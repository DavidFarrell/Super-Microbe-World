// Art for the flow screens (splash, cutscene, shrinking zone, summary, ending, level select).
// Loads atlas sets listed in web/data/atlas/index.json and draws "smw-atlas/1" symbols,
// including cut-out rigs (mode "rig": the game show cast and the shrinking avatars), which
// web/js/platformer/sprites.js does not draw. The drawing follows tools/swf-sheet/atlas-draw.js.
// Units are Flash stage pixels (800 x 450). Every call is safe while an atlas is missing: draw()
// returns false. Scenes wait for their set on a dark stage with drawLoading() and paint their
// placeholder only when a load failed (loadSet resolved false).
import { sprites, drawable } from '../platformer/sprites.js';

// Atlases are loaded through sprites.js (memoised per atlas id), so every area shares one copy
// of each sheet; this module only adds rig drawing, tracks and timelines on top.
const symbols = sprites.symbols;   // symbol -> { sym, images, atlas }

// Loads one atlas by id. Resolves to true when its symbols are ready.
export async function loadAtlas(id) {
  await sprites.ensureIndex();
  return sprites.loadAtlas(id);
}

// Loads every atlas of a named set ("splash", "cutscene", "shrink", "summary", ...). A failed
// atlas is not remembered (sprites.loadAtlas), so calling this again retries it.
export async function loadSet(name) {
  const index = await sprites.ensureIndex();
  const ids = (index && index.sets && index.sets[name]) || [];
  const ok = await Promise.all(ids.map(id => sprites.loadAtlas(id)));
  return ok.length > 0 && ok.every(Boolean);
}

// Loads an atlas outside the shared cache and returns { draw, has, symbol, close } (for one-off use such
// as level-select thumbnails from a large sheet: the bitmaps are freed as soon as it is drawn).
export async function loadPrivate(id) {
  try {
    const got = await sprites.loadPrivate(id);
    if (!got) return null;
    const { data, images } = got;
    const own = new Map(Object.entries(data.symbols || {}).map(([n, sym]) => [n, { sym, images, atlas: id }]));
    return {
      draw: (ctx, name, frame = 1, m = null, opts) => drawEntry(ctx, own.get(name), frame, m, opts),
      has: name => own.has(name),
      symbol: name => (own.has(name) ? own.get(name).sym : null),
      close: () => { for (const img of images) { try { img.close(); } catch { /* ignore */ } } own.clear(); },
    };
  } catch {
    return null;
  }
}

export const has = name => symbols.has(name);
export const symbol = name => (symbols.has(name) ? symbols.get(name).sym : null);

// Per-frame matrix of a named child recorded by the render job ([a, b, c, d, tx, ty] or null).
export function track(name, key, frame = 1) {
  const s = symbol(name);
  const t = s && s.tracks && s.tracks[key];
  return t ? t[Math.max(0, Math.min(t.length - 1, frame - 1))] : null;
}

export function alphaTrack(name, key, frame = 1) {
  const s = symbol(name);
  const t = s && s.alphas && s.alphas[key];
  return t ? t[Math.max(0, Math.min(t.length - 1, frame - 1))] : null;
}

export const multiply = (p, c) => [
  p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1],
  p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3],
  p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5],
];

function drawRect(ctx, images, r, scale) {
  const [img, x, y, w, h, ox, oy] = r, k = 1 / scale;
  const page = images[img];
  if (drawable(page)) ctx.drawImage(page, x, y, w, h, -ox * k, -oy * k, w * k, h * k);
}

// Draws Flash frame `frame` (1-based) of a symbol with its registration point at the current
// origin, transformed by matrix m ([a, b, c, d, tx, ty], stage px). Returns false when nothing
// could be drawn (atlas missing or frame empty).
export function draw(ctx, name, frame = 1, m = null, opts) {
  return drawEntry(ctx, symbols.get(name), frame, m, opts);
}

function drawEntry(ctx, e, frame, m, { alpha = 1 } = {}) {
  if (!e || alpha <= 0) return false;
  const { sym, images } = e;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  if (m) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  let drawn = false;
  const rig = sym.rig;
  const p = rig ? rig.frames[frame - 1] : null;
  if (p != null) {
    const pose = rig.poses[p];
    for (let i = 0; i < pose.length; i += 7) {
      const part = rig.parts[pose[i]];
      ctx.save();
      ctx.transform(pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]);
      drawRect(ctx, images, part, part[7]);
      ctx.restore();
    }
    drawn = true;
  } else {
    for (let f = Math.min(frame, sym.frames.length); f >= 1; f--) {
      const r = sym.frames[f - 1];
      if (r) { drawRect(ctx, images, r, sym.scale || 1); drawn = true; break; }
    }
  }
  ctx.restore();
  return drawn;
}

// Waiting for art: the studio's dark blue with a small spinning ring (after a short grace, so a
// load that is nearly done shows nothing at all).
export function drawLoading(ctx, age, colour = '#1b1640') {
  ctx.fillStyle = colour; ctx.fillRect(0, 0, 800, 450);
  if (age < 12) return;
  const a = Math.min(1, (age - 12) / 20);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(400, 225, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd23f';
  const r0 = age * 0.12;
  ctx.beginPath(); ctx.arc(400, 225, 22, r0, r0 + Math.PI * 0.6); ctx.stroke();
  ctx.restore();
}

// Frame clock for scene timelines: the 2009 timelines ran at 25 fps (40 ms), the engine ticks
// every 15 ms, so frame = floor(ticks * 15 / 40) = floor(ticks * 3 / 8) (NOTES 12.1).
export const framesAt = ticks => Math.floor((ticks * 3) / 8);
