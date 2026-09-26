// Game flow controller: the port of GameController.as. It owns the journey (the player's
// avatar, nickname and scores, the CPU opponent's score, the current round and step), level
// select progress (unlocked levels, best scores) and moves between scenes through the callbacks
// in js/flow/contract.md.
//
// Journey (NOTES 2.3, decisions 11.9 #1, #3-#5):
//   splash -> cutscene -> for each of the 5 rounds:
//     [blind rounds on: the round's blind quiz half] -> shrinking zone
//     -> action: the round's platform level chain, or the kitchen levels 0-3 in round 4
//     -> the round's (sighted) quiz -> ... -> ending
// A failed level shows the summary card and restarts that same level with the score kept
// (restartScope 'level', the default), or the round's first level with its briefing, as Flash
// did (restartScope 'round': NOTES 11.1 #2; GameController.as:283-308, PlatformGame.as:187-192).
// Four separate scores, as in Flash: quiz points (player) and the CPU's quiz points decide the
// winner; hoverboard points (PlatformGame.score, zeroed only when the game is built, so it runs
// across every level, round and retry: PlatformGame.as:123) and kitchen points are shown only.
//
// Progress is saved at the start of every step (smw:progress), so Continue resumes the step the
// player was on with the scores it started with. Randomness: a new journey draws a fresh run seed
// (or takes ?seed=), and each step gets a seed derived from it, so a saved journey replays the
// same way. A level played from Level select gets its own seed, never the journey's.
// Art for the next screen is fetched while the current one plays, as Flash preloaded every SWF
// (NOTES 2.1): decoded ahead when that screen surely comes next (the shrinking zone during the
// cutscene and the quiz, the level or kitchen during the shrinking zone, the summary card during
// a level), downloaded only (not decoded, so no texture memory) when it may come next (the
// cutscene and game show art on the splash, the next level of the round, or the game show,
// during a level). Each prefetch starts once the current screen's own art is in.
import { loadJson } from '../core/assets.js';
import { load, save } from '../core/save.js';
import { settings } from '../core/settings.js';
import { loadLanguage } from '../core/i18n.js';
import { sprites } from '../platformer/sprites.js';
import { loadKitchenArt, kitchenAtlases } from '../kitchen/art.js';
import * as art from './art.js';

const SAVE_KEY = 'progress';
const PROFILE_KEY = 'profile';
export const ROUNDS = 5;
export const KITCHEN_LEVELS = [0, 1, 2, 3];
export const AVATARS = ['harry', 'amy'];
export const avatarName = a => (a === 'amy' ? 'Amy' : 'Harry');
export const otherAvatar = a => (a === 'amy' ? 'harry' : 'amy');

// After a failed level: 'level' restarts that level (decision 11.9 #5, the default); 'round'
// restarts the round from its first level with its briefing, as Flash's restartRound() did.
export const RESTART_SCOPE_DEFAULT = 'level';
export function restartScope() {
  return settings.get('restartScope') === 'round' ? 'round' : RESTART_SCOPE_DEFAULT;
}

// A fresh 32-bit seed for a new journey or a practice level (not the seeded game RNG, whose
// first draw is the same after every page load).
export function freshSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    if (a[0]) return a[0];
  } catch { /* fall through */ }
  return ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
}

// Language of the quiz and the host's introduction (web/data/quiz/<code>.json). i18n keeps any
// offered language active even without UI tables (core/i18n.js), but the setting is read here so
// the right quiz file is chosen even before loadLanguage() has finished.
let languages = null;
export function quizLanguage() {
  const code = settings.get('language');
  return code && (!languages || languages.includes(code)) ? code : 'en';
}

// Loads the host's introduction and quiz file for the chosen language, English as fallback.
export async function loadQuizText(code = quizLanguage()) {
  try { return await loadJson(`data/quiz/${code}.json`); } catch { return loadJson('data/quiz/en.json'); }
}

function blankProgress() {
  return { v: 1, run: null, unlocked: ['alpha_level1'], best: {}, finished: 0, lastEnding: null, shrinkSeen: false };
}

// The journey fields the flow keeps. Older saves also held an optional age (never collected
// now, NOTES 11.2) and a retry flag (a retry is not resumed after a reload); both are dropped.
function cleanRun(r) {
  const { age, retry, ...rest } = r;
  void age; void retry;
  return rest;
}

// Saves from the placeholder flow (no "v") kept only their unlocked list.
function migrate(stored) {
  const base = blankProgress();
  if (!stored || typeof stored !== 'object') return base;
  if (stored.v === 1) {
    return {
      ...base, ...stored,
      unlocked: Array.isArray(stored.unlocked) ? [...new Set(['alpha_level1', ...stored.unlocked])] : base.unlocked,
      best: stored.best && typeof stored.best === 'object' ? stored.best : {},
      run: validRun(stored.run) ? cleanRun(stored.run) : null,
      shrinkSeen: !!stored.shrinkSeen,
    };
  }
  if (Array.isArray(stored.unlocked)) base.unlocked = [...new Set(['alpha_level1', ...stored.unlocked.filter(x => typeof x === 'string')])];
  return base;
}

function validRun(r) {
  return !!r && typeof r === 'object' && AVATARS.includes(r.avatar) && Number.isInteger(r.round) && r.round >= 0 && r.round < ROUNDS
    && ['blind', 'shrink', 'action', 'quiz'].includes(r.step) && Number.isInteger(r.part) && r.part >= 0;
}

// Small string hash for per-step seeds.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createFlow(app) {
  let table = null;
  const progress = migrate(load(SAVE_KEY, null));
  const profile = { nickname: '', avatar: null, ...(load(PROFILE_KEY, {}) || {}) };
  const persist = () => save(SAVE_KEY, progress);
  const persistProfile = () => save(PROFILE_KEY, profile);
  let lastLaunch = null;
  let nextFocus = null;        // iris centre for the level after the shrinking zone (the child)
  let mode = 'menu';           // 'menu' | 'journey' | 'single'
  let retrying = false;        // the next level launch is the retry straight after a summary card
  const seedParam = (() => {
    const v = app.params && app.params.get('seed');
    return v != null && v !== '' && isFinite(Number(v)) ? Number(v) >>> 0 : null;
  })();

  // Text size as a CSS variable for every area's UI (contract.md).
  const applyTextScale = () => document.documentElement.style.setProperty('--text-scale', String(Number(settings.get('textScale')) || 1));
  applyTextScale();
  const applyMotionClass = () => document.documentElement.classList.toggle('reduced-motion', !!settings.get('reducedMotion'));
  applyMotionClass();
  settings.addEventListener('change', e => {
    if (e.detail.key === 'textScale') applyTextScale();
    if (e.detail.key === 'reducedMotion') applyMotionClass();
  });

  // ?lang=<code> selects the language like the 2009 "language" flashvar (NOTES 7.1).
  const langParam = app.params && app.params.get('lang');
  const manifestJob = loadJson('data/lang/manifest.json').then(m => { languages = m.languages || ['en']; return m; }).catch(() => ({ languages: ['en'], names: { en: 'English' } }));
  manifestJob.then(m => {
    if (langParam && (m.languages || []).includes(langParam)) {
      if (settings.get('language') !== langParam) settings.set('language', langParam);
      // Boot loaded the saved language; make the URL's the active one (UI text falls back to
      // English key by key, and a language without UI tables makes no requests).
      loadLanguage(langParam);
    }
  });

  async function roundTable() {
    if (!table) {
      const index = await loadJson('data/levels/index.json');
      table = {
        order: index.order,
        rounds: index.rounds.map((r, i) => ({
          number: i + 1,
          kind: r.kind,
          levels: r.kind === 'kitchen' ? KITCHEN_LEVELS.map(n => `kitchen${n}`) : r.levels.slice(),
        })),
      };
    }
    return table;
  }

  const unlock = id => { if (id && !progress.unlocked.includes(id)) progress.unlocked.push(id); };
  const recordBest = (id, points) => {
    if (typeof points !== 'number' || !isFinite(points)) return;
    if (progress.best[id] == null || points > progress.best[id]) progress.best[id] = points;
  };
  const kitchenNumber = id => Number(String(id).replace('kitchen', ''));
  const isKitchen = id => /^kitchen\d$/.test(String(id));

  // The scene launcher records what it passed (functions dropped) for the flow probe.
  function launch(name, params, style = { style: 'fade' }) {
    const plain = {};
    for (const [k, v] of Object.entries(params || {})) if (typeof v !== 'function' && !(v instanceof HTMLCanvasElement)) plain[k] = v;
    lastLaunch = { scene: name, params: plain };
    app.scenes.go(name, params, style);
  }

  // Copies the canvas as it is now (the frozen level behind the summary card).
  function snapshot() {
    try {
      const src = app.view.canvas;
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      return c;
    } catch { return null; }
  }

  const run = () => progress.run;
  const nickFor = r => (r.nickname && r.nickname.trim()) || avatarName(r.avatar);
  // Journey steps: derived from the run seed. Level select: ?seed= makes it reproducible,
  // otherwise every practice run draws a fresh seed (recorded in the flow probe's lastLaunch).
  const seedFor = tag => (hash(tag) ^ (progress.run ? progress.run.seed : 1)) >>> 0;
  const singleSeed = id => (seedParam != null ? (hash('single:' + id) ^ seedParam) >>> 0 : freshSeed());

  // Prefetch (fire and forget; every atlas load is memoised, so the scene's own load reuses it).
  const prefetch = job => { try { Promise.resolve(job()).catch(() => {}); } catch { /* ignore */ } };
  const prefetchShrink = () => prefetch(() => art.loadSet('shrink'));
  function prefetchAction(round, avatar) {
    if (!round) return;
    // Each area's own memoised loader, so the scene's load finds the sheets already in.
    if (round.kind === 'kitchen') { prefetch(() => loadKitchenArt(avatar)); return; }
    const id = round.levels[0];
    if (id) prefetch(() => sprites.loadForLevel(id, avatar));
  }
  // During a level (after its own art is in, `ready`): download what follows it, the round's next
  // level or, after the last one, the game show (download only: sprites.prefetchSet).
  function prefetchAfter(ready, round, part, avatar) {
    const next = round.levels[part + 1];
    prefetch(() => Promise.resolve(ready).then(() => (next && round.kind !== 'kitchen'
      ? sprites.loadIndex().then(() => sprites.prefetchSet(sprites.atlasesFor(next, avatar)))
      : next ? null : sprites.prefetchSet('gameshow'))));
  }

  // ---------------------------------------------------------------------------------------------
  // Texture memory (NOTES 8.4). Decoded atlas pages cost width x height x 4 bytes each, and iOS
  // Safari evicts or crashes a page well before 400-500 MB, so at every scene change the atlases
  // the next screen does not use are closed (sprites.release). Kept: the next screen's own set,
  // the set the flow decodes ahead during it (the shrinking zone during the cutscene and a quiz,
  // the level or kitchen during the shrinking zone, the summary card during a level), and the
  // player's hoverboard, HUD and pickups, which every level uses. The compressed bytes stay in
  // memory, so art needed again later decodes without downloading. null keeps everything (the
  // summary card between a level and its retry, Settings, unknown scenes).
  // ---------------------------------------------------------------------------------------------
  let lastReleased = [];
  function keepFor(name, params = {}) {
    const idx = sprites.index;
    if (!idx) return null;
    const sets = idx.sets || {};
    const avatar = AVATARS.includes(params.avatar) ? params.avatar : AVATARS.includes(profile.avatar) ? profile.avatar : 'harry';
    const ids = new Set(['hud', 'entities', 'player-' + avatar]);
    const add = list => (list || []).forEach(id => ids.add(id));
    const addSet = n => add(sets[n]);
    const action = round => {
      if (!round) return;
      if (round.kind === 'kitchen') add(kitchenAtlases(idx, avatar));
      else if (round.levels[0]) add(sprites.atlasesFor(round.levels[0], avatar));
    };
    switch (name) {
      case 'splash': addSet('splash'); break;
      case 'cutscene': addSet('cutscene'); addSet('shrink'); break;
      case 'shrink': addSet('shrink'); action(table && table.rounds[(Number(params.round) || 1) - 1]); break;
      case 'platform': add(sprites.atlasesFor(params.level, avatar)); addSet('summary'); break;
      case 'kitchen': add(kitchenAtlases(idx, avatar)); addSet('summary'); break;
      case 'gameshow': addSet('gameshow'); addSet('shrink'); break;
      case 'ending': addSet('gameshow'); addSet('splash'); break;
      case 'levelSelect':
        for (const id of Object.keys(idx.atlases || {})) if (/^tiles-|^hud/.test(id)) ids.add(id);
        addSet('splash');
        break;
      default: return null;
    }
    return ids;
  }
  app.scenes.beforeEnter = (name, params) => {
    const keep = keepFor(name, params);
    lastReleased = keep ? sprites.releaseExcept(keep) : [];
  };

  // ---------------------------------------------------------------------------------------------
  // Journey steps
  // ---------------------------------------------------------------------------------------------
  async function goStep() {
    const r = run();
    if (!r) return flow.toSplash();
    mode = 'journey';
    persist();
    const t = await roundTable();
    const round = t.rounds[r.round];
    if (!round) return finish();
    switch (r.step) {
      case 'blind': prefetchShrink(); return playQuiz(round, true);
      case 'shrink':
        prefetchAction(round, r.avatar);
        return launch('shrink', {
          avatar: r.avatar, round: round.number,
          // NOTES 2.5: played in full the first time, skippable after that.
          skippable: !!progress.shrinkSeen,
          onComplete: info => {
            nextFocus = info && info.focus;
            progress.shrinkSeen = true;
            r.step = 'action'; r.part = 0; goStep();
          },
        }, { style: 'iris' });
      case 'action': return playAction(round);
      case 'quiz': if (r.round < ROUNDS - 1) prefetchShrink(); return playQuiz(round, false);
      default: return finish();
    }
  }

  function playAction(round) {
    const r = run();
    if (r.part >= round.levels.length) { r.step = 'quiz'; return goStep(); }
    const id = round.levels[r.part];
    unlock(id);
    persist();
    const afterLevel = (points, newTotal) => {
      recordBest(id, points);
      if (round.kind === 'kitchen') r.kitchen = newTotal; else r.hover = newTotal;
      r.part++;
      if (r.part < round.levels.length) unlock(round.levels[r.part]);
      else r.step = 'quiz';
      goStep();
    };
    const onQuit = () => flow.toSplash();
    const style = { style: 'iris', focus: nextFocus };
    nextFocus = null;
    if (round.kind === 'kitchen') {
      const start = r.kitchen;
      prefetchAfter(loadKitchenArt(r.avatar), round, r.part, r.avatar);
      launch('kitchen', {
        level: kitchenNumber(id), avatar: r.avatar, score: start, seed: seedFor(`kitchen${id}`),
        onComplete: res => afterLevel(numberOr(res && res.score, start) - start, numberOr(res && res.score, start)),
        onQuit,
      }, style);
      return;
    }
    const start = r.hover;
    prefetch(() => art.loadSet('summary'));       // the card a failed level shows
    prefetchAfter(sprites.loadForLevel(id, r.avatar), round, r.part, r.avatar);
    // The retry straight after the summary card skips the briefing just read; a level reached
    // any other way (Continue, a round restart) shows it.
    const skipIntro = retrying;
    retrying = false;
    launch('platform', {
      level: id, avatar: r.avatar, score: start, seed: seedFor(id), intro: skipIntro ? '0' : undefined,
      onComplete: res => afterLevel(numberOr(res && res.score, start) - start, numberOr(res && res.score, start)),
      onGameOver: res => {
        // Score kept (the original never reset PlatformGame.score); lives and time reset.
        r.hover = numberOr(res && res.score, start);
        if (restartScope() === 'round') {
          // Flash: restartRound() = initialiseGame(roundStartPlayer, roundStartLevel), the
          // round's first level with its ePhone briefing (capture 510).
          r.part = 0;
          retrying = false;
        } else {
          retrying = true;
        }
        persist();
        launch('summary', {
          kind: res && res.reason === 0 ? 'time' : 'died', result: res, backdrop: snapshot(), buttons: ['retry'],
          onComplete: () => goStep(),
        }, { style: 'none' });
      },
      onQuit,
    }, style);
  }

  function playQuiz(round, blind) {
    const r = run();
    const blindOn = !!settings.get('blindRounds');
    // The step after this quiz is fixed now, with the host's closing line: "Step right this way"
    // is always followed by the shrinking zone. Changing the blind-rounds setting during a quiz
    // (Settings is reachable from its pause menu) takes effect from the next quiz.
    const next = blind ? 'shrink' : (blindOn ? 'blind' : 'shrink');
    launch('gameshow', {
      round: round.number, avatar: r.avatar, nickname: nickFor(r), cpuName: avatarName(otherAvatar(r.avatar)),
      playerScore: r.quiz, cpuScore: r.cpu, blind, seed: seedFor(`quiz${round.number}${blind ? 'b' : 's'}`),
      stepRight: blind || (!blindOn && round.number < ROUNDS),
      onComplete: res => {
        if (!blind) {
          r.quiz = numberOr(res && res.playerScore, r.quiz);
          r.cpu = numberOr(res && res.cpuScore, r.cpu);
          r.round++;
          r.part = 0;
          if (r.round >= ROUNDS) return finish();
        }
        r.step = next;
        goStep();
      },
      onQuit: () => flow.toSplash(),
    }, { style: 'fade' });
  }

  function finish() {
    const r = run();
    if (!r) return flow.toSplash();
    const ending = {
      playerScore: r.quiz, cpuScore: r.cpu, hoverScore: r.hover, kitchenScore: r.kitchen,
      avatar: r.avatar, nickname: nickFor(r),
    };
    progress.finished = (progress.finished || 0) + 1;
    progress.lastEnding = { ...ending };
    progress.run = null;
    persist();
    mode = 'menu';
    launch('ending', ending, { style: 'fade' });
  }

  // ---------------------------------------------------------------------------------------------
  // Level select: one level alone (briefing, level, results card), no shrink or quiz.
  // ---------------------------------------------------------------------------------------------
  async function playSingle(id) {
    const t = await roundTable();
    mode = 'single';
    const avatar = AVATARS.includes(profile.avatar) ? profile.avatar : 'harry';
    const next = nextLevelId(t, id);
    const results = (res, points) => {
      const prevBest = progress.best[id] ?? null;
      recordBest(id, points);
      if (next) unlock(next);
      persist();
      launch('summary', {
        kind: 'complete', result: { ...res, level: id, points, best: progress.best[id], prevBest, next },
        buttons: next ? ['next', 'retry', 'levelSelect'] : ['retry', 'levelSelect'],
        onComplete: choice => {
          if (choice === 'next' && next) playSingle(next);
          else if (choice === 'retry') playSingle(id);
          else flow.openLevelSelect();
        },
      }, { style: 'fade' });
    };
    if (isKitchen(id)) {
      launch('kitchen', {
        level: kitchenNumber(id), avatar, score: 0, seed: singleSeed(id),
        onComplete: res => results(res || {}, numberOr(res && res.score, 0)),
        onQuit: () => flow.openLevelSelect(),
      }, { style: 'iris' });
      return;
    }
    prefetch(() => art.loadSet('summary'));       // the results card
    launch('platform', {
      level: id, avatar, score: 0, seed: singleSeed(id),
      onComplete: res => results(res || {}, numberOr(res && res.score, 0)),
      onGameOver: res => launch('summary', {
        kind: res && res.reason === 0 ? 'time' : 'died', result: res, backdrop: snapshot(), buttons: ['retry', 'levelSelect'],
        onComplete: choice => (choice === 'levelSelect' ? flow.openLevelSelect() : playSingle(id)),
      }, { style: 'none' }),
      onQuit: () => flow.openLevelSelect(),
    }, { style: 'iris' });
  }

  function nextLevelId(t, id) {
    if (isKitchen(id)) { const n = kitchenNumber(id); return n < 3 ? `kitchen${n + 1}` : null; }
    const i = t.order.indexOf(id);
    return i >= 0 && i < t.order.length - 1 ? t.order[i + 1] : null;
  }

  const flow = {
    get state() { return progress; },
    get profile() { return profile; },
    get mode() { return mode; },
    overlayOpen: false,
    roundTable,
    hasSave: () => !!progress.run,
    isUnlocked: id => progress.unlocked.includes(id),
    manifest: () => manifestJob,

    newGame() {
      progress.run = null;
      retrying = false;
      persist();
      mode = 'journey';
      prefetchShrink();
      // Level 1's art that does not depend on the avatar (tiles, Lucy, pickups, HUD, briefing),
      // downloaded (not decoded) while the cutscene plays, once the cutscene's own art is in.
      prefetch(() => sprites.prefetchSet('cutscene').then(() => roundTable()).then(t => {
        const first = t.rounds[0] && t.rounds[0].kind !== 'kitchen' && t.rounds[0].levels[0];
        return first ? sprites.prefetchSet(sprites.atlasesFor(first, 'harry').filter(id => !/^player-/.test(id))) : null;
      }));
      launch('cutscene', {
        onComplete: ({ avatar, nickname } = {}) => {
          const a = AVATARS.includes(avatar) ? avatar : 'harry';
          const nick = String(nickname || '').trim().slice(0, 25);
          profile.nickname = nick;
          profile.avatar = a;
          persistProfile();
          progress.run = {
            avatar: a, nickname: nick, round: 0, part: 0,
            step: settings.get('blindRounds') ? 'blind' : 'shrink',
            quiz: 0, cpu: 0, hover: 0, kitchen: 0,
            seed: seedParam != null ? seedParam : freshSeed(),
          };
          goStep();
        },
      }, { style: 'fade' });
    },

    continueGame() {
      if (!progress.run) return flow.newGame();
      retrying = false;
      if (progress.run.step === 'shrink') prefetchShrink();
      goStep();
    },

    playLevel: id => playSingle(id),
    openLevelSelect() { mode = 'menu'; launch('levelSelect', {}, { style: 'fade' }); },
    toSplash() { mode = 'menu'; retrying = false; launch('splash', { again: true }, { style: 'fade' }); },
    finish,

    setProfileAvatar(a) { if (AVATARS.includes(a)) { profile.avatar = a; persistProfile(); } },

    clearNickname() {
      profile.nickname = '';
      persistProfile();
      if (progress.run) { progress.run.nickname = ''; persist(); }
    },

    resetProgress() {
      const keep = { ...blankProgress() };
      Object.keys(progress).forEach(k => delete progress[k]);
      Object.assign(progress, keep);
      persist();
    },

    // The splash's own art is in: download the cutscene's (the game show studio and cast, which
    // every quiz uses too), the likeliest next screen, without decoding it.
    prefetchMenu() { prefetch(() => sprites.prefetchSet('cutscene')); },

    probe() {
      const r = progress.run;
      return {
        mode,
        run: r ? { ...r } : null,
        unlocked: progress.unlocked.slice(),
        best: { ...progress.best },
        finished: progress.finished,
        lastLaunch: lastLaunch ? { scene: lastLaunch.scene, params: { ...lastLaunch.params } } : null,
        profile: { ...profile },
        blindRounds: !!settings.get('blindRounds'),
        restartScope: restartScope(),
        shrinkSeen: !!progress.shrinkSeen,
        retrying,
        language: quizLanguage(),
        art: { decodedBytes: sprites.decodedBytes(), loaded: [...sprites.decoded.keys()], released: lastReleased.slice() },
      };
    },
  };

  if (window.__test) window.__test.register('flow', () => flow.probe());
  return flow;
}

function numberOr(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }
