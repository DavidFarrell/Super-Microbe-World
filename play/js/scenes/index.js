// Scene registry and boot-time asset loading.
import { loadAll } from '../core/assets.js';
import { splashScene } from './splash.js';
import { platformScene } from '../platformer/platformScene.js';
import { fontTasks } from '../core/fonts.js';
import { loadLanguage } from '../core/i18n.js';
import { sprites } from '../platformer/sprites.js';

export async function bootAssets(app, onProgress) {
  await loadAll([...fontTasks(), () => loadLanguage(), () => sprites.loadIndex()], onProgress);
}

export function registerScenes(app) {
  app.scenes.register('splash', splashScene);
  app.scenes.register('platform', platformScene);
}
