// Robustness on a patchy connection (a phone on mobile data): one failed download must not
// break a file for the rest of the session. Each test makes a file fail (page.route aborts it)
// for its first attempts only, then lets the network work again, and checks that the game asks
// again instead of keeping the failure:
//   (a) the atlas index (data/atlas/index.json) failing at boot: the splash still loads it and
//       draws its own art;
//   (b) a level file failing: the level shows a connection card (not "Level not found") with
//       Try again, which then loads and plays the level; Back leaves the level;
//   (c) one atlas page (Harry's hoverboard sheet) failing: the level plays, offers to fetch the
//       missing pictures, and the retry brings the art back.
// A network error is retried once inside the loader (core/assets.js fetchOk), so each route
// aborts the first two requests to exhaust that retry. Service workers are blocked so every
// request reaches the route. Aborted requests log "Failed to load resource" console errors,
// which are expected here and ignored; any other console error fails the test.
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);

async function until(page, predicate, what, { max = 3000, chunk = 4 } = {}) {
  const src = predicate.toString();
  for (let used = 0; used <= max; used += chunk) {
    const ok = await page.evaluate(s => { try { return !!(0, eval)(s)(window.__test); } catch { return false; } }, src);
    if (ok) return used;
    await step(page, chunk);
    if (used % 100 === 0) await page.waitForTimeout(20);
  }
  throw new Error(`timed out waiting for ${what} (scene ${await page.evaluate(() => window.__test.scene)})`);
}

// Opens the game with `pattern` failing for its first `failures` requests. Returns the page and
// a counter of the requests the route saw.
async function openFlaky(ctx, query, pattern, failures = 2) {
  const { context, page, errors } = await ctx.openPage(PHONE);
  const seen = { n: 0 };
  await page.route(pattern, route => {
    seen.n++;
    if (seen.n <= failures) route.abort('failed'); else route.continue();
  });
  await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en${query}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
  return { context, page, errors, seen };
}

const realErrors = errors => errors.filter(e => !/Failed to load resource|ERR_FAILED/i.test(e));
const sprites = page => page.evaluate(async () => {
  const { sprites: s } = await import('./js/platformer/sprites.js');
  return { index: !!s.index, decoded: [...s.decoded.keys()], failed: [...s.failed], symbols: s.symbols.size };
});

export const tests = [
  {
    name: 'a failed atlas index at boot is fetched again: the splash draws its art',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors, seen } = await openFlaky(ctx, '', '**/data/atlas/index.json');
      await until(page, t => t.scene === 'splash' && t.probe('splash') && t.probe('splash').ready, 'the splash art');
      const s = await sprites(page);
      assert(seen.n >= 3, `index.json requested ${seen.n} times`);
      assert(s.index && s.decoded.includes('splash') && s.symbols > 0, `sprites after boot: ${JSON.stringify(s)}`);
      assert(realErrors(errors).length === 0, `errors: ${realErrors(errors).join(' | ')}`);
      ctx.log(`index.json requests: ${seen.n}; decoded ${s.decoded.join(', ')}`);
      await context.close();
    },
  },
  {
    name: 'a failed level file shows a connection card; Try again loads and plays the level',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors, seen } = await openFlaky(ctx, '&scene=platform&level=alpha_level2&intro=0&seed=1', '**/data/levels/alpha_level2.json');
      await until(page, t => t.probe('platform') && t.probe('platform').ui === 'error', 'the error card');
      const p = await probe(page, 'platform');
      assert(!/not found/i.test(p.error) && /download/i.test(p.error), `error card heading: ${p.error}`);
      assert(await page.locator('#pf-load-retry').count() === 1 && await page.locator('#pf-load-back').count() === 1, 'no Try again / Back');
      await page.screenshot({ path: `${ctx.shots}/robustness-level-error.png` });
      await page.locator('#pf-load-retry').click();
      await until(page, t => t.probe('platform') && t.probe('platform').ready && t.probe('platform').ui === 'play', 'play after Try again');
      assert(seen.n === 3, `alpha_level2.json requested ${seen.n} times`);
      const s = await sprites(page);
      assert(s.decoded.includes('tiles-skin') && s.failed.length === 0, `sprites: ${JSON.stringify(s)}`);
      assert(realErrors(errors).length === 0, `errors: ${realErrors(errors).join(' | ')}`);
      await context.close();
    },
  },
  {
    name: 'a failed atlas page: the level plays, offers a retry, and the retry brings the art back',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors, seen } = await openFlaky(ctx, '&scene=platform&level=alpha_level1&intro=0&seed=1&avatar=harry', '**/data/atlas/player-harry-0.webp');
      await until(page, t => t.probe('platform') && t.probe('platform').ready && t.probe('platform').ui === 'play', 'play');
      let p = await probe(page, 'platform');
      let s = await sprites(page);
      assert(p.artRetry && s.failed.includes('player-harry') && !s.decoded.includes('player-harry'), `first attempt: retry ${p.artRetry}, ${JSON.stringify(s)}`);
      await page.locator('#pf-art-retry').click();
      await until(page, t => t.probe('platform') && !t.probe('platform').artRetry, 'the retry button to go');
      s = await sprites(page);
      assert(s.decoded.includes('player-harry') && s.failed.length === 0, `after the retry: ${JSON.stringify(s)}`);
      assert(seen.n === 3, `player-harry-0.webp requested ${seen.n} times`);
      assert(realErrors(errors).length === 0, `errors: ${realErrors(errors).join(' | ')}`);
      await context.close();
    },
  },
];
