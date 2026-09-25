/**
 * BuildingManager.js — Placement, validation, demolition and spatial queries
 * for every structure in the world.
 */

import { CONFIG } from '../core/config.js';
import { buildingDef } from '../data/buildings.js';
import { Building } from './Building.js';

const WALKABLE_KINDS = new Set(['path', 'fastPath', 'bridge', 'door']);

export class BuildingManager {
  constructor(world) {
    this.world = world;
    /** All placed structures (construction or built). */
    this.structures = [];
  }

  // ---------------------------------------------------------------- placement

  /**
   * Validate a potential placement.
   * @returns {{ok:boolean, reason?:string}}
   */
  validate(defId, x, y, rotation) {
    const def = buildingDef(defId);
    if (!def) return { ok: false, reason: 'Unknown building' };

    const probe = new Building(def, x, y, rotation);
    for (const tile of probe.footprintTiles()) {
      const t = this.world.tile(tile.x, tile.y);
      if (!t) return { ok: false, reason: 'Outside the world' };
      if (t.structure) return { ok: false, reason: 'Tile already occupied' };
      if (t.tree || t.vein) return { ok: false, reason: 'Blocked by tree or ore vein' };
      if (def.requiresRiver) {
        if (t.biome !== 'river') return { ok: false, reason: 'Bridge must be on a river' };
      } else if (t.biome === 'river') {
        return { ok: false, reason: 'Cannot build on water' };
      }
    }
    return { ok: true };
  }

  /**
   * Place a structure as a construction site.
   * @returns {{ok:boolean, building?:Building, reason?:string}}
   */
  add(defId, x, y, rotation = 0) {
    const def = buildingDef(defId);
    const check = this.validate(defId, x, y, rotation);
    if (!check.ok) return check;

    const building = new Building(def, x, y, rotation);
    for (const tile of building.footprintTiles()) {
      const t = this.world.tile(tile.x, tile.y);
      t.structure = building;
      // Building over loose material clears it.
      t.groundItem = null;
    }
    this.structures.push(building);
    return { ok: true, building };
  }

  // ---------------------------------------------------------------- demolition

  /**
   * Destroy a structure. Refunds 50% of the cost (rounded up) as ground items,
   * including any stored items, preferring the footprint tiles, then the path
   * the door connects to, then nearby free tiles.
   */
  destroy(building) {
    const refund = {};
    if (building.state === 'built') {
      // Finished building: refund 50% of the cost, rounded up.
      for (const type in building.def.cost) {
        const qty = Math.ceil(building.def.cost[type] * CONFIG.construction.refundFraction);
        if (qty > 0) refund[type] = (refund[type] || 0) + qty;
      }
    } else {
      // Construction site: refund only the materials actually delivered so far
      // (a freshly-placed "ghost" with nothing delivered refunds nothing).
      for (const type in building.delivered) {
        refund[type] = (refund[type] || 0) + building.delivered[type];
      }
    }
    // Include stored / in-progress inventory contents (no loss on those).
    const inventories = [building.inventory, building.input, building.output].filter(Boolean);
    for (const inv of inventories) {
      for (const type in inv.items) {
        refund[type] = (refund[type] || 0) + inv.items[type];
      }
    }

    const footprint = building.footprintTiles();

    // Free the tiles first.
    for (const tile of footprint) {
      const t = this.world.tile(tile.x, tile.y);
      if (t && t.structure === building) t.structure = null;
    }

    // Preferred drop tiles: footprint, then path next to the door, then nearby.
    const preferred = footprint.map((t) => ({ x: t.x, y: t.y }));
    const door = building.doorTile();
    for (const n of this.world.neighbors4(door.x, door.y)) {
      const t = this.world.tile(n.x, n.y);
      if (t && t.structure && WALKABLE_KINDS.has(t.structure.def.kind)) {
        preferred.push({ x: n.x, y: n.y });
      }
    }

    for (const type in refund) {
      this.placeGroundItem(type, refund[type], preferred);
    }

    this.structures = this.structures.filter((b) => b !== building);
    return refund;
  }

  /** Drop `qty` of `type` onto the best available tile from `preferred`. */
  placeGroundItem(type, qty, preferred = []) {
    const drop = this.findDropTile(type, preferred);
    if (!drop) return false; // no space at all -> material is lost
    const t = this.world.tile(drop.x, drop.y);
    if (t.groundItem && t.groundItem.type === type) {
      t.groundItem.qty += qty;
    } else {
      t.groundItem = { type, qty };
    }
    return true;
  }

  // ------------------------------------------------------------------ queries

  getAt(x, y) {
    const t = this.world.tile(x, y);
    return t ? t.structure : null;
  }

  getBuilding(id) {
    return this.structures.find((b) => b.id === id) || null;
  }

  /** All finished structures. */
  get built() {
    return this.structures.filter((b) => b.state === 'built');
  }

  /** Nearest storage that can accept `type` (built + space + matching type). */
  storageAccepting(type, fromX, fromY) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.built) {
      if (b.def.kind !== 'storage') continue;
      if (!b.inventory.designatedType) continue;
      if (!b.inventory.canAdd(type, 1)) continue;
      const d = cheb(b.x, b.y, fromX, fromY);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Nearest storage holding at least one of `type`. */
  storageWith(type, fromX, fromY) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.built) {
      if (b.def.kind !== 'storage') continue;
      if (b.inventory.count(type) <= 0) continue;
      const d = cheb(b.x, b.y, fromX, fromY);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Construction sites still missing `type`. */
  sitesNeeding(type) {
    const out = [];
    for (const b of this.structures) {
      if (b.state !== 'construction') continue;
      if (b.missingMaterials().some((m) => m.type === type)) out.push(b);
    }
    return out;
  }

  /**
   * Find the nearest source of `type`: a storage holding it, or a nearby ground
   * item. Ground items are limited to `maxGroundRadius` so a minion never treks
   * across the whole map for a loose item; storage remains the long-distance source.
   * @returns {{kind:'storage'|'ground', x:number, y:number, buildingId?:number}|null}
   */
  findSourceFor(type, fromX, fromY, maxGroundRadius = CONFIG.station.radius) {
    let best = null;
    let bestD = Infinity;

    const storage = this.storageWith(type, fromX, fromY);
    if (storage) {
      const door = storage.doorTile();
      bestD = cheb(door.x, door.y, fromX, fromY);
      // Store an id (serialisable), never a live Building reference.
      best = { kind: 'storage', x: door.x, y: door.y, buildingId: storage.id };
    }

    for (let y = fromY - maxGroundRadius; y <= fromY + maxGroundRadius; y++) {
      for (let x = fromX - maxGroundRadius; x <= fromX + maxGroundRadius; x++) {
        const t = this.world.tile(x, y);
        if (!t || !t.groundItem || t.groundItem.type !== type || t.groundItem.qty <= 0) continue;
        const d = cheb(x, y, fromX, fromY);
        if (d < bestD) {
          bestD = d;
          best = { kind: 'ground', x, y };
        }
      }
    }
    return best;
  }

  /**
   * Find a tile to drop a ground item of `type`, preferring `preferred` tiles,
   * then spreading out. Returns {x,y} or null.
   */
  findDropTile(type, preferred = []) {
    const seen = new Set();
    const queue = [];
    for (const p of preferred) {
      const k = `${p.x},${p.y}`;
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ x: p.x, y: p.y, d: 0 });
      }
    }
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const t = this.world.tile(cur.x, cur.y);
      if (t && this._canHoldItem(t, type)) return { x: cur.x, y: cur.y };
      if (cur.d < 12) {
        for (const n of this.world.neighbors4(cur.x, cur.y)) {
          const k = `${n.x},${n.y}`;
          if (!seen.has(k)) {
            seen.add(k);
            queue.push({ x: n.x, y: n.y, d: cur.d + 1 });
          }
        }
      }
    }
    return null;
  }

  _canHoldItem(tile, type) {
    if (tile.structure || tile.tree || tile.vein) return false;
    if (tile.biome === 'river') return false;
    if (tile.groundItem) return tile.groundItem.type === type;
    return true;
  }

  // -------------------------------------------------------------- lifecycle

  /** Re-link tile.structure references after loading a save. */
  relink() {
    for (const b of this.structures) {
      for (const tile of b.footprintTiles()) {
        const t = this.world.tile(tile.x, tile.y);
        if (t) t.structure = b;
      }
    }
  }
}

function cheb(x1, y1, x2, y2) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
