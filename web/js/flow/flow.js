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
// A failed level shows the summary card and restarts that same level with the score kept.
// Four separate scores, as in Flash: quiz points (player) and the CPU's quiz points decide the
// winner; hoverboard points (PlatformGame.score, zeroed only when the game is built, so it runs
// across every level, round and retry: PlatformGame.as:123) and kitchen points are shown only.
//
// Progress is saved at the start of every step (smw:progress), so Continue resumes the step the
// player was on with the scores it started with. Randomness: each step gets a seed derived from
// the run seed, so a saved journey replays the same way.
import { loadJson } from '../core/assets.js';
import { load, save } from '../core/save.js';
import { settings } from '../core/settings.js';
import { gameRng } from '../core/rng.js';
import { loadLanguage } from '../core/i18n.js';

const SAVE_KEY = 'progress';
const PROFILE_KEY = 'profile';
export const ROUNDS = 5;
export const KITCHEN_LEVELS = [0, 1, 2, 3];
export const AVATARS = ['harry', 'amy'];
export const avatarName = a => (a === 'amy' ? 'Amy' : 'Harry');
export const otherAvatar = a => (a === 'amy' ? 'harry' : 'amy');

// Language of the quiz and the host's introduction (web/data/quiz/<code>.json). Read from the
// setting rather than i18n's active language, which stays English while only English UI tables
// exist (web/requests/flow.md #1).
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
  return { v: 1, run: null, unlocked: ['alpha_level1'], best: {}, finished: 0, lastEnding: null };
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
      run: validRun(stored.run) ? stored.run : null,
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
    if (langParam && (m.languages || []).includes(langParam) && settings.get('language') !== langParam) {
      settings.set('language', langParam);
      if (langParam === 'en') loadLanguage('en');
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
  const seedFor = tag => (hash(tag) ^ (progress.run ? progress.run.seed : 1)) >>> 0;

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
      case 'blind': return playQuiz(round, true);
      case 'shrink':
        return launch('shrink', {
          avatar: r.avatar, round: round.number,
          onComplete: info => { nextFocus = info && info.focus; r.step = 'action'; r.part = 0; goStep(); },
        }, { style: 'iris' });
      case 'action': return playAction(round);
      case 'quiz': return playQuiz(round, false);
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
      launch('kitchen', {
        level: kitchenNumber(id), avatar: r.avatar, score: start, seed: seedFor(`kitchen${id}`),
        onComplete: res => afterLevel(numberOr(res && res.score, start) - start, numberOr(res && res.score, start)),
        onQuit,
      }, style);
      return;
    }
    const start = r.hover;
    launch('platform', {
      level: id, avatar: r.avatar, score: start, seed: seedFor(id), intro: r.retry ? '0' : undefined,
      onComplete: res => { r.retry = false; afterLevel(numberOr(res && res.score, start) - start, numberOr(res && res.score, start)); },
      onGameOver: res => {
        // Score kept (the original never reset PlatformGame.score); lives and time reset.
        r.hover = numberOr(res && res.score, start);
        r.retry = true;
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
          r.step = settings.get('blindRounds') ? 'blind' : 'shrink';
        } else {
          r.step = 'shrink';
        }
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
      recordBest(id, points);
      if (next) unlock(next);
      persist();
      launch('summary', {
        kind: 'complete', result: { ...res, level: id, points, best: progress.best[id], next },
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
        level: kitchenNumber(id), avatar, score: 0, seed: seedFor(id),
        onComplete: res => results(res || {}, numberOr(res && res.score, 0)),
        onQuit: () => flow.openLevelSelect(),
      }, { style: 'iris' });
      return;
    }
    launch('platform', {
      level: id, avatar, score: 0, seed: seedFor(id),
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
      persist();
      mode = 'journey';
      launch('cutscene', {
        onComplete: ({ avatar, nickname, age } = {}) => {
          const a = AVATARS.includes(avatar) ? avatar : 'harry';
          const nick = String(nickname || '').trim().slice(0, 25);
          const ageNum = Number.isInteger(age) && age > 0 && age < 120 ? age : null;
          profile.nickname = nick;
          profile.avatar = a;
          persistProfile();
          const seedParam = app.params && app.params.get('seed');
          progress.run = {
            avatar: a, nickname: nick, age: ageNum, round: 0, part: 0,
            step: settings.get('blindRounds') ? 'blind' : 'shrink',
            quiz: 0, cpu: 0, hover: 0, kitchen: 0,
            seed: seedParam != null && seedParam !== '' ? Number(seedParam) >>> 0 : Math.floor(gameRng.next() * 2147483647),
          };
          goStep();
        },
      }, { style: 'fade' });
    },

    continueGame() {
      if (!progress.run) return flow.newGame();
      goStep();
    },

    playLevel: id => playSingle(id),
    openLevelSelect() { mode = 'menu'; launch('levelSelect', {}, { style: 'fade' }); },
    toSplash() { mode = 'menu'; launch('splash', { again: true }, { style: 'fade' }); },
    finish,

    setProfileAvatar(a) { if (AVATARS.includes(a)) { profile.avatar = a; persistProfile(); } },

    clearNickname() {
      profile.nickname = '';
      persistProfile();
      if (progress.run) { progress.run.nickname = ''; progress.run.age = null; persist(); }
    },

    resetProgress() {
      const keep = { ...blankProgress() };
      Object.keys(progress).forEach(k => delete progress[k]);
      Object.assign(progress, keep);
      persist();
    },

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
        language: quizLanguage(),
      };
    },
  };

  if (window.__test) window.__test.register('flow', () => flow.probe());
  return flow;
}

function numberOr(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }
