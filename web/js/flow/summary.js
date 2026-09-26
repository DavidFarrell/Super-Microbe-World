// Summary page (movies/summary_page.swf): the white panel the 2009 game laid over the frozen level
// after a failed level, with its 50% black layer turning the orange level brown (capture 509),
// text0 "You Died!" or "You ran out of time.", text1 "click to try again" and the glossy "Click"
// button (GameController.as:283-308). The port restarts the same level (decision 11.9 #5).
// The same card, with the port's own lines, is the results card of a level played from Level
// select ('complete') and can show kitchen notes ('kitchen').
// Params: { kind: 'died'|'time'|'complete'|'kitchen', result, lines?, backdrop? (canvas),
//           buttons?: ['retry'|'next'|'levelSelect'|'menu'|'continue'], onComplete(choice) }.
import { el } from '../ui/dom.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { Particles, haptic } from '../core/fx.js';
import { fxRng } from '../core/rng.js';
import { ease } from '../core/tween.js';
import { tp } from '../ui/prompts.js';
import * as art from './art.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav } from './ui.js';

const CSS = `
.sm-art-btn { position: absolute; left: 292px; top: 352px; width: 219px; height: 79px; border: 0; border-radius: 16px; background: transparent;
  color: #fff; font: bold calc(30px * var(--text-scale, 1)) Verdana, "DejaVu Sans", sans-serif; text-shadow: 0 2px 2px rgba(0, 40, 90, 0.5); cursor: pointer; }
.sm-art-btn:focus-visible { outline: 4px solid #ffd23f; outline-offset: 3px; }
.sm-row { position: absolute; left: 60px; right: 60px; top: 360px; display: flex; justify-content: center; gap: 14px; }
.sm-text { position: absolute; left: 82px; width: 648px; top: 20px; text-align: center; color: #000; pointer-events: none; }
.sm-text h2 { margin: 0; font: bold calc(22px * var(--text-scale, 1))/1.25 Verdana, "DejaVu Sans", sans-serif; }
.sm-text p { margin: 8px 0 0; font: calc(17px * var(--text-scale, 1))/1.35 Verdana, "DejaVu Sans", sans-serif; }
.sm-stats { display: flex; justify-content: center; gap: 22px; margin-top: 22px; }
.sm-stat { min-width: 132px; padding: 12px 10px 10px; border-radius: 14px; background: #fff3d6; border: 3px solid #1b1640; font: 700 calc(14px * var(--text-scale, 1)) var(--body-font); }
.sm-stat b { display: block; font: 800 calc(34px * var(--text-scale, 1))/1 var(--ui-font); color: #1b1640; margin-bottom: 4px; }
.sm-stat.best b { color: #c2410c; }
.sm-new { display: inline-block; margin-top: 14px; padding: 4px 14px; border-radius: 999px; background: #ffd23f; font: 800 calc(18px * var(--text-scale, 1)) var(--ui-font); animation: sm-wobble 0.9s ease-in-out infinite alternate; }
@keyframes sm-wobble { from { transform: rotate(-3deg) scale(1); } to { transform: rotate(3deg) scale(1.06); } }
html.reduced-motion .sm-new { animation: none; }
`;

const WAKE = 16;   // ticks before the buttons respond
const LABELS = { retry: 'flow.summary.tryAgain', next: 'flow.summary.next', levelSelect: 'flow.summary.levelSelect', menu: 'flow.summary.menu', continue: 'flow.summary.continue' };

export function summaryScene(app) {
  let params = {}, ticks = 0, ready = false, done = false, reduced = false, popNav = null;
  let panelK = 0, rootEl = null, wake = null, artBtn = null, btnState = 1, countEl = null, countFrom = 0, countTo = 0, countK = 1;
  const particles = new Particles(300);

  function choose(choice) {
    if (done) return;
    done = true;
    const cb = params.onComplete;
    if (typeof cb === 'function') cb(choice);
    else app.scenes.go('splash', {}, { style: 'fade' });
  }

  function headingText() {
    const k = params.kind;
    const r = params.result || {};
    if (k === 'time') return t('flow.summary.outOfTime');
    if (k === 'died') return t('flow.summary.died');
    if (k === 'kitchen') return params.title || t('flow.summary.kitchenTitle');
    const n = /(\d+)$/.exec(String(r.level || ''))?.[1];
    if (/^kitchen/.test(String(r.level || ''))) return t('flow.summary.kitchenComplete', { n: Number(n) + 1 });
    return t('flow.summary.levelComplete', { n: n || '' });
  }

  function build() {
    const kind = params.kind || 'died';
    const buttons = (Array.isArray(params.buttons) && params.buttons.length ? params.buttons : [kind === 'complete' ? 'continue' : 'retry']).filter(b => LABELS[b]);
    const text = el('div', { class: 'sm-text' }, el('h2', { id: 'summary-heading' }, headingText()));
    if (kind === 'died' || kind === 'time') {
      text.append(el('p', {}, buttons.length === 1 ? tp('flow.summary.clickToTryAgain') : t('flow.summary.scoreKept', { score: (params.result && params.result.score) ?? 0 })));
    } else if (kind === 'complete') {
      const r = params.result || {};
      countTo = Number(r.points) || 0;
      countFrom = 0;
      countK = reduced ? 1 : 0;
      countEl = el('b', {}, String(reduced ? countTo : 0));
      const isBest = r.best != null && countTo >= r.best && countTo > 0;
      text.append(el('div', { class: 'sm-stats' },
        el('div', { class: 'sm-stat' }, countEl, t('flow.summary.points')),
        el('div', { class: 'sm-stat best' }, el('b', {}, String(r.best ?? countTo)), t('flow.summary.best'))));
      if (isBest) text.append(el('div', { class: 'sm-new' }, t('flow.summary.newBest')));
      if (r.next) text.append(el('p', {}, t('flow.summary.unlocked')));
    }
    for (const line of params.lines || []) text.append(el('p', {}, String(line)));
    const root = el('div', { class: 'fl-layer', id: 'summary-root', role: 'dialog', 'aria-labelledby': 'summary-heading' }, text);
    let first;
    if (buttons.length === 1) {
      artBtn = el('button', { type: 'button', class: 'sm-art-btn', id: `summary-${buttons[0]}` }, t(LABELS[buttons[0]]));
      artBtn.addEventListener('click', () => { audio.play('tap'); choose(buttons[0]); });
      artBtn.addEventListener('pointerenter', () => { btnState = 2; });
      artBtn.addEventListener('pointerleave', () => { btnState = 1; });
      artBtn.addEventListener('pointerdown', () => { btnState = 3; });
      artBtn.addEventListener('focus', () => { btnState = 2; });
      artBtn.addEventListener('blur', () => { btnState = 1; });
      root.append(artBtn);
      first = artBtn;
    } else {
      const row = el('div', { class: 'sm-row' }, buttons.map((b, i) => glossy(t(LABELS[b]), () => choose(b), { id: `summary-${b}`, class: i ? 'alt' : '' })));
      root.append(row);
      first = row.firstChild;
    }
    // Buttons wake after a moment, so a key or tap still held from the level cannot choose.
    root.inert = true;
    app.ui.append(root);
    rootEl = root;
    wake = () => {
      root.inert = false;
      popNav = pushNav(root, { initial: first, onBack: buttons.includes('levelSelect') ? () => choose('levelSelect') : null });
    };
    app.announce(`${headingText()}. ${root.textContent}`);
    window.__test && window.__test.register('summary', () => ({ kind, heading: headingText(), buttons: buttons.map(b => `summary-${b}`), ready, panel: panelK, awake: ticks >= WAKE }));
  }

  function drawBackdrop(ctx) {
    const b = params.backdrop;
    if (b && b.width) {
      try { ctx.drawImage(b, 0, 0, b.width, b.height, 0, 0, 800, 450); return; } catch { /* fall through */ }
    }
    ctx.fillStyle = params.kind === 'complete' || params.kind === 'kitchen' ? '#5fb4e8' : '#ff9900';
    ctx.fillRect(0, 0, 800, 450);
  }

  const scene = {
    enter(p = {}) {
      params = p || {};
      ensureStyle();
      ensureStyle('summary-style', CSS);
      clearNav();
      app.touch.hide();
      reduced = !!settings.get('reducedMotion');
      art.loadSet('summary').then(ok => { ready = ok; });
      if (params.kind === 'complete' && !reduced) {
        for (let i = 0; i < 3; i++) particles.emit(200 + i * 200, 80, { count: 18, colors: ['#ffd23f', '#ff6b81', '#5fd4ff', '#6fe0a8'], shape: fxRng.next() < 0.5 ? 'star' : 'square', speed: 4, angle: -Math.PI / 2, spread: 1.6, life: 70, size: 5, gravity: 0.1 });
        haptic(30);
      }
      build();
    },
    exit() {
      if (popNav) popNav();
      window.__test && window.__test.unregister('summary');
    },
    update() {
      ticks++;
      if (ticks === WAKE && wake) wake();
      tickNav();
      panelK = reduced ? 1 : Math.min(1, ticks / 14);
      if (rootEl) {
        const k = ease.outBack(panelK);
        rootEl.style.transform = panelK >= 1 ? '' : `scale(${0.92 + 0.08 * k})`;
        rootEl.style.opacity = String(Math.min(1, panelK * 1.5));
      }
      particles.update();
      if (countEl && countK < 1) {
        countK = Math.min(1, countK + 0.03);
        countEl.textContent = String(Math.round(countFrom + (countTo - countFrom) * ease.outCubic(countK)));
        if (ticks % 4 === 0) audio.play('countTick', { rate: 0.8 + countK * 0.6 });
      }
      // Keyboard: Enter / Space choose the focused button natively; with nothing focused (after a
      // tap) the first button answers the confirm key, as "click to try again" did.
      const active = document.activeElement;
      if (!done && ticks > WAKE && (input.pressed('confirm') || input.pressed('jump')) && !(active && active.closest && active.closest('#summary-root'))) {
        const firstBtn = document.querySelector('#summary-root button');
        if (firstBtn) firstBtn.click();
      }
    },
    render(ctx) {
      drawBackdrop(ctx);
      const k = ease.outBack(panelK);
      ctx.save();
      ctx.translate(400, 225);
      ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
      ctx.translate(-400, -225);
      ctx.globalAlpha = Math.min(1, panelK * 1.5);
      if (ready) {
        art.draw(ctx, 'summary_page_bg', 1);
        if (artBtn) art.draw(ctx, 'summary_click_button', btnState, art.track('summary_page_bg', 'click_button', 1) || [1, 0, 0, 1, 292.2, 351.9]);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 800, 450);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(42, 12, 718, 426, 12) : ctx.rect(42, 12, 718, 426); ctx.fill(); ctx.stroke();
        if (artBtn) { ctx.fillStyle = '#45b1f7'; ctx.fillRect(292, 352, 219, 79); }
      }
      ctx.restore();
      particles.draw(ctx);
    },
  };
  return scene;
}
