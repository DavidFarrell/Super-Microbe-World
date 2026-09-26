// window.__test: deterministic hooks for end-to-end tests and bots.
// Tests may read state and inject input, but never skip gameplay: levels must still be
// completed by pressing the same actions a player would.
import { input } from './input.js';
import { gameRng } from './rng.js';

export function installTestHooks(app) {
  const probes = new Map(); // name -> () => value, registered by scenes
  const errors = [];
  addEventListener('error', e => errors.push(String(e.message || e)));
  addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.message || e.reason)));

  window.__test = {
    get scene() { return app.scenes.current ? app.scenes.current.name : null; },
    get transitioning() { return !!app.scenes.transition; },
    get tick() { return app.loop.tick; },
    get errors() { return errors.slice(); },
    get lastDevice() { return input.lastDevice; },
    probe(name) { const f = probes.get(name); return f ? f() : undefined; },
    probes() { return Object.fromEntries([...probes].map(([k, f]) => [k, f()])); },
    register(name, fn) { probes.set(name, fn); },
    unregister(name) { probes.delete(name); },
    seed(n) { gameRng.seed(n); },
    // Input injection: press/release named actions (see input.ACTIONS).
    press(action) { input.inject(action, true); },
    release(action) { input.inject(action, false); },
    hold(actions) { input.injectOnly(actions); },
    releaseAll() { input.injectOnly([]); },
    // Manual stepping: freeze the real-time loop and advance exact tick counts.
    manual(on = true) { app.loop.manual = on; },
    step(n = 1) { app.loop.step(n); return app.loop.tick; },
    // Runs ticks until predicate() is true or maxTicks pass; returns ticks used or -1.
    stepUntil(predicate, maxTicks = 6000, chunk = 1) {
      for (let i = 0; i < maxTicks; i += chunk) {
        if (predicate(window.__test)) return i;
        app.loop.step(chunk);
      }
      return predicate(window.__test) ? maxTicks : -1;
    },
    recordInput() { input.log = []; },
    takeInputLog() { const l = input.log; input.log = null; return l; },
    go(scene, params) { app.scenes.go(scene, params, { style: 'none' }); },
    app,
  };
  return window.__test;
}
