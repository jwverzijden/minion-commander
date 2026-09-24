/**
 * Inspector.js — Floating panel shown when the player clicks a structure.
 *
 * - Storage buildings: choose the stored item type (also while under construction).
 * - Craft buildings (factory/smeltery): choose a recipe and inspect input/output
 *   inventories.
 * - Construction sites: live progress bar and per-material delivered/needed counts.
 */

import { RESOURCE_TYPES, RESOURCE_IDS, RECIPES, STATION_RECIPES } from '../data/resources.js';

export class Inspector {
  constructor(el) {
    this.el = el;
    this.building = null;
    this._refs = {};
    this._state = null;
    this._storageType = null;
  }

  get visible() {
    return !this.el.classList.contains('hidden');
  }

  show(building) {
    this.building = building;
    this._state = building.state;
    this._storageType = building.inventory ? building.inventory.type : null;
    this._render();
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.building = null;
    this._refs = {};
    this._state = null;
    this._storageType = null;
  }

  /** Live-update dynamic values without rebuilding the whole panel. */
  refresh() {
    const b = this.building;
    if (!b) return;

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
  }

  _render() {
    const b = this.building;
    this.el.innerHTML = '';
    this._refs = {};

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '\u00d7';
    close.title = 'Close';
    close.addEventListener('click', () => this.hide());
    this.el.appendChild(close);

    const h2 = document.createElement('h2');
    h2.textContent = b.def.name;
    this.el.appendChild(h2);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = b.def.description;
    this.el.appendChild(desc);

    this._renderStatus(b);

    if (b.def.kind === 'storage') {
      this._renderStorage(b);
    } else if (b.def.behavior === 'craft') {
      this._renderCraft(b);
    }
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
      this._itemButton('Auto', null, inv.designatedType === null, () => {
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
      this._itemButton('Auto', null, b.designatedRecipe === null, () => {
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
