import { load, save } from './save.js';

const prefersReducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  fire: ['KeyX', 'KeyJ', 'ControlLeft'],
  camera: ['KeyC', 'KeyK', 'ShiftLeft'],
  phone: ['KeyP', 'Tab'],
  pause: ['Escape'],
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Backspace'],
  answer1: ['Digit1', 'Numpad1'],
  answer2: ['Digit2', 'Numpad2'],
  answer3: ['Digit3', 'Numpad3'],
};

const defaults = () => ({
  master: 0.8,
  music: 0.55,
  sfx: 0.9,
  muted: false,
  reducedMotion: prefersReducedMotion(),
  reducedShake: prefersReducedMotion(),
  touchOpacity: 0.55,
  textScale: 1,
  language: null,
  keys: structuredClone(DEFAULT_KEYS),
  haptics: true,
});

class Settings extends EventTarget {
  constructor() {
    super();
    this.values = { ...defaults(), ...load('settings', {}) };
    this.values.keys = { ...structuredClone(DEFAULT_KEYS), ...(this.values.keys || {}) };
  }
  get(key) { return this.values[key]; }
  set(key, value) {
    this.values[key] = value;
    save('settings', this.values);
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }
  resetKeys() { this.set('keys', structuredClone(DEFAULT_KEYS)); }
}

export const settings = new Settings();
