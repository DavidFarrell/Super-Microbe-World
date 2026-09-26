// The platform game simulation: port of reference/Junior_Game/src/ebug/junior/PlatformGame.as
// (level build, UPDATE_WORLD, the event dispatcher and the logic side effects of RENDER_WORLD).
// Pure and deterministic: no DOM, no clock, no Math.random. One call to step() is one original
// UPDATE plus the following RENDER pass (about 30 ms of game time).
//
// Reference: reference/analysis/flash-platformer.md (section numbers are cited as "section N").
import {
  TILE, STAGE_W, STEP_MS, FRAME_MS, LEVEL_TIME_STEPS, GRAVITY_Y, DRAG, DELTA_T_MS, WORLD_MIN_Y,
  WORLD_MAX_Y, PLAYER_BOX, BULLET_BOX, SHOOT_POINT, LEFT, RIGHT, T, S, E, END, POINTS,
  GOOD_MICROBE_TYPES, BAD_MICROBE_TYPES,
} from './constants.js';
import { round1 } from './vec.js';
import { ParticleSystem } from './physics.js';
import { Clip } from './timeline.js';
import { Level } from './level.js';
import { Goal } from './goal.js';
import { Camera } from './camera.js';
import { ev, GoodMicrobe, LucyLactobacillus, BadMicrobe, SuperInfection } from './entities.js';
import { PlayerEntity, AvatarClip, PLAYER_STATE } from './player.js';
import {
  BulletEntity, CameraFlashEntity, AmmoPickup, AntibioticPickup, MilkGlassEntity, PortalEntity,
  AntibioticBombEntity, PORTAL,
} from './actors.js';

export const GAME_STATE = Object.freeze({ INTRO: 'intro', PLAY: 'play', COMPLETE: 'complete', GAME_OVER: 'gameover' });

export const DEFAULT_OPTIONS = Object.freeze({
  jumpFeel: true,          // coyote time + jump buffer + no dead press (player.js)
  smoothCamera: true,      // eased camera clamped to the level (camera.js)
  cameraLookAhead: 70,     // px the view leads the player by while riding (camera.js); 0 = off
  physicsFixes: { staticBroadphase: true, skipDeadBodies: true, internalEdges: true },
});

// Microbe types hit by an antibiotic explosion: bacteria only (not Patty, Donna or Iggy).
const ANTIBIOTIC_VICTIMS = [T.LUCY, T.SANDY, T.STEVE, T.SLURM, T.SLARG, T.COLIN];
const ANTIBIOTIC_GOOD = [T.LUCY, T.SANDY, T.STEVE];
// Clip _width at attach time (frame 1) of the projectile clips (spawn offsets, section 3.5).
const SPAWN_CLIP_WIDTH = { soap_projectile: 0, white_projectile: 18, antibiotic_pickup: 38.3, camera_flash: 75 };

export class PlatformGame {
  /**
   * @param {object} levelData  parsed web/data/levels/<name>.json
   * @param {object} [o]
   * @param {'harry'|'amy'} [o.avatar]
   * @param {number} [o.score]   carried over between levels (the original never reset it)
   * @param {object} [o.options] see DEFAULT_OPTIONS
   */
  constructor(levelData, { avatar = 'harry', score = 0, options = {} } = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options, physicsFixes: { ...DEFAULT_OPTIONS.physicsFixes, ...(options.physicsFixes || {}) } };
    this.level = new Level(levelData);
    this.avatar = avatar;
    this.score = score;
    this.startScore = score;
    this.events = [];          // PlatformGame.entityEvents (FIFO, persists between steps)
    this.entities = [];        // index 0 is the player; removed dynamic entities become null
    this.fx = [];              // cosmetic notifications for the scene (sounds, particles)
    this.state = GAME_STATE.INTRO;
    this.gameState = null;     // 'complete' | 'gameover' once triggered inside a step
    this.exitReason = null;
    this.stepCount = 0;
    this.timeLeftSteps = LEVEL_TIME_STEPS;
    this.timeUp = false;
    this.frameClock = 0;
    this.antibioticHeld = false;   // HUD icon; reset per level (the original leaked it, bug 17)
    this.goalTicks = 0;            // ePhone tick boxes filled (MODIFY_GOAL_STATUS)
    this.phoneExit = false;        // ePhone shows exit_status once the portal opens
    this.whiteout = 0;             // antibiotic flash, 100 -> 0
    this.portalId = -1;
    this.renderCamX = null;        // camera x of the last render pass (tile solidity)
    this.build();
  }

  get player() { return this.entities[0]; }
  get portal() { return this.entities[this.portalId] || null; }
  get portalOpen() { const p = this.portal; return !!p && p.state === PORTAL.OPEN; }
  get secondsLeft() { return Math.ceil(this.timeLeftSteps * STEP_MS / 1000); }

  // ------------------------------------------------------------------------------------------
  // Level build: LEVEL_LOADED, LOAD_TILES, CREATE_GUI and CREATE_ENTITIES (PlatformGame.as:255-539)
  // ------------------------------------------------------------------------------------------
  build() {
    const L = this.level;
    this.bodyLevel = L.bodyLevel;
    this.ps = new ParticleSystem({
      deltaMs: DELTA_T_MS, iterations: 1, gravity: { x: 0, y: GRAVITY_Y }, drag: DRAG,
      worldMin: { x: 0, y: WORLD_MIN_Y }, worldMax: { x: L.cols * TILE, y: WORLD_MAX_Y },
      emit: c => this.events.push(ev(E.COLLIDE, c.target, [c.other, c.change])),
      fixes: this.options.physicsFixes,
    });

    // LOAD_TILES: a static box per geometry anchor cell, sized from the tile's clip, created
    // physics exempt; the render pass makes on-screen tiles solid.
    this.tileBodies = [];
    for (const [row, col, id] of L.solidCells()) {
      const d = L.def(id);
      const idx = this.ps.createBox(col * TILE, row * TILE, d.w, d.h, { dynamic: false });
      if (idx === null) continue; // no linkage in the SWF: no clip, no body
      const body = this.ps.staticEntities[idx];
      body.physicsExcempt = true;
      body.tile = { row, col, id, movie: d.movie };
      this.tileBodies.push(body);
    }

    // CREATE_GUI: goals (Goal objects; the list is popped when the portal opens, so keep a view).
    this.goals = L.goals.map(g => new Goal(g.goalType, g.microbeType, g.required));
    this.goalsView = [...this.goals];

    // CREATE_ENTITIES: the player first, then entity cells in row-major order.
    const start = L.playerStart || { row: 0, col: 0 };
    const px = start.col * TILE, py = start.row * TILE;
    const avatar = new AvatarClip(this.avatar);
    // ClipLoader.as:17 plays the upper body's 'hurt' flourish on load (behind the ePhone intro);
    // its last frame goes to 'move', so play starts with the upper body looping 'move'. The port
    // starts there directly (the intro does not advance the simulation's clips).
    avatar.upper.gotoAndPlay('move');
    const pIdx = this.ps.createBox(px, py, PLAYER_BOX.w, PLAYER_BOX.h, { dynamic: true, force: { x: 0, y: 0 } });
    const pBody = this.ps.dynamicEntities[pIdx];
    const player = new PlayerEntity(this, pBody, avatar);
    pBody.theParent = player;
    player.isOnScreen = true;
    pBody.physicsExcempt = false;
    player.particleArrayId = pIdx;
    player.particleIsDynamic = true;
    player.speed = GRAVITY_Y * 1.5;    // 4500
    player.jumpForce = GRAVITY_Y * 8;  // 24000
    player.indexId = 0;
    this.entities.push(player);

    for (const [row, col, id] of L.entityCells) this.createEntity(row, col, L.def(id));

    this.camera = new Camera({ levelWidth: L.width, smooth: this.options.smoothCamera, lookAhead: this.options.smoothCamera ? this.options.cameraLookAhead : 0 });
    this.camera.snap(px, px + PLAYER_BOX.w);
  }

  createEntity(row, col, d) {
    const ps = this.ps;
    // A missing linkage (colin_icon, super_slarg_icon) or an unhandled type (entrance portal)
    // made the original push a stale or body-less entity (bug 15). The port skips it.
    if (d.w == null || d.h == null) return null;
    const x = col * TILE, y = row * TILE;
    const clip = new Clip(d.movie);
    let ent = null;
    if (GOOD_MICROBE_TYPES.includes(d.type) || d.type === T.LUCY || BAD_MICROBE_TYPES.includes(d.type)) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: true });
      const body = ps.dynamicEntities[idx];
      body.physicsExcempt = true;
      const Cls = d.type === T.LUCY ? LucyLactobacillus : BAD_MICROBE_TYPES.includes(d.type) ? BadMicrobe : GoodMicrobe;
      ent = new Cls(this, row, col, body, clip);
      ent.particleArrayId = idx;
      ent.particleIsDynamic = true;
    } else if (d.type === T.AMMO_PICKUP) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: false, gravityExcempt: true, maxChangeExcempt: true });
      const body = ps.staticEntities[idx];
      body.physicsExcempt = true;
      ent = new AmmoPickup(this, body, clip, this.bodyLevel);
      ent.particleArrayId = idx;
      ps.exempt(0, idx, false);
    } else if (d.type === T.MILK) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: true, gravityExcempt: true, maxChangeExcempt: true });
      const body = ps.dynamicEntities[idx];
      ent = new MilkGlassEntity(this, body, clip);
      ent.particleArrayId = idx;
      ent.particleIsDynamic = true;
    } else if (d.type === T.PORTAL_EXIT) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: false, gravityExcempt: true, maxChangeExcempt: true });
      const body = ps.staticEntities[idx];
      ent = new PortalEntity(this, body, clip);
      ent.particleArrayId = idx;
      this.portalId = this.entities.length;
      ps.exempt(0, idx, false);
    } else if (d.type === T.ANTIBIOTIC_PICKUP) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: false, gravityExcempt: true, maxChangeExcempt: true });
      const body = ps.staticEntities[idx];
      ent = new AntibioticPickup(this, body, clip);
      ent.particleArrayId = idx;
      ps.exempt(0, idx, false);
    } else if (d.type === T.SUPERINFECTION) {
      const idx = ps.createBox(x, y, d.w, d.h, { dynamic: true, gravityExcempt: true, maxChangeExcempt: true });
      const body = ps.dynamicEntities[idx];
      ent = new SuperInfection(this, body, clip);
      ent.particleArrayId = idx;
      ent.particleIsDynamic = true;
    } else {
      return null;
    }
    ent.type = d.type;
    ent.symbol = d.movie;
    ent.particle.theParent = ent;
    ent.isOnScreen = true;   // everything is "on screen" until the first render pass
    ent.indexId = this.entities.length;
    this.entities.push(ent);
    return ent;
  }

  // Ends the ePhone intro (STATE_INIT_DIALOGUE -> UPDATE_WORLD).
  start() {
    if (this.state === GAME_STATE.INTRO) this.state = GAME_STATE.PLAY;
  }

  // ------------------------------------------------------------------------------------------
  // One logic step: UPDATE_WORLD then the RENDER_WORLD bookkeeping.
  // input: { left, right, jumpHeld, jumpPressed, jumpReleased, firePressed, cameraPressed }
  // ------------------------------------------------------------------------------------------
  step(input) {
    if (this.state !== GAME_STATE.PLAY) return;
    this.fx = [];
    this.stepCount++;
    this.whiteout = Math.max(0, this.whiteout - 10 * STEP_MS / FRAME_MS);

    // Flash timelines advance at 25 fps on a global clock (3 frames every 4 steps).
    const before = Math.floor(this.frameClock / FRAME_MS);
    this.frameClock += STEP_MS;
    const frames = Math.floor(this.frameClock / FRAME_MS) - before;
    for (let f = 0; f < frames; f++) {
      for (const e of this.entities) if (e && e.clip && !e.clip.removed) e.clip.tick();
    }

    if (input) this.player.input = input;
    this.update();
    this.renderPass();

    if (this.gameState === 'complete') { this.state = GAME_STATE.COMPLETE; this.exitReason = END.COMPLETE; this.fx.push({ type: 'levelComplete' }); }
    else if (this.gameState === 'gameover') { this.state = GAME_STATE.GAME_OVER; this.fx.push({ type: 'gameOver', reason: this.exitReason }); }
  }

  // UPDATE_WORLD (PlatformGame.as:553-1059, section 1.5)
  update() {
    const player = this.player;
    // 1. Level timer: 6000 steps = 180 s. Replaces the wall-clock getTimer() countdown.
    if (this.timeLeftSteps > 0) {
      this.timeLeftSteps--;
      if (this.timeLeftSteps === 0 && !this.timeUp) {
        this.timeUp = true;
        this.events.push(ev(E.TRIGGER_GAME_END, null));
        this.exitReason = END.TIME;
      }
    }
    // 2. Goals: when all are met and the portal is closed, pop the goal and open the portal.
    const allMet = this.goals.every(g => g.isGoalMet());
    const portal = this.portal;
    if (allMet && portal && portal.state === PORTAL.CLOSED) {
      this.goals.pop();
      this.phoneExit = true;
      this.events.push(ev(E.PORTAL_OPEN, portal));
      this.fx.push({ type: 'portalOpen', x: portal.particle.position.x, y: portal.particle.position.y });
    }
    // 3. Death check.
    if (player.lives <= 0 && this.exitReason !== END.DIE) {
      this.events.push(ev(E.TRIGGER_GAME_END, null));
      this.exitReason = END.DIE;
    }
    // 5. Scroll (decided from the previous step's movement, as in the original).
    const pp = player.particle;
    this.camera.update(pp.position.x, pp.position.x + pp.width, pp.position.x - pp.previousPosition.x);

    // 7. Advance every on-screen entity in index order (the player is index 0). A thrown
    // antibiotic also advances off screen, so its fuse always runs out (NOTES 11.9 #7; the
    // original froze it off screen and the level could become unwinnable).
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e && (e.isOnScreen === true || (e.advancesOffScreen && !e.removed))) {
        const out = e.advance();
        if (out && out.length) for (const x of out) if (x) this.events.push(x);
      }
    }
    // 8. Event loop (FIFO; handlers may also push onto this.events directly).
    let guard = 0;
    while (this.events.length && guard++ < 10000) {
      const e = this.events.shift();
      if (!e) continue;
      const out = this.dispatch(e);
      if (out && out.length) for (const x of out) if (x) this.events.push(x);
    }
    // 9. Physics. Collisions queue COLLIDE events for the next step. Tiles are solid only while
    // they overlap the view of the last render pass; that is re-derived here from the camera x it
    // used, which changes nothing in play and lets planners' copies share the tile bodies.
    this.solidTiles(this.renderCamX);
    this.ps.timeStep();
    // 10. The dirty check's side effect: every entity's x snaps to 0.1 px (section 2.2).
    for (const e of this.entities) if (e && e.particle) e.particle.position.x = round1(e.particle.position.x);
  }

  // The event dispatcher (PlatformGame.as:646-1000, section 1.7).
  dispatch(e) {
    const player = this.player;
    switch (e.type) {
      case E.COLLIDE: {
        const t = e.target, other = e.params[0];
        if (t.type === T.AMMO_PICKUP && other.type === T.PLAYER) {
          const out = t.act(e);
          this.events.push(ev(E.MODIFY_POINTS, null, [POINTS.PICKUP]));
          this.fx.push({ type: 'pickup', x: t.particle.position.x, y: t.particle.position.y, white: t.white });
          return out;
        }
        // "Bullet hits bad microbe: +3" (PlatformGame.as:658-665, doc:1234). The original tested
        // type 5 (GAME_ENTITY_BAD_MICROBE), which no entity is given, so it never paid out; the
        // port awards it (NOTES 11.9 #10). One contact can reach the microbe twice (the physics
        // pair event and the bullet's re-notify), so it is paid once per bullet, and only when the
        // hit lands: an on-screen bad microbe that is not ignoring collisions (the superinfection
        // shrugs bullets off and pays nothing).
        if (t.isBad && other && other.type === T.BULLET && t.type !== T.SUPERINFECTION && !other.bonusPaid &&
            t.isOnScreen && !t.removed && !t.ignoresCollisions()) {
          other.bonusPaid = true;
          this.events.push(ev(E.MODIFY_POINTS, t, [POINTS.BULLET_HIT]));
        }
        return t.act(e);
      }
      case E.CREATE_SOAP_BULLET:
        if (!this.bodyLevel) this.spawnBullet(false);
        else { e.type = E.CREATE_WHITE_BULLET; this.events.push(e); }
        return [];
      case E.CREATE_WHITE_BULLET:
        this.spawnBullet(true);
        return [];
      case E.CREATE_CAMERA_FLASH:
        this.spawnFlash();
        return [];
      case E.PICKUP_ANTIBIOTIC:
        this.antibioticHeld = true;
        player.has_antibiotic = true;
        this.fx.push({ type: 'pickup', antibiotic: true, x: e.target.particle.position.x, y: e.target.particle.position.y });
        return [];
      case E.CREATE_ANTIBIOTIC:
        this.antibioticHeld = false;
        player.has_antibiotic = false;
        this.spawnBomb();
        return [];
      case E.EXPLODE_ANTIBIOTIC:
        return this.explodeAntibiotic(e);
      case E.REMOVE: {
        const t = e.target;
        const index = t.particleArrayId, isDynamic = t.particle.isDynamic, id = t.indexId;
        const out = t.act(e);
        if (t.type === T.CAMERA_FLASH) player.canTakePhotograph = true;
        if (isDynamic) {
          if (t.clip) t.clip.removed = true;
          if (this.entities[id] === t) this.entities[id] = null;
          // The camera flash marks its static body isDynamic, so the original nulled the dynamic
          // body that happened to share its static index. Only null the entity's own body.
          if (this.ps.dynamicEntities[index] === t.particle) this.ps.removeDynamic(index);
        }
        return out;
      }
      case E.MODIFY_POINTS: {
        const n = e.params[0];
        this.score += n;
        const src = e.target && e.target.particle ? e.target.particle.position : player.particle.position;
        this.fx.push({ type: 'points', n, x: src.x, y: src.y });
        return [];
      }
      case E.MODIFY_GOAL_STATUS:
        this.goalTicks++;
        this.fx.push({ type: 'goalTick', n: this.goalTicks });
        return [];
      case E.TRIGGER_LEVEL_END:
        this.gameState = 'complete';
        return [];
      case E.TRIGGER_GAME_END:
        this.gameState = 'gameover';
        return [];
      case E.BE_KILLED: {
        let out = [];
        for (const g of this.goals) out = g.updateGoal(e);   // a later goal overwrites (faithful)
        e.target.act(e);                                     // result discarded (bug 4, faithful)
        const t = e.target;
        out.push(ev(E.MODIFY_POINTS, t, [t.isBad ? POINTS.KILL_BAD : POINTS.KILL_GOOD]));
        this.fx.push({ type: t === player ? 'playerKilled' : 'kill', x: t.particle.position.x, y: t.particle.position.y, bad: !!t.isBad, entity: t });
        return out;
      }
      case E.BE_PHOTOGRAPHED: {
        let out = [];
        for (const g of this.goals) out = g.updateGoal(e);
        e.target.act(e);
        const t = e.target;
        out.push(ev(E.MODIFY_POINTS, t, [t.isGood ? POINTS.PHOTO_GOOD : POINTS.PHOTO_BAD]));
        this.fx.push({ type: 'photographed', x: t.particle.position.x, y: t.particle.position.y, entity: t });
        return out;
      }
      case E.MILK_GLASS_EVENT_TURN_TO_YOGURT: {
        let out = [];
        for (const g of this.goals) out = g.updateGoal(e);
        out.push(ev(E.MODIFY_POINTS, e.target, [POINTS.YOGURT]));
        this.fx.push({ type: 'yogurt', x: e.target.particle.position.x, y: e.target.particle.position.y });
        return out;
      }
      default:
        if (e.type === E.BE_HURT && e.target === player) this.fx.push({ type: 'hurt', x: player.particle.position.x, y: player.particle.position.y });
        else if (e.type === E.BAD_MICROBE_WASH_AWAY) this.fx.push({ type: 'wash', x: e.target.particle.position.x, y: e.target.particle.position.y, entity: e.target });
        return e.target ? e.target.act(e) : [];
    }
  }

  // EXPLODE_ANTIBIOTIC (PlatformGame.as:822-885, section 3.7)
  explodeAntibiotic(e) {
    const victims = [];
    let superRef;
    for (let i = 0; i < this.entities.length; i++) {
      const x = this.entities[i];
      if (!x || x.isOnScreen !== true) continue;
      if (ANTIBIOTIC_VICTIMS.includes(x.type)) victims.push(x);
      else if (x.type === T.SUPERINFECTION) superRef = i;
    }
    let points = 0;
    for (const v of victims) {
      v.kill();
      points += ANTIBIOTIC_GOOD.includes(v.type) ? POINTS.ANTIBIOTIC_GOOD : POINTS.ANTIBIOTIC_BAD;
    }
    const out = [];
    if (superRef !== undefined) {
      points += POINTS.ANTIBIOTIC_SUPER;
      out.push(ev(E.BE_HURT, this.entities[superRef], [1]));
    }
    out.push(ev(E.MODIFY_POINTS, e.target, [points]));
    // The original pushed goalevents.pop() even when it was empty (an undefined event, bug 7).
    for (const g of this.goals) { const ge = g.updateGoal(e); if (ge.length) out.push(ge.pop()); }
    this.whiteout = 100;
    this.fx.push({ type: 'explode', x: e.target.particle.position.x, y: e.target.particle.position.y, victims: victims.length });
    return out;
  }

  // ------------------------------------------------------------------------------------------
  // Spawns (PlatformGame.as:670-821). Positions use the player's clip as last rendered:
  // y = clip._y + SHOOT_POINT, x offset by the avatar's live width (clip._width at the moment the
  // event is handled: both parts at their current frames, exhaust included; AvatarClip.bounds).
  // ------------------------------------------------------------------------------------------
  spawnOrigin(clipWidth) {
    const p = this.player;
    const W = p.clipWidth;
    const px = p.particle.position.x;
    const x = p.direction === RIGHT ? px + W - clipWidth : px - clipWidth;
    return { x, y: p.ry + SHOOT_POINT };
  }

  spawnBullet(white) {
    const p = this.player;
    const symbol = white ? 'white_projectile' : 'soap_projectile';
    const clip = new Clip(symbol);
    const { x, y } = this.spawnOrigin(SPAWN_CLIP_WIDTH[symbol]);
    const force = { x: p.particle.position.x - p.particle.previousPosition.x, y: 0 };
    const idx = this.ps.createBox(x, y, BULLET_BOX.w, BULLET_BOX.h, { dynamic: true, force, maxChangeExcempt: true });
    const body = this.ps.dynamicEntities[idx];
    const b = new BulletEntity(this, body, clip, { speed: 10, white });
    b.symbol = symbol;
    b.particleArrayId = idx;
    b.particleIsDynamic = true;
    b.direction = p.direction;
    b.indexId = this.entities.length;
    this.entities.push(b);
    this.ps.exempt(0, idx, true);
    this.ps.exempt(idx, 0, true);
    this.fx.push({ type: 'throw', white, x, y });
    return b;
  }

  spawnFlash() {
    const p = this.player;
    const clip = new Clip('camera_flash');
    const W = p.clipWidth, px = p.particle.position.x;
    const x = p.direction === RIGHT ? px + W : px - SPAWN_CLIP_WIDTH.camera_flash - 2;
    const y = p.ry + SHOOT_POINT;
    const idx = this.ps.createBox(x, y, 75, 75, { dynamic: false, force: { x: 0, y: 0 }, gravityExcempt: true, maxChangeExcempt: true });
    const body = this.ps.staticEntities[idx];
    // The flash is not a tile: keep it out of the static lookup grid (a flash landing exactly on
    // a cell corner could otherwise shadow a tile's entry).
    for (const [k, v] of this.ps.levelTileArray) if (v === idx) this.ps.levelTileArray.delete(k);
    const f = new CameraFlashEntity(this, body, clip);
    f.symbol = 'camera_flash';
    f.particleArrayId = idx;
    body.physicsExcempt = true;
    f.direction = p.direction;
    f.indexId = this.entities.length;
    this.entities.push(f);
    this.ps.exempt(0, idx, false);
    this.fx.push({ type: 'photo', x: x + (p.direction === RIGHT ? 6 : 69), y: y + 2, dir: p.direction });
    return f;
  }

  spawnBomb() {
    const p = this.player;
    const clip = new Clip('antibiotic_pickup');
    const { x, y } = this.spawnOrigin(SPAWN_CLIP_WIDTH.antibiotic_pickup);
    const idx = this.ps.createBox(x, y, 38.3, 16.3, { dynamic: true, maxChangeExcempt: true });
    const body = this.ps.dynamicEntities[idx];
    const b = new AntibioticBombEntity(this, body, clip);
    b.symbol = 'antibiotic_pickup';
    b.particleArrayId = idx;
    b.particleIsDynamic = true;
    b.direction = p.direction;
    b.indexId = this.entities.length;
    this.entities.push(b);
    this.ps.exempt(0, idx, true);
    this.ps.exempt(idx, 0, true);
    this.fx.push({ type: 'throwAntibiotic', x, y });
    return b;
  }

  // ------------------------------------------------------------------------------------------
  // RENDER_WORLD's logic side effects (PlatformGame.as:1060-1167, section 1.6): only tiles that
  // overlap the visible 800 px band are solid; entities off screen stop advancing and lose
  // physics; on-screen entities in DYNAMIC / FALL / JUMP_MID regain physics. Also records each
  // clip's rendered position and mirroring, which hitTest and spawns read.
  // ------------------------------------------------------------------------------------------
  // Tiles overlapping the view of camera x camX are solid; before the first render pass
  // (camX null) none is, as LOAD_TILES created them all physics exempt.
  solidTiles(camX) {
    for (const t of this.tileBodies) {
      const sx = t.position.x - camX;
      t.physicsExcempt = camX == null || !(sx <= STAGE_W && sx + t.width > 0);
    }
  }

  renderPass() {
    const camX = this.camera.x;
    this.renderCamX = camX;
    this.solidTiles(camX);
    for (const e of this.entities) {
      if (!e) continue;
      // Box positions at this and the previous render, for drawing interpolation only.
      e.pbx = e.bx ?? e.particle.position.x;
      e.pby = e.by ?? e.particle.position.y;
      e.bx = e.particle.position.x;
      e.by = e.particle.position.y;
      let mirror = 0;
      if (e.direction === RIGHT) e.flip = false;
      else if (e.direction === LEFT) { mirror = e.particle.width; e.flip = true; }
      e.rx = e.particle.position.x + mirror;
      e.ry = e.particle.position.y;
      const sx = e.rx - camX;
      const w = e.symbol === 'soap_projectile' ? BULLET_BOX.w : e.clipWidth;
      if (sx > STAGE_W || sx + w <= 0) {
        e.isOnScreen = false;
        e.particle.physicsExcempt = true;
      } else if (!e.removed) {
        e.isOnScreen = true;
        if (e.state === S.DYNAMIC || e.state === S.FALL || e.state === S.JUMP_MID) e.particle.physicsExcempt = false;
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // A deep copy of the whole simulation, for planners (the level bots look ahead on copies).
  // Immutable data is shared: the level, the options and the Flash timeline definitions. The
  // physics system's collision callback is re-bound to the copy's own event queue. Stepping the
  // copy never touches the original (unit test: identical inputs give identical snapshots).
  // ------------------------------------------------------------------------------------------
  clone() {
    // Tile bodies never change except their solidity, which step() re-derives from renderCamX.
    const shared = new Set([this.level, this.options, this.tileBodies, ...this.tileBodies]);
    const seen = new Map();
    const rec = v => {
      if (v === null || typeof v !== 'object') return v;
      if (shared.has(v) || Object.isFrozen(v)) return v;
      let out = seen.get(v);
      if (out) return out;
      if (Array.isArray(v)) {
        out = new Array(v.length);
        seen.set(v, out);
        for (let i = 0; i < v.length; i++) out[i] = rec(v[i]);
        return out;
      }
      if (v instanceof Map) { out = new Map(); seen.set(v, out); for (const [k, x] of v) out.set(k, rec(x)); return out; }
      if (v instanceof Set) { out = new Set(); seen.set(v, out); for (const x of v) out.add(rec(x)); return out; }
      out = Object.create(Object.getPrototypeOf(v));
      seen.set(v, out);
      for (const k of Object.keys(v)) {
        const x = v[k];
        // Timeline definitions and their label tables are shared, read-only data.
        out[k] = (k === 'def' || k === '_labelFrames') ? x : rec(x);
      }
      return out;
    };
    const copy = rec(this);
    copy.ps.emit = c => copy.events.push(ev(E.COLLIDE, c.target, [c.other, c.change]));
    return copy;
  }

  // ------------------------------------------------------------------------------------------
  // Read-only views for the HUD, renderer and test hooks.
  // ------------------------------------------------------------------------------------------
  snapshot() {
    const p = this.player, pb = p.particle;
    return {
      level: this.level.name,
      state: this.state,
      stepCount: this.stepCount,
      timeLeftSteps: this.timeLeftSteps,
      secondsLeft: this.secondsLeft,
      score: this.score,
      lives: p.lives,
      goals: this.goalsView.map(g => ({ type: g.goalType, microbeType: g.microbeType, required: g.required, achieved: g.achieved })),
      portalOpen: this.portalOpen,
      exitReason: this.exitReason,
      camera: { x: this.camera.x },
      player: {
        x: pb.position.x, y: pb.position.y, w: pb.width, h: pb.height,
        vx: round3(pb.position.x - pb.previousPosition.x), vy: round3(pb.position.y - pb.previousPosition.y),
        clipW: p.clipWidth, onGround: !!pb.supported, facing: p.direction === LEFT ? 'left' : 'right', ammo: p.ammo,
        jumpsLeft: p.jumpsLeft, hurt: p.state === PLAYER_STATE.BE_HURT, canPhoto: p.canTakePhotograph,
        hasAntibiotic: p.has_antibiotic,
      },
      entities: this.entities.map((e, id) => e && id > 0 ? {
        id, type: typeName(e.type), typeId: e.type, symbol: e.symbol, state: e.state,
        x: e.particle.position.x, y: e.particle.position.y, w: e.particle.width, h: e.particle.height,
        art: e.artRect(),
        alive: !e.removed && e.state !== S.BE_KILLED && e.state !== S.IGNORE, onScreen: !!e.isOnScreen,
        photographed: e.hasBeenPhotographed === true,
      } : null).filter(Boolean),
    };
  }
}

const round3 = v => Math.round(v * 1000) / 1000;
const TYPE_NAMES = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k.toLowerCase()]));
const typeName = t => TYPE_NAMES[t] || String(t);

// Convenience for tests and tools: a game that has already left its intro.
export function createGame(levelData, opts) {
  const g = new PlatformGame(levelData, opts);
  g.start();
  return g;
}

export { PLAYER_STATE };
