#!/usr/bin/env node
// One-command test runner: `npm test` (or `node web/tests/run.mjs`).
//
// 1. Runs the node unit tests (web/tests/unit/*.test.mjs) with `node --test`.
// 2. Serves web/ statically on a free localhost port (no build step, exactly what a player gets).
// 3. Launches Chromium through Playwright (the preinstalled browser here; on another machine run
//    `npx playwright install chromium` once) and runs every web/tests/*.spec.mjs.
//
// A spec module exports `tests`: [{ name, run(ctx) }]. run() throws to fail. ctx gives
//   { browser, devices, baseUrl, shots (screenshot folder), log(...), openPage(opts) }.
//
// Usage: node web/tests/run.mjs [--no-unit] [--screenshots] [name filter]
//   --screenshots  also write the gallery screenshots to web/screenshots/ (otherwise they go to
//                  tools/.cache/test-shots/, which is not committed).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const filter = args.find(a => !a.startsWith('--')) || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.mp3': 'audio/mpeg',
};

// Static file server for web/, like `npx serve web` or `python3 -m http.server -d web`.
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(WEB, url);
    if (!file.startsWith(WEB)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const results = [];
const line = (ok, name, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

// 1. Unit tests.
if (!flags.has('--no-unit') && !filter) {
  const unitDir = path.join(WEB, 'tests', 'unit');
  const files = fs.readdirSync(unitDir).filter(f => f.endsWith('.test.mjs')).map(f => path.join(unitDir, f));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = /# pass (\d+)/.exec(out)?.[1] ?? out.match(/ℹ pass (\d+)/)?.[1];
  const fail = /# fail (\d+)/.exec(out)?.[1] ?? out.match(/ℹ fail (\d+)/)?.[1];
  const ok = r.status === 0;
  if (!ok) console.log(out);
  line(ok, 'unit tests (node --test)', `${pass ?? '?'} passed, ${fail ?? '?'} failed, ${Date.now() - t0} ms`);
  results.push(ok);
}

// 2 and 3. Browser specs.
const server = await serve();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const shots = flags.has('--screenshots') ? path.join(WEB, 'screenshots') : path.join(ROOT, 'tools', '.cache', 'test-shots');
fs.mkdirSync(shots, { recursive: true });
let browser;
try {
  browser = await chromium.launch();
  const specs = fs.readdirSync(HERE).filter(f => f.endsWith('.spec.mjs')).sort();
  for (const file of specs) {
    const mod = await import(pathToFileURL(path.join(HERE, file)).href);
    for (const t of mod.tests || []) {
      const name = `${file.replace('.spec.mjs', '')}: ${t.name}`;
      if (filter && !name.includes(filter)) continue;
      const t0 = Date.now();
      const notes = [];
      const ctx = {
        browser, devices, baseUrl, shots, root: ROOT, web: WEB,
        log: (...a) => notes.push(a.join(' ')),
        // A fresh context + page that records console errors, page errors and HTTP failures.
        async openPage(opts = {}) {
          const context = await browser.newContext(opts);
          const page = await context.newPage();
          const errors = [];
          page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
          page.on('pageerror', e => errors.push(e.message));
          page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
          return { context, page, errors };
        },
      };
      try {
        await (t.timeoutMs ? withTimeout(t.run(ctx), t.timeoutMs) : t.run(ctx));
        line(true, name, `${Date.now() - t0} ms`);
        results.push(true);
      } catch (e) {
        line(false, name, `${Date.now() - t0} ms`);
        console.log('      ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n      '));
        results.push(false);
      }
      for (const n of notes) console.log('      ' + n);
    }
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms); })])
    .finally(() => clearTimeout(timer));
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
