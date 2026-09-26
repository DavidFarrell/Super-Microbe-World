// Scene 'kitchen': the kitchen game of round 4 ("Food Hygiene"), ported from
// reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as (NOTES section 5).
// Params (web/js/flow/contract.md): { level: 0..3, avatar: 'harry' | 'amy', score (running kitchen
// total), seed, onComplete(result), onQuit() }; result = { level, score (new total), points,
// report: [{ item, ok, reason, ... }], rows, notes }. Without onComplete (opened directly with
// ?scene=kitchen&level=0) the scene plays the following levels itself, as the original's
// nextLevel() did, and ends on a card back to the main menu.
//
// One scene visit is one level: intro screens (plus the spring-onion tutorial on level 0), play,
// then the outro pages (items placed correctly, incorrectly, microbial mistakes, and the port's
// points page). Game time runs on the 25 fps frame clock derived from the engine's 15 ms ticks
// (frame = floor(ticks * 3 / 8)); a second is 25 frames, the sneeze window 50 (NOTES 12.1). All
// randomness (the food draw and the sneeze roll) comes from gameRng, so runs replay exactly.
import { el, button, focusFirst, focusNavigator, trapFocus } from '../ui/dom.js';
import { audio } from '../core/audio.js';
import { AREA_MUSIC } from '../core/music.js';
import { settings } from '../core/settings.js';
import { t, has } from '../core/i18n.js';
import { Particles, Shake, Popups, haptic } from '../core/fx.js';
import { gameRng } from '../core/rng.js';
import { ease, clamp, lerp } from '../core/tween.js';
import { device, keyFor, promptVars } from '../ui/prompts.js';
import * as art from './art.js';
import { Clip, framesAt, loadKitchenArt } from './art.js';
import { AVATAR_TIMELINE, SINK_TIMELINE } from './timeline.js';
import { LOC, LOC_NAMES, TYPE, LEVELS, SNEEZE_CHANCE_START, drawLevelFood, makeItem, sneezeRoll, judge, hygieneNotes, scoreLevel, reportOf, correctLocations } from './rules.js';
import { TARGET, TARGETS, TAB_ORDER, DEST_ORDER, SLOTS_BY_LOC, REST_POINTS, FOOD_BOX, CLOCK, AVATAR_POS, fitInBox, targetAt, neighbour, centre, inside } from './layout.js';
import { KitchenControls } from './controls.js';
import * as flowSettings from '../flow/settings.js';
import { drawFood, drawBackground, drawCounter, drawSink, drawMark, drawGerms, drawHand, drawBubble, drawGlow, foodSize, roundRect } from './draw.js';
import './sounds.js';

const FPS = 25;                  // frames per game second (1 s = 25 frames exactly, NOTES 12.1)
const SNEEZE_WINDOW = 50;        // frames: setInterval(makeSneeze, 2000) (KitchenGame.as:548)
const BIN_FADE = 5;              // alpha per frame: removeBinItem, _alpha -= 5 every 40 ms (:621-629)
// Port change (NOTES-kitchen-decisions.md, "Timing"): after the last item goes in, the outro waits
// for the first second tick at least this many ticks (0.6 s) later, so the item lands and the
// "All put away!" banner can be read. A time-out already ends on a second tick, so its outro
// follows one second later, as in the original.
const BANNER_MIN = 40;
// Flash device fonts for text drawn inside the original art (NOTES 8.6).
const VERDANA = 'Verdana, "DejaVu Sans", "Liberation Sans", Geneva, sans-serif';
const TOUCH_PAUSE = ['pause'];
const BAG = { x: 52, y: 186 };   // mouth of the shopping bag on the counter (items hop out of it)
const AVATAR_ANIM = { [LOC.CUPBOARD]: 'cupboard', [LOC.BOWL]: 'bowl', [LOC.BIN]: 'bin' };
const PLACE_SOUND = { [LOC.CUPBOARD]: 'kitchenCupboard', [LOC.BOWL]: 'kitchenBowl', [LOC.BIN]: 'kitchenBin' };

// Intro screens (kitchen_game_intro_level_N.swf): string numbers per screen, NOTES 5.11.
const INTRO = [
  [[1, 2], [3, 4], [5, 6, 7], [8]],
  [[1, 2], [3, 4], [5, 6, 7], [8, 9]],
  [[1, 2], [3, 4], [5, 6, 7], [8, 9]],
  [[1, 2], [3, 4], [5, 6, 7]],
];
// The intro SWFs' text fields text0..text11 (DefineEditText rectangles as placed on the root:
// x, y, width, height, gutter included), per level and screen, and for the tutorial's wrong and
// right screens (level 0 frames 60 and 70). Each line starts at its field's top unless the line
// before it runs longer (larger text sizes), which pushes it down. Levels 1-3 put "Level N" in an
// 84.4 px field centred on x 393.05; the port widens it about the same centre.
const TITLE_FIELD = [143.05, 63.75, 500, 28.3];
const INTRO_FIELDS = [
  [
    [[82.05, 63.75, 622, 28.3], [200, 158.9, 342.95, 38.1]],
    [[141, 62.9, 493.95, 62.1], [123, 158.9, 530.95, 62.1]],
    [[141, 62.9, 493.95, 62.1], [134.55, 160.9, 530.95, 29.15], [134.55, 213.45, 530.95, 29.15]],
    [[141, 62.9, 493.95, 193.15]],
  ],
  [
    [TITLE_FIELD, [176, 166.9, 435.95, 80.9]],
    [[141, 62.9, 493.95, 62.1], [123, 158.9, 530.95, 62.1]],
    [[141, 62.9, 493.95, 41.1], [134.55, 160.9, 530.95, 29.15], [134.55, 213.45, 530.95, 54.6]],
    [[141, 62.9, 493.95, 105.1], [141, 202.4, 493.95, 105.1]],
  ],
  [
    [TITLE_FIELD, [176, 166.9, 435.95, 80.9]],
    [[141, 62.9, 493.95, 62.1], [123, 158.9, 530.95, 80.9]],
    [[139, 26.9, 514.95, 103.1], [134.55, 143.9, 530.95, 46.1], [134.55, 200, 530.95, 134]],
    [[141, 62.9, 493.95, 105.1], [141, 202.4, 493.95, 105.1]],
  ],
  [
    [TITLE_FIELD, [176, 166.9, 435.95, 80.9]],
    [[141, 62.9, 493.95, 62.1], [123, 158.9, 530.95, 80.9]],
    [[139, 26.9, 514.95, 103.1], [134.55, 143.9, 530.95, 46.1], [134.55, 200, 530.95, 134]],
  ],
];
const TUTORIAL_FIELDS = {
  wrong: [[120.05, 54.95, 500.1, 31.95], [120.05, 204.2, 530.95, 29.15], [120.05, 256.75, 530.95, 29.15]],
  right: [[120.05, 54.95, 500.1, 36.8], [120.05, 122.2, 530.95, 95.85], [120.05, 238.7, 500.1, 73.4]],
};
const FIELD_SLACK = 40;
// "Microbial Mistakes": the outro's text1..text4 reminder fields are 71 px apart (frame 30).
const NOTE_SLOT = 71;
const OUTRO_PAGES = 4;

const STYLE = `
#ui .kz-layer { position: absolute; inset: 0; pointer-events: none; }
#ui .kz-layer[hidden] { display: none; }
#ui .kz-layer .kz-zone { position: absolute; pointer-events: auto; cursor: pointer; border-radius: 12px; outline: none; touch-action: none; -webkit-tap-highlight-color: transparent; }
#ui .kz-layer .kz-zone[hidden] { display: none; }
#ui .kz-page { position: absolute; inset: 0; pointer-events: none; }
#ui .kz-page * { pointer-events: none; }
#ui .kz-page .kz-live, #ui .kz-page .kz-live * { pointer-events: auto; }
.kz-intro-text { position: absolute; left: 0; top: 0; width: 800px; display: flex; flex-direction: column; align-items: flex-start; text-align: center; }
.kz-intro-text .kz-field { flex: none; box-sizing: border-box; padding-bottom: 8px; }
.kz-intro-text p { margin: 0; color: #fff; font: bold calc(20px * var(--text-scale, 1))/1.25 ${VERDANA}; text-shadow: 0 1px 2px rgba(0,0,0,0.35); animation: kz-rise 0.45s cubic-bezier(.2,1.2,.4,1) both; }
.kz-intro-text p.wrong { font-size: calc(23px * var(--text-scale, 1)); }
.btn.kz-blue { position: absolute; width: 219px; height: 79px; padding: 0; border-radius: 16px; color: #fff; font: 800 34px/1 var(--ui-font); letter-spacing: 0.5px;
  background: linear-gradient(#9ddcff 0%, #58bdf7 46%, #2ea5f2 54%, #3cb2f7 100%); border: 4px solid #0d4f82; box-shadow: 0 5px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.6);
  text-shadow: 0 2px 0 rgba(13,79,130,0.8); }
.btn.kz-blue:hover { background: linear-gradient(#b2e5ff 0%, #6cc7fa 46%, #37acf5 54%, #4bbaf9 100%); }
.btn.kz-blue:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
.kz-hint { position: absolute; left: 0; right: 0; margin: 0 auto; width: fit-content; top: 10px; max-width: 560px; padding: 8px 18px 7px; border-radius: 999px; background: rgba(27,22,64,0.82); color: #fff; font: 700 calc(16px * var(--text-scale, 1))/1.25 var(--body-font); text-align: center; animation: kz-rise 0.4s ease both; }
.kz-legend { position: absolute; left: 0; right: 0; bottom: 6px; margin: 0 auto; width: fit-content; max-width: 780px; padding: 4px 12px 3px; border-radius: 999px; background: rgba(255,255,255,0.86); box-shadow: 0 2px 0 rgba(0,0,0,0.15); text-align: center; white-space: nowrap; color: #1f4d3b; font: 700 calc(12.5px * var(--text-scale, 1))/1.3 var(--body-font); }
.kz-legend kbd { font: 800 12px/1 var(--body-font); background: #1f4d3b; color: #fff; border-radius: 5px; padding: 2px 5px 1px; }
.kz-outro { position: absolute; left: 46px; top: 16px; width: 708px; height: 330px; color: #111; text-align: center; }
.kz-outro h2 { margin: 0; height: 44px; line-height: 44px; font: bold calc(20px * var(--text-scale, 1))/44px ${VERDANA}; color: #111; }
.kz-row { position: absolute; left: 0; width: 708px; height: 36px; font: 400 calc(20px * var(--text-scale, 1))/36px ${VERDANA}; animation: kz-row-in 0.35s ease both; }
.kz-row span { position: absolute; top: 0; text-align: center; }
.kz-row .l { left: 56px; width: 300px; }
.kz-row .x { left: 334px; width: 30px; font-weight: 700; }
.kz-row .n { left: 380px; width: 58px; }
.kz-row .e { left: 460px; width: 30px; font-weight: 700; }
.kz-row .s { left: 510px; width: 124px; }
.kz-row.good .s, .kz-row.good .n { color: #13854a; font-weight: 700; }
.kz-row.bad .s, .kz-row.bad .n { color: #c02a3f; font-weight: 700; }
.kz-notes { position: absolute; left: 30px; top: 48px; width: 648px; height: 272px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; justify-content: flex-start; }
#ui .kz-page .kz-notes { pointer-events: auto; }
.kz-notes p { margin: 0; flex: none; font: 400 calc(16px * var(--text-scale, 1))/1.35 ${VERDANA}; color: #111; animation: kz-row-in 0.35s ease both; }
.kz-notes.slots p { min-height: ${NOTE_SLOT - 12}px; }
.kz-notes.many { gap: 4px; top: 46px; height: 284px; }
.kz-notes.many p { font-size: calc(14px * var(--text-scale, 1)); line-height: 1.25; }
.kz-notes.scrolls { justify-content: flex-start; padding-bottom: 26px; -webkit-mask-image: linear-gradient(#000 calc(100% - 44px), transparent); mask-image: linear-gradient(#000 calc(100% - 44px), transparent); }
.kz-notes.scrolls.end { -webkit-mask-image: none; mask-image: none; }
.kz-notes p.none { color: #13854a; font-weight: 700; }
.kz-points { position: absolute; left: 0; top: 58px; width: 708px; display: flex; flex-direction: column; align-items: stretch; gap: 14px; }
.kz-points .pair { display: flex; margin: 0 40px; }
.kz-points .pair .kz-total { flex: 1 1 0; }
.kz-total { font: 400 calc(20px * var(--text-scale, 1))/1.2 ${VERDANA}; animation: kz-row-in 0.35s ease both; }
.kz-total b { display: block; margin-top: 4px; font: bold 40px/1 ${VERDANA}; color: #1b1640; }
.kz-total.big b { font-size: 56px; }
.kz-total.small { font-size: calc(17px * var(--text-scale, 1)); color: #444; }
.kz-total.small b { font-size: 30px; }
.kz-total.plus b { color: #13854a; } .kz-total.minus b { color: #c02a3f; }
.kz-pageno { position: absolute; right: 18px; bottom: 2px; font: 400 calc(13px * var(--text-scale, 1)) var(--body-font); color: #666; }
.kz-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(20, 14, 50, 0.5); }
.kz-card { width: 520px; max-width: 92%; background: var(--panel); color: var(--ink); border-radius: 26px; padding: 22px 26px 20px; text-align: center; box-shadow: 0 10px 0 rgba(0,0,0,0.3); border: 4px solid rgba(255,255,255,0.15); animation: kz-card-in 0.35s cubic-bezier(.2,1.4,.4,1) both; }
.kz-card h2 { margin: 0 0 8px; font: 800 calc(34px * var(--text-scale, 1))/1.1 var(--ui-font); }
.kz-card p { margin: 6px 0 14px; font: 400 calc(19px * var(--text-scale, 1))/1.35 var(--body-font); }
.kz-card .row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.kz-card .kz-toggle { font-size: calc(16px * var(--text-scale, 1)); min-height: max(44px, calc(46px / var(--stage-scale, 1))); padding: 8px 18px 6px; }
@keyframes kz-rise { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes kz-row-in { from { transform: translateX(-14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes kz-card-in { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .kz-intro-text p, .kz-row, .kz-notes p, .kz-total, .kz-card, .kz-hint { animation: none !important; } }
html.reduced-motion .kz-intro-text p, html.reduced-motion .kz-row, html.reduced-motion .kz-notes p, html.reduced-motion .kz-total, html.reduced-motion .kz-card, html.reduced-motion .kz-hint { animation: none !important; }
`;

export function kitchenScene(app) {
  const input = app.input;
  const particles = new Particles(500);
  const popups = new Popups();
  const shake = new Shake();
  let params = {};
  let mode = 'loading';          // loading | intro | tutorial | play | outro | done | paused
  let pausedFrom = null;
  let destroyed = false;
  let artReady = false, loadProgress = 0;
  let level = 0, avatar = 'harry';
  let startScore = 0;            // running kitchen total when this level started
  let lastResult = null;
  let tick = 0, cosmetic = 0;    // engine ticks (all modes) and a cosmetic frame clock
  let reduced = !!settings.get('reducedMotion');

  // Level state (reset by startLevel).
  let items = [], itemIndex = 0, current = null, placements = [];
  let slotContent = new Map();   // rest point name -> { item, alpha, landed }
  let slotOrder = [];            // per location: rest point names in fill order
  let timeLeft = 60, gstate = 'wait', sneezeChance = SNEEZE_CHANCE_START, sneezeFrames = 0;
  let hands = { sneeze: false, meat: false };
  let playTicks = 0, frame = 0, secFrames = 0;
  let endReason = null;
  let summary = null, report = null;

  // Interaction and juice state.
  let held = false, dragging = false, focusId = null;
  let flights = [], marks = [], arrival = null, banner = null, shimmer = 0, clockPulse = 0;
  let introPage = 0, tutorialStep = null, outroPage = 0;
  let avatarClip = null, sinkClip = null;
  let controls = null;
  let pageLayer = null, overlay = null, nav = null, untrap = null, legend = null;
  let lastDevice = null;
  let musicOn = false;
  let wobble = null;             // the tissues shrug when tapped outside a sneeze
  let keptFocus = false;         // keyboard: Enter on a destination keeps the focus there

  // ------------------------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------------------------
  const spec = () => LEVELS[level];
  const foodName = item => t('kitchen.food.' + item.asset);
  const clickWord = cap => t(`kitchen.${cap ? 'Click' : 'click'}.${device()}`);
  // The move keys as prompts name them: the arrows while the four directions still start with
  // them, else the first key of each direction as remapped in Settings.
  function moveKeys(form) {
    const keys = settings.get('keys') || {};
    const arrows = ['Left', 'Right', 'Up', 'Down'].every(d => (keys[d.toLowerCase()] || [])[0] === 'Arrow' + d);
    return arrows ? t('kitchen.keys.' + form) : ['up', 'left', 'down', 'right'].map(keyFor).join(' ');
  }
  // The controls the kitchen reads itself (controls.js: T, C, H, Enter) keep their literal names;
  // gamepad names come from web/js/ui/prompts.js.
  const words = () => ({
    ...promptVars(device()), click: clickWord(false), Click: clickWord(true), seconds: LEVELS[3].seconds,
    arrowKeys: moveKeys('arrows'), ArrowKeys: moveKeys('Arrows'),
  });
  // A string's variant for the input in use (key.keyboard, key.gamepad) when it has one: the
  // intro sentences that name a control say "click on the tissues (or press T)", "tap on the
  // tissues" or "press B for the tissues" (the rest of the 2009 wording is unchanged).
  const tx = key => { const k = `${key}.${device()}`; return t(has(k) ? k : key, words()); };
  const textScale = () => clamp(Number(settings.get('textScale')) || 1, 1, 1.5);

  function counterRect(item) {
    const [w, h] = foodSize(item.asset);
    return { x: FOOD_BOX.x + FOOD_BOX.w - w, y: FOOD_BOX.y + FOOD_BOX.h - h, w, h };
  }

  function clearPage() { if (pageLayer) { pageLayer.remove(); pageLayer = null; } legend = null; }
  function setPage(node, { live = [] } = {}) {
    clearPage();
    pageLayer = el('div', { class: 'kz-page', 'data-native-keys': true }, node);
    for (const n of live) n.classList.add('kz-live');
    app.ui.append(pageLayer);
    return pageLayer;
  }

  function clearOverlay() {
    if (untrap) { untrap(); untrap = null; }
    if (overlay) {
      const had = overlay.contains(document.activeElement);
      overlay.remove();
      if (had) document.getElementById('game')?.focus({ preventScroll: true });
    }
    overlay = null; nav = null;
  }

  function blueButton(label, id, onActivate, pos) {
    const b = button(label, onActivate, { class: 'kz-blue', id });
    Object.assign(b.style, { left: pos.x + 'px', top: pos.y + 'px' });
    return b;
  }

  function startMusic() {
    if (musicOn || !audio.ctx || audio.ctx.state !== 'running') return;
    audio.playMusic(AREA_MUSIC.kitchenGame);
    musicOn = true;
  }

  // ------------------------------------------------------------------------------------------
  // Loading and level start
  // ------------------------------------------------------------------------------------------
  async function load() {
    if (!document.getElementById('kitchen-style')) document.head.append(el('style', { id: 'kitchen-style' }, STYLE));
    artReady = await loadKitchenArt(avatar, p => { loadProgress = p; }).catch(() => false);
    if (destroyed) return;
    startLevel(level);
  }

  function startLevel(n, { skipIntro = false } = {}) {
    level = clamp(n | 0, 0, 3);
    reduced = !!settings.get('reducedMotion');
    items = drawLevelFood(level, gameRng).map((food, i) => makeItem(food, i));
    itemIndex = 0; current = null; placements = [];
    slotContent = new Map();
    slotOrder = SLOTS_BY_LOC.map(() => []);
    timeLeft = spec().seconds;
    gstate = 'wait'; sneezeChance = SNEEZE_CHANCE_START; sneezeFrames = 0;
    hands = { sneeze: false, meat: false };
    playTicks = 0; frame = 0; secFrames = 0; endReason = null;
    summary = null; report = null;
    held = false; dragging = false; focusId = null;
    flights = []; marks = []; arrival = null; banner = null; shimmer = 0; clockPulse = 0;
    particles.clear(); popups.clear(); shake.clear();
    avatarClip = new Clip('kitchen_' + avatar, AVATAR_TIMELINE);
    avatarClip.gotoAndPlay('idle');
    sinkClip = new Clip('kitchen_sink', SINK_TIMELINE);
    if (controls) controls.clear();
    // The first item is on the counter behind the intro, as in the original's intro pictures;
    // level 0's tutorial uses a spring onion (kitchen_game_intro_level_0.swf frame 50).
    current = level === 0 && !skipIntro ? makeItem(25, -1) : items[0];
    if (skipIntro) beginPlay();
    else showIntro(0);
  }

  // ------------------------------------------------------------------------------------------
  // Intro screens and the level-0 tutorial
  // ------------------------------------------------------------------------------------------
  // Every intro line is white Verdana Bold 20; only "Wrong!  Try again." is 23 (NOTES 8.6).
  function introLines(page) {
    if (page === 'wrong') return [['kitchen.intro.0.wrong', 'wrong'], ['kitchen.intro.0.6'], ['kitchen.intro.0.7']];
    if (page === 'right') return [['kitchen.intro.0.right'], ['kitchen.intro.0.goal'], ['kitchen.intro.0.ready']];
    return INTRO[level][page].map(k => [`kitchen.intro.${level}.${k}`]);
  }

  function showIntro(page, { quiet = false } = {}) {
    mode = 'intro';
    introPage = page;
    tutorialStep = null;
    held = false; dragging = false;
    if (controls) controls.hide();
    const lines = introLines(page);
    const fields = typeof page === 'string' ? TUTORIAL_FIELDS[page] : INTRO_FIELDS[level][page];
    const last = page === 'right' || (typeof page === 'number' && level > 0 && page === INTRO[level].length - 1);
    const label = last ? t('kitchen.button.start') : t('kitchen.button.next');
    const next = blueButton(label, 'kz-next', () => introNext(), { x: 282.7, y: 335.4 });
    // Each line sits in its text field (2 px Flash gutter); a field's height runs to the next
    // field's top, so a line that wraps further pushes the rest down instead of overlapping.
    const text = el('div', { class: 'kz-intro-text', role: 'dialog', 'aria-live': 'polite' },
      lines.map(([key, cls], i) => {
        const [x, y, w, h] = fields[Math.min(i, fields.length - 1)];
        const below = fields[i + 1];
        const p = el('p', { class: cls || null }, tx(key));
        p.style.animationDelay = `${i * 0.12}s`;
        const f = el('div', { class: 'kz-field' }, p);
        // Widened by up to FIELD_SLACK a side about the same centre: the browser's stand-in for
        // Verdana Bold can run a little wider than Flash's, and a line should not wrap for that.
        const slack = Math.min(FIELD_SLACK, x + 2 - 16, 800 - 16 - (x + w - 2));
        Object.assign(f.style, { marginLeft: `${x + 2 - slack}px`, width: `${w - 4 + slack * 2}px`, minHeight: `${below ? below[1] - y : h - 4}px` });
        return f;
      }));
    text.style.paddingTop = `${fields[0][1] + 2}px`;
    setPage(el('div', {}, text, next), { live: [next] });
    focusFirst(pageLayer);
    app.touch.show(TOUCH_PAUSE);
    if (!quiet) audio.play('pageTurn');
  }

  function introNext() {
    if (mode !== 'intro') return;
    const page = introPage;
    if (page === 'right') { beginPlay(); return; }
    if (page === 'wrong') { showTutorial(); return; }
    if (page < INTRO[level].length - 1) { showIntro(page + 1); return; }
    if (level === 0) showTutorial();
    else beginPlay();
  }

  // Level 0: "click on the correct place in the fridge to put away the spring onion". The right
  // place is the drawer (right_button at (473.05, 215.9)); the five wrong_buttons cover the
  // cupboard, the bowl, the fridge shelves, the door and the bin (intro SWF frame 50).
  function showTutorial() {
    mode = 'tutorial';
    tutorialStep = 'ask';
    held = false; dragging = false;
    current = makeItem(25, -1);
    tutorialHint();
    showControls(['item', ...DEST_ORDER]);
    if (device() !== 'touch') setFocus('item');
    app.touch.show(TOUCH_PAUSE);
  }

  function tutorialHint() {
    setPage(el('div', { class: 'kz-hint', role: 'status' }, t('kitchen.tutorial.hint.' + device(), words())));
  }

  function tutorialAnswer(loc) {
    if (loc === LOC.FRIDGE_DRAWER) {
      audio.play('kitchenFridge');
      avatarClip.gotoAndPlay('fridge');
      const slot = SLOTS_BY_LOC[LOC.FRIDGE_DRAWER][0];
      const [w, h] = foodSize(current.asset);
      const to = fitInBox(slot, w, h);
      const from = dragging && controls && controls.dragPos ? { x: controls.dragPos.x - w / 2, y: controls.dragPos.y - h / 2, w, h } : liftedRect(current);
      slotContent.set(slot.name, { item: current, alpha: 100, fading: false, landed: false });
      flights.push({ item: current, from, to, slot: slot.name, loc: LOC.FRIDGE_DRAWER, age: 0, dur: reduced ? 1 : 16, verdict: 'tutorial' });
      current = null;
      held = false; dragging = false;
      haptic(20);
      showIntro('right');
    } else {
      audio.play('kitchenWrong');
      shake.add(0.25);
      haptic(40);
      showIntro('wrong');
    }
  }

  // ------------------------------------------------------------------------------------------
  // Play
  // ------------------------------------------------------------------------------------------
  function beginPlay() {
    clearPage();
    mode = 'play';
    tutorialStep = null;
    playTicks = 0; frame = 0; secFrames = 0;
    held = false; dragging = false;
    slotContent = new Map();
    slotOrder = SLOTS_BY_LOC.map(() => []);
    flights = []; marks = [];
    avatarClip.gotoAndPlay('idle');
    itemIndex = 0;
    current = null;
    pickItem();
    showControls(TAB_ORDER);
    if (device() !== 'touch') setFocus('item');
    else focusId = null;
    buildLegend();
    app.touch.show(TOUCH_PAUSE);
    audio.musicLevel(1);
    if (app.registerServiceWorker) app.registerServiceWorker();
  }

  function showControls(ids) {
    if (!controls) controls = new KitchenControls(app, { label: t('kitchen.zones') });
    controls.show(app.ui, ids);
    controls.enabledKeys = true;
    refreshLabels();
  }

  function refreshLabels() {
    if (!controls) return;
    for (const tg of TARGETS) {
      let label = t('kitchen.target.' + tg.id);
      if (tg.id === 'item') label = current ? t(held ? 'kitchen.target.itemHeld' : 'kitchen.target.item', { food: foodName(current) }) : '';
      controls.setLabel(tg.id, label);
    }
  }

  // Key or button names for the HUD bubbles and the legend: T / H on a keyboard (controls.js reads
  // them directly), the gamepad's B / Y (handleActions: camera = tissues, phone = wash).
  const toolKey = tool => (device() === 'gamepad'
    ? promptVars('gamepad')[tool === 'wash' ? 'key_phone' : tool === 'cling' ? 'key_fire' : 'key_camera']
    : t(`kitchen.legend.${tool === 'wash' ? 'washKey' : tool === 'cling' ? 'clingKey' : 'tissuesKey'}`));

  // HUD bubble texts: "Wash (H)" / "Wash (Y)" / "Wash", "Tissue! (T)" / "Tissue! (B)" / "Tissue!".
  const washLabel = () => (gstate === 'wash' ? t('kitchen.hud.washing')
    : device() === 'touch' ? t('kitchen.hud.washTap') : t('kitchen.hud.washKey', { key: toolKey('wash') }));
  const tissueLabel = () => (device() === 'touch' ? t('kitchen.hud.tissueTap') : t('kitchen.hud.tissueKey', { key: toolKey('tissues') }));

  // Control legend along the bottom of the counter (keyboard and gamepad; touch players tap the
  // art). Pause and the move keys follow Settings; Tab, Enter, T, C and H are read directly.
  function buildLegend() {
    clearPage();
    const dev = device();
    if (mode !== 'play' || dev === 'touch') return;
    const pad = dev === 'gamepad';
    const v = promptVars(dev);
    const pairs = [
      [pad ? t('kitchen.legend.dpad') : t('kitchen.legend.moveKeys', { keys: moveKeys('arrowsShort') }), 'kitchen.legend.move'],
      [pad ? v.key_jump : t('kitchen.legend.actKeys'), 'kitchen.legend.act'],
      [toolKey('tissues'), 'kitchen.legend.tissues'], [toolKey('cling'), 'kitchen.legend.cling'],
      [toolKey('wash'), 'kitchen.legend.wash'], [pad ? v.key_pause : keyFor('pause'), 'kitchen.legend.pause']];
    const parts = [];
    pairs.forEach(([k, label], i) => { if (i) parts.push('   '); parts.push(el('kbd', {}, k), ' ' + t(label)); });
    legend = el('div', { class: 'kz-legend', 'aria-hidden': 'true' }, parts);
    setPage(legend);
  }

  // pickItem() (KitchenGame.as:780-800): the next item, or the end of the level once every item
  // is placed (the outro then follows at the next one-second tick).
  function pickItem({ prefix = '' } = {}) {
    if (itemIndex >= items.length) {
      current = null;
      if (prefix) app.announce(prefix);
      endLevel('done');
      return;
    }
    current = items[itemIndex];
    gstate = 'wait';
    arrival = { age: 0, dur: reduced ? 1 : 22 };
    audio.play('kitchenPop', { rate: 0.9 + (itemIndex % 5) * 0.05 });
    refreshLabels();
    app.announce((prefix ? prefix + ' ' : '') + t('kitchen.say.next', { food: foodName(current) }));
  }

  function endLevel(reason) {
    if (gstate === 'end') return;
    // The original's 2 s sneeze interval outlived the end of the level and could set the state
    // back to WAIT (KitchenGame.as:548,602-611 vs :148-151): the port cancels the sneeze.
    if (gstate === 'sneeze') avatarClip.gotoAndPlay('idle');
    gstate = 'end';
    endReason = reason;
    held = false; dragging = false;
    if (controls) controls.clear();
    banner = { text: t(reason === 'time' ? 'kitchen.hud.timeUp' : 'kitchen.hud.allDone'), age: 0 };
    audio.play(reason === 'time' ? 'kitchenTimeUp' : 'kitchenDone');
    if (reason === 'done' && !reduced) for (let i = 0; i < 3; i++) particles.emit(250 + i * 150, 120, { count: 16, colors: ['#ffd84a', '#ff8a5c', '#5fd4ff', '#6fe0a8', '#ffffff'], shape: 'square', speed: 4, life: 60, size: 5, gravity: 0.12 });
  }

  // One 40 ms frame of the original's main() (KitchenGame.as:144-191), plus the sneeze interval.
  // The sneeze window and the seconds both run on this clock, so a sneeze always ends on a second
  // boundary: the second is handled first (no sneeze roll while sneezing), then the window, so a
  // new sneeze can never start in the frame the last one ended.
  function onFrame() {
    avatarClip.tick();
    sinkClip.tick();
    for (const s of slotContent.values()) if (s.fading && s.landed && s.alpha > 0) s.alpha = Math.max(0, s.alpha - BIN_FADE);
    const sneezing = gstate === 'sneeze';
    if (++secFrames >= FPS) { secFrames = 0; onSecond(); }
    if (sneezing && gstate === 'sneeze' && ++sneezeFrames >= SNEEZE_WINDOW) makeSneeze();
  }

  function onSecond() {
    // The outro follows at the next second tick (KitchenGame.as:168-177), but no sooner than 40
    // ticks (0.6 s) after the end so the "All put away!" banner can be read.
    if (gstate === 'end') { if (!banner || banner.age >= BANNER_MIN) finishLevel(); return; }
    timeLeft--;
    if (timeLeft < 0) {
      // The original showed "99" for this last second (KitchenGame.as:148-151); the port shows 0.
      timeLeft = 0;
      endLevel('time');
      return;
    }
    if (timeLeft <= 10) { clockPulse = 1; audio.play('kitchenTick', { rate: timeLeft <= 3 ? 1.25 : 1 }); }
    if (gstate === 'wait') {
      if (spec().sneezes && sneezeRoll(gameRng) > sneezeChance) {
        startSneeze();
        sneezeChance++;
      }
    } else if (gstate === 'wash') {
      if (!avatarClip.midAnimation) {
        hands.sneeze = false;
        hands.meat = false;
        gstate = 'wait';
        audio.play('kitchenCorrect', { volume: 0.6 });
        popups.add('✓', 348, 196, { color: '#b9f6c9', size: 24 });
        app.announce(t('kitchen.say.washed'));
      }
    }
  }

  // --- sneezes (KitchenGame.as:545-550, 602-619) ---------------------------------------------
  function startSneeze() {
    gstate = 'sneeze';
    sneezeFrames = 0;
    if (held || dragging) { held = false; dragging = false; audio.play('kitchenDrop'); }
    avatarClip.gotoAndPlay('sneeze_Start');
    audio.play('kitchenSneezeUp');
    haptic([15, 60, 15]);
    app.announce(t('kitchen.say.sneeze'));
  }

  function makeSneeze() {
    gstate = 'wait';
    if (current) { current.sneeze = true; if (!current.sneezeFrom) current.sneezeFrom = 'food'; }
    hands.sneeze = true;
    avatarClip.gotoAndPlay('sneeze_food_end');
    audio.play('kitchenSneeze');
    audio.play('kitchenGerm');
    shake.add(0.35);
    haptic([40, 30, 40]);
    const from = mouth();
    const to = current ? centre(counterRect(current)) : { x: 170, y: 220 };
    if (!reduced) particles.emit(from.x, from.y, { count: 26, colors: ['#8fe36b', '#c5f59a', '#5cc24a', '#ffffff'], speed: 5, spread: 0.9, angle: Math.atan2(to.y - from.y, to.x - from.x), life: 34, size: 3.2, gravity: 0.15 });
    popups.add(t('kitchen.hud.germs'), to.x, to.y - 40, { color: '#b9f6a0', size: 20 * textScale() });
    app.announce(t('kitchen.say.sneezed'));
  }

  function sneezeHankie() {
    gstate = 'wait';
    hands.sneeze = true;   // "infect hand with sneeze microbes" (KitchenGame.as:616-617)
    avatarClip.gotoAndPlay('sneeze_tissue_end');
    audio.play('kitchenTissue');
    haptic(20);
    const m = mouth();
    if (!reduced) particles.emit(m.x, m.y, { count: 14, colors: ['#ffffff', '#f3f7ff', '#ffd6f0'], shape: 'square', speed: 2.2, life: 30, size: 4, gravity: 0.05 });
    app.announce(t('kitchen.say.tissue'));
  }

  // Where the sneeze comes from: near the avatar's face (behind the counter at (65.5, 8.7)).
  const mouth = () => (avatar === 'amy' ? { x: 196, y: 108 } : { x: 190, y: 104 });

  // --- input ------------------------------------------------------------------------------------
  // receiveInput(buttonName) (KitchenGame.as:632-777). A sneeze in progress takes any input: the
  // tissues catch it, anything else sneezes on the food. Otherwise input counts only in WAIT
  // (not while washing or after the level ended).
  function activate(id) {
    const tg = TARGET[id];
    if (!tg) return;
    if (mode === 'tutorial') {
      if (tg.kind === 'loc') tutorialAnswer(tg.loc);
      else if (tg.kind === 'item') toggleHeld();
      return;
    }
    if (mode !== 'play') return;
    if (gstate === 'sneeze') {
      if (tg.kind === 'tissues') sneezeHankie();
      else if (tg.kind !== 'item') makeSneeze();
      return;
    }
    if (gstate !== 'wait' || !current) return;
    switch (tg.kind) {
      case 'item': toggleHeld(); break;
      case 'tissues': wobble = { id: 'tissues', age: 0 }; break;   // nothing outside a sneeze
      case 'clingfilm': wrap(); break;
      case 'sink': wash(); break;
      case 'loc': place(tg.loc); break;
      default: break;
    }
  }
  function toggleHeld() {
    if (!current) return;
    held = !held;
    audio.play(held ? 'kitchenLift' : 'kitchenDrop');
    refreshLabels();
    if (held && focusId && TARGET[focusId].kind !== 'loc' && device() !== 'touch') setFocus(bestDestination());
    if (!held && focusId && device() !== 'touch') setFocus('item');
  }

  // Keyboard convenience when lifting an item: start from the fridge door area... never the
  // answer (that would give the game away): the first destination in the Tab order.
  const bestDestination = () => DEST_ORDER[0];

  function wrap() {
    // clingfilm (KitchenGame.as:764-770): allowed on any item; no avatar animation.
    if (!current) return;
    const again = current.clingfilm;
    current.clingfilm = true;
    shimmer = 1;
    audio.play('kitchenCling', { volume: again ? 0.5 : 1 });
    const r = counterRect(current);
    if (!again) {
      if (!reduced) particles.emit(r.x + r.w / 2, r.y + r.h / 2, { count: 10, colors: ['#ffffff', '#dff3ff', '#bfefff'], shape: 'star', speed: 2.2, life: 26, size: 4, gravity: -0.02 });
      app.announce(t('kitchen.say.covered'));
    }
  }

  function wash() {
    // sink_area (KitchenGame.as:772-774): WASH_HANDS until the animation ends and a second ticks.
    gstate = 'wash';
    held = false; dragging = false;
    avatarClip.gotoAndPlay('wash_hands');
    sinkClip.gotoAndPlay('tab_wash_hand');
    audio.play('kitchenWash');
    refreshLabels();
  }

  // Rest point placement (KitchenGame.as:643-746) at the tapped location's next free slot.
  function place(loc) {
    const item = current;
    if (!item) return;
    avatarClip.gotoAndPlay(AVATAR_ANIM[loc] || 'fridge');
    // Hands to food (:680-694): sneeze microbes spread to one item, then the hands are clean.
    if (hands.sneeze) {
      item.sneeze = true;
      if (!item.sneezeFrom) item.sneezeFrom = 'hands';
      hands.sneeze = false;
    }
    // Decision #13: raw meat contaminates the hands until they are washed (the original meant to
    // but tested and wrote the wrong fields, :685-689); anything else handled meanwhile carries
    // the microbes and earns the "Raw Meat Hands" reminder.
    if (hands.meat && item.type !== TYPE.RAW_MEAT) item.meatHands = true;
    if (item.type === TYPE.RAW_MEAT) hands.meat = true;

    const slot = nextSlot(loc);
    const [w, h] = foodSize(item.asset);
    const to = fitInBox(slot, w, h);
    const from = dragging && controls && controls.dragPos
      ? { x: controls.dragPos.x - w * 0.55, y: controls.dragPos.y - h * 0.55, w: w * 1.1, h: h * 1.1 }
      : liftedRect(item);
    slotContent.set(slot.name, { item, alpha: 100, fading: loc === LOC.BIN, landed: false });
    flights.push({ item, from, to, slot: slot.name, loc, age: 0, dur: reduced ? 1 : 16, verdict: judge(item, loc).verdict });
    placements.push({ item, loc });
    audio.play(PLACE_SOUND[loc] || 'kitchenFridge');

    held = false; dragging = false;
    itemIndex++;
    const verdict = flights[flights.length - 1].verdict;
    const said = t(verdict === 'correct' ? 'kitchen.say.right' : verdict === 'incorrect' ? 'kitchen.say.wrong' : 'kitchen.say.binned');
    pickItem({ prefix: said });
    // Keyboard: after placing a lifted item the focus returns to the next item; a direct Enter on
    // a destination keeps the focus there (quick for runs of the same kind).
    if (device() !== 'touch' && focusId && !keptFocus && current) setFocus('item');
  }
  function nextSlot(loc) {
    const slots = SLOTS_BY_LOC[loc];
    const order = slotOrder[loc];
    let slot = slots.find(s => !slotContent.has(s.name));
    if (!slot) {
      // Every slot is taken: reuse the oldest one (the original simply replaced the item shown in
      // the clicked slot; every placement still counts, :730-733).
      const name = order.shift();
      slot = slots.find(s => s.name === name) || slots[0];
    }
    const i = order.indexOf(slot.name);
    if (i >= 0) order.splice(i, 1);
    order.push(slot.name);
    return slot;
  }

  function liftedRect(item) {
    const r = counterRect(item);
    if (!held) return r;
    return { x: r.x, y: r.y - 10, w: r.w, h: r.h };
  }

  function landFlight(f) {
    const s = slotContent.get(f.slot);
    if (s && s.item === f.item) s.landed = true;
    const cx = f.to.x + f.to.w / 2, cy = f.to.y + f.to.h / 2;
    const ts = textScale();
    if (f.verdict === 'correct' || f.verdict === 'tutorial') {
      audio.play('kitchenCorrect');
      burst(cx, cy, true);
      if (f.verdict === 'correct') popups.add('+10', cx, f.to.y - 16, { color: '#b9f6c9', size: 20 * ts });
      haptic(15);
    } else if (f.verdict === 'incorrect') {
      audio.play('kitchenWrong');
      popups.add('-10', cx, f.to.y - 16, { color: '#ffb3c0', size: 20 * ts });
      shake.add(0.28);
      haptic(45);
    } else {
      popups.add(t('kitchen.hud.binned'), cx, f.to.y - 12, { color: '#ffffff', size: 18 * ts });
      if (!reduced) particles.emit(cx, cy, { count: 10, colors: ['#c9c9c9', '#9a9a9a', '#e8e8e8'], speed: 1.6, life: 26, size: 3, gravity: 0.05 });
    }
    // A tick for right (and for bad food binned, which is right to do though it scores nothing).
    marks.push({ x: cx, y: f.to.y - 4, ok: f.verdict !== 'incorrect', age: 0, life: 70 });
    if (f.verdict !== 'tutorial' && hygieneNotes(f.item, f.loc).length) audio.play('kitchenGerm');
  }

  function burst(x, y, good) {
    if (reduced) return;
    particles.emit(x, y, { count: good ? 14 : 6, colors: good ? ['#fff4a8', '#ffffff', '#6fe0a8'] : ['#ffb3c0', '#ffffff'], shape: 'star', speed: 3, life: 28, size: 4.5, gravity: 0.04 });
  }

  // --- focus (keyboard) -------------------------------------------------------------------------
  function focusIds() {
    if (mode === 'tutorial') return held ? DEST_ORDER : ['item', ...DEST_ORDER];
    return held ? DEST_ORDER : TAB_ORDER;
  }

  function setFocus(id) {
    focusId = id;
    if (controls && id) controls.focus(id);
  }

  function moveFocus(dx, dy) {
    const ids = focusIds();
    if (!focusId || !ids.includes(focusId)) { setFocus(ids[0]); return; }
    const n = neighbour(focusId, dx, dy, ids);
    if (n) { setFocus(n); audio.play('hover', { volume: 0.7 }); }
  }

  function cycleFocus(dir) {
    const ids = focusIds();
    const i = ids.indexOf(focusId);
    const next = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
    setFocus(ids[next]);
    audio.play('hover', { volume: 0.7 });
  }

  function handleKey(code, shift) {
    switch (code) {
      case 'Tab': cycleFocus(shift ? -1 : 1); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        if (!focusId) { setFocus(focusIds()[0]); break; }
        keptFocus = !held && TARGET[focusId].kind === 'loc';
        activate(focusId);
        keptFocus = false;
        break;
      case 'KeyT': case 'Digit1': case 'Numpad1': if (mode === 'play') activate('tissues'); break;
      case 'KeyC': case 'Digit2': case 'Numpad2': if (mode === 'play') activate('clingfilm'); break;
      case 'KeyH': case 'Digit3': case 'Numpad3': if (mode === 'play') activate('sink'); break;
      case 'Backspace': if (held) toggleHeld(); break;
      default: break;
    }
  }

  function handleEvents() {
    if (!controls) return;
    for (const ev of controls.take()) {
      if (mode !== 'play' && mode !== 'tutorial') continue;
      if (ev.type === 'key') { handleKey(ev.code, ev.shift); continue; }
      if (ev.type === 'tap') { if (device() === 'touch' || ev.id !== focusId) focusId = null; activate(ev.id); continue; }
      if (ev.type === 'dragStart') {
        focusId = null;
        const ok = mode === 'tutorial' || (gstate === 'wait' && current);
        if (ok && current) {
          if (!held) audio.play('kitchenLift');
          held = true; dragging = true;
          refreshLabels();
        }
        continue;
      }
      if (ev.type === 'drop') {
        if (!dragging) continue;
        const tg = ev.x >= 0 ? targetAt(ev.x, ev.y, { destinationsOnly: true }) : null;
        if (tg) activate(tg.id);
        else if (held) { held = false; audio.play('kitchenDrop'); refreshLabels(); }
        dragging = false;
      }
    }
  }

  function handleActions() {
    if (input.pressed('pause')) { pause(); return true; }
    // Back puts a lifted item down. On a gamepad B is both back and the tissues: with an item
    // lifted it puts it down (a sneeze has already dropped it), otherwise it takes a tissue.
    let putBack = false;
    if (input.pressed('back') && held) { toggleHeld(); putBack = true; }
    if (input.pressed('left')) moveFocus(-1, 0);
    else if (input.pressed('right')) moveFocus(1, 0);
    else if (input.pressed('up')) moveFocus(0, -1);
    else if (input.pressed('down')) moveFocus(0, 1);
    if (input.lastDevice === 'gamepad') {
      if (input.pressed('confirm') && focusId) activate(focusId);
      if (mode === 'play') {
        if (input.pressed('camera') && !putBack) activate('tissues');
        if (input.pressed('fire')) activate('clingfilm');
        if (input.pressed('phone')) activate('sink');
      }
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // Outro: the three original pages (KitchenGame.as:193-351) and the port's points page
  // ------------------------------------------------------------------------------------------
  function finishLevel() {
    summary = scoreLevel(placements);
    report = reportOf(placements);
    particles.clear(); popups.clear(); flights = []; marks = [];
    mode = 'outro';
    held = false; dragging = false; focusId = null;
    if (controls) { controls.hide(); controls.enabledKeys = false; }
    showOutro(0);
  }

  function showOutro(page) {
    outroPage = page;
    const s = summary;
    let body, title;
    if (page === 0 || page === 1) {
      const good = page === 0;
      title = t(good ? 'kitchen.outro.shoppingPlacedCorrectly' : 'kitchen.outro.itemsPlacedIncorrectly');
      body = s.rows.map((r, i) => {
        const n = good ? r.correct : r.incorrect;
        const sum = good ? String(n * 10) : `- ${n * 10}`;
        const row = el('div', { class: 'kz-row' + (n > 0 ? (good ? ' good' : ' bad') : '') },
          el('span', { class: 'l' }, t('kitchen.outro.' + r.key)),
          el('span', { class: 'x' }, t('kitchen.outro.times')),
          el('span', { class: 'n' }, String(n)),
          el('span', { class: 'e' }, t('kitchen.outro.equals')),
          el('span', { class: 's' }, sum));
        row.style.top = `${48 + i * 40}px`;
        row.style.animationDelay = `${i * 0.06}s`;
        return row;
      });
    } else if (page === 2) {
      title = t('kitchen.outro.microbialMistakes');
      const notes = s.notes.length
        ? s.notes.map((k, i) => { const p = el('p', {}, t('kitchen.note.' + k)); p.style.animationDelay = `${i * 0.08}s`; return p; })
        : [el('p', { class: 'none' }, t('kitchen.outro.noMistakes'))];
      // All reminders are listed (the original had four slots, text1..text4, 71 px apart from just
      // under the title); up to four sit on those slots, more close up, many of them get a compact
      // layout, and a list that still overflows scrolls with a fade at the bottom until its end.
      const n = s.notes.length;
      body = [el('div', { class: 'kz-notes' + (n > 6 ? ' many' : n && n <= 4 ? ' slots' : ''), tabindex: '0', 'aria-label': title }, notes)];
    } else {
      title = t('kitchen.outro.pointsPage');
      const total = startScore + s.points;
      // Awarded and deducted side by side, then this level's total and the running kitchen total,
      // in one column so larger text sizes push the blocks down instead of overlapping (the big
      // numerals keep their size). Only non-zero values are coloured, as on pages 1 and 2.
      const block = (cls, label, value, delay) => {
        const d = el('div', { class: 'kz-total ' + cls }, el('div', {}, label), el('b', {}, value));
        d.style.animationDelay = delay + 's';
        return d;
      };
      const sign = n => (n > 0 ? 'plus' : n < 0 ? 'minus' : '');
      body = [el('div', { class: 'kz-points' },
        el('div', { class: 'pair' },
          block(s.awarded ? 'plus' : '', t('kitchen.outro.pointsAwarded'), s.awarded ? `+${s.awarded}` : '0', 0),
          block(s.deducted ? 'minus' : '', t('kitchen.outro.pointsDeducted'), s.deducted ? `-${s.deducted}` : '0', 0.1)),
        block('big ' + sign(s.points), t('kitchen.outro.totalPoints'), String(s.points), 0.2),
        block('small', t('kitchen.outro.kitchenTotal'), String(total), 0.3))];
    }
    const last = page === OUTRO_PAGES - 1;
    const next = blueButton(t(last ? 'kitchen.button.continue' : 'kitchen.button.next'), 'kz-next', () => outroNext(), { x: 292.2, y: 351.9 });
    const panel = el('div', { class: 'kz-outro', role: 'dialog', 'aria-label': title },
      el('h2', {}, title), body,
      el('div', { class: 'kz-pageno' }, t('kitchen.outro.page', { n: page + 1, total: OUTRO_PAGES })));
    const live = [next];
    const notesBox = panel.querySelector('.kz-notes');
    if (notesBox) live.push(notesBox);
    setPage(el('div', {}, panel, next), { live });
    if (notesBox) {
      // Checked now and again once the web fonts have loaded (a font swap can change the height).
      const atEnd = () => notesBox.classList.toggle('end', notesBox.scrollTop + notesBox.clientHeight >= notesBox.scrollHeight - 4);
      const check = () => {
        if (!notesBox.isConnected) return;
        notesBox.classList.toggle('scrolls', notesBox.scrollHeight > notesBox.clientHeight + 2);
        atEnd();
      };
      notesBox.addEventListener('scroll', atEnd, { passive: true });
      check();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(check, () => {});
    }
    focusFirst(pageLayer);
    app.touch.show(TOUCH_PAUSE);
    audio.play(page === 0 ? 'kitchenDone' : 'pageTurn');
    // A little confetti from the panel's top corners (kept clear of the rows).
    if (page === 0 && s.points > 0 && !reduced) {
      for (const [x, a] of [[58, 0.35], [742, Math.PI - 0.35]]) particles.emit(x, 24, { count: 14, colors: ['#ffd84a', '#ff8a5c', '#5fd4ff', '#6fe0a8'], shape: 'square', speed: 3.2, spread: 0.7, angle: a, life: 40, size: 4.5, gravity: 0.1 });
    }
  }

  function outroNext() {
    if (mode !== 'outro') return;
    if (outroPage < OUTRO_PAGES - 1) { showOutro(outroPage + 1); return; }
    complete();
  }

  function complete() {
    const points = summary.points;
    const result = {
      level, score: startScore + points, points,
      report, rows: summary.rows, notes: summary.notes, awarded: summary.awarded, deducted: summary.deducted,
      reason: endReason, placed: placements.length, items: items.length,
    };
    lastResult = result;
    if (typeof params.onComplete === 'function') {
      // The flow moves on; the outro stays on screen under its fade-out.
      mode = 'done';
      app.touch.hide();
      params.onComplete(result);
      return;
    }
    // Standalone: carry on to the next level like nextLevel() (KitchenGame.as:813-872).
    startScore = result.score;
    if (level < 3) { startLevel(level + 1); return; }
    mode = 'done';
    const card = el('div', { class: 'kz-card', role: 'dialog', 'aria-label': t('kitchen.done.title') },
      el('h2', {}, t('kitchen.done.title')),
      el('p', {}, t('kitchen.done.text', { points: startScore })),
      el('div', { class: 'row' }, button(t('kitchen.done.menu'), () => quit(), { class: 'primary', id: 'kz-done' })));
    showOverlay(card);
  }

  // ------------------------------------------------------------------------------------------
  // Pause
  // ------------------------------------------------------------------------------------------
  function showOverlay(node) {
    clearOverlay();
    overlay = el('div', { class: 'kz-overlay', 'data-native-keys': true }, node);
    for (const d of overlay.querySelectorAll('[role="dialog"]')) d.setAttribute('aria-modal', 'true');
    app.ui.append(overlay);
    nav = focusNavigator(overlay);
    untrap = trapFocus(overlay);
    focusFirst(overlay);
    app.touch.hide();
  }

  function pause() {
    if (mode !== 'play' && mode !== 'tutorial' && mode !== 'intro' && mode !== 'outro') return;
    pausedFrom = mode;
    mode = 'paused';
    held = held && !dragging ? held : false;
    dragging = false;
    if (controls) { controls.clear(); controls.enabledKeys = false; }
    audio.play('tap');
    audio.musicLevel(0.35);
    const soundLabel = () => (settings.get('muted') ? t('pause.soundOff') : t('pause.soundOn'));
    const toggle = button(soundLabel(), () => {
      settings.set('muted', !settings.get('muted'));
      toggle.textContent = soundLabel();
      toggle.setAttribute('aria-pressed', String(!settings.get('muted')));
    }, { id: 'kz-sound', class: 'kz-toggle', 'aria-pressed': String(!settings.get('muted')) });
    const card = el('div', { class: 'kz-card', role: 'dialog', 'aria-label': t('pause.title') },
      el('h2', {}, t('pause.title')),
      el('p', {}, t('kitchen.levelLabel', { n: level + 1 })),
      el('div', { class: 'row' },
        button(t('pause.resume'), () => resume(), { class: 'primary', id: 'kz-resume' }),
        // No restart on the outro: the finished level's result would be thrown away.
        pausedFrom === 'outro' ? null : button(t('pause.restart'), () => restart(), { id: 'kz-restart' }),
        button(t('pause.quit'), () => quit(), { id: 'kz-quit' })),
      el('div', { class: 'row' }, toggle, settingsButton()));
    showOverlay(card);
  }

  // The flow's settings overlay (web/js/flow/contract.md), when that module provides it.
  function settingsButton() {
    const open = flowSettings && typeof flowSettings.openSettings === 'function' ? flowSettings.openSettings : null;
    if (!open) return null;
    return button(t('kitchen.pause.settings'), () => open(app, { onClose: () => { if (overlay) focusFirst(overlay); } }), { id: 'kz-settings', class: 'kz-toggle' });
  }

  function resume() {
    if (mode !== 'paused') return;
    clearOverlay();
    mode = pausedFrom || 'play';
    pausedFrom = null;
    if (controls && (mode === 'play' || mode === 'tutorial')) { controls.clear(); controls.enabledKeys = true; }
    app.touch.show(TOUCH_PAUSE);
    audio.musicLevel(1);
    if (pageLayer) focusFirst(pageLayer);
    if ((mode === 'play' || mode === 'tutorial') && focusId && device() !== 'touch') setFocus(focusId);
  }

  // From play the level starts again at once; from the intro or the tutorial the intro screens
  // (and level 0's spring-onion tutorial) are shown again.
  function restart() {
    const from = pausedFrom;
    clearOverlay();
    pausedFrom = null;
    startLevel(level, { skipIntro: from === 'play' });
  }

  function quit() {
    clearOverlay();
    if (typeof params.onQuit === 'function') params.onQuit();
    else app.scenes.go('splash');
  }

  // ------------------------------------------------------------------------------------------
  // Scene
  // ------------------------------------------------------------------------------------------
  const scene = {
    enter(p = {}) {
      params = { ...p };
      level = clamp(Number(params.level) || 0, 0, 3);
      avatar = params.avatar === 'amy' ? 'amy' : 'harry';
      startScore = Number(params.score) || 0;
      if (params.seed != null && params.seed !== '') gameRng.seed(Number(params.seed));
      app.touch.hide();
      lastDevice = device();
      window.__test && window.__test.register('kitchen', probe);
      load();
    },

    exit() {
      destroyed = true;
      clearOverlay();
      clearPage();
      if (controls) { controls.destroy(); controls = null; }
      app.touch.hide();
      audio.stopMusic();
      window.__test && window.__test.unregister('kitchen');
    },

    onHidden() { if (mode === 'play' || mode === 'tutorial') pause(); },

    update() {
      tick++;
      // Settings > Reduced motion can change while the kitchen is open (pause > Settings).
      reduced = !!settings.get('reducedMotion');
      const settingsOpen = !!(app.flow && app.flow.overlayOpen);
      const before = mode;
      if (nav && !settingsOpen) nav();
      // A gamepad press that just worked a card button (Resume, Restart) must not also act on the
      // page that button brought back in this tick.
      if (mode !== before) return;
      if (mode === 'loading' || mode === 'done') { cosmeticUpdate(); return; }
      startMusic();
      // Where the focus was when this tick's keys went down (a device change below can rebuild
      // the page and move the focus to its button, which then never saw the key).
      const focusAtKey = document.activeElement;
      if (mode === 'paused') {
        if (settingsOpen) return;   // the settings overlay has the input
        if (input.pressed('pause') || input.pressed('back')) resume();
        return;   // the picture freezes under the pause card
      }
      // Checked after the pause card, so a switch of device while paused is seen on resume.
      const dev = device();
      if (dev !== lastDevice) { lastDevice = dev; onDeviceChange(); }
      if (mode === 'intro' || mode === 'outro') {
        if (input.pressed('pause')) { pause(); return; }
        const active = focusAtKey;
        const onButton = !!(active && active.id === 'kz-next');
        const pad = input.lastDevice === 'gamepad';
        // Space, Enter and the arrows scroll the reminders list natively while it has the focus.
        const inList = !pad && active && active.closest && active.closest('.kz-notes');
        const go = input.pressed('confirm') || (input.pressed('jump') && !input.isDown('up'));
        // Enter and Space on the focused button click it natively; a gamepad's A does not.
        if (go && !inList && (!onButton || pad)) {
          if (mode === 'intro') introNext(); else outroNext();
        }
        // The d-pad (and the arrows, from outside the list) scroll a long reminders list.
        const list = !inList && pageLayer && pageLayer.querySelector('.kz-notes.scrolls');
        const dir = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
        if (list && dir) list.scrollTop += dir * 6;
        cosmetic++;
        if (framesAt(cosmetic) !== framesAt(cosmetic - 1)) avatarClip.tick();
        cosmeticUpdate();
        return;
      }
      if (mode === 'tutorial') {
        handleEvents();
        if (mode === 'tutorial' && handleActions()) return;
        cosmetic++;
        if (framesAt(cosmetic) !== framesAt(cosmetic - 1)) avatarClip.tick();
        cosmeticUpdate();
        return;
      }
      if (mode === 'play') {
        handleEvents();
        if (mode !== 'play') { cosmeticUpdate(); return; }
        if (handleActions()) return;
        playTicks++;
        const target = framesAt(playTicks);
        while (frame < target && mode === 'play') { frame++; onFrame(); }
        if (mode === 'play') {
          if (gstate === 'sneeze' && !reduced && frame % 6 === 0 && playTicks % 3 === 0) {
            const m = mouth();
            particles.emit(m.x, m.y - 6, { count: 1, colors: ['#ffffff'], shape: 'bubble', speed: 0.6, life: 20, size: 2.5, gravity: -0.04 });
          }
          if (gstate === 'wash' && !reduced && playTicks % 4 === 0) particles.emit(338, 232, { count: 2, colors: ['#bfefff', '#ffffff', '#8fd8ff'], shape: 'bubble', speed: 1.4, spread: 1.6, angle: -Math.PI / 2, life: 26, size: 3, gravity: -0.03 });
        }
        cosmeticUpdate();
      }
    },

    render(ctx) {
      if (mode === 'loading') { drawLoading(ctx); return; }
      if (mode === 'outro' || (mode === 'paused' && pausedFrom === 'outro') || (mode === 'done' && lastResult && typeof params.onComplete === 'function')) { drawOutroBackdrop(ctx); particles.draw(ctx); return; }
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawKitchen(ctx);
      ctx.restore();
      if (mode === 'intro' || (mode === 'paused' && pausedFrom === 'intro')) {
        // The intro SWFs show the kitchen picture at 30 % alpha (background cxform, alpha 77/256)
        // over the dark grey stage behind them (about #333, sampled from the captures).
        ctx.fillStyle = 'rgba(51,51,51,0.70)';
        ctx.fillRect(0, 0, 800, 450);
        particles.draw(ctx);
        return;
      }
      drawHud(ctx);
      particles.draw(ctx);
      popups.draw(ctx, 0, 0, 'Baloo');
    },
  };

  function onDeviceChange() {
    if (mode === 'play') buildLegend();
    if (mode === 'intro') showIntro(introPage, { quiet: true });
    // The tutorial keeps its state (a lifted spring onion stays lifted); only the hint changes.
    if (mode === 'tutorial') {
      tutorialHint();
      if (device() !== 'touch' && !focusId) setFocus(held ? DEST_ORDER[0] : 'item');
    }
    if (device() === 'touch' && (mode === 'play' || mode === 'tutorial')) focusId = null;
  }

  function cosmeticUpdate() {
    particles.update();
    popups.update();
    shake.update();
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      if (++f.age >= f.dur) { flights.splice(i, 1); landFlight(f); }
    }
    for (let i = marks.length - 1; i >= 0; i--) if (++marks[i].age >= marks[i].life) marks.splice(i, 1);
    if (arrival && ++arrival.age >= arrival.dur) {
      arrival = null;
      if (!reduced && current) { const r = counterRect(current); particles.emit(r.x + r.w / 2, r.y + r.h, { count: 5, colors: ['#ffffff', '#d7f3e6'], speed: 1.4, spread: 1.2, angle: -Math.PI / 2, life: 16, size: 2.5, gravity: 0.08 }); }
    }
    if (banner) banner.age++;
    if (wobble && ++wobble.age > 20) wobble = null;
    shimmer = Math.max(0, shimmer - 0.04);
    clockPulse = Math.max(0, clockPulse - 0.05);
  }

  // ------------------------------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------------------------------
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

  const time = () => tick * 0.015;

  function drawKitchen(ctx) {
    drawBackground(ctx);
    // Rest points (root timeline, under the avatar and the counter), back to front.
    const flying = new Set(flights.map(f => f.slot));
    for (const r of SORTED_POINTS) {
      const s = slotContent.get(r.name);
      if (!s || !s.landed || s.alpha <= 0 || flying.has(r.name)) continue;
      const [w, h] = foodSize(s.item.asset);
      const b = fitInBox(r, w, h);
      drawFood(ctx, s.item, b.x, b.y, b.scale, { alpha: s.alpha / 100 });
      drawItemGerms(ctx, s.item, b, s.alpha / 100);
    }
    // Avatar behind the counter (swapDepths with kitchen_counter, KitchenGame.as:1111-1112).
    if (avatarClip && !avatarClip.draw(ctx, AVATAR_POS.x, AVATAR_POS.y)) drawAvatarPlaceholder(ctx);
    drawCounter(ctx);
    drawSink(ctx, sinkClip ? sinkClip.frame : 1);
    if (wobble && wobble.id === 'tissues') {
      const k = Math.sin(wobble.age * 0.9) * (1 - wobble.age / 20);
      drawGlow(ctx, TARGET.tissues.glow, { colour: '#ffffff', alpha: 0.5 * Math.abs(k), width: 3 });
    }
    // Zone highlights under the item being carried.
    drawTargets(ctx);
    // Items in flight to their rest point.
    for (const f of flights) {
      const k = ease.inOutQuad(Math.min(1, f.age / f.dur));
      const x = lerp(f.from.x, f.to.x, k), y = lerp(f.from.y, f.to.y, k) - Math.sin(k * Math.PI) * 46;
      const w = lerp(f.from.w, f.to.w, k);
      const [fw] = foodSize(f.item.asset);
      drawFood(ctx, f.item, x, y, w / fw);
    }
    // The current item on the counter (food_throw_area sits above everything, :1137).
    if (current && (mode === 'play' || mode === 'tutorial' || mode === 'intro' || mode === 'paused')) drawCurrent(ctx);
    for (const m of marks) drawMark(ctx, m.x, m.y, m.ok, m.age / m.life, reduced);
  }

  const SORTED_POINTS = [...REST_POINTS].sort((a, b) => a.y - b.y || a.x - b.x);

  function drawItemGerms(ctx, item, b, alpha = 1) {
    if (alpha < 0.3) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) * 0.55 + 4;
    if (item.sneeze) drawGerms(ctx, cx, cy, r, time(), '#5cc24a', 3, reduced);
    if (item.meatHands) drawGerms(ctx, cx, cy, r + 4, time() + 1.3, '#e0475b', 3, reduced);
  }

  function drawCurrent(ctx) {
    const item = current;
    const [w, h] = foodSize(item.asset);
    let r = counterRect(item);
    let s = 1;
    if (arrival) {
      const k = ease.outQuad(Math.min(1, arrival.age / arrival.dur));
      const sx = BAG.x - w / 2, sy = BAG.y - h / 2;
      s = 0.6 + 0.4 * k;
      r = { x: lerp(sx, r.x, k) + (w - w * s) / 2, y: lerp(sy, r.y, k) - Math.sin(k * Math.PI) * 60 + (h - h * s), w, h };
    } else if (dragging && controls && controls.dragPos) {
      s = 1.1;
      r = { x: controls.dragPos.x - w * s / 2, y: controls.dragPos.y - h * s / 2, w, h };
    } else if (held) {
      r = { x: r.x, y: r.y - 10 - (reduced ? 0 : Math.sin(tick * 0.12) * 2.5), w, h };
    }
    if (held || dragging) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const base = dragging ? r.y + h * s + 10 : FOOD_BOX.y + FOOD_BOX.h;
      ctx.beginPath(); ctx.ellipse(r.x + w * s / 2, base, w * s * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    drawFood(ctx, item, r.x, r.y, s);
    if (shimmer > 0) {
      ctx.save();
      ctx.globalAlpha = shimmer;
      const g = ctx.createLinearGradient(r.x, r.y, r.x + w * s, r.y + h * s);
      const p = 1 - shimmer;
      g.addColorStop(Math.max(0, p - 0.2), 'rgba(255,255,255,0)');
      g.addColorStop(p, 'rgba(255,255,255,0.85)');
      g.addColorStop(Math.min(1, p + 0.2), 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      roundRect(ctx, r.x - 2, r.y - 2, w * s + 4, h * s + 4, 8); ctx.fill();
      ctx.restore();
    }
    drawItemGerms(ctx, item, { x: r.x, y: r.y, w: w * s, h: h * s });
  }

  function drawAvatarPlaceholder(ctx) {
    ctx.save();
    ctx.fillStyle = avatar === 'amy' ? '#f08a3c' : '#6b4423';
    ctx.beginPath(); ctx.arc(190, 90, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6c8a8';
    ctx.beginPath(); ctx.arc(196, 100, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = avatar === 'amy' ? '#b8e08a' : '#d99a5b';
    roundRect(ctx, 150, 140, 90, 110, 20); ctx.fill();
    ctx.restore();
  }

  function drawTargets(ctx) {
    if (mode !== 'play' && mode !== 'tutorial' && !(mode === 'paused' && (pausedFrom === 'play' || pausedFrom === 'tutorial'))) return;
    const pulse = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(tick * 0.14);
    const carrying = held || dragging;
    const under = dragging && controls && controls.dragPos ? targetAt(controls.dragPos.x, controls.dragPos.y, { destinationsOnly: true }) : null;
    if (carrying) {
      for (const id of DEST_ORDER) {
        const tg = TARGET[id];
        const hot = (under && under.id === id) || focusId === id || (controls && controls.hover === id);
        if (hot) drawGlow(ctx, tg.glow, { colour: '#ffb400', alpha: 1, width: 5, fill: 'rgba(255,216,74,0.28)' });
        else drawGlow(ctx, tg.glow, { colour: '#1f8fd0', alpha: 0.5 + 0.35 * pulse, width: 3, dash: [9, 6], fill: 'rgba(95,212,255,0.16)' });
      }
    } else if (controls && controls.hover && TARGET[controls.hover] && (mode === 'tutorial' || (mode === 'play' && gstate !== 'end'))) {
      const tg = TARGET[controls.hover];
      if (tg.kind !== 'item') drawGlow(ctx, tg.glow || tg.hit, { colour: '#ffffff', alpha: 0.7, width: 3, fill: 'rgba(255,255,255,0.1)' });
    }
    // Sneeze: the tissues glow (the countdown ring and the "Tissue!" bubble are in the HUD).
    if (mode === 'play' && gstate === 'sneeze') drawGlow(ctx, TARGET.tissues.glow, { colour: '#ff8a5c', alpha: pulse, width: 5, fill: 'rgba(255,138,92,0.2)' });
    // Keyboard / gamepad focus: a two-tone ring (dark under light) that reads on the light-blue
    // fridge and the white shelves as well as on the green counter.
    if (focusId && device() !== 'touch' && TARGET[focusId]) {
      const tg = TARGET[focusId];
      const r = tg.kind === 'item' && current ? pad(counterRect(current), 8) : tg.glow || tg.hit;
      drawGlow(ctx, r, { colour: '#1b1640', alpha: 0.9, width: 8 });
      drawGlow(ctx, r, { colour: '#5fd4ff', alpha: 0.8 + 0.2 * pulse, width: 4 });
    }
  }
  const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 });

  function drawHud(ctx) {
    if (mode !== 'play' && mode !== 'paused' && mode !== 'tutorial') return;
    if (mode === 'tutorial' || pausedFrom === 'tutorial') return;
    // Clock (KitchenGame.as:180): Verdana Bold 20, #20648c, centred in a 110 x 35 field; its
    // digits centre on y 20.7 (2 px gutter, Verdana ascent 1.005 em, cap height 0.73 em). Port
    // additions: it follows the text size, and in the last ten seconds it turns red with a pulse.
    const ts = textScale();
    const low = timeLeft <= 10;
    const cx = CLOCK.x + CLOCK.w / 2, cy = CLOCK.y + 14.8;
    ctx.save();
    ctx.translate(cx, cy);
    const k = 1 + (reduced ? 0 : clockPulse * 0.3);
    ctx.scale(k, k);
    ctx.font = `bold ${20 * ts}px ${VERDANA}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const base = 7.3 * ts;
    if (low) { ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.strokeText(String(timeLeft), 0, base); }
    ctx.fillStyle = low ? '#d23c3c' : '#20648c';
    ctx.fillText(String(timeLeft), 0, base);
    ctx.restore();
    // Items put away (port addition): a small pill left of the clock, scaled with the text size
    // about its right end.
    const done = Math.min(itemIndex, items.length);
    const label = t('kitchen.hud.items', { n: done, total: items.length });
    ctx.save();
    ctx.font = '800 16px Baloo, "Trebuchet MS", sans-serif';
    const w = ctx.measureText(label).width + 36;
    const right = CLOCK.x + 4, y = 10;
    ctx.translate(right, y);
    ctx.scale(ts, ts);
    ctx.fillStyle = 'rgba(32,100,140,0.14)';
    roundRect(ctx, -w, 0, w, 26, 13); ctx.fill();
    // A tick in a disc: items put away.
    ctx.fillStyle = '#20648c';
    ctx.beginPath(); ctx.arc(-w + 15, 13, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-w + 11, 13.5); ctx.lineTo(-w + 14, 16.5); ctx.lineTo(-w + 19.5, 10); ctx.stroke();
    ctx.fillStyle = '#20648c';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, -w + 27, 14);
    ctx.restore();
    const x = right - w * ts;
    const bubbleFont = size => `800 ${Math.round(size * ts)}px Baloo, "Trebuchet MS", sans-serif`;
    const bubbleH = Math.round(30 * Math.max(1, ts * 0.95));
    // Hands: a badge in the HUD row while they carry microbes (sneeze or raw meat) or are being
    // washed, and a soft pulse on the sink.
    const dirty = hands.sneeze || hands.meat;
    if (dirty || gstate === 'wash') {
      const bx = x - 26, by = y + 13 * ts;
      const bob = reduced ? 0 : Math.sin(tick * 0.1) * 1.5;
      ctx.save();
      ctx.fillStyle = gstate === 'wash' ? 'rgba(223,246,255,0.95)' : 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = gstate === 'wash' ? '#1f7fb0' : hands.meat && !hands.sneeze ? '#e0475b' : '#5cc24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by + bob, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawHand(ctx, bx + 1, by + bob + 3, 0.9);
      if (gstate !== 'wash') {
        if (hands.sneeze) drawGerms(ctx, bx, by + bob, 14, time(), '#5cc24a', 3, reduced);
        if (hands.meat) drawGerms(ctx, bx, by + bob, 18, time() + 1, '#e0475b', 3, reduced);
      }
      ctx.restore();
      const text = washLabel();
      ctx.save();
      ctx.font = bubbleFont(14);
      const tw = ctx.measureText(text).width;
      ctx.restore();
      drawBubble(ctx, bx - 30 - tw / 2, by + bob, text, { font: bubbleFont(14), h: bubbleH, fill: gstate === 'wash' ? '#dff6ff' : '#fffbe0' });
      if (dirty && gstate === 'wait') drawGlow(ctx, TARGET.sink.glow, { colour: '#5fd4ff', alpha: 0.35 + 0.3 * (reduced ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.12)), width: 3, fill: 'rgba(95,212,255,0.1)' });
    }
    // Sneeze warning above the avatar.
    if (gstate === 'sneeze' && mode === 'play') {
      const m = mouth();
      const jig = reduced ? 0 : Math.sin(tick * 0.9) * 1.5;
      drawBubble(ctx, m.x + 58 + jig, 40, t('kitchen.hud.sneeze'), { font: bubbleFont(17), h: bubbleH, tx: m.x + 22, ty: 70, fill: '#fff4e0' });
      // Over the tissue box: a ring counting down the two-second window, and the bubble above it.
      const c = centre(TARGET.tissues.glow);
      const left = 1 - sneezeFrames / SNEEZE_WINDOW;
      const ry = c.y - 46;
      ctx.save();
      ctx.fillStyle = 'rgba(27,22,64,0.55)';
      ctx.beginPath(); ctx.arc(c.x, ry, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, ry, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
      ctx.fillStyle = '#ff8a5c';
      ctx.beginPath(); ctx.arc(c.x, ry, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawBubble(ctx, c.x, ry - 19 - bubbleH / 2 + jig * 0.5, tissueLabel(), { font: bubbleFont(15), h: bubbleH, fill: '#ffe2d6', tx: c.x, ty: ry - 16 });
    }
    // End-of-level banner.
    if (banner) {
      const a = Math.min(1, banner.age / 8);
      const s = reduced ? 1 : ease.outBack(Math.min(1, banner.age / 16));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(400, 150);
      ctx.scale(s, s);
      ctx.font = '800 44px Baloo, "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = '#1b1640'; ctx.lineJoin = 'round';
      ctx.strokeText(banner.text, 0, 0);
      ctx.fillStyle = endReason === 'time' ? '#ffb3c0' : '#fff4a8';
      ctx.fillText(banner.text, 0, 0);
      ctx.restore();
    }
  }

  // The outro replaces the kitchen (theGame._visible = false, KitchenGame.as:172): a white panel
  // with a black border on the dark stage (kitchen_game_outro.swf frame 10).
  function drawOutroBackdrop(ctx) {
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, 800, 450);
    if (art.draw(ctx, 'kitchen_outro_bg', 10, 0, 0)) return;
    ctx.fillStyle = '#000';
    roundRect(ctx, 40, 9, 720, 432, 14); ctx.fill();
    ctx.fillStyle = '#fff';
    roundRect(ctx, 45, 14, 710, 422, 10); ctx.fill();
  }

  // window.__test probe: everything a bot or test needs, read-only.
  function itemView(item) {
    if (!item) return null;
    return {
      asset: item.asset, name: item.name, type: item.type, mouldy: item.mouldy, burst: item.burst,
      clingfilm: item.clingfilm, sneeze: item.sneeze, sneezeFrom: item.sneezeFrom, meatHands: item.meatHands,
      correct: correctLocations(item).map(l => LOC_NAMES[l]),
    };
  }

  function probe() {
    return {
      ready: mode !== 'loading', mode, pausedFrom, level, avatar, art: artReady, device: device(),
      state: gstate, timeLeft, frame, playTicks, secFrames,
      itemIndex, itemCount: items.length, items: items.map(i => i.asset),
      current: itemView(current), held, dragging, focus: focusId,
      hands: { ...hands }, sneezeChance, sneezeFramesLeft: gstate === 'sneeze' ? SNEEZE_WINDOW - sneezeFrames : 0,
      avatarLabel: avatarClip ? avatarClip.label : null, avatarFrame: avatarClip ? avatarClip.frame : 0,
      midAnimation: avatarClip ? avatarClip.midAnimation : false,
      placements: placements.map(p => ({ asset: p.item.asset, loc: LOC_NAMES[p.loc], verdict: judge(p.item, p.loc).verdict, sneeze: p.item.sneeze, sneezeFrom: p.item.sneezeFrom, meatHands: p.item.meatHands, clingfilm: p.item.clingfilm })),
      intro: mode === 'intro' || (mode === 'paused' && pausedFrom === 'intro') ? { page: introPage, pages: INTRO[level].length } : null,
      tutorial: tutorialStep,
      outro: summary ? { page: outroPage, pages: OUTRO_PAGES, rows: summary.rows, notes: summary.notes, points: summary.points, awarded: summary.awarded, deducted: summary.deducted } : null,
      score: startScore, endReason, result: lastResult,
      targets: Object.fromEntries(TARGETS.map(tg => [tg.id, { ...tg.hit }])),
      fx: { particles: particles.items.length, popups: popups.items.length, flights: flights.length, marks: marks.length, shake: shake.trauma },
      music: musicOn, reducedMotion: reduced,
      hud: { wash: washLabel(), tissue: tissueLabel() },
    };
  }

  return scene;
}
