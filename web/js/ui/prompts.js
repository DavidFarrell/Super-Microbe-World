// Control prompts that follow the input device in use. Text uses placeholders such as
// {press_camera} ("press C" on a keyboard, "tap the camera button" on touch, "press B" on a
// gamepad) and {key_jump} (the key or button name alone); promptVars() fills them all.
import { settings } from '../core/settings.js';
import { input } from '../core/input.js';
import { t, has } from '../core/i18n.js';

const ACTIONS = ['left', 'right', 'jump', 'fire', 'camera', 'phone', 'pause', 'confirm', 'back', 'tissues', 'clingfilm', 'wash'];
// Standard gamepad layout names (core/input.js GAMEPAD_BUTTONS). The kitchen tools are the camera,
// fire and phone buttons (web/js/kitchen/kitchenScene.js).
const PAD = { jump: 'A', camera: 'B', fire: 'X', phone: 'Y', pause: 'Start', confirm: 'A', back: 'Back', left: '←', right: '→', tissues: 'B', clingfilm: 'X', wash: 'Y' };

// Short display name of a KeyboardEvent.code.
export function keyLabel(code) {
  if (has('key.' + code)) return t('key.' + code);
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

// The first bound key of an action (the one prompts advertise).
export function keyFor(action) {
  const codes = (settings.get('keys') || {})[action] || [];
  return codes.length ? keyLabel(codes[0]) : '?';
}

export function device() {
  const d = input.lastDevice;
  return d === 'touch' || d === 'gamepad' ? d : 'keyboard';
}

// All prompt placeholders for the current (or given) device.
export function promptVars(dev = device()) {
  const vars = {};
  for (const a of ACTIONS) {
    const key = dev === 'gamepad' ? PAD[a] || '?' : keyFor(a);
    vars['key_' + a] = key;
    const cap = a.charAt(0).toUpperCase() + a.slice(1);
    if (dev === 'touch' && has(`prompt.touch.${a}`)) {
      vars['press_' + a] = t(`prompt.touch.${a}`);
      vars['Press_' + a] = t(`prompt.touch.${cap}`);
    } else {
      vars['press_' + a] = t('prompt.press', { key });
      vars['Press_' + a] = t('prompt.Press', { key });
    }
  }
  return vars;
}

// t() with the control prompts filled in.
export function tp(key, vars = {}) {
  return t(key, { ...promptVars(), ...vars });
}
