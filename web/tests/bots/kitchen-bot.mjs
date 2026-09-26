// A kitchen bot (round 4's food hygiene game, web/js/kitchen/) for the end-to-end tests. It reads
// only __test.probe('kitchen') and plays through real inputs: CDP touch taps on the scene's targets
// (touchDriver) or the keyboard alone (keyboardDriver: Tab / Enter / Space and the tool keys
// T, C, H). playLevelCorrectly() puts every item where it belongs: cling film on raw and cooked
// meat, tissues when the child sneezes, a hand wash after a tissue or raw meat, mouldy or burst
// food in the bin; it also answers the level 0 tutorial (one wrong place, then the drawer).
//
// The food table is the test suite's own reading of the rules (NOTES 5.3 and 5.9), not
// web/js/kitchen/rules.js, so the game is checked against the spec. Used by
// web/tests/kitchen.spec.mjs and web/tests/journey.spec.mjs.
const probe = page => page.evaluate(() => window.__test.probe('kitchen'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

export const TY = { FRUIT: 0, VEG: 1, CUP: 4, CHEESE: 5, DOOR: 6, RAW: 7, COOKED: 9 };
export const FOOD = {
  mouldy_bread: [TY.CUP, 'mouldy'], burst_yogurt: [TY.DOOR, 'burst'], carrots: [TY.VEG], tomatoes: [TY.VEG], orange: [TY.FRUIT],
  bananas: [TY.FRUIT], mouldy_orange: [TY.FRUIT, 'mouldy'], yogurt: [TY.DOOR], cheese: [TY.CHEESE], orange_juice: [TY.DOOR],
  red_apple: [TY.FRUIT], raw_lamb: [TY.RAW], raw_chicken: [TY.RAW], raw_sausages: [TY.RAW], raw_steak: [TY.RAW],
  cooked_steak: [TY.COOKED], cooked_lamb: [TY.COOKED], cooked_chicken: [TY.COOKED], green_apple: [TY.FRUIT], pear: [TY.FRUIT],
  milk: [TY.DOOR], soup: [TY.CUP], broccoli: [TY.VEG], bread: [TY.CUP], spring_onion: [TY.VEG],
};
export const HOME = { [TY.FRUIT]: 'bowl', [TY.VEG]: 'fridgeDrawer', [TY.CUP]: 'cupboard', [TY.CHEESE]: 'fridgeUpper', [TY.DOOR]: 'fridgeDoor', [TY.RAW]: 'fridgeLower', [TY.COOKED]: 'fridgeMid' };
export const isBad = asset => FOOD[asset].length > 1;
export const homeOf = asset => (isBad(asset) ? 'bin' : HOME[FOOD[asset][0]]);

export async function tap(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function centreOf(page, sel) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} is not visible`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
}

// Input drivers: the same bot plays through taps or the keyboard.
export function touchDriver(page, cdp) {
  return {
    name: 'touch',
    async target(id) { const c = await centreOf(page, `#kz-${id}`); await tap(cdp, c.x, c.y); await step(page, 2); },
    async next() { const c = await centreOf(page, '#kz-next'); await tap(cdp, c.x, c.y); await step(page, 2); },
    async tissues() { await this.target('tissues'); },
    async clingfilm() { await this.target('clingfilm'); },
    async wash() { await this.target('sink'); },
  };
}

export function keyboardDriver(page) {
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
    // away; or Tab straight to the place and Enter. Tabbing takes a tick per press, so the child
    // may start to sneeze meanwhile; then any place but the tissues would make the sneeze land on
    // the food (KitchenGame.as), so the press is held back and the caller answers the sneeze.
    async target(id) {
      const p = await probe(page);
      const play = p.mode === 'play';
      const sneezing = async () => play && id !== 'tissues' && (await probe(page)).state === 'sneeze';
      if (play && p.current && (n++ % 2 === 0) && !p.held) {
        await focusOn('item');
        if (await sneezing()) return;
        await press('Enter');
        const q = await probe(page);
        if (!q.held && q.state === 'sneeze') return;   // the sneeze made the child drop it
        assert(q.held, 'Enter on the item did not pick it up');
        await focusOn(id);
        if (await sneezing()) return;
        await press('Space');
      } else {
        await focusOn(id);
        if (await sneezing()) return;
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
export async function playLevelCorrectly(page, drv, level, { waitForSneeze = level > 0 } = {}) {
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
    if (p.placements.length === before && p.state === 'wait') throw new Error(`level ${level}: placing ${p.current && p.current.asset} (${drv.name}) did nothing: ${JSON.stringify({ mode: p.mode, state: p.state, focus: p.focus, held: p.held, current: p.current, hands: p.hands, placed: before, timeLeft: p.timeLeft })}`);
  }
  assert(p.mode === 'play' || p.mode === 'outro', `unexpected mode ${p.mode}`);
  // The outro follows at the next one-second tick.
  const n = await page.evaluate(() => window.__test.stepUntil(t => t.probe('kitchen').mode === 'outro', 200));
  assert(n >= 0, 'no outro after the level ended');
  p = await probe(page);
  return { seen, probe: p };
}

