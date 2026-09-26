// Input latching between 15 ms engine ticks and 30 ms logic steps, and the converted level data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { StepInput, REPEAT_DELAY_STEPS } from '../../js/platformer/controls.js';
import { ROOT, loadLevel } from './helpers.mjs';

const tick = (si, down, pressed = [], released = []) => si.latch({
  isDown: a => down.includes(a), pressed: a => pressed.includes(a), released: a => released.includes(a),
});

test('a tap that starts and ends between two logic steps is not lost', () => {
  const si = new StepInput();
  tick(si, ['jump'], ['jump']);
  tick(si, [], [], ['jump']);
  const s = si.take();
  assert.equal(s.jumpPressed, true);
  assert.equal(s.jumpHeld, true);   // down on either tick counts as held
  assert.equal(s.jumpReleased, true);
  const t = si.take();
  assert.equal(t.jumpPressed, false);
  assert.equal(t.jumpHeld, false);
});

test('movement held on either tick counts; presses are single-step edges', () => {
  const si = new StepInput();
  tick(si, []);
  tick(si, ['right'], ['right']);
  assert.equal(si.take().right, true);
  tick(si, ['camera'], ['camera']);
  tick(si, ['camera']);
  assert.equal(si.take().cameraPressed, true);
  tick(si, ['camera']);
  tick(si, ['camera']);
  assert.equal(si.take().cameraPressed, false);
});

test('fire auto-repeats after about half a second of holding', () => {
  const si = new StepInput();
  const presses = [];
  for (let step = 0; step < REPEAT_DELAY_STEPS + 8; step++) {
    tick(si, ['fire'], step === 0 ? ['fire'] : []);
    tick(si, ['fire']);
    presses.push(si.take().firePressed ? 1 : 0);
  }
  assert.equal(presses[0], 1);
  assert.equal(presses.slice(1, REPEAT_DELAY_STEPS).reduce((a, b) => a + b, 0), 0);
  assert.ok(presses.slice(REPEAT_DELAY_STEPS).reduce((a, b) => a + b, 0) >= 3);
  const noRepeat = new StepInput({ repeat: false });
  let n = 0;
  for (let step = 0; step < 40; step++) { tick(noRepeat, ['fire'], step === 0 ? ['fire'] : []); tick(noRepeat, ['fire']); n += noRepeat.take().firePressed ? 1 : 0; }
  assert.equal(n, 1);
});

test('converted levels: play order, body levels, goals and player starts (section 5.3, 6.5)', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/data/levels/index.json'), 'utf8'));
  assert.deepEqual(index.order, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `alpha_level${n}`));
  assert.deepEqual(index.rounds.map(r => r.levels.length), [4, 3, 2, 0, 1]);
  assert.equal(index.rounds[3].kind, 'kitchen');
  const expect = {
    1: { cols: 69, body: true, start: [1, 6], goal: [0, 11, 3], next: 'alpha_level2' },
    2: { cols: 44, body: true, start: [4, 3], goal: [1, 11, 3], next: 'alpha_level3' },
    3: { cols: 44, body: true, start: [2, 2], goal: [0, 14, 3], next: 'alpha_level4' },
    4: { cols: 69, body: true, start: [4, 5], goal: [0, 13, 3], next: 'exit' },
    5: { cols: 69, body: false, start: [3, 1], goal: [4, 17, 3], next: 'alpha_level6' },
    6: { cols: 69, body: false, start: [3, 6], goal: [4, 17, 3], next: 'alpha_level7' },
    7: { cols: 75, body: true, start: [3, 5], goal: [4, 17, 3], next: 'exit' },
    8: { cols: 37, body: true, start: [2, 3], goal: [7, 17, 1], next: 'alpha_level9' },
    9: { cols: 64, body: true, start: [1, 7], goal: [7, 17, 3], next: 'exit' },
    10: { cols: 46, body: true, start: [3, 3], goal: [6, 17, 6], next: 'exit' },
  };
  for (const [n, e] of Object.entries(expect)) {
    const l = loadLevel(`alpha_level${n}`);
    assert.equal(l.cols, e.cols, `level ${n} cols`);
    assert.equal(l.bodyLevel, e.body, `level ${n} bodyLevel`);
    assert.deepEqual([l.playerStart.row, l.playerStart.col], e.start, `level ${n} start`);
    assert.deepEqual([l.goals[0].goalType, l.goals[0].microbeType, l.goals[0].required], e.goal, `level ${n} goal`);
    assert.equal(l.next, e.next);
    assert.ok(l.intro.length > 0, `level ${n} has intro pages`);
    // Multi-cell tiles keep their clip size; every used id has a palette entry.
    for (const [, , id] of [...l.tiles, ...l.entities]) assert.ok(l.palette[id], `level ${n} palette ${id}`);
  }
  assert.deepEqual(loadLevel('alpha_level1').palette[20], { movie: 'pepper_obj', type: 1, w: 100, h: 200, ax: 0, ay: 0 });
});
