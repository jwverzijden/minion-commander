/**
 * SaveManager.js — Persistence to localStorage (one save slot).
 *
 * The world itself is regenerated deterministically from a seed; the save
 * stores the seed plus every runtime mutation (tiles, buildings, minions, time).
 */

const SAVE_KEY = 'minion-commander-save-v1';

export class SaveManager {
  constructor(key = SAVE_KEY) {
    this.key = key;
  }

  hasSave() {
    try {
      return localStorage.getItem(this.key) !== null;
    } catch {
      return false;
    }
  }

  save(obj) {
    try {
      localStorage.setItem(this.key, JSON.stringify(obj));
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}
