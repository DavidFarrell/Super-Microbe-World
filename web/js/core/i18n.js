// Translatable text. Strings live in web/data/lang/<code>.json as a flat { key: text } table;
// t(key, vars) looks a key up in the active language, falls back to English, then to the key.
// {name} placeholders are filled from vars; unknown placeholders are left as they are so a
// missing variable is visible rather than silently blank.
//
// Control prompts are placeholders too ({press_camera}, {key_jump}, ...): see ui/prompts.js,
// which fills them for the input device in use, so text never names a key the player lacks.
import { loadJson } from './assets.js';
import { settings } from './settings.js';

const tables = { en: {} };
let active = 'en';

export async function loadLanguage(code = settings.get('language') || 'en') {
  if (!tables.en || !Object.keys(tables.en).length) tables.en = await loadJson('data/lang/en.json').catch(() => ({}));
  if (code !== 'en' && !tables[code]) tables[code] = await loadJson(`data/lang/${code}.json`).catch(() => null);
  active = tables[code] ? code : 'en';
  document.documentElement.lang = active === 'en' ? 'en-GB' : active;
  return active;
}

export function has(key) { return key in (tables[active] || {}) || key in tables.en; }

export function t(key, vars = {}) {
  const raw = (tables[active] && tables[active][key]) ?? tables.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}

export const language = () => active;
