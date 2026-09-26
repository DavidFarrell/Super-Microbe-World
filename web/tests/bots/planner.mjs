// A planning level bot for the platform game. It plays through real inputs only: every decision
// is a set of actions ('left', 'right', 'jump', 'fire', 'camera') to hold for the next logic
// step, which the E2E tests and the trace recorder turn into injected input (__test.hold) or
// on-screen taps. It never touches the running game.
//
// How it plans: the bot keeps a shadow copy of the simulation (the pure PlatformGame built from
// the same level JSON), fed with exactly the inputs it sends, and checks each step that the
// shadow still agrees with the page's probe. To choose what to do it copies the shadow
// (PlatformGame.clone()) and tries a menu of short input plans (ride left / right / stay, switch
// direction part way, jump or double jump at a few moments) for about a second of game time,
// scoring where each plan ends on a navigation field: an estimate of the travel cost to a goal
// region that respects gravity (anywhere is reachable by falling, but you can only climb or
// cross a gap within a double jump of the ground below). The camera and the throw are pressed
// only when a look-ahead shows the shot counts. Per goal type, a mission (photograph, wash away,
// push Lucy into the milk, set off antibiotics, enter the portal) picks the goal region.
//
// Deterministic: no randomness, no clocks. A decision depends only on the probe's stepCount and
// the shadow, and the same action set is returned until the page's step count moves on, so a
// run in the browser (where hit-stop holds some steps back) feeds the game exactly the same
// per-step input as a headless run.
import { PlatformGame } from '../../js/platformer/game.js';
import { StepInput } from '../../js/platformer/controls.js';
import { T, S, G, TILE } from '../../js/platformer/constants.js';

const Q = 10;                    // navigation grid resolution (px)
const H = 36;                    // look-ahead horizon (logic steps, about 1.1 s)
const REPLAN = 3;                // steps between full re-plans
const TOP = -100, BOTTOM = 350;  // player top-left y range (world bounds)
const PW = 49, PH = 100;         // player box
const JUMP_H = 185;              // how high above the ground below the player can get (double jump)
const GOOD = [T.GOOD_MICROBE, T.GENERIC, T.SANDY, T.STEVE, T.PATTY, T.LUCY];
const BAD = [T.BAD_MICROBE, T.COLIN, T.DONNA, T.IGGY, T.SLARG, T.SLURM];
const GONE_STATES = [S.BE_KILLED, S.IGNORE, S.BE_WASHED_AWAY, S.DIVE];

const NONE = Object.freeze(new Set());

export const alive = e => !!e && !e.removed && !GONE_STATES.includes(e.state) && (!e.clip || e.clip.visible !== false);

// The per-step input snapshot the scene's StepInput produces when the held set changes only at
// step boundaries (the bot never holds a press for two steps, so auto-repeat never applies).
export function stepSnapshot(acts, prev) {
  return {
    left: acts.has('left'), right: acts.has('right'),
    jumpHeld: acts.has('jump'), jumpPressed: acts.has('jump') && !prev.has('jump'),
    jumpReleased: !acts.has('jump') && prev.has('jump'),
    firePressed: acts.has('fire') && !prev.has('fire'), cameraPressed: acts.has('camera') && !prev.has('camera'),
  };
}

// Drops a press that was already held on the previous step (presses are edges).
function edges(acts, prev) {
  let out = acts;
  for (const a of ['jump', 'fire', 'camera']) if (out.has(a) && prev.has(a)) { if (out === acts) out = new Set(acts); out.delete(a); }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Navigation grid: free player positions (top-left, 10 px grid), height above the ground below,
// and distance fields to goal regions.
// ---------------------------------------------------------------------------------------------
export class NavGrid {
  constructor(level) {
    this.width = level.cols * TILE;
    this.boxes = [];
    for (const [r, c, id] of level.tiles) {
      const d = level.palette[id];
      if (!d || d.w == null || r < 0 || r >= Math.min(level.rows, 9) || c < 0 || c > level.cols) continue;
      this.boxes.push([c * TILE, r * TILE, c * TILE + d.w, r * TILE + d.h]);
    }
    this.nx = Math.floor((this.width - PW) / Q) + 1;
    this.ny = Math.floor((BOTTOM - TOP) / Q) + 1;
    const n = this.nx * this.ny;
    this.free = new Uint8Array(n);
    this.hag = new Float32Array(n);   // px from the player's feet down to the first support
    for (let i = 0; i < this.nx; i++) {
      const x = i * Q;
      for (let j = 0; j < this.ny; j++) {
        const y = TOP + j * Q;
        const k = j * this.nx + i;
        this.free[k] = this.boxHits(x + 1, y + 1, x + PW - 1, y + PH - 1) ? 0 : 1;
        this.hag[k] = this.groundBelow(x, y + PH) - (y + PH);
      }
    }
    this.cache = new Map();
  }

  boxHits(x0, y0, x1, y1) {
    for (const b of this.boxes) if (b[0] < x1 && x0 < b[2] && b[1] < y1 && y0 < b[3]) return true;
    return false;
  }

  // The highest support top at or below feet y under the player's span [x, x + 49].
  groundBelow(x, feet) {
    let best = 450;
    for (const b of this.boxes) if (b[0] < x + PW - 1 && x + 1 < b[2] && b[1] >= feet - 0.01 && b[1] < best) best = b[1];
    return best;
  }

  cell(x, y) {
    const i = Math.max(0, Math.min(this.nx - 1, Math.round(x / Q)));
    const j = Math.max(0, Math.min(this.ny - 1, Math.round((y - TOP) / Q)));
    return j * this.nx + i;
  }

  // Travel-cost field to the region (pred(x, y) true for player top-left positions), Dijkstra
  // on 8 neighbours over reversed moves. A move from cell a to cell b is allowed when it goes
  // down (falling), or sideways / up while b stays within a double jump of the ground below.
  field(key, pred) {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const nx = this.nx, n = nx * this.ny;
    const dist = new Float32Array(n).fill(Infinity);
    const heap = new MinHeap();
    for (let k = 0; k < n; k++) {
      if (!this.free[k]) continue;
      const i = k % nx, j = (k - i) / nx;
      if (pred(i * Q, TOP + j * Q)) { dist[k] = 0; heap.push(0, k); }
    }
    while (heap.size) {
      const [d, k] = heap.pop();
      if (d > dist[k]) continue;
      const i = k % nx, j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= this.ny) continue;
        const kk = jj * nx + ii;
        if (!this.free[kk]) continue;
        // The move is kk -> k. dj > 0: kk is below k (a climb); dj < 0: a fall; 0: sideways.
        let c;
        if (dj < 0) c = di ? 1.1 * Q : 0.5 * Q;
        else if (this.hag[k] > JUMP_H) continue;
        else if (dj > 0) c = di ? 1.9 * Q : 1.6 * Q;
        else c = Q;
        const nd = d + c;
        if (nd < dist[kk]) { dist[kk] = nd; heap.push(nd, kk); }
      }
    }
    if (this.cache.size > 600) this.cache.clear();
    this.cache.set(key, dist);
    return dist;
  }

  at(dist, x, y) { return dist[this.cell(x, y)]; }
}

class MinHeap {
  constructor() { this.p = []; this.v = []; }
  get size() { return this.p.length; }
  push(p, v) {
    const P = this.p, V = this.v;
    P.push(p); V.push(v);
    let i = P.length - 1;
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (P[pi] <= P[i]) break;
      [P[pi], P[i]] = [P[i], P[pi]]; [V[pi], V[i]] = [V[i], V[pi]]; i = pi;
    }
  }
  pop() {
    const P = this.p, V = this.v;
    const top = [P[0], V[0]];
    const lp = P.pop(), lv = V.pop();
    if (P.length) {
      P[0] = lp; V[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < P.length && P[l] < P[m]) m = l;
        if (r < P.length && P[r] < P[m]) m = r;
        if (m === i) break;
        [P[m], P[i]] = [P[i], P[m]]; [V[m], V[i]] = [V[i], V[m]]; i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------------------------
// The plan menu: phases of [direction, steps] (the last phase lasts to the horizon), each with a
// few jump timings. "Ride k steps, brake 7 steps, coast" stops the board about where it is (a
// full-speed board needs about 7 steps of braking).
// ---------------------------------------------------------------------------------------------
const J_RIDE = [[], [0], [0, 8], [4], [4, 12], [0, 12]];
const MENU = [
  [[['right']], J_RIDE],
  [[['left']], J_RIDE],
  [[[null]], [[], [0], [0, 8]]],
  [[['right', 3], [null]], [[]]],
  [[['left', 3], [null]], [[]]],
  [[[null, 8], ['right']], [[], [8]]],
  [[[null, 8], ['left']], [[], [8]]],
];
for (const k of [4, 8, 12, 16, 20]) {
  MENU.push([[['right', k], ['left', 7], [null]], [[], [0]]]);
  MENU.push([[['left', k], ['right', 7], [null]], [[], [0]]]);
}

function makePlan(phases, jumps) {
  const plan = [];
  let p = 0, left = phases[0][1] ?? Infinity;
  for (let i = 0; i < H; i++) {
    while (left <= 0 && p < phases.length - 1) { p++; left = phases[p][1] ?? Infinity; }
    const d = phases[p][0];
    const s = new Set();
    if (d) s.add(d);
    if (jumps.includes(i)) s.add('jump');
    plan.push(s);
    left--;
  }
  return plan;
}
const BASE_PLANS = [];
for (const [d, js] of MENU) for (const j of js) BASE_PLANS.push(makePlan(d, j));

// ---------------------------------------------------------------------------------------------
// The bot
// ---------------------------------------------------------------------------------------------
export class PlannerBot {
  /**
   * @param {object} level      level JSON (web/data/levels/<name>.json)
   * @param {object} [o]
   * @param {string} [o.avatar] 'harry' | 'amy' (must match the page)
   * @param {number} [o.score]  starting score (must match the page)
   * @param {(msg: string) => void} [o.log]
   */
  constructor(level, { avatar = 'harry', score = 0, log = null } = {}) {
    this.level = level;
    this.nav = new NavGrid(level);
    this.shadow = new PlatformGame(level, { avatar, score });
    this.shadow.start();
    this.input = new StepInput();
    this.prev = NONE;
    this.lastStep = -1;
    this.lastActs = NONE;
    this.plan = [];
    this.planKey = null;
    this.sincePlan = 0;
    this.log = log;
    this.targetId = null;
    this.targetSteps = 0;
    this.desync = null;
    this.searches = 0;
    this.currentTask = null;
    this.lastScore = null;
    this.committed = 0;
    this.deepTries = 0;
    this.watchKey = null;
    this.watchBest = Infinity;
    this.watchSince = 0;
  }

  // One decision per logic step. Repeated calls without a new step return the same set.
  decide(p) {
    if (!p || !p.ready || p.state !== 'play' || (p.ui && p.ui !== 'play')) return [];
    if (p.stepCount === this.lastStep) return [...this.lastActs];
    const sp = this.shadow.player.particle.position;
    if (!this.desync && (p.stepCount !== this.shadow.stepCount || p.player.x !== sp.x || p.player.y !== sp.y || p.score !== this.shadow.score)) {
      this.desync = `step ${p.stepCount}: page (${p.player.x}, ${p.player.y}, score ${p.score}) vs shadow step ${this.shadow.stepCount} (${sp.x}, ${sp.y}, score ${this.shadow.score})`;
    }
    const acts = edges(this.choose(), this.prev);
    this.lastStep = p.stepCount;
    this.lastActs = acts;
    this.advanceShadow(acts);
    return [...acts];
  }

  // Feeds the shadow exactly what the scene's StepInput makes of this held set.
  advanceShadow(acts) {
    const prev = this.prev;
    for (let tick = 0; tick < 2; tick++) {
      this.input.latch({
        isDown: a => acts.has(a),
        pressed: a => tick === 0 && acts.has(a) && !prev.has(a),
        released: a => tick === 0 && !acts.has(a) && prev.has(a),
      });
    }
    this.shadow.step(this.input.take());
    this.prev = acts;
  }

  choose() {
    const g = this.shadow;
    const task = this.task(g);
    this.currentTask = task;
    // Progress watch: when the task's distance has not improved for a while, look further ahead.
    const pl = g.player.particle.position;
    const d = task.dist(g, pl.x, pl.y);
    if (task.key !== this.watchKey || d < this.watchBest - 5) { this.watchKey = task.key; this.watchBest = d; this.watchSince = g.stepCount; }
    if (task.shoot) {
      const shot = this.tryShot(g, task);
      if (shot) { this.plan = []; this.committed = 0; return shot; }
    }
    const clear = this.clearTheWay(g, task);
    if (clear) { this.plan = []; this.committed = 0; return clear; }
    if (this.committed > 0 && this.plan.length && task.key === this.planKey) {
      this.committed--;
      return this.plan.shift();
    }
    if (g.stepCount - this.watchSince > 45 && this.deepTries < 40) {
      this.deepTries++;
      const path = this.deepSearch(g, task);
      this.watchSince = g.stepCount;
      if (path && path.length) {
        this.plan = path.slice(1);
        this.planKey = task.key;
        this.committed = path.length - 1;
        return path[0];
      }
    }
    if (this.plan.length && this.sincePlan < REPLAN && task.key === this.planKey) {
      this.sincePlan++;
      return this.plan.shift();
    }
    const best = this.search(g, task);
    this.plan = best.slice(1);
    this.planKey = task.key;
    this.sincePlan = 1;
    return best[0];
  }

  // A wider look-ahead for when the plan menu makes no progress: a beam search over 6-step
  // moves (ride / stop / jump in each direction, for up to 72 steps), keeping the 36 best
  // distinct states per depth. Returns the input sequence to the best state found (success
  // first), which the shadow guarantees plays out exactly.
  deepSearch(g, task) {
    const M = 6, DEPTH = 12, BEAM = 36;
    const MOVES = [['right'], ['left'], [], ['right', 'jump'], ['left', 'jump'], ['jump'], ['right', 'jump3'], ['left', 'jump3']];
    const base = this.baseline(g);
    const lives0 = g.player.lives;
    const pl0 = g.player.particle.position;
    let best = { score: task.dist(g, pl0.x, pl0.y), path: [] };
    let beam = [{ game: g, prev: this.prev, path: [] }];
    for (let depth = 0; depth < DEPTH && beam.length; depth++) {
      const next = new Map();
      for (const node of beam) {
        for (const mv of MOVES) {
          const c = node.game.clone();
          let prev = node.prev;
          const path = node.path.slice();
          let dead = false, won = false;
          for (let i = 0; i < M && c.state === 'play'; i++) {
            const a = new Set(mv.filter(x => x !== 'jump' && x !== 'jump3'));
            if ((mv.includes('jump') && i === 0) || (mv.includes('jump3') && i === 3)) a.add('jump');
            const acts = edges(a, prev);
            c.step(stepSnapshot(acts, prev));
            prev = acts;
            path.push(acts);
            if (c.player.lives < lives0) { dead = true; break; }
            if ((task.success && task.success(c, base)) || c.state === 'complete') { won = true; break; }
          }
          if (dead) continue;
          if (won) { this.log && this.log(`deep search: success in ${path.length} steps`); return path; }
          const p = c.player.particle.position;
          const score = task.dist(c, p.x, p.y) + (task.penalty ? task.penalty(c, base) : 0);
          if (!isFinite(score)) continue;
          if (score < best.score - 1e-6) best = { score, path };
          const vx = p.x - c.player.particle.previousPosition.x, vy = p.y - c.player.particle.previousPosition.y;
          const key = `${Math.round(p.x / 12)},${Math.round(p.y / 12)},${Math.round(vx / 4)},${Math.round(vy / 6)},${c.player.jumpsLeft},${c.player.direction}`;
          const old = next.get(key);
          if (!old || score < old.score) next.set(key, { game: c, prev, path, score });
        }
      }
      beam = [...next.values()].sort((a, b) => a.score - b.score).slice(0, BEAM);
    }
    this.log && this.log(`deep search: best ${best.score.toFixed(1)} in ${best.path.length} steps`);
    return best.path;
  }

  // Fires at a bad microbe that is in the way (or nearby) when a shot would land, in any task
  // that does not already aim at bad microbes. Harmless to good microbes (they only slide).
  clearTheWay(g, task) {
    if (task.kind === 'kill' || task.kind === 'photo' || task.kind === 'yogurt') return null;
    const p = g.player, pl = p.particle.position;
    const near = g.entities.some(e => e && BAD.includes(e.type) && alive(e) && e.isOnScreen && Math.abs(e.particle.position.x - pl.x) < 420);
    if (!near || this.prev.has('fire')) return null;
    const hits = c => c.entities.filter(e => e && BAD.includes(e.type) && (!alive(e) || e.state === S.BE_HIT || e.washAway)).length;
    const h0 = hits(g);
    const next = this.plan[0] || NONE;
    const dir = [...next].filter(a => a === 'left' || a === 'right');
    const c = g.clone();
    let prev = this.prev;
    const first = new Set([...dir, 'fire']);
    for (let i = 0; i < 22 && c.state === 'play'; i++) {
      const acts = i === 0 ? first : new Set(dir);
      c.step(stepSnapshot(acts, prev));
      prev = acts;
      if (c.player.lives < p.lives) return null;
      if (hits(c) > h0) return first;
    }
    return null;
  }

  // Simulates a plan on a copy of g and scores where it ends (lower is better).
  rollout(g, plan, task, base) {
    const c = g.clone();
    let prev = this.prev;
    const lives0 = g.player.lives;
    for (let i = 0; i < plan.length && c.state === 'play'; i++) {
      const acts = edges(plan[i], prev);
      c.step(stepSnapshot(acts, prev));
      prev = acts;
      if (c.player.lives < lives0) return 1e5 + (plan.length - i);
      if (task.success && task.success(c, base)) return -1e6 + i;
    }
    if (c.state === 'complete') return -1e6 + plan.length;
    const pl = c.player.particle.position;
    let score = task.dist(c, pl.x, pl.y);
    if (!isFinite(score)) score = 5e4;
    if (task.penalty) score += task.penalty(c, base);
    return score;
  }

  search(g, task) {
    this.searches++;
    const base = this.baseline(g);
    let best = null, bestScore = Infinity;
    const plans = this.plan.length ? [this.extend(this.plan), ...BASE_PLANS] : BASE_PLANS;
    for (const plan of plans) {
      const s = this.rollout(g, plan, task, base);
      if (s < bestScore - 1e-9) { bestScore = s; best = plan; }
    }
    this.lastScore = bestScore;
    if (this.log) this.log(`step ${g.stepCount} ${task.key} score ${bestScore.toFixed(1)} at (${g.player.particle.position.x.toFixed(1)}, ${g.player.particle.position.y.toFixed(1)})`);
    return best.map(s => new Set(s));
  }

  extend(plan) {
    const out = plan.map(s => new Set(s));
    while (out.length < H) {
      const l = new Set(out[out.length - 1] || []);
      l.delete('jump'); l.delete('fire'); l.delete('camera');
      out.push(l);
    }
    return out;
  }

  baseline(g) {
    return {
      achieved: g.goalsView[0] ? g.goalsView[0].achieved : 0,
      goodAlive: g.entities.filter(e => e && GOOD.includes(e.type) && alive(e)).length,
      lucyAlive: g.entities.filter(e => e && e.type === T.LUCY && alive(e)).length,
      hasAntibiotic: g.player.has_antibiotic,
    };
  }

  // Presses the camera (a photo, or throwing a carried antibiotic) or fire when a short
  // look-ahead shows it counts. Returns the action set to send, or null.
  tryShot(g, task) {
    const p = g.player;
    const base = this.baseline(g);
    const next = this.plan[0] || NONE;
    const dir = [...next].filter(a => a === 'left' || a === 'right');
    for (const btn of task.shoot) {
      if (this.prev.has(btn)) continue;
      if (btn === 'camera' && !p.canTakePhotograph && !p.has_antibiotic) continue;
      if (task.shotWorth && !task.shotWorth(g)) continue;
      const c = g.clone();
      let prev = this.prev;
      const first = new Set([...dir, btn]);
      for (let i = 0; i < (task.shotSteps || 6) && c.state === 'play'; i++) {
        const acts = i === 0 ? first : new Set(dir);
        c.step(stepSnapshot(acts, prev));
        prev = acts;
        if (c.player.lives < p.lives) break;
        if (task.shotLands(c, base, btn)) return first;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------------------------------
  // Missions
  // ------------------------------------------------------------------------------------------
  task(g) {
    const goal = g.goalsView[0];
    if (g.portalOpen || !goal) return this.portalTask(g);
    switch (goal.goalType) {
      case G.PHOTOGRAPH_SPECIFIC: case G.PHOTOGRAPH_GOOD: case G.PHOTOGRAPH_ANY: return this.photoTask(g, goal);
      case G.KILL_ALL: return this.killTask(g, goal);
      case G.ANTIBIOTIC: return this.antibioticTask(g, goal);
      case G.YOGURT: return this.yogurtTask(g, goal);
      default: return this.portalTask(g);
    }
  }

  portalTask(g) {
    const portal = g.portal;
    const px = portal.particle.position.x, py = portal.particle.position.y;
    // Entry: within 100 px of the portal's top-left (checked every 10 steps) and overlapping it.
    const field = this.nav.field(`portal:${px},${py}`, (x, y) => Math.hypot(x - px, y - py) < 85);
    return {
      key: 'portal', kind: 'portal',
      dist: (c, x, y) => this.nav.at(field, x, y),
      success: c => c.state === 'complete',
    };
  }

  // Picks the target nearest along its field, and keeps it while it stays a target.
  pickTarget(g, list, fieldOf) {
    const pl = g.player.particle.position;
    let cur = list.find(e => e.indexId === this.targetId);
    if (!cur || this.targetSteps > 1500) {
      let best = null, bd = Infinity;
      for (const e of list) {
        if (cur && e === cur && list.length > 1) continue;
        const d = this.nav.at(fieldOf(e), pl.x, pl.y);
        if (!best || d < bd) { bd = d; best = e; }
      }
      if (best !== cur) { this.targetId = best.indexId; this.targetSteps = 0; }
      cur = best;
    }
    this.targetSteps++;
    return cur;
  }

  photoTargets(g, goal) {
    return g.entities.filter(e => {
      if (!alive(e) || !e.clip || e.hasBeenPhotographed) return false;
      if (goal.goalType === G.PHOTOGRAPH_SPECIFIC) return e.type === goal.microbeType;
      if (goal.goalType === G.PHOTOGRAPH_GOOD) return GOOD.includes(e.type);
      return GOOD.includes(e.type) || BAD.includes(e.type) || e.type === T.SUPERINFECTION;
    });
  }

  // Player positions from which a flash (facing either way) overlaps the microbe's art. Flash
  // art relative to the player's top-left: facing right x + W - 31 .. x + W + 44 (W, the avatar's
  // live width, about 56 standing), facing left x - 46 .. x + 29; y - 8 .. y + 67
  // (flash-platformer.md section 3.6). A margin keeps the region inside the real one.
  photoField(e) {
    const a = e.artRect();
    const qx = Math.round(a.x / 20) * 20, qy = Math.round(a.y / 10) * 10;
    const x0 = qx + 8, x1 = qx + a.w - 8, y0 = qy + 6, y1 = qy + a.h - 6;
    return this.nav.field(`photo:${qx},${qy},${a.w},${a.h}`, (x, y) => y - 8 < y1 && y + 67 > y0 && ((x + 25 < x1 && x + 100 > x0) || (x - 46 < x1 && x + 29 > x0)));
  }

  photoTask(g, goal) {
    const list = this.photoTargets(g, goal);
    if (!list.length) return this.portalTask(g);
    const t = this.pickTarget(g, list, e => this.photoField(e));
    const field = this.photoField(t);
    const achieved0 = goal.achieved;
    const facingCost = (c, x) => {
      const tc = t.particle.position.x + t.particle.width / 2, pc = x + PW / 2;
      return (tc > pc) !== (c.player.direction === 1) ? 25 : 0;
    };
    return {
      key: `photo:${t.indexId}`, kind: 'photo', target: t,
      dist: (c, x, y) => { const d = this.nav.at(field, x, y); return d + (d < 60 ? facingCost(c, x) : 0); },
      shoot: ['camera'], shotSteps: 4,
      shotLands: c => c.goalsView[0].achieved > achieved0,
      penalty: (c, base) => (c.entities.filter(e => e && GOOD.includes(e.type) && alive(e)).length < base.goodAlive ? 20000 : 0),
    };
  }

  // Player positions that can wash the microbe away with a shot: the bullet band (y + 27 ..
  // y + 52, PlatformGame.as:689) overlaps its box, 30 to 300 px away, nothing solid between.
  killField(e) {
    const b = e.particle;
    const qx = Math.round(b.position.x / 20) * 20, qy = Math.round(b.position.y / 10) * 10;
    const x0 = qx, x1 = qx + b.width, y0 = qy, y1 = qy + b.height;
    const clear = (xa, xb, y) => !this.nav.boxHits(Math.min(xa, xb), y + 28, Math.max(xa, xb), y + 51);
    const band = y => y + 27 < y1 - 0.3 && y + 52 > y0 + 0.3;
    return this.nav.field(`kill:${qx},${qy},${b.width},${b.height}`, (x, y) => band(y) && (
      (x + PW < x0 - 20 && x0 - (x + PW) < 300 && clear(x + PW, x0, y)) ||
      (x > x1 + 20 && x - x1 < 300 && clear(x1, x, y))));
  }

  killTask(g, goal) {
    const list = g.entities.filter(e => e && BAD.includes(e.type) && alive(e) && e.state !== S.BE_HIT);
    if (!list.length) return this.portalTask(g);
    const t = this.pickTarget(g, list, e => this.killField(e));
    const field = this.killField(t);
    const achieved0 = goal.achieved;
    const hits = c => c.entities.filter(e => e && BAD.includes(e.type) && (!alive(e) || e.state === S.BE_HIT || e.washAway)).length;
    const hits0 = hits(g);
    const facingCost = (c, x) => {
      const tc = t.particle.position.x + t.particle.width / 2, pc = x + PW / 2;
      return (tc > pc) !== (c.player.direction === 1) ? 25 : 0;
    };
    return {
      key: `kill:${t.indexId}`, kind: 'kill', target: t,
      dist: (c, x, y) => { const d = this.nav.at(field, x, y); return d + (d < 60 ? facingCost(c, x) : 0); },
      shoot: ['fire'], shotSteps: 22,
      shotLands: c => hits(c) > hits0 || c.goalsView[0].achieved > achieved0,
      success: c => c.goalsView[0].achieved > achieved0,
    };
  }

  antibioticTask(g) {
    const p = g.player;
    if (p.has_antibiotic) {
      // Throw it straight away: every detonation counts, wherever it happens.
      return {
        key: 'throw', kind: 'throw', dist: () => 0,
        shoot: ['camera'], shotSteps: 2,
        shotLands: c => !c.player.has_antibiotic,
      };
    }
    const list = g.entities.filter(e => e && e.type === T.ANTIBIOTIC_PICKUP && !e.removed);
    if (!list.length) {
      if (g.entities.some(e => e && e.type === T.ANTIBIOTIC_BOMB && !e.removed)) return { key: 'wait', kind: 'wait', dist: (c, x) => Math.abs(x - p.particle.position.x) };
      return this.portalTask(g);
    }
    const fieldOf = e => {
      const a = e.artRect();
      return this.nav.field(`pick:${Math.round(a.x)},${Math.round(a.y)}`, (x, y) => x + 4 < a.x + a.w && x + 52 > a.x && y - 8 < a.y + a.h && y + 96 > a.y);
    };
    const t = this.pickTarget(g, list, fieldOf);
    const field = fieldOf(t);
    return {
      key: `pick:${t.indexId}`, kind: 'pickup',
      dist: (c, x, y) => this.nav.at(field, x, y),
      success: c => c.player.has_antibiotic,
    };
  }

  // Yoghurt: push a Lucy into a glass of milk. A Lucy that touches the milk while walking or
  // standing dives into it without making yoghurt when she comes first in entity order (the
  // original's order dependence, kept); a pushed (sliding) Lucy always counts, so the bot rides
  // up to a Lucy from the side away from a glass and shoves her towards it. The pair is chosen
  // by the travel cost to the pushing spot plus how far she has to go; a pair that has been
  // tried for a long time without success is set aside for a while.
  pushField(lucy, dir) {
    const b = lucy.particle;
    const qx = Math.round(b.position.x / 10) * 10, feet = Math.round((b.position.y + b.height) / 10) * 10;
    return this.nav.field(`push:${qx},${feet},${dir}`, (x, y) => Math.abs(y + PH - feet) <= 25 &&
      (dir > 0 ? x + PW >= qx - 45 && x + PW <= qx + 12 : x >= qx + b.width - 12 && x <= qx + b.width + 45));
  }

  yogurtTask(g, goal) {
    const milks = g.entities.filter(e => e && e.type === T.MILK && e.state === 100);
    const lucys = g.entities.filter(e => e && e.type === T.LUCY && alive(e));
    if (!milks.length || !lucys.length) return this.portalTask(g);
    const pl = g.player.particle.position;
    this.pairTried = this.pairTried || new Map();
    let pick = this.pair && lucys.includes(this.pair.lucy) && milks.includes(this.pair.milk) ? this.pair : null;
    if (pick && g.stepCount - pick.since > 700) { this.pairTried.set(pick.key, g.stepCount); pick = null; }
    if (!pick) {
      let best = null, bd = Infinity;
      for (const l of lucys) for (const m of milks) {
        const key = `${l.indexId}:${m.indexId}`;
        const tried = this.pairTried.get(key);
        const lx = l.particle.position.x + l.particle.width / 2;
        const mx0 = m.particle.position.x, mx1 = mx0 + m.particle.width;
        const dir = lx < mx0 ? 1 : lx > mx1 ? -1 : (lx < (mx0 + mx1) / 2 ? 1 : -1);
        const gap = dir > 0 ? mx0 - lx : lx - mx1;
        const d = this.nav.at(this.pushField(l, dir), pl.x, pl.y) + Math.max(0, gap) * 2 + (tried != null && g.stepCount - tried < 2000 ? 5000 : 0);
        if (d < bd) { bd = d; best = { lucy: l, milk: m, dir, key, since: g.stepCount }; }
      }
      pick = this.pair = best;
    }
    const { lucy, milk, dir } = pick;
    const field = this.pushField(lucy, dir);
    const achieved0 = goal.achieved;
    return {
      key: `yogurt:${pick.key}`, kind: 'yogurt', target: lucy,
      dist: (c, x, y) => {
        const l = c.entities[lucy.indexId], m = c.entities[milk.indexId];
        let d = this.nav.at(field, x, y);
        if (l && m && alive(l)) {
          const lx = l.particle.position.x + l.particle.width / 2;
          const edge = dir > 0 ? m.particle.position.x : m.particle.position.x + m.particle.width;
          d += 0.6 * Math.max(0, dir > 0 ? edge - lx : lx - edge);
        }
        return d + ((c.player.direction === 1) !== (dir > 0) && d < 60 ? 20 : 0);
      },
      success: c => c.goalsView[0].achieved > achieved0,
      penalty: (c, base) => {
        const n = c.entities.filter(e => e && e.type === T.LUCY && alive(e)).length;
        return n < base.lucyAlive ? 30000 : 0;
      },
    };
  }
}

// Runs the planner against the pure game in node, through the page's StepInput path (two engine
// ticks per step). Returns { game, bot }.
export function runPlannerHeadless(level, { maxSteps = 6000, avatar = 'harry', log = null, onStep = null } = {}) {
  const game = new PlatformGame(level, { avatar });
  game.start();
  const bot = new PlannerBot(level, { avatar, log });
  const input = new StepInput();
  let prev = new Set();
  for (let i = 0; i < maxSteps && game.state === 'play'; i++) {
    const p = { ...game.snapshot(), ui: 'play', ready: true };
    const acts = new Set(bot.decide(p));
    if (onStep) onStep(i, p, acts, bot);
    for (let tick = 0; tick < 2; tick++) {
      input.latch({
        isDown: a => acts.has(a),
        pressed: a => tick === 0 && acts.has(a) && !prev.has(a),
        released: a => tick === 0 && !acts.has(a) && prev.has(a),
      });
    }
    prev = acts;
    game.step(input.take());
  }
  return { game, bot };
}
