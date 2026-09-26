// Game show quiz (scene 'gameshow'), end to end in Chromium, deterministic (?manual=1 and
// __test.step). The bots read only __test.probe('gameshow') and act through real input:
//   - desktop keyboard: a whole round answered with 1/2/3, arrows + Enter and Space;
//   - phone landscape (touch emulation): a whole round with CDP touch taps on the talkie, the
//     title card and the answer buttons;
// and check every score against the rules (js/gameshow/rules.js, imported here in Node), that
// every question including the last gets the host's verdict and a CPU turn, and that onComplete
// fires once with the right totals. Also: every round of every language loads and lays out its
// questions with no missing text (screenshots of a board in en, gk_gk and cz_cz), the blind
// half, the talkie's typing rules, text scaling, pause and quit, and 44 px tap targets.
import fs from 'node:fs';
import path from 'node:path';
import { scorePlayerAnswer, scoreCpuAnswer, blindIntro, normaliseIntro } from '../js/gameshow/rules.js';

const PHONE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const LANGS = ['en', 'bg_fl', 'bg_fr', 'cz_cz', 'dk_dk', 'fr_fr', 'gk_gk', 'it_it', 'pl_pl', 'por_por', 'sp_sp'];

const probe = page => page.evaluate(() => window.__test.probe('gameshow'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const quizFile = (ctx, code) => JSON.parse(fs.readFileSync(path.join(ctx.web, 'data/quiz', `${code}.json`), 'utf8'));

// Opens the game show with callbacks. The page starts on the scene itself (so nothing else
// loads), then __test.go() replaces it with one whose onComplete / onQuit record into window.
async function openShow(ctx, opts, params) {
  const { context, page, errors } = await ctx.openPage(opts);
  await page.goto(`${ctx.baseUrl}/index.html?scene=gameshow&manual=1`);
  await page.waitForFunction(() => window.__test && window.__test.scene === 'gameshow', null, { timeout: 20000 });
  await page.evaluate(p => {
    window.__gsResults = [];
    window.__gsQuit = 0;
    window.__test.go('gameshow', { ...p, onComplete: r => { window.__gsResults.push(r); }, onQuit: () => { window.__gsQuit++; } });
  }, params);
  await page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 20000 });
  assert((await page.evaluate(() => window.__test.tick)) === 0, 'the loop ticked before the test took over');
  return { context, page, errors };
}

// One finger tap through CDP (a real touch event sequence).
async function tapAt(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapEl(page, cdp, sel, fx = 0.5, fy = 0.5) {
  const b = await page.locator(sel).boundingBox();
  assert(b, `${sel} is not visible`);
  await tapAt(cdp, b.x + b.width * fx, b.y + b.height * fy);
}

// Expected scores from the probe's answer log (the rules, recomputed in Node).
function expectedScores(start, answers, { includeLastCpu = true } = {}) {
  let s = { player: start.player, cpu: start.cpu };
  answers.forEach((a, i) => {
    s = scorePlayerAnswer(a.value, a.score, s);
    if (a.cpu && (includeLastCpu || i < answers.length - 1)) s = scoreCpuAnswer(a.cpu.value, a.score, s);
  });
  return s;
}

// Plays one round. `choose(p)` returns { index, how } for a board, how = 'digit' | 'arrows' |
// 'space' | 'tap'. mode 'keyboard' advances the host with Enter / Space, 'touch' with taps.
async function playRound(page, { mode, cdp = null, choose, onEvent = () => {} }) {
  const trace = { advances: 0, boards: 0, checks: 0 };
  let lastPhase = null, lastQ = -1, flip = false;
  for (let i = 0; i < 6000; i++) {
    const p = await probe(page);
    if (p.phase !== lastPhase || p.questionIndex !== lastQ) { await onEvent(p, lastPhase); lastPhase = p.phase; lastQ = p.questionIndex; }
    if (p.phase === 'done') return { probe: p, trace };
    if (p.phase === 'title') {
      if (p.tick >= 30) {
        if (mode === 'touch') await tapEl(page, cdp, '#gs-stage-tap');
        else await page.keyboard.press('Enter');
      }
      await step(page, 3);
      continue;
    }
    if (p.phase === 'board') {
      if (p.board.accepting) {
        trace.boards++;
        const { index, how } = choose(p);
        if (how === 'tap') await tapEl(page, cdp, `#gs-answer-${index + 1}`);
        else if (how === 'digit') await page.keyboard.press(`Digit${index + 1}`);
        else {
          // Arrows: the first Down selects Agree, each further Down moves one down; then confirm.
          // Two ticks per press: a key tapped between two polls counts as down for one poll only.
          for (let k = 0; k <= index; k++) { await page.keyboard.press('ArrowDown'); await step(page, 2); }
          const sel = (await probe(page)).board.selected;
          assert(sel === index, `arrow selection is ${sel}, wanted ${index}`);
          await page.keyboard.press(how === 'space' ? 'Space' : 'Enter');
        }
        await step(page, 1);
        const after = await probe(page);
        assert(after.phase === 'lockin' && after.board.locked === index, `answer ${index} (${how}) was not taken: phase ${after.phase}, locked ${after.board.locked}`);
      }
      await step(page, 2);
      continue;
    }
    if (p.talkie && p.talkie.waiting) {
      if (mode === 'touch') await tapEl(page, cdp, '#gs-talkie-tap', 0.5, 0.85);
      else await page.keyboard.press((flip = !flip) ? 'Enter' : 'Space');
      trace.advances++;
      await step(page, 3);
      continue;
    }
    await step(page, 3);
  }
  throw new Error('the round did not finish');
}

// Checks the whole round: every question has a verdict and a CPU turn (the last one too), the
// scores follow the rules at each step and at the end, and onComplete fired once with them.
async function assertRound(page, p, { start, questions, types }) {
  assert(p.answers.length === questions, `${p.answers.length} answers for ${questions} questions`);
  for (let q = 0; q < questions; q++) {
    const a = p.answers[q];
    assert(a.q === q && a.cpu && [-1, 0, 1].includes(a.cpu.value), `question ${q}: bad answer record ${JSON.stringify(a)}`);
  }
  const seenTypes = new Set(p.answers.map(a => a.value));
  for (const v of types) assert(seenTypes.has(v), `the player never gave a ${v} answer`);
  const exp = expectedScores(start, p.answers);
  assert(p.scores.player === exp.player && p.scores.cpu === exp.cpu, `final scores ${p.scores.player}/${p.scores.cpu}, rules say ${exp.player}/${exp.cpu}`);
  assert(p.scores.shownPlayer === exp.player && p.scores.shownCpu === exp.cpu, `scoreboards show ${p.scores.shownPlayer}/${p.scores.shownCpu}`);
  const results = await page.evaluate(() => window.__gsResults);
  assert(results.length === 1, `onComplete fired ${results.length} times`);
  const r = results[0];
  assert(r.playerScore === exp.player && r.cpuScore === exp.cpu, `onComplete totals ${r.playerScore}/${r.cpuScore}, expected ${exp.player}/${exp.cpu}`);
  assert(Array.isArray(r.answers) && r.answers.length === questions && r.answers.every((a, i) => a.q === i && typeof a.value === 'number'), 'onComplete answers malformed');
  return exp;
}

// Per-step score check, run whenever the phase changes: after the player's verdict (entering the
// CPU turn) and after the CPU's (entering the next question or the end).
function stepChecker(start, trace) {
  return async (p, prev) => {
    if (!p.answers.length) return;
    let exp = null;
    if (p.phase === 'cpu') exp = expectedScores(start, p.answers.map((a, i) => (i === p.answers.length - 1 ? { ...a, cpu: null } : a)));
    else if ((p.phase === 'ask' || p.phase === 'outro' || p.phase === 'step' || p.phase === 'done') && prev === 'cpu') exp = expectedScores(start, p.answers);
    if (!exp) return;
    assert(p.scores.player === exp.player && p.scores.cpu === exp.cpu, `after ${prev} -> ${p.phase} (question ${p.questionIndex}): scores ${p.scores.player}/${p.scores.cpu}, rules say ${exp.player}/${exp.cpu}`);
    trace.checks++;
  };
}

// Picks the button for a wanted answer type (1 correct, -1 wrong, 0 don't know).
const buttonFor = (p, v) => p.question.values.indexOf(v);

export const tests = [
  {
    name: 'desktop keyboard: a full round (1/2/3, arrows + Enter, Space); scores follow the rules; onComplete totals',
    timeoutMs: 180000,
    async run(ctx) {
      const start = { player: 20, cpu: 15 };
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 5, avatar: 'amy', nickname: 'Zoe', cpuName: 'Harry', playerScore: start.player, cpuScore: start.cpu, seed: 11 });
      const q = quizFile(ctx, 'en').rounds[4];
      // Round 5 has six questions: correct, wrong, don't know, correct, don't know, wrong, each
      // entered a different way.
      const plan = [[1, 'digit'], [-1, 'arrows'], [0, 'digit'], [1, 'space'], [0, 'arrows'], [-1, 'digit']];
      const trace = { checks: 0 };
      let shot = false;
      const { probe: p } = await playRound(page, {
        mode: 'keyboard',
        choose: pr => { const [v, how] = plan[pr.questionIndex]; return { index: buttonFor(pr, v), how }; },
        onEvent: async (pr, prev) => {
          await stepChecker(start, trace)(pr, prev);
          if (pr.phase === 'board' && pr.questionIndex === 0 && !shot) {
            shot = true;
            assert(pr.board.layout.heading === 'Question 1' && pr.board.layout.points === '10 Points', 'board heading or points wrong');
            assert(pr.question.text === q.questions[0].text, 'board shows the wrong question');
          }
        },
      });
      const exp = await assertRound(page, p, { start, questions: 6, types: [1, 0, -1] });
      assert(trace.checks >= 11, `only ${trace.checks} per-step score checks ran`);
      // Every question, the last one included, had the host's verdict and a CPU turn.
      const log = p.log.map(e => e[1]);
      for (let i = 0; i < 6; i++) {
        assert(log.includes(`verdict ${i} ${p.answers[i].value}`), `no verdict for question ${i + 1}`);
        assert(log.includes(`cpuVerdict ${i} ${p.answers[i].cpu.value}`), `no CPU turn for question ${i + 1}`);
      }
      assert(p.playerName === 'Zoe' && p.cpuName === 'Harry' && p.avatar === 'amy' && p.cpuAvatar === 'harry', 'avatar mapping wrong');
      assert(p.talkie.statement.startsWith('Harry, you chose the'), `last host line: ${p.talkie.statement}`);
      assert((await page.evaluate(() => window.__test.lastDevice)) === 'keyboard', 'device is not keyboard');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      ctx.log(`scores ${exp.player}/${exp.cpu} from ${start.player}/${start.cpu}; answers ${p.answers.map(a => `${a.value}/${a.cpu.value}`).join(' ')}`);
      await context.close();
    },
  },
  {
    name: 'phone 915x412 (touch emulation): a full round with taps only; scores follow the rules; onComplete totals',
    timeoutMs: 180000,
    async run(ctx) {
      const start = { player: 0, cpu: 0 };
      const { context, page, errors } = await openShow(ctx, PHONE, { round: 1, avatar: 'harry', nickname: 'Kit', cpuName: 'Amy', playerScore: 0, cpuScore: 0, seed: 3 });
      const cdp = await context.newCDPSession(page);
      const plan = [1, -1, 0, 1];
      const trace = { checks: 0 };
      let sized = false;
      const { probe: p } = await playRound(page, {
        mode: 'touch', cdp,
        choose: pr => ({ index: buttonFor(pr, plan[pr.questionIndex]), how: 'tap' }),
        onEvent: async (pr, prev) => {
          await stepChecker(start, trace)(pr, prev);
          if (pr.phase === 'board' && !sized) {
            sized = true;
            await step(page, 30);
            for (const sel of ['#gs-answer-1', '#gs-answer-2', '#gs-answer-3', '#gs-pause']) {
              const b = await page.locator(sel).boundingBox();
              assert(b && b.width >= 44 && b.height >= 44, `${sel} is ${b ? `${b.width.toFixed(1)}x${b.height.toFixed(1)}` : 'hidden'} CSS px`);
            }
            await page.screenshot({ path: path.join(ctx.shots, 'gameshow-phone-board.png'), scale: 'css' });
          }
          if (pr.phase === 'cpu' && pr.questionIndex === 0) {
            await step(page, 50);
            await page.screenshot({ path: path.join(ctx.shots, 'gameshow-phone-verdict.png'), scale: 'css' });
          }
        },
      });
      await assertRound(page, p, { start, questions: 4, types: [1, 0, -1] });
      assert(trace.checks >= 7, `only ${trace.checks} per-step score checks ran`);
      assert((await page.evaluate(() => window.__test.lastDevice)) === 'touch', 'device is not touch');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      ctx.log(`touch round: ${p.scores.player}/${p.scores.cpu}`);
      await context.close();
    },
  },
  {
    name: 'every round of every language loads and lays out its questions with no missing text',
    timeoutMs: 300000,
    async run(ctx) {
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 1, lang: 'en', seed: 1 });
      // Reduced motion: the host's lines appear whole, so one press per line (the layout is the
      // same; only the typewriter and entrance animations are skipped).
      await page.evaluate(() => window.__test.app.settings.set('reducedMotion', true));
      let boards = 0;
      for (const code of LANGS) {
        const data = quizFile(ctx, code);
        for (let round = 1; round <= 5; round++) {
          const rd = data.rounds[round - 1];
          const out = await page.evaluate(async ({ code, round }) => {
            const T = window.__test;
            window.__gsResults = [];
            T.go('gameshow', { round, lang: code, seed: round, avatar: 'harry', nickname: 'Test', cpuName: 'Amy', onComplete: r => { window.__gsResults.push(r); } });
            await new Promise((res, rej) => { let n = 0; const f = () => { const p = T.probe('gameshow'); if (p && p.ready) res(); else if (++n > 500) rej(new Error('not ready')); else setTimeout(f, 10); }; f(); });
            const tap = a => { T.press(a); T.step(1); T.release(a); T.step(1); };
            const boards = [], statements = [];
            let lastKey = '';
            for (let i = 0; i < 20000; i++) {
              const p = T.probe('gameshow');
              if (p.phase === 'done') return { boards, statements, lang: p.lang, results: window.__gsResults.length };
              if (p.phase === 'board') { if (p.board.accepting) { boards.push({ q: p.questionIndex, text: p.question.text, layout: p.board.layout, labels: p.labels }); tap('answer2'); } else T.step(4); continue; }
              if (p.phase === 'title') { if (p.tick > 26) tap('confirm'); else T.step(4); continue; }
              if (p.talkie && p.talkie.waiting) {
                const key = p.phase + ':' + p.talkie.lineIndex + ':' + p.talkie.statement;
                if (key !== lastKey) { statements.push({ phase: p.phase, text: p.talkie.statement, pages: p.talkie.pageCount, lines: p.talkie.lines }); lastKey = key; }
                tap('confirm');
                continue;
              }
              T.step(4);
            }
            return { error: 'did not finish', boards, statements };
          }, { code, round });
          assert(!out.error, `${code} round ${round}: ${out.error}`);
          assert(out.lang === code, `${code} round ${round}: loaded ${out.lang}`);
          assert(out.results === 1, `${code} round ${round}: onComplete fired ${out.results} times`);
          assert(out.boards.length === rd.questions.length, `${code} round ${round}: ${out.boards.length} boards for ${rd.questions.length} questions`);
          out.boards.forEach((b, i) => {
            const where = `${code} round ${round} question ${i + 1}`;
            assert(b.text === rd.questions[i].text && b.text.trim().length > 0, `${where}: wrong or empty question text`);
            assert(b.layout.fits, `${where}: question text does not fit (${b.layout.lines.length} lines at ${b.layout.size}px)`);
            assert(b.layout.lines.every(l => l.length > 0), `${where}: an empty line in the layout`);
            assert(b.layout.heading === `Question ${i + 1}` && /\d+ Points/.test(b.layout.points), `${where}: heading/points ${b.layout.heading} ${b.layout.points}`);
            assert(b.layout.labels.length === 3 && b.layout.labels.every(l => l.text.trim() && l.fits), `${where}: a button label is empty or too wide: ${JSON.stringify(b.layout.labels)}`);
            boards++;
          });
          // The host read every normal intro line and every question. The data carries the
          // corrected "Ready?" and the Portuguese points line (tools/convert-text.mjs); the checks
          // below catch a regression in either.
          const intro = out.statements.filter(s => s.phase === 'intro').map(s => s.text);
          const wantIntro = normaliseIntro(code, rd.intro.normal);
          assert(intro.length === wantIntro.length && intro.every((s, i) => s === wantIntro[i] && s.trim()), `${code} round ${round}: intro lines ${JSON.stringify(intro)}`);
          if (code === 'en') assert(!intro.some(s => /\s[?!]/.test(s)), `en round ${round}: a space before ? or ! in ${JSON.stringify(intro)}`);
          if (code === 'por_por') assert(!intro.some(s => /prawidłową|punktów/.test(s)) && (round > 2 || intro.some(s => /10 pontos/.test(s))), `por_por round ${round}: the points line is not Portuguese: ${JSON.stringify(intro)}`);
          const asks = out.statements.filter(s => s.phase === 'ask');
          assert(asks.length === rd.questions.length && asks.every((s, i) => s.text.includes(rd.questions[i].text) && s.lines.every(l => l !== undefined)), `${code} round ${round}: question lines missing`);
          assert(out.statements.every(s => s.pages >= 1), `${code} round ${round}: a host line had no pages`);
        }
      }
      // Screenshots of a board with long text in three scripts.
      for (const [code, round] of [['en', 4], ['gk_gk', 4], ['cz_cz', 5]]) {
        await page.evaluate(({ code, round }) => window.__test.go('gameshow', { round, lang: code, seed: 2, avatar: 'amy', nickname: 'Test' }), { code, round });
        await page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready; });
        await page.evaluate(() => {
          const T = window.__test;
          const tap = a => { T.press(a); T.step(1); T.release(a); T.step(1); };
          for (let i = 0; i < 4000; i++) { const p = T.probe('gameshow'); if (p.phase === 'board') break; if (p.phase === 'title' && p.tick < 27) { T.step(1); continue; } tap('confirm'); }
          T.step(60);
        });
        const p = await probe(page);
        assert(p.phase === 'board' && p.board.layout.fits, `${code}: no board to screenshot`);
        await page.screenshot({ path: path.join(ctx.shots, `gameshow-board-${code}.png`), scale: 'css' });
      }
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      ctx.log(`${LANGS.length} languages x 5 rounds, ${boards} boards laid out`);
      await context.close();
    },
  },
  {
    name: 'blind half: blind intro without the bonus line, no scores or CPU turns, ends with "Step right this way"',
    timeoutMs: 120000,
    async run(ctx) {
      const start = { player: 30, cpu: 25 };
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 1, blind: true, stepRight: true, avatar: 'harry', nickname: 'Kit', playerScore: start.player, cpuScore: start.cpu, seed: 5 });
      const rd = quizFile(ctx, 'en').rounds[0];
      const intro = [];
      const { probe: p } = await playRound(page, {
        mode: 'keyboard',
        choose: pr => ({ index: [2, 0, 1, 2][pr.questionIndex], how: 'digit' }),
        onEvent: async pr => { if (pr.phase === 'intro' && !intro.length) intro.push(pr.talkie.lineCount); },
      });
      const expectedIntro = blindIntro(1, rd.intro.blind);
      assert(expectedIntro.length === rd.intro.blind.length - 1 && !expectedIntro.some(l => /bonus/i.test(l)), 'the bonus line is not dropped by the rule');
      assert(intro[0] === expectedIntro.length, `the blind intro had ${intro[0]} lines, expected ${expectedIntro.length}`);
      assert(p.answers.length === 4 && p.answers.every(a => a.blind && a.cpu === null), 'blind answers should have no CPU turn');
      assert(p.scores.player === start.player && p.scores.cpu === start.cpu, `blind round changed the scores: ${p.scores.player}/${p.scores.cpu}`);
      assert(p.talkie.statement === 'Step right this way and prepare to enter the world of microbes!', `last line: ${p.talkie.statement}`);
      const r = await page.evaluate(() => window.__gsResults);
      assert(r.length === 1 && r[0].blind === true && r[0].playerScore === start.player && r[0].cpuScore === start.cpu, `blind result ${JSON.stringify(r)}`);
      assert(!p.log.some(e => /^cpu/.test(e[1])), 'a CPU turn happened in the blind half');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'talkie: 1 character per 40 ms, first press completes, second advances, arrow only when complete; text size pages long lines',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 4, avatar: 'harry', seed: 1 });
      await step(page, 30);
      await page.keyboard.press('Enter');
      await step(page, 1);
      let p = await probe(page);
      assert(p.phase === 'intro' && p.talkie.lineIndex === 0, `title did not lead to the intro (phase ${p.phase})`);
      assert(p.talkie.shown <= 1, `the press that closed the title also typed or skipped the line (shown ${p.talkie.shown})`);
      const s0 = p.talkie.shown;
      await step(page, 16);
      p = await probe(page);
      assert(p.talkie.shown - s0 === 6, `16 ticks (240 ms) typed ${p.talkie.shown - s0} characters, expected 6`);
      assert(!p.talkie.arrow && !p.talkie.complete, 'the arrow shows while typing');
      await page.keyboard.press('Space');
      await step(page, 1);
      p = await probe(page);
      assert(p.talkie.complete && p.talkie.arrow && p.talkie.lineIndex === 0, 'the first press did not complete the line');
      await page.keyboard.press('Enter');
      await step(page, 1);
      p = await probe(page);
      assert(p.talkie.lineIndex === 1 && !p.talkie.complete, 'the second press did not advance');
      // Largest text size: the talkie pages long lines instead of overflowing, the board shrinks.
      await page.evaluate(() => window.__test.app.settings.set('textScale', 2));
      for (let i = 0; i < 400; i++) {
        p = await probe(page);
        if (p.phase === 'ask') break;
        await page.keyboard.press('Enter');
        await step(page, 2);
      }
      p = await probe(page);
      assert(p.phase === 'ask' && p.talkie.fontSize === 40, `not asking at text size 200% (phase ${p.phase}, font ${p.talkie.fontSize})`);
      assert(p.talkie.pageCount > 1 && p.talkie.lines.length <= 2, `a long question at 200% gave ${p.talkie.pageCount} pages of ${p.talkie.lines.length} lines`);
      const pages = [];
      for (let i = 0; i < 20 && (await probe(page)).phase === 'ask'; i++) {
        const q = await probe(page);
        if (!pages.includes(q.talkie.pageText)) pages.push(q.talkie.pageText);
        await page.keyboard.press('Enter');
        await step(page, 2);
      }
      const joined = pages.join(' ').replace(/\s+/g, ' ');
      assert(joined === p.talkie.statement.replace(/\s+/g, ' '), `pages lose text:\n${joined}\n${p.talkie.statement}`);
      p = await probe(page);
      assert(p.phase === 'board', `paging did not reach the board (${p.phase})`);
      await step(page, 40);
      p = await probe(page);
      assert(p.board.layout.fits && p.board.layout.size <= 40, 'the board does not fit its text at 200%');
      await page.screenshot({ path: path.join(ctx.shots, 'gameshow-board-textscale-200.png'), scale: 'css' });
      await page.evaluate(() => window.__test.app.settings.set('textScale', null));
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'pause and quit: Esc and the touch pause button pause, Resume resumes, Quit calls onQuit; 44 px targets on a 667x375 phone',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await openShow(ctx, { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { round: 2, avatar: 'amy', seed: 2 });
      const cdp = await context.newCDPSession(page);
      await step(page, 30);
      await page.keyboard.press('Escape');
      await step(page, 1);
      let p = await probe(page);
      assert(p.paused && p.overlay === 'Paused', 'Esc did not pause');
      const tickPaused = p.tick;
      await step(page, 30);
      assert((await probe(page)).tick === tickPaused, 'the show ran while paused');
      await page.keyboard.press('Escape');
      await step(page, 1);
      assert(!(await probe(page)).paused, 'Esc did not resume');
      // Touch: the pause button, then Resume.
      await tapEl(page, cdp, '#gs-pause');
      await step(page, 1);
      assert((await probe(page)).paused, 'the pause button did not pause');
      await page.waitForTimeout(400);
      const sizes = await page.evaluate(() => [...document.querySelectorAll('#ui button')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height }; }));
      for (const b of sizes) assert(b.w >= 44 && b.h >= 44, `${b.id} is ${b.w.toFixed(1)}x${b.h.toFixed(1)} CSS px`);
      await page.screenshot({ path: path.join(ctx.shots, 'gameshow-paused.png'), scale: 'css' });
      await tapEl(page, cdp, '#gs-resume');
      await step(page, 1);
      assert(!(await probe(page)).paused, 'Resume did not resume');
      // Board buttons on this small phone.
      for (let i = 0; i < 300 && (await probe(page)).phase !== 'board'; i++) { await tapEl(page, cdp, (await probe(page)).phase === 'title' ? '#gs-stage-tap' : '#gs-talkie-tap'); await step(page, 3); }
      await step(page, 30);
      for (const sel of ['#gs-answer-1', '#gs-answer-2', '#gs-answer-3']) {
        const b = await page.locator(sel).boundingBox();
        assert(b && b.width >= 44 && b.height >= 44, `${sel} too small on 667x375`);
      }
      // Quit from the pause menu.
      await tapEl(page, cdp, '#gs-pause');
      await step(page, 1);
      await page.waitForTimeout(400);
      await tapEl(page, cdp, '#gs-quit');
      await step(page, 1);
      assert((await page.evaluate(() => window.__gsQuit)) === 1, 'Quit did not call onQuit');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'standalone ?scene=gameshow: plays with no callback and ends on the results card',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await ctx.openPage(DESKTOP);
      await page.goto(`${ctx.baseUrl}/index.html?scene=gameshow&round=3&avatar=amy&nickname=Zoe&seed=9&manual=1`);
      await page.waitForFunction(() => { const p = window.__test && window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 20000 });
      await step(page, 60);
      await page.screenshot({ path: path.join(ctx.shots, 'gameshow-title.png'), scale: 'css' });
      let shot = false;
      const { probe: p } = await playRound(page, {
        mode: 'keyboard',
        choose: pr => ({ index: buttonFor(pr, 1), how: 'digit' }),
        onEvent: async pr => {
          if (pr.phase === 'response' && !shot) {
            // The gallery shot: the player's verdict just landed (confetti, +10, happy faces).
            shot = true;
            for (let k = 0; k < 400 && (await probe(page)).pendingVerdict; k++) await step(page, 2);
            await step(page, 18);
            const v = await probe(page);
            assert(!v.board.visible && v.studio.host === 'excited' && v.fx.popups > 0, `verdict moment: board ${v.board.visible}, host ${v.studio.host}, popups ${v.fx.popups}`);
            await page.screenshot({ path: path.join(ctx.shots, 'gameshow-verdict.png'), scale: 'css' });
          }
          if (pr.phase === 'board' && pr.questionIndex === 0) { await step(page, 40); await page.screenshot({ path: path.join(ctx.shots, 'gameshow-board.png'), scale: 'css' }); }
        },
      });
      assert(p.answers.every(a => a.value === 1), 'a correct answer was not scored as correct');
      await step(page, 10);
      await page.waitForTimeout(400);
      assert((await probe(page)).overlay === 'Round complete!', 'no results card');
      assert(await page.locator('#gs-next-round').count() === 1, 'no Next round button');
      await page.screenshot({ path: path.join(ctx.shots, 'gameshow-results.png'), scale: 'css' });
      await page.keyboard.press('Enter');
      await step(page, 40);
      await page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready && p.round === 4; }, null, { timeout: 20000 });
      const next = await probe(page);
      assert(next.startScores.player === p.scores.player && next.startScores.cpu === p.scores.cpu, 'Next round did not carry the scores');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'standalone with the blind-rounds setting on: the warm-up half first, then on to the scored questions',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await ctx.openPage(DESKTOP);
      // Setting off (or never set): the scored half, as the live 2009 build.
      await page.goto(`${ctx.baseUrl}/index.html?scene=gameshow&round=2&avatar=harry&seed=4&manual=1`);
      await page.waitForFunction(() => { const p = window.__test && window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 20000 });
      assert(!(await probe(page)).blind, 'blind with the setting unset');
      // Setting on: the warm-up (blind) half.
      await page.evaluate(() => window.__test.app.settings.set('blindRounds', true));
      await page.evaluate(() => window.__test.go('gameshow', { round: 2, avatar: 'harry', seed: 4 }));
      await page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 20000 });
      let p = await probe(page);
      assert(p.blind, 'standalone did not follow blindRounds = true');
      const { probe: end } = await playRound(page, { mode: 'keyboard', choose: pr => ({ index: 0, how: 'digit' }) });
      assert(end.answers.every(a => a.blind && a.cpu === null) && end.scores.player === 0 && end.scores.cpu === 0, 'the warm-up half scored');
      await step(page, 10);
      await page.waitForTimeout(400);
      assert((await probe(page)).overlay === 'Warm-up done!', 'no warm-up results card');
      await page.keyboard.press('Enter');
      // The card's button starts a new scene through a transition: step the frozen loop while the
      // new round loads.
      for (let k = 0; k < 200; k++) {
        p = await probe(page);
        if (p && p.ready && !p.blind && p.phase === 'title') break;
        await step(page, 4);
        await page.waitForTimeout(20);
      }
      p = await probe(page);
      assert(p.round === 2 && !p.blind, `the scored half did not follow (round ${p.round}, blind ${p.blind})`);
      // A flow launch always wins over the setting: blind: false stays sighted.
      await page.evaluate(() => window.__test.go('gameshow', { round: 2, avatar: 'harry', seed: 4, blind: false, onComplete: () => {} }));
      await page.waitForFunction(() => { const p = window.__test.probe('gameshow'); return p && p.ready; }, null, { timeout: 20000 });
      assert(!(await probe(page)).blind, 'blind: false from the flow was overridden by the setting');
      await page.evaluate(() => window.__test.app.settings.set('blindRounds', null));
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'pause: Enter, Space or gamepad A on Resume does not answer the board or advance the host',
    timeoutMs: 90000,
    async run(ctx) {
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 1, avatar: 'harry', nickname: 'Kit', seed: 3 });
      const focusId = () => page.evaluate(() => document.activeElement && document.activeElement.id);
      // Esc pauses (focus goes to Resume), then `key` presses the focused Resume natively.
      const pauseResume = async key => {
        await page.keyboard.press('Escape');
        await step(page, 1);
        assert((await probe(page)).paused, 'Esc did not pause');
        assert((await focusId()) === 'gs-resume', `Resume is not focused (${await focusId()})`);
        await page.keyboard.press(key);
        await step(page, 1);
        assert(!(await probe(page)).paused, `${key} on Resume did not resume`);
      };
      await step(page, 30);
      await page.keyboard.press('Enter');
      await step(page, 6);
      let p = await probe(page);
      assert(p.phase === 'intro' && !p.talkie.complete, `not typing the first intro line (phase ${p.phase})`);
      // While a line types, resuming must not complete it.
      const before = p.talkie;
      for (const key of ['Enter', 'Space']) {
        const was = (await probe(page)).talkie;
        await pauseResume(key);
        p = await probe(page);
        assert(!p.talkie.complete && p.talkie.lineIndex === before.lineIndex && p.talkie.shown - was.shown <= 1, `${key} on Resume reached the talkie: shown ${was.shown} -> ${p.talkie.shown}, complete ${p.talkie.complete}`);
      }
      // A complete line: resuming must not advance it.
      await page.keyboard.press('Enter');
      await step(page, 1);
      assert((await probe(page)).talkie.complete, 'Enter did not complete the line');
      await pauseResume('Enter');
      p = await probe(page);
      assert(p.talkie.complete && p.talkie.lineIndex === before.lineIndex, `Enter on Resume advanced the host (line ${before.lineIndex} -> ${p.talkie.lineIndex})`);
      // The board, with Don't Know selected: resuming must not answer.
      for (let i = 0; i < 400 && (await probe(page)).phase !== 'board'; i++) { await page.keyboard.press('Enter'); await step(page, 2); }
      await step(page, 30);
      for (let k = 0; k < 2; k++) { await page.keyboard.press('ArrowDown'); await step(page, 2); }
      p = await probe(page);
      assert(p.phase === 'board' && p.board.accepting && p.board.selected === 1, `board not ready (phase ${p.phase}, selected ${p.board.selected})`);
      for (const key of ['Enter', 'Space']) {
        await pauseResume(key);
        await step(page, 2);
        p = await probe(page);
        assert(p.phase === 'board' && p.board.locked === -1 && p.answers.length === 0, `${key} on Resume answered: phase ${p.phase}, locked ${p.board.locked}`);
      }
      // Gamepad A on the focused Resume clicks it from inside the tick (ui/dom.js focusNavigator).
      await page.evaluate(() => {
        window.__padA = false;
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0 && window.__padA, value: 0 })) }] });
      });
      await page.keyboard.press('Escape');
      await step(page, 1);
      assert((await probe(page)).paused && (await focusId()) === 'gs-resume', 'Esc did not pause (gamepad check)');
      await page.evaluate(() => { window.__padA = true; });
      await step(page, 1);
      assert(!(await probe(page)).paused, 'gamepad A on Resume did not resume');
      await step(page, 3);
      await page.evaluate(() => { window.__padA = false; });
      await step(page, 3);
      p = await probe(page);
      assert(p.phase === 'board' && p.board.locked === -1 && p.answers.length === 0, `gamepad A on Resume answered: phase ${p.phase}, locked ${p.board.locked}`);
      await page.evaluate(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
      // Play goes on as normal: Enter now picks the selected answer.
      await page.keyboard.press('Enter');
      await step(page, 1);
      p = await probe(page);
      assert(p.phase === 'lockin' && p.board.locked === 1, `Enter after resuming did not answer (phase ${p.phase}, locked ${p.board.locked})`);
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
  {
    name: 'board and prompts: mouse hover selects (Enter picks the lit button); badges and hints follow key bindings and device; labels, name tags, reduced motion, blit cache',
    timeoutMs: 90000,
    async run(ctx) {
      const long = 'Wolfeschlegelsteinhausenb';
      const { context, page, errors } = await openShow(ctx, DESKTOP, { round: 1, avatar: 'amy', nickname: long, seed: 3 });
      let p = await probe(page);
      // Name tags: a 25-character nickname keeps 13 px or more and is cut with an ellipsis.
      const tag = p.studio.tags.amy, other = p.studio.tags.harry;
      assert(tag.size >= 13 && tag.width <= 112 && tag.truncated && tag.text.endsWith('…') && long.startsWith(tag.text.slice(0, -1)), `long name tag ${JSON.stringify(tag)}`);
      assert(other.text === 'Harry' && other.size === 15 && !other.truncated, `short name tag ${JSON.stringify(other)}`);
      // The title prompt follows the confirm binding and the device.
      await step(page, 60);
      const setDevice = d => page.evaluate(v => window.__test.app.input._setDevice(v), d);
      p = await probe(page);
      assert(p.titleHint === 'Press Enter to start', `keyboard title hint: ${p.titleHint}`);
      await setDevice('gamepad');
      assert((await probe(page)).titleHint === 'Press A to start', 'gamepad title hint');
      await setDevice('touch');
      assert((await probe(page)).titleHint === 'Tap to start', 'touch title hint');
      await setDevice('keyboard');
      for (let i = 0; i < 400 && (await probe(page)).phase !== 'board'; i++) { await page.keyboard.press('Enter'); await step(page, 2); }
      await step(page, 40);
      p = await probe(page);
      assert(p.phase === 'board' && p.board.accepting, `no board (phase ${p.phase})`);
      assert(p.board.hint === 'Press 1, 2 or 3, or use ↑ ↓ and Enter', `keyboard hint: ${p.board.hint}`);
      assert(p.board.badges.join() === '1,2,3', `badges ${p.board.badges}`);
      assert(p.board.layout.labels.every(l => l.size === 23 && l.fits), `labels ${JSON.stringify(p.board.layout.labels)}`);
      const art = () => page.evaluate(async () => (await import('./js/gameshow/art.js')).blitCount());
      assert((await art()) > 0, 'no pre-scaled copies while the studio shows');
      // Mouse over Disagree selects it and focuses it; an arrow then moves both, and the hover
      // light goes, so only one button is ever lit.
      const focusId = () => page.evaluate(() => document.activeElement && document.activeElement.id);
      const centre = async i => { const b = await page.locator(`#gs-answer-${i}`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      await page.mouse.move(...(await centre(3)));
      await step(page, 1);
      p = await probe(page);
      assert(p.board.selected === 2 && p.board.hover === 2 && (await focusId()) === 'gs-answer-3', `hover did not select: selected ${p.board.selected}, hover ${p.board.hover}, focus ${await focusId()}`);
      await page.keyboard.press('ArrowUp');
      await step(page, 2);
      p = await probe(page);
      assert(p.board.selected === 1 && p.board.hover === -1 && (await focusId()) === 'gs-answer-2', `arrow after hover: selected ${p.board.selected}, hover ${p.board.hover}, focus ${await focusId()}`);
      const [x1, y1] = await centre(1);
      await page.mouse.move(x1, y1, { steps: 5 });
      await step(page, 1);
      p = await probe(page);
      assert(p.board.selected === 0 && (await focusId()) === 'gs-answer-1', `hover on Agree did not select it (selected ${p.board.selected})`);
      // Remapped answer 1: the badge and the hint show the new key.
      const keys = await page.evaluate(() => window.__test.app.settings.get('keys'));
      await page.evaluate(k => window.__test.app.settings.set('keys', { ...k, answer1: ['KeyQ'] }), keys);
      await step(page, 1);
      p = await probe(page);
      assert(p.board.badges.join() === 'Q,2,3' && p.board.hint.startsWith('Press Q, 2 or 3'), `after remapping: ${p.board.badges} / ${p.board.hint}`);
      await page.screenshot({ path: path.join(ctx.shots, 'gameshow-board-hover.png'), scale: 'css' });
      await page.keyboard.press('Enter');
      await step(page, 1);
      p = await probe(page);
      assert(p.phase === 'lockin' && p.board.locked === 0, `Enter did not pick the lit answer: locked ${p.board.locked}`);
      await page.evaluate(k => window.__test.app.settings.set('keys', k), keys);
      // The pause card does not bounce in when the game's own reduced-motion setting is on.
      await page.evaluate(() => window.__test.app.settings.set('reducedMotion', true));
      const byFlow = await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'));
      if (!byFlow) await page.evaluate(() => document.documentElement.classList.add('reduced-motion'));
      await page.keyboard.press('Escape');
      await step(page, 1);
      const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.gs-card')).animationName);
      assert(anim === 'none', `pause card animation with reduced motion on: ${anim}`);
      await page.keyboard.press('Escape');
      await step(page, 1);
      await page.evaluate(() => window.__test.app.settings.set('reducedMotion', null));
      // Leaving the show frees the pre-scaled copies.
      await page.evaluate(() => window.__test.go('splash', {}));
      assert((await art()) === 0, 'the pre-scaled copies were kept after the game show exited');
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      ctx.log(`long tag "${tag.text}" at ${tag.size}px; reduced-motion class ${byFlow ? 'set by the flow' : 'added by the test'}`);
      await context.close();
    },
  },
];
