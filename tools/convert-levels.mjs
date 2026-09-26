#!/usr/bin/env node
// Converts the 2009 Flash platform-game level XML into compact JSON for the browser port.
//
// Usage: node tools/convert-levels.mjs [--quiet]
//
// Reads (all under reference/):
//   Junior_Game/levels/tile_definitions.xml   the palette the Flash runtime really uses
//   Junior_Game/levels/alpha_level*.xml       every platform level (1-10 are played, 11 is unused)
//   analysis/swf-inventory.json               frame-1 bounds of each exported symbol (clip _width/_height)
//
// Writes:
//   web/data/levels/tile_definitions.json     all 114 definitions with type ids and clip sizes
//   web/data/levels/<name>.json               one file per level (name = XML file stem)
//   web/data/levels/index.json                play order (GameController rounds + next= chains)
//
// Runtime rules reproduced here (see reference/analysis/flash-platformer.md section 6):
// - A cell's <tile id="N"/> indexes tile_definitions.xml in file order, minus erasers (the eraser is
//   last, so ids do not shift). The level's own <tiles> block is ignored (MapBuilder.as:70-82).
// - The runtime linkage (symbol) name is the definition's <icon>, not <movie> (MapBuilder.as:77).
// - body_level != "false" (including a missing attribute) means a body level (MapBuilder.as:49).
// - Cells whose definition has type TILE are geometry; everything else is an entity cell
//   (MapBuilder.as:95-113). The last player_start wins.
// - Physics/art size of a tile or entity is its clip's frame-1 bounds, anchored at the cell's
//   top-left (ParticleSystem.as:189-195), so multi-cell tiles exist (section 6.3).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JG = path.join(ROOT, 'reference', 'Junior_Game');
const LEVELS_DIR = path.join(JG, 'levels');
const OUT_DIR = path.join(ROOT, 'web', 'data', 'levels');
const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

// Constants.as:29-58
const TYPE = {
  PLAYER: 0, TILE: 1, ERASER: 2, GENERIC: 3, GOOD_MICROBE: 4, BAD_MICROBE: 5, PORTAL_EXIT: 6,
  PORTAL_ENTRANCE: 7, BULLET: 8, AMMO_PICKUP: 9, CAMERA_FLASH: 10, LUCY: 11, SANDY: 12, PATTY: 13,
  STEVE: 14, COLIN: 15, SLARG: 16, SLURM: 17, IGGY: 18, DONNA: 19, MILK: 20, ANTIBIOTIC_PICKUP: 21,
  ANTIBIOTIC_BOMB: 22, SUPERINFECTION: 23,
};
const TYPE_NAME = Object.fromEntries(Object.entries(TYPE).map(([k, v]) => [v, k]));

// TileDefinitionParser.as:67-140: type string -> entity type id. Unknown strings become TILE.
const TYPE_STRING = {
  tile: TYPE.TILE, steve: TYPE.STEVE, lucy: TYPE.LUCY, colin: TYPE.COLIN, donna: TYPE.DONNA,
  iggy: TYPE.IGGY, patty: TYPE.PATTY, sandy: TYPE.SANDY, slurm: TYPE.SLURM, slarg: TYPE.SLARG,
  super_colin: TYPE.COLIN, super_slarg: TYPE.SLARG, super_slurm: TYPE.SLURM,
  portal: TYPE.PORTAL_EXIT, entrance_portal: TYPE.PORTAL_ENTRANCE, soap_pickup: TYPE.AMMO_PICKUP,
  white_pickup: TYPE.AMMO_PICKUP, player_start: TYPE.PLAYER, eraser: TYPE.ERASER,
  milk_glass: TYPE.MILK, antibiotic_pickup: TYPE.ANTIBIOTIC_PICKUP, superinfection: TYPE.SUPERINFECTION,
};

// GameController.as:65-69: the rounds. Round index 3 is the kitchen game (showHoverboardOrKitchen).
const ROUND_STARTS = ['alpha_level1', 'alpha_level5', 'alpha_level8', null, 'alpha_level10'];

// Level intro pages shown on the ePhone before the clock starts (platformer SWF sprite 1479
// "level_intros", transcribed in reference/analysis/flash-platformer.md section 8.2). The original
// wording and typos are kept verbatim; pages auto-advance after 5 s or on a tap.
const INTROS = {
  level1: [
    "We have shrunken you so small that you can't be seen with out a microscope!",
    'With your trusty hoverboard and camera phone, you have to explore the tiny world of the microbe.',
    'Microbes are everywhere, including the kitchen. Some are good and some are bad - so watch out!',
    'Your mission is to photograph 3 Lucy Lactobacillus.',
    'Lucy Lactobacillus - Bacteria. Lucy is a bacteria.',
    'When you are near Lucy, press the CTRL button to use your camera phone to take a picture.',
    'When you have taken all the photos, find the PORTAL to go to level 2.',
  ],
  level2: [
    "Now we have sent you onto a human hand. There are millions of microbes on everyone's hands!",
    'Photograph 3 more Lucy Lactobacillus Bacteria.',
  ],
  level3: [
    'This time you have to photograph 3 Steve Staphylococcus',
    'Steve is also a bacteria like Lucy.',
  ],
  level4: [
    'In this level, you need to photograph 3 Patty Penicillium',
    'Unlike Steve and Lucy, Patty is a FUNGUS! Fungi are bigger than bacteria.',
  ],
  level5: [
    'This time, use soap to wash away Slurm Staphylococcus.',
    'Press SPACE BAR to throw soap that you collect.',
  ],
  level6: [
    'Skin has good and bad microbes on it. Using soap is a good way to get rid of the bad microbes.',
    "This time, use soap to wash away all the bad microbes. Press the SPACE BAR to throw soap that you've picked up.",
    "Watch out for Donna Dermatophyte though! She's a fungus like Patty Pennicilium but she's not as friendly!",
  ],
  level7: [
    'We have sent you inside the body! Sometimes bacteria and viruses can get inside your body.',
    "Iggy Influenza is a flu virus. Viruses are the smallest of the microbe but that doesn't make them easy for the body to cope with.",
    'Bodys have natural defenses that kill intruders. Help the body by collecting and throwing white blood cells to kill all the bad microbes.',
    "Use the SPACE BAR to throw the body's defences at Iggy.",
  ],
  level8: [
    "We've sent you back into the kitchen. This time you're going to see what good microbes can REALLY do!",
    "Lucy Lactobacillus can turn milk into yogurt. That's how yogurt gets made. Amazing isnt' it?",
    'To turn the milk into yogurt, just push Lucy into the glass.',
  ],
  level9: [
    'Well done! We also use microbes to make things like bread and even cheese!',
    'This time you have to turn THREE glasses of milk into yogurt.',
  ],
  level10: [
    'In an earlier level, you used the body\'s own defenses to kill bad microbes. That works almost all of the time.',
    'Sometimes people get really sick and the doctor has to prescribe them special drugs called Antibiotics.',
    'The most important thing when using antibiotics is to do exactly what the doctor says.',
    "In this level you're going to use antibiotics to defeat a SUPER infection that can't be killed with the body's defense.",
    "You can only carry one antibiotic at a time, so you'll need to go back to get more until you kill the super infection.",
    'Press CTRL to use the antibiotic. Watch what it does. Does it kill all other microbes too?',
  ],
};

// ------------------------------------------------------------------------------------------
// Minimal XML helpers (the level files are machine-written and regular).
// ------------------------------------------------------------------------------------------
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
const text = (s, tag) => { const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? m[1].trim() : null; };
const readXml = (file) => fs.readFileSync(file, 'utf8').replace(/^﻿/, '');

// ------------------------------------------------------------------------------------------
// Symbol bounds (clip _width/_height at creation), from the SWF inventory. Entity art is exported
// by the platformer SWF; tile art comes from the shared library junior_game_assets.swf.
// ------------------------------------------------------------------------------------------
function loadBounds() {
  const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference', 'analysis', 'swf-inventory.json'), 'utf8'));
  const bySwf = (suffix) => inv.swfs.find(s => s.path.endsWith(suffix));
  const table = new Map();
  for (const swf of [bySwf('/introductionToMicrobes_platformer.swf'), bySwf('/junior_game_assets.swf')]) {
    for (const sp of swf.exportedSprites || []) {
      if (table.has(sp.name) || !sp.boundsFrame1) continue;
      const b = sp.boundsFrame1;
      table.set(sp.name, { w: b.w, h: b.h, ax: b.x, ay: b.y, swf: path.basename(swf.path) });
    }
  }
  return table;
}

// Physics box sizes settled by the Ruffle captures where the two bounds surveys disagree (NOTES.md
// 4.4 / 12.6). Patty: swf-inventory.json's boundsFrame1 gives 203.32 x 150.39, which pushes level
// 4's first Patty (4,11) off her spawn cell on step 2 (the loaf and the cheese push by different
// amounts) and leaves her hovering 60 px above the bread stick; captures 050-level4-opening and
// 051-level4-moving show her standing on it at her spawn cell. The other survey's box
// (reference/analysis/levels.json:1699-1706, "union of frame-1 child bounds, mask layers
// excluded"; flash-levels.md:225) keeps her at (550, 200), as captured. Only the box (w, h) is
// overridden: ax/ay feed the debug-art hint only, and the clip bounds used by hitTest and the
// on-screen test (web/js/platformer/data/clips.js) are a separate question.
const BOX_OVERRIDES = {
  patty_icon: { w: 187.89, h: 141.53 },
};

function parseTileDefinitions(bounds) {
  const xml = readXml(path.join(LEVELS_DIR, 'tile_definitions.xml'));
  const defs = [];
  for (const m of xml.matchAll(/<tile>([\s\S]*?)<\/tile>/g)) {
    const body = m[1];
    const typeString = text(body, 'type');
    const icon = text(body, 'icon') || null;
    const type = TYPE_STRING[typeString] ?? TYPE.TILE;
    const found = icon ? bounds.get(icon) : null;
    const b = found && BOX_OVERRIDES[icon] ? { ...found, ...BOX_OVERRIDES[icon] } : found;
    defs.push({
      id: defs.length,
      label: text(body, 'label') || null,
      typeString,
      type,
      typeName: TYPE_NAME[type],
      movie: icon,                     // runtime linkage name (<icon>)
      w: b ? round2(b.w) : null,       // clip frame-1 size; null = no linkage in either SWF
      h: b ? round2(b.h) : null,
      ax: b ? round2(b.ax) : 0,        // art offset from the registration point
      ay: b ? round2(b.ay) : 0,
    });
  }
  // MapBuilder.as:71-82 skips erasers; the eraser is the last definition, so ids are unchanged.
  const last = defs[defs.length - 1];
  if (last.type !== TYPE.ERASER) throw new Error('Expected the eraser to be the last tile definition');
  return defs.filter(d => d.type !== TYPE.ERASER);
}

const round2 = (v) => Math.round(v * 100) / 100;

function convertLevel(file, defs) {
  const xml = readXml(path.join(LEVELS_DIR, file));
  const head = attrs(xml.match(/<level\b([^>]*)>/)[1]);
  const name = file.replace(/\.xml$/, '');
  const cols = Number(head.cols), rows = Number(head.rows);
  const goalsXml = xml.match(/<goals>([\s\S]*?)<\/goals>/)?.[1] || '';
  const goals = [...goalsXml.matchAll(/<goal\b([^>]*)\/?>/g)].map(g => {
    const a = attrs(g[1]);
    return { goalType: Number(a.goalType), microbeType: Number(a.microbeType), required: Number(a.required) };
  });
  const rowsXml = xml.match(/<rows>\s*(<row[\s\S]*)<\/rows>/)?.[1] || '';
  const tiles = [], entities = [], outOfRange = [];
  let playerStart = null;
  const used = new Set();
  for (const r of rowsXml.matchAll(/<row\s+id="(\d+)"\s*>([\s\S]*?)<\/row>/g)) {
    const row = Number(r[1]);
    for (const c of r[2].matchAll(/<column\s+id="(\d+)"\s*>\s*<tile\s+id="(\d+)"\s*\/>\s*<\/column>/g)) {
      const col = Number(c[1]), id = Number(c[2]);
      const def = defs[id];
      if (!def) throw new Error(`${file}: unknown tile id ${id} at ${row},${col}`);
      used.add(id);
      if (def.type === TYPE.TILE) {
        tiles.push([row, col, id]);
        // Physics exists for rows 0..rows-1 and cols 0..cols inclusive; drawing for rows 0..rows-1.
        if (row >= rows || col > cols) outOfRange.push({ row, col, id, movie: def.movie, solid: false, drawn: row < rows });
      } else {
        entities.push([row, col, id]);
        if (def.type === TYPE.PLAYER) playerStart = { row, col };
        if (row >= rows) outOfRange.push({ row, col, id, movie: def.movie, entity: true });
      }
    }
  }
  const byRowCol = (a, b) => a[0] - b[0] || a[1] - b[1];
  tiles.sort(byRowCol);
  entities.sort(byRowCol);
  const palette = {};
  for (const id of [...used].sort((a, b) => a - b)) {
    const d = defs[id];
    palette[id] = { movie: d.movie, type: d.type, w: d.w, h: d.h, ax: d.ax, ay: d.ay };
  }
  const next = head.next ? head.next.replace(/\.xml$/, '') : null;
  return {
    name,
    title: head.name ?? null,              // ePhone intro label (EPhone.grow(level.name))
    id: head.id != null ? Number(head.id) : null,
    cols, rows,
    next,                                  // level stem, or "exit" (return to the game show)
    bodyLevel: head.body_level !== 'false',
    bodyLevelAttr: head.body_level ?? null,
    goals,
    playerStart,
    tiles,                                 // [row, col, tileId] geometry anchor cells, row-major
    entities,                              // [row, col, tileId] entity cells (incl. player_start), row-major
    palette,                               // tileId -> { movie, type, w, h, ax, ay }
    intro: INTROS[head.name] || [],
    outOfRange,
    source: `reference/Junior_Game/levels/${file}`,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bounds = loadBounds();
  const defs = parseTileDefinitions(bounds);
  fs.writeFileSync(path.join(OUT_DIR, 'tile_definitions.json'), JSON.stringify({
    source: 'reference/Junior_Game/levels/tile_definitions.xml',
    note: 'Index = tile id used by level cells. movie = runtime linkage (<icon>). w/h = clip frame-1 size; ax/ay = art offset from the registration point.',
    types: TYPE,
    definitions: defs,
  }, null, 1) + '\n');

  const files = fs.readdirSync(LEVELS_DIR).filter(f => /^alpha_level\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const levels = {};
  for (const f of files) {
    const lvl = convertLevel(f, defs);
    levels[lvl.name] = lvl;
    fs.writeFileSync(path.join(OUT_DIR, `${lvl.name}.json`), compactJson(lvl) + '\n');
    log(`${lvl.name}: ${lvl.cols}x${lvl.rows}, ${lvl.tiles.length} tiles, ${lvl.entities.length} entities, next=${lvl.next}, body=${lvl.bodyLevel}, goals=${JSON.stringify(lvl.goals)}${lvl.outOfRange.length ? `, ${lvl.outOfRange.length} out-of-range cells` : ''}`);
  }

  // Play order: each round starts at ROUND_STARTS[i] and follows next= until "exit".
  const rounds = ROUND_STARTS.map((start, i) => {
    if (!start) return { round: i, kind: 'kitchen', levels: [] };
    const chain = [];
    for (let cur = start; cur && cur !== 'exit'; cur = levels[cur]?.next) {
      if (chain.includes(cur)) throw new Error('next= loop at ' + cur);
      chain.push(cur);
    }
    return { round: i, kind: 'platform', levels: chain };
  });
  const order = rounds.flatMap(r => r.levels);
  const index = {
    source: 'GameController.as:65-69 (round entry levels) and each level\'s next= attribute',
    order,
    rounds,
    unused: Object.keys(levels).filter(n => !order.includes(n)),
    levels: Object.fromEntries(Object.values(levels).map(l => [l.name, {
      title: l.title, next: l.next, cols: l.cols, rows: l.rows, bodyLevel: l.bodyLevel, goals: l.goals,
    }])),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  log('order:', order.join(' -> '));
}

// JSON with one cell per line group: keeps files small but diffable.
function compactJson(obj) {
  const s = JSON.stringify(obj, (k, v) => v, 1);
  // Collapse the [row, col, id] triples onto single lines.
  return s.replace(/\[\s+(-?\d+),\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1,$2,$3]');
}

main();
