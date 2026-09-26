// Packs PNG frame sequences into WebP (and PNG fallback) atlases using headless Chromium's
// canvas, so no image libraries are needed. Dev-only; the game just loads the output.
//
// Usage: NODE_PATH=/opt/node22/lib/node_modules node tools/build-atlas.cjs <manifest.json>
// Manifest: { "out": "web/data/atlas/microbes", "pageSize": 2048, "quality": 0.86, "padding": 2,
//   "sprites": [ { "name": "lucy", "files": ["Assets/.../00lucy0001.png", ...], "scale": 0.5,
//                  "keys": ["1", "2", ...] (optional frame keys, default: numbers parsed from file names),
//                  "trim": true } ] }
// Output: <out>.json { pages: ["<base>-0.webp", ...], pagesPng: [...], sprites: { name: { scale,
//   frames: { key: [page, x, y, w, h, offX, offY, fullW, fullH] } } } }
// Offsets and full sizes are in the sprite's scaled pixel space; divide by `scale` for source pixels.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const manifestPath = process.argv[2];
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pageSize = m.pageSize || 2048, padding = m.padding ?? 2, quality = m.quality ?? 0.86;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Decode, trim and scale every frame in the browser; collect trimmed bitmaps as PNG data URLs.
  const frames = [];
  for (const s of m.sprites) {
    const files = s.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = s.keys ? String(s.keys[i]) : String(parseInt((path.basename(file).match(/(\d+)\.png$/i) || [0, i])[1], 10));
      const data = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, file)).toString('base64');
      const r = await page.evaluate(async ({ data, scale, trim }) => {
        const img = new Image(); img.src = data; await img.decode();
        const fw = Math.max(1, Math.round(img.width * scale)), fh = Math.max(1, Math.round(img.height * scale));
        const c = new OffscreenCanvas(fw, fh), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, fw, fh);
        let x0 = 0, y0 = 0, x1 = fw, y1 = fh;
        if (trim) {
          const d = g.getImageData(0, 0, fw, fh).data;
          x0 = fw; y0 = fh; x1 = 0; y1 = 0;
          for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
            if (d[(y * fw + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1; }
          }
          if (x1 <= x0) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
        }
        const w = x1 - x0, h = y1 - y0;
        const t = new OffscreenCanvas(w, h);
        t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
        const blob = await t.convertToBlob({ type: 'image/png' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        return { w, h, offX: x0, offY: y0, fullW: fw, fullH: fh, png: btoa(bin) };
      }, { data, scale: s.scale ?? 1, trim: s.trim !== false });
      frames.push({ sprite: s.name, key, ...r });
    }
    process.stdout.write(`  ${s.name}: ${files.length} frames\n`);
  }

  // 2. Deduplicate identical frames (Flash exports often repeat held poses).
  const byHash = new Map();
  for (const f of frames) {
    const h = f.w + 'x' + f.h + ':' + f.png;
    if (byHash.has(h)) f.dupOf = byHash.get(h); else byHash.set(h, f);
  }
  const unique = frames.filter(f => !f.dupOf);

  // 3. Shelf-pack unique frames, tallest first, into square pages.
  unique.sort((a, b) => b.h - a.h || b.w - a.w);
  const pages = [];
  let cur = null;
  const newPage = () => { cur = { shelves: [], y: 0, items: [] }; pages.push(cur); };
  newPage();
  for (const f of unique) {
    const w = f.w + padding * 2, h = f.h + padding * 2;
    if (w > pageSize || h > pageSize) throw new Error(`Frame ${f.sprite}#${f.key} (${f.w}x${f.h}) exceeds page size`);
    let placed = false;
    for (const pg of pages) {
      for (const sh of pg.shelves) {
        if (h <= sh.h && sh.x + w <= pageSize) { f.page = pages.indexOf(pg); f.x = sh.x + padding; f.y = sh.y + padding; sh.x += w; pg.items.push(f); placed = true; break; }
      }
      if (placed) break;
      if (pg.y + h <= pageSize) {
        const sh = { x: w, y: pg.y, h };
        pg.shelves.push(sh); pg.y += h;
        f.page = pages.indexOf(pg); f.x = padding; f.y = sh.y + padding; pg.items.push(f); placed = true; break;
      }
    }
    if (!placed) { newPage(); const sh = { x: w, y: 0, h }; cur.shelves.push(sh); cur.y = h; f.page = pages.length - 1; f.x = padding; f.y = padding; cur.items.push(f); }
  }

  // 4. Render pages and encode WebP + PNG.
  const outBase = path.join(ROOT, m.out);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  const baseName = path.basename(outBase);
  const pageFiles = [], pngFiles = [];
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    const usedH = Math.min(pageSize, Math.pow(2, Math.ceil(Math.log2(Math.max(64, pg.y)))));
    const res = await page.evaluate(async ({ items, size, h, quality }) => {
      const c = new OffscreenCanvas(size, h), g = c.getContext('2d');
      for (const it of items) {
        const img = new Image(); img.src = 'data:image/png;base64,' + it.png; await img.decode();
        g.drawImage(img, it.x, it.y);
      }
      const enc = async type => {
        const blob = await c.convertToBlob(type === 'image/webp' ? { type, quality } : { type });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      return { webp: await enc('image/webp'), png: await enc('image/png') };
    }, { items: pg.items.map(f => ({ x: f.x, y: f.y, png: f.png })), size: pageSize, h: usedH, quality });
    const wf = `${baseName}-${i}.webp`, pf = `${baseName}-${i}.png`;
    fs.writeFileSync(path.join(path.dirname(outBase), wf), Buffer.from(res.webp, 'base64'));
    if (m.png !== false) fs.writeFileSync(path.join(path.dirname(outBase), pf), Buffer.from(res.png, 'base64'));
    pageFiles.push(wf); pngFiles.push(pf);
  }

  const json = { pages: pageFiles, pagesPng: m.png !== false ? pngFiles : undefined, sprites: {} };
  for (const s of m.sprites) json.sprites[s.name] = { scale: s.scale ?? 1, frames: {} };
  for (const f of frames) {
    const src = f.dupOf || f;
    json.sprites[f.sprite].frames[f.key] = [src.page, src.x, src.y, src.w, src.h, f.offX, f.offY, f.fullW, f.fullH];
  }
  fs.writeFileSync(outBase + '.json', JSON.stringify(json));
  await browser.close();
  const bytes = pageFiles.reduce((n, f) => n + fs.statSync(path.join(path.dirname(outBase), f)).size, 0);
  console.log(`${m.out}: ${frames.length} frames (${unique.length} unique) on ${pages.length} page(s), WebP ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
