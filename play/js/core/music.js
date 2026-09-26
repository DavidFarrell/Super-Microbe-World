// Procedural area music for audio.playMusic(). The 2009 game was silent, so these tracks are new:
// short, gentle loops for the MusicPlayer step sequencer in audio.js
// ({ bpm, voices: [{ type, vol, len, notes: [midi | null per sixteenth] }] }).

// Expands per-bar chords into a sixteenth-note arpeggio (8ths, pattern of chord indices).
function arpeggio(chords, pattern = [0, 1, 2, 1, 0, 1, 2, 1]) {
  const out = [];
  for (const c of chords) for (let i = 0; i < 16; i++) out.push(i % 2 ? null : c[pattern[(i / 2) % pattern.length]]);
  return out;
}

// A bouncy bass line: root, fifth and octave per bar.
function bass(roots) {
  const out = [];
  for (const r of roots) {
    for (let i = 0; i < 16; i++) out.push(i === 0 ? r : i === 6 ? r + 7 : i === 8 ? r + 12 : i === 12 ? r + 7 : i === 14 ? r : null);
  }
  return out;
}

// Eighth-note melody (one number or null per eighth) spread onto sixteenths.
function eighths(notes) {
  const out = [];
  for (const n of notes) out.push(n, null);
  return out;
}

// Kitchen: a cheerful F major loop, I-vi-IV-V then I-iii-IV-V, eight bars.
const KITCHEN_CHORDS = [[65, 69, 72], [62, 65, 69], [62, 65, 70], [64, 67, 72], [65, 69, 72], [64, 69, 72], [62, 65, 70], [64, 67, 72]];
const KITCHEN_ROOTS = [41, 38, 46, 48, 41, 45, 46, 48];
const KITCHEN_TUNE = [
  69, 72, 69, 65, 67, 69, null, null,
  65, 69, 74, 72, 69, null, null, null,
  74, 72, 70, 69, 67, 69, 70, null,
  72, null, 67, null, 64, 67, 72, null,
  69, 72, 77, 72, 69, 72, null, null,
  76, 72, 69, 72, 76, null, null, null,
  74, 77, 74, 70, 72, 74, 72, 70,
  67, null, 72, null, 76, null, null, null,
];

export const KITCHEN = {
  name: 'kitchen',
  bpm: 108,
  voices: [
    { type: 'triangle', vol: 0.085, len: 1.6, notes: bass(KITCHEN_ROOTS) },
    { type: 'sine', vol: 0.03, len: 1.4, notes: arpeggio(KITCHEN_CHORDS) },
    { type: 'triangle', vol: 0.05, len: 1.7, notes: eighths(KITCHEN_TUNE) },
    { type: 'noise', vol: 0.012, notes: Array.from({ length: 128 }, (_, i) => (i % 4 === 2 ? 1 : null)) },
  ],
};

// Skin and body areas reuse the kitchen tune for now, transposed and slowed.
const shift = (track, semis, bpm, name) => ({
  name, bpm,
  voices: track.voices.map(v => (v.type === 'noise' ? v : { ...v, notes: v.notes.map(n => (n == null ? null : n + semis)) })),
});
export const SKIN = shift(KITCHEN, 2, 100, 'skin');
export const BODY = shift(KITCHEN, -3, 92, 'body');

export const AREA_MUSIC = { kitchen: KITCHEN, skin: SKIN, body: BODY };
