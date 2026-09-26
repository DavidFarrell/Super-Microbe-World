// Horizontal camera. The original kept the player between screen x 250 and 450 by moving the
// view exactly as far as the player moved in the previous step (PlatformGame.as:605-612,
// 1028-1050), with no clamp at the level edges and a wrong-way pan when moving away from a
// margin (section 7). The port keeps the same margins but eases towards the target and clamps
// to the level, which removes the snapping and the pans into empty space.
//
// The camera is part of the deterministic simulation: which tiles are solid and which entities
// are active depends on what is on screen (sections 1.6, 2.7), so it is updated once per logic
// step. Rendering interpolates between steps and adds the cosmetic shake offset.
//
// Look-ahead (port addition): while the player rides, the margin window slides against the
// direction of travel by up to `lookAhead` px, easing in, so more of what lies ahead is on
// screen. It depends only on the simulation (never on settings), so replays stay identical.
import { STAGE_W, SCROLL_MARGIN_LEFT, SCROLL_MARGIN_RIGHT } from './constants.js';

export class Camera {
  constructor({ levelWidth, marginLeft = SCROLL_MARGIN_LEFT, marginRight = SCROLL_MARGIN_RIGHT, smoothing = 0.25, smooth = true, lookAhead = 0 } = {}) {
    this.levelWidth = levelWidth;
    this.lookAhead = lookAhead;
    this.lead = 0;
    this.marginLeft = marginLeft;
    this.marginRight = marginRight;
    this.smoothing = smoothing;
    this.smooth = smooth;
    this.x = 0;
    this.prevX = 0;
    this.y = 0;
    // Cosmetic shake offset, set by the scene each frame; never read by the simulation.
    this.shakeX = 0;
    this.shakeY = 0;
  }

  get maxX() { return Math.max(0, this.levelWidth - STAGE_W); }
  clamp(x) { return Math.min(this.maxX, Math.max(0, x)); }

  // The x the view wants so that the box [left, right] sits inside the scroll margins.
  target(left, right) {
    const ml = this.marginLeft - this.lead, mr = this.marginRight - this.lead;
    let t = this.x;
    if (right - this.x > mr) t = right - mr;
    else if (left - this.x < ml) t = left - ml;
    return this.clamp(t);
  }

  snap(left, right) {
    this.x = this.target(left, right);
    // Centre on the player where the level allows, rather than hugging a margin at the start.
    this.x = this.clamp(Math.min(this.x, left - this.marginLeft));
    this.x = this.clamp(Math.max(this.x, right - this.marginRight));
    this.prevX = this.x;
  }

  // vx: the player's horizontal movement this step (for look-ahead).
  update(left, right, vx = 0) {
    this.prevX = this.x;
    if (this.lookAhead) {
      const speed = Math.abs(vx);
      const want = speed > 2 ? Math.sign(vx) * this.lookAhead * Math.min(1, (speed - 2) / 10) : this.lead;
      this.lead += (want - this.lead) * 0.04;
    }
    const t = this.target(left, right);
    if (!this.smooth) { this.x = t; return; }
    const d = t - this.x;
    this.x = Math.abs(d) < 0.05 ? t : this.x + d * this.smoothing;
    // Never let the player leave the visible stage while the view catches up.
    if (right - this.x > STAGE_W - 40) this.x = this.clamp(right - (STAGE_W - 40));
    if (left - this.x < 40) this.x = this.clamp(left - 40);
  }

  // Interpolated view x for drawing between two logic steps.
  viewX(alpha) { return this.prevX + (this.x - this.prevX) * alpha + this.shakeX; }
}
