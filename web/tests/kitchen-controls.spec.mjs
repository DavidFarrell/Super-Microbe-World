// Kitchen game: input devices, prompts, pause and presentation fidelity (review fixes, see
// web/NOTES-kitchen-decisions.md "Review fixes"). Deterministic (?manual=1 and __test.step).
//   - intro text in the original's text fields (Verdana Bold 20, white, fixed tops), the dimmed
//     backdrop, the outro fonts and the "Microbial Mistakes" slots;
//   - a gamepad alone (navigator.getGamepads stub): intro, tutorial, play, pause (Resume and
//     Restart) and outro, with A / B / X / Y names in every prompt;
//   - a device switch while paused, restart from the intro and the outro, reduced motion switched
//     on mid-level, remapped keys in the legend, the reminders list keeping Space;
//   - tap targets on a 640 x 360 phone, and the points page at the largest text size.
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const TINY_PHONE = { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 720 } };

const probe = page => page.evaluate(() => window.__test.probe('kitchen'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// A connected standard gamepad whose buttons the test holds and releases (index -> pressed).
const PAD_STUB = () => {
  window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [window.__pad] });
};
const PAD = { A: 0, B: 1, X: 2, Y: 3, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
async function padPress(page, button) {
  await page.evaluate(i => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, button);
  await step(page, 1);
  await page.evaluate(i => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, button);
  await step(page, 1);
}

async function open(ctx, opts, query, { pad = false, textScale = null, keys = null } = {}) {
  const { context, page, errors } = await ctx.openPage(opts);
  if (pad) await page.addInitScript(PAD_STUB);
  if (textScale || keys) {
    await page.addInitScript(({ textScale, keys }) => {
      try {
        const s = { v: 2, ...JSON.parse(localStorage.getItem('smw:settings') || '{}') };
        if (textScale) s.textScale = textScale;
        if (keys) s.keys = keys;
        localStorage.setItem('smw:settings', JSON.stringify(s));
      } catch { /* ignore */ }
    }, { textScale, keys });
  }
  await page.goto(`${ctx.baseUrl}/index.html?scene=kitchen&manual=1${query}`);
  await page.waitForFunction(() => window.__test && window.__test.probe('kitchen') && window.__test.probe('kitchen').ready, null, { timeout: 20000 });
  return { context, page, errors };
}

// Stage rectangle of an element (the #ui layer is the 800 x 450 stage, scaled), with the
// entrance animations finished (they run on real time, not on the stepped loop).
const stageRect = (page, sel) => page.evaluate(s => {
  for (const a of document.getAnimations()) a.finish();
  const ui = document.getElementById('ui').getBoundingClientRect();
  const k = ui.width / 800;
  return [...document.querySelectorAll(s)].map(n => {
    const r = n.getBoundingClientRect();
    return { x: (r.left - ui.left) / k, y: (r.top - ui.top) / k, w: r.width / k, h: r.height / k, bottom: (r.bottom - ui.top) / k, text: n.textContent };
  });
}, sel);

// Canvas pixel at a stage point.
const pixel = (page, x, y) => page.evaluate(([x, y]) => {
  const c = document.getElementById('game');
  const k = c.width / 800;
  return [...c.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3);
}, [x, y]);

async function tapAt(page, cdp, sel) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} not visible`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await step(page, 2);
}

async function keyTo(page, id) {
  let p = await probe(page);
  for (let i = 0; i < 16 && p.focus !== id; i++) { await page.keyboard.press('Tab'); await step(page, 1); p = await probe(page); }
  assert(p.focus === id, `could not Tab to ${id} (focus ${p.focus})`);
}

// Moves the gamepad focus to a target with the d-pad (greedy on the targets' centres).
async function padTo(page, id) {
  let p = await probe(page);
  for (let i = 0; i < 12 && p.focus !== id; i++) {
    const c = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const a = c(p.targets[p.focus || 'item']), b = c(p.targets[id]);
    const dx = b.x - a.x, dy = b.y - a.y;
    await padPress(page, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? PAD.RIGHT : PAD.LEFT) : (dy > 0 ? PAD.DOWN : PAD.UP));
    p = await probe(page);
  }
  assert(p.focus === id, `could not reach ${id} with the d-pad (focus ${p.focus})`);
}

const introText = page => page.evaluate(() => [...document.querySelectorAll('.kz-intro-text p')].map(p => p.textContent).join(' | '));

export const tests = [
  {
    name: 'intro text sits in the original fields in white Verdana Bold 20 over the grey-dimmed kitchen',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, '&level=0&seed=4&avatar=amy');
      await page.mouse.click(5, 5);
      await step(page, 2);
      const lines = await stageRect(page, '.kz-intro-text p');
      const style = await page.evaluate(() => [...document.querySelectorAll('.kz-intro-text p')].map(p => { const s = getComputedStyle(p); return [s.fontFamily, s.fontSize, s.fontWeight, s.color, p.className]; }));
      assert(lines.length === 2, `page 1 has ${lines.length} lines`);
      style.forEach(([family, size, weight, colour, cls]) => {
        assert(/Verdana/.test(family) && size === '20px' && Number(weight) >= 700 && colour === 'rgb(255, 255, 255)' && !cls, `intro line style ${family} ${size} ${weight} ${colour} ${cls}`);
      });
      // text0 at (82.05, 63.75) and text1 at (200, 158.9), 2 px gutters (kitchen_game_intro_level_0.swf).
      assert(Math.abs(lines[0].y - 65.75) < 1.5 && Math.abs(lines[1].y - 160.9) < 1.5, `line tops ${lines.map(l => l.y.toFixed(1))}`);
      assert(Math.abs(lines[1].x + lines[1].w / 2 - 371.5) < 2, `text1 centre ${lines[1].x + lines[1].w / 2}`);
      await page.screenshot({ path: `${ctx.shots}/kitchen-controls-l0-intro1.png` });
      // The dim: 30 % of the picture over #333 (a white wall pixel 255 becomes about 112).
      const dim = await pixel(page, 790, 400);
      // Level 2's intro: "Level 2" in the same white Verdana Bold 20 as the other lines, at y 65.75.
      const { page: page2, context: context2 } = await open(ctx, DESKTOP, '&level=1&seed=4&avatar=amy');
      await page2.mouse.click(5, 5);
      await step(page2, 2);
      const l2 = await stageRect(page2, '.kz-intro-text p');
      const s2 = await page2.evaluate(() => { const s = getComputedStyle(document.querySelector('.kz-intro-text p')); return [s.fontSize, s.color]; });
      assert(l2[0].text === 'Level 2' && Math.abs(l2[0].y - 65.75) < 1.5 && s2[0] === '20px' && s2[1] === 'rgb(255, 255, 255)', `Level 2 line ${JSON.stringify(l2[0])} ${s2}`);
      assert(Math.abs(l2[0].x + l2[0].w / 2 - 393.05) < 2 && Math.abs(l2[1].y - 168.9) < 1.5, `level 2 intro fields ${JSON.stringify(l2)}`);
      await page2.screenshot({ path: `${ctx.shots}/kitchen-controls-l1-intro1.png` });
      // Undimmed, the same pixel in play.
      for (let i = 0; i < 6 && (await probe(page2)).mode === 'intro'; i++) { await page2.keyboard.press('Enter'); await step(page2, 1); }
      await step(page2, 30);
      const lit = await pixel(page2, 790, 400);
      await page2.screenshot({ path: `${ctx.shots}/kitchen-controls-l1-play.png` });
      const expect = lit.map(v => 0.3 * v + 0.7 * 51);
      assert(dim.every((v, i) => Math.abs(v - expect[i]) <= 8), `dimmed ${dim} vs 0.3 x ${lit} + 0.7 x 51 = ${expect.map(Math.round)}`);
      // Wrong page: "Wrong!  Try again." 23 px at y 56.95, the rules at 206.2 and 258.75.
      let p = await probe(page);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await page.keyboard.press('Enter'); await step(page, 1); p = await probe(page); }
      assert(p.mode === 'tutorial', `tutorial not shown (${p.mode})`);
      await keyTo(page, 'bin');
      await page.keyboard.press('Enter');
      await step(page, 2);
      const wrong = await stageRect(page, '.kz-intro-text p');
      const wsize = await page.evaluate(() => getComputedStyle(document.querySelector('.kz-intro-text p')).fontSize);
      assert(wsize === '23px' && Math.abs(wrong[0].y - 56.95) < 1.5 && Math.abs(wrong[1].y - 206.2) < 1.5 && Math.abs(wrong[2].y - 258.75) < 1.5, `wrong page ${wsize} ${wrong.map(l => l.y.toFixed(1))}`);
      await page.screenshot({ path: `${ctx.shots}/kitchen-controls-l0-wrong.png` });
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context2.close();
      await context.close();
    },
  },
  {
    name: 'gamepad alone: intro, tutorial, play, pause and outro, with A / B / X / Y in the prompts',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, '&level=0&seed=4&avatar=harry', { pad: true });
      let p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 0, 'intro page 1 not shown');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.device === 'gamepad' && p.mode === 'intro' && p.intro.page === 1, `A did not advance the intro (device ${p.device}, page ${p.intro && p.intro.page})`);
      await padPress(page, PAD.A);
      await padPress(page, PAD.A);
      const choose = await introText(page);
      assert(/d-pad and press A/.test(choose) && !/click/i.test(choose), `page 4 text: ${choose}`);
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'tutorial', `A did not open the tutorial (${p.mode})`);
      const hint = await page.textContent('.kz-hint');
      assert(/D-pad/.test(hint) && /\bA\b/.test(hint), `tutorial hint: ${hint}`);
      // Lift the spring onion with A (focus moves to the first place, the bowl), put it in the bowl.
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.held && p.focus === 'bowl', `A on the item: held ${p.held}, focus ${p.focus}`);
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 'wrong', 'the bowl should be wrong');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'tutorial', 'A on the wrong page did not go back to the tutorial');
      await padTo(page, 'fridgeDrawer');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 'right', 'the drawer should be right');
      const ready = await introText(page);
      assert(/Press A when you're ready/.test(ready), `right page: ${ready}`);
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'play', `A did not start play (${p.mode})`);
      const legend = await page.textContent('.kz-legend');
      for (const w of ['D-pad', 'A', 'B', 'X', 'Y', 'Start']) assert(legend.includes(w), `legend lacks ${w}: ${legend}`);
      assert(p.hud.tissue === 'Tissue! (B)' && /Wash \(Y\)/.test(p.hud.wash), `HUD labels ${JSON.stringify(p.hud)}`);
      // Start pauses; A on Resume resumes without also acting on the kitchen in the same tick.
      const placed = p.placements.length;
      await padPress(page, PAD.START);
      p = await probe(page);
      assert(p.mode === 'paused', 'Start did not pause');
      assert(await page.locator('#kz-restart').count() === 1, 'Restart missing on the play pause card');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'play' && !p.held && p.placements.length === placed, `A on Resume: mode ${p.mode}, held ${p.held}, placed ${p.placements.length}`);
      // Start, d-pad to Restart, A: play starts again, and the A does not lift the new item.
      await padPress(page, PAD.START);
      await padPress(page, PAD.RIGHT);
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'kz-restart', 'the d-pad did not reach Restart');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'play' && !p.held && p.placements.length === 0 && p.timeLeft === 60, `A on Restart: mode ${p.mode}, held ${p.held}, time ${p.timeLeft}`);
      await page.screenshot({ path: `${ctx.shots}/kitchen-controls-gamepad-play.png` });
      // Let the time run out, then page through the outro with A (Restart is not offered there).
      await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 4400, 10));
      p = await probe(page);
      assert(p.mode === 'outro' && p.outro.page === 0, `no outro (${p.mode})`);
      await padPress(page, PAD.START);
      assert((await probe(page)).mode === 'paused' && await page.locator('#kz-restart').count() === 0, 'Restart should not be offered on the outro');
      await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.mode === 'outro' && p.outro.page === 0, `A on Resume should not also turn the outro page (page ${p.outro && p.outro.page})`);
      for (let i = 0; i < 4; i++) await padPress(page, PAD.A);
      p = await probe(page);
      assert(p.level === 1 && p.mode === 'intro', `A did not page through the outro (level ${p.level}, mode ${p.mode})`);
      for (let i = 0; i < 3; i++) await padPress(page, PAD.A);
      const sneeze = await introText(page);
      assert(/press B for the tissues/.test(sneeze) && /Press A when ready/.test(sneeze), `level 2 page 4: ${sneeze}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'keyboard prompts name the keys; a device switch while paused shows touch prompts on resume',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, PHONE, '&level=1&seed=4&avatar=amy');
      const cdp = await context.newCDPSession(page);
      // Keyboard: the intro names T and Enter, and play shows the legend and "Tissue! (T)".
      await page.keyboard.press('ArrowRight');
      await step(page, 2);
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await step(page, 1); }
      let text = await introText(page);
      assert(/click on the tissues \(or press T\)/.test(text) && /\(or press Enter\)/.test(text), `keyboard page 4: ${text}`);
      // Pause, switch to touch on the pause card, resume: the page says "tap".
      await page.keyboard.press('Escape');
      await step(page, 2);
      assert((await probe(page)).mode === 'paused', 'Escape did not pause');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 20, y: 20, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await step(page, 2);
      await tapAt(page, cdp, '#kz-resume');
      let p = await probe(page);
      text = await introText(page);
      assert(p.mode === 'intro' && p.device === 'touch' && /tap on the tissues quick/.test(text) && /Tap on the button/.test(text), `after resume (${p.device}): ${text}`);
      // Play with the keyboard (legend), pause, switch to touch, resume: no legend.
      await page.keyboard.press('Enter');
      await step(page, 2);
      p = await probe(page);
      assert(p.mode === 'play' && await page.locator('.kz-legend').count() === 1, `keyboard play without a legend (${p.mode})`);
      assert(p.hud.tissue === 'Tissue! (T)', `keyboard HUD ${p.hud.tissue}`);
      await page.keyboard.press('Escape');
      await step(page, 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 20, y: 20, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await step(page, 2);
      await tapAt(page, cdp, '#kz-resume');
      p = await probe(page);
      assert(p.mode === 'play' && p.device === 'touch' && await page.locator('.kz-legend').count() === 0, `legend still shown after resume on touch (${p.device})`);
      assert(p.hud.tissue === 'Tissue!', `touch HUD ${p.hud.tissue}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'restart from the intro or tutorial replays them; reduced motion switched on mid-level stops the particles',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, PHONE, '&level=0&seed=4&avatar=amy');
      const cdp = await context.newCDPSession(page);
      await tapAt(page, cdp, '#kz-next');
      await tapAt(page, cdp, '#touch-pause');
      assert((await probe(page)).mode === 'paused', 'the pause button did not pause');
      await tapAt(page, cdp, '#kz-restart');
      let p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 0 && p.tutorial === null, `restart from the intro: mode ${p.mode}, page ${p.intro && p.intro.page}`);
      for (let i = 0; i < 4; i++) await tapAt(page, cdp, '#kz-next');
      p = await probe(page);
      assert(p.mode === 'tutorial', `no tutorial (${p.mode})`);
      await tapAt(page, cdp, '#touch-pause');
      await tapAt(page, cdp, '#kz-restart');
      p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 0, `restart from the tutorial: mode ${p.mode}`);
      // Through the tutorial to play; a restart from play starts play again at once.
      for (let i = 0; i < 4; i++) await tapAt(page, cdp, '#kz-next');
      await tapAt(page, cdp, '#kz-fridgeDrawer');
      await tapAt(page, cdp, '#kz-next');
      p = await probe(page);
      assert(p.mode === 'play', `not playing (${p.mode})`);
      await step(page, 200);
      await tapAt(page, cdp, '#touch-pause');
      await tapAt(page, cdp, '#kz-restart');
      p = await probe(page);
      assert(p.mode === 'play' && p.timeLeft === 60 && p.placements.length === 0, `restart from play: ${p.mode} ${p.timeLeft}`);
      // Reduced motion on while the level runs: read every tick, no particles after a placement.
      assert(!p.reducedMotion, 'reduced motion should start off');
      await page.evaluate(async () => { const { settings } = await import('/js/core/settings.js'); settings.set('reducedMotion', true); });
      await step(page, 40);
      p = await probe(page);
      assert(p.reducedMotion && p.fx.particles === 0, `reduced motion ${p.reducedMotion}, particles ${p.fx.particles}`);
      await tapAt(page, cdp, '#kz-bin');
      await step(page, 4);
      p = await probe(page);
      assert(p.placements.length === 1 && p.fx.particles === 0, `after a placement: ${p.placements.length} placed, ${p.fx.particles} particles`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'remapped keys show in the legend and hint; Space on the reminders list scrolls it; points page fits at 130 % text',
    timeoutMs: 120000,
    async run(ctx) {
      const keys = {
        left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'], fire: ['KeyX', 'KeyJ'],
        camera: ['KeyK', 'ControlLeft'], phone: ['Tab'], pause: ['KeyP'], confirm: ['Enter', 'NumpadEnter'], back: ['Backspace'],
        answer1: ['Digit1', 'Numpad1'], answer2: ['Digit2', 'Numpad2'], answer3: ['Digit3', 'Numpad3'],
      };
      const { context, page, errors } = await open(ctx, DESKTOP, '&level=0&seed=4&avatar=harry', { keys });
      await page.mouse.click(5, 5);
      let p = await probe(page);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await page.keyboard.press('Enter'); await step(page, 1); p = await probe(page); }
      const hint = await page.textContent('.kz-hint');
      assert(/W A S D or Tab/.test(hint), `tutorial hint: ${hint}`);
      await keyTo(page, 'fridgeDrawer');
      await page.keyboard.press('Enter');
      await step(page, 2);
      await page.keyboard.press('Enter');
      await step(page, 2);
      p = await probe(page);
      assert(p.mode === 'play', `not playing (${p.mode})`);
      const legend = await page.textContent('.kz-legend');
      assert(/W A S D \/ Tab/.test(legend) && /P pause/.test(legend) && !/Esc|Arrows/.test(legend), `legend: ${legend}`);
      await page.keyboard.press('KeyP');
      await step(page, 2);
      assert((await probe(page)).mode === 'paused', 'P (remapped) did not pause');
      await page.keyboard.press('KeyP');
      await step(page, 2);
      await context.close();

      // Level 4 at 130 % text: a sneeze on the food, then everything to the cupboard, for a long
      // reminders list.
      const run = await open(ctx, DESKTOP, '&level=3&seed=185&avatar=harry', { textScale: 1.3 });
      const pg = run.page;
      await pg.mouse.click(5, 5);
      p = await probe(pg);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await pg.keyboard.press('Enter'); await step(pg, 1); p = await probe(pg); }
      assert(await pg.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state === 'sneeze', 6000)) >= 0, 'no sneeze');
      await pg.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state !== 'sneeze', 400));
      await keyTo(pg, 'cupboard');
      for (let guard = 0; guard < 400 && p.mode === 'play'; guard++) {
        if (p.state === 'wait' && p.current) { await pg.keyboard.press('Enter'); await step(pg, 2); } else await step(pg, 5);
        p = await probe(pg);
        if (p.state === 'end') break;
      }
      await pg.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 300));
      await pg.keyboard.press('Enter'); await step(pg, 2);
      await pg.keyboard.press('Enter'); await step(pg, 2);
      p = await probe(pg);
      assert(p.outro.page === 2 && p.outro.notes.length >= 10 && p.outro.notes.includes('sneeze'), `reminders page with ${p.outro && p.outro.notes}`);
      const box = await pg.evaluate(() => { const n = document.querySelector('.kz-notes'); return { sh: n.scrollHeight, ch: n.clientHeight, cls: n.className }; });
      assert(box.sh > box.ch, `the list should scroll at 130 % (${box.sh} <= ${box.ch}, ${box.cls})`);
      const first = await stageRect(pg, '.kz-notes p');
      assert(first[0].y < 70, `the first reminder starts under the title (y ${first[0].y.toFixed(1)})`);
      await pg.screenshot({ path: `${ctx.shots}/kitchen-controls-notes-130.png` });
      await pg.keyboard.press('Shift+Tab');
      await step(pg, 1);
      assert(await pg.evaluate(() => document.activeElement.classList.contains('kz-notes')), 'Shift+Tab did not reach the list');
      await pg.keyboard.press('Space');
      await step(pg, 2);
      await pg.waitForTimeout(500);   // native (smooth) keyboard scrolling runs on real time
      p = await probe(pg);
      const top = await pg.evaluate(() => document.querySelector('.kz-notes').scrollTop);
      assert(p.outro.page === 2 && top > 0, `Space on the list: page ${p.outro.page}, scrollTop ${top}`);
      await pg.keyboard.press('Tab');
      await step(pg, 1);
      await pg.keyboard.press('Enter');
      await step(pg, 2);
      p = await probe(pg);
      assert(p.mode === 'outro' && p.outro.page === 3, `points page not shown (${p.mode}, page ${p.outro.page})`);
      const blocks = await stageRect(pg, '.kz-points .pair, .kz-total.big, .kz-total.small, #kz-next');
      const [pair, big, small, next] = blocks;
      assert(pair.bottom <= big.y && big.bottom <= small.y && small.bottom <= next.y, `points page overlaps at 130 %: ${blocks.map(b => `${b.y.toFixed(0)}-${b.bottom.toFixed(0)}`).join(', ')}`);
      await pg.screenshot({ path: `${ctx.shots}/kitchen-controls-points-130.png` });
      assert(errors.length === 0 && run.errors.length === 0, `console errors:\n${[...errors, ...run.errors].join('\n')}`);
      await run.context.close();
    },
  },
  {
    name: 'every target is at least 44 CSS px on a 640 x 360 phone',
    timeoutMs: 60000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, TINY_PHONE, '&level=1&seed=4&avatar=harry');
      const cdp = await context.newCDPSession(page);
      for (let i = 0; i < 4; i++) await tapAt(page, cdp, '#kz-next');
      const p = await probe(page);
      assert(p.mode === 'play', `not playing (${p.mode})`);
      for (const id of Object.keys(p.targets)) {
        const b = await page.locator(`#kz-${id}`).boundingBox();
        assert(b && b.width >= 44 && b.height >= 44, `${id} is ${b && b.width.toFixed(1)} x ${b && b.height.toFixed(1)} CSS px at 640 x 360`);
      }
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
