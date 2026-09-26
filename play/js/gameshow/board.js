// The question board (eBugGameShow.swf 'question_board', sprite 77, 800 x 450): blue microbe
// background, "Question N" and the question top left, "10 Points" beside the (never driven)
// stopwatch, three big answer buttons (GameShow.as showBoard(), :184-203; NOTES 6.5).
//
// The art and all text are drawn on the canvas, so they animate together; transparent DOM
// buttons sit exactly over the button art as the tap and focus targets (at least 44 CSS px),
// with the label as their accessible name. Keys: 1 / 2 / 3 answer at once; up / down (or left /
// right) move the selection and Enter or Space chooses it. Touch: tap a button.
import { el } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { keyFor, tp } from '../ui/prompts.js';
import { audio } from '../core/audio.js';
import { drawFrame, hasArt, track } from './art.js';
import { wrap, fitLine, VERDANA, BALOO, roundRect } from './text.js';

const BUTTONS = ['agree', 'dont_know', 'disagree'];
// Button art: 219 x 79 with its registration point 3.5, 3 in from the top-left.
const BTN_W = 219, BTN_H = 79, BTN_OX = 3.5, BTN_OY = 3;
const FALLBACK_POS = [[293.75, 172.25], [293.75, 261.85], [293.75, 352.55]];
// Text boxes (NOTES 6.5, measured from the capture 021-r1-blind-q1-board@2x.png).
const HEADING = { x: 84, baseline: 48 };
const BODY = { x: 84, top: 56, width: 556, bottom: 162 };
const POINTS = { right: 724, baseline: 42 };
const GUARD_TICKS = 20;          // answers are ignored for 0.3 s after the board appears
const IN_TICKS = 24;

export class Board {
  constructor(app, { onChoose }) {
    this.app = app;
    this.onChoose = onChoose;
    this.visible = false;
    this.age = 0;
    this.alpha = 0;
    this.selected = -1;
    this.hover = -1;
    this.pressed = -1;
    this.locked = -1;
    this.lockAge = 0;
    this.question = null;
    this.labels = ['Agree', "Don't Know", 'Disagree'];
    this.layout = null;
    this.leaving = false;
    this.root = el('div', { class: 'gs-board', role: 'group' });
    this.root.hidden = true;
    this.buttons = BUTTONS.map((b, i) => {
      const [x, y] = this.buttonPos(i);
      const node = el('button', {
        type: 'button', class: 'gs-answer', id: `gs-answer-${i + 1}`, 'data-index': i,
        style: { left: `${x - BTN_OX}px`, top: `${y - BTN_OY}px`, width: `${BTN_W}px`, height: `${BTN_H}px` },
      });
      // A mouse over an answer selects it (and focuses it, since Enter on a focused button
      // clicks it natively), so the one highlighted button is always the one Enter picks.
      node.addEventListener('pointerenter', e => {
        if (e.pointerType === 'mouse' && this.locked < 0) this.select(i);
        this.hover = i;
      });
      node.addEventListener('pointerleave', () => { if (this.hover === i) this.hover = -1; if (this.pressed === i) this.pressed = -1; });
      node.addEventListener('pointerdown', () => { this.pressed = i; });
      node.addEventListener('pointerup', () => { this.pressed = -1; });
      node.addEventListener('click', e => { e.preventDefault(); this.choose(i); });
      node.addEventListener('focus', () => { if (this.locked < 0) this.selected = i; });
      return node;
    });
    this.root.append(...this.buttons);
    app.ui.append(this.root);
  }

  buttonPos(i) {
    const m = track('gs_question_board', `${BUTTONS[i]}_button`);
    return m ? [m[4], m[5]] : FALLBACK_POS[i];
  }

  buttonRect(i) {
    const [x, y] = this.buttonPos(i);
    return { x: x - BTN_OX, y: y - BTN_OY, w: BTN_W, h: BTN_H };
  }

  // question: { text, score }, n: 1-based number, total, labels: three button labels.
  // lang: BCP 47 tag of the quiz language, put on the answer buttons (their labels are quiz text).
  show(question, n, total, labels, lang = null) {
    this.question = { ...question, n, total };
    this.labels = labels;
    this.visible = true;
    this.leaving = false;
    this.age = 0;
    this.selected = -1;
    this.hover = -1;
    this.pressed = -1;
    this.locked = -1;
    this.lockAge = 0;
    this.layout = this.computeLayout();
    this.root.hidden = false;
    this.root.setAttribute('aria-label', t('gameshow.questionAria', { n, total, text: question.text }));
    this.buttons.forEach((b, i) => {
      b.setAttribute('aria-label', labels[i]); b.textContent = ''; b.append(el('span', { class: 'sr-only' }, labels[i])); b.disabled = false;
      if (lang) b.lang = lang; else b.removeAttribute('lang');
    });
    audio.play('gsBoard');
    if (this.app.announce) this.app.announce(t('gameshow.questionAria', { n, total, text: question.text }));
  }

  // Starts the exit animation (the DOM targets go at once).
  hide() {
    this.leaving = true;
    this.root.hidden = true;
    if (this.root.contains(document.activeElement)) document.getElementById('game')?.focus({ preventScroll: true });
  }

  get accepting() { return this.visible && !this.leaving && this.locked < 0 && this.age >= GUARD_TICKS; }

  choose(i) {
    if (!this.accepting || i < 0 || i > 2) return false;
    this.locked = i;
    this.selected = i;
    this.lockAge = 0;
    this.buttons.forEach(b => { b.disabled = true; });
    audio.play('gsLock');
    this.onChoose(i);
    return true;
  }

  select(i) {
    if (this.locked >= 0) return;
    this.hover = -1;           // the keyboard moved on: the button under the mouse is no longer lit
    const next = (i + 3) % 3;
    if (next !== this.selected) audio.play('gsSelect');
    this.selected = next;
    if (this.app.input.lastDevice !== 'touch') this.buttons[next].focus({ preventScroll: true });
  }

  // Per tick while shown: keyboard and gamepad input.
  update(input) {
    if (!this.visible) return;
    this.age++;
    if (this.leaving) {
      this.alpha = Math.max(0, this.alpha - 1 / 14);
      if (this.alpha <= 0) this.visible = false;
      return;
    }
    this.alpha = Math.min(1, this.age / IN_TICKS);
    if (this.locked >= 0) { this.lockAge++; return; }
    if (!this.accepting) return;
    if (input.pressed('answer1')) { this.choose(0); return; }
    if (input.pressed('answer2')) { this.choose(1); return; }
    if (input.pressed('answer3')) { this.choose(2); return; }
    const up = input.pressed('up') || input.pressed('left');
    const down = input.pressed('down') || input.pressed('right');
    if (up) { this.select(this.selected < 0 ? 2 : this.selected - 1); return; }
    if (down) { this.select(this.selected < 0 ? 0 : this.selected + 1); return; }
    // Space is also bound to jump with ArrowUp and W, so only a jump press that is not an up
    // press confirms. A press with nothing selected selects the first answer.
    const confirm = input.pressed('confirm') || (input.pressed('jump') && !input.isDown('up'));
    if (confirm) {
      if (this.selected < 0) this.select(0);
      else this.choose(this.selected);
    }
  }

  computeLayout() {
    const q = this.question;
    const scale = Math.max(0.8, Math.min(2, Number(this.app.settings.get('textScale')) || 1));
    const heading = t('gameshow.boardHeading', { n: q.n });
    const points = t('gameshow.boardPoints', { score: q.score });
    // Question text: 20 px Verdana Bold at 100% text size (the original field was 16 px; the
    // board has room, and this is the line the player must read), shrunk to fit the box.
    const max = BODY.bottom - BODY.top;
    let size = Math.round(20 * scale), lines = null, lh = 0;
    for (; size >= 12; size--) {
      lh = Math.round(size * 1.25);
      lines = wrap(q.text, `700 ${size}px ${VERDANA}`, BODY.width);
      if (lines.length * lh <= max) break;
    }
    if (size < 12) { size = 12; lh = 15; lines = wrap(q.text, `700 12px ${VERDANA}`, BODY.width); }
    // Button labels: the original's static text, white Verdana Bold with no outline, 23 px (it
    // measures 151 / 76.5 / 115 px wide in capture 021), shrunk for long translations.
    const labelFits = this.labels.map(l => fitLine(l, s => `700 ${s}px ${VERDANA}`, BTN_W - 34, Math.round(23 * Math.min(scale, 1.3)), 14));
    return {
      heading, points, size, lineHeight: lh, lines: lines.map(l => l.text),
      bodyBottom: BODY.top + lines.length * lh, maxBottom: BODY.bottom,
      fits: lines.length * lh <= max && lines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim() === q.text.replace(/\s+/g, ' ').trim(),
      labels: this.labels.map((l, i) => ({ text: l, size: labelFits[i].size, width: labelFits[i].width, fits: labelFits[i].fits })),
    };
  }

  draw(ctx, { device = 'keyboard', reducedMotion = false, tick = 0 } = {}) {
    if (!this.visible || this.alpha <= 0) return;
    const a = this.alpha;
    const e = reducedMotion ? 1 : 1 - Math.pow(1 - a, 3);
    ctx.save();
    ctx.globalAlpha *= reducedMotion ? a : Math.min(1, a * 1.4);
    if (!reducedMotion) {
      const s = 0.94 + 0.06 * e;
      ctx.translate(400, 225); ctx.scale(s, s); ctx.translate(-400, -225);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 800, 450);
    if (!drawFrame(ctx, 'gs_question_board', 1)) this.drawFallbackBoard(ctx);
    const L = this.layout;
    // Heading and points.
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${VERDANA}`;
    ctx.fillText(L.heading, HEADING.x, HEADING.baseline);
    ctx.textAlign = 'right';
    ctx.font = `700 17px ${VERDANA}`;
    ctx.fillText(L.points, POINTS.right, POINTS.baseline);
    // Question, revealed line by line as the board arrives.
    ctx.textAlign = 'left';
    ctx.font = `700 ${L.size}px ${VERDANA}`;
    ctx.shadowColor = 'rgba(0, 30, 70, 0.55)';
    ctx.shadowOffsetY = 1.5;
    ctx.shadowBlur = 2;
    L.lines.forEach((line, i) => {
      const k = reducedMotion ? 1 : Math.max(0, Math.min(1, (this.age - 4 - i * 3) / 8));
      if (k <= 0) return;
      ctx.globalAlpha = (reducedMotion ? a : Math.min(1, a * 1.4)) * k;
      ctx.fillText(line, BODY.x + (1 - k) * 12, BODY.top + L.size + i * L.lineHeight);
    });
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = reducedMotion ? a : Math.min(1, a * 1.4);
    // Buttons: pop in one after another, then react to hover, selection and the lock-in.
    for (let i = 0; i < 3; i++) this.drawButton(ctx, i, { device, reducedMotion, tick });
    // How to answer, for the input in use and the player's key bindings: white 17 px with a
    // dark outline (at least 14 CSS px on a 667 px wide phone, well above 4.5:1 on the board).
    if (this.locked < 0) {
      const hint = this.hintText(device);
      const f = fitLine(hint, z => `700 ${z}px ${VERDANA}`, 700, 17, 12);
      ctx.globalAlpha *= Math.max(0, Math.min(1, (this.age - 30) / 20));
      ctx.font = `700 ${f.size}px ${VERDANA}`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0, 32, 64, 0.85)';
      ctx.strokeText(hint, 400, 444);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(hint, 400, 444);
    }
    ctx.restore();
  }

  hintText(device) {
    if (device === 'touch') return t('gameshow.answerHint.touch');
    if (device === 'gamepad') return t('gameshow.answerHint.gamepad');
    return tp('gameshow.answerHint.keyboard', { key_answer1: keyFor('answer1'), key_answer2: keyFor('answer2'), key_answer3: keyFor('answer3'), key_up: keyFor('up'), key_down: keyFor('down') });
  }

  drawButton(ctx, i, { device, reducedMotion, tick }) {
    const [x, y] = this.buttonPos(i);
    const r = this.buttonRect(i);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const appear = reducedMotion ? 1 : Math.max(0, Math.min(1, (this.age - 6 - i * 4) / 10));
    if (appear <= 0) return;
    const back = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    let s = reducedMotion ? 1 : back(appear);
    const locked = this.locked >= 0;
    const isLocked = this.locked === i;
    const active = !locked && (this.hover === i || this.selected === i);
    // Art frames: 1 up, 2 over (orange rim), 3 down (green rim). The green 'down' frame shows only
    // while a finger or the mouse is held on it, as in Flash; a locked answer keeps the orange
    // rim so that green never hints at a verdict before the host gives it.
    let frame = 1;
    if (this.pressed === i && !locked) frame = 3;
    else if (isLocked || active) frame = 2;
    if (isLocked && !reducedMotion) s *= 1 + 0.07 * Math.sin(Math.min(1, this.lockAge / 12) * Math.PI);
    else if (active && !reducedMotion) s *= 1.03;
    ctx.save();
    if (locked && !isLocked) ctx.globalAlpha *= 0.45;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    // Glow behind the selected or locked button.
    if (isLocked || active) {
      const pulse = isLocked ? 1 : 0.6 + 0.4 * Math.sin(tick * 0.12);
      ctx.save();
      ctx.shadowColor = isLocked ? 'rgba(255, 216, 74, 0.95)' : `rgba(255, 255, 255, ${0.7 * pulse})`;
      ctx.shadowBlur = isLocked ? 22 : 14;
      ctx.fillStyle = isLocked ? 'rgba(255, 216, 74, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      roundRect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 8, 16);
      ctx.fill();
      ctx.restore();
    }
    if (!drawFrame(ctx, `gs_button_${BUTTONS[i]}`, frame, [1, 0, 0, 1, x, y])) {
      ctx.fillStyle = frame === 3 ? '#3aa3ee' : frame === 2 ? '#8fd3ff' : '#6cc3fe';
      ctx.strokeStyle = '#0b3f6e';
      ctx.lineWidth = 5;
      roundRect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 8, 14);
      ctx.fill(); ctx.stroke();
    }
    const L = this.layout.labels[i];
    ctx.font = `700 ${L.size}px ${VERDANA}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(L.text, cx, cy + 1 + (frame === 3 ? 2 : 0));
    // Key badge for keyboard players: the key bound to answer 1 / 2 / 3 (none when unbound).
    const key = device === 'keyboard' && !locked ? keyFor(`answer${i + 1}`) : '?';
    if (key !== '?') {
      ctx.font = `800 17px ${BALOO}`;
      const bw = Math.max(24, Math.ceil(ctx.measureText(key).width) + 12);
      const bx = r.x - 6 - bw, by = cy - 13;
      ctx.fillStyle = 'rgba(8, 40, 80, 0.55)';
      roundRect(ctx, bx, by, bw, 26, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx, by, bw, 26, 6);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(key, bx + bw / 2, by + 14);
    }
    ctx.restore();
  }

  drawFallbackBoard(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 450);
    g.addColorStop(0, '#0a8fcc');
    g.addColorStop(1, '#027ab3');
    ctx.fillStyle = g;
    ctx.fillRect(35, 0, 730, 450);
  }

  destroy() { this.root.remove(); }

  state(device = 'keyboard') {
    return {
      visible: this.visible, alpha: this.alpha, accepting: this.accepting, selected: this.selected, locked: this.locked,
      hover: this.hover, hint: this.hintText(device), badges: [1, 2, 3].map(n => keyFor(`answer${n}`)),
      layout: this.layout,
      buttons: this.buttons.map((b, i) => ({ id: b.id, label: this.labels[i], rect: this.buttonRect(i), disabled: b.disabled })),
    };
  }
}
