// Kitchen game (round 4) end to end, through real inputs only, deterministically (?manual=1 and
// __test.step): a probe-driven bot reads __test.probe('kitchen') and plays with
//   - taps (CDP touch events) on a landscape phone, as Amy, levels 0-3 chained through the
//     scene contract's onComplete, handling sneezes with the tissues and washing its hands after
//     a tissue and after raw meat;
//   - the keyboard alone on a desktop, as Harry (Tab / arrows, Enter / Space, T, C, H);
// and checks the scores, the report and the callback. Other tests: wrong placements score as
// NOTES 5.9 says (with the 11.9 fixes), exact frame-clock timing of seconds and sneezes, drag and
// drop with mouse and touch, tap-target sizes on small phones, and pause.
//
// The expected results come from this file's own reading of the rules (NOTES 5.3 and 5.9), not
// from web/js/kitchen/rules.js, so the game is checked against the spec.
import { drawLevelFood } from '../js/kitchen/rules.js';
import { Rng } from '../js/core/rng.js';

const PHONE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };
const SMALL_PHONE = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const SEEDS = [11, 10, 10, 296];          // per level: seed 10 gives mouldy and burst food in levels 1 and 2
const LEVEL_ITEMS = [10, 10, 10, 20];
const LEVEL_SECONDS = [60, 60, 60, 120];

const probe = page => page.evaluate(() => window.__test.probe('kitchen'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------------------------------------------------------------------------------------------
// The rules as NOTES 5.3 / 5.9 state them (with decisions 11.9 #13 and the 5.13 fixes).
// ---------------------------------------------------------------------------------------------
const TY = { FRUIT: 0, VEG: 1, CUP: 4, CHEESE: 5, DOOR: 6, RAW: 7, COOKED: 9 };
const FOOD = {
  mouldy_bread: [TY.CUP, 'mouldy'], burst_yogurt: [TY.DOOR, 'burst'], carrots: [TY.VEG], tomatoes: [TY.VEG], orange: [TY.FRUIT],
  bananas: [TY.FRUIT], mouldy_orange: [TY.FRUIT, 'mouldy'], yogurt: [TY.DOOR], cheese: [TY.CHEESE], orange_juice: [TY.DOOR],
  red_apple: [TY.FRUIT], raw_lamb: [TY.RAW], raw_chicken: [TY.RAW], raw_sausages: [TY.RAW], raw_steak: [TY.RAW],
  cooked_steak: [TY.COOKED], cooked_lamb: [TY.COOKED], cooked_chicken: [TY.COOKED], green_apple: [TY.FRUIT], pear: [TY.FRUIT],
  milk: [TY.DOOR], soup: [TY.CUP], broccoli: [TY.VEG], bread: [TY.CUP], spring_onion: [TY.VEG],
};
const HOME = { [TY.FRUIT]: 'bowl', [TY.VEG]: 'fridgeDrawer', [TY.CUP]: 'cupboard', [TY.CHEESE]: 'fridgeUpper', [TY.DOOR]: 'fridgeDoor', [TY.RAW]: 'fridgeLower', [TY.COOKED]: 'fridgeMid' };
const REMINDER = { [TY.FRUIT]: 'fruitLocation', [TY.VEG]: 'vegetablesLocation', [TY.CUP]: 'cupboardItemsLocation', [TY.CHEESE]: 'cheeseLocation', [TY.DOOR]: 'liquidsLocation', [TY.RAW]: 'rawMeatLocation', [TY.COOKED]: 'cookedMeatLocation' };
const LOCS = ['cupboard', 'bowl', 'fridgeUpper', 'fridgeMid', 'fridgeLower', 'fridgeDrawer', 'fridgeDoor', 'bin'];
const ROW_TYPES = [TY.FRUIT, TY.VEG, TY.CUP, TY.CHEESE, TY.RAW, TY.COOKED, TY.DOOR];
const isBad = asset => FOOD[asset].length > 1;
const homeOf = asset => (isBad(asset) ? 'bin' : HOME[FOOD[asset][0]]);

// One placement: 'correct' | 'incorrect' | 'neutral', and the reminder it raises.
function expectVerdict({ asset, loc, clingfilm }) {
  const [type, bad] = FOOD[asset];
  if (loc === 'bin') return bad ? ['neutral', null] : ['incorrect', REMINDER[type]];
  if (bad === 'mouldy') return ['incorrect', 'badFood'];
  if (bad === 'burst') return ['incorrect', 'burstContainer'];
  const shelf = loc === 'fridgeUpper' || loc === 'fridgeMid';
  if (type === TY.RAW && loc === 'fridgeLower') return clingfilm ? ['correct', null] : ['incorrect', 'clingfilm'];
  if (type === TY.COOKED && shelf) return clingfilm ? ['correct', null] : ['incorrect', 'clingfilm'];
  if (type === TY.CHEESE && shelf) return ['correct', null];
  if (HOME[type] === loc) return ['correct', null];
  return ['incorrect', REMINDER[type]];
}

// The level summary: rows, notes in calculateScores() order (locations 0-7, placement order,
// hygiene before location; each note once), and points = 10 x (correct - incorrect).
function expectSummary(placements) {
  const rows = Object.fromEntries(ROW_TYPES.map(t => [t, { correct: 0, incorrect: 0 }]));
  const notes = [];
  const add = n => { if (n && !notes.includes(n)) notes.push(n); };
  for (const loc of LOCS) {
    for (const p of placements.filter(x => x.loc === loc)) {
      if (p.sneeze) add('sneeze');
      if (p.meatHands && loc !== 'bin') add('rawMeatHands');
      const [v, note] = expectVerdict(p);
      if (v !== 'neutral') rows[FOOD[p.asset][0]][v]++;
      add(note);
    }
  }
  const correct = ROW_TYPES.reduce((n, t) => n + rows[t].correct, 0);
  const incorrect = ROW_TYPES.reduce((n, t) => n + rows[t].incorrect, 0);
  return { rows: ROW_TYPES.map(t => rows[t]), notes, points: 10 * (correct - incorrect) };
}

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------
async function openKitchen(ctx, opts, query = '') {
  const { context, page, errors } = await ctx.openPage(opts);
  await page.goto(`${ctx.baseUrl}/index.html?scene=kitchen&level=0&seed=1&manual=1${query}`);
  await page.waitForFunction(() => window.__test && window.__test.probe('kitchen') && window.__test.probe('kitchen').ready, null, { timeout: 20000 });
  assert(await page.evaluate(() => window.__test.tick) === 0, 'the loop ticked before the test took over');
  return { context, page, errors };
}

// Starts kitchen levels from..3 through the scene contract, as the flow does: each level's
// onComplete records the result and opens the next level with the new running score.
async function chainLevels(page, { avatar, from = 0, to = 3, score = 0, seeds = SEEDS }) {
  await page.evaluate(({ avatar, from, to, score, seeds }) => {
    window.__kitchen = { results: [], quits: 0 };
    const go = (level, total) => window.__test.go('kitchen', {
      level, avatar, score: total, seed: seeds[level],
      onComplete: r => { window.__kitchen.results.push(r); if (level < to) go(level + 1, r.score); else window.__kitchen.done = true; },
      onQuit: () => { window.__kitchen.quits++; },
    });
    go(from, score);
  }, { avatar, from, to, score, seeds });
}

async function waitLevel(page, level) {
  await page.waitForFunction(l => { const p = window.__test.probe('kitchen'); return p && p.ready && p.level === l && p.mode === 'intro'; }, level, { timeout: 20000 });
}

async function tap(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function centreOf(page, sel) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} is not visible`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
}

// Input drivers: the same bot plays through taps or the keyboard.
function touchDriver(page, cdp) {
  return {
    name: 'touch',
    async target(id) { const c = await centreOf(page, `#kz-${id}`); await tap(cdp, c.x, c.y); await step(page, 2); },
    async next() { const c = await centreOf(page, '#kz-next'); await tap(cdp, c.x, c.y); await step(page, 2); },
    async tissues() { await this.target('tissues'); },
    async clingfilm() { await this.target('clingfilm'); },
    async wash() { await this.target('sink'); },
  };
}

function keyboardDriver(page) {
  const press = async k => { await page.keyboard.press(k); await step(page, 1); };
  const focusOn = async id => {
    let p = await probe(page);
    for (let i = 0; i < 16 && p.focus !== id; i++) { await press('Tab'); p = await probe(page); }
    assert(p.focus === id, `could not Tab to ${id} (focus ${p.focus})`);
  };
  let n = 0;
  return {
    name: 'keyboard',
    // Alternates the two keyboard styles: lift the item (Enter), Tab to the place, Space to put it
    // away; or Tab straight to the place and Enter.
    async target(id) {
      const p = await probe(page);
      if (p.mode === 'play' && p.current && (n++ % 2 === 0) && !p.held) {
        await focusOn('item');
        await press('Enter');
        assert((await probe(page)).held, 'Enter on the item did not pick it up');
        await focusOn(id);
        await press('Space');
      } else {
        await focusOn(id);
        await press('Enter');
      }
      await step(page, 1);
    },
    async next() { await press('Enter'); await step(page, 1); },
    async tissues() { await press('KeyT'); },
    async clingfilm() { await press('KeyC'); },
    async wash() { await press('KeyH'); },
  };
}

// Plays one level to the end of its outro with every item put away correctly. Returns what the
// bot saw.
async function playLevelCorrectly(page, drv, level, { waitForSneeze = level > 0 } = {}) {
  const seen = { sneezes: 0, tissues: 0, washes: 0, wrongPage: false, clingfilms: 0, startTime: null };
  let p = await probe(page);
  // Intro screens (and the level 0 tutorial: one wrong answer, then the drawer).
  for (let i = 0; i < 20 && p.mode === 'intro'; i++) {
    if (p.intro && p.intro.page === 'right') { await drv.next(); p = await probe(page); break; }
    await drv.next();
    p = await probe(page);
    if (p.mode === 'tutorial') {
      if (!seen.wrongPage) {
        await drv.target('bin');
        p = await probe(page);
        assert(p.mode === 'intro' && p.intro.page === 'wrong', `tutorial: the bin should be wrong (mode ${p.mode}, page ${p.intro && p.intro.page})`);
        seen.wrongPage = true;
        continue;
      }
      await drv.target('fridgeDrawer');
      p = await probe(page);
      assert(p.mode === 'intro' && p.intro.page === 'right', 'tutorial: the drawer should be right');
    }
  }
  assert(p.mode === 'play', `level ${level} did not start (mode ${p.mode})`);
  seen.startTime = p.timeLeft;
  let idle = 0;
  for (let guard = 0; guard < 4000 && p.mode === 'play'; guard++) {
    if (p.state === 'sneeze') {
      seen.sneezes++;
      await drv.tissues();
      p = await probe(page);
      assert(p.state === 'wait' && p.hands.sneeze, `tissues did not catch the sneeze (state ${p.state})`);
      seen.tissues++;
      continue;
    }
    if (p.state === 'wash' || p.state === 'end') { await step(page, 4); p = await probe(page); continue; }
    if (p.hands.sneeze || p.hands.meat) {
      await drv.wash();
      seen.washes++;
      p = await probe(page);
      assert(p.state === 'wash', `the sink did not start washing (state ${p.state})`);
      continue;
    }
    if (!p.current) { await step(page, 2); p = await probe(page); continue; }
    // Idle (up to 40 s) so each sneezing level shows at least one sneeze.
    if (waitForSneeze && seen.sneezes === 0 && idle < 40 * 67) { await step(page, 20); idle += 20; p = await probe(page); continue; }
    const type = FOOD[p.current.asset][0];
    if ((type === TY.RAW || type === TY.COOKED) && !p.current.clingfilm) {
      await drv.clingfilm();
      seen.clingfilms++;
      p = await probe(page);
      continue;
    }
    const before = p.placements.length;
    await drv.target(homeOf(p.current.asset));
    p = await probe(page);
    if (p.placements.length === before && p.state === 'wait') throw new Error(`placing ${p.current && p.current.asset} did nothing`);
  }
  assert(p.mode === 'play' || p.mode === 'outro', `unexpected mode ${p.mode}`);
  // The outro follows at the next one-second tick.
  const n = await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 200));
  assert(n >= 0, 'no outro after the level ended');
  p = await probe(page);
  return { seen, probe: p };
}

async function readOutroRows(page) {
  return page.evaluate(() => [...document.querySelectorAll('.kz-row')].map(r => [...r.querySelectorAll('span')].map(s => s.textContent)));
}

async function finishOutro(page, drv, expected) {
  let p = await probe(page);
  assert(p.mode === 'outro' && p.outro.page === 0, 'outro page 1 not shown');
  const rows1 = await readOutroRows(page);
  assert(rows1.length === 7, `page 1 has ${rows1.length} rows`);
  rows1.forEach((r, i) => assert(r[2] === String(expected.rows[i].correct) && r[4] === String(expected.rows[i].correct * 10), `page 1 row ${i}: ${r.join(' ')}`));
  await drv.next();
  const rows2 = await readOutroRows(page);
  rows2.forEach((r, i) => assert(r[2] === String(expected.rows[i].incorrect) && r[4] === `- ${expected.rows[i].incorrect * 10}`, `page 2 row ${i}: ${r.join(' ')}`));
  await drv.next();
  const notes = await page.evaluate(() => [...document.querySelectorAll('.kz-notes p:not(.none)')].length);
  assert(notes === expected.notes.length, `page 3 shows ${notes} notes, expected ${expected.notes.length}`);
  await drv.next();
  p = await probe(page);
  assert(p.outro.page === 3, 'points page not shown');
  await drv.next();
}

// Full four-level journey with one input device.
async function journey(ctx, opts, avatar, makeDriver) {
  const { context, page, errors } = await openKitchen(ctx, opts, `&avatar=${avatar}`);
  const cdp = opts.hasTouch ? await context.newCDPSession(page) : null;
  if (!opts.hasTouch) await page.mouse.click(5, 5);   // focus the page (keyboard mode)
  const drv = makeDriver(page, cdp);
  await chainLevels(page, { avatar });
  let total = 0;
  for (let level = 0; level <= 3; level++) {
    await waitLevel(page, level);
    const items = (await probe(page)).items;
    assert(items.length === LEVEL_ITEMS[level], `level ${level} has ${items.length} items`);
    assert((await probe(page)).avatar === avatar, 'wrong avatar');
    const { seen, probe: p } = await playLevelCorrectly(page, drv, level);
    assert(seen.startTime === LEVEL_SECONDS[level], `level ${level} started with ${seen.startTime} s`);
    if (level > 0) assert(seen.sneezes >= 1 && seen.tissues === seen.sneezes, `level ${level}: sneezes ${seen.sneezes}, tissues ${seen.tissues}`);
    if (level === 0) assert(seen.wrongPage, 'the tutorial wrong page was not seen');
    const rawMeat = p.placements.filter(x => FOOD[x.asset][0] === TY.RAW).length;
    assert(seen.washes >= seen.tissues + (rawMeat ? 1 : 0), `level ${level}: washes ${seen.washes}`);
    assert(p.placements.length === items.length, `placed ${p.placements.length} of ${items.length}`);
    for (const x of p.placements) {
      assert(x.loc === homeOf(x.asset), `${x.asset} went to ${x.loc}`);
      assert(!x.sneeze && !x.meatHands, `${x.asset} carries microbes (sneeze ${x.sneeze}, meat ${x.meatHands})`);
    }
    const expected = expectSummary(p.placements);
    assert(expected.notes.length === 0, `expected no notes, got ${expected.notes}`);
    assert(p.outro.points === expected.points, `level ${level}: points ${p.outro.points}, expected ${expected.points}`);
    assert(JSON.stringify(p.outro.notes) === '[]', `notes ${p.outro.notes}`);
    await finishOutro(page, drv, expected);
    await page.waitForFunction(n => window.__kitchen.results.length === n, level + 1, { timeout: 5000 });
    const r = await page.evaluate(i => window.__kitchen.results[i], level);
    const good = items.filter(a => !isBad(a)).length;
    assert(r.level === level, `result level ${r.level}`);
    assert(r.points === 10 * good, `level ${level}: result points ${r.points}, expected ${10 * good}`);
    assert(r.score === total + r.points, `level ${level}: result score ${r.score}, expected ${total + r.points}`);
    assert(Array.isArray(r.report) && r.report.length === items.length, 'report length');
    for (const e of r.report) {
      assert(isBad(e.item) ? e.ok === null && e.location === 'bin' : e.ok === true, `report entry ${JSON.stringify(e)}`);
      assert(e.reason === null && e.hygiene.length === 0, `report reason ${JSON.stringify(e)}`);
    }
    total = r.score;
    ctx.log(`${drv.name} level ${level}: ${r.points} points (score ${r.score}), sneezes ${seen.sneezes}, washes ${seen.washes}, cling film ${seen.clingfilms}`);
  }
  assert(await page.evaluate(() => window.__kitchen.done === true), 'the last onComplete did not run');
  const last = await page.evaluate(() => window.__test.lastDevice);
  assert(last === (opts.hasTouch ? 'touch' : 'keyboard'), `input device ${last}`);
  assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
  await context.close();
  return total;
}

export const tests = [
  {
    name: 'food draw follows Math.round weights (NOTES 5.2, 5.3)',
    async run() {
      // Evenly spaced "random" values give the exact weights: category = Math.round(v * 6) at
      // level 3 gives the two end categories half the weight of the others.
      const CAT = { [TY.VEG]: 0, [TY.DOOR]: 1, [TY.FRUIT]: 2, [TY.CUP]: 3, [TY.RAW]: 4, [TY.CHEESE]: 5, [TY.COOKED]: 6 };
      const N = 1200, counts = new Array(7).fill(0);
      const names = Object.keys(FOOD);
      const assetOf = i => ['mouldy_bread', 'burst_yogurt', 'carrots', 'tomatoes', 'orange', 'bananas', 'mouldy_orange', 'yogurt', 'cheese', 'orange_juice', 'red_apple', 'raw_lamb', 'raw_chicken', 'raw_sausages', 'raw_steak', 'cooked_steak', 'cooked_lamb', 'cooked_chicken', 'green_apple', 'pear', 'milk', 'soup', 'orange_juice', 'broccoli', 'bread', 'spring_onion'][i];
      for (let k = 0; k < N; k++) {
        const vals = [(k + 0.5) / N, 0.5];
        let j = 0;
        const [food] = drawLevelFood(2, { next: () => vals[j++ % 2] });
        assert(names.includes(assetOf(food)), `unknown food ${food}`);
        counts[CAT[FOOD[assetOf(food)][0]]]++;
      }
      assert(JSON.stringify(counts) === JSON.stringify([100, 200, 200, 200, 200, 200, 100]), `category weights ${counts}`);
      // Within a category: Math.round(v * (len - 1)) over the 4 vegetables gives 1/6, 1/3, 1/3, 1/6.
      const veg = [0, 0, 0, 0];
      for (let k = 0; k < N; k++) {
        const vals = [0.01, (k + 0.5) / N];
        let j = 0;
        const [food] = drawLevelFood(0, { next: () => vals[j++ % 2] });
        veg[['carrots', 'tomatoes', 'broccoli', 'spring_onion'].indexOf(assetOf(food))]++;
      }
      assert(JSON.stringify(veg) === JSON.stringify([200, 400, 400, 200]), `vegetable weights ${veg}`);
      assert(drawLevelFood(3, new Rng(296)).length === 20 && drawLevelFood(1, new Rng(1)).length === 10, 'item counts 10 / 20');
    },
  },
  {
    name: 'touch: Amy puts away all four levels with taps (tissues, cling film, washing), onComplete chain',
    timeoutMs: 240000,
    async run(ctx) {
      const total = await journey(ctx, PHONE, 'amy', (page, cdp) => touchDriver(page, cdp));
      ctx.log(`touch journey kitchen total ${total}`);
    },
  },
  {
    name: 'keyboard: Harry puts away all four levels with Tab / Enter / Space and T, C, H',
    timeoutMs: 240000,
    async run(ctx) {
      const total = await journey(ctx, DESKTOP, 'harry', page => keyboardDriver(page));
      ctx.log(`keyboard journey kitchen total ${total}`);
    },
  },
  {
    name: 'wrong placements score 10 x (correct - incorrect) with the NOTES reminders',
    timeoutMs: 120000,
    async run(ctx) {
      const { context, page, errors } = await openKitchen(ctx, DESKTOP, '&avatar=harry');
      await page.mouse.click(5, 5);
      const drv = keyboardDriver(page);
      await chainLevels(page, { avatar: 'harry', from: 3, to: 3, score: 250, seeds: [0, 0, 0, 185] });
      await waitLevel(page, 3);
      let p = await probe(page);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await drv.next(); p = await probe(page); }
      assert(p.mode === 'play' && p.timeLeft === 120, `level 4 should give 120 s (got ${p.timeLeft})`);
      // Policy (seed 185: cheese first, three raw and four cooked meats, two mouldy oranges, a
      // burst yogurt): the first item to the bin; the first raw and the first cooked meat
      // uncovered; both mouldy oranges in the bowl (the original repeated "Bad Food" there); the
      // burst yogurt in the bowl (the original gave the liquids reminder); a second cheese in the
      // bowl; one sneeze allowed to land on the food; no hand washing until item 12.
      const used = new Set();
      const once = k => (used.has(k) ? false : (used.add(k), true));
      let sneezedOnFood = false;
      for (let guard = 0; guard < 3000 && p.mode === 'play'; guard++) {
        if (p.state === 'sneeze') {
          if (!sneezedOnFood) {
            sneezedOnFood = true;
            await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state !== 'sneeze', 400));
            p = await probe(page);
            assert(p.current.sneeze && p.current.sneezeFrom === 'food' && p.hands.sneeze && p.avatarLabel === 'sneeze_food_end', 'the sneeze did not land on the food');
          } else { await drv.tissues(); p = await probe(page); }
          continue;
        }
        if (p.state !== 'wait' || !p.current) { await step(page, 3); p = await probe(page); continue; }
        if (p.placements.length === 12 && (p.hands.meat || p.hands.sneeze)) { await drv.wash(); p = await probe(page); continue; }
        if (!sneezedOnFood && p.placements.length === 3) { await step(page, 20); p = await probe(page); continue; }
        const a = p.current.asset, type = FOOD[a][0];
        let loc = homeOf(a);
        if (p.placements.length === 0) loc = 'bin';
        else if (a === 'mouldy_orange' || a === 'burst_yogurt') loc = 'bowl';
        else if (type === TY.CHEESE && once('cheese')) loc = 'bowl';
        const cover = (type === TY.RAW && !once('raw')) || (type === TY.COOKED && !once('cooked'));
        if (cover && !p.current.clingfilm) { await drv.clingfilm(); p = await probe(page); continue; }
        await drv.target(loc);
        p = await probe(page);
      }
      await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 200));
      p = await probe(page);
      assert(p.mode === 'outro', `no outro (mode ${p.mode})`);
      const expected = expectSummary(p.placements);
      const got = p.outro;
      assert(got.points === expected.points, `points ${got.points}, expected ${expected.points}`);
      assert(JSON.stringify(got.rows.map(r => [r.correct, r.incorrect])) === JSON.stringify(expected.rows.map(r => [r.correct, r.incorrect])), `rows ${JSON.stringify(got.rows)} vs ${JSON.stringify(expected.rows)}`);
      assert(JSON.stringify(got.notes) === JSON.stringify(expected.notes), `notes ${got.notes} vs ${expected.notes}`);
      for (const k of ['sneeze', 'clingfilm', 'badFood', 'burstContainer', 'rawMeatHands', 'cheeseLocation']) assert(got.notes.includes(k), `missing note ${k}: ${got.notes}`);
      assert(got.notes.filter(k => k === 'badFood').length === 1, '"Bad Food" should appear once (the BOWL case repeated in the original)');
      assert(!got.notes.includes('liquidsLocation'), 'a burst yogurt out of place must give "Burst Container", not the liquids reminder');
      assert(p.placements.filter(x => x.asset === 'mouldy_orange' && x.loc === 'bowl').length === 2, 'both mouldy oranges should be in the bowl');
      assert(got.notes.length > 4, `expected more than four reminders (the original's four slots), got ${got.notes.length}`);
      assert(p.placements.some(x => x.meatHands), 'no item picked up raw-meat microbes from unwashed hands');
      // The reminders are all listed on page 3, and the result carries the points and report.
      await finishOutro(page, drv, expected);
      await page.waitForFunction(() => window.__kitchen.results.length === 1, null, { timeout: 5000 });
      const r = await page.evaluate(() => window.__kitchen.results[0]);
      assert(r.points === expected.points && r.score === 250 + expected.points, `result ${r.points} / ${r.score}`);
      const wrong = r.report.filter(e => e.ok === false);
      assert(wrong.length === expected.rows.reduce((n, x) => n + x.incorrect, 0), 'report wrong count');
      assert(wrong.every(e => e.reason), 'every wrong report entry has a reason');
      ctx.log(`wrong placements: ${expected.points} points, notes ${got.notes.join(', ')}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'timing: 1 s = 25 frames = 66.7 ticks, clock ends at 0; pause freezes the clock',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await openKitchen(ctx, DESKTOP, '&avatar=harry');
      await page.mouse.click(5, 5);
      await chainLevels(page, { avatar: 'harry', from: 1, to: 1, seeds: [0, 5, 0, 0] });
      await waitLevel(page, 1);
      let p = await probe(page);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await page.keyboard.press('Enter'); await step(page, 1); p = await probe(page); }
      assert(p.mode === 'play' && p.playTicks <= 1 && p.timeLeft === 60, `play start: ${p.mode} ${p.playTicks} ${p.timeLeft}`);
      await step(page, 66 - p.playTicks);
      p = await probe(page);
      assert(p.timeLeft === 60 && p.frame === 24, `after 66 ticks: ${p.timeLeft} s, frame ${p.frame}`);
      await step(page, 1);
      p = await probe(page);
      assert(p.timeLeft === 59 && p.frame === 25, `after 67 ticks: ${p.timeLeft} s, frame ${p.frame}`);
      // Pause: nothing moves.
      await page.keyboard.press('Escape');
      await step(page, 2);
      p = await probe(page);
      assert(p.mode === 'paused', 'Escape did not pause');
      const frozen = p.playTicks;
      await step(page, 300);
      p = await probe(page);
      assert(p.playTicks === frozen && p.timeLeft === 59, 'the clock ran while paused');
      await page.keyboard.press('Escape');
      await step(page, 2);
      p = await probe(page);
      assert(p.mode === 'play', 'Escape did not resume');
      // A sneeze: rolled once a second, then a window of exactly 50 frames (2 s) for the tissues;
      // missed, it lands on the food (KitchenGame.as:545-611).
      let n = await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state === 'sneeze', 4000));
      assert(n >= 0, 'no sneeze');
      p = await probe(page);
      const f0 = p.frame;
      assert(f0 % 25 === 0 && p.sneezeFramesLeft === 50 && p.avatarLabel === 'sneeze_Start', `sneeze start: frame ${f0}, left ${p.sneezeFramesLeft}, ${p.avatarLabel}`);
      await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state !== 'sneeze', 400));
      p = await probe(page);
      assert(p.frame - f0 === 50 && p.state === 'wait', `the sneeze window lasted ${p.frame - f0} frames (state ${p.state})`);
      assert(p.current.sneeze && p.hands.sneeze && p.avatarLabel === 'sneeze_food_end', 'the missed sneeze did not land on the food and the hands');
      // Washing: wash_hands runs 36 frames, then the next second clears the hands.
      await page.keyboard.press('KeyH');
      await step(page, 1);
      p = await probe(page);
      const w0 = p.frame;
      assert(p.state === 'wash' && p.midAnimation, 'H did not start washing');
      await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state !== 'wash', 400));
      p = await probe(page);
      assert(p.frame - w0 >= 35 && p.frame - w0 <= 61 && p.frame % 25 === 0 && !p.hands.sneeze, `washing took ${p.frame - w0} frames`);
      // Let the time run out, answering sneezes with the tissues: 60 s = 4000 ticks in all, then
      // the outro one second later. The clock shows 0 (the original showed 99).
      for (let i = 0; i < 80 && p.mode === 'play'; i++) {
        if (p.state === 'sneeze') { await page.keyboard.press('KeyT'); }
        await step(page, 60);
        p = await probe(page);
        if (p.state === 'end') break;
      }
      assert(p.state === 'end' && p.timeLeft === 0 && p.endReason === 'time', `time-out: state ${p.state}, clock ${p.timeLeft}`);
      assert(p.playTicks >= 4066 && p.playTicks <= 4140, `time ran out after ${p.playTicks} ticks`);
      n = await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 100));
      assert(n > 0 && n <= 68, `outro ${n} ticks after the time-out`);
      p = await probe(page);
      assert(p.outro.points === 0 && p.placements.length === 0, 'unplaced items cost nothing');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'drag and drop with the mouse and with a finger',
    timeoutMs: 90000,
    async run(ctx) {
      for (const opts of [DESKTOP, PHONE]) {
        const { context, page, errors } = await openKitchen(ctx, opts, '&avatar=amy');
        const cdp = opts.hasTouch ? await context.newCDPSession(page) : null;
        await chainLevels(page, { avatar: 'amy', from: 2, to: 2, seeds: [0, 0, 10, 0] });
        await waitLevel(page, 2);
        let p = await probe(page);
        const drv = opts.hasTouch ? touchDriver(page, cdp) : keyboardDriver(page);
        for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await drv.next(); p = await probe(page); }
        assert(p.mode === 'play', 'not playing');
        for (let k = 0; k < 2; k++) {
          const want = homeOf(p.current.asset);
          const from = await centreOf(page, '#kz-item');
          const to = await centreOf(page, `#kz-${want}`);
          const path = Array.from({ length: 8 }, (_, i) => ({ x: from.x + (to.x - from.x) * (i + 1) / 8, y: from.y + (to.y - from.y) * (i + 1) / 8 }));
          if (cdp) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 2 }] });
            for (const q of path) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x, y: q.y, id: 2 }] });
            await step(page, 1);
            p = await probe(page);
            assert(p.dragging && p.held, 'a finger drag did not pick the item up');
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } else {
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            for (const q of path) await page.mouse.move(q.x, q.y);
            await step(page, 1);
            p = await probe(page);
            assert(p.dragging && p.held, 'a mouse drag did not pick the item up');
            await page.mouse.up();
          }
          await step(page, 2);
          p = await probe(page);
          assert(p.placements.length === k + 1 && p.placements[k].loc === want, `drop ${k}: ${JSON.stringify(p.placements)}`);
          // Cooked or raw meat: dropped uncovered, so it counts as wrong; everything else right.
          const type = FOOD[p.placements[k].asset][0];
          const expectVerdictNow = (type === TY.RAW || type === TY.COOKED) ? 'incorrect' : (isBad(p.placements[k].asset) ? 'neutral' : 'correct');
          assert(p.placements[k].verdict === expectVerdictNow, `drop ${k} verdict ${p.placements[k].verdict}`);
          if (p.hands.meat || p.hands.sneeze || p.state !== 'wait') {
            await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').state === 'wait', 400));
            p = await probe(page);
          }
        }
        // A drop outside every place puts the item back on the counter.
        const from = await centreOf(page, '#kz-item');
        if (cdp) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 3 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + 20, y: from.y + 120, id: 3 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(from.x, from.y); await page.mouse.down();
          await page.mouse.move(from.x + 20, from.y + 60); await page.mouse.move(from.x + 20, from.y + 120);
          await page.mouse.up();
        }
        await step(page, 2);
        p = await probe(page);
        assert(p.placements.length === 2 && !p.held && !p.dragging, 'a drop on the floor should put the item back');
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
  {
    name: 'tap targets are at least 44 CSS px on small phones; the pause button pauses',
    timeoutMs: 90000,
    async run(ctx) {
      for (const opts of [PHONE, SMALL_PHONE]) {
        const { context, page, errors } = await openKitchen(ctx, opts, '&avatar=harry&level=1&seed=4');
        const cdp = await context.newCDPSession(page);
        const drv = touchDriver(page, cdp);
        let p = await probe(page);
        const next = await centreOf(page, '#kz-next');
        assert(next.w >= 44 && next.h >= 44, `Next button ${next.w} x ${next.h}`);
        for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await drv.next(); p = await probe(page); }
        assert(p.mode === 'play', 'not playing');
        for (const id of Object.keys(p.targets)) {
          const b = await page.locator(`#kz-${id}`).boundingBox();
          assert(b && b.width >= 44 && b.height >= 44, `${id} is ${b && b.width.toFixed(1)} x ${b && b.height.toFixed(1)} CSS px at ${opts.viewport.width}x${opts.viewport.height}`);
        }
        const pauseBtn = await centreOf(page, '#touch-pause');
        assert(pauseBtn.w >= 44, 'touch pause button too small');
        await tap(cdp, pauseBtn.x, pauseBtn.y);
        await step(page, 2);
        p = await probe(page);
        assert(p.mode === 'paused', `the pause button did not pause (${p.mode})`);
        const resume = await centreOf(page, '#kz-resume');
        await tap(cdp, resume.x, resume.y);
        await step(page, 2);
        p = await probe(page);
        assert(p.mode === 'play', 'Resume did not resume');
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        await context.close();
      }
    },
  },
  {
    name: 'standalone ?scene=kitchen carries on to the next level and keyboard arrows move between places',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await openKitchen(ctx, DESKTOP, '&avatar=amy&level=2&seed=10');
      await page.mouse.click(5, 5);
      let p = await probe(page);
      for (let i = 0; i < 6 && p.mode === 'intro'; i++) { await page.keyboard.press('Enter'); await step(page, 1); p = await probe(page); }
      assert(p.mode === 'play' && p.focus === 'item', `play with the focus on the item (focus ${p.focus})`);
      const key = async k => { await page.keyboard.press(k); await step(page, 2); return (await probe(page)).focus; };
      assert(await key('ArrowRight') === 'clingfilm', 'ArrowRight from the item should reach the cling film');
      assert(await key('ArrowRight') === 'sink', 'ArrowRight from the cling film should reach the sink');
      assert(await key('ArrowUp') === 'bowl', 'ArrowUp from the sink should reach the fruit bowl');
      assert(await key('ArrowRight') !== 'bowl', 'ArrowRight from the bowl should move into the fridge');
      // Play the level out quickly (all to the bin), then page through the outro with Enter.
      const drv = keyboardDriver(page);
      for (let guard = 0; guard < 400 && p.mode === 'play'; guard++) {
        if (p.state === 'sneeze') { await drv.tissues(); p = await probe(page); continue; }
        if (p.state !== 'wait' || !p.current) { await step(page, 3); p = await probe(page); continue; }
        await drv.target('bin');
        p = await probe(page);
      }
      await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 200));
      for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await step(page, 2); }
      p = await probe(page);
      assert(p.level === 3 && p.mode === 'intro', `standalone should carry on to level 3 (level ${p.level}, mode ${p.mode})`);
      assert(p.score === p.result.score && p.result.points < 0, `running score ${p.score}, result ${JSON.stringify(p.result && p.result.points)}`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
