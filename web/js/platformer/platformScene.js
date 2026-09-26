// Scene 'platform': the hoverboard platform game. Params: { level: 'alpha_level1', avatar:
// 'harry' | 'amy', score, intro: '0' to skip the ePhone briefing, seed, onComplete(result),
// onGameOver(result), onQuit() }. Also reachable as ?scene=platform&level=alpha_level1&avatar=amy.
//
// Runs one logic step (the original's ~30 ms UPDATE) every two 15 ms engine ticks and
// interpolates drawing in between. Owns loading, the ePhone briefing (intro.js), the canvas HUD
// (hud.js), pause, the portal exit sequence, level complete and game over, touch controls, sound,
// music and juice. The simulation itself is game.js and never sees any of this: juice reads the
// game's fx notifications, and hit-stop only delays whole logic steps, so a run is the same for
// the same per-step inputs.
import { el, button, focusFirst, focusNavigator, trapFocus } from '../ui/dom.js';
import { loadJson } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { AREA_MUSIC } from '../core/music.js';
import { Particles, Shake, Popups, haptic } from '../core/fx.js';
import { gameRng } from '../core/rng.js';
import { ease, clamp } from '../core/tween.js';
import { device, tp } from '../ui/prompts.js';
import { PlatformGame, GAME_STATE } from './game.js';
import { PlatformRenderer } from './render.js';
import { Hud, goalText } from './hud.js';
import { IntroPhone } from './intro.js';
import { StepInput } from './controls.js';
import { sprites } from './sprites.js';
import { TICKS_PER_STEP, END, STAGE_W, STEP_MS, LEFT, S, T, G } from './constants.js';

const TOUCH_PLAY = ['dpad', 'jump', 'fire', 'camera', 'pause', 'phone'];
const HIT_STOP = { hurt: 4, kill: 3, photo: 2 };   // logic steps frozen for impact
const SUCK_TICKS = 34;                              // player drawn into the portal
const IRIS_TICKS = 36;                              // iris closing on the portal
const FLYER_TICKS = 38;                             // photo sparkle flying to the ePhone
// On-screen controls that fade while a target is under them (see updateOcclusion).
const TOUCH_BUTTON_IDS = ['touch-left', 'touch-right', 'touch-jump', 'touch-fire', 'touch-camera', 'touch-pause', 'touch-phone'];
const PROJECTILE_TYPES = [T.BULLET, T.CAMERA_FLASH, T.ANTIBIOTIC_BOMB];

// Sounds for the later levels' mechanics (the original had no sound at all).
audio.defineSynth('antibioticBoom', (a, v) => {
  a.tone({ type: 'sine', freq: 140, to: 40, dur: 0.45, vol: 0.22 * v });
  a.noise({ dur: 0.5, vol: 0.2 * v, freq: 1600, to: 180, type: 'lowpass' });
  [1320, 1760, 2349].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.16, vol: 0.05 * v, delay: 0.12 + i * 0.06 }));
});
audio.defineSynth('superHit', (a, v) => {
  a.tone({ type: 'sawtooth', freq: 110, to: 55, dur: 0.4, vol: 0.12 * v });
  a.tone({ type: 'square', freq: 220, to: 90, dur: 0.25, vol: 0.06 * v, delay: 0.05 });
  a.noise({ dur: 0.25, vol: 0.1 * v, freq: 600, type: 'lowpass' });
});
audio.defineSynth('superDefeated', (a, v) => {
  a.tone({ type: 'sawtooth', freq: 160, to: 40, dur: 0.7, vol: 0.12 * v });
  a.noise({ dur: 0.6, vol: 0.14 * v, freq: 900, to: 120, type: 'lowpass' });
  [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.09 * v, delay: 0.45 + i * 0.09 }));
});
audio.defineSynth('milkSplash', (a, v) => {
  a.tone({ type: 'sine', freq: 520, to: 1300, dur: 0.12, vol: 0.12 * v });
  a.noise({ dur: 0.2, vol: 0.08 * v, freq: 2500, to: 700 });
});

// The level-complete card's goal counter label for each goal type.
function goalLabel(type) {
  const key = type === G.KILL_ALL ? 'kill' : type === G.YOGURT ? 'yogurt' : type === G.ANTIBIOTIC ? 'antibiotic' : 'photo';
  return t(`platform.goalLabel.${key}`);
}

// Tile id ranges in tile_definitions.xml (flash-platformer.md section 6.2), for the area music.
const areaOf = id => (id <= 38 ? 'kitchen' : id <= 69 ? 'body' : id <= 92 ? 'skin' : null);

const STYLE = `
.pf-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(20, 14, 50, 0.45); }
.pf-overlay.clear { background: transparent; }
.pf-card { width: 540px; max-width: 92%; background: var(--panel); border-radius: 26px; padding: 22px 26px 20px; text-align: center; box-shadow: 0 10px 0 rgba(0,0,0,0.3); border: 4px solid rgba(255,255,255,0.15); animation: pf-card-in 0.35s cubic-bezier(.2,1.4,.4,1) both; }
.pf-card h2 { margin: 0 0 8px; font: 800 34px/1.1 var(--ui-font); }
.pf-card p { margin: 6px 0 14px; font: 400 19px/1.35 var(--body-font); }
.pf-card .row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.pf-card .hint { font: 400 14px/1.3 var(--body-font); opacity: 0.8; margin: 10px 0 0; }
.pf-stats { display: flex; gap: 10px; justify-content: center; margin: 8px 0 14px; }
.pf-stat { background: rgba(255,255,255,0.1); border-radius: 16px; padding: 8px 14px 6px; min-width: 96px; }
.pf-stat b { display: block; font: 800 30px/1.1 var(--ui-font); color: #fff; }
.pf-stat span { font: 400 14px/1.2 var(--body-font); opacity: 0.85; }
.pf-stat.score b { color: #ffd84a; }
.pf-toggle { font-size: 16px; min-height: max(44px, calc(46px / var(--stage-scale, 1))); padding: 8px 18px 6px; }
.pf-cam-badge { position: absolute; right: -6px; top: -6px; width: 40px; height: 22px; border-radius: 11px; background: #1b1640; border: 2px solid #fff; display: grid; place-items: center; pointer-events: none; animation: pf-badge-in 0.3s cubic-bezier(.2,1.6,.4,1) both; }
.pf-cam-badge svg { width: 30px; height: 14px; }
@keyframes pf-badge-in { from { transform: scale(0.2); } to { transform: scale(1); } }
html.reduced-motion .pf-cam-badge { animation: none; }
.pf-intro { position: absolute; inset: 0; }
.pf-intro-tap { position: absolute; inset: 0; cursor: pointer; }
.pf-intro-next { position: absolute; right: 12px; bottom: 6px; }
.pf-intro-skip { position: absolute; left: 12px; top: 8px; font-size: 16px; min-height: max(44px, calc(46px / var(--stage-scale, 1))); padding: 8px 18px 6px; background: rgba(255,255,255,0.85); }
@keyframes pf-card-in { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pf-card { animation: none; } }
html.reduced-motion .pf-card { animation: none; }
`;

export function platformScene(app) {
  const input = app.input;
  const particles = new Particles(600);       // world space
  const screenFx = new Particles(300);        // screen space (sparkle trails, confetti)
  const popups = new Popups();
  const shake = new Shake();
  let game = null, renderer = null, hud = null, intro = null, levelIndex = null;
  let params = {}, levelData = null;
  let mode = 'loading';          // loading | intro | play | paused | briefing | exiting | ending | complete | gameover | error
  let phase = 0;                 // engine ticks since the last logic step
  let overlay = null, nav = null;
  let stepInput = new StepInput();
  let time = 0, tick = 0;
  let loadProgress = 0;
  let destroyed = false;
  let hitStop = 0;               // logic steps still frozen
  let frozen = false;            // the last step slot was a hit-stop (no interpolation)
  let flyers = [];
  let flash = 0;                 // camera-phone screen flash
  let exitAge = 0, endAge = 0;
  let exitFocus = null;          // screen point the iris closes on
  let area = 'kitchen';
  let musicOn = false;
  let reducedMotion = settings.get('reducedMotion');
  let lastSecs = 0;
  let stats = { photos: 0 };
  let untrap = null;             // removes the open dialog's Tab trap
  let controlRects = null, controlKey = '';
  const occluding = new Set();   // ids of touch controls currently faded over a target

  // ------------------------------------------------------------------------------------------
  // Overlays (DOM cards in the scaled UI layer)
  // ------------------------------------------------------------------------------------------
  function clearOverlay() {
    if (untrap) { untrap(); untrap = null; }
    if (overlay) {
      // Give focus back to the game (the canvas) rather than leaving it on a removed button.
      const had = overlay.contains(document.activeElement);
      overlay.remove();
      if (had) document.getElementById('game')?.focus({ preventScroll: true });
    }
    overlay = null; nav = null;
  }

  // A modal card: Tab / Shift+Tab stay inside it, Space and Enter activate the focused button
  // natively (data-native-keys stops the engine's keydown handler from cancelling them), and
  // arrow keys move between buttons (focusNavigator).
  function showOverlay(node, { focus = true, clear = false } = {}) {
    clearOverlay();
    overlay = el('div', { class: 'pf-overlay' + (clear ? ' clear' : ''), 'data-native-keys': true }, node);
    for (const d of overlay.querySelectorAll('[role="dialog"]')) d.setAttribute('aria-modal', 'true');
    app.ui.append(overlay);
    nav = focusNavigator(overlay);
    untrap = trapFocus(overlay);
    if (focus) focusFirst(overlay);
    app.touch.hide();
  }

  // ------------------------------------------------------------------------------------------
  // Loading and level start
  // ------------------------------------------------------------------------------------------
  async function load() {
    if (!document.getElementById('pf-scene-style')) document.head.append(el('style', { id: 'pf-scene-style' }, STYLE));
    const name = String(params.level || 'alpha_level1').replace(/\.xml$/, '');
    const avatar = params.avatar === 'amy' ? 'amy' : 'harry';
    try {
      [levelData, levelIndex] = await Promise.all([
        loadJson(`data/levels/${name}.json`),
        loadJson('data/levels/index.json').catch(() => null),
        sprites.loadForLevel(name, avatar, p => { loadProgress = p; }),
      ]);
    } catch (e) {
      console.warn(e);
      mode = 'error';
      showOverlay(el('div', { class: 'pf-card' }, el('h2', {}, t('level.notFound')), el('p', {}, t('level.notFoundText', { name })),
        el('div', { class: 'row' }, button(t('ui.back'), () => app.scenes.go('splash'), { class: 'primary' }))));
      return;
    }
    if (destroyed) return;
    if (params.seed != null) gameRng.seed(Number(params.seed));
    const counts = {};
    for (const [, , id] of levelData.tiles) { const a = areaOf(id); if (a) counts[a] = (counts[a] || 0) + 1; }
    area = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'kitchen';
    startLevel();
  }

  function startLevel() {
    clearOverlay();
    if (intro) { intro.destroy(); intro = null; }
    if (hud) hud.destroy();
    reducedMotion = settings.get('reducedMotion');
    document.documentElement.classList.toggle('reduced-motion', !!reducedMotion);
    game = new PlatformGame(levelData, { avatar: params.avatar === 'amy' ? 'amy' : 'harry', score: Number(params.score) || 0 });
    renderer = new PlatformRenderer(game, { reducedMotion });
    hud = new Hud(app, { onPhone: () => { if (mode === 'play') openBriefing(); } });
    hud.reset(game);
    particles.clear(); screenFx.clear(); popups.clear(); shake.clear(); flyers = [];
    stepInput = new StepInput();
    phase = 0; hitStop = 0; frozen = false; flash = 0; exitAge = 0; endAge = 0;
    lastSecs = game.secondsLeft;
    stats = { photos: 0, startScore: game.score };
    if (params.intro === '0' || params.intro === false) beginPlay();
    else showIntro(false);
    app.announce(`${t('intro.title')}. ${goalSentence()}`);
  }

  function goalSentence() {
    const g = game.goalsView[0];
    return g ? goalText({ type: g.goalType, microbeType: g.microbeType, required: g.required }) : '';
  }

  // ------------------------------------------------------------------------------------------
  // The ePhone briefing: at level start, and re-opened with the phone action (pauses play).
  // ------------------------------------------------------------------------------------------
  function showIntro(briefing) {
    clearOverlay();
    mode = briefing ? 'briefing' : 'intro';
    app.touch.hide();
    hud.setVisible(true);
    intro = new IntroPhone({
      app, title: game.level.title || 'level1', briefing, reducedMotion,
      phoneOffset: () => hud.phoneOffset(),
      onDone: () => { intro.destroy(); intro = null; if (briefing) resume(); else beginPlay(); },
    });
    intro.goalText = goalSentence();
    intro.refreshDom();
    audio.musicLevel(0.45);
  }

  function openBriefing() {
    if (mode !== 'play') return;
    showIntro(true);
  }

  function beginPlay() {
    clearOverlay();
    game.start();
    mode = 'play';
    stepInput.clear();
    app.touch.show(TOUCH_PLAY);
    audio.musicLevel(1);
    // The level's own downloads are done: offline caching can start now.
    if (app.registerServiceWorker) app.registerServiceWorker();
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'paused';
    audio.play('tap');
    audio.musicLevel(0.35);
    const soundLabel = () => (settings.get('muted') ? '🔇 ' + t('pause.soundOff') : '🔊 ' + t('pause.soundOn'));
    const toggle = button(soundLabel(), () => {
      settings.set('muted', !settings.get('muted'));
      toggle.textContent = soundLabel();
      toggle.setAttribute('aria-pressed', String(!settings.get('muted')));
    }, { id: 'pf-sound', class: 'pf-toggle', 'aria-pressed': String(!settings.get('muted')) });
    // Reduced motion and shake start from the OS preference; pressing one records a choice.
    const motionToggle = (key, id, label) => {
      const text = () => `${t(label)}: ${settings.get(key) ? t('ui.on') : t('ui.off')}`;
      const b = button(text(), () => {
        settings.set(key, !settings.get(key));
        b.textContent = text();
        b.setAttribute('aria-pressed', String(!!settings.get(key)));
      }, { id, class: 'pf-toggle', 'aria-pressed': String(!!settings.get(key)) });
      return b;
    };
    const card = el('div', { class: 'pf-card', role: 'dialog', 'aria-label': t('pause.title') },
      el('h2', {}, t('pause.title')),
      el('p', {}, goalSentence()),
      el('div', { class: 'row' },
        button(t('pause.resume'), () => resume(), { class: 'primary', id: 'pf-resume' }),
        button(t('pause.restart'), () => restart(), { id: 'pf-restart' }),
        button(t('pause.quit'), () => quit(), { id: 'pf-quit' })),
      el('div', { class: 'row' }, toggle,
        motionToggle('reducedMotion', 'pf-motion', 'pause.reduceMotion'),
        motionToggle('reducedShake', 'pf-shake', 'pause.reduceShake')));
    showOverlay(card);
  }

  // Reduced motion can change mid-level (the pause toggle, or the OS setting while it is followed).
  function onSettingChange(e) {
    if (e.detail.key !== 'reducedMotion') return;
    reducedMotion = !!settings.get('reducedMotion');
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    if (renderer) renderer.reducedMotion = reducedMotion;
    if (intro) intro.reducedMotion = reducedMotion;
  }

  function resume() {
    clearOverlay();
    mode = 'play';
    stepInput.clear();
    app.touch.show(TOUCH_PLAY);
    audio.musicLevel(1);
  }

  function restart() {
    params = { ...params, intro: '0', score: game ? game.startScore : params.score };
    startLevel();
  }

  function quit() {
    if (typeof params.onQuit === 'function') params.onQuit();
    else app.scenes.go('splash');
  }

  function nextLevelName() {
    const next = game.level.next;
    if (next && next !== 'exit') return next;
    const order = levelIndex && levelIndex.order;
    if (!order) return null;
    const i = order.indexOf(game.level.name);
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  }

  // ------------------------------------------------------------------------------------------
  // Level end: the player is drawn into the portal, an iris closes on it, then the summary.
  // ------------------------------------------------------------------------------------------
  function startExit() {
    mode = 'exiting';
    exitAge = 0;
    app.touch.hide();
    hud.setVisible(true);
    const p = game.player, portal = game.portal;
    const pb = portal ? portal.artBounds() : { x: 0, y: 0, w: 100, h: 160 };
    const to = portal ? { x: portal.particle.position.x + pb.x + pb.w / 2, y: portal.particle.position.y + pb.y + pb.h / 2 } : { x: p.particle.position.x + 25, y: p.particle.position.y + 50 };
    renderer.startExit({ x: p.particle.position.x + 25, y: p.particle.position.y + 50 }, to, reducedMotion ? 8 : SUCK_TICKS);
    exitFocus = { x: to.x - game.camera.x, y: to.y };
    audio.play('suck');
    haptic([20, 30, 40]);
    if (!reducedMotion) particles.emit(to.x, to.y, { count: 30, colors: ['#bff4ff', '#ffffff', '#5fd4ff'], shape: 'star', speed: 4, life: 40, size: 5, gravity: 0 });
    audio.musicLevel(0.4);
  }

  function onLevelComplete() {
    mode = 'complete';
    const result = { level: game.level.name, score: game.score, next: game.level.next, reason: END.COMPLETE };
    audio.play('levelComplete');
    haptic([30, 40, 30]);
    if (typeof params.onComplete === 'function') { params.onComplete(result); return; }
    const next = nextLevelName();
    const roundOver = game.level.next === 'exit';
    const n = /(\d+)$/.exec(game.level.name)?.[1] || '';
    const g = game.goalsView[0];
    const secsUsed = Math.round(game.stepCount * STEP_MS / 1000);
    const scoreEl = el('b', {}, String(stats.startScore));
    const stat = (cls, value, label) => el('div', { class: 'pf-stat ' + cls }, value, el('span', {}, label));
    const card = el('div', { class: 'pf-card', role: 'dialog', 'aria-label': t('complete.title', { n }) },
      el('h2', {}, roundOver ? t('complete.round') : t('complete.title', { n })),
      el('div', { class: 'pf-stats' },
        stat('score', scoreEl, t('complete.score')),
        g ? stat('goal', el('b', {}, `${Math.min(g.achieved, g.required)}/${g.required}`), goalLabel(g.goalType)) : null,
        stat('time', el('b', {}, `${Math.floor(secsUsed / 60)}:${String(secsUsed % 60).padStart(2, '0')}`), t('complete.time')),
        stat('lives', el('b', {}, '♥'.repeat(Math.max(0, game.player.lives)) || '0'), t('complete.lives'))),
      el('div', { class: 'row' },
        next ? button(roundOver ? t('complete.nextRound') : t('complete.next'), () => app.scenes.go('platform', { ...params, level: next, score: game.score, intro: undefined }, { style: 'iris' }), { class: 'primary', id: 'pf-next' })
          : button(t('complete.finish'), () => quit(), { class: 'primary', id: 'pf-next' }),
        button(t('complete.replay'), () => { params = { ...params, intro: '0', score: game.startScore }; startLevel(); }, { id: 'pf-replay' }),
        button(t('complete.quit'), () => quit(), { id: 'pf-quit' })));
    showOverlay(card, { clear: true });
    // Count the score up on the card.
    const from = stats.startScore, to = game.score;
    let k = 0;
    const count = () => {
      if (!overlay || !scoreEl.isConnected) return;
      k = Math.min(1, k + (reducedMotion ? 1 : 0.035));
      scoreEl.textContent = String(Math.round(from + (to - from) * ease.outCubic(k)));
      if (k < 1) { if (Math.round(k * 40) % 3 === 0) audio.play('countTick', { rate: 0.8 + k * 0.6 }); requestAnimationFrame(count); }
    };
    requestAnimationFrame(count);
  }

  // The original's summary page: "You Died!" / "You ran out of time." and "click to try again".
  // Retrying keeps the score, as the original did. (The original restarted the round from its
  // first level; the flow controller can restore that through params.onGameOver.)
  function onGameOver() {
    mode = 'gameover';
    const reason = game.exitReason;
    const result = { level: game.level.name, score: game.score, reason };
    audio.play('gameOver');
    audio.musicLevel(0.3);
    if (typeof params.onGameOver === 'function') { params.onGameOver(result); return; }
    const card = el('div', { class: 'pf-card', role: 'dialog', 'aria-label': reason === END.TIME ? t('gameover.time') : t('gameover.died') },
      el('h2', {}, reason === END.TIME ? t('gameover.time') : t('gameover.died')),
      el('p', {}, tp('gameover.retryPrompt')),
      el('div', { class: 'row' },
        button(t('gameover.retry'), () => { params = { ...params, intro: '0', score: game.score }; startLevel(); }, { class: 'primary', id: 'pf-retry' }),
        button(t('gameover.quit'), () => quit(), { id: 'pf-quit' })));
    showOverlay(card);
  }

  // ------------------------------------------------------------------------------------------
  // Juice: sounds, particles, popups, shake, hit-stop, haptics for the step's notifications.
  // ------------------------------------------------------------------------------------------
  function toScreen(x, y) { return { x: x - game.camera.x, y }; }

  function handleFx(list) {
    const photographed = list.filter(f => f.type === 'photographed');
    let photoIndex = 0;
    for (const f of list) {
      switch (f.type) {
        case 'jump':
          audio.play(f.double ? 'doubleJump' : 'jump');
          renderer.kick(f.double ? 'doubleJump' : 'jump');
          particles.emit(f.x + 24, f.y + 99, { count: f.double ? 10 : 6, colors: ['#bff4ff', '#ffffff', '#5fd4ff'], shape: f.double ? 'star' : 'bubble', speed: 2.2, spread: Math.PI * 0.9, angle: Math.PI / 2, life: 22, size: f.double ? 4 : 3, gravity: 0.04 });
          break;
        case 'land':
          audio.play('land', { volume: 0.7 });
          renderer.kick('land');
          for (const dir of [-1, 1]) particles.emit(f.x + 24 + dir * 14, f.y + 98, { count: 4, colors: ['#fff4e0', '#f3d9b0', '#ffffff'], speed: 1.8, spread: 0.6, angle: dir > 0 ? -0.35 : Math.PI + 0.35, life: 20, size: 3.5, gravity: 0.02, drag: 0.9 });
          break;
        case 'throw':
          audio.play('throw');
          particles.emit(f.x + 10, f.y + 10, { count: 5, colors: f.white ? ['#ffffff', '#ffd6d6'] : ['#d7f6ff', '#ffffff'], shape: 'bubble', speed: 1.5, life: 18, size: 3, gravity: -0.03 });
          break;
        case 'throwAntibiotic': audio.play('throw', { rate: 0.8 }); break;
        case 'photo':
          audio.play('photo');
          if (!reducedMotion) flash = 0.28;
          particles.emit(f.x + (f.dir > 0 ? 30 : -30), f.y, { count: 8, colors: ['#ffffff', '#fff4a8'], shape: 'star', speed: 3, life: 16, size: 4, gravity: 0 });
          break;
        case 'photographed': {
          stats.photos++;
          const e = f.entity;
          const b = e && e.artBounds ? e.artBounds() : { x: 0, y: 0, w: 40, h: 60 };
          const cx = f.x + b.x + b.w / 2, cy = f.y + b.y + b.h / 2;
          particles.emit(cx, cy, { count: 16, colors: ['#fff4a8', '#ffffff', '#6fe0a8'], shape: 'star', speed: 3.5, life: 30, size: 5, gravity: 0.05 });
          popups.add('Snap!', cx, f.y + b.y - 8, { color: '#fff4a8', size: 22 });
          renderer.hitFlash(e, 7);
          hitStop = Math.max(hitStop, HIT_STOP.photo);
          shake.add(0.12);
          haptic(20);
          break;
        }
        case 'goalTick': {
          // A photo that counts sends a sparkle to its tick box on the ePhone; the box fills when
          // it lands. Other goal events tick at once.
          const src = photographed[photoIndex++];
          if (src && !reducedMotion) {
            const e = src.entity;
            const b = e && e.artBounds ? e.artBounds() : { x: 0, y: 0, w: 40, h: 60 };
            const s = toScreen(src.x + b.x + b.w / 2, src.y + b.y + b.h / 2);
            flyers.push({ x0: s.x, y0: s.y, x: s.x, y: s.y, idx: f.n - 1, age: 0 });
            hud.holdTick();
          } else {
            audio.play('tickLand');
          }
          haptic(25);
          break;
        }
        case 'points':
          popups.add((f.n > 0 ? '+' : '') + f.n, f.x + 25, f.y - 30, { color: f.n >= 0 ? '#ffffff' : '#ffb3c0', size: 19 });
          break;
        case 'pickup':
          audio.play('pickup');
          particles.emit(f.x + 18, f.y + 20, { count: 12, colors: ['#bfefff', '#ffffff', '#fff4a8'], shape: 'star', speed: 2.6, life: 26, size: 4, gravity: -0.02 });
          particles.emit(f.x + 18, f.y + 20, { count: 8, colors: ['#bfefff', '#ffffff'], shape: 'bubble', speed: 2, life: 30, size: 5, gravity: -0.05 });
          break;
        case 'hurt':
          audio.play('hurt');
          audio.play('heartLost', { volume: 0.8 });
          shake.add(0.45);
          haptic([60, 40, 60]);
          hitStop = Math.max(hitStop, HIT_STOP.hurt);
          renderer.hitFlash(game.player, 8);
          renderer.kick('hurt');
          particles.emit(f.x + 24, f.y + 40, { count: 12, colors: ['#ff6b81', '#ffffff'], speed: 3, life: 24, size: 4 });
          break;
        case 'splat':
          audio.play(f.white ? 'squelch' : 'bubblePop', { volume: 0.8 });
          particles.emit(f.x, f.y, { count: 8, colors: f.white ? ['#fff5f5', '#ffc0c0'] : ['#d7f6ff', '#ffffff'], shape: 'bubble', speed: 2.2, life: 26, size: 4, gravity: -0.03 });
          break;
        case 'wash':
          audio.play('wash');
          particles.emit(f.x + 30, f.y + 30, { count: 18, colors: ['#d7f6ff', '#ffffff', '#9fe4ff'], shape: 'bubble', speed: 2.5, life: 40, size: 6, gravity: -0.06 });
          break;
        case 'kill':
          if (f.bad) {
            audio.play('splat', { volume: 0.9 });
            particles.emit(f.x + 30, f.y + 35, { count: 18, colors: ['#9be35a', '#5a9e2a', '#e6ff9a'], speed: 3.6, life: 30, size: 5, gravity: 0.15 });
            shake.add(0.25);
            hitStop = Math.max(hitStop, HIT_STOP.kill);
            haptic(35);
          } else {
            audio.play('wrong', { volume: 0.8 });
            particles.emit(f.x + 25, f.y + 30, { count: 12, colors: ['#8fe39a', '#2f7d3f'], speed: 3, life: 26, size: 4 });
            shake.add(0.2);
          }
          if (f.entity) renderer.hitFlash(f.entity, 6);
          break;
        case 'portalOpen': {
          audio.play('portalOpen');
          haptic([30, 50, 30]);
          hud.showBanner(t('hud.portalOpen'));
          const portal = game.portal;
          if (portal) {
            renderer.portalOpenAge = 0;
            const b = portal.artBounds();
            particles.emit(f.x + b.x + b.w / 2, f.y + b.y + b.h / 2, { count: 40, colors: ['#bff4ff', '#ffffff', '#5fd4ff', '#fff4a8'], shape: 'star', speed: 5, life: 44, size: 6, gravity: 0 });
          }
          shake.add(0.15);
          app.announce(t('hud.portalOpen'));
          break;
        }
        case 'yogurt':
          audio.play('yogurt');
          particles.emit(f.x + 75, f.y + 60, { count: 24, colors: ['#ffd0e0', '#ffffff'], shape: 'star', speed: 3, life: 40, size: 6, gravity: 0.02 });
          particles.emit(f.x + 75, f.y + 40, { count: 14, colors: ['#ffe6ef', '#ffffff', '#fff4a8'], shape: 'bubble', speed: 2, spread: 1.2, angle: -Math.PI / 2, life: 46, size: 6, gravity: -0.04 });
          popups.add(t('platform.yogurt'), f.x + 75, f.y - 10, { color: '#ffe6ef', size: 24 });
          if (f.entity) renderer.hitFlash(f.entity, 8);
          shake.add(0.15);
          haptic([20, 30, 20]);
          break;
        case 'milkHit':
          audio.play('milkSplash');
          particles.emit(f.x + 75, f.y + 20, { count: 16, colors: ['#ffffff', '#f4f6ff', '#dfe8ff'], shape: 'bubble', speed: 3, spread: 1.4, angle: -Math.PI / 2, life: 34, size: 5, gravity: 0.12 });
          break;
        case 'explode': {
          // The antibiotic: a burst of capsule shards and sparkles where it went off (if in view),
          // the original's whiteout, and a flash on every microbe it kills.
          audio.play('antibioticBoom');
          if (f.onScreen) {
            particles.emit(f.x + 19, f.y + 8, { count: 26, colors: ['#ff3b4e', '#ffffff', '#ffd6dc'], shape: 'square', speed: 5.5, life: 36, size: 5, gravity: 0.12, drag: 0.94 });
            particles.emit(f.x + 19, f.y + 8, { count: 22, colors: ['#ffffff', '#fff4a8', '#bff4ff'], shape: 'star', speed: 4, life: 44, size: 6, gravity: 0 });
          }
          for (const v of f.entities || []) {
            renderer.hitFlash(v, 10);
            const b = v.artBounds ? v.artBounds() : { x: 0, y: 0, w: 40, h: 60 };
            particles.emit(v.particle.position.x + b.x + b.w / 2, v.particle.position.y + b.y + b.h / 2, { count: 10, colors: ['#ffffff', '#ffd6dc'], shape: 'star', speed: 2.5, life: 26, size: 4, gravity: 0 });
          }
          shake.add(0.7);
          haptic([40, 30, 60]);
          break;
        }
        case 'superHit': {
          const e = f.entity;
          const b = e && e.artBounds ? e.artBounds() : { x: 0, y: 0, w: 400, h: 190 };
          const cx = f.x + b.x + b.w / 2, cy = f.y + b.y + b.h / 2;
          audio.play(f.lives > 0 ? 'superHit' : 'superDefeated');
          if (e) renderer.hitFlash(e, 12);
          particles.emit(cx, cy, { count: f.lives > 0 ? 24 : 60, colors: ['#b04070', '#ff8fd0', '#ffffff', '#6a1a8a'], shape: f.lives > 0 ? 'bubble' : 'star', speed: f.lives > 0 ? 4 : 6, life: f.lives > 0 ? 34 : 60, size: f.lives > 0 ? 6 : 7, gravity: 0.03 });
          const camX = game.camera.x;
          if (f.lives > 0) popups.add('-1', clamp(cx, camX + 90, camX + 710), Math.max(70, f.y + b.y - 6), { color: '#ffd0f0', size: 26 });
          if (f.lives <= 0) { hud.showBanner(t('platform.superDefeated')); app.announce(t('platform.superDefeated')); }
          hitStop = Math.max(hitStop, HIT_STOP.kill);
          shake.add(f.lives > 0 ? 0.35 : 0.8);
          break;
        }
        case 'playerKilled': shake.add(0.6); break;
        default: break;
      }
    }
  }

  // Hoverboard exhaust while riding on the ground.
  function trail() {
    if (tick % 3) return;
    const p = game.player, pb = p.particle;
    const vx = pb.position.x - pb.previousPosition.x;
    if (!pb.supported || Math.abs(vx) < 5) return;
    const back = p.direction === LEFT ? pb.position.x + pb.width - 4 : pb.position.x + 4;
    particles.emit(back, pb.position.y + pb.height - 3, { count: 1, colors: ['#bff4ff', '#ffffff'], shape: 'bubble', speed: 1.2, spread: 0.8, angle: p.direction === LEFT ? -0.3 : Math.PI + 0.3, life: 20, size: 2.5, gravity: -0.03 });
  }

  function updateFlyers() {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.age++;
      const target = hud.tickBoxCentre(f.idx);
      const k = ease.inOutCubic(Math.min(1, f.age / FLYER_TICKS));
      const mx = (f.x0 + target.x) / 2, my = Math.min(f.y0, target.y) - 90;
      const u = 1 - k;
      f.x = u * u * f.x0 + 2 * u * k * mx + k * k * target.x;
      f.y = u * u * f.y0 + 2 * u * k * my + k * k * target.y;
      if (f.age % 2 === 0) screenFx.emit(f.x, f.y, { count: 1, colors: ['#fff4a8', '#ffffff', '#6fe0a8'], shape: 'star', speed: 0.6, life: 16, size: 3, gravity: 0 });
      if (f.age >= FLYER_TICKS) {
        flyers.splice(i, 1);
        hud.landTick();
        audio.play('tickLand');
        screenFx.emit(target.x, target.y, { count: 14, colors: ['#fff4a8', '#ffffff', '#6fe0a8'], shape: 'star', speed: 2.6, life: 22, size: 4, gravity: 0 });
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // Touch controls over targets. The camera is part of the deterministic simulation, so it does
  // not make room for the controls; instead a control fades while a live microbe, pickup, the
  // milk or the portal is under it, so a target is never hidden behind a thumb button. Uses the
  // same stage rectangles as the E2E check (control boxes and entity art rects).
  // ------------------------------------------------------------------------------------------
  function stageControlRects() {
    const r = app.view.rect;
    const key = `${r.left}|${r.top}|${r.width}|${r.height}|${innerWidth}|${innerHeight}|${app.touch.root.hidden}|${input.lastDevice}`;
    if (controlRects && key === controlKey) return controlRects;
    controlKey = key;
    const k = STAGE_W / r.width;
    controlRects = [];
    for (const id of TOUCH_BUTTON_IDS) {
      // The layout box, not getBoundingClientRect(): a pressed control is scaled down a little.
      const node = document.getElementById(id);
      if (!node || !node.offsetParent || !node.offsetWidth) continue;
      const o = node.offsetParent.getBoundingClientRect();
      const left = o.left + node.offsetLeft, top = o.top + node.offsetTop;
      controlRects.push({ id, node, x: (left - r.left) * k, y: (top - r.top) * k, w: node.offsetWidth * k, h: node.offsetHeight * k });
    }
    return controlRects;
  }

  function updateOcclusion() {
    const on = new Set();
    if (mode === 'play' && device() === 'touch') {
      const rects = stageControlRects();
      const camX = game.camera.x;
      for (let i = 1; i < game.entities.length; i++) {
        const e = game.entities[i];
        if (!e || e.removed || e.state === S.BE_KILLED || e.state === S.IGNORE || PROJECTILE_TYPES.includes(e.type)) continue;
        const a = e.artRect();
        const x = a.x - camX;
        if (x > STAGE_W || x + a.w < 0) continue;
        for (const c of rects) if (c.x < x + a.w && x < c.x + c.w && c.y < a.y + a.h && a.y < c.y + c.h) on.add(c.id);
      }
    }
    for (const id of TOUCH_BUTTON_IDS) {
      const want = on.has(id);
      if (want === occluding.has(id)) continue;
      document.getElementById(id)?.classList.toggle('occluding', want);
      if (want) occluding.add(id); else occluding.delete(id);
    }
  }

  // While an antibiotic is carried the camera button throws it (PlayerEntity.as:193-197): the
  // touch camera button wears a capsule badge and says so to screen readers.
  let camBadge = null, camLabel = null;
  function syncCameraBadge(on) {
    const btn = document.getElementById('touch-camera');
    if (!btn) return;
    if (on && !camBadge) {
      camLabel = btn.getAttribute('aria-label');
      camBadge = el('span', { class: 'pf-cam-badge', 'aria-hidden': 'true' });
      camBadge.innerHTML = '<svg viewBox="0 0 30 14"><rect x="1" y="1" width="28" height="12" rx="6" fill="#fff"/><path d="M7 1h8v12H7a6 6 0 0 1 0-12z" fill="#e8283c"/><rect x="1" y="1" width="28" height="12" rx="6" fill="none" stroke="#1b1640" stroke-width="1.2"/></svg>';
      btn.append(camBadge);
      btn.setAttribute('aria-label', t('platform.throwAntibiotic'));
    } else if (!on && camBadge) {
      camBadge.remove(); camBadge = null;
      if (camLabel != null) btn.setAttribute('aria-label', camLabel);
    }
  }

  function startMusicWhenUnlocked() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC[area] || AREA_MUSIC.kitchen);
    audio.musicLevel(mode === 'play' ? 1 : 0.45);
  }

  // ------------------------------------------------------------------------------------------
  const scene = {
    enter(p = {}) {
      params = { ...p };
      app.touch.hide();
      app.__platform = scene;
      settings.addEventListener('change', onSettingChange);
      window.__test && window.__test.register('platform', probe);
      load();
    },

    exit() {
      destroyed = true;
      settings.removeEventListener('change', onSettingChange);
      mode = 'exited';
      updateOcclusion();
      syncCameraBadge(false);
      clearOverlay();
      if (intro) intro.destroy();
      if (hud) hud.destroy();
      app.touch.hide();
      audio.stopMusic();
      window.__test && window.__test.unregister('platform');
      if (app.__platform === scene) app.__platform = null;
    },

    onHidden() { pause(); },

    update() {
      tick++;
      if (nav) nav();
      if (!game) return;
      startMusicWhenUnlocked();
      const dev = device();
      if (mode === 'intro' || mode === 'briefing') {
        if (intro) intro.update();
      } else if (mode === 'paused') {
        if (input.pressed('pause') || input.pressed('back')) resume();
      } else if (mode === 'play') {
        if (input.pressed('pause')) { pause(); return; }
        if (input.pressed('phone')) { openBriefing(); return; }
        stepInput.latch(input);
        phase = (phase + 1) % TICKS_PER_STEP;
        if (phase === 0) {
          if (hitStop > 0) { hitStop--; frozen = true; }
          else {
            frozen = false;
            game.step(stepInput.take());
            handleFx(game.fx);
            if (game.secondsLeft !== lastSecs) {
              lastSecs = game.secondsLeft;
              if (lastSecs <= 10 && lastSecs > 0) audio.play('lowTime');
            }
            if (game.state === GAME_STATE.COMPLETE) startExit();
            else if (game.state === GAME_STATE.GAME_OVER) { mode = 'ending'; endAge = 0; app.touch.hide(); }
          }
        }
        trail();
      } else if (mode === 'exiting') {
        exitAge++;
        const suck = reducedMotion ? 8 : SUCK_TICKS, iris = reducedMotion ? 16 : IRIS_TICKS;
        if (exitAge === suck) audio.play('whoosh', { volume: 0.6 });
        if (exitAge >= suck + iris) onLevelComplete();
      } else if (mode === 'ending') {
        if (++endAge >= 40) onGameOver();
      } else if (mode === 'complete') {
        // Confetti behind the summary card.
        if (!reducedMotion && tick % 4 === 0 && tick < 100000) screenFx.emit(80 + (tick * 37) % 640, -10, { count: 2, colors: ['#ffd84a', '#ff8a5c', '#5fd4ff', '#6fe0a8', '#ffffff'], shape: 'square', speed: 1.2, spread: 1, angle: Math.PI / 2, life: 150, size: 6, gravity: 0.03, drag: 0.99 });
      }
      updateOcclusion();
      syncCameraBadge(!!game.player.has_antibiotic && (mode === 'play' || mode === 'paused' || mode === 'briefing'));
      flash = Math.max(0, flash - 0.04);
      // Paused or briefing: the picture under the card or phone is frozen (particles, popups,
      // shake, sparkles in flight and HUD counters wait); only the HUD's layout follows the device.
      if (mode === 'paused' || mode === 'briefing') { hud.updateLayout(dev); return; }
      time += 0.015;
      if (renderer) { renderer.touchLayout = hud.touchMix > 0.5; renderer.update(); }
      hud.update(game, dev);
      updateFlyers();
      particles.update();
      screenFx.update();
      popups.update();
      shake.update();
    },

    render(ctx, alpha) {
      if (!game) { drawLoading(ctx); return; }
      const a = mode === 'play' && !frozen ? Math.min(1, (phase + alpha) / TICKS_PER_STEP) : 1;
      game.camera.shakeX = shake.x;
      game.camera.shakeY = shake.y;
      renderer.draw(ctx, a, time);
      const vx = game.camera.viewX(a);
      particles.draw(ctx, vx, shake.y);
      popups.draw(ctx, vx, shake.y);
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, 800, 450); }
      const introOn = !!intro;
      hud.draw(ctx, game, { phone: !introOn, reducedMotion });
      if (mode === 'exiting' || mode === 'complete') drawIris(ctx);
      screenFx.draw(ctx);
      for (const f of flyers) drawFlyer(ctx, f);
      if (intro) intro.draw(ctx);
    },
  };

  function drawLoading(ctx) {
    ctx.fillStyle = '#1b1640';
    ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(250, 262, 300, 12);
    ctx.fillStyle = '#ff8a5c';
    ctx.fillRect(250, 262, 300 * loadProgress, 12);
    ctx.fillStyle = '#fdf8ec';
    ctx.font = '800 26px Baloo, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('ui.loading'), 400, 240);
  }

  // Iris closing on the portal after the player has gone through it.
  function drawIris(ctx) {
    const suck = reducedMotion ? 8 : SUCK_TICKS, iris = reducedMotion ? 16 : IRIS_TICKS;
    const k = mode === 'complete' ? 1 : clamp((exitAge - suck) / iris, 0, 1);
    if (k <= 0) return;
    const c = exitFocus || { x: 400, y: 225 };
    ctx.save();
    ctx.fillStyle = '#1b1640';
    if (reducedMotion) {
      ctx.globalAlpha = k;
      ctx.fillRect(0, 0, 800, 450);
    } else {
      const maxR = Math.hypot(Math.max(c.x, 800 - c.x), Math.max(c.y, 450 - c.y));
      const r = maxR * (1 - ease.inOutCubic(k));
      ctx.beginPath();
      ctx.rect(0, 0, 800, 450);
      ctx.arc(c.x, c.y, Math.max(0.01, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      if (r > 1) { ctx.strokeStyle = '#5fd4ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawFlyer(ctx, f) {
    const k = f.age / FLYER_TICKS;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.age * 0.25);
    const r = 9 + 3 * Math.sin(k * Math.PI);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.8);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4a8';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // window.__test probe: everything a bot or test needs to plan moves.
  function probe() {
    if (!game) return { level: params.level || null, state: mode, ui: mode, ready: false, loadProgress };
    return {
      ...game.snapshot(), ui: mode, ready: true, stageWidth: STAGE_W, levelWidth: game.level.width, levelRows: game.level.rows,
      hitStop, device: device(), flyers: flyers.length, time,
      fx: { particles: particles.items.length, popups: popups.items.length, shake: shake.trauma },
      occluding: [...occluding].sort(), reducedMotion: !!reducedMotion,
      intro: intro ? { phase: intro.phase, page: intro.page, pages: intro.pages.length, text: intro.text, briefing: intro.briefing } : null,
      hud: hud ? { ticksShown: hud.ticksShown, touchLayout: hud.touchMix > 0.5, phone: hud.phoneRect(), ...hud.goalPicture() } : null,
      music: musicOn,
    };
  }

  return scene;
}
