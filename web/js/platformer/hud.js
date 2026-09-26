// Platform game HUD, drawn on the canvas from the original art (hud atlas, exported from
// introductionToMicrobes_platformer.swf) at the original root-timeline positions
// (flash-platformer.md section 8.1):
//   score      'score' at (674.8, 14.05), four 'digit' clips placed by score.tracks
//   hearts     'heart' at x 655.85 / 699.35 / 742.85, y 71.7
//   timer      bold black Arial 16 at (333.95, 17.5), 104 x 21.9, left-aligned (a dynamic text field)
//   ePhone     'e_phone' frame 2 at (-1.8, 4.15) with the 'status' screen placed by
//              e_phone.tracks.screen: goal picture ('lucy_image', or 'exit_status' once the
//              portal opens), mode icon ('camera_icon') and six 'tick_box_button' clips
//              (grey / empty / tick) placed by status.tracks (section 8.3).
// Touch play moves the ePhone to the left edge (the thumbs cover the bottom right) and the stage
// top-left holds the touch pause and phone buttons; keyboard play keeps the original layout.
//
// Additions (cosmetic): eased score counter with digit pops, hearts that burst when lost (the
// leftmost first, as in the original) and beat on the last life, the unused 'timer' stopwatch
// from the same SWF left of the time, which turns red in the last 20 s, tick boxes
// that pop when a photo lands, the goal picture flipping to the exit picture, and a banner.
import { el } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { ease, clamp } from '../core/tween.js';
import { sprites } from './sprites.js';
import { G, T } from './constants.js';

const ROOT = {
  score: [674.8, 14.05],
  hearts: [[655.85, 71.7], [699.35, 71.7], [742.85, 71.7]],
  timer: [333.95, 17.5, 104, 21.9],
  ephone: [-1.8, 4.15],
  antibiotic: [671.15, 104.5, 2.149],
};
const DIGITS = ['thousands', 'hundreds', 'tens', 'units'];
const DIGIT_FRAME = n => (n === 0 ? 1 : n * 10);
const TICK_FRAME = { grey: 1, tick: 10, cross: 20, empty: 30 };
// ePhone art bounds in stage units (small state) and where touch play puts it.
export const PHONE_RECT = { x: 695.6, y: 267.6, w: 93.1, h: 177.7 };
const TOUCH_PHONE_OFFSET = [-688, -178];
// Goal picture per goal (PlatformGame.as:331-362); Patty had no branch and kept 'background'.
const GOAL_IMAGE = { [T.LUCY]: 'lucy_image', [T.STEVE]: 'steve_image', [T.SANDY]: 'sandy_image', [T.SLARG]: 'slarg_image', [T.SLURM]: 'slurm_image' };

export function goalImage(goal) {
  if (!goal) return 'status_background';
  if (goal.goalType === G.PHOTOGRAPH_GOOD) return 'lucy_image';
  if (goal.goalType === G.PHOTOGRAPH_SPECIFIC) return GOAL_IMAGE[goal.microbeType] || 'status_background';
  if (goal.goalType === G.YOGURT) return 'milk_image';
  if (goal.goalType === G.ANTIBIOTIC) return 'superinfection_image';
  return 'slurm_image';
}
function goalMode(goal) {
  if (!goal) return null;
  if (goal.goalType === G.YOGURT || goal.goalType === G.ANTIBIOTIC) return null;
  if (goal.goalType === G.KILL_ALL) return 'kill_icon';
  return 'camera_icon';
}

// Goal pictures the original lacked (NOTES.md 11.9 #9): level 4 (photograph Patty) had no
// branch in CREATE_GUI and showed an empty screen, and every KILL_ALL level showed Slurm, even
// level 7, where Iggy is the only bad microbe (PlatformGame.as:337-358). Both are built here
// from the microbe's own idle frame, in the style of the shipped pictures (microbes on black
// with a soft white glow, 151 x 168.5 status units). Layout entries are [centre x, centre y,
// scale, flip] in status units.
const PORTRAITS = {
  patty: { symbol: 'patty_icon', layout: [[75.5, 86, 0.82, false]] },
  iggy: { symbol: 'iggy_icon', layout: [[48, 56, 1.3, false], [104, 50, 1.2, true], [112, 108, 1.35, true], [40, 116, 1.25, false], [76, 86, 1.45, false]] },
};
const portraitCache = new Map();

// The portrait for a goal, or null to keep the original picture. badTypes: the type ids of
// the level's bad microbes.
export function goalPortrait(goal, badTypes = []) {
  if (!goal) return null;
  if (goal.goalType === G.PHOTOGRAPH_SPECIFIC && goal.microbeType === T.PATTY) return 'patty';
  if (goal.goalType === G.KILL_ALL && badTypes.length && badTypes.every(t => t === T.IGGY)) return 'iggy';
  return null;
}

// Composes a portrait once (at the atlases' 2x) and caches it; null until its art is loaded.
function portraitCanvas(name) {
  if (portraitCache.has(name)) return portraitCache.get(name);
  const p = PORTRAITS[name];
  const sym = p && sprites.symbol(p.symbol);
  if (!sym || !sprites.hasSymbol('status_background')) return null;
  const K = 2, W = 302, H = 337;
  const make = () => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }));
  // The idle frame's bounds about the registration point (its label-start image).
  const fr = (sym.frames || [])[(sym.labels && sym.labels.idle ? sym.labels.idle : 1) - 1];
  const s0 = sym.scale || 1;
  const b = fr ? { x: -fr[5] / s0, y: -fr[6] / s0, w: fr[3] / s0, h: fr[4] / s0 } : { x: 0, y: 0, w: 50, h: 50 };
  const art = make(), ag = art.getContext('2d');
  ag.setTransform(K, 0, 0, K, 0, 0);
  for (const [cx, cy, s, flip] of p.layout) {
    const rx = cx - (flip ? -(b.x + b.w / 2) : b.x + b.w / 2) * s, ry = cy - (b.y + b.h / 2) * s;
    sprites.drawSymbol(ag, p.symbol, 'idle', 0, rx, ry, { flipX: flip, scaleX: s, scaleY: s, pivotX: rx, pivotY: ry });
  }
  const out = make(), g = out.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.shadowColor = 'rgba(255, 255, 255, 0.85)';
  g.shadowBlur = 7;
  g.drawImage(art, 0, 0);
  g.shadowBlur = 0;
  g.drawImage(art, 0, 0);
  portraitCache.set(name, out);
  return out;
}

// Goal as a sentence, e.g. "Photograph 3 Lucy".
export function goalText(goal) {
  const n = goal.required;
  switch (goal.type) {
    case G.PHOTOGRAPH_SPECIFIC: return t('goal.photoSpecific', { n, microbe: t('microbe.' + goal.microbeType) });
    case G.PHOTOGRAPH_GOOD: return t('goal.photoGood', { n });
    case G.PHOTOGRAPH_ANY: return t('goal.photoAny', { n });
    case G.KILL_ALL: return t('goal.killAll', { n });
    case G.YOGURT: return t('goal.yogurt', { n });
    case G.ANTIBIOTIC: return t('goal.antibiotic', { n });
    default: return t('goal.other');
  }
}

const mat = (ctx, m) => ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

export class Hud {
  /**
   * @param {object} app  engine app (ui layer, announce)
   * @param {object} o
   * @param {() => void} o.onPhone  called when the ePhone is tapped or clicked
   */
  constructor(app, { onPhone } = {}) {
    this.app = app;
    this.live = el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    this.phoneBtn = el('button', { type: 'button', id: 'pf-ephone', class: 'pf-ephone-hit', 'aria-label': t('hud.phone'), tabindex: '-1' });
    this.phoneBtn.addEventListener('click', e => { e.preventDefault(); if (onPhone) onPhone(); });
    if (!document.getElementById('pf-hud-style')) {
      document.head.append(el('style', { id: 'pf-hud-style' }, '.pf-ephone-hit { position: absolute; background: transparent; border: 0; padding: 0; border-radius: 14px; cursor: pointer; -webkit-tap-highlight-color: transparent; } .pf-ephone-hit:focus-visible { outline: 4px solid var(--accent-2); }'));
    }
    app.ui.append(this.live, this.phoneBtn);
    this.touchMix = 0;          // 0 = keyboard layout, 1 = touch layout (eased)
    this.visible = true;
  }

  // Starts a level: counters jump to the game's values without animating.
  reset(game) {
    this.score = game.score;
    this.shownScore = game.score;
    this.digitPop = [0, 0, 0, 0];
    this.lastDigits = this.digits(game.score);
    this.scoreBump = 0;
    this.lives = game.player.lives;
    this.heartAnim = [0, 0, 0];     // ticks since each heart was lost (0 = not lost)
    this.goal = game.goalsView[0] || null;
    const bad = [...new Set(game.entities.filter(e => e && e.isBad && e.type !== T.SUPERINFECTION).map(e => e.type))];
    this.portrait = goalPortrait(this.goal, bad);
    this.ticksShown = game.goalTicks;
    this.heldTicks = 0;             // ticks still flying towards the phone (sparkle trails)
    this.tickPop = [0, 0, 0, 0, 0, 0];
    this.portalOpen = false;
    this.flip = 0;                  // goal picture flip, 0..1 while turning to the exit picture
    this.ring = 0;                  // ePhone wiggle ticks
    this.banner = null;             // { text, age }
    this.secs = game.secondsLeft;
    this.timerPulse = 0;
    this.age = 0;
    this.announceState(game, true);
  }

  digits(n) {
    const v = clamp(Math.round(n), 0, 9999);
    return [Math.floor(v / 1000) % 10, Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10];
  }

  // What the ePhone status screen shows (for the test probe): picture and mode icon.
  goalPicture() {
    return {
      picture: this.portalOpen ? 'exit_status' : this.portrait ? `portrait:${this.portrait}` : goalImage(this.goal),
      mode: goalMode(this.goal),
    };
  }

  // A photo's sparkle trail is on its way: its tick box fills when it lands (landTick()).
  holdTick() { this.heldTicks++; }
  landTick() {
    this.heldTicks = Math.max(0, this.heldTicks - 1);
  }

  showBanner(text, ticks = 170) { this.banner = { text, age: 0, ticks }; this.bannerY = null; }

  // Per engine tick while the game is paused: only the layout follows the input device.
  updateLayout(device) {
    const target = device === 'touch' ? 1 : 0;
    this.touchMix += (target - this.touchMix) * 0.18;
    if (Math.abs(target - this.touchMix) < 0.002) this.touchMix = target;
    this.placePhoneButton();
  }

  // Per engine tick (15 ms). device: 'touch' | 'keyboard' | 'gamepad'.
  update(game, device) {
    this.age++;
    this.updateLayout(device);

    // Score: ease towards the real score; pop the digits that change.
    this.score = game.score;
    const d = this.score - this.shownScore;
    if (d !== 0) {
      this.shownScore += Math.abs(d) < 0.6 ? d : d * 0.14 + Math.sign(d) * 0.35;
      if (Math.sign(this.score - this.shownScore) !== Math.sign(d)) this.shownScore = this.score;
    }
    const digits = this.digits(this.shownScore);
    digits.forEach((v, i) => { if (v !== this.lastDigits[i]) { this.digitPop[i] = 1; this.scoreBump = 1; } });
    this.lastDigits = digits;
    for (let i = 0; i < 4; i++) this.digitPop[i] = Math.max(0, this.digitPop[i] - 0.09);
    this.scoreBump = Math.max(0, this.scoreBump - 0.06);

    // Hearts: heart0 (the leftmost) goes first, as the original hid heart0 .. heart(2 - lives)
    // (PlatformGame.as:598-601). Going from L to L' lives loses hearts 3 - L .. 3 - L' - 1.
    const lives = clamp(game.player.lives, 0, 3);
    if (lives < this.lives) for (let i = 3 - this.lives; i < 3 - lives; i++) this.heartAnim[i] = 1;
    if (lives > this.lives) for (let i = 3 - lives; i < 3 - this.lives; i++) this.heartAnim[i] = 0;
    this.lives = lives;
    for (let i = 0; i < 3; i++) if (this.heartAnim[i] > 0) this.heartAnim[i]++;

    // Goal ticks: shown = counted minus those still flying.
    const shown = Math.max(0, game.goalTicks - this.heldTicks);
    if (shown > this.ticksShown) {
      for (let i = this.ticksShown; i < shown && i < 6; i++) this.tickPop[i] = 1;
      this.ticksShown = shown;
    }
    for (let i = 0; i < 6; i++) this.tickPop[i] = Math.max(0, this.tickPop[i] - 0.05);

    if (game.portalOpen && !this.portalOpen) { this.portalOpen = true; this.flip = 0.0001; this.ring = 1; }
    if (this.flip > 0 && this.flip < 1) this.flip = Math.min(1, this.flip + 0.045);
    if (this.ring > 0) this.ring = this.ring >= 60 ? 0 : this.ring + 1;
    if (this.banner && ++this.banner.age > this.banner.ticks) this.banner = null;
    // The banner moves down out of the way while the player rides along the top of the screen.
    const want = game.player.particle.position.y < 150 ? 250 : 78;
    this.bannerY = this.bannerY == null ? want : this.bannerY + (want - this.bannerY) * 0.15;

    if (game.secondsLeft !== this.secs) { this.secs = game.secondsLeft; if (this.secs <= 20) this.timerPulse = 1; }
    this.timerPulse = Math.max(0, this.timerPulse - 0.04);

    this.announceState(game);
    this.placePhoneButton();
  }

  // Screen-reader summary, refreshed when lives, goal progress or the portal change.
  announceState(game, force = false) {
    const g = game.goalsView[0];
    const key = `${game.player.lives}|${game.goalTicks}|${game.portalOpen}`;
    if (!force && key === this._liveKey) return;
    this._liveKey = key;
    const goal = g ? goalText({ type: g.goalType, microbeType: g.microbeType, required: g.required }) : '';
    this.live.textContent = (game.portalOpen ? t('hud.portalOpen') + ' ' : '') + t('hud.live', { lives: Math.max(0, game.player.lives), score: game.score, secs: game.secondsLeft, goal, done: Math.min(game.goalTicks, g ? g.required : 0), required: g ? g.required : 0 });
  }

  // Offset of the whole ePhone for the current layout (touch play moves it to the left edge).
  phoneOffset(mix = this.touchMix) {
    const k = ease.inOutCubic(mix);
    return [TOUCH_PHONE_OFFSET[0] * k, TOUCH_PHONE_OFFSET[1] * k];
  }

  phoneRect() {
    const [dx, dy] = this.phoneOffset();
    return { x: PHONE_RECT.x + dx, y: PHONE_RECT.y + dy, w: PHONE_RECT.w, h: PHONE_RECT.h };
  }

  placePhoneButton() {
    const r = this.phoneRect();
    const s = this.phoneBtn.style;
    const v = `${r.x.toFixed(1)}|${r.y.toFixed(1)}|${this.visible}`;
    if (this._btnKey === v) return;
    this._btnKey = v;
    Object.assign(s, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', display: this.visible ? '' : 'none' });
  }

  // Centre of tick box i (0-based) in stage units, for sparkle trails.
  tickBoxCentre(i) {
    const phone = sprites.symbol('e_phone'), status = sprites.symbol('status');
    const [dx, dy] = this.phoneOffset();
    if (!phone || !status) { const r = this.phoneRect(); return { x: r.x + r.w / 2, y: r.y + r.h * 0.75 }; }
    const s = phone.tracks.screen[1], b = status.tracks['button' + (clamp(i, 0, 5) + 1)][0];
    // box centre (9, 9) through button matrix, then screen matrix, then root + layout offset
    const bx = b[0] * 9 + b[2] * 9 + b[4], by = b[1] * 9 + b[3] * 9 + b[5];
    const sx = s[0] * bx + s[2] * by + s[4], sy = s[1] * bx + s[3] * by + s[5];
    return { x: sx + ROOT.ephone[0] + dx, y: sy + ROOT.ephone[1] + dy };
  }

  // Draws the HUD. game: the PlatformGame; opts.phone = false hides the ePhone (while the intro
  // animates it). opts.whiteout (0..1): the antibiotic whiteout, which in the original (root
  // depth 194, NOTES.md 3.24) covered the timer (125), held antibiotic (123), hearts (111-119)
  // and score (89). The ePhone's depth after INIT_DIALOGUE's swapDepths
  // (this.getNextHighestDepth() of the game clip, PlatformGame.as:542) cannot be read from the
  // sources; the port keeps the phone and the banner above the white.
  draw(ctx, game, { phone = true, reducedMotion = false, whiteout = 0 } = {}) {
    if (!this.visible) { drawWhiteout(ctx, whiteout); return; }
    const have = sprites.hasSymbol('score');
    this.drawTimer(ctx, game, have);
    if (have) this.drawScore(ctx, reducedMotion); else this.drawFallbackScore(ctx);
    this.drawHearts(ctx, have, reducedMotion);
    if (game.antibioticHeld) {
      ctx.save();
      ctx.translate(ROOT.antibiotic[0], ROOT.antibiotic[1]);
      ctx.scale(ROOT.antibiotic[2], ROOT.antibiotic[2]);
      sprites.drawSymbol(ctx, 'antibiotic_pickup', null, 0, 0, 0);
      ctx.restore();
    }
    drawWhiteout(ctx, whiteout);
    if (phone) this.drawPhone(ctx, game, reducedMotion);
    if (this.banner) this.drawBanner(ctx);
  }

  drawScore(ctx, reducedMotion) {
    const score = sprites.symbol('score');
    ctx.save();
    ctx.translate(ROOT.score[0], ROOT.score[1]);
    if (this.scoreBump && !reducedMotion) {
      const s = 1 + 0.06 * ease.outQuad(this.scoreBump);
      ctx.translate(36.5, 16); ctx.scale(s, s); ctx.translate(-36.5, -16);
    }
    sprites.drawFrame(ctx, 'score', 1);
    this.lastDigits.forEach((v, i) => {
      ctx.save();
      mat(ctx, score.tracks[DIGITS[i]][0]);
      const p = reducedMotion ? 0 : this.digitPop[i];
      if (p) { const s = 1 + 0.35 * ease.outQuad(p); ctx.translate(5.2, 8.75); ctx.scale(s, s); ctx.translate(-5.2, -8.75); }
      sprites.drawFrame(ctx, 'digit', DIGIT_FRAME(v));
      ctx.restore();
    });
    ctx.restore();
  }

  drawFallbackScore(ctx) {
    ctx.save();
    ctx.fillStyle = '#1f7a2e'; ctx.fillRect(ROOT.score[0], ROOT.score[1], 73, 32);
    ctx.font = '800 22px Baloo, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8ffb0'; ctx.fillText(String(this.lastDigits.join('')), ROOT.score[0] + 36.5, ROOT.score[1] + 17);
    ctx.restore();
  }

  drawHearts(ctx, have, reducedMotion) {
    for (let i = 0; i < 3; i++) {
      const [x, y] = ROOT.hearts[i];
      const lost = i < 3 - this.lives;
      const a = this.heartAnim[i];
      // A lost heart is hidden, as in the original, once its burst has played.
      if (lost && (a === 0 || a >= 22)) continue;
      ctx.save();
      ctx.translate(x + 12.1, y + 11.65);
      if (lost) {
        // Burst: swell, then shrink and fade out.
        const k = Math.min(1, a / 22);
        const s = reducedMotion ? 1 : k < 0.3 ? 1 + k * 1.3 : 1.39 - (k - 0.3) * 0.7;
        ctx.scale(s, s);
        ctx.globalAlpha = 1 - k;
        ctx.translate(-12.1, -11.65);
        if (have) sprites.drawFrame(ctx, 'heart', 1, { tint: '#7a6a8a', tintAmount: Math.min(1, k * 1.4) });
        else drawHeartShape(ctx, '#888');
      } else {
        const beat = this.lives === 1 && !reducedMotion ? 1 + 0.12 * Math.max(0, Math.sin(this.age * 0.16)) ** 6 : 1;
        ctx.scale(beat, beat);
        ctx.translate(-12.1, -11.65);
        if (have) sprites.drawFrame(ctx, 'heart', 1); else drawHeartShape(ctx, '#e0304a');
      }
      ctx.restore();
    }
  }

  // The original 'timeLeft' field: bold black Arial 16 px, left-aligned in a text box at
  // (333.95, 17.5) with Flash's 2 px gutter (DefineEditText 1499, PlatformGame.as:561). Added:
  // the SWF's unused 'timer' stopwatch to the left of the number, and in the last 20 s the number
  // turns red and pops each second (logged in NOTES-platformer-decisions.md).
  drawTimer(ctx, game, have) {
    const [x, y, , h] = ROOT.timer;
    const secs = Math.max(0, game.secondsLeft);
    const low = secs <= 20;
    const text = String(secs);
    const tx = x + 2, cy = y + h / 2 + 1;
    ctx.save();
    if (have && sprites.hasSymbol('timer')) {
      const timer = sprites.symbol('timer');
      const elapsed = 1 - game.timeLeftSteps / 6000;
      const p = clamp(Math.floor(elapsed * 13), 0, 12);
      ctx.save();
      ctx.translate(tx - 30, y - 3);
      const s = 0.43 * (1 + 0.15 * ease.outQuad(this.timerPulse));
      ctx.translate(13, 14.7); ctx.scale(s, s); ctx.rotate(low ? Math.sin(this.age * 0.9) * 0.08 * this.timerPulse : 0); ctx.translate(-30, -34);
      sprites.drawFrame(ctx, 'timer', timer.labels['p' + p] || 1);
      ctx.restore();
    }
    ctx.font = 'bold 16px Arial, "Helvetica Neue", Helvetica, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const s = 1 + 0.25 * ease.outQuad(this.timerPulse);
    ctx.translate(tx, cy); ctx.scale(s, s);
    ctx.fillStyle = low ? '#c4102a' : '#000';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // The small ePhone with the status screen. Also used by the intro for the resting phone.
  drawPhone(ctx, game, reducedMotion = false, { offset = this.phoneOffset(), alpha = 1 } = {}) {
    if (!sprites.hasSymbol('e_phone')) { this.drawFallbackPhone(ctx, game, offset); return; }
    const phone = sprites.symbol('e_phone');
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(ROOT.ephone[0] + offset[0], ROOT.ephone[1] + offset[1]);
    if (this.ring && !reducedMotion) {
      const k = 1 - this.ring / 60;
      const r = Math.sin(this.ring * 0.95) * 0.07 * k;
      const cx = PHONE_RECT.x + PHONE_RECT.w / 2, cy = PHONE_RECT.y + PHONE_RECT.h / 2;
      ctx.translate(cx, cy); ctx.rotate(r); ctx.translate(-cx, -cy);
    }
    sprites.drawFrame(ctx, 'e_phone', 2);
    ctx.save();
    mat(ctx, phone.tracks.screen[1]);
    this.drawStatus(ctx);
    ctx.restore();
    ctx.restore();
  }

  // The 'status' screen (180 x 293 in its own units): goal picture, mode icon, tick boxes.
  drawStatus(ctx) {
    const st = sprites.symbol('status');
    if (!st) return;
    sprites.drawFrame(ctx, 'status', 1);
    // Goal picture, flipping over to the exit picture when the portal opens.
    ctx.save();
    mat(ctx, st.tracks.background[0]);
    const f = this.flip;
    const showExit = this.portalOpen && f >= 0.5;
    const sx = f > 0 && f < 1 ? Math.abs(Math.cos(f * Math.PI)) : 1;
    ctx.translate(75.35, 0); ctx.scale(sx, 1); ctx.translate(-75.35, 0);
    const img = showExit ? 'exit_status' : goalImage(this.goal);
    const portrait = !showExit && this.portrait ? portraitCanvas(this.portrait) : null;
    if (portrait) ctx.drawImage(portrait, 0, 0, portrait.width, portrait.height, 0, 0, portrait.width / 2, portrait.height / 2);
    else if (!sprites.drawFrame(ctx, img, 1)) sprites.drawFrame(ctx, 'status_background', 1);
    if (showExit && f < 1) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - f) * 1.6; sprites.drawFrame(ctx, 'exit_status', 1); }
    ctx.restore();
    const mode = goalMode(this.goal);
    if (mode) { ctx.save(); mat(ctx, st.tracks.mode[0]); sprites.drawFrame(ctx, mode, 1); ctx.restore(); }
    // Every counted goal event ticks the next box, with no bound (PlatformGame.as:918-925), so an
    // overshoot (two kills in one step in levels 5 and 6, which place 4 bad microbes for 3) also
    // ticks a grey box.
    const required = this.goal ? this.goal.required : 0;
    for (let b = 0; b < 6; b++) {
      ctx.save();
      mat(ctx, st.tracks['button' + (b + 1)][0]);
      const state = b < this.ticksShown ? 'tick' : b < required ? 'empty' : 'grey';
      const p = this.tickPop[b];
      if (p) { const s = 1 + 0.6 * Math.sin(p * Math.PI) * p; ctx.translate(9, 9); ctx.scale(s, s); ctx.translate(-9, -9); }
      sprites.drawFrame(ctx, 'tick_box_button', TICK_FRAME[state]);
      ctx.restore();
    }
  }

  drawFallbackPhone(ctx, game, offset) {
    const r = { x: PHONE_RECT.x + offset[0], y: PHONE_RECT.y + offset[1], w: PHONE_RECT.w, h: PHONE_RECT.h };
    ctx.save();
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill(); ctx.stroke();
    const req = this.goal ? this.goal.required : 0;
    for (let b = 0; b < 6; b++) {
      ctx.fillStyle = b < this.ticksShown ? '#3c3' : b < req ? '#fff' : '#555';
      ctx.fillRect(r.x + 10 + (b % 3) * 26, r.y + 110 + Math.floor(b / 3) * 26, 18, 18);
    }
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    const k = b.age < 14 ? ease.outBack(b.age / 14) : b.age > b.ticks - 16 ? 1 - ease.inQuad((b.age - (b.ticks - 16)) / 16) : 1;
    ctx.save();
    ctx.font = '800 24px Baloo, "Trebuchet MS", sans-serif';
    const w = ctx.measureText(b.text).width + 44;
    ctx.translate(400, this.bannerY ?? 78);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.fillStyle = 'rgba(27, 22, 64, 0.86)';
    roundRectPath(ctx, -w / 2, -22, w, 44, 22); ctx.fill();
    ctx.strokeStyle = '#5fd4ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.text, 0, 2);
    ctx.restore();
  }

  setVisible(v) { this.visible = v; this.placePhoneButton(); }

  destroy() { this.live.remove(); this.phoneBtn.remove(); }
}

function drawWhiteout(ctx, k) {
  if (!(k > 0)) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k)})`;
  ctx.fillRect(0, 0, 800, 450);
  ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeartShape(ctx, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.bezierCurveTo(-4, 11, 2, -2, 12, 6);
  ctx.bezierCurveTo(22, -2, 28, 11, 12, 22);
  ctx.fill();
}
