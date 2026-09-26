#!/usr/bin/env node
// Renders animation frames of symbols straight from the original SWFs, through Ruffle, into
// per-frame PNGs with exact registration points (dev-only; see README.md in this folder).
//
//   node tools/swf-sheet/sheet.mjs <jobs.json> [--only a,b] [--force]
//   node tools/swf-sheet/sheet.mjs --swf movies/amy.swf --symbol root:lower [--name amy_lower]
//        [--scale 2] [--frames 1-50,60] [--omit-text] [--hide bigScreen,screen] [--force]
//
// Jobs file: { "scale": 2, "jobs": [ { "swf": "movies/x.swf", "symbol": "lucy_icon" |
//   1495 | "root:<instance>", "name": "out name", "scale": 2, "frames": "1-10,20",
//   "omitText": false, "hide": ["instanceName"], "track": ["instanceName"], "ticks": 30,
//   "margin": 4, "pageMax": 4096, "nested": "age" | "frame" } ] }. "nested" picks how nested clips
// advance (see Snapshotter in timeline.mjs): "age" (default) is Flash's behaviour; "frame" is the
// original model, pinned in jobs/level1.json so a forced rebuild reproduces the shipped sheets. SWF paths are relative to
// reference/Junior_Game. A symbol is an export name, a character id, or an instance on the
// root timeline's first frame (its root placement matrix is applied, so it shares the movie's
// registration point, as the avatar halves in harry.swf and amy.swf need).
//
// Output: tools/.cache/sheets/<swf base name>/<name>/ with fNNN.png per distinct frame image,
// meta.json and preview.png. meta.json:
//   { symbol, name, swf, charId, scale, frameCount, labels: { label: frame },
//     scripts: { frame: [op, ...] }, placement, frames: [ { file, originX, originY, w, h } ] }
// frames[i] is frame i + 1. originX/originY is the symbol's registration point measured from the
// top-left of that frame's trimmed image, in output pixels (Flash px * scale). Frames that draw
// nothing have file null and w = h = 0. Identical frames share one file.
//
// "ticks": N renders the symbol's frame 1 (or "atFrame") as it looks 0..N-1 ticks after being
// placed, for one-frame symbols animated by nested clips; meta.frames then holds N entries.
// "track" records, per frame, the matrix of direct child instances with those names (for example
// the ePhone's "screen", hidden with "hide" and drawn by the engine) as
// meta.tracks[name][i] = [a, b, c, d, tx, ty] in the symbol's space (Flash px), or null.
// "erase": [{ "shape": 248, "rect": [x0, y0, x1, y1] }] removes every outline of that shape lying
// entirely inside the rectangle (Flash px, shape space) for this render only, e.g. a logo.
// "groupTrack": R records meta.tracks.group[i], the single affine transform that maps the layout
// of frame R onto frame i + 1 when every child moved together (null when they did not). The
// ePhone's grow and shrink tweens are such rigid moves, so the engine can transform one image.

import fs from 'node:fs';
import path from 'node:path';
import { SwfLibrary, Snapshotter, buildSheetSwf, displayListAt, eraseShapeRegions } from './timeline.mjs';
import { transformRect, multiply, IDENTITY, filterReach } from './swf-io.mjs';
import { RuffleCapturer, REPO } from './ruffle-capture.mjs';
import { decodePng, encodePng, crop, alphaBounds } from './png.mjs';
import { writePreview } from './preview.mjs';

export const SOURCE_ROOT = path.join(REPO, 'reference/Junior_Game');
export const SHEETS_DIR = path.join(REPO, 'tools/.cache/sheets');
const PAGE_MAX = 4096; // default sheet size limit; "pageMax" per job (smaller sheets render faster)

const libraries = new Map();
function library(swfPath) {
  if (!libraries.has(swfPath)) libraries.set(swfPath, new SwfLibrary(fs.readFileSync(path.join(SOURCE_ROOT, swfPath)), swfPath));
  return libraries.get(swfPath);
}

export function sheetDir(job) {
  return path.join(SHEETS_DIR, path.basename(job.swf, '.swf').replace(/[^\w.-]+/g, '_'), jobName(job));
}

function jobName(job) {
  return job.name || String(job.symbol).replace(/^root:/, 'root_').replace(/[^\w.-]+/g, '_');
}

// "1-10,20" -> [1..10, 20]
function parseFrames(spec, frameCount) {
  if (!spec || spec === 'all') return Array.from({ length: frameCount }, (_, i) => i + 1);
  const out = [];
  for (const part of String(spec).split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let f = a; f <= (b || a); f++) if (f >= 1 && f <= frameCount) out.push(f);
  }
  return out;
}

// Frame scripts of the symbol's own timeline, normalised for the engine:
// ["set", name, value], ["gotoAndPlay", target], ["gotoAndStop", target], ["stop"], ["play"],
// ["nextFrame"], ["prevFrame"], ["script"] (anything not decoded, e.g. a conditional).
function normaliseScripts(timeline) {
  const out = {};
  timeline.frames.forEach((f, i) => {
    const ops = [];
    for (let k = 0; k < f.actions.length; k++) {
      const a = f.actions[k];
      if (a[0] === 'goto') {
        const next = f.actions[k + 1];
        if (a[2] || (next && next[0] === 'play')) { ops.push(['gotoAndPlay', a[1]]); if (!a[2]) k++; }
        else { ops.push(['gotoAndStop', a[1]]); if (next && next[0] === 'stop') k++; }
      } else if (a[0] === 'complex') ops.push(['script']);
      else if (a[0] === 'next') ops.push(['nextFrame']);
      else if (a[0] === 'prev') ops.push(['prevFrame']);
      else ops.push(a);
    }
    if (ops.length) out[i + 1] = ops;
  });
  return out;
}

// Shelf packing of cells (tallest first) into pages of at most PAGE_MAX square.
function packCells(cells, gutter, PAGE_MAX) {
  const order = [...cells].sort((a, b) => b.h - a.h || b.w - a.w);
  const pages = [];
  let page = null, x = 0, y = 0, rowH = 0;
  const newPage = () => { page = { cells: [], w: 0, h: 0 }; pages.push(page); x = gutter; y = gutter; rowH = 0; };
  newPage();
  for (const c of order) {
    if (c.w + 2 * gutter > PAGE_MAX || c.h + 2 * gutter > PAGE_MAX) throw new Error(`Frame ${c.w}x${c.h} is larger than a ${PAGE_MAX} page; lower the scale`);
    if (x + c.w + gutter > PAGE_MAX) { x = gutter; y += rowH + gutter; rowH = 0; }
    if (y + c.h + gutter > PAGE_MAX) newPage();
    c.x = x; c.y = y; page.cells.push(c);
    x += c.w + gutter; rowH = Math.max(rowH, c.h);
    page.w = Math.max(page.w, c.x + c.w + gutter); page.h = Math.max(page.h, c.y + c.h + gutter);
  }
  return pages;
}

export async function renderJob(job, capturer, { defaults = {}, force = false, log = console.log } = {}) {
  const outDir = sheetDir(job);
  if (!force && fs.existsSync(path.join(outDir, 'meta.json'))) { log(`  ${jobName(job)}: cached`); return JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8')); }
  const t0 = Date.now();
  const scale = job.scale ?? defaults.scale ?? 2;
  const lib = library(job.swf);
  const { id, placement } = lib.resolve(job.symbol);
  const char = lib.chars.get(id);
  if (!char) throw new Error(`${job.swf}: character ${id} is not defined in this file`);
  const snap = new Snapshotter(lib, { omitText: job.omitText ?? defaults.omitText, hide: job.hide || [], nested: job.nested ?? defaults.nested ?? 'age' });
  const erased = eraseShapeRegions(lib, job.erase);
  const ticks = job.ticks || 0;
  const frameCount = ticks || (char.kind === 'sprite' ? char.timeline.frameCount : 1);
  const frames = parseFrames(job.frames, frameCount);
  // Output frame i maps to symbol frame i, or in ticks mode to atFrame aged by i - 1 ticks.
  const nodeFor = f => ticks ? snap.node(id, job.atFrame || 1, placement?.ratio, f - 1) : snap.node(id, f, placement?.ratio);

  // Root transform in twips: output scale times the root placement (if any).
  const base = multiply({ a: scale, b: 0, c: 0, d: scale, tx: 0, ty: 0 }, placement ? placement.matrix : IDENTITY);
  const rootReach = filterReach(placement?.filters);

  // One cell per distinct snapshot.
  const cellsById = new Map();
  const frameCell = new Map();
  for (const f of frames) {
    const n = nodeFor(f);
    if (!n || !n.bounds) { frameCell.set(f, null); continue; }
    if (!cellsById.has(n.id)) {
      const b = transformRect(base, n.bounds);
      const margin = (job.margin ?? defaults.margin ?? 4) + Math.ceil((n.reach + rootReach) * scale * 1.5);
      const x0 = Math.floor(b.xMin / 20), y0 = Math.floor(b.yMin / 20);
      const x1 = Math.ceil(b.xMax / 20), y1 = Math.ceil(b.yMax / 20);
      cellsById.set(n.id, { id: n.id, first: f, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin, ox: margin - x0, oy: margin - y0, ratio: n.ratio ? (placement?.ratio || 0) : undefined });
    }
    frameCell.set(f, cellsById.get(n.id));
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const pages = packCells([...cellsById.values()], 2, job.pageMax ?? defaults.pageMax ?? PAGE_MAX);
  const warnings = [];
  for (const [pi, page] of pages.entries()) {
    const items = page.cells.map(c => ({
      id: c.id, ratio: c.ratio,
      matrix: { ...base, tx: base.tx + (c.x + c.ox) * 20, ty: base.ty + (c.y + c.oy) * 20 },
      cxform: placement?.cxform, filters: placement?.filters, blendMode: placement?.blendMode,
    }));
    const swf = buildSheetSwf(lib, snap, items, page.w, page.h, erased.overrides);
    if (job.keepSwf) fs.writeFileSync(path.join(outDir, `page${pi}.swf`), swf);
    const { png } = await capturer.capture(swf, page.w, page.h, { stable: true });
    const img = decodePng(png);
    for (const c of page.cells) {
      const cell = crop(img, c.x, c.y, c.w, c.h);
      // Anything touching the cell's outer ring means the bounds underestimated the art.
      if (touchesEdge(cell)) warnings.push(`frame ${c.first}: art reaches the cell edge (raise "margin")`);
      const t = alphaBounds(cell);
      if (!t) { c.empty = true; continue; }
      c.file = `f${String(c.first).padStart(3, '0')}.png`;
      c.w2 = t.w; c.h2 = t.h; c.originX = c.ox - t.x; c.originY = c.oy - t.y;
      fs.writeFileSync(path.join(outDir, c.file), encodePng(crop(cell, t.x, t.y, t.w, t.h)));
    }
  }

  const meta = {
    symbol: job.symbol, name: jobName(job), swf: job.swf, charId: id, scale,
    frameCount, frames: undefined,
    labels: char.kind === 'sprite' && !ticks ? char.timeline.labels : {},
    scripts: char.kind === 'sprite' && !ticks ? normaliseScripts(char.timeline) : {},
    mode: ticks ? 'ticks' : 'frames',
    placement: placement ? { depth: placement.depth, name: placement.name, matrix: placement.matrix } : null,
    options: { omitText: !!(job.omitText ?? defaults.omitText), hide: job.hide || [], frames: job.frames || 'all', ticks: ticks || undefined, atFrame: job.atFrame, nested: job.nested ?? defaults.nested ?? 'age' },
  };
  meta.frames = Array.from({ length: frameCount }, (_, i) => {
    const c = frameCell.get(i + 1);
    if (!c || c.empty) return { file: null, originX: 0, originY: 0, w: 0, h: 0 };
    return { file: c.file, originX: c.originX, originY: c.originY, w: c.w2, h: c.h2 };
  });
  if (job.track?.length && char.kind === 'sprite') {
    meta.tracks = {};
    for (const name of job.track) {
      meta.tracks[name] = Array.from({ length: frameCount }, (_, i) => {
        const list = displayListAt(char.timeline, ticks ? (job.atFrame || 1) : i + 1);
        const inst = [...list.values()].find(v => v.name === name);
        if (!inst) return null;
        const m = inst.matrix;
        return [m.a, m.b, m.c, m.d, m.tx / 20, m.ty / 20].map(v => +v.toFixed(5));
      });
    }
  }
  if (job.groupTrack && char.kind === 'sprite') {
    meta.tracks = meta.tracks || {};
    const ref = displayListAt(char.timeline, job.groupTrack);
    meta.tracks.group = Array.from({ length: frameCount }, (_, i) => groupTransform(ref, displayListAt(char.timeline, i + 1)));
    meta.groupReference = job.groupTrack;
  }
  if (erased.report.length) meta.erased = erased.report;
  if (warnings.length) meta.warnings = warnings;
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 1));
  writePreview(outDir, meta);
  log(`  ${meta.name}: ${frames.length} frames, ${cellsById.size} distinct, ${pages.length} page(s), ${((Date.now() - t0) / 1000).toFixed(1)} s${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
  for (const w of warnings.slice(0, 5)) log(`    warning: ${w}`);
  return meta;
}

// The transform g with child_k = g * child_ref for every depth present in both display lists, or
// null if the children did not move as one rigid group. Returned as [a, b, c, d, tx, ty] in px.
function groupTransform(ref, cur) {
  let g = null;
  for (const [depth, inst] of cur) {
    const r = ref.get(depth);
    if (!r) continue;
    const m = r.matrix, det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 1e-9) continue;
    const inv = { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, tx: (m.c * m.ty - m.d * m.tx) / det, ty: (m.b * m.tx - m.a * m.ty) / det };
    const h = multiply(inst.matrix, inv);
    if (!g) g = h;
    else if (Math.max(Math.abs(g.a - h.a), Math.abs(g.b - h.b), Math.abs(g.c - h.c), Math.abs(g.d - h.d)) > 0.01 || Math.max(Math.abs(g.tx - h.tx), Math.abs(g.ty - h.ty)) > 10) return null;
  }
  return g && [g.a, g.b, g.c, g.d, g.tx / 20, g.ty / 20].map(v => +v.toFixed(5));
}

function touchesEdge(img) {
  const { width: w, height: h, data } = img;
  for (let x = 0; x < w; x++) if (data[x * 4 + 3] || data[((h - 1) * w + x) * 4 + 3]) return true;
  for (let y = 0; y < h; y++) if (data[(y * w) * 4 + 3] || data[(y * w + w - 1) * 4 + 3]) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// CLI

async function main() {
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? true) : undefined; };
  const force = args.includes('--force');
  let jobs, defaults = {};
  if (flag('--swf')) {
    jobs = [{ swf: flag('--swf'), symbol: flag('--symbol'), name: flag('--name'), scale: flag('--scale') ? +flag('--scale') : undefined, pageMax: flag('--page-max') ? +flag('--page-max') : undefined, frames: flag('--frames'), omitText: args.includes('--omit-text'), hide: flag('--hide') ? String(flag('--hide')).split(',') : [], keepSwf: args.includes('--keep-swf') }];
  } else if (args[0] && !args[0].startsWith('--')) {
    const cfg = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    jobs = cfg.jobs; defaults = cfg;
    const only = flag('--only');
    if (only) { const set = new Set(String(only).split(',')); jobs = jobs.filter(j => set.has(jobName(j))); }
  } else {
    console.log('Usage: node tools/swf-sheet/sheet.mjs <jobs.json> [--only a,b] [--force]\n       node tools/swf-sheet/sheet.mjs --swf movies/x.swf --symbol <name|id|root:instance> [--name n] [--scale 2] [--frames 1-9] [--omit-text] [--hide a,b] [--force]');
    process.exit(1);
  }
  const capturer = await new RuffleCapturer().open();
  try {
    for (const job of jobs) await renderJob(job, capturer, { defaults, force });
  } finally {
    await capturer.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
