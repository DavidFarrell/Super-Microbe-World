// Kitchen screen layout in stage coordinates (800 x 450), from movies/kitchen_game_main.swf and
// KitchenGame.as (NOTES 5.4), plus the port's touch/keyboard targets.
import { LOC } from './rules.js';

// kitchen_bg and kitchen_counter (export kitchen_fg) are both placed at (400.05, 219.05) on the
// root timeline (root bounds -58.9, -17.15, 901 x 486.3 = both symbols' bounds at that point).
export const BG_POS = { x: 400.05, y: 219.05 };
export const COUNTER_POS = { x: 400.05, y: 219.05 };
// Counter children (atlas tracks of kitchen_counter): sink_area (-126.45, -44.4), tissues
// (-394.7, -8.3), clingfilm (-195.85, -7.8); stage points in NOTES 5.4.
export const SINK_POS = { x: 273.6, y: 174.65 };
// Avatar: attachMovie("harry" | "amy", "avatar", ..., { _x: 65.5, _y: 8.7 }) (KitchenGame.as:1106-1108).
export const AVATAR_POS = { x: 65.5, y: 8.7 };
// Current item: food_throw_area.foodContainer, a 90 x 90 box; the item is bottom-right aligned
// inside it (pickItem, KitchenGame.as:780-800).
export const FOOD_BOX = { x: 120.3, y: 171.5, w: 90, h: 90 };
// Clock text field (Verdana Bold 20, #20648c, centred) at (669.95, 5.9), 110 x 35.
export const CLOCK = { x: 669.95, y: 5.9, w: 110, h: 35 };

// The 27 rest points (NOTES 5.4 table): box top-left and size (30 x the instance scale).
const RP = (name, loc, x, y, w, h = w) => ({ name, loc, x, y, w, h });
export const REST_POINTS = [
  RP('restpointCupboardTopLeft', LOC.CUPBOARD, 263.2, 28.9, 28),
  RP('restpointCupboardTopRight', LOC.CUPBOARD, 295.1, 28.9, 28),
  RP('restpointCupboardMidLeft', LOC.CUPBOARD, 263.2, 63.6, 28),
  RP('restpointCupboardMidRight', LOC.CUPBOARD, 295.1, 63.6, 28),
  RP('restpointCupboardBottomLeft', LOC.CUPBOARD, 264.7, 94.85, 25),
  RP('restpointCupboardBottomRight', LOC.CUPBOARD, 296.6, 94.85, 25),
  RP('restpointFruitBowlMid', LOC.BOWL, 390.75, 170.1, 24, 23),
  RP('restpointFruitBowlLeft', LOC.BOWL, 410.25, 169.15, 23, 22),
  RP('restpointFruitBowlRight', LOC.BOWL, 370.4, 165.8, 23, 22),
  RP('restpointFruitBowlTop', LOC.BOWL, 383.5, 152.85, 23, 22),
  RP('restpointFridgeTopLeft', LOC.FRIDGE_UPPER, 479.9, 72.85, 45),
  RP('restpointFridgeTopRight', LOC.FRIDGE_UPPER, 528.2, 73.35, 45),
  RP('restpointFridgeMidLeft', LOC.FRIDGE_MID, 478.4, 122.65, 45),
  RP('restpointFridgeMidRight', LOC.FRIDGE_MID, 527.5, 123.65, 45),
  RP('restpointFridgeBottomLeft', LOC.FRIDGE_LOWER, 480.7, 171.2, 40),
  RP('restpointFridgeBottomRight', LOC.FRIDGE_LOWER, 529, 171.2, 40),
  RP('restpointFridgeBoxLeftBack', LOC.FRIDGE_DRAWER, 488.5, 219.2, 25),
  RP('restpointFridgeBoxRightBack', LOC.FRIDGE_DRAWER, 537.5, 219.2, 25),
  RP('restpointFridgeBoxLeftFrontLeft', LOC.FRIDGE_DRAWER, 475, 235.45, 25, 24),
  RP('restpointFridgeBoxRightFrontLeft', LOC.FRIDGE_DRAWER, 527.55, 235.45, 25, 24),
  RP('restpointFridgeBoxLeftFrontRight', LOC.FRIDGE_DRAWER, 501.5, 234.35, 25),
  RP('restpointFridgeBoxRightFrontRight', LOC.FRIDGE_DRAWER, 554.15, 234.35, 25),
  RP('restpointFridgeSideTopBack', LOC.FRIDGE_DOOR, 609.65, 104.35, 42, 47),
  RP('restpointFridgeSideTopFront', LOC.FRIDGE_DOOR, 651.9, 106.85, 41, 47),
  RP('restpointFridgeSideBottomBack', LOC.FRIDGE_DOOR, 646.95, 201.45, 40, 44),
  RP('restpointFridgeSideBottomFront', LOC.FRIDGE_DOOR, 603.45, 191.15, 40, 44),
  RP('restpointBin', LOC.BIN, 713.8, 331.2, 64, 69),
];
// Slots per location in fill order (the port fills the next free slot of the tapped location;
// the original let the player pick the slot, NOTES 5.4 "Port (touch)").
export const SLOTS_BY_LOC = Object.values(LOC).map(loc => REST_POINTS.filter(r => r.loc === loc));

// Fits an item of frame-1 size (w, h) into a rest point box, as receiveInput did
// (KitchenGame.as:696-727): scale by width when the item is wider than tall, else by height,
// then bottom-align in the box.
export function fitInBox(box, w, h) {
  const scale = w > h ? box.w / w : box.h / h;
  return { x: box.x, y: box.y + box.h - h * scale, scale, w: w * scale, h: h * scale };
}

// Touch and keyboard targets. `hit` is the tap/drop area (at least 53 stage px each way, which is
// 44 CSS px at the smallest common landscape phone scale of about 0.83); `glow` is the art the
// highlight follows. The four fridge bands share the fridge column, stretched to the fridge's top
// frame and body so each band is tall enough.
const R = (x, y, w, h) => ({ x, y, w, h });
export const TARGETS = [
  { id: 'item', kind: 'item', hit: R(104, 160, 100, 106), glow: null },
  { id: 'tissues', kind: 'tissues', hit: R(0, 204, 100, 66), glow: R(8, 210, 88, 58) },
  { id: 'clingfilm', kind: 'clingfilm', hit: R(204, 204, 68, 60), glow: R(206, 210, 62, 46) },
  { id: 'sink', kind: 'sink', hit: R(272, 210, 154, 58), glow: R(276, 214, 146, 50) },
  { id: 'bowl', kind: 'loc', loc: LOC.BOWL, hit: R(356, 132, 88, 76), glow: R(360, 148, 80, 70) },
  { id: 'cupboard', kind: 'loc', loc: LOC.CUPBOARD, hit: R(246, 10, 172, 118), glow: R(252, 24, 80, 100) },
  { id: 'fridgeUpper', kind: 'loc', loc: LOC.FRIDGE_UPPER, hit: R(460, 38, 132, 78), glow: R(474, 64, 104, 54) },
  { id: 'fridgeMid', kind: 'loc', loc: LOC.FRIDGE_MID, hit: R(460, 116, 132, 53), glow: R(474, 118, 104, 50) },
  { id: 'fridgeLower', kind: 'loc', loc: LOC.FRIDGE_LOWER, hit: R(460, 169, 132, 53), glow: R(474, 168, 104, 44) },
  { id: 'fridgeDrawer', kind: 'loc', loc: LOC.FRIDGE_DRAWER, hit: R(460, 222, 132, 78), glow: R(474, 212, 104, 50) },
  { id: 'fridgeDoor', kind: 'loc', loc: LOC.FRIDGE_DOOR, hit: R(594, 44, 106, 246), glow: R(600, 96, 98, 156) },
  { id: 'bin', kind: 'loc', loc: LOC.BIN, hit: R(702, 262, 98, 188), glow: R(708, 268, 88, 132) },
];
export const TARGET = Object.fromEntries(TARGETS.map(t => [t.id, t]));
export const LOC_TARGET = Object.fromEntries(TARGETS.filter(t => t.kind === 'loc').map(t => [t.loc, t]));
// Keyboard cycle order (Tab): the item, the counter tools left to right, then the destinations.
export const TAB_ORDER = ['item', 'tissues', 'clingfilm', 'sink', 'bowl', 'cupboard', 'fridgeUpper', 'fridgeMid', 'fridgeLower', 'fridgeDrawer', 'fridgeDoor', 'bin'];
export const DEST_ORDER = TAB_ORDER.filter(id => TARGET[id].kind === 'loc');

export const centre = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// The target under a stage point (destinations win over the counter tools where they touch).
export function targetAt(x, y, { destinationsOnly = false } = {}) {
  for (const t of TARGETS) {
    if (destinationsOnly && t.kind !== 'loc') continue;
    if (inside(t.hit, x, y)) return t;
  }
  return null;
}

// Spatial keyboard navigation: the nearest target in a direction (dx, dy one of -1, 0, 1), scored
// by distance with a penalty for sideways offset.
export function neighbour(fromId, dx, dy, ids) {
  const from = centre(TARGET[fromId].hit);
  let best = null, bestScore = Infinity;
  for (const id of ids) {
    if (id === fromId) continue;
    const c = centre(TARGET[id].hit);
    const ax = c.x - from.x, ay = c.y - from.y;
    const along = ax * dx + ay * dy;
    if (along <= 4) continue;
    const across = Math.abs(ax * dy) + Math.abs(ay * dx);
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}
