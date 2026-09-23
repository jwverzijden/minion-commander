/**
 * World.js — The 100x100 tile grid and spatial queries.
 */

import { CONFIG } from '../core/config.js';
import { Tile } from './Tile.js';

const WALKABLE_KINDS = new Set(['path', 'fastPath', 'bridge']);

export class World {
  constructor(size = CONFIG.world.size) {
    this.size = size;
    this.tiles = new Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.tiles[y * size + x] = new Tile(x, y);
      }
    }
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  tile(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y * this.size + x];
  }

  /** The 4 orthogonally-adjacent in-bounds coordinates. */
  neighbors4(x, y) {
    const out = [];
    if (x > 0) out.push({ x: x - 1, y });
    if (x < this.size - 1) out.push({ x: x + 1, y });
    if (y > 0) out.push({ x, y: y - 1 });
    if (y < this.size - 1) out.push({ x, y: y + 1 });
    return out;
  }

  /**
   * Can a minion step onto this tile?
   *
   * Buildings block movement except for their door tile. Paths, fast paths and
   * bridges are always walkable. Trees and veins block movement unless they are
   * the explicit goal of the current trip (so a minion can walk up to cut/collect).
   */
  isWalkable(x, y, goal = null) {
    if (!this.inBounds(x, y)) return false;
    if (goal && goal.x === x && goal.y === y) return true;

    const t = this.tile(x, y);

    if (t.structure) {
      // Construction sites block movement until finished.
      if (t.structure.state !== 'built') return false;
      if (WALKABLE_KINDS.has(t.structure.def.kind)) return true;
      // A building's door tile is the exception to blocking.
      return t.structure.isDoorTile(x, y);
    }

    if (t.tree || t.vein) return false;
    if (t.biome === 'river') return false; // only bridges (structures) are walkable here
    return true;
  }

  /**
   * True when the tile is within `maxDist` (Chebyshev) of any path, fast path
   * or bridge — used to decide whether a minion is "lost".
   */
  hasPathNear(x, y, maxDist) {
    for (let dy = -maxDist; dy <= maxDist; dy++) {
      for (let dx = -maxDist; dx <= maxDist; dx++) {
        const t = this.tile(x + dx, y + dy);
        if (t && t.structure && WALKABLE_KINDS.has(t.structure.def.kind)) return true;
      }
    }
    return false;
  }

  /** Iterate every tile (y-major) for scans that run each tick. */
  *forEachTile() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        yield this.tiles[y * this.size + x];
      }
    }
  }
}
