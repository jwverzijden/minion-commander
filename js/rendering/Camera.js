/**
 * Camera.js — Viewport transform with 90-degree world rotation and panning.
 *
 * The world is square; the camera is clamped so the background never shows.
 * There is no zoom — the tile size adapts once to the screen so the world
 * always fills the viewport.
 */

import { CONFIG } from '../core/config.js';

export class Camera {
  constructor(worldSize) {
    this.worldSize = worldSize;
    this.cx = worldSize / 2;
    this.cy = worldSize / 2;
    this.rotation = 0; // 0..3 (90-degree clockwise turns)
    this.vw = 800;
    this.vh = 600;
    this.tileSize = CONFIG.world.tileSize;
  }

  resize(vw, vh) {
    this.vw = vw;
    this.vh = vh;
    this.tileSize = Math.max(
      CONFIG.world.tileSize,
      Math.ceil(Math.max(vw, vh) / this.worldSize),
    );
    this.clamp();
  }

  rotate(delta) {
    this.rotation = (this.rotation + delta + 4) % 4;
  }

  /** Pan by a screen-space pixel delta (WASD). */
  pan(dxPx, dyPx) {
    const w = this._screenVecToWorld(dxPx / this.tileSize, dyPx / this.tileSize);
    this.cx += w.x;
    this.cy += w.y;
    this.clamp();
  }

  centerOn(x, y) {
    this.cx = x;
    this.cy = y;
    this.clamp();
  }

  clamp() {
    // Half-extents in tiles. The viewport swaps axes when rotated 90 degrees,
    // so each axis uses its own dimension rather than the larger of the two.
    const vwTiles = this.vw / this.tileSize;
    const vhTiles = this.vh / this.tileSize;
    const halfX = ((this.rotation % 2 === 0) ? vwTiles : vhTiles) / 2;
    const halfY = ((this.rotation % 2 === 0) ? vhTiles : vwTiles) / 2;
    this.cx = Math.max(halfX, Math.min(this.worldSize - halfX, this.cx));
    this.cy = Math.max(halfY, Math.min(this.worldSize - halfY, this.cy));
  }

  _screenVecToWorld(dx, dy) {
    switch (this.rotation) {
      case 0:
        return { x: dx, y: dy };
      case 1:
        return { x: dy, y: -dx };
      case 2:
        return { x: -dx, y: -dy };
      case 3:
        return { x: -dy, y: dx };
      default:
        return { x: dx, y: dy };
    }
  }

  worldToScreen(wx, wy) {
    const ts = this.tileSize;
    const dx = wx * ts - this.cx * ts;
    const dy = wy * ts - this.cy * ts;
    let ox;
    let oy;
    switch (this.rotation) {
      case 0:
        ox = dx;
        oy = dy;
        break;
      case 1:
        ox = -dy;
        oy = dx;
        break;
      case 2:
        ox = -dx;
        oy = -dy;
        break;
      case 3:
        ox = dy;
        oy = -dx;
        break;
      default:
        ox = dx;
        oy = dy;
    }
    return { x: this.vw / 2 + ox, y: this.vh / 2 + oy };
  }

  screenToWorld(sx, sy) {
    const ts = this.tileSize;
    const dx = sx - this.vw / 2;
    const dy = sy - this.vh / 2;
    let wx;
    let wy;
    switch (this.rotation) {
      case 0:
        wx = dx;
        wy = dy;
        break;
      case 1:
        wx = dy;
        wy = -dx;
        break;
      case 2:
        wx = -dx;
        wy = -dy;
        break;
      case 3:
        wx = -dy;
        wy = dx;
        break;
      default:
        wx = dx;
        wy = dy;
    }
    return { x: this.cx + wx / ts, y: this.cy + wy / ts };
  }

  /** Axis-aligned world tile range currently visible. */
  visibleWorldRect() {
    const corners = [
      [0, 0],
      [this.vw, 0],
      [this.vw, this.vh],
      [0, this.vh],
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [sx, sy] of corners) {
      const w = this.screenToWorld(sx, sy);
      x0 = Math.min(x0, w.x);
      x1 = Math.max(x1, w.x);
      y0 = Math.min(y0, w.y);
      y1 = Math.max(y1, w.y);
    }
    return {
      x0: Math.max(0, Math.floor(x0)),
      y0: Math.max(0, Math.floor(y0)),
      x1: Math.min(this.worldSize - 1, Math.ceil(x1)),
      y1: Math.min(this.worldSize - 1, Math.ceil(y1)),
    };
  }
}
