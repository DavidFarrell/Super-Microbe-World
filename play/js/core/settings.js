// Player settings, saved to localStorage as overrides only: a key is stored once the player sets
// it, and everything else follows the current defaults. So a later change to the default key
// bindings reaches players who never remapped, and the reduced-motion settings keep following
// the OS preference (prefers-reduced-motion) until the player chooses a value in game.
import { load, save } from './save.js';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const motionMedia = (() => { try { return matchMedia(MOTION_QUERY); } catch { return null; } })();
const prefersReducedMotion = () => !!(motionMedia && motionMedia.matches);

// Arrow keys / WASD ride, Space (or Up) jumps. The 2009 original took photos with Ctrl and threw
// soap with Space; Space now jumps (Up and W still do), so throwing moved to X/J and Ctrl stays a
// camera key beside C/K, which prompts advertise (Ctrl+arrow is an OS shortcut on some systems).
export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  fire: ['KeyX', 'KeyJ'],
  camera: ['KeyC', 'KeyK', 'ControlLeft', 'ControlRight', 'ShiftLeft'],
  phone: ['KeyP', 'Tab'],
  pause: ['Escape'],
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Backspace'],
  answer1: ['Digit1', 'Numpad1'],
  answer2: ['Digit2', 'Numpad2'],
  answer3: ['Digit3', 'Numpad3'],
  // Kitchen tools (web/js/kitchen/controls.js reads them by code; NOTES 5.6).
  tissues: ['KeyT', 'Digit1', 'Numpad1'],
  clingfilm: ['KeyC', 'Digit2', 'Numpad2'],
  wash: ['KeyH', 'Digit3', 'Numpad3'],
};

// Defaults. reducedMotion / reducedShake are null, meaning "follow the OS preference".
const DEFAULTS = Object.freeze({
  master: 0.8,
  music: 0.55,
  sfx: 0.9,
  muted: false,
  reducedMotion: null,
  reducedShake: null,
  touchOpacity: 0.55,
  textScale: 1,
  language: null,
  haptics: true,
});
const FOLLOWS_OS = new Set(['reducedMotion', 'reducedShake']);
const SCHEMA = 2;

// Settings saved by earlier builds were the whole merged object (defaults included), so they
// cannot tell a choice from a default. Keep the values that differ from today's defaults, and
// drop the OS-derived motion flags and the full key map, which were never real choices then.
function migrate(stored) {
  if (!stored || typeof stored !== 'object') return {};
  if (stored.v === SCHEMA) { const { v, ...rest } = stored; return rest; }
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    if (k in DEFAULTS && !FOLLOWS_OS.has(k) && v !== DEFAULTS[k]) out[k] = v;
  }
  return out;
}

class Settings extends EventTarget {
  constructor() {
    super();
    this.overrides = migrate(load('settings', null));
    if (motionMedia) {
      const onOs = () => {
        for (const key of FOLLOWS_OS) if (this.overrides[key] == null) this._emit(key, this.get(key));
      };
      if (motionMedia.addEventListener) motionMedia.addEventListener('change', onOs);
      else if (motionMedia.addListener) motionMedia.addListener(onOs);
    }
  }

  get(key) {
    const o = this.overrides[key];
    if (key === 'keys') return o ? { ...structuredClone(DEFAULT_KEYS), ...o } : structuredClone(DEFAULT_KEYS);
    if (FOLLOWS_OS.has(key)) return o == null ? prefersReducedMotion() : !!o;
    return o !== undefined ? o : DEFAULTS[key];
  }

  // True when the player has set this key (false: it follows the default or the OS).
  isSet(key) { return this.overrides[key] != null; }

  // Stores a player choice. null (or undefined) clears it, so the key follows the default again.
  set(key, value) {
    if (value == null) delete this.overrides[key];
    else this.overrides[key] = key === 'keys' ? structuredClone(value) : value;
    save('settings', { v: SCHEMA, ...this.overrides });
    this._emit(key, this.get(key));
  }

  resetKeys() { this.set('keys', null); }

  _emit(key, value) { this.dispatchEvent(new CustomEvent('change', { detail: { key, value } })); }
}

export const settings = new Settings();
