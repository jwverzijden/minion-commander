/**
 * Pathfinding.js — A* over the tile grid.
 *
 * Movement cost is cheap on fast paths / paths, and expensive off-path, which
 * makes minions naturally prefer the path network while still allowing them to
 * reach a nearby tree, ore vein or material item.
 */

const COST = {
  fastPath: 0.7,
  path: 1,
  bridge: 1,
  offPath: 8,
  door: 1,
};

function moveCost(world, x, y) {
  const t = world.tile(x, y);
  if (!t) return COST.offPath;
  const b = t.structure;
  if (!b) return COST.offPath;
  switch (b.def.kind) {
    case 'fastPath':
      return COST.fastPath;
    case 'path':
    case 'bridge':
      return COST.path;
    default:
      return COST.door; // building door tile
  }
}

function heuristic(x1, y1, x2, y2) {
  return (Math.abs(x1 - x2) + Math.abs(y1 - y2)) * 0.7;
}

/** A tiny binary min-heap keyed on `f`. */
class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Find a shortest path from (sx,sy) to (gx,gy).
 *
 * @param {World} world
 * @param {object} [opts]
 * @param {{x:number,y:number}|null} [opts.goal] tile allowed to be entered even
 *   if blocked (a tree/vein being harvested).
 * @param {number} [opts.maxNodes] safety cap for the search.
 * @returns {Array<{x:number,y:number}>|null} path from start to goal (inclusive), or null.
 */
export function findPath(world, sx, sy, gx, gy, opts = {}) {
  const goal = opts.goal || null;
  const maxNodes = opts.maxNodes || 20000;
  const size = world.size;

  if (!world.inBounds(sx, sy) || !world.inBounds(gx, gy)) return null;
  if (sx === gx && sy === gy) return [{ x: sx, y: sy }];
  if (!world.isWalkable(gx, gy, goal)) return null;

  const key = (x, y) => y * size + x;
  const target = key(gx, gy);

  const open = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();

  const startKey = key(sx, sy);
  gScore.set(startKey, 0);
  open.push({ k: startKey, x: sx, y: sy, f: heuristic(sx, sy, gx, gy) });

  let visited = 0;
  while (open.size > 0) {
    const cur = open.pop();
    if (cur.k === target) {
      // Walk backwards and reverse.
      const path = [{ x: cur.x, y: cur.y }];
      let k = cur.k;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k);
        path.push({ x: prev.x, y: prev.y });
        k = key(prev.x, prev.y);
      }
      path.reverse();
      return path;
    }
    if (visited++ > maxNodes) return null;

    const curG = gScore.get(cur.k);
    const nbrs = world.neighbors4(cur.x, cur.y);
    for (const n of nbrs) {
      if (!world.isWalkable(n.x, n.y, goal)) continue;
      const nk = key(n.x, n.y);
      const tentative = curG + moveCost(world, n.x, n.y);
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, { x: cur.x, y: cur.y });
        open.push({ k: nk, x: n.x, y: n.y, f: tentative + heuristic(n.x, n.y, gx, gy) });
      }
    }
  }
  return null;
}
