/**
 * EventBus.js — Tiny pub/sub used to decouple systems.
 *
 * Usage:
 *   bus.on('toast', (msg) => ...)
 *   bus.emit('toast', { text: 'Saved!', kind: 'info' })
 */

export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._handlers.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${event}" threw:`, err);
      }
    }
  }

  clear() {
    this._handlers.clear();
  }
}

/** Shared singleton for the whole game. */
export const bus = new EventBus();
