/**
 * TaskSystem.js — Generates jobs from workplaces/construction sites and drives
 * each minion through its current task.
 *
 * A task is a plain, serialisable object ({ type, step, ...data }). The minion
 * itself is just state + movement; all behaviour lives here so saving/loading
 * stays simple.
 */

import { CONFIG } from '../core/config.js';
import { RECIPES, STATION_RECIPES } from '../data/resources.js';
import { findPath } from './Pathfinding.js';

const LIFESPAN_HOURS = CONFIG.minion.lifespanDays * CONFIG.time.hoursPerDay;
const COLLECTABLE = new Set(['wood', 'stone', 'ironOre', 'copperOre', 'planks', 'gravel', 'gears', 'refinedPlanks', 'copperWire', 'ironIngot', 'copperIngot']);

function cheb(x1, y1, x2, y2) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export class TaskSystem {
  constructor(world, buildings, bus) {
    this.world = world;
    this.buildings = buildings;
    this.bus = bus;
  }

  // ------------------------------------------------------------- main loop

  update(minions, dt, timeHours) {
    for (const m of minions) {
      if (m.dead) continue;

      m.age += dt;
      if (m.age >= LIFESPAN_HOURS) {
        this._kill(m);
        continue;
      }

      // Depleted battery: finish a delivery in progress, otherwise abandon.
      if (m.battery <= 0 && m.task && m.task.type !== 'recharge') {
        if (m.carried) {
          m.lowBattery = true;
        } else {
          this._abandon(m);
        }
      }

      this._execute(m, dt, timeHours);
    }

    this._assign(minions);
  }

  // -------------------------------------------------------------- assignment

  _assign(minions) {
    const active = new Map(); // built workplace id -> busy slots
    const siteBusy = new Set(); // construction site ids being worked
    const rechargeBusy = new Set(); // recharge station ids in use

    for (const m of minions) {
      if (!m.task || m.task.buildingId == null) continue;
      if (m.task.type === 'recharge') rechargeBusy.add(m.task.buildingId);
      if (m.task.type === 'construct' || m.task.type === 'deliverToSite') {
        siteBusy.add(m.task.buildingId);
      }
      const b = this.buildings.getBuilding(m.task.buildingId);
      if (b && b.state === 'built' && b.def.workplaces > 0) {
        active.set(b.id, (active.get(b.id) || 0) + 1);
      }
    }

    // Track resources already claimed by active tasks (so two minions never
    // target the same tree/item) and which types currently have a sink.
    const claimed = new Set();
    const sinkTypes = new Set();
    for (const type of COLLECTABLE) {
      if (this._hasSinkFor(type)) sinkTypes.add(type);
    }
    for (const m of minions) {
      if (!m.task) continue;
      const t = m.task;
      if (t.type === 'collect') claimed.add(`collect:${t.x},${t.y}`);
      else if (t.type === 'cutTree') claimed.add(`cut:${t.x},${t.y}`);
      else if (t.type === 'drill') claimed.add(`drill:${t.x},${t.y}`);
      else if (t.type === 'replant') claimed.add(`replant:${t.x},${t.y}`);
    }

    // Gather candidate tasks. Construction is collected separately and pushed
    // first so minions build paths/infrastructure before gathering resources.
    const workCandidates = [];
    const constructionCandidates = [];
    for (const b of this.buildings.structures) {
      if (b.state === 'built' && b.def.workplaces > 0 && b.def.behavior) {
        const free = b.def.workplaces - (active.get(b.id) || 0);
        if (free <= 0) continue;
        const tasks = this._buildingTasks(b, claimed, sinkTypes).slice(0, free);
        for (const t of tasks) {
          t.buildingId = b.id;
          t.step = 0;
          workCandidates.push(t);
        }
      } else if (b.state === 'construction') {
        if (siteBusy.has(b.id)) continue;
        if (b.totalCostUnits === 0) {
          constructionCandidates.push({ type: 'construct', buildingId: b.id, step: 0 });
        } else {
          const door = b.doorTile();
          for (const mm of b.missingMaterials()) {
            const src = this.buildings.findSourceFor(mm.type, door.x, door.y);
            if (src) {
              constructionCandidates.push({ type: 'deliverToSite', buildingId: b.id, itemType: mm.type, source: src, step: 0 });
            }
          }
        }
      }
    }
    const candidates = constructionCandidates.concat(workCandidates);

    // Split idle minions: carried items first, then recharge, then the rest
    // form a pool of workers for building tasks.
    const pool = [];
    for (const m of minions) {
      if (m.dead || m.task || m.state !== 'idle') continue;

      // A minion holding an item must finish delivering it before new work.
      if (m.carried) {
        if (m.battery <= 0) m.lowBattery = true;
        m.task = { type: 'deliver', itemType: m.carried.type, step: 0 };
        if (this._planDelivery(m, m.carried.type)) continue;
        this._dropAtFeet(m, m.carried.type);
        m.task = null;
        continue;
      }

      if (m.battery <= 0) {
        const st = this._nearestRecharge(m, rechargeBusy);
        if (st) {
          m.task = { type: 'recharge', buildingId: st.id, step: 0 };
          rechargeBusy.add(st.id);
        }
        continue;
      }

      pool.push(m);
    }

    // Task-centric assignment: each task takes the closest idle minion, so a
    // distant minion never steals a job a nearby minion could do sooner.
    for (const t of candidates) {
      const tx = t.x ?? t.source?.x ?? 0;
      const ty = t.y ?? t.source?.y ?? 0;
      let best = null;
      let bestD = Infinity;
      let bestIdx = -1;
      for (let i = 0; i < pool.length; i++) {
        const d = cheb(pool[i].tileX(), pool[i].tileY(), tx, ty);
        if (d < bestD) {
          bestD = d;
          best = pool[i];
          bestIdx = i;
        }
      }
      if (best) {
        best.task = t;
        pool.splice(bestIdx, 1);
      }
    }
  }

  _nearestRecharge(m, busy) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings.built) {
      if (b.def.behavior !== 'recharge') continue;
      if (busy.has(b.id)) continue;
      const d = cheb(m.tileX(), m.tileY(), b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** True when some storage, construction site or craft building wants `type`. */
  _hasSinkFor(type) {
    if (this.buildings.sitesNeeding(type).length > 0) return true;
    for (const b of this.buildings.built) {
      if (b.def.kind === 'storage' && b.inventory.canAdd(type, 1)) return true;
      if (b.input && b.input.canAdd(type, 1)) {
        const ids = STATION_RECIPES[b.def.id] || [];
        for (const id of ids) {
          const recipe = RECIPES[id];
          if (recipe && recipe.inputs[type]) return true;
        }
      }
    }
    return false;
  }

  /** Build candidate tasks for a finished workplace building. */
  _buildingTasks(b, claimed, sinkTypes) {
    const r = CONFIG.station.radius;
    const cx = b.x + b.rotatedW / 2;
    const cy = b.y + b.rotatedH / 2;

    switch (b.def.behavior) {
      case 'collect': {
        const out = [];
        for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
            if (!this.world.inBounds(x, y)) continue;
            const t = this.world.tile(x, y);
            if (!t.groundItem || !COLLECTABLE.has(t.groundItem.type) || t.groundItem.qty <= 0) continue;
            if (!sinkTypes.has(t.groundItem.type)) continue; // no storage/factory/site wants it
            if (claimed.has(`collect:${x},${y}`)) continue; // already being collected
            out.push({ type: 'collect', itemType: t.groundItem.type, x, y });
          }
        }
        return out;
      }

      case 'cutTree': {
        const out = [];
        for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
            const t = this.world.tile(x, y);
            if (t && t.tree && t.tree.mature && !claimed.has(`cut:${x},${y}`)) {
              out.push({ type: 'cutTree', x, y });
            }
          }
        }
        return out;
      }

      case 'replant': {
        const out = [];
        for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
            const t = this.world.tile(x, y);
            if (t && t.isEmpty && !claimed.has(`replant:${x},${y}`)) {
              out.push({ type: 'replant', x, y });
            }
          }
        }
        return out;
      }

      case 'drill': {
        const out = [];
        for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
            const t = this.world.tile(x, y);
            if (t && t.vein && !claimed.has(`drill:${x},${y}`)) {
              out.push({ type: 'drill', itemType: t.vein === 'iron' ? 'ironOre' : 'copperOre', x, y });
            }
          }
        }
        return out;
      }

      case 'craft': {
        const out = [];
        if (!b.output.isEmpty) {
          const n = Math.min(b.def.workplaces, b.output.total);
          for (let i = 0; i < n; i++) out.push({ type: 'depositOutput' });
          return out;
        }
        const recipe = this._pickCraftRecipe(b);
        if (recipe) {
          out.push({ type: 'craft', recipeId: recipe.id });
          return out;
        }
        const fetch = this._pickFetchInput(b);
        if (fetch) {
          const n = Math.min(b.def.workplaces, b.input.capacity - b.input.total);
          for (let i = 0; i < n; i++) {
            out.push({ type: 'fetchInput', itemType: fetch.itemType, source: fetch.source });
          }
        }
        return out;
      }

      case 'transport': {
        // Help any crafting workplace move its output out and fetch its input.
        const out = [];
        for (const target of this.buildings.built) {
          if (target.output && !target.output.isEmpty) {
            out.push({ type: 'depositOutput', targetId: target.id });
          }
        }
        for (const target of this.buildings.built) {
          if (!target.input || target.input.isFull) continue;
          const fetch = this._pickFetchInput(target);
          if (fetch) {
            out.push({
              type: 'fetchInput',
              targetId: target.id,
              itemType: fetch.itemType,
              source: fetch.source,
            });
          }
        }
        return out;
      }

      case 'duplicate': {
        return [{ type: 'duplicate' }];
      }

      default:
        return [];
    }
  }

  _pickCraftRecipe(b) {
    if (b.designatedRecipe) {
      const recipe = RECIPES[b.designatedRecipe];
      return recipe && this._craftReady(b, recipe) ? recipe : null;
    }
    // const ids = STATION_RECIPES[b.def.id] || [];
    // for (const id of ids) {
    //   const recipe = RECIPES[id];
    //   if (recipe && this._craftReady(b, recipe)) return recipe;
    // }
    return null;
  }

  _pickFetchInput(b) {
    const ids = STATION_RECIPES[b.def.id] || [];
    const list = b.designatedRecipe ? [b.designatedRecipe] : ids;
    for (const id of list) {
      const recipe = RECIPES[id];
      if (!recipe) continue;
      for (const inp in recipe.inputs) {
        if (!b.input.canAdd(inp, 1)) continue;
        const src = this.buildings.findSourceFor(inp, b.x, b.y);
        if (src) return { itemType: inp, source: src };
      }
    }
    return null;
  }

  // -------------------------------------------------------------- execution

  _execute(m, dt, timeHours) {
    const t = m.task;
    if (!t) return;
    switch (t.type) {
      case 'collect':
        return this._tCollect(m, t, dt);
      case 'cutTree':
        return this._tCutTree(m, t, dt);
      case 'replant':
        return this._tReplant(m, t, dt, timeHours);
      case 'drill':
        return this._tDrill(m, t, dt);
      case 'craft':
        return this._tCraft(m, t, dt);
      case 'fetchInput':
        return this._tFetchInput(m, t, dt);
      case 'depositOutput':
        return this._tDepositOutput(m, t, dt);
      case 'deliverToSite':
        return this._tDeliverToSite(m, t, dt);
      case 'construct':
        return this._tConstruct(m, t, dt);
      case 'recharge':
        return this._tRecharge(m, t, dt);
      case 'duplicate':
        return this._tDuplicate(m, t, dt);
      case 'deliver':
        return this._stepDeliver(m, t, dt);
      default:
        this._done(m);
    }
  }

  // --- individual task handlers -------------------------------------------

  _tCollect(m, t, dt) {
    if (t.step === 0) {
      if (this._stepMove(m, t.x, t.y, null, dt)) t.step = 1;
    } else if (this._stepWork(m, CONFIG.work.collectHours, dt)) {
      const tile = this.world.tile(t.x, t.y);
      if (tile && tile.groundItem && tile.groundItem.type === t.itemType && tile.groundItem.qty > 0) {
        tile.groundItem.qty -= 1;
        if (tile.groundItem.qty <= 0) tile.groundItem = null;
        m.carried = { type: t.itemType, qty: 1 };
        if (!this._planDelivery(m, t.itemType)) this._done(m);
      } else {
        this._done(m);
      }
    }
  }

  _tCutTree(m, t, dt) {
    if (t.step === 0) {
      if (this._stepMove(m, t.x, t.y, { x: t.x, y: t.y }, dt)) t.step = 1;
    } else if (this._stepWork(m, CONFIG.work.cutTreeHours, dt)) {
      const tile = this.world.tile(t.x, t.y);
      if (tile && tile.tree) {
        tile.tree = null;
        if (tile.groundItem && tile.groundItem.type === 'wood') tile.groundItem.qty += CONFIG.trees.dropsPerCut;
        else tile.groundItem = { type: 'wood', qty: CONFIG.trees.dropsPerCut };
        tile.groundItem.qty -= 1;
        if (tile.groundItem.qty <= 0) tile.groundItem = null;
        m.carried = { type: 'wood', qty: 1 };
        if (!this._planDelivery(m, 'wood')) this._done(m);
      } else {
        this._done(m);
      }
    }
  }

  _tReplant(m, t, dt, timeHours) {
    if (t.step === 0) {
      if (this._stepMove(m, t.x, t.y, null, dt)) t.step = 1;
    } else if (this._stepWork(m, CONFIG.work.replantHours, dt)) {
      const tile = this.world.tile(t.x, t.y);
      if (tile && tile.isEmpty) {
        tile.tree = { mature: false, plantedAtHours: timeHours };
      }
      this._done(m);
    }
  }

  _tDrill(m, t, dt) {
    if (t.step === 0) {
      if (this._stepMove(m, t.x, t.y, { x: t.x, y: t.y }, dt)) t.step = 1;
    } else if (this._stepWork(m, CONFIG.work.collectHours, dt)) {
      const tile = this.world.tile(t.x, t.y);
      if (tile && tile.vein) {
        if (tile.groundItem && tile.groundItem.type === t.itemType) tile.groundItem.qty += 1;
        else tile.groundItem = { type: t.itemType, qty: 1 };
        tile.groundItem.qty -= 1;
        if (tile.groundItem.qty <= 0) tile.groundItem = null;
        m.carried = { type: t.itemType, qty: 1 };
        if (!this._planDelivery(m, t.itemType)) this._done(m);
      } else {
        this._done(m);
      }
    }
  }

  _tCraft(m, t, dt) {
    const b = this.buildings.getBuilding(t.targetId ?? t.buildingId);
    if (!b || b.state !== 'built') return this._done(m);
    if (t.step === 0) {
      const door = b.doorTile();
      if (this._stepMove(m, door.x, door.y, null, dt)) t.step = 1;
      return;
    }
    const recipe = RECIPES[t.recipeId];
    if (!recipe || !this._craftReady(b, recipe)) return this._done(m);
    if (this._stepWork(m, recipe.hours, dt)) {
      for (const inp in recipe.inputs) b.input.remove(inp, recipe.inputs[inp]);
      b.output.add(recipe.output, 1);
      this._done(m);
    }
  }

  _craftReady(b, recipe) {
    for (const inp in recipe.inputs) {
      if (b.input.count(inp) < recipe.inputs[inp]) return false;
    }
    return b.output.canAdd(recipe.output, 1);
  }

  _tFetchInput(m, t, dt) {
    const b = this.buildings.getBuilding(t.targetId ?? t.buildingId);
    if (!b || b.state !== 'built') return this._done(m);

    if (t.step === 0) {
      if (this._stepMove(m, t.source.x, t.source.y, null, dt)) {
        if (this._takeFromSource(m, t.itemType, t.source)) {
          m.carried = { type: t.itemType, qty: 1 };
          t.step = 1;
        } else {
          this._done(m);
        }
      }
      return;
    }
    // step 1: return to the building and deposit into its input buffer.
    const door = b.doorTile();
    if (!this._stepMove(m, door.x, door.y, null, dt)) return;
    if (b.input.canAdd(t.itemType, 1)) {
      b.input.add(t.itemType, 1);
      m.carried = null;
      this._done(m);
    } else {
      // Input filled up while we were travelling — reroute the carried item.
      if (this._planDelivery(m, t.itemType)) return;
      this._dropAtFeet(m, t.itemType);
      this._done(m);
    }
  }

  _tDepositOutput(m, t, dt) {
    const b = this.buildings.getBuilding(t.targetId ?? t.buildingId);
    if (!b || b.state !== 'built') return this._done(m);
    const door = b.doorTile();
    if (!this._stepMove(m, door.x, door.y, null, dt)) return;
    const type = b.output.peek();
    if (type && b.output.remove(type, 1) > 0) {
      m.carried = { type, qty: 1 };
      if (!this._planDelivery(m, type)) this._done(m);
    } else {
      this._done(m);
    }
  }

  _tDeliverToSite(m, t, dt) {
    const site = this.buildings.getBuilding(t.buildingId);
    if (!site || site.state !== 'construction') return this._done(m);

    if (t.step === 0) {
      if (this._stepMove(m, t.source.x, t.source.y, null, dt)) {
        if (this._takeFromSource(m, t.itemType, t.source)) {
          m.carried = { type: t.itemType, qty: 1 };
          t.step = 1;
        } else {
          this._done(m);
        }
      }
      return;
    }
    const dest = this._deliveryPoint(site, m);
    if (!this._stepMove(m, dest.x, dest.y, null, dt)) return;
    if (site.deliver(t.itemType)) {
      m.carried = null;
      this._done(m);
    } else {
      if (this._planDelivery(m, t.itemType)) return;
      this._dropAtFeet(m, t.itemType);
      this._done(m);
    }
  }

  _tConstruct(m, t, dt) {
    const site = this.buildings.getBuilding(t.buildingId);
    if (!site || site.state !== 'construction') return this._done(m);

    if (t.step === 0) {
      const dest = this._deliveryPoint(site, m);
      if (this._stepMove(m, dest.x, dest.y, null, dt)) t.step = 1;
      return;
    }
    m.state = 'working';
    this._drain(m, dt);
    site.finishProgress = Math.min(CONFIG.work.constructHours, site.finishProgress + dt);
    if (site.finishProgress >= CONFIG.work.constructHours) {
      site.state = 'built';
      this._done(m);
    }
  }

  _tRecharge(m, t, dt) {
    const b = this.buildings.getBuilding(t.buildingId);
    if (!b || b.state !== 'built') return this._done(m);
    if (t.step === 0) {
      const door = b.doorTile();
      if (this._stepMove(m, door.x, door.y, null, dt)) {
        m.state = 'recharging';
        t.step = 1;
      }
      return;
    }
    m.state = 'recharging';
    m.battery = Math.min(
      CONFIG.minion.maxBatteryHours,
      m.battery + CONFIG.minion.rechargeRateHoursPerHour * dt,
    );
    if (m.battery >= CONFIG.minion.maxBatteryHours) {
      m.lowBattery = false;
      this._done(m);
    }
  }

  _tDuplicate(m, t, dt) {
    const b = this.buildings.getBuilding(t.buildingId);
    if (!b || b.state !== 'built') return this._done(m);
    if (t.step === 0) {
      const door = b.doorTile();
      if (this._stepMove(m, door.x, door.y, null, dt)) t.step = 1;
      return;
    }
    if (this._stepWork(m, CONFIG.work.duplicateHours, dt)) {
      const door = b.doorTile();
      const spawn = this._freeTileNear(door.x, door.y);
      this.bus.emit('minion-spawn', { x: spawn.x, y: spawn.y });
      this._done(m);
    }
  }

  /** A walkable tile next to (x, y), used to place a freshly duplicated minion. */
  _freeTileNear(x, y) {
    for (const n of this.world.neighbors4(x, y)) {
      if (this.world.isWalkable(n.x, n.y)) return n;
    }
    return { x, y };
  }

  // --- shared movement / work / delivery helpers ---------------------------

  /** Move toward a tile. Returns true once arrived (or if already there). */
  _stepMove(m, tx, ty, goal, dt) {
    if (m.tileX() === tx && m.tileY() === ty) {
      m.path = [];
      m.state = 'idle';
      return true;
    }
    if (m.state !== 'moving' || m.path.length === 0) {
      const path = findPath(this.world, m.tileX(), m.tileY(), tx, ty, { goal });
      if (!path || path.length === 0) {
        this._abandon(m);
        return true;
      }
      m.setPathTo(tx, ty, path);
    }
    if (m.carried) this._drain(m, dt);
    const arrived = m.moveAlongPath(this.world, dt);
    if (arrived) {
      m.state = 'idle';
      return true;
    }
    return false;
  }

  /** Perform timed work; returns true when the timer finishes. */
  _stepWork(m, hours, dt) {
    if (m.state !== 'working') {
      m.workRemaining = hours;
      m.workTotal = hours;
      m.state = 'working';
    }
    this._drain(m, dt);
    m.workRemaining -= dt;
    return m.workRemaining <= 0;
  }

  _stepDeliver(m, t, dt) {
    if (!this._stepMove(m, t.dest.x, t.dest.y, null, dt)) return false;
    if (this._tryDeposit(m, t)) {
      m.carried = null;
      this._done(m);
      return true;
    }
    // Destination no longer valid — try elsewhere.
    if (this._planDelivery(m, t.itemType)) return false;
    this._dropAtFeet(m, t.itemType);
    this._done(m);
    return true;
  }

  _tryDeposit(m, t) {
    const itemType = t.itemType;
    if (t.destKind === 'site') {
      const site = this.buildings.getBuilding(t.siteId);
      return !!(site && site.state === 'construction' && site.deliver(itemType));
    }
    if (t.destKind === 'storage') {
      const storage = this.buildings.getBuilding(t.storageId);
      return !!(storage && storage.state === 'built' && storage.inventory.add(itemType, 1) > 0);
    }
    if (t.destKind === 'ground') {
      const tile = this.world.tile(t.dest.x, t.dest.y);
      if (!tile || tile.structure || tile.tree || tile.vein || tile.biome === 'river') return false;
      if (tile.groundItem && tile.groundItem.type !== itemType) return false;
      if (tile.groundItem) tile.groundItem.qty += 1;
      else tile.groundItem = { type: itemType, qty: 1 };
      return true;
    }
    return false;
  }

  /** Decide where a freshly-acquired item should go; morph task into `deliver`. */
  _planDelivery(m, itemType) {
    const t = m.task;

    const sites = this.buildings.sitesNeeding(itemType);
    if (sites.length) {
      let best = sites[0];
      let bestD = Infinity;
      for (const s of sites) {
        const d = cheb(m.tileX(), m.tileY(), s.x, s.y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      t.type = 'deliver';
      t.itemType = itemType;
      t.dest = this._deliveryPoint(best, m);
      t.destKind = 'site';
      t.siteId = best.id;
      t.step = 0;
      return true;
    }

    const storage = this.buildings.storageAccepting(itemType, m.tileX(), m.tileY());
    if (storage) {
      t.type = 'deliver';
      t.itemType = itemType;
      t.dest = this._deliveryPoint(storage, m);
      t.destKind = 'storage';
      t.storageId = storage.id;
      t.step = 0;
      return true;
    }

    const drop = this.buildings.findDropTile(itemType, [{ x: m.tileX(), y: m.tileY() }]);
    if (drop) {
      t.type = 'deliver';
      t.itemType = itemType;
      t.dest = drop;
      t.destKind = 'ground';
      t.step = 0;
      return true;
    }
    return false;
  }

  /** A walkable tile to stand on while interacting with a building. */
  _deliveryPoint(building, m) {
    const door = building.doorTile();
    if (this.world.isWalkable(door.x, door.y)) return { x: door.x, y: door.y };

    // Construction site: deliver from the nearest walkable adjacent tile so a
    // minion doesn't walk around to an arbitrary far side of the site.
    let best = null;
    let bestD = Infinity;
    const seen = new Set();
    for (const ft of building.footprintTiles()) {
      for (const n of this.world.neighbors4(ft.x, ft.y)) {
        const k = `${n.x},${n.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (!this.world.isWalkable(n.x, n.y)) continue;
        const d = cheb(n.x, n.y, m.tileX(), m.tileY());
        if (d < bestD) {
          bestD = d;
          best = { x: n.x, y: n.y };
        }
      }
    }
    return best || { x: door.x, y: door.y };
  }

  _takeFromSource(m, type, source) {
    if (source.kind === 'ground') {
      const tile = this.world.tile(source.x, source.y);
      if (tile && tile.groundItem && tile.groundItem.type === type && tile.groundItem.qty > 0) {
        tile.groundItem.qty -= 1;
        if (tile.groundItem.qty <= 0) tile.groundItem = null;
        return true;
      }
      return false;
    }
    if (source.kind === 'storage') {
      const b = this.buildings.getBuilding(source.buildingId);
      return !!(b && b.state === 'built' && b.inventory.remove(type, 1) > 0);
    }
    return false;
  }

  _dropAtFeet(m, itemType) {
    const tile = this.world.tile(m.tileX(), m.tileY());
    if (tile && !(tile.structure && tile.structure.def.kind !== 'path' && tile.structure.def.kind !== 'fastPath') && tile.biome !== 'river') {
      if (!tile.groundItem || tile.groundItem.type === itemType) {
        if (tile.groundItem) tile.groundItem.qty += 1;
        else tile.groundItem = { type: itemType, qty: 1 };
      }
    }
    m.carried = null;
  }

  // ------------------------------------------------------------- termination

  _drain(m, dt) {
    m.battery = Math.max(0, m.battery - dt);
  }

  _done(m) {
    // Never leave a minion idle while still carrying something.
    if (m.carried) this._dropAtFeet(m, m.carried.type);
    m.task = null;
    m.state = 'idle';
    m.path = [];
    m.workRemaining = 0;
    m.lowBattery = false;
  }

  _abandon(m) {
    if (m.carried) this._dropAtFeet(m, m.carried.type);
    this._done(m);
  }

  _kill(m) {
    if (m.carried) this._dropAtFeet(m, m.carried.type);
    m.dead = true;
    m.task = null;
    this.bus.emit('minion-died', { x: m.tileX(), y: m.tileY() });
  }
}
