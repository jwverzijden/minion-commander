/**
 * Input.js — Keyboard + mouse capture, exposing state and callbacks.
 *
 * Movement (WASD/arrows) is polled via `isDown`; discrete actions (E/Q/R/space/
 * Escape) and mouse events are surfaced through the handler callbacks Game sets.
 */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, button: 0 };

    this.onKeyDown = null; // (key, event)
    this.onKeyUp = null; // (key, event)
    this.onMouseDown = null; // (button, event)
    this.onMouseUp = null; // (button, event)
    this.onMouseMove = null; // (event)
    this.onWheel = null; // (deltaY)

    this._bind();
  }

  isDown(key) {
    return this.keys.has(key.toLowerCase());
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys.add(key);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }
      if (this.onKeyDown) this.onKeyDown(key, e);
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys.delete(key);
      if (this.onKeyUp) this.onKeyUp(key, e);
    });

    window.addEventListener('blur', () => this.keys.clear());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      if (this.onMouseMove) this.onMouseMove(e);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.down = true;
      this.mouse.button = e.button;
      if (this.onMouseDown) this.onMouseDown(e.button, e);
    });

    window.addEventListener('mouseup', (e) => {
      this.mouse.down = false;
      if (this.onMouseUp) this.onMouseUp(e.button, e);
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.onWheel) this.onWheel(e.deltaY);
    }, { passive: false });
  }

  /** Tile under the cursor, per the camera. */
  tileUnderMouse(camera) {
    const w = camera.screenToWorld(this.mouse.x, this.mouse.y);
    return { x: Math.floor(w.x), y: Math.floor(w.y) };
  }
}
