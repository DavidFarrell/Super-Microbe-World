// Vector maths with the rounding side effects of ebug.Vector3 (src/ebug/Vector3.as).
// The original's numbers depend on these, so they are reproduced exactly:
// - add() returns the sum rounded to 3 decimal places per component (Vector3.as:24-41; the
//   precision argument is always undefined, so round(NaN) falls back to 3).
// - subtract() and multiply() do not round (Vector3.as:43-49, 164-170).
// - PlatformGame calls position.equals(previousPosition, 1) on every entity after each physics
//   step, which mutates position.x to one decimal place (Vector3.as:55-69, PlatformGame.as:1017).
// Plain {x, y} objects are used; z is always 0 in the platformer.

export const round3 = v => Math.round(v * 1000) / 1000;
export const round1 = v => Math.round(v * 10) / 10;

export const vec = (x = 0, y = 0) => ({ x, y });
export const clone = v => ({ x: v.x, y: v.y });

// Vector3.add: rounded to 0.001.
export const add = (a, b) => ({ x: round3(a.x + b.x), y: round3(a.y + b.y) });
// Vector3.subtract / multiply: unrounded.
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: k * a.x, y: k * a.y });
export const length = a => Math.sqrt(a.x * a.x + a.y * a.y);
