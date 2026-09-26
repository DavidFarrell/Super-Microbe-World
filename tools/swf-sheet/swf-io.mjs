// Byte-level SWF reader and writer (dev-only). Enough of the SWF 8 format to take an original
// Flash movie apart tag by tag, keep its definition tags verbatim, and write a new uncompressed
// movie with a synthetic root timeline. Reference: SWF File Format Specification v19.
//
// Nothing here interprets shapes or bitmaps: those bytes are copied as they are, so every
// gradient, bitmap fill and morph survives untouched and Ruffle renders the original data.

import zlib from 'node:zlib';

// Tag codes used by the tools (SWF spec, appendix "Tag list").
export const TAG = {
  End: 0, ShowFrame: 1, DefineShape: 2, PlaceObject: 4, RemoveObject: 5, DefineBits: 6,
  DefineButton: 7, JPEGTables: 8, SetBackgroundColor: 9, DefineFont: 10, DefineText: 11,
  DoAction: 12, DefineFontInfo: 13, DefineSound: 14, StartSound: 15, DefineButtonSound: 17,
  SoundStreamHead: 18, SoundStreamBlock: 19, DefineBitsLossless: 20, DefineBitsJPEG2: 21,
  DefineShape2: 22, DefineButtonCxform: 23, Protect: 24, PlaceObject2: 26, RemoveObject2: 28,
  DefineShape3: 32, DefineText2: 33, DefineButton2: 34, DefineBitsJPEG3: 35,
  DefineBitsLossless2: 36, DefineEditText: 37, DefineSprite: 39, ProductInfo: 41, FrameLabel: 43,
  SoundStreamHead2: 45, DefineMorphShape: 46, DefineFont2: 48, ExportAssets: 56, ImportAssets: 57,
  EnableDebugger: 58, DoInitAction: 59, DefineVideoStream: 60, VideoFrame: 61, DefineFontInfo2: 62,
  DebugID: 63, EnableDebugger2: 64, ScriptLimits: 65, SetTabIndex: 66, FileAttributes: 69,
  PlaceObject3: 70, ImportAssets2: 71, DefineFontAlignZones: 73, CSMTextSettings: 74,
  DefineFont3: 75, SymbolClass: 76, Metadata: 77, DefineScalingGrid: 78, DoABC: 82,
  DefineShape4: 83, DefineMorphShape2: 84, DefineSceneAndFrameLabelData: 86, DefineBinaryData: 87,
  DefineFontName: 88, StartSound2: 89, DefineBitsJPEG4: 90, DefineFont4: 91,
};

export const SHAPE_TAGS = new Set([TAG.DefineShape, TAG.DefineShape2, TAG.DefineShape3, TAG.DefineShape4]);
export const MORPH_TAGS = new Set([TAG.DefineMorphShape, TAG.DefineMorphShape2]);
export const TEXT_TAGS = new Set([TAG.DefineText, TAG.DefineText2]);
export const BUTTON_TAGS = new Set([TAG.DefineButton, TAG.DefineButton2]);
export const BITMAP_TAGS = new Set([TAG.DefineBits, TAG.DefineBitsLossless, TAG.DefineBitsJPEG2,
  TAG.DefineBitsJPEG3, TAG.DefineBitsLossless2, TAG.DefineBitsJPEG4]);
export const FONT_TAGS = new Set([TAG.DefineFont, TAG.DefineFont2, TAG.DefineFont3, TAG.DefineFont4]);

// Tags whose body starts with the UI16 id of the character they define.
export const DEFINING_TAGS = new Set([...SHAPE_TAGS, ...MORPH_TAGS, ...TEXT_TAGS, ...BUTTON_TAGS,
  ...BITMAP_TAGS, ...FONT_TAGS, TAG.DefineSound, TAG.DefineEditText, TAG.DefineSprite,
  TAG.DefineVideoStream, TAG.DefineBinaryData]);

// Root-timeline tags that are dropped when a movie is rebuilt: timeline control, scripts,
// sound playback, imports (their characters live in another file), and debug/meta records.
// FileAttributes and SetBackgroundColor are dropped too because the writer emits its own.
export const DROPPED_ROOT_TAGS = new Set([TAG.End, TAG.ShowFrame, TAG.PlaceObject, TAG.PlaceObject2,
  TAG.PlaceObject3, TAG.RemoveObject, TAG.RemoveObject2, TAG.DoAction, TAG.DoInitAction,
  TAG.FrameLabel, TAG.StartSound, TAG.StartSound2, TAG.SoundStreamHead, TAG.SoundStreamHead2,
  TAG.SoundStreamBlock, TAG.ImportAssets, TAG.ImportAssets2, TAG.FileAttributes,
  TAG.SetBackgroundColor, TAG.Metadata, TAG.Protect, TAG.EnableDebugger, TAG.EnableDebugger2,
  TAG.DebugID, TAG.ProductInfo, TAG.ScriptLimits, TAG.SetTabIndex, TAG.VideoFrame,
  TAG.SymbolClass, TAG.DoABC, TAG.DefineSceneAndFrameLabelData]);

// ---------------------------------------------------------------------------------------------
// Bit-level reading and writing (SWF bit fields are big-endian within bytes; integers are LE).

export class BitReader {
  constructor(buf, pos = 0) { this.buf = buf; this.pos = pos; this.bit = 0; }
  align() { if (this.bit) { this.bit = 0; this.pos++; } }
  ub(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const b = (this.buf[this.pos] >> (7 - this.bit)) & 1;
      v = v * 2 + b;
      if (++this.bit === 8) { this.bit = 0; this.pos++; }
    }
    return v;
  }
  sb(n) { if (!n) return 0; const v = this.ub(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }
  fb(n) { return this.sb(n) / 65536; }
  u8() { this.align(); return this.buf[this.pos++]; }
  u16() { this.align(); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  u32() { this.align(); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  str() {
    this.align();
    let e = this.pos;
    while (e < this.buf.length && this.buf[e] !== 0) e++;
    const s = this.buf.toString('latin1', this.pos, e);
    this.pos = e + 1;
    return s;
  }
  bytes(n) { this.align(); const b = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return b; }
  rect() {
    const n = this.ub(5);
    const r = { xMin: this.sb(n), xMax: this.sb(n), yMin: this.sb(n), yMax: this.sb(n) };
    this.align();
    return r;
  }
  // Returns the affine matrix {a, b, c, d, tx, ty} with translation in twips:
  // x' = a*x + c*y + tx, y' = b*x + d*y + ty.
  matrix() {
    const m = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    if (this.ub(1)) { const n = this.ub(5); m.a = this.fb(n); m.d = this.fb(n); }
    if (this.ub(1)) { const n = this.ub(5); m.b = this.fb(n); m.c = this.fb(n); }
    const n = this.ub(5);
    m.tx = this.sb(n); m.ty = this.sb(n);
    this.align();
    return m;
  }
  // CXFORM (withAlpha = false) or CXFORMWITHALPHA. Multipliers are 8.8 fixed (256 = 1).
  cxform(withAlpha) {
    const hasAdd = this.ub(1), hasMult = this.ub(1), n = this.ub(4);
    const cx = { rm: 256, gm: 256, bm: 256, am: 256, ra: 0, ga: 0, ba: 0, aa: 0 };
    if (hasMult) { cx.rm = this.sb(n); cx.gm = this.sb(n); cx.bm = this.sb(n); if (withAlpha) cx.am = this.sb(n); }
    if (hasAdd) { cx.ra = this.sb(n); cx.ga = this.sb(n); cx.ba = this.sb(n); if (withAlpha) cx.aa = this.sb(n); }
    this.align();
    return cx;
  }
}

export class BitWriter {
  constructor() { this.bytes = []; this.cur = 0; this.bit = 0; }
  align() { if (this.bit) { this.bytes.push(this.cur); this.cur = 0; this.bit = 0; } }
  ub(n, v) {
    for (let i = n - 1; i >= 0; i--) {
      const b = Math.floor(v / 2 ** i) & 1;
      this.cur |= b << (7 - this.bit);
      if (++this.bit === 8) { this.bytes.push(this.cur); this.cur = 0; this.bit = 0; }
    }
  }
  sb(n, v) { this.ub(n, v < 0 ? v + 2 ** n : v); }
  u8(v) { this.align(); this.bytes.push(v & 0xff); }
  u16(v) { this.align(); this.bytes.push(v & 0xff, (v >> 8) & 0xff); }
  u32(v) { this.align(); this.bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }
  str(s) { this.align(); for (const ch of Buffer.from(s, 'latin1')) this.bytes.push(ch); this.bytes.push(0); }
  raw(buf) { this.align(); for (const b of buf) this.bytes.push(b); }
  rect(r) {
    const n = Math.max(1, ...[r.xMin, r.xMax, r.yMin, r.yMax].map(sbits));
    this.ub(5, n); this.sb(n, r.xMin); this.sb(n, r.xMax); this.sb(n, r.yMin); this.sb(n, r.yMax);
    this.align();
  }
  matrix(m) {
    const fx = v => Math.round(v * 65536);
    const a = fx(m.a), d = fx(m.d), b = fx(m.b), c = fx(m.c);
    const tx = Math.round(m.tx), ty = Math.round(m.ty);
    if (a !== 65536 || d !== 65536) { const n = Math.max(sbits(a), sbits(d)); this.ub(1, 1); this.ub(5, n); this.sb(n, a); this.sb(n, d); } else this.ub(1, 0);
    if (b !== 0 || c !== 0) { const n = Math.max(sbits(b), sbits(c)); this.ub(1, 1); this.ub(5, n); this.sb(n, b); this.sb(n, c); } else this.ub(1, 0);
    const n = (tx || ty) ? Math.max(sbits(tx), sbits(ty)) : 0;
    this.ub(5, n);
    if (n) { this.sb(n, tx); this.sb(n, ty); }
    this.align();
  }
  cxformWithAlpha(cx) {
    const mult = [cx.rm, cx.gm, cx.bm, cx.am], add = [cx.ra, cx.ga, cx.ba, cx.aa];
    const hasMult = mult.some(v => v !== 256), hasAdd = add.some(v => v !== 0);
    const n = Math.max(1, ...(hasMult ? mult.map(sbits) : []), ...(hasAdd ? add.map(sbits) : []));
    this.ub(1, hasAdd ? 1 : 0); this.ub(1, hasMult ? 1 : 0); this.ub(4, n);
    if (hasMult) for (const v of mult) this.sb(n, v);
    if (hasAdd) for (const v of add) this.sb(n, v);
    this.align();
  }
  toBuffer() { this.align(); return Buffer.from(this.bytes); }
}

// Bits needed to hold v as a signed (two's complement) bit field.
function sbits(v) {
  v = Math.round(v);
  const mag = v < 0 ? -v - 1 : v; // -1 needs 1 bit, 1 needs 2, -2 needs 2, 2 needs 3 ...
  return mag === 0 ? 1 : Math.floor(Math.log2(mag)) + 2;
}

// ---------------------------------------------------------------------------------------------
// Movie container.

// Reads a SWF (FWS or CWS) into { version, frameSize, frameRate, frameCount, body, tags }.
// Each tag is { code, pos, headerLen, length, body (Buffer view), raw (header + body view) }.
export function readSwf(file) {
  const sig = file.toString('latin1', 0, 3);
  const version = file[3];
  const fileLength = file.readUInt32LE(4);
  let data;
  if (sig === 'FWS') data = file;
  else if (sig === 'CWS') data = Buffer.concat([file.subarray(0, 8), zlib.inflateSync(file.subarray(8))]);
  else throw new Error(`Unsupported SWF signature ${sig} (LZMA "ZWS" files are not handled)`);
  // harry.swf and amy.swf carry a few bytes past their stated length; only truncation matters.
  if (data.length < fileLength) console.warn(`warning: SWF is ${data.length} bytes, header says ${fileLength} (truncated?)`);
  const r = new BitReader(data, 8);
  const frameSize = r.rect();
  const frameRate = r.u16() / 256;
  const frameCount = r.u16();
  const tags = readTags(data, r.pos, data.length);
  return { version, frameSize, frameRate, frameCount, data, tags };
}

// Walks a tag stream (the root, or a DefineSprite's control tags) up to and including End.
export function readTags(buf, pos, end) {
  const tags = [];
  while (pos < end) {
    const start = pos;
    const codeAndLength = buf.readUInt16LE(pos); pos += 2;
    const code = codeAndLength >> 6;
    let length = codeAndLength & 0x3f;
    if (length === 0x3f) { length = buf.readUInt32LE(pos); pos += 4; }
    const headerLen = pos - start;
    tags.push({ code, pos: start, headerLen, length, body: buf.subarray(pos, pos + length), raw: buf.subarray(start, pos + length) });
    pos += length;
    if (code === TAG.End) break;
  }
  return tags;
}

// Encodes one tag. Long headers are used for bodies of 63 bytes or more, or when forced.
export function encodeTag(code, body = Buffer.alloc(0), forceLong = false) {
  if (body.length < 63 && !forceLong) {
    const h = Buffer.alloc(2); h.writeUInt16LE((code << 6) | body.length); return Buffer.concat([h, body]);
  }
  const h = Buffer.alloc(6); h.writeUInt16LE((code << 6) | 0x3f); h.writeUInt32LE(body.length, 2);
  return Buffer.concat([h, body]);
}

// Writes an uncompressed FWS movie from an array of already-encoded tag buffers (End is appended).
export function writeSwf({ version = 8, width, height, frameRate = 25, frameCount = 1, tags }) {
  const w = new BitWriter();
  w.rect({ xMin: 0, xMax: Math.round(width * 20), yMin: 0, yMax: Math.round(height * 20) });
  w.u16(Math.round(frameRate * 256));
  w.u16(frameCount);
  const head = w.toBuffer();
  const body = Buffer.concat([head, ...tags, encodeTag(TAG.End)]);
  const out = Buffer.alloc(8 + body.length);
  out.write('FWS', 0, 'latin1');
  out[3] = version;
  out.writeUInt32LE(out.length, 4);
  body.copy(out, 8);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Specific tag bodies.

// Length in bytes of one FILTER record (id byte included) starting at pos.
function filterLength(buf, pos) {
  switch (buf[pos]) {
    case 0: return 1 + 23;                                        // DropShadow
    case 1: return 1 + 9;                                         // Blur
    case 2: return 1 + 15;                                        // Glow
    case 3: return 1 + 27;                                        // Bevel
    case 4: case 7: return 1 + 1 + buf[pos + 1] * 5 + 19;         // GradientGlow, GradientBevel
    case 5: return 1 + 2 + 8 + buf[pos + 1] * buf[pos + 2] * 4 + 4 + 1; // Convolution
    case 6: return 1 + 80;                                        // ColorMatrix
    default: throw new Error(`Unknown filter id ${buf[pos]}`);
  }
}

// Length in bytes of a FILTERLIST starting at pos (so filters can be copied verbatim).
export function filterListLength(buf, pos) {
  let p = pos + 1;
  for (let i = 0; i < buf[pos]; i++) p += filterLength(buf, p);
  return p - pos;
}

// Largest blur/offset reach of a FILTERLIST, in pixels, used to pad capture cells.
export function filterReach(filters) {
  if (!filters) return 0;
  const fixed = p => filters.readInt32LE(p) / 65536;
  let reach = 0, pos = 1;
  for (let i = 0; i < filters[0]; i++) {
    const id = filters[pos], f = pos + 1;
    if (id === 0) reach = Math.max(reach, Math.max(fixed(f + 4), fixed(f + 8)) + Math.abs(fixed(f + 16)));
    else if (id === 3) reach = Math.max(reach, Math.max(fixed(f + 8), fixed(f + 12)) + Math.abs(fixed(f + 20)));
    else if (id === 1) reach = Math.max(reach, fixed(f), fixed(f + 4));
    else if (id === 2) reach = Math.max(reach, fixed(f + 4), fixed(f + 8));
    else reach = Math.max(reach, 40);
    pos += filterLength(filters, pos);
  }
  return reach;
}

// Parses PlaceObject, PlaceObject2 and PlaceObject3 bodies into a plain record. Clip actions
// are not parsed (they are scripts); everything that affects rendering is.
export function parsePlace(code, body) {
  const r = new BitReader(body);
  if (code === TAG.PlaceObject) {
    const p = { move: false, charId: r.u16(), depth: r.u16() };
    p.matrix = r.matrix();
    if (r.pos < body.length) p.cxform = r.cxform(false);
    return p;
  }
  const f1 = r.u8();
  const f2 = code === TAG.PlaceObject3 ? r.u8() : 0;
  const p = { move: !!(f1 & 0x01), depth: r.u16() };
  if (code === TAG.PlaceObject3 && ((f2 & 0x08) || ((f2 & 0x10) && (f1 & 0x02)))) p.className = r.str();
  if (f1 & 0x02) p.charId = r.u16();
  if (f1 & 0x04) p.matrix = r.matrix();
  if (f1 & 0x08) p.cxform = r.cxform(true);
  if (f1 & 0x10) p.ratio = r.u16();
  if (f1 & 0x20) p.name = r.str();
  if (f1 & 0x40) p.clipDepth = r.u16();
  if (f2 & 0x01) { const len = filterListLength(body, r.pos); p.filters = Buffer.from(r.bytes(len)); }
  if (f2 & 0x02) p.blendMode = r.u8();
  if (f2 & 0x04) p.cacheAsBitmap = r.u8();
  if (f2 & 0x20) p.visible = r.u8();
  if (f2 & 0x40) p.background = r.bytes(4);
  if (f1 & 0x80) p.hasClipActions = true;
  return p;
}

// Encodes a PlaceObject2 (or PlaceObject3 when filters, blend mode or bitmap caching are
// present) that places a character at a depth. Clip actions are never written.
export function encodePlace(p) {
  const po3 = !!(p.filters || (p.blendMode && p.blendMode > 1) || p.cacheAsBitmap);
  const w = new BitWriter();
  let f1 = 0x02; // HasCharacter
  if (p.matrix) f1 |= 0x04;
  if (p.cxform && !isIdentityCxform(p.cxform)) f1 |= 0x08;
  if (p.ratio !== undefined) f1 |= 0x10;
  if (p.name) f1 |= 0x20;
  if (p.clipDepth) f1 |= 0x40;
  w.u8(f1);
  if (po3) w.u8((p.filters ? 0x01 : 0) | (p.blendMode > 1 ? 0x02 : 0) | (p.cacheAsBitmap ? 0x04 : 0));
  w.u16(p.depth);
  w.u16(p.charId);
  if (f1 & 0x04) w.matrix(p.matrix);
  if (f1 & 0x08) w.cxformWithAlpha(p.cxform);
  if (f1 & 0x10) w.u16(p.ratio);
  if (f1 & 0x20) w.str(p.name);
  if (f1 & 0x40) w.u16(p.clipDepth);
  if (po3) {
    if (p.filters) w.raw(p.filters);
    if (p.blendMode > 1) w.u8(p.blendMode);
    if (p.cacheAsBitmap) w.u8(1);
  }
  return encodeTag(po3 ? TAG.PlaceObject3 : TAG.PlaceObject2, w.toBuffer());
}

export function isIdentityCxform(cx) {
  return !cx || (cx.rm === 256 && cx.gm === 256 && cx.bm === 256 && cx.am === 256 &&
    cx.ra === 0 && cx.ga === 0 && cx.ba === 0 && cx.aa === 0);
}

// DefineSprite: { id, frameCount, tags } with the control tags parsed in place.
export function parseSprite(body) {
  const id = body.readUInt16LE(0), frameCount = body.readUInt16LE(2);
  return { id, frameCount, tags: readTags(body, 4, body.length) };
}

// Encodes a DefineSprite from already-encoded control tags (ShowFrame and End are appended).
export function encodeSprite(id, controlTags, frames = 1) {
  const head = Buffer.alloc(4); head.writeUInt16LE(id, 0); head.writeUInt16LE(frames, 2);
  const show = [];
  for (let i = 0; i < frames; i++) show.push(encodeTag(TAG.ShowFrame));
  return encodeTag(TAG.DefineSprite, Buffer.concat([head, ...controlTags, ...show, encodeTag(TAG.End)]), true);
}

// Button character records (DefineButton / DefineButton2), for rendering the "up" state.
export function parseButtonRecords(code, body) {
  const r = new BitReader(body, code === TAG.DefineButton2 ? 5 : 2);
  const out = [];
  for (;;) {
    const flags = r.u8();
    if (flags === 0) break;
    const rec = { up: !!(flags & 0x01), over: !!(flags & 0x02), down: !!(flags & 0x04), hit: !!(flags & 0x08) };
    rec.charId = r.u16(); rec.depth = r.u16(); rec.matrix = r.matrix();
    if (code === TAG.DefineButton2) {
      rec.cxform = r.cxform(true);
      if (flags & 0x10) { const len = filterListLength(body, r.pos); rec.filters = Buffer.from(r.bytes(len)); }
      if (flags & 0x20) rec.blendMode = r.u8();
    }
    out.push(rec);
  }
  return out;
}

// Bounds of the character a definition tag defines, in twips, or null if it has none.
// Shapes use their shape bounds (strokes included), morph shapes return both start and end,
// static text applies its text matrix, edit text uses its field rectangle.
export function definitionBounds(code, body) {
  const r = new BitReader(body, 2);
  if (SHAPE_TAGS.has(code) || code === TAG.DefineEditText) return r.rect();
  if (MORPH_TAGS.has(code)) { const start = r.rect(); const end = r.rect(); return { start, end }; }
  if (TEXT_TAGS.has(code)) { const b = r.rect(); const m = r.matrix(); return transformRect(m, b); }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Matrix and colour-transform algebra (translation in twips).

export const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });

// Returns parent * child: the child's coordinates mapped into the parent's space.
export function multiply(p, c) {
  return {
    a: p.a * c.a + p.c * c.b, b: p.b * c.a + p.d * c.b,
    c: p.a * c.c + p.c * c.d, d: p.b * c.c + p.d * c.d,
    tx: p.a * c.tx + p.c * c.ty + p.tx, ty: p.b * c.tx + p.d * c.ty + p.ty,
  };
}

export function transformRect(m, r) {
  const pts = [[r.xMin, r.yMin], [r.xMax, r.yMin], [r.xMin, r.yMax], [r.xMax, r.yMax]]
    .map(([x, y]) => [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty]);
  return {
    xMin: Math.min(...pts.map(p => p[0])), xMax: Math.max(...pts.map(p => p[0])),
    yMin: Math.min(...pts.map(p => p[1])), yMax: Math.max(...pts.map(p => p[1])),
  };
}

export function unionRect(a, b) {
  if (!a) return b; if (!b) return a;
  return { xMin: Math.min(a.xMin, b.xMin), xMax: Math.max(a.xMax, b.xMax), yMin: Math.min(a.yMin, b.yMin), yMax: Math.max(a.yMax, b.yMax) };
}

export function intersectRect(a, b) {
  if (!a || !b) return null;
  const r = { xMin: Math.max(a.xMin, b.xMin), xMax: Math.min(a.xMax, b.xMax), yMin: Math.max(a.yMin, b.yMin), yMax: Math.min(a.yMax, b.yMax) };
  return r.xMin < r.xMax && r.yMin < r.yMax ? r : null;
}

// ---------------------------------------------------------------------------------------------
// Shape records: parse a DefineShape's outline records and rewrite them without some subpaths.
// Used to erase small details (such as a logo drawn as outlines) from otherwise original art.

export { sbits };

function skipFillStyle(r, code) {
  const type = r.u8();
  if (type === 0x00) r.bytes(code >= TAG.DefineShape3 ? 4 : 3);
  else if (type === 0x10 || type === 0x12 || type === 0x13) {
    r.matrix();
    r.align();
    const n = r.u8() & 0x0f;
    for (let i = 0; i < n; i++) { r.u8(); r.bytes(code >= TAG.DefineShape3 ? 4 : 3); }
    if (type === 0x13) r.u16();
  } else if (type >= 0x40 && type <= 0x43) { r.u16(); r.matrix(); }
  else throw new Error(`Unknown fill style type ${type}`);
}

function skipStyles(r, code) {
  let n = r.u8();
  if (n === 0xff && code !== TAG.DefineShape) n = r.u16();
  for (let i = 0; i < n; i++) skipFillStyle(r, code);
  n = r.u8();
  if (n === 0xff && code !== TAG.DefineShape) n = r.u16();
  for (let i = 0; i < n; i++) {
    r.u16();
    if (code === TAG.DefineShape4) {
      const f1 = r.u8(), f2 = r.u8();
      const join = (f1 >> 4) & 3, hasFill = (f1 >> 3) & 1;
      if (join === 2) r.u16();
      if (hasFill) skipFillStyle(r, code); else r.bytes(4);
      void f2;
    } else r.bytes(code >= TAG.DefineShape3 ? 4 : 3);
  }
}

// Parses the records of a DefineShape1-4 body. Returns { stylesEnd, numFill, numLine, records }
// where records are { style, flags, move, fill0, fill1, line, newStyles, numFill, numLine, x, y },
// { edge, straight, dx, dy | cx, cy, ax, ay, x0, y0 } or { end }, coordinates in twips.
export function parseShapeRecords(code, body) {
  const r = new BitReader(body, 2);
  r.rect();
  if (code === TAG.DefineShape4) { r.rect(); r.u8(); }
  skipStyles(r, code);
  const stylesEnd = r.pos;
  let numFill = r.ub(4), numLine = r.ub(4);
  const first = { numFill, numLine };
  const records = [];
  let x = 0, y = 0;
  for (;;) {
    if (r.ub(1) === 0) {
      const flags = r.ub(5);
      if (flags === 0) { records.push({ end: true }); break; }
      const rec = { style: true, flags };
      if (flags & 1) { const n = r.ub(5); x = r.sb(n); y = r.sb(n); rec.move = [x, y]; rec.moveBits = n; }
      if (flags & 2) rec.fill0 = r.ub(numFill);
      if (flags & 4) rec.fill1 = r.ub(numFill);
      if (flags & 8) rec.line = r.ub(numLine);
      if (flags & 16) {
        r.align();
        const s = r.pos;
        skipStyles(r, code);
        rec.newStyles = Buffer.from(body.subarray(s, r.pos));
        numFill = r.ub(4); numLine = r.ub(4);
      }
      rec.numFill = numFill; rec.numLine = numLine; rec.x = x; rec.y = y;
      records.push(rec);
    } else if (r.ub(1)) {
      const nb = r.ub(4) + 2;
      let dx = 0, dy = 0;
      const general = r.ub(1);
      if (general) { dx = r.sb(nb); dy = r.sb(nb); } else if (r.ub(1)) dy = r.sb(nb); else dx = r.sb(nb);
      records.push({ edge: true, straight: true, dx, dy, x0: x, y0: y, nb, general: !!general });
      x += dx; y += dy;
    } else {
      const nb = r.ub(4) + 2;
      const cx = r.sb(nb), cy = r.sb(nb), ax = r.sb(nb), ay = r.sb(nb);
      records.push({ edge: true, straight: false, cx, cy, ax, ay, x0: x, y0: y, nb });
      x += cx + ax; y += cy + ay;
    }
  }
  return { stylesEnd, ...first, records };
}

// Splits records into subpaths (each starts at a style record with a move, or at the first edge
// after one without) and returns [{ start, end, bounds }] indexes into records (end exclusive).
export function shapeSubpaths(records) {
  const paths = [];
  let cur = null;
  const close = () => { if (cur && cur.bounds) paths.push(cur); cur = null; };
  records.forEach((rec, i) => {
    if (rec.style && rec.move) close();
    if (!rec.edge) return;
    if (!cur) cur = { start: i, end: i + 1, bounds: null };
    const pts = rec.straight ? [[rec.x0, rec.y0], [rec.x0 + rec.dx, rec.y0 + rec.dy]]
      : [[rec.x0, rec.y0], [rec.x0 + rec.cx, rec.y0 + rec.cy], [rec.x0 + rec.cx + rec.ax, rec.y0 + rec.cy + rec.ay]];
    for (const [px, py] of pts) cur.bounds = unionRect(cur.bounds, { xMin: px, xMax: px, yMin: py, yMax: py });
    cur.end = i + 1;
  });
  close();
  return paths;
}

// Rewrites a DefineShape body keeping only edges whose record index passes keepEdge(i). Style
// records are all kept (style changes still apply); a move is inserted wherever removed edges
// would otherwise shift the pen. Returns the new body (id, bounds and style arrays unchanged).
export function rewriteShapeBody(code, body, keepEdge) {
  const { stylesEnd, numFill, numLine, records } = parseShapeRecords(code, body);
  const w = new BitWriter();
  w.raw(body.subarray(0, stylesEnd));
  w.ub(4, numFill); w.ub(4, numLine);
  let nFill = numFill, nLine = numLine, penX = 0, penY = 0;
  // Field widths of original records are kept, so an unmodified shape is rewritten byte for byte.
  const moveTo = (x, y, flags = 0, rec = null) => {
    w.ub(1, 0); w.ub(5, flags | 1);
    const n = rec?.moveBits ?? Math.max(sbits(x), sbits(y));
    w.ub(5, n); w.sb(n, x); w.sb(n, y);
    penX = x; penY = y;
    if (rec) writeStyleFields(rec);
  };
  const writeStyleFields = rec => {
    if (rec.flags & 2) w.ub(nFill, rec.fill0);
    if (rec.flags & 4) w.ub(nFill, rec.fill1);
    if (rec.flags & 8) w.ub(nLine, rec.line);
    if (rec.flags & 16) { w.raw(rec.newStyles); nFill = rec.numFill; nLine = rec.numLine; w.ub(4, nFill); w.ub(4, nLine); }
  };
  records.forEach((rec, i) => {
    if (rec.end) { w.ub(1, 0); w.ub(5, 0); return; }
    if (rec.style) {
      if (rec.move) moveTo(rec.move[0], rec.move[1], rec.flags, rec);
      else { w.ub(1, 0); w.ub(5, rec.flags); writeStyleFields(rec); }
      return;
    }
    if (!keepEdge(i)) return;
    if (penX !== rec.x0 || penY !== rec.y0) moveTo(rec.x0, rec.y0);
    w.ub(1, 1);
    if (rec.straight) {
      const nb = rec.nb;
      w.ub(1, 1); w.ub(4, nb - 2);
      if (rec.general) { w.ub(1, 1); w.sb(nb, rec.dx); w.sb(nb, rec.dy); }
      else { w.ub(1, 0); w.ub(1, rec.dx ? 0 : 1); w.sb(nb, rec.dx || rec.dy); }
      penX += rec.dx; penY += rec.dy;
    } else {
      const nb = rec.nb;
      w.ub(1, 0); w.ub(4, nb - 2);
      w.sb(nb, rec.cx); w.sb(nb, rec.cy); w.sb(nb, rec.ax); w.sb(nb, rec.ay);
      penX += rec.cx + rec.ax; penY += rec.cy + rec.ay;
    }
  });
  return w.toBuffer();
}
