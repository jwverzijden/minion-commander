/**
 * Renderer.js — Draws the world, structures, minions and the placement ghost.
 *
 * Everything is drawn in a canvas transform that applies the camera's position
 * and 90-degree rotation, then each sprite is painted at world-pixel coords.
 */

import {
  drawGround,
  drawGroundItem,
  drawTree,
  drawVein,
  drawBuilding,
  drawMinion,
  drawGhost,
  drawSelection,
} from './Sprites.js';

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
    this.width = 0;
    this.height = 0;
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(width, height);
  }

  render(game) {
    const { world, buildings, minions, camera } = game;
    const ctx = this.ctx;
    const ts = camera.tileSize;

    // Keep the DPR transform applied so CSS-pixel coordinates fill the canvas
    // correctly on high-DPI (retina) screens.
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(camera.vw / 2, camera.vh / 2);
    ctx.rotate(camera.rotation * (Math.PI / 2));
    ctx.translate(-camera.cx * ts, -camera.cy * ts);

    const rect = camera.visibleWorldRect();

    // Ground pass.
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const t = world.tile(x, y);
        if (t) drawGround(ctx, t, ts);
      }
    }
    // Resource pass (veins, trees, loose items).
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const t = world.tile(x, y);
        if (!t) continue;
        if (t.vein) drawVein(ctx, t, ts);
        if (t.tree) drawTree(ctx, t, ts);
        if (t.groundItem) drawGroundItem(ctx, t, ts);
      }
    }

    // Structures.
    for (const b of buildings.structures) {
      const bx1 = b.x + b.rotatedW - 1;
      const by1 = b.y + b.rotatedH - 1;
      if (bx1 < rect.x0 || b.x > rect.x1 || by1 < rect.y0 || b.y > rect.y1) continue;
      drawBuilding(ctx, b, ts);
    }

    // Minions.
    const nowSec = performance.now() / 1000;
    for (const m of minions) {
      if (m.dead) continue;
      const tx = Math.floor(m.x);
      const ty = Math.floor(m.y);
      if (tx < rect.x0 || tx > rect.x1 || ty < rect.y0 || ty > rect.y1) continue;
      drawMinion(ctx, m, ts, nowSec);
    }

    // Placement ghost (single tile) or a dragged path line.
    if (game.dragPreview && game.dragPreview.length > 0) {
      ctx.fillStyle = 'rgba(93,179,255,0.35)';
      ctx.strokeStyle = 'rgba(93,179,255,0.9)';
      ctx.lineWidth = 2;
      for (const p of game.dragPreview) {
        ctx.fillRect(p.x * ts + 1, p.y * ts + 1, ts - 2, ts - 2);
        ctx.strokeRect(p.x * ts + 1, p.y * ts + 1, ts - 2, ts - 2);
      }
    } else if (game.ghost) {
      const g = game.ghost;
      drawGhost(ctx, world, g.def, g.x, g.y, g.rotation, g.valid, ts);
    }

    // Highlight the inspected building / resource / minion.
    if (game.inspected) {
      drawSelection(ctx, game.inspected, ts);
    }

    ctx.restore();
  }
}
