// On-screen touch controls, sized for thumbs and anchored to the screen corners (not the
// scaled stage) so they stay the same physical size on every device. Each control is a
// DOM element with a stable id, so Playwright can tap it in end-to-end tests.
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { el } from './dom.js';

const ICONS = {
  left: '<path d="M15 5 8 12l7 7" />',
  right: '<path d="m9 5 7 7-7 7" />',
  jump: '<path d="M12 19V6M6 11l6-6 6 6" />',
  fire: '<circle cx="12" cy="12" r="6"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/>',
  camera: '<rect x="3" y="7" width="18" height="12" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2.5h5L16 7"/>',
  pause: '<path d="M9 6v12M15 6v12" />',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

export class TouchControls {
  constructor(root) {
    this.root = root;
    this.visible = new Set();
    this.labels = { left: 'Move left', right: 'Move right', jump: 'Jump', fire: 'Throw', camera: 'Take photo', pause: 'Pause', phone: 'Phone' };
    this._build();
    settings.addEventListener('change', e => { if (e.detail.key === 'touchOpacity') this._applyOpacity(); });
    this._applyOpacity();
  }

  _build() {
    const dpad = el('div', { class: 'touch-dpad', id: 'touch-dpad', 'data-control': 'dpad' },
      el('div', { class: 'touch-btn touch-left', id: 'touch-left', role: 'button', 'aria-label': this.labels.left }),
      el('div', { class: 'touch-btn touch-right', id: 'touch-right', role: 'button', 'aria-label': this.labels.right }));
    dpad.querySelector('#touch-left').innerHTML = svg('left');
    dpad.querySelector('#touch-right').innerHTML = svg('right');
    this._bindDpad(dpad);

    const actions = el('div', { class: 'touch-actions' });
    for (const a of ['camera', 'fire', 'jump']) actions.append(this._button(a));
    const top = el('div', { class: 'touch-top' });
    for (const a of ['phone', 'pause']) top.append(this._button(a));
    this.nodes = { dpad, jump: actions.children[2], fire: actions.children[1], camera: actions.children[0], phone: top.children[0], pause: top.children[1] };
    this.root.append(dpad, actions, top);
  }

  _button(action) {
    const b = el('div', { class: `touch-btn touch-${action}`, id: `touch-${action}`, role: 'button', 'aria-label': this.labels[action], 'data-control': action });
    b.innerHTML = svg(action);
    const held = new Set();
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      held.add(e.pointerId);
      input.touchPress(action);
      b.classList.add('down');
    });
    const up = e => {
      if (!held.delete(e.pointerId)) return;
      input.touchRelease(action);
      if (!held.size) b.classList.remove('down');
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    return b;
  }

  // The d-pad is one zone: sliding a thumb between left and right switches direction
  // without lifting, which matters a lot for platforming on glass.
  _bindDpad(zone) {
    const pointers = new Map(); // pointerId -> current action
    const leftEl = zone.querySelector('#touch-left'), rightEl = zone.querySelector('#touch-right');
    const set = (id, action) => {
      const prev = pointers.get(id);
      if (prev === action) return;
      if (prev) input.touchRelease(prev);
      if (action) { input.touchPress(action); pointers.set(id, action); } else pointers.delete(id);
      const acts = new Set(pointers.values());
      leftEl.classList.toggle('down', acts.has('left'));
      rightEl.classList.toggle('down', acts.has('right'));
    };
    const pick = e => {
      const r = zone.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2 ? 'left' : 'right';
    };
    zone.addEventListener('pointerdown', e => { e.preventDefault(); zone.setPointerCapture(e.pointerId); set(e.pointerId, pick(e)); });
    zone.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) set(e.pointerId, pick(e)); });
    const up = e => set(e.pointerId, null);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
  }

  _applyOpacity() { this.root.style.setProperty('--touch-opacity', settings.get('touchOpacity')); }

  // Shows only the listed controls (e.g. ['dpad','jump','fire','camera','pause','phone']).
  show(which) {
    this.visible = new Set(which);
    for (const [k, node] of Object.entries(this.nodes)) node.hidden = !this.visible.has(k);
    this.root.hidden = this.visible.size === 0;
  }
  hide() { this.show([]); }
}
