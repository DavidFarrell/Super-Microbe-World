// Asset loading. Everything goes through fetch() with relative URLs so the game works
// from any static host, a sub-path, or an artifact that serves its files alongside the page.
const cache = new Map();

// A network error (fetch() rejects: a dropped connection, a phone moving between cells) is
// retried once after a short pause; an HTTP error (404, 500) is not, since asking again will
// not change the answer.
const RETRY_MS = 400;
async function fetchOk(url, { retry = 1 } = {}) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    if (retry <= 0) throw e;
    await new Promise(r => setTimeout(r, RETRY_MS));
    return fetchOk(url, { retry: retry - 1 });
  }
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res;
}

// Memoises a load by key but never keeps a failure: a rejected job is dropped from the cache,
// so the next request for the same file tries the network again (one blip on mobile data must
// not break a file for the rest of the session).
function memo(key, make) {
  if (!cache.has(key)) {
    const job = make().catch(e => {
      if (cache.get(key) === job) cache.delete(key);
      throw e;
    });
    cache.set(key, job);
  }
  return cache.get(key);
}

export async function loadJson(url) {
  return memo(url, () => fetchOk(url).then(r => r.json()));
}

// Prefetched bytes (url -> Promise<Blob | null>), downloaded for a screen that may come next but
// not decoded: decoded atlas pages cost tens of MB each, the compressed bytes a few hundred KB.
// fetchBlob() hands them over (and forgets them) when the screen really loads.
const prefetched = new Map();

// Downloads a file without decoding it. Safe to call repeatedly; a file already loaded (or being
// loaded) through this module is not fetched again, and a failure is silent (the real load retries).
export function prefetchBlob(url) {
  if (cache.has(url)) return Promise.resolve(null);
  if (!prefetched.has(url)) {
    const job = fetchOk(url).then(r => r.blob()).catch(() => {
      if (prefetched.get(url) === job) prefetched.delete(url);
      return null;
    });
    prefetched.set(url, job);
  }
  return prefetched.get(url);
}

// A file's bytes: the prefetched copy when there is one, otherwise fetched now. The copy is taken
// out of the store before waiting for it, so it has exactly one consumer: the atlas loader
// (sprites.loadAtlas, memoised per atlas) is the only caller, and should two loads ever ask for
// the same URL at once, the second simply fetches it again. Network errors are retried once.
export async function fetchBlob(url) {
  const job = prefetched.get(url);
  if (job) {
    prefetched.delete(url);
    const b = await job;
    if (b) return b;
  }
  return fetchOk(url).then(r => r.blob());
}

export async function loadFont(family, url, descriptors = {}) {
  return memo('font:' + family + url, () => fetchOk(url).then(r => r.arrayBuffer()).then(async buf => {
    const face = new FontFace(family, buf, descriptors);
    await face.load();
    document.fonts.add(face);
    return face;
  }));
}

// Loads a batch with progress reporting: tasks is an array of () => Promise.
export async function loadAll(tasks, onProgress = () => {}) {
  let done = 0;
  onProgress(0, tasks.length);
  return Promise.all(tasks.map(t => t().then(v => { onProgress(++done, tasks.length); return v; })));
}
