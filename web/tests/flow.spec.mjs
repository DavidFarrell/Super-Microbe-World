// The game flow end to end in Chromium, with real inputs only (keyboard events, or CDP touch
// events on a phone emulation), stepping the engine by hand (?manual=1) so every run is the same:
//   - New Game through the cutscene (host lines, avatar choice, details form, closing line) to
//     the shrinking zone and on to level 1 with the chosen avatar: keyboard alone, touch alone;
//   - Continue restores the saved journey after a reload (the step and the scores);
//   - a failed level (time out) shows the summary card and restarts the same level, score kept;
//   - Level select plays a chosen unlocked level; locked ones cannot be started;
//   - settings persist across a reload, and a remapped key works in a level;
//   - the ending: a draw for equal quiz points, a win otherwise, with the hoverboard points shown.
// Other areas' scenes may still be placeholders (stub-<scene>-continue); assertions only rely on
// the flow's own probes and on the scene names.
import path from 'node:path';

const PHONE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);
const scene = page => page.evaluate(() => window.__test.scene);

// Steps the engine until predicate(__test) is true, yielding to the page between chunks so
// fetches and atlas loads can finish. Returns the ticks used; throws after max ticks.
async function until(page, predicate, what, { max = 3000, chunk = 4 } = {}) {
  const src = predicate.toString();
  for (let used = 0; used <= max; used += chunk) {
    const ok = await page.evaluate(s => { try { return !!(0, eval)(s)(window.__test); } catch { return false; } }, src);
    if (ok) return used;
    await step(page, chunk);
    if (used % 200 === 0) await page.waitForTimeout(5);
  }
  throw new Error(`timed out waiting for ${what} (scene ${await scene(page)})`);
}

async function openGame(ctx, opts, query = '', { init = null } = {}) {
  const { context, page, errors } = await ctx.openPage(opts);
  if (init) await context.addInitScript(init.fn, init.arg);
  await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en${query}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
  return { context, page, errors };
}

// Saves progress and settings before the page loads (localStorage keys as core/save.js uses).
function seed(values) {
  return {
    fn: v => { if (!sessionStorage.getItem('seeded')) { for (const [k, x] of Object.entries(v)) localStorage.setItem('smw:' + k, JSON.stringify(x)); sessionStorage.setItem('seeded', '1'); } },
    arg: values,
  };
}

async function tap(cdp, x, y, id = 7) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapEl(page, cdp, sel) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} is not visible`);
  await tap(cdp, b.x + b.width / 2, b.y + b.height / 2);
}
async function tapStage(page, cdp, sx = 400, sy = 200) {
  const c = await page.locator('#game').boundingBox();
  await tap(cdp, c.x + (sx / 800) * c.width, c.y + (sy / 450) * c.height);
}

// The splash menu wakes (takes taps, focuses its first choice) a moment after it appears.
async function waitSplashMenu(page) {
  await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
  return until(page, t => t.probe('splash') && t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
}

// Advances the talkie with a key until the cutscene leaves `phase`.
async function advanceWithKey(page, phase, key = 'Enter') {
  for (let i = 0; i < 40; i++) {
    const p = await probe(page, 'cutscene');
    if (!p || p.phase !== phase) return;
    await page.keyboard.press(key);
    await step(page, 4);
  }
  throw new Error(`the cutscene stayed in phase ${phase}`);
}
async function advanceWithTap(page, cdp, phase) {
  for (let i = 0; i < 40; i++) {
    const p = await probe(page, 'cutscene');
    if (!p || p.phase !== phase) return;
    await tapStage(page, cdp, 400, 380);
    await step(page, 4);
  }
  throw new Error(`the cutscene stayed in phase ${phase}`);
}

// The journey from the splash to level 1, keyboard only. Returns the page on level 1.
async function keyboardNewGame(ctx, shots = null) {
  const { context, page, errors } = await openGame(ctx, DESKTOP);
  await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
  await step(page, 40);
  await page.keyboard.press('Enter');          // skips the tuning to frame 150
  await until(page, t => t.probe('splash').menu, 'the splash menu', { max: 60 });
  assert((await probe(page, 'splash')).frame >= 150, 'Enter did not skip the tuning');
  await until(page, t => t.probe('splash').awake, 'the splash menu to wake', { max: 30 });
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'btn-new-game', 'New Game is not focused');
  if (shots) await page.screenshot({ path: path.join(shots, 'flow-splash.png') });
  await page.keyboard.press('Enter');
  await until(page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro', 'the cutscene');
  const first = await probe(page, 'cutscene');
  assert(/Super Microbe World Game Show/.test(first.talkie.statement), `unexpected first line: ${first.talkie.statement}`);
  assert(!/e-Bug/i.test(first.talkie.statement), 'the e-Bug name is in the host line');
  await step(page, 30);
  if (shots) await page.screenshot({ path: path.join(shots, 'flow-cutscene-host.png') });
  await advanceWithKey(page, 'intro');
  assert((await probe(page, 'cutscene')).phase === 'choose', 'no avatar choice after the host lines');
  assert(await page.evaluate(() => !document.activeElement || !document.activeElement.closest('.cs-kid')), 'a child is focused before any key was pressed');
  // Arrow keys move between the children; the focused one plays "happy".
  await page.keyboard.press('ArrowRight'); await step(page, 2);
  assert((await probe(page, 'cutscene')).hover === 'harry', 'ArrowRight did not move to Harry');
  await page.keyboard.press('ArrowLeft'); await step(page, 20);
  assert((await probe(page, 'cutscene')).hover === 'amy', 'ArrowLeft did not move to Amy');
  if (shots) await page.screenshot({ path: path.join(shots, 'flow-cutscene-choose.png') });
  await until(page, t => t.probe('cutscene').awake, 'the choice to take picks', { max: 60 });
  await page.keyboard.press('Enter'); await step(page, 2);
  assert((await probe(page, 'cutscene')).chosen === 'amy', 'Enter did not choose Amy');
  await advanceWithKey(page, 'chosen');
  assert((await probe(page, 'cutscene')).phase === 'form', 'no details form');
  assert(await page.locator('input[type="email"], #form-email').count() === 0, 'the form asks for an e-mail address');
  assert(await page.locator('#form-age').count() === 0, 'the form asks for an age (NOTES 11.2)');
  assert(!/competition/i.test(await page.locator('#cutscene-form').innerText()), 'the form mentions competitions');
  assert(await page.inputValue('#form-nickname') === 'Amy', 'the nickname is not pre-filled with the avatar name');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Sam');
  // Tab reaches Submit and Shift+Tab comes back to the nickname (the flow's own Tab handling).
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.id) === 'form-submit', 'Tab did not reach Submit');
  await page.keyboard.press('Shift+Tab');
  assert(await page.evaluate(() => document.activeElement.id) === 'form-nickname', 'Shift+Tab did not return to the nickname');
  if (shots) await page.screenshot({ path: path.join(shots, 'flow-cutscene-form.png') });
  await until(page, t => t.probe('cutscene').awake, 'the form to take a submit', { max: 60 });
  await page.keyboard.press('Enter');
  await step(page, 2);
  const closing = await probe(page, 'cutscene');
  assert(closing.phase === 'closing' && closing.nickname === 'Sam' && !('age' in closing), `form not submitted: ${JSON.stringify(closing)}`);
  assert(/Sam/.test(closing.talkie.statement), 'the closing line does not use the nickname');
  // Round 1 (blind rounds off): "Step right this way ..." comes before the first shrink.
  const said = new Set();
  for (let i = 0; i < 40; i++) {
    const p = await probe(page, 'cutscene');
    if (!p || p.phase !== 'closing') break;
    said.add(p.talkie.statement);
    await page.keyboard.press('Enter');
    await step(page, 4);
  }
  assert([...said].some(x => /^Step right this way/.test(x)), `no "Step right this way" before the shrink: ${[...said].join(' | ')}`);
  await until(page, t => t.scene === 'shrink' && !t.transitioning, 'the shrinking zone');
  const s = await probe(page, 'shrink');
  assert(s.avatar === 'amy' && s.round === 1, `shrinking zone for ${s.avatar}, round ${s.round}`);
  // The shrink plays its 149 frames (about 6 s) and hands over to level 1.
  const ticks = await until(page, t => t.scene === 'platform', 'level 1', { max: 900 });
  const f = await probe(page, 'flow');
  assert(ticks > 380, `the shrinking zone ended too early (${ticks} ticks)`);
  assert(f.lastLaunch.scene === 'platform' && f.lastLaunch.params.level === 'alpha_level1' && f.lastLaunch.params.avatar === 'amy', `level launch: ${JSON.stringify(f.lastLaunch)}`);
  assert(f.run && f.run.step === 'action' && f.run.nickname === 'Sam' && !('age' in f.run), `saved run: ${JSON.stringify(f.run)}`);
  assert(f.shrinkSeen === true, 'the first shrink was not recorded as seen');
  await until(page, t => t.probe('platform') && t.probe('platform').ready, 'level 1 to load');
  return { context, page, errors };
}

export const tests = [
  {
    name: 'keyboard: new game, cutscene, shrinking zone, level 1 as Amy',
    timeoutMs: 180000,
    async run(ctx) {
      const { context, page, errors } = await keyboardNewGame(ctx, ctx.shots);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'touch (phone): new game, cutscene, shrinking zone, level 1 as Harry',
    timeoutMs: 180000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, PHONE);
      const cdp = await context.newCDPSession(page);
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
      await step(page, 20);
      await tapStage(page, cdp);                       // a tap skips the tuning
      await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 80 });
      // Tap targets at least 44 CSS px.
      for (const id of ['#btn-new-game', '#btn-level-select', '#btn-settings', '#btn-language']) {
        const b = await page.locator(id).boundingBox();
        assert(b && b.width >= 44 && b.height >= 44, `${id} is ${b && b.width}x${b && b.height} CSS px`);
      }
      await tapEl(page, cdp, '#btn-new-game');
      await until(page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro', 'the cutscene');
      assert(await page.evaluate(() => window.__test.lastDevice) === 'touch', 'not in touch mode');
      await advanceWithTap(page, cdp, 'intro');
      assert((await probe(page, 'cutscene')).phase === 'choose', 'no avatar choice');
      await until(page, t => t.probe('cutscene').awake, 'the choice to take picks', { max: 60 });
      await page.screenshot({ path: path.join(ctx.shots, 'flow-phone-choose.png') });
      await tapEl(page, cdp, '#choose-harry');
      await step(page, 2);
      assert((await probe(page, 'cutscene')).chosen === 'harry', 'tap did not choose Harry');
      await advanceWithTap(page, cdp, 'chosen');
      assert((await probe(page, 'cutscene')).phase === 'form', 'no details form');
      await page.screenshot({ path: path.join(ctx.shots, 'flow-phone-form.png') });
      await until(page, t => t.probe('cutscene').awake, 'the form to take a submit', { max: 60 });
      await tapEl(page, cdp, '#form-submit');          // defaults: nickname Harry, no age
      await step(page, 2);
      const c = await probe(page, 'cutscene');
      assert(c.phase === 'closing' && c.nickname === 'Harry', `form: ${JSON.stringify({ phase: c.phase, nickname: c.nickname })}`);
      await advanceWithTap(page, cdp, 'closing');
      await until(page, t => t.scene === 'shrink' && !t.transitioning, 'the shrinking zone');
      assert((await probe(page, 'shrink')).avatar === 'harry', 'the shrinking zone shows the wrong child');
      await step(page, 60);
      const sh = await probe(page, 'shrink');
      assert(sh.ready && sh.frame > 1, `the shrinking zone is not playing its art: ${JSON.stringify(sh)}`);
      await page.screenshot({ path: path.join(ctx.shots, 'flow-phone-shrink.png') });
      // The first shrink plays in full (NOTES 2.5): a tap does not skip it.
      await tapStage(page, cdp);
      await step(page, 10);
      assert(await scene(page) === 'shrink' && !(await probe(page, 'shrink')).done, 'a tap skipped the first shrinking zone');
      await until(page, t => t.scene === 'platform', 'level 1', { max: 900 });
      const f = await probe(page, 'flow');
      assert(f.lastLaunch.params.level === 'alpha_level1' && f.lastLaunch.params.avatar === 'harry', `level launch: ${JSON.stringify(f.lastLaunch)}`);
      await until(page, t => t.probe('platform') && t.probe('platform').ready, 'level 1 to load');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'continue restores the saved journey after a reload',
    timeoutMs: 180000,
    async run(ctx) {
      // 1. A journey started for real, reloaded on level 1.
      const { context, page, errors } = await keyboardNewGame(ctx);
      await page.reload();
      await page.waitForFunction(() => window.__test && window.__test.scene === 'splash', null, { timeout: 20000 });
      await waitSplashMenu(page);
      const sp = await probe(page, 'splash');
      assert(sp.buttons.includes('btn-continue'), `no Continue button: ${sp.buttons}`);
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'btn-continue', 'Continue is not focused first');
      await page.keyboard.press('Enter');
      await until(page, t => t.scene === 'platform', 'the saved level');
      let f = await probe(page, 'flow');
      assert(f.lastLaunch.params.level === 'alpha_level1' && f.lastLaunch.params.avatar === 'amy', `resumed at ${JSON.stringify(f.lastLaunch)}`);
      await context.close();
      // 2. A journey saved later on: round 2, second level, with scores.
      const run = { avatar: 'amy', nickname: 'Sam', age: null, round: 1, part: 1, step: 'action', quiz: 30, cpu: 15, hover: 420, kitchen: 0, seed: 5 };
      const g = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level5', 'alpha_level6'], best: {} } }) });
      await waitSplashMenu(g.page);
      await g.page.click('#btn-continue');
      await until(g.page, t => t.scene === 'platform', 'the saved level');
      f = await probe(g.page, 'flow');
      assert(f.lastLaunch.params.level === 'alpha_level6' && f.lastLaunch.params.score === 420 && f.lastLaunch.params.avatar === 'amy', `resumed at ${JSON.stringify(f.lastLaunch)}`);
      assert(f.run.quiz === 30 && f.run.cpu === 15, 'quiz scores lost');
      assert(errors.length === 0 && g.errors.length === 0, `console errors:\n${[...errors, ...g.errors].join('\n')}`);
      await g.context.close();
    },
  },
  {
    name: 'a timed-out level shows the summary and restarts the same level with the score kept',
    timeoutMs: 180000,
    async run(ctx) {
      const run = { avatar: 'harry', nickname: '', age: null, round: 0, part: 2, step: 'action', quiz: 0, cpu: 0, hover: 57, kitchen: 0, seed: 9 };
      const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level2', 'alpha_level3'], best: {} } }) });
      await waitSplashMenu(page);
      await page.click('#btn-continue');
      await until(page, t => t.scene === 'platform' && t.probe('platform') && t.probe('platform').ready, 'level 3');
      // Skip the briefing, then let the clock run out (180 s = 6000 steps).
      for (let i = 0; i < 30 && (await probe(page, 'platform')).ui !== 'play'; i++) { await page.keyboard.press('Escape'); await step(page, 10); }
      assert((await probe(page, 'platform')).ui === 'play', 'the briefing did not end');
      await until(page, t => t.scene === 'summary', 'the summary page', { max: 13000, chunk: 500 });
      const s = await probe(page, 'summary');
      assert(s.kind === 'time' && /ran out of time/.test(s.heading), `summary: ${JSON.stringify(s)}`);
      await step(page, 20);
      await page.screenshot({ path: path.join(ctx.shots, 'flow-summary-time.png') });
      await page.keyboard.press('Enter');
      await until(page, t => t.scene === 'platform', 'the retry');
      const f = await probe(page, 'flow');
      assert(f.lastLaunch.params.level === 'alpha_level3', `retried ${f.lastLaunch.params.level}, not the same level`);
      assert(f.lastLaunch.params.score === 57, `score not kept: ${f.lastLaunch.params.score}`);
      assert(f.lastLaunch.params.intro === '0', 'the retry replays the briefing');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'level select plays a chosen unlocked level (keyboard)',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run: null, unlocked: ['alpha_level1', 'alpha_level2', 'alpha_level3', 'kitchen0'], best: { alpha_level2: 140 } } }) });
      await waitSplashMenu(page);
      await page.click('#btn-level-select');
      await until(page, t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready, 'level select');
      const ls = await probe(page, 'levelSelect');
      const open = ls.cards.filter(c => c.unlocked).map(c => c.id);
      assert(ls.cards.length === 14, `${ls.cards.length} cards, expected 10 levels and 4 kitchen levels`);
      assert(open.join() === 'alpha_level1,alpha_level2,alpha_level3,kitchen0', `unlocked: ${open}`);
      assert(await page.locator('#level-alpha_level4').isDisabled(), 'a locked level can be started');
      assert(/Best 140/.test(await page.locator('#level-alpha_level2').innerText()), 'the best score is not shown');
      await page.waitForFunction(() => window.__test.probe('levelSelect').cards.filter(c => c.thumb).length >= 14, null, { timeout: 20000 });
      await step(page, 30);
      await page.screenshot({ path: path.join(ctx.shots, 'flow-level-select.png') });
      assert(await page.evaluate(() => document.activeElement.id) === 'level-alpha_level1', 'the first open level is not focused');
      await page.keyboard.press('ArrowRight'); await step(page, 2);
      await page.keyboard.press('ArrowRight'); await step(page, 2);
      assert(await page.evaluate(() => document.activeElement.id) === 'level-alpha_level3', 'arrows did not move to level 3');
      await page.keyboard.press('Enter');
      await until(page, t => t.scene === 'platform', 'level 3');
      const f = await probe(page, 'flow');
      assert(f.mode === 'single' && f.lastLaunch.params.level === 'alpha_level3' && f.lastLaunch.params.score === 0, `launch: ${JSON.stringify(f)}`);
      await until(page, t => t.probe('platform') && t.probe('platform').ready, 'level 3 to load');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'settings persist and a remapped key works in a level',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, DESKTOP);
      await waitSplashMenu(page);
      await page.click('#btn-settings');
      await until(page, t => t.scene === 'settings' && t.probe('settings') && !t.transitioning, 'settings');
      await page.click('#settings-tab-game');
      await page.click('#settings-blind');
      await page.click('#settings-tab-display');
      await page.click('#settings-text-130');
      await page.click('#settings-tab-controls');
      await page.click('#settings-remap-jump');
      assert((await probe(page, 'settings')).capturing === 'jump', 'not waiting for a key');
      await page.keyboard.press('KeyZ');
      await step(page, 2);
      let s = await probe(page, 'settings');
      assert(s.capturing === null && s.keys.jump[0] === 'KeyZ', `jump keys: ${s.keys.jump}`);
      assert(!s.keys.jump.includes('Space'), 'Space still jumps');
      await page.screenshot({ path: path.join(ctx.shots, 'flow-settings-controls.png') });
      // Keyboard only: Escape leaves the settings.
      await page.keyboard.press('Escape');
      await until(page, t => t.scene === 'splash', 'back to the splash');
      // Persisted across a reload.
      await page.goto(`${ctx.baseUrl}/index.html?manual=1&scene=settings`);
      await page.waitForFunction(() => window.__test && window.__test.probe('settings'), null, { timeout: 20000 });
      s = await probe(page, 'settings');
      assert(s.keys.jump[0] === 'KeyZ' && s.blindRounds === true && s.textScale === 1.3, `after reload: ${JSON.stringify({ jump: s.keys.jump, blind: s.blindRounds, text: s.textScale })}`);
      assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()) === '1.3', 'text scale not applied');
      // The new key jumps in a level; Space no longer does.
      await page.goto(`${ctx.baseUrl}/index.html?manual=1&scene=platform&level=alpha_level1&intro=0&seed=1`);
      await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 20000 });
      await until(page, t => t.probe('platform').ui === 'play', 'play');
      await step(page, 40);
      const y0 = (await probe(page, 'platform')).player.y;
      await page.keyboard.press('Space');
      await step(page, 16);
      assert(Math.abs((await probe(page, 'platform')).player.y - y0) < 1, 'Space still jumps after the remap');
      await page.keyboard.down('KeyZ');
      await step(page, 16);
      await page.keyboard.up('KeyZ');
      const y1 = (await probe(page, 'platform')).player.y;
      assert(y1 < y0 - 20, `Z did not jump (y ${y0} -> ${y1})`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'blind rounds on: the blind quiz comes before the shrinking zone',
    timeoutMs: 120000,
    async run(ctx) {
      const run = { avatar: 'harry', nickname: '', age: null, round: 1, part: 0, step: 'quiz', quiz: 20, cpu: 5, hover: 300, kitchen: 0, seed: 4 };
      const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1'], best: {} }, settings: { v: 2, blindRounds: true } }) });
      await waitSplashMenu(page);
      await page.click('#btn-continue');
      await until(page, t => t.scene === 'gameshow', 'the round 2 quiz');
      let f = await probe(page, 'flow');
      const p = f.lastLaunch.params;
      assert(p.round === 2 && p.blind === false && p.stepRight === false && p.playerScore === 20 && p.cpuScore === 5 && p.cpuName === 'Amy' && p.nickname === 'Harry', `quiz launch: ${JSON.stringify(p)}`);
      assert(!('hoverScore' in p) && p.score === undefined, 'hoverboard points reached the quiz');
      // With the placeholder game show, finish the quiz and check the next round starts blind.
      if (await page.locator('#stub-gameshow-continue').count()) {
        await until(page, t => !t.transitioning, 'the quiz to settle');
        await page.click('#stub-gameshow-continue');
        await until(page, t => t.probe('flow').lastLaunch && t.probe('flow').lastLaunch.params.round === 3, 'the round 3 blind quiz');
        f = await probe(page, 'flow');
        assert(f.lastLaunch.scene === 'gameshow' && f.lastLaunch.params.blind === true && f.run.step === 'blind', `next: ${JSON.stringify(f.lastLaunch)}`);
        await until(page, t => t.scene === 'gameshow' && !t.transitioning, 'the blind quiz');
        await page.click('#stub-gameshow-continue');
        await until(page, t => t.scene === 'shrink', 'the shrinking zone after the blind quiz');
        f = await probe(page, 'flow');
        assert(f.run.round === 2 && f.run.step === 'shrink', `run: ${JSON.stringify(f.run)}`);
      } else ctx.log('game show is not a placeholder any more: blind-half hand-over checked through the launch params only');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'the settings overlay over a paused level swallows keys and closes with Escape',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, DESKTOP, '&scene=platform&level=alpha_level1&intro=0&seed=1');
      await page.waitForFunction(() => window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 20000 });
      await until(page, t => t.probe('platform').ui === 'play', 'play');
      await page.keyboard.press('Escape'); await step(page, 2);
      assert((await probe(page, 'platform')).ui === 'paused', 'Escape did not pause');
      await page.evaluate(async () => {
        const m = await import('./js/flow/settings.js');
        window.__closed = false;
        m.openSettings(window.__test.app, { onClose: () => { window.__closed = true; } });
      });
      assert(await page.locator('#settings-overlay').count() === 1, 'no overlay');
      assert(await page.evaluate(() => window.__test.app.flow.overlayOpen), 'overlayOpen not set');
      await page.keyboard.press('ArrowDown'); await step(page, 2);
      await page.keyboard.press('ArrowDown'); await step(page, 2);
      assert(await page.evaluate(() => document.activeElement.id) === 'settings-tab-display', 'arrows did not move through the tabs');
      assert((await probe(page, 'platform')).ui === 'paused', 'the level reacted to the overlay keys');
      await page.keyboard.press('Escape'); await step(page, 4);
      assert(await page.locator('#settings-overlay').count() === 0 && await page.evaluate(() => window.__closed), 'Escape did not close the overlay');
      assert((await probe(page, 'platform')).ui === 'paused', 'closing the overlay resumed the level');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'the ending: equal quiz points are a draw; a win shows the points and Play again',
    timeoutMs: 120000,
    async run(ctx) {
      const run = { avatar: 'amy', nickname: 'Sam', age: null, round: 4, part: 0, step: 'quiz', quiz: 60, cpu: 60, hover: 1234, kitchen: 80, seed: 3 };
      const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1'], best: {} } }) });
      await waitSplashMenu(page);
      // The last quiz ends the journey (the game show's own result is not needed here).
      await page.evaluate(() => window.__test.app.flow.finish());
      await until(page, t => t.scene === 'ending' && t.probe('ending') && t.probe('ending').phase === 'line', 'the ending');
      let e = await probe(page, 'ending');
      assert(e.outcome === 'draw' && /draw/i.test(e.line) && /Harry/.test(e.line), `draw ending: ${JSON.stringify(e)}`);
      for (let i = 0; i < 10 && !(await probe(page, 'ending')).card; i++) { await page.keyboard.press('Enter'); await step(page, 4); }
      e = await probe(page, 'ending');
      assert(e.card && /draw/i.test(e.title), `draw card: ${e.title}`);
      // A press straight after the host's line cannot start a new game by accident.
      await page.keyboard.press('Enter'); await step(page, 2);
      assert(await scene(page) === 'ending' && !(await probe(page, 'ending')).buttons.length, 'the card reacted at once');
      await step(page, 30);
      e = await probe(page, 'ending');
      const text = await page.locator('#ending-card').innerText();
      assert(/1234/.test(text) && /80/.test(text), 'hoverboard or kitchen points missing');
      assert(e.buttons.join() === 'ending-play-again,ending-level-select,ending-menu', `buttons: ${e.buttons}`);
      await step(page, 30);
      await page.screenshot({ path: path.join(ctx.shots, 'flow-ending-draw.png') });
      const f = await probe(page, 'flow');
      assert(f.run === null && f.finished === 1, 'the finished journey is still saved');
      // A win, opened directly.
      await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en&scene=ending&playerScore=90&cpuScore=40&hoverScore=500&avatar=harry`);
      await page.waitForFunction(() => window.__test && window.__test.probe('ending') && window.__test.probe('ending').phase === 'line', null, { timeout: 20000 });
      e = await probe(page, 'ending');
      assert(e.outcome === 'win' && /You beat Amy/.test(e.line) && !/reload/.test(e.line), `win line: ${e.line}`);
      for (let i = 0; i < 10 && !(await probe(page, 'ending')).card; i++) { await page.keyboard.press('Enter'); await step(page, 4); }
      await step(page, 40);
      await page.screenshot({ path: path.join(ctx.shots, 'flow-ending-win.png') });
      assert(await page.evaluate(() => document.activeElement.id) === 'ending-play-again', 'Play again is not focused');
      await page.keyboard.press('Enter');               // Play again is focused
      await until(page, t => t.scene === 'cutscene', 'a new game');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
