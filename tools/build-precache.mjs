// Writes web/precache.json for the service worker (web/sw.js) and stamps the build hash into
// sw.js. Run after any change to web/ (the test runner does it too).
//
//   files  cached when the worker installs: the shell (HTML, JS, fonts, language, manifest and
//          small icons), every level JSON (a few KB each, so progression works offline) and the
//          atlases of level 1 with the default avatar (Harry) plus the shared HUD and entities.
//   lazy   every other atlas (the other avatar, other areas' sets): cached by the worker the
//          first time the game fetches them, so a first visit downloads only what level 1 uses.
//
// The version is a content hash of every file in both lists.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web');
// Not part of the game: tests, screenshots, notes, source maps, dotfiles, loose PNGs, and the
// 512 px icons (the browser fetches manifest icons itself when installing).
const SKIP = [/^tests\//, /^screenshots\//, /^precache\.json$/, /^NOTES.*\.md$/, /^PROGRESS\.md$/, /^README\.md$/, /\.map$/, /(^|\/)\./, /^artifact\//, /\.png$/, /-512\.png$/];
const KEEP_PNG = [/^icons\/icon-(180|192)\.png$/];
const DEFAULT_AVATAR = 'harry';
const FIRST_LEVEL_SET = 'level1';

const all = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(WEB, abs).split(path.sep).join('/');
    if (e.isDirectory()) { walk(abs); continue; }
    if (SKIP.some(r => r.test(rel)) && !KEEP_PNG.some(r => r.test(rel))) continue;
    all.push(rel);
  }
})(WEB);
all.sort();

// Atlas files outside the first level's set go to the lazy list.
const index = JSON.parse(fs.readFileSync(path.join(WEB, 'data/atlas/index.json'), 'utf8'));
const sets = index.sets || {};
const coreAtlases = new Set([...(sets[FIRST_LEVEL_SET] || []), ...(sets['player-' + DEFAULT_AVATAR] || []), 'hud', 'entities']);
const lazyFiles = new Set();
for (const [id, a] of Object.entries(index.atlases || {})) {
  if (coreAtlases.has(id)) continue;
  const json = typeof a === 'string' ? a : a.json;
  const dir = json.slice(0, json.lastIndexOf('/') + 1);
  lazyFiles.add('data/atlas/' + json);
  for (const img of (a.images || [])) lazyFiles.add('data/atlas/' + dir + img);
}
const files = all.filter(f => !lazyFiles.has(f));
const lazy = all.filter(f => lazyFiles.has(f));

const hash = crypto.createHash('sha256');
for (const f of all) if (f !== 'sw.js') hash.update(f).update(fs.readFileSync(path.join(WEB, f)));
const version = hash.digest('hex').slice(0, 12);
const list = ['./', ...files.filter(f => f !== 'index.html'), 'index.html'];
const swPath = path.join(WEB, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/const BUILD = '[^']*';/, `const BUILD = '${version}';`));
fs.writeFileSync(path.join(WEB, 'precache.json'), JSON.stringify({ version, files: list, lazy }, null, 1));
const size = l => l.reduce((n, f) => n + fs.statSync(path.join(WEB, f)).size, 0);
const mb = n => (n / 1048576).toFixed(2);
console.log(`precache.json: ${files.length} files, ${mb(size(files))} MB at install; ${lazy.length} lazy files, ${mb(size(lazy))} MB on first use; version ${version}`);
