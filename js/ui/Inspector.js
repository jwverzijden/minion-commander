/**
 * Inspector.js — Floating panel shown when the player clicks a finished
 * building. Storage buildings let the player choose the stored item type;
 * craft buildings (factory/smeltery) let the player choose a recipe.
 */

import { RESOURCE_TYPES, RESOURCE_IDS, RECIPES, STATION_RECIPES } from '../data/resources.js';

export class Inspector {
  constructor(el) {
    this.el = el;
    this.building = null;
    this.countEl = null;
  }

  get visible() {
    return !this.el.classList.contains('hidden');
  }

  show(building) {
    this.building = building;
    this._render();
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.building = null;
    this.countEl = null;
  }

  /** Update dynamic text (count) without rebuilding the whole panel. */
  refresh() {
    if (!this.building || this.building.def.kind !== 'storage' || !this.countEl) return;
    this.countEl.textContent = `${this.building.inventory.total} / ${this.building.inventory.capacity}`;
  }

  _render() {
    const b = this.building;
    this.el.innerHTML = '';

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '\u00d7';
    close.title = 'Close';
    close.addEventListener('click', () => this.hide());
    this.el.appendChild(close);

    const h2 = document.createElement('h2');
    h2.textContent = b.def.name;
    this.el.appendChild(h2);

    if (b.def.kind === 'storage') {
      this._renderStorage(b);
    } else if (b.def.behavior === 'craft') {
      this._renderCraft(b);
    } else {
      const desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = b.def.description;
      this.el.appendChild(desc);
      const state = document.createElement('p');
      state.className = 'desc';
      state.textContent = b.state === 'built' ? 'Finished' : `Under construction (${Math.round(b.progress * 100)}%)`;
      this.el.appendChild(state);
    }
  }

  _renderStorage(b) {
    const inv = b.inventory;

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = b.def.description;
    this.el.appendChild(desc);

    // Current contents.
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
      this.countEl = qty;
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
      this.countEl = null;
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
        this._render();
      }),
    );
    for (const id of RESOURCE_IDS) {
      const res = RESOURCE_TYPES[id];
      grid.appendChild(
        this._itemButton(res.name, res.color, inv.designatedType === id, () => {
          this.building.inventory.setDesignation(id);
          this._render();
        }),
      );
    }
    this.el.appendChild(grid);
  }

  _renderCraft(b) {
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = b.def.description;
    this.el.appendChild(desc);

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
