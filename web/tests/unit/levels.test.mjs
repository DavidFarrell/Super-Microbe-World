// Levels 2-10: the resolved decisions that change the original's rules (NOTES.md 11.9 #7 and
// #10) and the converted level data every level relies on. Synthetic levels come from
// helpers.mjs; the real ones from web/data/levels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { E, G, S, T, POINTS, BOMB_FUSE_STEPS } from '../../js/platformer/constants.js';
import { flatLevel, newGame, settle, inp, loadLevel } from './helpers.mjs';

const pointsOf = g => g.fx.filter(f => f.type === 'points').map(f => f.n);

test('decision #7: a thrown antibiotic explodes and counts even when it is off screen', () => {
  const g = newGame(flatLevel({ cols: 80, goals: [{ goalType: G.ANTIBIOTIC, microbeType: T.SLURM, required: 1 }], entities: [[7, 4, 'antibiotic']] }));
  for (let i = 0; i < 60 && !g.player.has_antibiotic; i++) g.step(inp({ right: g.player.particle.position.x < 170 }));
  assert.equal(g.player.has_antibiotic, true);
  g.step(inp({ cameraPressed: true }));
  const bomb = g.entities.find(e => e && e.type === T.ANTIBIOTIC_BOMB);
  assert.ok(bomb, 'the camera button throws the carried antibiotic');
  // Ride right until the bomb has left the view, then keep going: in the original an off-screen
  // bomb stopped advancing and never exploded (AntibioticBombEntity.as:36-57, PlatformGame.as:621).
  let offAt = -1, explodedOff = false, steps = 0;
  for (; steps < 300 && g.goalsView[0].achieved === 0; steps++) {
    g.step(inp({ right: true }));
    if (offAt < 0 && bomb.isOnScreen === false) offAt = steps;
    if (g.fx.some(f => f.type === 'explode')) explodedOff = bomb.isOnScreen === false;
  }
  assert.ok(offAt >= 0, 'the bomb left the view');
  assert.ok(explodedOff, 'the bomb exploded while off screen');
  assert.equal(g.goalsView[0].achieved, 1, 'the off-screen detonation counts for the ANTIBIOTIC goal');
  assert.ok(steps <= BOMB_FUSE_STEPS + 40, `exploded after ${steps} steps`);
  assert.equal(bomb.removed, true);
});

test('an antibiotic does not kill a bacterium that is already dying (no second -10)', () => {
  const g = newGame(flatLevel({ cols: 40, goals: [{ goalType: G.ANTIBIOTIC, microbeType: T.SLURM, required: 2 }], entities: [[7, 4, 'antibiotic'], [7, 5, 'antibiotic'], [6, 12, 'lucy']] }));
  const lucy = g.entities.find(e => e && e.type === T.LUCY);
  const got = [];
  let thrown = 0;
  for (let i = 0; i < 400 && g.goalsView[0].achieved < 2; i++) {
    const has = g.player.has_antibiotic;
    // Collect and throw both antibiotics straight away, so the second blast comes while Lucy's
    // be_killed animation from the first is still playing.
    g.step(inp({ right: !has && g.player.particle.position.x < 240, cameraPressed: has && i % 2 === 0 }));
    if (has && !g.player.has_antibiotic) thrown++;
    for (const f of g.fx) if (f.type === 'explode') got.push({ step: g.stepCount, victims: f.victims, lucy: lucy.state });
  }
  assert.equal(thrown, 2);
  assert.equal(got.length, 2, `explosions ${JSON.stringify(got)}`);
  assert.ok(got[1].step - got[0].step < 30, `the blasts are ${got[1].step - got[0].step} steps apart`);
  assert.equal(got[0].victims, 1);
  assert.equal(got[1].victims, 0, 'the dying Lucy is not a victim again');
  assert.equal(got[1].lucy, S.BE_KILLED, 'Lucy was still dying (on screen, not removed) at the second blast');
  assert.equal(g.score, -10);
});

test('decision #10: a white blood cell hitting a bad microbe pays +3, then +5 when it is washed away', () => {
  const g = settle(newGame(flatLevel({ entities: [[6, 8, 'slurm']] })));
  for (let i = 0; i < 20; i++) g.step(inp()); // the Slurm lands and starts its patrol
  const slurm = g.entities.find(e => e && e.type === T.SLURM);
  const got = [];
  g.step(inp({ firePressed: true }));
  for (let i = 0; i < 90 && !slurm.removed; i++) { g.step(inp()); got.push(...pointsOf(g)); }
  assert.deepEqual(got, [POINTS.BULLET_HIT, POINTS.KILL_BAD], `points ${got}`);
  assert.equal(g.score, 8);
});

test('decision #10: bullets pay nothing on the superinfection (it shrugs them off)', () => {
  const g = settle(newGame(flatLevel({ entities: [[4, 5, 'superinfection']] })));
  const got = [];
  for (let k = 0; k < 3; k++) {
    g.step(inp({ firePressed: true }));
    for (let i = 0; i < 30; i++) { g.step(inp()); got.push(...pointsOf(g)); }
  }
  assert.deepEqual(got, []);
  assert.equal(g.entities.find(e => e && e.type === T.SUPERINFECTION).lives, 6);
});

test('decision #6: the Lucy / milk result keeps the original entity order', () => {
  // A walking Lucy that comes before the glass in entity (row-major) order dives in without
  // making yogurt; after the glass, the glass sees her first and turns (MilkGlassEntity.as:64-93,
  // LucyLactobacillus.as:145-175). Pushing her in always works (game.test.mjs).
  const run = (lucyRow, lucyCol) => {
    const g = newGame(flatLevel({ cols: 16, goals: [{ goalType: G.YOGURT, microbeType: T.SLURM, required: 1 }], startCol: 14, entities: [[lucyRow, lucyCol, 'lucy'], [4, 8, 'milk']] }));
    const lucy = g.entities.find(e => e && e.type === T.LUCY);
    for (let i = 0; i < 600 && !lucy.removed && g.goalsView[0].achieved === 0; i++) g.step(inp());
    return { g, lucy };
  };
  const first = run(3, 5);   // row 3: before the glass (row 4)
  assert.ok(first.lucy.indexId < first.g.entities.find(e => e && e.type === T.MILK).indexId);
  assert.equal(first.g.goalsView[0].achieved, 0, 'a walking Lucy with the lower index dives without yogurt');
  assert.ok(first.lucy.removed && first.lucy.state === S.IGNORE, `Lucy dived into the glass (state ${first.lucy.state})`);
  const after = run(5, 5);   // row 5: after the glass
  assert.ok(after.lucy.indexId > after.g.entities.find(e => e && e.type === T.MILK).indexId);
  assert.equal(after.g.goalsView[0].achieved, 1, 'the glass registers a Lucy that comes after it');
});

test('the ePhone goal event and its points: MILK_GLASS_HIT +10, TURN_TO_YOGURT +50 (ids namespaced)', () => {
  assert.notEqual(E.MILK_GLASS_HIT, E.PLAYER_ACCELERATE);
  assert.notEqual(E.BAD_MICROBE_WASH_AWAY, E.PLAYER_DECELERATE);
  assert.equal(POINTS.MILK_HIT, 10);
  assert.equal(POINTS.YOGURT, 50);
});
