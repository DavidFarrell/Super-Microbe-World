// Language chooser: the 11 languages of the 2009 live build (web/data/lang/manifest.json), each
// under its own native name. The original chose the language through a "language" flashvar in
// the embedding page and had no in-game screen (NOTES 7.1); the port asks on the first run (on
// the splash) and in Settings. The game show quiz and the host's introduction exist in every
// language; everything else is English until translations arrive, and the chooser says so.
import { el } from '../ui/dom.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { glossy, pushNav } from './ui.js';

const CSS_ID = 'flow-language-style';
const CSS = `
.lc-box { width: 660px; padding: 20px 24px 18px; }
.lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 12px; }
.lc-grid .fl-btn { font-size: calc(17px * var(--text-scale, 1)); padding: 8px 10px 7px; }
.lc-grid .fl-btn[aria-checked="true"] { outline: 3px solid #2b2150; outline-offset: 2px; }
.lc-note { font-size: calc(13px * var(--text-scale, 1)) !important; opacity: 0.8; }
.lc-globe { width: 34px; height: 34px; vertical-align: middle; margin-right: 8px; }
`;

// Maps the browser language to the nearest original code (NOTES 11.9 #19: original codes).
export function detectLanguage(codes, nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en') {
  const tag = String(nav).toLowerCase();
  const table = [
    [/^nl/, 'bg_fl'], [/^fr-be/, 'bg_fr'], [/^fr/, 'fr_fr'], [/^cs/, 'cz_cz'], [/^da/, 'dk_dk'], [/^el/, 'gk_gk'],
    [/^it/, 'it_it'], [/^pl/, 'pl_pl'], [/^pt/, 'por_por'], [/^es/, 'sp_sp'], [/^en/, 'en'],
  ];
  for (const [re, code] of table) if (re.test(tag) && codes.includes(code)) return code;
  return 'en';
}

// Opens the chooser over `parent`; resolves to the chosen code, or null when closed without one.
export async function openLanguageChooser(app, parent, { firstRun = false } = {}) {
  if (!document.getElementById(CSS_ID)) document.head.append(el('style', { id: CSS_ID }, CSS));
  const manifest = await app.flow.manifest();
  const codes = manifest.languages || ['en'];
  const names = manifest.names || { en: 'English' };
  const current = settings.get('language') || detectLanguage(codes);
  return new Promise(resolve => {
    let pop = null;
    const done = code => { if (pop) pop(); dim.remove(); resolve(code); };
    const buttons = codes.map(code => glossy(names[code] || code, () => done(code), {
      class: code === current ? '' : 'alt', id: `lang-${code}`, lang: code === 'en' ? 'en-GB' : code.slice(0, 2),
      role: 'radio', 'aria-checked': String(code === current),
    }));
    const globe = el('span', {});
    globe.innerHTML = '<svg class="lc-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>';
    const box = el('div', { class: 'fl-dialog lc-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('flow.lang.title'), id: 'language-chooser' },
      el('h2', {}, globe, t('flow.lang.title')),
      el('div', { class: 'lc-grid', role: 'radiogroup', 'aria-label': t('flow.lang.title') }, buttons),
      el('p', { class: 'lc-note' }, t('flow.lang.note')),
      firstRun ? null : el('div', { class: 'fl-row' }, glossy(t('flow.ui.cancel'), () => done(null), { class: 'alt small', id: 'lang-cancel' })));
    const dim = el('div', { class: 'fl-dim', style: { zIndex: '45' } }, box);
    parent.append(dim);
    pop = pushNav(box, { onBack: firstRun ? () => done(current) : () => done(null), initial: buttons[codes.indexOf(current)] || buttons[0] });
  });
}
