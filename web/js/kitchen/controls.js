// The kitchen's location-based input layer. The original's click targets were 23-69 px boxes
// (27 rest points plus the tissues, cling film and sink, NOTES 5.4); here every location is one
// large target (layout.js TARGETS, at least 44 CSS px on a small phone), built as DOM elements in
// the scaled #ui layer so taps, drags, mouse hover and screen readers all work.
//
// Nothing here changes game state directly: pointer and key events are queued and the scene
// drains the queue in update(), so a run is the same for the same inputs per tick (tests step the
// loop by hand). Events: { type: 'tap', id } | { type: 'dragStart' } | { type: 'drop', x, y }
// | { type: 'key', code, shift }.
import { el } from '../ui/dom.js';
import { TARGETS, inside } from './layout.js';

// Keys the kitchen handles itself (the engine's action map has no tissues / cling film / wash
// actions, and Space and ArrowUp share the "jump" action).
const KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'Tab', 'KeyT', 'KeyC', 'KeyH', 'Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'Backspace']);
const DRAG_START = 10; // stage px of movement before a press on the item becomes a drag

export class KitchenControls {
  constructor(app, { label }) {
    this.app = app;
    this.queue = [];
    this.hover = null;          // target under the mouse (cosmetic)
    this.dragPos = null;        // pointer position while dragging (cosmetic, stage px)
    this.press = null;
    this.enabledKeys = false;
    this.nodes = {};
    this.layer = el('div', { class: 'kz-layer', role: 'group', 'aria-label': label });
    for (const t of TARGETS) {
      const n = el('div', { class: `kz-zone kz-${t.kind}`, id: `kz-${t.id}`, role: 'button', tabindex: '-1', 'data-target': t.id });
      Object.assign(n.style, { left: t.hit.x + 'px', top: t.hit.y + 'px', width: t.hit.w + 'px', height: t.hit.h + 'px' });
      this._bind(n, t);
      this.nodes[t.id] = n;
      this.layer.append(n);
    }
    this._onKey = e => {
      if (!this.enabledKeys || e.repeat) return;
      const tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!KEYS.has(e.code)) return;
      e.preventDefault();
      this.queue.push({ type: 'key', code: e.code, shift: e.shiftKey });
    };
    addEventListener('keydown', this._onKey);
  }

  _stage(e) { return this.app.view.toStage(e.clientX, e.clientY); }

  _bind(n, t) {
    n.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      const p = this._stage(e);
      try { n.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.press = { id: t.id, pointerId: e.pointerId, x0: p.x, y0: p.y, moved: false };
    });
    n.addEventListener('pointermove', e => {
      const pr = this.press;
      if (!pr || pr.pointerId !== e.pointerId || pr.id !== 'item') return;
      const p = this._stage(e);
      if (!pr.moved && Math.hypot(p.x - pr.x0, p.y - pr.y0) > DRAG_START) {
        pr.moved = true;
        this.queue.push({ type: 'dragStart' });
      }
      if (pr.moved) this.dragPos = p;
    });
    const end = (e, cancelled) => {
      const pr = this.press;
      if (!pr || pr.pointerId !== e.pointerId) return;
      this.press = null;
      const p = this._stage(e);
      if (pr.moved) { this.queue.push({ type: 'drop', x: cancelled ? -1 : p.x, y: cancelled ? -1 : p.y }); return; }
      if (!cancelled && inside(t.hit, p.x, p.y)) this.queue.push({ type: 'tap', id: t.id });
    };
    n.addEventListener('pointerup', e => end(e, false));
    n.addEventListener('pointercancel', e => end(e, true));
    n.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') this.hover = t.id; });
    n.addEventListener('pointerleave', () => { if (this.hover === t.id) this.hover = null; });
  }

  // Shows the layer (in the scene's UI root) with the targets that are live in this mode.
  show(root, ids) {
    if (!this.layer.isConnected) root.append(this.layer);
    this.layer.hidden = false;
    const live = new Set(ids);
    for (const [id, n] of Object.entries(this.nodes)) n.hidden = !live.has(id);
  }

  hide() {
    this.layer.hidden = true;
    this.enabledKeys = false;
    this.hover = null;
    this.press = null;
    this.dragPos = null;
  }

  setLabel(id, text) { const n = this.nodes[id]; if (n && n.getAttribute('aria-label') !== text) n.setAttribute('aria-label', text); }

  // Moves real DOM focus to a target (screen readers announce its label); never steals focus
  // from a touch player.
  focus(id) {
    const n = this.nodes[id];
    if (n && !n.hidden && document.activeElement !== n) n.focus({ preventScroll: true });
  }

  take() { const q = this.queue; this.queue = []; return q; }
  clear() { this.queue.length = 0; this.press = null; this.dragPos = null; }

  destroy() {
    removeEventListener('keydown', this._onKey);
    this.layer.remove();
  }
}
