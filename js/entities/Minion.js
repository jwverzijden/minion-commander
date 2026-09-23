/**
 * Minion.js — A minion entity (a data holder + movement helper).
 *
 * Behaviour (tasks, battery, ageing) is driven by the TaskSystem, which keeps
 * this class serialisable and free of game logic.
 */

import { CONFIG, tileSpeed } from '../core/config.js';
import { HEAVY_RESOURCES } from '../data/resources.js';

let NEXT_MINION_ID = 1;

export class Minion {
  /**
   * @param {number} x tile x (spawn)
   * @param {number} y tile y (spawn)
   */
  constructor(x, y) {
    this.id = NEXT_MINION_ID++;
    this.x = x + 0.5; // centre of tile, float
    this.y = y + 0.5;

    this.age = 0; // in-game hours
    this.battery = CONFIG.minion.maxBatteryHours;

    /** 'idle' | 'moving' | 'working' | 'recharging' */
    this.state = 'idle';

    /** Current task (set by TaskSystem) or null. */
    this.task = null;

    /** Remaining path as [{x,y}] float centres, consumed from the front. */
    this.path = [];

    /** { type, qty } currently carried, or null. */
    this.carried = null;

    /** Work timer (hours). */
    this.workRemaining = 0;
    this.workTotal = 1;

    /** Low-battery flag: finish current delivery at half speed, then recharge. */
    this.lowBattery = false;

    this.dead = false;
  }

  tileX() {
    return Math.floor(this.x);
  }

  tileY() {
    return Math.floor(this.y);
  }

  /** Current movement speed in tiles/hour, accounting for surface + carry penalty. */
  speed(world) {
    let s = tileSpeed(world, this.tileX(), this.tileY());
    if (this.carried && HEAVY_RESOURCES.has(this.carried.type)) {
      s *= 1 - CONFIG.minion.carryPenalty;
    }
    if (this.lowBattery) s *= 0.5;
    return s;
  }

  /**
   * Advance along `this.path` by dt hours. Returns true when the path is done.
   */
  moveAlongPath(world, dt) {
    if (this.path.length === 0) return true;
    const speed = this.speed(world);
    let remaining = speed * dt; // tiles to travel this frame

    while (remaining > 0 && this.path.length > 0) {
      const target = this.path[0];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining || dist < 1e-6) {
        this.x = target.x;
        this.y = target.y;
        this.path.shift();
        remaining -= dist;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    return this.path.length === 0;
  }

  /** Begin moving to a tile (goal allowed to be a blocked tree/vein tile). */
  setPathTo(tx, ty, path) {
    if (!path || path.length === 0) return false;
    this.path = path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    // Drop the first node when it is our current tile.
    const first = this.path[0];
    if (Math.abs(first.x - this.x) < 0.1 && Math.abs(first.y - this.y) < 0.1) {
      this.path.shift();
    }
    if (this.path.length === 0) return false;
    this.state = 'moving';
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      age: this.age,
      battery: this.battery,
      state: this.state,
      task: this.task ? { ...this.task } : null,
      path: this.path.map((p) => ({ ...p })),
      carried: this.carried ? { ...this.carried } : null,
      workRemaining: this.workRemaining,
      workTotal: this.workTotal,
      lowBattery: this.lowBattery,
    };
  }

  static fromJSON(o) {
    const m = new Minion(0, 0);
    m.id = o.id;
    m.x = o.x;
    m.y = o.y;
    m.age = o.age;
    m.battery = o.battery;
    m.state = o.state;
    m.task = o.task ? { ...o.task } : null;
    // Migrate older saves that stored a live building reference inside a task's
    // source — replace it with the building id so lookups work after loading.
    if (m.task && m.task.source && m.task.source.building && !m.task.source.buildingId) {
      m.task.source = { ...m.task.source, buildingId: m.task.source.building.id };
      delete m.task.source.building;
    }
    m.path = (o.path || []).map((p) => ({ ...p }));
    m.carried = o.carried ? { ...o.carried } : null;
    m.workRemaining = o.workRemaining ?? 0;
    m.workTotal = o.workTotal ?? 1;
    m.lowBattery = o.lowBattery ?? false;
    if (m.id >= NEXT_MINION_ID) NEXT_MINION_ID = m.id + 1;
    return m;
  }
}
