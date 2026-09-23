/**
 * smoke.mjs — Headless logic test (no DOM).
 *
 * Runs world generation, a short task simulation, pathfinding, and save/load
 * round-trips to catch runtime errors without a browser.
 *
 *   node scripts/smoke.mjs
 */

import { CONFIG } from '../js/core/config.js';
import { bus } from '../js/core/EventBus.js';
import { GameTime } from '../js/core/GameTime.js';
import { generateWorld } from '../js/world/WorldGenerator.js';
import { World } from '../js/world/World.js';
import { Tile } from '../js/world/Tile.js';
import { BuildingManager } from '../js/buildings/BuildingManager.js';
import { Building } from '../js/buildings/Building.js';
import { Minion } from '../js/entities/Minion.js';
import { TaskSystem } from '../js/systems/TaskSystem.js';
import { findPath } from '../js/systems/Pathfinding.js';
import { buildingDef } from '../js/data/buildings.js';
import { RESOURCE_TYPES, RESOURCE_IDS } from '../js/data/resources.js';
import { Inventory } from '../js/systems/Inventory.js';
import { Camera } from '../js/rendering/Camera.js';

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ok  ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

// --- World generation ---
const gen = generateWorld(12345);
const world = gen.world;
assert(world.size === CONFIG.world.size, 'world is 100x100');
assert(gen.start.spawnPositions.length === CONFIG.worldGen.startingMinions, '5 minions spawned');
assert(gen.start.spawnPositions.every((p) => world.inBounds(p.x, p.y)), 'spawn positions in bounds');

// --- Building placement ---
const buildings = new BuildingManager(world);
assert(buildings.add('collectingStation', gen.start.x, gen.start.y, 0).ok, 'place collecting station');
assert(buildings.add('path', gen.start.x, gen.start.y + 1, 0).ok, 'place path');
assert(!buildings.add('path', gen.start.x, gen.start.y, 0).ok, 'reject overlapping placement');
assert(buildings.add('bridge', 0, 0, 0).ok === false || world.tile(0, 0).biome !== 'river', 'bridge rejects non-river');

// --- Pathfinding ---
const path = findPath(world, gen.start.x, gen.start.y + 1, gen.start.x + 4, gen.start.y + 1, {});
assert(Array.isArray(path) && path.length >= 5, 'pathfinding returns a route');

// --- Simulation ---
const minions = gen.start.spawnPositions.map((p) => new Minion(p.x, p.y));
const taskSystem = new TaskSystem(world, buildings, bus);
const time = new GameTime();
const step = 0.1; // hours
for (let i = 0; i < 300; i++) {
  taskSystem.update(minions, step, time.hours);
  time.hours += step;
}
assert(minions.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y)), 'minion positions finite');
assert(minions.some((m) => m.battery < CONFIG.minion.maxBatteryHours), 'battery drains with work');
console.log('  minions:', minions.map((m) => `${m.state}@${m.tileX()},${m.tileY()} batt=${m.battery.toFixed(1)}`).join(' | '));

// --- Save/load round-trips ---
const b = buildings.structures[0];
const b2 = Building.fromJSON(b.toJSON(), buildingDef(b.def.id));
assert(b2.id === b.id && b2.state === b.state, 'building JSON round-trip');

const m = minions[0];
const m2 = Minion.fromJSON(m.toJSON());
assert(m2.id === m.id && m2.battery === m.battery && m2.x === m.x, 'minion JSON round-trip');

// --- Tile / World helpers ---
const tile = world.tile(5, 5);
assert(tile instanceof Tile && tile.x === 5, 'tile lookup');
assert(world.inBounds(0, 0) && !world.inBounds(-1, 5), 'world bounds');

// --- Inventory ---
const inv = new Inventory(5);
inv.add('wood', 3);
assert(inv.count('wood') === 3 && inv.total === 3, 'inventory add/count');
const invSingle = new Inventory(50, { singleType: true });
invSingle.add('wood', 2);
assert(!invSingle.canAdd('stone'), 'single-type inventory restriction');

// --- Resource catalogue ---
assert(RESOURCE_IDS.length === 11 && RESOURCE_TYPES.wood.name === 'Wood', 'resource defs');

// --- Camera math (no zoom, 90-degree rotation) ---
const cam = new Camera(world.size);
cam.resize(1280, 720);
cam.centerOn(50, 50);
const screen = cam.worldToScreen(50, 50);
assert(Math.abs(screen.x - 640) < 0.001 && Math.abs(screen.y - 360) < 0.001, 'camera centre maps to viewport centre');
cam.rotate(1);
const w2 = cam.screenToWorld(100, 100);
assert(Number.isFinite(w2.x) && Number.isFinite(w2.y), 'camera rotates without NaN');

// --- Inventory designation ---
const invD = new Inventory(50, { singleType: true });
invD.setDesignation('stone');
assert(invD.canAdd('stone') && !invD.canAdd('wood'), 'designation locks the type');
invD.add('stone', 5);
invD.setDesignation('wood');
assert(!invD.canAdd('wood'), 'cannot mix types while holding items');
invD.remove('stone', 5);
assert(invD.canAdd('wood'), 'new designation applies once empty');

// --- Demolition refunds ---
const siteDef = buildingDef('storageSmall');
const site = new Building(siteDef, 70, 70, 0);
site.delivered = { wood: 3 };
const refSite = buildings.destroy(site);
assert((refSite.wood || 0) === 3, 'construction site refunds only delivered materials');

const finished = new Building(siteDef, 75, 75, 0);
finished.state = 'built';
const refFinished = buildings.destroy(finished);
assert((refFinished.wood || 0) === 5, 'finished building refunds 50% rounded up');

// --- Camera vertical clamp (landscape screens must still scroll full height) ---
const cam2 = new Camera(world.size);
cam2.resize(1280, 720);
cam2.centerOn(50, 5);
assert(cam2.cy < 20, 'camera can reach near the top of the world');
cam2.centerOn(50, 95);
assert(cam2.cy > 80, 'camera can reach near the bottom of the world');

// --- Transport & duplication task generation ---
const factory = new Building(buildingDef('factory'), 40, 40, 0);
factory.state = 'built';
factory.output.add('planks', 1);
buildings.structures.push(factory);

const transport = new Building(buildingDef('transportStation'), 46, 46, 0);
transport.state = 'built';
buildings.structures.push(transport);

const tTasks = taskSystem._buildingTasks(transport);
assert(
  tTasks.some((t) => t.type === 'depositOutput' && t.targetId === factory.id),
  'transport station deposits craft output',
);

const dup = new Building(buildingDef('minionDuplicationStation'), 60, 60, 0);
dup.state = 'built';
buildings.structures.push(dup);
assert(
  taskSystem._buildingTasks(dup).some((t) => t.type === 'duplicate'),
  'duplication station generates a duplicate task',
);

// --- Duplication execution emits a spawn event ---
let spawnPos = null;
const off = bus.on('minion-spawn', (p) => {
  spawnPos = p;
});
const dupMinion = new Minion(60, 60);
const dupDoor = dup.doorTile();
dupMinion.x = dupDoor.x + 0.5;
dupMinion.y = dupDoor.y + 0.5;
dupMinion.state = 'working';
dupMinion.workRemaining = 0.01;
dupMinion.task = { type: 'duplicate', buildingId: dup.id, step: 1 };
taskSystem._execute(dupMinion, 0.1, 0);
off();
assert(
  spawnPos && Number.isInteger(spawnPos.x) && Number.isInteger(spawnPos.y),
  'duplication spawns a new minion',
);

// --- Sink gating (collect only when something wants the item) ---
const sinkWorld = generateWorld(999).world;
const sinkBm = new BuildingManager(sinkWorld);
const sinkTs = new TaskSystem(sinkWorld, sinkBm, bus);
assert(sinkTs._hasSinkFor('wood') === false, 'no sink for wood in an empty world');
const sinkStore = new Building(buildingDef('storageSmall'), 20, 20, 0);
sinkStore.state = 'built';
sinkBm.structures.push(sinkStore);
assert(sinkTs._hasSinkFor('wood') === true, 'an empty storage is a sink for wood');

// --- Claimed targets are not re-assigned (no two minions on one tree) ---
let treeTile = null;
for (const t of world.forEachTile()) {
  if (t.tree && t.tree.mature) {
    treeTile = t;
    break;
  }
}
if (treeTile) {
  const wcs = new Building(buildingDef('woodcuttingStation'), treeTile.x - 1, treeTile.y - 1, 0);
  wcs.state = 'built';
  const claimedSet = new Set([`cut:${treeTile.x},${treeTile.y}`]);
  const cutTasks = taskSystem._buildingTasks(wcs, claimedSet, new Set(['wood']));
  assert(
    !cutTasks.some((t) => t.type === 'cutTree' && t.x === treeTile.x && t.y === treeTile.y),
    'a claimed tree is not re-assigned',
  );
}

// --- Craft recipe designation ---
const factory2 = new Building(buildingDef('factory'), 30, 30, 0);
factory2.state = 'built';
factory2.designatedRecipe = 'gears';
factory2.input.add('planks', 1);
const chosen = taskSystem._pickCraftRecipe(factory2);
assert(chosen && chosen.id === 'gears', 'designated craft recipe is respected');

// --- _done never leaves a minion carrying ---
const carrier = new Minion(5, 5);
carrier.carried = { type: 'wood', qty: 1 };
taskSystem._done(carrier);
assert(carrier.carried === null && carrier.state === 'idle', '_done drops any carried item');

// --- Save/load round-trip of a minion mid-fetchInput (no live references) ---
const srcStore = new Building(buildingDef('storageSmall'), 10, 10, 0);
srcStore.state = 'built';
srcStore.inventory.add('wood', 3);
buildings.structures.push(srcStore);

const fetchMinion = new Minion(11, 11);
fetchMinion.task = {
  type: 'fetchInput',
  buildingId: factory.id,
  itemType: 'wood',
  source: { kind: 'storage', x: 10, y: 10, buildingId: srcStore.id },
  step: 0,
};
const roundtrip = Minion.fromJSON(JSON.parse(JSON.stringify(fetchMinion.toJSON())));
assert(
  roundtrip.task.source.buildingId === srcStore.id && roundtrip.task.source.building === undefined,
  'task source serialises as a building id',
);
const took = taskSystem._takeFromSource(roundtrip, 'wood', roundtrip.task.source);
assert(took === true && srcStore.inventory.count('wood') === 2, '_takeFromSource works after a load');

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
