// Full screen for a game opened in a browser tab (GOAL_PROMPT: "the fullscreen API where it is
// supported"). The page never scrolls, so a phone browser's toolbar never hides by itself and
// takes a slice of the stage; the Full screen buttons (splash, pause cards) and a touch player's
// New Game / Continue tap ask for full screen and then lock the orientation to landscape. An
// installed app (display-mode fullscreen or standalone) is full screen already and shows no
// button. iPhone Safari has no element full screen: the splash shows a one-time tip about
// Add to Home Screen instead.
import { load, save } from '../core/save.js';
import { t } from '../core/i18n.js';

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

// Installed and launched from the home screen (Chromium also reports display-mode fullscreen
// while an element is full screen, which does not count).
const standalone = () => {
  try {
    return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches
      || (!isFullscreen() && matchMedia('(display-mode: fullscreen)').matches);
  } catch { return false; }
};

// Whether a Full screen button makes sense here (it also leaves full screen).
export function canFullscreen() {
  const d = document;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !standalone();
}

// Asks for full screen (must run inside a tap or key press), then landscape. Never throws.
export async function enterFullscreen() {
  if (isFullscreen()) return true;
  const root = document.documentElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    else return false;
  } catch { return false; }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch { /* not allowed here */ }
  return true;
}

export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch { /* already left */ }
}

export function toggleFullscreen() {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

// Calls fn whenever full screen starts or ends (for button labels). Returns the unsubscribe.
export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}

// iPhone Safari (no element full screen), in the browser rather than from the home screen, and
// the tip not yet dismissed on this device.
const HINT_KEY = 'homeScreenHint';
export function wantsHomeScreenHint() {
  const iphone = /iPhone|iPod/.test(navigator.userAgent || '');
  return iphone && !canFullscreen() && !standalone() && !load(HINT_KEY, false);
}
export function dismissHomeScreenHint() { save(HINT_KEY, true); }

export const FULLSCREEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
export const EXIT_FULLSCREEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';

// A text button for a pause card that enters or leaves full screen, or null where there is no
// full screen to offer. `button` is ui/dom.js button(); attrs as for it.
export function fullscreenButton(button, attrs = {}) {
  if (!canFullscreen()) return null;
  const label = () => t(isFullscreen() ? 'flow.menu.exitFullscreen' : 'flow.menu.fullscreen');
  const b = button(label(), () => { Promise.resolve(toggleFullscreen()).then(() => { b.textContent = label(); }); }, attrs);
  return b;
}
