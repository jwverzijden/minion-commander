/**
 * Menu.js — Main menu, pause menu and the controls/help screen.
 *
 * Renders into the #overlay element and wires callbacks supplied by Game.
 */

export class Menu {
  constructor(overlayEl) {
    this.el = overlayEl;
    this.onBack = null;
  }

  hide() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  showMainMenu({ hasSave, onNew, onContinue, onControls }) {
    this.el.innerHTML = `
      <div class="menu">
        <h1>Minion Commander</h1>
        <p class="subtitle">Humans are gone. Guide the minions so they can survive and thrive.</p>
        ${hasSave ? '<button data-action="continue" class="primary">Continue</button>' : ''}
        <button data-action="new" class="${hasSave ? '' : 'primary'}">New Game</button>
        <button data-action="controls">Controls</button>
        <p class="note">Starting a new game overwrites the existing save.</p>
      </div>
    `;
    this.el.classList.remove('hidden');

    const bind = (action, fn) => {
      const btn = this.el.querySelector(`[data-action="${action}"]`);
      if (btn && fn) btn.addEventListener('click', fn);
    };
    bind('new', onNew);
    bind('continue', onContinue);
    bind('controls', onControls);
  }

  showPauseMenu({ onResume, onSaveAndExit }) {
    this.el.innerHTML = `
      <div class="menu">
        <h1>Paused</h1>
        <p class="subtitle">Game saved. Plan your build in peace.</p>
        <button data-action="resume" class="primary">Resume</button>
        <button data-action="exit">Save &amp; Exit to Menu</button>
      </div>
    `;
    this.el.classList.remove('hidden');
    this.el.querySelector('[data-action="resume"]').addEventListener('click', onResume);
    this.el.querySelector('[data-action="exit"]').addEventListener('click', onSaveAndExit);
  }

  showControls(onBack) {
    this.el.innerHTML = `
      <div class="menu">
        <h1>Controls</h1>
        <h2>World</h2>
        <div class="key-row"><span>Move view</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
        <div class="key-row"><span>Rotate world</span><span><kbd>Q</kbd> / <kbd>E</kbd></span></div>
        <h2>Building</h2>
        <div class="key-row"><span>Pick a building</span><span>hotbar</span></div>
        <div class="key-row"><span>Rotate ghost</span><span><kbd>R</kbd></span></div>
        <div class="key-row"><span>Place / drag paths</span><span>left click</span></div>
        <div class="key-row"><span>Cancel selection</span><span><kbd>Esc</kbd> / right click</span></div>
        <div class="key-row"><span>Demolish building</span><span><kbd>X</kbd> or <kbd>Del</kbd></span></div>
        <h2>Simulation</h2>
        <div class="key-row"><span>Pause / play</span><span><kbd>Space</kbd></span></div>
        <div class="key-row"><span>Pause &amp; save</span><span><kbd>Esc</kbd></span></div>
        <button data-action="back" class="primary">Back</button>
      </div>
    `;
    this.el.classList.remove('hidden');
    this.el.querySelector('[data-action="back"]').addEventListener('click', onBack);
  }
}
