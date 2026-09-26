// Platform levels: the briefing, the cards and the level-10 hints, as reviewed.
//   (e) the first briefing: the level is shown without its tiles, a window blur stops the
//       autoplay (the level never starts unattended); once the player turns a page themselves
//       the autoplay stays off (they read at their own pace), and play (with the clock) starts
//       as the phone starts shrinking after their last press, the tiles with it.
//   (f) reduced motion: the briefing still autoplays, page by page, but never turns its last
//       page: play waits for the player's press. A long page waits longer than 5 s, and longer
//       still at a larger text size.
//   (g) game-over card: Enter retries whatever has focus; on touch the prompt says "Tap", turns
//       into "Press Enter" after a key press, and a tap off the buttons retries.
//   (h) level 10: the antibiotic whiteout covers the score and hearts; off-screen bombs on one
//       side get separate badges.
import fs from 'node:fs';
import path from 'node:path';

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const probe = page => page.evaluate(() => window.__test.probe('platform'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const stepUntilUi = (page, modes, max, chunk = 1) =>
  page.evaluate(({ modes, max, chunk }) => window.__test.stepUntil(t => modes.includes(t.probe('platform').ui), max, chunk), { modes, max, chunk });
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const PHONE = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(ctx, opts, query) {
  const { context, page, errors } = await ctx.openPage(opts);
  await page.goto(`${ctx.baseUrl}/index.html?scene=platform&seed=1&manual=1&${query}`);
  await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
  return { context, page, errors };
}

// Runs the level clock out (no input) and waits for the game-over card.
async function runOutClock(page) {
  await page.evaluate(() => window.__test.releaseAll());
  const used = await stepUntilUi(page, ['gameover'], 14000, 100);
  assert(used >= 0, 'the clock did not run out into the game-over card');
  await step(page, 2);
  assert(await page.locator('#pf-retry').count() === 1, 'no Try again button');
}

const promptText = page => page.evaluate(() => document.querySelector('.pf-card p')?.textContent || '');

export const tests = [
  {
    name: '(e) briefing: no tiles under the phone, a blur stops the autoplay, play starts as the phone shrinks',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, DESKTOP, 'level=alpha_level2');
      await step(page, 100);
      let p = await probe(page);
      assert(p.ui === 'intro' && p.intro && p.intro.page === 0, `not on the first briefing page (ui ${p.ui})`);
      assert(p.tilesDrawn === 0, `${p.tilesDrawn} tiles drawn under the first briefing`);
      assert(p.entities.some(e => e.onScreen), 'no level entity to show around the phone');
      await page.screenshot({ path: path.join(ctx.shots, 'levels-ui-briefing.png'), scale: 'css' });
      // The player goes away: the briefing waits on its page and the level does not start.
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      const ran = await stepUntilUi(page, ['play'], 2500, 10);
      p = await probe(page);
      assert(ran < 0 && p.ui === 'intro', `the briefing started the level unattended (ui ${p.ui} after ${ran} ticks)`);
      assert(p.stepCount === 0 && p.secondsLeft === 180, `the level ran while the briefing waited (step ${p.stepCount}, ${p.secondsLeft} s)`);
      assert(p.intro.page === 0 && p.intro.autoplay === false, `the briefing moved on (page ${p.intro.page}, autoplay ${p.intro.autoplay})`);
      // Back: a key press (Space shows the whole page or the next one). The player is now
      // turning pages themselves, so the autoplay stays off: the briefing waits on its page.
      await page.keyboard.press('Space');
      await step(page, 2);
      p = await probe(page);
      assert(p.intro.autoplay === false, 'the autoplay came back after the player turned a page');
      const page0 = p.intro.page;
      await step(page, 1200);
      p = await probe(page);
      assert(p.ui === 'intro' && p.intro.page === page0 && p.stepCount === 0, `the briefing moved on by itself after a manual page turn (page ${p.intro.page}, ui ${p.ui})`);
      // Each press turns a page; the press on the last page starts the level.
      let shrink = -1;
      for (let i = 0; i < 30 && shrink < 0; i++) {
        await page.keyboard.press('Space');
        shrink = await page.evaluate(() => window.__test.stepUntil(t => { const q = t.probe('platform'); return q.intro && q.intro.phase === 'shrink'; }, 6, 1));
      }
      assert(shrink >= 0, 'the key presses did not reach the end of the briefing');
      p = await probe(page);
      assert(p.ui === 'play', `play did not start as the phone started shrinking (ui ${p.ui})`);
      await step(page, 20);
      p = await probe(page);
      assert(p.intro && p.intro.phase === 'shrink' && p.stepCount >= 8, `the level did not run under the shrinking phone (intro ${p.intro && p.intro.phase}, step ${p.stepCount})`);
      assert(p.tilesDrawn > 0, 'no tiles once play started');
      await page.screenshot({ path: path.join(ctx.shots, 'levels-ui-shrink.png'), scale: 'css' });
      await step(page, 60);
      p = await probe(page);
      assert(p.intro === null && p.ui === 'play', `the phone did not finish shrinking (intro ${JSON.stringify(p.intro)})`);
      // The re-opened briefing (port only) keeps the tiles.
      await page.keyboard.press('KeyP');
      await step(page, 80);
      p = await probe(page);
      assert(p.ui === 'briefing' && p.tilesDrawn > 0, `re-opened briefing: ui ${p.ui}, ${p.tilesDrawn} tiles`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(f) reduced motion: the briefing autoplays page by page, but only the player starts the level; long pages wait longer',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await open(ctx, { ...DESKTOP, reducedMotion: 'reduce' }, 'level=alpha_level2');
      const p0 = await probe(page);
      assert(p0.reducedMotion, 'reduced motion is not on');
      await step(page, 20);
      const p1 = await probe(page);
      assert(p1.ui === 'intro' && p1.intro.autoplay, `autoplay is not running with reduced motion (${JSON.stringify(p1.intro)})`);
      // Autoplay turns every page but the last, each after max(5 s, 0.45 s a word).
      const turns = [];
      let last = p1.intro.page, t0 = 20, ticks = 20;
      for (let guard = 0; guard < 400; guard++) {
        await step(page, 10); ticks += 10;
        const q = await probe(page);
        if (q.ui !== 'intro') throw new Error(`the briefing left by itself (ui ${q.ui})`);
        if (q.intro.page !== last) { turns.push({ page: last, ticks: ticks - t0 }); last = q.intro.page; t0 = ticks; }
        if (q.intro.page === q.intro.pages - 1) break;
      }
      let q = await probe(page);
      assert(q.intro.page === q.intro.pages - 1, `autoplay did not reach the last page (page ${q.intro.page} of ${q.intro.pages})`);
      for (const tr of turns) assert(tr.ticks >= Math.round(5000 / 15) - 10, `page ${tr.page} turned after ${tr.ticks} ticks, under 5 s`);
      await step(page, 1500);
      q = await probe(page);
      assert(q.ui === 'intro' && !q.intro.autoplay && q.stepCount === 0, `the last page started the level unattended (ui ${q.ui}, step ${q.stepCount})`);
      await page.keyboard.press('Space');
      const used = await stepUntilUi(page, ['play'], 200, 1);
      assert(used >= 0, 'the press on the last page did not start the level');
      // Pace: 0.45 s a word, times the text scale (the level 2 briefing, first page).
      const pace = await page.evaluate(async () => {
        const { IntroPhone } = await import('./js/platformer/intro.js');
        const { settings } = await import('./js/core/settings.js');
        const fake = { text: new Array(20).fill('word').join(' ') };
        const at = scale => { settings.set('textScale', scale); return IntroPhone.prototype.autoplayTicks.call(fake); };
        const out = { short: IntroPhone.prototype.autoplayTicks.call({ text: 'a few words' }), long: at(1), large: at(1.3) };
        settings.set('textScale', 1);
        return out;
      });
      assert(pace.short === Math.round(5000 / 15) && pace.long === Math.round(9000 / 15) && pace.large === Math.round(11700 / 15), `autoplay pace ${JSON.stringify(pace)}`);
      ctx.log(`autoplay turns (ticks): ${turns.map(tr => tr.ticks).join(', ')}; play after the press; pace ${JSON.stringify(pace)}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: '(g) game-over card: Enter retries with no focus; on touch the prompt follows the device and a backdrop tap retries',
    timeoutMs: 180000,
    async run(ctx) {
      {
        const { context, page, errors } = await open(ctx, DESKTOP, 'level=alpha_level2&intro=0');
        await runOutClock(page);
        assert(/Press Enter to try again/.test(await promptText(page)), `desktop prompt: ${await promptText(page)}`);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        assert(await page.evaluate(() => document.activeElement === document.body), 'focus did not leave the card');
        await page.keyboard.press('Enter');
        await step(page, 2);
        const p = await probe(page);
        assert(p.ui === 'play' && p.stepCount <= 2, `Enter with no focus did not retry (ui ${p.ui})`);
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }
      {
        const { context, page, errors } = await open(ctx, PHONE, 'level=alpha_level2&intro=0');
        const cdp = await context.newCDPSession(page);
        await runOutClock(page);
        assert(/Tap to try again/.test(await promptText(page)), `touch prompt: ${await promptText(page)}`);
        await page.keyboard.press('KeyQ');     // an unbound key: the keyboard is now in use
        await step(page, 2);
        assert(/Press Enter to try again/.test(await promptText(page)), `after a key press the prompt reads: ${await promptText(page)}`);
        assert((await probe(page)).ui === 'gameover', 'an unbound key left the card');
        const card = await page.locator('.pf-card').boundingBox();
        const ov = await page.locator('.pf-overlay').boundingBox();
        const x = ov.x + 12, y = ov.y + 12;
        assert(x < card.x || y < card.y, 'no backdrop outside the card');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await step(page, 2);
        const p = await probe(page);
        assert(p.ui === 'play', `a tap on the backdrop did not retry (ui ${p.ui})`);
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
  {
    name: '(h) level 10: the whiteout covers the score and hearts; off-screen bombs on one side get separate badges',
    timeoutMs: 120000,
    async run(ctx) {
      const trace = JSON.parse(fs.readFileSync(path.join(ctx.web, 'tests/traces/alpha_level10.json'), 'utf8'));
      const { context, page, errors } = await open(ctx, PHONE, trace.query.replace(/^scene=platform&/, '').replace(/&seed=1&manual=1/, ''));
      const r = await page.evaluate(log => {
        const T = window.__test;
        const c = T.app.view.canvas, k = c.width / 800, g = c.getContext('2d');
        const px = (x, y) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3);
        let white = null, most = 0, minGap = Infinity, at = -1;
        for (let i = 0; i < log.length; i++) {
          T.hold(log[i] ? log[i].split(',') : []);
          T.step(1);
          const p = T.probe('platform');
          if (!white && p.whiteout >= 99) white = { tick: i + 1, score: px(711, 30), heart: px(755, 84), timer: px(390, 28) };
          for (const side of ['left', 'right']) {
            const ys = p.bombHints.filter(h => h.side === side).map(h => h.y).sort((a, b) => a - b);
            if (ys.length > most) { most = ys.length; at = i + 1; }
            for (let j = 1; j < ys.length; j++) minGap = Math.min(minGap, ys[j] - ys[j - 1]);
          }
        }
        return { white, most, minGap, at, ui: T.probe('platform').ui, state: T.probe('platform').state };
      }, trace.log);
      assert(r.state === 'complete', `the level 10 trace did not complete on the phone viewport (${r.state})`);
      assert(r.white, 'no whiteout seen');
      for (const [where, rgb] of Object.entries(r.white)) {
        if (where === 'tick') continue;
        assert(rgb.every(v => v >= 245), `the whiteout does not cover the ${where} at tick ${r.white.tick}: rgb ${rgb}`);
      }
      assert(r.most >= 2, `never more than ${r.most} off-screen bomb badge on one side`);
      assert(r.minGap >= 45, `badges on one side only ${r.minGap} px apart`);
      ctx.log(`whiteout at tick ${r.white.tick}; up to ${r.most} badges on one side (tick ${r.at}), at least ${Math.round(r.minGap)} px apart`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
