// Drives Ruffle in headless Chromium to render SWFs to transparent PNG screenshots (dev-only).
// Serves the repository (for Ruffle's own files) plus in-memory SWFs from a local HTTP server.
//
// Chromium is the preinstalled one used by Playwright; never run "playwright install" here.
// SwiftShader provides WebGL in headless mode, exactly as in tools/ruffle/capture.cjs.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash', '.json': 'application/json', '.map': 'application/json' };

export class RuffleCapturer {
  constructor({ maxSize = 4096, log = false } = {}) {
    this.maxSize = maxSize;
    this.log = log;
    this.swfs = new Map();
    this.counter = 0;
  }

  async open() {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/__swf/')) {
        const buf = this.swfs.get(url.pathname);
        if (!buf) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES['.swf'], 'Content-Length': buf.length });
        return res.end(buf);
      }
      const p = path.join(REPO, decodeURIComponent(url.pathname));
      if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    await new Promise(r => this.server.listen(0, '127.0.0.1', r));
    this.port = this.server.address().port;
    this.browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
    this.page = await this.browser.newPage({ viewport: { width: this.maxSize, height: this.maxSize }, deviceScaleFactor: 1, locale: 'en-GB' });
    this.page.on('pageerror', e => console.warn('  page error:', e.message));
    if (this.log) this.page.on('console', m => console.log('  console:', m.type(), m.text()));
    await this.page.goto(`http://127.0.0.1:${this.port}/tools/swf-sheet/capture.html`);
    return this;
  }

  // Renders an SWF buffer whose stage is width x height pixels; returns the PNG screenshot.
  // With background set (a CSS colour) the page behind the transparent stage is painted with it,
  // which is only used to check that transparency composites correctly.
  // With stable set, screenshots are repeated until two in a row match, so slow bitmap decoding
  // cannot leave a half-drawn sheet.
  async capture(swf, width, height, { background = null, settleMs = 600, stable = false } = {}) {
    if (width > this.maxSize || height > this.maxSize) throw new Error(`Sheet ${width}x${height} exceeds ${this.maxSize}`);
    const key = `/__swf/${++this.counter}.swf`;
    this.swfs.set(key, swf);
    await this.page.evaluate(bg => { document.body.style.background = bg || 'transparent'; }, background);
    const info = await this.page.evaluate(([url, w, h, s]) => window.loadSwf(url, w, h, s), [key, width, height, settleMs]);
    if (info.canvasW !== width || info.canvasH !== height) console.warn(`  warning: Ruffle canvas is ${info.canvasW}x${info.canvasH}, expected ${width}x${height}`);
    // SwiftShader can take many seconds per frame on a large sheet full of filtered clips.
    const shot = () => this.page.screenshot({ omitBackground: !background, clip: { x: 0, y: 0, width, height }, timeout: 180000 });
    let png = await shot();
    for (let i = 0; stable && i < 8; i++) {
      await this.page.waitForTimeout(200);
      const again = await shot();
      if (again.equals(png)) break;
      png = again;
      if (i === 7) console.warn('  warning: sheet never became stable');
    }
    this.swfs.delete(key);
    return { png, info };
  }

  async close() {
    await this.browser?.close();
    this.server?.close();
  }
}
