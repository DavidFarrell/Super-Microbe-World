// The full journey, start to finish, through real inputs only (no ?scene=, no __test.go, no flow
// calls): a first visit (the language chooser comes up) -> splash -> New Game -> cutscene (host
// lines, avatar choice, nickname form) -> for each of the 5 rounds: the shrinking zone -> the
// round's platform levels (completed by the planning bot, web/tests/bots/planner.mjs) or the four
// kitchen levels (the kitchen bot, web/tests/bots/kitchen-bot.mjs) -> the round's quiz, answered
// by tapping or with keys -> the ending with the scores. It runs twice:
//   (a) phone: Playwright mobile emulation (isMobile, hasTouch, 915 x 412 landscape, Pixel 7), as
//       Harry. Every input is a CDP touch event: taps on the menus, the talkies, the cutscene, the
//       quiz buttons, the kitchen's targets, and every step of every platform level on the
//       on-screen controls (d-pad, jump, camera, throw; several fingers at once). The only keys
//       are the phone's soft keyboard in the nickname box (Backspace / Delete, and text entered
//       with keyboard.insertText, which sends no key events), which the game ignores as a device
//       switch because they go to a text field;
//   (b) desktop 1280 x 720, as Amy, with the keyboard alone (no mouse at all).
// The engine is stepped by hand (?manual=1) and the journey seed is fixed (?seed=), so the kitchen
// food, the sneezes and the other player's answers are the same every run. The planning bot plays
// the platform levels from the probe's step count and a shadow copy of the simulation fed with
// exactly the inputs it sends; after each level it must report no desync, which proves the page
// saw those inputs step for step. Checked along the way: the scene order (from the scene
// manager's change events), each launch's level, avatar and running score, no console errors or
// failed requests at any scene change, the input device, the quiz totals carried round to round,
// and the ending's outcome and scores. Screenshots of every screen go to
// tools/.cache/journey/<phone|desktop>/ with an index.json (file, scene, caption) for the gallery.
import fs from 'node:fs';
import path from 'node:path';
import { PlannerBot } from './bots/planner.mjs';
import { touchDriver, keyboardDriver, playLevelCorrectly } from './bots/kitchen-bot.mjs';

const PHONE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const SEED = 2009;
const EXPECTED = [
  'splash', 'cutscene',
  'shrink', 'platform', 'platform', 'platform', 'platform', 'gameshow',
  'shrink', 'platform', 'platform', 'platform', 'gameshow',
  'shrink', 'platform', 'platform', 'gameshow',
  'shrink', 'kitchen', 'kitchen', 'kitchen', 'kitchen', 'gameshow',
  'shrink', 'platform', 'gameshow',
  'ending',
];
// Quiz answers per round and question: 1 correct, 0 don't know, -1 wrong (so every verdict is heard).
const ANSWERS = [[1, 1, 0, 1], [1, -1, 1, 1], [1, 1], [1, 0, 1, 1, 1], [1, 1, -1, 1, 1, 1]];
const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', camera: 'KeyC', fire: 'KeyX' };
const TOUCH_IDS = { left: '#touch-left', right: '#touch-right', jump: '#touch-jump', camera: '#touch-camera', fire: '#touch-fire' };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// Holds exactly the wanted on-screen buttons, one finger each (as web/tests/level1.spec.mjs). CDP
// cannot lift one finger out of several, so a release lifts every finger and puts the still-wanted
// ones straight back down between two engine ticks; the controls count fingers per action, so those
// actions stay held without a new press.
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

async function playJourney(ctx, run) {
  const { context, page, errors } = await ctx.openPage(run.opts);
  const failed = [];
  page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure() && r.failure().errorText}`));
  const touch = !!run.opts.hasTouch;
  const cdp = touch ? await context.newCDPSession(page) : null;
  const dir = path.join(ctx.root, 'tools', '.cache', 'journey', run.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const index = [];
  const t0 = Date.now();
  const timing = [];
  let seenScenes = 0;

  const step = (n = 1) => page.evaluate(k => window.__test.step(k), n);
  const probe = name => page.evaluate(n => window.__test.probe(n), name);
  const scene = () => page.evaluate(() => window.__test.scene);
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  // Each scene the manager swapped in (its 'change' event) must be the next expected one, with no
  // console error or failed request so far.
  async function checkScenes(list) {
    for (; seenScenes < list.length; seenScenes++) {
      const name = list[seenScenes];
      assert(errors.length === 0 && failed.length === 0, `${run.name}: errors before scene ${seenScenes} (${name}):\n${[...errors, ...failed].join('\n')}`);
      assert(EXPECTED[seenScenes] === name, `${run.name}: scene ${seenScenes} is ${name}, expected ${EXPECTED[seenScenes]} (so far: ${list.join(' ')})`);
      timing.push(`${name} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  // Steps the engine until predicate(__test) holds, yielding to the page so loads can finish. The
  // predicate runs in the page: a function that uses nothing from here, or its source as a string
  // with any values written in.
  async function until(predicate, what, { max = 3000, chunk = 4 } = {}) {
    const src = typeof predicate === 'string' ? predicate : predicate.toString();
    for (let used = 0; used <= max; used += chunk) {
      const r = await page.evaluate(s => {
        let ok = false;
        try { ok = !!(0, eval)(s)(window.__test); } catch { ok = false; }
        return { ok, scenes: window.__scenes };
      }, src);
      await checkScenes(r.scenes);
      if (r.ok) return used;
      await step(chunk);
      if (used % 100 === 0) await page.waitForTimeout(5);
    }
    const d = await page.evaluate(() => {
      const T = window.__test, pick = (o, ks) => o ? Object.fromEntries(ks.map(k => [k, o[k]])) : o;
      return { scene: T.scene, transitioning: T.transitioning, launch: (T.probe('flow') || {}).lastLaunch, probe: pick(T.probe(T.scene), ['ready', 'failed', 'ui', 'mode', 'phase', 'state', 'stepCount', 'level', 'loadProgress']) };
    });
    throw new Error(`${run.name}: timed out waiting for ${what}: ${JSON.stringify(d)}`);
  }
  // DOM cards and results pages animate in real time (CSS), so each shot waits a moment first.
  async function shot(caption, settle = 200) {
    await page.waitForTimeout(settle);
    const file = `${String(index.length + 1).padStart(2, '0')}-${caption.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
    await page.screenshot({ path: path.join(dir, file), scale: 'css' });
    index.push({ file, scene: await scene(), caption });
  }

  // Real input: CDP taps on the phone, keys on the desktop.
  async function tapXY(x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 9 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  async function tapEl(sel, fx = 0.5, fy = 0.5) {
    const b = await page.locator(sel).boundingBox();
    assert(b, `${run.name}: ${sel} is not visible`);
    await tapXY(b.x + b.width * fx, b.y + b.height * fy);
  }
  async function tapStage(sx = 400, sy = 200) {
    const c = await page.locator('#game').boundingBox();
    await tapXY(c.x + (sx / 800) * c.width, c.y + (sy / 450) * c.height);
  }
  // Moves a talkie on: Enter, or a tap low on the stage.
  const nextLine = () => (touch ? tapStage(400, 380) : page.keyboard.press('Enter'));
  async function advanceCutscene(phase) {
    for (let i = 0; i < 40; i++) {
      const p = await probe('cutscene');
      if (!p || p.phase !== phase) return;
      await nextLine();
      await step(4);
    }
    throw new Error(`${run.name}: the cutscene stayed in phase ${phase}`);
  }

  await page.goto(`${ctx.baseUrl}/index.html?manual=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__scenes = [window.__test.scene];
    window.__test.app.scenes.addEventListener('change', e => window.__scenes.push(e.detail));
  });

  // 1. Splash (first visit: the language chooser), then New Game.
  await until(t => t.probe('splash') && t.probe('splash').ready, 'the splash art');
  await step(30);
  await shot('Splash: the TV tunes in');
  if (touch) await tapStage(); else await page.keyboard.press('Enter');
  await until(t => t.probe('splash').chooser, 'the first-run language chooser', { max: 400 });
  await step(12);
  await shot('Splash: first-run language chooser', 500);
  if (touch) await tapEl('#lang-en');
  else {
    assert(await focused() === 'lang-en', `${run.name}: English is not focused in the chooser (${await focused()})`);
    await page.keyboard.press('Enter');
  }
  await until(t => !t.probe('splash').chooser && t.probe('splash').menu && t.probe('splash').awake, 'the splash menu', { max: 600 });
  await step(20);
  await shot('Splash: main menu', 500);
  if (touch) await tapEl('#btn-new-game');
  else {
    assert(await focused() === 'btn-new-game', `${run.name}: New Game is not focused (${await focused()})`);
    await page.keyboard.press('Enter');
  }

  // 2. Cutscene: host lines, the avatar, the nickname, the closing lines.
  await until(t => t.scene === 'cutscene' && !t.transitioning && t.probe('cutscene') && t.probe('cutscene').phase === 'intro', 'the cutscene', { max: 3000 });
  await step(30);
  await shot('Cutscene: the host welcomes the player');
  await advanceCutscene('intro');
  assert((await probe('cutscene')).phase === 'choose', `${run.name}: no avatar choice`);
  await until(t => t.probe('cutscene').awake, 'the choice to take picks', { max: 60 });
  await shot('Cutscene: choose Harry or Amy');
  if (touch) await tapEl(`#choose-${run.avatar}`);
  else {
    for (let i = 0; i < 4 && (await probe('cutscene')).hover !== run.avatar; i++) { await page.keyboard.press(run.avatar === 'amy' ? 'ArrowLeft' : 'ArrowRight'); await step(2); }
    assert((await probe('cutscene')).hover === run.avatar, `${run.name}: the arrows did not reach ${run.avatar}`);
    await page.keyboard.press('Enter');
  }
  await step(2);
  assert((await probe('cutscene')).chosen === run.avatar, `${run.name}: ${run.avatar} was not chosen`);
  await step(20);
  await shot(`Cutscene: ${run.avatar} chosen`);
  await advanceCutscene('chosen');
  assert((await probe('cutscene')).phase === 'form', `${run.name}: no details form`);
  if (touch) {
    // The phone's soft keyboard: clear the pre-filled name, then type the nickname.
    await tapEl('#form-nickname');
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Backspace'); await page.keyboard.press('Delete'); }
    await page.keyboard.insertText(run.nickname);
  } else {
    assert(await focused() === 'form-nickname', `${run.name}: the nickname box is not focused`);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(run.nickname);
  }
  assert(await page.inputValue('#form-nickname') === run.nickname, `${run.name}: nickname box holds "${await page.inputValue('#form-nickname')}"`);
  await until(t => t.probe('cutscene').awake, 'the form to take a submit', { max: 60 });
  await shot('Cutscene: nickname form', 500);
  if (touch) await tapEl('#form-submit'); else await page.keyboard.press('Enter');
  await step(2);
  const closing = await probe('cutscene');
  assert(closing.phase === 'closing' && closing.nickname === run.nickname, `${run.name}: form not submitted (${closing.phase}, ${closing.nickname})`);
  await step(30);
  await shot('Cutscene: closing line with the nickname');
  await advanceCutscene('closing');
  let f = await probe('flow');
  assert(f.run && f.run.avatar === run.avatar && f.run.nickname === run.nickname && f.run.seed === SEED, `${run.name}: journey ${JSON.stringify(f.run)}`);
  if (!touch) assert(await page.evaluate(() => window.__test.lastDevice) === 'keyboard', `${run.name}: the device is not the keyboard`);

  // 3. The five rounds.
  const table = JSON.parse(fs.readFileSync(path.join(ctx.web, 'data/levels/index.json'), 'utf8'));
  const totals = { quiz: 0, cpu: 0, hover: 0, kitchen: 0 };
  const report = [];
  let bytesToLevel1 = null;
  for (let r = 0; r < 5; r++) {
    const round = table.rounds[r];
    // The shrinking zone: the first plays in full; later ones are skipped once the hint is up.
    await until(t => t.scene === 'shrink' && !t.transitioning && t.probe('shrink') && t.probe('shrink').ready, `round ${r + 1}'s shrinking zone`, { max: 3000 });
    const sh = await probe('shrink');
    assert(sh.avatar === run.avatar && sh.round === r + 1 && sh.skippable === (r > 0), `${run.name}: shrinking zone ${JSON.stringify(sh)}`);
    await step(60);
    await shot(`Round ${r + 1}: shrinking zone`);
    if (r > 0) {
      await until(t => t.probe('shrink').canSkip, 'the skip hint', { max: 200 });
      if (touch) await tapStage(); else await page.keyboard.press('Enter');
    }

    if (round.kind === 'kitchen') {
      for (let n = 0; n < 4; n++) {
        await until(`t => t.scene === 'kitchen' && !t.transitioning && t.probe('kitchen') && t.probe('kitchen').ready && t.probe('kitchen').level === ${n} && t.probe('kitchen').mode === 'intro'`, `kitchen level ${n}`, { max: 3000 });
        const launch = (await probe('flow')).lastLaunch;
        assert(launch.scene === 'kitchen' && launch.params.level === n && launch.params.avatar === run.avatar && launch.params.score === totals.kitchen, `${run.name}: kitchen launch ${JSON.stringify(launch)}`);
        await step(10);
        await shot(`Kitchen level ${n}: introduction`, 600);
        const drv = touch ? touchDriver(page, cdp) : keyboardDriver(page);
        const { seen, probe: kp } = await playLevelCorrectly(page, drv, n, { waitForSneeze: false });
        assert(kp.placements.length === kp.items.length && kp.placements.every(x => !x.sneeze && !x.meatHands), `${run.name}: kitchen level ${n} placed ${kp.placements.length} of ${kp.items.length}`);
        await step(10);
        await shot(`Kitchen level ${n}: results`, 1200);
        const points = kp.outro.points;
        // The results pages, until the flow starts the next step.
        for (let i = 0; i < 8; i++) {
          const k = await probe('kitchen');
          const l = (await probe('flow')).lastLaunch;
          if (!k || k.mode !== 'outro' || l.scene !== 'kitchen' || l.params.level !== n) break;
          await drv.next();
        }
        await until(`t => t.probe('flow').lastLaunch.scene !== 'kitchen' || t.probe('flow').lastLaunch.params.level !== ${n}`, `the step after kitchen level ${n}`, { max: 400, chunk: 2 });
        totals.kitchen += points;
        assert((await probe('flow')).run.kitchen === totals.kitchen, `${run.name}: kitchen total ${(await probe('flow')).run.kitchen}, expected ${totals.kitchen}`);
        assert(await page.evaluate(() => window.__test.lastDevice) === run.device, `${run.name}: kitchen level ${n} ended on device ${await page.evaluate(() => window.__test.lastDevice)}`);
        report.push(`kitchen${n} ${points} (sneezes ${seen.sneezes}, washes ${seen.washes}, cling film ${seen.clingfilms})`);
      }
    } else {
      for (const id of round.levels) {
        await until(`t => t.scene === 'platform' && !t.transitioning && t.probe('flow').lastLaunch.params.level === ${JSON.stringify(id)} && t.probe('platform') && t.probe('platform').ready`, id, { max: 3000 });
        const launch = (await probe('flow')).lastLaunch;
        assert(launch.params.avatar === run.avatar && launch.params.score === totals.hover, `${run.name}: ${id} launch ${JSON.stringify(launch.params)}, running score ${totals.hover}`);
        let p = await probe('platform');
        assert(p.ui === 'intro' && p.stepCount === 0 && p.score === totals.hover && p.avatar === run.avatar, `${run.name}: ${id} starts in ${p.ui} at step ${p.stepCount}, score ${p.score}`);
        if (id === 'alpha_level1') bytesToLevel1 = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].reduce((n, e) => n + (e.encodedBodySize || 0), 0));
        await step(40);
        await shot(`${id.replace('alpha_level', 'Level ')}: ePhone briefing`);
        // Through the briefing; the last page's press starts play, caught at its first tick.
        for (let i = 0; i < 80; i++) {
          p = await probe('platform');
          if (p.ui === 'play') break;
          if (p.intro && p.intro.phase === 'page') { if (touch) await tapEl('#pf-intro-next'); else await page.keyboard.press('Enter'); }
          await page.evaluate(() => window.__test.stepUntil(t => t.probe('platform').ui === 'play', 12, 1));
        }
        p = await probe('platform');
        assert(p.ui === 'play' && p.stepCount === 0, `${run.name}: ${id}: the briefing did not hand over to play at step 0 (ui ${p.ui}, step ${p.stepCount})`);
        // The planning bot plays, one logic step (two engine ticks) per decision.
        const level = JSON.parse(fs.readFileSync(path.join(ctx.web, 'data/levels', `${id}.json`), 'utf8'));
        const bot = new PlannerBot(level, { avatar: run.avatar, score: p.score });
        const centres = {};
        if (touch) {
          for (const [a, sel] of Object.entries(TOUCH_IDS)) {
            const b = await page.locator(sel).boundingBox();
            assert(b, `${run.name}: ${id}: touch control ${sel} is not visible in play`);
            centres[a] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          }
        }
        const held = new Set();
        const used = new Set();
        let lite = { ready: true, state: p.state, ui: p.ui, stepCount: p.stepCount, score: p.score, player: { x: p.player.x, y: p.player.y } };
        let shotPlay = false, calls = 0;
        while (lite.state === 'play') {
          assert(lite.ui === 'play', `${run.name}: ${id} left play (ui ${lite.ui}) at step ${lite.stepCount}`);
          assert(++calls < 12000, `${run.name}: ${id} did not finish (step ${lite.stepCount})`);
          const want = new Set(bot.decide(lite));
          for (const a of want) used.add(a);
          if (touch) await setTouches(cdp, want, held, centres);
          else {
            for (const a of [...held]) if (!want.has(a)) { await page.keyboard.up(KEYS[a]); held.delete(a); }
            for (const a of want) if (!held.has(a)) { await page.keyboard.down(KEYS[a]); held.add(a); }
          }
          lite = await page.evaluate(() => {
            window.__test.step(2);
            const q = window.__test.probe('platform');
            return { ready: q.ready, state: q.state, ui: q.ui, stepCount: q.stepCount, score: q.score, lives: q.lives, player: { x: q.player.x, y: q.player.y }, goal: q.goals[0] };
          });
          if (!shotPlay && lite.stepCount >= 70) { shotPlay = true; await shot(`${id.replace('alpha_level', 'Level ')}: play`); }
        }
        if (touch) await setTouches(cdp, new Set(), held, centres);
        else for (const a of held) await page.keyboard.up(KEYS[a]);
        assert(!bot.desync, `${run.name}: ${id}: the page and the bot's shadow simulation parted: ${bot.desync}`);
        assert(lite.state === 'complete', `${run.name}: ${id} ended ${lite.state} at step ${lite.stepCount} (goal ${lite.goal.achieved}/${lite.goal.required}, lives ${lite.lives})`);
        assert(await page.evaluate(() => window.__test.lastDevice) === run.device, `${run.name}: ${id} was not played with ${run.device}`);
        await step(12);
        await shot(`${id.replace('alpha_level', 'Level ')}: into the portal`);
        report.push(`${id.replace('alpha_', '')} ${lite.score - totals.hover} in ${lite.stepCount} steps (${[...used].sort().join('+')})`);
        totals.hover = lite.score;
        await until(`t => t.probe('flow').lastLaunch.params.level !== ${JSON.stringify(id)}`, `the step after ${id}`, { max: 600 });
        assert((await probe('flow')).run.hover === totals.hover, `${run.name}: hoverboard total ${(await probe('flow')).run.hover}, expected ${totals.hover}`);
      }
    }

    // The quiz.
    await until(t => t.scene === 'gameshow' && !t.transitioning && t.probe('gameshow') && t.probe('gameshow').ready, `round ${r + 1}'s quiz`, { max: 3000 });
    const qp = (await probe('flow')).lastLaunch.params;
    assert(qp.round === r + 1 && qp.blind === false && qp.stepRight === (r < 4) && qp.playerScore === totals.quiz && qp.cpuScore === totals.cpu && qp.avatar === run.avatar
      && qp.nickname === run.nickname && qp.cpuName === (run.avatar === 'amy' ? 'Harry' : 'Amy'), `${run.name}: quiz launch ${JSON.stringify(qp)}`);
    let g = null, flip = 0, boards = 0, lastShot = '';
    for (let i = 0; i < 6000; i++) {
      g = await probe('gameshow');
      if (!g || g.phase === 'done') break;
      const key = `${g.phase}:${g.questionIndex}`;
      if (g.phase === 'title' && lastShot !== key && g.tick >= 30) { lastShot = key; await shot(`Round ${r + 1} quiz: title`); }
      if (g.phase === 'title') {
        if (g.tick >= 30) { if (touch) await tapEl('#gs-stage-tap'); else await page.keyboard.press('Enter'); }
        await step(3);
        continue;
      }
      if (g.phase === 'board' && g.board.accepting) {
        const want = ANSWERS[r][g.questionIndex];
        const index = g.question.values.indexOf(want);
        if (boards++ === 0) await shot(`Round ${r + 1} quiz: question 1`);
        if (touch) await tapEl(`#gs-answer-${index + 1}`);
        else if (flip % 3 === 0) await page.keyboard.press(`Digit${index + 1}`);
        else {
          for (let k = 0; k <= index; k++) { await page.keyboard.press('ArrowDown'); await step(2); }
          assert((await probe('gameshow')).board.selected === index, `${run.name}: the arrows selected ${(await probe('gameshow')).board.selected}, wanted ${index}`);
          await page.keyboard.press(flip % 3 === 1 ? 'Enter' : 'Space');
        }
        flip++;
        await step(1);
        const after = await probe('gameshow');
        assert(after.phase === 'lockin' && after.board.locked === index, `${run.name}: round ${r + 1} question ${g.questionIndex + 1}: answer ${index + 1} not taken (${after.phase})`);
        if (g.questionIndex === 0) await shot(`Round ${r + 1} quiz: answer locked in`);
        continue;
      }
      if (g.talkie && g.talkie.waiting) {
        if (touch) await tapEl('#gs-talkie-tap', 0.5, 0.85); else await page.keyboard.press(flip++ % 2 ? 'Space' : 'Enter');
        await step(3);
        continue;
      }
      await step(3);
    }
    assert(g && g.phase === 'done', `${run.name}: round ${r + 1}'s quiz did not finish (phase ${g && g.phase})`);
    assert(g.answers.length === ANSWERS[r].length && g.answers.every((a, i) => a.value === ANSWERS[r][i] && a.cpu), `${run.name}: round ${r + 1} answers ${JSON.stringify(g.answers.map(a => [a.value, a.cpu && a.cpu.value]))}`);
    await shot(`Round ${r + 1} quiz: scores`);
    totals.quiz = g.scores.player;
    totals.cpu = g.scores.cpu;
    report.push(`quiz ${r + 1} ${totals.quiz}:${totals.cpu}`);
    await until(t => t.scene !== 'gameshow', `the step after round ${r + 1}'s quiz`, { max: 600 });
    f = await probe('flow');
    if (r < 4) assert(f.run.quiz === totals.quiz && f.run.cpu === totals.cpu && f.run.round === r + 1, `${run.name}: after round ${r + 1} the journey holds ${JSON.stringify(f.run)}`);
  }

  // 4. The ending.
  await until(t => t.scene === 'ending' && !t.transitioning && t.probe('ending') && t.probe('ending').phase === 'line', 'the ending', { max: 3000 });
  let e = await probe('ending');
  const outcome = totals.quiz > totals.cpu ? 'win' : totals.quiz === totals.cpu ? 'draw' : 'lose';
  assert(e.outcome === outcome && e.playerScore === totals.quiz && e.cpuScore === totals.cpu && e.hoverScore === totals.hover && e.kitchenScore === totals.kitchen,
    `${run.name}: ending ${JSON.stringify({ outcome: e.outcome, quiz: e.playerScore, cpu: e.cpuScore, hover: e.hoverScore, kitchen: e.kitchenScore })}, expected ${outcome} ${JSON.stringify(totals)}`);
  await step(30);
  await shot('Ending: the host announces the result');
  for (let i = 0; i < 12 && !(await probe('ending')).card; i++) { await nextLine(); await step(4); }
  await step(40);
  e = await probe('ending');
  assert(e.card && e.buttons.join() === 'ending-play-again,ending-level-select,ending-menu', `${run.name}: ending card ${JSON.stringify(e)}`);
  const cells = await page.evaluate(() => [...document.querySelectorAll('#ending-card .en-table .n')].map(n => n.textContent));
  assert(JSON.stringify(cells) === JSON.stringify([String(totals.quiz), String(totals.cpu), String(totals.hover), '-', String(totals.kitchen), '-']), `${run.name}: ending table ${cells}`);
  await shot('Ending: final scores', 800);
  f = await probe('flow');
  assert(f.run === null && f.finished === 1, `${run.name}: the finished journey is still saved (${JSON.stringify(f.run)})`);
  const scenes = await page.evaluate(() => window.__scenes);
  await checkScenes(scenes);
  assert(JSON.stringify(scenes) === JSON.stringify(EXPECTED), `${run.name}: scenes ${scenes.join(' ')}`);
  assert(await page.evaluate(() => window.__test.lastDevice) === run.device, `${run.name}: ended on device ${await page.evaluate(() => window.__test.lastDevice)}`);
  assert(errors.length === 0 && failed.length === 0, `${run.name}: errors:\n${[...errors, ...failed].join('\n')}`);
  const bytesAll = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].reduce((n, x) => n + (x.encodedBodySize || 0), 0));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ run: run.name, viewport: run.opts.viewport, device: run.device, avatar: run.avatar, seed: SEED, shots: index }, null, 1) + '\n');
  ctx.log(`${run.name}: ${outcome} ${totals.quiz}:${totals.cpu}, hoverboard ${totals.hover}, kitchen ${totals.kitchen}; ${scenes.length} scenes in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${index.length} screenshots in tools/.cache/journey/${run.name}/`);
  ctx.log(`${run.name}: ${report.join('; ')}`);
  ctx.log(`${run.name}: page fetched ${(bytesToLevel1 / 1e6).toFixed(2)} MB by the start of level 1 (first visit via New Game), ${(bytesAll / 1e6).toFixed(2)} MB over the whole journey (resource timing; files served by the service worker once it took over count too)`);
  ctx.log(`${run.name}: scene times ${timing.join(', ')}`);
  await context.close();
}

export const tests = [
  {
    name: '(a) phone 915x412 landscape, touch only: splash to the ending, every level, the kitchen and every quiz, as Harry',
    timeoutMs: 1800000,
    run: ctx => playJourney(ctx, { name: 'phone', opts: PHONE, device: 'touch', avatar: 'harry', nickname: 'Kit' }),
  },
  {
    name: '(b) desktop 1280x720, keyboard only: splash to the ending, every level, the kitchen and every quiz, as Amy',
    timeoutMs: 1800000,
    run: ctx => playJourney(ctx, { name: 'desktop', opts: DESKTOP, device: 'keyboard', avatar: 'amy', nickname: 'Sam' }),
  },
];
