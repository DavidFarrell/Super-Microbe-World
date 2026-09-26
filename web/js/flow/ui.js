// Shared UI for the flow screens: the injected stylesheet (the flow never edits index.html),
// glossy buttons in the style of the 2009 art ("New Game", "Submit", "Click"), a focus stack with
// spatial arrow-key / gamepad navigation, and an in-page confirm dialog (window.confirm is not
// available in the artifact host). All sizes are stage pixels inside the scaled #ui layer.
import { el, button } from '../ui/dom.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { t } from '../core/i18n.js';

const CSS = `
.fl-layer { position: absolute; inset: 0; }
.fl-layer.passthrough { pointer-events: none; }
.fl-btn {
  font: 800 calc(21px * var(--text-scale, 1))/1.05 var(--ui-font); color: #fff; cursor: pointer;
  text-shadow: 0 2px 0 rgba(8, 40, 80, 0.45); letter-spacing: 0.2px;
  --fl-bg: linear-gradient(180deg, #d6f0ff 0%, #8fd4ff 46%, #45b1f7 54%, #5cc3ff 100%);
  background: var(--fl-bg);
  border: 3px solid #0e3d6b; border-radius: 13px; padding: 10px 22px 9px;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.75), 0 4px 0 #0a2a4a, 0 6px 12px rgba(0, 0, 0, 0.25);
  min-height: max(48px, calc(46px / var(--stage-scale, 1))); min-width: max(48px, calc(46px / var(--stage-scale, 1)));
  transition: transform 0.08s ease, box-shadow 0.08s ease, filter 0.12s ease;
}
.btn.fl-btn:hover { background: var(--fl-bg); filter: brightness(1.07); transform: translateY(-1px); }
.btn.fl-btn:active { transform: translateY(3px); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 1px 0 #0a2a4a; }
.fl-btn:focus-visible { outline: 4px solid #ffd23f; outline-offset: 3px; }
.fl-btn.pop { animation: fl-pop 0.22s ease; }
.fl-btn[disabled] { filter: grayscale(0.8) brightness(0.8); cursor: default; }
.fl-btn.alt { --fl-bg: linear-gradient(180deg, #fffdf6 0%, #f3ead2 50%, #e6d8b4 54%, #efe3c4 100%); color: #2b2150; text-shadow: none; border-color: #5b4a2a; box-shadow: inset 0 2px 0 #fff, 0 4px 0 #5b4a2a, 0 6px 12px rgba(0, 0, 0, 0.25); }
.fl-btn.warn { --fl-bg: linear-gradient(180deg, #ffd9d9 0%, #ff9a9a 46%, #f06060 54%, #ff7b7b 100%); border-color: #6b1010; box-shadow: inset 0 2px 0 rgba(255,255,255,0.7), 0 4px 0 #4a0a0a, 0 6px 12px rgba(0, 0, 0, 0.25); }
.fl-btn.small { font-size: calc(16px * var(--text-scale, 1)); padding: 7px 14px 6px; border-radius: 10px; }
@keyframes fl-pop { 0% { transform: scale(1); } 40% { transform: scale(1.08); } 100% { transform: scale(1); } }
.fl-card {
  position: absolute; background: #fffdf6; color: #1b1640; border: 4px solid #111; border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); font-family: var(--body-font);
}
.fl-card h2 { margin: 0; font: 800 calc(28px * var(--text-scale, 1))/1.1 var(--ui-font); }
.fl-card p { margin: 0; font-size: calc(16px * var(--text-scale, 1)); line-height: 1.35; }
.fl-dim { position: absolute; inset: 0; background: rgba(10, 8, 30, 0.6); display: grid; place-items: center; }
.fl-dialog { position: relative; background: #fffdf6; color: #1b1640; border: 4px solid #111; border-radius: 16px; padding: 22px 26px; width: 460px; text-align: center; display: grid; gap: 14px; font-family: var(--body-font); box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: fl-in 0.22s ease-out; }
.fl-dialog h2 { margin: 0; font: 800 calc(26px * var(--text-scale, 1))/1.1 var(--ui-font); }
.fl-dialog p { margin: 0; font-size: calc(16px * var(--text-scale, 1)); line-height: 1.35; }
.fl-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
@keyframes fl-in { from { transform: translateY(18px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }
html.reduced-motion .fl-btn, html.reduced-motion .fl-dialog { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) { .fl-btn.pop, .fl-dialog { animation: none; } .fl-btn { transition: none; } }
.fl-prompt { position: absolute; font: 700 calc(15px * var(--text-scale, 1)) var(--body-font); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); pointer-events: none; }
`;

export function ensureStyle(id = 'flow-style', css = CSS) {
  if (document.getElementById(id)) return;
  document.head.append(el('style', { id }, css));
}

// A glossy flow button. attrs as ui/dom button(); `variant`: '' | 'alt' | 'warn' | 'small'.
export function glossy(label, onActivate, attrs = {}) {
  const { class: cls = '', ...rest } = attrs;
  return button(label, onActivate, { ...rest, class: ('fl-btn ' + cls).trim() });
}

// ---------------------------------------------------------------------------------------------
// Focus stack. Each screen or dialog pushes a container; only the top one reacts to the arrow
// keys, the d-pad and gamepad, and Escape / Backspace / gamepad Back (onBack). Scenes call
// tickNav() once per tick. Focusable items: buttons and [data-focusable]; an item with
// data-adjust handles left/right itself (sliders, choosers) through its onAdjust property.
// ---------------------------------------------------------------------------------------------
const stack = [];

export function pushNav(container, { onBack = null, initial = null } = {}) {
  const entry = { container, onBack, last: null };
  stack.push(entry);
  if (initial !== false) focusInitial(container, initial);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    const top = stack[stack.length - 1];
    if (top && top.last && top.last.isConnected && input.lastDevice !== 'touch') top.last.focus({ preventScroll: true });
  };
}

export function clearNav() { stack.length = 0; }

export const navDepth = () => stack.length;

function items(container) {
  return [...container.querySelectorAll('button:not([disabled]), [data-focusable]:not([disabled])')]
    .filter(n => n.offsetParent !== null && !n.closest('[inert]'));
}

export function focusInitial(container, preferred = null) {
  if (input.lastDevice === 'touch') return;
  const target = (preferred && (typeof preferred === 'string' ? container.querySelector(preferred) : preferred))
    || container.querySelector('[autofocus]') || items(container)[0];
  if (target) target.focus({ preventScroll: true });
}

// Picks the nearest item in a direction from the focused one (spatial navigation).
function nearest(list, from, dx, dy) {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const n of list) {
    if (n === from) continue;
    const b = n.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy;
    if (along <= 2) continue;
    const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = n; }
  }
  return best;
}

// Moves focus from the focused item (or into the container) in a direction. Returns the item.
export function moveFocus(container, dx, dy, from = null) {
  const list = items(container);
  if (!list.length) return null;
  const active = from || document.activeElement;
  const inside = list.includes(active) ? active : null;
  let next = inside ? nearest(list, inside, dx, dy) : list[0];
  if (!next && inside && dy !== 0) next = dy > 0 ? list[0] : list[list.length - 1]; // wrap vertically
  if (next) { next.focus({ preventScroll: true }); if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest' }); audio.play('hover'); }
  return next;
}

// Left / right on a slider or chooser (an item with data-adjust and an onAdjust(d) property).
export function adjustFocused(container, dx) {
  const a = document.activeElement;
  if (a && container.contains(a) && a.dataset && a.dataset.adjust != null && typeof a.onAdjust === 'function') { a.onAdjust(dx); return true; }
  return false;
}

export function tickNav() {
  const top = stack[stack.length - 1];
  if (!top || !top.container.isConnected) return;
  const list = items(top.container);
  const active = document.activeElement;
  const inside = list.includes(active) ? active : null;
  if (inside) top.last = inside;
  if (input.pressed('back') || input.pressed('pause')) {
    if (top.onBack) { audio.play('tap'); top.onBack(); }
    return;
  }
  const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
  for (const [name, dx, dy] of dirs) {
    if (!input.pressed(name)) continue;
    if (dx !== 0 && adjustFocused(top.container, dx)) return;
    if (!inside && top.last && top.last.isConnected && list.includes(top.last)) { top.last.focus({ preventScroll: true }); audio.play('hover'); return; }
    moveFocus(top.container, dx, dy, inside);
    return;
  }
  // Gamepad A activates the focused item (keyboard Enter / Space use the native button action).
  if (inside && input.lastDevice === 'gamepad' && (input.pressed('confirm') || input.pressed('jump'))) inside.click();
}

// The top of the focus stack (for overlays that navigate from raw key events).
export const topNav = () => stack[stack.length - 1] || null;

// In-page confirm dialog. Resolves true (yes) or false (no / back).
export function confirmDialog(parent, { title, text = '', yes = t('flow.ui.yes'), no = t('flow.ui.no'), danger = false } = {}) {
  return new Promise(resolve => {
    let pop = null;
    const done = v => { if (pop) pop(); dim.remove(); resolve(v); };
    const yesBtn = glossy(yes, () => done(true), { class: danger ? 'warn' : '', id: 'fl-confirm-yes' });
    const noBtn = glossy(no, () => done(false), { class: 'alt', id: 'fl-confirm-no' });
    const box = el('div', { class: 'fl-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      el('h2', {}, title), text ? el('p', {}, text) : null, el('div', { class: 'fl-row' }, noBtn, yesBtn));
    const dim = el('div', { class: 'fl-dim', style: { zIndex: '40' } }, box);
    parent.append(dim);
    pop = pushNav(box, { onBack: () => done(false), initial: noBtn });
  });
}

// Screen-reader announcement through the page's live region.
export function announce(app, text) { if (app && app.announce) app.announce(text); }
