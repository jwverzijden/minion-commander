/**
 * Building.js — A single placed structure instance.
 *
 * Covers real buildings, paths, fast paths and bridges. Every structure starts
 * as a construction site and is "finished" either by delivering its material
 * cost or, when it has no cost, by a short build task.
 */

import { CONFIG } from '../core/config.js';
import { Inventory } from '../systems/Inventory.js';

let NEXT_ID = 1;

export class Building {
  /**
   * @param {object} def building definition from data/buildings.js
   * @param {number} x top-left tile x (before rotation)
   * @param {number} y top-left tile y (before rotation)
   * @param {number} rotation 0..3 (90-degree clockwise turns)
   */
  constructor(def, x, y, rotation = 0) {
    this.id = NEXT_ID++;
    this.def = def;
    this.x = x;
    this.y = y;
    this.rotation = rotation;

    /** 'construction' | 'built' */
    this.state = 'construction';

    /** resource id -> units already delivered (construction). */
    this.delivered = {};

    /** hours elapsed toward CONFIG.work.constructHours (no-cost buildings). */
    this.finishProgress = 0;

    /** Recipe id a craft building is locked to (null = auto pick). */
    this.designatedRecipe = null;

    // ---- Inventories ----
    if (def.kind === 'storage') {
      this.inventory = new Inventory(def.capacity, { singleType: true });
    } else if (def.behavior === 'craft') {
      this.input = new Inventory(CONFIG.inventory.workplaceSlots);
      this.output = new Inventory(CONFIG.inventory.workplaceSlots);
    }
  }

  // ------------------------------------------------------------------ shape

  get rotatedW() {
    return this.rotation % 2 === 0 ? this.def.footprint.w : this.def.footprint.h;
  }

  get rotatedH() {
    return this.rotation % 2 === 0 ? this.def.footprint.h : this.def.footprint.w;
  }

  /** Local tile -> world tile, honouring the 90-degree rotation. */
  localToWorld(lx, ly) {
    const { w, h } = this.def.footprint;
    switch (this.rotation) {
      case 0:
        return { x: this.x + lx, y: this.y + ly };
      case 1:
        return { x: this.x + (h - 1 - ly), y: this.y + lx };
      case 2:
        return { x: this.x + (w - 1 - lx), y: this.y + (h - 1 - ly) };
      case 3:
        return { x: this.x + ly, y: this.y + (w - 1 - lx) };
      default:
        return { x: this.x + lx, y: this.y + ly };
    }
  }

  /** All world tiles this structure occupies. */
  footprintTiles() {
    const { w, h } = this.def.footprint;
    const out = [];
    for (let ly = 0; ly < h; ly++) {
      for (let lx = 0; lx < w; lx++) {
        out.push(this.localToWorld(lx, ly));
      }
    }
    return out;
  }

  /** The single door tile (local (0, h-1), rotated with the shape). */
  doorTile() {
    return this.localToWorld(0, this.def.footprint.h - 1);
  }

  isDoorTile(x, y) {
    const d = this.doorTile();
    return d.x === x && d.y === y;
  }

  // ------------------------------------------------------------ construction

  /** Total material units the cost requires. */
  get totalCostUnits() {
    let n = 0;
    for (const k in this.def.cost) n += this.def.cost[k];
    return n;
  }

  /** Material types still missing, as [{type, qty}]. */
  missingMaterials() {
    const out = [];
    for (const type in this.def.cost) {
      const need = this.def.cost[type] - (this.delivered[type] || 0);
      if (need > 0) out.push({ type, qty: need });
    }
    return out;
  }

  get needsMaterials() {
    return this.missingMaterials().length > 0;
  }

  /** Construction progress in [0,1] for the UI. */
  get progress() {
    if (this.state === 'built') return 1;
    if (this.totalCostUnits === 0) {
      return Math.min(1, this.finishProgress / CONFIG.work.constructHours);
    }
    let delivered = 0;
    for (const k in this.delivered) delivered += this.delivered[k];
    return Math.min(1, delivered / this.totalCostUnits);
  }

  /** Accept one delivered unit of a material; returns true if fully supplied. */
  deliver(type) {
    if (this.state !== 'construction') return false;
    if ((this.delivered[type] || 0) >= (this.def.cost[type] || 0)) return false;
    this.delivered[type] = (this.delivered[type] || 0) + 1;
    if (!this.needsMaterials) this.state = 'built';
    return true;
  }

  toJSON() {
    const o = {
      id: this.id,
      def: this.def.id,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      state: this.state,
      delivered: { ...this.delivered },
      finishProgress: this.finishProgress,
      designatedRecipe: this.designatedRecipe,
    };
    if (this.inventory) o.inventory = this.inventory.toJSON();
    if (this.input) o.input = this.input.toJSON();
    if (this.output) o.output = this.output.toJSON();
    return o;
  }

  static fromJSON(o, def) {
    const b = new Building(def, o.x, o.y, o.rotation);
    b.id = o.id;
    b.state = o.state;
    b.delivered = { ...(o.delivered || {}) };
    b.finishProgress = o.finishProgress ?? 0;
    b.designatedRecipe = o.designatedRecipe ?? null;
    if (o.inventory) b.inventory = Inventory.fromJSON(o.inventory);
    if (o.input) b.input = Inventory.fromJSON(o.input);
    if (o.output) b.output = Inventory.fromJSON(o.output);
    if (b.id >= NEXT_ID) NEXT_ID = b.id + 1;
    return b;
  }
}
