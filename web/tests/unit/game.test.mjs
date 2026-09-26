// Game rules: projectiles, photos, goals, the portal, damage, the level timer, the jump feel
// fixes and determinism. Levels are either the converted originals or small synthetic ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformGame } from '../../js/platformer/game.js';
import { Goal } from '../../js/platformer/goal.js';
import { StepInput } from '../../js/platformer/controls.js';
import { ev } from '../../js/platformer/entities.js';
import { E, G, T, END, LEVEL_TIME_STEPS } from '../../js/platformer/constants.js';
import { PLAYER_STATE, AvatarClip } from '../../js/platformer/player.js';
import { CLIPS } from '../../js/platformer/data/clips.js';
import { PlatformBot, runBotHeadless } from '../bots/platform-bot.mjs';
import { flatLevel, newGame, settle, inp, loadLevel } from './helpers.mjs';

const bullets = g => g.entities.filter(e => e && e.type === T.BULLET);
const countFx = (g, type) => g.fx.filter(f => f.type === type).length;

function bulletTrack(level) {
  const g = settle(newGame(level));
  g.step(inp({ firePressed: true }));
  let b = null, x0 = 0;
  const xs = [];
  for (let i = 0; i < 40 && xs.length < 17; i++) {
    g.step(inp());
    b = b || bullets(g)[0];
    if (b) { if (!xs.length) x0 = b.particle.position.x; xs.push(b.particle.position.x - x0); }
  }
  return { g, b, xs, x0 };
}

test('white blood cells: 19.5, 28.5, then 10 + maxChange per step; about 484 px over 16 steps (section 3.5)', () => {
  const { g, xs, x0 } = bulletTrack(flatLevel({ entities: [[6, 38, 'lucy']] })); // player at x = 100
  assert.equal(g.ps.maxChange.x, 21.16);
  const step = xs.slice(1).map((x, i) => Math.round((x - xs[i]) * 10) / 10);
  assert.deepEqual(step.slice(0, 3), [19.5, 28.5, 31.2]);
  assert.ok(Math.abs(xs[16] - 484) < 2, `range ${xs[16]}`);
  // Spawned in front of the avatar's art: x = player.x + the avatar's live clip._width - 18. The
  // shot leaves on upper frame 283 (shoot_soap) with the lower body standing on frame 1: 54.48.
  assert.equal(Math.round((x0 - 100) * 10) / 10, 36.5);
});

test('the avatar\'s live width: exhaust and brake sparks widen clip._width (PlatformGame.as:763)', () => {
  const a = new AvatarClip('harry');
  assert.equal(a.bounds.w, CLIPS.harry.bounds.w); // frame 1 of both parts is the root's frame 1
  a.upper.gotoAndPlay('take_photo_start');
  a.lower.gotoAndPlay('accelerate_mid');
  // Upper x -2.01..53.67 and lower (frame 85, exhaust behind the board) -24.99..39.72. The Ruffle
  // atlas estimate in the review was 77.5 (pixel-trimmed frames at 2x).
  assert.ok(Math.abs(a.bounds.w - 78.66) < 0.02, `width ${a.bounds.w}`);
  assert.ok(Math.abs(a.bounds.x + 24.99) < 0.02, `x ${a.bounds.x}`);
  a.lower.gotoAndPlay('decelerate_mid'); // brake sparks in front of the board
  assert.ok(a.bounds.x + a.bounds.w > 60, `brake right edge ${a.bounds.x + a.bounds.w}`);
});

test('camera flash while riding right spawns at player.x + the live width, not the frame-1 55.68', () => {
  for (const who of ['harry', 'amy']) {
    const g = settle(newGame(flatLevel({ cols: 60 }), { avatar: who }));
    for (let i = 0; i < 60 && !(i > 10 && g.player.lowerClip.label === 'accelerate_mid'); i++) g.step(inp({ right: true }));
    const p = g.player;
    assert.equal(p.lowerClip.label, 'accelerate_mid');
    const px = p.particle.position.x;
    g.step(inp({ right: true, cameraPressed: true }));
    const flash = g.entities.find(e => e && e.type === T.CAMERA_FLASH);
    assert.ok(flash, `${who}: no flash`);
    // The flash is created after the upper body's goto to take_photo_start, with the lower body on
    // its current accelerate_mid frame; both are still on those frames after the step.
    assert.equal(p.upperClip.label, 'take_photo_start');
    const up = CLIPS[`${who}_upper`].frameBounds[p.upperClip.frame - 1], low = CLIPS[`${who}_lower`].frameBounds[p.lowerClip.frame - 1];
    const W = Math.max(up[0] + up[2], low[0] + low[2]) - Math.min(up[0], low[0]);
    assert.ok(Math.abs(flash.particle.position.x - (px + W)) <= 0.05, `${who}: flash at px + ${flash.particle.position.x - px}, expected px + ${W}`);
    // The Ruffle capture (reference/captures/ruffle-level1-photo-riding-right.png) shows at least
    // 75 px between the box and the flash's registration point.
    assert.ok(W >= 75 && W < 110, `${who}: live width ${W}`);
  }
});

test('the upper body loops its move animation from the start, as after ClipLoader\'s hurt flourish', () => {
  const g = newGame(flatLevel());
  assert.equal(g.player.upperClip.label, 'move');
  const f0 = g.player.upperClip.frame;
  for (let i = 0; i < 8; i++) g.step(inp());
  assert.notEqual(g.player.upperClip.frame, f0);
  assert.equal(g.player.upperClip.label, 'move');
  assert.equal(g.player.upperState, 0); // UPPER.IDLE: the logic state is unchanged
});

test('soap outside the body: range about 538 px with maxChange 25, no inherited momentum', () => {
  const { xs, b } = bulletTrack(flatLevel({ bodyLevel: false }));
  assert.equal(b.symbol, 'soap_projectile');
  assert.ok(Math.abs(xs[16] - 538) < 2, `range ${xs[16]}`);
});

test('fire repeats while held, like keyboard auto-repeat (the animation limits the rate)', () => {
  const g = settle(newGame(flatLevel()));
  const si = new StepInput();
  const src = held => ({ isDown: a => held && a === 'fire', pressed: () => false, released: () => false });
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    for (let t = 0; t < 2; t++) si.latch(i === 0 && t === 0 ? { isDown: a => a === 'fire', pressed: a => a === 'fire', released: () => false } : src(true));
    g.step(si.take());
    shots += countFx(g, 'throw');
  }
  assert.ok(shots >= 3, `shots ${shots}`);
});

test('onSolidGround (physics bodies): two consecutive still steps with counterCeiling 1', () => {
  const g = settle(newGame(flatLevel()));
  const p = g.player;
  p.counter = p.counterCeiling; // as jump_start sets it
  p.particle.previousPosition = { ...p.particle.position };
  assert.equal(p.onSolidGround(), false);
  assert.equal(p.onSolidGround(), true);
  p.particle.previousPosition = { x: p.particle.position.x, y: p.particle.position.y - 5 };
  assert.equal(p.onSolidGround(), false);
  assert.equal(p.counter, p.counterCeiling);
});

test('Goal counting per type, and >= so an overshoot still completes (bug 5)', () => {
  const lucy = { type: T.LUCY, isGood: true }, steve = { type: T.STEVE, isGood: true }, slurm = { type: T.SLURM, isBad: true };
  const photo = t => ev(E.BE_PHOTOGRAPHED, t), killed = t => ev(E.BE_KILLED, t);
  const spec = new Goal(G.PHOTOGRAPH_SPECIFIC, T.LUCY, 3);
  assert.equal(spec.updateGoal(photo(steve)).length, 0);
  assert.equal(spec.updateGoal(photo(lucy))[0].type, E.MODIFY_GOAL_STATUS);
  assert.equal(spec.achieved, 1);
  const good = new Goal(G.PHOTOGRAPH_GOOD, T.LUCY, 3);
  good.updateGoal(photo(steve)); good.updateGoal(killed(lucy)); good.updateGoal(photo(slurm));
  assert.equal(good.achieved, 2); // good photos and (faithfully) good deaths count
  const kill = new Goal(G.KILL_ALL, T.SLURM, 3);
  kill.updateGoal(killed({ type: T.IGGY, isBad: true })); kill.updateGoal(killed(lucy)); kill.updateGoal(photo(slurm));
  assert.equal(kill.achieved, 1); // microbeType is ignored; only bad deaths count
  const any = new Goal(G.PHOTOGRAPH_ANY, 0, 2);
  any.updateGoal(photo(slurm)); any.updateGoal(photo(lucy)); any.updateGoal(photo(steve));
  assert.equal(any.achieved, 3);
  assert.equal(any.isGoalMet(), true);
  const yog = new Goal(G.YOGURT, T.SLURM, 1);
  yog.updateGoal(ev(E.MILK_GLASS_EVENT_TURN_TO_YOGURT, {}));
  assert.equal(yog.isGoalMet(), true);
  const anti = new Goal(G.ANTIBIOTIC, T.SLURM, 6);
  anti.updateGoal(ev(E.EXPLODE_ANTIBIOTIC, {}));
  assert.equal(anti.achieved, 1);
});

test('photographing: +5 for a good microbe, one microbe per flash, the portal opens, the level ends', () => {
  const level = flatLevel({ goals: [{ goalType: G.PHOTOGRAPH_SPECIFIC, microbeType: T.LUCY, required: 1 }], entities: [[6, 3, 'lucy'], [5, 8, 'portal']] });
  const g = newGame(level);
  g.step(inp({ cameraPressed: true }));
  assert.equal(g.player.canTakePhotograph, false);
  let photographedAt = -1;
  for (let i = 0; i < 6 && photographedAt < 0; i++) { g.step(inp()); if (g.goalsView[0].achieved === 1) photographedAt = i; }
  assert.ok(photographedAt >= 0, 'Lucy was photographed');
  assert.equal(g.score, 5);
  const lucy = g.entities.find(e => e && e.type === T.LUCY);
  assert.equal(lucy.hasBeenPhotographed, true);
  assert.equal(g.portalOpen, false); // opens at the start of the next step
  g.step(inp());
  assert.equal(g.portalOpen, true);
  assert.equal(g.goals.length, 0);    // the goal is popped when the portal opens
  assert.equal(g.goalsView[0].achieved, 1);
  // The flash cooldown ends when the flash is removed (10 steps of fading).
  for (let i = 0; i < 12; i++) g.step(inp());
  assert.equal(g.player.canTakePhotograph, true);
  // Ride into the portal; it checks for the player every 10 steps.
  for (let i = 0; i < 200 && g.state === 'play'; i++) g.step(inp({ right: g.player.particle.position.x < 380 }));
  assert.equal(g.state, 'complete');
  assert.equal(g.exitReason, END.COMPLETE);
});

test('a level without goals opens its portal straight away', () => {
  const g = newGame(flatLevel({ entities: [[5, 8, 'portal']] }));
  g.step(inp());
  g.step(inp());
  assert.equal(g.portalOpen, true);
});

test('damage: one life per hit, 480 ms of no damage and no control, death ends the game', () => {
  const g = settle(newGame(flatLevel()));
  const p = g.player;
  g.events.push(ev(E.BE_HURT, p, [1]));
  g.step(inp());
  assert.equal(p.lives, 2);
  assert.equal(p.state, PLAYER_STATE.BE_HURT);
  g.events.push(ev(E.BE_HURT, p, [1]));
  g.step(inp({ right: true }));
  assert.equal(p.lives, 2, 'invulnerable while hurt');
  let n = 0;
  while (p.state === PLAYER_STATE.BE_HURT && n < 40) { g.step(inp()); n++; }
  assert.ok(n >= 13 && n <= 18, `hurt lasted ${n + 2} steps`);
  for (const expectLives of [1, 0]) {
    g.events.push(ev(E.BE_HURT, p, [1]));
    g.step(inp());
    assert.equal(p.lives, expectLives);
    while (p.state === PLAYER_STATE.BE_HURT) g.step(inp());
  }
  for (let i = 0; i < 3 && g.state === 'play'; i++) g.step(inp());
  assert.equal(g.state, 'gameover');
  assert.equal(g.exitReason, END.DIE);
  assert.equal(g.score, -10); // the player's own BE_KILLED scores -10 (faithful)
});

test('touching a bad microbe costs a life', () => {
  const g = newGame(flatLevel({ entities: [[6, 5, 'slurm']] }));
  let hurt = false;
  for (let i = 0; i < 80 && !hurt; i++) { g.step(inp({ right: true })); hurt = g.player.lives < 3; }
  assert.ok(hurt);
  assert.equal(g.player.lives, 2);
});

test('level timer: 6000 steps (180 s), shown as 180 at the start; time out ends the game', () => {
  const g = newGame(flatLevel());
  assert.equal(g.timeLeftSteps, LEVEL_TIME_STEPS);
  assert.equal(g.secondsLeft, 180);
  g.timeLeftSteps = 2;
  g.step(inp());
  assert.equal(g.state, 'play');
  g.step(inp());
  g.step(inp());
  assert.equal(g.state, 'gameover');
  assert.equal(g.exitReason, END.TIME);
});

// ---- Jumping: the original's dead press, and the port's buffer and coyote time --------------
function doubleJumpThenLand(g) {
  g.step(inp({ jumpPressed: true, jumpHeld: true }));
  g.step(inp({ jumpHeld: true }));
  g.step(inp({ jumpReleased: true }));
  g.step(inp());
  g.step(inp({ jumpPressed: true, jumpHeld: true }));
  g.step(inp({ jumpReleased: true }));
  assert.equal(g.player.jumpsLeft, 0);
}
const jumpsIn = (g, steps, first = inp({ jumpPressed: true, jumpHeld: true })) => {
  let n = 0;
  g.step(first); n += countFx(g, 'jump');
  for (let i = 1; i < steps; i++) { g.step(i === 1 ? inp({ jumpReleased: true }) : inp()); n += countFx(g, 'jump'); }
  return n;
};

test('original: the first press after landing from a double jump does nothing (dead press)', () => {
  const g = settle(newGame(flatLevel(), { options: { jumpFeel: false } }));
  doubleJumpThenLand(g);
  for (let i = 0; i < 40; i++) g.step(inp());
  assert.equal(g.player.jumpsLeft, 2);
  assert.equal(jumpsIn(g, 5), 0, 'dead press');
  assert.equal(jumpsIn(g, 5), 1, 'the next press jumps');
});

test('port: pressing jump after landing always works', () => {
  const g = settle(newGame(flatLevel()));
  doubleJumpThenLand(g);
  for (let i = 0; i < 40; i++) g.step(inp());
  assert.equal(jumpsIn(g, 5), 1);
});

test('port: a press up to 4 steps before landing is buffered; earlier presses are not', () => {
  const run = (early, jumpFeel = true) => {
    const g = settle(newGame(flatLevel(), { options: { jumpFeel } }));
    doubleJumpThenLand(g);
    // Record the fall to find the step the player touches down.
    const probe = settle(newGame(flatLevel()));
    doubleJumpThenLand(probe);
    let land = 0;
    while (!probe.player.particle.supported && land < 80) { probe.step(inp()); land++; }
    for (let i = 0; i < land - early; i++) g.step(inp());
    return jumpsIn(g, early + 6);
  };
  assert.equal(run(3), 1, 'pressed 3 steps early');
  assert.equal(run(9), 0, 'pressed 9 steps early');
  assert.equal(run(3, false), 0, 'original: no buffer');
});

test('port: coyote time, a jump just after leaving a ledge restores the double jump', () => {
  const ledge = () => {
    const tiles = [];
    for (let c = 0; c <= 5; c++) tiles.push([4, c, 'floor']);
    const g = settle(newGame(flatLevel({ startRow: 2, startCol: 3, extraTiles: tiles })));
    let n = 0;
    while (g.player.particle.supported && n < 60) { g.step(inp({ right: true })); n++; }
    return g;
  };
  const late = (wait) => {
    const g = ledge();
    g.player.jumpsLeft = 0; // as if a double jump had just landed and not been detected yet
    for (let i = 0; i < wait; i++) g.step(inp());
    return jumpsIn(g, 3);
  };
  assert.equal(late(2), 1, 'within the coyote window');
  assert.equal(late(8), 0, 'too late');
});

test('determinism: the same inputs give the same run; level 1 completes by bot', async () => {
  const a = await runBotHeadless(loadLevel('alpha_level1'), { PlatformGame, StepInput });
  const b = await runBotHeadless(loadLevel('alpha_level1'), { PlatformGame, StepInput });
  assert.equal(a.state, 'complete');
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.ok(a.stepCount < 1000, `took ${a.stepCount} steps`);
});

test('camera: clamped to the level and the player always on screen', () => {
  const level = loadLevel('alpha_level1');
  const g = newGame(level);
  const bot = new PlatformBot(level);
  const si = new StepInput();
  let prev = new Set();
  for (let i = 0; i < 1000 && g.state === 'play'; i++) {
    const acts = new Set(bot.decide({ ...g.snapshot(), ui: 'play', ready: true }));
    for (let t = 0; t < 2; t++) si.latch({ isDown: x => acts.has(x), pressed: x => t === 0 && acts.has(x) && !prev.has(x), released: x => t === 0 && !acts.has(x) && prev.has(x) });
    prev = acts;
    g.step(si.take());
    assert.ok(g.camera.x >= 0 && g.camera.x <= level.cols * 50 - 800);
    const sx = g.player.particle.position.x - g.camera.x;
    assert.ok(sx >= 0 && sx + 49 <= 800, `player at screen x ${sx}`);
  }
  assert.equal(g.state, 'complete');
});

test('every converted level builds and runs 200 idle steps without errors', () => {
  for (let n = 1; n <= 11; n++) {
    const g = newGame(loadLevel(`alpha_level${n}`));
    for (let i = 0; i < 200; i++) g.step(inp());
    assert.ok(g.entities[0] && g.player.lives === 3, `level ${n}`);
  }
});

test('milk: pushing Lucy into the glass makes yogurt (+10 for the hit, +50 for the yogurt)', () => {
  const g = newGame(flatLevel({ goals: [{ goalType: G.YOGURT, microbeType: T.SLURM, required: 1 }], entities: [[6, 5, 'lucy'], [4, 8, 'milk']] }));
  for (let i = 0; i < 300 && g.goalsView[0].achieved === 0; i++) g.step(inp({ right: true }));
  assert.equal(g.goalsView[0].achieved, 1);
  assert.equal(g.score, 60);
  for (let i = 0; i < 60; i++) g.step(inp());
  const milk = g.entities.find(e => e && e.type === T.MILK);
  assert.equal(milk.clip.label, 'yogurt');
});

test('antibiotic: carry one, throw it, it explodes 2 s after landing; bacteria die, the superinfection loses a life', () => {
  const g = newGame(flatLevel({ goals: [{ goalType: G.ANTIBIOTIC, microbeType: T.SLURM, required: 1 }], entities: [[7, 4, 'antibiotic'], [7, 6, 'antibiotic'], [6, 9, 'lucy'], [2, 13, 'superinfection']] }));
  for (let i = 0; i < 60 && !g.player.has_antibiotic; i++) g.step(inp({ right: g.player.particle.position.x < 170 }));
  assert.equal(g.player.has_antibiotic, true);
  assert.equal(g.antibioticHeld, true);
  g.step(inp({ cameraPressed: true })); // the camera button throws a carried antibiotic
  assert.equal(g.player.has_antibiotic, false);
  let explodedAt = -1;
  for (let i = 0; i < 120 && explodedAt < 0; i++) { g.step(inp()); if (g.fx.some(f => f.type === 'explode')) explodedAt = i; }
  assert.ok(explodedAt >= 67 && explodedAt < 90, `exploded after ${explodedAt} steps`);
  assert.equal(g.goalsView[0].achieved, 1);
  const lucy = g.entities.find(e => e && e.type === T.LUCY);
  const sup = g.entities.find(e => e && e.type === T.SUPERINFECTION);
  assert.ok(!lucy || lucy.state === 10 || lucy.removed, 'Lucy is killed by the antibiotic');
  assert.equal(sup.lives, 5);
  assert.ok(g.whiteout > 0);
});
