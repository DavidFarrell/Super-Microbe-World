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

const app = {
  input, audio, settings, params,
  view: new View(document.getElementById('stage-root'), document.getElementById('game'), document.getElementById('ui')),
  ui: document.getElementById('ui'),
  touch: new TouchControls(document.getElementById('touch')),
  announce(text) { const live = document.getElementById('live'); live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); },
};
app.scenes = new SceneManager(app);
app.loop = new Loop({
  update: tick => { input.poll(); app.scenes.update(tick); },
  render: alpha => { const ctx = app.view.begin(); app.scenes.render(ctx, alpha); },
});
installTestHooks(app);

// Pause the simulation when the tab is hidden; scenes may show a pause menu.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.scenes.current?.onHidden?.();
});

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
  window.focus();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable on this host */ });
}

boot();
