// Web Audio mixer: master -> {music, sfx} buses, unlocked on the first user gesture
// (required on iOS). Sounds extracted from the original SWFs are played as buffers;
// anything the original lacked is synthesised here so the game never needs extra files.
import { settings } from './settings.js';

class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.unlocked = false;
    this.music = null;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) addEventListener(ev, unlock, { capture: true, passive: true });
    settings.addEventListener('change', () => this._applyVolumes());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.unlocked) this.ctx.resume();
    });
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    // A gentle compressor keeps stacked effects from clipping.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this._noise = this._makeNoise();
    this._applyVolumes();
    return this.ctx;
  }

  unlock() {
    const ctx = this._ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!this.unlocked) {
      // A silent buffer fully unlocks older iOS Safari.
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
      this.unlocked = true;
    }
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const muted = settings.get('muted');
    this.master.gain.setTargetAtTime(muted ? 0 : settings.get('master'), t, 0.02);
    this.musicBus.gain.setTargetAtTime(settings.get('music'), t, 0.02);
    this.sfxBus.gain.setTargetAtTime(settings.get('sfx'), t, 0.02);
  }

  async decode(arrayBuffer) {
    const ctx = this._ensure();
    if (!ctx) return null;
    return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
  }

  register(name, buffer) { if (buffer) this.buffers.set(name, buffer); }

  // Lets each game area add its own synthesised effects without editing this file:
  // fn(audio, volume, rate) builds the sound from audio.tone() / audio.noise().
  defineSynth(name, fn) { SYNTHS[name] = fn; }
  hasSound(name) { return this.buffers.has(name) || name in SYNTHS; }

  // Plays a named sound: a loaded buffer if present, else a synthesised effect.
  play(name, { volume = 1, rate = 1, pan = 0 } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const buf = this.buffers.get(name);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = volume;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = pan; src.connect(g).connect(p).connect(this.sfxBus); } else src.connect(g).connect(this.sfxBus);
      src.start();
      return;
    }
    const synth = SYNTHS[name];
    if (synth) synth(this, volume, rate);
  }

  _makeNoise() {
    const ctx = this.ctx, len = ctx.sampleRate * 0.5;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
    return b;
  }

  // Building blocks for synthesised effects.
  tone({ type = 'square', freq = 440, to = null, dur = 0.12, vol = 0.2, attack = 0.005, delay = 0, bus = this.sfxBus }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.2, freq = 1200, q = 1, type = 'bandpass', to = null, delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this._noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }

  playMusic(track) {
    this.stopMusic();
    if (!this.ctx || !track) return;
    this.music = new MusicPlayer(this, track);
    this.music.start();
  }

  stopMusic(fade = 0.4) {
    if (this.music) { this.music.stop(fade); this.music = null; }
  }

  // Ducks the music (1 = full level) without stopping it.
  musicLevel(v) { if (this.music) this.music.level(v); }
}

// Synthesised effects, tuned to feel cartoony and soft (a children's game).
const SYNTHS = {
  tap: (a, v) => a.tone({ type: 'triangle', freq: 880, to: 1320, dur: 0.06, vol: 0.12 * v }),
  hover: (a, v) => a.tone({ type: 'sine', freq: 660, dur: 0.04, vol: 0.05 * v }),
  jump: (a, v, r) => a.tone({ type: 'square', freq: 300 * r, to: 620 * r, dur: 0.14, vol: 0.09 * v }),
  doubleJump: (a, v, r) => { a.tone({ type: 'square', freq: 420 * r, to: 900 * r, dur: 0.12, vol: 0.08 * v }); a.noise({ dur: 0.1, vol: 0.05 * v, freq: 3000 }); },
  land: (a, v) => a.noise({ dur: 0.08, vol: 0.12 * v, freq: 400, type: 'lowpass' }),
  throw: (a, v) => { a.noise({ dur: 0.12, vol: 0.1 * v, freq: 1800, to: 600 }); a.tone({ type: 'sine', freq: 500, to: 900, dur: 0.1, vol: 0.06 * v }); },
  bubblePop: (a, v, r) => { a.tone({ type: 'sine', freq: 900 * r, to: 1800 * r, dur: 0.07, vol: 0.12 * v }); a.noise({ dur: 0.05, vol: 0.06 * v, freq: 5000 }); },
  splat: (a, v) => { a.noise({ dur: 0.22, vol: 0.2 * v, freq: 700, to: 200, type: 'lowpass' }); a.tone({ type: 'sawtooth', freq: 180, to: 60, dur: 0.2, vol: 0.08 * v }); },
  photo: (a, v) => { a.noise({ dur: 0.05, vol: 0.2 * v, freq: 6000, type: 'highpass' }); a.noise({ dur: 0.18, vol: 0.12 * v, freq: 2500, delay: 0.05 }); a.tone({ type: 'sine', freq: 2400, dur: 0.05, vol: 0.05 * v, delay: 0.02 }); },
  pickup: (a, v) => { a.tone({ type: 'square', freq: 988, dur: 0.07, vol: 0.08 * v }); a.tone({ type: 'square', freq: 1319, dur: 0.12, vol: 0.08 * v, delay: 0.07 }); },
  hurt: (a, v) => { a.tone({ type: 'sawtooth', freq: 420, to: 110, dur: 0.35, vol: 0.12 * v }); a.noise({ dur: 0.2, vol: 0.1 * v, freq: 900 }); },
  goal: (a, v) => [659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.14, vol: 0.12 * v, delay: i * 0.08 })),
  levelComplete: (a, v) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => a.tone({ type: 'square', freq: f, dur: i === 5 ? 0.4 : 0.12, vol: 0.09 * v, delay: i * 0.1 })),
  gameOver: (a, v) => [392, 349, 311, 262].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.3, vol: 0.12 * v, delay: i * 0.22 })),
  right: (a, v) => { a.tone({ type: 'triangle', freq: 784, dur: 0.1, vol: 0.14 * v }); a.tone({ type: 'triangle', freq: 1175, dur: 0.25, vol: 0.14 * v, delay: 0.1 }); },
  wrong: (a, v) => { a.tone({ type: 'square', freq: 196, dur: 0.18, vol: 0.1 * v }); a.tone({ type: 'square', freq: 147, dur: 0.3, vol: 0.1 * v, delay: 0.16 }); },
  neutral: (a, v) => a.tone({ type: 'sine', freq: 523, dur: 0.2, vol: 0.1 * v }),
  typeBlip: (a, v, r) => a.tone({ type: 'square', freq: 600 * r, dur: 0.025, vol: 0.03 * v }),
  shrink: (a, v) => { a.tone({ type: 'sine', freq: 1400, to: 90, dur: 1.4, vol: 0.12 * v }); a.tone({ type: 'triangle', freq: 1800, to: 120, dur: 1.4, vol: 0.05 * v, delay: 0.1 }); },
  whoosh: (a, v) => a.noise({ dur: 0.35, vol: 0.12 * v, freq: 400, to: 3000 }),
  tick: (a, v) => a.tone({ type: 'square', freq: 1500, dur: 0.02, vol: 0.05 * v }),
  yogurt: (a, v) => [523, 698, 880, 1047].forEach((f, i) => a.tone({ type: 'sine', freq: f, dur: 0.18, vol: 0.12 * v, delay: i * 0.07 })),
  sneeze: (a, v) => { a.tone({ type: 'sine', freq: 500, to: 900, dur: 0.4, vol: 0.05 * v }); a.noise({ dur: 0.3, vol: 0.25 * v, freq: 2500, delay: 0.42 }); },
  wash: (a, v) => { a.noise({ dur: 0.6, vol: 0.12 * v, freq: 1500, q: 0.5 }); a.tone({ type: 'sine', freq: 700, to: 1400, dur: 0.1, vol: 0.05 * v, delay: 0.3 }); },
  bin: (a, v) => a.noise({ dur: 0.2, vol: 0.18 * v, freq: 300, type: 'lowpass' }),
  cheer: (a, v) => { for (let i = 0; i < 6; i++) a.noise({ dur: 0.5, vol: 0.05 * v, freq: 1000 + i * 300, delay: i * 0.05 }); SYNTHS.goal(a, v); },
  // Platform game additions (the 2009 original had no sound at all).
  phoneGrow: (a, v) => { a.tone({ type: 'sine', freq: 520, to: 1040, dur: 0.22, vol: 0.07 * v }); a.tone({ type: 'triangle', freq: 1320, dur: 0.08, vol: 0.05 * v, delay: 0.2 }); },
  phoneShrink: (a, v) => a.tone({ type: 'sine', freq: 1040, to: 440, dur: 0.2, vol: 0.06 * v }),
  pageTurn: (a, v) => { a.noise({ dur: 0.07, vol: 0.05 * v, freq: 3200, q: 0.8 }); a.tone({ type: 'triangle', freq: 990, dur: 0.05, vol: 0.05 * v }); },
  tickLand: (a, v, r) => { a.tone({ type: 'triangle', freq: 1175 * r, dur: 0.08, vol: 0.1 * v }); a.tone({ type: 'triangle', freq: 1568 * r, dur: 0.16, vol: 0.1 * v, delay: 0.07 }); a.noise({ dur: 0.12, vol: 0.04 * v, freq: 7000, type: 'highpass', delay: 0.05 }); },
  portalOpen: (a, v) => { [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.3, vol: 0.08 * v, delay: i * 0.07 })); a.tone({ type: 'sine', freq: 180, to: 900, dur: 0.8, vol: 0.06 * v }); },
  suck: (a, v) => { a.tone({ type: 'sine', freq: 900, to: 120, dur: 0.55, vol: 0.1 * v }); a.noise({ dur: 0.5, vol: 0.08 * v, freq: 2500, to: 300 }); },
  heartLost: (a, v) => { a.tone({ type: 'square', freq: 330, to: 165, dur: 0.18, vol: 0.06 * v }); a.tone({ type: 'triangle', freq: 220, to: 110, dur: 0.25, vol: 0.08 * v, delay: 0.08 }); },
  countTick: (a, v, r) => a.tone({ type: 'square', freq: 1200 * r, dur: 0.025, vol: 0.035 * v }),
  lowTime: (a, v) => a.tone({ type: 'square', freq: 1760, dur: 0.04, vol: 0.05 * v }),
  squelch: (a, v) => { a.noise({ dur: 0.18, vol: 0.16 * v, freq: 500, to: 150, type: 'lowpass' }); a.tone({ type: 'sine', freq: 260, to: 90, dur: 0.16, vol: 0.1 * v }); },
};

// A tiny step sequencer for procedural area music. A track is
// { bpm, steps, voices: [{ type, vol, notes: [midi|null per step], len }] }.
class MusicPlayer {
  constructor(audio, track) {
    this.a = audio; this.track = track; this.step = 0; this.timer = 0; this.next = 0;
    this.gain = audio.ctx.createGain(); this.gain.gain.value = 0.0001; this.gain.connect(audio.musicBus);
  }
  start() {
    const ctx = this.a.ctx;
    this.gain.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    this.next = ctx.currentTime + 0.05;
    const spb = 60 / this.track.bpm / 4; // sixteenth notes
    const schedule = () => {
      while (this.next < ctx.currentTime + 0.25) {
        for (const v of this.track.voices) {
          const n = v.notes[this.step % v.notes.length];
          if (n == null) continue;
          const freq = 440 * Math.pow(2, (n - 69) / 12);
          if (v.type === 'noise') this._hat(this.next, v.vol);
          else this._note(v.type, freq, this.next, spb * (v.len || 1) * 0.95, v.vol);
        }
        this.step++;
        this.next += spb;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 60);
  }
  _note(type, freq, t, dur, vol) {
    const ctx = this.a.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain); o.start(t); o.stop(t + dur + 0.02);
  }
  _hat(t, vol) {
    const ctx = this.a.ctx, s = ctx.createBufferSource(); s.buffer = this.a._noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f).connect(g).connect(this.gain); s.start(t); s.stop(t + 0.06);
  }
  // Smoothly sets this track's level (1 = full), e.g. ducked under a menu.
  level(v, time = 0.25) {
    this.gain.gain.setTargetAtTime(Math.max(0.0001, v), this.a.ctx.currentTime, time);
  }
  stop(fade) {
    clearInterval(this.timer);
    const ctx = this.a.ctx;
    this.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3);
    setTimeout(() => this.gain.disconnect(), fade * 1000 + 200);
  }
}

export const audio = new Audio();
