// Non-microbe entities of the platform game: projectiles, the camera flash, pickups, the milk
// glass, the exit portal and the antibiotic bomb. Ported from reference/Junior_Game/src/ebug/
// junior/{BulletEntity,CameraFlashEntity,SoapPickup,WhitePickup,AntibioticPickup,
// MilkGlassEntity,PortalEntity,AntibioticBombEntity}.as. Pure: no DOM.
import { S, E, T, SAFE_TRAVEL_DISTANCE, BOMB_FUSE_STEPS } from './constants.js';
import { sub, length } from './vec.js';
import { GameEntity, Microbe, ev } from './entities.js';

// ---------------------------------------------------------------------------------------------
// BulletEntity.as: soap (outside the body) and white blood cells (inside) share this logic.
// ---------------------------------------------------------------------------------------------
export const BULLET = Object.freeze({ NORMAL: 100, SPLAT: 101, DEAD: 102 });

export class BulletEntity extends GameEntity {
  constructor(game, particle, clip, { speed = 10, white = false } = {}) {
    super(game, particle, clip);
    this.type = T.BULLET;
    this.white = white;
    this.counterCeiling = 1;
    this.thinkTime = this.defaultThinkTime = 3;
    particle.theParent = this;
    this.speed = speed;
    particle.isDynamic = true;
    particle.gravityExcempt = true;   // also wipes the initial force, so no inherited momentum
    particle.physicsExcempt = false;
    this.deadTimer = 15;
    clip.gotoAndPlay('shoot');
    this.state = BULLET.NORMAL;
  }

  // BulletEntity.as:53-91: pushes itself 10 px per step on top of the Verlet carry.
  advance() {
    switch (this.state) {
      case BULLET.NORMAL: {
        if (this.deadTimer <= 0) this.splat(); else this.deadTimer--;
        this.particle.position.x += this.speed * this.direction;
        if (Math.abs(this.particle.position.x - this.particle.previousPosition.x) <= SAFE_TRAVEL_DISTANCE) {
          this.thinkTime--;
          if (this.thinkTime <= 0) this.splat();
        }
        return [];
      }
      case BULLET.SPLAT:
        if (this.clip.midAnimation === false) {
          this.remove();
          return [ev(E.REMOVE, this)];
        }
        return [];
      default: return [];
    }
  }

  splat() {
    this.state = BULLET.SPLAT;
    this.clip.gotoAndPlay('splat');
    this.game.fx.push({ type: 'splat', white: this.white, x: this.particle.position.x + 25, y: this.particle.position.y + 12 });
  }

  // BulletEntity.as:93-110: splats on anything but bullets and the player, and re-notifies the victim.
  act(e) {
    if (this.state === BULLET.NORMAL && e.type === E.COLLIDE) {
      const other = e.params[0];
      if (other && other.type !== T.BULLET && other.type !== T.PLAYER) {
        this.splat();
        return [ev(E.COLLIDE, other, [this])];
      }
    }
    return [];
  }

  remove() {
    this.particle.physicsExcempt = true;
    this.clip.visible = false;
    this.removed = true;
  }
}

// ---------------------------------------------------------------------------------------------
// CameraFlashEntity.as: photographs the first microbe its art overlaps, then fades out.
// ---------------------------------------------------------------------------------------------
export const FLASH = Object.freeze({ NORMAL: 100, DEAD: 102 });

export class CameraFlashEntity extends GameEntity {
  constructor(game, particle, clip) {
    super(game, particle, clip);
    this.type = T.CAMERA_FLASH;
    this.counterCeiling = 1;
    this.thinkTime = 0;
    particle.theParent = this;
    this.shotTaken = false;
    particle.isDynamic = true;      // (sic) the body itself is static and physics exempt
    particle.gravityExcempt = true;
    particle.physicsExcempt = false;
    this.state = FLASH.NORMAL;
  }

  advance() {
    return this.state === FLASH.NORMAL ? this.takeShot() : [];
  }

  act(e) {
    if (e.type === E.COLLIDE) {
      const microbe = e.params[0];
      if (microbe instanceof Microbe && !microbe.hasBeenPhotographed) {
        this.shotTaken = true;
        this.game.events.push(ev(E.BE_PHOTOGRAPHED, microbe));
        this.photographed = microbe;
      }
    } else if (e.type === E.REMOVE) {
      this.remove();
    }
    return [];
  }

  // CameraFlashEntity.as:70-91: alpha -10 per step (gone after 10); the first overlapping
  // microbe in entity order is chosen even if it was already photographed (wasting the shot).
  takeShot() {
    const events = [];
    this.clip.alpha -= 10;
    if (this.clip.alpha <= 0) {
      events.push(ev(E.REMOVE, this));
      this.state = FLASH.DEAD;
    }
    const list = this.game.entities;
    for (let i = 0; i < list.length && !this.shotTaken; i++) {
      const m = list[i];
      if (m instanceof Microbe && this.hitTest(m)) {
        events.push(ev(E.COLLIDE, this, [m]));
        this.shotTaken = true;
      }
    }
    return events;
  }

  remove() {
    this.particle.physicsExcempt = true;
    this.clip.visible = false;
    this.removed = true;
  }
}

// ---------------------------------------------------------------------------------------------
// SoapPickup.as / WhitePickup.as (identical logic) and AntibioticPickup.as. Static and not
// solid: each step they hitTest the player's clip themselves.
// ---------------------------------------------------------------------------------------------
class Pickup extends GameEntity {
  constructor(game, particle, clip, type) {
    super(game, particle, clip);
    this.type = type;
    this.counterCeiling = 1;
    this.thinkTime = 0;
    particle.theParent = this;
    particle.physicsExcempt = true;
    particle.isDynamic = false;
    this.state = S.IDLE;
  }

  advance() {
    if (this.state === S.IDLE) {
      const player = this.game.player;
      if (this.hitTest(player)) return [ev(E.COLLIDE, this, [player])];
    }
    return [];
  }
}

export class AmmoPickup extends Pickup {
  constructor(game, particle, clip, white) {
    super(game, particle, clip, T.AMMO_PICKUP);
    this.white = white;
  }

  act(e) {
    if (e.type === E.COLLIDE && this.state !== S.DEFAULT && e.params[0].type === T.PLAYER) {
      const player = e.params[0];
      player.ammo++;
      if (player.ammo === player.maxAmmo) player.infiniteAmmo = true;
      this.remove();
      return [ev(E.REMOVE, this)];
    }
    return [];
  }
}

export class AntibioticPickup extends Pickup {
  constructor(game, particle, clip) {
    super(game, particle, clip, T.ANTIBIOTIC_PICKUP);
  }

  // Only one antibiotic can be carried at a time (AntibioticPickup.as:44-63).
  act(e) {
    if (e.type === E.COLLIDE && this.state !== S.DEFAULT && e.params[0].type === T.PLAYER && e.params[0].has_antibiotic === false) {
      this.remove();
      return [ev(E.REMOVE, this), ev(E.PICKUP_ANTIBIOTIC, this)];
    }
    return [];
  }
}

// ---------------------------------------------------------------------------------------------
// MilkGlassEntity.as: turns into yoghurt when Lucy touches it.
// ---------------------------------------------------------------------------------------------
export const MILK = Object.freeze({ WHITE: 100, FLASHING: 101, YOGURT: 102 });

export class MilkGlassEntity extends GameEntity {
  constructor(game, particle, clip) {
    super(game, particle, clip);
    this.counterCeiling = 1;      // one Lucy contact is enough
    this.thinkTime = 0;
    particle.theParent = this;
    particle.physicsExcempt = false;
    particle.isDynamic = true;
    this.state = MILK.WHITE;
    clip.stop();
    this.defaultThinkTime = 9999999;
    this.type = T.MILK;
  }

  advance() {
    if (this.thinkTime <= 0 && this.state === MILK.FLASHING && this.clip.midAnimation === false) {
      if (this.counter === this.counterCeiling) {
        this.state = MILK.YOGURT;
        this.clip.gotoAndPlay('yogurt');
      } else {
        this.state = MILK.WHITE;
        this.clip.gotoAndPlay('start');
      }
      this.thinkTime = this.defaultThinkTime;
    }
    return [];
  }

  act(e) {
    const events = [];
    switch (e.type) {
      case E.COLLIDE: {
        const lucy = e.params[0];
        if (lucy && lucy.type === T.LUCY && lucy.state !== S.DIVE) events.push(ev(E.MILK_GLASS_HIT, this));
        break;
      }
      case E.MILK_GLASS_HIT:
        if (this.state === MILK.WHITE) {
          this.clip.gotoAndPlay('tickle');
          this.counter++;
          if (this.counter === this.counterCeiling) events.push(ev(E.MILK_GLASS_EVENT_TURN_TO_YOGURT, this));
          this.state = MILK.FLASHING;
          this.thinkTime = 0;
          events.push(ev(E.MODIFY_POINTS, null, [10]));
        }
        break;
      default: break;
    }
    return events;
  }
}

// ---------------------------------------------------------------------------------------------
// PortalEntity.as: opens when the goals are met; checks for the player every 10 steps.
// ---------------------------------------------------------------------------------------------
export const PORTAL = Object.freeze({ CLOSED: 100, OPEN: 101 });

export class PortalEntity extends GameEntity {
  constructor(game, particle, clip) {
    super(game, particle, clip);
    this.type = T.PORTAL_EXIT;
    this.counterCeiling = 1;
    this.thinkTime = 0;
    particle.theParent = this;
    particle.physicsExcempt = true;
    particle.isDynamic = false;
    this.state = PORTAL.CLOSED;
    clip.stop();
  }

  advance() {
    const events = [];
    this.thinkTime--;
    if (this.thinkTime <= 0) {
      if (this.state === PORTAL.OPEN) {
        const player = this.game.player;
        if (length(sub(this.particle.position, player.particle.position)) < 100 && this.hitTest(player)) {
          events.push(ev(E.TRIGGER_LEVEL_END, this, []));
        }
      }
      this.thinkTime = this.defaultThinkTime * 2;
    }
    return events;
  }

  act(e) {
    if (e.type === E.PORTAL_OPEN && this.state !== PORTAL.OPEN) {
      this.clip.play();
      this.state = PORTAL.OPEN;
    }
    return [];
  }
}

// ---------------------------------------------------------------------------------------------
// AntibioticBombEntity.as: drops, and explodes 2 s after it has come to rest.
// ---------------------------------------------------------------------------------------------
export const BOMB = Object.freeze({ FALLING: 100, COUNTING_DOWN: 101, EXPLODE: 102 });

export class AntibioticBombEntity extends GameEntity {
  constructor(game, particle, clip) {
    super(game, particle, clip);
    this.type = T.ANTIBIOTIC_BOMB;
    this.counterCeiling = 1;
    this.thinkTime = this.defaultThinkTime = 3;
    particle.theParent = this;
    particle.isDynamic = true;
    particle.gravityExcempt = false;
    particle.physicsExcempt = false;
    this.state = BOMB.FALLING;
    this.minimumSpeedTrigger = 2;
    this.fuse = 0;   // steps left; the original compared getTimer() with a 2000 ms deadline
  }

  advance() {
    switch (this.state) {
      case BOMB.FALLING:
        if (Math.abs(this.particle.position.y - this.particle.previousPosition.y) <= this.minimumSpeedTrigger) {
          this.state = BOMB.COUNTING_DOWN;
          this.fuse = BOMB_FUSE_STEPS;
        }
        return [];
      case BOMB.COUNTING_DOWN:
        if (--this.fuse <= 0) this.state = BOMB.EXPLODE;
        return [];
      case BOMB.EXPLODE:
        return [ev(E.EXPLODE_ANTIBIOTIC, this), ev(E.REMOVE, this)];
      default: return [];
    }
  }

  act(e) {
    if (e.type === E.REMOVE) this.remove();
    return [];
  }

  remove() {
    this.particle.physicsExcempt = true;
    this.clip.removed = true;
    this.clip.visible = false;
    this.removed = true;
    this.state = S.IGNORE;
  }
}
