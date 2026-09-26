// Builds the claude.ai Artifact variant of the game from web/.
// The artifact host wraps the page in its own <!doctype><head><body> skeleton, runs it in a
// frame without service workers, and expects a side gutter, so this variant:
//   - keeps only the <title>, <style> and body content of web/index.html,
//   - drops the manifest/icon links (main.js then skips service-worker registration),
//   - adds a 16px minimum side gutter around the stage,
//   - copies every runtime file into the output folder and writes files.json (the publish map).
// Usage: node tools/build-artifact.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web');
const out = path.resolve(process.argv[2] || 'artifact-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
let style = html.match(/<style id="game-style">[\s\S]*?<\/style>/)[0];
style = style.replace('</style>', `
  /* Artifact host: keep a 16px side gutter and paint our own ground behind the frame. */
  #stage-root { left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); }
  :root { padding: 0 !important; }
</style>`);
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync(path.join(out, 'index.html'), `${title}\n${style}\n${body.trim()}\n`);

const SKIP = [/^index\.html$/, /^sw\.js$/, /^manifest\.webmanifest$/, /^precache\.json$/, /^icons\//, /^tests\//, /^screenshots\//, /\.md$/, /\.map$/, /(^|\/)\./, /-\d+\.png$/];
const files = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(WEB, abs).split(path.sep).join('/');
    if (e.isDirectory()) { walk(abs); continue; }
    if (SKIP.some(r => r.test(rel))) continue;
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.copyFileSync(abs, path.join(out, rel));
    files[rel] = rel;
  }
})(WEB);
// Merge each language's common + namespace string tables into one bundle, so a language is a
// single request and the artifact stays well under the host's per-publish file limit.
const langDir = path.join(out, 'data/lang');
if (fs.existsSync(path.join(langDir, 'manifest.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(langDir, 'manifest.json'), 'utf8'));
  for (const code of manifest.languages) {
    const merged = {};
    for (const f of [`${code}.json`, ...manifest.namespaces.map(ns => `${code}/${ns}.json`)]) {
      const p = path.join(langDir, f);
      if (fs.existsSync(p)) { Object.assign(merged, JSON.parse(fs.readFileSync(p, 'utf8'))); fs.rmSync(p); delete files[`data/lang/${f}`]; }
    }
    fs.writeFileSync(path.join(langDir, `${code}.bundle.json`), JSON.stringify(merged));
    files[`data/lang/${code}.bundle.json`] = `data/lang/${code}.bundle.json`;
    fs.rmSync(path.join(langDir, code), { recursive: true, force: true });
  }
  manifest.bundled = true;
  fs.writeFileSync(path.join(langDir, 'manifest.json'), JSON.stringify(manifest));
}
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 1));
const n = Object.keys(files).length;
const bytes = Object.keys(files).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`artifact build: ${n} files + index.html, ${(bytes / 1048576).toFixed(2)} MB -> ${out}`);
if (n > 250) console.warn('WARNING: more than 250 files; an artifact publish takes at most 255.');
