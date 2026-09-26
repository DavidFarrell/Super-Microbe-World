// Ending: the 2009 game stopped on one host line (GameShow.as:451-459): "Well done! You beat
// Amy. Thank you for playing. To play again, reload this web page." or, including a tie, "At
// the end of the game, I'm sorry to say you lost. ..." and the click did nothing (NOTES 2.1,
// 2.8 #5). The port keeps the host's line (without "reload this web page"), names the real
// opponent, makes a tie a draw with its own line (decision 11.9 #3), and adds a winner card:
// both contestants' quiz points, which alone decide the winner (#4), the hoverboard and kitchen
// points, and Play again / Level select / Main menu. Celebration: fanfare, applause, confetti.
// Params: { playerScore, cpuScore, hoverScore, kitchenScore, avatar, nickname }.
import { el } from '../ui/dom.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { Particles, haptic } from '../core/fx.js';
import { fxRng } from '../core/rng.js';
import { ease } from '../core/tween.js';
import { AREA_MUSIC } from '../core/music.js';
import { createTalkie } from '../gameshow/talkie.js';
import { Studio } from '../gameshow/studio.js';
import { loadAtlases, atlasSet } from '../gameshow/art.js';
import { drawLoading } from './art.js';
import { registerGameshowSounds } from '../gameshow/sound.js';
import { avatarName, otherAvatar } from './flow.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav } from './ui.js';

const CSS = `
.en-card { left: 22px; top: 20px; width: 410px; max-height: 410px; box-sizing: border-box; padding: 18px 22px 0; display: grid; gap: 10px; text-align: center; transform-origin: 50% 0;
  overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: thin; }
.en-card h2 { font-size: calc(38px * var(--text-scale, 1)); color: #7a2f99; }
.en-card.win h2 { color: #c2410c; }
.en-sub { font: 700 calc(15px * var(--text-scale, 1)) var(--body-font); opacity: 0.85; }
.en-table { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: 4px 8px; align-items: center; font: 700 calc(15px * var(--text-scale, 1)) var(--body-font); text-align: left; }
.en-table .h { font: 800 calc(16px * var(--text-scale, 1)) var(--ui-font); text-align: center; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.en-table .n { text-align: center; font: 800 calc(24px * var(--text-scale, 1))/1.1 var(--ui-font); color: #1b1640; }
.en-table .n.lead { color: #c2410c; }
.en-table .muted { opacity: 0.6; font-weight: 400; }
.en-table hr { grid-column: 1 / -1; width: 100%; border: 0; border-top: 2px dashed rgba(27,22,64,0.25); margin: 2px 0; }
.en-note { font: 400 calc(13px * var(--text-scale, 1))/1.3 var(--body-font); opacity: 0.8; }
/* The buttons stay in view at the card's foot whatever the text size (the card scrolls). */
.en-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; position: sticky; bottom: 0; z-index: 1;
  background: #fffdf6; padding: 8px 0 16px; box-shadow: 0 -8px 10px -8px rgba(27, 22, 64, 0.25); }
.en-buttons .wide { grid-column: 1 / span 2; }
`;

const CARD_WAKE = 24;   // ticks (0.36 s) before the card's buttons respond

export function endingScene(app) {
  let params = {}, ticks = 0, studio = null, talkie = null, ready = false, destroyed = false, popNav = null;
  let phase = 'loading', card = null, cardAge = 0, musicOn = false;
  const confetti = new Particles(500);
  const reduced = () => !!settings.get('reducedMotion');
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  let player, cpuAvatar, quiz, cpu, hover, kitchen, outcome, nick, cpuName;

  function hostLine() {
    if (outcome === 'win') return t('flow.ending.win', { cpu: cpuName });
    if (outcome === 'draw') return t('flow.ending.draw', { cpu: cpuName });
    return t('flow.ending.lose');
  }

  function react() {
    if (outcome === 'win') { studio.react('host', 'excited'); studio.react(player, 'happy'); studio.react(cpuAvatar, 'disappointed'); }
    else if (outcome === 'draw') { studio.react('host', 'excited'); studio.react(player, 'happy'); studio.react(cpuAvatar, 'happy'); }
    else { studio.react('host', 'serious'); studio.react(player, 'disappointed'); studio.react(cpuAvatar, 'happy'); }
  }

  function celebrate() {
    if (outcome === 'lose') { audio.play('gsApplause', { volume: 0.5 }); return; }
    audio.play('gsFanfare');
    audio.play('gsApplause');
    audio.play('cheer', { volume: 0.6 });
    haptic([40, 60, 40, 60, 80]);
  }

  function start() {
    phase = 'line';
    react();
    celebrate();
    talkie.say([hostLine()], showCard);
  }

  function showCard() {
    if (destroyed) return;
    phase = 'card';
    talkie.hide();
    const title = outcome === 'win' ? t('flow.ending.youWin') : outcome === 'draw' ? t('flow.ending.itsADraw') : t('flow.ending.cpuWins', { cpu: cpuName });
    const sub = outcome === 'win' ? t('flow.ending.winSub', { name: nick }) : outcome === 'draw' ? t('flow.ending.drawSub') : t('flow.ending.loseSub', { name: nick });
    const cell = (v, lead) => el('div', { class: 'n' + (lead ? ' lead' : '') }, String(v));
    const buttons = el('div', { class: 'en-buttons' },
      glossy(t('flow.ending.playAgain'), () => app.flow.newGame(), { id: 'ending-play-again', class: 'wide' }),
      glossy(t('flow.ending.levelSelect'), () => app.flow.openLevelSelect(), { id: 'ending-level-select', class: 'alt' }),
      glossy(t('flow.ending.menu'), () => app.flow.toSplash(), { id: 'ending-menu', class: 'alt' }));
    card = el('div', { class: `fl-card en-card ${outcome}`, id: 'ending-card', role: 'dialog', 'aria-labelledby': 'ending-title' },
      el('h2', { id: 'ending-title' }, title),
      el('div', { class: 'en-sub' }, sub),
      el('div', { class: 'en-table', role: 'table', 'aria-label': t('flow.ending.scores') },
        el('div', {}), el('div', { class: 'h', title: nick }, nick), el('div', { class: 'h', title: cpuName }, cpuName),
        el('div', {}, t('flow.ending.quizPoints')), cell(quiz, quiz > cpu), cell(cpu, cpu > quiz),
        el('hr', {}),
        el('div', {}, t('flow.ending.hoverPoints')), cell(hover, false), el('div', { class: 'n muted' }, '-'),
        el('div', {}, t('flow.ending.kitchenPoints')), cell(kitchen, false), el('div', { class: 'n muted' }, '-')),
      el('div', { class: 'en-note' }, t('flow.ending.note')),
      buttons);
    // The buttons wake up after a moment, so the taps and key presses that skipped through the
    // host's line cannot start a new game by accident.
    card.inert = true;
    app.ui.append(card);
    cardAge = 0;
    app.announce(`${title}. ${sub}. ${t('flow.ending.quizPoints')}: ${nick} ${quiz}, ${cpuName} ${cpu}. ${t('flow.ending.hoverPoints')}: ${hover}. ${t('flow.ending.kitchenPoints')}: ${kitchen}.`);
  }

  function startMusic() {
    if (musicOn || !audio.unlocked || !audio.ctx || audio.ctx.state !== 'running') return;
    musicOn = true;
    audio.playMusic(AREA_MUSIC.gameshow || AREA_MUSIC.menu);
    audio.musicLevel(0.55);
  }

  return {
    enter(p = {}) {
      params = p || {};
      ensureStyle();
      ensureStyle('ending-style', CSS);
      clearNav();
      app.touch.hide();
      registerGameshowSounds();
      player = params.avatar === 'amy' ? 'amy' : 'harry';
      cpuAvatar = otherAvatar(player);
      quiz = num(params.playerScore); cpu = num(params.cpuScore);
      hover = num(params.hoverScore); kitchen = num(params.kitchenScore);
      outcome = quiz > cpu ? 'win' : quiz === cpu ? 'draw' : 'lose';
      nick = String(params.nickname || '').trim() || avatarName(player);
      cpuName = avatarName(cpuAvatar);
      studio = new Studio({ player, playerName: nick, cpuName });
      studio.start();
      studio.setScores(quiz, cpu, { instant: true });
      talkie = createTalkie(app, { x: 20, y: 308, speaker: t('gameshow.host') });
      loadAtlases(atlasSet('gameshow', ['gameshow-bg', 'gameshow-cast'])).then(ok => { ready = !!ok; if (!destroyed) { studio.start(); studio.setScores(quiz, cpu, { instant: true }); start(); } });
      window.__test && window.__test.register('ending', () => ({
        outcome, phase, ready, playerScore: quiz, cpuScore: cpu, hoverScore: hover, kitchenScore: kitchen,
        line: talkie ? talkie.state().statement : '', card: !!card,
        title: card ? card.querySelector('h2').textContent : null,
        buttons: card && cardAge >= CARD_WAKE ? [...card.querySelectorAll('button')].map(b => b.id) : [],
      }));
    },
    exit() {
      destroyed = true;
      if (popNav) popNav();
      if (talkie) talkie.destroy();
      audio.stopMusic();
      window.__test && window.__test.unregister('ending');
    },
    update() {
      ticks++;
      startMusic();
      if (phase === 'loading') return;
      studio.update();
      talkie.update();
      tickNav();
      if (card) {
        cardAge++;
        if (cardAge === CARD_WAKE) {
          card.inert = false;
          popNav = pushNav(card, { initial: '#ending-play-again', onBack: () => app.flow.toSplash() });
        }
        const k = reduced() ? 1 : ease.outBack(Math.min(1, cardAge / 18));
        card.style.transform = `translateY(${(1 - k) * -30}px) scale(${0.9 + 0.1 * k})`;
        card.style.opacity = String(Math.min(1, cardAge / 8));
      }
      if (outcome !== 'lose' && !reduced() && ticks % 3 === 0 && ticks < 900) {
        confetti.emit(40 + fxRng.next() * 720, -10, { count: 2, colors: ['#ffd23f', '#ff6b81', '#5fd4ff', '#6fe0a8', '#b059d1', '#ffffff'], shape: fxRng.next() < 0.5 ? 'square' : 'star', speed: 1.4, angle: Math.PI / 2, spread: 0.9, life: 220, size: 5, gravity: 0.025, drag: 0.995, fade: false });
      }
      confetti.update();
    },
    render(ctx) {
      // Waiting for the studio's art: a small loading ring, not the studio's placeholder drawing.
      if (phase === 'loading') { drawLoading(ctx, ticks, '#000'); return; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 450);
      if (!studio) return;
      studio.draw(ctx, { reducedMotion: reduced() });
      // A warm spotlight on the winner's podium (both for a draw).
      if (phase !== 'loading' && outcome !== 'lose') {
        const spots = outcome === 'draw' ? ['amy', 'harry'] : [player];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const who of spots) {
          const c = who === 'amy' ? { x: 508, y: 210 } : { x: 648, y: 222 };
          const pulse = reduced() ? 0.8 : 0.7 + 0.3 * Math.sin(ticks / 12);
          const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 120);
          g.addColorStop(0, `rgba(255, 236, 150, ${0.35 * pulse})`);
          g.addColorStop(1, 'rgba(255, 236, 150, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(c.x - 130, c.y - 130, 260, 260);
        }
        ctx.restore();
      }
      confetti.draw(ctx);
      talkie.render(ctx);
      void ready;
    },
  };
}
