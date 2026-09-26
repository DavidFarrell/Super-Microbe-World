// Sprite / animation API keyed by Flash symbol name and frame label, with a clean debug
// fallback so the game is fully playable before (or without) any art.
//
// CONTRACT
// --------
//   await sprites.loadForLevel(level, avatar, onProgress)  // the level's atlas set plus one avatar
//   await sprites.load(baseUrl = 'data/atlas/')   // every atlas (tools); missing atlases are fine
//   sprites.drawSymbol(ctx, symbol, label, frameIndex, x, y, opts) -> 'atlas' | 'debug'
//   sprites.hasSymbol(symbol, label?) -> boolean   // true when atlas art exists (for that label)
//   sprites.defineBounds(symbol, { x, y, w, h })   // size hint for the debug fallback (tiles)
//
// symbol      Flash linkage name, e.g. 'lucy_icon', 'Yog_L_Tile', 'harry_upper', 'camera_flash'.
// label       Flash frame label, e.g. 'idle', 'walk', 'be_photographed'; null = none.
// frameIndex  frames elapsed since the label (0-based, 25 fps), as Clip.labelFrame reports. With
//             no label (or a label the symbol lacks) it counts from frame 1 and loops, which
//             suits one-frame symbols animated by nested clips (rendered as "ticks").
// x, y        the symbol's registration point in stage units (Flash _x / _y), camera applied.
// opts        { flipX = false, alpha = 1, scaleX = 1, scaleY = 1, pivotX, pivotY (scale centre in
//               stage units, default the registration point), tint = null (CSS colour),
//               tintAmount = 1, t = 0 (seconds, debug wobble), text = null (debug caption) }.
//               flipX mirrors about the registration point, like Flash _xscale = -100.
//
// ATLASES  (written by tools/build-atlas.cjs; see its header for the full format)
//   web/data/atlas/index.json  { format: "smw-atlas-index/1",
//                                atlases: { id: { json, images: [...] } }, symbols: { symbol: id } }
//   <id>.json                  { format: "smw-atlas/1", images: [...], symbols: { symbol: {
//                                  scale, frameCount, labels: { label: frame },
//                                  frames: [ [image, x, y, w, h, originX, originY] | null, ... ] } } }
//   frames[i] is Flash frame i + 1; originX/Y is the registration point from the rectangle's
//   top-left in atlas pixels; scale is atlas pixels per stage pixel. Rig symbols ("mode": "rig",
//   the level 2-11 microbes) store parts once and a pose per frame in rig.frames; a frame with a
//   pose draws the pose, others fall back to the image frames (label starts). A null frame falls back to
//   the nearest earlier drawn frame of the same label; with none, nothing is drawn. Symbols the
//   index does not list fall back to the debug shapes below, never to an error.
import { CLIPS } from './data/clips.js';

const DEBUG_STYLE = {
  // name prefix / exact -> [fill, stroke]
  lucy_icon: ['#8fe39a', '#2f7d3f'], steve_icon: ['#9ad8ff', '#2a6f99'], patty_icon: ['#d6b3ff', '#6b3fa0'],
  sandy_icon: ['#ffe28a', '#9a7a20'], slurm_icon: ['#ff8f8f', '#9b2c2c'], super_slurm_icon: ['#ff8f8f', '#9b2c2c'],
  slarg_icon: ['#ff9f6b', '#9b4a1c'], iggy_icon: ['#ff7fbf', '#9a2a66'], donna_icon: ['#c9a36b', '#6d4c1d'],
  super_colin_icon: ['#ff6f6f', '#7a1d1d'], superinfection_icon: ['#b04070', '#4a0f28'],
  milk_glass_icon: ['#f4f6ff', '#8a93b8'], portal_exit_icon: ['#7fd8ff', '#1f5f8a'],
  soap_pickup: ['#bfefff', '#3a8fb5'], white_pickup: ['#fff3f3', '#b56a6a'], antibiotic_pickup: ['#ffffff', '#c03030'],
  soap_projectile: ['#d7f6ff', '#3a8fb5'], white_projectile: ['#fff5f5', '#b56a6a'], camera_flash: ['#ffffff', '#ffe27a'],
};
const MICROBE_NAMES = {
  lucy_icon: 'Lucy', steve_icon: 'Steve', patty_icon: 'Patty', sandy_icon: 'Sandy', slurm_icon: 'Slurm',
  super_slurm_icon: 'Slurm', slarg_icon: 'Slarg', iggy_icon: 'Iggy', donna_icon: 'Donna', super_colin_icon: 'Colin',
  superinfection_icon: 'Superinfection',
};

class Sprites {
  constructor() {
    this.baseUrl = 'data/atlas/';
    this.index = null;
    this.indexLoading = null;
    this.atlasLoads = new Map(); // atlas id -> Promise<boolean> (memoised, so loads are additive)
    this.symbols = new Map();    // symbol -> { sym, images, atlas }
    this.bounds = new Map();     // debug size hints
    this._scratch = null;        // shared canvas for tinted draws
  }

  // Loads web/data/atlas/index.json once. Never throws: without it every symbol uses the debug
  // renderer.
  loadIndex(baseUrl = this.baseUrl) {
    if (this.indexLoading) return this.indexLoading;
    this.baseUrl = baseUrl;
    this.indexLoading = (async () => {
      try {
        const res = await fetch(baseUrl + 'index.json');
        if (!res.ok) return null;
        this.index = await res.json();
      } catch { this.index = null; }
      return this.index;
    })();
    return this.indexLoading;
  }

  // Loads one atlas (JSON plus WebP pages). Memoised per atlas; failures leave the debug fallback.
  loadAtlas(id) {
    if (this.atlasLoads.has(id)) return this.atlasLoads.get(id);
    const job = (async () => {
      const a = this.index && this.index.atlases && this.index.atlases[id];
      if (!a) return false;
      try {
        const file = typeof a === 'string' ? a : a.json;
        const res = await fetch(this.baseUrl + file);
        if (!res.ok) return false;
        const data = await res.json();
        const dir = this.baseUrl + file.slice(0, file.lastIndexOf('/') + 1);
        const images = await Promise.all((data.images || []).map(src => loadBitmap(dir + src)));
        for (const [name, sym] of Object.entries(data.symbols || {})) this.symbols.set(name, { sym, images, atlas: id });
        return true;
      } catch { return false; }
    })();
    this.atlasLoads.set(id, job);
    return job;
  }

  // The atlases a level needs: its named set in index.json ("level1" for alpha_level1) plus the
  // chosen avatar's set, plus the shared HUD and pickups. A level without a set of its own loads
  // every non-avatar atlas, so nothing that exists is left undrawn.
  atlasesFor(levelName, avatar = 'harry') {
    const idx = this.index;
    if (!idx) return [];
    const sets = idx.sets || {};
    const n = /(\d+)$/.exec(String(levelName || ''))?.[1];
    const ids = new Set();
    const own = n && sets['level' + n];
    if (own) own.forEach(id => ids.add(id));
    else for (const id of Object.keys(idx.atlases || {})) if (!/^player-/.test(id)) ids.add(id);
    for (const id of ['hud', 'entities']) if (idx.atlases && idx.atlases[id]) ids.add(id);
    (sets['player-' + avatar] || []).forEach(id => ids.add(id));
    return [...ids];
  }

  // Loads what a level needs, reporting progress in bytes (from index.json) as onProgress(0..1).
  async loadForLevel(levelName, avatar, onProgress = () => {}) {
    await this.loadIndex();
    const ids = this.atlasesFor(levelName, avatar);
    const size = id => (this.index.atlases[id] && this.index.atlases[id].bytes) || 1;
    const total = ids.reduce((n, id) => n + size(id), 0) || 1;
    let done = 0;
    onProgress(0);
    await Promise.all(ids.map(id => this.loadAtlas(id).then(() => { done += size(id); onProgress(done / total); })));
    return ids;
  }

  // Loads every atlas the index lists (tools and tests; the game loads per level).
  async load(baseUrl = 'data/atlas/') {
    const idx = await this.loadIndex(baseUrl);
    if (!idx) return false;
    await Promise.all(Object.keys(idx.atlases || {}).map(id => this.loadAtlas(id)));
    return true;
  }

  defineBounds(symbol, b) { this.bounds.set(symbol, b); }

  hasSymbol(symbol, label) {
    const e = this.symbols.get(symbol);
    if (!e) return false;
    return label == null || !e.sym.labels || label in e.sym.labels;
  }

  // Raw atlas record of a symbol (labels, scripts, tracks, frames) or null.
  symbol(symbol) {
    const e = this.symbols.get(symbol);
    return e ? e.sym : null;
  }

  drawSymbol(ctx, symbol, label, frameIndex, x, y, opts = {}) {
    const e = this.symbols.get(symbol);
    if (e) {
      const n = this._frameNumber(e.sym, label, Math.max(0, frameIndex | 0));
      const pose = n && e.sym.rig ? e.sym.rig.frames[n - 1] : null;
      if (pose != null) this._drawPose(ctx, e, pose, x, y, opts);
      else {
        const f = this._frame(e.sym, label, Math.max(0, frameIndex | 0));
        if (f) this._drawFrame(ctx, f, e.images, e.sym.scale || 1, x, y, opts);
      }
      return 'atlas';
    }
    drawDebugSymbol(ctx, symbol, label, frameIndex, x, y, opts, this.boundsOf(symbol));
    return 'debug';
  }

  // Draws Flash frame `frame` (1-based) of a symbol with its registration point at the current
  // transform's origin. For HUD parts placed through track matrices. Returns false when the frame
  // has no art. Rig symbols draw their pose for the frame.
  drawFrame(ctx, symbol, frame = 1, opts = {}) {
    const e = this.symbols.get(symbol);
    if (!e) return false;
    const pose = e.sym.rig ? e.sym.rig.frames[frame - 1] : null;
    if (pose != null) { this._drawPose(ctx, e, pose, 0, 0, opts); return true; }
    const fr = (e.sym.frames || [])[frame - 1];
    if (!fr) return false;
    this._drawFrame(ctx, fr, e.images, e.sym.scale || 1, 0, 0, opts);
    return true;
  }

  // The 1-based frame a label plus an offset resolves to (the same rule as _frame), or null.
  _frameNumber(sym, label, frameIndex) {
    const n = sym.frameCount || (sym.frames || []).length;
    if (!n) return null;
    const start = label != null && sym.labels && sym.labels[label] != null ? sym.labels[label] : null;
    return start != null ? Math.min(n, start + frameIndex) : (frameIndex % n) + 1;
  }

  // Cut-out rigs (web/NOTES-art-decisions.md section 2; tools/swf-sheet/atlas-draw.js): a pose
  // is a list of [part, a, b, c, d, tx, ty] and each part is an atlas rectangle
  // [image, x, y, w, h, originX, originY, partScale]. Flip, scale and pivot apply to the whole
  // pose, as for a frame. With alpha below 1 or a tint the pose is first composed on a scratch
  // canvas, so overlapping parts fade and tint as one picture (a microbe washing away does not
  // turn see-through part by part).
  _drawPose(ctx, e, p, x, y, { flipX = false, alpha = 1, scaleX = 1, scaleY = 1, pivotX = x, pivotY = y, tint = null, tintAmount = 1 } = {}) {
    const rig = e.sym.rig, pose = rig.poses[p];
    if (!pose || alpha <= 0) return;
    ctx.save();
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.translate(pivotX, pivotY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-pivotX, -pivotY);
    }
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    const composite = alpha < 1 || (tint && tintAmount > 0);
    if (!composite) {
      drawPoseParts(ctx, rig, pose, e.images);
    } else {
      const b = this._poseBounds(e.sym, p);
      const k = 2;   // scratch pixels per stage pixel (the atlases are drawn at 2x)
      const w = Math.max(1, Math.ceil(b.w * k)), h = Math.max(1, Math.ceil(b.h * k));
      const c = this._poseCanvas(w, h);
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, -b.x * k, -b.y * k);
      drawPoseParts(g, rig, pose, e.images);
      if (tint && tintAmount > 0) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = Math.min(1, tintAmount);
        g.fillStyle = tint;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
      ctx.globalAlpha *= alpha;
      ctx.drawImage(c, 0, 0, w, h, b.x, b.y, w / k, h / k);
    }
    ctx.restore();
  }

  // Bounds of a pose in the symbol's own units (cached per symbol and pose).
  _poseBounds(sym, p) {
    let cache = this._boundsCache || (this._boundsCache = new WeakMap());
    let m = cache.get(sym);
    if (!m) { m = new Map(); cache.set(sym, m); }
    let b = m.get(p);
    if (b) return b;
    const rig = sym.rig, pose = rig.poses[p];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pose.length; i += 7) {
      const [, , , w, h, ox, oy, s] = rig.parts[pose[i]];
      const k = 1 / s;
      const rx = -ox * k, ry = -oy * k, rw = w * k, rh = h * k;
      const [a, bb, c, d, tx, ty] = [pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]];
      for (const [px, py] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) {
        const X = a * px + c * py + tx, Y = bb * px + d * py + ty;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
    }
    b = isFinite(x0) ? { x: Math.floor(x0) - 1, y: Math.floor(y0) - 1, w: Math.ceil(x1 - x0) + 3, h: Math.ceil(y1 - y0) + 3 } : { x: 0, y: 0, w: 1, h: 1 };
    m.set(p, b);
    return b;
  }

  _poseCanvas(w, h) {
    let c = this._poseScratch;
    if (!c) c = this._poseScratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    return c;
  }

  boundsOf(symbol) {
    return this.bounds.get(symbol) || (CLIPS[symbol] && CLIPS[symbol].bounds) || { x: 0, y: 0, w: 50, h: 50 };
  }

  // Resolves label + frameIndex to a frame tuple (see the contract above).
  _frame(sym, label, frameIndex) {
    const frames = sym.frames || [];
    const n = sym.frameCount || frames.length;
    if (!n) return null;
    const start = label != null && sym.labels && sym.labels[label] != null ? sym.labels[label] : null;
    const f = start != null ? Math.min(n, start + frameIndex) : (frameIndex % n) + 1;
    const lo = start != null ? start : 1;
    for (let k = f; k >= lo; k--) if (frames[k - 1]) return frames[k - 1];
    return null;
  }

  // opts: flipX mirrors about the registration point; scaleX/scaleY scale about (pivotX, pivotY)
  // (stage units, default the registration point); tint = CSS colour washed over the art with
  // tintAmount (0..1), e.g. the white hit flash.
  _drawFrame(ctx, fr, images, scale, x, y, { flipX = false, alpha = 1, scaleX = 1, scaleY = 1, pivotX = x, pivotY = y, tint = null, tintAmount = 1 } = {}) {
    const [img, sx, sy, w, h, ox, oy] = fr;
    const page = images[img];
    if (!page || alpha <= 0) return;
    const k = 1 / scale;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.translate(pivotX, pivotY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-pivotX, -pivotY);
    }
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    if (tint && tintAmount > 0) {
      const c = this._tinted(page, sx, sy, w, h, tint, tintAmount);
      ctx.drawImage(c, 0, 0, w, h, -ox * k, -oy * k, w * k, h * k);
    } else {
      ctx.drawImage(page, sx, sy, w, h, -ox * k, -oy * k, w * k, h * k);
    }
    ctx.restore();
  }

  // Copies an atlas rectangle to the shared scratch canvas and washes it with a colour, keeping
  // the art's alpha (source-atop), at atlas resolution.
  _tinted(page, sx, sy, w, h, tint, amount) {
    let c = this._scratch;
    if (!c) {
      c = this._scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    }
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(page, sx, sy, w, h, 0, 0, w, h);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = Math.min(1, amount);
    g.fillStyle = tint;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return c;
  }
}

// Draws every part of a rig pose at the current origin (the symbol's registration point).
function drawPoseParts(ctx, rig, pose, images) {
  for (let i = 0; i < pose.length; i += 7) {
    const [img, x, y, w, h, ox, oy, s] = rig.parts[pose[i]];
    const page = images[img];
    if (!page) continue;
    const k = 1 / s;
    ctx.save();
    ctx.transform(pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]);
    ctx.drawImage(page, x, y, w, h, -ox * k, -oy * k, w * k, h * k);
    ctx.restore();
  }
}

async function loadBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

// ---------------------------------------------------------------------------------------------
// Debug shapes: readable coloured boxes and simple faces, sized from the Flash bounds.
// ---------------------------------------------------------------------------------------------
export function drawDebugSymbol(ctx, symbol, label, frameIndex, x, y, opts = {}, b = { x: 0, y: 0, w: 50, h: 50 }) {
  const { flipX = false, alpha = 1, scaleX = 1, scaleY = 1, t = 0, text = null } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale((flipX ? -1 : 1) * scaleX, scaleY);
  const style = DEBUG_STYLE[symbol];
  if (MICROBE_NAMES[symbol]) drawMicrobe(ctx, symbol, label, frameIndex, b, style, t);
  else if (symbol === 'portal_exit_icon') drawPortal(ctx, b, label, t);
  else if (symbol === 'milk_glass_icon') drawMilk(ctx, b, label, frameIndex);
  else if (symbol === 'camera_flash') drawFlash(ctx, b);
  else if (symbol === 'soap_projectile' || symbol === 'white_projectile') drawProjectile(ctx, symbol, label, frameIndex);
  else if (symbol === 'soap_pickup' || symbol === 'white_pickup' || symbol === 'antibiotic_pickup') drawPickup(ctx, symbol, b, t);
  else drawBox(ctx, b, style || tileStyle(symbol));
  ctx.restore();
  if (text) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = '700 11px Baloo, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const cx = flipX ? x - (b.x + b.w / 2) : x + b.x + b.w / 2;
    ctx.strokeText(text, cx, y + b.y - 6);
    ctx.fillText(text, cx, y + b.y - 6);
    ctx.restore();
  }
}

// Tile colours by name, so kitchen, skin and body levels read differently.
function tileStyle(symbol = '') {
  const s = symbol.toLowerCase();
  if (/yog|unit/.test(s)) return ['#e9e2d0', '#9c8f6c'];
  if (/cheese/.test(s)) return ['#ffd65c', '#b58a16'];
  if (/chip|chop|sausage/.test(s)) return ['#e0a060', '#8a5420'];
  if (/loaf|toast|bread/.test(s)) return ['#d9a36a', '#7a4c1e'];
  if (/pepper|salt/.test(s)) return ['#cfd3dc', '#6b7080'];
  if (/hair|wart|spot|scab|plaster|splinter|skin|pore/.test(s)) return ['#f2b8a0', '#a8604a'];
  if (/villi|flesh|bone|acid|platform|blood|vein|body|cell/.test(s)) return ['#e0707a', '#8a2a36'];
  return ['#b9c2d6', '#5a6480'];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBox(ctx, b, [fill, stroke]) {
  ctx.fillStyle = fill;
  roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 5);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 6);
  ctx.stroke();
}

function drawMicrobe(ctx, symbol, label, frameIndex, b, [fill, stroke], t) {
  const dying = label === 'be_killed' || label === 'be_washed_away' || label === 'dive';
  const hit = label === 'be_hit' || /^be_hit_/.test(label || '');
  const wob = Math.sin(t * 6 + b.w) * 2;
  ctx.fillStyle = hit ? '#ffffff' : fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  const bad = /slurm|slarg|iggy|donna|colin|superinfection/.test(symbol);
  roundRect(ctx, b.x + 2, b.y + 2 - wob * 0.5, b.w - 4, b.h - 4 + wob * 0.5, Math.min(b.w, b.h) * (bad ? 0.28 : 0.45));
  ctx.fill();
  ctx.stroke();
  if (bad) {
    // spikes
    ctx.fillStyle = stroke;
    for (let i = 0; i < 5; i++) {
      const sx = b.x + (b.w * (i + 0.5)) / 5;
      ctx.beginPath();
      ctx.moveTo(sx - 5, b.y + 4);
      ctx.lineTo(sx, b.y - 6 - wob);
      ctx.lineTo(sx + 5, b.y + 4);
      ctx.fill();
    }
  }
  // face (looks right; mirrored by flipX)
  const ex = b.x + b.w * 0.62, ey = b.y + Math.min(b.h * 0.3, 30);
  const er = Math.max(3, Math.min(b.w, b.h) * 0.08);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.arc(ex + er * 2.4, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1640';
  if (dying) {
    ctx.strokeStyle = '#1b1640'; ctx.lineWidth = 2;
    for (const cx of [ex, ex + er * 2.4]) {
      ctx.beginPath(); ctx.moveTo(cx - er * 0.7, ey - er * 0.7); ctx.lineTo(cx + er * 0.7, ey + er * 0.7);
      ctx.moveTo(cx + er * 0.7, ey - er * 0.7); ctx.lineTo(cx - er * 0.7, ey + er * 0.7); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(ex + er * 0.35, ey, er * 0.5, 0, Math.PI * 2); ctx.arc(ex + er * 2.75, ey, er * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#1b1640';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const my = ey + er * 2.2;
  if (bad) { ctx.moveTo(ex - er, my + er * 0.6); ctx.quadraticCurveTo(ex + er * 1.2, my - er * 0.6, ex + er * 3.4, my + er * 0.6); }
  else { ctx.moveTo(ex - er * 0.5, my); ctx.quadraticCurveTo(ex + er * 1.2, my + er * 1.4, ex + er * 3, my); }
  ctx.stroke();
  // walking feet
  if (label === 'walk') {
    const ph = Math.sin(frameIndex * 0.9);
    ctx.fillStyle = stroke;
    ctx.fillRect(b.x + b.w * 0.25 + ph * 3, b.y + b.h - 4, 8, 4);
    ctx.fillRect(b.x + b.w * 0.65 - ph * 3, b.y + b.h - 4, 8, 4);
  }
}

function drawPortal(ctx, b, label, t) {
  const open = label === 'open';
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.22;
    ctx.strokeStyle = open ? `hsla(${(t * 120 + i * 50) % 360}, 90%, 65%, 0.95)` : 'rgba(150,160,190,0.8)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, (b.w / 2 - 4) * k, (b.h / 2 - 4) * k, open ? t * (i % 2 ? -1 : 1) : 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = open ? 'rgba(160,240,255,0.35)' : 'rgba(40,40,70,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w / 2 - 10, b.h / 2 - 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = '800 14px Baloo, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = open ? '#fff' : 'rgba(255,255,255,0.7)';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', cx, cy + 5);
}

function drawMilk(ctx, b, label, frameIndex) {
  const yog = label === 'yogurt';
  const tickle = label === 'tickle';
  ctx.fillStyle = 'rgba(220,235,255,0.35)';
  ctx.strokeStyle = '#8a93b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x + 10, b.y + 10); ctx.lineTo(b.x + b.w - 10, b.y + 10);
  ctx.lineTo(b.x + b.w - 25, b.y + b.h - 5); ctx.lineTo(b.x + 25, b.y + b.h - 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = yog ? '#ffd0e0' : tickle && frameIndex % 4 < 2 ? '#fffbe0' : '#fafcff';
  ctx.beginPath();
  ctx.moveTo(b.x + 16, b.y + 40); ctx.lineTo(b.x + b.w - 16, b.y + 40);
  ctx.lineTo(b.x + b.w - 28, b.y + b.h - 9); ctx.lineTo(b.x + 28, b.y + b.h - 9); ctx.closePath();
  ctx.fill();
  ctx.font = '800 16px Baloo, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a6480';
  ctx.fillText(yog ? 'YOGURT' : 'MILK', b.x + b.w / 2, b.y + b.h / 2 + 10);
}

function drawFlash(ctx, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, b.w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,250,200,0.8)');
  g.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function drawProjectile(ctx, symbol, label, frameIndex) {
  const splat = label === 'splat';
  if (symbol === 'soap_projectile') {
    // soap bar in flight (the art is 50 x 16 at the registration point), splat = bubbles
    if (splat) {
      ctx.fillStyle = 'rgba(210,245,255,0.8)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(10 + i * 8, 8 - (frameIndex + i) % 5 * 3, 5, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    ctx.fillStyle = '#c9f0ff'; ctx.strokeStyle = '#3a8fb5'; ctx.lineWidth = 2;
    roundRect(ctx, 4, 2, 42, 14, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(10, 5, 16, 3);
  } else {
    ctx.fillStyle = splat ? 'rgba(255,230,230,0.6)' : '#fff5f5'; ctx.strokeStyle = '#b56a6a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(9, 10, splat ? 12 : 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d88'; ctx.beginPath(); ctx.arc(11, 8, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPickup(ctx, symbol, b, t) {
  const bob = Math.sin(t * 4) * 3;
  ctx.translate(0, bob);
  if (symbol === 'antibiotic_pickup') {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c03030'; ctx.lineWidth = 2;
    roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e04040'; roundRect(ctx, b.x + b.w / 2, b.y + 1, b.w / 2 - 1, b.h - 2, 8); ctx.fill();
    return;
  }
  const [fill, stroke] = DEBUG_STYLE[symbol];
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2.5;
  if (symbol === 'soap_pickup') {
    roundRect(ctx, b.x + 2, b.y + 10, b.w - 4, b.h - 14, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(b.x + 8 + i * 10, b.y + 6 - i * 2, 4, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 2 - 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d88'; ctx.beginPath(); ctx.arc(b.x + b.w / 2 + 3, b.y + b.h / 2 - 3, 6, 0, Math.PI * 2); ctx.fill();
  }
}

export const sprites = new Sprites();
export { MICROBE_NAMES };
