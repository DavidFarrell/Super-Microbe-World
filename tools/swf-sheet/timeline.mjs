// Timeline interpretation and snapshot sprites (dev-only).
//
// To show frame k of a sprite S, S's display list is computed by replaying its PlaceObject and
// RemoveObject tags from frame 1 to k. Nested sprites advance with their parent: a child placed
// on parent frame b is on its own frame 1 at b and has been ticked (k - b) times at k, looping at
// its end, and constant stop()/play()/gotoAndPlay()/gotoAndStop() frame scripts are honoured
// (anything conditional is ignored). The result is written as a "snapshot sprite": a synthetic
// one-frame DefineSprite whose display list is that computed state, with nested sprites replaced
// by their own snapshots. Shapes, morph shapes (with their ratio) and text stay as leaves.
//
// Keeping the nesting (rather than flattening to leaves on one timeline) preserves clip layers
// (clipDepth masks apply at the same level as in the original), filters and blend modes, which
// apply to a whole group in Flash. Snapshots are memoised by content, so identical frames share
// one character id and are only rendered once.

import {
  TAG, SHAPE_TAGS, MORPH_TAGS, TEXT_TAGS, BUTTON_TAGS, BITMAP_TAGS, FONT_TAGS, DEFINING_TAGS,
  DROPPED_ROOT_TAGS, readSwf, shapeSubpaths, parseShapeRecords, rewriteShapeBody, parseSprite, parsePlace, parseButtonRecords, definitionBounds,
  encodePlace, encodeSprite, encodeTag, writeSwf, transformRect, unionRect, intersectRect,
  filterReach, IDENTITY, BitReader, multiply,
} from './swf-io.mjs';

// ---------------------------------------------------------------------------------------------
// AVM1 frame scripts: just enough to follow constant timeline control.

// Decodes a DoAction body into simple ops: ['stop'], ['play'], ['goto', frame|label, play],
// ['next'], ['prev'], ['set', name, value]. Parsing stops at the first action that is not a
// constant push or one of those (branches, calls, reads), which is recorded as ['complex'].
export function decodeSimpleActions(body) {
  const ops = [];
  const stack = [];
  let pool = [];
  let p = 0;
  while (p < body.length) {
    const op = body[p++];
    if (op === 0) break;
    let len = 0;
    if (op >= 0x80) { len = body.readUInt16LE(p); p += 2; }
    const d = p;
    p += len;
    switch (op) {
      case 0x07: ops.push(['stop']); break;
      case 0x06: ops.push(['play']); break;
      case 0x04: ops.push(['next']); break;
      case 0x05: ops.push(['prev']); break;
      case 0x81: ops.push(['goto', body.readUInt16LE(d) + 1, false]); break; // GotoFrame (0-based)
      case 0x8c: { let e = d; while (body[e]) e++; ops.push(['goto', body.toString('latin1', d, e), false]); break; } // GoToLabel
      case 0x9f: { // GotoFrame2: pops a frame number or label
        const flags = body[d];
        let target = stack.pop();
        if (target === undefined) { ops.push(['complex']); return ops; }
        if (typeof target === 'number' && flags & 0x02) target += body.readUInt16LE(d + 1);
        if (typeof target === 'string' && /^\d+$/.test(target)) target = +target;
        ops.push(['goto', target, !!(flags & 1)]);
        break;
      }
      case 0x88: { // ConstantPool
        const n = body.readUInt16LE(d); let q = d + 2; pool = [];
        for (let i = 0; i < n; i++) { let e = q; while (body[e]) e++; pool.push(body.toString('latin1', q, e)); q = e + 1; }
        break;
      }
      case 0x96: { // Push
        let q = d;
        while (q < d + len) {
          const t = body[q++];
          if (t === 0) { let e = q; while (body[e]) e++; stack.push(body.toString('latin1', q, e)); q = e + 1; }
          else if (t === 1) { stack.push(body.readFloatLE(q)); q += 4; }
          else if (t === 2) stack.push(null);
          else if (t === 3) stack.push(undefined);
          else if (t === 4) { ops.push(['complex']); return ops; } // register
          else if (t === 5) stack.push(!!body[q++]);
          else if (t === 6) { stack.push(readSwfDouble(body, q)); q += 8; }
          else if (t === 7) { stack.push(body.readInt32LE(q)); q += 4; }
          else if (t === 8) stack.push(pool[body[q++]]);
          else if (t === 9) { stack.push(pool[body.readUInt16LE(q)]); q += 2; }
          else { ops.push(['complex']); return ops; }
        }
        break;
      }
      case 0x1d: { const value = stack.pop(); const name = stack.pop(); ops.push(['set', name, value]); break; } // SetVariable
      case 0x3c: { const value = stack.pop(); const name = stack.pop(); ops.push(['set', name, value]); break; } // DefineLocal
      case 0x17: stack.pop(); break; // Pop
      default: ops.push(['complex']); return ops;
    }
  }
  return ops;
}

// SWF doubles store the two 32-bit halves swapped.
function readSwfDouble(buf, p) {
  const b = Buffer.alloc(8);
  buf.copy(b, 0, p + 4, p + 8); buf.copy(b, 4, p, p + 4);
  return b.readDoubleLE(0);
}

// Parses a timeline's control tags into frames [{ ops, labels, actions }], 0-based by index.
function parseTimeline(tags, frameCount) {
  const frames = [];
  let cur = { ops: [], labels: [], actions: [] };
  for (const t of tags) {
    if (t.code === TAG.ShowFrame) { frames.push(cur); cur = { ops: [], labels: [], actions: [] }; }
    else if (t.code === TAG.PlaceObject || t.code === TAG.PlaceObject2 || t.code === TAG.PlaceObject3) cur.ops.push({ place: parsePlace(t.code, t.body) });
    else if (t.code === TAG.RemoveObject) cur.ops.push({ remove: t.body.readUInt16LE(2) });
    else if (t.code === TAG.RemoveObject2) cur.ops.push({ remove: t.body.readUInt16LE(0) });
    else if (t.code === TAG.FrameLabel) { let e = 0; while (t.body[e]) e++; cur.labels.push(t.body.toString('latin1', 0, e)); }
    else if (t.code === TAG.DoAction) cur.actions.push(...decodeSimpleActions(t.body));
  }
  while (frames.length < frameCount) frames.push({ ops: [], labels: [], actions: [] });
  const labels = {};
  frames.forEach((f, i) => { for (const l of f.labels) if (!(l in labels)) labels[l] = i + 1; });
  return { frameCount: Math.max(frameCount, frames.length), frames, labels };
}

// ---------------------------------------------------------------------------------------------
// Library of one SWF's characters.

export class SwfLibrary {
  constructor(buffer, name = 'movie') {
    this.name = name;
    this.swf = readSwf(buffer);
    this.chars = new Map();
    this.exports = new Map();
    this.imported = new Set();
    this.keptTags = [];
    this.maxId = 0;
    const rootTags = [];
    for (const t of this.swf.tags) {
      if (DEFINING_TAGS.has(t.code)) {
        const id = t.body.readUInt16LE(0);
        const c = { id, code: t.code, kind: kindOf(t.code), tag: t };
        if (t.code === TAG.DefineSprite) {
          const sp = parseSprite(t.body);
          c.timeline = parseTimeline(sp.tags, sp.frameCount);
        } else if (BUTTON_TAGS.has(t.code)) {
          c.records = parseButtonRecords(t.code, t.body);
        } else {
          c.bounds = definitionBounds(t.code, t.body);
        }
        this.chars.set(id, c);
        this.maxId = Math.max(this.maxId, id);
      } else if (t.code === TAG.ExportAssets) {
        const r = new BitReader(t.body);
        for (let i = 0, n = r.u16(); i < n; i++) { const id = r.u16(); this.exports.set(r.str(), id); }
      } else if (t.code === TAG.ImportAssets || t.code === TAG.ImportAssets2) {
        const r = new BitReader(t.body);
        r.str();
        if (t.code === TAG.ImportAssets2) r.u16();
        for (let i = 0, n = r.u16(); i < n; i++) { const id = r.u16(); r.str(); this.imported.add(id); this.maxId = Math.max(this.maxId, id); }
      }
      if (!DROPPED_ROOT_TAGS.has(t.code)) this.keptTags.push({ raw: t.raw, id: DEFINING_TAGS.has(t.code) ? t.body.readUInt16LE(0) : undefined });
      else if (t.code !== TAG.FileAttributes && t.code !== TAG.SetBackgroundColor) rootTags.push(t);
      if (t.code === TAG.FileAttributes) this.fileAttributes = t.raw;
    }
    // The root timeline is kept apart so its instances (e.g. the avatar halves) can be targeted.
    this.root = parseTimeline(this.swf.tags.filter(t => t.code !== TAG.End), this.swf.frameCount);
    // The root timeline also acts as a pseudo sprite (id -1) so "root" can be rendered whole.
    this.chars.set(-1, { id: -1, kind: 'sprite', timeline: this.root });
    // Export names sometimes carry a stray leading space in these files; accept both.
    for (const [n, id] of [...this.exports]) if (n.trim() !== n && !this.exports.has(n.trim())) this.exports.set(n.trim(), id);
  }

  // Resolves "name", a numeric id, "root" (the whole root timeline) or "root:<instance>" (an
  // instance on the root timeline's frame 1) to { id, placement } where placement is the root
  // place record (or null).
  resolve(target) {
    // "a/b/c": resolve a, then descend through instances named b, c on each clip's frame 1,
    // composing their placement matrices (so the result shares a's registration point). The
    // innermost colour transform, filters and blend mode are kept; outer ones are reported.
    if (typeof target === 'string' && target.includes('/') && !target.startsWith('root:') || /^root:[^/]+\//.test(String(target))) {
      const parts = String(target).split('/');
      let { id, placement } = this.resolve(/^\d+$/.test(parts[0]) ? +parts[0] : parts[0]);
      let matrix = placement ? placement.matrix : IDENTITY;
      for (const name of parts.slice(1)) {
        const c = this.chars.get(id);
        if (!c || c.kind !== 'sprite') throw new Error(`${this.name}: ${target}: ${id} is not a sprite`);
        const inst = [...displayListAt(c.timeline, 1).values()].find(v => v.name === name);
        if (!inst) throw new Error(`${this.name}: ${target}: no instance named ${name}`);
        if (placement && (placement.cxform || placement.filters || placement.blendMode > 1)) console.warn(`  note: ${target}: outer effects of ${placement.name} are not applied`);
        matrix = multiply(matrix, inst.matrix);
        id = inst.charId;
        placement = { ...inst, matrix };
      }
      return { id, placement };
    }
    if (target === 'root') return { id: -1, placement: null };
    if (typeof target === 'number' || /^\d+$/.test(String(target))) return { id: +target, placement: null };
    if (String(target).startsWith('root:')) {
      const name = target.slice(5);
      const list = displayListAt(this.root, 1);
      // "root:#12" is the instance at depth 12 (for unnamed instances such as the splash TV).
      if (/^#\d+$/.test(name)) { const inst = list.get(+name.slice(1)); if (inst) return { id: inst.charId, placement: inst }; }
      for (const inst of list.values()) if (inst.name === name) return { id: inst.charId, placement: inst };
      throw new Error(`${this.name}: no root instance named ${name}`);
    }
    if (!this.exports.has(target)) throw new Error(`${this.name}: no export named ${target}`);
    return { id: this.exports.get(target), placement: null };
  }

  // Display list of sprite id at frame k, memoised.
  dl(id, k) {
    const c = this.chars.get(id);
    if (!c.dls) c.dls = new Map();
    if (!c.dls.has(k)) c.dls.set(k, displayListAt(c.timeline, k));
    return c.dls.get(k);
  }

  // State of a freshly created instance of sprite id after `age` ticks: { frame, created } where
  // created maps each depth of the display list at that frame to the tick its current instance
  // was created on. Constant frame scripts are followed (as playSequence). An instance survives
  // a frame change (linear play, loop or goto) when the new frame's display list holds the same
  // character at that depth from the same PlaceObject (same birth frame), as Flash and Ruffle
  // keep it; otherwise it is created afresh. So a nested clip inside a stopped or one-frame
  // parent keeps playing, as in Flash, instead of being frozen at its first frame.
  stateAt(id, age) {
    const c = this.chars.get(id);
    if (!c.history) {
      const tl = c.timeline, n = tl.frameCount;
      const labelFrame = t => typeof t === 'number' ? Math.min(Math.max(1, t), n) : tl.labels[t];
      const h = { states: [], frame: 1, playing: true, live: new Map() };
      h.reconcile = tick => {
        const list = this.dl(id, h.frame), next = new Map();
        for (const [depth, inst] of list) {
          const prev = h.live.get(depth);
          next.set(depth, prev && prev.charId === inst.charId && prev.born === inst.born ? prev : { charId: inst.charId, born: inst.born, created: tick });
        }
        h.live = next;
      };
      h.enter = () => {
        for (let guard = 0; guard < 8; guard++) {
          const before = h.frame;
          for (const a of tl.frames[h.frame - 1]?.actions || []) {
            if (a[0] === 'complex') break;
            if (a[0] === 'stop') h.playing = false;
            else if (a[0] === 'play') h.playing = true;
            else if (a[0] === 'next') { h.frame = Math.min(n, h.frame + 1); h.playing = false; }
            else if (a[0] === 'prev') { h.frame = Math.max(1, h.frame - 1); h.playing = false; }
            else if (a[0] === 'goto') { const t = labelFrame(a[1]); if (!t) continue; h.frame = t; h.playing = a[2]; }
          }
          if (h.frame === before) return;
        }
      };
      h.push = tick => {
        h.reconcile(tick);
        h.states.push({ frame: h.frame, created: new Map([...h.live].map(([d, v]) => [d, v.created])) });
      };
      // Tick 0: frame 1 is placed, then its script runs (it may jump elsewhere at once).
      h.reconcile(0); h.enter(); h.push(0);
      c.history = h;
    }
    const h = c.history, n = c.timeline.frameCount;
    while (h.states.length <= age) {
      const tick = h.states.length;
      if (h.playing) { h.frame = h.frame >= n ? 1 : h.frame + 1; h.enter(); }
      h.push(tick);
    }
    return h.states[age];
  }

  // Frame after `ticks` frame advances of a freshly created instance of sprite id, following
  // constant stop/play/goto frame scripts. Memoised per sprite as a sequence with a cycle.
  frameAfter(id, ticks) {
    const c = this.chars.get(id);
    if (!c.sequence) c.sequence = playSequence(c.timeline);
    const { seq, loopStart } = c.sequence;
    if (ticks < seq.length) return seq[ticks];
    const loopLen = seq.length - loopStart;
    return seq[loopStart + ((ticks - loopStart) % loopLen)];
  }
}

function kindOf(code) {
  if (SHAPE_TAGS.has(code)) return 'shape';
  if (MORPH_TAGS.has(code)) return 'morph';
  if (TEXT_TAGS.has(code)) return 'text';
  if (code === TAG.DefineEditText) return 'edittext';
  if (code === TAG.DefineSprite) return 'sprite';
  if (BUTTON_TAGS.has(code)) return 'button';
  if (BITMAP_TAGS.has(code)) return 'bitmap';
  if (FONT_TAGS.has(code)) return 'font';
  return 'other';
}

// Computes the display list of a timeline at frame k (1-based) by replaying frames 1..k.
// Returns Map depth -> instance { charId, matrix, cxform, ratio, clipDepth, name, filters,
// blendMode, cacheAsBitmap, born } where born is the frame the instance was created on.
export function displayListAt(timeline, k) {
  const list = new Map();
  for (let f = 1; f <= k; f++) {
    for (const op of timeline.frames[f - 1]?.ops || []) {
      if (op.remove !== undefined) { list.delete(op.remove); continue; }
      const p = op.place;
      const prev = list.get(p.depth);
      if (p.move && prev) {
        // Modify in place; a new character id replaces the character (a fresh instance).
        const inst = { ...prev };
        for (const key of ['matrix', 'cxform', 'ratio', 'clipDepth', 'name', 'filters', 'blendMode', 'cacheAsBitmap']) if (p[key] !== undefined) inst[key] = p[key];
        if (p.charId !== undefined && p.charId !== prev.charId) { inst.charId = p.charId; inst.born = f; }
        list.set(p.depth, inst);
      } else if (p.charId !== undefined) {
        list.set(p.depth, { charId: p.charId, matrix: p.matrix || IDENTITY, cxform: p.cxform, ratio: p.ratio, clipDepth: p.clipDepth, name: p.name, filters: p.filters, blendMode: p.blendMode, cacheAsBitmap: p.cacheAsBitmap, born: f });
      }
    }
  }
  return list;
}

// Simulates a freshly placed instance ticking forward: seq[t] is its frame after t ticks.
// Returns { seq, loopStart } so the tail repeats from loopStart forever.
function playSequence(timeline) {
  const n = timeline.frameCount;
  const labelFrame = t => typeof t === 'number' ? Math.min(Math.max(1, t), n) : timeline.labels[t];
  let frame = 1, playing = true;
  // Runs the frame script on entering a frame. Every op runs in order (a goto moves the playhead
  // and stops it, a following play() restarts it, as gotoAndPlay compiles to goto + play), then
  // the script of the frame the playhead landed on runs (bounded to avoid script ping-pong).
  const enter = () => {
    for (let guard = 0; guard < 8; guard++) {
      const before = frame;
      for (const a of timeline.frames[frame - 1]?.actions || []) {
        if (a[0] === 'complex') break;
        if (a[0] === 'stop') playing = false;
        else if (a[0] === 'play') playing = true;
        else if (a[0] === 'next') { frame = Math.min(n, frame + 1); playing = false; }
        else if (a[0] === 'prev') { frame = Math.max(1, frame - 1); playing = false; }
        else if (a[0] === 'goto') {
          const target = labelFrame(a[1]);
          if (!target) continue;
          frame = target;
          playing = a[2];
        }
      }
      if (frame === before) return;
    }
  };
  enter();
  const seq = [], seen = new Map();
  for (;;) {
    const state = frame + (playing ? 'p' : 's');
    if (seen.has(state)) return { seq, loopStart: seen.get(state) };
    seen.set(state, seq.length);
    seq.push(frame);
    if (playing) { frame = frame >= n ? 1 : frame + 1; enter(); }
  }
}

// ---------------------------------------------------------------------------------------------
// Snapshot sprites.

export class Snapshotter {
  // options: omitText (skip static and edit text), hide (Set of instance names to skip).
  // nested: 'age' (default) plays nested clips by their own age since creation (SwfLibrary.stateAt),
  // so clips inside stopped or one-frame parents keep animating as in Flash; 'frame' is the
  // original model (a child's frame follows its parent's frame number), which the level-1 sheets
  // were rendered with. The two agree whenever parents play straight through.
  // pin: { instanceName: frame number or label } shows those named children at a fixed frame,
  // for parent scripts that drive a child (milk_image frame 1: glass.gotoAndStop("yogurt")).
  constructor(lib, { omitText = false, hide = [], nested = 'age', pin = {} } = {}) {
    this.lib = lib;
    this.omitText = omitText;
    this.nested = nested;
    this.pin = pin;
    this.hide = new Set(hide);
    this.nextId = lib.maxId + 1;
    this.memo = new Map();       // content key -> id
    this.defs = new Map();       // synthetic id -> { tag, deps: [ids], bounds, reach }
    this.stack = new Set();
  }

  // Returns { id, bounds, reach } for a character shown at local frame `frame` (sprites) with
  // morph ratio `ratio`, or null when nothing is drawn. Bounds are in local twips; reach is the
  // largest filter reach inside, in pixels at scale 1.
  // ageOffset adds ticks to every direct child's age (used to animate one-frame symbols whose
  // motion lives in nested clips, such as the portal).
  node(charId, frame = 1, ratio, ageOffset = 0) {
    const c = this.lib.chars.get(charId);
    if (!c) return null; // imported or undefined character
    if (c.kind === 'shape') return { id: charId, bounds: c.bounds, reach: 0 };
    if (c.kind === 'morph') {
      const t = (ratio || 0) / 65535, s = c.bounds.start, e = c.bounds.end;
      const lerp = (a, b) => a + (b - a) * t;
      return { id: charId, bounds: { xMin: lerp(s.xMin, e.xMin), xMax: lerp(s.xMax, e.xMax), yMin: lerp(s.yMin, e.yMin), yMax: lerp(s.yMax, e.yMax) }, reach: 0, ratio: true };
    }
    if (c.kind === 'text' || c.kind === 'edittext') return this.omitText ? null : { id: charId, bounds: c.bounds, reach: 0 };
    if (c.kind === 'sprite') return this.snapshot(charId, frame, ageOffset);
    if (c.kind === 'button') return this.buttonSnapshot(charId, ['up', 'over', 'down'][frame - 1] || 'up');
    return null; // bitmaps, fonts, sounds cannot be placed directly
  }

  snapshot(spriteId, frame, ageOffset = 0) {
    const c = this.lib.chars.get(spriteId);
    const key0 = spriteId + '@' + frame + '+' + ageOffset;
    if (this.stack.has(key0)) throw new Error(`Recursive sprite ${spriteId}`);
    this.stack.add(key0);
    const list = displayListAt(c.timeline, frame);
    const items = [];
    // topDepths (set by a job's "depths"): only these depths of the top-level symbol are drawn.
    const keepDepth = this.topDepths && spriteId === this.topDepths.id ? this.topDepths.test : null;
    for (const [depth, inst] of [...list].sort((a, b) => a[0] - b[0])) {
      if ((inst.name && this.hide.has(inst.name)) || (keepDepth && !keepDepth(depth))) { items.push({ depth, missing: true, clipDepth: inst.clipDepth }); continue; }
      const child = this.lib.chars.get(inst.charId);
      let n = this.pinned(inst);
      if (n !== undefined) { /* pinned */ }
      else if (child?.kind === 'sprite' && this.nested === 'age') n = this.aged(inst.charId, frame - inst.born + ageOffset);
      else n = this.node(inst.charId, child?.kind === 'sprite' ? this.lib.frameAfter(inst.charId, frame - inst.born + ageOffset) : 1, inst.ratio);
      if (!n) { items.push({ depth, missing: true, clipDepth: inst.clipDepth }); continue; }
      items.push({ depth, inst, n });
    }
    this.stack.delete(key0);
    return this.emit(items);
  }

  // A pinned child's node, or undefined when the child is not pinned.
  pinned(inst) {
    if (!inst.name || !(inst.name in this.pin)) return undefined;
    const c = this.lib.chars.get(inst.charId);
    if (c?.kind !== 'sprite') return undefined;
    const t = this.pin[inst.name], f = typeof t === 'number' ? t : c.timeline.labels[t];
    if (!f) throw new Error(`pin: ${inst.name} has no label ${t}`);
    return this.snapshot(inst.charId, f);
  }

  // Snapshot of a nested sprite instance that is `age` ticks old (see SwfLibrary.stateAt).
  aged(spriteId, age) {
    const key0 = spriteId + '~' + age;
    if (!this.agedMemo) this.agedMemo = new Map();
    if (this.agedMemo.has(key0)) return this.agedMemo.get(key0);
    if (this.stack.has(key0)) throw new Error(`Recursive sprite ${spriteId}`);
    this.stack.add(key0);
    const { frame, created } = this.lib.stateAt(spriteId, Math.max(0, age));
    const items = [];
    for (const [depth, inst] of [...this.lib.dl(spriteId, frame)].sort((a, b) => a[0] - b[0])) {
      if (inst.name && this.hide.has(inst.name)) { items.push({ depth, missing: true, clipDepth: inst.clipDepth }); continue; }
      const child = this.lib.chars.get(inst.charId);
      let n = this.pinned(inst);
      if (n === undefined) n = child?.kind === 'sprite' ? this.aged(inst.charId, age - created.get(depth)) : this.node(inst.charId, 1, inst.ratio);
      if (!n) { items.push({ depth, missing: true, clipDepth: inst.clipDepth }); continue; }
      items.push({ depth, inst, n });
    }
    this.stack.delete(key0);
    const node = this.emit(items);
    this.agedMemo.set(key0, node);
    return node;
  }

  // A button drawn in one state ('up' as placed on a timeline; a top-level button job renders
  // frames 1, 2, 3 as up, over, down).
  buttonSnapshot(buttonId, state = 'up') {
    const c = this.lib.chars.get(buttonId);
    const items = [];
    for (const r of c.records.filter(r => r[state]).sort((a, b) => a.depth - b.depth)) {
      const n = this.node(r.charId, 1);
      if (!n) continue;
      items.push({ depth: r.depth, inst: { matrix: r.matrix, cxform: r.cxform, filters: r.filters, blendMode: r.blendMode }, n });
    }
    return this.emit(items);
  }

  // Writes (or reuses) a one-frame sprite holding the given items.
  emit(items) {
    // A clip layer whose mask was skipped hides the depths it would have masked.
    const places = [];
    let maskedUntil = -1;
    for (const it of items) {
      if (it.depth <= maskedUntil) continue;
      if (it.missing) { if (it.clipDepth) maskedUntil = it.clipDepth; continue; }
      const { inst, n } = it;
      places.push({
        depth: it.depth, charId: n.id, matrix: inst.matrix || IDENTITY, cxform: inst.cxform,
        ratio: n.ratio ? (inst.ratio || 0) : undefined, clipDepth: inst.clipDepth,
        filters: inst.filters, blendMode: inst.blendMode, cacheAsBitmap: inst.cacheAsBitmap,
        childBounds: n.bounds, childReach: n.reach,
      });
    }
    if (!places.length) return null;
    const key = JSON.stringify(places.map(p => [p.depth, p.charId, p.matrix, p.cxform, p.ratio, p.clipDepth, p.filters && p.filters.toString('hex'), p.blendMode, p.cacheAsBitmap]));
    if (this.memo.has(key)) return this.defs.get(this.memo.get(key)).node;

    // Bounds: union of drawn children, each clipped by the masks covering its depth.
    let bounds = null, reach = 0;
    const masks = [];
    for (const p of places) {
      const b = p.childBounds && transformRect(p.matrix, p.childBounds);
      if (p.clipDepth) { masks.push({ until: p.clipDepth, rect: b }); continue; }
      let clipped = b;
      for (const m of masks) if (p.depth <= m.until) clipped = intersectRect(clipped, m.rect);
      const r = filterReach(p.filters) + p.childReach;
      reach = Math.max(reach, r);
      if (clipped && r) clipped = { xMin: clipped.xMin - r * 20, xMax: clipped.xMax + r * 20, yMin: clipped.yMin - r * 20, yMax: clipped.yMax + r * 20 };
      bounds = unionRect(bounds, clipped);
    }
    if (this.nextId > 65535) throw new Error('Out of character ids (more than 65535 snapshots)');
    const id = this.nextId++;
    const tag = encodeSprite(id, places.map(p => encodePlace(p)));
    const node = bounds ? { id, bounds, reach } : null;
    this.defs.set(id, { tag, deps: places.map(p => p.charId).filter(d => this.defs.has(d)), node });
    this.memo.set(key, id);
    return node;
  }

  // Encoded definition tags needed to place the given root ids, dependencies first.
  closure(rootIds) {
    const need = new Set();
    const visit = id => {
      if (need.has(id) || !this.defs.has(id)) return;
      for (const d of this.defs.get(id).deps) visit(d);
      need.add(id);
    };
    rootIds.forEach(visit);
    return [...need].sort((a, b) => a - b).map(id => this.defs.get(id).tag);
  }
}

// Builds a complete movie: original definitions, then snapshot sprites, then a root frame that
// places each item { id, matrix (twips), cxform, filters, blendMode } at increasing depths.
// overrides maps a character id to a replacement definition tag (see eraseShapeRegions).
export function buildSheetSwf(lib, snap, items, width, height, overrides = new Map()) {
  const tags = [];
  tags.push(lib.fileAttributes ? Buffer.from(lib.fileAttributes) : encodeTag(TAG.FileAttributes, Buffer.alloc(4)));
  tags.push(encodeTag(TAG.SetBackgroundColor, Buffer.from([255, 255, 255])));
  for (const t of lib.keptTags) tags.push(Buffer.from(overrides.get(t.id) || t.raw));
  tags.push(...snap.closure(items.map(i => i.id)));
  items.forEach((it, i) => tags.push(encodePlace({ depth: i + 1, charId: it.id, matrix: it.matrix, cxform: it.cxform, ratio: it.ratio, filters: it.filters, blendMode: it.blendMode })));
  tags.push(encodeTag(TAG.ShowFrame));
  return writeSwf({ version: Math.max(8, lib.swf.version), width, height, frameRate: lib.swf.frameRate, frameCount: 1, tags });
}

// Replacement definition tags for shapes with regions erased: every subpath lying entirely inside
// a rectangle [x0, y0, x1, y1] (Flash px, in the shape's own space) is removed. Used to take a
// small logo off otherwise original art. Returns { overrides: Map, report: [...] }.
export function eraseShapeRegions(lib, entries = []) {
  const overrides = new Map(), report = [];
  for (const { shape, rect } of entries) {
    const c = lib.chars.get(shape);
    if (!c || c.kind !== 'shape') throw new Error(`erase: ${shape} is not a shape`);
    const { records } = parseShapeRecords(c.code, c.tag.body);
    const [x0, y0, x1, y1] = rect.map(v => v * 20);
    const drop = new Set();
    let n = 0;
    for (const p of shapeSubpaths(records)) {
      const b = p.bounds;
      if (b.xMin >= x0 && b.xMax <= x1 && b.yMin >= y0 && b.yMax <= y1) { n++; for (let i = p.start; i < p.end; i++) drop.add(i); }
    }
    overrides.set(shape, encodeTag(c.code, rewriteShapeBody(c.code, c.tag.body, i => !drop.has(i)), true));
    report.push({ shape, rect, subpathsRemoved: n });
  }
  return { overrides, report };
}
