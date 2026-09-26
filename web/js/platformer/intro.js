// The ePhone level briefing, recreated from the original art: the HUD phone grows and turns to
// landscape (e_phone frames 10-29), shows the level's pages (the 'level_intros' clip on its big
// screen, frame 30), then shrinks back (frames 40-59). Everything is placed through the
// symbol's tracks exported by the art pipeline: tracks.group[f-1] is the transform of the whole
// phone at frame f (drawn with the landscape frame-30 art) and tracks.bigScreen[f-1] places the
// level_intros page inside it (flash-platformer.md section 8.2).
//
// The page text is drawn here (translatable, from web/data/lang) in the original text boxes,
// whose matrices were read from level_intros (sprite 1479). Levels whose pages are not in the
// atlas yet show the text on the phone's blank screen.
//
// Controls: tap anywhere, Space / jump or Enter shows the whole page, then the next one; Esc /
// Backspace skips; the original's 5 s autoplay is kept (counted once the text is fully shown).
import { el, button } from '../ui/dom.js';
import { audio } from '../core/audio.js';
import { t, has } from '../core/i18n.js';
import { tp, device } from '../ui/prompts.js';
import { ease, clamp } from '../core/tween.js';
import { sprites } from './sprites.js';
import { PHONE_RECT } from './hud.js';

const TICK_MS = 15;
const FRAME_MS = 40;                          // 25 fps
const AUTOPLAY_TICKS = Math.round(5000 / TICK_MS);
const REVEAL_PER_TICK = 1.3;                  // typewriter speed, characters per 15 ms
const ROOT = [-1.8, 4.15];
// The level_intros text fields are Arial (body regular 10 px, titles 16 px, white, left-aligned;
// DefineEditText 1200-1232 in sprite 1479). Arial is not bundled, so platforms without it fall
// back to their own sans-serif, as Flash Player did for device fonts.
const PAGE_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

// Text boxes from level_intros, in its own units: rect [x0, y0, x1, y1] and matrix
// [a, b, c, d, tx, ty] (twips / 20). The boxes are turned +90 degrees; the big screen turns the
// whole clip -90 degrees, so the text reads horizontally on the landscape phone.
const BODY = { rect: [-2, -2, 102, 97.65], m: [0, 1.5961, -1.5961, 0, 167.8, 119.2] };
const TITLE = { rect: [-2, -2, 148, 50.9], m: [0, 1, -1, 0, 56.9, 139.95] };
// Body text box of a page: rect width and the field's position (DefineEditText placements in
// sprite 1479, read from the SWF; every one is Arial 10 white, turned by the 1.5961 matrix).
const box = (x1, tx, ty) => ({ rect: [-2, -2, x1, 97.65], m: [0, 1.5961, -1.5961, 0, tx, ty] });
const WIDE = box(137.7, 168.45, 76);
// Page frames are absolute frame numbers in level_intros (the stop() frames of each block);
// levels 2-10 draw them from their own level_intros_<name> symbol (web/NOTES-art-decisions.md
// section 5), level 1 from level_intros.
export const INTRO_PAGES = {
  // level1 stops at frames 1, 3, 6, 9, 14, 20 and 30 (39 only sets finished = true).
  level1: [
    { frame: 1, body: BODY },
    { frame: 3, body: BODY },
    { frame: 6, body: BODY },
    { frame: 9, body: BODY },
    { frame: 14, title: TITLE, body: { rect: [-2, -2, 102, 97.65], m: [0, 1.5961, -1.5961, 0, 168.45, 12.8] } },
    { frame: 20, title: TITLE, titleKey: 'intro.level1.5', body: { rect: [-2, -2, 118.55, 97.65], m: [0, 1.5961, -1.5961, 0, 175.45, 13.8] } },
    { frame: 30, body: { rect: [-2, -2, 92.6, 99.15], m: [0, 1.5961, -1.5961, 0, 165.85, 15.15] } },
  ],
  level2: [{ frame: 40, body: BODY }, { frame: 45, body: BODY }],
  level3: [{ frame: 50, body: box(102, 168.45, 54.1) }, { frame: 60, body: box(102, 168.45, 54.1) }],
  level4: [{ frame: 70, body: box(102, 168.45, 54.1) }, { frame: 80, body: box(124.5, 176.45, 13.2) }],
  level5: [{ frame: 90, body: box(124.5, 168.45, 18.2) }, { frame: 100, body: box(124.5, 168.45, 18.2) }],
  level6: [{ frame: 110, body: box(100.8, 163.9, 116.05) }, { frame: 120, body: box(100.8, 170.9, 100.6) }, { frame: 130, body: box(137.7, 173.85, 72) }],
  level7: [{ frame: 140, body: WIDE }, { frame: 150, body: WIDE }, { frame: 160, body: WIDE }, { frame: 170, body: WIDE }],
  level8: [{ frame: 190, body: WIDE }, { frame: 200, body: WIDE }, { frame: 210, body: WIDE }],
  level9: [{ frame: 221, body: WIDE }, { frame: 230, body: WIDE }],
  level10: [241, 250, 260, 270, 280, 290].map(frame => ({ frame, body: WIDE })),
};
// Frames that hold a small looping inset animation while their page waits (the timeline stops
// on the page frame but its nested clips keep playing; the frames up to the next stop show that
// motion). [first, last] per page frame, from the level_intros scripts.
const PAGE_LOOPS = { 80: [80, 89], 110: [110, 119], 120: [120, 129], 130: [130, 139], 140: [140, 149], 150: [150, 159], 160: [160, 169], 170: [170, 179] };
// A text box for levels without page art: most of the big screen.
const GENERIC_BODY = { rect: [0, 0, 164, 94], m: [0, 1.5961, -1.5961, 0, 168, 16] };

const mat = (ctx, m) => ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

// Page text keys for a level: intro.<title>.1, .2, ... as long as they exist.
export function introKeys(title) {
  const keys = [];
  for (let i = 1; has(`intro.${title}.${i}`); i++) keys.push(`intro.${title}.${i}`);
  return keys;
}

export class IntroPhone {
  /**
   * @param {object} o
   * @param {object} o.app          engine app (ui layer, input)
   * @param {string} o.title        level title, e.g. 'level1' (level_intros label)
   * @param {boolean} o.briefing    re-opened from play: no autoplay, 'Back to game'
   * @param {() => number[]} o.phoneOffset  current HUD phone offset (touch layout)
   * @param {() => void} o.onDone   called once the phone has shrunk back
   * @param {boolean} o.reducedMotion
   */
  constructor({ app, title, briefing = false, phoneOffset = () => [0, 0], onDone = () => {}, reducedMotion = false }) {
    this.app = app;
    this.title = title;
    this.briefing = briefing;
    this.phoneOffset = phoneOffset;
    this.onDone = onDone;
    this.reducedMotion = reducedMotion;
    const keys = introKeys(title);
    const layout = INTRO_PAGES[title];
    this.pages = (keys.length ? keys : ['goal']).map((key, i) => ({ key, ...(layout && layout[i] ? layout[i] : { frame: 0, body: GENERIC_BODY }) }));
    // Levels 2-10 have their own page symbol; level 1 (and anything else) uses level_intros.
    this.symbol = sprites.hasSymbol(`level_intros_${title}`) ? `level_intros_${title}` : 'level_intros';
    this.labelFrame = sprites.symbol(this.symbol)?.labels?.[title] || 0;
    this.phase = 'grow';
    this.age = 0;            // ticks in the current phase
    this.page = 0;
    this.pageAge = 0;
    this.revealed = 0;
    this.revealedAt = -1;
    this.prevImage = null;   // page image frame fading out
    this.fade = 1;
    this.done = false;
    this.buildDom();
    audio.play('phoneGrow');
  }

  get text() {
    const p = this.pages[this.page];
    return p.key === 'goal' ? this.goalText || '' : tp(p.key);
  }

  buildDom() {
    this.tapLayer = el('div', { id: 'pf-intro-tap', class: 'pf-intro-tap', 'aria-hidden': 'true' });
    this.tapLayer.addEventListener('pointerdown', e => { e.preventDefault(); this.advance(); });
    this.next = button(t('intro.next'), () => this.advance(), { id: 'pf-intro-next', class: 'primary pf-intro-next' });
    this.skipBtn = button(this.briefing ? t('intro.back') : t('intro.skip'), () => this.skip(), { id: 'pf-intro-skip', class: 'pf-intro-skip' });
    this.region = el('div', { class: 'sr-only', role: 'dialog', 'aria-label': t('intro.title'), 'aria-live': 'polite' });
    this.root = el('div', { class: 'pf-intro' }, this.tapLayer, this.region, this.skipBtn, this.next);
    this.app.ui.append(this.root);
    this.refreshDom();
  }

  refreshDom() {
    const last = this.page >= this.pages.length - 1;
    this.next.textContent = last ? (this.briefing ? t('intro.back') : t('intro.play')) : t('intro.next') + ' ›';
    this.region.textContent = `${t('intro.page', { n: this.page + 1, total: this.pages.length })}. ${this.text}`;
  }

  // Next page (after first finishing the typewriter), or close after the last one. During the
  // grow animation it just finishes the animation.
  advance() {
    if (this.phase === 'grow') { this.age = 9999; return; }
    if (this.phase !== 'page') return;
    if (this.revealed < this.text.length) { this.revealed = this.text.length; this.revealedAt = this.pageAge; return; }
    if (this.page >= this.pages.length - 1) { this.close(); return; }
    const before = this.imageFrame(this.page);
    this.page++;
    this.pageAge = 0;
    this.revealed = this.reducedMotion ? Infinity : 0;
    this.revealedAt = -1;
    this.prevImage = before !== this.imageFrame(this.page) ? before : null;
    this.fade = this.prevImage ? 0 : 1;
    audio.play('pageTurn');
    this.refreshDom();
  }

  skip() { this.close(); }

  close() {
    if (this.phase === 'shrink' || this.phase === 'done') return;
    this.phase = 'shrink';
    this.age = 0;
    this.root.remove();
    audio.play('phoneShrink');
  }

  // The level_intros frame shown for page i (absolute frame numbers; 0 = no page art).
  imageFrame(i) {
    const p = this.pages[i];
    return p && p.frame && this.labelFrame ? p.frame : 0;
  }

  // The frame drawn now: a page with an inset animation loops through it while it waits.
  liveFrame(i) {
    const f = this.imageFrame(i);
    const loop = PAGE_LOOPS[f];
    if (!loop || this.reducedMotion) return f;
    const n = Math.floor(this.pageAge * TICK_MS / FRAME_MS);
    return loop[0] + (n % (loop[1] - loop[0] + 1));
  }

  update() {
    const input = this.app.input;
    this.age++;
    if (this.phase === 'grow') {
      if (this.reducedMotion || this.age * TICK_MS >= 20 * FRAME_MS) {
        this.phase = 'page'; this.age = 0; this.pageAge = 0;
        this.revealed = this.reducedMotion ? Infinity : 0;
        this.next.focus({ preventScroll: true });
        if (device() === 'touch') this.next.blur();
      }
      return;
    }
    if (this.phase === 'shrink') {
      if (this.reducedMotion || this.age * TICK_MS >= 20 * FRAME_MS) { this.phase = 'done'; this.done = true; this.onDone(); }
      return;
    }
    if (this.phase !== 'page') return;
    this.pageAge++;
    this.fade = Math.min(1, this.fade + 0.12);
    const total = this.text.length;
    if (this.revealed < total) {
      const before = Math.floor(this.revealed);
      this.revealed = Math.min(total, this.revealed + REVEAL_PER_TICK);
      if (Math.floor(this.revealed) !== before && before % 4 === 0 && this.text[before] !== ' ') audio.play('typeBlip', { volume: 0.5, rate: 0.9 + (before % 7) * 0.05 });
      if (this.revealed >= total) this.revealedAt = this.pageAge;
    }
    // Keys: Space / jump and Enter advance (Enter on a focused button activates it instead).
    const focused = document.activeElement && document.activeElement.tagName === 'BUTTON' && this.root.contains(document.activeElement);
    if (input.pressed('jump') || (input.pressed('confirm') && !focused)) this.advance();
    else if (input.pressed('back') || input.pressed('pause') || (this.briefing && input.pressed('phone'))) this.skip();
    else if (!this.briefing && this.revealedAt >= 0 && this.pageAge - this.revealedAt >= AUTOPLAY_TICKS) this.advance();
  }

  // Current e_phone frame (1-based) and how far the phone is towards its large state (0..1).
  phoneFrame() {
    const f = Math.floor(this.age * TICK_MS / FRAME_MS);
    if (this.phase === 'grow') return this.reducedMotion ? [30, 1] : [Math.min(29, 10 + f), Math.min(1, f / 20)];
    if (this.phase === 'shrink') return this.reducedMotion ? [30, 0] : [Math.min(59, 40 + f), Math.max(0, 1 - f / 20)];
    return [30, 1];
  }

  // Draws the phone and the page. Returns false once done. As in the original, the level and
  // the HUD around the phone stay at full brightness (no dimmed backdrop).
  draw(ctx) {
    if (this.done) return false;
    const phone = sprites.symbol('e_phone');
    const [f, k] = this.phoneFrame();
    const ek = ease.inOutQuad(k);
    const alpha = this.reducedMotion ? (this.phase === 'grow' ? Math.min(1, this.age / 10) : this.phase === 'shrink' ? Math.max(0, 1 - this.age / 10) : 1) : 1;
    ctx.save();
    const off = this.phoneOffset();
    ctx.globalAlpha = alpha;
    ctx.translate(ROOT[0] + off[0] * (1 - ek), ROOT[1] + off[1] * (1 - ek));
    if (phone) {
      ctx.save(); mat(ctx, phone.tracks.group[f - 1]); sprites.drawFrame(ctx, 'e_phone', 30); ctx.restore();
      ctx.save(); mat(ctx, phone.tracks.bigScreen[f - 1]); this.drawScreen(ctx, k); ctx.restore();
    } else {
      this.drawFallbackPhone(ctx, ek);
    }
    ctx.restore();
    if (this.phase === 'page') this.drawChrome(ctx);
    return true;
  }

  // The level_intros page (image + text) in its own units (180 x 293, portrait).
  drawScreen(ctx, k) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 180, 293); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 180, 293);
    const frame = this.phase === 'page' ? this.liveFrame(this.page) : this.imageFrame(this.page);
    if (this.prevImage && this.fade < 1) sprites.drawFrame(ctx, this.symbol, this.prevImage, { alpha: 1 - this.fade });
    if (frame) sprites.drawFrame(ctx, this.symbol, frame, { alpha: this.prevImage ? this.fade : 1 });
    const p = this.pages[this.page];
    const textAlpha = this.phase === 'page' ? Math.min(1, this.pageAge / 6) : this.phase === 'grow' ? clamp((k - 0.7) / 0.3, 0, 1) : clamp(k * 2 - 1, 0, 1);
    ctx.globalAlpha *= textAlpha;
    if (p.title) this.drawTitle(ctx, p);
    const shown = this.phase === 'page' ? Math.floor(this.revealed) : this.text.length;
    drawBox(ctx, p.body, this.text, shown, { size: 9.6, min: 6, color: '#ffffff', weight: 400 });
    ctx.restore();
  }

  drawTitle(ctx, p) {
    ctx.save();
    mat(ctx, p.title.m);
    const [x0, y0] = p.title.rect;
    ctx.font = `bold 16px ${PAGE_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b6f25a';
    const name = t(p.titleKey ? `${p.titleKey}.title` : `${p.key}.title`);
    ctx.fillText(name, x0 + 4, y0 + 6);
    const tag = t(p.titleKey ? `${p.titleKey}.tag` : `${p.key}.tag`);
    ctx.font = `bold 10px ${PAGE_FONT}`;
    const w = ctx.measureText(tag).width + 12;
    ctx.fillStyle = '#b6f25a';
    pill(ctx, x0 + 4, y0 + 28, w, 15, 7.5);
    ctx.fill();
    ctx.fillStyle = '#16301a';
    ctx.fillText(tag, x0 + 10, y0 + 31);
    ctx.restore();
  }

  drawFallbackPhone(ctx, k) {
    const s = 0.3 + 0.7 * k;
    ctx.save();
    ctx.translate(400, 225); ctx.scale(s, s);
    ctx.fillStyle = '#111'; pill(ctx, -370, -195, 740, 390, 60); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= clamp((k - 0.6) / 0.4, 0, 1);
    drawBox(ctx, { rect: [0, 0, 560, 300], m: [1, 0, 0, 1, 120, 75] }, this.text, this.phase === 'page' ? Math.floor(this.revealed) : this.text.length, { size: 28, min: 14, color: '#fff', weight: 400 });
    ctx.restore();
  }

  // Page dots on the phone's bottom bezel and the control hint below the phone.
  drawChrome(ctx) {
    const n = this.pages.length;
    ctx.save();
    const y = 399;
    for (let i = 0; i < n; i++) {
      const x = 405 + (i - (n - 1) / 2) * 16;
      ctx.beginPath();
      ctx.arc(x, y, i === this.page ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === this.page ? '#5fd4ff' : i < this.page ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
    const hint = device() === 'touch' ? t('prompt.touch.continue') : tp('prompt.keys.continue') + '   ·   ' + tp('prompt.keys.skip');
    const pulse = this.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(this.pageAge * 0.08);
    ctx.globalAlpha = (this.revealedAt >= 0 ? 1 : 0.55) * pulse;
    ctx.font = '700 15px Baloo, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,48,0.8)';
    ctx.strokeText(hint, 400, 436);
    ctx.fillStyle = '#fff';
    ctx.fillText(hint, 400, 436);
    // Autoplay progress: a thin bar under the dots.
    if (!this.briefing && this.revealedAt >= 0) {
      const p = clamp((this.pageAge - this.revealedAt) / AUTOPLAY_TICKS, 0, 1);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(360, 407, 90, 2.5);
      ctx.fillStyle = '#5fd4ff'; ctx.fillRect(360, 407, 90 * p, 2.5);
    }
    ctx.restore();
  }

  // Stage rectangle of the resting phone (for tests and hit areas).
  static restingRect(offset = [0, 0]) {
    return { x: PHONE_RECT.x + offset[0], y: PHONE_RECT.y + offset[1], w: PHONE_RECT.w, h: PHONE_RECT.h };
  }

  destroy() { this.root.remove(); }
}

// Draws wrapped text inside a box ({ rect, m }) in the box's own units, shrinking the font until
// it fits, and only the first `shown` characters (the layout does not move while typing).
function drawBox(ctx, box, text, shown, { size = 10, min = 6, color = '#fff', weight = 400 } = {}) {
  ctx.save();
  mat(ctx, box.m);
  const [x0, y0, x1, y1] = box.rect;
  const w = x1 - x0 - 6, h = y1 - y0 - 6;
  let fs = size, lines;
  for (;;) {
    ctx.font = `${weight} ${fs}px ${PAGE_FONT}`;
    lines = wrap(ctx, text, w);
    if (lines.length * fs * 1.22 <= h || fs <= min) break;
    fs -= 0.4;
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  let left = shown;
  lines.forEach((line, i) => {
    if (left <= 0) return;
    const part = line.slice(0, left);
    left -= line.length + 1;
    ctx.fillText(part, x0 + 3, y0 + 3 + i * fs * 1.22);
  });
  ctx.restore();
}

function wrap(ctx, text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function pill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
