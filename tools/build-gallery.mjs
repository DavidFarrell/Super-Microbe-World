#!/usr/bin/env node
// Builds the fidelity gallery web/screenshots/index.html (dev-only; nothing here ships).
//
//   node tools/build-gallery.mjs                 take every remake screenshot, copy the Flash
//                                               references and write index.html
//   node tools/build-gallery.mjs --only kitchen*,ending   re-take only those sessions (ids below;
//                                                          a trailing * matches a prefix)
//   node tools/build-gallery.mjs --html-only     rewrite index.html (and the Flash copies) only
//
// Remake side: web/ is served on a local port and driven in the preinstalled Chromium through
// Playwright, exactly as the tests do (?manual=1, __test.step and the scene probes, real key
// presses and CDP touch taps; nothing is skipped by calling game code, except where a caption
// says so). Desktop shots are 1280 x 720; phone shots are a 915 x 412 landscape phone with touch
// emulation, saved at CSS size. Every shot is re-encoded to WebP in Chromium (there is no WebP
// encoder in Node here) into web/screenshots/remake/.
//
// Flash side: Ruffle captures of the original (reference/captures, see its index.md) and the
// screens composed from the original SWFs (web/screenshots/reference, see its index.md), copied as
// WebP into web/screenshots/flash/ so the page is self-contained.
//
// The gallery content (sections, pairs, what to compare, deliberate differences) is the GALLERY
// list at the bottom of this file. Chromium is the preinstalled one; never run
// "playwright install" in the development container (on your own machine it is fine).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'screenshots');
const REMAKE = path.join(OUT, 'remake');
const FLASH = path.join(OUT, 'flash');
const args = process.argv.slice(2);
const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1] : null; })();
const htmlOnly = args.includes('--html-only');
const QUALITY = 0.86;

const DESKTOP = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
const PHONE = {
  viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

// ---------------------------------------------------------------------------------------------
// Static server for web/ (as web/tests/run.mjs, or `npx serve web`).
// ---------------------------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css', '.svg': 'image/svg+xml',
};
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

// ---------------------------------------------------------------------------------------------
// WebP encoding in Chromium.
// ---------------------------------------------------------------------------------------------
let encoderPage = null;
async function toWebp(pngBuffer, quality = QUALITY) {
  const dataUrl = await encoderPage.evaluate(async ({ b64, q }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { url: c.toDataURL('image/webp', q), w: c.width, h: c.height };
  }, { b64: pngBuffer.toString('base64'), q: quality });
  return { data: Buffer.from(dataUrl.url.split(',')[1], 'base64'), w: dataUrl.w, h: dataUrl.h };
}

// ---------------------------------------------------------------------------------------------
// Session helper: one browser context, the page, and the stepping / probing helpers the specs use.
// ---------------------------------------------------------------------------------------------
class Session {
  constructor(browser, baseUrl, device) {
    this.browser = browser; this.baseUrl = baseUrl; this.device = device; this.errors = []; this.taken = [];
  }
  async open(query = '', { storage = null } = {}) {
    if (this.context) await this.context.close();
    this.context = await this.browser.newContext(this.device === 'phone' ? PHONE : DESKTOP);
    if (storage) {
      await this.context.addInitScript(v => {
        if (sessionStorage.getItem('seeded')) return;
        for (const [k, x] of Object.entries(v)) localStorage.setItem('smw:' + k, JSON.stringify(x));
        sessionStorage.setItem('seeded', '1');
      }, storage);
    }
    this.page = await this.context.newPage();
    this.page.on('console', m => { if (m.type() === 'error') this.errors.push(m.text()); });
    this.page.on('pageerror', e => this.errors.push(e.message));
    this.page.on('response', r => { if (r.status() >= 400) this.errors.push(`HTTP ${r.status()} ${r.url()}`); });
    this.cdp = this.device === 'phone' ? await this.context.newCDPSession(this.page) : null;
    await this.page.goto(`${this.baseUrl}/index.html?manual=1&lang=en${query}`);
    await this.page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 30000 });
    return this.page;
  }
  step(n = 1) { return this.page.evaluate(k => window.__test.step(k), n); }
  probe(name) { return this.page.evaluate(n => window.__test.probe(n), name); }
  scene() { return this.page.evaluate(() => window.__test.scene); }
  // Steps until predicate(__test) holds, yielding so fetches and decodes can finish.
  async until(predicate, what, { max = 3000, chunk = 4 } = {}) {
    const src = predicate.toString();
    for (let used = 0; used <= max; used += chunk) {
      const ok = await this.page.evaluate(s => { try { return !!(0, eval)(s)(window.__test); } catch { return false; } }, src);
      if (ok) return used;
      await this.step(chunk);
      if (used % 100 === 0) await this.page.waitForTimeout(5);
    }
    throw new Error(`timed out waiting for ${what} (scene ${await this.scene()})`);
  }
  async key(k, ticks = 2) { await this.page.keyboard.press(k); await this.step(ticks); }
  async tap(sel, fx = 0.5, fy = 0.5) {
    const b = await this.page.locator(sel).boundingBox();
    if (!b) throw new Error(`${sel} is not visible`);
    const x = b.x + b.width * fx, y = b.y + b.height * fy;
    if (this.cdp) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await this.page.mouse.click(x, y);
    }
  }
  // Takes a screenshot (after `wait` ms of real time for CSS transitions, which run on the wall
  // clock, not the stepped loop) and writes it as WebP.
  async shot(name, { wait = 400 } = {}) {
    await this.page.waitForTimeout(wait);
    const png = await this.page.screenshot({ scale: 'css', type: 'png' });
    const { data, w, h } = await toWebp(png);
    fs.writeFileSync(path.join(REMAKE, `${name}.webp`), data);
    this.taken.push(name);
    console.log(`    ${name}.webp  ${w}x${h}  ${(data.length / 1024).toFixed(0)} KB`);
  }
  async close() { if (this.context) await this.context.close(); this.context = null; }
}

const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// Replays a level's recorded winning trace (web/tests/traces) from tick `from` to `to`.
function replay(s, log, from, to) {
  return s.page.evaluate(({ log, from, to }) => {
    const T = window.__test;
    for (let i = from; i < to; i++) { T.hold(log[i] ? log[i].split(',') : []); T.step(1); }
    T.releaseAll();
    return T.probe('platform');
  }, { log, from, to });
}

async function openLevel(s, n, extra = '') {
  await s.open(`&scene=platform&level=alpha_level${n}&avatar=harry&seed=1${extra}`);
  await s.page.waitForFunction(() => window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
}

// Pages through a level's ePhone briefing with Space until its text matches `re`.
async function briefingTo(s, re, { touch = false } = {}) {
  await s.step(60);
  for (let i = 0; i < 40; i++) {
    const p = await s.probe('platform');
    if (p.intro && p.intro.phase === 'page' && re.test(p.intro.text)) return p;
    if (p.ui === 'play') throw new Error(`the briefing ended before ${re}`);
    if (p.intro && p.intro.phase === 'page') {
      if (touch) await s.tap('#pf-intro-next'); else await s.page.keyboard.press('Space');
    }
    await s.step(12);
  }
  throw new Error(`no briefing page matching ${re}`);
}

// Kitchen: puts the current item where it belongs (cling film first for meat), by mouse or tap.
async function kitchenPlace(s) {
  let p = await s.probe('kitchen');
  if (!p.current || p.state !== 'wait') { await s.step(2); return false; }
  if ((p.current.type === 7 || p.current.type === 9) && !p.current.clingfilm) {
    await s.tap('#kz-clingfilm'); await s.step(2);
    p = await s.probe('kitchen');
  }
  if (p.hands.sneeze || p.hands.meat) { await s.tap('#kz-sink'); await s.step(4); return false; }
  const before = p.placements.length;
  await s.tap(`#kz-${p.current.correct[0]}`);
  await s.step(3);
  return (await s.probe('kitchen')).placements.length > before;
}

async function kitchenIntroToPlay(s) {
  for (let i = 0; i < 20; i++) {
    const p = await s.probe('kitchen');
    if (p.mode === 'play') return;
    if (p.mode === 'tutorial') { await s.tap('#kz-fridgeDrawer'); await s.step(3); continue; }
    await s.tap('#kz-next'); await s.step(3);
  }
  throw new Error('the kitchen intro did not lead to play');
}

// A game show round opened through the scene contract (as web/tests/gameshow.spec.mjs does).
async function openShow(s, params) {
  await s.open('&scene=gameshow');
  await s.page.waitForFunction(() => window.__test.probe('gameshow'), null, { timeout: 30000 });
  await s.page.evaluate(p => window.__test.go('gameshow', { ...p, onComplete: () => {}, onQuit: () => {} }), params);
  await s.page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 30000 });
}
// Advances the host (Enter or a tap on the talkie) until the phase is one of `phases`.
async function showUntil(s, phases, { touch = false, max = 200 } = {}) {
  for (let i = 0; i < max; i++) {
    const p = await s.probe('gameshow');
    if (phases.includes(p.phase)) return p;
    if (p.phase === 'title' && p.tick >= 30) { if (touch) await s.tap('#gs-stage-tap'); else await s.page.keyboard.press('Enter'); }
    else if (p.talkie && p.talkie.waiting) { if (touch) await s.tap('#gs-talkie-tap', 0.5, 0.85); else await s.page.keyboard.press('Enter'); }
    await s.step(4);
  }
  throw new Error(`the game show did not reach ${phases}`);
}
// Lets the talkie finish typing the current page.
// (Predicates run in the page, so they cannot close over variables: one per scene.)
const TALKIE_DONE = {
  gameshow: t => { const p = t.probe('gameshow'); return p && p.talkie && p.talkie.complete; },
  cutscene: t => { const p = t.probe('cutscene'); return p && p.talkie && p.talkie.complete; },
};
async function talkieDone(s, name = 'gameshow') {
  await s.until(TALKIE_DONE[name], 'the host line', { max: 600 });
}

// Waits for the splash menu to wake and New Game to reach full alpha (frame 170, the stop()).
async function splashMenu(s) {
  await s.until(t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
  await s.until(t => t.probe('splash').menu && t.probe('splash').awake && t.probe('splash').frame >= 170, 'the splash menu', { max: 900 });
}

// ---------------------------------------------------------------------------------------------
// Sessions: each opens its own browser context and writes one or more named shots.
// ---------------------------------------------------------------------------------------------
const SESSIONS = [
  {
    id: 'splash', device: 'desktop',
    async run(s) {
      await s.open();
      await s.until(t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
      await s.until(t => t.probe('splash').frame >= 118, 'the tuning bars', { max: 600, chunk: 2 });
      await s.shot('splash-tuning', { wait: 100 });
      await splashMenu(s);
      await s.step(20);
      await s.shot('splash-menu', { wait: 900 });
    },
  },
  {
    id: 'splash-phone', device: 'phone',
    async run(s) {
      await s.open();
      await splashMenu(s);
      await s.step(20);
      await s.shot('splash-menu-phone', { wait: 900 });
    },
  },
  {
    id: 'cutscene', device: 'desktop',
    async run(s) {
      await s.open();
      await splashMenu(s);
      await s.key('Enter');
      await s.until(t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro' && t.probe('cutscene').ready, 'the cutscene');
      await talkieDone(s, 'cutscene');
      await s.step(10);
      await s.shot('cutscene-host');
      for (let i = 0; i < 40 && (await s.probe('cutscene')).phase === 'intro'; i++) { await s.key('Enter', 4); }
      await s.key('ArrowRight', 2);
      await s.step(24);
      await s.shot('cutscene-choose');
      await s.key('Enter', 2);
      for (let i = 0; i < 40 && (await s.probe('cutscene')).phase === 'chosen'; i++) { await s.key('Enter', 4); }
      await s.step(20);
      await s.shot('cutscene-form', { wait: 700 });
    },
  },
  {
    id: 'cutscene-phone', device: 'phone',
    async run(s) {
      await s.open();
      await splashMenu(s);
      await s.tap('#btn-new-game');
      await s.until(t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro' && t.probe('cutscene').ready, 'the cutscene');
      for (let i = 0; i < 60 && (await s.probe('cutscene')).phase === 'intro'; i++) {
        const c = await s.page.locator('#game').boundingBox();
        await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + c.width / 2, y: c.y + c.height * 0.84, id: 3 }] });
        await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await s.step(4);
      }
      await s.step(24);
      await s.shot('cutscene-choose-phone');
    },
  },
  {
    id: 'shrink', device: 'desktop',
    async run(s) {
      await s.open('&scene=shrink&avatar=harry&round=1');
      await s.until(t => t.probe('shrink') && t.probe('shrink').ready, 'the shrinking zone art');
      await s.until(t => t.probe('shrink').frame >= 38, 'the shrink under way', { max: 900, chunk: 2 });
      await s.shot('shrink', { wait: 100 });
    },
  },
  ...Array.from({ length: 10 }, (_, i) => i + 1).map(n => ({
    id: `level${n}`, device: 'desktop',
    async run(s) {
      // The opening view: the level with the briefing skipped, after the player has landed.
      await openLevel(s, n, '&intro=0');
      await s.step(40);
      await s.shot(`level${n}-opening`, { wait: 150 });
      // A gameplay moment: the level's winning input trace replayed to a point part way through.
      const trace = readJson(`web/tests/traces/alpha_level${n}.json`);
      await s.open(`&${trace.query.replace(/(^|&)manual=1/, '')}`);
      await s.page.waitForFunction(() => window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
      let at = Math.round(trace.log.length * (MOMENT[n] ?? 0.45));
      let p = await replay(s, trace.log, 0, at);
      // Moves on a tick at a time while the player is above the top of the screen or an
      // antibiotic's whiteout fills it.
      for (let k = 0; k < 160 && at < trace.log.length - 1 && (p.player.y < 40 || p.whiteout > 0); k++) p = await replay(s, trace.log, at, ++at);
      await s.shot(`level${n}-play`, { wait: 150 });
      if (n === 1 || n === 10) {
        await replay(s, trace.log, at, trace.log.length);
        const used = await s.page.evaluate(() => window.__test.stepUntil(t => t.probe('platform').ui === 'complete', 400));
        if (used < 0) throw new Error('no level-complete card');
        await s.step(30);
        await s.shot(`level${n}-complete`, { wait: 1400 });
      }
    },
  })),
  {
    id: 'briefing', device: 'desktop',
    async run(s) {
      await openLevel(s, 1);
      await briefingTo(s, /Lucy is a bacteria/);
      await s.step(110);                           // the page text types in
      await s.shot('briefing-level1', { wait: 150 });
      await openLevel(s, 10);
      await briefingTo(s, /really sick/);
      await s.step(110);
      await s.shot('briefing-level10', { wait: 150 });
    },
  },
  {
    id: 'briefing-phone', device: 'phone',
    async run(s) {
      await openLevel(s, 1);
      await briefingTo(s, /press the|tap the camera/i, { touch: true });
      await s.step(110);
      await s.shot('briefing-level1-phone', { wait: 150 });
    },
  },
  {
    id: 'layout', device: 'desktop',
    async run(s) {
      await openLevel(s, 1, '&intro=0');
      await s.step(20);
      await s.key('ArrowRight', 30);
      await s.step(10);
      await s.shot('layout-keyboard-desktop', { wait: 150 });
      await s.key('Escape', 2);
      await s.shot('pause-desktop', { wait: 700 });
      await s.page.locator('#pf-settings').click();
      await s.step(2);
      await s.shot('pause-settings-desktop', { wait: 600 });
    },
  },
  {
    id: 'layout-phone', device: 'phone',
    async run(s) {
      await openLevel(s, 1, '&intro=0');
      await s.step(40);
      await s.shot('layout-touch-phone', { wait: 150 });
      await s.tap('#touch-pause');
      await s.step(2);
      await s.shot('pause-phone', { wait: 700 });
    },
  },
  {
    id: 'settings', device: 'desktop',
    async run(s) {
      await s.open('&scene=settings');
      await s.until(t => t.probe('settings'), 'the settings');
      await s.step(10);
      await s.shot('settings-sound', { wait: 600 });
      await s.page.locator('#settings-tab-controls').click();
      await s.step(4);
      await s.shot('settings-controls', { wait: 500 });
    },
  },
  {
    id: 'settings-phone', device: 'phone',
    async run(s) {
      await s.open('&scene=settings');
      await s.until(t => t.probe('settings'), 'the settings');
      await s.tap('#settings-tab-display');
      await s.step(6);
      await s.shot('settings-display-phone', { wait: 600 });
    },
  },
  {
    id: 'summary-time', device: 'desktop',
    async run(s) {
      // Amy, round 1, level 1, left alone until the clock runs out (as capture 509).
      const run = { avatar: 'amy', nickname: '', round: 0, part: 0, step: 'action', quiz: 0, cpu: 0, hover: 0, kitchen: 0, seed: 7 };
      await s.open('', { storage: { progress: { v: 1, run, unlocked: ['alpha_level1'], best: {}, shrinkSeen: true } } });
      await splashMenu(s);
      await s.page.click('#btn-continue');
      await s.until(t => t.scene === 'platform' && t.probe('platform') && t.probe('platform').ready, 'level 1');
      for (let i = 0; i < 30 && (await s.probe('platform')).ui !== 'play'; i++) await s.key('Escape', 10);
      await s.until(t => t.scene === 'summary', 'the summary page', { max: 13000, chunk: 500 });
      await s.step(30);
      await s.shot('summary-time', { wait: 900 });
    },
  },
  {
    id: 'summary-died', device: 'desktop',
    async run(s) {
      // Level 5 part way through, then the summary card the flow opens after a death, with the
      // flow's own parameters (kind 'died', the frozen level behind it). Losing three lives on
      // purpose through the bot is not needed to show the card.
      const trace = readJson('web/tests/traces/alpha_level5.json');
      await s.open(`&${trace.query.replace(/(^|&)manual=1/, '')}`);
      await s.page.waitForFunction(() => window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
      await replay(s, trace.log, 0, Math.round(trace.log.length * 0.3));
      await s.page.evaluate(() => {
        const src = window.__test.app.view.canvas;
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        const p = window.__test.probe('platform');
        window.__test.go('summary', { kind: 'died', result: { level: 'alpha_level5', score: p.score, reason: 1 }, backdrop: c, buttons: ['retry'], onComplete: () => {} });
      });
      await s.until(t => t.scene === 'summary' && t.probe('summary') && t.probe('summary').ready, 'the summary card');
      await s.step(40);
      await s.shot('summary-died', { wait: 900 });
    },
  },
  {
    id: 'gameshow', device: 'desktop',
    async run(s) {
      await openShow(s, { round: 1, avatar: 'harry', nickname: 'Harry', cpuName: 'Amy', playerScore: 0, cpuScore: 0, seed: 3 });
      await s.until(t => t.probe('gameshow').phase === 'title' && t.probe('gameshow').tick >= 40, 'the title card', { max: 400 });
      await s.shot('gameshow-title', { wait: 500 });
      await showUntil(s, ['intro']);
      await talkieDone(s);
      await s.shot('gameshow-studio', { wait: 150 });
      await showUntil(s, ['board']);
      await s.until(t => t.probe('gameshow').board && t.probe('gameshow').board.accepting, 'the answers', { max: 600 });
      await s.step(10);
      await s.shot('gameshow-board', { wait: 500 });
      await s.key('Digit3', 2);                    // Disagree: the correct answer to question 1
      await showUntil(s, ['response']);
      await talkieDone(s);
      await s.step(20);
      await s.shot('gameshow-verdict', { wait: 200 });
      await showUntil(s, ['cpu']);
      await talkieDone(s);
      await s.step(20);
      await s.shot('gameshow-cpu', { wait: 200 });
    },
  },
  {
    id: 'gameshow-phone', device: 'phone',
    async run(s) {
      await openShow(s, { round: 1, avatar: 'amy', nickname: 'Amy', cpuName: 'Harry', playerScore: 0, cpuScore: 0, seed: 3 });
      await showUntil(s, ['board'], { touch: true });
      await s.until(t => t.probe('gameshow').board && t.probe('gameshow').board.accepting, 'the answers', { max: 600 });
      await s.step(10);
      await s.shot('gameshow-board-phone', { wait: 500 });
    },
  },
  ...[0, 1, 2, 3].map(level => ({
    id: `kitchen${level}`, device: 'desktop',
    async run(s) {
      await s.open(`&scene=kitchen&level=${level}&seed=${[11, 10, 10, 296][level]}&avatar=harry`);
      await s.page.waitForFunction(() => { const p = window.__test.probe('kitchen'); return p && p.ready && p.mode === 'intro'; }, null, { timeout: 30000 });
      await s.step(30);
      await s.shot(`kitchen${level}-intro`, { wait: 700 });
      if (level === 0) {
        // Through the intro screens to the tutorial (the spring onion), then play.
        for (let i = 0; i < 10 && (await s.probe('kitchen')).mode === 'intro'; i++) { await s.tap('#kz-next'); await s.step(3); }
        await s.step(10);
        await s.shot('kitchen0-tutorial', { wait: 500 });
        await kitchenIntroToPlay(s);
        let placed = 0;
        for (let i = 0; i < 200 && placed < 3; i++) if (await kitchenPlace(s)) placed++;
        await s.step(30);
        await s.shot('kitchen0-play', { wait: 300 });
        for (let i = 0; i < 400 && (await s.probe('kitchen')).mode === 'play'; i++) await kitchenPlace(s);
        await s.until(t => t.probe('kitchen').mode === 'outro', 'the outro', { max: 300 });
        await s.step(20);
        await s.shot('kitchen0-outro1', { wait: 900 });
      }
      if (level === 1) {
        // Waits (idle) for a sneeze, as capture 619 does.
        await kitchenIntroToPlay(s);
        await s.until(t => t.probe('kitchen').state === 'sneeze', 'a sneeze', { max: 4000, chunk: 10 });
        await s.step(12);
        await s.shot('kitchen1-sneeze', { wait: 200 });
      }
      if (level === 2) {
        // Cling film on the first piece of meat, as capture 631.
        await kitchenIntroToPlay(s);
        for (let i = 0; i < 200; i++) {
          const p = await s.probe('kitchen');
          if (p.mode !== 'play') break;
          if (p.current && p.state === 'wait' && (p.current.type === 7 || p.current.type === 9)) {
            await s.tap('#kz-clingfilm'); await s.step(30);
            await s.shot('kitchen2-clingfilm', { wait: 200 });
            break;
          }
          await kitchenPlace(s);
        }
      }
    },
  })),
  {
    id: 'kitchen-phone', device: 'phone',
    async run(s) {
      await s.open('&scene=kitchen&level=3&seed=296&avatar=amy');
      await s.page.waitForFunction(() => { const p = window.__test.probe('kitchen'); return p && p.ready && p.mode === 'intro'; }, null, { timeout: 30000 });
      await kitchenIntroToPlay(s);
      let placed = 0;
      for (let i = 0; i < 300 && placed < 6; i++) if (await kitchenPlace(s)) placed++;
      await s.step(30);
      await s.shot('kitchen3-play-phone', { wait: 300 });
    },
  },
  {
    id: 'ending', device: 'desktop',
    async run(s) {
      await s.open('&scene=ending&playerScore=90&cpuScore=40&hoverScore=642&kitchenScore=280&avatar=harry&nickname=Harry');
      await s.until(t => t.probe('ending') && t.probe('ending').phase === 'line', 'the ending');
      await s.step(330);                           // the line types at 40 ms a character
      await s.shot('ending-line', { wait: 150 });
      for (let i = 0; i < 10 && !(await s.probe('ending')).card; i++) await s.key('Enter', 4);
      await s.step(60);
      await s.shot('ending-card', { wait: 900 });
    },
  },
  {
    id: 'level-select', device: 'desktop',
    async run(s) {
      const unlocked = ['alpha_level1', 'alpha_level2', 'alpha_level3', 'alpha_level4', 'alpha_level5', 'alpha_level6', 'kitchen0', 'kitchen1'];
      const best = { alpha_level1: 140, alpha_level2: 95, alpha_level3: 120, alpha_level4: 88, alpha_level5: 176, kitchen0: 90 };
      await s.open('', { storage: { progress: { v: 1, run: null, unlocked, best, finished: 0, shrinkSeen: true } } });
      await splashMenu(s);
      await s.page.click('#btn-level-select');
      await s.until(t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready, 'level select');
      await s.page.waitForFunction(() => window.__test.probe('levelSelect').cards.filter(c => c.thumb).length >= 14, null, { timeout: 30000 });
      await s.step(30);
      await s.shot('level-select', { wait: 700 });
    },
  },
  {
    id: 'level-select-phone', device: 'phone',
    async run(s) {
      const unlocked = ['alpha_level1', 'alpha_level2', 'alpha_level3', 'kitchen0'];
      await s.open('', { storage: { progress: { v: 1, run: null, unlocked, best: { alpha_level1: 140 }, finished: 0, shrinkSeen: true } } });
      await splashMenu(s);
      await s.tap('#btn-level-select');
      await s.until(t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready, 'level select');
      await s.page.waitForFunction(() => window.__test.probe('levelSelect').cards.filter(c => c.thumb).length >= 14, null, { timeout: 30000 });
      await s.step(30);
      await s.shot('level-select-phone', { wait: 700 });
    },
  },
];

// Fraction of each level's trace at which the gameplay moment is taken (chosen to show action).
const MOMENT = { 1: 0.45, 2: 0.5, 3: 0.45, 4: 0.5, 5: 0.4, 6: 0.45, 7: 0.45, 8: 0.6, 9: 0.5, 10: 0.4 };

// ---------------------------------------------------------------------------------------------
// Flash references: copied (as WebP) into web/screenshots/flash/.
// ---------------------------------------------------------------------------------------------
function flashName(src) {
  const base = path.basename(src).replace(/\.png$/, '');
  return src.startsWith('web/screenshots/reference/') ? `composed-${base}` : base;
}
async function copyFlash(sources) {
  fs.mkdirSync(FLASH, { recursive: true });
  const dims = {};
  for (const src of sources) {
    const out = path.join(FLASH, `${flashName(src)}.webp`);
    const { data, w, h } = await toWebp(fs.readFileSync(path.join(ROOT, src)), 0.9);
    fs.writeFileSync(out, data);
    dims[src] = { w, h };
  }
  return dims;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
fs.mkdirSync(REMAKE, { recursive: true });
const { GALLERY, renderHtml } = await import('./gallery-content.mjs');
const server = await serve();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
try {
  const ctx = await browser.newContext();
  encoderPage = await ctx.newPage();
  await encoderPage.goto(`${baseUrl}/manifest.webmanifest`);
  if (!htmlOnly) {
    for (const sess of SESSIONS) {
      if (only && !only.split(',').some(o => (o.endsWith('*') ? sess.id.startsWith(o.slice(0, -1)) : sess.id === o))) continue;
      const t0 = Date.now();
      console.log(`${sess.id} (${sess.device})`);
      const s = new Session(browser, baseUrl, sess.device);
      try {
        await sess.run(s);
        if (s.errors.length) console.log(`    console errors:\n      ${s.errors.join('\n      ')}`);
      } catch (e) {
        failures.push(`${sess.id}: ${e.message}`);
        console.log(`    FAILED: ${e.message}`);
      } finally {
        await s.close();
      }
      console.log(`    ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  }
  const sources = [...new Set(GALLERY.flatMap(sec => sec.entries.flatMap(e => [...(e.flash || []), ...(e.rows || []).flatMap(r => r.flash)].map(f => f.src))))];
  const dims = await copyFlash(sources);
  const missing = [];
  const html = renderHtml({
    flashImage: src => ({ file: `flash/${flashName(src)}.webp`, ...dims[src] }),
    remakeImage: name => {
      const file = path.join(REMAKE, `${name}.webp`);
      if (!fs.existsSync(file)) { missing.push(name); return null; }
      const b = fs.readFileSync(file);
      // VP8/VP8L/VP8X header dimensions.
      const kind = b.toString('ascii', 12, 16);
      let w = 0, h = 0;
      if (kind === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
      else if (kind === 'VP8L') { const v = b.readUInt32LE(21); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
      else if (kind === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
      return { file: `remake/${name}.webp`, w, h };
    },
  });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`wrote web/screenshots/index.html (${sources.length} Flash references)`);
  if (missing.length) console.log(`missing remake shots: ${missing.join(', ')}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.log(`\n${failures.length} session(s) failed:\n  ${failures.join('\n  ')}`); process.exitCode = 1; }
