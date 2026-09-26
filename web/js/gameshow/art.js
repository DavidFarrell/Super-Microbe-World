// Game show art: access to the atlas symbols rendered from movies/eBugGameShow.swf (atlas sets
// 'gameshow' and 'cutscene' in web/data/atlas/index.json), cut-out rig drawing and a small clip
// player that runs a symbol's Flash timeline (labels and frame scripts) on the 25 fps frame clock.
//
// Every symbol of the studio is drawn at the identity transform: the render jobs placed the set,
// host, children and podia in the stage space of gameshow_set, exactly as the SWF lays them out
// (tools/swf-sheet/jobs/gameshow.json, tools/swf-sheet/compose.mjs 'studio').
//
// Rig symbols (gs_host, gs_harry, gs_amy) are drawn part by part as in
// tools/swf-sheet/atlas-draw.js (format in tools/build-atlas.cjs): rig.frames[f - 1] is a pose, a
// flat list [part, a, b, c, d, tx, ty, ...] drawn back to front.
import { sprites } from '../platformer/sprites.js';

export const FRAME_MS = 40;            // the SWF's 25 fps timeline
// Frame clock on the 15 ms engine tick: 3 frames every 8 ticks (NOTES 12.1).
export const frameOfTick = tick => Math.floor((tick * 3) / 8);

// Loads the named atlases (memoised by sprites.loadAtlas); resolves to true when all loaded.
// onProgress(0..1) is reported by atlas.
export async function loadAtlases(ids, onProgress = () => {}) {
  await sprites.loadIndex();
  const known = ids.filter(id => sprites.index && sprites.index.atlases && sprites.index.atlases[id]);
  let done = 0;
  onProgress(0);
  const ok = await Promise.all(known.map(id => sprites.loadAtlas(id).then(r => { onProgress(++done / Math.max(1, known.length)); return r; })));
  return ok.length === ids.length && ok.every(Boolean);
}

// The atlas set for a named set in index.json (falls back to the given list).
export function atlasSet(name, fallback) {
  const sets = sprites.index && sprites.index.sets;
  return (sets && sets[name]) || fallback;
}

// { sym, images } for a loaded symbol, or null.
export function entry(name) {
  return sprites.symbols.get(name) || null;
}

export const hasArt = name => !!entry(name);

// Per-frame matrix [a, b, c, d, tx, ty] of a named child recorded by the render job, or null.
export function track(name, key, frame = 1) {
  const e = entry(name);
  const tr = e && e.sym.tracks && e.sym.tracks[key];
  return (tr && (tr[frame - 1] || tr[0])) || null;
}

// Matrix product p * c (apply c, then p), both [a, b, c, d, tx, ty].
export const mul = (p, c) => [
  p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1],
  p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3],
  p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5],
];

function drawRect(ctx, images, r, scale) {
  const [img, x, y, w, h, ox, oy] = r;
  const page = images[img];
  if (!page) return;
  const k = 1 / scale;
  ctx.drawImage(page, x, y, w, h, -ox * k, -oy * k, w * k, h * k);
}

// Draws Flash frame `frame` (1-based) of a symbol with its registration point at the current
// origin (after an optional matrix m). Returns true when something was drawn.
export function drawFrame(ctx, name, frame = 1, m = null) {
  const e = entry(name);
  if (!e) return false;
  const { sym, images } = e;
  ctx.save();
  if (m) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  let drawn = false;
  const rig = sym.rig;
  const p = rig ? rig.frames[frame - 1] : null;
  if (p != null) {
    const pose = rig.poses[p];
    const base = ctx.getTransform();
    for (let i = 0; i < pose.length; i += 7) {
      const part = rig.parts[pose[i]];
      ctx.setTransform(base);
      ctx.transform(pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]);
      drawRect(ctx, images, part, part[7]);
    }
    drawn = true;
  } else {
    for (let f = Math.min(frame, sym.frames.length); f >= 1; f--) {
      const r = sym.frames[f - 1];
      if (r) { if (!blitCached(ctx, name, f, r, e)) drawRect(ctx, images, r, sym.scale || 1); drawn = true; break; }
    }
  }
  ctx.restore();
  return drawn;
}

// Draws one raw atlas rectangle of a symbol's frame (no rig), e.g. a talkie state.
export function drawStill(ctx, name, frame, x = 0, y = 0) {
  const e = entry(name);
  const r = e && e.sym.frames[frame - 1];
  if (!r) return false;
  ctx.save();
  ctx.translate(x, y);
  if (!blitCached(ctx, name, frame, r, e)) drawRect(ctx, e.images, r, e.sym.scale || 1);
  ctx.restore();
  return true;
}

// Large static frames (the set, the podia, the question board, the talkie) are drawn from a copy
// pre-scaled to the canvas resolution, so each frame is a 1:1 copy instead of a filtered
// downscale of a 2x atlas rectangle (about 7 ms each for the full-screen ones under software
// rendering). Used only when the transform is the stage transform plus a translation; any other
// transform (the board's zoom-in) draws from the atlas directly. One copy per symbol frame.
const blits = new Map();   // name|frame -> { key, canvas, fx, fy }
const MIN_BLIT_AREA = 150 * 150;

function blitCached(ctx, name, frame, r, e) {
  const m = ctx.getTransform();
  const base = ctx.canvas.width / 800;
  if (m.b !== 0 || m.c !== 0 || Math.abs(m.a - base) > 1e-6 || Math.abs(m.d - base) > 1e-6) return false;
  const [img, x, y, w, h, ox, oy] = r;
  const page = e.images[img];
  if (!page) return false;
  const k = 1 / (e.sym.scale || 1);
  if (w * k * h * k < MIN_BLIT_AREA) return false;
  // Device-space rectangle of the frame at this transform.
  const left = m.e + base * (-ox * k), top = m.f + base * (-oy * k);
  const id = name + '|' + frame;
  const key = base.toFixed(5);
  let c = blits.get(id);
  if (!c || c.key !== key) {
    const dw = Math.ceil(base * w * k) + 2, dh = Math.ceil(base * h * k) + 2;
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(dw, dh) : Object.assign(document.createElement('canvas'), { width: dw, height: dh });
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const fx = left - Math.floor(left), fy = top - Math.floor(top);
    g.drawImage(page, x, y, w, h, fx, fy, base * w * k, base * h * k);
    c = { key, canvas, fx, fy };
    blits.set(id, c);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c.canvas, Math.round(left - c.fx), Math.round(top - c.fy));
  ctx.restore();
  return true;
}

// Frees the pre-scaled copies (a scene that no longer shows the studio can call this).
export function releaseBlits() { blits.clear(); }
export const blitCount = () => blits.size;

// Does this label have any drawable pose or frame (a rig render may leave labels out)?
export function labelHasArt(name, label) {
  const e = entry(name);
  if (!e) return false;
  const { sym } = e;
  const start = sym.labels && sym.labels[label];
  if (!start) return false;
  const starts = Object.values(sym.labels).sort((a, b) => a - b);
  const end = (starts.find(s => s > start) || sym.frameCount + 1) - 1;
  for (let f = start; f <= end; f++) {
    if (sym.rig && sym.rig.frames[f - 1] != null) return true;
  }
  return !sym.rig && !!sym.frames[start - 1];
}

// A movie clip timeline: plays from a label and honours the frame scripts recorded in the atlas
// ('stop', 'gotoAndPlay', 'gotoAndStop', 'play'), one frame per 40 ms frame-clock step.
export class Clip {
  constructor(name, { fallbacks = {}, start = 1, playing = false } = {}) {
    this.name = name;
    this.fallbacks = fallbacks;   // label -> label used when the first has no art yet
    this.frame = start;
    this.playing = playing;
    this.label = null;            // last label requested (after fallback)
    this.requested = null;        // last label asked for
  }

  get sym() { const e = entry(this.name); return e ? e.sym : null; }

  resolve(label) {
    const sym = this.sym;
    if (!sym) return label;
    let l = label;
    for (let i = 0; i < 4 && !labelHasArt(this.name, l) && this.fallbacks[l]; i++) l = this.fallbacks[l];
    return l;
  }

  // Flash gotoAndPlay(label): jumps and runs that frame's scripts.
  play(label) {
    this.requested = label;
    const l = this.resolve(label);
    const sym = this.sym;
    this.label = l;
    if (!sym || !sym.labels || sym.labels[l] == null) return;
    this.frame = sym.labels[l];
    this.playing = true;
    this._scripts();
  }

  stopAt(label) {
    this.play(label);
    this.playing = false;
  }

  // One timeline frame (call once per frame-clock step).
  advance() {
    const sym = this.sym;
    if (!sym || !this.playing) return;
    this.frame = this.frame >= sym.frameCount ? 1 : this.frame + 1;
    this._scripts();
  }

  _scripts() {
    const sym = this.sym;
    const list = sym && sym.scripts && sym.scripts[this.frame];
    if (!list) return;
    for (const s of list) {
      if (s[0] === 'stop') this.playing = false;
      else if (s[0] === 'play') this.playing = true;
      else if ((s[0] === 'gotoAndPlay' || s[0] === 'gotoAndStop') && sym.labels) {
        const target = typeof s[1] === 'number' ? s[1] : sym.labels[s[1]];
        if (target != null) {
          this.frame = target;
          this.playing = s[0] === 'gotoAndPlay';
          // The label now showing (for probes): the one whose span holds the frame.
          let best = null;
          for (const [name, f] of Object.entries(sym.labels)) if (f <= target && (!best || f > sym.labels[best])) best = name;
          this.label = best;
          return;   // the target frame's own scripts only set flags here
        }
      }
    }
  }

  draw(ctx, m = null) { return drawFrame(ctx, this.name, this.frame, m); }
}
