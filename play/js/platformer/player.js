// The player on the hoverboard: port of reference/Junior_Game/src/ebug/junior/PlayerEntity.as.
// Movement is force based (accelerate / brake), with a double jump, soap or white-blood-cell
// shots, the camera phone and the antibiotic. Upper and lower body animations are separate
// timelines whose midAnimation / shoot flags gate the logic, as in the original.
//
// Input arrives as a per-step snapshot set by the game (see game.js): the original read key
// flags that its Key listener set between updates, and reset them after every update.
import { LEFT, RIGHT, E, T, SAFE_TRAVEL_DISTANCE, MAX_JUMPS, PLAYER_LIVES } from './constants.js';
import { add } from './vec.js';
import { GameEntity, ev } from './entities.js';
import { Clip } from './timeline.js';
import { CLIPS } from './data/clips.js';

export const UPPER = Object.freeze({ IDLE: 0, MOVE: 1, ACCELERATE: 2, DECELERATE: 3, TAKE_PHOTO: 4, BE_HURT: 7, SHOOT_SOAP: 8, THROW_WHITE_BLOOD: 9 });
export const LOWER = Object.freeze({ IDLE: 0, MOVE: 1, ACCELERATE: 2, DECELERATE: 3, JUMP: 4, JUMP_LAND: 5, BE_HURT: 6 });
export const PLAYER_STATE = Object.freeze({ ENTER_LEVEL: 100, BE_HURT: 101, NORMAL: 102 });

// Feel improvements (logged in web/NOTES-platformer-decisions.md). Counted in 30 ms logic steps.
export const JUMP_BUFFER_STEPS = 4;
export const COYOTE_STEPS = 4;

// The avatar: harry.swf / amy.swf, whose root holds an 'upper' and a 'lower' timeline.
export class AvatarClip {
  constructor(who) {
    this.who = who;
    this.symbol = who;
    this.def = CLIPS[who];
    this.upper = new Clip(`${who}_upper`);
    this.lower = new Clip(`${who}_lower`);
    this.removed = false;
    this.visible = true;
    this.alpha = 100;
    this._boundsKey = -1;
    this._bounds = null;
  }
  tick() { this.upper.tick(); this.lower.tick(); }

  // The root clip's live bounds { x, y, w, h } relative to its registration point: the union of
  // the upper and lower parts at their current frames. Flash reads clip._width live, so the
  // hoverboard exhaust behind the board (move, accelerate) and the sparks in front of it (brake)
  // widen the avatar, which moves the camera flash and soap spawn points and grows the hitTest
  // box (PlatformGame.as:681,763; flash-platformer.md section 3.5). Data from clips.js only.
  get bounds() {
    const key = this.upper.frame * 4096 + this.lower.frame;
    if (key !== this._boundsKey) {
      this._boundsKey = key;
      this._bounds = unionRects(partRect(this.upper), partRect(this.lower)) || this.def.bounds;
    }
    return this._bounds;
  }
}

// [x, y, w, h] of a part's current frame (frame-1 bounds when per-frame data is missing).
function partRect(clip) {
  const fb = clip.def.frameBounds;
  if (fb) return fb[clip.frame - 1] || null;
  const b = clip.def.bounds;
  return b ? [b.x, b.y, b.w, b.h] : null;
}

function unionRects(a, b) {
  if (!a && !b) return null;
  if (!a || !b) { const r = a || b; return { x: r[0], y: r[1], w: r[2], h: r[3] }; }
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]);
  const x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3]);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const NO_INPUT = Object.freeze({ left: false, right: false, jumpHeld: false, jumpPressed: false, jumpReleased: false, firePressed: false, cameraPressed: false });

export class PlayerEntity extends GameEntity {
  constructor(game, particle, clip) {
    super(game, particle, clip);
    this.type = T.PLAYER;
    this.upperState = UPPER.IDLE;
    this.lowerState = LOWER.IDLE;
    this.upperClip = clip.upper;
    this.lowerClip = clip.lower;
    this.jumpReady = true;
    this.maxJumps = MAX_JUMPS;     // `(!isNaN(inJumps)) ? 2 : inJumps` still yields 2
    this.jumpsLeft = this.maxJumps;
    this.counterCeiling = 1;
    this.isShootingSoap = true;
    this.canTakePhotograph = true;
    this.thinkTime = this.defaultThinkTime = 100;
    this.ammo = 0;
    this.maxAmmo = 10;
    this.infiniteAmmo = true;      // PlayerEntity.as:124: shooting never needs pickups
    this.lives = PLAYER_LIVES;
    this.has_antibiotic = false;
    this.state = PLAYER_STATE.NORMAL;
    this.speed = 0;                // set by the game: gravity.y * 1.5
    this.jumpForce = 0;            // set by the game: gravity.y * 8
    this.input = NO_INPUT;
    // Port additions for coyote time and jump buffering.
    this.jumpBuffer = 0;
    this.stepsSinceSupported = 99;
  }

  get fixes() { return this.game.options; }

  // hitTest, the off-screen test and the spawn offsets read the avatar's live bounds.
  artBounds() { return this.clip.bounds; }

  // PlayerEntity.as:134-164
  advance() {
    if (this.particle.supported) this.stepsSinceSupported = 0; else this.stepsSinceSupported++;
    const internal = this.checkKeys().concat(this.checkStateEvents());
    const out = [];
    while (internal.length) {
      const e = internal.shift();
      if (e.type === E.CREATE_SOAP_BULLET || e.type === E.CREATE_CAMERA_FLASH || e.type === E.CREATE_ANTIBIOTIC) out.push(e);
      else internal.push(...this.act(e));
    }
    this.thinkTime--;
    return out;
  }

  // PlayerEntity.as:166-268: every event is ignored unless the player is in the NORMAL state.
  act(e) {
    const events = [];
    if (this.state !== PLAYER_STATE.NORMAL) return events;
    switch (e.type) {
      case E.PLAYER_ACCELERATE: return this.accelerate();
      case E.PLAYER_DECELERATE: return this.decelerate();
      case E.PLAYER_JUMP_START: return this.jumpStart();
      case E.PLAYER_KEY_RELEASED_JUMP:
        if (this.jumpsLeft > 0) this.jumpReady = true;
        break;
      case E.PLAYER_KEY_PRESSED_ALT_FIRE:
        if (!this.has_antibiotic) {
          if (this.canTakePhotograph) {
            this.upperClip.gotoAndPlay('take_photo_start');
            this.upperState = UPPER.TAKE_PHOTO;
            this.canTakePhotograph = false;
            events.push(ev(E.CREATE_CAMERA_FLASH, this));
          }
        } else {
          this.upperClip.gotoAndPlay('shoot_soap');
          events.push(ev(E.CREATE_ANTIBIOTIC, this));
        }
        break;
      case E.PLAYER_KEY_PRESSED_FIRE: return this.fireWeapon();
      case E.CREATE_SOAP_BULLET: events.push(e); break;
      case E.COLLIDE: {
        const other = e.params[0];
        if (other && other.isBad && this.state !== PLAYER_STATE.BE_HURT && other.lives > 0) {
          events.push(ev(E.BE_HURT, this, [1]));
          this.jumpsLeft = this.maxJumps;
        }
        break;
      }
      case E.BE_HURT:
        this.lives -= e.params[0];
        this.upperClip.gotoAndPlay('hurt');
        this.upperState = UPPER.BE_HURT;
        this.lowerClip.gotoAndPlay('hurt');
        this.lowerState = LOWER.BE_HURT;
        this.canTakePhotograph = true;
        if (this.lives <= 0) events.push(ev(E.BE_KILLED, this));
        else this.state = PLAYER_STATE.BE_HURT;
        break;
      default: break;
    }
    return events;
  }

  // PlayerEntity.as:270-282
  takePhotograph() {
    if (this.upperState === UPPER.TAKE_PHOTO && this.upperClip.midAnimation === false) {
      this.canTakePhotograph = true;
      this.upperState = UPPER.MOVE;
    }
    return [];
  }

  // PlayerEntity.as:316-353
  fireWeapon() {
    const events = [];
    const u = this.upperState;
    if (u === UPPER.ACCELERATE || u === UPPER.DECELERATE || u === UPPER.IDLE || u === UPPER.MOVE) {
      if (this.isShootingSoap && (this.ammo > 0 || this.infiniteAmmo)) {
        this.upperState = UPPER.SHOOT_SOAP;
        this.upperClip.gotoAndPlay('shoot_soap');
        if (!this.infiniteAmmo) this.ammo--;
      }
    } else if (u === UPPER.SHOOT_SOAP) {
      if (this.upperClip.shoot === true) {
        this.upperClip.shoot = false;
        events.push(ev(E.CREATE_SOAP_BULLET, this, [0]));
      }
      if (this.upperClip.midAnimation === false) this.upperState = UPPER.MOVE;
    }
    return events;
  }

  // PlayerEntity.as:355-379
  accelerate() {
    const l = this.lowerState, u = this.upperState;
    if (l === LOWER.IDLE || l === LOWER.DECELERATE || l === LOWER.MOVE) {
      this.lowerState = LOWER.ACCELERATE;
      this.lowerClip.gotoAndPlay('accelerate_start');
    }
    if (u === UPPER.IDLE || u === UPPER.MOVE || u === UPPER.DECELERATE) {
      this.upperState = UPPER.ACCELERATE;
      this.upperClip.gotoAndPlay('accelerate_start');
    }
    this.particle.force = add(this.particle.force, { x: this.speed * this.direction, y: 0 });
    this.thinkTime = 0;
    return [];
  }

  // PlayerEntity.as:381-405
  decelerate() {
    const l = this.lowerState, u = this.upperState;
    if (l === LOWER.IDLE || l === LOWER.ACCELERATE || l === LOWER.MOVE) {
      this.lowerState = LOWER.DECELERATE;
      this.lowerClip.gotoAndPlay('decelerate_start');
    }
    if (u === UPPER.IDLE || u === UPPER.MOVE || u === UPPER.ACCELERATE) {
      this.upperState = UPPER.DECELERATE;
      this.upperClip.gotoAndPlay('decelerate_start');
    }
    this.particle.force = add(this.particle.force, { x: this.speed * this.direction * -1, y: 0 });
    this.thinkTime = 0;
    return [];
  }

  // PlayerEntity.as:410-424: always sets the vertical speed to -25 px/step after the clamp.
  jumpStart() {
    this.lowerState = LOWER.JUMP;
    this.lowerClip.gotoAndPlay('jump_start');
    this.particle.force = add(this.particle.force, { x: 0, y: -3 * this.jumpForce });
    this.jumpsLeft--;
    this.jumpReady = false;
    this.counter = this.counterCeiling;
    this.thinkTime = 0;
    this.game.fx.push({ type: 'jump', double: this.jumpsLeft < this.maxJumps - 1, x: this.particle.position.x, y: this.particle.position.y });
    return [];
  }

  // PlayerEntity.as:426-445: landing restores both jumps.
  jumpMid() {
    if (this.onSolidGround()) {
      this.lowerState = LOWER.JUMP_LAND;
      this.lowerClip.gotoAndPlay('jump_end');
      this.jumpsLeft = this.maxJumps;
      this.game.fx.push({ type: 'land', x: this.particle.position.x, y: this.particle.position.y });
    } else {
      const u = this.upperState;
      if (u === UPPER.MOVE || u === UPPER.DECELERATE || u === UPPER.IDLE) {
        this.upperState = UPPER.ACCELERATE;
        this.upperClip.gotoAndPlay('accelerate_start');
      }
    }
    this.direction = this.checkDirection();
    this.thinkTime = 0;
    return [];
  }

  // PlayerEntity.as:458-563
  checkStateEvents() {
    let events = [];
    switch (this.upperState) {
      case UPPER.BE_HURT:
        if (this.upperClip.midAnimation === false) {
          this.upperState = UPPER.MOVE;
          if (this.lowerState !== LOWER.BE_HURT) this.state = PLAYER_STATE.NORMAL;
        }
        break;
      case UPPER.SHOOT_SOAP: events = events.concat(this.fireWeapon()); break;
      case UPPER.TAKE_PHOTO: events = events.concat(this.takePhotograph()); break;
      default: break;
    }
    const dx = Math.abs(this.particle.position.x - this.particle.previousPosition.x);
    switch (this.lowerState) {
      case LOWER.BE_HURT:
        if (this.lowerClip.midAnimation === false) this.lowerState = LOWER.MOVE;
        if (this.upperState !== UPPER.BE_HURT) this.state = PLAYER_STATE.NORMAL;
        break;
      case LOWER.JUMP:
        if (this.lowerClip.midAnimation === false) events = events.concat(this.jumpMid());
        break;
      case LOWER.ACCELERATE:
        if (dx < SAFE_TRAVEL_DISTANCE) { this.lowerState = LOWER.IDLE; this.lowerClip.gotoAndPlay('idle'); }
        else if (dx < SAFE_TRAVEL_DISTANCE * 2) { this.lowerState = LOWER.MOVE; this.lowerClip.gotoAndPlay('move'); }
        break;
      case LOWER.MOVE:
        if (dx < SAFE_TRAVEL_DISTANCE) { this.lowerState = LOWER.IDLE; this.lowerClip.gotoAndPlay('idle'); }
        break;
      case LOWER.JUMP_LAND:
        if (this.lowerClip.midAnimation === false) {
          this.lowerState = LOWER.MOVE;
          this.lowerClip.gotoAndPlay('move');
          this.direction = this.checkDirection();
        }
        break;
      default: break;
    }
    return events;
  }

  // PlayerEntity.as:566-636, with the port's jump buffer / coyote time when enabled.
  checkKeys() {
    const k = this.input;
    const events = [];
    const right = k.right, left = k.left;
    if (!(right && left)) {
      if (right) {
        if (this.direction === RIGHT) events.push(ev(E.PLAYER_ACCELERATE, this));
        else {
          if (this.checkDirection() === RIGHT) { this.direction = RIGHT; events.push(ev(E.PLAYER_ACCELERATE, this)); }
          events.push(ev(E.PLAYER_DECELERATE, this));
        }
      } else if (left) {
        if (this.direction === LEFT) events.push(ev(E.PLAYER_ACCELERATE, this));
        else {
          if (this.checkDirection() === LEFT) { this.direction = LEFT; events.push(ev(E.PLAYER_ACCELERATE, this)); }
          events.push(ev(E.PLAYER_DECELERATE, this));
        }
      }
    }

    if (this.fixes.jumpFeel) {
      // Edge-triggered jump with a short buffer; a jump within COYOTE_STEPS of standing on
      // something always gets the full double jump back. Fixes the original's "dead press"
      // after a double jump (and after very quick taps) while keeping two jumps.
      if (k.jumpPressed) this.jumpBuffer = JUMP_BUFFER_STEPS;
      if (this.jumpBuffer > 0) {
        if (this.state === PLAYER_STATE.NORMAL) {
          if (this.stepsSinceSupported <= COYOTE_STEPS) this.jumpsLeft = this.maxJumps;
          if (this.jumpsLeft > 0) {
            events.push(ev(E.PLAYER_JUMP_START, this));
            this.jumpBuffer = 0;
            this.stepsSinceSupported = COYOTE_STEPS + 1;
          } else this.jumpBuffer--;
        } else this.jumpBuffer--;
      }
    } else if (k.jumpHeld || k.jumpPressed) {
      // Original: Up held while jumpReady starts a jump; releasing Up re-arms it, but only while
      // jumps remain, and a release in the same update as a press is lost.
      if (this.jumpReady) events.push(ev(E.PLAYER_JUMP_START, this));
    } else if (k.jumpReleased) {
      events.push(ev(E.PLAYER_KEY_RELEASED_JUMP, this));
    }

    if (k.firePressed) events.push(ev(E.PLAYER_KEY_PRESSED_FIRE, this));
    if (k.cameraPressed) events.push(ev(E.PLAYER_KEY_PRESSED_ALT_FIRE, this));
    this.input = NO_INPUT; // reset_keys(): flags mean "since the last update"
    return events;
  }

  // PlayerEntity.as:646-652
  checkDirection() {
    return this.particle.position.x < this.particle.previousPosition.x ? LEFT : RIGHT;
  }
}
