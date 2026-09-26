// Cut-out "rig" rendering (dev-only): instead of one image per animation frame, render each
// distinct body part once and record, per frame, which parts are drawn with which affine matrix.
//
// The game show host and contestants and the kitchen avatars are classic Flash cut-out
// animation: about 36 parts per frame (heads, arms, hands, torsos) moved by motion tweens, with
// no filters and no morph shapes. As per-frame images they would cost about 13 MB of WebP at 2x;
// as rigs they cost a few hundred KB and stay sharp at any zoom.
//
// Decomposition (per frame, on the same aged display tree the sheet renderer uses):
//   - a sprite whose own display list at that moment holds a clip layer (mask), a blend mode, or a
//     child with filters is "atomic": its snapshot (content-deduplicated) becomes one part, so
//     masks and filters render exactly as in Flash, inside the part;
//   - any other sprite is opened: its children's matrices and colour transforms are composed
//     onto the parent's and the walk continues;
//   - shapes, morph shapes (with their ratio), text and buttons are leaf parts.
// A part is keyed by its content and its composed colour transform, which is baked into the part
// image. Each part is rendered once, at out-scale times the largest scale it is ever drawn at.
//
// meta.json (mode "rig") adds to the usual sheet meta:
//   rig: { parts: [ { file, originX, originY, w, h, scale } ],   scale = image px per part-local px
//          poses: [ [part, a, b, c, d, tx, ty, part, a, ...] ],    flat, back to front
//          frames: [ pose index | null ] }                         one per Flash frame
// Matrices map part-local Flash px to the symbol's space (Flash px, the same space as the
// registration point of the symbol's ordinary frames). Drawing pose p of a rig at (px, py):
//   for each [part, a, b, c, d, tx, ty] in poses[p]:
//     ctx.save(); ctx.translate(px, py); ctx.transform(a, b, c, d, tx, ty);
//     const P = parts[part], k = 1 / P.scale;   // P also has its atlas rectangle
//     ctx.drawImage(page, P.x, P.y, P.w, P.h, -P.ox * k, -P.oy * k, P.w * k, P.h * k); ctx.restore();
// The ordinary "frames" of a rig symbol hold whole-character images at the label start frames
// only, so an engine that cannot draw rigs still shows each label's first pose.

import fs from 'node:fs';
import path from 'node:path';
import { Snapshotter, buildSheetSwf, eraseShapeRegions } from './timeline.mjs';
import { transformRect, multiply, IDENTITY, isIdentityCxform } from './swf-io.mjs';
import { decodePng, encodePng, crop, alphaBounds } from './png.mjs';
import { writePreview } from './preview.mjs';
import { library, sheetDir, jobName, parseFrames, packCells, touchesEdge, normaliseScripts, renderJob } from './sheet.mjs';

// Composes colour transforms: child applied first, then parent (8.8 fixed multipliers).
function composeCx(parent, child) {
  if (isIdentityCxform(child)) return parent;
  if (isIdentityCxform(parent)) return child;
  const m = (p, c) => Math.round(p * c / 256);
  return {
    rm: m(parent.rm, child.rm), gm: m(parent.gm, child.gm), bm: m(parent.bm, child.bm), am: m(parent.am, child.am),
    ra: Math.round(child.ra * parent.rm / 256 + parent.ra), ga: Math.round(child.ga * parent.gm / 256 + parent.ga),
    ba: Math.round(child.ba * parent.bm / 256 + parent.ba), aa: Math.round(child.aa * parent.am / 256 + parent.aa),
  };
}
const cxKey = cx => (isIdentityCxform(cx) ? '' : `|${cx.rm},${cx.gm},${cx.bm},${cx.am},${cx.ra},${cx.ga},${cx.ba},${cx.aa}`);

// Frames reachable when the timeline is entered only at these labels (as build-atlas.cjs).
export function reachable(frameCount, labels, scripts, entryLabels) {
  const seen = new Set();
  const labelFrame = t => (typeof t === 'number' ? t : labels[t]);
  for (const l of entryLabels) {
    if (!labels[l]) throw new Error(`no label ${l}`);
    let f = labels[l];
    const visited = new Set();
    while (f >= 1 && f <= frameCount && !visited.has(f)) {
      visited.add(f); seen.add(f);
      let next = f + 1 > frameCount ? 1 : f + 1, stop = false;
      for (const op of scripts[f] || []) {
        if (op[0] === 'stop') stop = true;
        else if (op[0] === 'gotoAndPlay' && labelFrame(op[1])) { next = labelFrame(op[1]) === f ? (f + 1 > frameCount ? 1 : f + 1) : labelFrame(op[1]); stop = false; }
        else if (op[0] === 'gotoAndStop' && labelFrame(op[1])) { seen.add(labelFrame(op[1])); stop = true; }
      }
      if (stop) break;
      f = next;
    }
  }
  return seen;
}

// Walks the aged display tree of frame f of sprite `id` and returns the draw list
// [{ key, node, matrix (twips, symbol space), cx }], back to front.
export function decompose(lib, snap, id, f, base, { hide = new Set(), atomic = new Set() } = {}) {
  const out = [];
  const needsAtomic = list => [...list.values()].some(i => i.clipDepth || (i.blendMode > 1) || i.filters);
  const leaf = (inst, M, CX) => {
    const ch = lib.chars.get(inst.charId);
    if (!ch) return;
    if (ch.kind === 'shape' || ch.kind === 'morph' || ch.kind === 'text' || ch.kind === 'edittext' || ch.kind === 'button') {
      const node = snap.node(inst.charId, 1, inst.ratio);
      if (!node) return;
      out.push({ key: `c${inst.charId}${ch.kind === 'morph' ? ':' + (inst.ratio || 0) : ''}${cxKey(CX)}`, node, matrix: M, cx: CX, ratio: node.ratio ? (inst.ratio || 0) : undefined });
    }
  };
  // list: display list entries; ageOf(depth, inst) gives a child sprite's age.
  const walk = (list, ageOf, M, CX) => {
    for (const [depth, inst] of [...list].sort((a, b) => a[0] - b[0])) {
      if (inst.name && hide.has(inst.name)) continue;
      const ch = lib.chars.get(inst.charId);
      if (!ch) continue;
      const M2 = multiply(M, inst.matrix || IDENTITY), CX2 = composeCx(CX, inst.cxform);
      if (ch.kind !== 'sprite') { leaf(inst, M2, CX2); continue; }
      const age = Math.max(0, ageOf(depth, inst));
      const st = lib.stateAt(inst.charId, age);
      const childList = lib.dl(inst.charId, st.frame);
      if (atomic.has(inst.charId) || needsAtomic(childList)) {
        const node = snap.aged(inst.charId, age);
        if (node) out.push({ key: `s${node.id}${cxKey(CX2)}`, node, matrix: M2, cx: CX2 });
      } else {
        walk(childList, d => age - st.created.get(d), M2, CX2);
      }
    }
  };
  const c = lib.chars.get(id);
  if (c.kind !== 'sprite') { leaf({ charId: id, matrix: IDENTITY }, base, null); return out; }
  const list = lib.dl(id, f);
  if (needsAtomic(list)) {
    const node = snap.node(id, f);
    if (node) out.push({ key: `s${node.id}`, node, matrix: base, cx: null });
    return out;
  }
  walk(list, (d, inst) => f - inst.born, base, null);
  return out;
}

const axisScale = m => Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
const q = (v, d) => +v.toFixed(d);

export async function renderRig(job, capturer, { defaults = {}, force = false, log = console.log } = {}) {
  const outDir = sheetDir(job);
  if (!force && fs.existsSync(path.join(outDir, 'meta.json'))) { log(`  ${jobName(job)}: cached`); return JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8')); }
  const t0 = Date.now();
  const scale = job.scale ?? defaults.scale ?? 2;
  const lib = library(job.swf);
  const { id, placement } = lib.resolve(job.symbol);
  const char = lib.chars.get(id);
  if (char.kind !== 'sprite') throw new Error(`${job.symbol}: a rig needs a sprite`);
  const tl = char.timeline, frameCount = tl.frameCount;
  const scripts = normaliseScripts(tl);
  let frames = parseFrames(job.frames, frameCount);
  if (job.entryLabels) { const r = reachable(frameCount, tl.labels, scripts, job.entryLabels); frames = frames.filter(f => r.has(f)); }
  const snap = new Snapshotter(lib, { omitText: job.omitText ?? true, hide: job.hide || [], nested: 'age' });
  const erased = eraseShapeRegions(lib, job.erase);
  const base = placement ? placement.matrix : IDENTITY;
  const opts = { hide: new Set(job.hide || []), atomic: new Set(job.atomic || []) };

  // Decompose every frame; collect distinct parts and the largest scale each is drawn at.
  const parts = new Map(); // key -> { key, node, cx, ratio, maxScale, index }
  const poseKeys = new Map(), poses = [], frameToPose = new Array(frameCount).fill(null);
  for (const f of frames) {
    const list = decompose(lib, snap, id, f, base, opts);
    if (!list.length) continue;
    const flat = [];
    for (const it of list) {
      let p = parts.get(it.key);
      if (!p) { p = { key: it.key, node: it.node, cx: it.cx, ratio: it.ratio, maxScale: 0, index: parts.size }; parts.set(it.key, p); }
      p.maxScale = Math.max(p.maxScale, axisScale(it.matrix));
      const m = it.matrix;
      flat.push(p.index, q(m.a, 4), q(m.b, 4), q(m.c, 4), q(m.d, 4), q(m.tx / 20, 2), q(m.ty / 20, 2));
    }
    const k = flat.join(',');
    if (!poseKeys.has(k)) { poseKeys.set(k, poses.length); poses.push(flat); }
    frameToPose[f - 1] = poseKeys.get(k);
  }

  // Render each part once, at out-scale times its largest use (rounded up to 1/8 steps).
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const cells = [];
  for (const p of parts.values()) {
    p.scale = Math.max(0.25, Math.ceil(scale * p.maxScale * 8) / 8);
    const m = { a: p.scale, b: 0, c: 0, d: p.scale, tx: 0, ty: 0 };
    const b = transformRect(m, p.node.bounds);
    const margin = (job.margin ?? defaults.margin ?? 4) + Math.ceil(p.node.reach * p.scale * 1.5);
    const x0 = Math.floor(b.xMin / 20), y0 = Math.floor(b.yMin / 20), x1 = Math.ceil(b.xMax / 20), y1 = Math.ceil(b.yMax / 20);
    cells.push({ part: p, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin, ox: margin - x0, oy: margin - y0 });
  }
  const pages = packCells(cells, 2, job.pageMax ?? defaults.pageMax ?? 4096);
  const warnings = [];
  for (const [pi, page] of pages.entries()) {
    const items = page.cells.map(c => ({ id: c.part.node.id, ratio: c.part.ratio, cxform: c.part.cx || undefined, matrix: { a: c.part.scale, b: 0, c: 0, d: c.part.scale, tx: (c.x + c.ox) * 20, ty: (c.y + c.oy) * 20 } }));
    const swf = buildSheetSwf(lib, snap, items, page.w, page.h, erased.overrides);
    if (job.keepSwf) fs.writeFileSync(path.join(outDir, `page${pi}.swf`), swf);
    const { png } = await capturer.capture(swf, page.w, page.h, { stable: true });
    const img = decodePng(png);
    for (const c of page.cells) {
      const cell = crop(img, c.x, c.y, c.w, c.h);
      if (touchesEdge(cell)) warnings.push(`part ${c.part.index}: art reaches the cell edge`);
      const t = alphaBounds(cell);
      if (!t) { c.part.empty = true; continue; }
      c.part.file = `p${String(c.part.index).padStart(3, '0')}.png`;
      c.part.w = t.w; c.part.h = t.h; c.part.originX = c.ox - t.x; c.part.originY = c.oy - t.y;
      fs.writeFileSync(path.join(outDir, c.part.file), encodePng(crop(cell, t.x, t.y, t.w, t.h)));
    }
  }
  // Empty parts (fully transparent) are dropped from the poses.
  const ordered = [...parts.values()].sort((a, b) => a.index - b.index);
  const remap = new Map(); let n = 0;
  for (const p of ordered) if (!p.empty) remap.set(p.index, n++);
  const finalPoses = poses.map(flat => {
    const outFlat = [];
    for (let i = 0; i < flat.length; i += 7) if (remap.has(flat[i])) outFlat.push(remap.get(flat[i]), ...flat.slice(i + 1, i + 7));
    return outFlat;
  });

  // Whole-character images at the label starts (and frame 1), for engines without rig support.
  const starts = [...new Set([1, ...Object.values(tl.labels)])].filter(f => frames.includes(f)).sort((a, b) => a - b);
  const fullJob = { swf: job.swf, symbol: job.symbol, name: jobName(job) + '__full', scale: job.fullScale ?? scale, frames: starts.join(','), hide: job.hide, omitText: job.omitText ?? true, nested: 'age', erase: job.erase };
  const full = await renderJob(fullJob, capturer, { defaults, force: true, log });

  const meta = {
    symbol: job.symbol, name: jobName(job), swf: job.swf, charId: id, scale: full.scale, frameCount,
    labels: tl.labels, scripts, mode: 'rig',
    placement: placement ? { depth: placement.depth, name: placement.name, matrix: placement.matrix } : null,
    options: { frames: job.frames || 'all', entryLabels: job.entryLabels, hide: job.hide || [], nested: 'age' },
    frames: full.frames, fullSheet: path.relative(outDir, sheetDir(fullJob)),
    rig: {
      parts: ordered.filter(p => !p.empty).map(p => ({ file: p.file, originX: p.originX, originY: p.originY, w: p.w, h: p.h, scale: p.scale })),
      poses: finalPoses, frames: frameToPose,
    },
  };
  if (warnings.length) meta.warnings = warnings;
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta));
  const partPx = meta.rig.parts.reduce((a, p) => a + p.w * p.h, 0);
  log(`  ${meta.name}: rig of ${frames.length} frames, ${poses.length} poses, ${meta.rig.parts.length} parts (${(partPx / 1e6).toFixed(2)} Mpx), ${starts.length} full frames, ${((Date.now() - t0) / 1000).toFixed(1)} s${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
  for (const w of warnings.slice(0, 5)) log(`    warning: ${w}`);
  return meta;
}

// Survey without rendering: parts, poses and part pixels for a rig job.
export function surveyRig(job) {
  const lib = library(job.swf);
  const { id, placement } = lib.resolve(job.symbol);
  const tl = lib.chars.get(id).timeline;
  let frames = parseFrames(job.frames, tl.frameCount);
  if (job.entryLabels) { const r = reachable(tl.frameCount, tl.labels, normaliseScripts(tl), job.entryLabels); frames = frames.filter(f => r.has(f)); }
  const snap = new Snapshotter(lib, { omitText: true, hide: job.hide || [], nested: 'age' });
  const parts = new Map(); let uses = 0; const poses = new Set();
  for (const f of frames) {
    const list = decompose(lib, snap, id, f, placement ? placement.matrix : IDENTITY, { hide: new Set(job.hide || []), atomic: new Set(job.atomic || []) });
    uses += list.length;
    poses.add(list.map(i => i.key + [i.matrix.a, i.matrix.b, i.matrix.c, i.matrix.d, i.matrix.tx, i.matrix.ty].map(v => v.toFixed(3)).join()).join(';'));
    for (const it of list) { const p = parts.get(it.key) || { node: it.node, s: 0 }; p.s = Math.max(p.s, axisScale(it.matrix)); parts.set(it.key, p); }
  }
  const scale = job.scale ?? 2;
  let px = 0;
  for (const p of parts.values()) { const b = p.node.bounds; px += ((b.xMax - b.xMin) / 20 * p.s * scale) * ((b.yMax - b.yMin) / 20 * p.s * scale); }
  return { frames: frames.length, poses: poses.size, parts: parts.size, atomicParts: [...parts.keys()].filter(k => k[0] === 's').length, usesPerFrame: +(uses / frames.length).toFixed(1), partMpx: +(px / 1e6).toFixed(2) };
}
