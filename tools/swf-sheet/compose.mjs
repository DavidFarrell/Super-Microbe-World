#!/usr/bin/env node
// Composes full 800 x 450 screens of the original game (dev-only), two ways:
//   --source sheets  from the Ruffle renders in tools/.cache/sheets (whole-character frames for
//                    rigged characters): the "Flash reference" images, written to
//                    web/screenshots/reference/<scene>.png with --out-dir
//   --source atlas   from the shipped atlases in web/data/atlas (rigs drawn part by part with
//                    tools/swf-sheet/atlas-draw.js, WebP pages): what the engine will draw
// and, with --diff, compares the two (mean absolute difference per channel, 0-255).
//
//   node tools/swf-sheet/compose.mjs [--scenes a,b] [--source sheets|atlas|both] [--out-dir d] [--diff]
//
// Every placement comes from the SWFs (root timelines, the attachMovie coordinates in the AS2
// source, and the tracks recorded by the render jobs), so the layouts are the original's. Scenes
// are listed at the bottom of this file with how each is put together (see also index.md).

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { SwfLibrary, displayListAt } from './timeline.mjs';
import { REPO } from './ruffle-capture.mjs';
import { decodePng, encodePng } from './png.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SHEETS = path.join(REPO, 'tools/.cache/sheets');
const ATLAS = path.join(REPO, 'web/data/atlas');

// ---------------------------------------------------------------------------------------------
// Symbol name -> sheet folder, from the atlas manifests (tools/atlas/*.json).
const sheetOf = new Map();
for (const f of fs.readdirSync(path.join(REPO, 'tools/atlas'))) {
  if (!f.endsWith('.json')) continue; // coverage.mjs lives there too
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/atlas', f), 'utf8'));
  for (const a of cfg.atlases || [cfg]) for (const s of a.symbols) if (s.sheet) sheetOf.set(s.name || path.basename(s.sheet), s.sheet);
}
const metaCache = new Map();
const sheetMeta = dir => {
  if (!metaCache.has(dir)) metaCache.set(dir, JSON.parse(fs.readFileSync(path.join(SHEETS, dir, 'meta.json'), 'utf8')));
  return metaCache.get(dir);
};
const index = JSON.parse(fs.readFileSync(path.join(ATLAS, 'index.json'), 'utf8'));
const atlasCache = new Map();
const atlasSym = name => {
  const a = index.symbols[name];
  if (!a) throw new Error(`no atlas symbol ${name}`);
  if (!atlasCache.has(a)) atlasCache.set(a, JSON.parse(fs.readFileSync(path.join(ATLAS, index.atlases[a].json), 'utf8')));
  return { atlas: a, data: atlasCache.get(a), sym: atlasCache.get(a).symbols[name] };
};
// Tracks, labels and other symbol data (identical in both sources).
const symInfo = name => (sheetOf.has(name) ? sheetMeta(sheetOf.get(name)) : atlasSym(name).sym);
const track = (name, key, f = 1) => symInfo(name).tracks[key][f - 1];
const label = (name, l) => symInfo(name).labels[l];

// Draw ops for one symbol frame: [{ img, rect: [x, y, w, h], ox, oy, scale, m? }].
function opsFor(source, name, frame) {
  if (source === 'sheets') {
    let dir = sheetOf.get(name);
    if (!dir) throw new Error(`no sheet for ${name}`);
    let meta = sheetMeta(dir);
    if (meta.mode === 'rig') { dir = path.join(dir, meta.fullSheet); meta = { ...meta, frames: meta.frames }; }
    for (let f = frame; f >= 1; f--) {
      const fr = meta.frames[f - 1];
      if (fr && fr.file) return [{ img: 'sheet:' + path.join(dir, fr.file), rect: [0, 0, fr.w, fr.h], ox: fr.originX, oy: fr.originY, scale: meta.scale }];
    }
    return [];
  }
  const { atlas, data, sym } = atlasSym(name);
  const page = i => 'atlas:' + data.images[i];
  const p = sym.rig ? sym.rig.frames[frame - 1] : null;
  if (p != null) {
    const pose = sym.rig.poses[p], out = [];
    for (let i = 0; i < pose.length; i += 7) {
      const [img, x, y, w, h, ox, oy, s] = sym.rig.parts[pose[i]];
      out.push({ img: page(img), rect: [x, y, w, h], ox, oy, scale: s, m: pose.slice(i + 1, i + 7) });
    }
    return out;
  }
  for (let f = frame; f >= 1; f--) {
    const r = sym.frames[f - 1];
    if (r) return [{ img: page(r[0]), rect: r.slice(1, 5), ox: r[5], oy: r[6], scale: sym.scale }];
  }
  void atlas;
  return [];
}

// ---------------------------------------------------------------------------------------------
// Layout data straight from the SWFs.
const lib = swf => new SwfLibrary(fs.readFileSync(path.join(REPO, 'reference/Junior_Game', swf)), swf);
const rootPlacements = swf => {
  const out = {};
  for (const [d, inst] of displayListAt(lib(swf).root, 1)) {
    const m = inst.matrix;
    out[inst.name || 'd' + d] = [m.a, m.b, m.c, m.d, m.tx / 20, m.ty / 20];
  }
  return out;
};
const T = (x, y) => [1, 0, 0, 1, x, y];
const I = [1, 0, 0, 1, 0, 0];
const mul = (p, c) => [p[0] * c[0] + p[2] * c[1], p[1] * c[0] + p[3] * c[1], p[0] * c[2] + p[2] * c[3], p[1] * c[2] + p[3] * c[3], p[0] * c[4] + p[2] * c[5] + p[4], p[1] * c[4] + p[3] * c[5] + p[5]];

// Scene layers: { sym, frame, m, alpha } | { fill } | { dim } (black over what is drawn so far).
function podiumDigits(score = [0, 0]) {
  const out = [];
  ['amy_score', 'harry_score'].forEach((who, k) => {
    const digits = String(score[k]).padStart(4, '0').split('').map(Number);
    ['thousands', 'hundreds', 'tens', 'units'].forEach((d, i) => out.push({ sym: 'gs_digit', frame: digits[i] ? digits[i] * 10 : 1, m: mul(track('gs_podia', who), track('gs_score', d)) }));
  });
  return out;
}
const studio = ({ hostFrame, kidsFrame = label('gs_harry', 'idle'), dim = 0, talkieAt = null, scores } = {}) => [
  { sym: 'gs_set', frame: 1, m: I },
  { sym: 'gs_host', frame: hostFrame ?? label('gs_host', 'excited'), m: I },
  ...(dim ? [{ dim }] : []),
  { sym: 'gs_harry', frame: kidsFrame, m: I },
  { sym: 'gs_amy', frame: kidsFrame, m: I },
  { sym: 'gs_podia', frame: 1, m: I },
  ...podiumDigits(scores),
  ...(talkieAt ? [{ sym: 'gs_talkie', frame: 21, m: T(...talkieAt) }] : []),
];

function levelScene(n, camera = 0) {
  const L = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/analysis/levels.json'), 'utf8'));
  const level = L.levels.find(l => l.file === `alpha_level${n}.xml`);
  const hud = rootPlacements('movies/introductionToMicrobes_platformer.swf');
  const layers = [{ sym: 'level_background', frame: 1, m: I }];
  const entities = [];
  let start = null;
  for (const c of level.resolvedCells) {
    const x = c.col * 50 - camera, y = c.row * 50;
    if (c.movie === 'player_start') { start = [x, y]; continue; }
    if (x < -300 || x > 850 || c.row > 8) continue;
    if (c.class === 'geometry') { layers.push({ sym: c.movie, frame: 1, m: T(x, y) }); continue; }
    const f = { lucy_icon: 'idle', steve_icon: 'idle', patty_icon: 'idle', slurm_icon: 'idle', slarg_icon: 'idle', donna_icon: 'idle', iggy_icon: 'idle', superinfection_icon: 'idle_1', milk_glass_icon: 'start' }[c.movie];
    entities.push({ sym: c.movie, frame: f ? label(c.movie, f) : 1, m: T(x, y) });
  }
  layers.push(...entities);
  layers.push({ sym: 'harry_lower', frame: 10, m: T(...start) }, { sym: 'harry_upper', frame: 10, m: T(...start) });
  // HUD: score with digits, hearts, the resting phone with the goal status screen.
  layers.push({ sym: 'score', frame: 1, m: hud.score });
  for (const d of ['thousands', 'hundreds', 'tens', 'units']) layers.push({ sym: 'digit', frame: 1, m: mul(hud.score, track('score', d)) });
  for (const h of ['heart0', 'heart1', 'heart2']) layers.push({ sym: 'heart', frame: 1, m: hud[h] });
  layers.push({ sym: 'e_phone', frame: 2, m: hud.ephone });
  const scr = mul(hud.ephone, track('e_phone', 'screen', 2));
  layers.push({ sym: 'status', frame: 1, m: scr });
  // Goal picture and mode icon exactly as PlatformGame.as:331-362 chooses them.
  const g = level.goals[0], img = { 11: 'lucy_image', 14: 'steve_image', 12: 'sandy_image', 16: 'slarg_image', 17: 'slurm_image' };
  let pic = null, mode = null;
  if (g.goalType === 1) { pic = 'lucy_image'; mode = 'camera_icon'; }
  else if (g.goalType === 0) { mode = 'camera_icon'; pic = img[g.microbeType] || null; }
  else if (g.goalType === 7) pic = 'milk_image';
  else if (g.goalType === 6) pic = 'superinfection_image';
  else { pic = 'slurm_image'; mode = 'kill_icon'; }
  if (pic) layers.push({ sym: pic, frame: 1, m: mul(scr, track('status', 'background')) });
  if (mode) layers.push({ sym: mode, frame: 1, m: mul(scr, track('status', 'mode')) });
  for (let b = 1; b <= 6; b++) layers.push({ sym: 'tick_box_button', frame: b <= g.required ? 30 : 1, m: mul(scr, track('status', 'button' + b)) });
  return layers;
}

const kitchenRoot = () => rootPlacements('movies/kitchen_game_main.swf');
const SCENES = {
  'splash-tuning': () => [
    { fill: '#000000' },
    { sym: 'splash_back', frame: 1, m: I }, { sym: 'splash_screen', frame: 60, m: I }, { sym: 'splash_casing', frame: 1, m: I },
    { sym: 'splash_tuning', frame: 60, m: I }, { sym: 'splash_glass', frame: 1, m: I },
  ],
  'splash-new-game': () => [
    { fill: '#000000' },
    { sym: 'splash_back', frame: 1, m: I }, { sym: 'splash_studio', frame: 120, m: I },
    { sym: 'splash_new_game', frame: 1, m: track('splash_timeline', 'd390', 170) },
    { sym: 'splash_casing', frame: 1, m: I }, { sym: 'splash_shine', frame: 120, m: I }, { sym: 'splash_glass', frame: 120, m: I },
  ],
  'cutscene-host': () => [{ fill: '#000000' }, ...studio({ talkieAt: [15, 307.5] })],
  'cutscene-avatar-choice': () => [{ fill: '#000000' }, ...studio({ hostFrame: 1, dim: 0.3 })],
  'cutscene-details-form': () => [{ fill: '#000000' }, { sym: 'cut_details_form', frame: 30, m: I }, { sym: 'cut_submit_button', frame: 1, m: T(398.65, 275.95) }],
  'gameshow': () => [{ fill: '#000000' }, ...studio({ talkieAt: [20, 308], scores: [55, 225] })],
  'gameshow-question-board': () => [
    { fill: '#000000' }, { sym: 'gs_question_board', frame: 1, m: I },
    ...['agree', 'dont_know', 'disagree'].map(b => ({ sym: `gs_button_${b}`, frame: 1, m: track('gs_question_board', `${b}_button`) })),
  ],
  'shrink': () => [{ fill: '#ffffff' }, { sym: 'gs_shrinking_zone', frame: 1, m: I }, { sym: 'shrink_harry', frame: 1, m: I }],
  'kitchen': () => {
    const r = kitchenRoot();
    return [{ fill: '#2c2c2c' }, { sym: 'kitchen_bg', frame: 1, m: r.d1 }, { sym: 'kitchen_harry', frame: label('kitchen_harry', 'idle'), m: T(65.5, 8.7) },
      { sym: 'kitchen_counter', frame: 1, m: r.kitchen_counter }, { sym: 'kitchen_sink', frame: 1, m: mul(r.kitchen_counter, track('kitchen_counter', 'sink_area')) }];
  },
  'kitchen-intro': () => [{ fill: '#000000' }, { sym: 'kitchen_intro0_bg', frame: 1, m: I, alpha: 77 / 256 },
    { sym: 'kitchen_click_button', frame: 1, m: track('kitchen_intro0_screen', 'click_button', 10) }],
  'kitchen-outro': () => [{ fill: '#000000' }, { sym: 'kitchen_outro_bg', frame: 10, m: I }, { sym: 'kitchen_click_button', frame: 1, m: track('kitchen_outro_bg', 'click_button', 10) }],
  'summary': () => [{ fill: '#ff9900' }, { sym: 'summary_page_bg', frame: 1, m: I }, { sym: 'summary_click_button', frame: 1, m: track('summary_page_bg', 'click_button') }],
};
for (let n = 1; n <= 11; n++) SCENES[`level${n}-opening`] = () => levelScene(n);

// ---------------------------------------------------------------------------------------------
async function main() {
  const names = flag('--scenes') ? flag('--scenes').split(',') : Object.keys(SCENES);
  const sources = (flag('--source', 'both') === 'both') ? ['sheets', 'atlas'] : [flag('--source')];
  const outDir = flag('--out-dir', path.join(REPO, 'tools/.cache/compose'));
  const zoom = +flag('--zoom', 1);
  fs.mkdirSync(outDir, { recursive: true });
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const p = u.startsWith('/sheet/') ? path.join(SHEETS, u.slice(7)) : path.join(ATLAS, u.slice(7));
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': p.endsWith('.png') ? 'image/png' : 'image/webp' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + 'none').catch(() => {});
  const results = [];
  for (const name of names) {
    const shots = {};
    for (const source of sources) {
      const layers = SCENES[name]().map(l => (l.sym ? { ...l, ops: opsFor(source, l.sym, l.frame) } : l));
      const b64 = await page.evaluate(async ({ layers, base, zoom }) => {
        const cache = {};
        const img = async key => {
          if (!cache[key]) {
            const url = key.startsWith('sheet:') ? base + 'sheet/' + key.slice(6) : base + 'atlas/' + key.slice(6);
            cache[key] = createImageBitmap(await (await fetch(url)).blob());
          }
          return cache[key];
        };
        const c = new OffscreenCanvas(800 * zoom, 450 * zoom), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        for (const l of layers) {
          if (l.fill) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = l.fill; g.fillRect(0, 0, c.width, c.height); continue; }
          if (l.dim) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(0,0,0,${l.dim})`; g.fillRect(0, 0, c.width, c.height); continue; }
          g.setTransform(zoom, 0, 0, zoom, 0, 0);
          g.transform(...l.m);
          g.globalAlpha = l.alpha ?? 1;
          for (const op of l.ops) {
            const bmp = await img(op.img);
            g.save();
            if (op.m) g.transform(...op.m);
            const k = 1 / op.scale;
            g.drawImage(bmp, op.rect[0], op.rect[1], op.rect[2], op.rect[3], -op.ox * k, -op.oy * k, op.rect[2] * k, op.rect[3] * k);
            g.restore();
          }
          g.globalAlpha = 1;
        }
        const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return btoa(s);
      }, { layers, base, zoom });
      shots[source] = Buffer.from(b64, 'base64');
      const file = source === 'sheets' ? path.join(outDir, `${name}${zoom === 1 ? '' : '@' + zoom + 'x'}.png`) : path.join(REPO, 'tools/.cache/compose', `${name}.atlas${zoom === 1 ? '' : '@' + zoom + 'x'}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, shots[source]);
    }
    if (shots.sheets && shots.atlas) {
      const a = decodePng(shots.sheets), b = decodePng(shots.atlas);
      let sum = 0, big = 0;
      for (let i = 0; i < a.data.length; i += 4) { let d = 0; for (let k = 0; k < 3; k++) d += Math.abs(a.data[i + k] - b.data[i + k]); sum += d / 3; if (d / 3 > 48) big++; }
      results.push(`${name}: sheets vs atlas mean abs diff ${(sum / (a.data.length / 4)).toFixed(2)}/255, ${big} px off by more than 48`);
    } else results.push(`${name}: written`);
  }
  await browser.close();
  server.close();
  for (const r of results) console.log(r);
  void encodePng;
}
main().catch(e => { console.error(e); process.exit(1); });
