// Translatable text. Strings live in web/data/lang/<code>.json (common UI) plus one file per
// area, web/data/lang/<code>/<namespace>.json (namespaces listed in web/data/lang/manifest.json),
// each a flat { key: text } table merged into one lookup per language;
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

let manifest = null;

// Loads a language's common table plus every namespace file; missing files are skipped.
async function loadTable(code) {
  manifest ||= await loadJson('data/lang/manifest.json').catch(() => ({ languages: ['en'], namespaces: [] }));
  const parts = await Promise.all([
    loadJson(`data/lang/${code}.json`).catch(() => null),
    ...manifest.namespaces.map(ns => loadJson(`data/lang/${code}/${ns}.json`).catch(() => null)),
  ]);
  if (parts.every(p => p == null)) return null;
  return Object.assign({}, ...parts.filter(Boolean));
}

export const availableLanguages = () => (manifest ? manifest.languages : ['en']);

export async function loadLanguage(code = settings.get('language') || 'en') {
  if (!tables.en || !Object.keys(tables.en).length) tables.en = (await loadTable('en')) || {};
  if (code !== 'en' && !tables[code]) tables[code] = await loadTable(code);
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
