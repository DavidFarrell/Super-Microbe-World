// A reactive level bot for the platform game. It only sees the 'platform' test probe (the same
// data window.__test.probe('platform') returns) plus the level geometry, and answers with the
// actions to hold for the next logic step, so it plays through real inputs: the E2E tests feed
// its answers to __test.hold() (keyboard path) or to the on-screen touch buttons.
//
// Strategy: pick a target (the nearest unfinished goal microbe, then the open portal), ride
// towards it, jump when blocked or when the target is above, double jump near the apex, and
// photograph / throw when the target is in reach. Deterministic: no randomness, no timers.
//
// This reactive bot is enough for level 1 (web/tests/level1.spec.mjs drives it with the keyboard
// and with on-screen taps). Every level 1-10 is completed by the planning bot, PlannerBot, in
// ./planner.mjs (look-ahead on a shadow copy of the simulation), re-exported here; its winning
// runs are recorded by ./record-traces.mjs into web/tests/traces/ and replayed by
// web/tests/levels.spec.mjs.
export { PlannerBot, runPlannerHeadless } from './planner.mjs';

const TILE = 50;
const LUCY = 11, MILK = 20, PORTAL = 6, ANTIBIOTIC_PICKUP = 21, SUPERINFECTION = 23;
const GOOD = [3, 4, 11, 12, 13, 14];
const BAD = [5, 15, 16, 17, 18, 19];

export class PlatformBot {
  /** @param {{ tiles?: number[][], palette?: object, rows?: number, cols?: number }} level JSON (optional) */
  constructor(level = null) {
    this.level = level;
    this.step = 0;
    this.lastX = null;
    this.stuck = 0;
    this.jumpCooldown = 0;
    this.photoCooldown = 0;
    this.fireCooldown = 0;
    this.prevActions = new Set();
    this.reverse = 0;
    this.dwell = 0;
    this.log = [];
  }

  // Which entities still matter for the level's goal.
  targets(p) {
    const g = p.goals[0];
    const alive = p.entities.filter(e => e.alive && e.onScreen !== undefined);
    if (p.portalOpen || !g) return alive.filter(e => e.typeId === PORTAL);
    switch (g.type) {
      case 0: return alive.filter(e => e.typeId === g.microbeType && !e.photographed);
      case 1: return alive.filter(e => GOOD.includes(e.typeId) && !e.photographed);
      case 3: return alive.filter(e => (GOOD.includes(e.typeId) || BAD.includes(e.typeId)) && !e.photographed);
      case 4: return alive.filter(e => BAD.includes(e.typeId));
      case 6: return p.player.hasAntibiotic ? alive.filter(e => e.typeId === SUPERINFECTION) : alive.filter(e => e.typeId === ANTIBIOTIC_PICKUP);
      case 7: return alive.filter(e => e.typeId === LUCY);
      default: return alive.filter(e => e.typeId === PORTAL);
    }
  }

  // The camera flash's art rectangle for the current facing (flash-platformer.md section 3.6).
  // Facing right it spawns at x + the avatar's live clip width (probe player.clipW).
  flashRect(pl) {
    const W = pl.clipW ?? 55.68;
    return pl.facing === 'right'
      ? { x0: pl.x + W - 31, x1: pl.x + W + 44, y0: pl.y - 8, y1: pl.y + 67 }
      : { x0: pl.x - 46, x1: pl.x + 29, y0: pl.y - 8, y1: pl.y + 67 };
  }

  decide(p) {
    this.step++;
    const pl = p.player;
    const acts = new Set();
    if (!p.ready || p.state !== 'play' || p.ui !== 'play') return this._emit(acts);
    const list = this.targets(p);
    const cx = pl.x + pl.w / 2;
    // Nearest target by horizontal distance, preferring ones roughly level with us.
    let t = null, best = Infinity;
    for (const e of list) {
      const d = Math.abs(e.x + e.w / 2 - cx) + Math.max(0, pl.y + pl.h - (e.y + e.h)) * 1.5;
      if (d < best) { best = d; t = e; }
    }
    if (!t) return this._emit(acts);
    const tx = t.x + t.w / 2;
    const g = p.goals[0];
    const photoGoal = g && [0, 1, 3].includes(g.type) && !p.portalOpen;
    const killGoal = g && g.type === 4 && !p.portalOpen;

    // Photograph when the flash would overlap the target.
    if (photoGoal && pl.canPhoto && this.photoCooldown <= 0) {
      const f = this.flashRect(pl);
      if (f.x0 < t.x + t.w && f.x1 > t.x && f.y0 < t.y + t.h && f.y1 > t.y) {
        acts.add('camera');
        this.photoCooldown = 12;
      }
    }
    // Throw when a bad microbe is ahead at bullet height.
    if (killGoal && this.fireCooldown <= 0) {
      const ahead = pl.facing === 'right' ? t.x > pl.x && t.x - pl.x < 420 : t.x < pl.x && pl.x - t.x < 420;
      const by0 = pl.y + 27, by1 = by0 + 25;
      if (ahead && by0 < t.y + t.h && by1 > t.y) { acts.add('fire'); this.fireCooldown = 8; }
    }

    // Horizontal: ride towards the target; stand still on the portal.
    const want = p.portalOpen ? tx - (pl.x + 24) : photoGoal ? this._photoStand(pl, t) : killGoal ? this._killStand(pl, t) : tx - cx;
    let dir = 0;
    if (Math.abs(want) > (p.portalOpen ? 18 : 12)) dir = Math.sign(want);
    if (this.reverse > 0) { dir = -this.lastDir || -1; this.reverse--; }
    if (dir > 0) acts.add('right'); else if (dir < 0) acts.add('left');
    if (dir) this.lastDir = dir;

    // Stuck detection: holding a direction without moving means a wall; jump it.
    if (this.lastX !== null && dir && Math.abs(pl.x - this.lastX) < 0.6) this.stuck++; else this.stuck = 0;
    this.lastX = pl.x;
    const above = t.y + t.h < pl.y + pl.h - 30;
    const needJump = (this.stuck >= 2) || (above && Math.abs(tx - cx) < 180) || this._wallAhead(pl, dir);
    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (needJump && this.jumpCooldown <= 0) {
      if (pl.onGround && pl.jumpsLeft > 0) { acts.add('jump'); this.jumpCooldown = 3; }
      else if (!pl.onGround && pl.jumpsLeft > 0 && pl.vy > -3) { acts.add('jump'); this.jumpCooldown = 6; }
    }
    if (this.stuck > 40) { this.reverse = 12; this.stuck = 0; }
    this.photoCooldown--;
    this.fireCooldown--;
    return this._emit(acts);
  }

  // Where to stand to photograph t: just in front of it, facing it.
  _photoStand(pl, t) {
    const W = 55.68;
    const tcx = t.x + t.w / 2;
    if (tcx >= pl.x + 24) return (t.x - W - 10) - pl.x;  // approach from the left
    return (t.x + t.w + 20) - pl.x;                      // approach from the right
  }

  _killStand(pl, t) {
    const d = t.x + t.w / 2 - (pl.x + 24);
    if (Math.abs(d) > 260) return d - Math.sign(d) * 220;
    return 0;
  }

  // A solid tile directly ahead at body height (from the level JSON, when given).
  _wallAhead(pl, dir) {
    if (!this.level || !dir) return false;
    const cells = this._cells || (this._cells = this._buildCells());
    const probeX = dir > 0 ? pl.x + pl.w + 8 : pl.x - 8;
    const c = Math.floor(probeX / TILE);
    for (let y = pl.y + 10; y < pl.y + pl.h - 5; y += 20) {
      if (cells.has(Math.floor(y / TILE) * 4096 + c)) return true;
    }
    return false;
  }

  _buildCells() {
    const set = new Set();
    for (const [r, c, id] of this.level.tiles) {
      const d = this.level.palette[id];
      if (!d || d.w == null || r >= this.level.rows) continue;
      for (let rr = r; rr < r + Math.ceil(d.h / TILE); rr++) for (let cc = c; cc < c + Math.ceil(d.w / TILE); cc++) set.add(rr * 4096 + cc);
    }
    return set;
  }

  // Presses are edges: an action held last step is released for a step before re-pressing
  // (movement keys may stay held).
  _emit(acts) {
    for (const a of ['jump', 'camera', 'fire']) {
      if (acts.has(a) && this.prevActions.has(a)) acts.delete(a);
    }
    this.prevActions = acts;
    return [...acts];
  }
}

// Runs a bot against the pure game in node (no browser): feeds the chosen actions through the
// same StepInput latch the scene uses, two engine ticks per logic step.
export async function runBotHeadless(level, { PlatformGame, StepInput, maxSteps = 6000, options = {} } = {}) {
  const game = new PlatformGame(level, options);
  game.start();
  const bot = new PlatformBot(level);
  const input = new StepInput();
  let prev = new Set();
  for (let i = 0; i < maxSteps && game.state === 'play'; i++) {
    const snap = { ...game.snapshot(), ui: 'play', ready: true };
    const acts = new Set(bot.decide(snap));
    for (let tick = 0; tick < 2; tick++) {
      const src = {
        isDown: a => acts.has(a),
        pressed: a => tick === 0 && acts.has(a) && !prev.has(a),
        released: a => tick === 0 && !acts.has(a) && prev.has(a),
      };
      input.latch(src);
    }
    prev = acts;
    game.step(input.take());
  }
  return game;
}
