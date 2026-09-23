/**
 * GameTime.js — In-game clock.
 *
 * Time is measured in in-game hours (float). 1 hour = 15 real seconds.
 * 1 day = 24 hours. This class advances the clock and emits day boundaries so
 * other systems can react (autosave, tree growth, minion ageing).
 */

import { CONFIG } from './config.js';

export class GameTime {
  constructor() {
    this.hours = 0; // total elapsed in-game hours
    this.day = 1; // 1-based day counter
  }

  /** Total days elapsed (float, 0-based) — used for tree growth. */
  get daysFloat() {
    return this.hours / CONFIG.time.hoursPerDay;
  }

  /** Advance by real seconds; returns true if a day boundary was crossed. */
  advance(realSeconds) {
    const before = this.hours;
    this.hours += realSeconds / CONFIG.time.secondsPerHour;

    const beforeDay = Math.floor(before / CONFIG.time.hoursPerDay);
    const afterDay = Math.floor(this.hours / CONFIG.time.hoursPerDay);
    if (afterDay > beforeDay) {
      this.day = afterDay + 1;
      return true;
    }
    return false;
  }

  /** HH:MM (in-game) string. */
  timeOfDay() {
    const h = Math.floor(this.hours % CONFIG.time.hoursPerDay);
    const m = Math.floor((this.hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  toJSON() {
    return { hours: this.hours, day: this.day };
  }

  fromJSON(o) {
    this.hours = o.hours ?? 0;
    this.day = o.day ?? 1;
  }
}
