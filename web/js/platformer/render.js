// Draws the platform game. Every tile and entity goes through sprites.drawSymbol(), keyed by its
// Flash symbol and frame label, so atlases can replace the debug shapes without touching this
// file. Purely cosmetic: reads the simulation, never changes it.
//
// Animation: each entity's Flash timeline (timeline.js Clip) advances at 25 fps on the game's
// frame clock and is driven by the same gotoAndPlay calls as the AS2 code; the renderer draws the
// clip's current label and frame. The avatar is two clips, <who>_lower then <who>_upper, sharing
// one registration point (flash-platformer.md section 3.9).
//
// Juice layered on top (see platformScene.js for the triggers): squash and stretch about the
// hoverboard, white hit flashes (tint), invulnerability blinking, a dim closed portal and a
// glowing open one, an arrow to an open portal that is off screen, a tick badge over microbes
// already photographed, and the player being drawn into the portal at the end.
import { TILE, STAGE_W, STAGE_H, S, T, LEFT } from './constants.js';
import { sprites, MICROBE_NAMES } from './sprites.js';
import { PLAYER_STATE, UPPER, LOWER } from './player.js';
import { PORTAL, BULLET } from './actors.js';
import { ease, clamp } from '../core/tween.js';

// The original drew one flat background for every level (root shape 1495: #ff9900).
export const BACKGROUND = '#ff9900';
const AVATAR_COLOURS = {
  harry: { shirt: '#3d7fd6', trousers: '#2d4a7a', hair: '#8a4b1f', skin: '#f5c9a3', board: '#ff8a5c' },
  amy: { shirt: '#e05a9a', trousers: '#5a3d8a', hair: '#e8b04a', skin: '#f5c9a3', board: '#5fd4ff' },
};
const PHOTO_GOAL_TYPES = [0, 1, 3];

export class PlatformRenderer {
  constructor(game, { reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    // Squash and stretch spring for the player (x and y scale about the hoverboard).
    this.squash = { x: 1, y: 1, vx: 0, vy: 0 };
    this.flash = new Map();   // entity -> ticks of white flash left
    this.exit = null;         // { age, ticks, from: {x, y}, to: {x, y} } while entering the portal
    this.portalOpenAge = -1;
    this.setGame(game);
  }

  setGame(game) {
    this.game = game;
    for (const [, d] of Object.entries(game.level.palette)) {
      if (d.movie && d.w != null) sprites.defineBounds(d.movie, { x: d.ax || 0, y: d.ay || 0, w: d.w, h: d.h });
    }
    this.cells = [...game.level.drawnCells()].filter(([, , id]) => game.level.def(id).movie && game.level.def(id).w != null);
    const g = game.goalsView[0];
    this.goalType = g ? g.goalType : null;
    this.goalMicrobe = g ? g.microbeType : null;
  }

  // Juice triggers from the scene.
  kick(kind) {
    if (this.reducedMotion) return;
    const s = this.squash;
    if (kind === 'jump') { s.x = 0.82; s.y = 1.2; s.vx = 0; s.vy = 0; }
    else if (kind === 'doubleJump') { s.x = 0.86; s.y = 1.16; }
    else if (kind === 'land') { s.x = 1.2; s.y = 0.8; s.vx = 0; s.vy = 0; }
    else if (kind === 'hurt') { s.x = 1.15; s.y = 0.85; }
  }
  hitFlash(entity, ticks = 8) { if (entity) this.flash.set(entity, ticks); }
  startExit(from, to, ticks = 34) { this.exit = { age: 0, ticks, from, to }; }

  // Per engine tick (15 ms): springs and timers.
  update() {
    const s = this.squash;
    for (const k of ['x', 'y']) {
      const v = k === 'x' ? 'vx' : 'vy';
      s[v] = (s[v] + (1 - s[k]) * 0.3) * 0.72;
      s[k] += s[v];
      if (Math.abs(s[k] - 1) < 0.002 && Math.abs(s[v]) < 0.002) { s[k] = 1; s[v] = 0; }
    }
    for (const [e, n] of this.flash) { if (n <= 1) this.flash.delete(e); else this.flash.set(e, n - 1); }
    if (this.exit && this.exit.age < this.exit.ticks) this.exit.age++;
    if (this.game.portalOpen) this.portalOpenAge++;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx  in logical 800x450 units
   * @param {number} alpha  0..1 between the previous and the current logic step
   * @param {number} t      seconds of scene time (25 fps clock for one-frame symbols)
   */
  draw(ctx, alpha, t = 0) {
    const g = this.game;
    const cam = g.camera;
    const vx = cam.viewX(alpha);
    const vy = cam.shakeY;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.save();
    ctx.translate(0, -vy);

    // Depth order as in the original: level entities (portal, pickups, microbes, milk) were
    // attached inside the 'game' clip at CREATE_ENTITIES (PlatformGame.as:419), and each tile
    // cell is duplicated above them at the next highest depth when it first scrolls into view
    // (PlatformGame.as:1104), so tiles cover the level entities (the portal's bottom edge sits
    // behind the worktop). Projectiles and the flash are attached later, above the tiles already
    // there. The avatar is a root clip (depth 6) above the whole 'game' clip (depth 4), so it is
    // drawn last, over the projectiles too.
    const order = [];
    for (let i = 1; i < g.entities.length; i++) { const e = g.entities[i]; if (e) order.push(e); }
    const layer = e => (e.type === T.PORTAL_EXIT ? 0 : e.type === T.AMMO_PICKUP || e.type === T.ANTIBIOTIC_PICKUP ? 1 : e.type === T.MILK ? 3 : e.type === T.BULLET || e.type === T.CAMERA_FLASH || e.type === T.ANTIBIOTIC_BOMB ? 5 : 2);
    order.sort((a, b) => layer(a) - layer(b) || a.indexId - b.indexId);
    for (const e of order) { if (layer(e) < 5) this.drawEntity(ctx, e, vx, alpha, t); }

    // Tiles, snapped to device pixels so edge-to-edge tiles leave no seams. Big tiles extend to
    // the right of their anchor cell, so a few extra columns on the left are drawn.
    const c0 = Math.floor(vx / TILE) - 6, c1 = Math.ceil((vx + STAGE_W) / TILE) + 1;
    const snap = ctx.getTransform().a;
    const ox = Math.round(vx * snap) / snap;
    for (const [r, c, id] of this.cells) {
      if (c < c0 || c > c1) continue;
      const d = g.level.def(id);
      sprites.drawSymbol(ctx, d.movie, null, 0, c * TILE - ox, r * TILE);
    }

    for (const e of order) { if (layer(e) === 5) this.drawEntity(ctx, e, vx, alpha, t); }
    this.drawPlayer(ctx, g.player, vx, alpha, t);
    ctx.restore();

    this.drawPortalArrow(ctx, vx, t);
    if (g.whiteout > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, g.whiteout / 100)})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
  }

  // Interpolated registration point of an entity's clip, in world coordinates.
  clipPos(e, alpha) {
    const bx = e.bx ?? e.particle.position.x, by = e.by ?? e.particle.position.y;
    let px = e.pbx ?? bx, py = e.pby ?? by;
    if (Math.abs(bx - px) > 120 || Math.abs(by - py) > 120) { px = bx; py = by; }
    const x = px + (bx - px) * alpha, y = py + (by - py) * alpha;
    return { x: x + (e.flip ? e.particle.width : 0), y };
  }

  drawEntity(ctx, e, vx, alpha, t) {
    const clip = e.clip;
    if (!clip || clip.removed || clip.visible === false) return;
    if (e.removed && e.type !== T.CAMERA_FLASH) return;
    const { x, y } = this.clipPos(e, alpha);
    const sx = x - vx;
    if (sx > STAGE_W + 450 || sx < -450) return;
    let label = clip.label, frame = clip.labelFrame;
    // One-frame symbols animated by nested clips (portal) loop on the 25 fps clock.
    if (clip.def.frameCount <= 1) { label = null; frame = g2frame(t); }
    if (e.type === T.PORTAL_EXIT) { this.drawPortal(ctx, e, sx, y, frame, t); return; }
    let text = null;
    if (MICROBE_NAMES[e.symbol] && e.symbol !== 'superinfection_icon') text = MICROBE_NAMES[e.symbol] + (e.hasBeenPhotographed ? ' ✓' : '');
    if (e.type === T.SUPERINFECTION) text = e.lives > 0 ? `Superinfection  ${'●'.repeat(e.lives)}` : null;
    const fl = this.flash.get(e) || 0;
    sprites.drawSymbol(ctx, e.symbol || clip.symbol, label, frame, sx, y, {
      flipX: e.flip, alpha: Math.max(0, clip.alpha) / 100, t, text,
      tint: fl ? '#ffffff' : null, tintAmount: fl / 8,
    });
    if (e.hasBeenPhotographed && PHOTO_GOAL_TYPES.includes(this.goalType) && !e.removed && e.state !== S.BE_KILLED) this.drawTickBadge(ctx, e, sx, y);
  }

  // A small tick bubble above a microbe that is already in the album (clarity for players).
  drawTickBadge(ctx, e, sx, y) {
    const b = e.artBounds();
    const cx = sx + (e.flip ? -(b.x + b.w / 2) : b.x + b.w / 2);
    const cy = y + b.y - 12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#2fbf5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-4.5, 0.5); ctx.lineTo(-1.2, 4); ctx.lineTo(5, -3.5); ctx.stroke();
    ctx.restore();
  }

  // The portal: the shipped art is a pulsing blue ellipse that looked the same open or closed
  // (section 4.10). Added: closed portals are dimmed and greyed; an open one glows, breathes and
  // throws a ring of light as it opens.
  drawPortal(ctx, e, sx, y, frame, t) {
    const open = e.state === PORTAL.OPEN;
    const b = e.artBounds();
    const cx = sx + b.x + b.w / 2, cy = y + b.y + b.h / 2;
    const age = this.portalOpenAge;
    if (open && !this.reducedMotion) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, b.w * 0.95);
      grad.addColorStop(0, `rgba(160, 235, 255, ${0.55 + 0.2 * pulse})`);
      grad.addColorStop(1, 'rgba(160, 235, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.95, b.h * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      // Opening shockwave rings.
      for (let i = 0; i < 2; i++) {
        const k = (age - i * 8) / 36;
        if (k <= 0 || k >= 1) continue;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - k)})`;
        ctx.lineWidth = 8 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, b.w / 2 + k * 140, b.h / 2 + k * 160, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    const breathe = open && !this.reducedMotion ? 1 + 0.04 * Math.sin(t * 4) : 1;
    const pop = open && age >= 0 && age < 20 && !this.reducedMotion ? 1 + 0.25 * Math.sin((age / 20) * Math.PI) : 1;
    const s = breathe * pop;
    sprites.drawSymbol(ctx, e.symbol, null, frame, sx, y, {
      alpha: open ? 1 : 0.6, scaleX: s, scaleY: s, pivotX: cx, pivotY: cy,
      tint: open ? null : '#6a6f86', tintAmount: 0.55,
    });
  }

  // An arrow at the screen edge pointing to an open portal that is off screen.
  drawPortalArrow(ctx, vx, t) {
    const p = this.game.portal;
    if (!p || !this.game.portalOpen || this.exit) return;
    const b = p.artBounds();
    const px = p.particle.position.x + b.x + b.w / 2 - vx;
    if (px > 40 && px < STAGE_W - 40) return;
    const right = px >= STAGE_W - 40;
    const y = clamp(p.particle.position.y + b.y + b.h / 2, 130, 330);
    const bob = this.reducedMotion ? 0 : Math.sin(t * 7) * 5;
    const x = right ? STAGE_W - 34 + bob : 34 - bob;
    ctx.save();
    ctx.translate(x, y);
    if (!right) ctx.scale(-1, 1);
    ctx.fillStyle = '#5fd4ff'; ctx.strokeStyle = '#1b1640'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-6, -20); ctx.lineTo(-6, -9); ctx.lineTo(-20, -9); ctx.lineTo(-20, 9); ctx.lineTo(-6, 9); ctx.lineTo(-6, 20); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, p, vx, alpha, t) {
    const who = p.clip.who;
    const { x, y } = this.clipPos(p, alpha);
    const sx = x - vx;
    const hurt = p.state === PLAYER_STATE.BE_HURT;
    // Invulnerability: a white flash as the hit lands, then blinking until control returns.
    const fl = this.flash.get(p) || 0;
    const blink = hurt && !fl && Math.floor(t * 18) % 2 === 0 ? 0.3 : 1;
    const left = p.flip ? sx - p.particle.width : sx;
    const footX = left + p.particle.width / 2, footY = y + p.particle.height;
    let fade = 1;
    ctx.save();
    if (this.exit) {
      // Drawn into the portal: the body's centre slides to the portal's centre, spinning and
      // shrinking.
      const k = ease.inQuad(clamp(this.exit.age / this.exit.ticks, 0, 1));
      const bcx = footX, bcy = footY - p.particle.height / 2;
      const tx = this.exit.to.x - vx, ty = this.exit.to.y;
      ctx.translate(bcx + (tx - bcx) * k, bcy + (ty - bcy) * k);
      ctx.rotate(k * Math.PI * 3 * (p.direction === LEFT ? -1 : 1));
      const s = Math.max(0.02, 1 - k * 0.95);
      ctx.scale(s, s);
      ctx.translate(-bcx, -bcy);
      fade = 1 - k * 0.5;
    }
    // Squash and stretch about the middle of the hoverboard (the box's bottom centre).
    const opts = {
      flipX: p.flip, alpha: blink * fade, t, scaleX: this.squash.x, scaleY: this.squash.y, pivotX: footX, pivotY: footY,
      tint: fl ? '#ffffff' : hurt ? '#ff4060' : null, tintAmount: fl ? fl / 8 : hurt ? 0.25 : 0,
    };
    if (sprites.hasSymbol(`${who}_lower`) && sprites.hasSymbol(`${who}_upper`)) {
      sprites.drawSymbol(ctx, `${who}_lower`, p.lowerClip.label, p.lowerClip.labelFrame, sx, y, opts);
      sprites.drawSymbol(ctx, `${who}_upper`, p.upperClip.label, p.upperClip.labelFrame, sx, y, opts);
    } else {
      drawDebugAvatar(ctx, p, who, sx, y, opts, avatarAnim(p));
    }
    ctx.restore();
  }
}

const g2frame = t => Math.floor(t * 25);

// A single logical animation name (debug avatar and tests).
export function avatarAnim(p) {
  if (p.state === PLAYER_STATE.BE_HURT || p.upperState === UPPER.BE_HURT) return 'hurt';
  if (p.upperState === UPPER.TAKE_PHOTO) return 'take_photo';
  if (p.upperState === UPPER.SHOOT_SOAP) return 'shoot';
  if (p.lowerState === LOWER.JUMP) return 'jump';
  if (p.lowerState === LOWER.JUMP_LAND) return 'land';
  if (p.lowerState === LOWER.ACCELERATE) return 'accelerate';
  if (p.lowerState === LOWER.DECELERATE) return 'decelerate';
  if (p.lowerState === LOWER.MOVE) return 'move';
  return 'idle';
}

// Debug avatar: a child on a hoverboard inside the 49 x 100 box (registration at the box's
// top-left; flipX mirrors about x = 49 exactly as the Flash clip did).
function drawDebugAvatar(ctx, p, who, x, y, { flipX, alpha, t, scaleX = 1, scaleY = 1 }, anim) {
  const c = AVATAR_COLOURS[who] || AVATAR_COLOURS.harry;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flipX) ctx.scale(-1, 1);
  ctx.translate(24.5, 100);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-24.5, -100);
  const bob = anim === 'idle' ? Math.sin(t * 5) * 1.5 : 0;
  // board + glow
  ctx.fillStyle = 'rgba(95,212,255,0.35)';
  ctx.beginPath(); ctx.ellipse(24, 99, 30, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.board; ctx.strokeStyle = '#2a1030'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 90); ctx.lineTo(52, 90); ctx.quadraticCurveTo(58, 90, 56, 95); ctx.lineTo(-4, 96); ctx.quadraticCurveTo(-9, 93, -6, 90); ctx.fill(); ctx.stroke();
  ctx.translate(0, bob);
  // legs
  ctx.fillStyle = c.trousers;
  const crouch = anim === 'jump' ? 6 : anim === 'land' ? 4 : 0;
  ctx.fillRect(14, 58 + crouch, 9, 32 - crouch);
  ctx.fillRect(27, 58 + crouch, 9, 32 - crouch);
  // body
  ctx.fillStyle = c.shirt;
  ctx.beginPath(); ctx.moveTo(10, 30 + crouch); ctx.lineTo(40, 30 + crouch); ctx.lineTo(38, 62 + crouch); ctx.lineTo(12, 62 + crouch); ctx.closePath(); ctx.fill();
  // arm: points forward with the phone / soap when acting
  ctx.strokeStyle = c.skin; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  if (anim === 'take_photo' || anim === 'shoot') { ctx.moveTo(32, 38 + crouch); ctx.lineTo(50, 36 + crouch); }
  else { ctx.moveTo(32, 38 + crouch); ctx.lineTo(38, 54 + crouch); }
  ctx.stroke();
  if (anim === 'take_photo') { ctx.fillStyle = '#222'; ctx.fillRect(47, 30 + crouch, 7, 11); ctx.fillStyle = '#9ef'; ctx.fillRect(49, 32 + crouch, 3, 3); }
  if (anim === 'shoot') { ctx.fillStyle = '#c9f0ff'; ctx.beginPath(); ctx.arc(52, 36 + crouch, 5, 0, Math.PI * 2); ctx.fill(); }
  // head
  ctx.fillStyle = c.skin;
  ctx.beginPath(); ctx.arc(25, 17 + crouch, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath(); ctx.arc(23, 11 + crouch, 13, Math.PI * 1.05, Math.PI * 2.1); ctx.fill();
  if (who === 'amy') { ctx.beginPath(); ctx.ellipse(10, 24 + crouch, 5, 11, 0.2, 0, Math.PI * 2); ctx.fill(); }
  // eye (looks forward)
  ctx.fillStyle = '#1b1640';
  ctx.beginPath(); ctx.arc(31, 17 + crouch, 2.2, 0, Math.PI * 2); ctx.fill();
  if (anim === 'hurt') { ctx.strokeStyle = '#1b1640'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(28, 25 + crouch, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.restore();
}

export { BULLET, S };
