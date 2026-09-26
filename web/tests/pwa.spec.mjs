// Progressive web app, served on localhost by the test runner (a secure context, so the service
// worker is allowed):
//   (a) the web app manifest is valid: name, short name, start URL, scope, display, colours, and
//       icons that exist with the pixel sizes they claim, linked from index.html and served with
//       the manifest media type;
//   (b) a first visit that plays level 1 (splash, Level select, level 1) registers the service
//       worker, which installs the build's cache with every precache.json "files" entry; then,
//       with the browser context offline (and the test proving the network is really gone), a
//       reload boots to the splash with its art, Level select opens and level 1 starts and plays,
//       with no console errors and no failed requests; the rest of the game is cached in the
//       background once play begins, so levels 2 and 5 then play offline with no placeholder art.
// The worker registers only once a level begins play (web/js/main.js, platformScene.js), so the
// first visit plays into level 1 before going offline, as a player would.
//
// Offline for real: Chromium's offline emulation (context.setOffline) stops the page's own
// requests but not the service worker's fetch() to the network (an uncached file still came back
// as the server's 404), so it would let a worker that misses files pass. This test therefore
// serves web/ from its own localhost server (the same static handler as run.mjs) and shuts it
// down, closing every open connection, before the offline reload; setOffline is set as well.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const DESKTOP = { viewport: { width: 1280, height: 720 } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);
const readJson = (ctx, rel) => JSON.parse(fs.readFileSync(path.join(ctx.web, rel), 'utf8'));

async function until(page, predicate, what, { max = 3000, chunk = 4 } = {}) {
  const src = predicate.toString();
  for (let used = 0; used <= max; used += chunk) {
    const ok = await page.evaluate(s => { try { return !!(0, eval)(s)(window.__test); } catch { return false; } }, src);
    if (ok) return used;
    await step(page, chunk);
    if (used % 100 === 0) await page.waitForTimeout(5);
  }
  throw new Error(`timed out waiting for ${what} (scene ${await page.evaluate(() => window.__test.scene)})`);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.mp3': 'audio/mpeg',
};

// A private static server for web/ on a free localhost port (run.mjs's handler).
function serve(web) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(web, url);
    if (!file.startsWith(web)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Width and height from a PNG's IHDR chunk.
function pngSize(file) {
  const b = fs.readFileSync(file);
  assert(b.readUInt32BE(0) === 0x89504e47 && b.toString('latin1', 12, 16) === 'IHDR', `${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// From the splash menu: Level select, then level 1 with the keyboard, through its briefing to play.
async function splashToLevel1(page, shots, tag) {
  await until(page, t => t.scene === 'splash' && t.probe('splash') && (t.probe('splash').ready || t.probe('splash').failed), 'the splash art');
  const sp = await probe(page, 'splash');
  assert(sp.ready && !sp.failed, `${tag}: the splash art did not load (${JSON.stringify(sp)})`);
  await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
  await step(page, 10);
  await page.screenshot({ path: path.join(shots, `pwa-${tag}-splash.png`) });
  // Keyboard only: the menu's focus starts on its first button; arrows move it to Level select.
  for (let i = 0; i < 6 && await page.evaluate(() => document.activeElement && document.activeElement.id) !== 'btn-level-select'; i++) {
    await page.keyboard.press('ArrowDown'); await step(page, 2);
  }
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'btn-level-select', `${tag}: could not reach Level select with the arrows`);
  await page.keyboard.press('Enter');
  await until(page, t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready && !t.transitioning, 'Level select');
  await step(page, 20);
  await page.waitForTimeout(300);
  await step(page, 10);
  await page.screenshot({ path: path.join(shots, `pwa-${tag}-level-select.png`) });
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'level-alpha_level1', `${tag}: level 1 is not focused in Level select`);
  await page.keyboard.press('Enter');
  await until(page, t => t.scene === 'platform' && t.probe('platform') && t.probe('platform').ready, 'level 1', { max: 1200 });
  // The ePhone briefing, then play.
  for (let i = 0; i < 40 && (await probe(page, 'platform')).ui !== 'play'; i++) { await page.keyboard.press('Enter'); await step(page, 12); }
  const p = await probe(page, 'platform');
  assert(p.ui === 'play', `${tag}: level 1 did not reach play (ui ${p.ui})`);
  assert((await probe(page, 'flow')).lastLaunch.params.level === 'alpha_level1', `${tag}: Level select did not start level 1`);
  // Ride right for a second: the level really runs.
  const x0 = p.player.x;
  await page.keyboard.down('ArrowRight'); await step(page, 70); await page.keyboard.up('ArrowRight');
  const x1 = (await probe(page, 'platform')).player.x;
  assert(x1 > x0 + 40, `${tag}: the player did not move (x ${x0} -> ${x1})`);
  await page.screenshot({ path: path.join(shots, `pwa-${tag}-level1.png`) });
}

export const tests = [
  {
    name: '(a) manifest: valid fields, icons that exist at their stated sizes, linked and served as a manifest',
    async run(ctx) {
      const m = readJson(ctx, 'manifest.webmanifest');
      for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons']) assert(m[k], `manifest has no ${k}`);
      assert(m.short_name.length <= 15, `short_name "${m.short_name}" is over 15 characters (launchers cut it)`);
      assert(['fullscreen', 'standalone', 'minimal-ui'].includes(m.display), `display ${m.display} does not make an installable app`);
      assert(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color), 'colours are not #rrggbb');
      const start = new URL(m.start_url, 'https://x.test/game/manifest.webmanifest');
      const scope = new URL(m.scope, 'https://x.test/game/manifest.webmanifest');
      assert(start.href.startsWith(scope.href), `start_url ${start.href} is outside the scope ${scope.href}`);
      assert(start.href === 'https://x.test/game/', `start_url ${m.start_url} is not the folder the game is served from (relative paths)`);
      const sizes = [];
      for (const icon of m.icons) {
        const file = path.join(ctx.web, icon.src);
        assert(!icon.src.startsWith('/') && fs.existsSync(file), `icon ${icon.src} is missing or not relative`);
        assert(icon.type === 'image/png', `icon ${icon.src} type ${icon.type}`);
        const [w, h] = pngSize(file);
        assert(icon.sizes === `${w}x${h}`, `icon ${icon.src} says ${icon.sizes}, the file is ${w}x${h}`);
        sizes.push(`${icon.sizes} ${icon.purpose || 'any'}`);
      }
      assert(m.icons.some(i => i.sizes === '192x192' && /any/.test(i.purpose || 'any')) && m.icons.some(i => i.sizes === '512x512' && /any/.test(i.purpose || 'any')), 'installability needs 192 and 512 px icons');
      assert(m.icons.some(i => /maskable/.test(i.purpose || '')), 'no maskable icon');
      // Linked from the page and served with the manifest media type.
      const html = fs.readFileSync(path.join(ctx.web, 'index.html'), 'utf8');
      assert(/<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/.test(html), 'index.html does not link manifest.webmanifest');
      const res = await fetch(`${ctx.baseUrl}/manifest.webmanifest`);
      assert(res.status === 200 && /application\/manifest\+json/.test(res.headers.get('content-type')), `served ${res.status} ${res.headers.get('content-type')}`);
      for (const icon of m.icons) assert((await fetch(`${ctx.baseUrl}/${icon.src}`)).status === 200, `${icon.src} not served`);
      ctx.log(`${m.name} (${m.short_name}), display ${m.display}, icons ${sizes.join(', ')}`);
    },
  },
  {
    name: '(b) service worker: installs the build cache on the first visit; offline, a reload boots to the splash and plays level 1 from Level select',
    timeoutMs: 240000,
    async run(ctx) {
      const pre = readJson(ctx, 'precache.json');
      const build = /const BUILD = '([^']*)';/.exec(fs.readFileSync(path.join(ctx.web, 'sw.js'), 'utf8'))[1];
      assert(build === pre.version, `sw.js BUILD ${build} is not precache.json's ${pre.version}`);
      const server = await serve(ctx.web);
      const origin = `http://127.0.0.1:${server.address().port}`;
      let served = 0;
      server.on('request', () => { served++; });
      const { context, page, errors } = await ctx.openPage(DESKTOP);
      await page.goto(`${origin}/index.html?manual=1&lang=en`);
      await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
      assert(!(await page.evaluate(() => navigator.serviceWorker.controller)), 'a worker already controls a fresh context');

      // 1. First visit, online: splash, Level select, level 1. The worker registers as play begins.
      await splashToLevel1(page, ctx.shots, 'online');
      await page.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === 'activated', null, { timeout: 60000 });
      const scriptURL = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
      assert(scriptURL === `${origin}/sw.js`, `worker ${scriptURL}`);
      // Every install-list file is in this build's cache (the worker adds them in batches).
      const want = pre.files.map(f => new URL(f, `${origin}/`).pathname);
      let cached = [];
      for (let i = 0; i < 120; i++) {
        cached = await page.evaluate(async name => (await caches.has(name)) ? (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname) : [], `smw-${build}`);
        if (want.every(p => cached.includes(p))) break;
        await page.waitForTimeout(250);
      }
      const missing = want.filter(p => !cached.includes(p));
      assert(missing.length === 0, `not precached after 30 s: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` and ${missing.length - 10} more` : ''}`);
      // Every game file the page downloaded before the worker took control (the splash, Level
      // select's thumbnails, the cutscene art the splash prefetches) is adopted into the cache.
      let unadopted = [];
      for (let i = 0; i < 240; i++) {
        unadopted = await page.evaluate(async name => {
          const cache = await caches.open(name);
          const seen = [...new Set(performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => u.origin === location.origin && u.pathname.includes('/data/')).map(u => u.pathname))];
          const out = [];
          for (const p of seen) if (!(await cache.match(p, { ignoreSearch: true }))) out.push(p);
          return out;
        }, `smw-${build}`);
        if (!unadopted.length) break;
        await page.waitForTimeout(250);
      }
      assert(unadopted.length === 0, `downloaded before the worker took control but not cached after 60 s: ${unadopted.join(', ')}`);
      // The rest of the game ("lazy": the other areas' and the other avatar's art) follows in the
      // background once play has begun (sw.js "cache-rest"), so later levels work offline too.
      const lazyWant = pre.lazy.map(f => new URL(f, `${origin}/`).pathname);
      let lazyMissing = lazyWant;
      for (let i = 0; i < 240 && lazyMissing.length; i++) {
        const have = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname), `smw-${build}`);
        lazyMissing = lazyWant.filter(p => !have.includes(p));
        if (lazyMissing.length) await page.waitForTimeout(250);
      }
      assert(lazyMissing.length === 0, `the rest of the game was not cached in the background after 60 s: ${lazyMissing.slice(0, 8).join(', ')}`);
      const keys = await page.evaluate(() => caches.keys());
      assert(keys.filter(k => k.startsWith('smw-')).join() === `smw-${build}`, `caches ${keys}`);
      assert(errors.length === 0, `console errors online:\n${errors.join('\n')}`);

      // 2. Offline: the server stops and drops its connections; the context is offline as well.
      //    Prove the network is gone for the worker too: a file never cached must fail (a 404
      //    would mean the worker's own fetch still reached a server).
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      await context.setOffline(true);
      const servedOnline = served;
      const probeFetch = await page.evaluate(() => fetch(`never-cached-${Date.now()}.json`).then(r => `HTTP ${r.status}`, e => `rejected: ${e.message}`));
      assert(/^rejected/.test(probeFetch), `offline is not offline: an uncached fetch gave ${probeFetch}`);
      errors.length = 0;   // the probe fetch's own failure

      // 3. Reload offline: boots from the cache to the splash, then Level select and level 1.
      const failed = [];
      page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure() && r.failure().errorText}`));
      await page.reload();
      await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
      assert(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the offline reload is not controlled by the worker');
      await splashToLevel1(page, ctx.shots, 'offline');
      // Level 2 and level 5 (other tiles, other microbes) play offline with their own art: the
      // debug renderer draws nothing.
      for (const id of ['alpha_level2', 'alpha_level5']) {
        await page.evaluate(async () => (await import('./js/platformer/sprites.js')).sprites.debugDrawn.clear());
        await page.evaluate(level => window.__test.app.flow.playLevel(level), id);
        await until(page, t => t.scene === 'platform' && !t.transitioning && t.probe('platform') && t.probe('platform').ready && t.probe('platform').level !== 'alpha_level1', id, { max: 1200 });
        for (let i = 0; i < 40 && (await probe(page, 'platform')).ui !== 'play'; i++) { await page.keyboard.press('Enter'); await step(page, 12); }
        await step(page, 30);
        const p = await probe(page, 'platform');
        const debug = await page.evaluate(async () => [...(await import('./js/platformer/sprites.js')).sprites.debugDrawn]);
        assert(p.level === id && p.ui === 'play' && p.tilesDrawn > 0, `${id} offline: level ${p.level}, ui ${p.ui}, tiles ${p.tilesDrawn}`);
        assert(debug.length === 0, `${id} offline drew placeholder shapes for ${debug.join(', ')}`);
        await page.screenshot({ path: path.join(ctx.shots, `pwa-offline-${id}.png`) });
      }
      assert(failed.length === 0, `requests failed offline:\n${failed.join('\n')}`);
      assert(errors.length === 0, `console errors offline:\n${errors.join('\n')}`);
      ctx.log(`build ${build}: ${want.length} files precached at install, ${lazyWant.length} more in the background (${servedOnline} requests served online); offline reload booted and played levels 1, 2 and 5 (uncached fetch: ${probeFetch})`);
      await context.close();
    },
  },
];
