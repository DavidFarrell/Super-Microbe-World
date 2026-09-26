#!/usr/bin/env node
// Builds web/screenshots/level1-compare.png (dev-only): the level 1 start screen four ways, for
// eyeballing fidelity. Top left: the original platformer SWF in Ruffle (reference/captures; it
// stops on frame 1 standalone, so it shows the HUD layout and background but no level). Top
// right: the level drawn straight from the SWF-derived atlases (tools/swf-sheet/verify-atlas.mjs,
// run it first). Bottom: the remake at the same moment, keyboard layout and touch layout.
//
//   node tools/compare-level1.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'screenshots', 'level1-compare.png');
const REF = path.join(ROOT, 'reference', 'captures', 'platformer-standalone-frame1.png');
const RECON = path.join(ROOT, 'tools', '.cache', 'verify-level1.png');

const server = http.createServer((req, res) => {
  let file = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  const type = { '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': type }).end(data)));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function remake(opts) {
  const page = await browser.newPage(opts);
  await page.goto(`${base}/index.html?scene=platform&level=alpha_level1&seed=1&intro=0`);
  await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready);
  await page.evaluate(() => { window.__test.manual(true); window.__test.step(40); });
  const png = await page.screenshot({ scale: 'css' });
  await page.close();
  return png.toString('base64');
}
const keyboard = await remake({ viewport: { width: 800, height: 450 } });
const touch = await remake({ viewport: { width: 800, height: 450 }, isMobile: true, hasTouch: true });
const b64 = f => (fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null);

const page = await browser.newPage({ viewport: { width: 1640, height: 1000 } });
const png = await page.evaluate(async ({ ref, recon, keyboard, touch }) => {
  const img = async s => (s ? createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()) : null);
  const c = new OffscreenCanvas(1640, 1000), g = c.getContext('2d');
  g.fillStyle = '#1b1640'; g.fillRect(0, 0, 1640, 1000);
  const panels = [
    [await img(ref), 'Flash original in Ruffle (frame 1 only: HUD and background)', 0, 75, 800, 450],
    [await img(recon), 'Level 1 drawn from the SWF art (atlas reconstruction)', 0, 0, null, null],
    [await img(keyboard), 'Remake: keyboard layout (original HUD positions)', 0, 0, 800, 450],
    [await img(touch), 'Remake: touch layout (ePhone on the left, pause and phone top left)', 0, 0, 800, 450],
  ];
  panels.forEach(([im, label, sx, sy, sw, sh], i) => {
    const x = 13 + (i % 2) * 814, y = 36 + Math.floor(i / 2) * 492;
    g.fillStyle = '#fdf8ec'; g.font = 'bold 20px sans-serif'; g.fillText(label, x, y - 10);
    if (!im) { g.fillStyle = '#444'; g.fillRect(x, y, 800, 450); g.fillStyle = '#fff'; g.fillText('(missing)', x + 350, y + 225); return; }
    g.drawImage(im, sx, sy, sw || im.width, sh || im.height, x, y, 800, 450);
  });
  const blob = await c.convertToBlob({ type: 'image/png' });
  const u = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}, { ref: b64(REF), recon: b64(RECON), keyboard, touch });
fs.writeFileSync(OUT, Buffer.from(png, 'base64'));
await browser.close();
server.close();
console.log(`wrote ${path.relative(ROOT, OUT)}`);
