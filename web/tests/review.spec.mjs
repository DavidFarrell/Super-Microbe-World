// Fixes from the whole-game review (NOTES 10.2 #87 and 10.6), each checked in the running game:
//   (a) the game show host echoes the answer label the board showed, in the quiz language, and
//       the answer buttons carry that language's tag;
//   (b) turning blind rounds on or off during a quiz does not change what follows it: "Step
//       right this way" is always followed by the shrinking zone;
//   (c) a phone gets a Full screen button on the splash and the pause card, and a touch New Game
//       asks for full screen;
//   (d) level 5 on a phone: the HUD ePhone fades while the player is under it, and the Throw
//       button is dimmed while there is nothing to throw;
//   (e) Settings on a phone: a vertical swipe over a slider scrolls the panel and leaves the
//       value alone, a sideways drag sets it; a key capture can be cancelled by touch; the
//       Controls tab explains the keys to a touch player;
//   (f) language tags: the chooser tags each language with its BCP 47 code and the page stays
//       en-GB while the menus are English; the yoghurt goals read as the briefings do;
//   (g) New Game: level 1's art that does not depend on the avatar is downloaded (not decoded)
//       while the cutscene plays.
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);

async function until(page, predicate, what, { max = 3000, chunk = 4 } = {}) {
  const src = predicate.toString();
  for (let used = 0; used <= max; used += chunk) {
    const ok = await page.evaluate(s => { try { return !!(0, eval)(s)(window.__test); } catch { return false; } }, src);
    if (ok) return used;
    await step(page, chunk);
    if (used % 100 === 0) await page.waitForTimeout(10);
  }
  throw new Error(`timed out waiting for ${what} (scene ${await page.evaluate(() => window.__test.scene)})`);
}

async function open(ctx, opts, query = '', storage = null) {
  const { context, page, errors } = await ctx.openPage(opts);
  if (storage) {
    await context.addInitScript(v => {
      if (sessionStorage.getItem('seeded')) return;
      for (const [k, x] of Object.entries(v)) localStorage.setItem('smw:' + k, JSON.stringify(x));
      sessionStorage.setItem('seeded', '1');
    }, storage);
  }
  await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en${query}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
  return { context, page, errors };
}

const center = async (page, sel) => { const b = await page.locator(sel).boundingBox(); assert(b, `${sel} is not visible`); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
async function tap(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function drag(cdp, x0, y0, x1, y1, n = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 4 }] });
  for (let i = 1; i <= n; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, id: 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const launches = page => page.evaluate(() => {
  const sc = window.__test.app.scenes;
  const go = sc.go.bind(sc);
  window.__launches = [];
  sc.go = (name, params, style) => { window.__launches.push({ name, params }); return go(name, params, style); };
});
const callLast = (page, name, cb, arg) => page.evaluate(([n, c, a]) => window.__launches.filter(x => x.name === n).pop().params[c](a), [name, cb, arg]);

export const tests = [
  {
    name: '(a) game show in French: the host echoes the label the board showed; the answers carry lang="fr"',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, '&scene=gameshow');
      await page.evaluate(() => window.__test.go('gameshow', { round: 1, lang: 'fr_fr', seed: 3, avatar: 'amy', nickname: 'Zoe', cpuName: 'Harry' }));
      await until(page, t => t.probe('gameshow') && t.probe('gameshow').ready, 'the game show');
      let p = null;
      for (let i = 0; i < 800; i++) {
        p = await probe(page, 'gameshow');
        if (p.phase === 'board' && p.board.accepting) break;
        if (p.phase === 'title' && p.tick >= 30) await page.keyboard.press('Enter');
        else if (p.talkie && p.talkie.waiting) await page.keyboard.press('Enter');
        await step(page, 3);
      }
      assert(p.phase === 'board', `no board (phase ${p.phase})`);
      assert(p.lang === 'fr_fr' && p.labels[2] === "Pas d'accord", `labels ${JSON.stringify(p.labels)}`);
      const langs = await page.evaluate(() => [...document.querySelectorAll('.gs-board button')].map(b => b.lang));
      assert(langs.length === 3 && langs.every(l => l === 'fr'), `answer button langs ${langs}`);
      await page.keyboard.press('Digit3');
      let said = '';
      for (let i = 0; i < 200 && !/you chose/.test(said); i++) { await step(page, 3); said = ((await probe(page, 'gameshow')).talkie || {}).statement || ''; }
      assert(said.startsWith("Zoe, you chose Pas d'accord."), `host line: ${said}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(b) blind rounds switched during a quiz take effect from the next quiz: "Step right this way" always leads to the shrinking zone',
    timeoutMs: 90000,
    async run(ctx) {
      const run = (round, step0) => ({ avatar: 'harry', nickname: 'Sam', round, part: 0, step: step0, quiz: 0, cpu: 0, hover: 0, kitchen: 0, seed: 9 });
      // Off at the start of round 1's quiz, switched on during it.
      let o = await open(ctx, DESKTOP, '', { progress: { v: 1, run: run(0, 'quiz'), unlocked: ['alpha_level1'], best: {} }, settings: { v: 2, blindRounds: false } });
      await launches(o.page);
      await o.page.evaluate(() => window.__test.app.flow.continueGame());
      await until(o.page, t => t.scene === 'gameshow' && !t.transitioning, 'the round 1 quiz');
      let f = await probe(o.page, 'flow');
      assert(f.lastLaunch.params.stepRight === true && f.lastLaunch.params.blind === false, `launch ${JSON.stringify(f.lastLaunch.params)}`);
      await o.page.evaluate(async () => (await import('./js/core/settings.js')).settings.set('blindRounds', true));
      await callLast(o.page, 'gameshow', 'onComplete', { playerScore: 20, cpuScore: 5 });
      await until(o.page, t => t.scene === 'shrink', 'the shrinking zone');
      f = await probe(o.page, 'flow');
      assert(f.lastLaunch.scene === 'shrink' && f.lastLaunch.params.round === 2 && f.run.step === 'shrink', `after the quiz: ${JSON.stringify(f.lastLaunch)} step ${f.run.step}`);
      assert(o.errors.length === 0, `console errors:\n${o.errors.join('\n')}`);
      await o.context.close();
      // On at the start of round 2's quiz, switched off during it: the blind half of round 3 still
      // comes next (its own "Step right this way" leads to the shrink).
      o = await open(ctx, DESKTOP, '', { progress: { v: 1, run: run(1, 'quiz'), unlocked: ['alpha_level1'], best: {} }, settings: { v: 2, blindRounds: true } });
      await launches(o.page);
      await o.page.evaluate(() => window.__test.app.flow.continueGame());
      await until(o.page, t => t.scene === 'gameshow' && !t.transitioning, 'the round 2 quiz');
      f = await probe(o.page, 'flow');
      assert(f.lastLaunch.params.stepRight === false, `launch ${JSON.stringify(f.lastLaunch.params)}`);
      await o.page.evaluate(async () => (await import('./js/core/settings.js')).settings.set('blindRounds', false));
      await callLast(o.page, 'gameshow', 'onComplete', { playerScore: 20, cpuScore: 5 });
      await until(o.page, t => t.scene === 'gameshow' && t.probe('flow').lastLaunch.params.round === 3, 'the round 3 blind quiz');
      f = await probe(o.page, 'flow');
      assert(f.lastLaunch.params.blind === true && f.lastLaunch.params.stepRight === true, `after the quiz: ${JSON.stringify(f.lastLaunch.params)}`);
      assert(o.errors.length === 0, `console errors:\n${o.errors.join('\n')}`);
      await o.context.close();
    },
  },
  {
    name: '(c) phone: Full screen on the splash and the pause card; a touch New Game asks for full screen',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, PHONE);
      const cdp = await context.newCDPSession(page);
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
      const s0 = await center(page, '#game');
      await tap(cdp, s0.x, s0.y);        // skips the tuning (and makes the device touch)
      await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
      assert((await probe(page, 'splash')).fullscreenButton, 'no Full screen button on the splash');
      const fs = await center(page, '#btn-fullscreen');
      assert(fs.b.width >= 44 && fs.b.height >= 44, `the Full screen button is ${fs.b.width}x${fs.b.height}`);
      await tap(cdp, fs.x, fs.y);
      await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
      await step(page, 2);
      assert(/Leave/.test(await page.getAttribute('#btn-fullscreen', 'aria-label')), 'the button does not offer to leave full screen');
      const fs2 = await center(page, '#btn-fullscreen');
      await tap(cdp, fs2.x, fs2.y);
      await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
      // A touch New Game asks for full screen as it starts the game.
      const ng = await center(page, '#btn-new-game');
      await tap(cdp, ng.x, ng.y);
      await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
      await until(page, t => t.scene === 'cutscene', 'the cutscene');
      await page.evaluate(() => document.exitFullscreen());
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
      // The pause card.
      const l = await open(ctx, PHONE, '&scene=platform&level=alpha_level1&intro=0&seed=1');
      const cdp2 = await l.context.newCDPSession(l.page);
      await until(l.page, t => t.probe('platform') && t.probe('platform').ui === 'play', 'play');
      const pz = await center(l.page, '#touch-pause');
      await tap(cdp2, pz.x, pz.y);
      await step(l.page, 2);
      assert(await l.page.locator('#pf-fullscreen').count() === 1, 'no Full screen button on the pause card');
      const pf = await center(l.page, '#pf-fullscreen');
      await tap(cdp2, pf.x, pf.y);
      await l.page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
      assert(l.errors.length === 0, `console errors:\n${l.errors.join('\n')}`);
      await l.context.close();
    },
  },
  {
    name: '(d) level 5 on a phone: the ePhone fades over the player at the start; Throw is dimmed with nothing to throw',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, PHONE, '&scene=platform&level=alpha_level5&intro=0&seed=1');
      const cdp = await context.newCDPSession(page);
      await until(page, t => t.probe('platform') && t.probe('platform').ui === 'play', 'play');
      const j = await center(page, '#touch-jump');
      await tap(cdp, j.x, j.y);           // the touch layout (the phone moves to the left edge)
      await step(page, 40);
      const p = await probe(page, 'platform');
      assert(p.hud.touchLayout, 'not in the touch layout');
      const r = p.hud.phone, pl = p.player;
      const under = r.x < pl.x - p.camera.x + pl.w && pl.x - p.camera.x < r.x + r.w && r.y < pl.y + pl.h && pl.y < r.y + r.h;
      assert(under, `the player is not under the phone at the start (phone ${JSON.stringify(r)}, player ${pl.x},${pl.y})`);
      assert(p.hud.phoneAlpha < 0.5, `the ePhone did not fade over the player (alpha ${p.hud.phoneAlpha})`);
      const fire = await page.evaluate(() => { const b = document.getElementById('touch-fire'); return { empty: b.classList.contains('empty'), disabled: b.getAttribute('aria-disabled'), opacity: getComputedStyle(b).opacity }; });
      assert(p.player.ammo === 0 && fire.empty && fire.disabled === 'true', `Throw with ammo ${p.player.ammo}: ${JSON.stringify(fire)}`);
      await page.screenshot({ path: `${ctx.shots}/review-level5-phone.png` });
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(e) Settings on a phone at 130% text: swipes scroll past sliders, drags set them; key capture cancels by touch',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, SMALL, '&scene=settings', { settings: { v: 2, textScale: 1.3, touchOpacity: 0.55 } });
      const cdp = await context.newCDPSession(page);
      await until(page, t => t.scene === 'settings' && t.probe('settings'), 'Settings');
      const tab = await center(page, '#settings-tab-display');
      await tap(cdp, tab.x, tab.y);
      await step(page, 2);
      const sl = await center(page, '#settings-touch');
      await drag(cdp, sl.x, sl.y, sl.x + 4, sl.y - 150);
      await page.waitForTimeout(400);
      let s = await probe(page, 'settings');
      assert(s.touchOpacity === 0.55, `a vertical swipe over the slider changed it to ${s.touchOpacity}`);
      const sl2 = await center(page, '#settings-touch');
      await drag(cdp, sl2.b.x + 20, sl2.y, sl2.b.x + sl2.b.width * 0.8, sl2.y + 3);
      await step(page, 2);
      s = await probe(page, 'settings');
      assert(s.touchOpacity !== 0.55, 'a sideways drag did not set the slider');
      // Controls: the touch note, and Change turns into Cancel while it waits for a key.
      const ct = await center(page, '#settings-tab-controls');
      await tap(cdp, ct.x, ct.y);
      await step(page, 2);
      assert(await page.locator('#settings-touch-note').count() === 1, 'no note about the keys for a touch player');
      const ch = await center(page, '#settings-remap-left');
      await tap(cdp, ch.x, ch.y);
      await step(page, 2);
      assert((await probe(page, 'settings')).capturing === 'left' && await page.textContent('#settings-remap-left') === 'Cancel', 'not waiting for a key with a Cancel button');
      const ch2 = await center(page, '#settings-remap-left');
      await tap(cdp, ch2.x, ch2.y);
      await step(page, 2);
      assert((await probe(page, 'settings')).capturing === null && await page.textContent('#settings-remap-left') === 'Change', 'Cancel did not stop the capture');
      await tap(cdp, ch2.x, ch2.y);
      await step(page, 2);
      assert((await probe(page, 'settings')).capturing === 'left', 'Change did not start a capture');
      const note = await center(page, '#settings-touch-note');
      await tap(cdp, note.x, note.y);
      await step(page, 2);
      assert((await probe(page, 'settings')).capturing === null, 'a tap outside the row did not stop the capture');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(f) language tags in the chooser, the page stays en-GB with English menus; yoghurt goals as in the briefings',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, '&lang=fr_fr');
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash');
      assert(await page.evaluate(() => document.documentElement.lang) === 'en-GB', `html lang ${await page.evaluate(() => document.documentElement.lang)}`);
      await page.keyboard.press('Enter');
      await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
      await page.evaluate(() => document.getElementById('btn-language').click());
      await step(page, 4);
      const tags = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[id^="lang-"][lang]')].map(b => [b.id.slice(5), b.lang])));
      const want = { en: 'en-GB', bg_fl: 'nl-BE', bg_fr: 'fr-BE', cz_cz: 'cs', dk_dk: 'da', fr_fr: 'fr', gk_gk: 'el', it_it: 'it', pl_pl: 'pl', por_por: 'pt', sp_sp: 'es' };
      assert(JSON.stringify(tags) === JSON.stringify(want), `chooser tags ${JSON.stringify(tags)}`);
      const goals = await page.evaluate(async () => {
        const { goalText } = await import('./js/platformer/hud.js');
        const { G } = await import('./js/platformer/constants.js');
        return [goalText({ type: G.YOGURT, required: 1 }), goalText({ type: G.YOGURT, required: 3 })];
      });
      assert(goals[0] === 'Turn the milk into yogurt' && goals[1] === 'Turn 3 glasses of milk into yogurt', `yoghurt goals: ${goals.join(' | ')}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(g) New Game downloads level 1\'s avatar-independent art during the cutscene, without decoding it',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP);
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash');
      await page.evaluate(() => window.__test.app.flow.newGame());
      await until(page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro', 'the cutscene');
      const want = ['tiles-kitchen-0.webp', 'microbe-lucy-0.webp', 'entities-0.webp', 'hud-0.webp', 'intro-level1-0.webp'];
      let got = [];
      for (let i = 0; i < 100; i++) {
        got = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name.split('/').pop()));
        if (want.every(f => got.includes(f))) break;
        await page.waitForTimeout(100);
      }
      assert(want.every(f => got.includes(f)), `not downloaded during the cutscene: ${want.filter(f => !got.includes(f)).join(', ')}`);
      assert(!got.some(f => /^player-/.test(f)), 'an avatar sheet was downloaded before the choice');
      const decoded = await page.evaluate(async () => [...(await import('./js/platformer/sprites.js')).sprites.decoded.keys()]);
      assert(!decoded.includes('tiles-kitchen') && !decoded.includes('microbe-lucy'), `decoded during the cutscene: ${decoded.join(', ')}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
