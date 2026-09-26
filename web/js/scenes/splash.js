// Splash: the 2009 "tuning in" television (movies/splash.swf, sprite 58: 170 frames at 25 fps).
// The screen is dark, then static with "Tuning" and green bars, then the game show studio; at
// frame 150 the logo drops in and the New Game button fades in, and frame 170 stops (NOTES 2.1).
// The port draws the Super Microbe World title where the e-Bug logo was (branding, NOTES 11.2)
// and puts the menu on the TV screen: New Game, Continue (with a saved game), Level select and
// Settings. The dial on the cabinet is the language button. On the very first run a language
// chooser comes up at frame 150 (skipped with ?lang=<code>). Tap, click, Enter or Space during
// the tuning jumps to frame 150; coming back to the splash from another screen starts at 170.
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
import { ensureStyle, glossy, pushNav, tickNav, clearNav, confirmDialog, focusInitial } from '../flow/ui.js';
import { openLanguageChooser } from '../flow/language.js';

const LAST = 170;          // frame 170: stop()
const MENU_FROM = 150;     // New Game appears (NewGame alpha 0 -> 1 over 150-170)
const STUDIO_FROM = 120;   // the static screen is gone, the studio shows
const TUNING = [49, 134];  // the "Tuning" group (track d490)
const SCREEN_CLIP = [[96, 58], [640, 58], [652, 350], [110, 370]]; // TV glass, for idle effects

const CSS = `
.sp-menu { position: absolute; left: 150px; top: 206px; width: 430px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
.sp-menu .fl-btn { width: 100%; }
.sp-menu .wide { grid-column: 1 / span 2; }
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
  let ticks = 0, frame = 1, ready = false, destroyed = false, waiting = 0;
  let menu = null, skipLayer = null, langBtn = null, popNav = null, chooserOpen = false, musicOn = false;
  let reduced = !!settings.get('reducedMotion');
  const bubbles = new Particles(120);
  let menuShownAt = -1;

  function jumpTo(f) {
    frame = f;
    ticks = Math.ceil((f * 8) / 3);
  }

  let menuStarted = false;
  function skip() {
    if (frame < MENU_FROM) { jumpTo(MENU_FROM); audio.play('tap'); }
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
    const b = {
      cont: hasSave ? glossy(t('flow.menu.continue'), () => flow.continueGame(), { id: 'btn-continue' }) : null,
      nw: glossy(t('flow.menu.newGame'), () => newGame(), { id: 'btn-new-game', class: hasSave ? 'alt' : '' }),
      ls: glossy(t('flow.menu.levelSelect'), () => flow.openLevelSelect(), { id: 'btn-level-select', class: 'alt' }),
      st: glossy(t('flow.menu.settings'), () => app.scenes.go('settings', { back: 'splash' }), { id: 'btn-settings', class: 'alt' }),
    };
    if (!hasSave) b.nw.classList.add('wide');
    menu = el('nav', { class: 'sp-menu', 'aria-label': t('flow.menu.label') }, b.cont, b.nw, b.ls, b.st);
    langBtn = el('button', { type: 'button', class: 'sp-lang', id: 'btn-language', 'aria-label': t('flow.menu.language', { name: languageName() }) },
      el('span', {}, languageName()));
    langBtn.addEventListener('click', () => { audio.play('tap'); chooseLanguage(false); });
    root.append(menu, langBtn);
    menuShownAt = ticks;
    if (popNav) popNav();
    popNav = pushNav(root, { initial: hasSave ? b.cont : b.nw });
    if (audio.ctx && audio.ctx.state === 'running') audio.play('tvOn');
    app.announce(t('flow.menu.ready'));
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
      if (menu) { menu.remove(); langBtn.remove(); menu = null; }
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

  // Title where the e-Bug logo was: a blue splat with the name, dropping in on track d399.
  function drawTitle(ctx, dy, squash) {
    ctx.save();
    ctx.translate(352, 128 + dy);
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
      art.loadSet('splash').then(ok => { ready = ok; });
      if (frame >= MENU_FROM) { menuStarted = true; onFrame150(); }
      window.__test && window.__test.register('splash', () => ({
        frame, ready, menu: !!menu, chooser: chooserOpen,
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
      // The tuning waits for its art (at most about 3 s, then the placeholder TV plays).
      if (!ready && frame < MENU_FROM && ++waiting < 200) { if (input.pressed('confirm') || input.pressed('jump')) skip(); return; }
      ticks++;
      if (frame < MENU_FROM && (input.pressed('confirm') || input.pressed('jump'))) skip();
      if (frame < LAST) frame = Math.min(LAST, Math.max(frame, 1 + art.framesAt(ticks)));
      if (!menuStarted && frame >= MENU_FROM) { menuStarted = true; onFrame150(); }
      // Idle: bubbles drifting up behind the glass once the studio shows.
      if (frame >= STUDIO_FROM && ticks % (reduced ? 40 : 14) === 0) {
        bubbles.emit(130 + fxRng.next() * 490, 372, { count: 1, colors: ['#ffffff', '#bfefff', '#ffe9a8'], shape: 'bubble', gravity: -0.012, speed: 0.5, angle: -Math.PI / 2, spread: 0.6, life: 200, size: 5, drag: 0.995 });
      }
      bubbles.update();
      // The menu follows the NewGame alpha ramp (frames 150-170).
      if (menu) {
        const a = frame >= LAST ? 1 : Math.max(0, art.alphaTrack('splash_timeline', 'd390', frame) ?? (frame - MENU_FROM) / (LAST - MENU_FROM));
        const k = reduced ? 1 : Math.min(1, a * 1.4);
        menu.style.opacity = String(k);
        menu.style.transform = `translateY(${(1 - k) * 12}px)`;
      }
    },
    render(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 450);
      if (!ready) { drawPlaceholder(ctx); if (frame >= MENU_FROM) drawTitle(ctx, 0, 0); return; }
      art.draw(ctx, 'splash_back', 1);
      art.draw(ctx, 'splash_studio', STUDIO_FROM);
      if (frame >= STUDIO_FROM) {
        drawPodiumBadge(ctx);
        ctx.save(); clipScreen(ctx); bubbles.draw(ctx); ctx.restore();
      }
      if (frame >= MENU_FROM) {
        const ty = art.track('splash_timeline', 'd399', frame), last = art.track('splash_timeline', 'd399', LAST);
        let dy = ty && last ? ty[5] - last[5] : 0;
        let squash = 0;
        const since = frame >= LAST ? ticks - Math.ceil((LAST * 8) / 3) : -1;
        if (!reduced && since >= 0 && since < 30) squash = Math.sin((since / 30) * Math.PI) * (1 - since / 30);
        if (!reduced && frame >= LAST) dy += Math.sin(ticks / 70) * 3;
        ctx.save(); clipScreen(ctx); drawTitle(ctx, dy, squash); ctx.restore();
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
      void menuShownAt;
    },
  };
  return scene;
}
