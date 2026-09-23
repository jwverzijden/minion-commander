/**
 * resources.js — Item/resource definitions and crafting recipes.
 *
 * Resources are the currency of the world: they exist as ground items, inside
 * inventories, carried by minions, and consumed by construction.
 */

export const RESOURCE_TYPES = {
  wood: { id: 'wood', name: 'Wood', color: '#9c6b3c', textColor: '#fff' },
  planks: { id: 'planks', name: 'Planks', color: '#c89a5e', textColor: '#1a1200' },
  refinedPlanks: { id: 'refinedPlanks', name: 'Refined Planks', color: '#dcbd8d', textColor: '#1a1200' },
  gears: { id: 'gears', name: 'Gears', color: '#6f7a86', textColor: '#fff' },
  stone: { id: 'stone', name: 'Stone', color: '#8a8f96', textColor: '#fff' },
  gravel: { id: 'gravel', name: 'Gravel', color: '#b9b2a4', textColor: '#1a1200' },
  ironOre: { id: 'ironOre', name: 'Iron Ore', color: '#8c6a52', textColor: '#fff' },
  ironIngot: { id: 'ironIngot', name: 'Iron Ingot', color: '#c9cdd2', textColor: '#1a1200' },
  copperOre: { id: 'copperOre', name: 'Copper Ore', color: '#b07a3f', textColor: '#fff' },
  copperIngot: { id: 'copperIngot', name: 'Copper Ingot', color: '#d9822b', textColor: '#1a1200' },
  copperWire: { id: 'copperWire', name: 'Copper Wire', color: '#e0913f', textColor: '#1a1200' },
};

/** Ordered list for stable UI display. */
export const RESOURCE_IDS = [
  'wood',
  'planks',
  'refinedPlanks',
  'gears',
  'stone',
  'gravel',
  'ironOre',
  'ironIngot',
  'copperOre',
  'copperIngot',
  'copperWire',
];

/**
 * Resources that incur the 30% movement penalty while carried.
 * (spec: "carrying a ore or a ingot has a 30% walking speed penalty")
 */
export const HEAVY_RESOURCES = new Set(['ironOre', 'ironIngot', 'copperOre', 'copperIngot']);

export function resource(id) {
  return RESOURCE_TYPES[id] || null;
}

export function resourceName(id) {
  const r = RESOURCE_TYPES[id];
  return r ? r.name : id;
}

/**
 * Crafting recipes. Each recipe consumes one unit of each input and produces
 * one unit of output after `hours` of work at the listed station.
 */
export const RECIPES = {
  planks: { id: 'planks', output: 'planks', inputs: { wood: 1 }, hours: 2 },
  refinedPlanks: { id: 'refinedPlanks', output: 'refinedPlanks', inputs: { planks: 1 }, hours: 2 },
  gears: { id: 'gears', output: 'gears', inputs: { planks: 1 }, hours: 3 },
  gravel: { id: 'gravel', output: 'gravel', inputs: { stone: 1 }, hours: 2 },
  copperWire: { id: 'copperWire', output: 'copperWire', inputs: { copperIngot: 1 }, hours: 2 },
  ironIngot: { id: 'ironIngot', output: 'ironIngot', inputs: { ironOre: 1 }, hours: 2 },
  copperIngot: { id: 'copperIngot', output: 'copperIngot', inputs: { copperOre: 1 }, hours: 2 },
};

/**
 * The recipes each station knows how to run.
 * (factory: planks / refined planks / gears / gravel / copper wire,
 *  smeltery: iron & copper ingots)
 */
export const STATION_RECIPES = {
  factory: ['planks', 'refinedPlanks', 'gears', 'gravel', 'copperWire'],
  smeltery: ['ironIngot', 'copperIngot'],
};
