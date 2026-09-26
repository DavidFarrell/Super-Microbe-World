// Settings (port addition; the 2009 game had none): sound, game, display and accessibility,
// controls (every action remappable, with a "Classic 2009 keys" preset: Up jumps, Space throws,
// Ctrl takes photos) and saved data. Available as the 'settings' scene (from the splash) and as
// an overlay other areas can open over their own screen:
//   import { openSettings } from '../flow/settings.js';
//   openSettings(app, { onClose })
// While the overlay is open, app.flow.overlayOpen is true, the rest of the UI is inert and the
// overlay reads the keyboard itself (the host scene receives no key presses), so a paused level
// underneath stays paused. Everything is saved at once through core/settings.js; the flow owns
// the 'blindRounds' key (default off, decision 11.9 #1).
import { el } from '../ui/dom.js';
import { input, ACTIONS } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings, DEFAULT_KEYS } from '../core/settings.js';
import { t, loadLanguage } from '../core/i18n.js';
import { haptic } from '../core/fx.js';
import { keyLabel } from '../ui/prompts.js';
import { ensureStyle, glossy, pushNav, tickNav, clearNav, confirmDialog, moveFocus, adjustFocused, topNav, focusInitial } from './ui.js';
import { openLanguageChooser } from './language.js';

// The 2009 keys (PlatformGame.as:1260-1311, PlayerEntity.as:566-636; NOTES 3.9): arrows move,
// Up jumps, Space throws, Ctrl photographs.
export const CLASSIC_KEYS = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  jump: ['ArrowUp'], fire: ['Space'], camera: ['ControlLeft', 'ControlRight'],
  phone: ['KeyP', 'Tab'], pause: ['Escape'], confirm: ['Enter', 'NumpadEnter'], back: ['Backspace'],
  answer1: ['Digit1', 'Numpad1'], answer2: ['Digit2', 'Numpad2'], answer3: ['Digit3', 'Numpad3'],
};
// Keys that may be shared between actions of different groups (menus vs play vs quiz).
const GROUPS = [
  ['left', 'right', 'jump', 'fire', 'camera', 'phone', 'pause'],
  ['up', 'down', 'left', 'right', 'confirm', 'back', 'pause'],
  ['answer1', 'answer2', 'answer3', 'confirm', 'back'],
];
const TEXT_SIZES = [1, 1.15, 1.3];
const TABS = ['sound', 'game', 'display', 'controls', 'data'];

const CSS = `
.st-root { position: absolute; inset: 0; background: linear-gradient(180deg, #2c2466, #1b1640); color: #fdf8ec; font-family: var(--body-font); }
.st-head { position: absolute; left: 14px; right: 14px; top: 10px; height: 50px; display: flex; align-items: center; gap: 14px; }
.st-head h1 { margin: 0; flex: 1; text-align: center; font: 800 calc(30px * var(--text-scale, 1)) var(--ui-font); color: #fff; text-shadow: 0 3px 0 #0a0830; padding-right: 90px; }
.st-tabs { position: absolute; left: 14px; top: 70px; width: 172px; display: grid; gap: 8px; }
.st-tabs .fl-btn { text-align: left; font-size: calc(17px * var(--text-scale, 1)); padding: 9px 14px 8px; }
.st-tabs .fl-btn[aria-selected="false"] { --fl-bg: linear-gradient(180deg, #4a4190, #372f78); border-color: #120e3a; box-shadow: 0 3px 0 #0a0830; text-shadow: none; }
.st-panel { position: absolute; left: 200px; right: 14px; top: 70px; bottom: 12px; overflow-y: auto; overscroll-behavior: contain; padding: 4px 10px 12px 4px; touch-action: pan-y; }
.st-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 14px; padding: 9px 12px; border-radius: 12px; background: rgba(255,255,255,0.06); margin-bottom: 8px; min-height: 44px; }
.st-row .lbl b { display: block; font: 800 calc(18px * var(--text-scale, 1))/1.15 var(--ui-font); color: #fff; }
.st-row .lbl span { display: block; font-size: calc(13px * var(--text-scale, 1)); line-height: 1.3; opacity: 0.8; margin-top: 2px; }
.st-slider { position: relative; width: 230px; height: 44px; border-radius: 22px; cursor: pointer; touch-action: none; }
.st-slider:focus-visible { outline: 4px solid #ffd23f; outline-offset: 2px; }
.st-slider .track { position: absolute; left: 14px; right: 60px; top: 19px; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.2); }
.st-slider .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #5fd4ff; }
.st-slider .knob { position: absolute; top: -9px; width: 26px; height: 26px; margin-left: -13px; border-radius: 50%; background: #fff; border: 3px solid #0e3d6b; box-shadow: 0 2px 0 #0a2a4a; }
.st-slider .val { position: absolute; right: 4px; top: 11px; width: 50px; text-align: right; font: 800 calc(16px * var(--text-scale, 1)) var(--ui-font); }
.st-switch { position: relative; width: 78px; height: 44px; border-radius: 22px; border: 3px solid #0e3d6b; background: #4a4190; cursor: pointer; padding: 0; }
.st-switch::after { content: ''; position: absolute; left: 4px; top: 4px; width: 30px; height: 30px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.st-switch[aria-checked="true"] { background: #36c26b; }
.st-switch[aria-checked="true"]::after { transform: translateX(34px); }
.st-switch:focus-visible { outline: 4px solid #ffd23f; outline-offset: 2px; }
.st-seg { display: flex; gap: 6px; }
.st-seg .fl-btn { font-size: calc(15px * var(--text-scale, 1)); padding: 7px 12px 6px; min-width: 64px; }
.st-seg .fl-btn[aria-checked="false"] { --fl-bg: linear-gradient(180deg, #4a4190, #372f78); border-color: #120e3a; box-shadow: 0 3px 0 #0a0830; text-shadow: none; }
.st-keys { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.st-key { display: inline-block; min-width: 26px; padding: 3px 8px; border-radius: 7px; background: #fdf8ec; color: #1b1640; font: 800 calc(14px * var(--text-scale, 1)) var(--ui-font); text-align: center; box-shadow: 0 2px 0 #8a7d5a; }
.st-key.none { background: #ff9a9a; }
.st-capture { font: 800 calc(15px * var(--text-scale, 1)) var(--ui-font); color: #ffd23f; animation: st-blink 0.8s ease-in-out infinite alternate; }
@keyframes st-blink { from { opacity: 1; } to { opacity: 0.45; } }
.st-note { font-size: calc(13px * var(--text-scale, 1)); color: #ffd23f; min-height: 18px; margin: 0 0 8px 4px; }
.st-presets { display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.st-overlay { position: absolute; inset: 0; z-index: 50; }
html.reduced-motion .st-switch::after { transition: none; }
`;

// ---------------------------------------------------------------------------------------------
// Building blocks. Every control is a real focusable element; sliders and switches also take
// left / right (data-adjust, handled by ui.js navigation).
// ---------------------------------------------------------------------------------------------
function row(label, desc, control, id) {
  return el('div', { class: 'st-row', id }, el('div', { class: 'lbl' }, el('b', {}, label), desc ? el('span', {}, desc) : null), control);
}

function slider({ id, label, get, set, min = 0, max = 1, step = 0.05, format = v => `${Math.round(v * 100)}%` }) {
  const fill = el('div', { class: 'fill' });
  const knob = el('div', { class: 'knob' });
  const val = el('div', { class: 'val' });
  const node = el('div', { class: 'st-slider', id, role: 'slider', tabindex: '0', 'data-focusable': '', 'data-adjust': '', 'aria-label': label,
    'aria-valuemin': String(min), 'aria-valuemax': String(max) }, el('div', { class: 'track' }, fill, knob), val);
  const show = () => {
    const v = get();
    const k = (v - min) / (max - min);
    fill.style.width = `${k * 100}%`;
    knob.style.left = `${k * 100}%`;
    val.textContent = format(v);
    node.setAttribute('aria-valuenow', String(Math.round(v * 100) / 100));
    node.setAttribute('aria-valuetext', format(v));
  };
  const apply = v => {
    const q = Math.round(Math.min(max, Math.max(min, v)) / step) * step;
    set(Math.round(q * 1000) / 1000);
    show();
  };
  node.onAdjust = d => { apply(get() + d * step); audio.play('tick'); };
  const fromPointer = e => {
    const r = node.querySelector('.track').getBoundingClientRect();
    apply(min + ((e.clientX - r.left) / r.width) * (max - min));
  };
  node.addEventListener('pointerdown', e => { e.preventDefault(); node.setPointerCapture(e.pointerId); node.focus({ preventScroll: true }); fromPointer(e); });
  node.addEventListener('pointermove', e => { if (node.hasPointerCapture(e.pointerId)) fromPointer(e); });
  node.addEventListener('pointerup', () => audio.play('tick'));
  show();
  node.refresh = show;
  return node;
}

function toggle({ id, label, get, set, disabled = false }) {
  const node = el('button', { type: 'button', class: 'st-switch', id, role: 'switch', 'aria-label': label, 'data-adjust': '', disabled });
  const show = () => node.setAttribute('aria-checked', String(!!get()));
  node.addEventListener('click', () => { set(!get()); show(); audio.play('tap'); });
  node.onAdjust = d => { const want = d > 0; if (!!get() !== want) { set(want); show(); audio.play('tap'); } };
  show();
  node.refresh = show;
  return node;
}

function segmented({ id, label, options, get, set }) {
  const group = el('div', { class: 'st-seg', role: 'radiogroup', 'aria-label': label, id });
  const buttons = options.map(o => glossy(o.label, () => { set(o.value); show(); }, { class: 'small', role: 'radio', id: `${id}-${o.key}` }));
  const show = () => buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i].value === get())));
  group.append(...buttons);
  show();
  group.refresh = show;
  return group;
}

// Keys: replace an action's first key with `code`, and free `code` from the other actions it
// would clash with (same group). Returns the list of actions that lost the key.
export function remapKey(keys, action, code) {
  const next = structuredClone(keys);
  const old = next[action] || [];
  next[action] = [code, ...old.slice(1).filter(k => k !== code)];
  const clash = new Set(GROUPS.filter(g => g.includes(action)).flat());
  const moved = [];
  for (const other of ACTIONS) {
    if (other === action || !clash.has(other)) continue;
    const list = next[other] || [];
    if (list.includes(code)) { next[other] = list.filter(k => k !== code); moved.push(other); }
  }
  return { keys: next, moved };
}

// ---------------------------------------------------------------------------------------------
// The panel (shared by the scene and the overlay).
// ---------------------------------------------------------------------------------------------
function buildPanel(app, { onBack, overlay }) {
  let tab = 'sound';
  let capture = null;       // { action, row }
  let note = '';
  const panel = el('div', { class: 'st-panel', id: 'settings-panel', role: 'tabpanel' });
  const tabButtons = TABS.map(k => glossy(t(`flow.settings.tab.${k}`), () => showTab(k), { id: `settings-tab-${k}`, role: 'tab', class: 'small' }));
  const root = el('div', { class: 'st-root', id: 'settings-root', role: 'dialog', 'aria-label': t('flow.settings.title') },
    el('div', { class: 'st-head' }, glossy(t('flow.ui.back'), () => onBack(), { id: 'settings-back', class: 'alt small' }), el('h1', {}, t('flow.settings.title'))),
    el('div', { class: 'st-tabs', role: 'tablist', 'aria-orientation': 'vertical' }, tabButtons),
    panel);

  const volume = key => ({ get: () => Number(settings.get(key)) || 0, set: v => { settings.set(key, v); if (key !== 'master' || !settings.get('muted')) audio.play('tick', { volume: 0.8 }); } });
  const motionChoice = key => segmented({
    id: `settings-${key}`, label: t(`flow.settings.${key}`),
    options: [{ key: 'auto', value: 'auto', label: t('flow.settings.auto') }, { key: 'on', value: true, label: t('flow.settings.on') }, { key: 'off', value: false, label: t('flow.settings.off') }],
    get: () => (settings.isSet(key) ? !!settings.get(key) : 'auto'),
    set: v => settings.set(key, v === 'auto' ? null : v),
  });

  const builders = {
    sound: () => [
      row(t('flow.settings.master'), null, slider({ id: 'settings-master', label: t('flow.settings.master'), ...volume('master') })),
      row(t('flow.settings.music'), null, slider({ id: 'settings-music', label: t('flow.settings.music'), ...volume('music') })),
      row(t('flow.settings.sfx'), null, slider({ id: 'settings-sfx', label: t('flow.settings.sfx'), ...volume('sfx') })),
      row(t('flow.settings.mute'), t('flow.settings.muteDesc'), toggle({ id: 'settings-muted', label: t('flow.settings.mute'), get: () => settings.get('muted'), set: v => settings.set('muted', v) })),
    ],
    game: () => [
      row(t('flow.settings.blind'), t('flow.settings.blindDesc'), toggle({ id: 'settings-blind', label: t('flow.settings.blind'), get: () => !!settings.get('blindRounds'), set: v => settings.set('blindRounds', v) })),
      row(t('flow.settings.language'), t('flow.settings.languageDesc'), languageButton()),
    ],
    display: () => [
      row(t('flow.settings.reducedMotion'), t('flow.settings.reducedMotionDesc'), motionChoice('reducedMotion')),
      row(t('flow.settings.reducedShake'), t('flow.settings.reducedShakeDesc'), motionChoice('reducedShake')),
      row(t('flow.settings.textSize'), t('flow.settings.textSizeDesc'), segmented({
        id: 'settings-text', label: t('flow.settings.textSize'),
        options: TEXT_SIZES.map(v => ({ key: String(Math.round(v * 100)), value: v, label: `${Math.round(v * 100)}%` })),
        get: () => Number(settings.get('textScale')) || 1, set: v => settings.set('textScale', v),
      })),
      row(t('flow.settings.touchOpacity'), t('flow.settings.touchOpacityDesc'), slider({ id: 'settings-touch', label: t('flow.settings.touchOpacity'), min: 0.2, max: 1, get: () => Number(settings.get('touchOpacity')) || 0.55, set: v => settings.set('touchOpacity', v) })),
      row(t('flow.settings.haptics'), navigator.vibrate ? t('flow.settings.hapticsDesc') : t('flow.settings.hapticsNone'),
        toggle({ id: 'settings-haptics', label: t('flow.settings.haptics'), get: () => !!settings.get('haptics'), set: v => { settings.set('haptics', v); if (v) haptic(30); }, disabled: !navigator.vibrate })),
    ],
    controls: () => {
      const out = [
        el('div', { class: 'st-presets' },
          glossy(t('flow.settings.classic'), () => { settings.set('keys', structuredClone(CLASSIC_KEYS)); setNote(t('flow.settings.classicDone')); refreshKeys(); }, { id: 'settings-keys-classic', class: 'small' }),
          glossy(t('flow.settings.resetKeys'), () => { settings.resetKeys(); setNote(t('flow.settings.resetKeysDone')); refreshKeys(); }, { id: 'settings-keys-reset', class: 'small alt' })),
        el('p', { class: 'st-note', id: 'settings-note', 'aria-live': 'polite' }, note),
      ];
      for (const action of ACTIONS) out.push(keyRow(action));
      return out;
    },
    data: () => [
      row(t('flow.settings.nickname'), app.flow.profile.nickname ? t('flow.settings.nicknameSaved', { name: app.flow.profile.nickname }) : t('flow.settings.nicknameNone'),
        glossy(t('flow.settings.clearNickname'), async () => {
          const ok = await confirmDialog(root, { title: t('flow.settings.clearNicknameTitle'), text: t('flow.settings.clearNicknameText'), yes: t('flow.settings.clear'), no: t('flow.ui.cancel'), danger: true });
          if (ok) { app.flow.clearNickname(); app.announce(t('flow.settings.nicknameCleared')); showTab('data', '#settings-clear-nickname'); }
        }, { id: 'settings-clear-nickname', class: 'small warn', disabled: !app.flow.profile.nickname && !(app.flow.state.run && app.flow.state.run.age != null) })),
      row(t('flow.settings.resetProgress'), t('flow.settings.resetProgressDesc'),
        glossy(t('flow.settings.reset'), async () => {
          const ok = await confirmDialog(root, { title: t('flow.settings.resetTitle'), text: t('flow.settings.resetText'), yes: t('flow.settings.resetYes'), no: t('flow.ui.cancel'), danger: true });
          if (ok) { app.flow.resetProgress(); app.announce(t('flow.settings.progressReset')); showTab('data', '#settings-reset-progress'); }
        }, { id: 'settings-reset-progress', class: 'small warn' })),
      el('p', { class: 'st-note', style: { color: '#fdf8ec', opacity: '0.75' } }, t('flow.settings.privacy')),
    ],
  };

  function languageButton() {
    return glossy(currentLanguageName(), async () => {
      const code = await openLanguageChooser(app, root, { firstRun: false });
      if (code && code !== settings.get('language')) {
        settings.set('language', code);
        await loadLanguage(code);
      }
      showTab('game', '#settings-language');
    }, { id: 'settings-language', class: 'small' });
  }
  let names = { en: 'English' };
  app.flow.manifest().then(m => { names = m.names || names; const b = root.querySelector('#settings-language'); if (b) b.textContent = currentLanguageName(); });
  function currentLanguageName() { return names[settings.get('language') || 'en'] || 'English'; }

  function keyChips(action) {
    const codes = settings.get('keys')[action] || [];
    if (!codes.length) return [el('span', { class: 'st-key none' }, t('flow.settings.noKey'))];
    const labels = [...new Set(codes.map(keyLabel))];
    return labels.slice(0, 4).map(l => el('span', { class: 'st-key' }, l));
  }

  function keyRow(action) {
    const keysBox = el('span', { class: 'st-keys', id: `settings-keys-${action}` }, keyChips(action));
    const change = glossy(t('flow.settings.change'), () => startCapture(action), { id: `settings-remap-${action}`, class: 'small', 'aria-label': t('flow.settings.changeLabel', { action: t(`flow.action.${action}`) }) });
    return row(t(`flow.action.${action}`), null, el('div', { class: 'st-keys' }, keysBox, change), `settings-row-${action}`);
  }

  function refreshKeys() {
    for (const action of ACTIONS) {
      const box = root.querySelector(`#settings-keys-${action}`);
      if (box) box.replaceChildren(...keyChips(action));
    }
  }

  function setNote(text) {
    note = text;
    const n = root.querySelector('#settings-note');
    if (n) n.textContent = text;
  }

  // Remapping: the next key press (any key, read in the capture phase so the game never sees it)
  // becomes the action's first key. Escape cancels, except when remapping pause or back.
  function startCapture(action) {
    if (capture) stopCapture();
    const box = root.querySelector(`#settings-keys-${action}`);
    box.replaceChildren(el('span', { class: 'st-capture' }, t('flow.settings.pressKey')));
    const onKey = e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape' && action !== 'pause' && action !== 'back') { stopCapture(); setNote(t('flow.settings.cancelled')); return; }
      if (!e.code || e.code === 'Unidentified') return;
      const { keys, moved } = remapKey(settings.get('keys'), action, e.code);
      settings.set('keys', keys);
      stopCapture();
      audio.play('tap');
      const name = keyLabel(e.code);
      const msg = moved.length
        ? t('flow.settings.remappedMoved', { key: name, action: t(`flow.action.${action}`), from: moved.map(a => t(`flow.action.${a}`)).join(', ') })
        : t('flow.settings.remapped', { key: name, action: t(`flow.action.${action}`) });
      setNote(msg);
      app.announce(msg);
      const btn = root.querySelector(`#settings-remap-${action}`);
      if (btn && input.lastDevice !== 'touch') btn.focus({ preventScroll: true });
    };
    // Stop the click that started the capture from also counting as a key.
    capture = { action, onKey };
    addEventListener('keydown', onKey, true);
    input.clearAll();
  }

  function stopCapture() {
    if (!capture) return;
    removeEventListener('keydown', capture.onKey, true);
    capture = null;
    refreshKeys();
  }

  function showTab(k, focusSel = null) {
    stopCapture();
    tab = k;
    tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(TABS[i] === k)));
    panel.replaceChildren(...builders[k]());
    panel.scrollTop = 0;
    panel.setAttribute('aria-labelledby', `settings-tab-${k}`);
    if (focusSel) { const f = root.querySelector(focusSel); if (f && input.lastDevice !== 'touch') f.focus({ preventScroll: true }); }
  }

  showTab('sound');
  return {
    root,
    get tab() { return tab; },
    get capturing() { return capture ? capture.action : null; },
    showTab,
    destroy: () => stopCapture(),
    probe: () => ({
      tab, capturing: capture ? capture.action : null, overlay: !!overlay,
      keys: settings.get('keys'), blindRounds: !!settings.get('blindRounds'), textScale: settings.get('textScale'),
      master: settings.get('master'), music: settings.get('music'), sfx: settings.get('sfx'), muted: settings.get('muted'),
      reducedMotion: settings.isSet('reducedMotion') ? !!settings.get('reducedMotion') : 'auto',
      reducedShake: settings.isSet('reducedShake') ? !!settings.get('reducedShake') : 'auto',
      touchOpacity: settings.get('touchOpacity'), haptics: settings.get('haptics'), language: settings.get('language'),
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Scene: params { back = 'splash', backParams }.
// ---------------------------------------------------------------------------------------------
export function settingsScene(app) {
  let params = {}, panel = null, popNav = null;
  const back = () => app.scenes.go(params.back || 'splash', { again: true, ...(params.backParams || {}) }, { style: 'fade' });
  return {
    enter(p = {}) {
      params = p || {};
      ensureStyle();
      ensureStyle('settings-style', CSS);
      clearNav();
      app.touch.hide();
      panel = buildPanel(app, { onBack: back, overlay: false });
      app.ui.append(panel.root);
      popNav = pushNav(panel.root, { initial: '#settings-tab-sound', onBack: () => { if (!panel.capturing) back(); } });
      window.__test && window.__test.register('settings', () => panel.probe());
    },
    exit() {
      if (panel) panel.destroy();
      if (popNav) popNav();
      window.__test && window.__test.unregister('settings');
    },
    update() { if (!panel.capturing) tickNav(); },
    render(ctx) { ctx.fillStyle = '#1b1640'; ctx.fillRect(0, 0, 800, 450); },
  };
}

// ---------------------------------------------------------------------------------------------
// Overlay over any scene (pause menus). Reads raw key events so the scene below sees none.
// ---------------------------------------------------------------------------------------------
export function openSettings(app, { onClose } = {}) {
  ensureStyle();
  ensureStyle('settings-style', CSS);
  if (app.flow) app.flow.overlayOpen = true;
  const inertBefore = [...app.ui.children].map(n => [n, n.inert]);
  for (const [n] of inertBefore) n.inert = true;
  // The game's own input (keys, touch controls, gamepad) is off while the overlay is open.
  const inputWas = input.enabled;
  input.enabled = false;
  let popNav = null;
  const close = () => {
    panel.destroy();
    removeEventListener('keydown', onKey, true);
    if (popNav) popNav();
    wrap.remove();
    for (const [n, was] of inertBefore) if (n.isConnected) n.inert = was;
    if (app.flow) app.flow.overlayOpen = false;
    input.clearAll();
    input.enabled = inputWas;
    window.__test && window.__test.unregister('settings');
    if (typeof onClose === 'function') onClose();
  };
  const panel = buildPanel(app, { onBack: close, overlay: true });
  const wrap = el('div', { class: 'st-overlay', id: 'settings-overlay' }, panel.root);
  app.ui.append(wrap);
  popNav = pushNav(panel.root, { initial: '#settings-tab-sound', onBack: close });
  // Keyboard, straight from the DOM: arrows move / adjust, Escape and Backspace go back; Enter and
  // Space reach the focused button natively. Nothing propagates to the game's input.
  const keys = () => settings.get('keys');
  const is = (action, code) => (keys()[action] || []).includes(code);
  const onKey = e => {
    if (panel.capturing) return;
    const t0 = e.target;
    if (t0 && (t0.tagName === 'INPUT' || t0.tagName === 'TEXTAREA')) return;
    e.stopPropagation();
    const top = topNav();
    const container = top ? top.container : panel.root;
    let dx = 0, dy = 0;
    if (is('left', e.code)) dx = -1; else if (is('right', e.code)) dx = 1;
    else if (is('up', e.code)) dy = -1; else if (is('down', e.code)) dy = 1;
    if (dx || dy) {
      e.preventDefault();
      if (dx && adjustFocused(container, dx)) return;
      if (!container.contains(document.activeElement)) focusInitial(container);
      else moveFocus(container, dx, dy);
      return;
    }
    if (e.code === 'Escape' || is('back', e.code) || is('pause', e.code)) {
      e.preventDefault();
      if (top && top.onBack) top.onBack();
    }
  };
  addEventListener('keydown', onKey, true);
  window.__test && window.__test.register('settings', () => panel.probe());
  return { close };
}
