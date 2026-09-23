/**
 * WorldGenerator.js — Deterministic 4-phase world generation.
 *
 *  1. Biomes       — grass everywhere, stony ovals, squiggly rivers
 *  2. Resources    — forests (tree ovals) + ore veins
 *  3. Materials    — loose wood/stone/ore items
 *  4. Starting area — a spot near a forest with 5 minions
 */

import { CONFIG } from '../core/config.js';
import { World } from './World.js';

/** Small deterministic PRNG so a seed reproduces the same world. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWorld(seed) {
  const g = CONFIG.worldGen;
  const actualSeed = (seed ?? (Math.random() * 2 ** 31) >>> 0) >>> 0;
  const rng = mulberry32(actualSeed);
  const world = new World(CONFIG.world.size);

  generateBiomes(world, rng, g);
  generateResourceTiles(world, rng, g);
  generateMaterialTiles(world, rng, g);
  const start = generateStartingArea(world, rng, g);

  return { world, start, seed: actualSeed };
}

// ---------------------------------------------------------------------------
// Phase 1 — biomes
// ---------------------------------------------------------------------------

function generateBiomes(world, rng, g) {
  // Stony ovals.
  for (let i = 0; i < g.stoneOvals; i++) {
    const cx = Math.floor(rng() * world.size);
    const cy = Math.floor(rng() * world.size);
    const rx = g.stoneOvalRadiusMin + rng() * (g.stoneOvalRadiusMax - g.stoneOvalRadiusMin);
    const ry = g.stoneOvalRadiusMin + rng() * (g.stoneOvalRadiusMax - g.stoneOvalRadiusMin);
    forEachInEllipse(world, cx, cy, rx, ry, (x, y) => {
      const t = world.tile(x, y);
      if (t.biome === 'grass') t.biome = 'stone';
    });
  }

  // Squiggly rivers: random walks that carve a river bed across the map.
  for (let i = 0; i < g.riverCount; i++) {
    let x = Math.floor(rng() * world.size);
    let y = Math.floor(rng() * world.size);
    let dx = pickDir(rng);
    let dy = pickDir(rng);
    for (let s = 0; s < g.riverSegments; s++) {
      carveRiverAt(world, x, y, g.riverWidth);
      if (rng() < 0.12) {
        dx = pickDir(rng);
        dy = pickDir(rng);
      }
      x += dx;
      y += dy;
      if (!world.inBounds(x, y)) {
        x = Math.max(0, Math.min(world.size - 1, x));
        y = Math.max(0, Math.min(world.size - 1, y));
        dx = -dx;
        dy = -dy;
      }
    }
  }
}

function pickDir(rng) {
  const r = rng();
  if (r < 0.25) return -1;
  if (r < 0.5) return 1;
  if (r < 0.75) return 0;
  return 0;
}

function carveRiverAt(world, cx, cy, width) {
  for (let dy = -width; dy <= width; dy++) {
    for (let dx = -width; dx <= width; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!world.inBounds(x, y)) continue;
      if (Math.abs(dx) + Math.abs(dy) <= width) {
        const t = world.tile(x, y);
        // Rivers erase trees/items later phases will respect.
        t.biome = 'river';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — resource tiles (trees + ore veins)
// ---------------------------------------------------------------------------

function generateResourceTiles(world, rng, g) {
  // Forests: filled ovals of trees on grass.
  for (let i = 0; i < g.forestCount; i++) {
    const cx = Math.floor(rng() * world.size);
    const cy = Math.floor(rng() * world.size);
    const rx = g.forestRadiusMin + rng() * (g.forestRadiusMax - g.forestRadiusMin);
    const ry = g.forestRadiusMin + rng() * (g.forestRadiusMax - g.forestRadiusMin);
    forEachInEllipse(world, cx, cy, rx, ry, (x, y) => {
      const t = world.tile(x, y);
      if (t.biome !== 'grass' || t.tree) return;
      if (rng() < g.treeDensity) {
        t.tree = { mature: true, plantedAtHours: 0 };
      }
    });
  }

  // Ore veins (iron + copper) inside stone areas, spaced apart.
  placeVeins(world, rng, 'iron', g.oreVeinCountIron, g.oreVeinMinGap);
  placeVeins(world, rng, 'copper', g.oreVeinCountCopper, g.oreVeinMinGap);
}

function placeVeins(world, rng, type, count, minGap) {
  const placed = [];
  let attempts = 0;
  while (placed.length < count && attempts < count * 60) {
    attempts++;
    const x = Math.floor(rng() * world.size);
    const y = Math.floor(rng() * world.size);
    const t = world.tile(x, y);
    if (t.biome !== 'stone' || t.vein) continue;
    if (placed.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < minGap)) continue;
    t.vein = type;
    placed.push({ x, y });
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — loose material items
// ---------------------------------------------------------------------------

function generateMaterialTiles(world, rng, g) {
  for (const t of world.forEachTile()) {
    if (t.structure || t.tree || t.vein) continue;

    if (t.biome === 'grass') {
      if (!t.groundItem && rng() < g.groundWoodDensity) {
        t.groundItem = { type: 'wood', qty: 1 + Math.floor(rng() * 3) };
      }
    } else if (t.biome === 'stone') {
      if (rng() < g.groundStoneDensity) {
        t.groundItem = { type: 'stone', qty: 1 + Math.floor(rng() * 3) };
      } else if (rng() < g.groundOreDensity) {
        t.groundItem = {
          type: rng() < 0.5 ? 'ironOre' : 'copperOre',
          qty: 1 + Math.floor(rng() * 3),
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 4 — starting area
// ---------------------------------------------------------------------------

function generateStartingArea(world, rng, g) {
  // Find a grass tile within a few tiles of a tree (near a forest), with room
  // for a 5x5 spawn area.
  let best = null;
  for (let attempts = 0; attempts < 400 && !best; attempts++) {
    const cx = 5 + Math.floor(rng() * (world.size - 10));
    const cy = 5 + Math.floor(rng() * (world.size - 10));

    // Must be near a tree.
    let nearForest = false;
    for (let dy = -6; dy <= 6 && !nearForest; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const t = world.tile(cx + dx, cy + dy);
        if (t && t.tree) {
          nearForest = true;
          break;
        }
      }
    }
    if (!nearForest) continue;

    // The 5x5 area must be clear, walkable grass.
    const half = Math.floor(g.startingArea / 2);
    let clear = true;
    for (let dy = -half; dy <= half && clear; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const t = world.tile(cx + dx, cy + dy);
        if (!t || t.biome !== 'grass' || t.tree || t.vein || t.structure) {
          clear = false;
          break;
        }
      }
    }
    if (clear) best = { x: cx, y: cy };
  }

  const center = best || { x: Math.floor(world.size / 2), y: Math.floor(world.size / 2) };

  // Place 5 minions on distinct tiles in the spawn area.
  const spawnPositions = [];
  const half = Math.floor(g.startingArea / 2);
  const candidates = [];
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (world.inBounds(x, y) && world.tile(x, y).biome === 'grass') {
        candidates.push({ x, y });
      }
    }
  }
  // Shuffle and take the first `startingMinions`.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(g.startingMinions, candidates.length);
  for (let i = 0; i < n; i++) spawnPositions.push(candidates[i]);

  return { x: center.x, y: center.y, spawnPositions };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function forEachInEllipse(world, cx, cy, rx, ry, fn) {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!world.inBounds(x, y)) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) fn(x, y);
    }
  }
}
