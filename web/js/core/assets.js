// Asset loading. Everything goes through fetch() with relative URLs so the game works
// from any static host, a sub-path, or an artifact that serves its files alongside the page.
import { audio } from './audio.js';

const cache = new Map();

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res;
}

export async function loadJson(url) {
  if (!cache.has(url)) cache.set(url, fetchOk(url).then(r => r.json()));
  return cache.get(url);
}

export async function loadImage(url) {
  if (!cache.has(url)) {
    cache.set(url, fetchOk(url).then(r => r.blob()).then(b => createImageBitmap(b)));
  }
  return cache.get(url);
}

export async function loadSound(url) {
  if (!cache.has(url)) {
    cache.set(url, fetchOk(url).then(r => r.arrayBuffer()).then(buf => audio.decode(buf)));
  }
  return cache.get(url);
}

export async function loadFont(family, url, descriptors = {}) {
  const key = 'font:' + family + url;
  if (!cache.has(key)) {
    cache.set(key, fetchOk(url).then(r => r.arrayBuffer()).then(async buf => {
      const face = new FontFace(family, buf, descriptors);
      await face.load();
      document.fonts.add(face);
      return face;
    }));
  }
  return cache.get(key);
}

// An atlas is JSON plus WebP pages in the "smw-atlas/1" format written by tools/build-atlas.cjs:
// { images: [page files], symbols: { name: { scale, frameCount, labels, scripts, tracks,
// frames: [[image, x, y, w, h, originX, originY] | null] } } }. See that file's header for the
// draw formula; web/data/atlas/index.json maps symbols to atlases and lists per-level sets.
export async function loadAtlas(jsonUrl) {
  if (!cache.has(jsonUrl)) {
    cache.set(jsonUrl, (async () => {
      const data = await loadJson(jsonUrl);
      const base = jsonUrl.slice(0, jsonUrl.lastIndexOf('/') + 1);
      const images = await Promise.all((data.images || [data.image]).map(src => loadImage(base + src)));
      return { ...data, bitmaps: images };
    })());
  }
  return cache.get(jsonUrl);
}

// Loads a batch with progress reporting: tasks is an array of () => Promise.
export async function loadAll(tasks, onProgress = () => {}) {
  let done = 0;
  onProgress(0, tasks.length);
  return Promise.all(tasks.map(t => t().then(v => { onProgress(++done, tasks.length); return v; })));
}
