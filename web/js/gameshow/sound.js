// Game show sounds and music. The 2009 original was silent (NOTES 8.5), so these are new:
// synthesised effects registered with audio.defineSynth (names prefixed 'gs' so no other area's
// effect is replaced) and a procedural studio loop registered as the 'gameshow' track.
import { audio } from '../core/audio.js';
import { defineTrack } from '../core/music.js';

// Deterministic "random" values for textures (applause), so the synth never uses Math.random.
function* lcg(seed) {
  let s = seed >>> 0;
  for (;;) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; yield s / 4294967296; }
}

const SYNTHS = {
  // Correct answer: a bright rising arpeggio with a sparkle on top.
  gsCorrect: (a, v) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: i === 3 ? 0.42 : 0.13, vol: 0.13 * v, delay: i * 0.075 }));
    [1046.5, 1318.5].forEach((f, i) => a.tone({ type: 'square', freq: f, dur: 0.18, vol: 0.035 * v, delay: 0.3 + i * 0.06 }));
    a.noise({ dur: 0.35, vol: 0.05 * v, freq: 8000, type: 'highpass', delay: 0.25 });
  },
  // Wrong answer: a soft falling "wah-wah" (a children's game: disappointed, never harsh).
  gsWrong: (a, v) => {
    [[392, 370, 0], [349.2, 330, 0.2], [311.1, 262, 0.4]].forEach(([f, to, d], i) => a.tone({ type: 'triangle', freq: f, to, dur: i === 2 ? 0.6 : 0.2, vol: 0.13 * v, delay: d }));
    a.tone({ type: 'sine', freq: 155.6, to: 130.8, dur: 0.7, vol: 0.08 * v, delay: 0.4 });
  },
  // Don't know: a gentle two-note "hmm".
  gsNeutral: (a, v) => {
    a.tone({ type: 'sine', freq: 659.25, dur: 0.18, vol: 0.11 * v });
    a.tone({ type: 'sine', freq: 587.33, dur: 0.32, vol: 0.1 * v, delay: 0.17 });
    a.tone({ type: 'triangle', freq: 293.66, dur: 0.4, vol: 0.05 * v, delay: 0.17 });
  },
  // One snare hit (the drumroll is played hit by hit while the host builds suspense).
  gsDrum: (a, v, r) => {
    a.noise({ dur: 0.07, vol: 0.14 * v, freq: 1900 * r, q: 0.7 });
    a.tone({ type: 'triangle', freq: 190 * r, to: 140 * r, dur: 0.06, vol: 0.06 * v });
  },
  // A whole drumroll (about 0.9 s, rising).
  gsDrumroll: (a, v) => {
    for (let i = 0; i < 20; i++) {
      const k = i / 19;
      a.noise({ dur: 0.06, vol: (0.04 + 0.1 * k) * v, freq: 1800 + 400 * k, q: 0.7, delay: i * 0.045 });
    }
  },
  // Cymbal crash to land a verdict.
  gsCrash: (a, v) => {
    a.noise({ dur: 0.9, vol: 0.09 * v, freq: 6000, type: 'highpass' });
    a.noise({ dur: 0.4, vol: 0.06 * v, freq: 3000, q: 0.6 });
  },
  // Studio applause: many short claps in a deterministic scatter.
  gsApplause: (a, v) => {
    const r = lcg(2009);
    for (let i = 0; i < 46; i++) {
      const t = r.next().value * 1.3;
      const env = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 1.2;
      a.noise({ dur: 0.035, vol: Math.max(0.01, 0.07 * env) * v, freq: 1400 + r.next().value * 2200, q: 1.4, delay: t });
    }
  },
  // Round title fanfare.
  gsFanfare: (a, v) => {
    [[523.25, 0, 0.12], [523.25, 0.13, 0.08], [659.25, 0.22, 0.12], [783.99, 0.35, 0.45]].forEach(([f, d, dur]) => {
      a.tone({ type: 'square', freq: f, dur, vol: 0.06 * v, delay: d });
      a.tone({ type: 'triangle', freq: f / 2, dur, vol: 0.08 * v, delay: d });
    });
    a.tone({ type: 'triangle', freq: 1046.5, dur: 0.5, vol: 0.06 * v, delay: 0.35 });
  },
  // The question board swooping in.
  gsBoard: (a, v) => {
    a.noise({ dur: 0.28, vol: 0.07 * v, freq: 500, to: 3500, q: 0.8 });
    a.tone({ type: 'sine', freq: 440, to: 880, dur: 0.2, vol: 0.05 * v, delay: 0.08 });
  },
  // An answer locked in.
  gsLock: (a, v) => {
    a.tone({ type: 'square', freq: 523.25, dur: 0.07, vol: 0.07 * v });
    a.tone({ type: 'square', freq: 783.99, dur: 0.12, vol: 0.07 * v, delay: 0.06 });
  },
  // Selection moving between answer buttons.
  gsSelect: (a, v) => a.tone({ type: 'triangle', freq: 880, dur: 0.05, vol: 0.06 * v }),
  // Scoreboard digit ticking over.
  gsDigit: (a, v, r) => a.tone({ type: 'square', freq: 1320 * r, dur: 0.02, vol: 0.03 * v }),
};

let registered = false;
export function registerGameshowSounds() {
  if (registered) return;
  registered = true;
  for (const [name, fn] of Object.entries(SYNTHS)) audio.defineSynth(name, fn);
  defineTrack('gameshow', GAMESHOW_TRACK);
}

// ---------------------------------------------------------------------------------------------
// Music: a bouncy studio loop in C major (I-vi-IV-V, I-iii-IV-V), 8 bars at 126 bpm.
const CHORDS = [[60, 64, 67], [57, 60, 64], [57, 60, 65], [59, 62, 67], [60, 64, 67], [59, 64, 67], [57, 60, 65], [59, 62, 67]];
const ROOTS = [48, 45, 41, 43, 48, 40, 41, 43];
const TUNE = [
  72, 76, 79, 76, 77, 76, 74, 72,
  69, 72, 76, null, 74, 72, 69, null,
  65, 69, 72, 77, 76, 74, 72, 69,
  67, 71, 74, 79, 77, 74, 71, null,
  76, null, 79, 76, 72, null, 76, 79,
  76, 74, 71, 67, 71, 74, 76, null,
  77, 76, 74, 72, 69, 72, 74, 77,
  79, null, 74, null, 71, 74, 72, null,
];

function stabs(chords) {
  // Off-beat chord stabs (the "and" of each beat), one chord tone per voice.
  return k => {
    const out = [];
    for (const c of chords) for (let i = 0; i < 16; i++) out.push(i % 4 === 2 ? c[k] : null);
    return out;
  };
}
function bassLine(roots) {
  const out = [];
  for (const r of roots) for (let i = 0; i < 16; i++) out.push(i === 0 ? r : i === 4 ? r + 7 : i === 8 ? r + 12 : i === 10 ? r + 7 : i === 12 ? r : null);
  return out;
}
function eighths(notes) {
  const out = [];
  for (const n of notes) out.push(n, null);
  return out;
}
const stab = stabs(CHORDS);

export const GAMESHOW_TRACK = {
  name: 'gameshow',
  bpm: 126,
  voices: [
    { type: 'triangle', vol: 0.09, len: 1.5, notes: bassLine(ROOTS) },
    { type: 'square', vol: 0.014, len: 0.9, notes: stab(0) },
    { type: 'square', vol: 0.014, len: 0.9, notes: stab(1) },
    { type: 'square', vol: 0.012, len: 0.9, notes: stab(2) },
    { type: 'triangle', vol: 0.05, len: 1.6, notes: eighths(TUNE) },
    { type: 'noise', vol: 0.014, notes: Array.from({ length: 128 }, (_, i) => (i % 2 === 1 ? 1 : null)) },
  ],
};
