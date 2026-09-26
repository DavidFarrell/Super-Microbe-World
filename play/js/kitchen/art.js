// Kitchen art: loads the kitchen atlas set from web/data/atlas/index.json and draws
// "smw-atlas/1" symbols, including the avatars' cut-out rigs (mode "rig"), which the platformer's
// sprites.js does not draw (formula in the header of tools/build-atlas.cjs). Units are Flash stage
// pixels. Every call is safe while an atlas is missing: draw() returns false and the scene paints
// a clean placeholder, so the game stays playable (and testable) without art.
import { sprites, drawable } from '../platformer/sprites.js';

// The atlases load through sprites.js, the one atlas store (memoised per atlas, failures not
// kept, released between screens by the flow), so this module only draws.
const symbols = sprites.symbols;   // symbol -> { sym, images, atlas }

// The kitchen set minus the other child's avatar atlas (index.json "sets": kitchen,
// kitchen-harry, kitchen-amy). Ids are read from the index, never hard-coded, so an art update
// that moves symbols between atlases needs no code change. Resolves when every load settled.
export function kitchenAtlases(index, avatar) {
  const sets = (index && index.sets) || {};
  const other = avatar === 'amy' ? 'harry' : 'amy';
  const skip = new Set(sets['kitchen-' + other] || []);
  const mine = new Set(sets['kitchen-' + avatar] || []);
  return [...new Set([...(sets.kitchen || []), ...mine])].filter(id => !skip.has(id) || mine.has(id));
}

export async function loadKitchenArt(avatar, onProgress = () => {}) {
  const index = await sprites.ensureIndex();
  if (!index) return false;
  const ids = kitchenAtlases(index, avatar);
  let done = 0;
  onProgress(0);
  const ok = await Promise.all(ids.map(id => sprites.loadAtlas(id).then(r => { onProgress(++done / Math.max(1, ids.length)); return r; })));
  return ok.every(Boolean);
}

export const has = name => symbols.has(name);
export const symbol = name => (symbols.has(name) ? symbols.get(name).sym : null);

function drawRect(ctx, images, r, scale) {
  const [img, x, y, w, h, ox, oy] = r, k = 1 / scale;
  const page = images[img];
  if (drawable(page)) ctx.drawImage(page, x, y, w, h, -ox * k, -oy * k, w * k, h * k);
}

// Draws Flash frame `frame` (1-based) of a symbol with its registration point at (x, y).
// opts: alpha, scale (uniform, about the registration point), sx/sy (non-uniform).
export function draw(ctx, name, frame, x, y, { alpha = 1, scale = 1, sx = scale, sy = scale } = {}) {
  const e = symbols.get(name);
  if (!e || alpha <= 0) return false;
  const { sym, images } = e;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  let drawn = false;
  const rig = sym.rig;
  const p = rig ? rig.frames[frame - 1] : null;
  if (p != null) {
    const pose = rig.poses[p];
    for (let i = 0; i < pose.length; i += 7) {
      const part = rig.parts[pose[i]];
      ctx.save();
      ctx.transform(pose[i + 1], pose[i + 2], pose[i + 3], pose[i + 4], pose[i + 5], pose[i + 6]);
      drawRect(ctx, images, part, part[7]);
      ctx.restore();
    }
    drawn = true;
  } else {
    // A null frame falls back to the nearest earlier drawn frame (atlas contract).
    for (let f = Math.min(frame, sym.frames.length); f >= 1; f--) {
      const r = sym.frames[f - 1];
      if (r) { drawRect(ctx, images, r, sym.scale || 1); drawn = true; break; }
    }
  }
  ctx.restore();
  return drawn;
}

// Matrix of a named child on a frame (atlas "tracks"), or null.
export function track(name, key, frame = 1) {
  const s = symbol(name);
  const t = s && s.tracks && s.tracks[key];
  return t ? t[Math.max(0, Math.min(t.length - 1, frame - 1))] : null;
}

// A Flash timeline driven by the atlas labels and decoded frame scripts (stop, play, set,
// gotoAndPlay, gotoAndStop), advanced one 25 fps frame per tick(). Used for the kitchen avatar
// (its midAnimation flag gates hand washing, KitchenGame.as:161-167) and the sink.
export class Clip {
  // def: { frameCount, labels, scripts } to drive the timeline from fixed data (so game logic does
  // not depend on the art having loaded); default: the atlas symbol's own.
  constructor(name, def = null) {
    this.name = name;
    this.def = def;
    this.frame = 1;
    this.playing = true;
    this.vars = { midAnimation: false };
    this.label = null;
    this._run(1);
  }

  get timeline() { return this.def || symbol(this.name); }
  get midAnimation() { return !!this.vars.midAnimation; }
  get frameCount() { const s = this.timeline; return s ? s.frameCount || (s.frames ? s.frames.length : 1) : 1; }
  labelFrame(label) { const s = this.timeline; return s && s.labels ? s.labels[label] : undefined; }

  gotoAndPlay(label) { this._goto(label, true); }
  gotoAndStop(label) { this._goto(label, false); }

  _goto(label, play, depth = 0) {
    const f = typeof label === 'number' ? label : this.labelFrame(label);
    if (f == null) return;
    this.playing = play;
    if (typeof label === 'string') this.label = label;
    this.frame = f;
    this._run(f, depth + 1);
  }

  tick() {
    if (!this.playing) return;
    const n = this.frameCount;
    this.frame = this.frame >= n ? 1 : this.frame + 1;
    this._run(this.frame);
  }

  _run(frame, depth = 0) {
    const s = this.timeline;
    const ops = s && s.scripts && s.scripts[frame];
    if (!ops || depth > 4) return;
    for (const op of ops) {
      if (op[0] === 'stop') this.playing = false;
      else if (op[0] === 'play') this.playing = true;
      else if (op[0] === 'set') this.vars[op[1]] = op[2];
      else if (op[0] === 'gotoAndPlay' || op[0] === 'gotoAndStop') { this._goto(op[1], op[0] === 'gotoAndPlay', depth); return; }
    }
  }

  draw(ctx, x, y, opts) { return draw(ctx, this.name, this.frame, x, y, opts); }
}

// 25 fps frame clock from engine ticks: frame = floor(ticks * 15 / 40) (NOTES 12.1).
export const framesAt = ticks => Math.floor((ticks * 3) / 8);
