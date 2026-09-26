// Reference drawing code for smw-atlas/1 symbols, including cut-out rigs (dev-only, but written
// to be copied into the engine as is: plain ES module, Canvas 2D, no dependencies).
//
//   import { drawAtlasFrame, frameFor } from './atlas-draw.js';
//   drawAtlasFrame(ctx, sym, images, frame)   // draws Flash frame `frame` (1-based) of `sym` with
//                                            // its registration point at ctx's current origin
//
// sym is one entry of <atlas>.json "symbols"; images are that atlas's decoded pages. Units are
// Flash pixels (the 800 x 450 stage): set the canvas transform for zoom and position first.
// A rig symbol ("mode": "rig", see tools/swf-sheet/rig.mjs) draws its pose for the frame; frames
// the rig does not cover fall back to the ordinary image frames (label starts), and an ordinary
// symbol falls back to the nearest earlier drawn frame, as web/js/platformer/sprites.js does.

// Draws one atlas rectangle [image, x, y, w, h, originX, originY] at scale `scale`.
function drawRect(ctx, images, r, scale) {
  const [img, x, y, w, h, ox, oy] = r, k = 1 / scale;
  ctx.drawImage(images[img], x, y, w, h, -ox * k, -oy * k, w * k, h * k);
}

// Returns true when something was drawn.
export function drawAtlasFrame(ctx, sym, images, frame, { lo = 1 } = {}) {
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
    return true;
  }
  for (let f = frame; f >= lo; f--) {
    const r = sym.frames[f - 1];
    if (r) { drawRect(ctx, images, r, sym.scale); return true; }
  }
  return false;
}

// Frame number for a label plus an offset (0-based), e.g. frameFor(sym, 'idle', 3).
export function frameFor(sym, label, offset = 0) {
  const start = sym.labels && sym.labels[label];
  return start ? start + offset : 1 + offset;
}
