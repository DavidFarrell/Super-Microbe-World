// Canvas drawing helpers for the kitchen: food and scene art with clean placeholders when an atlas
// is missing, and the port's feedback marks (tick, cross, germs, hands, rings). Stage px.
import * as art from './art.js';
import { FOOD_SIZE, TYPE } from './rules.js';
import { BG_POS, COUNTER_POS, SINK_POS } from './layout.js';

const TYPE_COLOUR = {
  [TYPE.FRUIT]: ['#ffb347', '#b8641b'], [TYPE.VEGETABLES]: ['#7cc96b', '#3b7d2f'], [TYPE.CUPBOARD]: ['#e0b27a', '#8a5a2b'],
  [TYPE.CHEESE]: ['#ffe066', '#b08f10'], [TYPE.DOOR]: ['#eaf4ff', '#6b8fb8'], [TYPE.RAW_MEAT]: ['#f08a8a', '#9b3a3a'],
  [TYPE.COOKED_MEAT]: ['#b87a4b', '#6b3f1d'],
};

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const foodSize = asset => FOOD_SIZE[asset] || [50, 40];

// Draws a food item with its top-left at (x, y) scaled by s (food symbols are top-left
// registered), with its cling film overlay when wrapped.
export function drawFood(ctx, item, x, y, s = 1, { alpha = 1 } = {}) {
  const ok = art.draw(ctx, 'food_' + item.asset, 1, x, y, { scale: s, alpha });
  if (!ok) {
    const [w, h] = foodSize(item.asset);
    const [fill, stroke] = TYPE_COLOUR[item.type] || ['#ddd', '#777'];
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = item.mouldy || item.burst ? '#9aa36b' : fill;
    ctx.strokeStyle = stroke; ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, w * s - 2, h * s - 2, 8 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    ctx.font = `700 ${Math.max(7, Math.round(10 * s))}px Atkinson, Verdana, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(item.name, x + w * s / 2, y + h * s / 2, w * s - 4);
    ctx.restore();
  }
  if (item.clingfilm) {
    const cf = art.draw(ctx, 'food_clingfilm_' + item.asset, 1, x, y, { scale: s, alpha });
    if (!cf) {
      const [w, h] = foodSize(item.asset);
      ctx.save();
      ctx.globalAlpha *= alpha * 0.5;
      ctx.fillStyle = '#e8f6ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      roundRect(ctx, x, y, w * s, h * s, 8 * s); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

// The kitchen picture behind everything (kitchen_bg, registration at its centre).
export function drawBackground(ctx) {
  if (art.draw(ctx, 'kitchen_bg', 1, BG_POS.x, BG_POS.y)) return;
  ctx.fillStyle = '#FFF697'; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = '#fffbd8'; ctx.fillRect(0, 0, 800, 12);
  ctx.fillStyle = '#96DAB8'; ctx.fillRect(30, 22, 390, 102);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(254, 26, 76, 96);
  ctx.fillStyle = '#9ED3F0'; roundRect(ctx, 455, 42, 148, 330, 26); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(472, 64, 106, 198);
  ctx.strokeStyle = '#b8c4cc'; ctx.lineWidth = 2;
  for (const y of [117, 167, 211]) { ctx.beginPath(); ctx.moveTo(472, y); ctx.lineTo(578, y); ctx.stroke(); }
  ctx.fillStyle = '#86c3e8'; roundRect(ctx, 598, 44, 132, 248, 22); ctx.fill();
  ctx.fillStyle = '#f2f7fb'; ctx.fillRect(606, 64, 92, 212);
  ctx.fillStyle = '#6aa9d8'; ctx.beginPath(); ctx.ellipse(398, 196, 38, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a9d6ef'; ctx.fillRect(708, 300, 80, 150);
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(458, 372, 250, 78);
}

export function drawCounter(ctx) {
  if (art.draw(ctx, 'kitchen_counter', 1, COUNTER_POS.x, COUNTER_POS.y)) return;
  ctx.fillStyle = '#96DAB8'; ctx.fillRect(-10, 262, 470, 14);
  ctx.fillStyle = '#80BB9E'; ctx.fillRect(-10, 276, 470, 174);
  ctx.fillStyle = '#c69c6d'; ctx.fillRect(2, 166, 100, 80);
  ctx.fillStyle = '#e98fd0'; roundRect(ctx, 8, 228, 88, 38, 6); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(52, 224, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dff3ff'; roundRect(ctx, 210, 224, 56, 30, 6); ctx.fill();
}

export function drawSink(ctx, frame) {
  if (art.draw(ctx, 'kitchen_sink', frame, SINK_POS.x, SINK_POS.y)) return;
  ctx.fillStyle = '#d9dee3'; roundRect(ctx, 318, 236, 104, 22, 6); ctx.fill();
  ctx.fillStyle = '#8f9aa3'; ctx.fillRect(334, 186, 8, 56);
  ctx.fillStyle = '#44c2ea'; roundRect(ctx, 280, 222, 32, 38, 6); ctx.fill();
}

// A tick (ok) or cross mark popping in at (x, y); t runs 0..1 over its life.
export function drawMark(ctx, x, y, ok, t, reduced) {
  const pop = reduced ? 1 : t < 0.18 ? 0.4 + (t / 0.18) * 0.8 : t < 0.3 ? 1.2 - ((t - 0.18) / 0.12) * 0.2 : 1;
  const a = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  const r = 15 * pop;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y - (reduced ? 0 : t * 10));
  ctx.fillStyle = ok ? '#2fb86b' : '#e0475b';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 4 * pop;
  ctx.beginPath();
  if (ok) { ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.38); ctx.lineTo(r * 0.5, -r * 0.35); }
  else { ctx.moveTo(-r * 0.38, -r * 0.38); ctx.lineTo(r * 0.38, r * 0.38); ctx.moveTo(r * 0.38, -r * 0.38); ctx.lineTo(-r * 0.38, r * 0.38); }
  ctx.stroke();
  ctx.restore();
}

// Little microbes orbiting a contaminated item (green: sneeze, red: raw-meat hands).
export function drawGerms(ctx, cx, cy, radius, time, colour, n = 4, reduced = false) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = (reduced ? 0 : time * 1.6) + (i * Math.PI * 2) / n;
    const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a * 1.3) * radius * 0.6;
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 0.9, y - 0.9, 1, 0, Math.PI * 2); ctx.fill();
    // tiny spikes
    ctx.strokeStyle = colour; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const b = k * Math.PI / 2 + a;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(b) * 3, y + Math.sin(b) * 3); ctx.lineTo(x + Math.cos(b) * 5, y + Math.sin(b) * 5); ctx.stroke();
    }
  }
  ctx.restore();
}

// A cartoon hand (palm up) for the dirty-hands badge.
export function drawHand(ctx, x, y, s, fill = '#f6c8a8', stroke = '#9a5c3c') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath();
  roundRect(ctx, -9, -4, 18, 16, 6);
  ctx.fill(); ctx.stroke();
  const fingers = [[-8, -4, 4.2, 11], [-3.5, -4, 4.2, 13], [1, -4, 4.2, 12.5], [5.5, -4, 3.8, 10]];
  for (const [fx, fy, fw, fh] of fingers) { roundRect(ctx, fx, fy - fh + 3, fw, fh, 2); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(-11, 4, 3.4, 6.5, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// A speech bubble with text (canvas), pointing down-left to (tx, ty).
export function drawBubble(ctx, x, y, text, { font = '800 17px Baloo, "Trebuchet MS", sans-serif', fill = '#ffffff', ink = '#1b1640', tx = null, ty = null } = {}) {
  ctx.save();
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 22, h = 30;
  ctx.fillStyle = fill; ctx.strokeStyle = 'rgba(27,22,64,0.55)'; ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 14); ctx.fill(); ctx.stroke();
  if (tx != null) {
    ctx.beginPath(); ctx.moveTo(x - 8, y + h / 2 - 1); ctx.lineTo(tx, ty); ctx.lineTo(x + 6, y + h / 2 - 1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
  return w;
}

// A soft glowing outline around a target area.
export function drawGlow(ctx, r, { colour = '#5fd4ff', alpha = 1, width = 4, dash = null, fill = null, radius = 12 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (fill) { ctx.fillStyle = fill; roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.fill(); }
  ctx.strokeStyle = colour; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.shadowColor = colour; ctx.shadowBlur = 10;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.stroke();
  ctx.restore();
}
