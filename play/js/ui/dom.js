// Small DOM helpers for scene UI. All scene UI lives in the 800x450 #ui layer, which is
// scaled as a whole, so positions and sizes here are in logical stage pixels.
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

// A button with press feedback and a tap sound. onActivate fires on click (mouse, touch,
// Enter/Space via native button behaviour).
export function button(label, onActivate, attrs = {}) {
  const { class: cls = '', ...rest } = attrs;
  const b = el('button', { type: 'button', ...rest, class: ('btn ' + cls).trim() }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    audio.play('tap');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    onActivate(e);
  });
  b.addEventListener('pointerenter', () => { if (input.lastDevice !== 'touch') audio.play('hover', { volume: 0.6 }); });
  return b;
}

// Arrow-key / gamepad navigation between focusable buttons inside a container.
// Returns a function to call each tick from the owning scene.
export function focusNavigator(container, { columns = 1, wrap = true } = {}) {
  const items = () => [...container.querySelectorAll('button:not([disabled]), [data-focusable]:not([disabled])')].filter(n => n.offsetParent !== null);
  return function navigate() {
    const list = items();
    if (!list.length) return;
    let i = list.indexOf(document.activeElement);
    const move = d => {
      if (i < 0) i = 0; else i = wrap ? (i + d + list.length) % list.length : Math.max(0, Math.min(list.length - 1, i + d));
      list[i].focus({ preventScroll: true });
      audio.play('hover');
    };
    if (input.pressed('left')) move(-1);
    else if (input.pressed('right')) move(1);
    else if (input.pressed('up')) move(-columns);
    else if (input.pressed('down')) move(columns);
    else if ((input.pressed('confirm') || input.pressed('jump')) && input.lastDevice === 'gamepad' && i >= 0) list[i].click();
  };
}

export function focusFirst(container) {
  const first = container.querySelector('[autofocus], button:not([disabled])');
  if (first && input.lastDevice !== 'touch') first.focus({ preventScroll: true });
}
