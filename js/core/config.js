/**
 * config.js — Central, tunable game constants.
 *
 * Everything that affects balance or behaviour should live here so the rest of
 * the codebase stays free of magic numbers.
 */

export const CONFIG = {
  // ---- World ----
  world: {
    size: 100, // 100 x 100 tile grid
    tileSize: 32, // rendered tile edge in px at 1:1
  },

  // ---- Time (spec: 1 ingame hour = 15 real seconds) ----
  time: {
    secondsPerHour: 15, // real seconds per in-game hour
    hoursPerDay: 24,
    // => 1 day = 360s = 6 real minutes
  },

  // ---- Minions ----
  minion: {
    maxBatteryHours: 20, // full battery charge
    lifespanDays: 10, // a minion lives 10 in-game days
    rechargeHours: 4, // time to fully recharge an empty battery
    rechargeRateHoursPerHour: 20 / 4, // charge gained per hour spent recharging

    speedPathTilesPerHour: 14,
    speedFastPathTilesPerHour: 20,
    speedOffPathTilesPerHour: 10, // off-path walking (slower than path)

    carryPenalty: 0.3, // 30% movement penalty while carrying ore or ingots
    carryCapacity: 1, // units carried at once (all recipes are 1-in -> 1-out)

    radiusRescue: 5, // "lost" when further than this many tiles from a path
  },

  // ---- Task / work durations (in-game hours) ----
  work: {
    collectHours: 1 / 15,
    cutTreeHours: 1,
    replantHours: 1,
    constructHours: 1 / 15, // finishing any building (no-cost buildings too)
    duplicateHours: 4, // time to duplicate a minion at a duplication station
  },

  // ---- Resource generation ----
  trees: {
    dropsPerCut: 2, // wood items dropped when a tree is cut
    growDays: 5, // a planted tree matures after 5 days
  },

  // ---- Buildings ----
  station: {
    radius: 5, // square radius (Chebyshev) a station reaches for its jobs
  },
  inventory: {
    workplaceSlots: 5, // 5 input + 5 output slots per workstation
  },
  construction: {
    refundFraction: 0.5, // destroy refunds 50% rounded up
  },

  // ---- World generation ----
  worldGen: {
    stoneOvals: 24, // number of stony area ovals
    stoneOvalRadiusMin: 4,
    stoneOvalRadiusMax: 9,
    riverCount: 3, // number of squiggly rivers
    riverSegments: 140, // steps per river walk
    riverWidth: 1, // average half-width of a river
    forestCount: 30, // number of forest ovals
    forestRadiusMin: 3,
    forestRadiusMax: 8,
    treeDensity: 0.62, // chance a forest-oval tile grows a tree
    oreVeinCountStone: 40,
    oreVeinCountIron: 40,
    oreVeinCountCopper: 40,
    oreVeinMinGap: 3, // veins keep some distance apart
    groundWoodDensity: 0.05, // open green tiles that start with a wood item
    groundStoneDensity: 0.07,
    groundOreDensity: 0.04,
    startingMinions: 10,
    startingArea: 5, // 5x5 spawn area
  },

  // ---- UI ----
  ui: {
    maxFps: 60,
  },
};

/**
 * Speed (tiles / hour) for a given tile surface, used both for movement and
 * as the pathfinding weight (fast path is cheapest, then path, then off-path).
 */
export function tileSpeed(world, x, y) {
  const tile = world.tile(x, y);
  if (!tile) return CONFIG.minion.speedOffPathTilesPerHour;
  const b = tile.structure;
  if (!b) return CONFIG.minion.speedOffPathTilesPerHour;
  switch (b.def.kind) {
    case 'fastPath':
      return CONFIG.minion.speedFastPathTilesPerHour;
    case 'path':
    case 'bridge':
    case 'door':
      return CONFIG.minion.speedPathTilesPerHour;
    default:
      return CONFIG.minion.speedOffPathTilesPerHour;
  }
}
