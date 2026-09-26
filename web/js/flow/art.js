// Art for the flow screens (splash, cutscene, shrinking zone, summary, ending, level select).
// Loads atlas sets listed in web/data/atlas/index.json and draws "smw-atlas/1" symbols,
// including cut-out rigs (mode "rig": the game show cast and the shrinking avatars), which
// web/js/platformer/sprites.js does not draw. The drawing follows tools/swf-sheet/atlas-draw.js.
// Units are Flash stage pixels (800 x 450). Every call is safe while an atlas is missing: draw()
// returns false and scenes paint a placeholder, so the game never waits on art to be playable.
import { loadJson } from '../core/assets.js';
import { sprites } from '../platformer/sprites.js';

// Atlases are loaded through sprites.js (memoised per atlas id), so every area shares one copy
// of each sheet; this module only adds rig drawing, tracks and timelines on top.
const BASE = 'data/atlas/';
const symbols = sprites.symbols;   // symbol -> { sym, images, atlas }

// Loads one atlas by id. Resolves to true when its symbols are ready.
export async function loadAtlas(id) {
  await sprites.loadIndex(BASE);
  return sprites.loadAtlas(id);
}

// Loads every atlas of a named set ("splash", "cutscene", "shrink", "summary", ...).
export async function loadSet(name) {
  const index = await sprites.loadIndex(BASE);
  const ids = (index && index.sets && index.sets[name]) || [];
  const ok = await Promise.all(ids.map(id => sprites.loadAtlas(id)));
  return ok.length > 0 && ok.every(Boolean);
}

// Loads an atlas outside the shared cache and returns { draw, has, close } (for one-off use such
// as level-select thumbnails from a large sheet: the bitmaps are freed as soon as it is drawn).
export async function loadPrivate(id) {
  const index = await sprites.loadIndex(BASE);
  const a = index && index.atlases && index.atlases[id];
  if (!a) return null;
  try {
    const file = typeof a === 'string' ? a : a.json;
    const data = await loadJson(BASE + file);
    const dir = BASE + file.slice(0, file.lastIndexOf('/') + 1);
    const images = await Promise.all((data.images || []).map(async src => {
      const res = await fetch(dir + src);
      if (!res.ok) throw new Error(String(res.status));
      return createImageBitmap(await res.blob());
    }));
    const own = new Map(Object.entries(data.symbols || {}).map(([n, sym]) => [n, { sym, images, atlas: id }]));
    return {
      draw: (ctx, name, frame = 1, m = null, opts) => drawEntry(ctx, own.get(name), frame, m, opts),
      has: name => own.has(name),
      close: () => { for (const img of images) { try { img.close(); } catch { /* ignore */ } } own.clear(); },
    };
  } catch {
    return null;
  }
}

export const has = name => symbols.has(name);
export const symbol = name => (symbols.has(name) ? symbols.get(name).sym : null);

// 1-based frame number of a label plus an offset.
export function frameOf(name, label, offset = 0) {
  const s = symbol(name);
  const start = s && s.labels && s.labels[label];
  return (start || 1) + offset;
}

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
  if (page) ctx.drawImage(page, x, y, w, h, -ox * k, -oy * k, w * k, h * k);
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

// A Flash timeline driven by the atlas's labels and decoded frame scripts, advanced one 25 fps
// frame per tick() call (scenes call it when their frame clock moves on).
export class AtlasClip {
  constructor(name, label = null) {
    this.name = name;
    this.frame = 1;
    this.playing = true;
    this.vars = {};
    if (label) this.gotoAndPlay(label);
  }

  get sym() { return symbol(this.name); }
  get frameCount() { const s = this.sym; return s ? s.frameCount || s.frames.length : 1; }

  gotoAndPlay(label) { this._goto(label, true); }
  gotoAndStop(label) { this._goto(label, false); }

  _goto(label, play) {
    const s = this.sym;
    const f = typeof label === 'number' ? label : s && s.labels ? s.labels[label] : undefined;
    this.playing = play;
    this.label = typeof label === 'string' ? label : this.label;
    if (f == null) return;
    this.frame = f;
    this._run(f);
  }

  tick() {
    if (!this.playing) return;
    const n = this.frameCount;
    this.frame = this.frame >= n ? 1 : this.frame + 1;
    this._run(this.frame);
  }

  _run(frame) {
    const s = this.sym;
    const ops = s && s.scripts && s.scripts[frame];
    if (!ops) return;
    for (const op of ops) {
      if (op[0] === 'stop') this.playing = false;
      else if (op[0] === 'play') this.playing = true;
      else if (op[0] === 'set') this.vars[op[1]] = op[2];
      else if (op[0] === 'gotoAndPlay' || op[0] === 'gotoAndStop') {
        const f = typeof op[1] === 'number' ? op[1] : s.labels && s.labels[op[1]];
        if (f != null) { this.frame = f; this.playing = op[0] === 'gotoAndPlay'; }
      }
    }
  }

  draw(ctx, m = null, opts) { return draw(ctx, this.name, this.frame, m, opts); }
}

// Frame clock for scene timelines: the 2009 timelines ran at 25 fps (40 ms), the engine ticks
// every 15 ms, so frame = floor(ticks * 15 / 40) = floor(ticks * 3 / 8) (NOTES 12.1).
export const framesAt = ticks => Math.floor((ticks * 3) / 8);
