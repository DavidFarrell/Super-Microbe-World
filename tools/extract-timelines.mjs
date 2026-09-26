#!/usr/bin/env node
// Extracts the Flash timeline data the platform game's logic depends on (frame labels, frame
// counts, frame-1 bounds and the tiny frame scripts that set midAnimation / shoot / goto) into
// an ES module, so the pure simulation can run in node and in the browser without fetch().
//
// Usage: node tools/extract-timelines.mjs [--quiet]
//
// Reads:  reference/analysis/swf-inventory.json   labels, frame counts, bounds per exported sprite
//         reference/analysis/swf-scripts/*.txt     decompiled AVM1 frame scripts
//         reference/Junior_Game/movies/{harry,amy}.swf  per-frame bounds of the avatar parts
// Writes: web/js/platformer/data/clips.js
//
// Script ops emitted per frame (applied when the playhead enters the frame):
//   ['set', key, value]        midAnimation / shoot / finished / lives / visible
//   ['goto', label, play]      gotoAndPlay (play = true) or gotoAndStop (play = false)
//   ['stop'] | ['play']
//   ['if', key, then[], else[]]  truthiness test on a clip variable (only two such scripts exist)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SwfLibrary, Snapshotter } from './swf-sheet/timeline.mjs';
import { transformRect } from './swf-sheet/swf-io.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYSIS = path.join(ROOT, 'reference', 'analysis');
const MOVIES = path.join(ROOT, 'reference', 'Junior_Game', 'movies');
const OUT = path.join(ROOT, 'web', 'js', 'platformer', 'data', 'clips.js');
const QUIET = process.argv.includes('--quiet');

// Symbols exported by the platformer SWF whose timelines drive game logic or art.
const PLATFORMER_SYMBOLS = [
  'lucy_icon', 'steve_icon', 'patty_icon', 'sandy_icon', 'slurm_icon', 'slarg_icon', 'iggy_icon',
  'donna_icon', 'super_colin_icon', 'super_slurm_icon', 'superinfection_icon', 'milk_glass_icon',
  'soap_projectile', 'white_projectile', 'portal_exit_icon', 'camera_flash', 'soap_pickup',
  'white_pickup', 'antibiotic_pickup',
];
// Avatar SWFs: the root holds two nested sprites, 'upper' and 'lower' (PlayerEntity.as:108-109).
const AVATARS = { harry: 'harry.swf', amy: 'amy.swf' };

function parseScriptDump(file) {
  // Returns Map(spriteId -> Map(frame -> string[] lines)).
  const out = new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^\/\/ ---- sprite (\d+)(?: "[^"]*")?, frame (\d+)/);
    if (h) {
      const id = Number(h[1]), frame = Number(h[2]);
      if (!out.has(id)) out.set(id, new Map());
      cur = [];
      out.get(id).set(frame, cur);
      continue;
    }
    if (line.startsWith('// ----')) { cur = null; continue; }
    if (!line || line.startsWith('//')) continue;
    if (cur) cur.push(line);
  }
  return out;
}

// Converts decompiled straight-line code into ops. The only branching scripts are hand-mapped.
function toOps(lines, where) {
  const joined = lines.join('\n');
  // superinfection_icon frame 318: if (lives > 0) gotoAndPlay("idle_4") else { stop(); _visible = false }
  if (joined.includes('if (!(lives > 0))')) {
    return [['set', 'midAnimation', false], ['if', 'lives', [['goto', 'idle_4', true]], [['stop'], ['set', 'visible', false]]]];
  }
  // milk_glass_icon frame 50: if (finished) gotoAndPlay("yogurt") else gotoAndPlay("start")
  if (joined.includes('if (!!finished)')) {
    return [['set', 'midAnimation', false], ['if', 'finished', [['goto', 'yogurt', true]], [['goto', 'start', true]]]];
  }
  const ops = [];
  for (const l of lines) {
    let m;
    if (l === 'stop()') ops.push(['stop']);
    else if (l === 'play()') ops.push(['play']);
    else if ((m = l.match(/^(?:var )?(midAnimation|shoot|finished|lives) = (true|false|-?\d+)$/))) {
      ops.push(['set', m[1], m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2])]);
    } else if ((m = l.match(/^this\._visible = (true|false)$/))) ops.push(['set', 'visible', m[1] === 'true']);
    else if ((m = l.match(/^goto(AndPlay|AndStop)\("([^"]+)"\)$/))) ops.push(['goto', m[2], m[1] === 'AndPlay']);
    else throw new Error(`Unhandled script line in ${where}: ${l}`);
  }
  return ops;
}

function spriteRecord(sp, scripts, frameCount, labels, bounds) {
  const byFrame = {};
  const frames = scripts ? [...scripts.keys()].sort((a, b) => a - b) : [];
  for (const f of frames) byFrame[f] = toOps(scripts.get(f), `${sp} frame ${f}`);
  const lab = {};
  for (const l of labels) if (!(l.name in lab)) lab[l.name] = l.frame;
  return {
    frameCount,
    labels: lab,
    scripts: byFrame,
    bounds: bounds ? { x: r2(bounds.x), y: r2(bounds.y), w: r2(bounds.w), h: r2(bounds.h) } : null,
  };
}
const r2 = (v) => Math.round(v * 100) / 100;

// Bounds of every frame of a root instance ('upper' / 'lower') in the avatar root's space, as
// [x, y, w, h] (Flash px) or null where nothing is drawn. Flash reads the avatar's _width live
// (the union of both parts at their current frames), and the hoverboard exhaust drawn behind the
// board in the move / accelerate frames makes it much wider than frame 1 (PlatformGame.as:763).
// Nested clips follow timeline.mjs (children age with their parent, constant scripts honoured).
function avatarFrameBounds(lib, part) {
  const { id, placement } = lib.resolve('root:' + part);
  const snap = new Snapshotter(lib);
  const n = lib.chars.get(id).timeline.frameCount;
  const out = [];
  for (let f = 1; f <= n; f++) {
    const node = snap.node(id, f, placement && placement.ratio);
    if (!node || !node.bounds) { out.push(null); continue; }
    const b = transformRect(placement.matrix, node.bounds);
    out.push([b.xMin / 20, b.yMin / 20, (b.xMax - b.xMin) / 20, (b.yMax - b.yMin) / 20].map(r2));
  }
  return out;
}

function main() {
  const inv = JSON.parse(fs.readFileSync(path.join(ANALYSIS, 'swf-inventory.json'), 'utf8'));
  const swf = (name) => inv.swfs.find(s => s.path.endsWith('/' + name));
  const clips = {};

  const plat = swf('introductionToMicrobes_platformer.swf');
  const platScripts = parseScriptDump(path.join(ANALYSIS, 'swf-scripts', 'introductionToMicrobes_platformer.txt'));
  for (const name of PLATFORMER_SYMBOLS) {
    const sp = plat.exportedSprites.find(e => e.name === name);
    if (!sp) throw new Error('Missing symbol ' + name);
    clips[name] = spriteRecord(name, platScripts.get(sp.id), sp.frameCount, sp.labels, sp.boundsFrame1);
  }

  for (const [who, file] of Object.entries(AVATARS)) {
    const s = swf(file);
    const scripts = parseScriptDump(path.join(ANALYSIS, 'swf-scripts', file.replace('.swf', '.txt')));
    const rootB = s.rootTimeline.boundsFrame1;
    const lib = new SwfLibrary(fs.readFileSync(path.join(MOVIES, file)), file);
    for (const part of ['upper', 'lower']) {
      const inst = s.rootTimeline.instances.find(i => i.name === part);
      const placed = s.rootTimeline.placedOnFrame1.find(p => p.name === part);
      const labels = inst.labels.map(l => { const [f, n] = l.split(':'); return { frame: Number(f), name: n }; });
      const rec = spriteRecord(`${who}.${part}`, scripts.get(inst.charId), placed.frameCount, labels, placed.bounds);
      rec.frameBounds = avatarFrameBounds(lib, part);
      if (rec.frameBounds.length !== placed.frameCount) throw new Error(`${who}.${part}: ${rec.frameBounds.length} frame bounds for ${placed.frameCount} frames`);
      const f1 = rec.frameBounds[0], b1 = rec.bounds;
      if (!f1 || Math.abs(f1[0] - b1.x) > 0.05 || Math.abs(f1[2] - b1.w) > 0.05) throw new Error(`${who}.${part}: frame-1 bounds ${f1} disagree with the inventory ${JSON.stringify(b1)}`);
      clips[`${who}_${part}`] = rec;
    }
    // The avatar root clip: its bounds are the player's clip _width/_height used by hitTest,
    // bullet/flash spawn offsets and scrolling (PlatformGame.as:681,763,1029).
    clips[who] = { frameCount: 1, labels: {}, scripts: {}, bounds: { x: r2(rootB.x), y: r2(rootB.y), w: r2(rootB.w), h: r2(rootB.h) } };
  }

  const header = `// GENERATED by tools/extract-timelines.mjs from reference/analysis/swf-inventory.json and
// reference/analysis/swf-scripts/*.txt. Do not edit by hand; re-run the tool instead.
//
// Flash timeline data for the platform game: frame labels, frame counts, frame-1 bounds (clip
// _width/_height and art offset from the registration point) and frame-script ops. The avatar
// entries <who>_upper / <who>_lower are the nested 'upper' and 'lower' sprites of harry.swf /
// amy.swf (movies/, 25 fps), with frameBounds[f - 1] = [x, y, w, h] of frame f in the avatar
// root's space (null: nothing drawn); <who> alone is the avatar root clip (frame 1).
`;
  const body = `export const CLIPS = ${JSON.stringify(clips)};\n`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, header + body);
  if (!QUIET) console.log(`Wrote ${path.relative(ROOT, OUT)} with ${Object.keys(clips).length} clips`);
}

main();
