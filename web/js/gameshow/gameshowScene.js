// Scene 'gameshow': one quiz round of the game show (src/ebug/junior/GameShow.as; NOTES 6).
//
// Params (js/flow/contract.md): { round: 1..5, avatar: 'harry' | 'amy', nickname, cpuName,
// playerScore, cpuScore, blind, stepRight, seed, onComplete({ playerScore, cpuScore, answers }),
// onQuit() }:
//   blind: true      the round's blind half (build A, "warm-up questions"): blind intro, the
//                    questions without scores or CPU turns, then "Step right this way..."; the
//                    flow calls it before the shrink when settings 'blindRounds' is on (NOTES 2.3).
//                    Left out with no onComplete (opened on its own), it follows that setting.
//   stepRight: true  end the sighted half with "Step right this way..." (a shrink follows)
//   cpuName          the other child's name (default: that avatar's name)
//   seed             seeds the gameplay random stream (the CPU's answers)
//   lang             (tests) quiz language code; default: settings 'language' (the flow's
//                    choice, as i18n stays English without UI tables), else English. A missing
//                    quiz file falls back to English.
// Result: { playerScore, cpuScore, answers: [{ q, choice, value, score, blind, cpu: { choice,
// value } | null }], round, blind, lang }.
// URL form for testing: ?scene=gameshow&round=3&avatar=amy&nickname=Zoe&lang=gk_gk&seed=4.
// Without onComplete the scene ends on a small results card (next round / again / title).
//
// Round, sighted (the default; live 2009 build B): round title card -> the host's intro lines
// (<intro_text><normal>) -> for each question: "Question number N: ..." -> the board -> the
// player's answer -> "<name>, you chose X. This is the....VERDICT" -> the CPU's turn
// "<cpu>, you chose the VERDICT" -> next. Every question, including the last, gets its feedback
// and CPU turn (build A skipped both after the last question, GameShow.as:293-298).
// Scoring (rules.js): correct + score for whoever answered; wrong gives the opponent
// floor(score / 2); don't know scores nothing. The CPU picks a button uniformly (gameRng).
//
// Juice (render-only or deterministic): round title card with fanfare and applause, a drumroll
// while the host says "This is the....", the verdict landing on its first letter with confetti
// and sparkles (correct), a gentle shake (wrong) or a soft chime (don't know), score popups,
// eased LCD counters, board zoom-in and staggered buttons, music ducked on the board.
import { el, button, focusFirst, focusNavigator, trapFocus } from '../ui/dom.js';
import { loadJson } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t, language } from '../core/i18n.js';
import { AREA_MUSIC } from '../core/music.js';
import { Particles, Popups, Shake, haptic } from '../core/fx.js';
import { gameRng } from '../core/rng.js';
import { device, tp } from '../ui/prompts.js';
import { openSettings } from '../flow/settings.js';
import { loadAtlases, atlasSet, releaseBlits } from './art.js';
import { createTalkie } from './talkie.js';
import { Studio } from './studio.js';
import { Board } from './board.js';
import { injectStyle, PAUSE_ICON } from './style.js';
import { registerGameshowSounds } from './sound.js';
import { BALOO, roundRect, fitLine } from './text.js';
import {
  scorePlayerAnswer, scoreCpuAnswer, cpuChoice, verdictKey, PLAYER_REACTION, CPU_REACTION,
  BLIND_REACTIONS, blindIntro, normaliseIntro, buttonLabels, ANSWER_CORRECT, ANSWER_WRONG,
} from './rules.js';

const ROUNDS = 5;
const TITLE_TICKS = 160;         // the round card holds 2.4 s unless tapped
const TITLE_MIN_TICKS = 24;      // and cannot be skipped in its first 0.36 s
const LOCK_TICKS = 34;           // the chosen answer pulses for 0.5 s before the host replies
const OUTRO_TICKS = 60;          // pause on the final scores before handing back
const CONFETTI = ['#ffd84a', '#ff8a5c', '#5fd4ff', '#6fe0a8', '#ffffff', '#ff7fbf'];
const SENTINEL = '\u0001';

registerGameshowSounds();

const truthy = v => v === true || v === 1 || v === '1' || v === 'true';

export function gameshowScene(app) {
  const input = app.input;
  const particles = new Particles(500);
  const popups = new Popups();
  const shake = new Shake();
  let params = {};
  let phase = 'loading';
  let tick = 0;
  let loadProgress = 0;
  let destroyed = false;
  let paused = false;
  let overlay = null, overlayNav = null, untrap = null;
  let pauseBtn = null, stageTap = null, stageTapQueued = false;
  let studio = null, talkie = null, board = null;
  let quiz = null, quizCode = 'en', roundData = null, questions = [], labels = [];
  let roundNo = 1, blind = false, stepRight = false;
  let avatar = 'harry', cpuAvatar = 'amy', playerName = 'Harry', cpuName = 'Amy';
  let scores = { player: 0, cpu: 0 };
  let startScores = { player: 0, cpu: 0 };
  let qi = -1;
  let answers = [];
  let pending = null;              // verdict waiting for the typewriter: { at, drumFrom, fire, fired, lastDrum }
  let titleAge = 0, lockAge = 0, outroAge = 0;
  let result = null, completed = false;
  let musicOn = false;
  let reducedMotion = !!settings.get('reducedMotion');
  const log = [];                  // event log for tests: [tick, event]

  const onSetting = e => {
    if (e.detail.key === 'reducedMotion') reducedMotion = !!settings.get('reducedMotion');
    if (e.detail.key === 'textScale' && board && board.visible && board.question) board.layout = board.computeLayout();
  };

  // ------------------------------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------------------------------
  async function load() {
    const code = params.lang || settings.get('language') || language() || 'en';
    const quizJob = loadJson(`data/quiz/${code}.json`).then(d => ({ code, d }))
      .catch(() => loadJson('data/quiz/en.json').then(d => ({ code: 'en', d })));
    const art = loadAtlases(atlasSet('gameshow', ['gameshow-bg', 'gameshow-cast']), p => { loadProgress = p; }).catch(() => false);
    const [q] = await Promise.all([quizJob, art]);
    if (destroyed) return;
    quiz = q.d;
    quizCode = q.code;
    roundData = quiz.rounds[roundNo - 1] || quiz.rounds[0];
    questions = roundData.questions;
    labels = buttonLabels(quiz);
    begin();
  }

  function begin() {
    studio = new Studio({ player: avatar, playerName, cpuName });
    studio.setScores(scores.player, scores.cpu, { instant: true });
    studio.onDigit = () => { if (tick % 4 === 0) audio.play('gsDigit', { volume: 0.5 }); };
    studio.start();
    talkie = createTalkie(app, { x: 20, y: 308, speaker: t('gameshow.host'), id: 'gs-talkie-tap' });
    board = new Board(app, { onChoose: onAnswer });
    pauseBtn = button('', () => { pauseBtn.blur(); pause(); }, { class: 'gs-pause', id: 'gs-pause', 'aria-label': t('gameshow.pause') });
    pauseBtn.innerHTML = PAUSE_ICON;
    app.ui.append(pauseBtn);
    stageTap = el('div', { class: 'gs-stage-tap', id: 'gs-stage-tap', role: 'button', 'aria-label': t('gameshow.continue') });
    stageTap.hidden = true;
    stageTap.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); stageTapQueued = true; });
    app.ui.append(stageTap);
    startTitle();
  }

  // ------------------------------------------------------------------------------------------
  // The round, step by step
  // ------------------------------------------------------------------------------------------
  function mark(event) { log.push([tick, event]); }

  function startTitle() {
    phase = 'title';
    titleAge = 0;
    stageTap.hidden = false;
    stageTapQueued = false;
    studio.react('host', 'excited');
    audio.play('gsFanfare');
    audio.play('gsApplause', { volume: 0.8 });
    mark('title');
  }

  function startIntro() {
    stageTap.hidden = true;
    phase = 'intro';
    studio.react('host', 'excited');
    const lines = normaliseIntro(quizCode, blind ? blindIntro(roundNo, roundData.intro.blind) : roundData.intro.normal);
    mark('intro');
    talkie.say(lines.length ? lines : [''], () => ask(0));
  }

  function ask(i) {
    if (i >= questions.length) { finishRound(); return; }
    qi = i;
    phase = 'ask';
    const q = questions[i];
    mark(`ask ${i}`);
    talkie.show();
    talkie.say([t('gameshow.ask', { n: i + 1, text: q.text })], showBoard);
  }

  function showBoard() {
    phase = 'board';
    const q = questions[qi];
    talkie.hide();
    board.show({ text: q.text, score: q.score }, qi + 1, questions.length, labels);
    audio.musicLevel(0.55);
    mark(`board ${qi}`);
  }

  // Board callback: the player chose button `choice` (0 Agree, 1 Don't Know, 2 Disagree).
  function onAnswer(choice) {
    if (phase !== 'board') return;
    phase = 'lockin';
    lockAge = 0;
    const q = questions[qi];
    const value = q.answers[choice].value;
    answers.push({ q: qi, choice, value, score: q.score, blind, cpu: null });
    haptic(12);
    mark(`answer ${qi} ${choice} ${value}`);
  }

  function respond() {
    board.hide();
    audio.musicLevel(1);
    phase = 'response';
    const a = answers[answers.length - 1];
    const q = questions[qi];
    let text = t('gameshow.youChose', { name: playerName, choice: t(`gameshow.choice.${a.choice}`) });
    talkie.show();
    if (blind) {
      // Blind round: no verdict, the host looks serious and the player makes a random face
      // (GameShow.as:216-243). The last blind answer gets this echo too, before "Step right this
      // way..." (build A dropped it, :284-292; NOTES 11.1 #1; decisions G1).
      text += '\n' + t('gameshow.blindNotice');
      studio.react('host', 'serious');
      studio.react(avatar, BLIND_REACTIONS[Math.min(2, Math.floor(gameRng.next() * 3))]);
      pending = null;
      talkie.say([text], afterResponse);
      return;
    }
    const verdict = t(`gameshow.verdict.${verdictKey(a.value)}`);
    const tail = t('gameshow.thisIsThe', { verdict: SENTINEL });
    const drumFrom = text.length + 1;
    const at = drumFrom + tail.indexOf(SENTINEL);
    text += '\n' + tail.replace(SENTINEL, verdict);
    pending = {
      at, drumFrom, fired: false, lastDrum: -1,
      fire: () => {
        const before = { ...scores };
        scores = scorePlayerAnswer(a.value, q.score, scores);
        const react = PLAYER_REACTION[a.value];
        studio.react('host', react.host);
        studio.react(avatar, react.kid);
        studio.setScores(scores.player, scores.cpu);
        playerVerdictFx(a.value, scores.player - before.player, scores.cpu - before.cpu);
        mark(`verdict ${qi} ${a.value}`);
      },
    };
    talkie.say([text], afterResponse);
  }

  function afterResponse() {
    firePending();
    if (blind) {
      if (qi + 1 < questions.length) ask(qi + 1);
      else stepRightThisWay();
      return;
    }
    cpuTurn();
  }

  // The CPU's turn (GameShow.as pickCpuResponse(), :304-329).
  function cpuTurn() {
    phase = 'cpu';
    const q = questions[qi];
    const choice = cpuChoice(gameRng);
    const value = q.answers[choice].value;
    const a = answers[answers.length - 1];
    a.cpu = { choice, value };
    const template = t('gameshow.cpuChose', { name: cpuName, verdict: SENTINEL });
    const at = template.indexOf(SENTINEL);
    const text = template.replace(SENTINEL, t(`gameshow.verdict.${verdictKey(value)}`));
    mark(`cpu ${qi} ${choice} ${value}`);
    pending = {
      at, drumFrom: at, fired: false, lastDrum: -1,
      fire: () => {
        const before = { ...scores };
        scores = scoreCpuAnswer(value, q.score, scores);
        studio.react(cpuAvatar, CPU_REACTION[value]);
        studio.setScores(scores.player, scores.cpu);
        cpuVerdictFx(value, scores.player - before.player, scores.cpu - before.cpu);
        mark(`cpuVerdict ${qi} ${value}`);
      },
    };
    talkie.say([text], () => { firePending(); ask(qi + 1); });
  }

  function firePending() {
    if (pending && !pending.fired) { pending.fired = true; pending.fire(); }
    pending = null;
  }

  function stepRightThisWay() {
    phase = 'step';
    mark('step');
    talkie.say([t('gameshow.stepRightThisWay')], () => complete());
  }

  function finishRound() {
    if (stepRight) { stepRightThisWay(); return; }
    phase = 'outro';
    outroAge = 0;
    audio.play('gsApplause', { volume: 0.7 });
    mark('outro');
  }

  function complete() {
    if (completed) return;
    completed = true;
    phase = 'done';
    result = {
      playerScore: scores.player, cpuScore: scores.cpu,
      answers: answers.map(a => ({ ...a, cpu: a.cpu ? { ...a.cpu } : null })),
      round: roundNo, blind, lang: quizCode,
    };
    mark('complete');
    const cb = params.onComplete;
    if (typeof cb === 'function') cb(result);
    else showEndCard();
  }

  // ------------------------------------------------------------------------------------------
  // Juice
  // ------------------------------------------------------------------------------------------
  function burstConfetti(who, count = 46) {
    const k = studio.kidAnchor(who);
    const p = { x: k.x, y: k.y + 25 };
    particles.emit(p.x, p.y, { count, colors: CONFETTI, shape: 'square', speed: 6.5, spread: 1.5, angle: -Math.PI / 2, gravity: 0.16, drag: 0.975, life: 80, size: 7 });
    particles.emit(p.x, p.y - 20, { count: Math.round(count / 3), colors: ['#fff6b0', '#ffffff'], shape: 'star', speed: 3.5, gravity: 0.02, life: 50, size: 7 });
  }

  function sparkle(who, count = 16, colors = ['#fff6b0', '#ffffff', '#b8ff9a']) {
    const c = studio.scoreCentre(who);
    particles.emit(c.x, c.y, { count, colors, shape: 'star', speed: 3, gravity: 0.01, life: 40, size: 6 });
  }

  function popup(who, n, color) {
    if (!n) return;
    const c = studio.scoreCentre(who);
    popups.add(t('gameshow.plus', { n }), c.x, c.y - 50, { color, size: 26, life: 70, stroke: '#2a1b4a' });
    studio.tagPop[who] = 1;
  }

  function playerVerdictFx(value, dPlayer, dCpu) {
    if (value === ANSWER_CORRECT) {
      audio.play('gsCorrect');
      audio.play('gsCrash', { volume: 0.7 });
      audio.play('gsApplause');
      burstConfetti(avatar);
      sparkle(avatar, 18);
      popup(avatar, dPlayer, '#ffd84a');
      haptic([15, 30, 15]);
    } else if (value === ANSWER_WRONG) {
      audio.play('gsWrong');
      if (!reducedMotion) shake.add(0.32);
      popup(cpuAvatar, dCpu, '#ffb0c0');
      sparkle(cpuAvatar, 8, ['#ffd0d8', '#ffffff']);
      haptic([30, 40, 30]);
    } else {
      audio.play('gsNeutral');
      const c = studio.kidAnchor(avatar);
      particles.emit(c.x, c.y + 40, { count: 10, colors: ['#e8f4ff', '#ffffff'], shape: 'bubble', speed: 1.4, gravity: -0.04, life: 60, size: 6 });
    }
  }

  function cpuVerdictFx(value, dPlayer, dCpu) {
    if (value === ANSWER_CORRECT) {
      audio.play('gsCorrect', { volume: 0.6 });
      audio.play('gsApplause', { volume: 0.5 });
      sparkle(cpuAvatar, 14);
      popup(cpuAvatar, dCpu, '#b8ff9a');
    } else if (value === ANSWER_WRONG) {
      audio.play('gsWrong', { volume: 0.6 });
      popup(avatar, dPlayer, '#ffd84a');
      sparkle(avatar, 12);
    } else {
      audio.play('gsNeutral', { volume: 0.6 });
    }
  }

  // Drum hits while "This is the...." types, then the verdict as its first letter appears.
  function updatePending() {
    if (!pending || pending.fired) return;
    const p = talkie.progress;
    if (p >= pending.at) { firePending(); return; }
    if (p > pending.drumFrom && p !== pending.lastDrum && p % 2 === 0) {
      const k = Math.max(0, Math.min(1, (p - pending.drumFrom) / Math.max(1, pending.at - pending.drumFrom)));
      audio.play('gsDrum', { volume: 0.35 + 0.65 * k, rate: 0.95 + 0.1 * k });
    }
    pending.lastDrum = p;
  }

  // ------------------------------------------------------------------------------------------
  // Pause and the standalone results card
  // ------------------------------------------------------------------------------------------
  function clearOverlay() {
    if (untrap) { untrap(); untrap = null; }
    if (overlay) {
      const had = overlay.contains(document.activeElement);
      overlay.remove();
      if (had) document.getElementById('game')?.focus({ preventScroll: true });
    }
    overlay = null; overlayNav = null;
  }

  function showOverlay(card) {
    clearOverlay();
    overlay = el('div', { class: 'gs-overlay', 'data-native-keys': true }, card);
    app.ui.append(overlay);
    overlayNav = focusNavigator(overlay);
    untrap = trapFocus(overlay);
    focusFirst(overlay);
  }

  function pause() {
    if (paused || phase === 'loading' || phase === 'done') return;
    paused = true;
    audio.musicLevel(0.35);
    showOverlay(el('div', { class: 'gs-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gs-paused-title' },
      el('h2', { id: 'gs-paused-title' }, t('gameshow.paused')),
      el('div', { class: 'gs-row' },
        button(t('gameshow.resume'), resume, { class: 'primary', id: 'gs-resume' }),
        button(t('gameshow.settings'), openSettingsOverlay, { id: 'gs-settings' }),
        button(t('gameshow.quit'), quit, { id: 'gs-quit' }))));
    mark('pause');
  }

  // The flow's settings panel over the pause card (text size, sound, keys); input waits for it.
  function openSettingsOverlay() {
    const card = overlay;
    if (untrap) { untrap(); untrap = null; }
    overlayNav = null;
    openSettings(app, {
      onClose: () => {
        if (destroyed || overlay !== card || !card) return;
        overlayNav = focusNavigator(card);
        untrap = trapFocus(card);
        focusFirst(card);
      },
    });
  }

  function resume() {
    if (!paused) return;
    paused = false;
    clearOverlay();
    // The Enter or Space that pressed Resume must not also reach the board or the talkie on the
    // next poll (input.js adds the key to keysTapped before the button's native click runs), as
    // flow/settings.js close() does.
    input.clearAll();
    audio.musicLevel(phase === 'board' ? 0.55 : 1);
    mark('resume');
  }

  function quit() {
    clearOverlay();
    paused = false;
    if (typeof params.onQuit === 'function') params.onQuit();
    else app.scenes.go('splash');
  }

  function showEndCard() {
    const you = el('div', { class: 'gs-score you' }, el('b', {}, String(scores.player)), el('span', {}, playerName));
    const them = el('div', { class: 'gs-score' }, el('b', {}, String(scores.cpu)), el('span', {}, cpuName));
    const buttons = [];
    const base = { avatar, nickname: params.nickname || '', lang: params.lang, seed: params.seed };
    if (blind) buttons.push(button(t('gameshow.scoredQuestions'), () => app.scenes.go('gameshow', { ...base, round: roundNo, blind: false, playerScore: scores.player, cpuScore: scores.cpu }), { class: 'primary', id: 'gs-scored' }));
    if (roundNo < ROUNDS && !blind) buttons.push(button(t('gameshow.nextRound'), () => app.scenes.go('gameshow', { ...base, round: roundNo + 1, playerScore: scores.player, cpuScore: scores.cpu }), { class: 'primary', id: 'gs-next-round' }));
    buttons.push(button(t('gameshow.playAgain'), () => app.scenes.go('gameshow', { ...base, round: roundNo, blind, playerScore: startScores.player, cpuScore: startScores.cpu }), { id: 'gs-again' }));
    buttons.push(button(t('gameshow.backToTitle'), () => app.scenes.go('splash'), { id: 'gs-title' }));
    showOverlay(el('div', { class: 'gs-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gs-end-title' },
      el('h2', { id: 'gs-end-title' }, t(blind ? 'gameshow.warmUpComplete' : 'gameshow.roundComplete')),
      el('div', { class: 'gs-scores' }, you, them),
      el('div', { class: 'gs-row' }, ...buttons)));
  }

  function startMusicWhenUnlocked() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC.gameshow);
    audio.musicLevel(paused ? 0.35 : phase === 'board' ? 0.55 : 1);
  }

  // ------------------------------------------------------------------------------------------
  const scene = {
    enter(p = {}) {
      params = { ...p };
      injectStyle();
      app.touch.hide();
      if (params.seed != null && params.seed !== '') gameRng.seed(Number(params.seed));
      roundNo = Math.max(1, Math.min(ROUNDS, Math.round(Number(params.round) || 1)));
      // The flow always says which half it wants. Opened on its own (no callback, no `blind`),
      // the scene follows the flow's 'blindRounds' setting like a journey would: the blind half
      // first, and its results card leads on to the scored half (NOTES 11.9 #1).
      const standalone = typeof params.onComplete !== 'function';
      blind = params.blind != null && params.blind !== '' ? truthy(params.blind) : standalone && !!settings.get('blindRounds');
      avatar = params.avatar === 'amy' ? 'amy' : 'harry';
      cpuAvatar = avatar === 'amy' ? 'harry' : 'amy';
      const nick = String(params.nickname || '').trim();
      playerName = nick || t(`gameshow.name.${avatar}`);
      cpuName = String(params.cpuName || '').trim() || t(`gameshow.name.${cpuAvatar}`);
      stepRight = truthy(params.stepRight);
      scores = { player: Math.max(0, Number(params.playerScore) || 0), cpu: Math.max(0, Number(params.cpuScore) || 0) };
      startScores = { ...scores };
      settings.addEventListener('change', onSetting);
      window.__test && window.__test.register('gameshow', probe);
      load();
    },

    exit() {
      destroyed = true;
      settings.removeEventListener('change', onSetting);
      clearOverlay();
      if (talkie) talkie.destroy();
      if (board) board.destroy();
      // The pre-scaled copies of the set, board, podia and talkie (about 12 MB on a 2x phone)
      // are not needed outside the studio; the cutscene and ending rebuild theirs on first draw.
      releaseBlits();
      audio.stopMusic();
      window.__test && window.__test.unregister('gameshow');
    },

    onHidden() { pause(); },

    update() {
      if (app.flow && app.flow.overlayOpen) return;   // the settings panel has the input
      const wasPaused = paused;
      if (overlayNav) overlayNav();
      if (!studio) return;
      startMusicWhenUnlocked();
      if (paused) {
        if (input.pressed('pause') || input.pressed('back')) resume();
        return;
      }
      // Resumed by the menu during this tick (a gamepad A on Resume clicks it from overlayNav()
      // above): this tick's presses are spent.
      if (wasPaused) return;
      if (phase === 'done') { tick++; studio.update(); particles.update(); popups.update(); shake.update(); return; }
      if (input.pressed('pause')) { pause(); return; }
      tick++;
      let consumed = false;          // a press used here must not also reach the talkie
      if (phase === 'title') {
        titleAge++;
        const press = input.pressed('confirm') || input.pressed('jump') || stageTapQueued;
        stageTapQueued = false;
        if (titleAge >= TITLE_TICKS || (press && titleAge >= TITLE_MIN_TICKS)) { consumed = press; startIntro(); }
      } else if (phase === 'lockin') {
        lockAge++;
        if (lockAge % 3 === 0) audio.play('gsDrum', { volume: 0.25 + 0.5 * (lockAge / LOCK_TICKS) });
        if (lockAge >= LOCK_TICKS) respond();
      } else if (phase === 'outro') {
        outroAge++;
        if (outroAge >= OUTRO_TICKS && studio.countersSettled) complete();
      }
      board.update(input);
      if (!consumed) talkie.update();
      updatePending();
      studio.update();
      particles.update();
      popups.update();
      shake.update();
    },

    render(ctx) {
      if (!studio) { drawLoading(ctx); return; }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 800, 450);
      ctx.save();
      if (shake.trauma > 0) ctx.translate(shake.x, shake.y);
      studio.draw(ctx, { reducedMotion });
      particles.draw(ctx);
      popups.draw(ctx);
      ctx.restore();
      talkie.render(ctx);
      if (phase === 'title') drawTitle(ctx);
      board.draw(ctx, { device: device(), reducedMotion, tick });
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
    ctx.font = `800 26px ${BALOO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t('gameshow.loading'), 400, 240);
  }

  // The round title card: "Round N" and the topic, bouncing in over a dimmed studio.
  function drawTitle(ctx) {
    const inK = reducedMotion ? 1 : Math.min(1, titleAge / 18);
    const back = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const s = reducedMotion ? 1 : back(inK);
    ctx.save();
    ctx.fillStyle = `rgba(20, 10, 50, ${0.45 * inK})`;
    ctx.fillRect(0, 0, 800, 450);
    ctx.translate(400, 170);
    ctx.scale(s, s);
    ctx.rotate(reducedMotion ? 0 : (1 - inK) * -0.12);
    const w = 470, h = 150;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    roundRect(ctx, -w / 2, -h / 2 + 8, w, h, 30);
    ctx.fill();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#c86ee6');
    g.addColorStop(1, '#8a3cb4');
    ctx.fillStyle = g;
    roundRect(ctx, -w / 2, -h / 2, w, h, 30);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd84a';
    ctx.stroke();
    // Bulbs round the edge, chasing (like the set's arch).
    for (let i = 0; i < 22; i++) {
      const u = i / 22;
      const per = 2 * (w + h);
      let d = u * per, bx, by;
      if (d < w) { bx = -w / 2 + d; by = -h / 2; } else if ((d -= w) < h) { bx = w / 2; by = -h / 2 + d; } else if ((d -= h) < w) { bx = w / 2 - d; by = h / 2; } else { d -= w; bx = -w / 2; by = h / 2 - d; }
      const on = reducedMotion || (Math.floor(titleAge / 5) + i) % 3 !== 0;
      ctx.fillStyle = on ? '#fff3a6' : '#b88a2a';
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const head = blind ? t('gameshow.warmUp') : t('gameshow.round', { n: roundNo });
    const hf = fitLine(head, z => `800 ${z}px ${BALOO}`, w - 60, 58, 28);
    ctx.font = `800 ${hf.size}px ${BALOO}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#4a1670';
    ctx.strokeText(head, 0, 4);
    ctx.fillStyle = '#ffd84a';
    ctx.fillText(head, 0, 4);
    const name = t(`gameshow.roundName.${roundNo}`);
    const sub = blind ? `${t('gameshow.round', { n: roundNo })}: ${name}` : name;
    const nf = fitLine(sub, z => `700 ${z}px ${BALOO}`, w - 60, 30, 16);
    ctx.font = `700 ${nf.size}px ${BALOO}`;
    ctx.lineWidth = 5;
    ctx.strokeText(sub, 0, 48);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, 0, 48);
    ctx.restore();
    // Sparkles drifting up behind the card.
    if (!reducedMotion && titleAge % 6 === 0 && titleAge < 120) particles.emit(160 + (titleAge * 53) % 480, 250, { count: 2, colors: ['#fff6b0', '#ffffff', '#ffd84a'], shape: 'star', speed: 1.5, angle: -Math.PI / 2, spread: 1, gravity: -0.02, life: 60, size: 6 });
    const hint = titleHintText();
    if (titleAge > 40) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (titleAge - 40) / 20) * (0.7 + 0.3 * Math.sin(titleAge * 0.1));
      ctx.font = `700 18px ${BALOO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(hint, 400, 275);
      ctx.restore();
    }
  }

  // "Tap to start", or "Press <the key bound to confirm> to start" ("Press A" on a gamepad).
  function titleHintText() {
    return device() === 'touch' ? t('gameshow.tapToStart') : tp('gameshow.pressToStart');
  }

  // window.__test probe: everything a bot or test needs.
  function probe() {
    const q = qi >= 0 ? questions[qi] : null;
    return {
      ready: !!studio, phase, paused, round: roundNo, blind, lang: quizCode, tick,
      avatar, cpuAvatar, playerName, cpuName,
      questionIndex: qi, questionCount: questions.length,
      question: q ? { text: q.text, score: q.score, values: q.answers.map(a => a.value) } : null,
      labels,
      talkie: talkie ? talkie.state() : null,
      board: board ? board.state(device()) : null,
      titleHint: titleHintText(),
      scores: { ...scores, shownPlayer: studio ? studio.scores[avatar].shown : scores.player, shownCpu: studio ? studio.scores[cpuAvatar].shown : scores.cpu },
      startScores: { ...startScores },
      answers: answers.map(a => ({ ...a, cpu: a.cpu ? { ...a.cpu } : null })),
      studio: studio ? studio.state() : null,
      pendingVerdict: !!(pending && !pending.fired),
      result, completed, device: device(), reducedMotion,
      fx: { particles: particles.items.length, popups: popups.items.length, shake: shake.trauma },
      overlay: overlay ? (overlay.querySelector('h2') || {}).textContent || 'open' : null,
      music: musicOn,
      log: log.slice(-160),
    };
  }

  return scene;
}
