// Flow review fixes, end to end in Chromium (engine stepped by hand with ?manual=1):
//   - splash: a held Enter never starts a game the player has not seen; Tab and Space work;
//   - shrinking zone: the first viewing plays in full; later a skip needs the hint, and a key
//     held from the screen before never skips; the clip waits for its art (no placeholder);
//   - cutscene: a touch Main menu button, a device-aware avatar hint, hover and focus agree;
//   - layout at text size 130% on a 667 x 375 phone: the ending card's buttons, the language
//     chooser's Cancel, Level select cards, and 44 CSS px settings controls and form field;
//   - Level select shows the Patty (L4) and Iggy (L7) portraits;
//   - flow rules: fresh run seeds, practice seeds independent of the saved journey, the
//     'round' restart scope, Continue after a failed level shows the briefing, a tied best is
//     not a new best.
const PHONE = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const probe = (page, name) => page.evaluate(n => window.__test.probe(n), name);
const scene = page => page.evaluate(() => window.__test.scene);
const active = page => page.evaluate(() => document.activeElement && document.activeElement.id);

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

function seed(values) {
  return {
    fn: v => { if (!sessionStorage.getItem('seeded')) { for (const [k, x] of Object.entries(v)) localStorage.setItem('smw:' + k, JSON.stringify(x)); sessionStorage.setItem('seeded', '1'); } },
    arg: values,
  };
}

async function openGame(ctx, opts, query = '', { init = null, before = null } = {}) {
  const { context, page, errors } = await ctx.openPage(opts);
  if (init) await context.addInitScript(init.fn, init.arg);
  if (before) await before(page);
  await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en${query}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
  return { context, page, errors };
}

async function waitMenu(page) {
  await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
  await until(page, t => t.probe('splash').menu && t.probe('splash').awake, 'the splash menu');
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
async function tapStage(page, cdp, sx = 400, sy = 380) {
  const c = await page.locator('#game').boundingBox();
  await tap(cdp, c.x + (sx / 800) * c.width, c.y + (sy / 450) * c.height);
}

// Records every scene launch's params (callbacks included) so a test can answer for a scene.
async function captureLaunches(page) {
  await page.evaluate(() => {
    const sc = window.__test.app.scenes;
    const go = sc.go.bind(sc);
    window.__launches = [];
    sc.go = (name, params, style) => { window.__launches.push({ name, params }); return go(name, params, style); };
  });
}
const lastParams = (page, name) => page.evaluate(n => { const l = window.__launches.filter(x => x.name === n).pop(); return l ? Object.fromEntries(Object.entries(l.params).filter(([, v]) => typeof v !== 'function' && !(v instanceof HTMLCanvasElement))) : null; }, name);
const callLast = (page, name, cb, arg) => page.evaluate(([n, c, a]) => window.__launches.filter(x => x.name === n).pop().params[c](a), [name, cb, arg]);

// Is every rect inside the #ui layer's rect (1 px tolerance)?
async function insideUi(page, selector) {
  return page.evaluate(sel => {
    const ui = document.getElementById('ui').getBoundingClientRect();
    return [...document.querySelectorAll(sel)].map(n => {
      const r = n.getBoundingClientRect();
      const ok = r.left >= ui.left - 1 && r.top >= ui.top - 1 && r.right <= ui.right + 1 && r.bottom <= ui.bottom + 1 && r.bottom <= innerHeight + 1;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: n.id, ok: ok && !!hit && (hit === n || n.contains(hit)), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
    });
  }, selector);
}

const RUN = (over = {}) => ({ avatar: 'harry', nickname: '', round: 0, part: 0, step: 'shrink', quiz: 0, cpu: 0, hover: 0, kitchen: 0, seed: 11, ...over });

export const tests = [
  {
    name: 'splash: a held Enter never starts a game; Tab moves and Space activates in the menu',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, DESKTOP);
      await until(page, t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
      await step(page, 20);
      await page.keyboard.down('Enter');                 // skips the tuning to frame 150
      await step(page, 2);
      let sp = await probe(page, 'splash');
      assert(sp.frame >= 150 && sp.menu && !sp.awake, `after the first Enter: ${JSON.stringify(sp)}`);
      assert(await active(page) !== 'btn-new-game', 'New Game is focused before the menu wakes');
      // The OS auto-repeat of the held key (keydown with repeat: true), before and after the wake.
      for (let i = 0; i < 12; i++) { await page.keyboard.down('Enter'); await step(page, 3); }
      await step(page, 20);
      assert((await probe(page, 'splash')).awake, 'the menu did not wake');
      for (let i = 0; i < 6; i++) { await page.keyboard.down('Enter'); await step(page, 3); }
      await step(page, 40);
      assert(await scene(page) === 'splash', `a held Enter started ${await scene(page)}`);
      await page.keyboard.up('Enter');
      assert(await active(page) === 'btn-new-game', `focus after the wake: ${await active(page)}`);
      // Tab / Shift+Tab move through the menu in order and wrap.
      await page.keyboard.press('Tab');
      assert(await active(page) === 'btn-level-select', `Tab went to ${await active(page)}`);
      await page.keyboard.press('Tab');
      assert(await active(page) === 'btn-settings', `Tab went to ${await active(page)}`);
      await page.keyboard.press('Tab');
      assert(await active(page) === 'btn-language', `Tab went to ${await active(page)}`);
      // Full screen, where the browser offers it (Chromium does), comes last.
      const fsButton = (await probe(page, 'splash')).fullscreenButton;
      if (fsButton) {
        await page.keyboard.press('Tab');
        assert(await active(page) === 'btn-fullscreen', `Tab went to ${await active(page)}`);
      }
      await page.keyboard.press('Tab');
      assert(await active(page) === 'btn-new-game', `Tab did not wrap: ${await active(page)}`);
      await page.keyboard.press('Shift+Tab');
      assert(await active(page) === (fsButton ? 'btn-fullscreen' : 'btn-language'), `Shift+Tab went to ${await active(page)}`);
      if (fsButton) await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      assert(await active(page) === 'btn-level-select', `Shift+Tab went to ${await active(page)}`);
      await page.keyboard.press('Tab');
      // Space activates the focused button, exactly once.
      await page.evaluate(() => { window.__clicks = 0; document.getElementById('btn-settings').addEventListener('click', () => { window.__clicks++; }); });
      await page.keyboard.press('Space');
      await until(page, t => t.scene === 'settings' && !t.transitioning, 'the settings');
      assert(await page.evaluate(() => window.__clicks) === 1, `Space clicked ${await page.evaluate(() => window.__clicks)} times`);
      // In the settings, Tab moves on from the Back button, Space opens a tab.
      await until(page, () => document.activeElement && document.activeElement.id === 'settings-tab-sound', 'the settings focus');
      await page.keyboard.press('Tab');
      assert(await active(page) === 'settings-tab-game', `Tab in the settings went to ${await active(page)}`);
      await page.keyboard.press('Space');
      await step(page, 2);
      assert((await probe(page, 'settings')).tab === 'game', 'Space did not open the Game tab');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'shrinking zone: waits for its art, the first one plays in full, later skips need the hint and a fresh press',
    timeoutMs: 180000,
    async run(ctx) {
      // 1. First viewing, with the shrink sheet held back: a dark stage and a loading ring (no
      //    placeholder), then the full clip; Enter and taps do not skip it.
      let release;
      const gate = new Promise(r => { release = r; });
      const a = await openGame(ctx, DESKTOP, '', {
        init: seed({ progress: { v: 1, run: RUN(), unlocked: ['alpha_level1'], best: {} } }),
        before: page => page.route(/data\/atlas\/shrink[.-]/, async route => { await gate; await route.continue(); }),
      });
      await waitMenu(a.page);
      await a.page.keyboard.press('Enter');             // Continue (focused)
      await until(a.page, t => t.scene === 'shrink' && !t.transitioning, 'the shrinking zone');
      await step(a.page, 60);
      let s = await probe(a.page, 'shrink');
      assert(!s.ready && s.frame === 1 && s.ticks === 0 && !s.skippable, `while loading: ${JSON.stringify(s)}`);
      const px = await a.page.evaluate(() => { const c = document.getElementById('game'); const d = c.getContext('2d').getImageData(Math.round(c.width * 0.1), Math.round(c.height * 0.2), 1, 1).data; return [d[0], d[1], d[2]]; });
      assert(px[0] < 60 && px[1] < 60 && px[2] < 90, `the loading stage is not dark: ${px}`);
      await a.page.keyboard.press('Enter');
      await step(a.page, 4);
      release();
      await until(a.page, t => t.probe('shrink').ready, 'the shrink art');
      await step(a.page, 70);
      await a.page.keyboard.press('Enter');
      await step(a.page, 6);
      s = await probe(a.page, 'shrink');
      assert(await scene(a.page) === 'shrink' && !s.done && s.frame > 20, `the first shrink was skipped: ${JSON.stringify(s)}`);
      const used = await until(a.page, t => t.scene === 'platform', 'level 1', { max: 900 });
      assert(used > 250, `the first shrink ended early (${used} more ticks)`);
      let f = await probe(a.page, 'flow');
      assert(f.shrinkSeen === true, 'the shrink was not recorded as seen');
      assert(a.errors.length === 0, `console errors:\n${a.errors.join('\n')}`);
      await a.context.close();

      // 2. Seen before: skippable, but not by the Enter held from the menu, nor by a fresh press
      //    before the hint; a fresh press after it skips.
      const b = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run: RUN(), unlocked: ['alpha_level1'], best: {}, shrinkSeen: true } }) });
      await waitMenu(b.page);
      await b.page.keyboard.down('Enter');               // Continue, and keep holding
      await until(b.page, t => t.scene === 'shrink' && !t.transitioning && t.probe('shrink').ready, 'the shrinking zone');
      await step(b.page, 50);
      s = await probe(b.page, 'shrink');
      assert(s.skippable && s.ticks >= 40 && !s.done && await scene(b.page) === 'shrink', `the held Enter skipped: ${JSON.stringify(s)}`);
      await b.page.keyboard.up('Enter');
      await step(b.page, 2);
      await b.page.keyboard.press('Enter');
      await step(b.page, 2);
      assert((await probe(b.page, 'shrink')).done, 'a fresh Enter after the hint did not skip');
      await until(b.page, t => t.scene === 'platform', 'level 1', { max: 80 });
      await b.context.close();

      const c = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run: RUN(), unlocked: ['alpha_level1'], best: {}, shrinkSeen: true } }) });
      await waitMenu(c.page);
      await c.page.click('#btn-continue');
      await until(c.page, t => t.scene === 'shrink' && t.probe('shrink').ready && t.probe('shrink').ticks >= 8, 'the shrinking zone');
      await c.page.keyboard.press('Enter');              // before the hint: ignored
      await c.page.mouse.click(640, 360);
      await step(c.page, 2);
      s = await probe(c.page, 'shrink');
      assert(!s.done && s.ticks < 40, `an early press skipped: ${JSON.stringify(s)}`);
      await until(c.page, t => t.probe('shrink').canSkip, 'the skip hint');
      await c.page.mouse.click(640, 360);
      await step(c.page, 2);
      assert((await probe(c.page, 'shrink')).done, 'a click after the hint did not skip');
      assert(c.errors.length === 0, `console errors:\n${c.errors.join('\n')}`);
      await c.context.close();
    },
  },
  {
    name: 'cutscene: touch Main menu button, device-aware avatar hint, hover and focus agree, form keys',
    timeoutMs: 180000,
    async run(ctx) {
      const { context, page, errors } = await openGame(ctx, PHONE);
      const cdp = await context.newCDPSession(page);
      await waitMenu(page);
      await tapEl(page, cdp, '#btn-new-game');
      await until(page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro' && !t.transitioning, 'the cutscene');
      const q = await page.locator('#cutscene-quit').boundingBox();
      assert(q && q.width >= 44 && q.height >= 44, `the Main menu button is ${q && q.width}x${q && q.height}`);
      await tapEl(page, cdp, '#cutscene-quit');
      await step(page, 2);
      assert(await page.locator('#fl-confirm-yes').count() === 1, 'the Main menu button did not ask');
      await tapEl(page, cdp, '#fl-confirm-no');
      await step(page, 2);
      assert(await page.locator('#fl-confirm-yes').count() === 0 && (await probe(page, 'cutscene')).phase === 'intro', 'Cancel did not return to the cutscene');
      for (let i = 0; i < 40 && (await probe(page, 'cutscene')).phase === 'intro'; i++) { await tapStage(page, cdp); await step(page, 4); }
      let c = await probe(page, 'cutscene');
      assert(c.phase === 'choose' && c.hint === 'Tap Amy or Harry', `touch hint: ${c.hint}`);
      await page.keyboard.press('ArrowRight');
      await step(page, 2);
      c = await probe(page, 'cutscene');
      assert(/→/.test(c.hint) && /Enter/.test(c.hint) && !/^Tap/.test(c.hint), `keyboard hint: ${c.hint}`);
      await tapEl(page, cdp, '#cutscene-quit');
      await step(page, 2);
      await tapEl(page, cdp, '#fl-confirm-yes');
      await until(page, t => t.scene === 'splash', 'the main menu');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();

      // Desktop: keyboard focus on Amy, the mouse moves to Harry: Harry is focused and chosen.
      const d = await openGame(ctx, DESKTOP);
      await waitMenu(d.page);
      await d.page.keyboard.press('Enter');
      await until(d.page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro', 'the cutscene');
      for (let i = 0; i < 40 && (await probe(d.page, 'cutscene')).phase === 'intro'; i++) { await d.page.keyboard.press('Enter'); await step(d.page, 4); }
      // The Enter presses that hurried the host along cannot pick a child: the first one after the
      // choice appears only highlights Amy, and a confirm on her does nothing until the choice
      // has been up for half a second.
      assert(await active(d.page) !== 'choose-amy', `focus at the choice: ${await active(d.page)}`);
      await d.page.keyboard.press('Enter'); await step(d.page, 2);
      c = await probe(d.page, 'cutscene');
      assert(c.phase === 'choose' && !c.chosen && await active(d.page) === 'choose-amy', `first Enter: ${c.phase} ${c.chosen} ${await active(d.page)}`);
      await d.page.keyboard.press('Enter'); await step(d.page, 2);
      c = await probe(d.page, 'cutscene');
      assert(c.phase === 'choose' && !c.chosen && !c.awake, `an Enter before the choice woke picked ${c.chosen}`);
      const h = await d.page.locator('#choose-harry').boundingBox();
      await d.page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await step(d.page, 2);
      c = await probe(d.page, 'cutscene');
      assert(c.hover === 'harry' && await active(d.page) === 'choose-harry', `hover ${c.hover}, focus ${await active(d.page)}`);
      await until(d.page, t => t.probe('cutscene').awake, 'the choice to take picks', { max: 60 });
      await d.page.keyboard.press('Enter');
      await step(d.page, 2);
      assert((await probe(d.page, 'cutscene')).chosen === 'harry', 'Enter did not choose the hovered child');
      for (let i = 0; i < 40 && (await probe(d.page, 'cutscene')).phase === 'chosen'; i++) { await d.page.keyboard.press('Enter'); await step(d.page, 4); }
      assert((await probe(d.page, 'cutscene')).phase === 'form', 'no form');
      // The name is not selected (a stray key cannot wipe it), and Enter does not submit the
      // form until it has been up for a moment.
      const sel = await d.page.evaluate(() => { const n = document.getElementById('form-nickname'); return [n.selectionStart, n.selectionEnd, n.value.length]; });
      assert(sel[0] === sel[2] && sel[1] === sel[2], `nickname selection ${sel}`);
      await d.page.keyboard.press('Enter'); await step(d.page, 2);
      assert((await probe(d.page, 'cutscene')).phase === 'form', 'an Enter as the form appeared submitted it');
      await until(d.page, t => t.probe('cutscene').awake, 'the form to take a submit', { max: 60 });
      // Form: arrows from Submit reach the nickname; Space on Submit submits.
      await d.page.keyboard.press('Tab');
      assert(await active(d.page) === 'form-submit', `Tab went to ${await active(d.page)}`);
      await d.page.keyboard.press('ArrowUp');
      await step(d.page, 2);
      assert(await active(d.page) === 'form-nickname', `ArrowUp from Submit went to ${await active(d.page)}`);
      await d.page.keyboard.press('Tab');
      await d.page.keyboard.press('Space');
      await step(d.page, 2);
      assert((await probe(d.page, 'cutscene')).phase === 'closing', 'Space on Submit did not submit');
      assert(d.errors.length === 0, `console errors:\n${d.errors.join('\n')}`);
      await d.context.close();
    },
  },
  {
    name: 'phone 667x375 at text size 130%: ending buttons, language Cancel, 44 px settings controls and form field',
    timeoutMs: 180000,
    async run(ctx) {
      const run = RUN({ avatar: 'amy', nickname: 'Maximiliana Wolfeschlegel', round: 4, step: 'quiz', quiz: 60, cpu: 40, hover: 1234, kitchen: 80 });
      const { context, page, errors } = await openGame(ctx, PHONE, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1'], best: {} }, settings: { v: 2, textScale: 1.3 } }) });
      const cdp = await context.newCDPSession(page);
      await waitMenu(page);
      await page.evaluate(() => window.__test.app.flow.finish());
      await until(page, t => t.scene === 'ending' && t.probe('ending') && t.probe('ending').phase === 'line', 'the ending');
      for (let i = 0; i < 20 && !(await probe(page, 'ending')).card; i++) { await tapStage(page, cdp); await step(page, 4); }
      await until(page, t => t.probe('ending').buttons.length === 3, 'the ending buttons');
      await step(page, 30);
      await page.screenshot({ path: `${ctx.shots}/flow-ending-phone-130.png` });
      const eb = await insideUi(page, '#ending-card button');
      assert(eb.length === 3 && eb.every(x => x.ok), `ending buttons off screen: ${JSON.stringify(eb)}`);
      await tapEl(page, cdp, '#ending-menu');
      await until(page, t => t.scene === 'splash' && t.probe('splash') && t.probe('splash').awake, 'the main menu');

      // Settings: every slider and switch at least 44 CSS px; the language chooser's Cancel on screen.
      await tapEl(page, cdp, '#btn-settings');
      await until(page, t => t.scene === 'settings' && !t.transitioning, 'the settings');
      const sizes = async ids => page.evaluate(list => list.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.width), Math.round(r.height)]; }), ids);
      let small = (await sizes(['settings-master', 'settings-music', 'settings-sfx', 'settings-muted'])).filter(([, w, h]) => w < 44 || h < 44);
      await tapEl(page, cdp, '#settings-tab-game');
      await step(page, 2);
      small = small.concat((await sizes(['settings-blind', 'settings-restart-round', 'settings-language'])).filter(([, w, h]) => w < 44 || h < 44));
      await tapEl(page, cdp, '#settings-tab-display');
      await step(page, 2);
      small = small.concat((await sizes(['settings-touch', 'settings-haptics'])).filter(([, w, h]) => w < 44 || h < 44));
      assert(!small.length, `controls under 44 CSS px: ${JSON.stringify(small)}`);
      await tapEl(page, cdp, '#settings-tab-game');
      await step(page, 2);
      await tapEl(page, cdp, '#settings-language');
      await until(page, () => document.getElementById('lang-cancel'), 'the language chooser');
      await page.screenshot({ path: `${ctx.shots}/flow-language-phone-130.png` });
      const lc = await insideUi(page, '#lang-cancel');
      assert(lc[0].ok, `Cancel off screen: ${JSON.stringify(lc)}`);
      await tapEl(page, cdp, '#lang-cancel');
      await step(page, 2);
      assert(await page.locator('#language-chooser').count() === 0, 'Cancel did not close the chooser');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();

      // The details form's nickname field on the same phone.
      const f = await openGame(ctx, PHONE);
      const cdp2 = await f.context.newCDPSession(f.page);
      await waitMenu(f.page);
      await tapEl(f.page, cdp2, '#btn-new-game');
      await until(f.page, t => t.scene === 'cutscene' && t.probe('cutscene') && t.probe('cutscene').phase === 'intro' && !t.transitioning, 'the cutscene');
      for (let i = 0; i < 40 && (await probe(f.page, 'cutscene')).phase === 'intro'; i++) { await tapStage(f.page, cdp2); await step(f.page, 4); }
      await until(f.page, t => t.probe('cutscene').awake, 'the choice to take picks', { max: 60 });
      await tapEl(f.page, cdp2, '#choose-amy');
      for (let i = 0; i < 40 && (await probe(f.page, 'cutscene')).phase === 'chosen'; i++) { await tapStage(f.page, cdp2); await step(f.page, 4); }
      const nick = await f.page.locator('#form-nickname').boundingBox();
      assert(nick && nick.height >= 44, `the nickname field is ${nick && nick.height} CSS px high`);
      assert(f.errors.length === 0, `console errors:\n${f.errors.join('\n')}`);
      await f.context.close();
    },
  },
  {
    name: 'level select at 130% on a phone: cards do not overflow; Patty and Iggy portraits',
    timeoutMs: 120000,
    async run(ctx) {
      const all = ['alpha_level1', 'alpha_level2', 'alpha_level3', 'alpha_level4', 'alpha_level5', 'alpha_level6', 'alpha_level7', 'alpha_level8', 'alpha_level9', 'alpha_level10', 'kitchen0', 'kitchen1', 'kitchen2', 'kitchen3'];
      const { context, page, errors } = await openGame(ctx, PHONE, '', { init: seed({ progress: { v: 1, run: null, unlocked: all, best: { alpha_level1: 123456, alpha_level2: 340 } }, settings: { v: 2, textScale: 1.3 } }) });
      await waitMenu(page);
      await page.evaluate(() => window.__test.app.flow.openLevelSelect());
      await until(page, t => t.scene === 'levelSelect' && t.probe('levelSelect') && t.probe('levelSelect').ready, 'level select');
      await page.waitForFunction(() => window.__test.probe('levelSelect').cards.filter(c => c.thumb).length >= 14, null, { timeout: 30000 });
      await step(page, 20);
      await page.screenshot({ path: `${ctx.shots}/flow-level-select-phone-130.png` });
      const over = await page.evaluate(() => {
        const out = [];
        const grid = document.querySelector('.ls-grid');
        if (grid.scrollWidth > grid.clientWidth + 1) out.push(`grid ${grid.scrollWidth}>${grid.clientWidth}`);
        for (const card of document.querySelectorAll('.ls-card')) {
          if (card.scrollWidth > card.clientWidth + 1) out.push(`${card.id} sw=${card.scrollWidth} cw=${card.clientWidth}`);
          const cr = card.getBoundingClientRect();
          for (const n of card.querySelectorAll('canvas, b, small, .best, .round')) {
            const r = n.getBoundingClientRect();
            if (r.left < cr.left - 1 || r.right > cr.right + 1 || r.bottom > cr.bottom + 1) out.push(`${card.id} ${n.tagName}.${n.className} outside`);
          }
          const b = card.querySelector('.best'), rd = card.querySelector('.round');
          if (b && rd) { const x = b.getBoundingClientRect(), y = rd.getBoundingClientRect(); if (x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom) out.push(`${card.id} badges overlap`); }
        }
        return out;
      });
      assert(!over.length, `overflow: ${over.join('; ')}`);
      const cards = (await probe(page, 'levelSelect')).cards;
      const pic = id => cards.find(c => c.id === id).pic;
      assert(pic('alpha_level4') === 'patty', `level 4 picture: ${pic('alpha_level4')}`);
      assert(pic('alpha_level7') === 'iggy', `level 7 picture: ${pic('alpha_level7')}`);
      assert(pic('alpha_level1') === 'lucy_image' && pic('alpha_level5') === 'slurm_image', `other pictures: ${pic('alpha_level1')}, ${pic('alpha_level5')}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'flow rules: fresh run seeds, practice seeds, round restart scope, Continue after a fail, tied best',
    timeoutMs: 180000,
    async run(ctx) {
      // Two page loads that start a journey the same way get different run seeds.
      const seeds = [];
      for (let i = 0; i < 2; i++) {
        const { context, page } = await openGame(ctx, DESKTOP);
        await waitMenu(page);
        await captureLaunches(page);
        await page.evaluate(() => window.__test.app.flow.newGame());
        await until(page, t => t.scene === 'cutscene' && !t.transitioning, 'the cutscene');
        await callLast(page, 'cutscene', 'onComplete', { avatar: 'amy', nickname: 'Sam' });
        seeds.push((await probe(page, 'flow')).run.seed);
        await context.close();
      }
      assert(seeds[0] !== seeds[1], `two new journeys got the same seed ${seeds[0]}`);

      // Practice seeds never depend on the saved journey; ?seed= makes them reproducible.
      const practice = [];
      for (const run of [null, RUN({ seed: 777, step: 'action' })]) {
        const { context, page } = await openGame(ctx, DESKTOP, '&seed=5', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level2'], best: {} } }) });
        await waitMenu(page);
        await page.evaluate(() => window.__test.app.flow.playLevel('alpha_level2'));
        await until(page, t => t.probe('flow').lastLaunch && t.probe('flow').lastLaunch.scene === 'platform', 'the practice level');
        practice.push((await probe(page, 'flow')).lastLaunch.params.seed);
        await context.close();
      }
      assert(practice[0] === practice[1], `practice seeds depend on the saved journey: ${practice}`);

      // restartScope 'round': a failed level 3 restarts the round at level 1, with its briefing.
      {
        const run = RUN({ step: 'action', part: 2, hover: 57 });
        const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level2', 'alpha_level3'], best: {} }, settings: { v: 2, restartScope: 'round' } }) });
        await waitMenu(page);
        await captureLaunches(page);
        await page.evaluate(() => window.__test.app.flow.continueGame());
        await until(page, t => t.scene === 'platform' && !t.transitioning, 'level 3');
        assert((await lastParams(page, 'platform')).level === 'alpha_level3', 'Continue did not open level 3');
        await callLast(page, 'platform', 'onGameOver', { score: 80, reason: 1 });
        await until(page, t => t.scene === 'summary', 'the summary');
        await callLast(page, 'summary', 'onComplete', 'retry');
        await until(page, t => t.scene === 'platform' && !t.transitioning, 'the restart');
        const p = await lastParams(page, 'platform');
        assert(p.level === 'alpha_level1' && p.intro === undefined && p.score === 80, `round restart: ${JSON.stringify(p)}`);
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }

      // Default scope: the immediate retry skips the briefing; Continue later shows it.
      {
        const run = RUN({ step: 'action', part: 2, hover: 57 });
        const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run, unlocked: ['alpha_level1', 'alpha_level2', 'alpha_level3'], best: {} } }) });
        await waitMenu(page);
        await captureLaunches(page);
        await page.evaluate(() => window.__test.app.flow.continueGame());
        await until(page, t => t.scene === 'platform' && !t.transitioning, 'level 3');
        await callLast(page, 'platform', 'onGameOver', { score: 60, reason: 0 });
        await until(page, t => t.scene === 'summary' && !t.transitioning, 'the summary');
        await callLast(page, 'summary', 'onComplete', 'retry');
        await until(page, t => t.scene === 'platform' && !t.transitioning, 'the retry');
        let p = await lastParams(page, 'platform');
        assert(p.level === 'alpha_level3' && p.intro === '0' && p.score === 60, `retry: ${JSON.stringify(p)}`);
        await callLast(page, 'platform', 'onGameOver', { score: 60, reason: 0 });
        await until(page, t => t.scene === 'summary' && !t.transitioning, 'the summary');
        await page.evaluate(() => window.__test.app.flow.toSplash());
        await until(page, t => t.scene === 'splash' && t.probe('splash') && t.probe('splash').awake, 'the menu');
        await page.evaluate(() => window.__test.app.flow.continueGame());
        await until(page, t => t.scene === 'platform' && !t.transitioning, 'the resumed level');
        p = await lastParams(page, 'platform');
        assert(p.level === 'alpha_level3' && p.intro === undefined, `Continue after a fail skipped the briefing: ${JSON.stringify(p)}`);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smw:progress')).run);
        assert(!('retry' in saved) && !('age' in saved), `saved run: ${JSON.stringify(saved)}`);
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }

      // A score equal to the best is not a new best; a higher one is.
      {
        const { context, page, errors } = await openGame(ctx, DESKTOP, '', { init: seed({ progress: { v: 1, run: null, unlocked: ['alpha_level1', 'alpha_level2'], best: { alpha_level2: 340 } } }) });
        await waitMenu(page);
        await captureLaunches(page);
        for (const [score, expect] of [[340, false], [341, true]]) {
          await page.evaluate(() => window.__test.app.flow.playLevel('alpha_level2'));
          await until(page, t => t.scene === 'platform' && !t.transitioning, 'level 2');
          await callLast(page, 'platform', 'onComplete', { score });
          await until(page, t => t.scene === 'summary' && t.probe('summary'), 'the results');
          const s = await probe(page, 'summary');
          assert(s.newBest === expect, `score ${score} against best 340: newBest ${s.newBest}`);
          await until(page, t => !t.transitioning, 'the results to settle');
        }
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
];
