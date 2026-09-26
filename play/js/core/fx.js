// Game-feel helpers: particles, screen shake, hit-stop, floating text and haptics.
// All cosmetic: they use fxRng so they never affect gameplay determinism.
import { fxRng } from './rng.js';
import { settings } from './settings.js';

export class Particles {
  constructor(max = 600) { this.items = []; this.max = max; }

  emit(x, y, { count = 10, speed = 3, spread = Math.PI * 2, angle = 0, life = 40, size = 5, colors = ['#fff'], gravity = 0.12, drag = 0.98, shape = 'circle', grow = 0, fade = true } = {}) {
    if (settings.get('reducedMotion')) count = Math.ceil(count / 3);
    for (let i = 0; i < count && this.items.length < this.max; i++) {
      const a = angle + (fxRng.next() - 0.5) * spread;
      const s = speed * (0.4 + fxRng.next() * 0.8);
      this.items.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + fxRng.next() * 0.6), age: 0, size: size * (0.6 + fxRng.next() * 0.8),
        color: colors[Math.floor(fxRng.next() * colors.length)], gravity, drag, shape, grow, fade,
      });
    }
  }

  update() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age++;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.size = Math.max(0, p.size + p.grow);
    }
  }

  draw(ctx, camX = 0, camY = 0) {
    for (const p of this.items) {
      const t = p.age / p.life;
      ctx.globalAlpha = p.fade ? 1 - t * t : 1;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      const x = p.x - camX, y = p.y - camY;
      if (p.shape === 'bubble') {
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= 0.6;
        ctx.beginPath(); ctx.arc(x - p.size * 0.35, y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === 'star') {
        drawStar(ctx, x, y, p.size, p.age * 0.2);
      } else if (p.shape === 'square') {
        ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.items.length = 0; }
}

function drawStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

export class Shake {
  constructor() { this.trauma = 0; this.x = 0; this.y = 0; }
  add(amount) {
    const scale = settings.get('reducedShake') ? 0.25 : 1;
    this.trauma = Math.min(1, this.trauma + amount * scale);
  }
  update() {
    const s = this.trauma * this.trauma;
    this.x = (fxRng.next() * 2 - 1) * 9 * s;
    this.y = (fxRng.next() * 2 - 1) * 7 * s;
    this.trauma = Math.max(0, this.trauma - 0.035);
  }
  clear() { this.trauma = 0; this.x = 0; this.y = 0; }
}

// Floating labels ("+7", "Snap!") that rise and fade.
export class Popups {
  constructor() { this.items = []; }
  add(text, x, y, { color = '#fff', size = 18, life = 50, stroke = '#2a1b4a' } = {}) {
    this.items.push({ text, x, y, color, size, life, age: 0, stroke });
  }
  update() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      if (++p.age >= p.life) this.items.splice(i, 1);
    }
  }
  draw(ctx, camX = 0, camY = 0, font = 'Baloo') {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.items) {
      const t = p.age / p.life;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15));
      ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      ctx.font = `800 ${Math.round(p.size * pop)}px ${font}, "Trebuchet MS", sans-serif`;
      const x = p.x - camX, y = p.y - camY - t * 34;
      ctx.lineWidth = 4; ctx.strokeStyle = p.stroke; ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.items.length = 0; }
}

export function haptic(pattern) {
  if (!settings.get('haptics') || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
