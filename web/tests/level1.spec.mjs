// Level 1 end to end: the level bot (web/tests/bots/platform-bot.mjs) completes alpha_level1 in
// Chromium through real inputs only, deterministically (__test.manual() + __test.step()):
//   - desktop 1280x720 with real keyboard events;
//   - phone landscape emulation (isMobile, hasTouch, 915x412) with real multi-touch taps on the
//     on-screen controls (movement, jump, photo).
// It never skips a scene or calls game code: the bot only reads __test.probe('platform').
// Also checks the touch controls stay clear of the player and the HUD on common viewports, and
// that move + jump + fire can be held together with three fingers.
import fs from 'node:fs';
import path from 'node:path';
import { PlatformBot } from './bots/platform-bot.mjs';

const LEVEL = 'alpha_level1';
const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', camera: 'KeyC', fire: 'KeyX' };
const TOUCH_IDS = { left: '#touch-left', right: '#touch-right', jump: '#touch-jump', camera: '#touch-camera', fire: '#touch-fire' };
const PHONE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };

const probe = page => page.evaluate(() => window.__test.probe('platform'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ?manual=1: the loop never ticks in real time, so the test steps every tick from the first one
// and a run with the same seed and inputs is reproducible (stepCount is 0 when the bot starts).
async function openLevel(ctx, opts, query = '') {
  const { context, page, errors } = await ctx.openPage(opts);
  await page.goto(`${ctx.baseUrl}/index.html?scene=platform&level=${LEVEL}&seed=1&manual=1${query}`);
  await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 20000 });
  const start = await probe(page);
  assert(start.stepCount === 0 && (await page.evaluate(() => window.__test.tick)) === 0, `the loop ticked before the test took over (stepCount ${start.stepCount})`);
  return { context, page, errors };
}

// Steps until the scene's ui mode matches, up to max ticks (checked every `chunk` ticks).
async function stepUntilUi(page, modes, max = 400, chunk = 1) {
  return page.evaluate(({ modes, max, chunk }) => window.__test.stepUntil(t => modes.includes(t.probe('platform').ui), max, chunk), { modes, max, chunk });
}

// One finger tap through CDP (a real touch event sequence, not a synthetic click).
async function tap(cdp, x, y, id = 99) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapEl(page, cdp, sel) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} is not visible`);
  await tap(cdp, b.x + b.width / 2, b.y + b.height / 2);
}

// Holds exactly the wanted on-screen buttons, one finger each (multi-touch). CDP cannot lift one
// finger out of several (touchEnd carries no points), so a release lifts every finger and puts
// the still-wanted ones straight back down within the same engine tick; the controls count
// fingers per action, so those actions stay held without a new press edge.
async function setTouches(cdp, want, held, centres) {
  const ids = { left: 1, right: 2, jump: 3, camera: 4, fire: 5 };
  const next = [...want].filter(a => centres[a]);
  const released = [...held].some(a => !want.has(a));
  const added = next.some(a => !held.has(a));
  if (!released && !added) return;
  const points = next.map(a => ({ x: centres[a].x, y: centres[a].y, id: ids[a] }));
  if (released && held.size) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (points.length) await cdp.send('Input.dispatchTouchEvent', { type: released || !held.size ? 'touchStart' : 'touchMove', touchPoints: points });
  held.clear();
  for (const a of next) held.add(a);
}

// Plays the level with the bot until it ends; returns the final probe and a trace summary.
async function playWithBot(ctx, page, mode, { cdp, shotPrefix, occlusion = null } = {}) {
  const level = JSON.parse(fs.readFileSync(path.join(ctx.web, 'data/levels', `${LEVEL}.json`), 'utf8'));
  const bot = new PlatformBot(level);
  const held = new Set();
  const centres = {};
  if (mode === 'touch') {
    for (const [a, sel] of Object.entries(TOUCH_IDS)) {
      const b = await page.locator(sel).boundingBox();
      assert(b, `touch control ${sel} is not visible during play`);
      centres[a] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
  }
  const used = new Set();
  let p = await probe(page), shot = 0, portalShot = false, photoShot = false;
  for (let i = 0; i < 7000 && p.state === 'play'; i++) {
    const want = new Set(bot.decide(p));
    for (const a of want) used.add(a);
    if (mode === 'touch') await setTouches(cdp, want, held, centres);
    else {
      for (const a of held) if (!want.has(a)) { await page.keyboard.up(KEYS[a]); held.delete(a); }
      for (const a of want) if (!held.has(a)) { await page.keyboard.down(KEYS[a]); held.add(a); }
    }
    await step(page, 2);
    p = await probe(page);
    if (occlusion && p.state === 'play' && p.ui === 'play') await checkOcclusion(page, p, occlusion);
    if (shotPrefix) {
      if (i === 40 && !shot++) await page.screenshot({ path: `${shotPrefix}-play.png`, scale: 'css' });
      if (!photoShot && p.goals[0] && p.goals[0].achieved >= 1) { photoShot = true; await step(page, 6); await page.screenshot({ path: `${shotPrefix}-photo.png`, scale: 'css' }); }
      if (p.portalOpen && !portalShot) { portalShot = true; await step(page, 8); await page.screenshot({ path: `${shotPrefix}-portal-open.png`, scale: 'css' }); }
    }
  }
  if (mode === 'touch') await setTouches(cdp, new Set(), held, centres);
  else for (const a of held) await page.keyboard.up(KEYS[a]);
  return { probe: p, used };
}

// Asserts the end state: goals met, portal used (exit reason 2 = complete), the level-complete
// screen shown, no console errors, and the input device the run was meant to use.
async function assertComplete(page, errors, device) {
  const n = await stepUntilUi(page, ['complete', 'gameover'], 600);
  const p = await probe(page);
  const g = p.goals[0];
  assert(p.state === 'complete', `level did not complete: state=${p.state} ui=${p.ui} exitReason=${p.exitReason}`);
  assert(g.achieved >= g.required, `goal not reached: ${g.achieved}/${g.required}`);
  assert(p.exitReason === 2, `exit reason ${p.exitReason}, expected 2 (portal)`);
  assert(p.ui === 'complete', `level-complete screen not shown (ui=${p.ui}, waited ${n} ticks)`);
  assert(await page.locator('#pf-next').count() === 1, 'no Next button on the level-complete screen');
  const lastDevice = await page.evaluate(() => window.__test.lastDevice);
  assert(lastDevice === device, `input device was ${lastDevice}, expected ${device}`);
  assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
  return p;
}

// Stage-space rectangles of the on-screen controls (the canvas is the letterboxed stage).
async function controlRects(page) {
  return page.evaluate(() => {
    const c = document.getElementById('game').getBoundingClientRect();
    const k = 800 / c.width;
    const out = {};
    // Layout boxes (the pressed state's scale transform is ignored, as the scene does).
    const box = n => {
      if (!n || !n.offsetParent) return null;
      const o = n.offsetParent.getBoundingClientRect();
      return { left: o.left + n.offsetLeft, top: o.top + n.offsetTop, width: n.offsetWidth, height: n.offsetHeight };
    };
    for (const id of ['touch-left', 'touch-right', 'touch-jump', 'touch-fire', 'touch-camera', 'touch-pause', 'touch-phone']) {
      const r = box(document.getElementById(id));
      if (!r || !r.width) continue;
      out[id] = { x: (r.left - c.left) * k, y: (r.top - c.top) * k, w: r.width * k, h: r.height * k, screen: { x: r.left, y: r.top, w: r.width, h: r.height } };
    }
    return { rects: out, viewport: { w: innerWidth, h: innerHeight } };
  });
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Targets the player must be able to see: live entities other than projectiles (microbes,
// pickups, milk and the exit portal), as screen rectangles of their art.
const PROJECTILES = ['bullet', 'camera_flash', 'antibiotic_bomb'];
function targetRects(p) {
  return p.entities.filter(e => e.alive && !PROJECTILES.includes(e.type))
    .map(e => ({ id: e.id, type: e.type, x: e.art.x - p.camera.x, y: e.art.y, w: e.art.w, h: e.art.h }))
    .filter(r => r.x < 800 && r.x + r.w > 0);
}

// Every control over a target must be faded (class 'occluding'), so the target stays visible,
// apart from the d-pad and Jump, which the thumb holds and which never fade (they must not
// flicker while pressed).
const HELD = ['touch-left', 'touch-right', 'touch-jump'];
async function checkOcclusion(page, p, stats) {
  const { rects } = await controlRects(page);
  const faded = await page.evaluate(() => [...document.querySelectorAll('.touch-btn.occluding')].map(n => n.id));
  for (const id of HELD) assert(!faded.includes(id), `step ${p.stepCount}: the held control ${id} faded`);
  for (const t of targetRects(p)) {
    for (const [id, r] of Object.entries(rects)) {
      if (HELD.includes(id) || !overlap(r, t)) continue;
      stats.covered++;
      stats.byType[t.type] = (stats.byType[t.type] || 0) + 1;
      assert(faded.includes(id), `step ${p.stepCount}: ${id} covers ${t.type} #${t.id} but is not faded (faded: ${faded.join(',') || 'none'})`);
    }
  }
  stats.samples++;
}

export const tests = [
  {
    name: 'desktop 1280x720: bot completes level 1 with the keyboard',
    timeoutMs: 240000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 1280, height: 720 } });
      const shotPrefix = path.join(ctx.shots, 'level1-desktop');
      await step(page, 60);
      await page.screenshot({ path: `${shotPrefix}-intro.png`, scale: 'css' });
      // The briefing: Space / Enter advance the pages, then play starts.
      const texts = new Set();
      for (let i = 0; i < 40; i++) {
        const p = await probe(page);
        if (p.ui === 'play') break;
        if (p.intro) texts.add(p.intro.text);
        await page.keyboard.press(i % 2 ? 'Enter' : 'Space');
        await step(page, 12);
      }
      assert((await probe(page)).ui === 'play', 'the briefing did not lead to play');
      assert([...texts].some(x => /press C to use your camera phone/.test(x)), `the photo prompt does not name the keyboard key: ${[...texts].join(' | ')}`);
      // The phone key re-opens the briefing (paused); Esc closes it again.
      await page.keyboard.press('KeyP');
      await step(page, 2);
      assert((await probe(page)).ui === 'briefing', 'P did not re-open the briefing');
      await step(page, 80);
      await page.keyboard.press('Escape');
      assert((await stepUntilUi(page, ['play'], 200)) >= 0, 'Esc did not close the briefing');
      // Pause with Escape, resume with Enter on the focused Resume button.
      await page.keyboard.press('Escape');
      await step(page, 2);
      assert((await probe(page)).ui === 'paused', 'Escape did not pause');
      await page.waitForTimeout(450); // let the card's entrance animation finish
      await page.screenshot({ path: `${shotPrefix}-paused.png`, scale: 'css' });
      await page.keyboard.press('Enter');
      await step(page, 2);
      assert((await probe(page)).ui === 'play', 'Enter on Resume did not resume');
      // Hiding the tab pauses too.
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await step(page, 2);
      assert((await probe(page)).ui === 'paused', 'hiding the page did not pause');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
      await page.keyboard.press('Escape');
      await step(page, 2);
      assert((await probe(page)).ui === 'play', 'Escape did not resume');

      const { used } = await playWithBot(ctx, page, 'keyboard', { shotPrefix });
      const p = await assertComplete(page, errors, 'keyboard');
      await step(page, 30);
      await page.waitForTimeout(1200); // the card animates in and counts the score up in real time
      await page.screenshot({ path: `${shotPrefix}-complete.png`, scale: 'css' });
      ctx.log(`steps=${p.stepCount} score=${p.score} lives=${p.lives} goal=${p.goals[0].achieved}/${p.goals[0].required} actions=${[...used].sort().join(',')}`);
      await context.close();
    },
  },
  {
    name: 'phone 915x412 (touch emulation): bot completes level 1 with on-screen controls',
    timeoutMs: 240000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, PHONE);
      const cdp = await context.newCDPSession(page);
      const shotPrefix = path.join(ctx.shots, 'level1-phone');
      await step(page, 60);
      await page.screenshot({ path: `${shotPrefix}-intro.png`, scale: 'css' });
      // Tap through the briefing: the Next button on each page (the whole stage also works).
      const texts = new Set();
      for (let i = 0; i < 40; i++) {
        const p = await probe(page);
        if (p.ui === 'play') break;
        if (p.intro) texts.add(p.intro.text);
        if (p.intro && p.intro.phase === 'page') await tapEl(page, cdp, i % 3 === 2 ? '#pf-intro-tap' : '#pf-intro-next');
        await step(page, 12);
      }
      assert((await probe(page)).ui === 'play', 'tapping through the briefing did not lead to play');
      assert([...texts].some(x => /tap the camera button/.test(x)), `the photo prompt does not mention the touch button: ${[...texts].join(' | ')}`);
      // The phone button re-opens the briefing; its Back button returns to play.
      await tapEl(page, cdp, '#touch-phone');
      await step(page, 2);
      assert((await probe(page)).ui === 'briefing', 'the touch phone button did not open the briefing');
      await step(page, 70);
      await tapEl(page, cdp, '#pf-intro-skip');
      assert((await stepUntilUi(page, ['play'], 200)) >= 0, 'the briefing Back button did not return to play');
      await tapEl(page, cdp, '#touch-pause');
      await step(page, 2);
      assert((await probe(page)).ui === 'paused', 'the touch pause button did not pause');
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${shotPrefix}-paused.png`, scale: 'css' });
      await tapEl(page, cdp, '#pf-resume');
      await step(page, 2);
      assert((await probe(page)).ui === 'play', 'tapping Resume did not resume');

      const occlusion = { samples: 0, covered: 0, byType: {} };
      const { used } = await playWithBot(ctx, page, 'touch', { cdp, shotPrefix, occlusion });
      for (const a of ['right', 'jump', 'camera']) assert(used.has(a), `the touch run never used ${a}`);
      const p = await assertComplete(page, errors, 'touch');
      ctx.log(`occlusion: ${occlusion.samples} steps checked, ${occlusion.covered} control-over-target overlaps, all faded (${JSON.stringify(occlusion.byType)})`);
      await step(page, 30);
      await page.waitForTimeout(1200); // the card animates in and counts the score up in real time
      await page.screenshot({ path: `${shotPrefix}-complete.png`, scale: 'css' });
      ctx.log(`steps=${p.stepCount} score=${p.score} lives=${p.lives} goal=${p.goals[0].achieved}/${p.goals[0].required} actions=${[...used].sort().join(',')}`);
      await context.close();
    },
  },
  {
    name: 'touch controls never cover the player at the start or the HUD (phones and a tablet, landscape)',
    timeoutMs: 120000,
    async run(ctx) {
      // The HUD in touch play: score, hearts and timer at their original places, the ePhone on the left.
      const HUD = { score: { x: 674.8, y: 14.05, w: 73, h: 32.1 }, hearts: { x: 655.85, y: 71.7, w: 111.2, h: 23.3 }, timer: { x: 333.95, y: 17.5, w: 104, h: 21.9 } };
      for (const [w, h] of [[844, 390], [915, 412], [667, 375], [1024, 768]]) {
        const { context, page, errors } = await openLevel(ctx, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '&intro=0');
        await step(page, 40);
        const p = await probe(page);
        assert(p.ui === 'play' && p.hud.touchLayout, `${w}x${h}: not in touch play (ui=${p.ui})`);
        const player = { x: p.player.x - p.camera.x, y: p.player.y, w: p.player.w, h: p.player.h };
        const { rects, viewport } = await controlRects(page);
        assert(Object.keys(rects).length === 7, `${w}x${h}: expected 7 visible controls, got ${Object.keys(rects).join(',')}`);
        for (const [id, r] of Object.entries(rects)) {
          assert(!overlap(r, player), `${w}x${h}: ${id} covers the player at the start`);
          for (const [name, hr] of Object.entries({ ...HUD, ephone: p.hud.phone })) assert(!overlap(r, hr), `${w}x${h}: ${id} covers the HUD ${name}`);
          const sr = r.screen;
          assert(sr.x >= 0 && sr.y >= 0 && sr.x + sr.w <= viewport.w && sr.y + sr.h <= viewport.h, `${w}x${h}: ${id} is off screen`);
          assert(sr.w >= 44 && sr.h >= 44, `${w}x${h}: ${id} is smaller than a 44 px tap target`);
        }
        await page.screenshot({ path: path.join(ctx.shots, `level1-touch-${w}x${h}.png`), scale: 'css' });
        assert(errors.length === 0, `${w}x${h}: console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
  {
    name: 'multi-touch: ride, jump and throw with three fingers at once',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, PHONE, '&intro=0');
      const cdp = await context.newCDPSession(page);
      await step(page, 10);
      const { rects } = await controlRects(page);
      const c = id => ({ x: rects[id].screen.x + rects[id].screen.w / 2, y: rects[id].screen.y + rects[id].screen.h / 2 });
      const before = await probe(page);
      const points = [{ ...c('touch-right'), id: 1 }, { ...c('touch-jump'), id: 2 }, { ...c('touch-fire'), id: 3 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
      await step(page, 1);
      const down = await page.evaluate(() => ['right', 'jump', 'fire'].filter(a => window.__test.app.input.isDown(a)));
      assert(down.length === 3, `held together: ${down.join(',')}`);
      await step(page, 16);
      const p = await probe(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await step(page, 2);
      assert(p.player.x > before.player.x + 5, 'did not ride right');
      assert(p.player.y < before.player.y - 20 || p.player.vy < 0, 'did not jump');
      assert(p.entities.some(e => e.type === 'bullet'), 'did not throw');
      const after = await page.evaluate(() => ['right', 'jump', 'fire'].filter(a => window.__test.app.input.isDown(a)));
      assert(after.length === 0, `still held after lifting: ${after.join(',')}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'every visible button in the UI layer is at least 44x44 CSS px on a 667x375 phone',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const cdp = await context.newCDPSession(page);
      const small = async where => {
        const sizes = await page.evaluate(() => [...document.querySelectorAll('#ui button')].filter(b => b.offsetParent !== null && getComputedStyle(b).display !== 'none')
          .map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.textContent.trim(), w: r.width, h: r.height }; }));
        assert(sizes.length, `${where}: no visible buttons`);
        for (const b of sizes) assert(b.w >= 44 && b.h >= 44, `${where}: ${b.id} is ${b.w.toFixed(1)}x${b.h.toFixed(1)} CSS px`);
        return sizes.length;
      };
      await step(page, 60);
      const n1 = await small('briefing');
      await tapEl(page, cdp, '#pf-intro-skip');
      assert((await stepUntilUi(page, ['play'], 200)) >= 0, 'Skip did not start play');
      await tapEl(page, cdp, '#touch-pause');
      await step(page, 2);
      assert((await probe(page)).ui === 'paused', 'did not pause');
      await page.waitForTimeout(450);
      const n2 = await small('pause menu');
      await tapEl(page, cdp, '#pf-resume');
      await step(page, 2);
      // Let the 180 s clock run out (12000 ticks) for the game-over card.
      assert((await stepUntilUi(page, ['gameover'], 13000, 50)) >= 0, 'the time-up card did not appear');
      await page.waitForTimeout(450);
      const n3 = await small('game over');
      const prompt = await page.locator('.pf-card p').first().textContent();
      assert(prompt === 'Tap to try again', `touch game-over prompt: ${prompt}`);
      ctx.log(`buttons checked: briefing ${n1}, pause ${n2}, game over ${n3}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'touch comes back after a key press; a tap anywhere shows the controls again',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, PHONE, '&intro=0');
      const cdp = await context.newCDPSession(page);
      await step(page, 4);
      assert(await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display) !== 'none', 'touch controls hidden at the start');
      await page.keyboard.press('KeyA');
      await step(page, 2);
      assert(await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display) === 'none', 'a key press did not hide the touch controls');
      // Tap the middle of the stage (no control there): touch mode returns.
      await tap(cdp, 457, 150);
      await step(page, 2);
      const dev = await page.evaluate(() => window.__test.lastDevice);
      assert(dev === 'touch', `device after a tap: ${dev}`);
      assert(await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display) !== 'none', 'the tap did not bring the controls back');
      const { rects } = await controlRects(page);
      const r = rects['touch-right'].screen;
      const before = (await probe(page)).player.x;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + r.w / 2, y: r.y + r.h / 2, id: 1 }] });
      await step(page, 30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const after = await probe(page);
      assert(after.player.x > before + 20 && after.hud.touchLayout, `holding right did not ride (x ${before} -> ${after.player.x})`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'portrait, window blur and hidden tab pause play; the loop stops while the rotate prompt shows',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { ...PHONE, viewport: { width: 844, height: 390 } }, '&intro=0');
      await step(page, 4);
      assert((await probe(page)).ui === 'play', 'not playing');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => window.__test.app.loop.paused === true, null, { timeout: 5000 });
      assert(await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display) === 'grid', 'no rotate prompt in portrait');
      assert((await probe(page)).ui === 'paused', 'portrait did not pause');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForFunction(() => window.__test.app.loop.paused === false, null, { timeout: 5000 });
      assert((await probe(page)).ui === 'paused', 'rotating back should leave the pause menu up');
      await page.locator('#pf-resume').tap();
      await step(page, 2);
      assert((await probe(page)).ui === 'play', 'Resume did not resume');
      await page.evaluate(() => dispatchEvent(new Event('blur')));
      await step(page, 1);
      assert((await probe(page)).ui === 'paused', 'window blur did not pause');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'keyboard dialogs: Tab stays in the pause card, Space activates, focus returns to the game',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 1280, height: 720 } }, '&intro=0');
      await step(page, 10);
      await page.keyboard.press('Escape');
      await step(page, 2);
      assert((await probe(page)).ui === 'paused', 'Escape did not pause');
      const focused = () => page.evaluate(() => document.activeElement && document.activeElement.id);
      assert(await focused() === 'pf-resume', `first focus: ${await focused()}`);
      const modal = await page.evaluate(() => document.querySelector('.pf-card[role="dialog"]').getAttribute('aria-modal'));
      assert(modal === 'true', 'the pause card is not aria-modal');
      // One tick after each key, as in real time (a 15 ms tick polls between key presses).
      const key = async k => { await page.keyboard.press(k); await step(page, 1); };
      await key('Tab');
      assert(await focused() === 'pf-restart', `Tab moved focus to ${await focused()}`);
      await key('Shift+Tab');
      await key('Shift+Tab');
      const last = await page.evaluate(() => [...document.querySelectorAll('.pf-card button')].pop().id);
      assert(await focused() === last, `Shift+Tab from the first button went to ${await focused()}, expected ${last}`);
      await key('Tab');
      assert(await focused() === 'pf-resume', `Tab from the last button went to ${await focused()}`);
      await key('Space');
      await step(page, 2);
      assert((await probe(page)).ui === 'play', 'Space on Resume did not resume');
      assert(await focused() === 'game', `focus after closing: ${await focused()}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'pause freezes the picture (sparkles, popups, HUD); Restart clears popups and shake',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 1280, height: 720 } }, '&intro=0');
      const level = JSON.parse(fs.readFileSync(path.join(ctx.web, 'data/levels', `${LEVEL}.json`), 'utf8'));
      const bot = new PlatformBot(level);
      let p = await probe(page);
      for (let i = 0; i < 3000 && !(p.flyers > 0); i++) {
        await page.evaluate(a => window.__test.hold(a), bot.decide(p));
        await step(page, 2);
        p = await probe(page);
      }
      await page.evaluate(() => window.__test.releaseAll());
      assert(p.flyers > 0 && p.fx.popups > 0, `no photo sparkle in flight (flyers ${p.flyers}, popups ${p.fx.popups})`);
      await page.keyboard.press('Escape');
      await step(page, 2);
      const a = await probe(page);
      assert(a.ui === 'paused', 'did not pause');
      await step(page, 60);
      const b = await probe(page);
      assert(b.flyers === a.flyers && b.hud.ticksShown === a.hud.ticksShown && b.fx.popups === a.fx.popups && b.fx.particles === a.fx.particles && b.time === a.time,
        `paused picture changed: ${JSON.stringify({ a: [a.flyers, a.hud.ticksShown, a.fx, a.time], b: [b.flyers, b.hud.ticksShown, b.fx, b.time] })}`);
      await page.locator('#pf-restart').click();
      await step(page, 1);
      // Restart asks first (No focused); Yes restarts.
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'fl-confirm-no', 'Restart did not ask first with No focused');
      assert((await probe(page)).ui === 'paused', 'the level left the pause before the answer');
      await page.locator('#fl-confirm-yes').click();
      await step(page, 1);
      const c = await probe(page);
      assert(c.ui === 'play' && c.stepCount <= 1, `Restart did not restart (ui ${c.ui}, step ${c.stepCount})`);
      assert(c.fx.popups === 0 && c.fx.shake === 0 && c.flyers === 0, `state leaked into the restarted level: ${JSON.stringify(c.fx)} flyers ${c.flyers}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'settings: saved as overrides; reduced motion keeps following the OS until chosen in game',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' }, '&intro=0');
      await step(page, 4);
      await page.keyboard.press('Escape');
      await step(page, 2);
      await page.locator('#pf-sound').click();
      await page.locator('#pf-sound').click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smw:settings')));
      assert(!('reducedMotion' in saved) && !('reducedShake' in saved) && !('keys' in saved), `saved more than the player chose: ${JSON.stringify(saved)}`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // The media query's change event arrives asynchronously.
      await page.waitForFunction(() => document.documentElement.classList.contains('reduced-motion') && window.__test.probe('platform').reducedMotion, null, { timeout: 5000 });
      const live = await page.evaluate(() => window.__test.app.settings.get('reducedMotion'));
      assert(live === true, `the OS change was not followed live: ${live}`);
      await page.reload();
      await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 20000 });
      const after = await page.evaluate(() => [window.__test.app.settings.get('reducedMotion'), window.__test.app.settings.get('reducedShake'), document.documentElement.classList.contains('reduced-motion')]);
      assert(after.every(Boolean), `after reload with the OS set to reduce: ${after}`);
      // A choice in the pause menu overrides the OS and is saved.
      await step(page, 4);
      await page.keyboard.press('Escape');
      await step(page, 2);
      await page.locator('#pf-motion').click();
      const chosen = await page.evaluate(() => [window.__test.app.settings.get('reducedMotion'), JSON.parse(localStorage.getItem('smw:settings')).reducedMotion, window.__test.probe('platform').reducedMotion]);
      assert(chosen[0] === false && chosen[1] === false && chosen[2] === false, `the pause toggle did not record a choice: ${chosen}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'game over on desktop names the keyboard key',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await openLevel(ctx, { viewport: { width: 1280, height: 720 } }, '&intro=0');
      await page.keyboard.press('KeyA');
      assert((await stepUntilUi(page, ['gameover'], 13000, 50)) >= 0, 'the time-up card did not appear');
      const prompt = await page.locator('.pf-card p').first().textContent();
      assert(prompt === 'Press Enter to try again', `keyboard game-over prompt: ${prompt}`);
      await page.keyboard.press('Enter');
      await step(page, 2);
      const p = await probe(page);
      assert(p.ui === 'play' && p.stepCount <= 1, `Enter on Try again did not restart (ui ${p.ui})`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    // New Game now runs the flow's journey (cutscene, shrinking zone; flow.spec.mjs covers it),
    // so level 1 is reached here through Level select, the flow's one-level path.
    name: 'splash: Level select starts level 1 with its briefing (keyboard and tap)',
    timeoutMs: 90000,
    async run(ctx) {
      for (const [opts, how] of [[{ viewport: { width: 1280, height: 720 } }, 'enter'], [PHONE, 'tap']]) {
        const { context, page, errors } = await ctx.openPage(opts);
        await page.goto(`${ctx.baseUrl}/index.html?lang=en`);
        await page.waitForFunction(() => window.__test && window.__test.scene === 'splash', null, { timeout: 20000 });
        const press = async sel => {
          await page.locator(sel).waitFor({ state: 'visible', timeout: 30000 });
          if (how === 'tap') await page.locator(sel).tap();
          else { await page.locator(sel).focus(); await page.keyboard.press('Enter'); }
        };
        await press('#btn-level-select');
        await page.waitForFunction(() => window.__test.scene === 'levelSelect', null, { timeout: 20000 });
        await press('#level-alpha_level1');
        await page.waitForFunction(() => window.__test.scene === 'platform' && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 20000 });
        const p = await page.evaluate(() => window.__test.probe('platform'));
        assert(p.level === 'alpha_level1', `Level select opened ${p.level}`);
        assert(p.ui === 'intro', `level 1 should open the briefing first (ui=${p.ui})`);
        assert(errors.length === 0, `${how}: console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
];
