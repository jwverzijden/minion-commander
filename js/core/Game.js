/**
 * Game.js — Top-level orchestrator.
 *
 * Owns the world, buildings, minions, time, save state, camera, renderer,
 * input and UI, and runs the fixed loop. It is the only module that knows
 * about every other module; the library pieces stay decoupled underneath it.
 */

import { CONFIG } from './config.js';
import { bus } from './EventBus.js';
import { GameTime } from './GameTime.js';
import { SaveManager } from './SaveManager.js';
import { generateWorld } from '../world/WorldGenerator.js';
import { BuildingManager } from '../buildings/BuildingManager.js';
import { Building } from '../buildings/Building.js';
import { Minion } from '../entities/Minion.js';
import { TaskSystem } from '../systems/TaskSystem.js';
import { buildingDef } from '../data/buildings.js';
import { Camera } from '../rendering/Camera.js';
import { Renderer } from '../rendering/Renderer.js';
import { Input } from '../input/Input.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { Inspector } from '../ui/Inspector.js';

const PAN_SPEED = 700; // px/sec of camera panning
const PATH_KINDS = new Set(['path', 'fastPath', 'bridge']);

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.camera = new Camera(CONFIG.world.size);
    this.renderer = new Renderer(this.canvas, this.camera);
    this.input = new Input(this.canvas);
    this.menu = new Menu(document.getElementById('overlay'));
    this.hud = new HUD(
      document.getElementById('status-bar'),
      document.getElementById('hotbar'),
      document.getElementById('toasts'),
    );
    this.saveManager = new SaveManager();
    this.inspector = new Inspector(document.getElementById('inspector'));
    this.time = new GameTime();

    this.world = null;
    this.buildings = null;
    this.taskSystem = null;
    this.minions = [];
    this.seed = 0;
    this.startX = CONFIG.world.size / 2;
    this.startY = CONFIG.world.size / 2;

    this.state = 'menu'; // 'menu' | 'playing'
    this.paused = false;
    this.menuVisible = true;

    this.selectedId = null;
    this.ghost = null; // { def, x, y, rotation, valid }
    this.drag = null; // { start:{x,y}, current:{x,y} }
    this.dragPreview = []; // array of {x,y} along the drag line

    this.lastMs = performance.now();
    this.lastLostToast = 0;

    this._wire();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    bus.on('minion-died', () => this.hud.toast('A minion has died', 'warn'));
    bus.on('minion-spawn', ({ x, y }) => {
      this.minions.push(new Minion(x, y));
      this.hud.toast('A new minion was created!', 'info');
    });
  }

  start() {
    this._showMainMenu();
    requestAnimationFrame((t) => this._loop(t));
  }

  // -------------------------------------------------------------- lifecycle

  newGame() {
    this.seed = (Math.random() * 2 ** 31) >>> 0;
    const gen = generateWorld(this.seed);
    this.world = gen.world;
    this.startX = gen.start.x;
    this.startY = gen.start.y;
    this.buildings = new BuildingManager(this.world);
    this.time = new GameTime();
    this.minions = gen.start.spawnPositions.map((p) => new Minion(p.x, p.y));
    this.taskSystem = new TaskSystem(this.world, this.buildings, bus);
    this._startPlaying();
    this.saveGame();
  }

  continueGame() {
    const data = this.saveManager.load();
    if (!data) {
      this.hud.toast('No save found', 'warn');
      this._showMainMenu();
      return;
    }
    this._load(data);
    this._startPlaying();
  }

  exitToMenu() {
    this.saveGame();
    this.menu.hide();
    this.menuVisible = false;
    this.state = 'menu';
    this._clearSelection();
    this._showMainMenu();
  }

  resumeGame() {
    this.menu.hide();
    this.menuVisible = false;
    this.paused = false;
  }

  _startPlaying() {
    this.state = 'playing';
    this.paused = false;
    this.menu.hide();
    this.menuVisible = false;
    this._clearSelection();
    this.camera.rotation = 0;
    this.camera.centerOn(this.startX, this.startY);
  }

  _showMainMenu() {
    this.menuVisible = true;
    this.menu.showMainMenu({
      hasSave: this.saveManager.hasSave(),
      onNew: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onControls: () => this.menu.showControls(() => this._showMainMenu()),
    });
  }

  // ------------------------------------------------------------------ save

  saveGame() {
    if (!this.world) return false;
    const tiles = [];
    for (const t of this.world.forEachTile()) {
      if (t.tree || t.vein || t.groundItem) {
        tiles.push({ x: t.x, y: t.y, tree: t.tree, vein: t.vein, groundItem: t.groundItem });
      }
    }
    return this.saveManager.save({
      version: 1,
      seed: this.seed,
      startX: this.camera.cx,
      startY: this.camera.cy,
      time: this.time.toJSON(),
      tiles,
      buildings: this.buildings.structures.map((b) => b.toJSON()),
      minions: this.minions.filter((m) => !m.dead).map((m) => m.toJSON()),
    });
  }

  _load(data) {
    this.seed = data.seed;
    this.startX = data.startX ?? this.worldSizeSafe() / 2;
    this.startY = data.startY ?? this.worldSizeSafe() / 2;

    this.world = generateWorld(this.seed).world;
    this.time.fromJSON(data.time);

    // Rebuild the exact runtime tile state.
    for (const t of this.world.forEachTile()) {
      t.tree = null;
      t.vein = null;
      t.groundItem = null;
    }
    for (const e of data.tiles || []) {
      const t = this.world.tile(e.x, e.y);
      if (t) {
        t.tree = e.tree ?? null;
        t.vein = e.vein ?? null;
        t.groundItem = e.groundItem ?? null;
      }
    }

    this.buildings = new BuildingManager(this.world);
    for (const bd of data.buildings || []) {
      const def = buildingDef(bd.def);
      if (def) this.buildings.structures.push(Building.fromJSON(bd, def));
    }
    this.buildings.relink();

    this.minions = (data.minions || []).map((o) => Minion.fromJSON(o));
    this.taskSystem = new TaskSystem(this.world, this.buildings, bus);
  }

  worldSizeSafe() {
    return CONFIG.world.size;
  }

  // --------------------------------------------------------------- main loop

  _loop(nowMs) {
    const dt = (nowMs - this.lastMs) / 1000;
    this.lastMs = nowMs;

    // Keep the canvas sized to its CSS box (handles the initial layout too).
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w && h && (w !== this.renderer.width || h !== this.renderer.height)) {
      this.renderer.resize(w, h);
    }

    if (this.state === 'playing' && !this.menuVisible) {
      this._handlePan(dt);
      if (!this.paused) {
        this._update(dt);
      } else if (this.ghost) {
        this._updateGhost();
      }
    }

    if (this.world) {
      this.renderer.render(this);
      this.hud.update(this);
      if (this.inspector.visible) this.inspector.refresh();
    }

    requestAnimationFrame((t) => this._loop(t));
  }

  _handlePan(dt) {
    let dx = 0;
    let dy = 0;
    if (this.input.isDown('a') || this.input.isDown('arrowleft')) dx -= 1;
    if (this.input.isDown('d') || this.input.isDown('arrowright')) dx += 1;
    if (this.input.isDown('w') || this.input.isDown('arrowup')) dy -= 1;
    if (this.input.isDown('s') || this.input.isDown('arrowdown')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      this.camera.pan(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt);
      if (this.ghost) this._updateGhost();
    }
  }

  _update(dt) {
    const realDt = Math.min(dt, 0.25);
    const dtHours = realDt / CONFIG.time.secondsPerHour;
    const crossed = this.time.advance(realDt);

    this.taskSystem.update(this.minions, dtHours, this.time.hours);
    this._growTrees();
    this.minions = this.minions.filter((m) => !m.dead);

    if (this.ghost) this._updateGhost();

    if (crossed) {
      this.saveGame();
      this.hud.toast(`Day ${this.time.day} — autosaved`, 'info');
    }

    this._checkLostMinions();
  }

  _growTrees() {
    const matureAfter = CONFIG.trees.growDays * CONFIG.time.hoursPerDay;
    for (const t of this.world.forEachTile()) {
      if (t.tree && !t.tree.mature && this.time.hours - t.tree.plantedAtHours >= matureAfter) {
        t.tree.mature = true;
      }
    }
  }

  _checkLostMinions() {
    if (performance.now() - this.lastLostToast < 30000) return;
    for (const m of this.minions) {
      if (!m.dead && !this.world.hasPathNear(m.tileX(), m.tileY(), CONFIG.minion.radiusRescue)) {
        this.lastLostToast = performance.now();
        this.hud.toast('A minion is lost — build a path to it!', 'warn');
        break;
      }
    }
  }

  // ------------------------------------------------------------------ input

  _wire() {
    this.input.onKeyDown = (key) => this._onKeyDown(key);
    this.input.onMouseDown = (button) => this._onMouseDown(button);
    this.input.onMouseUp = (button) => this._onMouseUp(button);
    this.input.onMouseMove = () => this._onMouseMove();
    this.hud.onSelect = (id) => this.selectBuilding(id);
    this.hud.setPauseHandler(() => this.togglePause());
  }

  _onKeyDown(key) {
    if (this.state !== 'playing') return;

    if (this.menuVisible) {
      if (key === 'escape') this.resumeGame();
      return;
    }

    switch (key) {
      case ' ':
        this.togglePause();
        break;
      case 'escape':
        this._onEscape();
        break;
      case 'r':
        if (this.ghost) {
          this.ghost.rotation = (this.ghost.rotation + 1) % 4;
          this._updateGhost();
        }
        break;
      case 'e':
        this.camera.rotate(1);
        this._updateGhost();
        break;
      case 'q':
        this.camera.rotate(-1);
        this._updateGhost();
        break;
      case 'x':
      case 'delete':
        this._demolishUnderCursor();
        break;
      default:
        break;
    }
  }

  _onMouseDown(button) {
    if (this.state !== 'playing' || this.menuVisible) return;
    if (button === 2) {
      this._clearSelection();
      return;
    }
    if (button !== 0) return;

    const tile = this.input.tileUnderMouse(this.camera);

    if (this.selectedId) {
      const def = buildingDef(this.selectedId);
      if (!def) return;
      if (PATH_KINDS.has(def.kind)) {
        this.drag = { start: { x: tile.x, y: tile.y }, current: { x: tile.x, y: tile.y } };
        this._updateDragPreview();
      } else {
        this._placeAt(tile.x, tile.y);
      }
      return;
    }

    // No building selected: inspect the structure under the cursor
    // (construction sites included, so the player can track progress and
    // preselect a storage type or crafting recipe).
    const b = this.buildings.getAt(tile.x, tile.y);
    if (b) {
      this.inspector.show(b);
    } else {
      this.inspector.hide();
    }
  }

  _onMouseMove() {
    if (this.state !== 'playing' || this.menuVisible) return;
    if (this.drag) {
      const tile = this.input.tileUnderMouse(this.camera);
      this.drag.current = { x: tile.x, y: tile.y };
      this._updateDragPreview();
    } else if (this.ghost) {
      this._updateGhost();
    }
  }

  _onMouseUp(button) {
    if (button !== 0 || !this.drag) return;
    this._placeDragPath();
    this.drag = null;
    this.dragPreview = [];
  }

  _onEscape() {
    if (this.ghost || this.drag) {
      this._clearSelection();
      return;
    }
    if (this.inspector.visible) {
      this.inspector.hide();
      return;
    }
    this.paused = true;
    this.saveGame();
    this.menuVisible = true;
    this.menu.showPauseMenu({
      onResume: () => this.resumeGame(),
      onSaveAndExit: () => this.exitToMenu(),
    });
  }

  togglePause() {
    if (this.state !== 'playing' || this.menuVisible) return;
    this.paused = !this.paused;
  }

  // ---------------------------------------------------------------- building

  selectBuilding(id) {
    if (!this.buildings || this.state !== 'playing' || this.menuVisible) return;
    this.inspector.hide();
    this.selectedId = id;
    this.ghost = id ? { def: buildingDef(id), x: 0, y: 0, rotation: 0, valid: false } : null;
    this.drag = null;
    this.dragPreview = [];
    this.hud.setSelected(id);
    this._updateGhost();
  }

  _clearSelection() {
    this.selectedId = null;
    this.ghost = null;
    this.drag = null;
    this.dragPreview = [];
    this.hud.setSelected(null);
    this.inspector.hide();
  }

  _updateGhost() {
    if (!this.selectedId) return;
    const tile = this.input.tileUnderMouse(this.camera);
    this.ghost.x = tile.x;
    this.ghost.y = tile.y;
    this.ghost.valid = this.buildings.validate(this.selectedId, tile.x, tile.y, this.ghost.rotation).ok;
  }

  _placeAt(x, y) {
    const res = this.buildings.add(this.selectedId, x, y, this.ghost?.rotation ?? 0);
    if (!res.ok) this.hud.toast(res.reason || 'Cannot place here', 'warn');
  }

  _updateDragPreview() {
    this.dragPreview = lineTiles(this.drag.start, this.drag.current).filter((p) =>
      this.world.inBounds(p.x, p.y),
    );
  }

  _placeDragPath() {
    let placed = 0;
    for (const p of this.dragPreview) {
      if (this.buildings.add(this.selectedId, p.x, p.y, 0).ok) placed++;
    }
    if (placed === 0 && this.dragPreview.length > 0) {
      this.hud.toast('Cannot place path there', 'warn');
    }
  }

  _demolishUnderCursor() {
    const tile = this.input.tileUnderMouse(this.camera);
    const b = this.buildings.getAt(tile.x, tile.y);
    if (!b) {
      this.hud.toast('No building here', 'warn');
      return;
    }

    const refund = this.buildings.destroy(b);
    if (this.inspector.building === b) this.inspector.hide();

    // Clear minion tasks that reference the demolished building; carried items
    // will be re-routed to a new destination by the task system.
    for (const m of this.minions) {
      if (m.task && (m.task.buildingId === b.id || m.task.siteId === b.id || m.task.storageId === b.id)) {
        m.task = null;
        m.state = 'idle';
        m.path = [];
      }
    }

    const parts = Object.entries(refund)
      .map(([t, q]) => `${q} ${t}`)
      .join(', ');
    this.hud.toast(`Demolished ${b.def.name}${parts ? ` — refunded ${parts}` : ''}`, 'info');
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w && h) this.renderer.resize(w, h);
  }
}

/** Bresenham line between two tiles (inclusive). */
function lineTiles(a, b) {
  const pts = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return pts;
}
