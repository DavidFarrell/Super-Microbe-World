// Game entities of the platform game: the GameEntity base with the generic walk/idle/fall AI,
// and the microbes (GoodMicrobe, LucyLactobacillus, BadMicrobe, SuperInfection).
// Ported from reference/Junior_Game/src/ebug/junior/{GameEntity,Microbe,GoodMicrobe,
// LucyLactobacillus,BadMicrobe,SuperInfection}.as. Pure: no DOM.
//
// Conventions kept from the original so behaviour matches line by line:
// - advance() runs once per logic step while the entity is on screen and returns new events.
// - act(event) reacts to one event and returns follow-up events.
// - thinkTime counts down; when it goes negative the state's "think" function runs.
// - Events are plain objects { type, target, params }.
import { TILE, LEFT, RIGHT, S, E, T, SAFE_TRAVEL_DISTANCE } from './constants.js';
import { clone } from './vec.js';

export const ev = (type, target, params = null) => ({ type, target, params });

// Tolerance for the grid-based ground test. The original relied on y + clip._height landing
// exactly on a multiple of 50 (GameEntity.as:488-497, bug 22); float error could flip the row.
const GROUND_EPSILON = 1e-6;

export class GameEntity {
  constructor(game, particle, clip) {
    this.game = game;
    this.particle = particle;
    this.clip = clip;
    this.state = S.FALL;
    this.type = undefined;
    this.speed = undefined;
    this.counter = 0;
    this.counterCeiling = 3;
    this.direction = RIGHT;
    this.rowHeight = 0;
    this.colWidth = 0;
    this.isOnScreen = false;
    this.thinkTime = 0;
    this.defaultThinkTime = 5;
    this.row = 0;
    this.col = 0;
    this.indexId = -1;
    this.particleArrayId = -1;
    this.particleIsDynamic = false;
    this.removed = false;     // port flag: remove() was called; the entity is inert
    // Render-pass bookkeeping (what the Flash clip's _x/_y/_xscale were at the last render):
    // hitTest and spawn offsets read these, not the live physics position.
    this.rx = particle ? particle.position.x : 0;
    this.ry = particle ? particle.position.y : 0;
    this.flip = false;
  }

  get level() { return this.game.level; }
  geom(r, c) { return this.game.level.geom(r, c); }

  // Art bounding box in world space as positioned by the last render pass (Flash hitTest uses
  // the clips' bounding boxes). Mirrored clips (_xscale -100) flip the art about the
  // registration point, which render placed particle.width to the right.
  artRect() {
    const b = this.artBounds();
    const x0 = this.flip ? this.rx - (b.x + b.w) : this.rx + b.x;
    return { x: x0, y: this.ry + b.y, w: b.w, h: b.h };
  }
  artBounds() {
    const b = this.clip && this.clip.def.bounds;
    return b || { x: 0, y: 0, w: this.particle.width, h: this.particle.height };
  }
  // clip._width as seen by the render off-screen test and spawn code.
  get clipWidth() { return this.artBounds().w; }
  get clipHeight() { return this.artBounds().h; }

  hitTest(other) {
    if (!other || this.removed || other.removed || !this.clip || !other.clip || this.clip.removed || other.clip.removed) return false;
    const a = this.artRect(), b = other.artRect();
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // ---- GameEntity.advance / act (GameEntity.as:117-220): used by entities without overrides
  advance() {
    this.thinkTime--;
    const think = !(this.thinkTime >= 0);
    switch (this.state) {
      case S.WALK: return think ? this.walkThink() : this.walk();
      case S.IDLE: return think ? this.idleThink() : [];
      case S.FALL: return think ? this.fallThink() : this.fall();
      default: return [];
    }
  }

  act() { return []; }

  // GameEntity.as:222-242: microbes walk by teleporting speed px per step.
  walk() {
    const nextCol = this.direction === RIGHT ? this.col + 1 : this.col - 1;
    const colX = this.col * TILE;
    const p = this.particle.position;
    this.particle.teleport(p.x + this.speed * this.direction, p.y);
    const d = this.particle.position.x - colX;
    if ((this.direction === RIGHT && d >= TILE) || (this.direction === LEFT && d < 0)) this.col = nextCol;
    return [];
  }

  // GameEntity.as:244-291
  walkThink() {
    const colX = this.col * TILE;
    const nextCol = this.direction === RIGHT ? this.col + 1 : this.col - 1;
    const nextColX = nextCol * TILE;
    const p = this.particle.position, w = this.particle.width;
    if (this.safeToMove(colX, nextCol)) {
      if (this.direction === RIGHT) {
        this.thinkTime = Math.floor((nextColX - (p.x + w)) / this.speed);
        if (p.x + this.speed + w > colX + TILE) {
          let dangerousToSleep = false;
          for (let i = 0; i < this.rowHeight; i++) if (this.geom(this.row + i, nextCol + 1) !== undefined) dangerousToSleep = true;
          if (!dangerousToSleep) this.thinkTime += Math.floor(TILE / this.speed) - 1;
          this.thinkTime += Math.floor(TILE / this.speed) - 1;
        }
        if (this.thinkTime <= 0) this.thinkTime = 1;
      } else {
        this.thinkTime = Math.floor((p.x - colX) / this.speed);
        // The right-hand edge test is reused for the left branch in the original (line 275).
        if (p.x + this.speed + w > colX + TILE) this.thinkTime += Math.floor(TILE / this.speed) - 1;
        if (this.thinkTime <= 0) this.thinkTime = 1;
      }
      return [];
    }
    return [ev(E.IDLE, this, [this.defaultThinkTime])];
  }

  // GameEntity.as:293-303
  fall() {
    const dy = this.particle.position.y - this.particle.previousPosition.y;
    if (dy < SAFE_TRAVEL_DISTANCE) this.counter--; else this.counter = this.counterCeiling;
    return [];
  }

  // GameEntity.as:305-331
  fallThink() {
    if (!this.onSolidGround()) {
      this.particle.physicsExcempt = false;
      this.thinkTime = this.defaultThinkTime * 2;
      return [];
    }
    this.snapToGrid(false);
    this.counterCeiling = 3;
    return [ev(E.IDLE, this, [this.defaultThinkTime])];
  }

  // The re-snap shared by fallThink/slideThink (equal x -> LEFT) and bePhotographedThink /
  // beHitThink (equal x -> direction unchanged).
  snapToGrid(keepDirectionWhenStill) {
    const p = this.particle.position, prev = this.particle.previousPosition;
    if (p.x > prev.x) this.direction = RIGHT;
    else if (!keepDirectionWhenStill || p.x < prev.x) this.direction = LEFT;
    this.col = Math.floor(p.x / TILE);
    this.row = Math.floor(p.y / TILE);
    this.particle.physicsExcempt = true;
    this.particle.previousPosition = clone(p);
  }

  // GameEntity.as:343-404 (GoodMicrobe and BadMicrobe carry identical copies)
  idleThink() {
    const colX = this.col * TILE;
    if (this.direction === LEFT) {
      if (this.safeToMove(colX, this.col - 1)) return [ev(E.WALK, this, [LEFT])];
      this.direction = RIGHT;
      if (this.safeToMove(colX, this.col + 1)) return [ev(E.WALK, this, [RIGHT])];
      if (!this.onSolidGround()) return [ev(E.FALL, this, [])];
      this.thinkTime = this.defaultThinkTime;
      this.direction = LEFT;
      return [];
    }
    if (this.safeToMove(colX, this.col + 1)) return [ev(E.WALK, this, [RIGHT])];
    this.direction = LEFT;
    if (this.safeToMove(colX, this.col - 1)) return [ev(E.WALK, this, [LEFT])];
    if (!this.onSolidGround()) return [ev(E.FALL, this, [])];
    this.thinkTime = this.defaultThinkTime;
    this.direction = RIGHT;
    return [];
  }

  // GameEntity.as:410-468. Only anchor cells are visible to this test (wide tiles look like voids).
  safeToMove(colX, nextCol) {
    const d = this.particle.position.x - colX;
    let room;
    if (this.direction === RIGHT) room = !(d + this.clipWidth + this.speed > TILE);
    else room = d > this.speed;
    if (room) room = this.onSolidGround();
    if (room) return true;
    for (let i = 0; i < this.rowHeight; i++) if (this.geom(this.row + i, nextCol) !== undefined) return false;
    return this.geom(this.row + this.rowHeight, nextCol) !== undefined;
  }

  // GameEntity.as:472-501
  onSolidGround() {
    const p = this.particle.position;
    if (!this.particle.physicsExcempt) {
      const dy = Math.abs(p.y - this.particle.previousPosition.y);
      if (dy < SAFE_TRAVEL_DISTANCE) {
        if (this.counter <= 0) return true;
        this.counter--;
      } else {
        this.counter = this.counterCeiling;
      }
      return false;
    }
    const h = this.clipHeight;
    const checkCol = Math.floor(p.x / TILE);
    const checkRow = Math.floor((p.y + h) / TILE + GROUND_EPSILON);
    if (this.geom(checkRow, checkCol) === undefined) return false;
    const penetration = this.ry + h - (this.row + this.rowHeight) * TILE; // clip._y is the rendered y
    if (penetration > GROUND_EPSILON) p.y -= penetration;
    return true;
  }

  // GameEntity.as:504-511 (used by the antibiotic explosion)
  kill() {
    this.clip.gotoAndPlay('be_killed');
    this.state = S.BE_KILLED;
    return [];
  }

  remove() {
    this.removed = true;
    this.isOnScreen = false;
    this.state = S.DEFAULT;
    this.defaultThinkTime = 9999999;
    this.thinkTime = this.defaultThinkTime;
    if (this.clip) this.clip.removed = true;
  }
}

// ---------------------------------------------------------------------------------------------
// Microbe (Microbe.as) and the shared Good/Bad microbe machinery
// ---------------------------------------------------------------------------------------------
export class Microbe extends GameEntity {
  constructor(game, row, col, particle, clip) {
    super(game, particle, clip);
    this.hasBeenPhotographed = false;
    this.lives = 1;
    this.row = row;
    this.col = col;
    this.speed = 10;
    this.direction = RIGHT;
    if (particle) { particle.physicsExcempt = true; particle.isDynamic = true; }
    this.slideTimer = this.slideTimerDefault = 10;
    clip.gotoAndPlay('idle');
    this.state = S.FALL;
    this.thinkTime = 0;
    this.colWidth = Math.ceil(this.clipWidth / TILE);
    this.rowHeight = Math.ceil(this.clipHeight / TILE);
  }

  get isGood() { return false; }
  get isBad() { return false; }

  advance() {
    this.thinkTime--;
    const think = !(this.thinkTime >= 0);
    if (!this.isOnScreen) return [];
    switch (this.state) {
      case S.WALK: return think ? this.walkThink() : this.walk();
      case S.IDLE: return think ? this.idleThink() : [];
      case S.FALL: return think ? this.fallThink() : this.fall();
      case S.SLIDE:
        this.slideTimer--;
        return think ? this.slideThink() : this.slide();
      case S.BE_PHOTOGRAPHED:
      case S.BE_HIT:
        return think ? this.afterAnimThink() : [];
      case S.BE_KILLED: return think ? this.beKilledThink() : [];
      default: return this.advanceExtra(think);
    }
  }

  advanceExtra() { return []; }

  // act() cases shared by GoodMicrobe.as:115-212 and BadMicrobe.as:126-244
  act(e) {
    if (!this.isOnScreen) return [];
    this.thinkTime--;
    switch (e.type) {
      case E.THINK:
        this.thinkTime++;
        return this.advance();
      case E.WALK:
        this.state = S.WALK;
        this.direction = e.params[0];
        this.clip.gotoAndPlay('walk');
        this.thinkTime = 0;
        return this.advance();
      case E.IDLE:
        this.state = S.IDLE;
        this.clip.gotoAndPlay('idle');
        this.thinkTime = e.params[0];
        return this.advance();
      case E.FALL:
        this.state = S.FALL;
        this.counterCeiling = 3;
        this.counter = this.counterCeiling;
        this.clip.gotoAndPlay('fall');
        return this.advance();
      case E.COLLIDE:
        return this.collide(e);
      case E.BE_HURT:
        return this.beHurt(e);
      case E.BE_KILLED:
        this.state = S.BE_KILLED;
        return [];
      case E.BE_PHOTOGRAPHED:
        if (!this.hasBeenPhotographed) {
          this.hasBeenPhotographed = true;
          this.state = S.BE_PHOTOGRAPHED;
          this.clip.gotoAndPlay('be_photographed');
          this.thinkTime = this.defaultThinkTime;
          this.particle.physicsExcempt = true;
          return this.advance();
        }
        return [];
      default:
        return this.actExtra(e);
    }
  }

  actExtra() { return []; }

  // States in which a microbe ignores collisions.
  ignoresCollisions() {
    return this.state === S.FALL || this.state === S.SLIDE || this.state === S.BE_PHOTOGRAPHED ||
      this.state === S.BE_HIT || this.state === S.BE_KILLED;
  }

  startSlide(animate) {
    this.state = S.SLIDE;
    if (animate) this.clip.gotoAndPlay('slide');
    this.slideTimer = this.slideTimerDefault;
    this.particle.physicsExcempt = false;
    this.counterCeiling = 10;
    this.counter = this.counterCeiling;
  }

  // GoodMicrobe.as:214-224
  slide() {
    const dy = this.particle.position.y - this.particle.previousPosition.y;
    if (dy < SAFE_TRAVEL_DISTANCE) this.counter--; else this.counter = this.counterCeiling;
    return [];
  }

  // GoodMicrobe.as:226-250
  slideThink() {
    if (this.slideTimer > 0 && !this.onSolidGround()) {
      this.particle.physicsExcempt = false;
      this.thinkTime = this.defaultThinkTime * 2;
      return [];
    }
    this.snapToGrid(false);
    this.counterCeiling = 3;
    return [ev(E.IDLE, this, [1])];
  }

  // bePhotographedThink / beHitThink (GoodMicrobe.as:326-374): identical bodies.
  afterAnimThink() {
    if (this.clip.midAnimation === false) {
      this.snapToGrid(true);
      return [ev(E.FALL, this, [3])];
    }
    return [];
  }

  // GoodMicrobe.as:382-389 / BadMicrobe.as:414-430
  beKilledThink() {
    if (this.clip.midAnimation === false) {
      this.remove();
      return [ev(E.REMOVE, this)];
    }
    return [];
  }
}

// GoodMicrobe.as
export class GoodMicrobe extends Microbe {
  get isGood() { return true; }

  collide(e) {
    if (this.ignoresCollisions()) return [];
    const other = e.params[0];
    const events = [];
    if (other && other.isBad) {
      events.push(ev(E.BE_HURT, this, [1]));
      this.startSlide(false);
    } else {
      this.startSlide(true);
    }
    return events.concat(this.advance());
  }

  beHurt(e) {
    this.lives -= e.params[0];
    this.clip.gotoAndPlay('be_hit');
    this.state = S.BE_HIT;
    if (this.lives <= 0) {
      this.clip.gotoAndPlay('be_killed');
      return [ev(E.BE_KILLED, this)];
    }
    return [];
  }

  // GoodMicrobe.as:391-403: hidden and exempt; the game's REMOVE drops the dynamic body.
  remove() {
    this.particle.physicsExcempt = true;
    this.isOnScreen = false;
    this.removed = true;
    this.clip.visible = false;
  }
}

// LucyLactobacillus.as: a good microbe that dives into milk.
export class LucyLactobacillus extends GoodMicrobe {
  ignoresCollisions() { return super.ignoresCollisions() || this.state === S.DIVE; }

  collide(e) {
    if (this.ignoresCollisions()) return [];
    const other = e.params[0];
    const events = [];
    if (other && other.isBad) {
      events.push(ev(E.BE_HURT, this, [1]));
      this.startSlide(false);
    } else if (other && other.type === T.MILK) {
      this.particle.physicsExcempt = true;
      this.particle.isDynamic = false;
      this.state = S.DIVE;
      this.clip.gotoAndPlay('dive');
    } else {
      this.startSlide(true);
    }
    return events.concat(this.advance());
  }

  advanceExtra(think) {
    if (this.state !== S.DIVE) return [];
    return think ? this.diveThink() : this.dive();
  }

  // LucyLactobacillus.as:208-228
  dive() {
    this.clip.alpha -= 5;
    return [];
  }

  diveThink() {
    const events = [];
    if (this.clip.alpha <= 10) {
      events.push(ev(E.REMOVE, this));
      this.particle.physicsExcempt = true;
      this.isOnScreen = false;
      this.remove();
      this.state = S.IGNORE;
    }
    this.thinkTime = this.defaultThinkTime;
    return events;
  }
}

// BadMicrobe.as
export class BadMicrobe extends Microbe {
  constructor(...args) {
    super(...args);
    this.washAway = false;
  }

  get isBad() { return true; }

  ignoresCollisions() { return super.ignoresCollisions() || this.state === S.BE_WASHED_AWAY; }

  collide(e) {
    if (this.ignoresCollisions()) return [];
    const other = e.params[0];
    const events = [];
    if (other && (other.isGood || other.type === T.PLAYER || other.type === T.BULLET)) {
      this.washAway = other.type === T.BULLET;
      events.push(ev(E.BE_HURT, this, [1]));
      this.startSlide(false);
    } else {
      this.startSlide(true);
    }
    return events.concat(this.advance());
  }

  beHurt(e) {
    this.lives -= e.params[0];
    this.clip.gotoAndPlay('be_hit');
    this.state = S.BE_HIT;
    if (this.lives <= 0 && this.state !== S.BE_KILLED) {
      if (!this.washAway) {
        this.clip.gotoAndPlay('be_killed');
        return [ev(E.BE_KILLED, this)];
      }
      this.clip.gotoAndPlay('be_washed_away');
      return [ev(E.BAD_MICROBE_WASH_AWAY, this)];
    }
    return [];
  }

  actExtra(e) {
    if (e.type === E.BAD_MICROBE_WASH_AWAY) {
      this.particle.physicsExcempt = true;
      this.particle.gravityExcempt = true;
      this.state = S.BE_WASHED_AWAY;
    }
    return [];
  }

  advanceExtra(think) {
    if (this.state !== S.BE_WASHED_AWAY) return [];
    return think ? this.beWashedThink() : this.beWashed();
  }

  // BadMicrobe.as:432-449: rises 15 px and fades 5% per step; checked every 6th step.
  beWashed() {
    this.particle.position.y -= 15;
    this.clip.alpha -= 5;
    return [];
  }

  beWashedThink() {
    const events = [];
    if (this.clip.alpha <= 0) {
      events.push(ev(E.REMOVE, this));
      this.remove();
      events.push(ev(E.BE_KILLED, this));
    }
    this.thinkTime = this.defaultThinkTime;
    return events;
  }

  beKilledThink() {
    if (this.clip.midAnimation === false) {
      this.remove();
      this.state = S.DEFAULT;
      this.thinkTime = 9999999;
      return [ev(E.REMOVE, this)];
    }
    return [];
  }

  // BadMicrobe.as:451-464: also parks the body at (-100, -100).
  remove() {
    this.particle.physicsExcempt = true;
    this.isOnScreen = false;
    this.removed = true;
    this.particle.position.x = -100;
    this.particle.position.y = -100;
    this.clip.visible = false;
  }
}

// SuperInfection.as: a huge floating bad microbe with 6 lives that only antibiotics can hurt.
export class SuperInfection extends BadMicrobe {
  constructor(game, particle, clip) {
    super(game, 0, 0, particle, clip);
    this.particle.physicsExcempt = false;
    this.particle.isDynamic = true;
    this.state = S.IDLE;
    this.thinkTime = 0;
    this.hitTimes = 0;
    this.lives = 6;
    clip.gotoAndPlay('idle_1');
  }

  // Never "thinks" (the think code is commented out, SuperInfection.as:43-47), so its be-hit and
  // be-killed think functions never run and it is never removed.
  advance() {
    this.thinkTime--;
    return [];
  }

  act(e) {
    if (e.type === E.BE_HURT) {
      this.lives--;
      this.clip.lives = this.lives;
      this.hitTimes++;
      if (this.lives > 0) {
        this.clip.gotoAndPlay(this.hitTimes > 3 ? 'be_killed' : 'be_hit_' + this.hitTimes);
        this.state = S.BE_HIT;
      } else if (this.state !== S.BE_KILLED) {
        this.state = S.BE_KILLED;
        this.clip.gotoAndPlay('be_killed');
      }
    } else if (e.type === E.BE_PHOTOGRAPHED) {
      // Port fix (bug 8): the original ignored the photo, so hasBeenPhotographed stayed false and
      // every flash that touched it scored +15 again. It now counts once.
      this.hasBeenPhotographed = true;
    }
    return [];
  }
}
