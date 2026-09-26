#!/usr/bin/env node
// Checks a rendered rig (dev-only): for the given frames, Ruffle renders the whole character
// (an ordinary sheet), Chromium composes the rig's parts with Canvas 2D exactly as the engine
// would, and the two are compared (mean absolute difference over the pixels either one covers,
// 0-255 per channel). Writes a side-by-side PNG (Ruffle left, rig right) per checked frame.
//
//   node tools/swf-sheet/verify-rig.mjs <rig sheet dir under tools/.cache/sheets> [--frames 21,60,200] [--out dir]
//
// The Canvas code in page.evaluate below is the reference rig renderer for the engine.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { RuffleCapturer } from './ruffle-capture.mjs';
import { renderJob, SHEETS_DIR } from './sheet.mjs';
import { decodePng, encodePng } from './png.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(SHEETS_DIR, args[0]);
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const drawn = meta.rig.frames.map((p, i) => (p == null ? null : i + 1)).filter(Boolean);
const frames = flag('--frames') ? flag('--frames').split(',').map(Number) : [drawn[0], drawn[Math.floor(drawn.length / 3)], drawn[Math.floor(drawn.length * 2 / 3)], drawn[drawn.length - 1]];
const outDir = flag('--out', path.join(dir, 'verify'));
fs.mkdirSync(outDir, { recursive: true });

// Ruffle reference: the whole symbol at those frames, same scale.
const capturer = await new RuffleCapturer().open();
const refJob = { swf: meta.swf, symbol: meta.symbol, name: meta.name + '__verify', scale: meta.scale, frames: frames.join(','), hide: meta.options.hide, omitText: true, nested: 'age' };
const ref = await renderJob(refJob, capturer, { force: true, log: () => {} });
await capturer.close();
const refDir = path.join(path.dirname(dir), meta.name + '__verify');

const browser = await chromium.launch();
const page = await browser.newPage();
const partsB64 = meta.rig.parts.map(p => fs.readFileSync(path.join(dir, p.file)).toString('base64'));
const results = [];
for (const f of frames) {
  const rf = ref.frames[f - 1];
  if (!rf.file) { results.push({ f, note: 'empty in Ruffle' }); continue; }
  const refPng = fs.readFileSync(path.join(refDir, rf.file));
  if (meta.rig.frames[f - 1] == null) { results.push({ f, note: 'no pose (frame not reachable from the rig labels)' }); continue; }
  const pose = meta.rig.poses[meta.rig.frames[f - 1]];
  const b64 = await page.evaluate(async ({ partsB64, parts, pose, w, h, ox, oy, scale }) => {
    const imgs = await Promise.all(partsB64.map(async b => createImageBitmap(await (await fetch('data:image/png;base64,' + b)).blob())));
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    // Symbol origin at (ox, oy) in the reference image, at the reference's scale.
    g.setTransform(scale, 0, 0, scale, ox, oy);
    for (let i = 0; i < pose.length; i += 7) {
      const P = parts[pose[i]], k = 1 / P.scale;
      g.save();
      g.transform(pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]);
      g.drawImage(imgs[pose[i]], -P.originX * k, -P.originY * k, P.w * k, P.h * k);
      g.restore();
    }
    const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }, { partsB64, parts: meta.rig.parts, pose, w: rf.w, h: rf.h, ox: rf.originX, oy: rf.originY, scale: meta.scale });
  const a = decodePng(refPng), b = decodePng(Buffer.from(b64, 'base64'));
  let sum = 0, n = 0, big = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (!a.data[i + 3] && !b.data[i + 3]) continue;
    // Compare premultiplied colour so faint edges count by their coverage.
    let d = 0;
    for (let k = 0; k < 3; k++) d += Math.abs(a.data[i + k] * a.data[i + 3] / 255 - b.data[i + k] * b.data[i + 3] / 255);
    d += Math.abs(a.data[i + 3] - b.data[i + 3]);
    sum += d / 4; n++; if (d / 4 > 64) big++;
  }
  // Side by side on grey.
  const W = a.width * 2 + 8, H = a.height, out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    const src = x < a.width ? a : x >= a.width + 8 ? b : null, sx = x < a.width ? x : x - a.width - 8;
    let r = 176, g = 176, bl = 176;
    if (src) { const s = (y * src.width + sx) * 4, al = src.data[s + 3] / 255; r = src.data[s] * al + r * (1 - al); g = src.data[s + 1] * al + g * (1 - al); bl = src.data[s + 2] * al + bl * (1 - al); }
    out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
  }
  fs.writeFileSync(path.join(outDir, `f${f}.png`), encodePng({ width: W, height: H, data: out }));
  results.push({ f, meanAbsDiff: +(sum / n).toFixed(2), pixels: n, over64: big });
}
await browser.close();
fs.rmSync(refDir, { recursive: true, force: true });
for (const r of results) console.log(`${meta.name} frame ${r.f}: ${r.note || `mean abs diff ${r.meanAbsDiff}/255 over ${r.pixels} px, ${r.over64} px off by more than 64`}`);
