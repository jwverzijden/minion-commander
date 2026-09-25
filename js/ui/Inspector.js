/**
 * Inspector.js — Floating panel shown when the player clicks a structure.
 *
 * - Storage buildings: choose the stored item type (also while under construction).
 * - Craft buildings (factory/smeltery): choose a recipe and inspect input/output
 *   inventories.
 * - Construction sites: live progress bar and per-material delivered/needed counts.
 */

import { RESOURCE_TYPES, RESOURCE_IDS, RECIPES, STATION_RECIPES } from '../data/resources.js';
import { CONFIG } from '../core/config.js';

/** Tile vein type -> resource id (stone/iron/copper map to their mined item). */
const VEIN_RESOURCE = { stone: 'stone', iron: 'ironOre', copper: 'copperOre' };

const MINION_STATE_LABELS = {
  idle: 'Idle',
  moving: 'Moving',
  working: 'Working',
  recharging: 'Recharging',
};

export class Inspector {
  constructor(el) {
    this.el = el;
    this.target = null; // { kind: 'building'|'vein'|'tree'|'minion', ... }
    this.building = null;
    this.minions = [];
    this._refs = {};
    this._state = null;
    this._storageType = null;
    this._paused = null;
  }

  get visible() {
    return !this.el.classList.contains('hidden');
  }

  show(target, minions = []) {
    this.target = target;
    this.building = target && target.kind === 'building' ? target.building : null;
    this.minions = minions || [];
    this._state = this.building ? this.building.state : null;
    this._storageType =
      this.building && this.building.inventory ? this.building.inventory.type : null;
    this._render();
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.target = null;
    this.building = null;
    this.minions = [];
    this._refs = {};
    this._state = null;
    this._storageType = null;
    this._paused = null;
  }

  /** Live-update dynamic values without rebuilding the whole panel. */
  refresh(minions) {
    const target = this.target;
    if (!target) return;
    if (minions) this.minions = minions;

    // Non-building targets have lightweight, in-place updates.
    if (target.kind !== 'building') {
      if (target.kind === 'minion') {
        if (target.minion.dead) {
          this.hide();
          return;
        }
        if (this._refs.age) this._refs.age.textContent = formatAge(target.minion.age);
        if (this._refs.state) {
          this._refs.state.textContent =
            MINION_STATE_LABELS[target.minion.state] || target.minion.state;
        }
        if (this._refs.batteryFill) {
          this._applyBattery(this._refs.batteryFill, this._refs.battery, target.minion.battery);
        }
      }
      return;
    }

    const b = this.building;

    // Re-render when the pause state changes.
    if (b.paused !== this._paused) {
      this._render();
      return;
    }

    // Re-render on structural changes (state transition, storage type change).
    if (b.state !== this._state) {
      this._state = b.state;
      this._storageType = b.inventory ? b.inventory.type : null;
      this._render();
      return;
    }
    if (b.inventory && b.inventory.type !== this._storageType) {
      this._storageType = b.inventory.type;
      this._render();
      return;
    }

    if (this._refs.count) {
      this._refs.count.textContent = `${b.inventory.total} / ${b.inventory.capacity}`;
    }
    if (this._refs.fill) {
      const pct = Math.round(b.progress * 100);
      this._refs.fill.style.width = `${pct}%`;
      if (this._refs.pct) this._refs.pct.textContent = `${pct}%`;
    }
    if (this._refs.matCounts) {
      for (const type in this._refs.matCounts) {
        this._refs.matCounts[type].textContent = String(b.delivered[type] || 0);
      }
    }
    if (this._refs.inputLabel && b.input) {
      this._refs.inputLabel.textContent = `Input (${b.input.total}/${b.input.capacity})`;
    }
    if (this._refs.outputLabel && b.output) {
      this._refs.outputLabel.textContent = `Output (${b.output.total}/${b.output.capacity})`;
    }
    this._renderInvList(this._refs.inputList, b.input);
    this._renderInvList(this._refs.outputList, b.output);
    if (this._refs.workList) this._updateWork(this._refs.workList);
  }

  _render() {
    const target = this.target;
    this.el.innerHTML = '';
    this._refs = {};

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '\u00d7';
    close.title = 'Close';
    close.addEventListener('click', () => this.hide());
    this.el.appendChild(close);

    if (!target) return;

    if (target.kind === 'building') {
      this._renderBuilding(target.building);
    } else if (target.kind === 'vein') {
      this._renderResource(VEIN_RESOURCE[target.vein] || target.vein, 'Vein');
    } else if (target.kind === 'tree') {
      this._renderResource('wood', 'Tree');
    } else if (target.kind === 'minion') {
      this._renderMinion(target.minion);
    }
  }

  _renderBuilding(b) {
    this._paused = b.paused;

    const h2 = document.createElement('h2');
    h2.textContent = b.def.name;
    this.el.appendChild(h2);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = b.def.description;
    this.el.appendChild(desc);

    this._renderStatus(b);

    if (b.state === 'built' && b.def.workplaces > 0) {
      this._renderPauseToggle(b);
    }

    if (b.def.kind === 'storage') {
      this._renderStorage(b);
    } else if (b.def.behavior === 'craft') {
      this._renderCraft(b);
    }

    // Live progress bars for timed work happening at this station.
    if (
      b.state === 'built' &&
      (b.def.behavior === 'craft' ||
        b.def.behavior === 'duplicate' ||
        b.def.behavior === 'recharge')
    ) {
      this._renderWork(b);
    }
  }

  _renderPauseToggle(b) {
    const btn = document.createElement('button');
    btn.className = 'pause-btn' + (b.paused ? ' paused' : '');
    btn.textContent = b.paused ? 'Paused — P to resume' : 'Running — P to pause';
    btn.title = 'Pause or resume work at this building (hotkey: P)';
    btn.addEventListener('click', () => {
      b.paused = !b.paused;
      this._render();
    });
    this.el.appendChild(btn);
  }

  _renderResource(resId, subtitle) {
    const res = RESOURCE_TYPES[resId];
    const h2 = document.createElement('h2');
    h2.textContent = res ? res.name : resId;
    this.el.appendChild(h2);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = subtitle;
    this.el.appendChild(desc);
  }

  _renderMinion(m) {
    const h2 = document.createElement('h2');
    h2.textContent = 'Minion';
    this.el.appendChild(h2);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = MINION_STATE_LABELS[m.state] || m.state;
    this.el.appendChild(desc);
    this._refs.state = desc;

    const current = document.createElement('div');
    current.className = 'current';
    const meta = document.createElement('span');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = 'Age';
    meta.appendChild(name);
    meta.appendChild(document.createTextNode(' '));
    const age = document.createElement('span');
    age.className = 'qty';
    age.textContent = formatAge(m.age);
    meta.appendChild(age);
    current.appendChild(meta);
    this.el.appendChild(current);
    this._refs.age = age;

    // Battery (value + progress bar).
    const batRow = document.createElement('div');
    batRow.className = 'progress-row';
    const batLabel = document.createElement('span');
    batLabel.className = 'progress-label';
    batLabel.textContent = 'Battery';
    batRow.appendChild(batLabel);
    const batVal = document.createElement('span');
    batVal.className = 'progress-pct';
    batRow.appendChild(batVal);
    this.el.appendChild(batRow);
    this._refs.battery = batVal;

    const batTrack = document.createElement('div');
    batTrack.className = 'progress-track';
    const batFill = document.createElement('div');
    batFill.className = 'progress-fill';
    batTrack.appendChild(batFill);
    this.el.appendChild(batTrack);
    this._refs.batteryFill = batFill;

    this._applyBattery(batFill, batVal, m.battery);
  }

  /** Set a battery bar's width, colour and label text from an hour value. */
  _applyBattery(fill, val, batteryHours) {
    const max = CONFIG.minion.maxBatteryHours;
    const frac = Math.max(0, Math.min(1, batteryHours / max));
    fill.style.width = `${Math.round(frac * 100)}%`;
    fill.style.background = frac > 0.3 ? '#6bdf8a' : '#ff6b6b';
    val.textContent = formatBattery(batteryHours);
  }

  _renderStatus(b) {
    if (b.state === 'built') {
      const st = document.createElement('p');
      st.className = 'desc';
      st.textContent = 'Finished';
      this.el.appendChild(st);
      return;
    }

    // Construction progress bar.
    const pct = Math.round(b.progress * 100);
    const row = document.createElement('div');
    row.className = 'progress-row';
    const label = document.createElement('span');
    label.className = 'progress-label';
    label.textContent = 'Construction';
    row.appendChild(label);
    const pctEl = document.createElement('span');
    pctEl.className = 'progress-pct';
    pctEl.textContent = `${pct}%`;
    row.appendChild(pctEl);
    this.el.appendChild(row);
    this._refs.pct = pctEl;

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    this.el.appendChild(track);
    this._refs.fill = fill;

    // Per-material delivered / needed.
    if (b.totalCostUnits > 0) {
      const h3 = document.createElement('h3');
      h3.textContent = 'Materials';
      this.el.appendChild(h3);

      const list = document.createElement('div');
      list.className = 'materials';
      this._refs.matCounts = {};
      for (const type in b.def.cost) {
        const need = b.def.cost[type];
        const have = b.delivered[type] || 0;
        const res = RESOURCE_TYPES[type];

        const r = document.createElement('div');
        r.className = 'mat-row';
        const sw = document.createElement('span');
        sw.className = 'swatch';
        if (res) sw.style.background = res.color;
        r.appendChild(sw);
        const name = document.createElement('span');
        name.className = 'mat-name';
        name.textContent = res ? res.name : type;
        r.appendChild(name);
        const cnt = document.createElement('span');
        cnt.className = 'mat-count';
        const haveEl = document.createElement('span');
        haveEl.textContent = String(have);
        cnt.appendChild(haveEl);
        cnt.appendChild(document.createTextNode(` / ${need}`));
        r.appendChild(cnt);
        this._refs.matCounts[type] = haveEl;
        list.appendChild(r);
      }
      this.el.appendChild(list);
    }
  }

  _renderStorage(b) {
    const inv = b.inventory;

    // Current contents (or preselection).
    const current = document.createElement('div');
    current.className = 'current';
    const storedType = inv.type;
    if (storedType && RESOURCE_TYPES[storedType]) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = RESOURCE_TYPES[storedType].color;
      current.appendChild(sw);

      const meta = document.createElement('span');
      meta.className = 'meta';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = RESOURCE_TYPES[storedType].name;
      meta.appendChild(name);
      meta.appendChild(document.createTextNode(' '));
      const qty = document.createElement('span');
      qty.className = 'qty';
      qty.textContent = `${inv.total} / ${inv.capacity}`;
      this._refs.count = qty;
      meta.appendChild(qty);
      current.appendChild(meta);
    } else {
      const sw = document.createElement('span');
      sw.className = 'empty';
      current.appendChild(sw);
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = inv.designatedType
        ? `Empty — will store ${RESOURCE_TYPES[inv.designatedType]?.name || inv.designatedType}`
        : 'Empty — no item selected';
      current.appendChild(meta);
    }
    this.el.appendChild(current);

    if (inv.type && inv.designatedType && inv.type !== inv.designatedType) {
      const hint = document.createElement('p');
      hint.className = 'desc';
      hint.textContent = `Currently holds ${RESOURCE_TYPES[inv.type]?.name}; will switch to ${RESOURCE_TYPES[inv.designatedType]?.name} when empty.`;
      this.el.appendChild(hint);
    }

    const h3 = document.createElement('h3');
    h3.textContent = 'Store item';
    this.el.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'item-grid';
    grid.appendChild(
      this._itemButton('None', null, inv.designatedType === null, () => {
        this.building.inventory.setDesignation(null);
        this._storageType = this.building.inventory.type;
        this._render();
      }),
    );
    for (const id of RESOURCE_IDS) {
      const res = RESOURCE_TYPES[id];
      grid.appendChild(
        this._itemButton(res.name, res.color, inv.designatedType === id, () => {
          this.building.inventory.setDesignation(id);
          this._storageType = this.building.inventory.type;
          this._render();
        }),
      );
    }
    this.el.appendChild(grid);
  }

  _renderCraft(b) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Craft recipe';
    this.el.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'item-grid';
    grid.appendChild(
      this._itemButton('None', null, b.designatedRecipe === null, () => {
        this.building.designatedRecipe = null;
        this._render();
      }),
    );

    const ids = STATION_RECIPES[b.def.id] || [];
    for (const id of ids) {
      const recipe = RECIPES[id];
      if (!recipe) continue;
      const out = RESOURCE_TYPES[recipe.output];
      const inputs = Object.keys(recipe.inputs)
        .map((t) => RESOURCE_TYPES[t]?.name || t)
        .join(' + ');
      const label = out ? `${out.name} (${inputs})` : id;
      grid.appendChild(
        this._itemButton(label, out?.color || '#888', b.designatedRecipe === id, () => {
          this.building.designatedRecipe = id;
          this._render();
        }),
      );
    }
    this.el.appendChild(grid);

    // Input / output inventories.
    const invH3 = document.createElement('h3');
    invH3.textContent = 'Inventories';
    this.el.appendChild(invH3);

    const inputLabel = document.createElement('div');
    inputLabel.className = 'inv-label';
    inputLabel.textContent = `Input (${b.input.total}/${b.input.capacity})`;
    this.el.appendChild(inputLabel);
    this._refs.inputLabel = inputLabel;
    const inputList = document.createElement('div');
    inputList.className = 'inv-list';
    this.el.appendChild(inputList);
    this._refs.inputList = inputList;

    const outputLabel = document.createElement('div');
    outputLabel.className = 'inv-label';
    outputLabel.textContent = `Output (${b.output.total}/${b.output.capacity})`;
    this.el.appendChild(outputLabel);
    this._refs.outputLabel = outputLabel;
    const outputList = document.createElement('div');
    outputList.className = 'inv-list';
    this.el.appendChild(outputList);
    this._refs.outputList = outputList;

    this._renderInvList(inputList, b.input);
    this._renderInvList(outputList, b.output);
  }

  _renderInvList(container, inv) {
    if (!container || !inv) return;
    const sig = JSON.stringify(inv.items);
    if (container._sig === sig) return;
    container._sig = sig;
    container.innerHTML = '';

    const types = Object.keys(inv.items);
    if (types.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Empty';
      container.appendChild(empty);
      return;
    }
    for (const type of types) {
      const res = RESOURCE_TYPES[type];
      const row = document.createElement('div');
      row.className = 'inv-row';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      if (res) sw.style.background = res.color;
      row.appendChild(sw);
      const name = document.createElement('span');
      name.className = 'inv-name';
      name.textContent = res ? res.name : type;
      row.appendChild(name);
      const qty = document.createElement('span');
      qty.className = 'inv-qty';
      qty.textContent = `\u00d7 ${inv.items[type]}`;
      row.appendChild(qty);
      container.appendChild(row);
    }
  }

  /** Render the "Work" section (craft / duplicate / recharge progress bars). */
  _renderWork(b) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Work';
    this.el.appendChild(h3);

    const list = document.createElement('div');
    list.className = 'work-list';
    this.el.appendChild(list);

    const empty = document.createElement('div');
    empty.className = 'inv-empty';
    empty.textContent = 'No active work';
    this.el.appendChild(empty);

    this._refs.workList = list;
    this._refs.workEmpty = empty;
    this._refs.workBars = new Map();
    this._updateWork(list);
  }

  /**
   * Collect the timed work currently happening at `b` by scanning minion tasks.
   * Buildings don't track their workers, so we derive it from each minion's task.
   */
  _workItems(b) {
    const items = [];
    for (const m of this.minions) {
      const t = m.task;
      if (!t) continue;
      const bid = t.buildingId ?? t.targetId;
      if (bid !== b.id) continue;

      if (t.type === 'craft') {
        const recipe = RECIPES[t.recipeId];
        const out = recipe ? RESOURCE_TYPES[recipe.output] : null;
        const working = m.state === 'working' && m.workTotal > 0;
        items.push({
          key: `craft:${m.id}:${t.recipeId}`,
          label: `Crafting ${out ? out.name : t.recipeId || 'item'}`,
          color: out ? out.color : null,
          pct: working ? this._workPct(m) : 0,
        });
      } else if (t.type === 'duplicate') {
        const working = m.state === 'working' && m.workTotal > 0;
        items.push({
          key: `duplicate:${m.id}`,
          label: 'Duplicating minion',
          color: null,
          pct: working ? this._workPct(m) : 0,
        });
      } else if (t.type === 'recharge' && m.state === 'recharging') {
        items.push({
          key: `recharge:${m.id}`,
          label: 'Recharging minion',
          color: null,
          pct: Math.min(1, m.battery / CONFIG.minion.maxBatteryHours),
        });
      }
    }
    return items;
  }

  /** Fraction [0,1] of a timed-work task that has elapsed. */
  _workPct(m) {
    if (m.workTotal <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - m.workRemaining / m.workTotal));
  }

  /** Reconcile the work list against the current set of active work items. */
  _updateWork(list) {
    if (!list) return;
    const items = this._workItems(this.building);
    if (this._refs.workEmpty) {
      this._refs.workEmpty.style.display = items.length ? 'none' : '';
    }
    const bars = this._refs.workBars || (this._refs.workBars = new Map());

    const seen = new Set();
    for (const it of items) {
      seen.add(it.key);
      let bar = bars.get(it.key);
      if (!bar) {
        bar = this._makeWorkBar();
        bars.set(it.key, bar);
        list.appendChild(bar.row);
      }
      bar.label.textContent = it.label;
      if (it.color) bar.fill.style.background = it.color;
      const pct = Math.round(it.pct * 100);
      bar.fill.style.width = `${pct}%`;
      bar.pct.textContent = `${pct}%`;
    }

    for (const [key, bar] of bars) {
      if (!seen.has(key)) {
        bar.row.remove();
        bars.delete(key);
      }
    }
  }

  _makeWorkBar() {
    const row = document.createElement('div');
    row.className = 'work-row';

    const head = document.createElement('div');
    head.className = 'progress-row';
    const label = document.createElement('span');
    label.className = 'progress-label';
    const pct = document.createElement('span');
    pct.className = 'progress-pct';
    head.appendChild(label);
    head.appendChild(pct);
    row.appendChild(head);

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    track.appendChild(fill);
    row.appendChild(track);

    return { row, label, pct, fill };
  }

  _itemButton(label, color, active, onClick) {
    const btn = document.createElement('button');
    btn.className = 'item-btn' + (active ? ' active' : '');
    if (color) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = color;
      btn.appendChild(sw);
    }
    btn.appendChild(document.createTextNode(label));
    btn.addEventListener('click', onClick);
    return btn;
  }
}

function formatAge(ageHours) {
  const days = ageHours / CONFIG.time.hoursPerDay;
  return `${days.toFixed(1)} / ${CONFIG.minion.lifespanDays} days`;
}

function formatBattery(batteryHours) {
  const max = CONFIG.minion.maxBatteryHours;
  const pct = Math.round((batteryHours / max) * 100);
  return `${batteryHours.toFixed(1)} / ${max} h (${pct}%)`;
}
