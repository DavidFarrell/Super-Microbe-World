// Runtime-only SWF patch that lets Ruffle render the platform levels of the 2009 e-Bug Junior Game.
//
// Why: movies/introductionToMicrobes_platformer.swf imports one dummy symbol ("shared_library_link")
// from movies/junior_game_assets.swf (ImportAssets2) and then calls attachMovie() with the linkage
// names that junior_game_assets.swf exports (tiles, microbe icons, pickups...). Flash Player 8 let an
// importing movie attach any export of a loaded shared library. Ruffle (0.6.0 and the
// 0.7.0-nightly.2026.9.26 build) does not: an unlisted name fails ("Unable to attach 'C_Chip_L_Tile'"),
// and when the name is listed the imported sprite's children are looked up by character id in the
// importing movie's library, so e.g. Unit_2_Tile (assets id 564, child shape 563) draws the
// platformer's own shape 563 instead (wrong art: giant eyes, black leaves, chip floors).
//
// What: mergeSharedLibrary(platformer, assets) copies every shape, bitmap and sprite definition of
// junior_game_assets.swf into the platformer with character ids shifted by OFFSET, rewrites the ids
// they reference (sprite PlaceObject tags, bitmap fills inside shapes), converts JPEGTables-based
// DefineBits to self-contained DefineBitsJPEG2, exports the 211 linkage names under the new ids and
// drops the ImportAssets2 tag. The assets' DoInitAction tags (unfinished avatar-colouring
// registerClass calls) are not copied. The result is an uncompressed FWS SWF held in memory and served
// in place of the original file; nothing on disk is modified.
'use strict';
const zlib = require('zlib');

const OFFSET = 2000;

function parseSwf(buf) {
  const sig = buf.toString('ascii', 0, 3);
  const body = sig === 'CWS' ? zlib.inflateSync(buf.subarray(8)) : Buffer.from(buf.subarray(8));
  const nbits = body[0] >> 3;
  const tagStart = Math.ceil((5 + 4 * nbits) / 8) + 4;
  return { version: buf[3], body, tagStart };
}
function* tags(body, pos, end = body.length) {
  while (pos < end) {
    const h = body.readUInt16LE(pos); const code = h >> 6; let len = h & 63, hl = 2;
    if (len === 63) { len = body.readUInt32LE(pos + 2); hl = 6; }
    yield { code, pos, hl, len, data: body.subarray(pos + hl, pos + hl + len) };
    pos += hl + len; if (code === 0) break;
  }
}
function tagBytes(code, data) {
  const long = data.length >= 63 || [6, 21, 35, 20, 36, 90].includes(code); // bitmaps always long form
  const h = Buffer.alloc(long ? 6 : 2);
  if (long) { h.writeUInt16LE((code << 6) | 63); h.writeUInt32LE(data.length, 2); } else h.writeUInt16LE((code << 6) | data.length);
  return Buffer.concat([h, data]);
}
const cstr = (b, p) => { const e = b.indexOf(0, p); return [b.toString('latin1', p, e), e + 1]; };

// ------------------------------------------------------------------ bit reader over a Buffer
class Bits {
  constructor(buf, pos) { this.b = buf; this.p = pos; this.bit = 0; }
  ub(n) { let v = 0; for (let i = 0; i < n; i++) { v = (v << 1) | ((this.b[this.p] >> (7 - this.bit)) & 1); if (++this.bit === 8) { this.bit = 0; this.p++; } } return v >>> 0; }
  sb(n) { const v = this.ub(n); return n && (v & (1 << (n - 1))) ? v - (1 << n) : v; }
  align() { if (this.bit) { this.bit = 0; this.p++; } return this.p; }
}
function skipRect(b, p) { const r = new Bits(b, p); const n = r.ub(5); r.ub(n * 4); return r.align(); }
function skipMatrix(b, p) {
  const r = new Bits(b, p);
  if (r.ub(1)) { const n = r.ub(5); r.ub(2 * n); }
  if (r.ub(1)) { const n = r.ub(5); r.ub(2 * n); }
  const n = r.ub(5); r.ub(2 * n); return r.align();
}
// Returns new byte position; pushes byte offsets of bitmap ids into `refs`.
function readFillStyle(b, p, shapeVer, refs) {
  const type = b[p++];
  if (type === 0x00) return p + (shapeVer >= 3 ? 4 : 3);
  if (type === 0x10 || type === 0x12 || type === 0x13) {
    p = skipMatrix(b, p);
    const n = b[p++] & 15; p += n * (1 + (shapeVer >= 3 ? 4 : 3));
    if (type === 0x13) p += 2;
    return p;
  }
  if (type >= 0x40 && type <= 0x43) { refs.push(p); p += 2; return skipMatrix(b, p); }
  throw new Error('unknown fill style type 0x' + type.toString(16));
}
function readFillArray(b, p, v, refs) { let n = b[p++]; if (n === 0xff && v >= 2) { n = b.readUInt16LE(p); p += 2; } for (let i = 0; i < n; i++) p = readFillStyle(b, p, v, refs); return p; }
function readLineArray(b, p, v, refs) {
  let n = b[p++]; if (n === 0xff && v >= 2) { n = b.readUInt16LE(p); p += 2; }
  for (let i = 0; i < n; i++) {
    if (v < 4) { p += 2 + (v >= 3 ? 4 : 3); continue; }
    p += 2; const f1 = b[p], f2 = b[p + 1]; p += 2;
    const join = (f1 >> 4) & 3, hasFill = (f1 >> 3) & 1;
    if (join === 2) p += 2;
    p = hasFill ? readFillStyle(b, p, v, refs) : p + 4;
    void f2;
  }
  return p;
}
// DefineShape 1/2/3/4: collect byte offsets of every bitmap id (initial and new styles)
function shapeBitmapRefs(data, code) {
  const v = { 2: 1, 22: 2, 32: 3, 83: 4 }[code]; const refs = [];
  let p = skipRect(data, 2);
  if (v === 4) { p = skipRect(data, p); p += 1; }
  p = readFillArray(data, p, v, refs); p = readLineArray(data, p, v, refs);
  const r = new Bits(data, p); let fb = r.ub(4), lb = r.ub(4);
  for (;;) {
    if (r.ub(1) === 0) {
      const flags = r.ub(5); if (flags === 0) break;
      if (flags & 1) { const n = r.ub(5); r.sb(n); r.sb(n); }
      if (flags & 2) r.ub(fb);
      if (flags & 4) r.ub(fb);
      if (flags & 8) r.ub(lb);
      if (flags & 16) { let q = r.align(); q = readFillArray(data, q, v, refs); q = readLineArray(data, q, v, refs); r.p = q; r.bit = 0; fb = r.ub(4); lb = r.ub(4); }
    } else if (r.ub(1)) { const n = r.ub(4) + 2; if (r.ub(1)) { r.sb(n); r.sb(n); } else { r.ub(1); r.sb(n); } }
    else { const n = r.ub(4) + 2; r.sb(n); r.sb(n); r.sb(n); r.sb(n); }
  }
  return refs;
}
// 0xFFFF is the "no bitmap" id Flash writes for empty bitmap fills; leave it alone
const bump = (buf, off) => { const v = buf.readUInt16LE(off); if (v !== 0xffff) buf.writeUInt16LE(v + OFFSET, off); };

function remapSprite(data) {
  const out = Buffer.from(data); bump(out, 0);
  for (const t of tags(out, 4)) {
    const d = t.pos + t.hl;
    if (t.code === 26 && (out[d] & 2)) bump(out, d + 3);                   // PlaceObject2: flags, depth, id
    else if (t.code === 70 && (out[d] & 2)) { let q = d + 4; if (out[d + 1] & 8) q = out.indexOf(0, q) + 1; bump(out, q); }
    else if (t.code === 4 || t.code === 5) bump(out, d);                    // PlaceObject / RemoveObject
    else if (t.code === 15) bump(out, d);                                   // StartSound
  }
  return out;
}

function mergeSharedLibrary(platformerBuf, assetsBuf) {
  const P = parseSwf(platformerBuf), A = parseSwf(assetsBuf);
  const ownExports = new Set();
  for (const t of tags(P.body, P.tagStart)) if (t.code === 56) { let n = t.data.readUInt16LE(0), p = 2; for (let i = 0; i < n; i++) { const [s, q] = cstr(t.data, p + 2); ownExports.add(s); p = q; } }
  let jpegTables = null; const defs = []; const exportsOut = []; const stats = { shapes: 0, bitmaps: 0, sprites: 0, fillRefs: 0, exports: 0 };
  for (const t of tags(A.body, A.tagStart)) {
    const c = t.code;
    if (c === 8) { jpegTables = Buffer.from(t.data); continue; }
    if ([2, 22, 32, 83].includes(c)) {
      const d = Buffer.from(t.data); const refs = shapeBitmapRefs(d, c); for (const r of refs) bump(d, r); bump(d, 0);
      stats.shapes++; stats.fillRefs += refs.length; defs.push(tagBytes(c, d)); continue;
    }
    if (c === 6) { // DefineBits + JPEGTables -> DefineBitsJPEG2
      const id = Buffer.alloc(2); id.writeUInt16LE(t.data.readUInt16LE(0) + OFFSET);
      defs.push(tagBytes(21, Buffer.concat([id, jpegTables || Buffer.alloc(0), t.data.subarray(2)]))); stats.bitmaps++; continue;
    }
    if ([20, 21, 35, 36, 90].includes(c)) { const d = Buffer.from(t.data); bump(d, 0); defs.push(tagBytes(c, d)); stats.bitmaps++; continue; }
    if (c === 39) { defs.push(tagBytes(39, remapSprite(t.data))); stats.sprites++; continue; }
    if (c === 56) { let n = t.data.readUInt16LE(0), p = 2; for (let i = 0; i < n; i++) { const id = t.data.readUInt16LE(p); const [s, q] = cstr(t.data, p + 2); if (!ownExports.has(s)) exportsOut.push([id + OFFSET, s]); p = q; } continue; }
    // skipped: FileAttributes, SetBackgroundColor, DoInitAction, root PlaceObject/ShowFrame/End
  }
  const ex = [Buffer.from([exportsOut.length & 255, exportsOut.length >> 8])];
  for (const [id, s] of exportsOut) { const b = Buffer.alloc(2); b.writeUInt16LE(id); ex.push(b, Buffer.from(s + '\0', 'latin1')); }
  stats.exports = exportsOut.length;
  // keep the old import id resolvable: an empty sprite, as shared_library_link itself is empty
  const importIds = [];
  for (const t of tags(P.body, P.tagStart)) if (t.code === 71 || t.code === 57) { let [, q] = cstr(t.data, 0); if (t.code === 71) q += 2; const n = t.data.readUInt16LE(q); q += 2; for (let i = 0; i < n; i++) { importIds.push(t.data.readUInt16LE(q)); q = cstr(t.data, q + 2)[1]; } }
  for (const id of importIds) { const d = Buffer.alloc(8); d.writeUInt16LE(id, 0); d.writeUInt16LE(1, 2); d.writeUInt16LE(1 << 6, 4); d.writeUInt16LE(0, 6); defs.push(tagBytes(39, d)); }
  const inject = Buffer.concat([...defs, tagBytes(56, Buffer.concat(ex))]);
  const parts = [P.body.subarray(0, P.tagStart)]; let injected = false;
  for (const t of tags(P.body, P.tagStart)) {
    if (t.code === 71 || t.code === 57) { parts.push(inject); injected = true; continue; } // replace the import tag
    if (!injected && (t.code === 1 || t.code === 0)) { parts.push(inject); injected = true; }
    parts.push(P.body.subarray(t.pos, t.pos + t.hl + t.len));
  }
  const body = Buffer.concat(parts); const head = Buffer.alloc(8);
  head.write('FWS', 0, 'ascii'); head[3] = P.version; head.writeUInt32LE(body.length + 8, 4);
  return { swf: Buffer.concat([head, body]), stats };
}

module.exports = { mergeSharedLibrary, OFFSET };

if (require.main === module) {
  const fs = require('fs'); const path = require('path');
  const m = path.resolve(__dirname, '../../reference/Junior_Game/movies');
  const { swf, stats } = mergeSharedLibrary(fs.readFileSync(path.join(m, 'introductionToMicrobes_platformer.swf')), fs.readFileSync(path.join(m, 'junior_game_assets.swf')));
  console.log(JSON.stringify(stats), swf.length, 'bytes');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], swf);
}
