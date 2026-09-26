// Scene manager with animated transitions (fade and iris wipe).
// A scene is an object with optional: enter(params), exit(), update(tick), render(ctx, alpha),
// and `name`. Scenes own their DOM under ui (cleared on exit) and draw to the canvas.
import { settings } from './settings.js';
import { STAGE_W, STAGE_H } from './view.js';
import { ease } from './tween.js';

export class SceneManager extends EventTarget {
  constructor(app) {
    super();
    this.app = app;
    this.current = null;
    this.registry = new Map();
    this.transition = null; // { phase: 'out'|'in', age, ticks, style, next, params, color, focus }
  }

  register(name, factory) { this.registry.set(name, factory); }

  // Switches scene. style: 'fade' | 'iris' | 'none'. focus: stage point for the iris centre.
  go(name, params = {}, { style = 'fade', ticks = 26, color = '#1b1640', focus = null } = {}) {
    if (this.transition && this.transition.phase === 'out') return; // ignore double requests
    if (settings.get('reducedMotion') && style === 'iris') style = 'fade';
    if (!this.current || style === 'none') { this._swap(name, params); return; }
    this.transition = { phase: 'out', age: 0, ticks, style, next: name, params, color, focus };
    this.app.input.enabled = false;
  }

  _swap(name, params) {
    const factory = this.registry.get(name);
    if (!factory) throw new Error(`Unknown scene ${name}`);
    if (this.current) {
      this.current.exit && this.current.exit();
      this.app.ui.replaceChildren();
    }
    this.current = factory(this.app);
    this.current.name = name;
    this.current.enter && this.current.enter(params);
    this.dispatchEvent(new CustomEvent('change', { detail: name }));
  }

  update(tick) {
    const tr = this.transition;
    if (tr) {
      tr.age++;
      if (tr.phase === 'out' && tr.age >= tr.ticks) {
        this._swap(tr.next, tr.params);
        tr.phase = 'in'; tr.age = 0;
        this.app.input.enabled = true;
      } else if (tr.phase === 'in' && tr.age >= tr.ticks) {
        this.transition = null;
      }
    }
    // The outgoing scene freezes during its fade-out; the incoming one runs during fade-in.
    if (!tr || tr.phase === 'in') this.current && this.current.update && this.current.update(tick);
  }

  render(ctx, alpha) {
    if (this.current && this.current.render) this.current.render(ctx, alpha);
    const tr = this.transition;
    if (!tr) { this.app.ui.style.opacity = ''; return; }
    const p = tr.phase === 'out' ? tr.age / tr.ticks : 1 - tr.age / tr.ticks;
    const k = ease.inOutQuad(Math.min(1, Math.max(0, p)));
    this.app.ui.style.opacity = String(1 - k);
    if (tr.style === 'iris') {
      const cx = tr.focus ? tr.focus.x : STAGE_W / 2, cy = tr.focus ? tr.focus.y : STAGE_H / 2;
      const maxR = Math.hypot(Math.max(cx, STAGE_W - cx), Math.max(cy, STAGE_H - cy));
      const r = maxR * (1 - k);
      ctx.save();
      ctx.fillStyle = tr.color;
      ctx.beginPath();
      ctx.rect(0, 0, STAGE_W, STAGE_H);
      ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.restore();
    } else {
      ctx.fillStyle = tr.color;
      ctx.globalAlpha = k;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.globalAlpha = 1;
    }
  }
}
