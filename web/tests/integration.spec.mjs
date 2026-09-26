// Cross-area integration checks (web/requests/*.md, resolved when the areas were joined):
//   - the platform pause menu opens the flow's Settings panel over the paused level and leaves for
//     Level select; the platform probe names the avatar in play;
//   - the kitchen's tissues, cling film and wash keys follow Settings (prompts, legend, play);
//   - art for the next screen is downloaded while the current one plays (splash -> cutscene, a
//     level -> the round's next level, the last level -> the game show) without being decoded,
//     and the cutscene waits on a loading ring while its art is still missing;
//   - the game show children's `condifent` and `curious` poses are in the atlas.
// The prefetch test holds some atlas requests back with page.route handlers that never (or only
// later) continue; the pending requests end when the test closes its browser context. Keep it that
// way if the runner ever runs specs in parallel or adds request timeouts.
const PHONE = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);

// Steps the engine until predicate(__test) holds, yielding to the page so loads can finish.
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

// Stores settings and progress before the page loads (keys as core/save.js writes them).
function seedStorage(values) {
  return {
    fn: v => { if (!sessionStorage.getItem('seeded')) { for (const [k, x] of Object.entries(v)) localStorage.setItem('smw:' + k, JSON.stringify(x)); sessionStorage.setItem('seeded', '1'); } },
    arg: values,
  };
}

async function open(ctx, opts, query, { init = null, onRequest = null, route = null } = {}) {
  const { context, page, errors } = await ctx.openPage(opts);
  if (init) await context.addInitScript(init.fn, init.arg);
  if (onRequest) page.on('request', r => onRequest(r.url()));
  if (route) await page.route(route.pattern, route.handler);
  await page.goto(`${ctx.baseUrl}/index.html?manual=1${query}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
  return { context, page, errors };
}

// Whether an atlas has been decoded into the shared sprite cache (the page's own module).
// Holds the splash's own sheet back for the whole page (so the splash never prefetches).
const HOLD_SPLASH = { pattern: '**/data/atlas/splash-0.webp', handler: () => {} };

const decoded = (page, id) => page.evaluate(async i => (await import('./js/platformer/sprites.js')).sprites.atlasLoads.has(i), id);

export const tests = [
  {
    name: 'platform pause menu: Settings opens over the paused level and returns to the card; Level select leaves the level; the probe names the avatar',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, PHONE, '&lang=en&scene=platform&level=alpha_level1&intro=0&seed=1&avatar=amy');
      await until(page, t => t.probe('platform') && t.probe('platform').ready && t.probe('platform').ui === 'play', 'play');
      let p = await probe(page, 'platform');
      assert(p.avatar === 'amy', `probe avatar ${p.avatar}`);
      await page.keyboard.press('Escape'); await step(page, 2);
      assert((await probe(page, 'platform')).ui === 'paused', 'Escape did not pause');
      // Every pause button, the new ones included, is a real 44 CSS px target on a 667 x 375 phone
      // (measured once the card's bounce-in has finished; it runs in real time).
      await page.waitForTimeout(600);
      const sizes = await page.evaluate(() => [...document.querySelectorAll('.pf-card button')].map(b => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height, bottom: r.bottom }; }));
      assert(sizes.some(s => s.id === 'pf-settings') && sizes.some(s => s.id === 'pf-level-select'), `pause buttons ${sizes.map(s => s.id)}`);
      for (const s of sizes) assert(s.w >= 44 && s.h >= 44 && s.bottom <= 375, `${s.id} is ${s.w.toFixed(1)} x ${s.h.toFixed(1)} (bottom ${s.bottom.toFixed(1)})`);
      await page.screenshot({ path: `${ctx.shots}/integration-pause-phone.png` });
      await page.locator('#pf-settings').click();
      await step(page, 2);
      assert(await page.locator('#settings-overlay').count() === 1, 'Settings did not open the panel');
      assert(await page.evaluate(() => window.__test.app.flow.overlayOpen), 'overlayOpen not set');
      const stepsBefore = (await probe(page, 'platform')).stepCount;
      await page.keyboard.press('ArrowDown'); await step(page, 2);
      await page.keyboard.press('Escape'); await step(page, 4);
      assert(await page.locator('#settings-overlay').count() === 0, 'Escape did not close the panel');
      p = await probe(page, 'platform');
      assert(p.ui === 'paused' && p.stepCount === stepsBefore, `after the panel: ui ${p.ui}, steps ${stepsBefore} -> ${p.stepCount}`);
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'pf-settings', 'focus did not return to Settings');
      // The card still works from the keyboard: Resume is back in the Tab cycle.
      await page.locator('#pf-resume').focus();
      await page.keyboard.press('Enter'); await step(page, 2);
      assert((await probe(page, 'platform')).ui === 'play', 'Resume after Settings did not resume');
      await page.keyboard.press('Escape'); await step(page, 2);
      await page.locator('#pf-level-select').click();
      await step(page, 2);
      // Leaving the level asks first: Escape answers No and the pause card is back; then Yes.
      assert(await page.locator('#fl-confirm-yes').count() === 1, 'Level select did not ask first');
      await page.keyboard.press('Escape'); await step(page, 2);
      assert(await page.locator('#fl-confirm-yes').count() === 0 && (await probe(page, 'platform')).ui === 'paused', 'Escape did not answer No');
      await page.locator('#pf-level-select').click();
      await step(page, 2);
      await page.locator('#fl-confirm-yes').click();
      await until(page, t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready, 'Level select', { max: 400 });
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'kitchen: tool keys remapped in Settings drive the tissues and the sink, the prompts, the legend and the bubbles',
    timeoutMs: 90000,
    async run(ctx) {
      const keys = { tissues: ['KeyY'], wash: ['KeyG'] };
      const init = seedStorage({ settings: { v: 2, keys } });
      // Level 2's intro names the tissues key.
      let { context, page, errors } = await open(ctx, DESKTOP, '&scene=kitchen&level=1&seed=4&avatar=harry', { init });
      await until(page, t => t.probe('kitchen') && t.probe('kitchen').ready, 'the kitchen');
      await page.mouse.click(5, 5);
      await step(page, 2);
      let seen = '';
      for (let i = 0; i < 12 && (await probe(page, 'kitchen')).mode === 'intro'; i++) {
        seen += ' ' + await page.evaluate(() => document.querySelector('.kz-intro-text')?.textContent || '');
        await page.keyboard.press('Enter'); await step(page, 2);
      }
      assert(/\(or press Y\)/.test(seen) && !/press T\b/.test(seen), `level 2 intro: ${seen}`);
      let p = await probe(page, 'kitchen');
      assert(p.mode === 'play', `not playing (${p.mode})`);
      assert(p.hud.tissue === 'Tissue! (Y)' && p.hud.wash === 'Wash (G)', `bubbles ${JSON.stringify(p.hud)}`);
      const legend = await page.textContent('.kz-legend');
      assert(/Y tissues/.test(legend) && /C cling film/.test(legend) && /G wash hands/.test(legend), `legend: ${legend}`);
      // The old key does nothing; the new one washes.
      await until(page, t => t.probe('kitchen').state === 'wait', 'waiting for an item', { max: 400, chunk: 2 });
      await page.keyboard.press('KeyH'); await step(page, 2);
      assert((await probe(page, 'kitchen')).state !== 'wash', 'H still washes');
      await page.keyboard.press('KeyG'); await step(page, 2);
      p = await probe(page, 'kitchen');
      assert(p.state === 'wash' || p.avatarLabel === 'wash_hands', `G did not wash (state ${p.state}, avatar ${p.avatarLabel})`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'prefetch: the splash downloads the cutscene art; the cutscene waits on a loading ring; a level downloads the next level, the last one the game show, without decoding',
    timeoutMs: 180000,
    async run(ctx) {
      // 1. Splash: its own sheet, then the cutscene's, downloaded but not decoded.
      let urls = [];
      let release;
      const held = new Promise(r => { release = r; });
      let { context, page, errors } = await open(ctx, DESKTOP, '&lang=en', {
        onRequest: u => urls.push(u),
        route: { pattern: '**/data/atlas/cutscene-0.webp', handler: async r => { await held; await r.continue(); } },
      });
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /gameshow-cast-0\.webp$/.test(e.name)), null, { timeout: 20000 });
      assert(urls.some(u => /atlas\/cutscene-0\.webp$/.test(u)) && urls.some(u => /gameshow-bg-0\.webp$/.test(u)), 'the splash did not start downloading the cutscene art');
      assert(!(await decoded(page, 'gameshow-cast')), 'the splash decoded the cutscene art');
      // 2. New Game while the cutscene sheet is still held back: a loading ring, no studio yet.
      await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
      await page.click('#btn-new-game');
      await until(page, t => t.scene === 'cutscene', 'the cutscene', { max: 200 });
      await step(page, 40);
      assert((await probe(page, 'cutscene')).phase === 'loading', 'the cutscene started without its art');
      const ring = await page.evaluate(() => {
        const c = document.getElementById('game'), g = c.getContext('2d');
        const k = c.width / 800, d = g.getImageData(0, 0, c.width, c.height).data;
        let yellow = 0, other = 0;
        for (let y = 190; y < 260; y += 2) for (let x = 360; x < 440; x += 2) {
          const i = (Math.round(y * k) * c.width + Math.round(x * k)) * 4;
          if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 120) yellow++; else if (d[i] + d[i + 1] + d[i + 2] > 60) other++;
        }
        return { yellow, other };
      });
      assert(ring.yellow > 5, `no loading ring on the waiting cutscene (${JSON.stringify(ring)})`);
      release();
      await until(page, t => t.probe('cutscene').phase !== 'loading', 'the cutscene art', { max: 600 });
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();

      // 3. Continue into the first level of round 1: level 2's art is downloaded, not decoded.
      const progress = run => seedStorage({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level2', 'alpha_level8', 'alpha_level9'], best: {} } });
      urls = [];
      ({ context, page, errors } = await open(ctx, DESKTOP, '&lang=en', {
        init: progress({ avatar: 'harry', nickname: '', round: 0, part: 0, step: 'action', quiz: 0, cpu: 0, hover: 0, kitchen: 0, seed: 3 }),
        onRequest: u => urls.push(u),
        route: HOLD_SPLASH,
      }));
      // Straight on from the splash, whose own sheet is held back (so its cutscene prefetch never
      // starts): every atlas request below comes from the level.
      await page.evaluate(() => window.__test.app.flow.continueGame());
      await until(page, t => t.scene === 'platform' && t.probe('platform') && t.probe('platform').ready, 'level 1');
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /tiles-skin-0\.webp$/.test(e.name)), null, { timeout: 20000 });
      assert(!(await decoded(page, 'tiles-skin')), 'level 2 art was decoded during level 1');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();

      // 4. Continue into the last level of round 3: the game show art is downloaded, not decoded.
      urls = [];
      ({ context, page, errors } = await open(ctx, DESKTOP, '&lang=en', {
        init: progress({ avatar: 'amy', nickname: '', round: 2, part: 1, step: 'action', quiz: 20, cpu: 15, hover: 40, kitchen: 0, seed: 5 }),
        onRequest: u => urls.push(u),
        route: HOLD_SPLASH,
      }));
      await page.evaluate(() => window.__test.app.flow.continueGame());
      await until(page, t => t.scene === 'platform' && t.probe('platform') && t.probe('platform').ready, 'level 9');
      assert(!urls.some(u => /atlas\/cutscene-0\.webp$/.test(u)), 'the splash prefetch ran (this check needs the level alone)');
      assert((await probe(page, 'flow')).lastLaunch.params.level === 'alpha_level9', 'not level 9');
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /gameshow-cast-0\.webp$/.test(e.name)), null, { timeout: 20000 });
      assert(!(await decoded(page, 'gameshow-cast')), 'the game show art was decoded during the level');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'game show: the children\'s condifent and curious poses are in the atlas and play without a fallback',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, '&lang=en');
      const out = await page.evaluate(async () => {
        const a = await import('./js/gameshow/art.js');
        await a.loadAtlases(['gameshow-cast']);
        const res = {};
        for (const name of ['gs_harry', 'gs_amy']) {
          const sym = a.entry(name).sym;
          for (const label of ['condifent', 'curious']) {
            const c = new a.Clip(name, { fallbacks: { condifent: 'cautious', curious: 'neutral' } });
            c.play(label);
            const start = sym.labels[label];
            res[`${name}:${label}`] = { label: c.label, frame: c.frame, posed: sym.rig.frames[start - 1] != null && sym.rig.frames[start + 30 - 1] != null };
          }
        }
        return res;
      });
      for (const [k, v] of Object.entries(out)) assert(v.label === k.split(':')[1] && v.posed, `${k}: ${JSON.stringify(v)}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
