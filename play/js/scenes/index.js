// Scene registry and boot-time asset loading.
import { loadAll } from '../core/assets.js';
import { splashScene } from './splash.js';
import { platformScene } from '../platformer/platformScene.js';
import { fontTasks } from '../core/fonts.js';
import { loadLanguage } from '../core/i18n.js';
import { sprites } from '../platformer/sprites.js';
import { gameshowScene } from '../gameshow/gameshowScene.js';
import { kitchenScene } from '../kitchen/kitchenScene.js';
import { cutsceneScene } from '../flow/cutscene.js';
import { shrinkScene } from '../flow/shrink.js';
import { summaryScene } from '../flow/summary.js';
import { endingScene } from '../flow/ending.js';
import { levelSelectScene } from '../flow/levelSelect.js';
import { settingsScene } from '../flow/settings.js';
import { createFlow } from '../flow/flow.js';

export async function bootAssets(app, onProgress) {
  await loadAll([...fontTasks(), () => loadLanguage(), () => sprites.loadIndex()], onProgress);
}

export function registerScenes(app) {
  app.scenes.register('splash', splashScene);
  app.scenes.register('platform', platformScene);
  app.scenes.register('gameshow', gameshowScene);
  app.scenes.register('kitchen', kitchenScene);
  app.scenes.register('cutscene', cutsceneScene);
  app.scenes.register('shrink', shrinkScene);
  app.scenes.register('summary', summaryScene);
  app.scenes.register('ending', endingScene);
  app.scenes.register('levelSelect', levelSelectScene);
  app.scenes.register('settings', settingsScene);
  app.flow = createFlow(app);
}
