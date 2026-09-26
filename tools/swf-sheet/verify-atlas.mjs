#!/usr/bin/env node
// End-to-end check of the level-1 atlases (dev-only): loads web/data/atlas/*.json and the WebP
// pages in Chromium and draws a level-1 screen with Canvas 2D exactly as the engine would (the
// draw formula documented in tools/build-atlas.cjs), including the HUD, whose positions come
// from the platformer's root timeline and whose nested parts are placed through meta "tracks".
//
//   node tools/swf-sheet/verify-atlas.mjs [out.png] [--camera 0] [--avatar harry|amy] [--zoom 2] [--snap]
//
// The output is for eyeballing against the Flash original; it is not part of the game.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { SwfLibrary, displayListAt } from './timeline.mjs';
import { REPO } from './ruffle-capture.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : path.join(REPO, 'tools/.cache/verify-level1.png');
const camera = +flag('--camera', 0), avatar = flag('--avatar', 'harry'), zoom = +flag('--zoom', 2);
// --snap draws tiles on whole device pixels (each edge rounded separately), which is how the
// engine should draw edge-to-edge tiles: fractional edges are anti-aliased and leave seams.
const snap = args.includes('--snap');

// HUD placements on the platformer's root timeline (frame 1), in Flash px.
const lib = new SwfLibrary(fs.readFileSync(path.join(REPO, 'reference/Junior_Game/movies/introductionToMicrobes_platformer.swf')), 'platformer');
const hud = {};
for (const inst of displayListAt(lib.root, 1).values()) {
  if (!inst.name) continue;
  const m = inst.matrix;
  hud[inst.name] = [m.a, m.b, m.c, m.d, m.tx / 20, m.ty / 20];
}
const level = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/analysis/levels.json'), 'utf8')).levels.find(l => l.file === 'alpha_level1.xml');

const server = http.createServer((req, res) => {
  const p = path.join(REPO, 'web', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.json') ? 'application/json' : p.endsWith('.webp') ? 'image/webp' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`).catch(() => {});
const { png: b64, phoneCheck } = await page.evaluate(async ({ hud, cells, camera, avatar, zoom, snap }) => {
  const atlases = {};
  const load = async name => {
    const data = await (await fetch(`data/atlas/${name}.json`)).json();
    data.bitmaps = await Promise.all(data.images.map(async src => createImageBitmap(await (await fetch(`data/atlas/${src}`)).blob())));
    atlases[name] = data;
  };
  const index = await (await fetch('data/atlas/index.json')).json();
  for (const name of [...index.sets.level1, ...index.sets['player-' + avatar]]) await load(name);
  const sym = name => atlases[index.symbols[name]].symbols[name];
  const c = new OffscreenCanvas(800 * zoom, 450 * zoom);
  let g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.scale(zoom, zoom);
  // Draws frame f of a symbol with its registration point at the current transform's origin.
  const draw = (name, f = 1) => {
    const s = sym(name), fr = s.frames[f - 1];
    if (!fr) return;
    const [img, x, y, w, h, ox, oy] = fr, k = 1 / s.scale;
    g.drawImage(atlases[index.symbols[name]].bitmaps[img], x, y, w, h, -ox * k, -oy * k, w * k, h * k);
  };
  const at = (m, fn) => { g.save(); g.transform(...m); fn(); g.restore(); };
  const T = (x, y) => [1, 0, 0, 1, x, y];
  // Tile drawn with its rectangle snapped to device pixels.
  const drawTile = (name, x, y) => {
    const s = sym(name), [img, sx, sy, w, h, ox, oy] = s.frames[0], k = 1 / s.scale;
    const x0 = Math.round((x - ox * k) * zoom), y0 = Math.round((y - oy * k) * zoom);
    const x1 = Math.round((x - ox * k + w * k) * zoom), y1 = Math.round((y - oy * k + h * k) * zoom);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(atlases[index.symbols[name]].bitmaps[img], sx, sy, w, h, x0, y0, x1 - x0, y1 - y0);
    g.restore();
  };

  // Background (static, screen space), then the world scrolled by the camera.
  at(T(0, 0), () => draw('level_background'));
  for (const cell of cells) {
    const x = cell.col * 50 - camera, y = cell.row * 50;
    if (x < -300 || x > 850) continue;
    if (cell.class === 'geometry') { if (snap) drawTile(cell.movie, x, y); else at(T(x, y), () => draw(cell.movie)); }
    else if (cell.movie === 'lucy_icon') at(T(x, y), () => draw('lucy_icon', 10));
    else if (cell.movie === 'portal_exit_icon') at(T(x, y), () => draw('portal_exit_icon', 1));
    else if (cell.movie === 'player_start') at(T(x, y), () => { draw(avatar + '_lower', 10); draw(avatar + '_upper', 10); });
  }
  // A camera flash and a white blood cell in front of the player, for scale.
  const start = cells.find(c => c.movie === 'player_start');
  at(T(start.col * 50 - camera + 56 + 31, start.row * 50 + 27 + 35), () => draw('camera_flash'));
  at(T(start.col * 50 - camera + 120, start.row * 50 + 27), () => draw('white_projectile', 1));

  // HUD: score bar with digits placed by the score symbol's tracks.
  const score = sym('score');
  at(hud.score, () => {
    draw('score');
    ['thousands', 'hundreds', 'tens', 'units'].forEach((d, i) => at(score.tracks[d][0], () => draw('digit', [1, 10, 20, 30][i])));
  });
  for (const h of ['heart0', 'heart1', 'heart2']) at(hud[h], () => draw('heart'));
  at(hud.ephone, () => {
    // Small resting phone (frame 2), then the status screen through the phone's "screen" track.
    const phone = sym('e_phone');
    draw('e_phone', 2);
    at(phone.tracks.screen[1], () => {
      const st = sym('status');
      draw('status');
      at(st.tracks.background[0], () => draw('lucy_image'));
      at(st.tracks.mode[0], () => draw('camera_icon'));
      for (let b = 1; b <= 6; b++) at(st.tracks['button' + b][0], () => draw('tick_box_button', b <= 3 ? 30 : 1));
    });
  });
  // Timer text stand-in (the original is an Arial dynamic text field).
  g.font = 'bold 16px Arial'; g.fillStyle = '#000'; g.fillText('180', hud.timeLeft[4] + 40, hud.timeLeft[5] + 16);
  // ePhone check: frame 30 (large) drawn through tracks.group[1] must match frame 2 (small).
  const phoneCheck = (() => {
    const phone = sym('e_phone');
    const render = fn => { const pc = new OffscreenCanvas(800 * zoom, 450 * zoom), pg = pc.getContext('2d'); pg.imageSmoothingQuality = 'high'; pg.scale(zoom, zoom); const keep = g; g = pg; at(hud.ephone, fn); g = keep; return pg.getImageData(0, 0, pc.width, pc.height).data; };
    const a = render(() => draw('e_phone', 2));
    const b = render(() => at(phone.tracks.group[1], () => draw('e_phone', 30)));
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i + 3] || b[i + 3]) { for (let k = 0; k < 4; k++) sum += Math.abs(a[i + k] - b[i + k]); n += 4; }
    return { meanAbsDiff: +(sum / n).toFixed(2), pixels: n / 4 };
  })();
  const blob = await c.convertToBlob({ type: 'image/png' });
  const u = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return { png: btoa(s), phoneCheck };
}, { hud, cells: level.resolvedCells, camera, avatar, zoom, snap });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
await browser.close();
server.close();
console.log(`wrote ${path.relative(REPO, out)}`);
console.log(`ePhone: frame 30 through tracks.group[1] vs frame 2: mean abs diff ${phoneCheck.meanAbsDiff}/255 over ${phoneCheck.pixels} px`);
