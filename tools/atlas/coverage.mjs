#!/usr/bin/env node
// Art coverage and budget check for the shipped atlases (dev-only; nothing here ships).
//
//   node tools/atlas/coverage.mjs [--verbose] [--atlas-dir web/data/atlas]
//
// Checks, and prints a table for each:
//  1. index.json: valid, every atlas JSON and WebP page exists, pages are the size the index
//     says, every symbol maps to an atlas that defines it, every set names existing atlases, and
//     every frame, rig part and pose lies inside its page.
//  2. Platform levels (web/data/levels/alpha_level*.json, cross-checked against
//     reference/analysis/levels.json): every tile and entity placed, every symbol the code spawns
//     (projectile, camera flash, antibiotic bomb), the HUD, the goal picture and mode icon, and
//     the intro pages must be renderable from the level's set plus "hud", "entities" and either
//     player set, exactly as web/js/platformer/sprites.js atlasesFor() loads them. For each
//     frame label the platformer plays that the symbol has, the label's frame must draw.
//  3. Screens: splash, cutscene, game show, shrinking zone, kitchen and summary against what
//     reference/analysis/flash-flow.md says each screen shows (the 25 food symbols and the
//     character labels are read from that file).
//  4. Budget per load set: files, WebP bytes, JSON bytes and decoded RGBA, against 12 MB of WebP
//     in total and about 120 MB decoded per set (a level set plus a player set).
// Exits with status 1 when anything fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argAtlas = process.argv.indexOf('--atlas-dir');
const ATLAS = argAtlas > 0 ? path.resolve(process.argv[argAtlas + 1]) : path.join(REPO, 'web/data/atlas');
const LEVELS = path.join(REPO, 'web/data/levels');
const verbose = process.argv.includes('--verbose');
const WEBP_BUDGET = 12e6, DECODED_BUDGET = 120 * 1048576;

const failures = [];
const fail = (area, msg) => failures.push(`${area}: ${msg}`);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------------------------
// WebP canvas size from the RIFF header (VP8, VP8L or VP8X).
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a WebP file');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, kind };
  if (kind === 'VP8L') {
    const v = b.readUInt32LE(21);
    return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, kind };
  }
  if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1, kind };
  throw new Error(`unknown WebP chunk ${kind}`);
}

// ---------------------------------------------------------------------------------------------
// 1. Index and atlases.
let index;
try { index = readJson(path.join(ATLAS, 'index.json')); } catch (e) { console.error(`index.json: ${e.message}`); process.exit(1); }
if (index.format !== 'smw-atlas-index/1') fail('index', `format is ${index.format}`);
const atlases = new Map();   // id -> { data, pages: [{w, h}], files, bytes, jsonBytes, pixels }
const symbolAtlas = new Map(); // symbol -> atlas id (from the atlas JSON files)
let fileCount = 1;           // index.json itself
for (const [id, a] of Object.entries(index.atlases || {})) {
  const jsonFile = path.join(ATLAS, a.json);
  if (!fs.existsSync(jsonFile)) { fail('index', `${id}: ${a.json} is missing`); continue; }
  let data;
  try { data = readJson(jsonFile); } catch (e) { fail('index', `${id}: ${a.json} is not valid JSON (${e.message})`); continue; }
  if (data.format !== 'smw-atlas/1') fail('index', `${id}: format ${data.format}`);
  if (JSON.stringify(data.images) !== JSON.stringify(a.images)) fail('index', `${id}: images differ between index.json and ${a.json}`);
  fileCount++;
  const pages = [];
  let bytes = 0, pixels = 0;
  for (const img of data.images) {
    const f = path.join(ATLAS, img);
    if (!fs.existsSync(f)) { fail('index', `${id}: page ${img} is missing`); pages.push(null); continue; }
    fileCount++;
    bytes += fs.statSync(f).size;
    try { const s = webpSize(f); pages.push(s); pixels += s.w * s.h; } catch (e) { fail('index', `${id}: ${img}: ${e.message}`); pages.push(null); }
  }
  if (a.bytes !== bytes) fail('index', `${id}: bytes ${a.bytes} in index.json, ${bytes} on disk`);
  if (a.pixels !== pixels) fail('index', `${id}: pixels ${a.pixels} in index.json, ${pixels} in the WebP headers`);
  const jsonBytes = fs.statSync(jsonFile).size;
  if (a.jsonBytes != null && a.jsonBytes !== jsonBytes) fail('index', `${id}: jsonBytes ${a.jsonBytes} in index.json, ${jsonBytes} on disk`);
  const names = Object.keys(data.symbols || {});
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...(a.symbols || [])].sort())) fail('index', `${id}: symbol list differs from ${a.json}`);
  for (const n of names) {
    if (symbolAtlas.has(n)) fail('index', `symbol ${n} is in both ${symbolAtlas.get(n)} and ${id}`);
    symbolAtlas.set(n, id);
  }
  // Every rectangle inside its page.
  const inPage = (r, where) => {
    if (!r) return;
    const [img, x, y, w, h] = r, p = pages[img];
    if (!p) { fail('index', `${id}: ${where} uses missing page ${img}`); return; }
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > p.w || y + h > p.h) fail('index', `${id}: ${where} [${x}, ${y}, ${w}, ${h}] is outside page ${img} (${p.w} x ${p.h})`);
  };
  for (const [n, s] of Object.entries(data.symbols || {})) {
    if (!Array.isArray(s.frames) || s.frames.length !== s.frameCount) fail('index', `${id}: ${n} has ${s.frames?.length} frames for frameCount ${s.frameCount}`);
    (s.frames || []).forEach((r, i) => inPage(r, `${n} frame ${i + 1}`));
    if (s.rig) {
      s.rig.parts.forEach((r, i) => inPage(r, `${n} part ${i}`));
      s.rig.poses.forEach((pose, i) => { for (let k = 0; k < pose.length; k += 7) if (!s.rig.parts[pose[k]]) fail('index', `${id}: ${n} pose ${i} uses missing part ${pose[k]}`); });
      s.rig.frames.forEach((p, i) => { if (p != null && !s.rig.poses[p]) fail('index', `${id}: ${n} frame ${i + 1} uses missing pose ${p}`); });
      if (s.rig.frames.length !== s.frameCount) fail('index', `${id}: ${n} rig has ${s.rig.frames.length} frames for frameCount ${s.frameCount}`);
    }
  }
  atlases.set(id, { data, pages, bytes, jsonBytes, pixels, files: 1 + data.images.length });
}
for (const [n, id] of Object.entries(index.symbols || {})) {
  if (symbolAtlas.get(n) !== id) fail('index', `symbols.${n} points to ${id}, but ${symbolAtlas.has(n) ? symbolAtlas.get(n) : 'no atlas'} defines it`);
}
for (const [n, id] of symbolAtlas) if (!index.symbols?.[n]) fail('index', `${n} (in ${id}) is not listed in index.symbols`);
for (const [set, ids] of Object.entries(index.sets || {})) for (const id of ids) if (!atlases.has(id)) fail('index', `set ${set} names missing atlas ${id}`);
for (const k of ['totalBytes', 'totalJsonBytes']) {
  const sum = [...atlases.values()].reduce((t, a) => t + (k === 'totalBytes' ? a.bytes : a.jsonBytes), 0);
  if (index[k] != null && index[k] !== sum) fail('index', `${k} is ${index[k]}, the atlases add up to ${sum}`);
}

// ---------------------------------------------------------------------------------------------
// Symbol checks.
const sym = name => { const id = symbolAtlas.get(name); return id ? { id, s: atlases.get(id).data.symbols[name] } : null; };
const draws = (s, f) => f >= 1 && f <= s.frameCount && (s.frames[f - 1] != null || (s.rig && s.rig.frames[f - 1] != null));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Checks that `name` is renderable from the atlases `ids`: present, at least one frame draws,
// every label in `labels` (a list, or 'all' for every label the symbol has) draws at its start,
// and every frame in `frames` draws. Returns an error string or ''.
function check(name, ids, { labels = [], frames = [], optionalLabels = [] } = {}) {
  const e = sym(name);
  if (!e) return `${name}: in no atlas`;
  if (ids && !ids.includes(e.id)) return `${name}: in ${e.id}, which this set does not load`;
  const s = e.s;
  if (!s.frames.some(Boolean) && !(s.rig && s.rig.frames.some(f => f != null))) return `${name}: no frame draws`;
  const errs = [];
  const want = labels === 'all' ? Object.keys(s.labels || {}) : labels;
  for (const l of want) {
    const f = s.labels?.[l];
    if (f == null) { errs.push(`label ${l} missing`); continue; }
    if (!draws(s, f)) errs.push(`label ${l} (frame ${f}) draws nothing`);
  }
  for (const l of optionalLabels) { const f = s.labels?.[l]; if (f != null && !draws(s, f)) errs.push(`label ${l} (frame ${f}) draws nothing`); }
  const bad = frames.filter(f => !draws(s, f));
  if (bad.length) errs.push(`frames ${compact(bad)} draw nothing`);
  return errs.length ? `${name}: ${errs.join(', ')}` : '';
}
function compact(list) {
  const out = []; let a = null, b = null;
  for (const f of list) { if (a === null) { a = b = f; } else if (f === b + 1) b = f; else { out.push(a === b ? a : `${a}-${b}`); a = b = f; } }
  if (a !== null) out.push(a === b ? a : `${a}-${b}`);
  return out.join(',');
}

// ---------------------------------------------------------------------------------------------
// 2. Platform levels.
const td = readJson(path.join(LEVELS, 'tile_definitions.json'));
const T = td.types;
const levelIndex = readJson(path.join(LEVELS, 'index.json'));
const analysis = readJson(path.join(REPO, 'reference/analysis/levels.json'));
const levelFiles = fs.readdirSync(LEVELS).filter(f => /^alpha_level\d+\.json$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
const listed = new Set([...levelIndex.order, ...(levelIndex.unused || [])]);
for (const f of levelFiles) if (!listed.has(f.replace('.json', ''))) fail('levels', `${f} is not in levels/index.json order or unused`);
for (const n of listed) if (!levelFiles.includes(n + '.json')) fail('levels', `levels/index.json lists ${n}, which has no file`);

// Labels the platformer plays (web/js/platformer entities.js, actors.js, game.js), by role;
// checked only where the symbol has them, because Flash ignores a gotoAndPlay to a missing
// label (Slarg has no "walk", no clip has "fall", white_projectile has no "shoot").
const PLAYED = {
  microbe: ['idle', 'walk', 'slide', 'be_photographed', 'be_hit', 'be_killed', 'be_washed_away', 'dive',
    'idle_1', 'idle_2', 'idle_3', 'idle_4', 'be_hit_1', 'be_hit_2', 'be_hit_3'],
  milk: ['start', 'tickle', 'return_to_start', 'yogurt'],
  bullet: ['shoot', 'splat'],
};
const roleOf = type => type === T.MILK ? 'milk' : type >= T.LUCY && type <= T.SUPERINFECTION && type !== T.ANTIBIOTIC_PICKUP && type !== T.ANTIBIOTIC_BOMB ? 'microbe' : null;
// The HUD (web/js/platformer/hud.js) and the level background (render.js).
const HUD = { heart: {}, heart_half: {}, score: {}, digit: { labels: 'all' }, timer: {}, e_phone: { frames: [2, 30] },
  status: {}, status_background: {}, exit_status: {}, tick_box_button: { labels: ['grey', 'tick', 'cross', 'empty'] }, level_background: {} };
const PLAYER = { lower: ['idle', 'move', 'accelerate_start', 'decelerate_start', 'jump_start', 'jump_end'],
  upper: ['idle', 'move', 'accelerate_start', 'decelerate_start', 'take_photo_start', 'hurt', 'shoot_soap'] };
// Goal picture and mode icon, as hud.js goalImage()/goalMode() (PlatformGame.as:331-362).
const G = { PHOTOGRAPH_SPECIFIC: 0, PHOTOGRAPH_GOOD: 1, KILL_ALL: 4, ANTIBIOTIC: 6, YOGURT: 7 };
const GOAL_IMAGE = { [T.LUCY]: 'lucy_image', [T.STEVE]: 'steve_image', [T.SANDY]: 'sandy_image', [T.SLARG]: 'slarg_image', [T.SLURM]: 'slurm_image' };
const goalImage = g => g.goalType === G.PHOTOGRAPH_GOOD ? 'lucy_image' : g.goalType === G.PHOTOGRAPH_SPECIFIC ? (GOAL_IMAGE[g.microbeType] || 'status_background')
  : g.goalType === G.YOGURT ? 'milk_image' : g.goalType === G.ANTIBIOTIC ? 'superinfection_image' : 'slurm_image';
const goalMode = g => (g.goalType === G.YOGURT || g.goalType === G.ANTIBIOTIC) ? null : g.goalType === G.KILL_ALL ? 'kill_icon' : 'camera_icon';

const introLabels = new Map((analysis.introLabels?.labels || []).map(l => [l.label, l.frame]));
const introStarts = [...introLabels.values()].sort((a, b) => a - b);
const levelRows = [];
let colinPlaced = [];
for (const file of levelFiles) {
  const lv = readJson(path.join(LEVELS, file));
  const n = +file.match(/\d+/)[0];
  const area = `level ${n}`;
  const setName = 'level' + n;
  const own = index.sets?.[setName];
  if (!own) { fail(area, `no "${setName}" set in index.json`); continue; }
  const common = [...own, 'hud', 'entities'];
  const row = { level: n, set: setName, tiles: [0, 0], entities: [0, 0], code: [0, 0], hud: [0, 0], intro: '-', errors: [] };
  const tally = (k, err) => { row[k][1]++; if (err) row.errors.push(err); else row[k][0]++; };
  const movieOf = id => { const p = lv.palette?.[id]; const d = td.definitions[id]; return p ? p.movie : d?.movie; };
  // Tiles, and cross-check with the analysis of the original XML.
  const usedMovies = new Set();
  const tileIds = [...new Set(lv.tiles.map(t => t[2]))];
  for (const id of tileIds) {
    const m = movieOf(id);
    if (!m || m === 'null') { if (id !== 69) row.errors.push(`tile id ${id} has no movie`); continue; }
    usedMovies.add(m);
    tally('tiles', check(m, common));
  }
  // Entities.
  const entIds = [...new Set(lv.entities.map(t => t[2]))];
  let hasAntibiotic = false;
  for (const id of entIds) {
    const d = td.definitions[id], m = movieOf(id);
    if (d.type === T.COLIN) colinPlaced.push(`${file} (${m})`);
    if (d.type === T.PLAYER) { // the avatar: both player sets
      usedMovies.add(m);
      for (const who of ['harry', 'amy']) {
        const ids = [...common, ...(index.sets['player-' + who] || [])];
        tally('entities', check(`${who}_lower`, ids, { labels: PLAYER.lower }));
        tally('entities', check(`${who}_upper`, ids, { labels: PLAYER.upper }));
      }
      continue;
    }
    if (!m || m === 'null') { row.errors.push(`entity id ${id} (${d.typeName}) has no movie`); continue; }
    usedMovies.add(m);
    if (d.type === T.ANTIBIOTIC_PICKUP) hasAntibiotic = true;
    tally('entities', check(m, common, { optionalLabels: PLAYED[roleOf(d.type)] || [] }));
  }
  for (const u of analysis.movieUsageCanonical || []) {
    if (u.perLevel?.[`alpha_level${n}.xml`] && !usedMovies.has(u.movie)) row.errors.push(`levels.json places ${u.movie}, the web level does not`);
  }
  // Spawned by code.
  tally('code', check(lv.bodyLevel ? 'white_projectile' : 'soap_projectile', common, { optionalLabels: PLAYED.bullet }));
  tally('code', check('camera_flash', common));
  if (hasAntibiotic) tally('code', check('antibiotic_pickup', common)); // the thrown bomb and the HUD counter
  // HUD, goal picture and mode icon.
  for (const [name, opts] of Object.entries(HUD)) tally('hud', check(name, common, opts));
  for (const g of lv.goals || []) {
    tally('hud', check(goalImage(g), common, { labels: [] }));
    const mode = goalMode(g);
    if (mode) tally('hud', check(mode, common));
  }
  // Intro pages: level_intros_<title>, with level_intros for level 1.
  const start = introLabels.get(lv.title);
  if (start == null) row.intro = (lv.intro || []).length ? 'MISSING label' : 'none (as original)';
  else {
    // The pages run from the label to the frame script that sets finished = true.
    const name = sym(`level_intros_${lv.title}`) ? `level_intros_${lv.title}` : 'level_intros';
    const scripts = sym(name)?.s.scripts || {};
    const next = introStarts.find(f => f > start);
    const end = Object.keys(scripts).map(Number).sort((a, b) => a - b)
      .find(f => f >= start && scripts[f].some(op => op[0] === 'set' && op[1] === 'finished' && op[2] === true)) || (next ? next - 1 : start);
    const err = check(name, common, { frames: range(start, end) });
    if (err) row.errors.push(err);
    row.intro = err ? 'FAIL' : `${name} ${start}-${end}`;
  }
  levelRows.push(row);
  for (const e of row.errors) fail(area, e);
}

// ---------------------------------------------------------------------------------------------
// 3. Screens (reference/analysis/flash-flow.md).
const flow = fs.readFileSync(path.join(REPO, 'reference/analysis/flash-flow.md'), 'utf8');
const section = (from, to) => { const a = flow.indexOf(from), b = flow.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error(`flash-flow.md: section ${from} not found`); return flow.slice(a, b); };
// §5.3: the food table, one row per allPossibleFood entry, library symbol in backticks.
const foods = [...new Set([...section('### 5.3', '### 5.4').matchAll(/^\| \d+ \| [^|]+\| `(\w+)` \|/gm)].map(m => m[1]))];
if (foods.length !== 25) fail('flash-flow.md', `section 5.3 gave ${foods.length} distinct food symbols, expected 25`);
// §2.10: host and contestant label tables (condifent and curious are unreachable, section 2.10).
const s210 = section('### 2.10', '### 2.11');
const [hostTable, kidTable] = s210.split('Contestants:');
const tableLabels = t => [...t.matchAll(/^\| `(\w+)`/gm)].map(m => m[1]);
const hostLabels = tableLabels(hostTable);
const kidLabels = tableLabels(kidTable).filter(l => l !== 'condifent' && l !== 'curious');
if (hostLabels.length !== 4 || kidLabels.length !== 6) fail('flash-flow.md', `section 2.10 gave host labels ${hostLabels} and contestant labels ${kidLabels}`);
// §5.12: kitchen avatar labels (cling film and window animations are unused, section 5.12).
const s512 = section('### 5.12', '### 5.13').split('\n').find(l => l.includes('Avatar `upper` labels')) || '';
const kitchenLabels = [...s512.matchAll(/`(\w+)` \d/g)].map(m => m[1]).filter(l => !/^cling_film|^window$/.test(l));
if (kitchenLabels.length !== 11) fail('flash-flow.md', `section 5.12 gave kitchen labels ${kitchenLabels}`);
// §2.4: talkie labels shown by the game (init, start, wait_for_click, end; collect_text is unused).
const buttonStates = { frames: [1, 2, 3] };
const screens = [
  { name: 'splash', set: 'splash', ref: '1.2', items: {
    splash_back: { frames: [1] }, splash_studio: { frames: [120] }, splash_casing: { frames: [1] }, splash_shine: { frames: [120] },
    splash_screen: { frames: range(1, 119) }, splash_tuning: { frames: [60, 72, 84, 96, 108, 120] }, splash_glass: { frames: [1, 120] },
    splash_new_game: { frames: [1] }, splash_timeline: { data: ['tracks.d390', 'tracks.d399', 'alphas.d390'] } } },
  { name: 'cutscene', set: 'cutscene', ref: '3', items: {
    gs_set: {}, gs_podia: {}, gs_score: {}, gs_digit: { labels: 'all' }, gs_host: { labels: hostLabels }, gs_harry: { labels: kidLabels }, gs_amy: { labels: kidLabels },
    gs_talkie: { labels: ['start', 'wait_for_click'] }, cut_details_form: { frames: [30] }, cut_submit_button: buttonStates } },
  { name: 'game show', set: 'gameshow', ref: '2.4-2.10', items: {
    gs_set: {}, gs_podia: { data: ['tracks.amy_score', 'tracks.harry_score'] }, gs_score: {}, gs_digit: { labels: 'all' }, gs_host: { labels: hostLabels },
    gs_harry: { labels: kidLabels }, gs_amy: { labels: kidLabels }, gs_talkie: { labels: ['start', 'wait_for_click'] },
    gs_question_board: {}, gs_button_agree: buttonStates, gs_button_dont_know: buttonStates, gs_button_disagree: buttonStates } },
  { name: 'shrinking zone', set: 'shrink', ref: '4', items: {
    gs_shrinking_zone: {}, shrink_harry: { labels: ['start'], frames: [150] }, shrink_amy: { labels: ['start'], frames: [150] } } },
  { name: 'kitchen', set: 'kitchen', ref: '5.3-5.12', items: {
    kitchen_bg: {}, kitchen_counter: { data: ['tracks.sink_area', 'tracks.tissues', 'tracks.clingfilm'] }, kitchen_sink: { labels: ['tab_stop', 'tab_wash_hand'] },
    ...Object.fromEntries(foods.flatMap(f => [[`food_${f}`, {}], [`food_clingfilm_${f}`, {}]])),
    kitchen_harry: { labels: kitchenLabels }, kitchen_amy: { labels: kitchenLabels },
    kitchen_intro0_bg: {}, kitchen_intro1_bg: {}, kitchen_intro2_bg: {}, kitchen_intro3_bg: {}, kitchen_intro0_screen: { data: ['cxforms.background'] },
    kitchen_click_button: buttonStates, kitchen_outro_bg: {} } },
  { name: 'summary', set: 'summary', ref: '6.1', items: { summary_page_bg: {}, summary_click_button: buttonStates } },
];
const screenRows = [];
for (const sc of screens) {
  const ids = index.sets?.[sc.set];
  const row = { screen: sc.name, set: sc.set, ref: sc.ref, ok: 0, total: 0, errors: [] };
  if (!ids) { fail(sc.name, `no "${sc.set}" set in index.json`); screenRows.push(row); continue; }
  for (const [name, opts] of Object.entries(sc.items)) {
    row.total++;
    let err;
    if (opts.data) { // data-only symbols (tracks, colour transforms): present in the set with the data
      const e = sym(name);
      err = !e ? `${name}: in no atlas` : !ids.includes(e.id) ? `${name}: in ${e.id}, which this set does not load`
        : opts.data.filter(k => { const [a, b] = k.split('.'); return !e.s[a]?.[b]; }).map(k => `${name}: no ${k}`).join(', ');
      if (!err && Object.keys(opts).length > 1) err = check(name, ids, { ...opts, data: undefined });
      if (!err && name !== 'splash_timeline' && name !== 'kitchen_intro0_screen') err = check(name, ids);
    } else err = check(name, ids, opts);
    if (err) row.errors.push(err); else row.ok++;
  }
  screenRows.push(row);
  for (const e of row.errors) fail(sc.name, e);
}

// ---------------------------------------------------------------------------------------------
// 4. Budget per set.
const setInfo = ids => ids.reduce((t, id) => { const a = atlases.get(id); if (a) { t.files += a.files; t.bytes += a.bytes; t.json += a.jsonBytes; t.pixels += a.pixels; } return t; }, { files: 0, bytes: 0, json: 0, pixels: 0 });
const budgetRows = [];
for (const [set, ids] of Object.entries(index.sets || {})) {
  const own = setInfo(ids);
  // A level loads its set plus hud, entities (already listed) and the larger of the player sets.
  let peak = own.pixels * 4;
  if (/^level\d+$/.test(set)) {
    const extra = Math.max(...['player-harry', 'player-amy'].map(p => setInfo((index.sets[p] || []).filter(id => !ids.includes(id))).pixels));
    peak += extra * 4;
  }
  budgetRows.push({ set, atlases: ids.length, ...own, decoded: own.pixels * 4, peak });
  if (peak > DECODED_BUDGET) fail('budget', `${set} decodes to ${(peak / 1048576).toFixed(0)} MB with a player set (limit about 120 MB)`);
}
const totalBytes = [...atlases.values()].reduce((t, a) => t + a.bytes, 0);
const totalJson = [...atlases.values()].reduce((t, a) => t + a.jsonBytes, 0);
if (totalBytes > WEBP_BUDGET) fail('budget', `total WebP ${(totalBytes / 1e6).toFixed(2)} MB is over 12 MB`);

// ---------------------------------------------------------------------------------------------
// Report.
const pad = (s, n, right = false) => { s = String(s); return right ? s.padStart(n) : s.padEnd(n); };
const table = (head, rows) => {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => pad(c, w[i], typeof c === 'number' || /^[\d.,]+( ?(KB|MB|%))?$/.test(String(c)))).join('  ');
  console.log(line(head)); console.log(w.map(n => '-'.repeat(n)).join('  ')); rows.forEach(r => console.log(line(r)));
};
const frac = ([a, b]) => `${a}/${b}`;
const kb = b => `${Math.round(b / 1024)} KB`, mb = b => `${(b / 1048576).toFixed(1)} MB`;

console.log(`\nAtlas index: ${atlases.size} atlases, ${fileCount} files (with index.json), ${symbolAtlas.size} symbols, ${Object.keys(index.sets || {}).length} sets\n`);
console.log('Platform levels (level set + hud + entities + player set):');
table(['Level', 'Set', 'Tiles', 'Entities', 'Spawned', 'HUD', 'Intro pages', 'Result'],
  levelRows.map(r => [r.level, r.set, frac(r.tiles), frac(r.entities), frac(r.code), frac(r.hud), r.intro, r.errors.length ? `FAIL (${r.errors.length})` : 'ok']));
console.log(`\nColin: ${colinPlaced.length ? 'placed in ' + colinPlaced.join(', ') : 'placed in no level (type 15, ids 95 and 103)'}; colin_icon has no SWF export; ${sym('super_colin_icon') ? `super_colin_icon is in ${sym('super_colin_icon').id} (set "extras")` : 'super_colin_icon is missing'}.`);
if (colinPlaced.length && !sym('colin_icon')) fail('colin', 'a level places Colin but no colin_icon art exists');

console.log('\nScreens (flash-flow.md):');
table(['Screen', 'Set', 'flash-flow.md', 'Symbols', 'Result'], screenRows.map(r => [r.screen, r.set, '§' + r.ref, `${r.ok}/${r.total}`, r.errors.length ? `FAIL (${r.errors.length})` : 'ok']));
console.log(`  (${foods.length} foods from §5.3; host labels ${hostLabels.join(', ')}; contestant labels ${kidLabels.join(', ')}; kitchen avatar labels ${kitchenLabels.join(', ')})`);

console.log('\nBudget per load set (decoded = RGBA of the pages; peak adds a player set to a level):');
table(['Set', 'Atlases', 'Files', 'WebP', 'JSON', 'Decoded', 'Peak'],
  budgetRows.map(r => [r.set, r.atlases, r.files, kb(r.bytes), kb(r.json), mb(r.decoded), mb(r.peak)]));
console.log(`\nTotal: ${(totalBytes / 1e6).toFixed(2)} MB WebP (${(totalBytes / 1048576).toFixed(2)} MiB, budget 12 MB) + ${(totalJson / 1e6).toFixed(2)} MB JSON in ${fileCount} files; largest set peak ${mb(Math.max(...budgetRows.map(r => r.peak)))} (budget about 120 MB).`);

if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of verbose ? failures : failures.slice(0, 60)) console.log(`  - ${f}`);
  if (!verbose && failures.length > 60) console.log(`  ... and ${failures.length - 60} more (--verbose)`);
  process.exit(1);
}
console.log('\nAll checks passed.');
