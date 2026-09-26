// Seeded pseudo-random numbers (mulberry32) so runs and input replays are reproducible.
export class Rng {
  constructor(seed = 1) { this.seed(seed); }
  seed(s) { this.state = (s >>> 0) || 1; this.initial = this.state; }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, maxInclusive) { return Math.floor(this.range(min, maxInclusive + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

// Gameplay randomness (deterministic, seeded per run) and cosmetic randomness
// (particles, screen shake) are kept apart so juice never changes a replay.
export const gameRng = new Rng(20090620);
export const fxRng = new Rng(7);
