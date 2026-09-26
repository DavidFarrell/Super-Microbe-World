// Rebuilds Drive files downloaded via the Google Drive MCP (download_file_content)
// by scanning Claude Code transcripts and persisted tool results for the base64 payloads.
// Usage: node tools/decode-drive.mjs [transcriptRoot]
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ROOT = process.argv[2] || '/root/.claude/projects/-home-user-Super-Microbe-World';
const invPath = path.join(REPO, 'reference/inventory.json');
const inv = fs.existsSync(invPath) ? JSON.parse(fs.readFileSync(invPath, 'utf8')) : { files: [] };
const byId = new Map(inv.files.map(f => [f.id, f]));
const DOCS = {
  '0Bw62SxAHx-pjdUhOWFk3elJVY2s': 'Learning Outcomes and Game Mechanics.xls',
  '0Bw62SxAHx-pjVDZnZ3QyVmN6Ym8': 'art assets.xls',
  '0Bw62SxAHx-pjd3RDX0V0MVRocG8': 'food rules.txt',
  '0Bw62SxAHx-pjRnZoamtYa3VHVE0': 'games strategy.txt',
  '0Bw62SxAHx-pjaGUwem1wZUlUVEE': 'Estimates.xls',
  '0Bw62SxAHx-pjMjRsNmRyTklRTHc': 'Warsaw Junior Games Presentation.ppt',
};

const RE = /\{"content":"([A-Za-z0-9+/=]*)","id":"([^"]+)","mimeType":"([^"]*)","title":"((?:[^"\\]|\\.)*)"\}/g;
const found = new Map();
function scanString(s) {
  if (s.length < 40 || !s.includes('"content":"')) return;
  for (const m of s.matchAll(RE)) {
    const [, b64, id, mimeType, title] = m;
    const prev = found.get(id);
    if (!prev || prev.b64.length < b64.length) found.set(id, { b64, mimeType, title: JSON.parse('"' + title + '"') });
  }
}
function walk(v) {
  if (typeof v === 'string') scanString(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
}
function scanFile(p) {
  const text = fs.readFileSync(p, 'utf8');
  scanString(text);
  if (p.endsWith('.jsonl')) for (const line of text.split('\n')) { if (!line.includes('"content')) continue; try { walk(JSON.parse(line)); } catch {} }
}
(function rec(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) rec(p);
    else if (/\.(jsonl|txt|json)$/.test(e.name)) { try { scanFile(p); } catch (err) { console.error('scan fail', p, err.message); } }
  }
})(ROOT);

let written = 0, mismatched = [], unknown = [];
for (const [id, { b64, title }] of found) {
  const buf = Buffer.from(b64, 'base64');
  let out;
  if (byId.has(id)) out = path.join(REPO, 'reference/Junior_Game', byId.get(id).path);
  else if (DOCS[id]) out = path.join(REPO, 'reference/docs/raw', DOCS[id]);
  else { unknown.push(`${id} ${title}`); out = path.join(REPO, 'reference/other', title); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  written++;
  const exp = byId.get(id)?.size;
  if (exp != null && exp !== buf.length) mismatched.push(`${byId.get(id).path}: got ${buf.length}, expected ${exp}`);
}
const SKIP = /\.(fla|swd|bak|svn-base|tmp|db)$/i;
const missing = inv.files.filter(f => !found.has(f.id) && !SKIP.test(f.path) && !f.path.includes('.svn/') && !(f.size > 50e6) && !path.basename(f.path).startsWith('.'));
console.log(JSON.stringify({ found: found.size, written, mismatched, missing: missing.map(f => `${f.id} ${f.path}`), unknown }, null, 1));
