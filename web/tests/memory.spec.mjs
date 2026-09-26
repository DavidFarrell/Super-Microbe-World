// Texture memory across a whole journey (NOTES 8.4): decoded atlas pages cost width x height x 4
// bytes each, and iOS Safari evicts or crashes a page long before 400-500 MB. The flow closes the
// atlases the next screen does not use at every scene change (flow.js keepFor, sprites.release),
// so the decoded bytes must stay under BUDGET at every step of a journey: splash, cutscene, each
// shrinking zone, all ten levels, the four kitchen levels, every quiz and the ending. The steps are
// driven through the flow's own scene callbacks (as the scenes call them when finished), with
// every screen given time to load and decode its art (and the art the flow decodes ahead).
// A released atlas must draw again when it is needed later: the second quiz redraws the studio.
const DESKTOP = { viewport: { width: 1280, height: 720 } };
const BUDGET = 150 * 1048576;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const MB = n => (n / 1048576).toFixed(1);

// The atlas store now: decoded bytes, loaded ids, and loads still running.
const store = page => page.evaluate(async () => {
  const { sprites } = await import('./js/platformer/sprites.js');
  const loaded = [...sprites.decoded.keys()].sort();
  const pending = [...sprites.atlasLoads.keys()].filter(id => !sprites.decoded.has(id) && !sprites.failed.has(id));
  return { bytes: sprites.decodedBytes(), loaded, pending };
});

// Waits for `scene` to be on screen with every art load settled (and still settled a moment later).
async function settle(page, scene) {
  for (let i = 0; ; i++) {
    if (await page.evaluate(n => window.__test.scene === n && !window.__test.transitioning, scene)) break;
    if (i > 500) throw new Error(`timed out waiting for ${scene} (scene ${await page.evaluate(() => window.__test.scene)})`);
    await step(page, 4);
  }
  let last = '', same = 0;
  for (let i = 0; i < 200 && same < 3; i++) {
    await step(page, 4);
    await page.waitForTimeout(60);
    const s = await store(page);
    const key = s.loaded.join() + '|' + s.pending.join();
    same = s.pending.length === 0 && key === last ? same + 1 : 0;
    last = key;
  }
  return store(page);
}

const callLast = (page, name, cb, arg) => page.evaluate(([n, c, a]) => window.__launches.filter(x => x.name === n).pop().params[c](a), [name, cb, arg]);

export const tests = [
  {
    name: 'decoded atlas memory stays under 150 MB at every scene of a journey; released art draws again',
    timeoutMs: 240000,
    async run(ctx) {
      const { context, page, errors } = await ctx.openPage(DESKTOP);
      await page.goto(`${ctx.baseUrl}/index.html?manual=1&lang=en&seed=5`);
      await page.waitForFunction(() => window.__test && window.__test.scene, null, { timeout: 20000 });
      await page.evaluate(() => {
        const sc = window.__test.app.scenes;
        const go = sc.go.bind(sc);
        window.__launches = [];
        sc.go = (name, params, style) => { window.__launches.push({ name, params }); return go(name, params, style); };
      });
      const rows = [];
      const record = async (label, scene) => {
        const s = await settle(page, scene);
        rows.push({ label, ...s });
        assert(s.bytes <= BUDGET, `${label}: ${MB(s.bytes)} MB decoded (${s.loaded.join(', ')})`);
        return s;
      };
      await record('splash', 'splash');
      await page.evaluate(() => window.__test.app.flow.newGame());
      await record('cutscene', 'cutscene');
      await callLast(page, 'cutscene', 'onComplete', { avatar: 'harry', nickname: 'Sam' });
      const table = await page.evaluate(() => window.__test.app.flow.roundTable());
      let quizzes = 0;
      for (const round of table.rounds) {
        await record(`shrink ${round.number}`, 'shrink');
        await callLast(page, 'shrink', 'onComplete', {});
        const scene = round.kind === 'kitchen' ? 'kitchen' : 'platform';
        for (const id of round.levels) {
          const s = await record(id, scene);
          if (scene === 'platform') {
            const p = await page.evaluate(() => window.__test.probe('platform'));
            assert(p && p.ready && p.level === id, `${id} did not load`);
            assert(s.loaded.includes('hud') && s.loaded.includes('player-harry'), `${id}: ${s.loaded.join(', ')}`);
          }
          await callLast(page, scene, 'onComplete', { score: 100 * (rows.length + 1) });
        }
        const s = await record(`quiz ${round.number}`, 'gameshow');
        assert(s.loaded.includes('gameshow-cast') && s.loaded.includes('gameshow-bg'), `quiz ${round.number}: ${s.loaded.join(', ')}`);
        const drawn = await page.evaluate(async () => (await import('./js/gameshow/art.js')).hasArt('gs_host'));
        assert(drawn, `quiz ${round.number}: the host has no art`);
        quizzes++;
        await callLast(page, 'gameshow', 'onComplete', { playerScore: 10 * quizzes, cpuScore: 5 * quizzes });
      }
      await record('ending', 'ending');
      const peak = rows.reduce((m, r) => (r.bytes > m.bytes ? r : m));
      ctx.log(`peak ${MB(peak.bytes)} MB at ${peak.label}; budget ${MB(BUDGET)} MB`);
      ctx.log(rows.map(r => `${r.label} ${MB(r.bytes)}`).join(', '));
      assert(errors.length === 0, `errors: ${errors.join(' | ')}`);
      await context.close();
    },
  },
];
