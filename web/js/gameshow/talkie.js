// The host's dialogue box ("talkie"), a port of src/ebug/general/Talkie.as with the original box
// art (eBugGameShow.swf sprite 22, atlas symbol gs_talkie in the 'gameshow' and 'cutscene' sets).
// Shared by the game show and the flow area's intro cutscene. API (keep stable):
//
//   const talkie = createTalkie(app, { x, y, width, lines, speaker });
//   talkie.say(statements, onDone)  // statements: string[] (or one string), shown one by one;
//                                   // onDone() runs after the last one is dismissed
//   talkie.update()                 // once per 15 ms engine tick: typing, input
//   talkie.render(ctx)              // draws box, speaker, text and the next arrow (stage units)
//   talkie.skip()                   // same as a tap: completes the page, else advances
//   talkie.done                     // true when nothing is left to show (after onDone)
//   talkie.destroy()                // removes the DOM tap zone
//
// Options (all optional):
//   x, y      top-left of the talkie clip on the stage (Flash _x, _y). Game show (20, 308)
//             (GameShow.as:65-67); cutscene (15, 307.5).
//   width     width of the text field in stage px (default 667, the original
//             statement_text_field); text wraps to it.
//   lines     the most text lines shown at once (default: as many as fit the box, 3 at text
//             size 100%). Text that needs more lines is split into pages at word breaks; each
//             page types out and waits for its own tap.
//   speaker   name in the blue speaker box (default t('gameshow.host'), "Gameshow Host";
//             GameShow.as:150). Change later with talkie.speaker = '...'.
//   tapArea   'stage' (default: a tap anywhere on the stage advances) or 'box' (the talkie only).
//   sound     false to silence the typewriter blips.
//   id        id for the DOM tap zone (default none; the game show uses 'gs-talkie-tap').
//
// Behaviour (NOTES 6.4, 10.2 #52 / #52a):
//   - Typewriter: one character per 40 ms (the original's one per 25 fps frame), counted in
//     engine ticks (chars = floor(age * 15 / 40)), so it is deterministic under manual stepping.
//     With reduced motion the page appears at once.
//   - The first tap / Enter / Space completes the page; the next one advances. The press that
//     advances is consumed inside update(), so the scene never sees it on the same tick.
//   - The "next" arrow blinks only once the page is complete (the original showed it 0.4 s after
//     every line started, while still typing). The placeholder "df" is never shown.
//   - Text size follows settings 'textScale' (Arial 20 at 100%); the layout is redone when it
//     changes. Each page is announced to screen readers through app.announce().
//
// Extra read-only state for scenes and tests: visible, statement (full text of the current
// line), pageText, shown (characters of the page shown), progress (characters of the whole
// statement shown), complete (page fully shown), waiting (a tap would do something),
// lineIndex, pageIndex, pageCount, lines (the laid-out lines of the page), fontSize.
// Also: talkie.hide(), talkie.show(), talkie.state() (a plain snapshot for probes).
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { el } from '../ui/dom.js';
import { loadAtlases, atlasSet, drawStill, hasArt, frameOfTick } from './art.js';
import { wrap, fitLine, ARIAL, roundRect } from './text.js';

const SYMBOL = 'gs_talkie';
// The box's nested arrow clip blinks on its own 10-frame cycle; frame 21 is drawn with the arrow
// showing (atlas y 1810) and frame 10 ('start') without it (atlas y 2101).
const FRAME_ARROW = 21;
const FRAME_PLAIN = 10;
// Talkie-local geometry, measured from the art (clip registration at its top-left corner).
const BOX = { x: -2, y: 27.5, w: 761, h: 114 };          // translucent panel with white border
const SPEAKER = { x: 2, y: 0, w: 191, h: 27.5 };        // blue name box
const TEXT_X = 17;           // statement_text_field left edge (stage 37 at x = 20)
const TEXT_TOP = 49;         // top of the first line; baseline = TEXT_TOP + size
const TEXT_BOTTOM = 137;     // last baseline may sit here
const ARROW = { x: 709, y: 69, w: 28, h: 32 };           // white triangle, x 729-757 on the stage
const TAP_HEIGHT = 143.5;
const CHAR_TICKS_NUM = 3, CHAR_TICKS_DEN = 8;            // 15 / 40
const ENTER_TICKS = 12;      // slide-in when the box appears

export function createTalkie(app, opts = {}) {
  const {
    x = 20, y = 308, width = 667, lines: maxLinesOpt = null,
    speaker = t('gameshow.host'), tapArea = 'stage', sound = true, id = null,
  } = opts;
  const input = app.input;

  let statements = [];
  let lineIndex = -1;
  let pages = [];            // [{ text, start, lines: [{ text, start }] }] for the current statement
  let pageIndex = 0;
  let pageAge = 0;
  let skipped = false;
  let onDone = null;
  let active = false;        // a statement is on screen and not yet dismissed
  let visible = false;
  let visibleAge = 0;
  let tick = 0;
  let tapQueued = false;
  let fontSize = 20;
  let lastBlip = -1;
  let destroyed = false;

  // DOM tap zone (the original's big_invisible_button): transparent, under the scene's own UI.
  const zone = el('div', {
    class: 'gs-talkie-tap', id, role: 'button', 'aria-label': t('gameshow.continue'),
    style: tapArea === 'box'
      ? { position: 'absolute', left: x + 'px', top: y + 'px', width: '762px', height: TAP_HEIGHT + 'px', zIndex: '1', cursor: 'pointer' }
      : { position: 'absolute', left: '0', top: '0', width: '800px', height: '450px', zIndex: '1', cursor: 'pointer' },
  });
  zone.hidden = true;
  zone.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); tapQueued = true; });
  app.ui.prepend(zone);

  // The box art: load the atlas if the scene has not (the cutscene set includes it).
  if (!hasArt(SYMBOL)) loadAtlases(atlasSet('gameshow', ['gameshow-bg', 'gameshow-cast']).filter(id => /bg/.test(id)));

  const onSetting = e => { if (e.detail.key === 'textScale' && active) relayout(); };
  settings.addEventListener('change', onSetting);

  const textScale = () => {
    const s = Number(settings.get('textScale')) || 1;
    return Math.max(0.8, Math.min(2, s));
  };
  const fontFor = size => `${size}px ${ARIAL}`;
  const lineHeight = size => Math.round(size * 1.4);

  // Splits the current statement into pages that fit the box at the current text size.
  function layout(text) {
    fontSize = Math.round(20 * textScale());
    const lh = lineHeight(fontSize);
    const fit = Math.max(1, Math.floor((TEXT_BOTTOM - TEXT_TOP - fontSize) / lh) + 1);
    const per = Math.max(1, Math.min(fit, maxLinesOpt || fit));
    const all = wrap(text, fontFor(fontSize), width);
    const out = [];
    for (let i = 0; i < all.length; i += per) {
      const chunk = all.slice(i, i + per);
      const start = chunk[0].start;
      const last = chunk[chunk.length - 1];
      out.push({ start, end: last.start + last.text.length, lines: chunk });
    }
    if (!out.length) out.push({ start: 0, end: 0, lines: [{ text: '', start: 0 }] });
    for (const p of out) p.text = p.lines.map(l => l.text).join('\n');
    return out;
  }

  function relayout() {
    const prog = api.progress;
    pages = layout(statements[lineIndex]);
    // Keep the reader's place: the page that holds the character reached so far.
    let pi = pages.findIndex(p => prog < p.end || p === pages[pages.length - 1]);
    if (pi < 0) pi = pages.length - 1;
    pageIndex = pi;
    pageAge = Math.ceil(((prog - pages[pi].start) * CHAR_TICKS_DEN) / CHAR_TICKS_NUM);
  }

  function pageLength(p = pages[pageIndex]) { return p ? p.end - p.start : 0; }

  function shownChars() {
    const p = pages[pageIndex];
    if (!p) return 0;
    const n = pageLength(p);
    if (skipped || settings.get('reducedMotion')) return n;
    return Math.min(n, Math.floor((pageAge * CHAR_TICKS_NUM) / CHAR_TICKS_DEN));
  }

  function startPage(i) {
    pageIndex = i;
    pageAge = 0;
    skipped = false;
    lastBlip = -1;
    const p = pages[i];
    if (p && p.text && app.announce) app.announce(p.text.replace(/\n/g, ' '));
  }

  function startLine(i) {
    lineIndex = i;
    pages = layout(statements[i]);
    startPage(0);
  }

  function finish() {
    active = false;
    zone.hidden = true;
    const cb = onDone;
    onDone = null;
    if (cb) cb();
  }

  // One tap: complete the page, else next page, next statement or finish.
  function advance() {
    if (!active) return;
    if (shownChars() < pageLength()) { skipped = true; return; }
    if (pageIndex + 1 < pages.length) { startPage(pageIndex + 1); audio.play('tap', { volume: 0.4 }); return; }
    if (lineIndex + 1 < statements.length) { startLine(lineIndex + 1); audio.play('tap', { volume: 0.4 }); return; }
    audio.play('tap', { volume: 0.4 });
    finish();
  }

  const api = {
    say(list, cb = null) {
      statements = (Array.isArray(list) ? list : [list]).map(s => (s == null ? '' : String(s)));
      onDone = cb;
      if (!visible) { visible = true; visibleAge = 0; }
      if (!statements.length) { active = false; finish(); return api; }
      active = true;
      zone.hidden = false;
      tapQueued = false;
      startLine(0);
      return api;
    },

    update() {
      if (destroyed) return;
      tick++;
      if (visible) visibleAge++;
      if (!active) { tapQueued = false; return; }
      const press = input.pressed('confirm') || input.pressed('jump') || tapQueued;
      tapQueued = false;
      if (press) { advance(); return; }
      pageAge++;
      // Typewriter blips, throttled to every other visible character.
      const n = shownChars();
      if (sound && n > lastBlip && n < pageLength()) {
        const p = pages[pageIndex];
        const ch = statements[lineIndex][p.start + n - 1] || ' ';
        if (n % 2 === 0 && /\S/.test(ch)) audio.play('typeBlip', { volume: 0.35, rate: 0.9 + (n % 5) * 0.04 });
        lastBlip = n;
      }
    },

    render(ctx) {
      if (!visible || destroyed) return;
      const reduce = settings.get('reducedMotion');
      const k = reduce ? 1 : Math.min(1, visibleAge / ENTER_TICKS);
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(x, y + (1 - e) * 18);
      const complete = active && shownChars() >= pageLength();
      const blinkOn = complete && (frameOfTick(tick) % 10) < 6;
      const drawn = drawStill(ctx, SYMBOL, blinkOn && hasArt(SYMBOL) ? FRAME_ARROW : FRAME_PLAIN);
      if (!drawn) drawFallbackBox(ctx, blinkOn);
      // Speaker name (Arial 20, white, in the blue box).
      const name = api.speaker || '';
      if (name) {
        const f = fitLine(name, s => `${s}px ${ARIAL}`, SPEAKER.w - 16, 20, 12);
        ctx.font = `${f.size}px ${ARIAL}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, SPEAKER.x + 9, SPEAKER.y + SPEAKER.h / 2 + 1);
      }
      // Statement text, typed out line by line.
      const p = pages[pageIndex];
      if (p && (active || lineIndex >= 0)) {
        let left = active ? shownChars() : pageLength(p);
        const lh = lineHeight(fontSize);
        ctx.font = fontFor(fontSize);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
        ctx.fillStyle = '#ffffff';
        p.lines.forEach((ln, i) => {
          const rel = ln.start - p.start;
          const n = Math.max(0, Math.min(ln.text.length, left - rel));
          if (n > 0) ctx.fillText(ln.text.slice(0, n), TEXT_X, TEXT_TOP + fontSize + i * lh);
        });
        ctx.shadowColor = 'transparent';
      }
      ctx.restore();
    },

    skip() { advance(); },

    hide() { visible = false; zone.hidden = true; },
    show() { if (!visible) { visible = true; visibleAge = 0; } if (active) zone.hidden = false; },

    destroy() {
      destroyed = true;
      active = false;
      settings.removeEventListener('change', onSetting);
      zone.remove();
    },

    get done() { return !active; },
    get visible() { return visible; },
    get statement() { return lineIndex >= 0 ? statements[lineIndex] || '' : ''; },
    get pageText() { return pages[pageIndex] ? pages[pageIndex].text : ''; },
    get shown() { return shownChars(); },
    get progress() { const p = pages[pageIndex]; return p ? p.start + shownChars() : 0; },
    get complete() { return !active || shownChars() >= pageLength(); },
    get waiting() { return active; },
    get lineIndex() { return lineIndex; },
    get lineCount() { return statements.length; },
    get pageIndex() { return pageIndex; },
    get pageCount() { return pages.length; },
    get lines() { return pages[pageIndex] ? pages[pageIndex].lines.map(l => l.text) : []; },
    get fontSize() { return fontSize; },
    speaker,

    // Plain snapshot for test probes.
    state() {
      return {
        visible, waiting: active, statement: api.statement, pageText: api.pageText, shown: api.shown,
        progress: api.progress, complete: api.complete, lineIndex, lineCount: statements.length,
        pageIndex, pageCount: pages.length, lines: api.lines, fontSize, speaker: api.speaker,
        textWidth: width, arrow: active && shownChars() >= pageLength(),
      };
    },
  };
  return api;
}

// Canvas stand-in for the box art (used until the atlas has loaded).
function drawFallbackBox(ctx, arrow) {
  ctx.save();
  ctx.fillStyle = 'rgba(40, 40, 60, 0.72)';
  ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
  ctx.fillStyle = 'rgba(74, 110, 150, 0.9)';
  roundRect(ctx, SPEAKER.x, SPEAKER.y, SPEAKER.w, SPEAKER.h, 1);
  ctx.fill();
  ctx.stroke();
  if (arrow) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ARROW.x, ARROW.y);
    ctx.lineTo(ARROW.x + ARROW.w, ARROW.y + ARROW.h / 2);
    ctx.lineTo(ARROW.x, ARROW.y + ARROW.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
