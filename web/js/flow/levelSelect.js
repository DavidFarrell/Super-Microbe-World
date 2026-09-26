// Level select (port addition, NOTES 11.1 #3 and decision 11.9 #20): the ten platform levels and
// the four kitchen levels, each playable on its own (briefing, level, results card; no shrink,
// no quiz) once unlocked. Level 1 is always open; a level opens when the journey reaches it or
// when the level before it is completed here. Thumbnails are drawn from the level data and the
// tile art (the level's first screen), with the goal microbe's phone portrait; the kitchen
// levels use their 2009 intro pictures. Cards are real buttons: arrows / d-pad / Tab move,
// Enter or tap plays; the Harry / Amy switch picks who plays.
import { el } from '../ui/dom.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { loadJson } from '../core/assets.js';
import { AREA_MUSIC } from '../core/music.js';
import { goalText } from '../platformer/hud.js';
import { sprites } from '../platformer/sprites.js';
import * as art from './art.js';
import { avatarName, AVATARS } from './flow.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav } from './ui.js';

const THUMB_W = 128, THUMB_H = 72, THUMB_SCALE = 2;   // CSS stage px; canvas at 2x
const thumbs = new Map();                              // id -> canvas (kept for the session)
const PORTRAIT = { 11: 'lucy_image', 12: 'sandy_image', 14: 'steve_image', 16: 'slarg_image', 17: 'slurm_image' };
const AREA_COLOURS = { kitchen: ['#ffd27a', '#e08a2c'], skin: ['#f6c1a6', '#c9765a'], body: ['#f08a8a', '#9c2f3f'] };

const CSS = `
.ls-root { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, #3b3290 0%, #1b1640 70%); }
.ls-head { position: absolute; left: 16px; right: 16px; top: 10px; height: 52px; display: flex; align-items: center; gap: 14px; }
.ls-head h1 { margin: 0; flex: 1; text-align: center; color: #fff; font: 800 calc(30px * var(--text-scale, 1)) var(--ui-font); text-shadow: 0 3px 0 #0a0830; }
.ls-avatar { display: flex; gap: 6px; background: rgba(255,255,255,0.08); padding: 4px; border-radius: 14px; }
.ls-avatar .fl-btn { padding: 6px 14px 5px; font-size: calc(16px * var(--text-scale, 1)); }
.ls-avatar .fl-btn[aria-pressed="false"] { filter: grayscale(0.6) brightness(0.8); }
.ls-grid { position: absolute; left: 14px; right: 14px; top: 68px; bottom: 6px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-rows: 118px; gap: 8px 9px; }
.ls-card { position: relative; display: grid; grid-template-rows: ${THUMB_H}px auto; padding: 5px; min-width: 0; border-radius: 12px; border: 3px solid #0e3d6b; cursor: pointer; text-align: left;
  background: linear-gradient(180deg, #fffdf6, #efe3c4); box-shadow: 0 4px 0 #0a2a4a; color: #1b1640; font-family: var(--body-font); min-height: 48px; }
.ls-card:hover { transform: translateY(-2px); }
.ls-card:active { transform: translateY(2px); box-shadow: 0 1px 0 #0a2a4a; }
.ls-card:focus-visible { outline: 4px solid #ffd23f; outline-offset: 2px; }
.ls-card canvas { width: ${THUMB_W}px; height: ${THUMB_H}px; border-radius: 7px; display: block; justify-self: center; background: #ff9900; }
.ls-card b { font: 800 calc(15px * var(--text-scale, 1))/1.1 var(--ui-font); display: block; margin-top: 3px; }
.ls-card small { font-size: calc(11px * var(--text-scale, 1)); line-height: 1.15; display: block; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ls-card .best { position: absolute; right: 8px; top: 8px; background: #ffd23f; color: #3a1450; border-radius: 999px; padding: 1px 7px; font: 800 calc(12px * var(--text-scale, 1)) var(--ui-font); }
.ls-card .round { position: absolute; left: 8px; top: 8px; background: rgba(27,22,64,0.78); color: #fff; border-radius: 999px; padding: 1px 7px; font: 700 calc(11px * var(--text-scale, 1)) var(--body-font); }
.ls-card[disabled] { cursor: default; filter: grayscale(0.85) brightness(0.62); transform: none; }
.ls-card[disabled] .lock { position: absolute; left: 50%; top: 40px; transform: translate(-50%, -50%); width: 34px; height: 34px; color: #fff; }
`;

const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="rgba(0,0,0,0.35)"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

function areaOf(index, n) {
  const set = (index && index.sets && index.sets['level' + n]) || [];
  if (set.includes('tiles-body')) return 'body';
  if (set.includes('tiles-skin')) return 'skin';
  return 'kitchen';
}

function placeholder(canvas, colours, label) {
  const g = canvas.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, colours[0]); grd.addColorStop(1, colours[1]);
  g.fillStyle = grd; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = `800 ${Math.round(canvas.height * 0.36)}px Baloo, "Trebuchet MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, canvas.width / 2, canvas.height / 2);
}

// The level's first screen: orange background, tiles around the player start, goal portrait.
async function drawLevelThumb(canvas, id, goal) {
  const data = await loadJson(`data/levels/${id}.json`);
  const n = /(\d+)$/.exec(id)[1];
  // Only the tile sheets and the phone portraits (not the level's large microbe sheets).
  const idx = await sprites.loadIndex();
  const ids = ((idx && idx.sets && idx.sets['level' + n]) || []).filter(a => /^tiles-|^hud/.test(a));
  await Promise.all(ids.map(a => art.loadAtlas(a)));
  const g = canvas.getContext('2d');
  const k = canvas.width / 800;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = '#ff9900'; g.fillRect(0, 0, 800, 450);
  const maxX = Math.max(0, data.cols * 50 - 800);
  const camX = Math.min(maxX, Math.max(0, data.playerStart.col * 50 - 250));
  for (const [r, c, tid] of data.tiles) {
    if (r < 0 || r >= data.rows) continue;
    const x = c * 50 - camX;
    if (x < -400 || x > 820) continue;
    const def = data.palette[tid];
    if (!def || !def.movie) continue;
    if (!art.draw(g, def.movie, 1, [1, 0, 0, 1, x, r * 50])) { g.fillStyle = 'rgba(120,70,20,0.5)'; g.fillRect(x, r * 50, def.w || 50, def.h || 50); }
  }
  // Player start marker: a little hoverboard shadow.
  const px = data.playerStart.col * 50 - camX + 25, py = data.playerStart.row * 50 + 100;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(px, py, 34, 8, 0, 0, Math.PI * 2); g.fill();
  // Goal portrait in a round badge, as on the ePhone status screen.
  const pic = goal.goalType === 7 ? 'milk_image' : goal.goalType === 6 ? 'superinfection_image' : goal.goalType === 1 ? 'lucy_image' : goal.goalType === 0 ? PORTRAIT[goal.microbeType] : 'slurm_image';
  g.save();
  g.translate(705, 355);
  g.fillStyle = '#fff'; g.strokeStyle = '#1b1640'; g.lineWidth = 10;
  g.beginPath(); g.arc(0, 0, 80, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, 74, 0, Math.PI * 2); g.clip();
  const sym = pic && art.symbol(pic);
  if (sym && sym.frames && sym.frames[0]) {
    const [, , , w, h] = sym.frames[0];
    const s = Math.min(150 / (w / (sym.scale || 1)), 150 / (h / (sym.scale || 1)));
    g.scale(s, s);
    const ox = sym.frames[0][5] / (sym.scale || 1), oy = sym.frames[0][6] / (sym.scale || 1);
    art.draw(g, pic, 1, [1, 0, 0, 1, ox - w / (sym.scale || 1) / 2, oy - h / (sym.scale || 1) / 2]);
  } else {
    g.fillStyle = '#1b1640'; g.font = '800 70px Baloo, "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(t('microbe.' + goal.microbeType)).slice(0, 1), 0, 6);
  }
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// Kitchen thumbnails from the 2009 intro pictures (kitchen_game_intro_level_N backdrops). The
// kitchen sheet is large, so unless the kitchen already loaded it, it is loaded privately, drawn
// into the four thumbnails and freed at once.
async function drawKitchenThumbs(canvases) {
  const shared = art.has('kitchen_intro0_bg');
  const source = shared ? { draw: art.draw, close: () => {} } : await art.loadPrivate('kitchen');
  if (!source) return false;
  try {
    canvases.forEach((canvas, n) => {
      const g = canvas.getContext('2d');
      const k = canvas.width / 800;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = '#fff697'; g.fillRect(0, 0, 800, 450);
      source.draw(g, `kitchen_intro${n}_bg`, 1);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  } finally { source.close(); }
  return true;
}

export function levelSelectScene(app) {
  let popNav = null, destroyed = false, root = null, musicOn = false;
  const cards = new Map();

  function card(id, info) {
    const unlocked = app.flow.isUnlocked(id);
    const canvas = el('canvas', { width: String(THUMB_W * THUMB_SCALE), height: String(Math.round(THUMB_H * THUMB_SCALE)), 'aria-hidden': 'true' });
    const cached = thumbs.get(id);
    if (cached) canvas.getContext('2d').drawImage(cached, 0, 0);
    else placeholder(canvas, info.colours, info.short);
    const best = app.flow.state.best[id];
    const b = el('button', {
      type: 'button', class: 'ls-card', id: `level-${id}`, disabled: !unlocked,
      'aria-label': unlocked ? `${info.title}. ${info.goal}.${best != null ? ' ' + t('flow.levels.bestLabel', { score: best }) : ''}` : t('flow.levels.locked', { title: info.title }),
    }, canvas, el('div', {}, el('b', {}, info.title), el('small', {}, unlocked ? info.goal : t('flow.levels.lockedShort'))),
    el('span', { class: 'round' }, info.round),
    best != null && unlocked ? el('span', { class: 'best' }, t('flow.levels.best', { score: best })) : null);
    if (!unlocked) b.insertAdjacentHTML('beforeend', LOCK_SVG);
    b.addEventListener('click', () => { if (unlocked) { audio.play('tap'); app.flow.playLevel(id); } });
    cards.set(id, { button: b, canvas });
    return b;
  }

  async function build() {
    const table = await app.flow.roundTable();
    const index = await sprites.loadIndex();
    const levels = await loadJson('data/levels/index.json');
    if (destroyed) return;
    const avatarBtns = AVATARS.map(a => glossy(avatarName(a), () => setAvatar(a), {
      id: `ls-avatar-${a}`, class: 'small', 'aria-pressed': String((app.flow.profile.avatar || 'harry') === a),
    }));
    const head = el('div', { class: 'ls-head' },
      glossy(t('flow.ui.back'), () => app.flow.toSplash(), { id: 'ls-back', class: 'alt small' }),
      el('h1', {}, t('flow.levels.title')),
      el('div', { class: 'ls-avatar', role: 'group', 'aria-label': t('flow.levels.playAs') }, avatarBtns));
    const grid = el('div', { class: 'ls-grid', role: 'list' });
    const platformIds = table.order;
    const kitchenIds = ['kitchen0', 'kitchen1', 'kitchen2', 'kitchen3'];
    const roundOf = id => table.rounds.find(r => r.levels.includes(id))?.number || '';
    for (const id of platformIds) {
      const n = /(\d+)$/.exec(id)[1];
      const goal = (levels.levels[id] && levels.levels[id].goals[0]) || { goalType: -1, required: 0 };
      const area = areaOf(index, n);
      const info = {
        title: t('flow.levels.level', { n }), short: n, colours: AREA_COLOURS[area],
        goal: goalText({ type: goal.goalType, microbeType: goal.microbeType, required: goal.required }),
        round: t('flow.levels.round', { n: roundOf(id) }),
      };
      grid.append(card(id, info));
    }
    kitchenIds.forEach((id, i) => {
      grid.append(card(id, {
        title: t('flow.levels.kitchen', { n: i + 1 }), short: `K${i + 1}`, colours: ['#fff697', '#80bb9e'],
        goal: t('flow.levels.kitchenGoal'), round: t('flow.levels.round', { n: roundOf(id) }),
      }));
    });
    root = el('div', { class: 'ls-root fl-layer', id: 'level-select' }, head, grid);
    app.ui.append(root);
    const firstOpen = [...cards.values()].find(c => !c.button.disabled);
    popNav = pushNav(root, { initial: firstOpen ? firstOpen.button : '#ls-back', onBack: () => app.flow.toSplash() });
    renderThumbs(platformIds, kitchenIds, levels);
  }

  async function renderThumbs(platformIds, kitchenIds, levels) {
    for (const id of platformIds) {
      if (destroyed) return;
      if (thumbs.has(id)) continue;
      const c = document.createElement('canvas');
      c.width = THUMB_W * THUMB_SCALE; c.height = Math.round(THUMB_H * THUMB_SCALE);
      try {
        await drawLevelThumb(c, id, levels.levels[id].goals[0]);
        thumbs.set(id, c);
        const entry = cards.get(id);
        if (entry && !destroyed) entry.canvas.getContext('2d').drawImage(c, 0, 0);
      } catch { /* keep the placeholder */ }
    }
    if (destroyed || kitchenIds.every(id => thumbs.has(id))) return;
    const cs = kitchenIds.map(() => { const c = document.createElement('canvas'); c.width = THUMB_W * THUMB_SCALE; c.height = Math.round(THUMB_H * THUMB_SCALE); return c; });
    if (await drawKitchenThumbs(cs)) {
      kitchenIds.forEach((id, i) => {
        thumbs.set(id, cs[i]);
        const entry = cards.get(id);
        if (entry && !destroyed) entry.canvas.getContext('2d').drawImage(cs[i], 0, 0);
      });
    }
  }

  function setAvatar(a) {
    app.flow.setProfileAvatar(a);
    for (const x of AVATARS) document.getElementById(`ls-avatar-${x}`)?.setAttribute('aria-pressed', String(x === a));
    app.announce(t('flow.levels.playingAs', { name: avatarName(a) }));
  }

  function startMusic() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC.menu);
    audio.musicLevel(0.6);
  }

  return {
    enter() {
      ensureStyle();
      ensureStyle('levelselect-style', CSS);
      clearNav();
      app.touch.hide();
      build();
      window.__test && window.__test.register('levelSelect', () => ({
        ready: !!root,
        cards: [...cards.entries()].map(([id, c]) => ({ id, unlocked: !c.button.disabled, thumb: thumbs.has(id) })),
        avatar: app.flow.profile.avatar || 'harry',
      }));
    },
    exit() {
      destroyed = true;
      if (popNav) popNav();
      audio.stopMusic();
      window.__test && window.__test.unregister('levelSelect');
    },
    update() { startMusic(); tickNav(); },
    render(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 450);
      g.addColorStop(0, '#2c2466'); g.addColorStop(1, '#1b1640');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
      void settings;
    },
  };
}
