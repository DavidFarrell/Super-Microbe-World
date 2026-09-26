// Splash: the 2009 "tuning in" television (movies/splash.swf, sprite 58: 170 frames at 25 fps).
// The screen is dark, then static with "Tuning" and green bars, then the game show studio; at
// frame 150 the logo drops in and the New Game button fades in, and frame 170 stops (NOTES 2.1).
// The port draws the Super Microbe World title where the e-Bug logo was (branding, NOTES 11.2),
// on the logo's own motion track (d399). New Game is the 2009 button art (button_new_game on
// track d390, with its alpha ramp) under a transparent real button; Continue (with a saved game),
// Level select and Settings sit on the cabinet's bottom rail like a TV's own buttons, so nothing
// covers the studio's podiums. The dial on the cabinet is the language button. On the very first
// run a language chooser comes up at frame 150 (skipped with ?lang=<code>). Tap, click, Enter or
// Space during the tuning jumps to frame 150; coming back to the splash starts at 170.
// The menu wakes MENU_WAKE ticks after it appears: until then it takes no taps and nothing is
// focused, so the key or tap that skipped the tuning (or a held key's auto-repeat) cannot start
// a game the player has not seen. The tuning waits for its art (a loading ring meanwhile).
// Layer order and placements follow tools/swf-sheet/compose.mjs (splash-tuning, splash-new-game).
import { el } from '../ui/dom.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t, loadLanguage } from '../core/i18n.js';
import { Particles } from '../core/fx.js';
import { fxRng } from '../core/rng.js';
import { ease } from '../core/tween.js';
import { defineTrack, AREA_MUSIC } from '../core/music.js';
import * as art from '../flow/art.js';
import { drawLoading } from '../flow/art.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav, confirmDialog, focusInitial } from '../flow/ui.js';
import { openLanguageChooser } from '../flow/language.js';

const LAST = 170;          // frame 170: stop()
const MENU_FROM = 150;     // New Game appears (NewGame alpha 0 -> 1 over 150-170)
const STUDIO_FROM = 120;   // the static screen is gone, the studio shows
const TUNING = [49, 134];  // the "Tuning" group (track d490)
const SCREEN_CLIP = [[96, 58], [640, 58], [652, 350], [110, 370]]; // TV glass, for idle effects
const MENU_WAKE = 16;      // ticks (0.24 s) after the menu appears before it takes input
// button_new_game (splash.swf character 5) on track d390: 132.6 x 48.4 stage px at frame 170.
const NEW_GAME = { x: 197.21, y: 239.78, w: 132.62, h: 48.39 };
const TITLE_AT = [352, 128];

const CSS = `
.sp-menu { position: absolute; inset: 0; }
.sp-new { position: absolute; left: ${NEW_GAME.x - 4}px; width: ${NEW_GAME.w + 8}px; padding: 0; border: 0; border-radius: 14px; background: transparent; cursor: pointer;
  height: max(${NEW_GAME.h + 4}px, calc(46px / var(--stage-scale, 1))); top: calc(${NEW_GAME.y + NEW_GAME.h / 2}px - max(${NEW_GAME.h + 4}px, calc(46px / var(--stage-scale, 1))) / 2); }
.sp-new:focus-visible { outline: 4px solid #ffd23f; outline-offset: 1px; }
.sp-row { position: absolute; left: 96px; width: 556px; top: 366px; display: flex; justify-content: center; align-items: center; gap: 10px; }
.sp-row .fl-btn { padding-left: 16px; padding-right: 16px; }
.sp-lang { position: absolute; left: 676px; top: 60px; width: 72px; height: 72px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.0);
  background: transparent; cursor: pointer; display: grid; place-items: center; padding: 0; color: #fff; }
.sp-lang:focus-visible { outline: 4px solid #ffd23f; outline-offset: 2px; }
.sp-lang:hover { background: rgba(255, 255, 255, 0.12); }
.sp-lang span { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font: 800 calc(13px * var(--text-scale, 1)) var(--ui-font); background: rgba(20,14,50,0.8); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.sp-skip { position: absolute; inset: 0; background: transparent; border: 0; cursor: pointer; }
.sp-skip:focus { outline: none; }
`;

// A gentle, bouncy game-show jingle for the menus (the 2009 game had no sound at all).
const MENU_TRACK = (() => {
  const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const arp = [];
  for (const c of chords) for (let i = 0; i < 16; i++) arp.push(i % 2 ? null : c[[0, 1, 2, 1, 2, 1, 0, 1][(i / 2) % 8]] + 12);
  const bassNotes = [];
  for (const r of [48, 45, 41, 43]) for (let i = 0; i < 16; i++) bassNotes.push(i === 0 || i === 8 ? r : i === 12 ? r + 7 : null);
  const tune = [72, null, 76, null, 79, null, 76, 74, 72, null, 69, null, 72, null, null, null,
    69, null, 72, null, 76, null, 74, 72, 69, null, 65, null, 69, null, null, null,
    65, null, 69, null, 72, null, 69, 67, 65, null, 67, null, 69, null, null, null,
    67, null, 71, null, 74, null, 72, 71, 67, null, null, null, 74, null, null, null];
  return {
    name: 'menu', bpm: 96,
    voices: [
      { type: 'triangle', vol: 0.07, len: 1.8, notes: bassNotes },
      { type: 'sine', vol: 0.025, len: 1.2, notes: arp },
      { type: 'triangle', vol: 0.04, len: 1.6, notes: tune },
      { type: 'noise', vol: 0.008, notes: Array.from({ length: 64 }, (_, i) => (i % 8 === 4 ? 1 : null)) },
    ],
  };
})();
if (!AREA_MUSIC.menu) defineTrack('menu', MENU_TRACK);
audio.defineSynth('tvOn', (a, v) => {
  a.noise({ dur: 0.18, vol: 0.05 * v, freq: 4000, type: 'highpass' });
  [659, 880, 1175].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.2, vol: 0.07 * v, delay: 0.05 + i * 0.07 }));
});

let seenOnce = false;      // the tuning plays in full once per page load

export function splashScene(app) {
  let ticks = 0, frame = 1, ready = false, failed = false, destroyed = false, waiting = 0, skipWhenReady = false;
  let menu = null, skipLayer = null, langBtn = null, popNav = null, chooserOpen = false, musicOn = false;
  let newBtn = null, newState = 'up', newGlow = 0, menuAge = 0, awake = false, initialFocus = null;
  let reduced = !!settings.get('reducedMotion');
  const bubbles = new Particles(120);

  function jumpTo(f) {
    frame = f;
    ticks = Math.ceil((f * 8) / 3);
  }

  let menuStarted = false;
  function skip() {
    if (frame >= MENU_FROM) return;
    if (!ready && !failed) { skipWhenReady = true; return; }
    jumpTo(MENU_FROM); audio.play('tap');
  }

  function needsChooser() {
    const lang = app.params && app.params.get('lang');
    return settings.get('language') == null && !lang;
  }

  function buildMenu() {
    if (menu || destroyed) return;
    if (skipLayer) { skipLayer.remove(); skipLayer = null; }
    const flow = app.flow;
    const hasSave = flow.hasSave();
    // New Game: a transparent real button over the 2009 art, which the canvas draws.
    newBtn = el('button', { type: 'button', class: 'sp-new', id: 'btn-new-game' }, el('span', { class: 'sr-only' }, t('flow.menu.newGame')));
    newBtn.addEventListener('click', () => { audio.play('tap'); newGame(); });
    const setState = st => () => { newState = st; };
    newBtn.addEventListener('pointerenter', () => { if (newState !== 'down') newState = 'over'; if (input.lastDevice !== 'touch') audio.play('hover', { volume: 0.6 }); });
    newBtn.addEventListener('pointerleave', () => { newState = document.activeElement === newBtn ? 'over' : 'up'; });
    newBtn.addEventListener('pointerdown', setState('down'));
    newBtn.addEventListener('pointerup', setState('over'));
    newBtn.addEventListener('focus', setState('over'));
    newBtn.addEventListener('blur', setState('up'));
    const cont = hasSave ? glossy(t('flow.menu.continue'), () => flow.continueGame(), { id: 'btn-continue', class: 'small' }) : null;
    const row = el('div', { class: 'sp-row' },
      cont,
      glossy(t('flow.menu.levelSelect'), () => flow.openLevelSelect(), { id: 'btn-level-select', class: 'small alt' }),
      glossy(t('flow.menu.settings'), () => app.scenes.go('settings', { back: 'splash' }), { id: 'btn-settings', class: 'small alt' }));
    // Asleep until MENU_WAKE: taps pass through ('passthrough') and nothing is focused yet.
    menu = el('nav', { class: 'sp-menu passthrough', 'aria-label': t('flow.menu.label') }, newBtn, row);
    langBtn = el('button', { type: 'button', class: 'sp-lang passthrough', id: 'btn-language', 'aria-label': t('flow.menu.language', { name: languageName() }) },
      el('span', {}, languageName()));
    langBtn.addEventListener('click', () => { audio.play('tap'); chooseLanguage(false); });
    root.append(menu, langBtn);
    menuAge = 0;
    awake = false;
    initialFocus = cont || newBtn;
    if (popNav) popNav();
    popNav = pushNav(root, { initial: false });
    if (audio.ctx && audio.ctx.state === 'running') audio.play('tvOn');
    app.announce(t('flow.menu.ready'));
  }

  function wakeMenu() {
    awake = true;
    if (menu) menu.classList.remove('passthrough');
    if (langBtn) langBtn.classList.remove('passthrough');
    // Keep a focus the player already moved with the arrows; otherwise focus the first choice.
    if (!root.contains(document.activeElement) && initialFocus && initialFocus.isConnected) focusInitial(root, initialFocus);
  }

  let names = { en: 'English' };
  const languageName = () => names[settings.get('language') || 'en'] || 'English';
  app.flow.manifest().then(m => { names = m.names || names; if (langBtn) { langBtn.querySelector('span').textContent = languageName(); langBtn.setAttribute('aria-label', t('flow.menu.language', { name: languageName() })); } });

  async function chooseLanguage(firstRun) {
    if (chooserOpen) return;
    chooserOpen = true;
    const code = await openLanguageChooser(app, root, { firstRun });
    chooserOpen = false;
    if (destroyed) return;
    if (code && code !== settings.get('language')) {
      settings.set('language', code);
      await loadLanguage(code);
      if (destroyed) return;
      // Rebuild the menu in the new language.
      if (menu) { menu.remove(); langBtn.remove(); menu = null; newBtn = null; }
    } else if (code && firstRun) {
      settings.set('language', code);
    }
    buildMenu();
  }

  async function newGame() {
    if (app.flow.hasSave()) {
      const ok = await confirmDialog(root, { title: t('flow.menu.newGameTitle'), text: t('flow.menu.newGameText'), yes: t('flow.menu.newGameYes'), no: t('flow.ui.cancel'), danger: true });
      if (!ok || destroyed) return;
    }
    app.flow.newGame();
  }

  const root = el('div', { class: 'fl-layer', id: 'splash-root' });

  function onFrame150() {
    if (needsChooser()) chooseLanguage(true);
    else buildMenu();
  }

  function startMusic() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC.menu);
    audio.musicLevel(0.8);
  }

  // Title where the e-Bug logo was: a blue splat with the name. m is the logo's motion on track
  // d399 relative to where it comes to rest (frame 170), so the title swings in exactly as the
  // logo did (+13.8 degrees at frame 155, -13 at 160); squash is the landing juice.
  function drawTitle(ctx, m, squash, bob = 0) {
    ctx.save();
    if (m) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5] + bob);
    else ctx.translate(0, bob);
    ctx.translate(TITLE_AT[0], TITLE_AT[1]);
    ctx.rotate(-0.05);
    ctx.scale(1 + squash * 0.06, 1 - squash * 0.08);
    // splat
    ctx.beginPath();
    const spikes = 18;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? 1 : 1.13 + (i % 4 === 0 ? 0.06 : 0);
      ctx.lineTo(Math.cos(a) * 128 * r, Math.sin(a) * 74 * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#39a8ee'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 112, 62, 0, 0, Math.PI * 2); ctx.fillStyle = '#5fc4ff'; ctx.fill();
    // name
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const line = (text, y, size) => {
      ctx.font = `800 ${size}px Baloo, "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 9; ctx.strokeStyle = '#1d5a12'; ctx.strokeText(text, 0, y);
      ctx.fillStyle = '#e4f53d'; ctx.fillText(text, 0, y);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText(text, 0, y - size * 0.06);
      ctx.fillStyle = '#e4f53d'; ctx.save(); ctx.globalAlpha = 0.9; ctx.fillText(text, 0, y + 1); ctx.restore();
    };
    line('SUPER MICROBE', -8, 36);
    line('WORLD', 42, 54);
    // yellow dots like the original logo's spots
    ctx.fillStyle = 'rgba(255, 190, 40, 0.9)';
    for (const [x, y, r] of [[-104, -30, 5], [100, -38, 4], [112, 26, 6], [-96, 40, 4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // The host podium in the TV picture carries the blue e-Bug smiley (branding, NOTES 11.2): a
  // quiz-show "?" medallion covers it, as the game show studio does (js/gameshow/studio.js).
  function drawPodiumBadge(ctx) {
    const x = 255, y = 277, r = 19;
    ctx.save();
    ctx.fillStyle = '#c792dd';
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 6, y - 7, 2, x, y, r);
    g.addColorStop(0, '#fff6c4'); g.addColorStop(1, '#ffd766');
    ctx.fillStyle = g; ctx.strokeStyle = '#9a5cb8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a5cb8'; ctx.font = '800 26px Baloo, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + 2);
    ctx.restore();
  }

  // The d399 matrix at `frame` relative to its rest matrix (frame 170), in stage space
  // (compose.mjs places the splash timeline at identity).
  function titleMotion(f) {
    const m = art.track('splash_timeline', 'd399', f), r = art.track('splash_timeline', 'd399', LAST);
    if (!m || !r) return null;
    const det = r[0] * r[3] - r[1] * r[2];
    if (!det) return null;
    const inv = [r[3] / det, -r[1] / det, -r[2] / det, r[0] / det, (r[2] * r[5] - r[3] * r[4]) / det, (r[1] * r[4] - r[0] * r[5]) / det];
    return art.multiply(m, inv);
  }

  // The 2009 New Game art with its alpha ramp; a small lift and glow on hover / focus, a press.
  function drawNewGame(ctx) {
    if (!art.has('splash_new_game')) return;
    const a = frame >= LAST ? 1 : Math.max(0, art.alphaTrack('splash_timeline', 'd390', frame) ?? (frame - MENU_FROM) / (LAST - MENU_FROM));
    if (a <= 0) return;
    const m = art.track('splash_timeline', 'd390', Math.max(MENU_FROM, frame)) || [0.49576, 0, 0, 0.49379, NEW_GAME.x, NEW_GAME.y];
    const target = awake && newState !== 'up' ? 1 : 0;
    newGlow += (target - newGlow) * (reduced ? 1 : 0.3);
    const k = newState === 'down' && awake ? 0.96 : 1 + 0.05 * newGlow;
    const cx = NEW_GAME.x + NEW_GAME.w / 2, cy = NEW_GAME.y + NEW_GAME.h / 2;
    ctx.save();
    ctx.globalAlpha = a;
    if (newGlow > 0.02) {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, NEW_GAME.w * 0.75);
      g.addColorStop(0, `rgba(255, 236, 140, ${0.45 * newGlow})`);
      g.addColorStop(1, 'rgba(255, 236, 140, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - NEW_GAME.w, cy - NEW_GAME.h * 1.4, NEW_GAME.w * 2, NEW_GAME.h * 2.8);
    }
    ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    art.draw(ctx, 'splash_new_game', 1, m);
    // The label was a text field on the button (not part of the art render): white, centred.
    const label = t('flow.menu.newGame');
    let size = 18 * (Number(settings.get('textScale')) || 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      ctx.font = `600 ${size}px Atkinson, Verdana, "DejaVu Sans", sans-serif`;
      if (ctx.measureText(label).width <= NEW_GAME.w - 16) break;
      size *= 0.9;
    }
    ctx.fillStyle = 'rgba(8, 50, 110, 0.45)';
    ctx.fillText(label, cx, cy + 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, cy + 1);
    ctx.restore();
  }

  function drawPlaceholder(ctx) {
    ctx.fillStyle = '#bfe3f5'; ctx.fillRect(0, 0, 800, 300);
    ctx.fillStyle = '#c9dc8e'; ctx.fillRect(0, 300, 800, 150);
    ctx.fillStyle = '#b8864f'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(30, 30, 740, 380, 40) : ctx.rect(30, 30, 740, 380); ctx.fill();
    ctx.fillStyle = '#20242a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(90, 60, 560, 310, 50) : ctx.rect(90, 60, 560, 310); ctx.fill();
  }

  function clipScreen(ctx) {
    ctx.beginPath();
    ctx.moveTo(...SCREEN_CLIP[0]);
    for (const p of SCREEN_CLIP.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
    ctx.clip();
  }

  const scene = {
    enter(p = {}) {
      ensureStyle();
      ensureStyle('splash-style', CSS);
      clearNav();
      app.touch.hide();
      app.ui.append(root);
      reduced = !!settings.get('reducedMotion');
      if (p.again || seenOnce) jumpTo(LAST);
      seenOnce = true;
      if (frame < MENU_FROM) {
        skipLayer = el('button', { type: 'button', class: 'sp-skip', id: 'splash-skip', 'aria-label': t('flow.splash.skip') });
        skipLayer.addEventListener('click', skip);
        root.append(skipLayer);
      }
      art.loadSet('splash').then(ok => { ready = ok; failed = !ok; });
      window.__test && window.__test.register('splash', () => ({
        frame, ready, failed, menu: !!menu, awake, chooser: chooserOpen,
        buttons: menu ? [...menu.querySelectorAll('button')].map(b => b.id) : [],
      }));
    },
    exit() {
      destroyed = true;
      if (popNav) popNav();
      clearNav();
      audio.stopMusic();
      window.__test && window.__test.unregister('splash');
    },
    update() {
      startMusic();
      tickNav();
      // The splash waits for its art (a loading ring meanwhile; the placeholder TV only after a
      // failed load). A skip asked for meanwhile applies as soon as the art is in.
      if (!ready && !failed) { waiting++; if (input.pressed('confirm') || input.pressed('jump')) skip(); return; }
      if (skipWhenReady) { skipWhenReady = false; skip(); }
      if (!menuStarted && frame >= MENU_FROM) { menuStarted = true; onFrame150(); }
      ticks++;
      if (frame < MENU_FROM && (input.pressed('confirm') || input.pressed('jump'))) skip();
      if (frame < LAST) frame = Math.min(LAST, Math.max(frame, 1 + art.framesAt(ticks)));
      if (!menuStarted && frame >= MENU_FROM) { menuStarted = true; onFrame150(); }
      if (menu && !awake && ++menuAge >= MENU_WAKE) wakeMenu();
      // Idle: bubbles drifting up behind the glass once the studio shows.
      if (frame >= STUDIO_FROM && ticks % (reduced ? 40 : 14) === 0) {
        bubbles.emit(130 + fxRng.next() * 490, 372, { count: 1, colors: ['#ffffff', '#bfefff', '#ffe9a8'], shape: 'bubble', gravity: -0.012, speed: 0.5, angle: -Math.PI / 2, spread: 0.6, life: 200, size: 5, drag: 0.995 });
      }
      bubbles.update();
      // The rail buttons follow the NewGame alpha ramp (frames 150-170).
      if (menu) {
        const a = frame >= LAST ? 1 : Math.max(0, art.alphaTrack('splash_timeline', 'd390', frame) ?? (frame - MENU_FROM) / (LAST - MENU_FROM));
        const k = reduced ? 1 : Math.min(1, a * 1.4);
        const row = menu.querySelector('.sp-row');
        if (row) { row.style.opacity = String(k); row.style.transform = `translateY(${(1 - k) * 12}px)`; }
      }
    },
    render(ctx) {
      if (!ready && !failed) { drawLoading(ctx, waiting, '#000'); return; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 450);
      if (!ready) { drawPlaceholder(ctx); if (frame >= MENU_FROM) drawTitle(ctx, null, 0); return; }
      art.draw(ctx, 'splash_back', 1);
      art.draw(ctx, 'splash_studio', STUDIO_FROM);
      if (frame >= STUDIO_FROM) {
        drawPodiumBadge(ctx);
        ctx.save(); clipScreen(ctx); bubbles.draw(ctx); ctx.restore();
      }
      if (frame >= MENU_FROM) {
        let squash = 0;
        const since = frame >= LAST ? ticks - Math.ceil((LAST * 8) / 3) : -1;
        if (!reduced && since >= 0 && since < 30) squash = Math.sin((since / 30) * Math.PI) * (1 - since / 30);
        const bob = !reduced && frame >= LAST ? Math.sin(ticks / 70) * 3 : 0;
        ctx.save(); clipScreen(ctx); drawTitle(ctx, reduced && frame < LAST ? null : titleMotion(frame), squash, bob); ctx.restore();
        drawNewGame(ctx);
      }
      art.draw(ctx, 'splash_casing', 1);
      if (frame < STUDIO_FROM) art.draw(ctx, 'splash_screen', frame);
      if (frame >= TUNING[0] && frame <= TUNING[1]) {
        art.draw(ctx, 'splash_tuning', frame);
        // The "Tuning" text (Verdana Bold 30, #00ff00; omitted from the art render).
        ctx.save();
        ctx.font = 'bold 28px Verdana, "DejaVu Sans", sans-serif';
        ctx.fillStyle = '#00ff00'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(t('flow.splash.tuning'), 314, 293);
        ctx.restore();
      }
      if (frame >= STUDIO_FROM) art.draw(ctx, 'splash_shine', STUDIO_FROM);
      art.draw(ctx, 'splash_glass', frame >= STUDIO_FROM ? STUDIO_FROM : 1);
      // A slow glint across the glass every few seconds (idle animation).
      if (frame >= LAST && !reduced) {
        const period = 420, p = (ticks % period) / 90;
        if (p < 1) {
          ctx.save(); clipScreen(ctx);
          const x = -120 + ease.inOutQuad(p) * 900;
          const g = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.transform(1, 0, -0.5, 1, 0, 0); ctx.fillRect(x - 60, 0, 120, 450);
          ctx.restore();
        }
      }
    },
  };
  return scene;
}
