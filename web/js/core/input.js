// Unified input. Keyboard, on-screen touch controls, gamepads and injected input
// (tests, bots, replays) all feed one per-tick action state, so gameplay code only
// ever asks "is jump down / was fire pressed this tick".
import { settings } from './settings.js';

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'camera', 'phone', 'pause', 'confirm', 'back', 'answer1', 'answer2', 'answer3', 'tissues', 'clingfilm', 'wash'];

const GAMEPAD_BUTTONS = { 0: 'jump', 1: 'camera', 2: 'fire', 3: 'phone', 9: 'pause', 8: 'back', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const NO_SCROLL_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

class Input extends EventTarget {
  constructor() {
    super();
    this.keysDown = new Set();
    this.touchDown = new Map(); // action -> count of pointers holding it
    // Keys / touch actions pressed since the last poll. A tap that goes down and up between two
    // 15 ms polls would otherwise be lost; it now counts as down for one poll.
    this.keysTapped = new Set();
    this.touchTapped = new Set();
    this.injected = new Set();
    this.padDown = new Set();
    this.down = new Set();
    this.prev = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    // Start with the touch controls on any device with a touchscreen (phones and tablets, and
    // touchscreen laptops, whose primary pointer is fine); the first key press hides them.
    this.lastDevice = matchMedia('(pointer: coarse), (any-pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.enabled = true;
    this.log = null; // when an array, every tick's down-set is recorded for replays
    this._codeToActions = new Map();
    this._rebuildKeymap();
    settings.addEventListener('change', e => { if (e.detail.key === 'keys') this._rebuildKeymap(); });
    this._attachKeyboard();
    this._attachPointer();
    addEventListener('blur', () => this.clearAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearAll(); });
  }

  _rebuildKeymap() {
    this._codeToActions.clear();
    const keys = settings.get('keys');
    for (const [action, codes] of Object.entries(keys)) {
      for (const code of codes) {
        if (!this._codeToActions.has(code)) this._codeToActions.set(code, []);
        this._codeToActions.get(code).push(action);
      }
    }
  }

  _attachKeyboard() {
    addEventListener('keydown', e => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;
      this._setDevice('keyboard');
      if (NO_SCROLL_CODES.has(e.code) && !(t && t.closest && t.closest('[data-native-keys]'))) e.preventDefault();
      if (!e.repeat) { this.keysDown.add(e.code); this.keysTapped.add(e.code); }
    });
    addEventListener('keyup', e => this.keysDown.delete(e.code));
  }

  // Any touch anywhere (canvas, letterbox bars, menus) switches to touch, so the on-screen
  // controls come back after a key press (a phone with a Bluetooth keyboard, a stray key) without
  // needing a control that is hidden in keyboard mode. A mouse press switches back.
  _attachPointer() {
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') this._setDevice('touch');
      else if (e.pointerType === 'mouse') this._setDevice('keyboard');
    }, { capture: true, passive: true });
  }

  _setDevice(device) {
    if (this.lastDevice === device) return;
    this.lastDevice = device;
    document.documentElement.dataset.input = device;
    this.dispatchEvent(new CustomEvent('device', { detail: device }));
  }

  // Touch buttons: each held pointer increments the action's count.
  touchPress(action) { this._setDevice('touch'); this.touchDown.set(action, (this.touchDown.get(action) || 0) + 1); this.touchTapped.add(action); }
  touchRelease(action) {
    const n = (this.touchDown.get(action) || 0) - 1;
    if (n <= 0) this.touchDown.delete(action); else this.touchDown.set(action, n);
  }

  inject(action, isDown) { if (isDown) this.injected.add(action); else this.injected.delete(action); }
  injectOnly(actions) { this.injected = new Set(actions); }

  clearAll() {
    this.keysDown.clear();
    this.keysTapped.clear();
    this.touchDown.clear();
    this.touchTapped.clear();
    this.padDown.clear();
  }

  _pollGamepads() {
    this.padDown.clear();
    if (!navigator.getGamepads) return;
    for (const pad of navigator.getGamepads()) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((b, i) => {
        if (b.pressed && GAMEPAD_BUTTONS[i]) { this.padDown.add(GAMEPAD_BUTTONS[i]); this._setDevice('gamepad'); }
      });
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -0.45) this.padDown.add('left');
      if (ax > 0.45) this.padDown.add('right');
      if (ay < -0.6) this.padDown.add('up');
      if (ay > 0.6) this.padDown.add('down');
      if (this.padDown.has('jump')) this.padDown.add('confirm');
      if (this.padDown.has('camera')) this.padDown.add('back');
    }
  }

  // Called once per simulation tick before scenes update.
  poll() {
    this._pollGamepads();
    const next = new Set();
    if (this.enabled) {
      for (const code of this.keysDown) for (const a of this._codeToActions.get(code) || []) next.add(a);
      for (const code of this.keysTapped) for (const a of this._codeToActions.get(code) || []) next.add(a);
      for (const a of this.touchDown.keys()) next.add(a);
      for (const a of this.touchTapped) next.add(a);
      for (const a of this.padDown) next.add(a);
    }
    for (const a of this.injected) next.add(a);
    this.keysTapped.clear();
    this.touchTapped.clear();
    this.prev = this.down;
    this.down = next;
    this.pressedSet = new Set([...next].filter(a => !this.prev.has(a)));
    this.releasedSet = new Set([...this.prev].filter(a => !next.has(a)));
    if (this.log) this.log.push([...next].sort().join(','));
  }

  isDown(action) { return this.down.has(action); }
  pressed(action) { return this.pressedSet.has(action); }
  released(action) { return this.releasedSet.has(action); }
  anyPressed(...actions) { return actions.some(a => this.pressedSet.has(a)); }
}

export const input = new Input();
document.documentElement.dataset.input = input.lastDevice;
