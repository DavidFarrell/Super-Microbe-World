// Bundled fonts (SIL OFL, see web/fonts/OFL-*.txt), loaded with FontFace from relative
// URLs so the game makes no network requests. Greek and other scripts fall back to system fonts.
import { loadFont } from './assets.js';

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const FACES = [
  ['Baloo', 'baloo-2', ['700', '800']],
  ['Atkinson', 'atkinson-hyperlegible', ['400', '700']],
];

export function fontTasks() {
  const tasks = [];
  for (const [family, file, weights] of FACES) {
    for (const weight of weights) {
      tasks.push(() => loadFont(family, `fonts/${file}-latin-${weight}-normal.woff2`, { weight, unicodeRange: LATIN, display: 'swap' }).catch(() => null));
      tasks.push(() => loadFont(family, `fonts/${file}-latin-ext-${weight}-normal.woff2`, { weight, unicodeRange: LATIN_EXT, display: 'swap' }).catch(() => null));
    }
  }
  return tasks;
}
