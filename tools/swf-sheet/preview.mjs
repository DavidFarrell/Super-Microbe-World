// Contact sheet of a symbol's rendered frames for eyeballing (dev-only). Distinct frames are laid
// out in frame order on a grey checkerboard with the registration point marked by a red cross.

import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from './png.mjs';

export function writePreview(dir, meta, { maxWidth = 2400, maxFrames = 120 } = {}) {
  const seen = new Set(), frames = [];
  meta.frames.forEach((f, i) => { if (f.file && !seen.has(f.file)) { seen.add(f.file); frames.push({ ...f, frame: i + 1 }); } });
  if (!frames.length) return;
  const step = Math.ceil(frames.length / maxFrames);
  const shown = frames.filter((_, i) => i % step === 0).map(f => ({ ...f, img: decodePng(fs.readFileSync(path.join(dir, f.file))) }));
  // Row layout, each frame in a padded box that also contains its registration point.
  const pad = 6;
  let x = 0, y = 0, rowH = 0, width = 0;
  for (const f of shown) {
    const bx0 = Math.min(0, f.originX), by0 = Math.min(0, f.originY);
    const bx1 = Math.max(f.w, f.originX + 1), by1 = Math.max(f.h, f.originY + 1);
    const w = bx1 - bx0 + pad * 2, h = by1 - by0 + pad * 2;
    if (x + w > maxWidth && x > 0) { x = 0; y += rowH; rowH = 0; }
    f.x = x + pad - bx0; f.y = y + pad - by0; x += w; rowH = Math.max(rowH, h); width = Math.max(width, x);
  }
  const height = y + rowH;
  const data = Buffer.alloc(width * height * 4);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const v = ((px >> 3) + (py >> 3)) & 1 ? 200 : 160, o = (py * width + px) * 4;
    data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  for (const f of shown) {
    for (let py = 0; py < f.h; py++) for (let px = 0; px < f.w; px++) {
      const s = (py * f.w + px) * 4, o = ((f.y + py) * width + f.x + px) * 4, a = f.img.data[s + 3] / 255;
      for (let k = 0; k < 3; k++) data[o + k] = Math.round(f.img.data[s + k] * a + data[o + k] * (1 - a));
    }
    const cx = f.x + f.originX, cy = f.y + f.originY;
    for (let d = -4; d <= 4; d++) {
      for (const [px, py] of [[cx + d, cy], [cx, cy + d]]) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const o = (py * width + px) * 4; data[o] = 255; data[o + 1] = 0; data[o + 2] = 0;
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'preview.png'), encodePng({ width, height, data }));
}
