// Intro cutscene (movies/cutscene_introduction.swf: root labels init 1, start_intro 10,
// choose_avatar 20, get_details 30; NOTES 2.4). The host greets the player in the talkie (lines
// 0-2 of the introduction file), the player picks Amy or Harry (hover: that child plays "happy",
// the other "disappointed"; the room behind the podiums darkens), the host says line 4, the
// details form asks for a nickname only (no age, no e-mail and no competitions line: a privacy
// line instead, NOTES 11.2), and a closing line leads on (decision 11.9 #14). With blind rounds
// off a shrinking zone follows, so the host then says "Step right this way ..." (NOTES 2.3,
// build B). A small Main menu button (top left) lets a touch player leave at any point.
// Text: web/data/quiz/<lang>.json "intro" (the 10 live statements, line 0 already rebranded);
// the talkie, studio and cast are the game show area's (js/gameshow/talkie.js, studio.js).
import { el } from '../ui/dom.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { tp } from '../ui/prompts.js';
import { Particles, haptic } from '../core/fx.js';
import { AREA_MUSIC } from '../core/music.js';
import { createTalkie } from '../gameshow/talkie.js';
import { Studio } from '../gameshow/studio.js';
import { loadAtlases, atlasSet, drawFrame, hasArt } from '../gameshow/art.js';
import { registerGameshowSounds } from '../gameshow/sound.js';
import { loadQuizText, avatarName } from './flow.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav, confirmDialog } from './ui.js';

// Build A's and the live file's indices (CutSceneXMLParser: every <statement> in order).
const LINE = { hello: 0, soon: 1, who: 2, tell: 4, nickname: 5, closingLive: 9 };
const TALKIE_AT = { x: 15, y: 307.5 };
const KID_RECTS = {   // amyButton / harryButton: a 50 x 50 square scaled 2.68 x 5.26 (sprite 846)
  amy: { x: 437, y: 100, w: 134, h: 263 },
  harry: { x: 584, y: 124, w: 134, h: 263 },
};
const SUBMIT_AT = { x: 398.65, y: 275.95, w: 219, h: 79 };
const ENGLISH_FALLBACK = ['Hello and welcome to the Super Microbe World Game Show!', 'Soon you will be visiting the weird world of the microbe.', 'But first, who do you want to play as?', '', 'Tell me a little about yourself:', 'Nickname', 'Age', 'email address', '', "Let's see what you know about microbes."];

const CSS = `
.cs-kid { position: absolute; background: transparent; border: 0; border-radius: 22px; cursor: pointer; padding: 0; }
.cs-kid:focus-visible { outline: 4px solid #ffd23f; outline-offset: -4px; }
.cs-kid span { position: absolute; left: 50%; top: -6px; transform: translate(-50%, -100%) scale(0.85); opacity: 0; transition: opacity 0.15s, transform 0.15s;
  background: #ffd84a; color: #3a1450; border: 3px solid #b57a00; border-radius: 999px; padding: 3px 14px; font: 800 calc(18px * var(--text-scale, 1)) var(--ui-font); white-space: nowrap; }
.cs-kid:hover span, .cs-kid:focus-visible span, .cs-kid.hot span { opacity: 1; transform: translate(-50%, -100%) scale(1); }
.cs-hint { position: absolute; left: 20px; right: 20px; bottom: 16px; text-align: center; color: #fff; font: 800 calc(22px * var(--text-scale, 1)) var(--ui-font); text-shadow: 0 2px 4px rgba(0,0,0,0.7); pointer-events: none; }
.cs-form { position: absolute; inset: 0; }
.cs-form { --in-h: max(38px, calc(46px / var(--stage-scale, 1))); }
.cs-form label { position: absolute; left: 92.5px; max-width: 290px; color: #fff; font: bold min(calc(26px * var(--text-scale, 1)), 30px)/1.2 Verdana, "DejaVu Sans", sans-serif; text-shadow: 0 2px 3px rgba(0, 30, 70, 0.45);
  top: 57px; transform: translateY(-50%); overflow-wrap: anywhere; }
.cs-form input { position: absolute; left: 396px; height: var(--in-h); top: calc(57px - var(--in-h) / 2); box-sizing: border-box; border: 2px solid #111; background: #fff; color: #000; padding: 0 8px;
  font: calc(24px * var(--text-scale, 1)) Verdana, "DejaVu Sans", sans-serif; border-radius: 3px; -webkit-user-select: text; user-select: text; touch-action: manipulation; }
.cs-form input:focus-visible, .cs-form input:focus { outline: 4px solid #ffd23f; outline-offset: 2px; }
.cs-privacy { position: absolute; left: 86px; top: 102px; width: 636px; min-height: 138px; margin: 0; padding: 12px 16px 12px 70px; box-sizing: border-box; color: #fff; background: #0b5f94; border: 2px solid rgba(255,255,255,0.55); border-radius: 12px;
  font: calc(15px * var(--text-scale, 1))/1.4 Verdana, "DejaVu Sans", sans-serif; display: flex; align-items: center; max-height: 164px; overflow: hidden; }
.cs-privacy svg { position: absolute; left: 18px; top: 50%; width: 36px; height: 36px; margin-top: -18px; }
.cs-quit { position: absolute; left: 8px; top: 8px; padding: 0; width: max(48px, calc(46px / var(--stage-scale, 1))); z-index: 5; display: grid; place-items: center; }
.cs-quit svg { width: 26px; height: 26px; }
.cs-submit { position: absolute; border: 0; background: transparent; color: #fff; cursor: pointer; border-radius: 14px;
  font: bold calc(26px * var(--text-scale, 1)) Verdana, "DejaVu Sans", sans-serif; text-shadow: 0 2px 2px rgba(0, 40, 90, 0.5); }
.cs-submit:focus-visible { outline: 4px solid #ffd23f; outline-offset: 3px; }
`;

audio.defineSynth('csChoose', (a, v) => {
  [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.16, vol: 0.1 * v, delay: i * 0.06 }));
  a.noise({ dur: 0.25, vol: 0.04 * v, freq: 7000, type: 'highpass', delay: 0.18 });
});

export function cutsceneScene(app) {
  let params = {}, text = ENGLISH_FALLBACK, phase = 'loading', ticks = 0, ready = false, destroyed = false;
  let studio = null, talkie = null, popNav = null, layer = null, hover = null, chosen = null, form = null, quitBtn = null;
  let nickname = '', submitState = 1, dim = 0, dimTarget = 0, musicOn = false, fade = 0, hintEl = null;
  const particles = new Particles(300);
  const reduced = () => !!settings.get('reducedMotion');
  const line = i => (text[i] != null && text[i] !== '' ? text[i] : ENGLISH_FALLBACK[i]);

  function say(lines, then) {
    studio.react('host', 'excited');
    talkie.show();
    talkie.say(lines, () => { if (!destroyed) then(); });
  }

  // --- 1. Host lines 0-2 --------------------------------------------------------------------
  function start() {
    phase = 'intro';
    // Touch has no Escape key: a small Main menu button, top left (inside the safe area).
    quitBtn = glossy('', () => askQuit(), { id: 'cutscene-quit', class: 'alt small cs-quit', 'aria-label': t('flow.cutscene.quitLabel'), title: t('flow.cutscene.quitLabel') });
    quitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5h4v5"/></svg>';
    app.ui.append(quitBtn);
    say([line(LINE.hello), line(LINE.soon), line(LINE.who)], chooseAvatar);
  }

  // The avatar hint names the controls of the device in use, and changes with it.
  const hintText = () => (input.lastDevice === 'touch' ? t('flow.cutscene.chooseHint')
    : input.lastDevice === 'gamepad' ? tp('flow.cutscene.chooseHintPad') : tp('flow.cutscene.chooseHintKeys'));
  const onDevice = () => { if (hintEl) hintEl.textContent = hintText(); };

  // --- 2. Avatar choice ---------------------------------------------------------------------
  function chooseAvatar() {
    phase = 'choose';
    studio.host.stopAt('stop');
    talkie.hide();
    dimTarget = 0.3;
    studio.names = { amy: 'Amy', harry: 'Harry' };
    studio.player = 'none';
    const kid = who => {
      const r = KID_RECTS[who];
      const b = el('button', { type: 'button', class: 'cs-kid', id: `choose-${who}`, 'aria-label': t('flow.cutscene.playAs', { name: avatarName(who) }),
        style: { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' } }, el('span', {}, avatarName(who)));
      // Hover and keyboard focus always point at the same child, so Enter picks the one that
      // is reacting (the original had only the hovered child react).
      b.addEventListener('pointerenter', () => {
        const other = document.getElementById(`choose-${who === 'amy' ? 'harry' : 'amy'}`);
        if (other && document.activeElement === other) b.focus({ preventScroll: true });
        setHover(who);
      });
      b.addEventListener('pointerleave', () => { if (document.activeElement !== b) setHover(null); });
      b.addEventListener('focus', () => setHover(who));
      b.addEventListener('blur', () => setHover(null));
      b.addEventListener('click', () => choose(who));
      return b;
    };
    hintEl = el('div', { class: 'cs-hint', id: 'cutscene-hint' }, hintText());
    layer = el('div', { class: 'fl-layer', id: 'cutscene-choose', role: 'group', 'aria-label': line(LINE.who) },
      hintEl, kid('amy'), kid('harry'));
    app.ui.append(layer);
    input.addEventListener('device', onDevice);
    popNav = pushNav(layer, { initial: input.lastDevice === 'touch' ? false : '#choose-amy', onBack: askQuit });
    app.announce(line(LINE.who));
  }

  function setHover(who) {
    if (phase !== 'choose' || hover === who) return;
    hover = who;
    for (const k of ['amy', 'harry']) {
      const b = document.getElementById(`choose-${k}`);
      if (b) b.classList.toggle('hot', k === who);
    }
    if (who) {
      studio.react(who, 'happy');
      studio.react(who === 'amy' ? 'harry' : 'amy', 'disappointed');
      audio.play('hover');
    } else {
      studio.react('amy', 'idle');
      studio.react('harry', 'idle');
    }
  }

  function choose(who) {
    if (phase !== 'choose') return;
    chosen = who;
    phase = 'chosen';
    if (popNav) { popNav(); popNav = null; }
    input.removeEventListener('device', onDevice);
    hintEl = null;
    layer.remove(); layer = null;
    studio.react(who, 'happy');
    studio.react(who === 'amy' ? 'harry' : 'amy', 'idle');
    studio.player = who;
    studio.cpu = who === 'amy' ? 'harry' : 'amy';
    studio.tagPop[who] = 1;
    dimTarget = 0;
    audio.play('csChoose');
    audio.play('gsApplause', { volume: 0.6 });
    haptic(30);
    const r = KID_RECTS[who];
    if (!reduced()) particles.emit(r.x + r.w / 2, r.y + 60, { count: 36, colors: ['#ffd23f', '#ffffff', '#ff6b81', '#5fd4ff'], shape: 'star', speed: 4, life: 45, size: 5, gravity: 0.08 });
    app.announce(t('flow.cutscene.chose', { name: avatarName(who) }));
    nickname = (app.flow.profile.nickname || '').trim() || avatarName(who);
    // Line 4: "Tell me a little about yourself:"
    say([line(LINE.tell)], showForm);
  }

  // --- 3. Details form ------------------------------------------------------------------------
  function showForm() {
    phase = 'form';
    talkie.hide();
    studio.host.stopAt('stop');
    const nick = el('input', { id: 'form-nickname', type: 'text', maxlength: '25', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done',
      'aria-describedby': 'form-privacy', style: { width: '314px' } });
    nick.value = nickname;
    const lock = el('span', {});
    lock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const submit = el('button', { type: 'submit', class: 'cs-submit', id: 'form-submit',
      style: { left: SUBMIT_AT.x + 'px', top: SUBMIT_AT.y + 'px', width: SUBMIT_AT.w + 'px', height: SUBMIT_AT.h + 'px' } }, t('flow.cutscene.submit'));
    for (const [ev, s] of [['pointerenter', 2], ['pointerleave', 1], ['pointerdown', 3], ['focus', 2], ['blur', 1]]) submit.addEventListener(ev, () => { submitState = s; });
    // The age and e-mail boxes baked into the form art sit under the privacy panel.
    form = el('form', { class: 'cs-form', id: 'cutscene-form', autocomplete: 'off', novalidate: true, 'aria-label': line(LINE.tell) },
      el('label', { for: 'form-nickname' }, line(LINE.nickname)),
      nick,
      el('p', { class: 'cs-privacy', id: 'form-privacy' }, lock.firstChild, t('flow.cutscene.privacy')),
      submit);
    form.addEventListener('submit', e => { e.preventDefault(); submitForm(); });
    app.ui.append(form);
    popNav = pushNav(form, { initial: false, onBack: askQuit });
    if (input.lastDevice !== 'touch') { nick.focus({ preventScroll: true }); nick.select(); }
    app.announce(`${line(LINE.tell)} ${line(LINE.nickname)}`);
  }

  function submitForm() {
    if (phase !== 'form') return;
    const nick = document.getElementById('form-nickname');
    // Keep printable characters only; an empty nickname falls back to the avatar's name.
    nickname = String(nick ? nick.value : '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 25);
    audio.play('tap');
    if (popNav) { popNav(); popNav = null; }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    form.remove(); form = null;
    closing();
  }

  // --- 4. Closing line ----------------------------------------------------------------------
  function closing() {
    phase = 'closing';
    const name = nickname || avatarName(chosen);
    const blind = !!settings.get('blindRounds');
    // Blind rounds on: the quiz comes next, so the live closing line fits (in every language),
    // and the blind half ends with "Step right this way ...". Off (default): the shrinking zone
    // comes next, so a new neutral line (decision 11.9 #14; English), then "Step right this way
    // ...", which precedes every shrink (NOTES 2.3 port flow; build B: splash, cutscene, "Step
    // right this way", shrink, platform round 1).
    const lines = blind ? [line(LINE.closingLive)] : [t('flow.cutscene.closing', { name }), t('gameshow.stepRightThisWay')];
    say(lines, () => {
      phase = 'done';
      if (quitBtn) { quitBtn.remove(); quitBtn = null; }
      if (typeof params.onComplete === 'function') params.onComplete({ avatar: chosen, nickname });
      else app.scenes.go('splash', {}, { style: 'fade' });
    });
  }

  let dialogOpen = false;
  async function askQuit() {
    if (phase === 'done' || dialogOpen) return;
    dialogOpen = true;
    const ok = await confirmDialog(app.ui, { title: t('flow.cutscene.quitTitle'), text: t('flow.cutscene.quitText'), yes: t('flow.cutscene.quitYes'), no: t('flow.ui.cancel') });
    dialogOpen = false;
    if (ok && !destroyed) app.flow.toSplash();
  }

  function startMusic() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC.gameshow || AREA_MUSIC.menu);
    audio.musicLevel(0.5);
  }

  const scene = {
    enter(p = {}) {
      params = p || {};
      ensureStyle();
      ensureStyle('cutscene-style', CSS);
      clearNav();
      app.touch.hide();
      registerGameshowSounds();
      studio = new Studio({ player: 'harry', playerName: '', cpuName: '' });
      studio.names = {};
      studio.start();
      studio.setScores(0, 0, { instant: true });
      talkie = createTalkie(app, { x: TALKIE_AT.x, y: TALKIE_AT.y, speaker: t('gameshow.host') });
      const artJob = loadAtlases(atlasSet('cutscene', ['gameshow-bg', 'gameshow-cast', 'cutscene']));
      const textJob = loadQuizText().then(q => { if (q && Array.isArray(q.intro)) text = q.intro; }).catch(() => {});
      Promise.all([artJob, textJob]).then(([ok]) => { ready = !!ok; if (!destroyed && phase === 'loading') { studio.start(); start(); } });
      window.__test && window.__test.register('cutscene', () => ({
        phase, ready, hover, chosen, nickname, hint: hintEl ? hintEl.textContent : null,
        talkie: talkie ? talkie.state() : null,
        studio: studio ? studio.state() : null,
      }));
    },
    exit() {
      destroyed = true;
      if (popNav) popNav();
      input.removeEventListener('device', onDevice);
      if (talkie) talkie.destroy();
      audio.stopMusic();
      window.__test && window.__test.unregister('cutscene');
    },
    update() {
      ticks++;
      startMusic();
      if (phase === 'loading') return;
      fade = Math.min(1, fade + 0.06);
      studio.update();
      if (!dialogOpen) talkie.update();
      tickNav();
      dim += (dimTarget - dim) * (reduced() ? 1 : 0.15);
      particles.update();
      if (!dialogOpen && (phase === 'intro' || phase === 'chosen' || phase === 'closing') && (input.pressed('back') || input.pressed('pause'))) askQuit();
    },
    render(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 450);
      if (phase === 'loading') return;
      if (phase === 'form') {
        if (!drawFrame(ctx, 'cut_details_form', 30)) { ctx.fillStyle = '#027ab3'; ctx.fillRect(0, 0, 800, 450); }
        if (!drawFrame(ctx, 'cut_submit_button', submitState, [1, 0, 0, 1, SUBMIT_AT.x, SUBMIT_AT.y])) {
          ctx.fillStyle = '#45b1f7'; ctx.fillRect(SUBMIT_AT.x, SUBMIT_AT.y, SUBMIT_AT.w, SUBMIT_AT.h);
        }
        return;
      }
      ctx.save();
      ctx.globalAlpha = fade;
      studio.draw(ctx, { reducedMotion: reduced() });
      if (dim > 0.01 && hasArt('gs_set')) {
        // The avatar choice darkens the room behind the contestants (capture 010): redraw the
        // children and podia over a dim layer, as the SWF's frame 20 layers them.
        ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(0, 0, 800, 450);
        studio.kids.harry.draw(ctx);
        studio.kids.amy.draw(ctx);
        drawFrame(ctx, 'gs_podia', 1);
        studio.drawPodiumBadge(ctx);
        for (const who of ['amy', 'harry']) studio.drawScore(ctx, who);
        for (const who of ['amy', 'harry']) studio.drawTag(ctx, who, reduced());
      }
      particles.draw(ctx);
      talkie.render(ctx);
      ctx.restore();
    },
  };
  return scene;
}
