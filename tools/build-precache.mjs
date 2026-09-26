// Writes web/precache.json: every file under web/ that the game needs offline, with a
// content hash as the cache version. Run after any change to web/ (the test runner does it too).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web');
const SKIP = [/^tests\//, /^screenshots\//, /^precache\.json$/, /^NOTES\.md$/, /^PROGRESS\.md$/, /^README\.md$/, /\.map$/, /(^|\/)\./, /^artifact\//, /\.png$/];
const KEEP_PNG = [/^icons\//];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(WEB, abs).split(path.sep).join('/');
    if (e.isDirectory()) { walk(abs); continue; }
    if (SKIP.some(r => r.test(rel)) && !KEEP_PNG.some(r => r.test(rel))) continue;
    files.push(rel);
  }
})(WEB);
files.sort();

const hash = crypto.createHash('sha256');
for (const f of files) if (f !== 'sw.js') hash.update(f).update(fs.readFileSync(path.join(WEB, f)));
const version = hash.digest('hex').slice(0, 12);
const list = ['./', ...files.filter(f => f !== 'index.html'), 'index.html'];
const swPath = path.join(WEB, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/const BUILD = '[^']*';/, `const BUILD = '${version}';`));
fs.writeFileSync(path.join(WEB, 'precache.json'), JSON.stringify({ version, files: list }, null, 1));
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(WEB, f)).size, 0);
console.log(`precache.json: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB, version ${version}`);
