// Performance and payload budgets.
//   (a) Frame time under 4x CPU throttling (Chromium CDP Emulation.setCPUThrottlingRate), in real
//       time (no ?manual), 1280x720 at device pixel ratio 1: level 10 (antibiotic bombs, the
//       superinfection, the most microbes on screen), level 7 (the longest level) and a game show
//       round. The levels are played by their recorded winning traces (web/tests/traces/), injected
//       one engine tick at a time as the real-time loop runs, so the camera scrolls and microbes
//       are photographed, washed away and exploded as in a real run (and the trace must still win:
//       a free check that real-time play matches stepped play). The game show is played with Enter
//       and 1/2/3, polled every 500 ms; each poll serialises the probe on the page's main thread,
//       which only adds to the measured times, so the check errs on the strict side.
//
//       Which browser. The default headless shell has no GPU here, so its canvas 2D is rastered
//       by Skia on the page's main thread, which the throttling slows fourfold: profiles put about
//       half of each frame in raster (inside setTransform / restore) and under 5% in the game's
//       own script. No phone the game targets rasters canvas 2D on the CPU, so the budget is
//       checked in Chromium with GPU canvas (SwiftShader in the GPU process: chrome://gpu must say
//       "Canvas: Hardware accelerated", or the test fails rather than measure the wrong thing).
//       SwiftShader itself limits that browser to about 10 frames a second, so the rAF interval
//       there measures the emulated GPU; the budget is checked on the main thread's cost of one
//       60 Hz frame instead: frame = render time + update time / ticks run in that frame (one
//       engine tick plus one draw; frames with no tick are skipped). The median must stay within
//       20 ms and the 95th percentile within 40 ms. The software-canvas runs are reported too
//       (rAF interval and per-frame work), not gated.
//   (b) Payload: bytes downloaded to play level 1 (a direct open of the level: the shell, fonts,
//       text, level data and level 1's atlases), and the whole game (every runtime file under
//       web/ that precache.json lists: atlases, JS, data, fonts, icons), which must stay under
//       15 MB (15,000,000 bytes, the stricter reading of the brief's "about 15 MB").
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PERF = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
const BUDGET = { median: 20, p95: 40 };
const PAYLOAD_BUDGET = 15_000_000;
const WARM_MS = 1000;
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const readJson = (ctx, rel) => JSON.parse(fs.readFileSync(path.join(ctx.web, rel), 'utf8'));

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] || 0;
  return { n: s.length, median: q(0.5), p95: q(0.95), max: s[s.length - 1] || 0 };
}
const fmt = s => `median ${s.median.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms, max ${s.max.toFixed(1)} ms (${s.n} frames)`;

// A page in `browser` that records console errors, page errors and failed HTTP requests.
async function openPage(browser) {
  const context = await browser.newContext(PERF);
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { context, page, errors };
}

// Records, per animation frame: the rAF timestamp, the frame callback's whole work time, the
// ticks it ran, their summed update time and the render time. The loop re-requests this._frame
// each frame and calls this.update / this.render, so wrapping the three properties is enough.
function installRecorder() {
  const loop = window.__test.app.loop;
  const rec = window.__perf = { frames: [], startedAt: null, stopped: false };
  let ticks = 0, updateMs = 0, renderMs = 0;
  const update = loop.update, render = loop.render, frame = loop._frame;
  loop.update = tick => { const t0 = performance.now(); update(tick); updateMs += performance.now() - t0; ticks++; };
  loop.render = alpha => { const t0 = performance.now(); render(alpha); renderMs += performance.now() - t0; };
  loop._frame = now => {
    ticks = 0; updateMs = 0; renderMs = 0;
    const t0 = performance.now();
    frame(now);
    if (rec.startedAt != null && !rec.stopped) rec.frames.push([now, performance.now() - t0, ticks, updateMs, renderMs, now - rec.startedAt]);
  };
}

// Replays a trace's per-tick actions from the first tick of play (stepCount 0), as the real-time
// loop runs; marks the recorder started at that moment and stopped when the trace runs out.
function installTrace(log) {
  const T = window.__test, loop = T.app.loop, rec = window.__perf;
  const orig = loop.update;
  let i = -1;
  loop.update = tick => {
    if (i < 0) {
      const p = T.probe('platform');
      if (p && p.ready && p.ui === 'play' && p.stepCount === 0) { i = 0; rec.startedAt = performance.now(); }
    }
    if (i >= 0 && i < log.length) T.hold(log[i] ? log[i].split(',') : []);
    else if (i >= log.length && !rec.stopped) { T.releaseAll(); rec.stopped = true; }
    if (i >= 0) i++;
    orig(tick);
  };
}

async function frameSamples(page) {
  const r = await page.evaluate(() => {
    const v = window.__test.app.view;
    return { frames: window.__perf.frames, quality: v.quality, canvas: [v.canvas.width, v.canvas.height] };
  });
  const warm = r.frames.filter(f => f[5] >= WARM_MS);
  const intervals = [];
  for (let k = 1; k < warm.length; k++) intervals.push(warm[k][0] - warm[k - 1][0]);
  const ticked = warm.filter(f => f[2] > 0);
  return {
    interval: stats(intervals), work: stats(warm.map(f => f[1])),
    frame60: stats(ticked.map(f => f[4] + f[3] / f[2])), tick: stats(ticked.map(f => f[3] / f[2])), render: stats(warm.map(f => f[4])),
    ticksPerFrame: ticked.reduce((n, f) => n + f[2], 0) / Math.max(1, ticked.length), view: r,
  };
}

// One level, real time: the briefing is up (the level waits at step 0), throttling and the
// recorders go in, Backspace skips the briefing, and the trace plays the level.
async function runLevel(ctx, browser, level, rate) {
  const trace = readJson(ctx, `tests/traces/${level}.json`);
  const { context, page, errors } = await openPage(browser);
  await page.goto(`${ctx.baseUrl}/index.html?lang=en&scene=platform&level=${level}&avatar=${trace.avatar}&seed=${trace.seed}`);
  await page.waitForFunction(() => { const p = window.__test && window.__test.probe('platform'); return p && p.ready && p.ui === 'intro'; }, null, { timeout: 60000 });
  assert((await page.evaluate(() => window.__test.probe('platform').stepCount)) === 0, 'the level ran under its briefing');
  const cdp = await context.newCDPSession(page);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.evaluate(installRecorder);
  await page.evaluate(installTrace, trace.log);
  // Backspace skips the briefing (a first press during the phone's grow animation only finishes it).
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__perf.startedAt != null)); i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
  }
  assert(await page.evaluate(() => window.__perf.startedAt != null), `${level}: the briefing did not lead to play`);
  await page.waitForFunction(() => window.__perf.stopped, null, { timeout: 90000 });
  const s = await frameSamples(page);
  const end = await page.evaluate(() => { const p = window.__test.probe('platform'); return { state: p.state, ui: p.ui, stepCount: p.stepCount, score: p.score }; });
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert(end.state === 'complete' && end.stepCount === trace.final.stepCount && end.score === trace.final.score,
    `${level}: the trace played in real time ended ${end.state} at step ${end.stepCount}, score ${end.score} (recorded: ${trace.final.state} at ${trace.final.stepCount}, score ${trace.final.score})`);
  assert(errors.length === 0, `${level}: console errors:\n${errors.join('\n')}`);
  await context.close();
  return { ...s, end };
}

// A game show round in real time: the host's lines are advanced with Enter and each question
// answered with 1, 2 or 3, as a player at a keyboard would, for about a dozen seconds of the show.
async function runGameshow(ctx, browser, rate, seconds = 12) {
  const { context, page, errors } = await openPage(browser);
  await page.goto(`${ctx.baseUrl}/index.html?lang=en&scene=gameshow&round=5&avatar=amy&nickname=Zoe&cpuName=Harry&seed=11`);
  await page.waitForFunction(() => { const p = window.__test && window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 60000 });
  const cdp = await context.newCDPSession(page);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.evaluate(installRecorder);
  await page.evaluate(() => { window.__perf.startedAt = performance.now(); });
  const seen = new Set();
  let answered = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < seconds * 1000) {
    const p = await page.evaluate(() => { const g = window.__test.probe('gameshow'); return { phase: g.phase, tick: g.tick, waiting: !!(g.talkie && g.talkie.waiting), accepting: !!(g.board && g.board.accepting) }; });
    seen.add(p.phase);
    if (p.phase === 'board' && p.accepting) { await page.keyboard.press(`Digit${1 + (answered++ % 3)}`); }
    else if ((p.phase === 'title' && p.tick >= 30) || p.waiting) await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => { window.__perf.stopped = true; });
  const s = await frameSamples(page);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert(seen.has('board') && answered > 0, `the game show never reached a question (phases ${[...seen]})`);
  assert(errors.length === 0, `game show: console errors:\n${errors.join('\n')}`);
  await context.close();
  return { ...s, phases: [...seen], answered };
}

const describe = (name, r) => {
  const extra = r.end ? `, trace won at step ${r.end.stepCount}` : `, phases ${r.phases.join(' ')}, ${r.answered} answers`;
  return `${name}: 60 Hz frame ${fmt(r.frame60)} [tick ${r.tick.median.toFixed(1)} ms, render ${r.render.median.toFixed(1)} ms median]; rAF interval ${fmt(r.interval)}; work per rAF ${fmt(r.work)}; ${r.ticksPerFrame.toFixed(1)} ticks per rAF; canvas ${r.view.canvas.join('x')}${extra}`;
};

export const tests = [
  {
    name: '(a) frame time under 4x CPU throttling at 1280x720, DPR 1, GPU canvas: level 10, level 7 and a game show round (real time); software canvas reported',
    timeoutMs: 600000,
    async run(ctx) {
      // Software canvas (the default headless shell): reported, not gated.
      const { context: c0, page: p0 } = await openPage(ctx.browser);
      const cores = await p0.evaluate(() => navigator.hardwareConcurrency);
      await c0.close();
      ctx.log(`${cores} logical CPUs`);
      const base = await runLevel(ctx, ctx.browser, 'alpha_level10', 1);
      ctx.log(`software canvas, unthrottled ${describe('level 10', base)}`);
      for (const [name, r] of [
        ['level 10', await runLevel(ctx, ctx.browser, 'alpha_level10', 4)],
        ['level 7', await runLevel(ctx, ctx.browser, 'alpha_level7', 4)],
        ['game show', await runGameshow(ctx, ctx.browser, 4)],
      ]) ctx.log(`software canvas, 4x throttled ${describe(name, r)}`);

      // GPU canvas: the budget.
      const gpu = await chromium.launch({ channel: 'chromium', args: GPU_ARGS });
      try {
        const { context, page } = await openPage(gpu);
        await page.goto('chrome://gpu');
        let status = '';
        for (let i = 0; i < 20 && !/Canvas:/.test(status); i++) {
          await page.waitForTimeout(250);
          status = await page.evaluate(() => { const v = document.querySelector('info-view'); return (v && v.shadowRoot ? v.shadowRoot.textContent : document.body.innerText) || ''; });
        }
        await context.close();
        const canvasLine = (/Canvas:\s*[^\n*]*/.exec(status) || ['Canvas: (not reported)'])[0].trim();
        assert(/Canvas:\s*Hardware accelerated/.test(status), `the GPU-canvas browser reports "${canvasLine}"; the frame budget cannot be checked here`);
        ctx.log(`GPU-canvas browser ${gpu.version()}: ${canvasLine}`);
        const over = [];
        for (const [name, r] of [
          ['level 10', await runLevel(ctx, gpu, 'alpha_level10', 4)],
          ['level 7', await runLevel(ctx, gpu, 'alpha_level7', 4)],
          ['game show', await runGameshow(ctx, gpu, 4)],
        ]) {
          ctx.log(`GPU canvas, 4x throttled ${describe(name, r)}`);
          assert(r.frame60.n > 20, `${name}: only ${r.frame60.n} frames sampled`);
          if (r.frame60.median > BUDGET.median || r.frame60.p95 > BUDGET.p95) over.push(`${name}: ${fmt(r.frame60)}`);
        }
        assert(over.length === 0, `over the frame budget (median ${BUDGET.median} ms, p95 ${BUDGET.p95} ms) with 4x CPU throttling:\n${over.join('\n')}`);
      } finally {
        await gpu.close();
      }
    },
  },
  {
    name: '(b) payload: level 1 downloads, and the whole game under 15 MB',
    timeoutMs: 120000,
    async run(ctx) {
      // Level 1 opened directly (the brief's "to play level 1"): everything the page fetched once
      // the level is loaded and its briefing is up. The runner serves files uncompressed.
      const { context, page, errors } = await ctx.openPage(PERF);
      await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en&scene=platform&level=alpha_level1&seed=1`);
      await page.waitForFunction(() => { const p = window.__test && window.__test.probe('platform'); return p && p.ready; }, null, { timeout: 30000 });
      await page.evaluate(() => window.__test.step(60));
      await page.waitForTimeout(1000);
      const level1 = await page.evaluate(() => {
        const out = { total: 0, files: 0, atlas: 0, js: 0, other: 0 };
        const add = (name, bytes) => {
          out.total += bytes; out.files++;
          if (/\/data\/atlas\//.test(name)) out.atlas += bytes; else if (/\.m?js$/.test(new URL(name).pathname)) out.js += bytes; else out.other += bytes;
        };
        for (const e of performance.getEntriesByType('navigation')) add(e.name, e.encodedBodySize);
        for (const e of performance.getEntriesByType('resource')) add(e.name, e.encodedBodySize);
        return out;
      });
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
      // The whole game: every runtime file (precache.json's install and first-use lists).
      const pre = readJson(ctx, 'precache.json');
      const size = f => fs.statSync(path.join(ctx.web, f === './' ? 'index.html' : f)).size;
      const install = pre.files.filter(f => f !== './').reduce((n, f) => n + size(f), 0);
      const lazy = pre.lazy.reduce((n, f) => n + size(f), 0);
      const total = install + lazy;
      const byKind = {};
      for (const f of [...pre.files.filter(f => f !== './'), ...pre.lazy]) {
        const k = f.startsWith('data/atlas/') ? 'atlases' : f.startsWith('js/') ? 'JS' : f.startsWith('data/') ? 'data' : f.startsWith('fonts/') ? 'fonts' : 'shell and icons';
        byKind[k] = (byKind[k] || 0) + size(f);
      }
      const mb = n => `${(n / 1e6).toFixed(2)} MB (${(n / 1048576).toFixed(2)} MiB)`;
      ctx.log(`level 1: ${mb(level1.total)} in ${level1.files} files (atlases ${mb(level1.atlas)}, JS ${mb(level1.js)}, other ${mb(level1.other)})`);
      ctx.log(`whole game: ${mb(total)} (${Object.entries(byKind).map(([k, v]) => `${k} ${mb(v)}`).join(', ')}); service worker install ${mb(install)}, first use ${mb(lazy)}; headroom ${((PAYLOAD_BUDGET - total) / 1000).toFixed(0)} kB`);
      assert(level1.total > 0 && level1.total <= total, `level 1 downloads ${level1.total} bytes`);
      assert(total <= PAYLOAD_BUDGET, `the game is ${mb(total)}, over the ${mb(PAYLOAD_BUDGET)} budget`);
    },
  },
];
