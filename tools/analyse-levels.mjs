#!/usr/bin/env node
// Parses the 2009 Flash platform-game level data of Super Microbe World (e-Bug Junior Game)
// and writes reference/analysis/levels.json. No dependencies.
//
// Usage: node tools/analyse-levels.mjs [--quiet]
//
// What it reads (all under reference/Junior_Game/):
//   levels/*.xml, *.txt, *.as     every file whose root element is <level> (canonical and legacy)
//   levels/tile_definitions.xml   the palette the Flash runtime ACTUALLY uses (see below)
//   src/ebug/junior/GameController.as   start levels (hoverboardLevels.push)
//   src/ebug/junior/fridge/KitchenGame.as   kitchen game "levels" (code, not XML)
//   movies/introductionToMicrobes_platformer.swf, movies/junior_game_assets.swf
//                                  exported linkage names and frame-1 bounds (approximate _width/_height)
//
// Runtime palette rule: MapBuilder.parseXML (src/ebug/MapBuilder.as:70-82) ignores the level's own
// <tiles> block. It builds level.tiles from tilesList, which is TileDefinitionParser's parse of
// tile_definitions.xml (src/ebug/junior/TileDefinitionParser.as:419-512), skipping erasers, and uses
// the <icon> field as the movie. A cell's <tile id="N"/> indexes that compacted list. This script
// records both palettes and diffs them.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JG = path.join(ROOT, 'reference', 'Junior_Game');
const LEVELS_DIR = path.join(JG, 'levels');
const SRC = path.join(JG, 'src', 'ebug');
// The platformer SWF exports the entity art; the tile art lives in the runtime shared library
// junior_game_assets.swf (the platformer imports from it via ImportAssets).
const SWF_FILES = [
  path.join(JG, 'movies', 'introductionToMicrobes_platformer.swf'),
  path.join(JG, 'movies', 'junior_game_assets.swf'),
];
const OUT_JSON = path.join(ROOT, 'reference', 'analysis', 'levels.json');
const QUIET = process.argv.includes('--quiet');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---------------------------------------------------------------------------------------------
// Constants mirrored from src/ebug/Constants.as:29-58 and src/ebug/junior/Goal.as:15-22
// ---------------------------------------------------------------------------------------------
const ENTITY = {
  0: 'PLAYER', 1: 'TILE', 2: 'ERASER', 3: 'GENERIC', 4: 'GOOD_MICROBE', 5: 'BAD_MICROBE',
  6: 'PORTAL_EXIT', 7: 'PORTAL_ENTRANCE', 8: 'BULLET', 9: 'AMMO_PICKUP', 10: 'CAMERA_FLASH',
  11: 'LUCY', 12: 'SANDY', 13: 'PATTY', 14: 'STEVE', 15: 'COLIN', 16: 'SLARG', 17: 'SLURM',
  18: 'IGGY', 19: 'DONNA', 20: 'MILK', 21: 'ANTIBIOTIC_PICKUP', 22: 'ANTIBIOTIC_BOMB',
  23: 'SUPERINFECTION',
};
const MICROBE_NAME = {
  11: 'Lucy (Lactobacillus)', 12: 'Sandy (Streptococcus)', 13: 'Patty (Penicillium)',
  14: 'Steve (Staphylococcus)', 15: 'Colin (Campylobacter)', 16: 'Slarg (Staphylococcus, bad)',
  17: 'Slurm (Staphylococcus, bad)', 18: 'Iggy (Influenza)', 19: 'Donna (Dermatophyte)',
  20: 'milk glass', 21: 'antibiotic pickup', 22: 'antibiotic bomb', 23: 'superinfection',
};
const GOAL_TYPE = {
  0: 'PHOTOGRAPH_SPECIFIC', 1: 'PHOTOGRAPH_GOOD', 2: 'PHOTOGRAPH_BAD', 3: 'PHOTOGRAPH_ANY',
  4: 'KILL_ALL', 5: 'KILL_SPECIFIC', 6: 'ANTIBIOTIC', 7: 'YOGURT',
};
// Goal.updateGoal (src/ebug/junior/Goal.as:43-168): which goal types have a working handler.
const GOAL_HANDLED = { 0: true, 1: true, 2: false, 3: true, 4: true, 5: false, 6: true, 7: true };

// TileDefinitionParser.as:433-506, typeString -> Constants value. Unknown strings fall to TILE (1).
const TYPE_STRING = {
  tile: 1, steve: 14, lucy: 11, colin: 15, donna: 19, iggy: 18, patty: 13, sandy: 12, slurm: 17,
  slarg: 16, super_colin: 15, super_slarg: 16, super_slurm: 17, portal: 6, entrance_portal: 7,
  soap_pickup: 9, white_pickup: 9, player_start: 0, eraser: 2, milk_glass: 20,
  antibiotic_pickup: 21, superinfection: 23,
};

// PlatformGame.as:417-524 (STATE_CREATE_ENTITIES): which class a placed non-tile type becomes.
function runtimeClass(type, bodyLevel) {
  if (type === 1) return 'geometry';
  if (type === 0) return 'PlayerEntity (start position only)';
  if ([4, 3, 12, 14, 13].includes(type)) return 'GoodMicrobe';
  if (type === 11) return 'LucyLactobacillus'; // extends GoodMicrobe (LucyLactobacillus.as:12)
  if ([5, 15, 19, 18, 16, 17].includes(type)) return 'BadMicrobe';
  if (type === 9) return bodyLevel ? 'WhitePickup' : 'SoapPickup';
  if (type === 20) return 'MilkGlassEntity';
  if (type === 6) return 'PortalEntity';
  if (type === 21) return 'AntibioticPickup';
  if (type === 23) return 'SuperInfection'; // extends BadMicrobe (SuperInfection.as:12)
  return 'NONE (no branch in PlatformGame.as:424-524; undefined is pushed into entities)';
}
const isGoodClass = (t) => [4, 3, 12, 14, 13, 11].includes(t);
const isBadClass = (t) => [5, 15, 19, 18, 16, 17, 23].includes(t);

// ---------------------------------------------------------------------------------------------
// Minimal XML parser: elements, attributes, text, self-closing tags, BOM, <?xml?>, comments.
// Tolerant of the unclosed tags in the legacy files (a close tag pops to its matching open).
// ---------------------------------------------------------------------------------------------
function parseXml(text) {
  const src = text.replace(/^﻿/, '').replace(/﻿/g, '');
  const root = { name: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { stack[stack.length - 1].text += decode(src.slice(i)); break; }
    if (lt > i) stack[stack.length - 1].text += decode(src.slice(i, lt));
    if (src.startsWith('<?', lt)) { i = src.indexOf('?>', lt) + 2; continue; }
    if (src.startsWith('<!--', lt)) { i = src.indexOf('-->', lt) + 3; continue; }
    if (src.startsWith('<!', lt)) { i = src.indexOf('>', lt) + 1; continue; }
    const gt = src.indexOf('>', lt);
    if (gt < 0) break;
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) { stack.length = k; break; }
      }
      continue;
    }
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1) : raw;
    const m = /^([^\s/>]+)/.exec(body.trim());
    if (!m) continue;
    const node = { name: m[1], attrs: {}, children: [], text: '', offset: lt };
    const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    const attrSrc = body.trim().slice(m[1].length);
    while ((a = attrRe.exec(attrSrc))) node.attrs[a[1]] = decode(a[3] ?? a[4] ?? '');
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}
const child = (n, name) => n?.children.find((c) => c.name === name);
const kids = (n, name) => (n ? n.children.filter((c) => c.name === name) : []);
const txt = (n) => (n ? n.text.trim() : undefined);
// AS2 XML with ignoreWhite drops whitespace-only text nodes, so firstChild.nodeValue is undefined.
const flashText = (n) => { const t = n?.text; return t === undefined || t.trim() === '' ? undefined : t; };

// Line number of the first occurrence of a regex in a file (for citations).
function lineOf(file, re) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let k = 0; k < lines.length; k++) if (re.test(lines[k])) return k + 1;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Settings, inferred from linkage names (tile_definitions.xml labels agree)
// ---------------------------------------------------------------------------------------------
function settingOf(movie) {
  if (!movie) return 'blank';
  if (/^(C_Chip|Cheese|Chip|Chop|loaf|pepper|salt|Sausage|Sugar|toast|Unit|Yog|yoghurt|kitchen)_/.test(movie)) return 'kitchen';
  if (/^(hair|lint_ball|plaster|scab|skin|splinter|spot|wart)(_|$)/.test(movie)) return 'skin';
  if (/^(acid_pit|bone|bubble|cell|corner|flesh|floor|platform|roof|vertical|villi)_/.test(movie)) return 'body';
  if (/^(red_box|blue_box|green_box|tile_test|avatar)$/.test(movie)) return 'test';
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// ASCII glyphs, chosen from the resolved icon (not the numeric type) so super_* are distinct.
// ---------------------------------------------------------------------------------------------
const GLYPH = {
  player_start: 'P', portal_exit_icon: 'E', lucy_icon: 'L', sandy_icon: 'Y', steve_icon: 'T',
  patty_icon: 'A', colin_icon: 'C', donna_icon: 'D', iggy_icon: 'I', slarg_icon: 'G',
  slurm_icon: 'U', super_colin_icon: 'c', super_slarg_icon: 'g', super_slurm_icon: 'u',
  superinfection_icon: 'X', milk_glass_icon: 'M', soap_pickup: 'o', white_pickup: 'w',
  antibiotic_pickup: 'a',
};
const GLYPH_LEGEND = [
  ['#', 'geometry tile: the XML (anchor) cell, i.e. the top-left of its box'],
  ['+', 'further cells covered by that geometry tile\'s box (clip bounds wider or taller than 50 px)'],
  ['P', 'player_start'], ['E', 'portal_exit_icon (exit portal)'],
  ['L', 'Lucy (good)'], ['Y', 'Sandy (good)'], ['T', 'Steve (good)'], ['A', 'Patty (good)'],
  ['C', 'Colin (bad)'], ['D', 'Donna (bad)'], ['I', 'Iggy (bad)'], ['G', 'Slarg (bad)'], ['U', 'Slurm (bad)'],
  ['c', 'super_colin (type 15)'], ['g', 'super_slarg (type 16)'], ['u', 'super_slurm (type 17)'],
  ['X', 'superinfection'], ['M', 'milk_glass'], ['o', 'soap_pickup (ammo)'], ['w', 'white_pickup (ammo)'],
  ['a', 'antibiotic_pickup'], ['?', 'blank or unknown id'], ['.', 'empty'],
];

// ---------------------------------------------------------------------------------------------
// SWF reader: ExportAssets names and frame-1 bounds of exported sprites (approximate _width/_height)
// ---------------------------------------------------------------------------------------------
function readSwf(file) {
  if (!fs.existsSync(file)) return null;
  let buf = fs.readFileSync(file);
  const sig = buf.toString('latin1', 0, 3);
  if (sig === 'CWS') buf = Buffer.concat([buf.subarray(0, 8), zlib.inflateSync(buf.subarray(8))]);
  else if (sig !== 'FWS') return { error: `unsupported signature ${sig}` };
  const version = buf[3];
  class Bits {
    constructor(b, pos) { this.b = b; this.pos = pos; this.bit = 0; }
    ub(n) { let v = 0; for (let k = 0; k < n; k++) { const byte = this.b[this.pos]; v = (v * 2) + ((byte >> (7 - this.bit)) & 1); if (++this.bit === 8) { this.bit = 0; this.pos++; } } return v; }
    sb(n) { if (n === 0) return 0; const v = this.ub(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }
    fb(n) { return this.sb(n) / 65536; }
    align() { if (this.bit) { this.bit = 0; this.pos++; } }
  }
  const rect = (pos) => { const r = new Bits(buf, pos); const n = r.ub(5); const o = { xmin: r.sb(n), xmax: r.sb(n), ymin: r.sb(n), ymax: r.sb(n) }; r.align(); return [o, r.pos]; };
  const matrix = (pos) => {
    const r = new Bits(buf, pos); let a = 1, d = 1, b = 0, c = 0;
    if (r.ub(1)) { const n = r.ub(5); a = r.fb(n); d = r.fb(n); }
    if (r.ub(1)) { const n = r.ub(5); b = r.fb(n); c = r.fb(n); }
    const n = r.ub(5); const tx = r.sb(n), ty = r.sb(n); r.align();
    return [{ a, b, c, d, tx, ty }, r.pos];
  };
  const cstr = (pos) => { const e = buf.indexOf(0, pos); return [buf.toString('latin1', pos, e), e + 1]; };
  const [, afterRect] = rect(8);
  const bounds = {}; // charId -> rect (twips) for shapes/text
  const sprites = {}; // charId -> [{charId, m}] frame-1 placements
  const exportsByName = {};
  const frameLabels = [];
  function walk(start, end, spriteId) {
    let p = start; let frame1 = true; let frameNo = 1; const placed = spriteId !== undefined ? (sprites[spriteId] = new Map()) : null;
    while (p < end) {
      const hdr = buf.readUInt16LE(p); p += 2;
      const code = hdr >> 6; let len = hdr & 0x3f;
      if (len === 0x3f) { len = buf.readUInt32LE(p); p += 4; }
      const body = p; p += len;
      if (code === 0) break;
      if (code === 1) { frame1 = false; frameNo++; if (spriteId !== undefined) continue; }
      if (code === 43) { const e = buf.indexOf(0, body); frameLabels.push({ sprite: spriteId ?? 'root', frame: frameNo, label: buf.toString('latin1', body, e) }); continue; }
      if (code === 56) { // ExportAssets
        let q = body; const count = buf.readUInt16LE(q); q += 2;
        for (let k = 0; k < count; k++) { const id = buf.readUInt16LE(q); q += 2; const [name, nq] = cstr(q); q = nq; exportsByName[name] = id; }
      } else if ([2, 22, 32, 83, 46, 84, 11, 33, 37].includes(code)) { // shapes, morphs, text
        const id = buf.readUInt16LE(body); bounds[id] = rect(body + 2)[0];
      } else if (code === 39) { // DefineSprite
        const id = buf.readUInt16LE(body); walk(body + 4, body + len, id);
      } else if (placed && frame1 && (code === 26 || code === 70 || code === 4)) {
        let q = body; let flags = 0, flags2 = 0, depth, cid, m = null;
        if (code === 4) { cid = buf.readUInt16LE(q); depth = buf.readUInt16LE(q + 2); [m] = matrix(q + 4); placed.set(depth, { cid, m }); continue; }
        flags = buf[q++]; if (code === 70) flags2 = buf[q++];
        depth = buf.readUInt16LE(q); q += 2;
        if (code === 70 && ((flags2 & 0x08) || ((flags2 & 0x10) && (flags & 0x02)))) { q = cstr(q)[1]; }
        if (flags & 0x02) { cid = buf.readUInt16LE(q); q += 2; }
        if (flags & 0x04) { [m, q] = matrix(q); }
        const prev = placed.get(depth);
        if (cid === undefined && prev) cid = prev.cid;
        if (!m) m = prev?.m || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
        if (flags & 0x40) continue; // clip depth (mask): excluded from the union below
        if (cid !== undefined) placed.set(depth, { cid, m });
      } else if (placed && frame1 && (code === 5 || code === 28)) { // RemoveObject(2)
        const depth = code === 5 ? buf.readUInt16LE(body + 2) : buf.readUInt16LE(body); placed.delete(depth);
      }
    }
  }
  walk(afterRect + 4, buf.length);
  const memo = {};
  function spriteBounds(id, guard = 0) {
    if (memo[id] !== undefined) return memo[id];
    if (bounds[id]) return bounds[id];
    const placed = sprites[id]; if (!placed || guard > 40) return null;
    let r = null;
    for (const { cid, m } of placed.values()) {
      const cb = bounds[cid] || spriteBounds(cid, guard + 1); if (!cb) continue;
      for (const [x, y] of [[cb.xmin, cb.ymin], [cb.xmax, cb.ymin], [cb.xmin, cb.ymax], [cb.xmax, cb.ymax]]) {
        const X = m.a * x + m.c * y + m.tx, Y = m.b * x + m.d * y + m.ty;
        r = r ? { xmin: Math.min(r.xmin, X), xmax: Math.max(r.xmax, X), ymin: Math.min(r.ymin, Y), ymax: Math.max(r.ymax, Y) } : { xmin: X, xmax: X, ymin: Y, ymax: Y };
      }
    }
    memo[id] = r; return r;
  }
  const exportsOut = {};
  for (const [name, id] of Object.entries(exportsByName)) {
    const b = spriteBounds(id);
    exportsOut[name] = b ? {
      charId: id,
      widthPx: +((b.xmax - b.xmin) / 20).toFixed(2), heightPx: +((b.ymax - b.ymin) / 20).toFixed(2),
      xMinPx: +(b.xmin / 20).toFixed(2), yMinPx: +(b.ymin / 20).toFixed(2),
    } : { charId: id, widthPx: null, heightPx: null };
  }
  return { file: rel(file), version, exportCount: Object.keys(exportsOut).length, exports: exportsOut, frameLabels };
}

// ---------------------------------------------------------------------------------------------
// tile_definitions.xml (the runtime palette)
// ---------------------------------------------------------------------------------------------
const TD_FILE = path.join(LEVELS_DIR, 'tile_definitions.xml');
const tdRoot = parseXml(fs.readFileSync(TD_FILE, 'utf8')).children[0];
const tdLines = fs.readFileSync(TD_FILE, 'utf8').split(/\r?\n/);
const tileDefinitions = kids(tdRoot, 'tile').map((t, index) => {
  // TileDefinitionParser reads childNodes[0], [2], [3], [4] positionally (TileDefinitionParser.as:426-429).
  const c = t.children;
  const label = flashText(c[0]); const typeString = flashText(c[2]);
  const icon = flashText(c[3]); const movie = flashText(c[4]);
  const known = Object.prototype.hasOwnProperty.call(TYPE_STRING, typeString);
  const type = known ? TYPE_STRING[typeString] : 1;
  const lineNo = (() => { let n = 0; for (let k = 0; k < tdLines.length; k++) { if (/<tile>/.test(tdLines[k])) { if (n === index) return k + 1; n++; } } return null; })();
  return { index, label: label ?? null, typeString: typeString ?? null, type, typeName: ENTITY[type], typeStringKnown: known, icon: icon ?? null, movie: movie ?? null, setting: type === 1 ? settingOf(icon) : 'entity', source: `${rel(TD_FILE)}:${lineNo}` };
});
// MapBuilder.as:71-82: level.tiles = non-eraser definitions, compacted, movie = icon.
const runtimePalette = tileDefinitions.filter((d) => d.type !== 2);

// ---------------------------------------------------------------------------------------------
// Start levels and play order (GameController.as:65-69, 206-263; PlatformGame.as:1231-1246)
// ---------------------------------------------------------------------------------------------
const GC_FILE = path.join(SRC, 'junior', 'GameController.as');
const gcLines = fs.readFileSync(GC_FILE, 'utf8').split(/\r?\n/);
const startLevels = [];
gcLines.forEach((l, k) => {
  const m = /^\s*gameStructure\.hoverboardLevels\.push\("([^"]+)"\)/.exec(l);
  if (m) startLevels.push({ round: startLevels.length, entry: m[1], source: `${rel(GC_FILE)}:${k + 1}` });
});

// ---------------------------------------------------------------------------------------------
// Level discovery and parsing
// ---------------------------------------------------------------------------------------------
const levelFiles = fs.readdirSync(LEVELS_DIR).filter((f) => /\.(xml|txt|as)$/i.test(f)).sort();
const swfs = SWF_FILES.map(readSwf).filter(Boolean);
const swfExports = {};
for (const sw of swfs) for (const [name, e] of Object.entries(sw.exports || {})) if (!swfExports[name]) swfExports[name] = { ...e, swf: sw.file };

// ePhone.grow(level.name) -> bigScreen.gotoAndPlay(level.name) (PlatformGame.as:545, general/EPhone.as:16-20):
// the level's name attribute must be a frame label of the phone's big-screen intro clip.
const introSprite = swfs[0]?.frameLabels.find((l) => l.label === 'level1')?.sprite;
const introLabels = introSprite === undefined ? [] : swfs[0].frameLabels.filter((l) => l.sprite === introSprite);

function glyphFor(entry) {
  if (!entry) return '?';
  if (entry.type === 1) return entry.movie ? '#' : '?';
  return GLYPH[entry.movie] || '?';
}
// Footprint of a geometry tile in cells, from its frame-1 bounds (registration is 0,0 for every
// tile art clip, so the box starts at the cell's top-left). Unknown bounds -> 1x1.
function footprint(movie) {
  const b = swfExports[movie];
  if (!b || b.widthPx === null) return { w: 1, h: 1, known: false };
  return { w: Math.max(1, Math.ceil(b.widthPx / 50 - 1e-6)), h: Math.max(1, Math.ceil(b.heightPx / 50 - 1e-6)), known: true, widthPx: b.widthPx, heightPx: b.heightPx };
}

const levels = [];
for (const f of levelFiles) {
  const full = path.join(LEVELS_DIR, f);
  const text = fs.readFileSync(full, 'utf8');
  if (!/<level[\s>]/.test(text)) continue;
  const doc = parseXml(text);
  const lv = doc.children.find((c) => c.name === 'level');
  if (!lv) continue;
  const A = lv.attrs;
  const childOrder = lv.children.map((c) => c.name);
  const format = child(lv, 'entities') ? 'pre-release (<entities>/<columns>)' : 'MapBuilder';
  const rec = {
    file: f, source: rel(full), format,
    name: A.name ?? null, cols: A.cols !== undefined ? Number(A.cols) : (A.columns !== undefined ? Number(A.columns) : null),
    rows: A.rows !== undefined ? Number(A.rows) : null, next: A.next ?? null,
    bodyLevelAttr: A.body_level ?? null,
    // MapBuilder.as:49: anything other than the exact string "false" (including absence) is true.
    bodyLevel: A.body_level !== 'false',
    childOrder,
    positionalParseOk: childOrder[0] === 'goals' && childOrder[1] === 'tiles' && childOrder[2] === 'rows',
    goals: [], palette: [], cells: [],
  };
  if (format !== 'MapBuilder') {
    rec.checks = [{ level: 'info', id: 'legacy-format', msg: 'Pre-release format (Hello.xml style); MapBuilder cannot read it.' }];
    rec.canonical = false; levels.push(rec); continue;
  }
  // Goals: MapBuilder.as:65-69 -> new Goal(Number(goalType), microbeType (string), required (string))
  for (const g of kids(child(lv, 'goals'), 'goal')) {
    const gt = Number(g.attrs.goalType); const mt = g.attrs.microbeType; const rq = g.attrs.required;
    rec.goals.push({
      microbeType: mt === undefined ? null : Number(mt), required: rq === undefined ? null : Number(rq), goalType: gt,
      goalTypeName: GOAL_TYPE[gt] ?? 'UNKNOWN', microbeName: MICROBE_NAME[Number(mt)] ?? null,
      rawAttrs: { ...g.attrs },
    });
  }
  // Own palette (what the file says; NOT used by the runtime)
  for (const t of kids(child(lv, 'tiles'), 'tile')) {
    const sides = child(t, 'sides');
    const num = (n) => { const v = txt(n); return v === undefined || v === '' ? null : Number(v); };
    rec.palette.push({
      id: Number(t.attrs.id), movie: txt(child(t, 'movie')) || null, type: num(child(t, 'type')),
      sides: sides ? { left: num(child(sides, 'left')), top: num(child(sides, 'top')), right: num(child(sides, 'right')), bottom: num(child(sides, 'bottom')) } : null,
      rows: num(child(t, 'rows')), cols: num(child(t, 'cols')), entity: num(child(t, 'entity')),
      script: txt(child(t, 'script')) ?? null,
    });
  }
  // Cells, in document order. The runtime reads the THIRD child of <level> as rows (MapBuilder.as:58);
  // we read the element actually named <rows> and flag positional problems separately.
  for (const r of kids(child(lv, 'rows'), 'row')) {
    const row = Number(r.attrs.id);
    for (const c of kids(r, 'column')) {
      const t = c.children[0];
      rec.cells.push({ row, col: Number(c.attrs.id), tileId: t && t.attrs.id !== undefined ? Number(t.attrs.id) : null });
    }
  }
  levels.push(rec);
}

// Canonical chain
const byFile = Object.fromEntries(levels.map((l) => [l.file, l]));
const playOrder = [];
for (const s of startLevels) {
  if (!s.entry.endsWith('.xml')) { playOrder.push({ round: s.round, kind: 'kitchen', entry: s.entry, source: s.source }); continue; }
  let cur = s.entry; const seen = new Set(); let idx = 0;
  while (cur && cur !== 'exit' && !seen.has(cur)) {
    seen.add(cur);
    const l = byFile[cur];
    playOrder.push({ round: s.round, kind: 'platform', indexInRound: idx++, file: cur, exists: !!l, source: idx === 1 ? s.source : `${rel(path.join(LEVELS_DIR, [...seen][seen.size - 2]))}:1 (next=)` });
    cur = l ? l.next : null;
  }
}
const canonicalFiles = new Set(playOrder.filter((p) => p.kind === 'platform').map((p) => p.file));

// ---------------------------------------------------------------------------------------------
// Per-level resolution, counts, checks, ASCII
// ---------------------------------------------------------------------------------------------
for (const rec of levels) {
  if (rec.format !== 'MapBuilder') continue;
  rec.canonical = canonicalFiles.has(rec.file);
  const checks = rec.checks = [];
  const add = (level, id, msg, extra) => checks.push({ level, id, msg, ...(extra || {}) });

  // Palette diff: own palette vs runtime palette (movie vs icon, type vs resolved type)
  const diffs = [];
  for (const p of rec.palette) {
    const rt = runtimePalette[p.id];
    if (!rt) { diffs.push({ id: p.id, own: { movie: p.movie, type: p.type }, runtime: null }); continue; }
    if (p.movie !== rt.icon || p.type !== rt.type) diffs.push({ id: p.id, own: { movie: p.movie, type: p.type }, runtime: { icon: rt.icon, type: rt.type } });
  }
  const uniformSides = rec.palette.every((p) => p.sides && p.sides.left === 1 && p.sides.right === 1 && p.sides.top === 1 && p.sides.bottom === 0);
  // ids 69 and 108 have an empty <icon> in tile_definitions.xml. convertLevelToXML clones the base
  // tile (id 0, C_Chip_L_Tile) and overwrites its movie text with the icon (MapBuilder.as:246-255);
  // with no icon the clone keeps "C_Chip_L_Tile". Such diffs are serialisation artefacts.
  const artefact = (d) => (d.id === 69 || d.id === 108) && d.own.movie === runtimePalette[0].icon && d.runtime && d.runtime.icon === null && d.own.type === d.runtime.type;
  const realDiffs = diffs.filter((d) => !artefact(d));
  const equivalent = realDiffs.length === 0 && rec.palette.length === runtimePalette.length;
  rec.paletteDiff = {
    ownPaletteSize: rec.palette.length, runtimePaletteSize: runtimePalette.length,
    identical: diffs.length === 0 && rec.palette.length === runtimePalette.length,
    equivalentToRuntime: equivalent,
    differingIds: diffs.length, blankDefinitionArtefacts: diffs.filter(artefact).map((d) => d.id),
    realDifferences: realDiffs.length, examples: realDiffs.slice(0, 12),
    allSidesL1T1R1B0: uniformSides,
    allRows1Cols1: rec.palette.every((p) => p.rows === 1 && p.cols === 1),
    allEntity0: rec.palette.every((p) => p.entity === 0),
    allScript1: rec.palette.every((p) => p.script === '1'),
  };
  // Resolution basis: the runtime palette when equivalent, otherwise the file's own palette (older
  // tile_definitions). For the latter, the Flash runtime would mis-map the ids; we note it.
  rec.resolutionBasis = equivalent ? 'tile_definitions.xml (runtime)' : 'own <tiles> palette (differs from runtime)';
  if (!equivalent && rec.palette.length) add(rec.canonical ? 'error' : 'info', 'palette-mismatch', `Own <tiles> palette differs from tile_definitions.xml at ${realDiffs.length} id(s) beyond the 69/108 artefacts (own size ${rec.palette.length}, runtime ${runtimePalette.length}); the Flash runtime would resolve ids through tile_definitions.xml and draw different tiles. Rendered here from the file's own palette.`);
  if (!rec.positionalParseOk) add(rec.canonical ? 'error' : 'info', 'child-order', `<level> children are [${rec.childOrder.join(', ')}]; MapBuilder reads [0] as goals, [1] as tiles, [2] as rows (MapBuilder.as:56-58), so the runtime would load no cells from this file.`);
  const ownById = new Map(rec.palette.map((p) => [p.id, p]));
  const resolve = (tileId) => {
    if (equivalent || !rec.palette.length) {
      const rt = runtimePalette[tileId];
      return rt ? { movie: rt.icon, type: rt.type } : null;
    }
    const p = ownById.get(tileId);
    return p ? { movie: p.movie, type: p.type } : null;
  };

  // Duplicates (later wins: MapBuilder.as:100 and :112)
  const seenCell = new Map(); const dup = [];
  for (const c of rec.cells) { const k = `${c.row},${c.col}`; if (seenCell.has(k)) dup.push({ ...c, overwrites: seenCell.get(k) }); seenCell.set(k, c.tileId); }
  const rowIds = kids(child(parseXml(fs.readFileSync(path.join(LEVELS_DIR, rec.file), 'utf8')).children.find((c) => c.name === 'level'), 'rows'), 'row').map((r) => Number(r.attrs.id));
  const dupRows = rowIds.filter((v, k) => rowIds.indexOf(v) !== k);
  if (dup.length) add('warn', 'duplicate-cells', `${dup.length} cell(s) defined twice; the later definition wins (MapBuilder.as:100, :112).`, { cells: dup });
  if (dupRows.length) add('warn', 'duplicate-rows', `Row id(s) repeated: ${[...new Set(dupRows)].join(', ')}.`);

  // Resolve cells against the runtime palette
  const grid = new Map();
  for (const c of rec.cells) grid.set(`${c.row},${c.col}`, c.tileId);
  rec.resolvedCells = [];
  for (const [k, tileId] of grid) {
    const [row, col] = k.split(',').map(Number);
    const rt = resolve(tileId);
    rec.resolvedCells.push({ row, col, tileId, movie: rt ? rt.movie : null, type: rt ? rt.type : null, typeName: rt ? ENTITY[rt.type] ?? null : null, class: rt ? runtimeClass(rt.type, rec.bodyLevel) : 'UNRESOLVED', setting: rt ? (rt.type === 1 ? settingOf(rt.movie) : 'entity') : 'unresolved' });
  }
  rec.resolvedCells.sort((a, b) => a.row - b.row || a.col - b.col);
  const R = rec.resolvedCells;

  // Bounds checks
  const outRows = R.filter((c) => c.row >= rec.rows || c.row < 0);
  const outCols = R.filter((c) => c.col > rec.cols || c.col < 0);
  const edgeCol = R.filter((c) => c.col === rec.cols);
  const belowWorld = R.filter((c) => c.row >= 9);
  if (outRows.length) add('warn', 'cells-outside-rows', `${outRows.length} cell(s) at row >= rows (${rec.rows}); STATE_LOAD_TILES never creates their physics (PlatformGame.as:288) and STATE_RENDER_WORLD never draws them (:1081). Dead data.`, { cells: outRows.map(({ row, col, movie }) => ({ row, col, movie })) });
  if (outCols.length) add('warn', 'cells-outside-cols', `${outCols.length} cell(s) at col > cols (${rec.cols}); no physics box (PlatformGame.as:289 loops currentCol <= cols) but still drawn when scrolled into view (the render loop at :1089 has no cols bound). The player cannot reach them: worldMax.x = cols*50 (:261) is the effective wall.`, { cells: outCols.map(({ row, col, movie }) => ({ row, col, movie })) });
  if (edgeCol.length) add('info', 'cells-at-col-equals-cols', `${edgeCol.length} cell(s) at col == cols (${rec.cols}); they get a physics box (loop is <=) but sit outside worldMax.x = cols*50.`, { cells: edgeCol.map(({ row, col, movie }) => ({ row, col, movie })) });
  if (belowWorld.length) add('warn', 'cells-below-world', `${belowWorld.length} cell(s) in rows >= 9. worldMax.y is fixed at 450 (PlatformGame.as:261), the collision grid has 9 rows (ParticleSystem.as:155, :166-179 with wMax null at PlatformGame.as:153) and Game.as scrolls x only, so these are off screen and unreachable.`, { cells: belowWorld.map(({ row, col, movie }) => ({ row, col, movie })) });
  if (rec.rows !== 9) add('info', 'rows-not-9', `rows="${rec.rows}" but the playfield is 9 rows (450 px) high.`);

  const unresolved = R.filter((c) => c.movie === null && c.type === null);
  if (unresolved.length) add('error', 'unresolved-tile-id', `${unresolved.length} cell(s) use a tile id with no runtime definition.`, { cells: unresolved });
  const blank = equivalent ? R.filter((c) => (c.tileId === 69 || c.tileId === 108)) : R.filter((c) => !c.movie && c.type !== null);
  if (blank.length) add('error', 'blank-definition', `${blank.length} cell(s) use tile id 69 or 108, whose <icon> is empty (attachMovie fails; createBoxParticle returns null, ParticleSystem.as:186-188).`, { cells: blank });
  const noBranch = R.filter((c) => c.type === 7);
  if (noBranch.length) add('error', 'entrance-portal', 'entrance_portal (type 7) has no branch in STATE_CREATE_ENTITIES; undefined is pushed into entities (PlatformGame.as:526-527).');
  if (swfs.length) {
    const missing = [...new Set(R.map((c) => c.movie).filter((m) => m && !swfExports[m]))];
    rec.linkageNotExported = missing;
    if (missing.length) add(rec.canonical ? 'warn' : 'info', 'linkage-not-in-swf', `Linkage name(s) exported by none of ${swfs.map((x) => x.file).join(', ')}: ${missing.join(', ')}.`);
  }

  // Counts
  const count = (pred) => R.filter(pred).length;
  const byMovie = {}; const byType = {}; const byClass = {}; const bySetting = {};
  for (const c of R) {
    byMovie[c.movie ?? `id${c.tileId}`] = (byMovie[c.movie ?? `id${c.tileId}`] || 0) + 1;
    if (c.type !== 1) { byType[c.typeName] = (byType[c.typeName] || 0) + 1; byClass[c.class] = (byClass[c.class] || 0) + 1; }
    if (c.type === 1) bySetting[c.setting] = (bySetting[c.setting] || 0) + 1;
  }
  rec.counts = {
    cells: R.length, geometry: count((c) => c.type === 1), entities: count((c) => c.type !== 1),
    byMovie, entitiesByType: byType, entitiesByClass: byClass, geometryBySetting: bySetting,
    goodMicrobes: count((c) => isGoodClass(c.type)), badMicrobes: count((c) => isBadClass(c.type)),
  };
  const topSetting = Object.entries(bySetting).sort((a, b) => b[1] - a[1])[0];
  rec.setting = topSetting ? topSetting[0] : 'none';
  rec.settingMix = bySetting;

  // Player and portal
  const players = R.filter((c) => c.type === 0);
  const portals = R.filter((c) => c.type === 6);
  rec.playerStart = players.length ? { row: players[players.length - 1].row, col: players[players.length - 1].col } : null;
  rec.exitPortals = portals.map(({ row, col }) => ({ row, col }));
  if (players.length === 0) add('error', 'no-player-start', 'No player_start: playerPosition is undefined at PlatformGame.as:373.');
  if (players.length > 1) add('warn', 'multiple-player-starts', `${players.length} player_start cells; the last in document order wins (MapBuilder.as:103-110).`);
  if (portals.length === 0) add('error', 'no-exit-portal', 'No exit portal: portalId stays 0, which is the player (PlatformGame.as:117, :588), so the level cannot be exited normally.');
  if (portals.length > 1) add('warn', 'multiple-exit-portals', `${portals.length} exit portals; only the last created is tracked by portalId (PlatformGame.as:498).`);

  // Player start support: first geometry below the start column
  if (rec.playerStart) {
    const { row, col } = rec.playerStart;
    const below = R.filter((c) => c.type === 1 && (c.col === col) && c.row > row).sort((a, b) => a.row - b.row)[0];
    rec.playerStart.firstSolidBelow = below ? { row: below.row, movie: below.movie } : null;
    if (!below) add('warn', 'player-start-no-floor', 'No geometry below the player start column; the player falls to the world floor at y = 450 - 100 (worldMax clamp, ParticleSystem.as:652).');
  }

  // Intro label
  if (introLabels.length) {
    const hit = introLabels.find((l) => l.label === rec.name);
    rec.introLabel = hit ? { label: hit.label, frame: hit.frame, sprite: hit.sprite } : null;
    if (!hit) add(rec.canonical ? 'error' : 'info', 'no-intro-label', `name="${rec.name}" is not a frame label of the phone intro clip (sprite ${introSprite} in ${swfs[0].file}; labels ${introLabels.map((l) => l.label).join(', ')}). bigScreen.gotoAndPlay(name) (general/EPhone.as:20) would not find it.`);
  }

  // Goals
  if (rec.goals.length === 0) add(rec.canonical ? 'error' : 'info', 'no-goals', 'No <goal>: allGoalsAchieved is vacuously true, so the portal opens on the first STATE_UPDATE_WORLD (PlatformGame.as:575-593).');
  if (rec.goals.length > 1) add('warn', 'multiple-goals', 'More than one goal: only goals[0] drives the phone GUI (PlatformGame.as:331-362) and only the last is popped when the portal opens (:589).');
  rec.goalAnalysis = rec.goals.map((g, gi) => {
    const a = { index: gi, goalType: g.goalType, goalTypeName: g.goalTypeName, microbeType: g.microbeType, required: g.required, handled: !!GOAL_HANDLED[g.goalType] };
    let available = null; let basis = '';
    switch (g.goalType) {
      case 0: available = count((c) => c.type === g.microbeType); basis = `cells whose runtime type == ${g.microbeType} (Goal.as:49)`; break;
      case 1: available = count((c) => isGoodClass(c.type)); basis = 'GoodMicrobe-class placements (Goal.as:64)'; break;
      case 3: available = count((c) => isGoodClass(c.type) || isBadClass(c.type)); basis = 'any photographable microbe (Goal.as:79-90 counts every BE_PHOTOGRAPHED)'; break;
      case 4: available = count((c) => isBadClass(c.type)); basis = 'BadMicrobe-class placements incl. SuperInfection; microbeType is ignored (Goal.as:98-113)'; break;
      case 6: available = count((c) => c.type === 21); basis = 'antibiotic_pickup placements; each EXPLODE_ANTIBIOTIC counts once regardless of what it hits (Goal.as:153-164, PlatformGame.as:874-879)'; break;
      case 7: available = count((c) => c.type === 20); basis = 'milk_glass placements; each MILK_GLASS_EVENT_TURN_TO_YOGURT counts (Goal.as:141-152)'; break;
      default: available = null; basis = 'no handler in Goal.updateGoal';
    }
    a.available = available; a.basis = basis;
    a.enough = available === null ? false : available >= g.required;
    if (!a.handled) add('error', 'goal-unhandled', `Goal ${gi} type ${g.goalType} (${g.goalTypeName}) has no handler in Goal.updateGoal; the level can only be finished with the HOME/ALT cheat (PlatformGame.as:1287-1290).`);
    else if (!a.enough) add('error', 'goal-not-enough-targets', `Goal ${gi} needs ${g.required} but only ${available} ${basis}.`);
    if (g.goalType === 0 && g.microbeType === 13) add('info', 'phone-no-patty-image', 'PHOTOGRAPH_SPECIFIC with microbeType 13 (Patty): STATE_CREATE_GUI has no Patty branch, so the phone shows no target picture (PlatformGame.as:340-350).');
    if (g.goalType === 4 && available > g.required) add('info', 'kill-all-overshoot', `KILL_ALL needs ${g.required} but ${available} bad microbes exist; isGoalMet uses == (Goal.as:36), so two kills resolved in one frame that jump past ${g.required} would leave the goal unmet.`);
    if (g.goalType === 4 && g.microbeType !== null) a.note = `microbeType ${g.microbeType} is ignored by KILL_ALL; any BadMicrobe death counts.`;
    return a;
  });

  const cellMap = new Map(R.map((c) => [`${c.row},${c.col}`, c]));
  // Geometry footprints (the physics box is the clip's bounds, ParticleSystem.as:189-195)
  const cover = new Map(); // "r,c" -> anchor cell
  for (const c of R.filter((x) => x.type === 1 && x.movie)) {
    const fp = footprint(c.movie);
    c.footprint = { cols: fp.w, rows: fp.h, ...(fp.known ? { widthPx: fp.widthPx, heightPx: fp.heightPx } : {}) };
    for (let dr = 0; dr < fp.h; dr++) for (let dc = 0; dc < fp.w; dc++) {
      if (dr === 0 && dc === 0) continue;
      const k = `${c.row + dr},${c.col + dc}`; if (!cover.has(k)) cover.set(k, c);
    }
  }
  const overlaps = R.filter((c) => c.type === 1 && cover.has(`${c.row},${c.col}`)).map((c) => ({ row: c.row, col: c.col, movie: c.movie, insideBoxOf: { row: cover.get(`${c.row},${c.col}`).row, col: cover.get(`${c.row},${c.col}`).col, movie: cover.get(`${c.row},${c.col}`).movie } }));
  if (overlaps.length) add('info', 'overlapping-geometry', `${overlaps.length} geometry anchor(s) lie inside another tile's box (harmless overlap of solid boxes, but the art overlaps too).`, { cells: overlaps });
  const buried = R.filter((c) => c.type !== 1 && cover.has(`${c.row},${c.col}`)).map((c) => ({ row: c.row, col: c.col, movie: c.movie, insideBoxOf: cover.get(`${c.row},${c.col}`).movie }));
  if (buried.length) add('warn', 'entity-inside-geometry', `${buried.length} entity anchor(s) lie inside a geometry box; they start embedded in solid tiles.`, { cells: buried });
  const spill = [];
  for (const [k, a] of cover) { const [r, c] = k.split(',').map(Number); if (c >= rec.cols || r >= 9) spill.push({ row: r, col: c, from: { row: a.row, col: a.col, movie: a.movie } }); }
  if (spill.length) add('info', 'box-spills-outside-world', `${spill.length} footprint cell(s) of large tiles extend past col ${rec.cols - 1} or row 8 (outside worldMax).`, { cells: spill.slice(0, 20) });

  // Loose support hint: entities with no geometry (anchor or box) below any column their clip spans
  const solidAt = (r, c) => (cellMap.get(`${r},${c}`)?.type === 1) || cover.has(`${r},${c}`);
  const floating = R.filter((c) => {
    // Only microbes fall: pickups, portal are static; milk (:481) and superinfection (:514) are created gravityExcempt.
    if (!(isGoodClass(c.type) || isBadClass(c.type)) || c.type === 23) return false;
    const b = swfExports[c.movie]; const span = b && b.widthPx ? Math.max(1, Math.ceil(b.widthPx / 50 - 1e-6)) : 1;
    for (let dc = 0; dc < span; dc++) for (let r = c.row + 1; r < 9; r++) if (solidAt(r, c.col + dc)) return false;
    return true;
  });
  if (floating.length) add('info', 'entity-no-support', `${floating.length} microbe(s) have no geometry below any column their clip spans; if they fall they stop only at the worldMax clamp y = 450 - height (ParticleSystem.as:652).`, { cells: floating.map(({ row, col, movie }) => ({ row, col, movie })) });

  // Derived: ParticleSystem.maxChange, the per-step displacement cap applied to every dynamic body
  // (ParticleSystem.as:337-345). createBoxParticle lowers it to w/2, h/2 whenever ceil(w/2) < cap
  // (ParticleSystem.as:223-233) for every box created without maxChangeExcempt: all geometry
  // (PlatformGame.as:298), the player 49x100 (:387) and good/bad microbes (:427, :440, :456).
  // Pickups, portal, milk, superinfection, bullets, flash and bomb pass maxChangeExcempt = true.
  {
    let mx = 9999999, my = 9999999; const lowered = [];
    const feed = (w, h, what) => {
      if (w === null || h === null || w === undefined) return;
      if (Math.ceil(w / 2) < mx) { mx = w / 2; lowered.push({ axis: 'x', value: mx, by: what }); }
      if (Math.ceil(h / 2) < my) { my = h / 2; lowered.push({ axis: 'y', value: my, by: what }); }
    };
    for (let r = 0; r < rec.rows; r++) for (let c = 0; c <= rec.cols; c++) {
      const e = cellMap.get(`${r},${c}`); if (!e || e.type !== 1) continue;
      const b = swfExports[e.movie]; if (b) feed(b.widthPx, b.heightPx, e.movie);
    }
    feed(49, 100, 'player (forced 49x100)');
    for (const e of [...R].sort((a, b) => a.row - b.row || a.col - b.col)) {
      if ((isGoodClass(e.type) || isBadClass(e.type)) && e.type !== 23) { const b = swfExports[e.movie]; if (b) feed(b.widthPx, b.heightPx, e.movie); }
    }
    // Player jump with gravity (0,3000), drag 0.95, dt 0.03 (PlatformGame.as:150-153), impulse
    // -3 * jumpForce = -3 * (3000*8) (PlatformGame.as:397, PlayerEntity.as:416), one step.
    const dt2 = 0.03 * 0.03; let v = Math.max(-my, (-72000 + 3000) * dt2); let h = 0;
    while (v < 0) { h += -v; v = Math.max(-my, Math.min(my, v * 0.95 + 3000 * dt2)); }
    const vx = Math.min(mx, 4500 * dt2 / (1 - 0.95));
    rec.derivedPhysics = {
      note: 'Derived from SWF frame-1 bounds and the integration constants; not measured at runtime. Owner: physics notes.',
      maxChangeX: +mx.toFixed(2), maxChangeY: +my.toFixed(2), loweredBy: lowered,
      playerTopSpeedPxPerStep: +vx.toFixed(2), singleJumpApexPx: +h.toFixed(1), doubleJumpApexPxApprox: +(2 * h).toFixed(1),
    };
  }

  // ASCII renders. ascii = footprints painted; asciiAnchors = only the XML cells.
  const maxRow = Math.max(rec.rows - 1, ...R.map((c) => c.row), ...[...cover.keys()].map((k) => Number(k.split(',')[0])));
  const maxCol = Math.max(rec.cols - 1, ...R.map((c) => c.col), ...[...cover.keys()].map((k) => Number(k.split(',')[1])));
  const W = maxCol + 1;
  const ruler1 = '    ' + Array.from({ length: W }, (_, k) => (k % 10 === 0 ? String(Math.floor(k / 10) % 10) : ' ')).join('');
  const ruler2 = '    ' + Array.from({ length: W }, (_, k) => String(k % 10)).join('');
  const render = (withFootprint) => {
    const lines = [ruler1, ruler2];
    for (let r = 0; r <= maxRow; r++) {
      let s = '';
      for (let c = 0; c <= maxCol; c++) {
        const e = cellMap.get(`${r},${c}`);
        if (e) s += glyphFor(e);
        else if (withFootprint && cover.has(`${r},${c}`)) s += '+';
        else s += '.';
      }
      const mark = r >= 9 || r >= rec.rows ? '!' : ' ';
      lines.push(`${String(r).padStart(2)}${mark} ${s}`);
    }
    return lines;
  };
  rec.ascii = render(true);
  rec.asciiAnchors = render(false);
}

// ---------------------------------------------------------------------------------------------
// Distinct movie usage across the canonical levels and across everything
// ---------------------------------------------------------------------------------------------
function usage(filter) {
  const u = {};
  for (const l of levels.filter(filter)) {
    for (const c of l.resolvedCells || []) {
      const k = c.movie ?? `id${c.tileId}`;
      if (!u[k]) u[k] = { movie: k, tileId: c.tileId, type: c.type, typeName: c.typeName, setting: c.setting, label: tileDefinitions.find((d) => d.icon === c.movie)?.label ?? null, total: 0, perLevel: {} };
      u[k].total++; u[k].perLevel[l.file] = (u[k].perLevel[l.file] || 0) + 1;
    }
  }
  return Object.values(u).sort((a, b) => a.tileId - b.tileId);
}
const movieUsageCanonical = usage((l) => l.canonical);
const movieUsageAll = usage((l) => l.format === 'MapBuilder' && l.paletteDiff?.equivalentToRuntime);
const unusedDefinitions = runtimePalette.filter((d) => !movieUsageCanonical.some((u) => u.tileId === d.index)).map((d) => ({ index: d.index, icon: d.icon, label: d.label, typeString: d.typeString }));

// ---------------------------------------------------------------------------------------------
// Kitchen game (code-defined; src/ebug/junior/fridge/KitchenGame.as)
// ---------------------------------------------------------------------------------------------
const KG_FILE = path.join(SRC, 'junior', 'fridge', 'KitchenGame.as');
const kgLines = fs.readFileSync(KG_FILE, 'utf8').split(/\r?\n/);
const FOOD_TYPE = { TYPE_FRUIT: 0, TYPE_VEGETABLES: 1, TYPE_CUPBOARD: 4, TYPE_CHEESE: 5, TYPE_DOOR: 6, TYPE_RAW_MEAT: 7, TYPE_COOKED_MEAT: 9 };
const foods = [];
kgLines.forEach((l, k) => {
  const m = /allPossibleFood\.push\(\s*new FoodItem\(\s*FoodItem\.(\w+),\s*null,\s*"([^"]*)",\s*"([^"]*)"\)/.exec(l);
  if (m) { foods.push({ index: foods.length, foodType: FOOD_TYPE[m[1]], foodTypeName: m[1], name: m[2], linkage: m[3], states: [], source: `${rel(KG_FILE)}:${k + 1}` }); return; }
  const s = /foodState\[\s*FoodItem\.FOOD_STATE_(\w+)\s*\]\s*=\s*true/.exec(l);
  if (s && foods.length && /allPossibleFood\.length - 1/.test(l)) foods[foods.length - 1].states.push(s[1]);
});
const kl = (re) => `${rel(KG_FILE)}:${lineOf(KG_FILE, re)}`;
const kitchen = {
  note: 'There is no kitchen level file. The four kitchen levels are generated at random in code each time.',
  entry: { controllerEntry: 'NULL_KITCHEN_GAME', source: `${rel(GC_FILE)}:68`, shownWhen: 'round == 2 in showHoverboardOrKitchen (GameController.as:210-212)' },
  firstLevelCall: kl(/nextLevel\(0\);/),
  exitWhen: `level > 3 (${kl(/if \( level > 3 \)/)})`,
  levels: [
    { level: 0, items: 10, timeLeftSeconds: 60, categories: ['TYPE_VEGETABLES', 'TYPE_DOOR'], categoryPick: 'Math.round(Math.random()*(1-0))+0: veg 1/2, door 1/2', sneezes: false, source: `${rel(KG_FILE)}:910-935`, codeComment: '"10 items, 30 seconds, veg and door items" (the 30 is wrong; timeLeft is 60, :847)' },
    { level: 1, items: 10, timeLeftSeconds: 60, categories: ['TYPE_VEGETABLES', 'TYPE_DOOR', 'TYPE_FRUIT', 'TYPE_CUPBOARD'], categoryPick: 'Math.round(Math.random()*3): veg 1/6, door 1/3, fruit 1/3, cupboard 1/6', sneezes: true, source: `${rel(KG_FILE)}:936-971`, codeComment: '"10 items, 30 seconds, veg and door items" (copied comment; wrong on both counts)' },
    { level: 2, items: 10, timeLeftSeconds: 60, categories: ['TYPE_VEGETABLES', 'TYPE_DOOR', 'TYPE_FRUIT', 'TYPE_CUPBOARD', 'TYPE_RAW_MEAT', 'TYPE_CHEESE', 'TYPE_COOKED_MEAT'], categoryPick: 'Math.round(Math.random()*6): veg 1/12, door/fruit/cupboard/raw/cheese 1/6 each, cooked 1/12', sneezes: true, source: `${rel(KG_FILE)}:972-1022`, codeComment: '"10 items, 30 seconds, all items"' },
    { level: 3, items: 20, timeLeftSeconds: 120, categories: ['TYPE_VEGETABLES', 'TYPE_DOOR', 'TYPE_FRUIT', 'TYPE_CUPBOARD', 'TYPE_RAW_MEAT', 'TYPE_CHEESE', 'TYPE_COOKED_MEAT'], categoryPick: 'as level 2', sneezes: true, source: `${rel(KG_FILE)}:1023-1074`, codeComment: '"20 items, 45 seconds, all items" (timeLeft is 120, :845)' },
  ],
  timeLeftSource: `${rel(KG_FILE)}:844-848`,
  itemPick: 'Within a category: allPossibleFood index = category[Math.round(Math.random()*(category.length-1))], so the first and last entries of each category have half the weight of the others.',
  sneeze: {
    rule: 'Each second in STATE_WAIT: if GeneralFunctions.getRandom(0,10) > sneezeChance then startSneeze() and sneezeChance++ (KitchenGame.as:153-160). getRandom = Math.round(Math.random()*(max-min))+min (util/GeneralFunctions.as:3-5).',
    sneezeChanceStart: `7 for level > 0 (${rel(KG_FILE)}:857-860); undefined on level 0, so the comparison is false and level 0 never sneezes. levelSneezes is written but never read.`,
    perSecondProbability: { 7: 0.25, 8: 0.15, 9: 0.05, 10: 0 },
  },
  foods,
  duplicateFoodNames: [...new Set(foods.map((f) => f.name).filter((n, k, a) => a.indexOf(n) !== k))],
  validLocations: {
    source: kl(/function populateValidLocations/),
    TYPE_FRUIT: ['BOWL'], TYPE_VEGETABLES: ['FRIDGE_DRAWER'], TYPE_CUPBOARD: ['CUPBOARD'],
    TYPE_CHEESE: ['FRIDGE_UPPER', 'FRIDGE_MID'], TYPE_DOOR: ['FRIDGE_DOOR'], TYPE_RAW_MEAT: ['FRIDGE_LOWER'],
    TYPE_COOKED_MEAT: ['FRIDGE_MID', 'FRIDGE_UPPER'],
  },
  locationTypes: { CUPBOARD: 0, BOWL: 1, FRIDGE_UPPER: 2, FRIDGE_MID: 3, FRIDGE_LOWER: 4, FRIDGE_DRAWER: 5, FRIDGE_DOOR: 6, BIN: 7 },
  foodTypes: FOOD_TYPE,
};

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------
const out = {
  generatedBy: 'tools/analyse-levels.mjs',
  runtimeRules: {
    palette: 'Cells index tile_definitions.xml (erasers removed, movie = <icon>), not the level\'s own <tiles> (MapBuilder.as:70-82, TileDefinitionParser.as:419-512).',
    bodyLevel: 'body_level != "false" (including absent) means bodyLevel = true (MapBuilder.as:49).',
    goalParsing: 'new Goal(Number(goalType), microbeType as string, required as string) (MapBuilder.as:67). AS2 loose == makes the strings work; parse them as numbers in a port.',
    childOrder: 'MapBuilder reads <level> children by position: [0] goals, [1] tiles, [2] rows (MapBuilder.as:56-58).',
    worldSize: 'worldMin (0,-100), worldMax (cols*50, 450) (PlatformGame.as:260-261). TILE_WIDTH 50 (Constants.as:22).',
    timer: 'secondsLeft = 180 per level (PlatformGame.as:148); lives 3 (PlatformGame.as:381).',
    tileSize: 'Cell (row, col) has its top-left at (col*50, row*50). Tile and entity physics boxes take the clip\'s _width/_height, not 50x50 (ParticleSystem.as:189-195). Player box is forced to 49x100 (PlatformGame.as:387).',
  },
  constants: { entityTypes: ENTITY, goalTypes: GOAL_TYPE, microbeNames: MICROBE_NAME, goalTypeHandled: GOAL_HANDLED },
  startLevels,
  playOrder,
  glyphLegend: GLYPH_LEGEND,
  tileDefinitions,
  introLabels: { source: swfs[0]?.file, sprite: introSprite, labels: introLabels.map(({ label, frame }) => ({ label, frame })) },
  swf: { files: swfs.map((x) => ({ file: x.file, version: x.version, exportCount: x.exportCount })), note: 'widthPx/heightPx are the union of frame-1 child bounds (shape bounds include strokes; mask layers excluded). They approximate the clip _width/_height that createBoxParticle uses (ParticleSystem.as:189-195).', tileBounds: Object.fromEntries(tileDefinitions.filter((d) => d.icon).map((d) => [d.icon, swfExports[d.icon] || null])) },
  movieUsageCanonical,
  movieUsageAllMatchingPalettes: movieUsageAll,
  unusedDefinitionsInCanonicalLevels: unusedDefinitions,
  // resolvedCells (cells joined to their resolved movie/type/class/footprint) is kept for the
  // canonical levels and alpha_level11 only, to keep the file small; legacy files keep cells + palette.
  levels: levels.map((l) => {
    const keep = l.canonical || /^alpha_level\d+\.xml$/.test(l.file);
    const { resolvedCells, ...rest } = l;
    return keep ? l : { ...rest, resolvedCellsOmitted: true };
  }),
  kitchen,
};
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
// Pretty-print, but keep any object or array whose compact form is short on one line.
function stringify(v, ind = '') {
  const flat = JSON.stringify(v);
  if (flat === undefined) return 'null';
  if (flat.length <= 140 || v === null || typeof v !== 'object') return flat;
  const next = ind + ' ';
  if (Array.isArray(v)) return '[\n' + v.map((x) => next + stringify(x, next)).join(',\n') + '\n' + ind + ']';
  return '{\n' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => next + JSON.stringify(k) + ': ' + stringify(x, next)).join(',\n') + '\n' + ind + '}';
}
fs.writeFileSync(OUT_JSON, stringify(out) + '\n');

if (!QUIET) {
  console.log(`tile_definitions: ${tileDefinitions.length} entries, runtime palette ${runtimePalette.length}`);
  console.log(`swf exports: ${swfs.map((x) => `${x.file} ${x.exportCount}`).join(', ')}`);
  console.log(`level files: ${levels.length} (${levels.filter((l) => l.canonical).length} canonical)`);
  for (const p of playOrder) console.log(`  round ${p.round}: ${p.kind === 'kitchen' ? p.entry : p.file}`);
  for (const l of levels) {
    const errs = (l.checks || []).filter((c) => c.level === 'error').map((c) => c.id);
    const warns = (l.checks || []).filter((c) => c.level === 'warn').map((c) => c.id);
    console.log(`${l.canonical ? '*' : ' '} ${l.file.padEnd(28)} ${String(l.cols).padStart(3)}x${String(l.rows).padEnd(3)} next=${String(l.next).padEnd(18)} cells=${String(l.cells.length).padStart(4)} setting=${(l.setting || '-').padEnd(8)} err=[${errs.join(',')}] warn=[${warns.join(',')}]`);
  }
  console.log(`wrote ${rel(OUT_JSON)}`);
}
