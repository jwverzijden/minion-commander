/**
 * HUD.js — Status bar (resources, minions, day/time), building hotbar, toasts.
 */

import { RESOURCE_TYPES, RESOURCE_IDS } from '../data/resources.js';
import { BUILDING_IDS, BUILDING_DEFS } from '../data/buildings.js';
import { drawIcon } from '../rendering/Sprites.js';

export class HUD {
  constructor(statusEl, hotbarEl, toastsEl) {
    this.statusEl = statusEl;
    this.hotbarEl = hotbarEl;
    this.toastsEl = toastsEl;

    this.resValueEls = {};

    // Floating cost tooltip (position: fixed, so it never affects hotbar layout).
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'hotbar-tooltip';
    document.body.appendChild(this.tooltip);

    this._buildStatusBar();
    this._buildHotbar();
  }

  _buildStatusBar() {
    this.statusEl.innerHTML = '';

    this.dayValue = this._addStat('Day', null, null);
    this.timeValue = this._addStat('Time', null, null);
    this.minionValue = this._addStat('Minions', null, 'minions');
    this.idleValue = this._addStat('Idle', null, null);

    for (const id of RESOURCE_IDS) {
      const res = RESOURCE_TYPES[id];
      this.resValueEls[id] = this._addStat(res.name, res.color, null);
    }

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    this.statusEl.appendChild(spacer);

    this.decrementSimSpeedBtn = document.createElement('button');
    this.decrementSimSpeedBtn.textContent = '-';
    this.statusEl.appendChild(this.decrementSimSpeedBtn);
    
    this.simSpeedSpan = document.createElement('span');
    this.simSpeedSpan.textContent = '1x';
    this.simSpeedSpan.className = 'label';
    this.statusEl.appendChild(this.simSpeedSpan);
    
    this.incrementSimSpeedBtn = document.createElement('button');
    this.incrementSimSpeedBtn.textContent = '+';
    this.statusEl.appendChild(this.incrementSimSpeedBtn);

    this.pauseBtn = document.createElement('button');
    this.pauseBtn.textContent = 'Pause';
    this.statusEl.appendChild(this.pauseBtn);
  }

  _addStat(label, swatch, cls) {
    const el = document.createElement('div');
    el.className = 'stat' + (cls ? ` ${cls}` : '');
    if (swatch) {
      const s = document.createElement('span');
      s.className = 'swatch';
      s.style.background = swatch;
      el.appendChild(s);
    }
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    el.appendChild(l);
    const v = document.createElement('span');
    v.className = 'value';
    el.appendChild(v);
    this.statusEl.appendChild(el);
    return v;
  }

  _buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.itemEls = new Map();
    for (const id of BUILDING_IDS) {
      const def = BUILDING_DEFS[id];
      const el = document.createElement('div');
      el.className = 'hotbar-item';
      el.title = def.description;

      const icon = document.createElement('canvas');
      icon.className = 'icon';
      icon.width = 30;
      icon.height = 30;
      drawIcon(icon.getContext('2d'), id, 30);
      el.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = def.name;
      el.appendChild(label);

      const costText = formatCost(def.cost);
      el.addEventListener('mouseenter', () => this._showTooltip(el, costText));
      el.addEventListener('mouseleave', () => this._hideTooltip());

      el.addEventListener('click', () => this.onSelect && this.onSelect(id));
      this.hotbarEl.appendChild(el);
      this.itemEls.set(id, el);
    }
  }

  /** Game assigns this to handle hotbar clicks. */
  set onSelect(fn) {
    this._onSelect = fn;
  }
  get onSelect() {
    return this._onSelect;
  }

  setSelected(id) {
    for (const [key, el] of this.itemEls) {
      el.classList.toggle('selected', key === id);
    }
  }

  _showTooltip(el, text) {
    const rect = el.getBoundingClientRect();
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltip.style.top = `${rect.top - 6}px`;
    this.tooltip.classList.add('visible');
  }

  _hideTooltip() {
    this.tooltip.classList.remove('visible');
  }

  setDecrementSimSpeedHandler(fn) {
    this.decrementSimSpeedBtn.onclick = fn;
  }

  setIncrementSimSpeedHandler(fn) {
    this.incrementSimSpeedBtn.onclick = fn;
  }

  setPauseHandler(fn) {
    this.pauseBtn.onclick = fn;
  }

  update(game) {
    this.dayValue.textContent = String(game.time.day);
    this.timeValue.textContent = game.time.timeOfDay();

    const alive = game.minions.filter((m) => !m.dead);
    this.minionValue.textContent = String(alive.length);
    this.idleValue.textContent = String(alive.filter((m) => m.state === 'idle' && !m.task).length);

    const totals = computeTotals(game);
    for (const id of RESOURCE_IDS) {
      this.resValueEls[id].textContent = String(totals[id] || 0);
    }

    this.decrementSimSpeedBtn.disabled = game.simSpeed === 1;
    this.incrementSimSpeedBtn.disabled = game.simSpeed === 8;
    this.simSpeedSpan.textContent = game.simSpeed;

    this.pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
    this.pauseBtn.classList.toggle('paused', game.paused);
  }

  toast(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toastsEl.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }
}

function computeTotals(game) {
  // Only count items held in storage and workplace inventories (not loose
  // ground items, construction-delivered materials, or items in a minion's hands).
  const totals = {};
  for (const b of game.buildings.structures) {
    for (const inv of [b.inventory, b.input, b.output]) {
      if (!inv) continue;
      for (const k in inv.items) totals[k] = (totals[k] || 0) + inv.items[k];
    }
  }
  return totals;
}

function formatCost(cost) {
  const parts = Object.entries(cost).map(([type, qty]) => `${qty} ${RESOURCE_TYPES[type]?.name || type}`);
  return parts.length ? parts.join(', ') : 'Free';
}
