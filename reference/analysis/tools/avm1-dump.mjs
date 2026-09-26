// Minimal AVM1 (ActionScript 2 bytecode) linear pseudo-decompiler for the Flash SWFs in reference/Junior_Game/movies.
// Prints every DoAction (per sprite/frame/label), DoInitAction (compiled AS2 classes), button and clip action,
// plus, with --text, instance names and DefineEditText/DefineText contents. Registers appear as rN (in AS2
// methods r1 is usually 'this'; in timeline functions r1/r2 may be _root or _parent). Jumps are shown as goto labels.
// Output is approximate pseudo-code intended for reading, not recompiling.
// Usage: node reference/analysis/tools/avm1-dump.mjs reference/Junior_Game/movies/<file>.swf [--text] > out.txt
import fs from 'fs';
import { parseSwf } from 'swf-parser';

const file = process.argv[2];
const bytes = fs.readFileSync(file);
const movie = parseSwf(bytes);

function readStr(b, p) { let e = p; while (b[e] !== 0 && e < b.length) e++; return [Buffer.from(b.slice(p, e)).toString('utf8'), e + 1]; }
function q(s) { return JSON.stringify(s); }

function decompile(code, indent = '  ', pool0 = []) {
  const b = code instanceof Uint8Array ? code : Uint8Array.from(Object.values(code));
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pool = pool0.slice();
  const out = [];
  const stack = [];
  const pop = () => (stack.length ? stack.pop() : '<?>');
  const labels = new Set();
  // first pass to find jump targets
  const ops = [];
  let p = 0;
  while (p < b.length) {
    const start = p;
    const op = b[p++];
    let len = 0;
    if (op >= 0x80) { len = dv.getUint16(p, true); p += 2; }
    const dataStart = p;
    p += len;
    ops.push({ start, op, dataStart, len, end: p });
    if (op === 0) break;
  }
  for (const o of ops) {
    if (o.op === 0x99 || o.op === 0x9d) { const off = dv.getInt16(o.dataStart, true); labels.add(o.end + off); }
  }
  let skipUntil = -1;
  for (const o of ops) {
    if (o.start < skipUntil) continue;
    if (labels.has(o.start)) { if (stack.length) { out.push(indent + '// stack: ' + stack.join(' | ')); } out.push(indent.slice(2) + 'L' + o.start + ':'); }
    const d = o.dataStart;
    const emit = (s) => out.push(indent + s);
    const bin = (sym) => { const r = pop(), l = pop(); stack.push('(' + l + ' ' + sym + ' ' + r + ')'); };
    switch (o.op) {
      case 0x00: break;
      case 0x88: { // ConstantPool
        const n = dv.getUint16(d, true); let pp = d + 2; pool = [];
        for (let i = 0; i < n; i++) { const [s, np] = readStr(b, pp); pool.push(s); pp = np; }
        break; }
      case 0x96: { // Push
        let pp = d;
        while (pp < o.end) {
          const t = b[pp++];
          switch (t) {
            case 0: { const [s, np] = readStr(b, pp); stack.push(q(s)); pp = np; break; }
            case 1: stack.push(String(dv.getFloat32(pp, true))); pp += 4; break;
            case 2: stack.push('null'); break;
            case 3: stack.push('undefined'); break;
            case 4: stack.push('r' + b[pp]); pp += 1; break;
            case 5: stack.push(b[pp] ? 'true' : 'false'); pp += 1; break;
            case 6: { // double: high word first
              const hi = dv.getUint32(pp, true), lo = dv.getUint32(pp + 4, true);
              const ab = new DataView(new ArrayBuffer(8)); ab.setUint32(0, lo, true); ab.setUint32(4, hi, true);
              stack.push(String(ab.getFloat64(0, true))); pp += 8; break; }
            case 7: stack.push(String(dv.getInt32(pp, true))); pp += 4; break;
            case 8: stack.push(q(pool[b[pp]])); pp += 1; break;
            case 9: stack.push(q(pool[dv.getUint16(pp, true)])); pp += 2; break;
            default: stack.push('<push?' + t + '>'); pp = o.end;
          }
        }
        break; }
      case 0x17: { const v = pop(); if (v !== '<?>' && !/^[\"\d]/.test(v)) emit(v + ';'); break; }
      case 0x1c: { const n = pop(); stack.push(n.startsWith('"') ? JSON.parse(n) : 'eval(' + n + ')'); break; }
      case 0x1d: { const v = pop(), n = pop(); emit((n.startsWith('"') ? JSON.parse(n) : 'set(' + n + ')') + ' = ' + v + ';'); break; }
      case 0x4e: { const k = pop(), obj = pop(); stack.push(k.startsWith('"') && /^"[A-Za-z_$][\w$]*"$/.test(k) ? obj + '.' + JSON.parse(k) : obj + '[' + k + ']'); break; }
      case 0x4f: { const v = pop(), k = pop(), obj = pop(); emit((k.startsWith('"') && /^"[A-Za-z_$][\w$]*"$/.test(k) ? obj + '.' + JSON.parse(k) : obj + '[' + k + ']') + ' = ' + v + ';'); break; }
      case 0x3c: { const v = pop(), n = pop(); emit('var ' + (n.startsWith('"') ? JSON.parse(n) : n) + ' = ' + v + ';'); break; }
      case 0x41: { const n = pop(); emit('var ' + (n.startsWith('"') ? JSON.parse(n) : n) + ';'); break; }
      case 0x3d: { const n = pop(); const c = +pop(); const args = []; for (let i = 0; i < c; i++) args.push(pop()); stack.push((n.startsWith('"') ? JSON.parse(n) : n) + '(' + args.join(', ') + ')'); break; }
      case 0x52: { const m = pop(), obj = pop(); const c = +pop(); const args = []; for (let i = 0; i < c; i++) args.push(pop());
        const mm = (m === 'undefined' || m === '""') ? obj : (m.startsWith('"') ? obj + '.' + JSON.parse(m) : obj + '[' + m + ']');
        stack.push(mm + '(' + args.join(', ') + ')'); break; }
      case 0x40: { const n = pop(); const c = +pop(); const args = []; for (let i = 0; i < c; i++) args.push(pop()); stack.push('new ' + (n.startsWith('"') ? JSON.parse(n) : n) + '(' + args.join(', ') + ')'); break; }
      case 0x53: { const m = pop(), obj = pop(); const c = +pop(); const args = []; for (let i = 0; i < c; i++) args.push(pop()); stack.push('new ' + obj + (m === 'undefined' || m === '""' ? '' : '.' + m.replace(/"/g, '')) + '(' + args.join(', ') + ')'); break; }
      case 0x42: { const c = +pop(); const a = []; for (let i = 0; i < c; i++) a.push(pop()); stack.push('[' + a.join(', ') + ']'); break; }
      case 0x43: { const c = +pop(); const a = []; for (let i = 0; i < c; i++) { const v = pop(), k = pop(); a.push(k + ': ' + v); } stack.push('{' + a.join(', ') + '}'); break; }
      case 0x9b: case 0x8e: { // DefineFunction / DefineFunction2
        let pp = d; const [name, np] = readStr(b, pp); pp = np;
        const nparams = dv.getUint16(pp, true); pp += 2;
        const params = [];
        let codeSize;
        if (o.op === 0x9b) {
          for (let i = 0; i < nparams; i++) { const [s, n2] = readStr(b, pp); params.push(s); pp = n2; }
          codeSize = dv.getUint16(pp, true); pp += 2;
        } else {
          pp += 1; // register count
          pp += 2; // flags
          for (let i = 0; i < nparams; i++) { const reg = b[pp]; pp++; const [s, n2] = readStr(b, pp); params.push(s + (reg ? '/*r' + reg + '*/' : '')); pp = n2; }
          codeSize = dv.getUint16(pp, true); pp += 2;
        }
        const body = b.slice(o.end, o.end + codeSize);
        const inner = decompile(body, indent + '  ', pool);
        const head = 'function ' + name + '(' + params.join(', ') + ') {';
        if (name) { emit(head); out.push(inner); emit('}'); }
        else { stack.push(head + '\n' + inner + '\n' + indent + '}'); }
        skipUntil = o.end + codeSize;
        break; }
      case 0x3e: emit('return ' + pop() + ';'); break;
      case 0x9d: { const off = dv.getInt16(d, true); emit('if ' + pop() + ' goto L' + (o.end + off) + ';'); break; }
      case 0x99: { const off = dv.getInt16(d, true); emit('goto L' + (o.end + off) + ';'); break; }
      case 0x47: bin('+'); break; case 0x0a: bin('+'); break; case 0x0b: bin('-'); break; case 0x0c: bin('*'); break; case 0x0d: bin('/'); break; case 0x3f: bin('%'); break;
      case 0x49: bin('=='); break; case 0x0e: bin('=='); break; case 0x48: bin('<'); break; case 0x0f: bin('<'); break; case 0x67: bin('>'); break; case 0x66: bin('==='); break;
      case 0x10: bin('&&'); break; case 0x11: bin('||'); break; case 0x21: bin('add'); break; case 0x13: bin('eq'); break; case 0x29: bin('lt'); break; case 0x68: bin('gt'); break;
      case 0x60: bin('&'); break; case 0x61: bin('|'); break; case 0x62: bin('^'); break; case 0x63: bin('<<'); break; case 0x64: bin('>>'); break; case 0x65: bin('>>>'); break;
      case 0x54: bin('instanceof'); break;
      case 0x12: stack.push('!' + pop()); break;
      case 0x50: stack.push('(' + pop() + ' + 1)'); break;
      case 0x51: stack.push('(' + pop() + ' - 1)'); break;
      case 0x4c: { const v = pop(); stack.push(v, v); break; }
      case 0x4d: { const a = pop(), c = pop(); stack.push(a, c); break; }
      case 0x87: { const r = b[d]; const v = pop(); emit('r' + r + ' = ' + v + ';'); stack.push('r' + r); break; }
      case 0x83: { const [u, np] = readStr(b, d); const [t] = readStr(b, np); emit('getURL(' + q(u) + ', ' + q(t) + ');'); break; }
      case 0x9a: { const t = pop(), u = pop(); emit('getURL2(' + u + ', ' + t + ', flags=' + b[d] + ');'); break; }
      case 0x81: emit('gotoFrame(' + dv.getUint16(d, true) + ');'); break;
      case 0x9f: { const f = pop(); emit((b[d] & 1 ? 'gotoAndPlay(' : 'gotoAndStop(') + f + ');'); break; }
      case 0x8c: { const [l] = readStr(b, d); emit('gotoLabel(' + q(l) + ');'); break; }
      case 0x06: emit('play();'); break; case 0x07: emit('stop();'); break; case 0x04: emit('nextFrame();'); break; case 0x05: emit('prevFrame();'); break;
      case 0x09: emit('stopAllSounds();'); break; case 0x08: emit('toggleQuality();'); break;
      case 0x26: emit('trace(' + pop() + ');'); break;
      case 0x8b: { const [t] = readStr(b, d); emit('setTarget(' + q(t) + ');'); break; }
      case 0x20: emit('setTarget(' + pop() + ');'); break;
      case 0x94: emit('with (' + pop() + ') { /* size ' + dv.getUint16(d, true) + ' */'); break;
      case 0x3a: { const k = pop(), obj = pop(); stack.push('delete ' + obj + '[' + k + ']'); break; }
      case 0x3b: { const k = pop(); stack.push('delete ' + k); break; }
      case 0x44: stack.push('typeof ' + pop()); break;
      case 0x46: case 0x55: { const v = pop(); emit('/* enumerate ' + v + ' */'); stack.push('<enum-null>'); stack.push('<enum-key>'); break; }
      case 0x69: { const sup = pop(), sub = pop(); emit(sub + ' extends ' + sup + ';'); break; }
      case 0x2c: { const c = pop(); const n = +pop(); const a = []; for (let i = 0; i < n; i++) a.push(pop()); emit(c + ' implements ' + a.join(',') + ';'); break; }
      case 0x2b: { const obj = pop(), c = pop(); stack.push('(' + c + ')(' + obj + ')'); break; }
      case 0x4a: stack.push('Number(' + pop() + ')'); break;
      case 0x4b: stack.push('String(' + pop() + ')'); break;
      case 0x18: stack.push('int(' + pop() + ')'); break;
      case 0x22: { const i = pop(), t = pop(); stack.push('getProperty(' + t + ', ' + i + ')'); break; }
      case 0x23: { const v = pop(), i = pop(), t = pop(); emit('setProperty(' + t + ', ' + i + ', ' + v + ');'); break; }
      case 0x24: { const dp = pop(), tg = pop(), src = pop(); emit('duplicateMovieClip(' + src + ', ' + tg + ', ' + dp + ');'); break; }
      case 0x25: emit('removeMovieClip(' + pop() + ');'); break;
      case 0x27: { const t = pop(); const lc = pop(); if (lc !== '0' && lc !== 'false') { pop(); pop(); pop(); pop(); } pop(); emit('startDrag(' + t + ');'); break; }
      case 0x28: emit('stopDrag();'); break;
      case 0x14: case 0x31: stack.push('length(' + pop() + ')'); break;
      case 0x15: case 0x35: { const c = pop(), i = pop(), s = pop(); stack.push('substring(' + s + ', ' + i + ', ' + c + ')'); break; }
      case 0x34: stack.push('getTimer()'); break;
      case 0x30: stack.push('random(' + pop() + ')'); break;
      case 0x32: case 0x36: stack.push('ord(' + pop() + ')'); break;
      case 0x33: case 0x37: stack.push('chr(' + pop() + ')'); break;
      case 0x2a: emit('throw ' + pop() + ';'); break;
      case 0x8f: emit('try { /* ... */'); break;
      case 0x9e: emit('callFrame(' + pop() + ');'); break;
      case 0x8a: case 0x8d: emit('/* waitForFrame */'); if (o.op === 0x8d) pop(); break;
      default: emit('/* op 0x' + o.op.toString(16) + ' */');
    }
  }
  if (stack.length) out.push(indent + '// leftover stack: ' + stack.join(' | '));
  return out.join('\n');
}

// Font map for static text
const fonts = {};
function textOfRecords(t) {
  let s = '';
  for (const r of t.records || []) {
    if (r.fontId !== undefined && r.fontId !== null) textOfRecords.font = r.fontId;
    const f = fonts[textOfRecords.font];
    for (const e of r.entries || []) {
      const cu = f && f.glyphs && f.glyphs[e.index] !== undefined ? f.codeUnits && f.codeUnits[e.index] : undefined;
      s += cu !== undefined ? String.fromCharCode(cu) : '?';
    }
    s += ' ';
  }
  return s.trim();
}

const names = {};
function collectNames(tags) { for (const t of tags) { if (t.type === 35) for (const a of t.assets) names[a.id] = a.name; if (t.tags) collectNames(t.tags); } }
collectNames(movie.tags);

const showText = process.argv.includes('--text');
function walk(tags, where) {
  let frame = 1;
  let label = '';
  for (const t of tags) {
    switch (t.type) {
      case 12: case 16: fonts[t.id] = t; break;
      case 38: label = t.name; console.log(`== ${where} frame ${frame} label "${t.name}"`); break;
      case 58: frame++; break;
      case 31: console.log(`-- DoAction ${where} frame ${frame}${label ? ' (' + label + ')' : ''}`); console.log(decompile(t.actions)); break;
      case 32: console.log(`-- DoInitAction sprite ${t.spriteId} ${names[t.spriteId] || ''}`); console.log(decompile(t.actions)); break;
      case 24: walk(t.tags, `sprite ${t.id}${names[t.id] ? ' "' + names[t.id] + '"' : ''}`); break;
      case 6: case 7: case 8:
        if (t.actions) for (const a of t.actions) { console.log(`-- Button ${t.id} ${names[t.id] || ''} cond ${JSON.stringify(a.conditions)}`); console.log(decompile(a.actions)); }
        break;
      case 49:
        if (t.clipActions) for (const ca of t.clipActions) { const ev = Object.entries(ca.events).filter(([k, v]) => v).map(([k]) => k).join(','); console.log(`-- ClipAction ${where} frame ${frame} depth ${t.depth} name ${t.name || ''} char ${t.characterId} on(${ev})`); console.log(decompile(ca.actions)); }
        if (showText && t.name) console.log(`   [place ${where} f${frame} depth ${t.depth} char ${t.characterId} name "${t.name}"]`);
        break;
      case 11: if (showText) console.log(`   [edittext ${t.id} var=${t.variableName || ''} text=${JSON.stringify(t.text || '')}]`); break;
      case 25: if (showText) console.log(`   [text ${t.id}: ${JSON.stringify(textOfRecords(t))}]`); break;
    }
  }
}
walk(movie.tags, 'root');
