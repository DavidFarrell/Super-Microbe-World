#!/usr/bin/env node
// Records a winning input trace for every platform level with the planner bot, in Chromium,
// through real inputs only, and writes web/tests/traces/<level>.json.
//
// The page is opened with ?manual=1 (no real-time ticking) and intro=0 (play starts at once);
// the bot (web/tests/bots/planner.mjs) runs inside the page, reads only __test.probe('platform')
// plus the level JSON, and holds its chosen actions with __test.hold() for two engine ticks per
// logic step. __test.recordInput() / takeInputLog() capture the per-tick input the game saw,
// which web/tests/levels.spec.mjs replays from a fresh load.
//
// Usage: NODE_PATH=/opt/node22/lib/node_modules node web/tests/bots/record-traces.mjs [level numbers...]
//        [--avatar=amy] [--check] (--check compares with the headless run and writes nothing)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { runPlannerHeadless } from './planner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '../..');
const OUT = path.join(WEB, 'tests', 'traces');
const args = process.argv.slice(2);
const avatar = (args.find(a => a.startsWith('--avatar=')) || '--avatar=harry').slice(9);
const check = args.includes('--check');
const levels = args.filter(a => /^\d+$/.test(a)).map(Number);
const LEVELS = (levels.length ? levels : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(n => `alpha_level${n}`);
const SEED = 1;
const MAX_STEPS = 5800;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml' };
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

// Runs inside the page: plays the level with the planner and returns the input log.
async function playInPage({ level, avatar, maxSteps }) {
  const { PlannerBot } = await import('/tests/bots/planner.mjs');
  const data = await (await fetch(`data/levels/${level}.json`)).json();
  const T = window.__test;
  const bot = new PlannerBot(data, { avatar });
  T.recordInput();
  let p = T.probe('platform');
  if (p.stepCount !== 0) throw new Error(`the level had already stepped (${p.stepCount})`);
  let stalls = 0;
  for (let i = 0; i < maxSteps * 2 && p.state === 'play'; i++) {
    if (p.ui !== 'play') throw new Error(`the scene left play (ui ${p.ui}) at step ${p.stepCount}`);
    const before = p.stepCount;
    T.hold(bot.decide(p));
    T.step(2);
    p = T.probe('platform');
    stalls = p.stepCount === before ? stalls + 1 : 0;
    if (stalls > 20) throw new Error(`no step for 40 ticks at step ${p.stepCount}`);
  }
  T.releaseAll();
  const log = T.takeInputLog();
  return {
    log, desync: bot.desync,
    final: { state: p.state, stepCount: p.stepCount, score: p.score, lives: p.lives, exitReason: p.exitReason, goal: p.goals[0] },
  };
}

const server = await serve();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failed = 0;
try {
  fs.mkdirSync(OUT, { recursive: true });
  for (const level of LEVELS) {
    const t0 = Date.now();
    const query = `scene=platform&level=${level}&avatar=${avatar}&seed=${SEED}&manual=1&intro=0`;
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${baseUrl}/index.html?${query}`);
    await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
    const r = await page.evaluate(playInPage, { level, avatar, maxSteps: MAX_STEPS });
    await context.close();
    // The same bot against the pure game in node must end in the same place.
    const data = JSON.parse(fs.readFileSync(path.join(WEB, 'data/levels', `${level}.json`), 'utf8'));
    const { game } = runPlannerHeadless(data, { avatar, maxSteps: MAX_STEPS });
    const h = game.snapshot();
    const same = h.stepCount === r.final.stepCount && h.score === r.final.score && h.lives === r.final.lives && h.state === r.final.state;
    const ok = r.final.state === 'complete' && !r.desync && same && errors.length === 0;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${level}: ${r.final.state} in ${r.final.stepCount} steps (${r.log.length} ticks), score ${r.final.score}, lives ${r.final.lives}, goal ${r.final.goal.achieved}/${r.final.goal.required}; headless ${h.state} ${h.stepCount} steps score ${h.score}${r.desync ? '; DESYNC ' + r.desync : ''}${errors.length ? '; errors: ' + errors.join(' | ') : ''} (${Date.now() - t0} ms)`);
    if (!ok) { failed++; continue; }
    if (check) continue;
    const trace = {
      format: 'smw-trace/1',
      note: 'Per-tick held actions recorded from the planner bot (web/tests/bots/planner.mjs) by web/tests/bots/record-traces.mjs; replayed by web/tests/levels.spec.mjs with __test.hold() + __test.step(1) per tick.',
      level, avatar, seed: SEED, query,
      ticks: r.log.length,
      final: r.final,
      log: r.log,
    };
    fs.writeFileSync(path.join(OUT, `${level}.json`), JSON.stringify(trace) + '\n');
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
