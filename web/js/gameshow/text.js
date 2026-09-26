// Text layout for text drawn inside the original art (talkie, question board, title card).
// Canvas text is drawn at the canvas backing-store resolution (device pixels), so it stays crisp,
// and it moves with the art during animations. Flash used device fonts (Arial in the talkie,
// Verdana on the board, NOTES 8.6); the stacks below fall back to the platform's sans-serif,
// which also covers Greek and Czech.
export const ARIAL = 'Arial, "Liberation Sans", "Helvetica Neue", Helvetica, "DejaVu Sans", sans-serif';
export const VERDANA = 'Verdana, "DejaVu Sans", "Liberation Sans", Geneva, sans-serif';
export const BALOO = 'Baloo, "Trebuchet MS", "Arial Rounded MT Bold", "DejaVu Sans", sans-serif';

let measureCtx = null;
export function measurer() {
  if (!measureCtx) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4, 4) : document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
}

// Word-wraps text to maxWidth with the given CSS font. '\n' forces a break. A word wider than the
// line is split by characters. Returns [{ text, start }] where start is the index of the line's
// first character in the original string (so a typewriter can map characters to lines).
export function wrap(text, font, maxWidth) {
  const ctx = measurer();
  ctx.font = font;
  const out = [];
  const src = String(text);
  let i = 0;
  const paras = src.split('\n');
  for (const para of paras) {
    const base = i;
    if (!para.length) { out.push({ text: '', start: base }); i += 1; continue; }
    // Tokens: words with their following spaces.
    const re = /\S+\s*/g;
    let line = '', lineStart = base, m;
    const leading = /^\s*/.exec(para)[0].length;
    lineStart = base + leading;
    re.lastIndex = leading;
    while ((m = re.exec(para))) {
      const word = m[0];
      const trial = line + word;
      if (!line || ctx.measureText(trial.trimEnd()).width <= maxWidth) {
        if (!line && ctx.measureText(word.trimEnd()).width > maxWidth) {
          // Break an over-long word by characters.
          let chunk = '';
          let chunkStart = base + m.index;
          for (const ch of word) {
            if (chunk && ctx.measureText((chunk + ch).trimEnd()).width > maxWidth) {
              out.push({ text: chunk, start: chunkStart });
              chunkStart += chunk.length;
              chunk = '';
            }
            chunk += ch;
          }
          line = chunk;
          lineStart = chunkStart;
        } else {
          line = trial;
        }
      } else {
        out.push({ text: line.trimEnd(), start: lineStart });
        line = word;
        lineStart = base + m.index;
      }
    }
    out.push({ text: line.trimEnd(), start: lineStart });
    i = base + para.length + 1;
  }
  return out;
}

// Single-line fit: shrinks the size until the text is no wider than maxWidth.
export function fitLine(text, fontFor, maxWidth, size, min) {
  const ctx = measurer();
  for (let s = size; s >= min; s -= 0.5) {
    ctx.font = fontFor(s);
    const w = ctx.measureText(text).width;
    if (w <= maxWidth) return { size: s, width: w, fits: true };
  }
  ctx.font = fontFor(min);
  return { size: min, width: ctx.measureText(text).width, fits: false };
}

export function textWidth(text, font) {
  const ctx = measurer();
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
