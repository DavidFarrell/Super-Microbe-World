#!/usr/bin/env node
// Fast "is web/ bootable" gate, run before committing: syntax-checks every module under
// web/js, then boots the game headless (splash) and fails on any console error or page error.
// Usage: NODE_PATH=/opt/node22/lib/node_modules node tools/check-boot.mjs [scene query, e.g. "scene=platform&level=alpha_level1"]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
let bad = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.m?js$/.test(e.name)) {
      const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
      if (r.status !== 0) { bad++; console.log(`SYNTAX ${path.relative(WEB, p)}\n${r.stderr.split('\n').slice(0, 4).join('\n')}`); }
    }
  }
})(path.join(WEB, 'js'));
for (const f of fs.readdirSync(path.join(WEB, 'data'), { recursive: true })) {
  if (!String(f).endsWith('.json')) continue;
  try { JSON.parse(fs.readFileSync(path.join(WEB, 'data', f), 'utf8')); } catch (e) { bad++; console.log(`JSON ${f}: ${e.message}`); }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (err, data) => err ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(data));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/sw\.js|service ?worker/i.test(m.text())) errors.push('console: ' + m.text()); });
const q = process.argv[2] ? '?' + process.argv[2] : '';
await page.goto(`http://127.0.0.1:${server.address().port}/index.html${q}`);
const scene = await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 15000 }).then(h => h.jsonValue()).catch(() => null);
await page.waitForTimeout(800);
await browser.close(); server.close();
if (!scene) { bad++; console.log('BOOT: no scene started within 15 s'); }
for (const e of errors) { bad++; console.log('BOOT ' + e); }
console.log(bad ? `check-boot: ${bad} problem(s)` : `check-boot: ok (scene ${scene})`);
process.exit(bad ? 1 : 0);
