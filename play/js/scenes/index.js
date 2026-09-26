// Scene registry and boot-time asset loading.
import { loadAll } from '../core/assets.js';
import { splashScene } from './splash.js';
import { fontTasks } from '../core/fonts.js';

export async function bootAssets(app, onProgress) {
  await loadAll([...fontTasks()], onProgress);
}

export function registerScenes(app) {
  app.scenes.register('splash', splashScene);
}
