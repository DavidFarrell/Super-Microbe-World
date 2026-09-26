// Packs sprite frames into WebP texture atlases plus JSON for the game (dev-only; the game only
// loads the output). Sources are the SWF sheets rendered by tools/swf-sheet (exact Flash art with
// registration points, labels and frame scripts) or, as a fallback, PNG frame sequences such as
// the Unity remake's exports. Pixels are handled in Node; only WebP encoding uses headless Chromium.
//
// Usage: node tools/build-atlas.cjs <manifest.json> [more.json ...]
//
// Manifest: either one atlas, or { "atlases": [ atlas, ... ], "index": "web/data/atlas/index.json",
// "sets": { "level1": ["atlas name", ...] } } to build several and write an index.
//   atlas: { "out": "web/data/atlas/<name>", "pageSize": 2048, "quality": 0.9, "padding": 2,
//            "png": false, "symbols": [ symbol, ... ] }
//   symbol from a sheet (tools/.cache/sheets/<swf>/<name>/meta.json, see tools/swf-sheet):
//     { "sheet": "introductionToMicrobes_platformer/lucy_icon", "name": "lucy_icon",
//       "frames": "1-30,40" (default all), "reachable": true (drop frames the timeline can never
//       show when driven by labels), "entryLabels": ["idle", ...] (as reachable, but only from
//       these labels, the ones the game code jumps to), "extrude": 2 (repeat edge pixels into the padding, for tiles
//       drawn edge to edge), "resample": 1 (resize factor applied to the sheet pixels) }
//   symbol from PNG files (fallback, e.g. Unity exports; the registration point is taken as the
//   top-left of the untrimmed image, so check alignment by eye):
//     { "name": "x", "files": ["Assets/.../a0001.png", ...], "scale": 0.5, "sourceScale": 1,
//       "labels": { "idle": 1 } }
//
// ------------------------------------------------------------------------------------------------
// Output <out>.json, format "smw-atlas/1":
// {
//   "format": "smw-atlas/1",
//   "images": ["<name>-0.webp", ...],          // atlas pages, relative to the JSON file
//   "symbols": {
//     "<name>": {
//       "source": "swf" | "png",
//       "swf": "movies/x.swf", "symbol": "lucy_icon", "charId": 774,   // swf sources only
//       "scale": 2,                 // atlas pixels per Flash pixel (the stage is 800x450 Flash px)
//       "frameCount": 255,          // frames[] has exactly this many entries
//       "labels": { "idle": 10 },   // Flash frame labels, 1-based frame numbers
//       "scripts": { "30": [["set", "midAnimation", false], ["gotoAndPlay", "idle"]] },
//                                   // decoded frame scripts: set, gotoAndPlay, gotoAndStop, stop,
//                                   // play, nextFrame, prevFrame, script (not decoded)
//       "tracks": { "screen": [[a, b, c, d, tx, ty] | null, ...] },   // optional, per frame, Flash px:
//                                   // matrix of a named child (hidden in the art) in symbol space;
//                                   // "group" is the rigid transform of the whole layout of frame
//                                   // "groupReference" onto each frame (the ePhone's grow/shrink)
//       "groupReference": 30,       // optional, see tracks.group
//       "mode": "ticks",            // optional: frames are ticks after placement of a one-frame
//                                   // symbol animated by nested clips (labels/scripts then empty)
//       "entryLabels": ["idle"],    // optional: frames were reduced to those reachable from these
//       "frames": [ [image, x, y, w, h, originX, originY] | null, ... ]
//     }
//   }
// }
// frames[i] is Flash frame i + 1. image indexes "images"; x, y, w, h is the rectangle in that
// page; originX, originY is the symbol's registration point measured from the rectangle's top-left
// (it may be negative or lie outside the rectangle). null means the frame draws nothing (it is
// empty, was not requested, or is unreachable). Identical frames share one rectangle.
//
// To draw frame f of a symbol with its registration point at Flash coordinates (px, py):
//   const [img, x, y, w, h, ox, oy] = sym.frames[f - 1]; const k = 1 / sym.scale;
//   ctx.drawImage(images[img], x, y, w, h, px - ox * k, py - oy * k, w * k, h * k);
// Mirroring (Flash _xscale = -100) is a scale(-1, 1) about the registration point.
// ------------------------------------------------------------------------------------------------
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SHEETS = path.join(ROOT, 'tools/.cache/sheets');

let png; // tools/swf-sheet/png.mjs, loaded dynamically (ES module)

// ---------------------------------------------------------------------------------------------
// Pixels

function trim(img) {
  const b = png.alphaBounds(img);
  if (!b) return null;
  return { img: png.crop(img, b.x, b.y, b.w, b.h), x: b.x, y: b.y };
}

// Resizes straight-alpha RGBA by factor r with an area filter (downscale) or bilinear (upscale),
// weighting colour by alpha so transparent pixels do not darken edges.
function resample(img, r) {
  if (r === 1) return img;
  const W = Math.max(1, Math.round(img.width * r)), H = Math.max(1, Math.round(img.height * r));
  const out = Buffer.alloc(W * H * 4), src = img.data, sw = img.width, sh = img.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let R = 0, G = 0, B = 0, A = 0, wsum = 0;
    const sx0 = x / r, sy0 = y / r, sx1 = (x + 1) / r, sy1 = (y + 1) / r;
    if (r < 1) {
      for (let sy = Math.floor(sy0); sy < Math.min(sh, Math.ceil(sy1)); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.min(sw, Math.ceil(sx1)); sx++) {
          const w = wy * (Math.min(sx + 1, sx1) - Math.max(sx, sx0)), o = (sy * sw + sx) * 4, a = src[o + 3] * w;
          R += src[o] * a; G += src[o + 1] * a; B += src[o + 2] * a; A += a; wsum += w;
        }
      }
    } else {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / r - 0.5)), fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / r - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      for (const [sx, sy, w] of [[x0, y0, (1 - fx + x0) * (1 - fy + y0)], [x1, y0, (fx - x0) * (1 - fy + y0)], [x0, y1, (1 - fx + x0) * (fy - y0)], [x1, y1, (fx - x0) * (fy - y0)]]) {
        const o = (sy * sw + sx) * 4, a = src[o + 3] * w;
        R += src[o] * a; G += src[o + 1] * a; B += src[o + 2] * a; A += a; wsum += w;
      }
    }
    const o = (y * W + x) * 4;
    if (A > 0) { out[o] = Math.round(R / A); out[o + 1] = Math.round(G / A); out[o + 2] = Math.round(B / A); }
    out[o + 3] = Math.round(A / wsum);
  }
  return { width: W, height: H, data: out };
}

// ---------------------------------------------------------------------------------------------
// Timeline reachability: frames a label-driven timeline can ever show.

// Starts from frame 1 and every label, or only the given entry labels (those the game code jumps
// to), and follows the playhead through the decoded frame scripts.
function reachableFrames(meta, entryLabels) {
  const n = meta.frameCount, seen = new Set();
  const labelFrame = t => (typeof t === 'number' ? t : meta.labels[t]);
  const starts = [1, ...(entryLabels || Object.keys(meta.labels)).map(l => {
    if (!meta.labels[l]) throw new Error(`${meta.name}: no label ${l}`);
    return meta.labels[l];
  })];
  for (const start of starts) {
    let f = start;
    const visited = new Set();
    // Follows the playhead from a label: scripts may jump or stop; undecoded scripts are
    // assumed to let it play on (conservative).
    while (f >= 1 && f <= n && !visited.has(f)) {
      visited.add(f); seen.add(f);
      let next = f + 1 > n ? 1 : f + 1, stop = false;
      for (const op of (meta.scripts || {})[f] || []) {
        if (op[0] === 'stop') stop = true;
        // A goto to the current frame is a no-op, so gotoAndPlay(self) just plays on.
        else if (op[0] === 'gotoAndPlay' && labelFrame(op[1])) { next = labelFrame(op[1]) === f ? (f + 1 > n ? 1 : f + 1) : labelFrame(op[1]); stop = false; }
        else if (op[0] === 'gotoAndStop' && labelFrame(op[1])) { seen.add(labelFrame(op[1])); stop = true; }
      }
      if (stop) break;
      f = next;
    }
  }
  return seen;
}

function parseFrameSpec(spec, n) {
  if (!spec || spec === 'all') return null;
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let f = a; f <= (b || a); f++) if (f >= 1 && f <= n) out.add(f);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Loading symbols into { name, info, frames: [ { img, originX, originY } | null ] }

function loadSheetSymbol(s) {
  const dir = path.join(SHEETS, s.sheet);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const r = s.resample ?? 1;
  const want = parseFrameSpec(s.frames, meta.frameCount);
  const reach = s.reachable || s.entryLabels ? reachableFrames(meta, s.entryLabels) : null;
  const cache = new Map();
  const frames = meta.frames.map((f, i) => {
    if (!f.file || (want && !want.has(i + 1)) || (reach && !reach.has(i + 1))) return null;
    if (!cache.has(f.file)) {
      const img = resample(png.decodePng(fs.readFileSync(path.join(dir, f.file))), r);
      cache.set(f.file, img);
    }
    return { img: cache.get(f.file), originX: +(f.originX * r).toFixed(2), originY: +(f.originY * r).toFixed(2) };
  });
  const info = { source: 'swf', swf: meta.swf, symbol: meta.symbol, charId: meta.charId, scale: +(meta.scale * r).toFixed(4), frameCount: meta.frameCount, labels: meta.labels, scripts: meta.scripts };
  if (meta.tracks) info.tracks = meta.tracks;
  if (meta.groupReference) info.groupReference = meta.groupReference;
  if (meta.mode === 'ticks') info.mode = 'ticks';
  if (s.entryLabels) info.entryLabels = s.entryLabels;
  return { name: s.name || meta.name, info, frames, extrude: s.extrude || 0 };
}

function loadPngSymbol(s) {
  const r = s.scale ?? 1;
  const frames = s.files.map(file => {
    const t = trim(png.decodePng(fs.readFileSync(path.join(ROOT, file))));
    if (!t) return null;
    const img = resample(t.img, r);
    return { img, originX: +(-t.x * r).toFixed(2), originY: +(-t.y * r).toFixed(2) };
  });
  const info = { source: 'png', files: s.files.length, scale: +((s.sourceScale ?? 1) * r).toFixed(4), frameCount: frames.length, labels: s.labels || {}, scripts: {} };
  return { name: s.name, info, frames, extrude: s.extrude || 0 };
}

// ---------------------------------------------------------------------------------------------
// MaxRects packing (best short side fit).

class MaxRects {
  constructor(w, h) { this.w = w; this.h = h; this.free = [{ x: 0, y: 0, w, h }]; this.usedW = 0; this.usedH = 0; }
  insert(w, h) {
    let best = null, bestShort = Infinity, bestLong = Infinity;
    for (const f of this.free) {
      if (w <= f.w && h <= f.h) {
        const short = Math.min(f.w - w, f.h - h), long = Math.max(f.w - w, f.h - h);
        if (short < bestShort || (short === bestShort && long < bestLong)) { best = { x: f.x, y: f.y, w, h }; bestShort = short; bestLong = long; }
      }
    }
    if (!best) return null;
    const next = [];
    for (const f of this.free) {
      if (best.x >= f.x + f.w || best.x + best.w <= f.x || best.y >= f.y + f.h || best.y + best.h <= f.y) { next.push(f); continue; }
      if (best.x > f.x) next.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
      if (best.x + best.w < f.x + f.w) next.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
      if (best.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
      if (best.y + best.h < f.y + f.h) next.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
    }
    this.free = next.filter((a, i) => !next.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h)));
    this.usedW = Math.max(this.usedW, best.x + w); this.usedH = Math.max(this.usedH, best.y + h);
    return best;
  }
}

// Copies img into page at (x, y) and repeats its edge pixels outward by `extrude` pixels.
function blit(page, img, x, y, extrude) {
  for (let row = -extrude; row < img.height + extrude; row++) {
    const sy = Math.min(img.height - 1, Math.max(0, row));
    for (let col = -extrude; col < img.width + extrude; col++) {
      const sx = Math.min(img.width - 1, Math.max(0, col));
      const X = x + col, Y = y + row;
      if (X < 0 || Y < 0 || X >= page.width || Y >= page.height) continue;
      img.data.copy(page.data, (Y * page.width + X) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
    }
  }
}

// ---------------------------------------------------------------------------------------------

async function buildAtlas(m, encoder) {
  const pageSize = m.pageSize || 2048, padding = m.padding ?? 2, quality = m.quality ?? 0.9;
  const symbols = m.symbols.map(s => (s.sheet ? loadSheetSymbol(s) : loadPngSymbol(s)));

  // Distinct images across all symbols (held poses and shared frames are stored once).
  const unique = new Map();
  for (const s of symbols) for (const f of s.frames) {
    if (!f) continue;
    const key = crypto.createHash('sha1').update(`${f.img.width}x${f.img.height}:${s.extrude}`).update(f.img.data).digest('hex');
    if (!unique.has(key)) unique.set(key, { img: f.img, extrude: s.extrude });
    f.key = key;
  }
  const items = [...unique.values()].sort((a, b) => b.img.height - a.img.height || b.img.width - a.img.width);
  const padOf = it => Math.max(padding, it.extrude);
  // Packs every item, opening pages of w x h as needed; returns the pages or null if an item
  // cannot fit at all.
  const pack = (w, h, maxPages) => {
    const pages = [];
    for (const it of items) {
      const pw = it.img.width + padOf(it) * 2, ph = it.img.height + padOf(it) * 2;
      if (pw > w || ph > h) return null;
      let placed = null, pi = 0;
      for (; pi < pages.length && !placed; pi++) placed = pages[pi].insert(pw, ph);
      if (!placed) {
        if (pages.length >= maxPages) return null;
        pages.push(new MaxRects(w, h)); pi = pages.length; placed = pages[pi - 1].insert(pw, ph);
      }
      it.page = pi - 1; it.x = placed.x + padOf(it); it.y = placed.y + padOf(it);
    }
    return pages;
  };
  // Smallest single page that holds everything (keeps pages dense), else several full pages.
  const sizes = [256, 512, 1024, 1536, 2048].filter(v => v <= pageSize);
  const candidates = sizes.flatMap(w => sizes.map(h => [w, h])).sort((a, b) => a[0] * a[1] - b[0] * b[1] || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]));
  let pages = null;
  for (const [w, h] of candidates) if ((pages = pack(w, h, 1))) break;
  if (!pages) pages = pack(pageSize, pageSize, Infinity);
  if (!pages) throw new Error(`An image does not fit a ${pageSize} page`);

  const outBase = path.join(ROOT, m.out), baseName = path.basename(outBase);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  for (const f of fs.readdirSync(path.dirname(outBase))) if (new RegExp(`^${baseName}-\\d+\\.(webp|png)$`).test(f)) fs.unlinkSync(path.join(path.dirname(outBase), f));
  const images = [];
  let bytes = 0;
  for (let p = 0; p < pages.length; p++) {
    const W = Math.ceil(pages[p].usedW / 4) * 4, H = Math.ceil(pages[p].usedH / 4) * 4;
    const page = { width: W, height: H, data: Buffer.alloc(W * H * 4) };
    for (const it of items) if (it.page === p) blit(page, it.img, it.x, it.y, it.extrude);
    const pngBuf = png.encodePng(page);
    const webp = await encoder(pngBuf, quality);
    const file = `${baseName}-${p}.webp`;
    fs.writeFileSync(path.join(path.dirname(outBase), file), webp);
    if (m.png) fs.writeFileSync(path.join(path.dirname(outBase), `${baseName}-${p}.png`), pngBuf);
    images.push(file);
    bytes += webp.length;
  }

  const json = { format: 'smw-atlas/1', images, symbols: {} };
  for (const s of symbols) {
    json.symbols[s.name] = {
      ...s.info,
      frames: s.frames.map(f => {
        if (!f) return null;
        const it = unique.get(f.key);
        return [it.page, it.x, it.y, it.img.width, it.img.height, f.originX, f.originY];
      }),
    };
  }
  fs.writeFileSync(outBase + '.json', JSON.stringify(json));
  const frameCount = symbols.reduce((n, s) => n + s.frames.filter(Boolean).length, 0);
  const area = items.reduce((a, it) => a + it.img.width * it.img.height, 0);
  console.log(`${m.out}: ${symbols.length} symbols, ${frameCount} frames (${items.length} distinct), ${pages.length} page(s) ${images.map((_, p) => `${Math.ceil(pages[p].usedW / 4) * 4}x${Math.ceil(pages[p].usedH / 4) * 4}`).join(', ')}, fill ${(100 * area / pages.reduce((a, pg) => a + pg.usedW * pg.usedH, 0)).toFixed(0)}%, WebP ${(bytes / 1024).toFixed(0)} KB`);
  return { name: baseName, json: baseName + '.json', images, bytes, pixels: pages.reduce((a, pg) => a + Math.ceil(pg.usedW / 4) * 4 * Math.ceil(pg.usedH / 4) * 4, 0), symbols: symbols.map(s => s.name) };
}

async function main() {
  png = await import('./swf-sheet/png.mjs');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Encodes a PNG as WebP with Chromium's encoder (lossy colour, alpha kept).
  const encoder = async (pngBuf, quality) => {
    const b64 = await page.evaluate(async ({ data, quality }) => {
      const blob = await (await fetch('data:image/png;base64,' + data)).blob();
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'default', colorSpaceConversion: 'none' });
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0);
      const out = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality })).arrayBuffer());
      let bin = '';
      for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
      return btoa(bin);
    }, { data: pngBuf.toString('base64'), quality });
    return Buffer.from(b64, 'base64');
  };
  try {
    for (const file of process.argv.slice(2)) {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!cfg.atlases) { await buildAtlas(cfg, encoder); continue; }
      const built = [];
      for (const a of cfg.atlases) built.push(await buildAtlas({ ...cfg.defaults, ...a }, encoder));
      if (cfg.index) writeIndex(cfg, built);
    }
  } finally {
    await browser.close();
  }
}

// index.json: { format, atlases: { name: { json, images, bytes, pixels, symbols } },
//   symbols: { symbol: atlas name }, sets: { set name: [atlas names] }, totalBytes }
function writeIndex(cfg, built) {
  const file = path.join(ROOT, cfg.index);
  let index = { format: 'smw-atlas-index/1', atlases: {}, symbols: {}, sets: {} };
  if (fs.existsSync(file)) { try { index = { ...index, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* rebuilt below */ } }
  for (const b of built) {
    index.atlases[b.name] = { json: b.json, images: b.images, bytes: b.bytes, pixels: b.pixels, symbols: b.symbols };
  }
  index.symbols = {};
  for (const [name, a] of Object.entries(index.atlases)) for (const s of a.symbols) index.symbols[s] = name;
  Object.assign(index.sets, cfg.sets || {});
  index.totalBytes = Object.values(index.atlases).reduce((n, a) => n + a.bytes, 0);
  fs.writeFileSync(file, JSON.stringify(index, null, 1));
  for (const [set, names] of Object.entries(index.sets)) {
    const bytes = names.reduce((n, a) => n + (index.atlases[a]?.bytes || 0), 0);
    const px = names.reduce((n, a) => n + (index.atlases[a]?.pixels || 0), 0);
    console.log(`set ${set}: ${(bytes / 1024).toFixed(0)} KB WebP, ${(px * 4 / 1048576).toFixed(0)} MB decoded`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
