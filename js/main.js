/**
 * main.js — Application entry point.
 *
 * Boots the Game and hands control to its requestAnimationFrame loop.
 */

import { Game } from './core/Game.js';

// Polyfill roundRect for older browsers (native since Chrome 99 / Safari 16).
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = [r[0] ?? 0, r[1] ?? r[0] ?? 0, r[2] ?? r[0] ?? 0, r[3] ?? r[0] ?? 0];
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br);
    this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h);
    this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl);
    this.arcTo(x, y, x + tl, y, tl);
    this.closePath();
    return this;
  };
}

const game = new Game();
game.start();
