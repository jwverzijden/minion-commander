/**
 * Inventory.js — A capacity-limited item buffer.
 *
 * Used for two shapes:
 *   - Workstation input/output buffers (capacity 5, mixed item types allowed)
 *   - Storage buildings (capacity 50/150/400, restricted to ONE item type)
 */

export class Inventory {
  constructor(capacity, { singleType = false, inventoryType = null } = {}) {
    this.capacity = capacity;
    this.singleType = singleType;
    this.inventoryType = inventoryType;

    /** resource id -> quantity */
    this.items = {};

    /** The actual stored type (null when empty). */
    this.type = null;

    /** Player's chosen type for single-type storage (null = auto). */
    this.designatedType = null;

    this.assignedDelivery = 0;
  }

  get total() {
    let n = 0;
    for (const k in this.items) n += this.items[k];
    return n;
  }

  count(type) {
    return this.items[type] || 0;
  }

  get isEmpty() {
    return this.total === 0;
  }

  get isFull() {
    return this.total >= this.capacity;
  }

  /** Which type would a single-type inventory store (null if empty). */
  get lockedType() {
    return this.type;
  }

  assignDelivery(qty = 1) {
    this.assignedDelivery += qty;
  }

  canAdd(type, qty = 1) {
    const active = this.isEmpty ? this.designatedType : this.type;
    if (this.singleType) {
      // While holding items, only the held type may be added; once empty, the
      // player's designation (or any type, when auto) takes over. This keeps a
      // single-type inventory from ever mixing two item types.
      if (active && active !== type) return false;
    }
    if (this.inventoryType === 'storage') {
      // storage cant accept anything if the selection is none
      if (active === null) return false;
    }
    return this.total + qty + this.assignedDelivery <= this.capacity;
  }

  canAdd2(type, qty = 1) {
    const active = this.isEmpty ? this.designatedType : this.type;
    if (this.singleType) {
      // While holding items, only the held type may be added; once empty, the
      // player's designation (or any type, when auto) takes over. This keeps a
      // single-type inventory from ever mixing two item types.
      if (active && active !== type) return false;
    }
    if (this.inventoryType === 'storage') {
      // storage cant accept anything if the selection is none
      if (active === null) return false;
    }
    return this.total + qty <= this.capacity;
  }

  add(type, qty = 1, adjustAssignedDelivery = true) {
    if (!this.canAdd2(type, qty)) return 0;
    if (this.singleType) this.type = type;
    this.items[type] = (this.items[type] || 0) + qty;
    if( adjustAssignedDelivery )
      this.assignedDelivery -= qty;
    return qty;
  }

  remove(type, qty = 1) {
    const have = this.items[type] || 0;
    const take = Math.min(have, qty);
    if (take <= 0) return 0;
    this.items[type] = have - take;
    if (this.items[type] <= 0) {
      delete this.items[type];
      // Once empty, adopt the player's designation (or null when auto).
      if (this.singleType && this.total === 0) this.type = this.designatedType;
    }
    return take;
  }

  /**
   * Set/clear the item type a single-type storage is locked to.
   * When the storage is empty this also updates the displayed type immediately.
   */
  setDesignation(typeOrNull) {
    if (!this.singleType) return;
    this.designatedType = typeOrNull;
    if (this.isEmpty) this.type = typeOrNull;
  }

  /** First available resource id, or null. */
  peek() {
    for (const k in this.items) return k;
    return null;
  }

  toJSON() {
    return {
      capacity: this.capacity,
      singleType: this.singleType,
      items: this.items,
      type: this.type,
      designatedType: this.designatedType,
    };
  }

  static fromJSON(o) {
    const inv = new Inventory(o.capacity, { singleType: o.singleType });
    inv.items = { ...(o.items || {}) };
    inv.type = o.type ?? null;
    inv.designatedType = o.designatedType ?? null;
    return inv;
  }
}
