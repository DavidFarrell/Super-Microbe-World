// Levels 1-10 end to end.
//   (a) Every level's winning input trace (web/tests/traces/<level>.json, recorded from the
//       planning bot by web/tests/bots/record-traces.mjs) is replayed from a fresh load through
//       injected input only (__test.hold + __test.step, one engine tick at a time, ?manual=1) and
//       must complete the level with the recorded score, lives and step count.
//   (b) Determinism: one trace replayed twice from fresh loads gives the same simulation state
//       at every checkpoint.
//   (c) Data checks for every level: goal targets placed in sufficient numbers, one player start
//       and one exit, the player lands on solid ground, nothing spawns inside a solid tile
//       (documented original quirks listed), and every placed tile and entity has art in the
//       level's atlas set.
//   (d) Each level's ePhone briefing plays with real key presses, shows its pages with
//       device-aware prompts, and the ePhone status screen shows the level's goal picture.
import fs from 'node:fs';
import path from 'node:path';
import { PlatformGame } from '../js/platformer/game.js';
import { T, G, TILE } from '../js/platformer/constants.js';

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const probe = page => page.evaluate(() => window.__test.probe('platform'));
const step = (page, n = 1) => page.evaluate(k => window.__test.step(k), n);
const DESKTOP = { viewport: { width: 1280, height: 720 } };

const readJson = (ctx, rel) => JSON.parse(fs.readFileSync(path.join(ctx.web, rel), 'utf8'));
const LEVELS = Array.from({ length: 10 }, (_, i) => `alpha_level${i + 1}`);

async function openTrace(ctx, trace) {
  const { context, page, errors } = await ctx.openPage(DESKTOP);
  await page.goto(`${ctx.baseUrl}/index.html?${trace.query}`);
  await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
  const p = await probe(page);
  const tick = await page.evaluate(() => window.__test.tick);
  assert(p.stepCount === 0 && tick === 0, `the loop ran before the replay took over (step ${p.stepCount}, tick ${tick})`);
  assert(p.ui === 'play', `the trace's query should start in play (ui ${p.ui})`);
  return { context, page, errors };
}

// Replays log[from .. to) one engine tick at a time; returns the probe afterwards.
function replay(page, log, from = 0, to = log.length) {
  return page.evaluate(({ log, from, to }) => {
    const T = window.__test;
    for (let i = from; i < to; i++) { T.hold(log[i] ? log[i].split(',') : []); T.step(1); }
    return T.probe('platform');
  }, { log, from, to });
}

// The simulation's state in a probe (cosmetic fields such as particles, popups, hit-stop and
// the HUD's eased counters are left out).
function simState(p) {
  return JSON.stringify({
    state: p.state, stepCount: p.stepCount, timeLeftSteps: p.timeLeftSteps, score: p.score, lives: p.lives,
    goals: p.goals, portalOpen: p.portalOpen, exitReason: p.exitReason, camera: p.camera,
    player: p.player,
    entities: p.entities.map(e => [e.id, e.typeId, e.state, e.x, e.y, e.alive, e.onScreen, e.photographed]),
  });
}

const replayTests = LEVELS.map(level => ({
  name: `(a) trace replay: ${level} completes from a fresh load with injected input`,
  timeoutMs: 120000,
  async run(ctx) {
    const trace = readJson(ctx, `tests/traces/${level}.json`);
    assert(trace.format === 'smw-trace/1' && trace.level === level && Array.isArray(trace.log) && trace.seed != null, 'bad trace file');
    const { context, page, errors } = await openTrace(ctx, trace);
    await page.evaluate(() => window.__test.releaseAll());
    const p = await replay(page, trace.log);
    const f = trace.final;
    assert(p.state === 'complete', `${level}: ended in ${p.state} at step ${p.stepCount} (goal ${p.goals[0].achieved}/${p.goals[0].required}, lives ${p.lives})`);
    assert(p.stepCount === f.stepCount && p.score === f.score && p.lives === f.lives && p.goals[0].achieved === f.goal.achieved,
      `${level}: replay differs from the recording: steps ${p.stepCount}/${f.stepCount}, score ${p.score}/${f.score}, lives ${p.lives}/${f.lives}, goal ${p.goals[0].achieved}/${f.goal.achieved}`);
    // The player is drawn into the portal, the iris closes and the level-complete card appears.
    await page.evaluate(() => window.__test.releaseAll());
    const used = await page.evaluate(() => window.__test.stepUntil(t => t.probe('platform').ui === 'complete', 400));
    assert(used >= 0, `${level}: the level-complete card did not appear`);
    assert(await page.locator('#pf-next').count() === 1, `${level}: no Next button on the card`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ctx.shots, `levels-${level}-complete.png`), scale: 'css' });
    assert(errors.length === 0, `${level}: console errors:\n${errors.join('\n')}`);
    ctx.log(`${level}: ${f.stepCount} steps (${trace.ticks} ticks), score ${p.score}, lives ${p.lives}, goal ${p.goals[0].achieved}/${p.goals[0].required}`);
    await context.close();
  },
}));

export const tests = [
  ...replayTests,
  {
    name: '(b) determinism: the level 10 trace replayed twice gives identical states at every checkpoint',
    timeoutMs: 120000,
    async run(ctx) {
      const trace = readJson(ctx, 'tests/traces/alpha_level10.json');
      const runs = [];
      for (let k = 0; k < 2; k++) {
        const { context, page, errors } = await openTrace(ctx, trace);
        const states = [];
        for (let i = 0; i < trace.log.length; i += 40) states.push(simState(await replay(page, trace.log, i, Math.min(trace.log.length, i + 40))));
        assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
        runs.push(states);
        await context.close();
      }
      assert(runs[0].length === runs[1].length, 'different checkpoint counts');
      for (let i = 0; i < runs[0].length; i++) {
        assert(runs[0][i] === runs[1][i], `the runs differ at checkpoint ${i} (tick ${i * 40 + 40}):\n${runs[0][i].slice(0, 400)}\n${runs[1][i].slice(0, 400)}`);
      }
      const last = JSON.parse(runs[0][runs[0].length - 1]);
      assert(last.state === 'complete', `the run ended in ${last.state}`);
      ctx.log(`${runs[0].length} checkpoints identical; final step ${last.stepCount}, score ${last.score}`);
    },
  },
  {
    name: '(c) level data: goal targets, one start and one exit, spawns clear of solid tiles, the player lands on a tile, art for everything placed',
    async run(ctx) {
      const atlas = readJson(ctx, 'data/atlas/index.json');
      const index = readJson(ctx, 'data/levels/index.json');
      assert(JSON.stringify(index.order) === JSON.stringify(LEVELS), `play order ${index.order}`);
      const GOOD = [T.GOOD_MICROBE, T.GENERIC, T.SANDY, T.PATTY, T.STEVE, T.LUCY];
      const BAD = [T.BAD_MICROBE, T.COLIN, T.SLARG, T.SLURM, T.IGGY, T.DONNA];
      // Microbes whose frame-1 box is wider than their slot and reaches into neighbouring tiles in
      // the original data (the microbe falls and walks out of it; section 3.17 of NOTES.md). Level
      // 4's first Patty reaches into the loaf but also into the cheese below, and the two pushes
      // cancel, so she stays on her spawn cell as in the captures (NOTES-levels-decisions.md 5). The
      // exit portal is not solid and is listed by rule below.
      const KNOWN_OVERLAPS = new Set([
        'alpha_level4 patty_icon@(4,11) loaf_end_L_obj@(4,14)',
        'alpha_level5 slurm_icon@(5,39) spot_small_obj@(6,40)',
        'alpha_level6 slarg_icon@(3,43) skin_surface_tile@(7,43)', 'alpha_level6 slarg_icon@(3,43) skin_surface_tile@(7,44)',
      ]);
      const seen = new Set();
      const report = [];
      for (const name of LEVELS) {
        const L = readJson(ctx, `data/levels/${name}.json`);
        const n = name.replace('alpha_level', '');
        const def = id => L.palette[id];
        const ents = L.entities.map(([r, c, id]) => ({ r, c, id, ...def(id) }));
        const count = pred => ents.filter(pred).length;
        // One player start (matching playerStart) and one exit portal.
        const starts = ents.filter(e => e.type === T.PLAYER);
        assert(starts.length === 1 && starts[0].r === L.playerStart.row && starts[0].c === L.playerStart.col, `${name}: ${starts.length} player starts`);
        assert(count(e => e.type === T.PORTAL_EXIT) === 1, `${name}: ${count(e => e.type === T.PORTAL_EXIT)} exit portals`);
        assert(count(e => e.type === T.PORTAL_ENTRANCE) === 0, `${name}: has an entrance portal`);
        // Goal targets.
        assert(L.goals.length === 1, `${name}: ${L.goals.length} goals`);
        const g = L.goals[0];
        const targets = {
          [G.PHOTOGRAPH_SPECIFIC]: () => count(e => e.type === g.microbeType),
          [G.PHOTOGRAPH_GOOD]: () => count(e => GOOD.includes(e.type)),
          [G.PHOTOGRAPH_ANY]: () => count(e => GOOD.includes(e.type) || BAD.includes(e.type) || e.type === T.SUPERINFECTION),
          [G.KILL_ALL]: () => count(e => BAD.includes(e.type)),
          [G.ANTIBIOTIC]: () => count(e => e.type === T.ANTIBIOTIC_PICKUP),
          [G.YOGURT]: () => Math.min(count(e => e.type === T.MILK), count(e => e.type === T.LUCY)),
        }[g.goalType];
        assert(targets, `${name}: goal type ${g.goalType} can never be met (unimplemented in the original)`);
        assert(targets() >= g.required, `${name}: goal ${g.goalType} needs ${g.required}, only ${targets()} placed`);
        // Spawns: no entity anchor on a solid tile anchor; no box inside a solid tile except the
        // known cases. The portal is not solid: its 103.6 x 163.8 art may reach 3.6 px into the
        // next column and 13.8 px into the floor below (tiles are drawn over it, as in the SWF).
        const solid = L.tiles.filter(([r, c]) => r >= 0 && r < Math.min(L.rows, 9) && c >= 0 && c <= L.cols)
          .map(([r, c, id]) => ({ r, c, m: def(id).movie, x0: c * TILE, y0: r * TILE, x1: c * TILE + def(id).w, y1: r * TILE + def(id).h }));
        const anchors = new Set(solid.map(t => `${t.r},${t.c}`));
        for (const e of ents) {
          assert(!anchors.has(`${e.r},${e.c}`), `${name}: ${e.movie} at (${e.r},${e.c}) sits on a tile anchor`);
          if (e.w == null) continue;
          const b = e.type === T.PLAYER ? { x0: e.c * TILE, y0: e.r * TILE, x1: e.c * TILE + 49, y1: e.r * TILE + 100 } : { x0: e.c * TILE, y0: e.r * TILE, x1: e.c * TILE + e.w, y1: e.r * TILE + e.h };
          for (const t of solid) {
            const ox = Math.min(b.x1, t.x1) - Math.max(b.x0, t.x0), oy = Math.min(b.y1, t.y1) - Math.max(b.y0, t.y0);
            if (ox <= 0.5 || oy <= 0.5) continue;
            const key = `${name} ${e.movie}@(${e.r},${e.c}) ${t.m}@(${t.r},${t.c})`;
            if (e.type === T.PORTAL_EXIT) { assert(ox <= 3.61 || (oy <= 13.81 && t.y0 > b.y0), `${key}: the portal overlaps by ${ox.toFixed(1)} x ${oy.toFixed(1)}`); continue; }
            assert(KNOWN_OVERLAPS.has(key), `${key}: spawns ${ox.toFixed(1)} x ${oy.toFixed(1)} px inside a solid tile`);
            seen.add(key);
          }
        }
        // The player falls from player_start onto a tile (not the world floor at y 350).
        const game = new PlatformGame(L);
        game.start();
        for (let i = 0; i < 80; i++) game.step({});
        const pb = game.player.particle;
        assert(pb.supported && pb.position.y < 349.5 && game.player.lives === 3, `${name}: the player did not land on a tile (y ${pb.position.y}, supported ${pb.supported})`);
        // Level 4's first Patty stands on the bread stick at her spawn cell (captures 050, 051),
        // not pushed up into the air by the loaf and the cheese.
        if (name === 'alpha_level4') {
          const patty = game.entities.find(e => e && e.type === T.PATTY);
          assert(patty && Math.abs(patty.particle.position.y - 200) < 0.5, `${name}: the first Patty left her spawn cell (y ${patty && patty.particle.position.y})`);
        }
        // Art: every placed tile and entity (not the start marker) draws from the level's set.
        const set = new Set([...(atlas.sets['level' + n] || []), 'hud', 'entities']);
        for (const m of new Set([...L.tiles, ...L.entities].map(([, , id]) => def(id).movie))) {
          if (m === 'player_start') continue;
          assert(atlas.symbols[m] && set.has(atlas.symbols[m]), `${name}: ${m} has no art in set level${n}`);
        }
        if (Number(n) > 1) {
          const intro = `level_intros_level${n}`;
          assert(atlas.symbols[intro] && set.has(atlas.symbols[intro]), `${name}: no briefing pages (${intro}) in set level${n}`);
        }
        report.push(`${name} goal ${g.goalType}x${g.required} targets ${targets()}`);
      }
      for (const k of KNOWN_OVERLAPS) assert(seen.has(k), `known overlap no longer in the data: ${k}`);
      ctx.log(report.join('; '));
    },
  },
  {
    name: '(d) briefings: every level\'s ePhone pages play with Space, name the keyboard keys, then the goal picture shows',
    timeoutMs: 240000,
    async run(ctx) {
      const strings = readJson(ctx, 'data/lang/en/levels.json');
      const PICTURES = {
        1: ['lucy_image', 'camera_icon'], 2: ['lucy_image', 'camera_icon'], 3: ['steve_image', 'camera_icon'],
        4: ['portrait:patty', 'camera_icon'], 5: ['slurm_image', 'kill_icon'], 6: ['slurm_image', 'kill_icon'],
        7: ['portrait:iggy', 'kill_icon'], 8: ['milk_image', null], 9: ['milk_image', null], 10: ['superinfection_image', null],
      };
      const PROMPTS = { 5: /Press X to throw soap/, 6: /Press X to throw soap/, 7: /Press X to throw the body's defences/, 10: /Press C to use the antibiotic/ };
      const { context, page, errors } = await ctx.openPage(DESKTOP);
      for (let n = 1; n <= 10; n++) {
        await page.goto(`${ctx.baseUrl}/index.html?scene=platform&level=alpha_level${n}&seed=1&manual=1`);
        await page.waitForFunction(() => window.__test && window.__test.probe('platform') && window.__test.probe('platform').ready, null, { timeout: 30000 });
        const expected = Object.keys(strings).filter(k => new RegExp(`^intro\\.level${n}\\.\\d+$`).test(k)).length;
        assert(expected > 0, `level ${n}: no briefing text in levels.json`);
        await step(page, 60);
        const texts = new Set();
        let pages = 0;
        for (let i = 0; i < 40; i++) {
          const p = await probe(page);
          if (p.ui === 'play') break;
          if (p.intro) { texts.add(p.intro.text); pages = p.intro.pages; }
          await page.keyboard.press('Space');
          await step(page, 12);
        }
        const p = await probe(page);
        assert(p.ui === 'play', `level ${n}: the briefing did not lead to play (ui ${p.ui})`);
        assert(pages === expected && texts.size === expected, `level ${n}: ${texts.size} pages shown of ${pages}, expected ${expected}`);
        assert(![...texts].some(x => /\{|\}/.test(x)), `level ${n}: an unfilled placeholder: ${[...texts].join(' | ')}`);
        if (PROMPTS[n]) assert([...texts].some(x => PROMPTS[n].test(x)), `level ${n}: no keyboard prompt ${PROMPTS[n]} in ${[...texts].join(' | ')}`);
        const [picture, mode] = PICTURES[n];
        assert(p.hud.picture === picture && p.hud.mode === mode, `level ${n}: the ePhone shows ${p.hud.picture} / ${p.hud.mode}, expected ${picture} / ${mode}`);
        if (n === 4 || n === 7) { await step(page, 20); await page.screenshot({ path: path.join(ctx.shots, `levels-level${n}-phone.png`), clip: { x: 1100, y: 440, width: 180, height: 280 } }); }
      }
      assert(errors.length === 0, `console errors:\n${errors.join('\n')}`);
      await context.close();
    },
  },
];
