// Physics port checks against the derived numbers in reference/analysis/flash-platformer.md
// sections 0 and 2.6 (Verlet step 30 ms, gravity 3000, drag 0.95, rounding and the speed clamp).
import test from 'node:test';
import assert from 'node:assert/strict';
import { add, sub, mul, round1 } from '../../js/platformer/vec.js';
import { ParticleSystem } from '../../js/platformer/physics.js';
import { flatLevel, newGame, settle, inp, loadLevel } from './helpers.mjs';

const r2 = v => Math.round(v * 100) / 100;

test('Vector3 rounding semantics: add rounds to 0.001, subtract and multiply do not', () => {
  assert.deepEqual(add({ x: 0.1, y: 0.2 }, { x: 0.0004, y: 0.0006 }), { x: 0.1, y: 0.201 });
  assert.deepEqual(sub({ x: 1, y: 1 }, { x: 0.0004, y: 0 }), { x: 0.9996, y: 1 });
  assert.equal(mul({ x: 3, y: 0 }, 0.95).x, 3 * 0.95);
  assert.equal(round1(3.645), 3.6);
});

test('jump from rest: apex about 99.8 px after 8 steps, back down after 17 (section 2.6)', () => {
  const g = settle(newGame(flatLevel()));
  const p = g.player.particle;
  const y0 = p.position.y;
  const ys = [];
  g.step(inp({ jumpPressed: true, jumpHeld: true }));
  ys.push(r2(p.position.y - y0));
  for (let i = 0; i < 18; i++) { g.step(inp({ jumpHeld: true })); ys.push(r2(p.position.y - y0)); }
  assert.deepEqual(ys.slice(0, 11), [-25, -46.05, -63.35, -77.08, -87.42, -94.55, -98.62, -99.79, -98.2, -93.99, -87.29]);
  assert.equal(Math.min(...ys), -99.79);
  assert.equal(ys.indexOf(-99.79), 7); // the 8th step
  const landed = ys.findIndex((v, i) => i > 8 && v === 0);
  assert.ok(landed >= 15 && landed <= 17, `landed at step ${landed + 1}`);
});

test('run from rest: 3.6, 7.1, 10.4 ... capped by maxChange (25 without Lucy, 21.16 with)', () => {
  const vxs = level => {
    const g = settle(newGame(level));
    const p = g.player.particle;
    const out = [];
    for (let i = 0; i < 10; i++) { g.step(inp({ right: true })); out.push(r2(p.position.x - p.previousPosition.x)); }
    return { out, mc: g.ps.maxChange.x };
  };
  const plain = vxs(flatLevel());
  assert.equal(plain.mc, 25);
  assert.deepEqual(plain.out.slice(0, 9), [3.6, 7.1, 10.4, 13.5, 16.5, 19.3, 22, 24.5, 25]);
  const lucy = vxs(flatLevel({ entities: [[6, 30, 'lucy']] }));
  assert.equal(lucy.mc, 21.16);
  assert.deepEqual(lucy.out.slice(0, 7), [3.6, 7.1, 10.4, 13.5, 16.5, 19.3, 21.2]);
});

test('seams between flush floor tiles do not kick a coasting body (internal-edge fix)', () => {
  const kicks = fixes => {
    const g = settle(newGame(flatLevel({ cols: 60, startCol: 2 }), { options: { physicsFixes: fixes } }));
    const p = g.player.particle;
    for (let i = 0; i < 12; i++) g.step(inp({ right: true }));
    let prev = Infinity, n = 0;
    for (let i = 0; i < 70; i++) { g.step(inp()); const v = p.position.x - p.previousPosition.x; if (v > prev + 1e-9) n++; prev = v; }
    return n;
  };
  assert.equal(kicks({ internalEdges: true }), 0);
  assert.ok(kicks({ internalEdges: false }) > 0, 'the original min-axis rule speeds bodies up at seams');
});

test('coasting never stops: settles at +1.0 px/step right and -0.9 px/step left (section 2.2)', () => {
  for (const [dir, startCol, expect] of [['right', 2, 1.0], ['left', 36, -0.9]]) {
    const g = settle(newGame(flatLevel({ cols: 60, startCol })));
    const p = g.player.particle;
    for (let i = 0; i < 12; i++) g.step(inp({ [dir]: true }));
    for (let i = 0; i < 70; i++) g.step(inp());
    const v = p.position.x - p.previousPosition.x;
    assert.ok(Math.abs(v - expect) < 1e-9, `${dir}: ${v}`);
  }
});

test('maxChange per level follows ceil(w/2) < maxChange over tiles, player and microbes (section 2.6)', () => {
  const mc = name => newGame(loadLevel(name)).ps.maxChange;
  for (const n of [1, 2, 8, 9, 10]) assert.deepEqual(mc(`alpha_level${n}`), { x: 21.16, y: 25 }, `level ${n}`);
  for (const n of [3, 4, 5, 6]) assert.deepEqual(mc(`alpha_level${n}`), { x: 25, y: 25 }, `level ${n}`);
  assert.deepEqual(mc('alpha_level7'), { x: 23.98, y: 25 });
  // The player's 49 px box does not lower 25: ceil(24.5) = 25 is not < 25.
  const ps = new ParticleSystem();
  ps.createBox(0, 0, 50, 50);
  ps.createBox(0, 0, 49, 100, { dynamic: true });
  assert.deepEqual(ps.maxChange, { x: 25, y: 25 });
  ps.createBox(0, 0, 38.3, 16.3, { dynamic: true, maxChangeExcempt: true });
  assert.deepEqual(ps.maxChange, { x: 25, y: 25 });
});

test('speed clamp: a huge force moves a body at most maxChange per step', () => {
  const ps = new ParticleSystem({ worldMax: { x: 5000, y: 5000 }, worldMin: { x: -5000, y: -5000 } });
  ps.createBox(0, 0, 50, 50); // sets maxChange to 25
  const i = ps.createBox(100, 100, 40, 40, { dynamic: true, maxChangeExcempt: true });
  const b = ps.dynamicEntities[i];
  b.theParent = { isOnScreen: true, state: 0, type: 1 };
  b.force = { x: 1e7, y: -1e7 };
  ps.timeStep();
  assert.equal(b.position.x - 100, 25);
  assert.equal(b.position.y - 100, -25);
});

test('gravity adds 2.7 px/step and falls clamp at 25 px/step; the world floor is 450 - h', () => {
  const ps = new ParticleSystem({ worldMin: { x: 0, y: -100 }, worldMax: { x: 800, y: 450 } });
  ps.createBox(0, 0, 50, 50);
  const b = ps.dynamicEntities[ps.createBox(100, 0, 49, 100, { dynamic: true })];
  b.theParent = { isOnScreen: true, state: 0, type: 0 };
  const dys = [];
  for (let k = 0; k < 20; k++) { const y = b.position.y; ps.timeStep(); dys.push(r2(b.position.y - y)); }
  assert.equal(dys[0], 2.7);
  assert.equal(dys[1], r2(2.7 * 0.95 + 2.7));
  assert.ok(dys.slice(10).every(d => d <= 25));
  assert.equal(b.position.y, 350);
  assert.equal(b.supported, true);
});

test('collisions push along the smaller penetration axis (a head bump is a ceiling)', () => {
  const ps = new ParticleSystem({ gravity: { x: 0, y: 0 }, worldMax: { x: 2000, y: 2000 } });
  ps.createBox(100, 100, 50, 50);
  ps.staticEntities[0].physicsExcempt = false;
  const b = ps.dynamicEntities[ps.createBox(110, 140, 20, 20, { dynamic: true })]; // 10 px into the underside
  b.theParent = { isOnScreen: true, state: 0, type: 0 };
  ps.timeStep();
  assert.equal(b.position.y, 150);   // pushed down, out of the tile's underside
  assert.equal(b.position.x, 110);
  // A corner overlap that is shallower sideways is pushed sideways (off a ledge corner).
  const c = ps.dynamicEntities[ps.createBox(145, 60, 20, 60, { dynamic: true })]; // 5 px in from the right, 20 px down
  c.theParent = { isOnScreen: true, state: 0, type: 0 };
  ps.timeStep();
  assert.equal(c.position.x, 150);
});

test('static broadphase fix: the far end of a big tile is solid (bug 1)', () => {
  const run = fixes => {
    const ps = new ParticleSystem({ worldMax: { x: 2000, y: 2000 }, fixes });
    ps.createBox(1000, 1000, 50, 50);          // static 0: small radius (35)
    ps.createBox(0, 400, 250, 50);             // static 1: toast, anchor cell (8, 0)
    for (const s of ps.staticEntities) s.physicsExcempt = false;
    const b = ps.dynamicEntities[ps.createBox(200, 300, 49, 100, { dynamic: true })];
    b.theParent = { isOnScreen: true, state: 0, type: 0 };
    for (let k = 0; k < 10; k++) ps.timeStep();
    return b.position.y;
  };
  assert.equal(run({ staticBroadphase: true }), 300);          // stands on the toast
  assert.ok(run({ staticBroadphase: false }) > 300, 'original: the wrong radius lets it sink');
});

test('dead or ignored bodies no longer push others (bug 2)', () => {
  const run = fixes => {
    const ps = new ParticleSystem({ gravity: { x: 0, y: 0 }, worldMax: { x: 2000, y: 2000 }, fixes });
    const dead = ps.dynamicEntities[ps.createBox(100, 100, 50, 50, { dynamic: true })];
    dead.theParent = { isOnScreen: true, state: 23 /* IGNORE */, type: 11 };
    const b = ps.dynamicEntities[ps.createBox(140, 100, 50, 50, { dynamic: true })];
    b.theParent = { isOnScreen: true, state: 0, type: 0 };
    ps.timeStep();
    return b.position.x;
  };
  assert.equal(run({ skipDeadBodies: true }), 140);
  assert.notEqual(run({ skipDeadBodies: false }), 140);
});
