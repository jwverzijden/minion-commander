/**
 * Tile.js — A single cell of the game world.
 *
 * A tile knows its biome, any structure built on it, a tree, an ore vein, and
 * a ground material item. Only one type of ground material may occupy a tile
 * (any quantity), per the design doc.
 */

export class Tile {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    /** 'grass' | 'stone' | 'river' */
    this.biome = 'grass';

    /** Building instance occupying this tile (path/bridge/building), or null. */
    this.structure = null;

    /** { mature: boolean, plantedAtHours: number } or null. */
    this.tree = null;

    /** 'stone' | 'iron' | 'copper' | null */
    this.vein = null;

    /** { type: string, qty: number } or null (one material type per tile). */
    this.groundItem = null;
  }

  get hasTree() {
    return this.tree !== null;
  }

  get hasVein() {
    return this.vein !== null;
  }

  get hasGroundItem() {
    return this.groundItem !== null;
  }

  /** A tile is "empty" for planting when nothing occupies it at all. */
  get isEmpty() {
    return (
      !this.structure &&
      !this.tree &&
      !this.vein &&
      !this.groundItem &&
      this.biome === 'grass'
    );
  }
}
