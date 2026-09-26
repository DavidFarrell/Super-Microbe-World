// Shrinking zone (ShrinkingZone.as; movies/shrinking_harry.swf, shrinking_amy.swf): the chosen
// child on the red and white target under the studio spotlights, zapped by the big shrink ray.
// The clip is 150 frames (frame 1 "start" sets midAnimation, frame 150 clears it), authored at
// 24 fps and played at the host's 25: 149 frames, about 6.0 s (NOTES 2.5). Frames advance on the
// 25 fps frame clock derived from the 15 ms ticks, so the length is exact and deterministic.
// Juice (render only): the ray charges, a flickering beam and sparkles while the child shrinks
// (frames 28-81 of the clip), a whoosh, a light shake and a pop of sparkles at the end.
// Tap, click, Enter or Space skips (the Unity remake cut the clip; the port lets the player).
import { el } from '../ui/dom.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { Particles, Shake, haptic } from '../core/fx.js';
import { fxRng } from '../core/rng.js';
import { tp } from '../ui/prompts.js';
import * as art from './art.js';
import { ensureStyle, clearNav } from './ui.js';

const LAST = 150;
const ZAP = [28, 82];                 // frames where the child shrinks (rig scale 0.22 -> 0.086)
const MUZZLE = { x: 521, y: 191 };    // the ray's red nozzle in gs_shrinking_zone
const KID_BIG = { x: 398, y: 268 };
const KID_SMALL = { x: 396, y: 322 };
export const SHRINK_FOCUS = KID_SMALL;

audio.defineSynth('charge', (a, v) => {
  a.tone({ type: 'sine', freq: 180, to: 760, dur: 1.0, vol: 0.06 * v });
  a.tone({ type: 'triangle', freq: 360, to: 1520, dur: 1.0, vol: 0.025 * v, delay: 0.05 });
});
audio.defineSynth('zapPop', (a, v) => {
  a.tone({ type: 'sine', freq: 1500, to: 2600, dur: 0.09, vol: 0.09 * v });
  a.noise({ dur: 0.12, vol: 0.06 * v, freq: 6000, type: 'highpass', delay: 0.02 });
});

export function shrinkScene(app) {
  let params = {}, ticks = 0, frame = 1, ready = false, done = false, holding = 0, waiting = 0;
  const particles = new Particles(400);
  const shake = new Shake();
  let reduced = false, hint = null, skipBtn = null;
  const avatar = () => (params.avatar === 'amy' ? 'amy' : 'harry');

  function finish() {
    if (done) return;
    done = true;
    const cb = params.onComplete;
    if (typeof cb === 'function') cb({ focus: SHRINK_FOCUS });
    else app.scenes.go('splash', {}, { style: 'fade' });
  }

  function skip() { if (!done) { audio.play('tap'); finish(); } }

  function onFrame(f) {
    if (f === 2) audio.play('charge');
    if (f === ZAP[0]) { audio.play('whoosh'); audio.play('shrink'); haptic(40); if (!reduced) shake.add(0.35); }
    if (!reduced && (f === 31 || f === 41 || f === 51 || f === 61 || f === 71)) shake.add(0.18);
    if (f === ZAP[1]) {
      audio.play('zapPop');
      haptic([20, 30, 20]);
      particles.emit(KID_SMALL.x, KID_SMALL.y, { count: 26, colors: ['#ffffff', '#ffe27a', '#ff6b6b', '#bff4ff'], shape: 'star', speed: 3.2, life: 40, size: 5, gravity: 0.03 });
    }
  }

  function kidPoint(f) {
    const k = Math.max(0, Math.min(1, (f - ZAP[0]) / (ZAP[1] - ZAP[0])));
    return { x: KID_BIG.x + (KID_SMALL.x - KID_BIG.x) * k, y: KID_BIG.y + (KID_SMALL.y - KID_BIG.y) * k };
  }

  function drawBeam(ctx, f) {
    if (f < ZAP[0] || f >= ZAP[1]) return;
    const kid = kidPoint(f);
    const flicker = reduced ? 0.7 : 0.55 + 0.45 * Math.abs(Math.sin(ticks * 0.9));
    const dx = kid.x - MUZZLE.x, dy = kid.y - MUZZLE.y, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const w0 = 7, w1 = 46;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[1, 0.35], [0.55, 0.55]]) {
      ctx.beginPath();
      ctx.moveTo(MUZZLE.x + nx * w0 * w, MUZZLE.y + ny * w0 * w);
      ctx.lineTo(kid.x + nx * w1 * w, kid.y + ny * w1 * w);
      ctx.lineTo(kid.x - nx * w1 * w, kid.y - ny * w1 * w);
      ctx.lineTo(MUZZLE.x - nx * w0 * w, MUZZLE.y - ny * w0 * w);
      ctx.closePath();
      const g = ctx.createLinearGradient(MUZZLE.x, MUZZLE.y, kid.x, kid.y);
      g.addColorStop(0, `rgba(255, 120, 120, ${a * flicker})`);
      g.addColorStop(0.6, `rgba(255, 230, 140, ${a * 0.8 * flicker})`);
      g.addColorStop(1, `rgba(190, 245, 255, ${a * 0.6 * flicker})`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCharge(ctx, f) {
    const k = f < ZAP[0] ? f / ZAP[0] : f < ZAP[1] - 6 ? 1 : Math.max(0, (ZAP[1] - f) / 6);
    if (k <= 0) return;
    const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(ticks * 0.5);
    const r = Math.max(1, 6 + 16 * k * pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(MUZZLE.x, MUZZLE.y, 1, MUZZLE.x, MUZZLE.y, r * 2.2);
    g.addColorStop(0, `rgba(255,255,230,${0.9 * k})`);
    g.addColorStop(0.4, `rgba(255,140,120,${0.6 * k})`);
    g.addColorStop(1, 'rgba(255,80,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(MUZZLE.x, MUZZLE.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlaceholder(ctx) {
    ctx.fillStyle = '#94bbdd'; ctx.fillRect(0, 0, 800, 330);
    ctx.fillStyle = '#424242'; ctx.fillRect(0, 330, 800, 120);
    ctx.fillStyle = '#ebeaeb'; ctx.beginPath(); ctx.ellipse(400, 355, 150, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eb403d'; ctx.beginPath(); ctx.ellipse(400, 345, 150, 34, 0, 0, Math.PI * 2); ctx.fill();
    const k = frame < ZAP[0] ? 1 : frame > ZAP[1] ? 0.39 : 1 - 0.61 * (frame - ZAP[0]) / (ZAP[1] - ZAP[0]);
    ctx.fillStyle = avatar() === 'amy' ? '#ff9a5c' : '#8a5a2b';
    ctx.fillRect(385, 345 - 180 * k, 30, 180 * k);
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.ellipse(620, 120, 90, 60, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  const scene = {
    enter(p = {}) {
      params = p || {};
      ensureStyle();
      clearNav();
      app.touch.hide();
      reduced = !!settings.get('reducedMotion');
      art.loadSet('shrink').then(ok => { ready = ok; });
      skipBtn = el('button', { type: 'button', class: 'sp-skip', id: 'shrink-skip', 'aria-label': t('flow.shrink.skipLabel'),
        style: { position: 'absolute', inset: '0', background: 'transparent', border: '0', cursor: 'pointer' } });
      skipBtn.addEventListener('click', skip);
      hint = el('div', { class: 'fl-prompt', style: { right: '14px', bottom: '12px', opacity: '0', transition: 'opacity 0.4s', background: 'rgba(20,14,50,0.72)', padding: '5px 14px', borderRadius: '999px' } }, '');
      app.ui.append(skipBtn, hint);
      app.announce(t('flow.shrink.announce'));
      window.__test && window.__test.register('shrink', () => ({ frame, ready, done, avatar: avatar(), round: params.round ?? null }));
    },
    exit() { window.__test && window.__test.unregister('shrink'); },
    update() {
      if (done) return;
      // The clip waits for its art (at most about 3 s, then the placeholder plays).
      if (!ready && ++waiting < 200) { if (input.pressed('confirm') || input.pressed('jump') || input.pressed('back')) skip(); return; }
      ticks++;
      const before = frame;
      frame = Math.min(LAST, 1 + art.framesAt(ticks));
      for (let f = before + 1; f <= frame; f++) onFrame(f);
      if (frame === 1 && ticks === 1) onFrame(1);
      // Charge particles drawn into the nozzle, then sparkles streaming down the beam.
      if (frame < ZAP[0] && ticks % (reduced ? 6 : 2) === 0) {
        const a = fxRng.next() * Math.PI * 2, d = 40 + fxRng.next() * 30;
        particles.emit(MUZZLE.x + Math.cos(a) * d, MUZZLE.y + Math.sin(a) * d, { count: 1, colors: ['#ffe27a', '#ffffff', '#ff9a9a'], speed: 1.6, angle: a + Math.PI, spread: 0.2, life: 18, size: 2.5, gravity: 0, drag: 1 });
      } else if (frame >= ZAP[0] && frame < ZAP[1] && ticks % (reduced ? 4 : 1) === 0) {
        const kid = kidPoint(frame), s = fxRng.next();
        particles.emit(MUZZLE.x + (kid.x - MUZZLE.x) * s, MUZZLE.y + (kid.y - MUZZLE.y) * s, { count: 1, colors: ['#ffffff', '#ffe27a', '#bff4ff'], shape: fxRng.next() < 0.3 ? 'star' : 'circle', speed: 0.8, life: 22, size: 3, gravity: 0.01 });
      }
      particles.update();
      shake.update();
      if (hint && ticks === 40) { hint.textContent = tp('flow.shrink.skip'); hint.style.opacity = '0.9'; }
      if (input.pressed('confirm') || input.pressed('jump') || input.pressed('back')) { skip(); return; }
      if (frame >= LAST && ++holding >= 4) finish();
    },
    render(ctx) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 450);
      ctx.save();
      ctx.translate(shake.x, shake.y);
      if (ready) {
        art.draw(ctx, 'gs_shrinking_zone', 1);
        drawCharge(ctx, frame);
        drawBeam(ctx, frame);
        art.draw(ctx, avatar() === 'amy' ? 'shrink_amy' : 'shrink_harry', frame);
      } else {
        drawPlaceholder(ctx);
      }
      particles.draw(ctx);
      ctx.restore();
    },
  };
  return scene;
}
