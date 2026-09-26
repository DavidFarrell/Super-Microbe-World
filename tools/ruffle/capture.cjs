// node tools/ruffle/capture.cjs <swfPathFromRepoRoot> <out.png> [waitMs] [base] [vars]
// Serves the repo root on a local port and screenshots the SWF running in Ruffle.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash', '.xml': 'text/xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  const [swf, out, wait = '4000', base = '', vars = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl'] });
  const page = await b.newPage({ viewport: { width: 800, height: 600 }, locale: 'en-GB' });
  const logs = []; page.on('console', m => logs.push(`${m.type()}: ${m.text()}`)); page.on('pageerror', e => logs.push('pageerror: ' + e.message)); page.on('requestfailed', r => logs.push('reqfail: ' + r.url())); page.on('response', r => { if (r.status() >= 400) logs.push(r.status() + ' ' + r.url()); });
  const url = `http://localhost:${port}/tools/ruffle/harness.html?swf=${encodeURIComponent('/' + swf)}&base=${encodeURIComponent(base)}&vars=${encodeURIComponent(vars)}`;
  await page.goto(url); await page.waitForTimeout(+wait);
  await page.evaluate(() => { const r = window.__ruffle?.shadowRoot; if (!r) return; for (const el of r.querySelectorAll('*')) if (/hardware acceleration/i.test(el.textContent || '') && el.children.length < 6 && el.offsetHeight < 200) el.style.display = 'none'; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ loaded: await page.evaluate(() => window.__loaded || window.__loadError || false), logs: logs.slice(-15) }, null, 1));
  await b.close(); server.close();
});
