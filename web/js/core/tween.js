// Easing curves and a tick-driven tween list (deterministic: advances with the loop, not the clock).
export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// Frame-rate independent exponential smoothing: approach target by `rate` per tick.
export const approach = (cur, target, rate) => cur + (target - cur) * rate;

export class Tweens {
  constructor() { this.list = []; }
  // Animates obj[key] from its current value to `to` over `ticks` ticks.
  to(obj, props, ticks, { easing = ease.outQuad, delay = 0, onDone } = {}) {
    const from = {};
    for (const k of Object.keys(props)) from[k] = obj[k];
    const t = { obj, from, props, ticks: Math.max(1, ticks), age: -delay, easing, onDone };
    this.list.push(t);
    return t;
  }
  wait(ticks, onDone) { this.list.push({ obj: null, ticks, age: 0, onDone }); }
  update() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.age++;
      if (t.age < 0) continue;
      const p = Math.min(1, t.age / t.ticks);
      if (t.obj) for (const k of Object.keys(t.props)) t.obj[k] = lerp(t.from[k], t.props[k], t.easing(p));
      if (p >= 1) { this.list.splice(i, 1); t.onDone && t.onDone(); }
    }
  }
  clear() { this.list.length = 0; }
}
