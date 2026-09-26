// Kitchen sounds and music. The 2009 kitchen game was silent, so everything here is new and
// synthesised (no files): effects are registered with audio.defineSynth and the loop with
// defineTrack('kitchenGame'), both at import time (registration only; nothing plays until the
// audio context is unlocked by a gesture).
import { audio } from '../core/audio.js';
import { defineTrack } from '../core/music.js';

const S = {
  // Fridge door: a soft rubber-seal thump and a little suction pop.
  kitchenFridge: (a, v) => {
    a.noise({ dur: 0.16, vol: 0.2 * v, freq: 260, type: 'lowpass' });
    a.tone({ type: 'sine', freq: 170, to: 80, dur: 0.16, vol: 0.12 * v });
    a.tone({ type: 'sine', freq: 900, to: 1400, dur: 0.05, vol: 0.05 * v, delay: 0.09 });
  },
  // Cupboard: two quick wooden knocks.
  kitchenCupboard: (a, v) => {
    a.tone({ type: 'triangle', freq: 330, to: 210, dur: 0.07, vol: 0.14 * v });
    a.noise({ dur: 0.05, vol: 0.08 * v, freq: 900, q: 2 });
    a.tone({ type: 'triangle', freq: 280, to: 190, dur: 0.08, vol: 0.12 * v, delay: 0.08 });
  },
  // Fruit bowl: a ceramic clink.
  kitchenBowl: (a, v) => {
    a.tone({ type: 'sine', freq: 1760, dur: 0.22, vol: 0.07 * v });
    a.tone({ type: 'sine', freq: 2637, dur: 0.14, vol: 0.04 * v, delay: 0.01 });
    a.noise({ dur: 0.04, vol: 0.05 * v, freq: 4000, type: 'highpass' });
  },
  // Pedal bin: the lid clanks open and shut.
  kitchenBin: (a, v) => {
    a.noise({ dur: 0.12, vol: 0.14 * v, freq: 1300, q: 3 });
    a.tone({ type: 'square', freq: 240, to: 120, dur: 0.1, vol: 0.05 * v });
    a.noise({ dur: 0.16, vol: 0.12 * v, freq: 700, q: 2, delay: 0.26 });
    a.tone({ type: 'triangle', freq: 180, to: 110, dur: 0.14, vol: 0.08 * v, delay: 0.26 });
  },
  // Cling film: a stretch and a crinkle of short bright noise bursts.
  kitchenCling: (a, v) => {
    a.noise({ dur: 0.18, vol: 0.06 * v, freq: 2000, to: 5000, q: 0.7 });
    for (let i = 0; i < 6; i++) a.noise({ dur: 0.03, vol: (0.05 + (i % 3) * 0.015) * v, freq: 5000 + i * 700, type: 'highpass', delay: 0.14 + i * 0.045 });
  },
  // Running water with a couple of bubbles.
  kitchenWash: (a, v) => {
    a.noise({ dur: 1.2, vol: 0.09 * v, freq: 1600, q: 0.4 });
    a.noise({ dur: 1.0, vol: 0.05 * v, freq: 4200, q: 0.8, delay: 0.1 });
    for (let i = 0; i < 4; i++) a.tone({ type: 'sine', freq: 600 + i * 170, to: 1300 + i * 200, dur: 0.06, vol: 0.04 * v, delay: 0.25 + i * 0.22 });
  },
  // The sneeze builds up: "ah... ah..."
  kitchenSneezeUp: (a, v) => {
    a.tone({ type: 'sine', freq: 420, to: 560, dur: 0.35, vol: 0.06 * v });
    a.tone({ type: 'sine', freq: 520, to: 760, dur: 0.4, vol: 0.07 * v, delay: 0.45 });
  },
  // "Atchoo!" all over the food.
  kitchenSneeze: (a, v) => {
    a.tone({ type: 'sine', freq: 700, to: 300, dur: 0.12, vol: 0.06 * v });
    a.noise({ dur: 0.34, vol: 0.28 * v, freq: 2600, q: 0.6, delay: 0.05 });
    a.noise({ dur: 0.25, vol: 0.1 * v, freq: 600, type: 'lowpass', delay: 0.05 });
  },
  // A muffled sneeze into a tissue.
  kitchenTissue: (a, v) => {
    a.noise({ dur: 0.08, vol: 0.06 * v, freq: 5000, type: 'highpass' });
    a.noise({ dur: 0.22, vol: 0.14 * v, freq: 700, type: 'lowpass', delay: 0.08 });
    a.tone({ type: 'sine', freq: 380, to: 240, dur: 0.18, vol: 0.05 * v, delay: 0.08 });
  },
  // Right place: a bright two-note chime.
  kitchenCorrect: (a, v) => {
    a.tone({ type: 'triangle', freq: 880, dur: 0.09, vol: 0.12 * v });
    a.tone({ type: 'triangle', freq: 1319, dur: 0.22, vol: 0.12 * v, delay: 0.08 });
    a.tone({ type: 'sine', freq: 2637, dur: 0.12, vol: 0.03 * v, delay: 0.1 });
  },
  // Wrong place: a soft, low "uh-oh" (never harsh; a children's game).
  kitchenWrong: (a, v) => {
    a.tone({ type: 'triangle', freq: 330, to: 300, dur: 0.14, vol: 0.13 * v });
    a.tone({ type: 'triangle', freq: 247, to: 220, dur: 0.26, vol: 0.13 * v, delay: 0.14 });
  },
  // Germs landing on food or hands.
  kitchenGerm: (a, v) => {
    a.tone({ type: 'sine', freq: 300, to: 520, dur: 0.08, vol: 0.06 * v });
    a.tone({ type: 'sine', freq: 360, to: 640, dur: 0.08, vol: 0.05 * v, delay: 0.09 });
  },
  // The next item hops out of the shopping bag.
  kitchenPop: (a, v, r) => {
    a.tone({ type: 'sine', freq: 480 * r, to: 900 * r, dur: 0.08, vol: 0.07 * v });
    a.noise({ dur: 0.05, vol: 0.04 * v, freq: 1800, q: 1.5, delay: 0.02 });
  },
  // Lifting and putting back an item.
  kitchenLift: (a, v) => a.tone({ type: 'sine', freq: 620, to: 980, dur: 0.07, vol: 0.06 * v }),
  kitchenDrop: (a, v) => a.tone({ type: 'sine', freq: 760, to: 420, dur: 0.08, vol: 0.06 * v }),
  // A clock tick for the last ten seconds.
  kitchenTick: (a, v, r) => a.tone({ type: 'square', freq: 1480 * r, dur: 0.03, vol: 0.045 * v }),
  // Time up / level done.
  kitchenTimeUp: (a, v) => [784, 659, 523].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.1 * v, delay: i * 0.12 })),
  kitchenDone: (a, v) => [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: i === 3 ? 0.35 : 0.12, vol: 0.1 * v, delay: i * 0.09 })),
  // Outro rows and the count-up.
  kitchenRow: (a, v, r) => a.tone({ type: 'triangle', freq: 660 * r, dur: 0.06, vol: 0.06 * v }),
  kitchenCount: (a, v, r) => a.tone({ type: 'square', freq: 1100 * r, dur: 0.022, vol: 0.03 * v }),
};
for (const [name, fn] of Object.entries(S)) audio.defineSynth(name, fn);

// "kitchenGame": a jaunty 1950s-kitchen loop in C major (walking bass, off-beat chord stabs,
// a bouncy tune), eight bars at 124 bpm. Sequencer format: web/js/core/audio.js MusicPlayer.
const bars = (list, fill) => list.flatMap(fill);
// Walking bass: four quarter notes a bar.
const BASS = [[48, 52, 55, 57], [45, 48, 52, 50], [41, 45, 48, 50], [43, 47, 50, 47], [48, 52, 55, 52], [45, 49, 52, 49], [38, 41, 45, 41], [43, 47, 50, 53]];
const bass = bars(BASS, bar => bar.flatMap(n => [n, null, null, null]));
// Off-beat stabs, one voice per chord tone.
const CHORDS = [[60, 64, 67], [57, 60, 64], [57, 60, 65], [59, 62, 67], [60, 64, 67], [57, 61, 64], [57, 62, 65], [59, 62, 65]];
const stab = k => bars(CHORDS, c => Array.from({ length: 16 }, (_, i) => (i % 4 === 2 ? c[k] : null)));
// Tune in eighths.
const TUNE = [
  64, 67, 72, 67, 69, 67, 64, null,
  72, 71, 69, 64, 69, null, 72, null,
  69, 72, 77, 72, 74, 72, 69, null,
  67, 69, 71, 74, 79, null, 77, null,
  76, 74, 72, 67, 64, 67, 72, null,
  73, 76, 81, 76, 73, null, 69, null,
  74, 77, 81, 77, 74, 76, 77, null,
  79, 77, 74, 71, 67, null, null, null,
];
const tune = TUNE.flatMap(n => [n, null]);

export const KITCHEN_GAME_TRACK = {
  name: 'kitchenGame',
  bpm: 124,
  voices: [
    { type: 'triangle', vol: 0.09, len: 3.2, notes: bass },
    { type: 'square', vol: 0.012, len: 0.9, notes: stab(0) },
    { type: 'square', vol: 0.012, len: 0.9, notes: stab(1) },
    { type: 'square', vol: 0.012, len: 0.9, notes: stab(2) },
    { type: 'triangle', vol: 0.05, len: 1.6, notes: tune },
    { type: 'noise', vol: 0.011, notes: Array.from({ length: 128 }, (_, i) => (i % 4 === 2 ? 1 : null)) },
  ],
};
defineTrack('kitchenGame', KITCHEN_GAME_TRACK);
