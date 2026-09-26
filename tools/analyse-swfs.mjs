#!/usr/bin/env node
// Inventory and asset extraction for every SWF in the Flash original.
//
//   node tools/analyse-swfs.mjs [--no-browser] [--no-extract]
//
// Reads every .swf under reference/Junior_Game (movies/ and all subfolders, plus
// the stray top-level and src/ ones) and writes:
//   reference/analysis/swf-inventory.json      the machine-readable inventory
//   reference/analysis/bitmaps/<key>/<id>.*    every embedded bitmap (PNG or JPEG)
//   reference/analysis/sounds/<key>/<id>_*.*   every embedded sound (MP3 or WAV); none exist in this project
//   reference/analysis/swf-scripts/<key>.txt   decompiled AVM1 timeline scripts (frame, button, onClipEvent)
//
// <key> is the SWF path relative to reference/Junior_Game with the leading
// "movies/" dropped, "/" turned into "__", other unsafe characters into "_",
// and "root__" prepended for SWFs that sit directly in reference/Junior_Game
// (there are two ad.swf and two KitchenGame.swf, so basenames alone collide).
//
// Tag counts come from a raw walk of the tag headers (so DefineShape1-4,
// DefineBits/JPEG2/JPEG3/Lossless1/2 and the sound tags keep their real codes).
// Structured data (exports, sprites, labels, display lists, bitmaps) comes
// from swf-parser. Where swf-parser gives up on a tag it returns a RawBody; those
// are listed per SWF and, for morph shapes, their bounds are read directly.
//
// DefineBitsJPEG3 (JPEG plus a zlib alpha plane) needs a JPEG decoder to become a
// PNG. Node has none, so the tool decodes JPEGs in headless Chromium through
// Playwright (already a devDependency). With --no-browser, or if Chromium will
// not start, it writes <id>.jpg plus <id>_alpha.png instead.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSwf } from 'swf-parser';
import { TagType, FillStyleType } from 'swf-types';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = path.join(REPO, 'reference/Junior_Game');
const OUT_DIR = path.join(REPO, 'reference/analysis');
const ARGS = new Set(process.argv.slice(2));
const USE_BROWSER = !ARGS.has('--no-browser');
const EXTRACT = !ARGS.has('--no-extract');

// ---------------------------------------------------------------------------
// SWF tag codes (SWF File Format Specification v19, appendix "Tag list")
const TAG_NAMES = {
  0: 'End', 1: 'ShowFrame', 2: 'DefineShape', 4: 'PlaceObject', 5: 'RemoveObject', 6: 'DefineBits',
  7: 'DefineButton', 8: 'JPEGTables', 9: 'SetBackgroundColor', 10: 'DefineFont', 11: 'DefineText',
  12: 'DoAction', 13: 'DefineFontInfo', 14: 'DefineSound', 15: 'StartSound', 17: 'DefineButtonSound',
  18: 'SoundStreamHead', 19: 'SoundStreamBlock', 20: 'DefineBitsLossless', 21: 'DefineBitsJPEG2',
  22: 'DefineShape2', 23: 'DefineButtonCxform', 24: 'Protect', 26: 'PlaceObject2', 28: 'RemoveObject2',
  32: 'DefineShape3', 33: 'DefineText2', 34: 'DefineButton2', 35: 'DefineBitsJPEG3',
  36: 'DefineBitsLossless2', 37: 'DefineEditText', 39: 'DefineSprite', 41: 'ProductInfo',
  43: 'FrameLabel', 45: 'SoundStreamHead2', 46: 'DefineMorphShape', 48: 'DefineFont2',
  56: 'ExportAssets', 57: 'ImportAssets', 58: 'EnableDebugger', 59: 'DoInitAction',
  60: 'DefineVideoStream', 61: 'VideoFrame', 62: 'DefineFontInfo2', 63: 'DebugID', 64: 'EnableDebugger2',
  65: 'ScriptLimits', 66: 'SetTabIndex', 69: 'FileAttributes', 70: 'PlaceObject3', 71: 'ImportAssets2',
  72: 'DoABC(old)', 73: 'DefineFontAlignZones', 74: 'CSMTextSettings', 75: 'DefineFont3',
  76: 'SymbolClass', 77: 'Metadata', 78: 'DefineScalingGrid', 82: 'DoABC', 83: 'DefineShape4',
  84: 'DefineMorphShape2', 86: 'DefineSceneAndFrameLabelData', 87: 'DefineBinaryData',
  88: 'DefineFontName', 89: 'StartSound2', 90: 'DefineBitsJPEG4', 91: 'DefineFont4',
};
// Tags whose body starts with the UI16 character id they define.
const DEFINING = new Set([2, 6, 7, 10, 11, 14, 20, 21, 22, 32, 33, 34, 35, 36, 37, 39, 46, 48, 60, 75, 83, 84, 87, 90, 91]);
const SHAPE_CODES = [2, 22, 32, 83];
const MORPH_CODES = [46, 84];
const BITMAP_CODES = [6, 20, 21, 35, 36, 90];
const FONT_CODES = [10, 48, 75, 91];
const TEXT_CODES = [11, 33];
const BUTTON_CODES = [7, 34];
const SOUND_CODES = [14, 15, 17, 18, 19, 45, 89];

const SOUND_FORMATS = {
  0: 'uncompressed, native-endian', 1: 'ADPCM', 2: 'MP3', 3: 'uncompressed, little-endian',
  4: 'Nellymoser 16 kHz', 5: 'Nellymoser 8 kHz', 6: 'Nellymoser', 7: 'Speex',
};
// swf-parser reports rates as 5500/11000/22000/44000; the real rates are these.
const REAL_RATE = { 5500: 5512.5, 11000: 11025, 22000: 22050, 44000: 44100 };

// ---------------------------------------------------------------------------
// Small helpers
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');
const twipsToPx = (t) => t / 20;
const fixed = (v, div) => (v && typeof v === 'object' && 'epsilons' in v ? v.epsilons / div : (typeof v === 'number' ? v : 0));
const round2 = (n) => Math.round(n * 100) / 100;
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function listSwfs(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.swf$/i.test(e.name)) out.push(p);
    }
  })(dir);
  return out;
}

function swfKey(relToGame) {
  let k = relToGame.replace(/\.swf$/i, '');
  if (k.startsWith('movies/')) k = k.slice('movies/'.length);
  else if (!k.includes('/')) k = 'root__' + k;
  return k.split('/').map((s) => s.replace(/[^A-Za-z0-9_.-]+/g, '_')).join('__');
}

// ---------------------------------------------------------------------------
// Raw SWF walk: header plus every tag header (recursing into DefineSprite)
function decompressSwf(buf) {
  const sig = buf.toString('latin1', 0, 3);
  if (sig === 'FWS') return { sig, body: buf };
  if (sig === 'CWS') return { sig, body: Buffer.concat([buf.subarray(0, 8), zlib.inflateSync(buf.subarray(8))]) };
  throw new Error(`unsupported SWF signature ${sig}`);
}

class BitReader {
  constructor(buf, pos = 0) { this.buf = buf; this.pos = pos; this.bit = 0; }
  ub(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.buf[this.pos];
      v = v * 2 + ((byte >> (7 - this.bit)) & 1);
      if (++this.bit === 8) { this.bit = 0; this.pos++; }
    }
    return v;
  }
  sb(n) { if (n === 0) return 0; const v = this.ub(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }
  align() { if (this.bit) { this.bit = 0; this.pos++; } }
}

function readRect(buf, pos) {
  const br = new BitReader(buf, pos);
  const n = br.ub(5);
  const r = { xMin: br.sb(n), xMax: br.sb(n), yMin: br.sb(n), yMax: br.sb(n) };
  br.align();
  return { rect: r, end: br.pos };
}

function rawWalk(body) {
  const { end: afterRect } = readRect(body, 8);
  const tags = [];
  const walk = (p, end, spriteId) => {
    while (p < end) {
      const h = body.readUInt16LE(p); p += 2;
      const code = h >> 6; let len = h & 63;
      if (len === 63) { len = body.readUInt32LE(p); p += 4; }
      const t = { code, pos: p, len, spriteId };
      if (DEFINING.has(code) && len >= 2) t.charId = body.readUInt16LE(p);
      tags.push(t);
      if (code === 39) walk(p + 4, p + len, t.charId);
      p += len;
      if (code === 0 && spriteId !== null) break;
    }
  };
  walk(afterRect + 4, body.length, null);
  return tags;
}

// ---------------------------------------------------------------------------
// Geometry: bounding boxes of characters, the way Flash computes _width/_height
// (child rectangle transformed by the placement matrix, then axis-aligned).
function applyMatrix(m, x, y) {
  if (!m) return [x, y];
  const a = fixed(m.scaleX, 65536), d = fixed(m.scaleY, 65536);
  const b = fixed(m.rotateSkew0, 65536), c = fixed(m.rotateSkew1, 65536);
  return [a * x + c * y + (m.translateX || 0), b * x + d * y + (m.translateY || 0)];
}
function transformRect(m, r) {
  if (!r) return null;
  const pts = [applyMatrix(m, r.xMin, r.yMin), applyMatrix(m, r.xMax, r.yMin), applyMatrix(m, r.xMin, r.yMax), applyMatrix(m, r.xMax, r.yMax)];
  return {
    xMin: Math.min(...pts.map((p) => p[0])), xMax: Math.max(...pts.map((p) => p[0])),
    yMin: Math.min(...pts.map((p) => p[1])), yMax: Math.max(...pts.map((p) => p[1])),
  };
}
function unionRect(a, b) {
  if (!a) return b; if (!b) return a;
  return { xMin: Math.min(a.xMin, b.xMin), xMax: Math.max(a.xMax, b.xMax), yMin: Math.min(a.yMin, b.yMin), yMax: Math.max(a.yMax, b.yMax) };
}
function rectPx(r) {
  if (!r) return null;
  return { x: round2(twipsToPx(r.xMin)), y: round2(twipsToPx(r.yMin)), w: round2(twipsToPx(r.xMax - r.xMin)), h: round2(twipsToPx(r.yMax - r.yMin)) };
}

// ---------------------------------------------------------------------------
// AVM1 (ActionScript 1/2) bytecode: a light disassembler that turns frame
// scripts into short readable summaries (stop(), gotoAndPlay("walk"), ...).
const AVM1_OPS = {
  0x04: 'nextFrame', 0x05: 'prevFrame', 0x06: 'play', 0x07: 'stop', 0x08: 'toggleQuality', 0x09: 'stopSounds',
  0x0A: 'add', 0x0B: 'subtract', 0x0C: 'multiply', 0x0D: 'divide', 0x0E: 'equals', 0x0F: 'less', 0x10: 'and',
  0x11: 'or', 0x12: 'not', 0x13: 'stringEquals', 0x14: 'stringLength', 0x15: 'stringExtract', 0x17: 'pop',
  0x18: 'toInteger', 0x1C: 'getVariable', 0x1D: 'setVariable', 0x20: 'setTarget2', 0x21: 'stringAdd',
  0x22: 'getProperty', 0x23: 'setProperty', 0x24: 'cloneSprite', 0x25: 'removeSprite', 0x26: 'trace',
  0x27: 'startDrag', 0x28: 'endDrag', 0x29: 'stringLess', 0x2A: 'throw', 0x2B: 'castOp', 0x2C: 'implementsOp',
  0x30: 'randomNumber', 0x34: 'getTime', 0x3A: 'delete', 0x3B: 'delete2', 0x3C: 'defineLocal', 0x3D: 'callFunction',
  0x3E: 'return', 0x3F: 'modulo', 0x40: 'newObject', 0x41: 'defineLocal2', 0x42: 'initArray', 0x43: 'initObject',
  0x44: 'typeOf', 0x45: 'targetPath', 0x46: 'enumerate', 0x47: 'add2', 0x48: 'less2', 0x49: 'equals2',
  0x4A: 'toNumber', 0x4B: 'toString', 0x4C: 'pushDuplicate', 0x4D: 'stackSwap', 0x4E: 'getMember', 0x4F: 'setMember',
  0x50: 'increment', 0x51: 'decrement', 0x52: 'callMethod', 0x53: 'newMethod', 0x54: 'instanceOf', 0x55: 'enumerate2',
  0x60: 'bitAnd', 0x61: 'bitOr', 0x62: 'bitXor', 0x63: 'bitLShift', 0x64: 'bitRShift', 0x65: 'bitURShift',
  0x66: 'strictEquals', 0x67: 'greater', 0x68: 'stringGreater', 0x69: 'extends',
  0x81: 'gotoFrame', 0x83: 'getURL', 0x87: 'storeRegister', 0x88: 'constantPool', 0x8A: 'waitForFrame',
  0x8B: 'setTarget', 0x8C: 'gotoLabel', 0x8D: 'waitForFrame2', 0x8E: 'defineFunction2', 0x8F: 'try', 0x94: 'with',
  0x96: 'push', 0x99: 'jump', 0x9A: 'getURL2', 0x9B: 'defineFunction', 0x9D: 'if', 0x9E: 'call', 0x9F: 'gotoFrame2',
};

function readCString(buf, p) { let e = p; while (e < buf.length && buf[e] !== 0) e++; return [buf.toString('latin1', p, e), e + 1]; }

function disassembleAvm1(bytes) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ops = []; let pool = []; let p = 0;
  while (p < buf.length) {
    const offset = p;
    const code = buf[p++];
    if (code === 0) break;
    let len = 0;
    if (code >= 0x80) { len = buf.readUInt16LE(p); p += 2; }
    const body = buf.subarray(p, p + len); p += len;
    const op = { code, name: AVM1_OPS[code] || `op0x${code.toString(16)}`, offset, end: p };
    try {
      if (code === 0x88) {
        const n = body.readUInt16LE(0); let q = 2; pool = [];
        for (let i = 0; i < n; i++) { const [s, nq] = readCString(body, q); pool.push(s); q = nq; }
        op.pool = pool;
      } else if (code === 0x96) {
        const vals = []; let q = 0;
        while (q < body.length) {
          const t = body[q++];
          if (t === 0) { const [s, nq] = readCString(body, q); vals.push(JSON.stringify(s)); q = nq; }
          else if (t === 1) { vals.push(String(round2(body.readFloatLE(q)))); q += 4; }
          else if (t === 2) vals.push('null');
          else if (t === 3) vals.push('undefined');
          else if (t === 4) { vals.push(`r${body[q]}`); q += 1; }
          else if (t === 5) { vals.push(body[q] ? 'true' : 'false'); q += 1; }
          else if (t === 6) { const d = Buffer.concat([body.subarray(q + 4, q + 8), body.subarray(q, q + 4)]); vals.push(String(d.readDoubleLE(0))); q += 8; }
          else if (t === 7) { vals.push(String(body.readInt32LE(q))); q += 4; }
          else if (t === 8) { vals.push(JSON.stringify(pool[body[q]] ?? `c${body[q]}`)); q += 1; }
          else if (t === 9) { vals.push(JSON.stringify(pool[body.readUInt16LE(q)] ?? `c${body.readUInt16LE(q)}`)); q += 2; }
          else break;
        }
        op.values = vals;
      } else if (code === 0x81) op.frame = body.readUInt16LE(0) + 1;
      else if (code === 0x8C) op.label = readCString(body, 0)[0];
      else if (code === 0x9F) op.play = !!(body[0] & 1);
      else if (code === 0x87) op.register = body[0];
      else if (code === 0x99 || code === 0x9D) op.branch = body.readInt16LE(0);
      else if (code === 0x83) { const [u, q] = readCString(body, 0); op.url = u; op.target = readCString(body, q)[0]; }
      else if (code === 0x8B) op.target = readCString(body, 0)[0];
      else if (code === 0x9B) { // DefineFunction: name, UI16 numParams, params, UI16 codeSize
        let [name, q] = readCString(body, 0); const n = body.readUInt16LE(q); q += 2; const params = [];
        for (let i = 0; i < n; i++) { const [pn, nq] = readCString(body, q); params.push(pn); q = nq; }
        op.fn = name; op.params = params; op.bodyEnd = p + body.readUInt16LE(q);
      } else if (code === 0x8E) { // DefineFunction2: name, UI16 numParams, UI8 regCount, UI16 flags, (UI8 reg, name)*, UI16 codeSize
        let [name, q] = readCString(body, 0); const n = body.readUInt16LE(q); q += 2;
        q += 1; // register count
        const f1 = body[q]; const f2 = body[q + 1]; q += 2;
        // Preloaded registers are assigned from r1 in this order when their flag is set.
        const preload = []; if (f1 & 0x01) preload.push('this'); if (f1 & 0x04) preload.push('arguments'); if (f1 & 0x10) preload.push('super');
        if (f1 & 0x40) preload.push('_root'); if (f1 & 0x80) preload.push('_parent'); if (f2 & 0x01) preload.push('_global');
        const regNames = {}; preload.forEach((nm, k) => { regNames[`r${k + 1}`] = nm; });
        const params = [];
        for (let i = 0; i < n; i++) { const reg = body[q]; q += 1; const [pn, nq] = readCString(body, q); params.push(pn); if (reg) regNames[`r${reg}`] = pn; q = nq; }
        op.fn = name; op.params = params; op.regNames = regNames; op.bodyEnd = p + body.readUInt16LE(q);
      }
    } catch { /* truncated body: keep op name only */ }
    ops.push(op);
  }
  return { ops, pool };
}

// A small stack-based AVM1 decompiler for frame scripts. It follows the
// operand stack through straight-line code and prints statements such as
// `_parent.state = "idle"`, `gotoAndPlay("walk")`, `if (!x) { ... }` is shown as
// `if (!x) skip N bytes`. Good enough to read timeline scripts; not a full
// decompiler (loops and nested branches are flattened).
const PROPS = ['_x', '_y', '_xscale', '_yscale', '_currentframe', '_totalframes', '_alpha', '_visible', '_width', '_height', '_rotation', '_target', '_framesloaded', '_name', '_droptarget', '_url', '_highquality', '_focusrect', '_soundbuftime', '_quality', '_xmouse', '_ymouse'];
const BINOPS = { 0x0A: '+', 0x47: '+', 0x21: '+', 0x0B: '-', 0x0C: '*', 0x0D: '/', 0x3F: '%', 0x0E: '==', 0x49: '==', 0x13: '==', 0x66: '===', 0x0F: '<', 0x48: '<', 0x29: '<', 0x67: '>', 0x68: '>', 0x10: '&&', 0x11: '||', 0x60: '&', 0x61: '|', 0x62: '^', 0x63: '<<', 0x64: '>>', 0x65: '>>>', 0x54: 'instanceof' };
function decompileAvm1(bytes) {
  const { ops, pool } = disassembleAvm1(bytes);
  const out = []; let fnCount = 0;
  // One scope per function body: its own operand stack and register names.
  const scopes = [{ st: [], regs: {}, end: Infinity, anon: null }];
  const cur = () => scopes[scopes.length - 1];
  const unq = (v) => (typeof v === 'string' && /^".*"$/.test(v) ? JSON.parse(v) : v);
  const isLit = (v) => typeof v === 'string' && /^".*"$/.test(v);
  const member = (o, m) => (isLit(m) ? (/^\d+$/.test(unq(m)) ? `${o}[${unq(m)}]` : `${o}.${unq(m)}`) : `${o}[${m}]`);
  const push = (...v) => cur().st.push(...v);
  const pop = () => (cur().st.length ? cur().st.pop() : '?');
  const popArgs = () => { const n = Number(pop()); const a = []; for (let i = 0; i < (Number.isFinite(n) ? n : 0); i++) a.push(pop()); return a; };
  const indent = () => '  '.repeat(scopes.length - 1);
  const emit = (x) => out.push(indent() + x);
  const isCall = (v) => /^[A-Za-z_$][\w$.\[\]"?]*\(.*\)$/s.test(String(v)) || /^new /.test(String(v));
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]; const next = ops[i + 1];
    while (scopes.length > 1 && op.offset >= cur().end) { const sc = scopes.pop(); emit('}'); if (sc.anon) push(sc.anon); }
    switch (op.code) {
      case 0x88: break;
      case 0x96: for (const v of op.values) push(/^r\d+$/.test(v) ? (cur().regs[v] ?? v) : v); break;
      case 0x1C: { const n = pop(); push(isLit(n) ? String(unq(n)) : `eval(${n})`); break; }
      case 0x4E: { const m = pop(); const o = pop(); push(member(o, m)); break; }
      case 0x1D: { const v = pop(); const n = pop(); emit(`${isLit(n) ? unq(n) : `set(${n})`} = ${v}`); break; }
      case 0x4F: { const v = pop(); const m = pop(); const o = pop(); emit(`${member(o, m)} = ${v}`); break; }
      case 0x3C: { const v = pop(); emit(`var ${unq(pop())} = ${v}`); break; }
      case 0x41: emit(`var ${unq(pop())}`); break;
      case 0x3D: { const n = pop(); const a = popArgs(); push(`${isLit(n) ? unq(n) : n}(${a.join(', ')})`); break; }
      case 0x52: { const m = pop(); const o = pop(); const a = popArgs(); push(`${unq(m) === 'undefined' || unq(m) === '' ? o : member(o, m)}(${a.join(', ')})`); break; }
      case 0x40: { const n = unq(pop()); const a = popArgs(); push(`new ${n}(${a.join(', ')})`); break; }
      case 0x53: { const m = pop(); const o = pop(); const a = popArgs(); push(`new ${member(o, m)}(${a.join(', ')})`); break; }
      case 0x17: { const v = pop(); if (isCall(v)) emit(String(v)); break; }
      case 0x07: emit('stop()'); break;
      case 0x06: emit('play()'); break;
      case 0x04: emit('nextFrame()'); break;
      case 0x05: emit('prevFrame()'); break;
      case 0x09: emit('stopAllSounds()'); break;
      case 0x81: if (next && next.code === 0x06) { emit(`gotoAndPlay(${op.frame})`); i++; } else emit(`gotoAndStop(${op.frame})`); break;
      case 0x8C: if (next && next.code === 0x06) { emit(`gotoAndPlay(${JSON.stringify(op.label)})`); i++; } else emit(`gotoAndStop(${JSON.stringify(op.label)})`); break;
      case 0x9F: emit(`${op.play ? 'gotoAndPlay' : 'gotoAndStop'}(${pop()})`); break;
      case 0x12: push(`!${pop()}`); break;
      case 0x50: push(`${pop()} + 1`); break;
      case 0x51: push(`${pop()} - 1`); break;
      case 0x4C: { const v = pop(); push(v, v); break; }
      case 0x4D: { const a = pop(); const b = pop(); push(a, b); break; }
      case 0x87: { const st = cur().st; const v = st.length ? st[st.length - 1] : '?'; const r = `r${op.register}`; if (!(r in cur().regs) || cur().regs[r] === '?' || /^local:/.test(cur().regs[r])) cur().regs[r] = String(v).length > 60 ? `r${op.register}` : v; break; }
      case 0x9D: emit(`if (${pop()}) jump ${op.branch} bytes`); break;
      case 0x99: emit(`jump ${op.branch} bytes`); break;
      case 0x9B: case 0x8E: {
        const anon = op.fn ? null : `function#${++fnCount}`;
        emit(`${op.fn ? 'function ' + op.fn : anon} (${(op.params || []).join(', ')}) {`);
        if (op.bodyEnd && op.bodyEnd > op.end) scopes.push({ st: [], regs: { ...(op.regNames || {}) }, end: op.bodyEnd, anon });
        else { emit('}'); if (anon) push(anon); }
        break;
      }
      case 0x3E: emit(`return ${pop()}`); break;
      case 0x26: emit(`trace(${pop()})`); break;
      case 0x44: push(`typeof ${pop()}`); break;
      case 0x42: { const n = Number(pop()); const a = []; for (let k = 0; k < (Number.isFinite(n) ? n : 0); k++) a.push(pop()); push(`[${a.join(', ')}]`); break; }
      case 0x43: { const n = Number(pop()); const a = []; for (let k = 0; k < (Number.isFinite(n) ? n : 0); k++) { const v = pop(); a.push(`${unq(pop())}: ${v}`); } push(`{${a.reverse().join(', ')}}`); break; }
      case 0x22: { const idx = Number(unq(pop())); const t = pop(); push(`${t === '""' ? 'this' : unq(t)}.${PROPS[idx] ?? 'prop' + idx}`); break; }
      case 0x23: { const v = pop(); const idx = Number(unq(pop())); const t = pop(); emit(`${t === '""' ? 'this' : unq(t)}.${PROPS[idx] ?? 'prop' + idx} = ${v}`); break; }
      case 0x20: emit(`tellTarget(${pop()})`); break;
      case 0x8B: emit(`tellTarget(${JSON.stringify(op.target)})`); break;
      case 0x83: emit(`getURL(${JSON.stringify(op.url)}, ${JSON.stringify(op.target)})`); break;
      case 0x9A: { const t = pop(); const u = pop(); emit(`getURL(${u}, ${t})`); break; }
      case 0x25: emit(`removeMovieClip(${pop()})`); break;
      case 0x3A: { const m = pop(); const o = pop(); emit(`delete ${member(o, m)}`); break; }
      case 0x3B: emit(`delete ${unq(pop())}`); break;
      case 0x34: push('getTimer()'); break;
      case 0x30: push(`random(${pop()})`); break;
      case 0x18: push(`int(${pop()})`); break;
      case 0x4A: push(`Number(${pop()})`); break;
      case 0x4B: push(`String(${pop()})`); break;
      case 0x45: push(`targetPath(${pop()})`); break;
      case 0x46: case 0x55: emit(`for (var k in ${pop()}) ...`); push('null'); break;
      case 0x69: { const sup = pop(); const sub = pop(); emit(`${sub} extends ${sup}`); break; }
      default:
        if (BINOPS[op.code]) { const b = pop(); const a = pop(); push(`(${a} ${BINOPS[op.code]} ${b})`); }
        else emit(`/* ${op.name} */`);
    }
  }
  while (scopes.length > 1) { scopes.pop(); out.push('  '.repeat(scopes.length) + '}'); }
  return { lines: out, actionCount: ops.length, pool };
}

// Summarise a script: the decompiled statements joined on one line (capped),
// the full statement list (capped at 80 lines) and the constant pool.
function summariseScript(bytes) {
  const { lines, actionCount, pool } = decompileAvm1(bytes);
  const flat = lines.map((l) => l.trim()).join('; ').replace(/\{; /g, '{ ').replace(/; \}/g, ' }');
  return { summary: flat.length > 400 ? flat.slice(0, 397) + '...' : flat, code: lines.slice(0, 80), actionCount, strings: pool.slice(0, 40) };
}

// ---------------------------------------------------------------------------
// PNG / WAV writers and bitmap decoders
function encodePng(width, height, pixels, channels) {
  // channels: 1 = greyscale, 4 = RGBA (8 bits each)
  const colourType = channels === 1 ? 0 : 6;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colourType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function unpremultiply(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0) { rgba[i] = rgba[i + 1] = rgba[i + 2] = 0; }
    else if (a < 255) {
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.min(255, Math.round((rgba[i + k] * 255) / a));
    }
  }
  return rgba;
}

// DefineBitsLossless (version 1) and DefineBitsLossless2 (version 2).
// swf-parser hands back BitmapFormat(UI8) Width(UI16) Height(UI16) [ColorTableSize(UI8)] zlib-data.
function decodeLossless(data, version) {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const fmt = buf[0]; const w = buf.readUInt16LE(1); const h = buf.readUInt16LE(3);
  let off = 5; let ctSize = 0;
  if (fmt === 3) { ctSize = buf[5] + 1; off = 6; }
  const inflated = zlib.inflateSync(buf.subarray(off));
  const rgba = Buffer.alloc(w * h * 4);
  let expected;
  if (fmt === 3) {
    const entry = version === 2 ? 4 : 3;
    const rowBytes = (w + 3) & ~3;
    const pal = inflated.subarray(0, ctSize * entry);
    const px = inflated.subarray(ctSize * entry);
    expected = ctSize * entry + rowBytes * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const idx = px[y * rowBytes + x]; const o = (y * w + x) * 4;
      rgba[o] = pal[idx * entry]; rgba[o + 1] = pal[idx * entry + 1]; rgba[o + 2] = pal[idx * entry + 2];
      rgba[o + 3] = version === 2 ? pal[idx * entry + 3] : 255;
    }
  } else if (fmt === 4) { // PIX15, version 1 only: UB[1] pad, UB[5] R, UB[5] G, UB[5] B, rows padded to 32 bits
    const rowBytes = (w * 2 + 3) & ~3; expected = rowBytes * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = inflated.readUInt16BE(y * rowBytes + x * 2); const o = (y * w + x) * 4;
      rgba[o] = Math.round((((v >> 10) & 31) * 255) / 31); rgba[o + 1] = Math.round((((v >> 5) & 31) * 255) / 31);
      rgba[o + 2] = Math.round(((v & 31) * 255) / 31); rgba[o + 3] = 255;
    }
  } else if (fmt === 5) { // v1: PIX24 = reserved, R, G, B. v2: ARGB, premultiplied.
    expected = w * h * 4;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      rgba[o] = inflated[o + 1]; rgba[o + 1] = inflated[o + 2]; rgba[o + 2] = inflated[o + 3];
      rgba[o + 3] = version === 2 ? inflated[o] : 255;
    }
  } else throw new Error(`unknown lossless BitmapFormat ${fmt}`);
  if (version === 2) unpremultiply(rgba);
  return { width: w, height: h, rgba, bitmapFormat: fmt, colourTableSize: ctSize || undefined, inflatedBytes: inflated.length, expectedBytes: expected };
}

// Rebuild a clean baseline JPEG: drop every SOI/EOI before the first SOS (this
// removes Flash's erroneous FFD9FFD8 prefix and joins JPEGTables to DefineBits
// data), keep all other header segments, then copy the scan data verbatim.
function cleanJpeg(buf) {
  const parts = [Buffer.from([0xff, 0xd8])]; let p = 0;
  while (p < buf.length - 1) {
    if (buf[p] !== 0xff) { parts.push(buf.subarray(p)); break; }
    let q = p; while (q + 1 < buf.length && buf[q + 1] === 0xff) q++;
    const m = buf[q + 1];
    if (m === 0xd8 || m === 0xd9 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p = q + 2; continue; }
    if (m === 0xda) { parts.push(buf.subarray(q)); break; }
    const len = buf.readUInt16BE(q + 2);
    parts.push(buf.subarray(q, q + 2 + len)); p = q + 2 + len;
  }
  let out = Buffer.concat(parts);
  if (!(out[out.length - 2] === 0xff && out[out.length - 1] === 0xd9)) out = Buffer.concat([out, Buffer.from([0xff, 0xd9])]);
  return out;
}

function writeWav(samples /* Int16Array interleaved */, channels, rate) {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8, 'latin1');
  h.write('fmt ', 12, 'latin1'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(Math.round(rate), 24); h.writeUInt32LE(Math.round(rate) * channels * 2, 28); h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36, 'latin1'); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// SWF ADPCM (spec section "ADPCM compression"): 2-bit code size, then packets of
// 4096 samples per channel: SI16 initial sample, UB[6] initial step index, then
// 4095 codes of AdpcmCodeSize bits, sign-magnitude. Untested on real data here:
// no SWF in this project contains a sound.
const ADPCM_STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const ADPCM_INDEX = { 2: [-1, 2], 3: [-1, -1, 2, 4], 4: [-1, -1, -1, -1, 2, 4, 6, 8], 5: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16] };
function decodeAdpcm(data, channels, sampleCount) {
  const br = new BitReader(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  const bits = br.ub(2) + 2; const signMask = 1 << (bits - 1); const magMask = signMask - 1; const table = ADPCM_INDEX[bits];
  const out = new Int16Array(sampleCount * channels); let n = 0;
  const totalBits = data.byteLength * 8;
  const left = () => totalBits - (br.pos * 8 + br.bit);
  const clamp16 = (v) => Math.max(-32768, Math.min(32767, v));
  while (n < sampleCount && left() >= 22 * channels) {
    const ch = [];
    for (let c = 0; c < channels; c++) ch.push({ s: br.sb(16), i: br.ub(6) });
    for (let c = 0; c < channels; c++) out[n * channels + c] = ch[c].s;
    n++;
    for (let k = 1; k < 4096 && n < sampleCount && left() >= bits * channels; k++, n++) {
      for (let c = 0; c < channels; c++) {
        const code = br.ub(bits); const st = ch[c];
        const step = ADPCM_STEPS[st.i]; const mag = code & magMask;
        const delta = Math.floor(((2 * mag + 1) * step) / signMask);
        st.s = clamp16(code & signMask ? st.s - delta : st.s + delta);
        st.i = Math.max(0, Math.min(88, st.i + table[mag]));
        out[n * channels + c] = st.s;
      }
    }
  }
  return out.subarray(0, n * channels);
}

function mp3FrameCheck(buf) {
  // Walk MPEG audio frame headers: count frames and samples, confirm 0xFFE sync.
  const BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
  const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  let p = 0; let frames = 0; let samples = 0; let rate = 0; const firstSync = buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  while (p + 4 <= buf.length && buf[p] === 0xff && (buf[p + 1] & 0xe0) === 0xe0) {
    const ver = (buf[p + 1] >> 3) & 3; const layer = (buf[p + 1] >> 1) & 3; const bri = buf[p + 2] >> 4; const sri = (buf[p + 2] >> 2) & 3; const pad = (buf[p + 2] >> 1) & 1;
    if (layer !== 1 || bri === 0 || bri === 15 || sri === 3 || ver === 1) break; // layer III only
    const br = (ver === 3 ? BR[1] : BR[2])[bri] * 1000; rate = SR[ver][sri];
    const spf = ver === 3 ? 1152 : 576;
    const size = Math.floor((spf / 8) * br / rate) + pad;
    frames++; samples += spf; p += size;
  }
  return { firstSync, frames, samples, sampleRate: rate, durationSec: rate ? round2(samples / rate) : null, bytesWalked: p, bytesTotal: buf.length };
}

// ---------------------------------------------------------------------------
// Chromium JPEG decoder (via Playwright)
async function makeJpegDecoder() {
  if (!USE_BROWSER) return null;
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('about:blank');
    return {
      async decode(jpeg) {
        const res = await page.evaluate(async (b64) => {
          const bin = atob(b64); const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          const bmp = await createImageBitmap(new Blob([u8], { type: 'image/jpeg' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d');
          g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
          let s = ''; const CH = 0x8000;
          for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
          return { w: bmp.width, h: bmp.height, b64: btoa(s) };
        }, jpeg.toString('base64'));
        return { width: res.w, height: res.h, rgba: Buffer.from(res.b64, 'base64') };
      },
      close: () => browser.close(),
    };
  } catch (e) {
    console.warn(`[analyse-swfs] Chromium unavailable (${e.message.split('\n')[0]}); JPEG3 will be written as .jpg + _alpha.png`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-SWF analysis
function analyseSwf(file) {
  const fileBuf = fs.readFileSync(file);
  const relToGame = path.relative(SRC_ROOT, file).split(path.sep).join('/');
  const key = swfKey(relToGame);
  const { sig, body } = decompressSwf(fileBuf);
  const raw = rawWalk(body);
  const movie = parseSwf(fileBuf);
  const hdr = movie.header;

  // Raw tag census
  const tagCounts = {}; const tagCountsInSprites = {};
  const rawCodeById = new Map(); const rawTagById = new Map();
  for (const t of raw) {
    const n = TAG_NAMES[t.code] || `Unknown${t.code}`;
    tagCounts[n] = (tagCounts[n] || 0) + 1;
    if (t.spriteId !== null) tagCountsInSprites[n] = (tagCountsInSprites[n] || 0) + 1;
    if (t.charId !== undefined && t.spriteId === null) { rawCodeById.set(t.charId, t.code); rawTagById.set(t.charId, t); }
  }
  const countCodes = (codes) => raw.filter((t) => codes.includes(t.code)).length;

  // Dictionary from swf-parser
  const chars = new Map();
  const exportsList = []; const imports = []; let jpegTables = null; let bg = null; let fileAttributes = null;
  const unparsed = [];
  const fonts = []; const sounds = []; const bitmaps = [];
  let fontNames = new Map();
  for (const t of movie.tags) {
    switch (t.type) {
      case TagType.DefineShape: chars.set(t.id, { kind: 'shape', tag: t }); break;
      case TagType.DefineMorphShape: chars.set(t.id, { kind: 'morph', tag: t }); break;
      case TagType.DefineSprite: chars.set(t.id, { kind: 'sprite', tag: t }); break;
      case TagType.DefineText: chars.set(t.id, { kind: 'text', tag: t }); break;
      case TagType.DefineDynamicText: chars.set(t.id, { kind: 'editText', tag: t }); break;
      case TagType.DefineButton: chars.set(t.id, { kind: 'button', tag: t }); break;
      case TagType.DefineBitmap: chars.set(t.id, { kind: 'bitmap', tag: t }); bitmaps.push(t); break;
      case TagType.DefineSound: chars.set(t.id, { kind: 'sound', tag: t }); sounds.push(t); break;
      case TagType.DefineFont: case TagType.DefineGlyphFont: case TagType.DefineCffFont:
        chars.set(t.id, { kind: 'font', tag: t }); fonts.push(t); break;
      case TagType.DefineFontName: fontNames.set(t.fontId, t.name); break;
      case TagType.DefineVideoStream: chars.set(t.id, { kind: 'video', tag: t }); break;
      case TagType.ExportAssets: for (const a of t.assets) exportsList.push({ id: a.id, name: a.name }); break;
      case TagType.ImportAssets: imports.push({ url: t.url, assets: t.assets.map((a) => ({ id: a.id, name: a.name })) }); break;
      case TagType.DefineJpegTables: jpegTables = t.data; break;
      case TagType.SetBackgroundColor: bg = t.color; break;
      case TagType.FileAttributes: fileAttributes = t; break;
      case TagType.RawBody: {
        unparsed.push({ code: t.code, name: TAG_NAMES[t.code] || `Unknown${t.code}`, bytes: t.data.length });
        if (MORPH_CODES.includes(t.code)) {
          const b = Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength);
          const id = b.readUInt16LE(0);
          const s = readRect(b, 2); const e = readRect(b, s.end);
          chars.set(id, { kind: 'morph', raw: true, tag: { id, bounds: s.rect, morphBounds: e.rect } });
        } else if (DEFINING.has(t.code) && t.data.length >= 2) {
          chars.set(Buffer.from(t.data.buffer, t.data.byteOffset, 2).readUInt16LE(0), { kind: 'unparsed', code: t.code });
        }
        break;
      }
      default: break;
    }
  }
  // Name lookup (first export name wins; a symbol can be exported under two names)
  const exportNamesById = new Map();
  for (const e of exportsList) { if (!exportNamesById.has(e.id)) exportNamesById.set(e.id, []); exportNamesById.get(e.id).push(e.name); }
  const nameOf = (id) => (exportNamesById.get(id) || [])[0];

  // DoInitAction per sprite (AS2 class registration / #initclip code)
  const initActions = new Map();
  for (const t of movie.tags) if (t.type === TagType.DoInitAction) {
    const s = summariseScript(t.actions);
    initActions.set(t.spriteId, s);
  }

  // Timeline simulation
  const timelineCache = new Map();
  function simulate(tags, frameCountHint) {
    const dl = new Map(); const frames = []; const labels = []; const scripts = []; const instanceNames = new Map();
    const streamHeads = []; let streamBlocks = 0; const startSounds = []; let clipActionCount = 0;
    const snapshot = () => [...dl.entries()].sort((a, b) => a[0] - b[0]).map(([depth, e]) => ({ depth, ...e }));
    for (const t of tags) {
      switch (t.type) {
        case TagType.PlaceObject: {
          const prev = t.isUpdate ? dl.get(t.depth) : undefined;
          const e = prev ? { ...prev } : { matrix: null };
          if (t.characterId !== undefined) e.id = t.characterId;
          if (t.matrix) e.matrix = t.matrix;
          if (t.clipDepth !== undefined) e.clipDepth = t.clipDepth;
          if (t.name !== undefined) { e.name = t.name; if (e.id !== undefined && !instanceNames.has(t.name)) instanceNames.set(t.name, e.id); }
          if (t.clipActions && t.clipActions.length) clipActionCount++;
          dl.set(t.depth, e);
          break;
        }
        case TagType.RemoveObject: dl.delete(t.depth); break;
        case TagType.ShowFrame: frames.push(snapshot()); break;
        case TagType.FrameLabel: labels.push({ frame: frames.length + 1, name: t.name, ...(t.isAnchor ? { anchor: true } : {}) }); break;
        case TagType.DoAction: { const s = summariseScript(t.actions); scripts.push({ frame: frames.length + 1, summary: s.summary, actions: s.actionCount, ...(s.code.length > 1 || s.summary.length > 120 ? { code: s.code } : {}) }); break; }
        case TagType.SoundStreamHead: streamHeads.push({ frame: frames.length + 1, format: SOUND_FORMATS[t.streamFormat] ?? t.streamFormat, rate: REAL_RATE[t.streamSoundRate] || t.streamSoundRate, stereo: t.streamSoundType === 1, samplesPerBlock: t.streamSampleCount, latencySeek: t.latencySeek }); break;
        case TagType.SoundStreamBlock: streamBlocks++; break;
        case TagType.StartSound: startSounds.push({ frame: frames.length + 1, soundId: t.soundId, stop: !!t.soundInfo?.syncStop, loops: t.soundInfo?.loopCount }); break;
        default: break;
      }
    }
    if (frames.length === 0 || (frameCountHint && frames.length < frameCountHint)) frames.push(snapshot());
    return { frames, labels, scripts, instanceNames, streamHeads, streamBlocks, startSounds, clipActionCount };
  }
  function spriteTimeline(id) {
    if (!timelineCache.has(id)) { const c = chars.get(id); timelineCache.set(id, simulate(c.tag.tags, c.tag.frameCount)); }
    return timelineCache.get(id);
  }

  const boundsMemo = new Map();
  function charBounds(id, mode, stack = new Set()) {
    const k = `${id}:${mode}`;
    if (boundsMemo.has(k)) return boundsMemo.get(k);
    const c = chars.get(id); let r = null;
    if (!c || stack.has(id)) return null;
    stack.add(id);
    if (c.kind === 'shape') r = c.tag.bounds;
    else if (c.kind === 'morph') r = mode === 'first' ? c.tag.bounds : unionRect(c.tag.bounds, c.tag.morphBounds);
    else if (c.kind === 'text' || c.kind === 'editText') r = c.tag.bounds;
    else if (c.kind === 'button') {
      for (const rec of c.tag.records) if (mode === 'first' ? rec.stateUp : (rec.stateUp || rec.stateOver || rec.stateDown)) r = unionRect(r, transformRect(rec.matrix, charBounds(rec.characterId, mode, stack)));
    } else if (c.kind === 'sprite') {
      const tl = spriteTimeline(id);
      const fr = mode === 'first' ? tl.frames.slice(0, 1) : tl.frames;
      for (const f of fr) for (const e of f) if (e.id !== undefined) r = unionRect(r, transformRect(e.matrix, charBounds(e.id, mode, stack)));
    }
    stack.delete(id);
    boundsMemo.set(k, r);
    return r;
  }

  // Which bitmaps each character draws (via bitmap fill styles), recursively
  const shapeBitmaps = (tag) => {
    const ids = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        if (v.type === FillStyleType.Bitmap && typeof v.bitmapId === 'number' && v.bitmapId !== 65535) ids.add(v.bitmapId);
        for (const key of Object.keys(v)) if (key !== 'matrix') walk(v[key]);
      }
    };
    walk(tag.shape); return ids;
  };
  const usesMemo = new Map();
  function charUses(id, stack = new Set()) {
    if (usesMemo.has(id)) return usesMemo.get(id);
    const c = chars.get(id);
    const u = { bitmaps: new Set(), shapes: 0, morphs: 0, texts: 0, sprites: new Set() };
    if (!c || stack.has(id)) return u;
    stack.add(id);
    const add = (o) => { o.bitmaps.forEach((b) => u.bitmaps.add(b)); u.shapes += o.shapes; u.morphs += o.morphs; u.texts += o.texts; o.sprites.forEach((s) => u.sprites.add(s)); };
    if (c.kind === 'shape') { u.shapes = 1; shapeBitmaps(c.tag).forEach((b) => u.bitmaps.add(b)); }
    else if (c.kind === 'morph') { u.morphs = 1; if (!c.raw) shapeBitmaps(c.tag).forEach((b) => u.bitmaps.add(b)); }
    else if (c.kind === 'text' || c.kind === 'editText') u.texts = 1;
    else if (c.kind === 'button') { for (const rec of c.tag.records) add(charUses(rec.characterId, stack)); }
    else if (c.kind === 'sprite') {
      const seen = new Set();
      for (const t of c.tag.tags) if (t.type === TagType.PlaceObject && t.characterId !== undefined && !seen.has(t.characterId)) {
        seen.add(t.characterId);
        if (chars.get(t.characterId)?.kind === 'sprite') u.sprites.add(t.characterId);
        add(charUses(t.characterId, stack));
      }
    }
    stack.delete(id);
    usesMemo.set(id, u);
    return u;
  }

  // Parent graph for sprites (child -> set of parent sprite ids), root = 0
  const parents = new Map();
  const noteChild = (parent, child) => { if (!parents.has(child)) parents.set(child, new Set()); parents.get(child).add(parent); };
  for (const [id, c] of chars) {
    if (c.kind === 'sprite') for (const t of c.tag.tags) if (t.type === TagType.PlaceObject && t.characterId !== undefined) noteChild(id, t.characterId);
    if (c.kind === 'button') for (const rec of c.tag.records) noteChild(id, rec.characterId);
  }
  for (const t of movie.tags) if (t.type === TagType.PlaceObject && t.characterId !== undefined) noteChild(0, t.characterId);
  function exportedAncestors(id) {
    const out = new Set(); const seen = new Set(); const q = [id];
    while (q.length) {
      const cur = q.shift();
      for (const p of parents.get(cur) || []) {
        if (seen.has(p)) continue; seen.add(p);
        if (p === 0) out.add('(root timeline)');
        else if (nameOf(p) && !nameOf(p).startsWith('__Packages')) out.add(nameOf(p));
        else q.push(p);
      }
    }
    return [...out].sort();
  }

  const describeTimeline = (tl) => ({
    labels: tl.labels,
    instances: [...tl.instanceNames.entries()].map(([name, id]) => ({ name, charId: id, kind: chars.get(id)?.kind, ...(nameOf(id) ? { exportName: nameOf(id) } : {}), ...(chars.get(id)?.kind === 'sprite' && spriteTimeline(id).labels.length ? { labels: spriteTimeline(id).labels.map((l) => `${l.frame}:${l.name}`) } : {}) })),
    scripts: tl.scripts,
    ...(tl.clipActionCount ? { instancesWithOnClipEvent: tl.clipActionCount } : {}),
  });

  // Root timeline
  const rootTl = simulate(movie.tags, hdr.frameCount);
  let rootBoundsFirst = null;
  for (const e of rootTl.frames[0] || []) if (e.id !== undefined) rootBoundsFirst = unionRect(rootBoundsFirst, transformRect(e.matrix, charBounds(e.id, 'first')));

  // Exported symbols
  const exportedSprites = []; const otherExports = []; const classExports = [];
  for (const e of exportsList) {
    const c = chars.get(e.id);
    if (e.name.startsWith('__Packages.')) { classExports.push(e.name.slice('__Packages.'.length)); continue; }
    if (c && c.kind === 'sprite') {
      const tl = spriteTimeline(e.id); const uses = charUses(e.id);
      const init = initActions.get(e.id);
      exportedSprites.push({
        id: e.id, name: e.name,
        ...(e.name !== e.name.trim() ? { nameWarning: 'leading/trailing whitespace in linkage name' } : {}),
        frameCount: c.tag.frameCount,
        labels: tl.labels.map((l) => ({ frame: l.frame, name: l.name })),
        boundsFrame1: rectPx(charBounds(e.id, 'first')),
        boundsAllFrames: rectPx(charBounds(e.id, 'all')),
        hasMask: tl.frames.some((f) => f.some((x) => x.clipDepth !== undefined)),
        vectorOnly: uses.bitmaps.size === 0,
        bitmapIds: [...uses.bitmaps].sort((a, b) => a - b),
        shapeCount: uses.shapes, morphShapeCount: uses.morphs, textCount: uses.texts, nestedSpriteCount: uses.sprites.size,
        instances: describeTimeline(tl).instances,
        scripts: tl.scripts,
        ...(init ? { initAction: { actions: init.actionCount, summary: init.summary } } : {}),
      });
    } else {
      otherExports.push({ id: e.id, name: e.name, kind: c ? c.kind : 'unknown', ...(c && c.kind !== 'sound' ? { bounds: rectPx(charBounds(e.id, 'first')) } : {}) });
    }
  }
  // Sprites that are not exported but carry frame labels or run 20+ frames
  // (animation states nested inside exported clips, or on the root timeline)
  const labelledInternal = [];
  for (const [id, c] of chars) {
    if (c.kind !== 'sprite' || exportNamesById.has(id)) continue;
    const tl = spriteTimeline(id);
    if (!tl.labels.length && c.tag.frameCount < 20) continue;
    labelledInternal.push({ id, frameCount: c.tag.frameCount, labels: tl.labels.map((l) => ({ frame: l.frame, name: l.name })), usedBy: exportedAncestors(id), boundsFrame1: rectPx(charBounds(id, 'first')), boundsAllFrames: rectPx(charBounds(id, 'all')), vectorOnly: charUses(id).bitmaps.size === 0 });
  }

  // Sounds (DefineSound) and streams
  const soundInfo = sounds.map((s) => {
    const rate = REAL_RATE[s.soundRate] || s.soundRate;
    return {
      id: s.id, exportName: nameOf(s.id) || null, formatCode: s.format, format: SOUND_FORMATS[s.format] || String(s.format),
      rateHz: rate, is16Bit: s.soundSize === 16, stereo: s.soundType === 1, sampleCount: s.sampleCount,
      durationSec: round2(s.sampleCount / rate), bytes: s.data.length,
    };
  });
  const streams = [];
  const collectStreams = (label, tl) => { if (tl.streamHeads.length || tl.streamBlocks) streams.push({ timeline: label, heads: tl.streamHeads, blocks: tl.streamBlocks }); };
  collectStreams('root', rootTl);
  for (const [id, c] of chars) if (c.kind === 'sprite') collectStreams(`sprite ${id}${nameOf(id) ? ' ' + nameOf(id) : ''}`, spriteTimeline(id));
  const startSounds = rootTl.startSounds.map((s) => ({ ...s, timeline: 'root' }));
  for (const [id, c] of chars) if (c.kind === 'sprite') for (const s of spriteTimeline(id).startSounds) startSounds.push({ ...s, timeline: `sprite ${id}${nameOf(id) ? ' ' + nameOf(id) : ''}` });

  // Bitmap users
  const bitmapUsers = new Map();
  for (const s of exportedSprites) for (const b of s.bitmapIds) { if (!bitmapUsers.has(b)) bitmapUsers.set(b, []); bitmapUsers.get(b).push(s.name); }

  // Full decompiled dump of every timeline script in this SWF (frame scripts,
  // #initclip blocks of non-class symbols, button handlers, onClipEvent handlers).
  // Compiled AS2 classes (__Packages.*) are skipped: their source is in src/.
  const dumpLines = [];
  const dumpScript = (title, bytes) => {
    const d = decompileAvm1(bytes);
    if (!d.lines.length) return;
    dumpLines.push(`// ---- ${title} (${d.actionCount} actions)`, ...d.lines, '');
  };
  const eventNames = (ev) => Object.entries(ev || {}).filter(([, v]) => v === true).map(([k]) => k).join(',');
  const dumpTimeline = (label, tags) => {
    let frame = 1;
    for (const t of tags) {
      if (t.type === TagType.ShowFrame) frame++;
      else if (t.type === TagType.DoAction) dumpScript(`${label}, frame ${frame}`, t.actions);
      else if (t.type === TagType.PlaceObject && t.clipActions) for (const ca of t.clipActions) dumpScript(`${label}, frame ${frame}, instance ${t.name || '(depth ' + t.depth + ')'} of char ${t.characterId ?? '?'} onClipEvent(${eventNames(ca.events)})`, ca.actions);
    }
  };
  dumpTimeline('root timeline', movie.tags);
  for (const [id, c] of chars) {
    const nm = nameOf(id);
    if (nm && nm.startsWith('__Packages.')) continue;
    const label = `sprite ${id}${nm ? ' "' + nm + '"' : ''}`;
    if (c.kind === 'sprite') dumpTimeline(label, c.tag.tags);
    if (c.kind === 'button') for (const a of c.tag.actions || []) dumpScript(`button ${id}${nm ? ' "' + nm + '"' : ''} on(${eventNames(a.conditions)})`, a.actions);
  }
  for (const t of movie.tags) if (t.type === TagType.DoInitAction) {
    const nm = nameOf(t.spriteId);
    if (nm && nm.startsWith('__Packages.')) continue;
    dumpScript(`#initclip for sprite ${t.spriteId}${nm ? ' "' + nm + '"' : ''}`, t.actions);
  }

  const hasAbc = raw.some((t) => t.code === 82 || t.code === 72);
  const hasAvm1 = raw.some((t) => t.code === 12 || t.code === 59);
  const counts = {
    shapes: countCodes(SHAPE_CODES), morphShapes: countCodes(MORPH_CODES), sprites: countCodes([39]),
    bitmaps: countCodes(BITMAP_CODES), sounds: countCodes([14]), fonts: countCodes(FONT_CODES),
    staticTexts: countCodes(TEXT_CODES), editTexts: countCodes([37]), buttons: countCodes(BUTTON_CODES),
    frameLabels: countCodes([43]), doAction: countCodes([12]), doInitAction: countCodes([59]),
    soundTags: countCodes(SOUND_CODES), videoStreams: countCodes([60]),
  };

  return {
    path: rel(file), relToJuniorGame: relToGame, key, fileBytes: fileBuf.length, signature: sig,
    uncompressedBytes: body.length,
    swfVersion: hdr.swfVersion,
    stage: { widthPx: twipsToPx(hdr.frameSize.xMax - hdr.frameSize.xMin), heightPx: twipsToPx(hdr.frameSize.yMax - hdr.frameSize.yMin), twips: hdr.frameSize },
    frameRate: fixed(hdr.frameRate, 256), frameCount: hdr.frameCount,
    backgroundColour: bg ? '#' + [bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, '0')).join('') : null,
    actionScript: hasAbc ? 'AS3 (DoABC)' : hasAvm1 ? (classExports.length ? 'AS2 (AVM1, with compiled AS2 classes)' : 'AS1/AS2 (AVM1 bytecode)') : 'none',
    fileAttributes: fileAttributes ? { useAs3: fileAttributes.useAs3, useNetwork: fileAttributes.useNetwork, hasMetadata: fileAttributes.hasMetadata } : null,
    counts,
    tagCounts, tagCountsInsideSprites: tagCountsInSprites,
    unparsedBySwfParser: unparsed,
    exports: exportsList.map((e) => ({ id: e.id, name: e.name, kind: chars.get(e.id)?.kind || 'unknown' })),
    imports,
    as2Classes: classExports,
    rootTimeline: {
      frameCount: hdr.frameCount, showFrames: rootTl.frames.length, boundsFrame1: rectPx(rootBoundsFirst), ...describeTimeline(rootTl),
      placedOnFrame1: (rootTl.frames[0] || []).filter((e) => e.id !== undefined).map((e) => ({ depth: e.depth, charId: e.id, kind: chars.get(e.id)?.kind, ...(e.name ? { name: e.name } : {}), ...(nameOf(e.id) ? { exportName: nameOf(e.id) } : {}), ...(chars.get(e.id)?.kind === 'sprite' ? { frameCount: chars.get(e.id).tag.frameCount } : {}), bounds: rectPx(transformRect(e.matrix, charBounds(e.id, 'first'))) })),
    },
    exportedSprites, otherExports, notableInternalSprites: labelledInternal,
    fonts: fonts.map((f) => ({ id: f.id, code: TAG_NAMES[rawCodeById.get(f.id)], name: f.fontName || fontNames.get(f.id) || null, glyphs: f.glyphs ? f.glyphs.length : undefined, bold: f.isBold, italic: f.isItalic })),
    sounds: soundInfo, soundStreams: streams, startSounds,
    // internal, stripped before JSON output
    _scriptDump: dumpLines, _bitmaps: bitmaps, _jpegTables: jpegTables, _rawCodeById: rawCodeById, _bitmapUsers: bitmapUsers, _sounds: sounds, _nameOf: nameOf,
  };
}

// ---------------------------------------------------------------------------
// Extraction
async function extractAssets(results) {
  const decoder = EXTRACT ? await makeJpegDecoder() : null;
  const bitmapShaIndex = new Map();
  for (const r of results) {
    const outBitmaps = [];
    const bdir = path.join(OUT_DIR, 'bitmaps', r.key);
    if (EXTRACT && r._bitmaps.length) fs.mkdirSync(bdir, { recursive: true });
    for (const b of r._bitmaps) {
      const code = r._rawCodeById.get(b.id);
      const data = Buffer.from(b.data.buffer, b.data.byteOffset, b.data.byteLength);
      const rec = { id: b.id, tag: TAG_NAMES[code] || String(code), mediaType: b.mediaType, width: b.width, height: b.height, sourceSha1: sha1(data), exportName: r._nameOf(b.id) || null, usedBy: r._bitmapUsers.get(b.id) || [] };
      try {
        if (b.mediaType === 'image/x-swf-lossless1' || b.mediaType === 'image/x-swf-lossless2') {
          const d = decodeLossless(b.data, b.mediaType.endsWith('2') ? 2 : 1);
          rec.bitmapFormat = { 3: '8-bit colour-mapped', 4: '15-bit RGB', 5: d.bitmapFormat === 5 && b.mediaType.endsWith('2') ? '32-bit ARGB (premultiplied)' : '24-bit RGB' }[d.bitmapFormat];
          if (d.colourTableSize) rec.colourTableSize = d.colourTableSize;
          if (d.inflatedBytes !== d.expectedBytes) rec.warning = `inflated ${d.inflatedBytes} bytes, expected ${d.expectedBytes}`;
          const png = encodePng(d.width, d.height, d.rgba, 4);
          rec.pixelSha1 = sha1(d.rgba);
          rec.file = `bitmaps/${r.key}/${b.id}.png`;
          if (EXTRACT) fs.writeFileSync(path.join(bdir, `${b.id}.png`), png);
        } else if (b.mediaType === 'image/png' || b.mediaType === 'image/gif') {
          const ext = b.mediaType === 'image/png' ? 'png' : 'gif';
          rec.file = `bitmaps/${r.key}/${b.id}.${ext}`;
          if (EXTRACT) fs.writeFileSync(path.join(bdir, `${b.id}.${ext}`), data);
        } else if (b.mediaType === 'image/x-swf-jpeg3') {
          const off = data.readUInt32LE(0);
          const jpeg = cleanJpeg(data.subarray(4, 4 + off));
          const alpha = zlib.inflateSync(data.subarray(4 + off));
          rec.alphaBytes = alpha.length;
          if (alpha.length !== b.width * b.height) rec.warning = `alpha plane ${alpha.length} bytes, expected ${b.width * b.height}`;
          if (decoder) {
            const d = await decoder.decode(jpeg);
            if (d.width !== b.width || d.height !== b.height) rec.warning = `decoded ${d.width}x${d.height}, header says ${b.width}x${b.height}`;
            const rgba = d.rgba;
            // Is the JPEG colour premultiplied by alpha? The spec does not say. Measure it:
            // premultiplied data is (near) black where alpha = 0 and its colour/alpha
            // ratio stays around 1 for low-alpha pixels, while straight-alpha art keeps
            // full-strength colour there (ratio of opaqueMean/alpha, i.e. well above 2).
            let a0 = 0; let a0Sum = 0; let opaque = 0; let opaqueSum = 0; const ratios = [];
            for (let i = 0, a = 0; i < rgba.length; i += 4, a++) {
              const av = alpha[a] ?? 255; rgba[i + 3] = av;
              const mx = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
              if (av === 0) { a0++; a0Sum += mx; } else if (av === 255) { opaque++; opaqueSum += mx; } else if (av >= 16 && av < 128) ratios.push(mx / av);
            }
            ratios.sort((x, y) => x - y);
            const a0Mean = a0 ? a0Sum / a0 : null; const med = ratios.length ? ratios[ratios.length >> 1] : null;
            const premul = (a0Mean === null || a0Mean < 40) && (med === null || med < 1.6);
            rec.alphaCheck = {
              transparentPixels: a0, meanColourWhereTransparent: a0Mean === null ? null : round2(a0Mean),
              lowAlphaPixels: ratios.length, medianColourToAlphaRatio: med === null ? null : round2(med),
              meanColourWhereOpaque: opaque ? round2(opaqueSum / opaque) : null,
              verdict: a0 === 0 && ratios.length === 0 ? 'opaque' : premul ? 'premultiplied' : 'straight?',
            };
            if (premul) unpremultiply(rgba);
            rec.pixelSha1 = sha1(rgba);
            rec.file = `bitmaps/${r.key}/${b.id}.png`;
            if (EXTRACT) fs.writeFileSync(path.join(bdir, `${b.id}.png`), encodePng(d.width, d.height, rgba, 4));
          } else {
            rec.file = `bitmaps/${r.key}/${b.id}.jpg`; rec.alphaFile = `bitmaps/${r.key}/${b.id}_alpha.png`;
            if (EXTRACT) { fs.writeFileSync(path.join(bdir, `${b.id}.jpg`), jpeg); fs.writeFileSync(path.join(bdir, `${b.id}_alpha.png`), encodePng(b.width, b.height, alpha, 1)); }
          }
        } else { // image/jpeg (DefineBitsJPEG2, or JPEG3 without alpha) and x-swf-partial-jpeg (DefineBits + JPEGTables)
          let src = data;
          if (b.mediaType === 'image/x-swf-partial-jpeg') {
            rec.jpegTablesBytes = r._jpegTables ? r._jpegTables.length : 0;
            if (r._jpegTables && r._jpegTables.length) src = Buffer.concat([Buffer.from(r._jpegTables), data]);
          }
          const jpeg = cleanJpeg(src);
          if (decoder) {
            const d = await decoder.decode(jpeg);
            rec.decodedOk = d.width === b.width && d.height === b.height;
          }
          rec.file = `bitmaps/${r.key}/${b.id}.jpg`;
          if (EXTRACT) fs.writeFileSync(path.join(bdir, `${b.id}.jpg`), jpeg);
        }
      } catch (e) {
        rec.error = e.message;
      }
      if (!bitmapShaIndex.has(rec.sourceSha1)) bitmapShaIndex.set(rec.sourceSha1, []);
      bitmapShaIndex.get(rec.sourceSha1).push(`${r.key}#${b.id}`);
      outBitmaps.push(rec);
    }
    r.bitmaps = outBitmaps;

    // Sounds
    const sdir = path.join(OUT_DIR, 'sounds', r.key);
    for (const s of r._sounds) {
      const info = r.sounds.find((x) => x.id === s.id);
      const base = `${s.id}_${(info.exportName || 'unnamed').replace(/[^A-Za-z0-9_.-]+/g, '_')}`;
      const data = Buffer.from(s.data.buffer, s.data.byteOffset, s.data.byteLength);
      try {
        if (s.format === 2) {
          const seek = data.readInt16LE(0); const mp3 = data.subarray(2);
          info.seekSamples = seek; info.mp3 = mp3FrameCheck(mp3); info.file = `sounds/${r.key}/${base}.mp3`;
          if (EXTRACT) { fs.mkdirSync(sdir, { recursive: true }); fs.writeFileSync(path.join(sdir, `${base}.mp3`), mp3); }
        } else if (s.format === 1 || s.format === 0 || s.format === 3) {
          const ch = s.soundType === 1 ? 2 : 1; let pcm;
          if (s.format === 1) pcm = decodeAdpcm(s.data, ch, s.sampleCount);
          else if (s.soundSize === 16) pcm = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + (data.length & ~1)));
          else { pcm = new Int16Array(data.length); for (let i = 0; i < data.length; i++) pcm[i] = (data[i] - 128) << 8; }
          info.file = `sounds/${r.key}/${base}.wav`; info.decodedSamples = pcm.length / ch;
          if (EXTRACT) { fs.mkdirSync(sdir, { recursive: true }); fs.writeFileSync(path.join(sdir, `${base}.wav`), writeWav(pcm, ch, REAL_RATE[s.soundRate] || s.soundRate)); }
        } else info.note = 'Nellymoser/Speex: not decoded';
      } catch (e) { info.error = e.message; }
    }
  }
  if (decoder) await decoder.close();
  return [...bitmapShaIndex.entries()].filter(([, v]) => v.length > 1).map(([sourceSha1, occurrences]) => ({ sourceSha1, occurrences }));
}

// ---------------------------------------------------------------------------
// Cross-reference: linkage names used by level XML and by the AS2 source
function collectXmlMovies() {
  const dir = path.join(SRC_ROOT, 'levels'); const out = {};
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.xml')).sort()) {
    const text = fs.readFileSync(path.join(dir, f), 'latin1');
    const names = new Map();
    const lines = text.split('\n');
    lines.forEach((ln, i) => { for (const m of ln.matchAll(/<movie>([^<]*)<\/movie>/g)) { const n = m[1]; if (!names.has(n)) names.set(n, { line: i + 1, types: new Set(), tileIds: [], placed: 0 }); } });
    // Tile definitions (<tile id><movie><type>) and placements (<column><tile id/>)
    const defById = new Map();
    for (const m of text.matchAll(/<tile id="(\d+)">\s*<movie>([^<]*)<\/movie>\s*<type>(\d+)<\/type>/g)) {
      defById.set(m[1], m[2]);
      const e = names.get(m[2]); if (e) { e.types.add(Number(m[3])); e.tileIds.push(Number(m[1])); }
    }
    for (const m of text.matchAll(/<column id="\d+">\s*<tile id="(\d+)"\s*\/>/g)) { const n = defById.get(m[1]); if (n !== undefined && names.has(n)) names.get(n).placed++; }
    if (names.size) out[f] = [...names.entries()].map(([name, e]) => ({ name, line: e.line, entityTypes: [...e.types], tileIds: e.tileIds, placedInGrid: e.placed }));
  }
  return out;
}

function collectCodeRefs() {
  const refs = [];
  const dir = path.join(SRC_ROOT, 'src/ebug');
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.as')) {
        const lines = fs.readFileSync(p, 'latin1').split('\n');
        lines.forEach((ln, i) => {
          if (/^\s*\/\//.test(ln)) return;
          for (const m of ln.matchAll(/attachMovie\(\s*"([^"]+)"/g)) refs.push({ name: m[1], via: 'attachMovie', at: `${rel(p)}:${i + 1}` });
          for (const m of ln.matchAll(/new FoodItem\([^)]*"([^"]*)"\s*\)/g)) {
            refs.push({ name: m[1], via: 'FoodItem.assetName (attachMovie)', at: `${rel(p)}:${i + 1}` });
            refs.push({ name: 'clingfilm_' + m[1], via: 'FoodItem "clingfilm_" + assetName (attachMovie)', at: `${rel(p)}:${i + 1}` });
          }
        });
      }
    }
  })(dir);
  return refs;
}

// SWFs the shipped game loads at run time (from the AS2 source)
const RUNTIME_SWFS = [
  { swf: 'e-Bug Junior Game.swf', citedAt: 'reference/docs/junior-game-documentation.md (main game file, loads all other movies)' },
  { swf: 'junior_game_assets.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:83' },
  { swf: 'splash.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:84' },
  { swf: 'eBugGameShow.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:85' },
  { swf: 'introductionToMicrobes_mainMenu.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:86' },
  { swf: 'cutscene_introduction.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:87' },
  { swf: 'introductionToMicrobes_platformer.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:88' },
  { swf: 'harry.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:89, PlatformGame.as:168, fridge/FridgeMain.as:43' },
  { swf: 'amy.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:90, PlatformGame.as:166' },
  { swf: 'summary_page.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:91' },
  { swf: 'KitchenGame.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/GameController.as:92' },
  { swf: 'kitchen_game_main.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:121' },
  { swf: 'kitchen_game_intro_level_0.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:122' },
  { swf: 'kitchen_game_intro_level_1.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:123' },
  { swf: 'kitchen_game_intro_level_2.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:124' },
  { swf: 'kitchen_game_intro_level_3.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:125' },
  { swf: 'kitchen_game_outro.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as:126' },
  { swf: 'shrinking_harry.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/ShrinkingZone.as:25' },
  { swf: 'shrinking_amy.swf', citedAt: 'reference/Junior_Game/src/ebug/junior/ShrinkingZone.as:26' },
];

function crossReference(results) {
  const exporters = new Map(); // exact name -> [key]
  const exportersTrim = new Map();
  for (const r of results) for (const e of r.exports) {
    if (!exporters.has(e.name)) exporters.set(e.name, []); exporters.get(e.name).push(r.relToJuniorGame);
    const t = e.name.trim();
    if (!exportersTrim.has(t)) exportersTrim.set(t, []); exportersTrim.get(t).push(r.relToJuniorGame);
  }
  const platformer = results.find((r) => r.relToJuniorGame === 'movies/introductionToMicrobes_platformer.swf');
  const assets = results.find((r) => r.relToJuniorGame === 'movies/junior_game_assets.swf');
  const platformerNames = new Set(platformer.exports.map((e) => e.name));
  const assetNames = new Set(assets.exports.map((e) => e.name));
  const resolveForPlatformer = (n) => (platformerNames.has(n) ? 'introductionToMicrobes_platformer.swf (own export)' : assetNames.has(n) ? 'junior_game_assets.swf (via ImportAssets2 shared_library_link)' : null);

  const xml = collectXmlMovies(); const levelXml = {};
  for (const [file, names] of Object.entries(xml)) {
    levelXml[file] = {
      runtime: /^alpha_level\d+\.xml$/.test(file),
      names: names.map(({ name, line, entityTypes, tileIds, placedInGrid }) => ({
        name, line: `reference/Junior_Game/levels/${file}:${line}`, entityTypes, tileIds, placedInGrid,
        platformerResolves: name ? resolveForPlatformer(name) : null,
        exportedBy: exporters.get(name) || [],
        ...(!exporters.get(name) && exportersTrim.get(name.trim()) ? { exportedByAfterTrim: exportersTrim.get(name.trim()) } : {}),
      })),
    };
  }
  const code = collectCodeRefs().map((r) => ({ ...r, exportedBy: exporters.get(r.name) || [] }));
  return { levelXml, codeRefs: code };
}

// ---------------------------------------------------------------------------
async function main() {
  const files = listSwfs(SRC_ROOT);
  const results = [];
  for (const f of files) {
    try { results.push(analyseSwf(f)); }
    catch (e) { console.error(`[analyse-swfs] ${rel(f)}: ${e.stack}`); results.push({ path: rel(f), error: e.message }); }
  }
  const ok = results.filter((r) => !r.error);
  const duplicates = await extractAssets(ok);
  const xref = crossReference(ok);
  const scriptDir = path.join(OUT_DIR, 'swf-scripts');
  fs.rmSync(scriptDir, { recursive: true, force: true });
  fs.mkdirSync(scriptDir, { recursive: true });
  for (const r of ok) {
    if (!r._scriptDump.length) { r.scriptDump = null; continue; }
    const header = [`// Decompiled AVM1 timeline scripts from ${r.path}`, '// Generated by tools/analyse-swfs.mjs. Straight-line code is reconstructed from the operand', '// stack; branches appear as "if (cond) jump N bytes" (N is a byte offset, not a line count).', ''];
    fs.writeFileSync(path.join(scriptDir, `${r.key}.txt`), header.concat(r._scriptDump).join('\n'));
    r.scriptDump = `swf-scripts/${r.key}.txt`;
  }
  for (const r of ok) for (const k of Object.keys(r)) if (k.startsWith('_')) delete r[k];
  for (const r of ok) {
    const hit = RUNTIME_SWFS.find((x) => r.relToJuniorGame === `movies/${x.swf}`);
    r.loadedAtRuntime = hit ? hit.citedAt : false;
  }

  const totals = { swfs: results.length, bitmaps: 0, sounds: 0, soundTags: 0, exportedSprites: 0, exports: 0 };
  for (const r of ok) { totals.bitmaps += r.counts.bitmaps; totals.sounds += r.counts.sounds; totals.soundTags += r.counts.soundTags; totals.exportedSprites += r.exportedSprites.length; totals.exports += r.exports.length; }
  const inventory = {
    generatedBy: 'tools/analyse-swfs.mjs', generatedAt: new Date().toISOString(),
    sourceRoot: rel(SRC_ROOT),
    units: 'Bounds in pixels (twips / 20), relative to the symbol registration point. frameRate in frames per second. Frame numbers are 1-based as in the Flash IDE.',
    totals,
    runtimeLoadedSwfs: RUNTIME_SWFS,
    swfs: results,
    identicalBitmapsAcrossSwfs: duplicates,
    crossReference: xref,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'swf-inventory.json'), JSON.stringify(inventory, null, 1));
  console.log(JSON.stringify(totals));
}

main().catch((e) => { console.error(e); process.exit(1); });
