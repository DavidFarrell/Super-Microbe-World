// Boot: wires the engine together, loads core assets and starts the first scene.
import { Loop } from './core/loop.js';
import { View } from './core/view.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { settings } from './core/settings.js';
import { SceneManager } from './core/scenes.js';
import { installTestHooks } from './core/testhooks.js';
import { TouchControls } from './ui/touch.js';
import { registerScenes, bootAssets } from './scenes/index.js';

const params = new URLSearchParams(location.search);
// Keep every resource timing entry: the service worker adopts the files they name (sw.js).
try { performance.setResourceTimingBufferSize(2000); } catch { /* older browsers */ }

const app = {
  input, audio, settings, params,
  view: new View(document.getElementById('stage-root'), document.getElementById('game'), document.getElementById('ui')),
  ui: document.getElementById('ui'),
  touch: new TouchControls(document.getElementById('touch')),
  // lang: the BCP 47 tag of text that is not in the UI language (quiz and host lines).
  announce(text, lang = null) {
    const live = document.getElementById('live');
    live.textContent = '';
    setTimeout(() => { if (lang) live.lang = lang; else live.removeAttribute('lang'); live.textContent = text; }, 30);
  },
};
app.scenes = new SceneManager(app);
app.loop = new Loop({
  update: tick => { input.poll(); app.scenes.update(tick); },
  render: alpha => {
    const t0 = performance.now();
    const ctx = app.view.begin();
    app.scenes.render(ctx, alpha);
    // The resolution governor only reacts to real-time play (tests step the loop by hand).
    if (!app.loop.manual) app.view.noteRender(performance.now() - t0);
  },
});
// ?manual=1 (tests): the loop never ticks in real time, so every tick is stepped by the test and
// runs with the same seed and inputs are reproducible from the first tick.
if (params.get('manual') === '1') app.loop.manual = true;
installTestHooks(app);

// Pause when the player is away: the tab is hidden, the window loses focus (alt-tab, a system
// overlay), or a phone is turned to portrait, where the rotate prompt covers the game. Scenes
// show their pause menu (onHidden only pauses from play), so the player chooses when to resume.
const away = () => app.scenes.current?.onHidden?.();
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
addEventListener('blur', away);
// Same query as the #rotate prompt in index.html. While it shows, the loop stops ticking (the
// level clock, microbes and the briefing's autoplay all wait) and only renders.
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
function applyOrientation() {
  if (portrait.matches) away();
  app.loop.setPaused(portrait.matches);
}
portrait.addEventListener('change', applyOrientation);

// Offline support, registered once the first level is being played (scenes call this), so the
// worker's precache does not compete with the level's own downloads.
let swRequested = false;
const CACHE_REST_DELAY_MS = 4000;
app.registerServiceWorker = () => {
  if (swRequested) return;
  swRequested = true;
  registerServiceWorker();
};

async function boot() {
  const bar = document.getElementById('boot-bar');
  const msg = document.getElementById('boot-msg');
  try {
    await bootAssets(app, (done, total) => { bar.style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`; });
  } catch (e) {
    msg.textContent = 'Something went wrong while loading. Please reload the page.';
    console.error(e);
    return;
  }
  registerScenes(app);
  document.getElementById('boot').hidden = true;
  const start = params.get('scene') || 'splash';
  app.scenes.go(start, Object.fromEntries(params), { style: 'none' });
  app.loop.start();
  applyOrientation();
  window.focus();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  const sw = navigator.serviceWorker;
  sw.register('sw.js').then(() => {
    // Once the worker controls this page, hand it what was downloaded before (the splash, menus
    // and cutscene on a first visit) so those screens work offline too (sw.js "adopt").
    // A few seconds later, when the page is idle, the worker fetches the rest of the game in the
    // background (sw.js "cache-rest"), so the later levels also work offline.
    const adopt = () => {
      const urls = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin));
      if (sw.controller) sw.controller.postMessage({ type: 'adopt', urls });
      const rest = () => { if (sw.controller) sw.controller.postMessage({ type: 'cache-rest' }); };
      setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(rest, { timeout: 5000 }) : rest()), CACHE_REST_DELAY_MS);
    };
    if (sw.controller) adopt(); else sw.addEventListener('controllerchange', adopt, { once: true });
  }).catch(() => { /* offline mode unavailable on this host */ });
}

boot();
