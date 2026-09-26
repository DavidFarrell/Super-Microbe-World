#!/usr/bin/env node
// Drives the original 2009 Flash game ("e-Bug Junior Game" / Super Microbe World) in Ruffle
// with real mouse and keyboard input and saves numbered reference screenshots.
//
//   NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs <mode> [options]
//
// Modes
//   main        Full playthrough of movies/e-Bug Junior Game.swf: loader, splash, cutscene,
//               5 quiz rounds (blind and sighted), shrinking zone, platform levels 1-10
//               (opening view of each, then the game's own Home-key "end level" cheat),
//               kitchen game levels 0-3 (played by the script), final host line, restart.
//   standalone  Each standalone SWF in movies/ on its own at a few time offsets.
//   level       Loads movies/introductionToMicrobes_platformer.swf on its own with the flashvar
//               level=<file> and starts it through Ruffle's context menu "Play" (see flash-ruffle.md).
//               Default alpha_level1.xml (every intro page) and alpha_level11.xml (in no chain).
//   editor      movies/EBug Level Editor.swf with each alpha_levelN.xml chosen through its
//               FileReference.browse() file dialog (answered by Playwright); captures the layout.
//   kitchen     movies/KitchenGame.swf on its own, played through its four levels (test mode).
//   timeout     Short variant: choose Amy, answer the first blind round, enter level 1, idle
//               until the 180 s timer runs out, capture the "You ran out of time." summary page,
//               click it and capture the restarted level.
//
// Options
//   --avatar=harry|amy   avatar chosen in the cutscene (main default harry, timeout forces amy)
//   --until=<stage>      stop after a stage: splash, cutscene, round1-blind, level1, round1, ...
//   --no-hires           skip the 2x captures (by default every capture flagged "hi" is also saved
//                        as <nnn>-<name>@2x.png: the viewport is enlarged to twice the stage size for
//                        one screenshot so Ruffle redraws the vector art at 2x, then restored)
//   --dsf=2              alternative: render the whole run at deviceScaleFactor 2 and save only the
//                        "hi" captures (about half as fast again under SwiftShader; not used)
//   --out=<dir>          default reference/captures
//   --prefix=<n>         first capture number (default: main 1, standalone 300, level 400, editor 450,
//                        timeout 500, kitchen 600)
//   --shim=off           serve the untouched platformer (see swf-shim.cjs: levels then have no tiles)
//   --ruffle=<folder>    use another @ruffle-rs/ruffle build (e.g. an unpacked nightly) instead of node_modules
//   --level=a.xml,b.xml  levels for the "level" and "editor" modes
//   --only=a,b           standalone mode: only SWFs whose file name contains one of these
//   --verbose            print every AVM1 trace as it arrives
//
// Everything is driven by what the page shows (pixel probes on screenshots) and by the SWFs'
// own trace() output, which Ruffle forwards to the console at log level "info".
// It needs the harness in this folder, the npm package @ruffle-rs/ruffle in node_modules and the
// preinstalled Playwright Chromium. Research-data POSTs to e-bug.eu are aborted.

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MOVIES = '/reference/Junior_Game/movies/';
const args = Object.fromEntries(process.argv.slice(3).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const MODE = process.argv[2] || 'main';
const DSF = +(args.dsf || 1);
const OUT = path.resolve(ROOT, args.out || 'reference/captures');
const AVATAR = MODE === 'timeout' ? 'amy' : (args.avatar || 'harry');
const UNTIL = args.until || '';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- static server
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash', '.xml': 'text/xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const RUFFLE_DIR = args.ruffle ? path.resolve(String(args.ruffle)) : null;   // --ruffle=<folder of another @ruffle-rs/ruffle build>
function serve() {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const p = RUFFLE_DIR && u.startsWith('/__ruffle/') ? path.join(RUFFLE_DIR, u.slice(10)) : path.join(ROOT, u);
    if (!(p.startsWith(ROOT) || (RUFFLE_DIR && p.startsWith(RUFFLE_DIR))) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

// ---------------------------------------------------------------- Ruffle shim: shared library imports
// The platformer attaches tiles and icons exported by junior_game_assets.swf, relying on Flash
// Player's shared-library behaviour, which Ruffle does not reproduce (details in swf-shim.cjs and
// reference/analysis/flash-ruffle.md). By default the script serves a merged copy of the platformer
// built in memory by swf-shim.cjs; --shim=off serves the untouched file.
const { mergeSharedLibrary } = require('./swf-shim.cjs');
let SHIM_CACHE = null;
function shimmedPlatformer() {
  if (!SHIM_CACHE) {
    const m = path.join(ROOT, 'reference/Junior_Game/movies');
    SHIM_CACHE = mergeSharedLibrary(fs.readFileSync(path.join(m, 'introductionToMicrobes_platformer.swf')), fs.readFileSync(path.join(m, 'junior_game_assets.swf')));
  }
  return SHIM_CACHE;
}
const SHIM = args.shim !== 'off';

// ---------------------------------------------------------------- session
class Session {
  constructor() { this.traces = []; this.waiters = []; this.ruffleLog = new Map(); this.physics = []; this.manifest = []; this.timings = []; this.n = +(args.prefix || { main: 1, standalone: 300, level: 400, editor: 450, timeout: 500, kitchen: 600 }[MODE] || 1); }

  async open(swf, vars = '', { delaySwfMs = 0, viewport = { width: 800, height: 450 } } = {}) {
    this.server = this.server || await serve();
    this.browser = this.browser || await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl'] });
    if (this.context) await this.context.close();
    this.context = await this.browser.newContext({ viewport, deviceScaleFactor: DSF, locale: 'en-GB' }); this.viewport = viewport;
    const page = this.page = await this.context.newPage();
    this.traces = []; this.waiters = []; this.t0 = Date.now(); this.swf = swf;
    await page.route(/e-bug\.eu/, r => r.abort());
    if (SHIM) await page.route(/introductionToMicrobes_platformer\.swf$/, async r => { const { swf, stats } = shimmedPlatformer(); this.log(`shim: serving merged platformer ${JSON.stringify(stats)}`); if (delaySwfMs) await new Promise(x => setTimeout(x, delaySwfMs)); r.fulfill({ body: swf, contentType: 'application/x-shockwave-flash' }); });
    if (delaySwfMs) await page.route(/\/movies\/(?!e-Bug%20Junior%20Game|introductionToMicrobes_platformer).*\.swf$/, async r => { await new Promise(x => setTimeout(x, delaySwfMs)); r.continue(); });
    page.on('console', m => this.onConsole(m.text()));
    page.on('pageerror', e => this.log('pageerror: ' + e.message));
    page.on('requestfailed', r => { if (!/e-bug\.eu/.test(r.url())) this.log('requestfailed: ' + r.url()); });
    page.on('response', r => { if (r.status() >= 400) this.log(`HTTP ${r.status()} ${r.url()}`); });
    const port = this.server.address().port;
    const base = `http://localhost:${port}${MOVIES}`;
    await page.goto(`http://localhost:${port}/tools/ruffle/harness.html?log=info${RUFFLE_DIR ? '&ruffle=/__ruffle/' : ''}&swf=${encodeURIComponent(swf)}&base=${encodeURIComponent(base)}&vars=${encodeURIComponent(vars)}`);
    // Ruffle shows a "hardware acceleration is disabled" .modal under SwiftShader. While it is open
    // it swallows pointer input and blocks the context menu, so keep it hidden (class, not removal).
    await page.evaluate(() => setInterval(() => { const m = window.__ruffle?.shadowRoot?.getElementById('hardware-acceleration-modal'); if (m && !m.classList.contains('hidden')) m.classList.add('hidden'); }, 50));
    return page;
  }

  onConsole(text) {
    if (/Total physics/.test(text)) { this.physics.push(Date.now()); return; }
    const clean = text.replace(/%c/g, '').replace(/(color|background|font-style): [^;]*;?/g, '').replace(/\s+$/, '');
    const m = clean.match(/log_adapter\.rs:\d+\s?(.*)$/s);
    if (m) {
      const msg = m[1].trim();
      const entry = { t: this.now(), msg };
      this.traces.push(entry);
      if (args.verbose) console.log(`  [trace ${entry.t}] ${msg.slice(0, 160)}`);
      for (const w of [...this.waiters]) if (w.re.test(msg)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(entry); }
      return;
    }
    const k = clean.replace(/^(WARN|ERROR|INFO)\s+/, '$1 ').replace(/localhost:\d+/g, 'localhost');
    if (/^(WARN|ERROR)/.test(k)) {
      const key = k.replace(/Unable to attach '[^']*'/, "Unable to attach '<symbol>'").replace(/non-registered character \S+/, 'non-registered character <symbol>');
      const v = this.ruffleLog.get(key) || { count: 0, first: this.now(), example: k.slice(0, 200), names: new Set() };
      v.count++; this.ruffleLog.set(key, v);
      const nm = k.match(/Unable to attach '([^']*)'|non-registered character (\S+)|Frame label '"?([^'"]*)"?' not found/);
      if (nm && v.names.size < 60) v.names.add(nm[1] || nm[2] || nm[3]);
    }
  }

  now() { return +((Date.now() - this.t0) / 1000).toFixed(2); }
  log(s) { console.log(`[${String(this.now()).padStart(7)}] ${s}`); }
  timing(what, seconds) { this.timings.push({ swf: this.swf, what, seconds: +(+seconds).toFixed(2) }); this.log(`TIMING ${what}: ${(+seconds).toFixed(2)} s`); }
  wait(ms) { return this.page.waitForTimeout(ms); }

  waitTrace(re, timeout = 30000, { since = null } = {}) {
    if (since !== null) { const hit = this.traces.slice(since).find(e => re.test(e.msg)); if (hit) return Promise.resolve(hit); }
    return new Promise((resolve, reject) => {
      const w = { re, resolve };
      this.waiters.push(w);
      setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); reject(new Error(`timeout waiting for trace ${re}`)); } }, timeout);
    });
  }
  mark() { return this.traces.length; }
  seen(re, since = 0) { return this.traces.slice(since).some(e => re.test(e.msg)); }

  // Save a capture. hi = also wanted at 2x (only those are saved when --dsf=2).
  async shot(name, desc, { hi = false } = {}) {
    const id = String(this.n++).padStart(3, '0');
    const t = this.now();
    if (DSF === 1) {
      const file = `${id}-${name}.png`;
      await this.page.screenshot({ path: path.join(OUT, file) });
      const entry = { file, desc, t, swf: this.swf, hi };
      this.manifest.push(entry);
      this.log(`shot ${file}  ${desc}`);
      if (hi && !args['no-hires']) {
        // 2x render of the same moment: enlarge the viewport so Ruffle redraws the vector stage at twice
        // the size (showAll scaling), capture, and restore. Cheaper than a whole run at deviceScaleFactor 2.
        const v = this.viewport;
        await this.page.setViewportSize({ width: v.width * 2, height: v.height * 2 });
        await this.wait(900);
        entry.hires = `${id}-${name}@2x.png`;
        await this.page.screenshot({ path: path.join(OUT, entry.hires) });
        await this.page.setViewportSize(v);
        await this.wait(400);
      }
    } else if (hi) {
      const file = `${id}-${name}@2x.png`;
      await this.page.screenshot({ path: path.join(OUT, file) });
      this.manifest.push({ file, desc, t, swf: this.swf, hi });
      this.log(`shot ${file}  ${desc}`);
    }
    return id;
  }

  // Pixel probes: screenshot, decode in the page, return [r,g,b] per point (CSS pixels).
  async probe(points) {
    const buf = await this.page.screenshot({ scale: 'css' });
    return this.page.evaluate(async ({ b64, points }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return points.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]);
    }, { b64: buf.toString('base64'), points });
  }
  async region(clip) { return this.page.screenshot({ clip, scale: 'css' }); }
  async waitStable(clip, { gap = 350, timeout = 20000 } = {}) {
    const start = Date.now(); let prev = await this.region(clip);
    while (Date.now() - start < timeout) { await this.wait(gap); const cur = await this.region(clip); if (cur.equals(prev)) return (Date.now() - start) / 1000; prev = cur; }
    throw new Error('region never stabilised ' + JSON.stringify(clip));
  }
  async waitChange(clip, before, { timeout = 8000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) { const cur = await this.region(clip); if (!cur.equals(before)) return (Date.now() - start) / 1000; await this.wait(60); }
    return null;
  }
  async click(x, y, label = '') { await this.page.mouse.click(x, y); if (label) this.log(`click ${label} (${x},${y})`); }
  async key(k, ms = 0) { if (ms) { await this.page.keyboard.down(k); await this.wait(ms); await this.page.keyboard.up(k); } else await this.page.keyboard.press(k); }
  async hover(x, y) { await this.page.mouse.move(x, y, { steps: 4 }); }

  async fail(where, err) {
    const f = path.join(OUT, `_fail-${MODE}-${where}.png`);
    try { await this.page.screenshot({ path: f }); } catch {}
    console.log(`FAILED at ${where}: ${err && err.stack || err}\nlast traces:\n` + this.traces.slice(-40).map(e => `  ${e.t} ${e.msg.slice(0, 160)}`).join('\n'));
  }

  async close() {
    const report = {
      mode: MODE, dsf: DSF, avatar: AVATAR, when: new Date().toISOString(),
      captures: this.manifest, timings: this.timings,
      ruffleWarnings: [...this.ruffleLog.entries()].map(([k, v]) => ({ message: k.slice(0, 220), count: v.count, firstSeen: v.first, ...(v.names.size ? { names: [...v.names] } : {}) })),
      platformerLoop: physicsStats(this.physics), quirks: QUIRKS,
      traces: compactTraces(this.traces),
    };
    fs.writeFileSync(path.join(OUT, `_manifest-${MODE}${DSF === 2 ? '@2x' : ''}.json`), JSON.stringify(report, null, 1));
    if (this.browser) await this.browser.close();
    if (this.server) this.server.close();
  }
}

// AVM1 trace() output with consecutive repeats folded ("There were: 0" is traced on every platformer loop)
function compactTraces(list) {
  const out = [];
  for (const e of list) { const last = out[out.length - 1]; if (last && last.msg === e.msg) { last.repeats = (last.repeats || 1) + 1; last.until = e.t; } else out.push({ t: e.t, msg: e.msg.slice(0, 300) }); }
  return out;
}
function physicsStats(ts) {
  if (ts.length < 20) return { samples: ts.length };
  // per-second counts over windows where the loop was clearly running
  const buckets = new Map(); for (const t of ts) { const k = Math.floor(t / 1000); buckets.set(k, (buckets.get(k) || 0) + 1); }
  const counts = [...buckets.values()].filter(c => c > 5).sort((a, b) => a - b);
  return { samples: ts.length, secondsRunning: counts.length, callsPerSecondMedian: counts[Math.floor(counts.length / 2)], min: counts[0], max: counts[counts.length - 1] };
}

// ---------------------------------------------------------------- screen knowledge (stage px)
const TALK_TEXT = { x: 26, y: 352, width: 680, height: 88 };      // talkie text, excludes the blinking arrow
const TALK_CLICK = [400, 395];                                     // big_invisible_button over the talkie
const NEW_GAME = [262, 263];
const SUBMIT = [505, 312];
const AVATAR_BTN = { amy: [510, 200], harry: [640, 205] };
const BOARD = { agree: [400, 0], dontknow: [400, 0], disagree: [400, 0] }; // filled in after the first board capture
const CLICK_BUTTON_KITCHEN = [400, 0];

const S = new Session();
const stopAfter = stage => { if (UNTIL && UNTIL === stage) { S.log(`--until=${stage} reached`); throw new StopJourney(); } };
class StopJourney extends Error {}

// ---------------------------------------------------------------- building blocks
// Is the talkie on screen? Its speaker box sits at (18..205, 308..335).
async function talkieVisible() {
  const [a, b] = await S.probe([[30, 320], [190, 330]]);
  return JSON.stringify([a, b]);
}

// The typewriter (Talkie.update, one character per frame) is finished when the text has been still
// for 1.6 s and, when the line length is known, at least len/12 s have passed since the line
// started (nominal 25 characters per second; Ruffle under SwiftShader manages about 15-20).
// The blinking "next" arrow is NOT a completion signal: Talkie.init() calls play() from frame 10
// ("start") and the timeline stops on frame 20 ("wait_for_click", the arrow) after ten frames,
// so the arrow is already blinking while a long line is still being typed.
async function waitTalkComplete({ len = 0, timeout = 60000 } = {}) {
  const t0 = Date.now(); let prev = await S.region(TALK_TEXT); let lastChange = Date.now();
  for (;;) {
    await S.wait(250);
    const cur = await S.region(TALK_TEXT);
    if (!cur.equals(prev)) { lastChange = Date.now(); prev = cur; }
    if (Date.now() - lastChange > 1600 && Date.now() - t0 > (len / 12) * 1000) return (lastChange - t0) / 1000;
    if (Date.now() - t0 > timeout) throw new Error('talkie never finished typing');
  }
}
const QUIRKS = [];
async function talk(name, desc, { hi = false, shoot = true, len = 0 } = {}) {
  await waitTalkComplete({ len });
  if (shoot) await S.shot(name, desc, { hi });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const before = await S.region(TALK_TEXT);
    await S.click(...TALK_CLICK);
    if (await S.waitChange(TALK_TEXT, before, { timeout: 3500 }) !== null) return;
    // As built, the click on the last intro line of a quiz half only runs nextRoundText(); the line
    // stays on screen until a second click (GameShow.showRoundText sets busy = true, GameShow.as:164).
    S.log(`QUIRK: "${name || 'line'}" did not change after click ${attempt}; clicking again`);
    QUIRKS.push({ t: S.now(), name, attempt });
  }
}

module.exports = { Session };

async function main() {
  try {
    if (MODE === 'main') await runMain();
    else if (MODE === 'standalone') await runStandalone();
    else if (MODE === 'level') await runLevel();
    else if (MODE === 'timeout') await runTimeout();
    else if (MODE === 'kitchen') { await S.open(MOVIES + 'KitchenGame.swf', 'language=en_en'); await S.wait(1500); await kitchen(); }
    else if (MODE === 'editor') await runEditor();
    else throw new Error('unknown mode ' + MODE);
  } catch (e) {
    if (!(e instanceof StopJourney)) { await S.fail('error', e); process.exitCode = 1; }
  } finally { await S.close(); }
}

async function runMain() {
  await S.open(MOVIES + 'e-Bug Junior Game.swf', 'language=en_en', { delaySwfMs: 250 });
  await bootAndSplash();
  await cutscene(AVATAR);
  const chains = { 1: [1, 2, 3, 4], 2: [5, 6, 7], 3: [8, 9], 5: [10] };
  const from = +(args.from || 1);
  for (let r = 1; r <= 5; r++) {
    const q = loadQuiz(r);
    await quizHalf(r, 'blind', q); stopAfter(`round${r}-blind`);
    await shrinkZone(r);
    if (r === 4) await kitchen();
    else for (const [i, n] of chains[r].entries()) { await platformLevel(n, { last: i === chains[r].length - 1 }); stopAfter(`level${n}`); }
    await quizHalf(r, 'sighted', q); stopAfter(`round${r}`);
  }
  await ending();
}

async function ending() {
  await waitKind(['talkie'], 30000);
  await talk('final-host-line', 'End of game: final host line ("Well done! You beat Amy. ..." or the loss line), no winner screen', { hi: true, len: 90 });
  // the click runs GameController.exit() -> theRoot.gotoAndPlay("init"): a second GameController reloads everything
  for (const [ms, tag] of [[1000, 'restart-1s'], [4000, 'restart-4s'], [10000, 'restart-10s']]) { await S.wait(ms - (ms === 1000 ? 0 : ms === 4000 ? 1000 : 4000)); await S.shot(`final-${tag}`, `After the final click: the broken restart (gotoAndPlay("init")) ${ms / 1000} s later`); }
}

async function bootAndSplash() {
  // Loader ("Looding: <name>" + percentage). SWF responses are delayed 250 ms each so it is visible.
  await S.wait(900);
  await S.shot('loader', 'Preloader: "Looding: <file>" and percentage, red FPS text top left');
  await S.wait(1400);
  await S.shot('loader-later', 'Preloader part way through the ten-SWF list');
  // splash revealed when every asset has loaded: wait until the centre is no longer black
  const t = Date.now();
  for (;;) { const [p] = await S.probe([[400, 300]]); if (p[0] + p[1] + p[2] > 60) break; if (Date.now() - t > 30000) throw new Error('splash never shown'); await S.wait(100); }
  S.log('splash visible');
  await S.shot('splash-reveal', 'Splash TV as first revealed (animation already running since splash.swf loaded)');
  await S.wait(3000);
  await S.shot('splash-mid', 'Splash TV about 3 s after reveal');
  await S.wait(5000);
  await S.shot('splash-new-game', 'Splash final frame: TV showing the studio and the New Game button', { hi: true });
  stopAfter('splash');
  await S.click(...NEW_GAME, 'New Game');
  await S.waitTrace(/next line: 1|next line/, 100).catch(() => {});
}

async function cutscene(avatar) {
  // Line 0 was typed during preload; lines 1 and 2 are typed now.
  await S.wait(400);
  await talk('cutscene-line0', 'Cutscene: host line 0 "Hello and welcome to the e-Bug Game Show!" (typed during preload)', { hi: true, len: 0 });
  // typewriter measurement on line 1 (57 characters)
  const t1 = Date.now(); await S.wait(500);
  await S.shot('cutscene-typing', 'Cutscene: typewriter mid-line (line 1)');
  const tw = Date.now(); const done = await waitTalkComplete();
  S.timing('typewriter: line 1 "Soon you will be visiting the weird world of the microbe." (57 chars), click to last text change', (tw - t1) / 1000 + done);
  await talk('cutscene-line1', 'Cutscene: host line 1 "Soon you will be visiting the weird world of the microbe."', { len: 57 });
  await talk('cutscene-line2', 'Cutscene: host line 2 "But first, who do you want to play as?"', { len: 38 });
  await S.wait(800);
  await S.shot('avatar-choice', 'Avatar choice frame: host stops, Amy and Harry idle, no talkie', { hi: true });
  stopAfter('avatar');
  await S.hover(...AVATAR_BTN.amy); await S.wait(1500);
  await S.shot('avatar-hover-amy', 'Avatar choice: pointer over Amy (Amy plays happy, Harry disappointed)');
  await S.hover(...AVATAR_BTN.harry); await S.wait(1500);
  await S.shot('avatar-hover-harry', 'Avatar choice: pointer over Harry (Harry happy, Amy disappointed)');
  const m = S.mark();
  await S.click(...AVATAR_BTN[avatar], 'avatar ' + avatar);
  await S.waitTrace(/next line: 4/, 5000, { since: m }).catch(e => S.log('warn: ' + e.message));
  await S.wait(300);
  await talk('cutscene-line4', 'Cutscene: host line 4 "Tell me a little about yourself:"', { len: 32 });
  await S.wait(800);
  await S.shot('details-form', 'Details form: nickname, age, email (pre-filled), Submit', { hi: true });
  stopAfter('form');
  await S.click(...SUBMIT, 'Submit');
  await S.wait(600);
  await talk('cutscene-line8', 'Cutscene: host line 8 "Allright, Lets begin by seeing what you know about microbes."', { len: 60 });
}

// ---------------------------------------------------------------- quiz
const QUIZ_DIR = path.join(ROOT, 'reference/Junior_Game/levels');
function loadQuiz(r) {
  const x = fs.readFileSync(path.join(QUIZ_DIR, `alpha_gameshow_round${r}.xml`), 'utf8');
  const lines = tag => [...x.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))[1].matchAll(/<state?ment>([\s\S]*?)<\/state?ment>/g)].map(m => m[1].trim());
  const questions = [...x.matchAll(/<question id="(\d+)">([\s\S]*?)<\/question>/g)].map(m => ({ id: +m[1], text: m[2].match(/<text>([\s\S]*?)<\/text>/)[1], values: [...m[2].matchAll(/<value>(-?\d)<\/value>\s*<\/answer>/g)].map(v => +v[1]) }));
  return { blind: lines('blind'), normal: lines('normal'), questions, next: x.match(/<next_round>(.*?)<\/next_round>/)[1] };
}
const ANSWER_BTN = [[400, 209], [400, 298], [400, 388]];           // Agree, Don't Know, Disagree (board sprite 77)
const ANSWER_WORD = ['Agree', "Don't Know", 'Disagree'];
const RESULT_WORD = { '-1': 'WRONG answer!', '0': 'SAFE answer.', '1': 'CORRECT answer.' };
const near = (p, q, tol = 30) => p.every((v, i) => Math.abs(v - q[i]) <= tol);
async function screenKind() {
  const [a, b] = await S.probe([[30, 320], [190, 330]]);
  if (near(a, [89, 148, 192])) return 'talkie';
  if (near(a, [0, 0, 0], 12) && near(b, [2, 126, 178], 35)) return 'board';
  return 'other';
}
async function waitKind(kinds, timeout = 30000) {
  const t = Date.now();
  for (;;) { const k = await screenKind(); if (kinds.includes(k)) return k; if (Date.now() - t > timeout) throw new Error(`screen never became ${kinds} (last ${k})`); await S.wait(150); }
}
// which answer (button index) to give: pick by desired outcome (1 correct, 0 don't know, -1 wrong)
function buttonFor(q, outcome) { return q.values.indexOf(outcome); }
const POLICY = {
  blind: r => r === 1 ? [1, 0, -1, 1] : [1, 0, 1, 1, 1, 1],
  sighted: r => r === 1 ? [1, -1, 0, 1] : [1, 1, 1, 1, 1, 1],
};

async function quizHalf(r, half, quiz, { prefix = '', keepOnly = null, hiOff = false } = {}) {
  const intro = half === 'blind' ? quiz.blind : quiz.normal;
  const full = r === 1 && !keepOnly;                     // round 1 is captured line by line
  const items = [];
  intro.forEach((t, i) => items.push({ kind: 'talk', len: t.length, keep: full || i === 0, hi: r === 1 && half === 'blind' && i === 0, name: `r${r}-${half}-intro${i + 1}`, desc: `Round ${r} ${half} intro line ${i + 1}/${intro.length}: "${t}"` }));
  const outcomes = POLICY[half](r);
  quiz.questions.forEach((q, i) => {
    const last = i === quiz.questions.length - 1;
    const outcome = outcomes[i] ?? 1; const btn = buttonFor(q, outcome);
    items.push({ kind: 'talk', len: 22 + q.text.length, keep: full || i === 0, name: `r${r}-${half}-q${i + 1}-ask`, desc: `Round ${r} ${half}: host "Question number ${q.id + 1}: ${q.text}..."` });
    items.push({ kind: 'board', keep: full || i === 0, hi: r === 1 && half === 'blind' && i === 0, name: `r${r}-${half}-q${i + 1}-board`, desc: `Round ${r} ${half}: question board "Question ${q.id + 1}" / "${q.text}" / "10 Points"; the script clicks ${ANSWER_WORD[btn]} (${RESULT_WORD[outcome]})`, btn });
    if (!last) {
      const resp = half === 'blind' ? `"<nickname>, you chose ${ANSWER_WORD[btn]}." + "Because this is a Blind question round, you'll find out how you did later." (host serious, player avatar random reaction)` : `"<nickname>, you chose ${ANSWER_WORD[btn]}." + "This is the....${RESULT_WORD[outcome]}" (host ${{ '-1': 'disappointed', 0: 'serious', 1: 'excited' }[outcome]}, player ${{ '-1': 'disappointed', 0: 'neutral', 1: 'happy' }[outcome]})`;
      items.push({ kind: 'talk', len: half === 'blind' ? 100 : 45, keep: full || i === 0, hi: r === 1 && half === 'sighted' && i === 0, name: `r${r}-${half}-q${i + 1}-response`, desc: `Round ${r} ${half}: response ${resp}` });
      if (half === 'sighted') items.push({ kind: 'talk', len: 32, keep: full || i === 0, name: `r${r}-sighted-q${i + 1}-cpu`, desc: `Round ${r} sighted: CPU turn "Amy, you chose the <random> answer." (scoreboards updated)` });
    } else if (half === 'blind') items.push({ kind: 'talk', len: 63, keep: r === 1, name: `r${r}-step-right`, desc: 'Host: "Step right this way and prepare to enter the world of microbes!"' });
  });
  for (const it of items) { it.name = prefix + it.name; if (keepOnly) it.keep = keepOnly.includes(it.name.slice(prefix.length)); if (hiOff) it.hi = false; }
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    const kind = await waitKind(['talkie', 'board']);
    if (it.kind === 'talk' && kind === 'board') { S.log(`WARN expected talkie "${it.name}" but the board is up; skipping to the board`); while (items[k].kind !== 'board') k++; k--; continue; }
    if (it.kind === 'board' && kind === 'talkie') { S.log(`WARN extra talkie line before ${it.name}`); await talk(`r${r}-${half}-extra`, `Round ${r} ${half}: unexpected extra talkie state before the board`); k--; continue; }
    if (it.kind === 'talk') {
      await talk(it.name, it.desc, { hi: it.hi, shoot: it.keep, len: it.len || 0 });
    } else {
      await S.wait(300);
      if (it.keep) await S.shot(it.name, it.desc, { hi: it.hi });
      await S.click(...ANSWER_BTN[it.btn], ANSWER_WORD[it.btn]);
      const t = Date.now(); while ((await screenKind()) === 'board' && Date.now() - t < 5000) await S.wait(100);
    }
  }
}

// ---------------------------------------------------------------- platformer
// ePhone large (intro pages): five points on its bezel and screen must all match.
// ePhone small (playing): silver bezel of the corner phone at (700,400).
const PHONE_SCREEN = { x: 70, y: 55, width: 590, height: 340 };
const PHONE_LARGE = [[[50, 225], [247, 252, 252]], [[400, 40], [100, 107, 115]], [[400, 45], [166, 167, 173]], [[768, 225], [60, 68, 78]], [[660, 70], [0, 0, 0]]];
async function phoneState() {
  const px = await S.probe([...PHONE_LARGE.map(x => x[0]), [700, 400]]);
  if (PHONE_LARGE.every(([, c], i) => near(px[i], c, 14))) return 'large';
  if (near(px[5], [182, 182, 182], 25)) return 'small';
  return 'other';
}
async function waitPhone(state, timeout = 60000) {
  const t = Date.now();
  for (;;) { const st = await phoneState(); if (st === state) return (Date.now() - t) / 1000; if (Date.now() - t > timeout) throw new Error(`ePhone never became ${state} (last ${st})`); await S.wait(150); }
}
const waitPhoneSmall = t => waitPhone('small', t);

// Capture every intro page (they auto-advance every 5 s), then the level's opening view.
// Capture every ePhone intro page as it auto-advances (level_intros: waitTime 5000 ms per page).
// A 2x capture takes several seconds under SwiftShader, long enough for pages to go by, so the
// first page is only captured at 2x when asked (the level mode does it for alpha_level11).
async function phonePages(tag, label, { hiFirst = false, allPages = true } = {}) {
  await waitPhone('large', 60000);
  await S.wait(500);
  let page = 1; let prev = await S.region(PHONE_SCREEN); let tPage = Date.now();
  await S.shot(`${tag}-intro-p${page}`, `${label}: ePhone intro page ${page}`, { hi: hiFirst });
  const gaps = [];
  for (;;) {
    await S.wait(200);
    const st = await phoneState();
    if (st !== 'large') break;
    const cur = await S.region(PHONE_SCREEN);
    if (!cur.equals(prev)) {
      await S.wait(300);
      if ((await phoneState()) !== 'large') break;       // the change was the phone starting to shrink
      prev = await S.region(PHONE_SCREEN);
      gaps.push((Date.now() - tPage) / 1000); tPage = Date.now(); page++;
      if (allPages) await S.shot(`${tag}-intro-p${page}`, `${label}: ePhone intro page ${page}`);
    }
  }
  return gaps;
}

async function platformLevel(n, { last, prefix = '', allPages = true, extras = true, hiOff = false } = {}) {
  const tag = `${prefix}level${n}`;
  const gaps = await phonePages(tag, `Level ${n} (alpha_level${n}.xml)`, { allPages });
  if (gaps.length) S.timing(`level ${n} ePhone intro auto-advance gaps (s): ${gaps.map(g => g.toFixed(1)).join(', ')}`, gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const tShrink = Date.now();
  await waitPhone('small', 20000);
  S.timing(`level ${n} ePhone shrink (large to small)`, (Date.now() - tShrink) / 1000);
  await S.wait(700);
  await S.shot(`${tag}-opening`, `Level ${n}: opening view after the intro (HUD: timer top centre, score top right, hearts, ePhone bottom right)`, { hi: !hiOff });
  if (!extras) return;
  // a little movement: right for 1.5 s, then a jump
  await S.click(400, 200); // focus for keyboard (clicks do nothing in the platformer)
  await S.key('ArrowRight', 1500);
  await S.key('ArrowUp', 250); await S.wait(400);
  await S.shot(`${tag}-moving`, `Level ${n}: after holding Right 1.5 s and tapping Up (jump)`);
  if (n === 1) { await S.key('Control', 200); await S.wait(200); await S.shot(`${tag}-camera`, 'Level 1: CTRL pressed (camera phone photo flash)'); }
  if (n === 5 || n === 7) { await S.key('Space', 200); await S.wait(300); await S.shot(`${tag}-fire`, `Level ${n}: SPACE pressed (throw soap / white blood cell if one has been picked up)`); }
  const m = S.mark();
  await S.key('Home');
  await S.waitTrace(/CHEAT: end level/, 3000, { since: m }).then(() => S.log('Home cheat acknowledged')).catch(() => S.log('no CHEAT trace (traces may be compiled out)'));
}

// ---------------------------------------------------------------- kitchen game
const K = {
  click: [390, 372], outroClick: [399, 389], tissues: [50, 240], clingfilm: [235, 235], sink: [345, 232],
  // rest-point centres (kitchen_game_main.swf stage coordinates + half the box size)
  drawer: [501, 232], door: [631, 128], bowl: [403, 182], cupboard: [277, 43], upper: [502, 95], mid: [501, 145], lower: [501, 191], bin: [746, 366],
  wrong: [486, 110],                      // inside wrong_button2 (465.55, 58.7), the fridge's upper shelves
};
// food index (KitchenGame.as allPossibleFood) -> [destination, needs cling film]
function foodPlan(i) {
  if ([0, 1, 6].includes(i)) return ['bin', false];                  // mouldy bread, burst yogurt, mouldy orange
  if ([2, 3, 23, 25].includes(i)) return ['drawer', false];          // vegetables
  if ([7, 9, 20, 22].includes(i)) return ['door', false];            // yogurt, juice, milk
  if ([4, 5, 10, 18, 19].includes(i)) return ['bowl', false];        // fruit
  if ([21, 24].includes(i)) return ['cupboard', false];              // soup, bread
  if ([11, 12, 13, 14].includes(i)) return ['lower', true];          // raw meat: cling film, bottom shelf
  if ([15, 16, 17].includes(i)) return ['mid', true];                // cooked meat: cling film, middle shelf
  if (i === 8) return ['upper', false];                              // cheese
  return ['cupboard', false];
}
async function kitchenState() {
  const [btn, wall, top, obtn, white] = await S.probe([[390, 372], [760, 150], [400, 30], [398, 380], [400, 200]]);
  if (near(obtn, [218, 240, 255], 20) && near(white, [255, 255, 255], 5)) return 'outro';   // kitchen_game_outro.swf: white panel, Click at (292.2, 351.9)
  if (near(btn, [154, 214, 254], 25)) return 'button';
  if (near(wall, [255, 245, 153], 14) && near(top, [255, 247, 210], 14)) return 'tutorial';
  if (near(wall, [255, 245, 153], 14) && near(top, [150, 218, 184], 18)) return 'play';
  return 'other';
}
async function waitKitchen(states, timeout = 30000) {
  const t = Date.now();
  for (;;) { const k = await kitchenState(); if (states.includes(k)) return k; if (Date.now() - t > timeout) throw new Error(`kitchen never reached ${states} (last ${k})`); await S.wait(150); }
}
function levelFood(level) {
  const idx = S.traces.map(e => e.msg).lastIndexOf(S.traces.map(e => e.msg).reverse().find(m => new RegExp(`Starting Level: ${level}\\b`).test(m)));
  const out = [];
  for (let i = idx + 1; i < S.traces.length; i++) { const m = S.traces[i].msg.match(/^(\d+) - (.+)$/); if (m) out.push([+m[1], m[2]]); else if (out.length) break; }
  return out;
}
async function kitchen() {
  const intros = { 0: [], 1: [], 2: [], 3: [] };
  for (let level = 0; level < 4; level++) {
    // intro screens
    let screen = 1;
    for (;;) {
      const st = await waitKitchen(['button', 'tutorial', 'play'], 30000);
      if (st === 'play') break;
      if (st === 'button') {
        await S.wait(300);
        await S.shot(`kitchen-l${level}-intro${screen}`, `Kitchen level ${level} intro screen ${screen} (dimmed kitchen, white text, blue Click button)`, { hi: level === 0 && screen === 1 });
        const before = await S.region({ x: 100, y: 40, width: 600, height: 260 });
        await S.click(...K.click); screen++;
        await S.waitChange({ x: 100, y: 40, width: 600, height: 260 }, before, { timeout: 5000 });
        continue;
      }
      // level 0 tutorial: show the wrong answer once, then the right one
      await S.wait(400);
      await S.shot('kitchen-l0-tutorial', 'Kitchen level 0 tutorial: undimmed kitchen, click where the spring onion goes', { hi: true });
      await S.click(...K.wrong, 'tutorial wrong'); await S.wait(1200);
      await S.shot('kitchen-l0-tutorial-wrong', 'Kitchen tutorial after a wrong place: "Wrong!  Try again." with the two rules');
      await S.click(...K.click); await waitKitchen(['tutorial'], 8000); await S.wait(300);
      await S.click(...K.drawer, 'tutorial drawer'); await S.wait(1200);
      await S.shot('kitchen-l0-tutorial-right', 'Kitchen tutorial after the drawer: "Excellent, well done." / "Try to put away 10 things before the timer runs out."');
      await S.click(...K.click); screen++;
      const tw = Date.now(); while ((await kitchenState()) === 'button' && Date.now() - tw < 5000) await S.wait(150);
    }
    const tPlay = Date.now();
    await S.wait(600);
    const food = levelFood(level);
    S.log(`kitchen level ${level}: ${food.length} items: ${food.map(f => f[1]).join(', ')}`);
    await S.shot(`kitchen-l${level}-play`, `Kitchen level ${level} play: first item (${food[0] ? food[0][1] : '?'}) on the counter, clock top right`, { hi: level === 0 });
    if (level === 1) {
      // idle to invite a sneeze (1/4 chance per second from level 1 on), then tissues and hand washing
      await S.wait(2500); await S.shot('kitchen-l1-idle', 'Kitchen level 1 after 3 s idle (a sneeze may have started: avatar sneeze_Start / sneeze_mid)');
      await S.wait(2500); await S.shot('kitchen-l1-idle2', 'Kitchen level 1 after 5.5 s idle');
      await S.click(...K.tissues, 'tissues'); await S.wait(500); await S.shot('kitchen-l1-tissues', 'Kitchen level 1 after clicking the tissues (sneeze_tissue_end if a sneeze was running, otherwise nothing)');
      await S.click(...K.sink, 'sink'); await S.wait(700); await S.shot('kitchen-l1-wash', 'Kitchen level 1: sink clicked, wash_hands animation (36 frames)');
      // clicks are ignored in STATE_WASH_HANDS until the wash animation has ended and the next one-second
      // tick has passed (KitchenGame.as:161-167); under a slow Ruffle that can take several seconds
      await S.wait(7000);
    }
    for (let i = 0; i < food.length; i++) {
      const [idx, name] = food[i];
      let [dest, cling] = foodPlan(idx);
      if (level === 0 && i === food.length - 1 && dest !== 'bin') dest = 'bin';          // one deliberate mistake
      if (level === 2 && cling && !levelFood.skippedCling) { cling = false; levelFood.skippedCling = true; } // one meat without cling film
      await S.click(...K.tissues); await S.wait(60);
      if (cling) {
        await S.click(...K.clingfilm); await S.wait(700);
        if (level === 2 && !levelFood.clingShot) { levelFood.clingShot = true; await S.shot('kitchen-l2-clingfilm', `Kitchen level 2: cling film applied to ${name} on the counter`); }
      }
      // The current item sits bottom-right aligned in food_throw_area.foodContainer, a 90 x 90 box at
      // (120.3, 171.5). Only its bottom strip is watched: the avatar's body overlaps the upper part.
      // A click is only acted on in STATE_WAIT, so wait until pickItem() has drawn the next item
      // (the strip changes) before the next click; under a slow Ruffle that can take a while.
      const box = { x: 150, y: 244, width: 62, height: 18 };
      const sameNext = food[i + 1] && food[i + 1][0] === idx;
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = await S.region(box);
        await S.click(...K[dest]);
        if (sameNext || i === food.length - 1) { await S.wait(1500); break; }
        if (await S.waitChange(box, before, { timeout: 3000 }) !== null) { await S.wait(400); break; }
        S.log(`kitchen: ${name} not placed (state not WAIT?), retrying`); await S.click(...K.tissues); await S.wait(800);
      }
      if ((level === 0 && i === 2) || (level === 3 && i === 10)) await S.shot(`kitchen-l${level}-placing`, `Kitchen level ${level} after ${i + 1} placements (avatar animation for the last location, items in the fridge/bowl/cupboard)`);
    }
    await S.wait(300);
    await S.shot(`kitchen-l${level}-done`, `Kitchen level ${level}: every item placed (level ends at the next one-second tick)`);
    // outro: three pages with a Click button
    for (let pageNo = 1; pageNo <= 3; pageNo++) {
      await waitKitchen(['outro'], level === 3 ? 140000 : 80000);
      if (pageNo === 1) S.timing(`kitchen level ${level}: play start to outro`, (Date.now() - tPlay) / 1000);
      await S.wait(400);
      await S.shot(`kitchen-l${level}-outro${pageNo}`, `Kitchen level ${level} outro page ${pageNo}: ${['"Shopping Placed Correctly" rows with x10 sums', '"Items Placed Incorrectly" rows', '"Microbial Mistakes" admonishments (4 slots)'][pageNo - 1]}`, { hi: level === 0 && pageNo === 1 });
      const before = await S.region({ x: 100, y: 40, width: 600, height: 260 });
      await S.click(...K.outroClick);
      await S.waitChange({ x: 100, y: 40, width: 600, height: 260 }, before, { timeout: 5000 });
    }
    stopAfter(`kitchen${level}`);
  }
}

async function shrinkZone(r, { prefix = '', plan: planIn = null } = {}) {
  // after the "Step right this way" click: the shrinking zone plays for 149 frames, then the action starts
  const m = S.mark(); const t = Date.now();
  const plan = planIn || (r === 1 ? [[500, 'start', false], [2000, 'mid', false], [3500, 'late', true], [5000, 'end', false]] : [[2500, 'mid', false]]);
  for (const [ms, tag, hi] of plan) { await S.wait(Math.max(0, ms - (Date.now() - t))); if (S.seen(/Round is:/, m)) break; await S.shot(`${prefix}r${r}-shrink-${tag}`, `Round ${r}: shrinking zone about ${(ms / 1000).toFixed(1)} s after the click (the chosen child on the target under the shrink ray)`, { hi }); }
  const e = await S.waitTrace(/Round is:/, 30000, { since: m });
  S.timing(`round ${r} shrinking zone: click on "Step right this way" to showHoverboardOrKitchen trace`, (Date.now() - t) / 1000);
  return e;
}

// ---------------------------------------------------------------- standalone SWFs
// [file, stage size, wall-clock offsets in seconds (from the moment the harness page loads), note]
const STANDALONE = [
  ['splash.swf', [800, 450], [1, 3, 5, 6.5, 9], 'Splash TV: static, "Tuning" bars, studio fade-in, New Game button (frame 150 of sprite 58)'],
  ['cutscene_introduction.swf', [800, 450], [2, 6], 'Cutscene on its own: host line 0 typed, talkie waiting'],
  ['level_intros.swf', [800, 450], [1, 3, 7], 'ePhone intro pages (sprite 1479) at native size, small phone screen on the magenta #cc3366 stage, auto-advancing every 5 s'],
  ['junior_game_assets.swf', [800, 600], [2], 'Shared asset library (tiles and entity art exported for the platformer); stage 800x600'],
  ['EBug Level Editor.swf', [1180, 700], [3, 8], 'Level editor on its own; stage 1180x700; asks for a level through FileReference.browse'],
  ['eBugGameShow.swf', [800, 450], [2, 5], 'Game show on its own: studio, talkie with the first blind intro line'],
  ['KitchenGame.swf', [800, 450], [3, 6], 'Kitchen coordinator on its own: level 0 intro screen 1'],
  ['summary_page.swf', [800, 450], [1, 3, 6], 'Platform summary page on its own (static "Things to remember" texts)'],
  ['harry.swf', [1000, 600], [1, 3], 'Platformer Harry on the hoverboard; stage 1000x600'],
  ['amy.swf', [800, 450], [1, 3], 'Platformer Amy on the hoverboard; stage 550x400 shown letterboxed in 800x450'],
  ['introductionToMicrobes_mainMenu.swf', [800, 450], [2], 'Main menu SWF (loaded but never shown by the junior game)'],
  ['shrinking_harry.swf', [800, 450], [1, 3], 'Shrinking zone, Harry (clip stops on frame 1 until played)'],
  ['shrinking_amy.swf', [800, 450], [1, 3], 'Shrinking zone, Amy (clip stops on frame 1 until played)'],
  ['kitchen_game_main.swf', [800, 450], [2], 'Kitchen scene on its own (its frame 1 hides the developer test buttons; clock placeholder "30")'],
  ['kitchen_game_intro_level_0.swf', [800, 450], [2], 'Kitchen intro level 0, screen 1'],
  ['kitchen_game_intro_level_1.swf', [800, 450], [2], 'Kitchen intro level 1, screen 1'],
  ['kitchen_game_intro_level_2.swf', [800, 450], [2], 'Kitchen intro level 2, screen 1'],
  ['kitchen_game_intro_level_3.swf', [800, 450], [2], 'Kitchen intro level 3, screen 1'],
  ['kitchen_game_outro.swf', [800, 450], [2], 'Kitchen outro pages on their own'],
  ['talkie.swf', [800, 450], [2], 'Talkie dialogue box on its own'],
  ['introductionToMicrobes_platformer.swf', [800, 450], [2], 'Platformer frame 1: placeholder HUD, stops until played'],
  ['gameOver.swf', [800, 450], [2], 'gameOver.swf (not used by the junior game)'],
  ['Game_Show.swf', [800, 450], [2], 'Game_Show.swf, an older game show build'],
  ['cut_scene_director.swf', [800, 450], [2, 5], 'cut_scene_director.swf (older cutscene)'],
  ['dialogue_tutorial.swf', [800, 450], [2], 'dialogue_tutorial.swf (prototype)'],
  ['introductionToMicrobes.swf', [800, 450], [2], 'introductionToMicrobes.swf (2008 prototype shell)'],
  ['introductionToMicrobes_comicIntroduction.swf', [800, 450], [2], 'Comic introduction (prototype, not used by the junior game)'],
  ['introductionToMicrobes_exitQuiz.swf', [800, 450], [2], 'Exit quiz (prototype, not used by the junior game)'],
  ['avatar_harry_Fridge.swf', [800, 450], [2], 'Kitchen avatar Harry source SWF'],
  ['avatar_amy_Fridge.swf', [800, 450], [2], 'Kitchen avatar Amy source SWF'],
  ['fridge_game.swf', [800, 450], [3], 'fridge_game.swf, the older food game prototype'],
  ['introductionToMicrobes_platformer9.swf', [800, 750], [2], 'Older platformer build (stage 800x750), frame 1'],
  ['introductionToMicrobes_platformer_Scene 1.swf', [800, 450], [2], 'Platformer scene export (prototype), frame 1'],
  ['platformTest.swf', [800, 450], [2], 'platformTest.swf (physics prototype)'],
  ['map_builder.swf', [1000, 450], [2], 'map_builder.swf (early level builder, stage 1000x450)'],
  ['Shrinking Zone_Harry.swf', [800, 450], [2], 'Shrinking Zone_Harry.swf, an older export of shrinking_harry'],
  ['antibiotic_pickup.swf', [550, 400], [2], 'Antibiotic pickup art (stage 550x400)'],
  ['animation_test_dummy.swf', [550, 400], [2], 'animation_test_dummy.swf (avatar animation test, stage 550x400)'],
  ['ebug_food_sorting_game.swf', [800, 450], [2], 'ebug_food_sorting_game.swf (empty shell)'],
  ['Microbes_Motions/Colin_motion.swf', [1000, 600], [2], 'Colin microbe motion art (stage 1000x600)'],
  ['Microbes_Motions/Donna_motion.swf', [1000, 600], [2], 'Donna Dermatophyte motion art (stage 1000x600)'],
  ['Microbes_Motions/Steve_motion.swf', [1000, 600], [2], 'Steve Staphylococcus motion art (stage 1000x600)'],
  ['Sandy Art/Liquid Soap.swf', [550, 400], [2], 'Liquid soap pickup art (stage 550x400)'],
  ['Sandy Art/White Blood Cell Pick Up.swf', [49, 49], [2], 'White blood cell pickup art (stage 49x49)'],
  ['Sandy Art/White Blood Cell Projectile.swf', [550, 400], [2], 'White blood cell projectile art (stage 550x400)'],
  ['Sandy Art/milk.swf', [150, 200], [2], 'Milk glass art, 20 frames (stage 150x200)'],
];

async function runStandalone() {
  const only = args.only ? String(args.only).split(',') : null;
  for (const [file, [w, h], offsets, note] of STANDALONE) {
    if (only && !only.some(o => file.includes(o))) continue;
    try {
      const fcm = S.page ? null : null;
      await S.open(MOVIES + file, 'language=en_en', { viewport: { width: w, height: h } });
      if (/Level Editor/.test(file)) S.page.on('filechooser', async fc => { S.log('filechooser opened by FileReference.browse'); await fc.setFiles(path.join(ROOT, 'reference/Junior_Game/levels/alpha_level1.xml')); });
      let last = 0;
      for (const o of offsets) {
        await S.wait(Math.max(0, o * 1000 - (Date.now() - S.t0)));
        const base = file.replace(/\.swf$/, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
        await S.shot(`sa-${base}-${String(o).replace('.', '_')}s`, `${file} at ${o} s: ${note}`, { hi: offsets.length === 1 || o === offsets[offsets.length - 1] });
        last = o;
      }
      const tr = S.traces.map(e => e.msg).filter(Boolean);
      if (tr.length) S.log(`${file} traces: ` + tr.slice(0, 6).map(x => x.slice(0, 80)).join(' | '));
      S.timings.push({ swf: file, what: 'traces (first 10)', traces: tr.slice(0, 10) });
    } catch (e) { S.log(`FAILED ${file}: ${e.message}`); }
  }
}

// ---------------------------------------------------------------- timeout variant (Amy)
async function runTimeout() {
  await S.open(MOVIES + 'e-Bug Junior Game.swf', 'language=en_en');
  const t = Date.now();
  for (;;) { const [p] = await S.probe([[400, 300]]); if (p[0] + p[1] + p[2] > 60) break; if (Date.now() - t > 30000) throw new Error('splash never shown'); await S.wait(100); }
  await S.wait(8500);
  await S.click(...NEW_GAME, 'New Game');
  await S.wait(400);
  await talk('', '', { shoot: false });
  // typewriter measurement on cutscene line 1 (57 characters), with nothing else running
  const t1 = Date.now(); const done = await waitTalkComplete({ len: 57 });
  S.timing('typewriter (timeout run): cutscene line 1, 57 chars, click to last text change', done); void t1;
  await talk('', '', { shoot: false, len: 57 });
  await talk('', '', { shoot: false, len: 38 });
  await S.wait(800);
  const m = S.mark();
  await S.click(...AVATAR_BTN.amy, 'avatar amy');
  await S.waitTrace(/next line: 4/, 5000, { since: m }).catch(e => S.log('warn: ' + e.message));
  await S.wait(300);
  await talk('', '', { shoot: false });
  await S.wait(800);
  // text input: replace the pre-filled nickname "Amy" with "Sam"
  await S.click(700, 57); await S.wait(300);
  await S.page.keyboard.press('End');
  for (let i = 0; i < 6; i++) await S.page.keyboard.press('Backspace');
  await S.page.keyboard.type('Sam', { delay: 80 }); await S.wait(800);
  await S.shot('amy-form-typed', 'Variant (Amy): details form after clicking the nickname field, End, six Backspaces and typing "Sam"');
  await S.click(...SUBMIT, 'Submit');
  await S.wait(600);
  await talk('', '', { shoot: false });
  const q1 = loadQuiz(1);
  await quizHalf(1, 'blind', q1, { prefix: 'amy-', keepOnly: ['r1-blind-intro1', 'r1-blind-q1-response', 'r1-step-right'], hiOff: true });
  await shrinkZone(1, { prefix: 'amy-', plan: [[2500, 'mid', false], [4500, 'late', false]] });
  await platformLevel(1, { prefix: 'amy-', allPages: false, extras: false, hiOff: true });
  // idle until the 180 s clock runs out: GameController.endofHoverboard(END_REASON_TIME) shows summary_page.swf
  const t0 = Date.now();
  await S.wait(60000); await S.shot('amy-level1-idle-60s', 'Variant (Amy): level 1 after about 60 s idle (timer counting down)');
  for (;;) {
    const [a, b] = await S.probe([[400, 225], [20, 20]]);
    // summary page: olive/grey panel replaces the level (the ePhone disappears)
    if ((await phoneState()) !== 'small' && Date.now() - t0 > 150000) break;
    if (Date.now() - t0 > 260000) throw new Error('no time-out summary page after 260 s');
    await S.wait(1000); void a; void b;
  }
  S.timing('level 1 idle: opening view to summary page ("You ran out of time.")', (Date.now() - t0) / 1000);
  await S.wait(1200);
  await S.shot('amy-timeout-summary', 'Variant (Amy): summary_page.swf after the 180 s clock ran out: "You ran out of time." / "click to try again"', { hi: true });
  // its Click button calls GameController.restartHoverboardRound(): the round restarts from its first level
  await S.click(399, 389, 'summary Click'); await S.wait(3000);
  await S.shot('amy-after-retry', 'Variant (Amy): after clicking the summary page: level 1 restarts (ePhone intro again)');
}

// ---------------------------------------------------------------- direct level loading
// (a) The platformer SWF on its own stops on frame 1 ("init"); its frame 10 calls
//     game.initialiseGame(player, level, tiles) with the timeline variable "level", which a
//     flashvar sets. Ruffle's context menu item "Play" (right-click) resumes the root timeline.
async function contextMenuPlay() {
  await S.page.mouse.click(400, 225, { button: 'right' }); await S.wait(400);
  const items = await S.page.evaluate(() => [...window.__ruffle.shadowRoot.querySelectorAll('#context-menu .menu-item')].map(e => e.textContent.trim()));
  const ok = await S.page.evaluate(() => { const it = [...window.__ruffle.shadowRoot.querySelectorAll('#context-menu .menu-item')].find(e => e.textContent.trim() === 'Play'); if (it) { it.click(); return true; } return false; });
  S.log(`context menu: ${items.join(' | ')}; Play clicked: ${ok}`);
  return ok;
}
async function runLevel() {
  const levels = String(args.level || 'alpha_level1.xml,alpha_level11.xml').split(',');
  for (const lv of levels) {
    await S.open(MOVIES + 'introductionToMicrobes_platformer.swf', `level=${lv}`);
    await S.wait(2500);
    await S.shot(`lv-${lv.replace('.xml', '')}-frame1`, `Platformer SWF alone with flashvar level=${lv}: root frame 1 (placeholder HUD and ePhone, stopped)`);
    if (!await contextMenuPlay()) continue;
    const t = Date.now();
    // every intro page as it auto-advances (5 s each), then the level once the phone has shrunk
    const gaps = await phonePages(`lv-${lv.replace('.xml', '')}`, `Platformer alone, ${lv}` + (lv === 'alpha_level11.xml' ? ' (level 1 pages: level_intros has no level11 label)' : ''), { hiFirst: lv === 'alpha_level11.xml' });
    if (gaps.length) S.timing(`${lv} (alone): ePhone intro auto-advance gaps (s): ${gaps.map(g => g.toFixed(1)).join(', ')}`, gaps.reduce((a, b) => a + b, 0) / gaps.length);
    await waitPhoneSmall(90000);
    S.timing(`${lv}: context-menu Play to end of phone intro`, (Date.now() - t) / 1000);
    await S.wait(800);
    await S.shot(`lv-${lv.replace('.xml', '')}-opening`, `Platformer alone, ${lv}: opening view (shared-library art merged by swf-shim.cjs)`, { hi: lv === 'alpha_level11.xml' });
  }
}
// (b) The level editor loads any level XML through FileReference.browse(), which Ruffle turns into
//     a real file chooser; Playwright answers it with the chosen file.
async function runEditor() {
  const levels = String(args.level || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => `alpha_level${n}.xml`).join(',')).split(',');
  for (const lv of levels) {
    await S.open(MOVIES + 'EBug Level Editor.swf', '', { viewport: { width: 1180, height: 700 } });
    S.page.once('filechooser', fc => fc.setFiles(path.join(ROOT, 'reference/Junior_Game/levels', lv)));
    const m = S.mark();
    await S.waitTrace(/loading map/, 20000, { since: 0 }).catch(e => S.log('warn ' + e.message));
    await S.wait(3000);
    await S.shot(`editor-${lv.replace('.xml', '')}`, `Level editor with ${lv} loaded: first 800 px of the level, tile palette bottom left`, { hi: lv === 'alpha_level1.xml' });
  }
}

if (require.main === module) main();
