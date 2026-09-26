#!/usr/bin/env node
// Prints the display tree of a symbol (dev-only), to find instance paths, placements and the
// animated clips inside scenes before writing render jobs.
//
//   node tools/swf-sheet/tree.mjs <swf> <symbol|id|root|root:inst|a/b/c> [--frame 1] [--depth 3]
//   node tools/swf-sheet/tree.mjs <swf> <symbol> --survey [--frames 1-100] [--scale 2]
//
// --survey counts distinct snapshots over the frames and sums their bounds at the given scale
// (an upper bound on the pixels a render would produce), without rendering anything.

import fs from 'node:fs';
import path from 'node:path';
import { SwfLibrary, Snapshotter, displayListAt } from './timeline.mjs';
import { transformRect, multiply, IDENTITY } from './swf-io.mjs';
import { REPO } from './ruffle-capture.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [swfPath, target] = args;
const lib = new SwfLibrary(fs.readFileSync(path.join(REPO, 'reference/Junior_Game', swfPath)), swfPath);
const { id, placement } = lib.resolve(/^\d+$/.test(target) ? +target : target);
const fmt = m => `[${(m.a).toFixed(3)} ${(m.b).toFixed(3)} ${(m.c).toFixed(3)} ${(m.d).toFixed(3)} ${(m.tx / 20).toFixed(1)} ${(m.ty / 20).toFixed(1)}]`;
const rect = b => b ? `${((b.xMax - b.xMin) / 20).toFixed(1)}x${((b.yMax - b.yMin) / 20).toFixed(1)} at (${(b.xMin / 20).toFixed(1)}, ${(b.yMin / 20).toFixed(1)})` : 'empty';
const exportName = new Map([...lib.exports].map(([n, i]) => [i, n]));

if (args.includes('--survey')) {
  const scale = +flag('--scale', 2);
  const snap = new Snapshotter(lib, { omitText: args.includes('--omit-text'), hide: (flag('--hide', '') || '').split(',').filter(Boolean), nested: flag('--nested', 'age') });
  const c = lib.chars.get(id);
  const n = c.kind === 'sprite' ? c.timeline.frameCount : 1;
  const spec = flag('--frames', `1-${n}`);
  const frames = [];
  for (const part of spec.split(',')) { const [a, b] = part.split('-').map(Number); for (let f = a; f <= (b || a); f++) frames.push(f); }
  const base = multiply({ a: scale, b: 0, c: 0, d: scale, tx: 0, ty: 0 }, placement ? placement.matrix : IDENTITY);
  const seen = new Map();
  let maxW = 0, maxH = 0;
  for (const f of frames) {
    const node = snap.node(id, f, placement?.ratio);
    if (!node || !node.bounds || seen.has(node.id)) continue;
    const b = transformRect(base, node.bounds);
    const w = (b.xMax - b.xMin) / 20, h = (b.yMax - b.yMin) / 20;
    seen.set(node.id, w * h); maxW = Math.max(maxW, w); maxH = Math.max(maxH, h);
  }
  const area = [...seen.values()].reduce((a, v) => a + v, 0);
  console.log(`${target}: ${frames.length} frames, ${seen.size} distinct, max ${maxW.toFixed(0)}x${maxH.toFixed(0)} px at ${scale}x, bounds area ${(area / 1e6).toFixed(2)} Mpx (${(area * 4 / 1048576).toFixed(0)} MB RGBA)`);
  process.exit(0);
}

const maxDepth = +flag('--depth', 3);
const frame = +flag('--frame', 1);
if (placement) console.log(`placement ${fmt(placement.matrix)}${placement.cxform ? ' cxform' : ''}${placement.filters ? ' filters' : ''}`);
function walk(charId, fr, indent, level) {
  const c = lib.chars.get(charId);
  if (!c) { console.log(`${indent}(imported ${charId})`); return; }
  if (c.kind !== 'sprite') return;
  const list = displayListAt(c.timeline, fr);
  for (const [depth, inst] of [...list].sort((a, b) => a[0] - b[0])) {
    const ch = lib.chars.get(inst.charId);
    const kind = ch ? ch.kind : 'imported';
    const extra = ch?.kind === 'sprite' ? ` ${ch.timeline.frameCount}f${Object.keys(ch.timeline.labels).length ? ' labels ' + Object.entries(ch.timeline.labels).map(([l, f]) => `${l}:${f}`).join(',') : ''}` : ch?.bounds && !ch.bounds.start ? ` ${rect(ch.bounds)}` : '';
    console.log(`${indent}d${depth} ${kind} ${inst.charId}${exportName.has(inst.charId) ? ` (${exportName.get(inst.charId)})` : ''}${inst.name ? ` name=${inst.name}` : ''} ${fmt(inst.matrix)}${inst.clipDepth ? ` clip->${inst.clipDepth}` : ''}${inst.cxform ? ' cx' : ''}${inst.filters ? ' filters' : ''}${inst.blendMode ? ` blend${inst.blendMode}` : ''} born${inst.born}${extra}`);
    if (level < maxDepth && ch?.kind === 'sprite') walk(inst.charId, 1, indent + '  ', level + 1);
  }
}
const c = lib.chars.get(id);
console.log(`${target} = ${c.kind} ${id}${c.kind === 'sprite' ? ` ${c.timeline.frameCount}f labels ${JSON.stringify(c.timeline.labels)}` : ''}`);
walk(id, frame, '  ', 1);
