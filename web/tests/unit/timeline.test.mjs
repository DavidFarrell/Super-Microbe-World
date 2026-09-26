// Flash timeline model: the observable durations the logic depends on (flash-platformer.md
// sections 3.4-3.9, 4.4-4.7). One tick() is one 25 fps frame (40 ms).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Clip } from '../../js/platformer/timeline.js';

// Frames until midAnimation turns false after gotoAndPlay(label).
function midFrames(symbol, label) {
  const c = new Clip(symbol);
  c.gotoAndPlay(label);
  assert.equal(c.midAnimation, true, `${symbol} ${label} starts mid-animation`);
  let n = 0;
  while (c.midAnimation === true && n < 500) { c.tick(); n++; }
  return n;
}

test('avatar jump_start holds midAnimation for 4 frames (160 ms)', () => {
  assert.equal(midFrames('harry_lower', 'jump_start'), 4);
  assert.equal(midFrames('amy_lower', 'jump_start'), 4);
});

test('avatar hurt lasts 12 frames (480 ms) on both halves, for Harry and Amy', () => {
  for (const who of ['harry', 'amy']) {
    assert.equal(midFrames(`${who}_upper`, 'hurt'), 12, who);
    assert.equal(midFrames(`${who}_lower`, 'hurt'), 12, who);
  }
});

test('Amy differs from Harry: her throw holds the upper body 18 frames and fires on frame 4', () => {
  // amy.swf sprite 208: shoot_soap 280 (mid), 284 shoot = true, 298 mid = false. Harry: 280, 283, 283.
  assert.equal(midFrames('amy_upper', 'shoot_soap'), 18);
  assert.equal(midFrames('harry_upper', 'shoot_soap'), 3);
  const c = new Clip('amy_upper');
  c.gotoAndPlay('shoot_soap');
  for (let i = 0; i < 3; i++) c.tick();
  assert.equal(c.shoot, false);
  c.tick();
  assert.equal(c.shoot, true);
  // Her photo pose clears midAnimation after 7 frames (Harry 15).
  assert.equal(midFrames('amy_upper', 'take_photo_start'), 7);
  assert.equal(midFrames('harry_upper', 'take_photo_start'), 15);
});

test('shoot_soap: shoot turns true 3 frames after the press (the projectile spawn point)', () => {
  const c = new Clip('harry_upper');
  c.gotoAndPlay('shoot_soap');
  assert.equal(c.shoot, false);
  c.tick(); c.tick();
  assert.equal(c.shoot, false);
  c.tick();
  assert.equal(c.shoot, true);
  assert.equal(c.midAnimation, false);
});

test('microbe animation spans: Lucy be_photographed 14 frames, be_killed 27 then stop', () => {
  assert.equal(midFrames('lucy_icon', 'be_photographed'), 14);
  assert.equal(midFrames('lucy_icon', 'be_killed'), 27);
  const c = new Clip('lucy_icon');
  c.gotoAndPlay('be_killed');
  for (let i = 0; i < 40; i++) c.tick();
  assert.equal(c.playing, false);
  assert.equal(c.label, 'be_killed');
});

test('Slurm be_hit then be_killed in one act ends at once (last goto wins, section 4.5)', () => {
  const c = new Clip('slurm_icon');
  c.gotoAndPlay('be_hit');
  c.gotoAndPlay('be_killed');
  assert.equal(c.midAnimation, false);
  // Lucy's be_killed does set midAnimation itself, so she still plays her death.
  const l = new Clip('lucy_icon');
  l.gotoAndPlay('be_hit');
  l.gotoAndPlay('be_killed');
  assert.equal(l.midAnimation, true);
});

test('milk tickle runs 30 frames, then returns to start', () => {
  assert.equal(midFrames('milk_glass_icon', 'tickle'), 30);
  const c = new Clip('milk_glass_icon');
  c.gotoAndPlay('tickle');
  for (let i = 0; i < 30; i++) c.tick();
  assert.equal(c.label, 'start');
  assert.equal(c.playing, false);
});

test('soap splat: 5 frames of midAnimation; white blood cells never set it', () => {
  assert.equal(midFrames('soap_projectile', 'splat'), 5);
  const w = new Clip('white_projectile');
  w.gotoAndPlay('splat');
  assert.equal(w.midAnimation, false);
});

test('superinfection be_killed loops to idle_4 while lives remain, else hides', () => {
  const c = new Clip('superinfection_icon');
  c.lives = 2;
  c.gotoAndPlay('be_killed');
  for (let i = 0; i < 40; i++) c.tick();
  assert.equal(c.visible, true);
  assert.equal(c.label, 'idle_4');
  const d = new Clip('superinfection_icon');
  d.lives = 0;
  d.gotoAndPlay('be_killed');
  for (let i = 0; i < 40; i++) d.tick();
  assert.equal(d.visible, false);
});

test('gotos to missing labels are ignored (Steve frame 1 "steve_idle")', () => {
  const c = new Clip('steve_icon');
  const f = c.frame;
  c.gotoAndPlay('steve_idle');
  assert.equal(c.frame, f);
});
