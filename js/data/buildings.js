/**
 * buildings.js — Building definitions (the static catalogue).
 *
 * A "building" here also covers path / fast path / bridge, which are treated
 * as walkable 1x1 structures so they share construction & demolition logic.
 *
 * footprint: { w, h } in tiles BEFORE rotation (w = x columns, h = y rows).
 * door:      computed by Building as local tile (0, h-1) rotated with the shape.
 */

export const BUILDING_DEFS = {
  // ---- Movement ----
  path: {
    id: 'path',
    name: 'Path',
    description: 'Minions walk on paths.',
    footprint: { w: 1, h: 1 },
    workplaces: 0,
    cost: {},
    kind: 'path',
    color: '#b7a98a',
  },
  fastPath: {
    id: 'fastPath',
    name: 'Fast Path',
    description: 'Minions walk faster on fast paths.',
    footprint: { w: 1, h: 1 },
    workplaces: 0,
    cost: { gravel: 1 },
    kind: 'fastPath',
    color: '#d9d2b8',
  },
  bridge: {
    id: 'bridge',
    name: 'Bridge',
    description: 'Built on a river tile; lets a path cross it.',
    footprint: { w: 1, h: 1 },
    workplaces: 0,
    cost: { planks: 5 },
    kind: 'bridge',
    color: '#8a6d4a',
    requiresRiver: true,
  },

  // ---- Gathering ----
  collectingStation: {
    id: 'collectingStation',
    name: 'Collecting Station',
    description: 'Collect wood, stone, iron ore and copper ore.',
    footprint: { w: 1, h: 1 },
    workplaces: 1,
    cost: {},
    kind: 'building',
    color: '#c8a24a',
    behavior: 'collect',
  },
  woodcuttingStation: {
    id: 'woodcuttingStation',
    name: 'Woodcutting Station',
    description: 'Assigns minions to cut nearby trees.',
    footprint: { w: 2, h: 2 },
    workplaces: 2,
    cost: { wood: 5 },
    kind: 'building',
    color: '#7f9a4a',
    behavior: 'cutTree',
  },
  forestingStation: {
    id: 'forestingStation',
    name: 'Foresting Station',
    description: 'Replants empty green tiles with trees.',
    footprint: { w: 2, h: 2 },
    workplaces: 2,
    cost: { wood: 10, planks: 5 },
    kind: 'building',
    color: '#3f8f5f',
    behavior: 'replant',
  },
  drillingStation: {
    id: 'drillingStation',
    name: 'Drilling Station',
    description: 'Drills stone and ore from veins.',
    footprint: { w: 3, h: 3 },
    workplaces: 4,
    cost: { wood: 20, planks: 20, gears: 10, ironIngot: 10, wire: 5, gravel: 40 },
    kind: 'building',
    color: '#5b6772',
    behavior: 'drill',
  },

  // ---- Power / population ----
  rechargeStation: {
    id: 'rechargeStation',
    name: 'Recharge Station',
    description: 'Recharges a depleted minion.',
    footprint: { w: 1, h: 1 },
    workplaces: 1, // one minion recharges at a time
    cost: { wood: 5 },
    kind: 'building',
    color: '#4f9fe0',
    behavior: 'recharge',
  },
  minionDuplicationStation: {
    id: 'minionDuplicationStation',
    name: 'Duplication Station',
    description: 'Duplicates a minion.',
    footprint: { w: 2, h: 2 },
    workplaces: 1,
    cost: { planks: 20, gears: 10 },
    kind: 'building',
    color: '#a86fe0',
    behavior: 'duplicate',
  },

  // ---- Storage ----
  storageSmall: {
    id: 'storageSmall',
    name: 'Small Storage',
    description: 'Stores 50 of one item type.',
    footprint: { w: 2, h: 2 },
    workplaces: 0,
    cost: { wood: 10 },
    kind: 'storage',
    color: '#8a7f5f',
    capacity: 50,
  },
  storageMedium: {
    id: 'storageMedium',
    name: 'Medium Storage',
    description: 'Stores 150 of one item type.',
    footprint: { w: 3, h: 3 },
    workplaces: 0,
    cost: { wood: 20, planks: 10 },
    kind: 'storage',
    color: '#9a8f6d',
    capacity: 150,
  },
  storageLarge: {
    id: 'storageLarge',
    name: 'Large Storage',
    description: 'Stores 400 of one item type.',
    footprint: { w: 4, h: 4 },
    workplaces: 0,
    cost: { wood: 40, planks: 20 },
    kind: 'storage',
    color: '#aa9f7c',
    capacity: 400,
  },

  // ---- Crafting ----
  factory: {
    id: 'factory',
    name: 'Factory',
    description: 'Crafts planks, refined planks, gears, gravel and wire.',
    footprint: { w: 3, h: 2 },
    workplaces: 2,
    cost: { wood: 10 },
    kind: 'building',
    color: '#b06a3f',
    behavior: 'craft',
  },
  smeltery: {
    id: 'smeltery',
    name: 'Smeltery',
    description: 'Smelts iron and copper ore into ingots.',
    footprint: { w: 3, h: 3 },
    workplaces: 2,
    cost: { wood: 10, planks: 10, ironOre: 10, gravel: 20 },
    kind: 'building',
    color: '#c05a3a',
    behavior: 'craft',
  },

  // ---- Logistics ----
  transportStation: {
    id: 'transportStation',
    name: 'Transport Station',
    description: 'Moves items between inventories.',
    footprint: { w: 3, h: 3 },
    workplaces: 4,
    cost: { wood: 20, planks: 15, refinedPlanks: 5 },
    kind: 'building',
    color: '#3fa3a0',
    behavior: 'transport',
  },
};

/** Hotbar order (top-left to bottom-right). */
export const BUILDING_IDS = [
  'path',
  'fastPath',
  'bridge',
  'collectingStation',
  'woodcuttingStation',
  'forestingStation',
  'rechargeStation',
  'storageSmall',
  'storageMedium',
  'storageLarge',
  'factory',
  'smeltery',
  'drillingStation',
  'transportStation',
  'minionDuplicationStation',
];

export function buildingDef(id) {
  return BUILDING_DEFS[id] || null;
}
