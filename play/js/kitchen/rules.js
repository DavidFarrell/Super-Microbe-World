// Kitchen game rules: the food table, the level draws and the scoring, ported from
// reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as and FoodItem.as (NOTES section 5).
// Pure and deterministic: no DOM, audio or clocks, so tests and bots can reason about it. The
// scene (kitchenScene.js) owns timing, input and drawing.

// FoodItem.as:12-21
export const TYPE = { FRUIT: 0, VEGETABLES: 1, CUPBOARD: 4, CHEESE: 5, DOOR: 6, RAW_MEAT: 7, COOKED_MEAT: 9 };

// KitchenGame.as:97-104 (also the order calculateScores walks the locations in)
export const LOC = { CUPBOARD: 0, BOWL: 1, FRIDGE_UPPER: 2, FRIDGE_MID: 3, FRIDGE_LOWER: 4, FRIDGE_DRAWER: 5, FRIDGE_DOOR: 6, BIN: 7 };
export const LOC_NAMES = ['cupboard', 'bowl', 'fridgeUpper', 'fridgeMid', 'fridgeLower', 'fridgeDrawer', 'fridgeDoor', 'bin'];

// allPossibleFood in order (KitchenGame.as:1234-1285). Two entries share each of "Apple" (red and
// green art) and "Orange Juice" (the same art twice, index 9 and 22).
export const FOODS = [
  { name: 'Mouldy Bread', asset: 'mouldy_bread', type: TYPE.CUPBOARD, mouldy: true },
  { name: 'Burst Yogurt', asset: 'burst_yogurt', type: TYPE.DOOR, burst: true },
  { name: 'Carrots', asset: 'carrots', type: TYPE.VEGETABLES },
  { name: 'Tomatoes', asset: 'tomatoes', type: TYPE.VEGETABLES },
  { name: 'Orange', asset: 'orange', type: TYPE.FRUIT },
  { name: 'Bananas', asset: 'bananas', type: TYPE.FRUIT },
  { name: 'Mouldy Orange', asset: 'mouldy_orange', type: TYPE.FRUIT, mouldy: true },
  { name: 'Yogurt', asset: 'yogurt', type: TYPE.DOOR },
  { name: 'Cheese', asset: 'cheese', type: TYPE.CHEESE },
  { name: 'Orange Juice', asset: 'orange_juice', type: TYPE.DOOR },
  { name: 'Apple', asset: 'red_apple', type: TYPE.FRUIT },
  { name: 'Raw Lamb', asset: 'raw_lamb', type: TYPE.RAW_MEAT },
  { name: 'Raw Chicken', asset: 'raw_chicken', type: TYPE.RAW_MEAT },
  { name: 'Raw Sausages', asset: 'raw_sausages', type: TYPE.RAW_MEAT },
  { name: 'Raw Steak', asset: 'raw_steak', type: TYPE.RAW_MEAT },
  { name: 'Cooked Steak', asset: 'cooked_steak', type: TYPE.COOKED_MEAT },
  { name: 'Cooked Lamb', asset: 'cooked_lamb', type: TYPE.COOKED_MEAT },
  { name: 'Cooked Chicken', asset: 'cooked_chicken', type: TYPE.COOKED_MEAT },
  { name: 'Apple', asset: 'green_apple', type: TYPE.FRUIT },
  { name: 'Pear', asset: 'pear', type: TYPE.FRUIT },
  { name: 'Milk', asset: 'milk', type: TYPE.DOOR },
  { name: 'Soup', asset: 'soup', type: TYPE.CUPBOARD },
  { name: 'Orange Juice', asset: 'orange_juice', type: TYPE.DOOR },
  { name: 'Broccoli', asset: 'broccoli', type: TYPE.VEGETABLES },
  { name: 'Bread', asset: 'bread', type: TYPE.CUPBOARD },
  { name: 'Spring Onion', asset: 'spring_onion', type: TYPE.VEGETABLES },
];

// Frame-1 sizes of the food symbols in stage px (flash-swf-assets.md 5.7), used to fit an item
// into a rest point exactly as the original measured content._width / _height.
export const FOOD_SIZE = {
  yogurt: [37.85, 43.8], tomatoes: [66.7, 29.45], mouldy_bread: [83.75, 60.65], burst_yogurt: [50.6, 51.2],
  carrots: [66.35, 36.8], orange: [34.5, 34.45], bananas: [65, 67.2], mouldy_orange: [34.5, 34.45],
  cheese: [53.75, 34.1], orange_juice: [35.7, 64.55], red_apple: [35.9, 40.8], raw_lamb: [63.4, 29.5],
  cooked_lamb: [63.95, 29.5], green_apple: [35.9, 40.85], pear: [33.7, 58.95], milk: [35.6, 64.5],
  soup: [40.15, 65.65], raw_chicken: [55.85, 38.75], broccoli: [66.1, 54.9], cooked_chicken: [55.85, 38.75],
  raw_sausages: [61.65, 42.05], raw_steak: [48.05, 28.3], cooked_steak: [48.05, 28.3], spring_onion: [72.35, 36.8],
  bread: [83.75, 60.6],
};

// Category arrays, built by type in table order (KitchenGame.as:1288-1324), in the order
// prepareLevelFood numbers the categories: 0 veg, 1 door, 2 fruit, 3 cupboard, 4 raw meat,
// 5 cheese, 6 cooked meat (:906-1075).
const byType = type => FOODS.map((f, i) => (f.type === type ? i : -1)).filter(i => i >= 0);
export const CATEGORIES = [
  byType(TYPE.VEGETABLES), byType(TYPE.DOOR), byType(TYPE.FRUIT), byType(TYPE.CUPBOARD),
  byType(TYPE.RAW_MEAT), byType(TYPE.CHEESE), byType(TYPE.COOKED_MEAT),
];

// Per level: items, highest category number, seconds (KitchenGame.as:844-848, 906-1075), and
// sneezes from level 1 on with sneezeChance 7 (:857-860).
export const LEVELS = [
  { items: 10, high: 1, seconds: 60, sneezes: false },
  { items: 10, high: 3, seconds: 60, sneezes: true },
  { items: 10, high: 6, seconds: 60, sneezes: true },
  { items: 20, high: 6, seconds: 120, sneezes: true },
];
export const SNEEZE_CHANCE_START = 7;

// Draws a level's food list with replacement, exactly as prepareLevelFood():
//   category = Math.round(Math.random() * high); index = Math.round(Math.random() * (len - 1))
// Math.round gives the two end values half the weight of the others (NOTES 5.2, 5.3).
export function drawLevelFood(level, rng) {
  const spec = LEVELS[level];
  const list = [];
  for (let i = 0; i < spec.items; i++) {
    const category = Math.round(rng.next() * spec.high);
    const arr = CATEGORIES[category];
    list.push(arr[Math.round(rng.next() * (arr.length - 1))]);
  }
  return list;
}

// One drawn item with its own state (the original shared one FoodItem per food and never
// cloned it, so flags leaked between twins and levels: NOTES 5.13, fixed).
export function makeItem(foodIndex, uid) {
  const f = FOODS[foodIndex];
  return {
    uid, food: foodIndex, asset: f.asset, name: f.name, type: f.type,
    mouldy: !!f.mouldy, burst: !!f.burst,
    clingfilm: false,
    sneeze: false,          // FOOD_STATE_SNEEZE_MICROBES
    sneezeFrom: null,       // 'food' (sneezed on while on the counter) or 'hands' (after a tissue)
    meatHands: false,       // contaminated by raw-meat hands (decision #13)
  };
}

// The sneeze roll, GeneralFunctions.getRandom(0, 10) > sneezeChance (KitchenGame.as:155-157).
export const sneezeRoll = rng => Math.round(rng.next() * 10);

// Location reminder per food type (addFoodLocationAdmonishments, KitchenGame.as:552-600).
export const LOCATION_NOTE = {
  [TYPE.CHEESE]: 'cheeseLocation', [TYPE.COOKED_MEAT]: 'cookedMeatLocation', [TYPE.CUPBOARD]: 'cupboardItemsLocation',
  [TYPE.DOOR]: 'liquidsLocation', [TYPE.FRUIT]: 'fruitLocation', [TYPE.RAW_MEAT]: 'rawMeatLocation',
  [TYPE.VEGETABLES]: 'vegetablesLocation',
};

// The outro rows in order: Fruit, Vegetables, Cupboard Items, Cheese, Raw Meat, Cooked Meat,
// Liquids (showOutroAchievements, KitchenGame.as:228-261).
export const ROWS = [
  { type: TYPE.FRUIT, key: 'fruit' }, { type: TYPE.VEGETABLES, key: 'vegetables' },
  { type: TYPE.CUPBOARD, key: 'cupboardItems' }, { type: TYPE.CHEESE, key: 'cheese' },
  { type: TYPE.RAW_MEAT, key: 'rawMeat' }, { type: TYPE.COOKED_MEAT, key: 'cookedMeat' },
  { type: TYPE.DOOR, key: 'liquids' },
];

// Where an item belongs (for hints, bots and the report), as the scoring below accepts it.
export function correctLocations(item) {
  if (item.mouldy || item.burst) return [LOC.BIN];
  switch (item.type) {
    case TYPE.FRUIT: return [LOC.BOWL];
    case TYPE.VEGETABLES: return [LOC.FRIDGE_DRAWER];
    case TYPE.CUPBOARD: return [LOC.CUPBOARD];
    case TYPE.DOOR: return [LOC.FRIDGE_DOOR];
    case TYPE.RAW_MEAT: return [LOC.FRIDGE_LOWER];
    case TYPE.CHEESE: case TYPE.COOKED_MEAT: return [LOC.FRIDGE_UPPER, LOC.FRIDGE_MID];
    default: return [];
  }
}

// Judges one placement as calculateScores() does (KitchenGame.as:380-524):
//   verdict 'correct' | 'incorrect' | 'neutral' (bad food in the bin counts nothing either way)
//   note    the admonishment key it raises, or null
// Fixes (NOTES 5.13): a mouldy or burst item anywhere but the bin gets "Bad Food" / "Burst
// Container" instead of its category's location reminder.
export function judge(item, loc) {
  const locationNote = LOCATION_NOTE[item.type];
  if (loc === LOC.BIN) {
    if (item.mouldy || item.burst) return { verdict: 'neutral', note: null };
    return { verdict: 'incorrect', note: locationNote };
  }
  if (item.mouldy) return { verdict: 'incorrect', note: 'badFood' };
  if (item.burst) return { verdict: 'incorrect', note: 'burstContainer' };
  switch (loc) {
    case LOC.BOWL:
      return item.type === TYPE.FRUIT ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: locationNote };
    case LOC.CUPBOARD:
      return item.type === TYPE.CUPBOARD ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: locationNote };
    case LOC.FRIDGE_DOOR:
      return item.type === TYPE.DOOR ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: locationNote };
    case LOC.FRIDGE_DRAWER:
      return item.type === TYPE.VEGETABLES ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: locationNote };
    case LOC.FRIDGE_LOWER:
      if (item.type !== TYPE.RAW_MEAT) return { verdict: 'incorrect', note: locationNote };
      return item.clingfilm ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: 'clingfilm' };
    case LOC.FRIDGE_MID:
    case LOC.FRIDGE_UPPER:
      if (item.type === TYPE.CHEESE) return { verdict: 'correct', note: null };
      if (item.type !== TYPE.COOKED_MEAT) return { verdict: 'incorrect', note: locationNote };
      return item.clingfilm ? { verdict: 'correct', note: null } : { verdict: 'incorrect', note: 'clingfilm' };
    default:
      return { verdict: 'incorrect', note: locationNote };
  }
}

// Hygiene notes an item carries whatever its location: the sneeze (as built, any location,
// KitchenGame.as:373-378) and raw-meat hands (decision #13; not for binned items, which are
// thrown away). SNEEZE_HANDS_NOTE: false keeps the original's "Sneeze" text for an item
// contaminated by hands after a tissue; true would use the unused "Sneeze Hands" string instead.
export const SNEEZE_HANDS_NOTE = false;
export function hygieneNotes(item, loc) {
  const notes = [];
  if (item.sneeze) notes.push(SNEEZE_HANDS_NOTE && item.sneezeFrom === 'hands' ? 'sneezeHands' : 'sneeze');
  if (item.meatHands && loc !== LOC.BIN) notes.push('rawMeatHands');
  return notes;
}

// Scores a level from its placements [{ item, loc }] in placement order, walking locations in id
// order and items in placement order like calculateScores(). Every admonishment is raised once
// per level (the original's BOWL "Bad Food" could repeat: fixed, NOTES 5.13).
export function scoreLevel(placements) {
  const counts = {};
  for (const r of ROWS) counts[r.type] = { correct: 0, incorrect: 0 };
  const notes = [];
  const seen = new Set();
  const add = key => { if (key && !seen.has(key)) { seen.add(key); notes.push(key); } };
  for (let loc = 0; loc < LOC_NAMES.length; loc++) {
    for (const p of placements) {
      if (p.loc !== loc) continue;
      for (const n of hygieneNotes(p.item, loc)) add(n);
      const { verdict, note } = judge(p.item, loc);
      if (verdict === 'correct') counts[p.item.type].correct++;
      else if (verdict === 'incorrect') counts[p.item.type].incorrect++;
      add(note);
    }
  }
  const rows = ROWS.map(r => ({ key: r.key, type: r.type, correct: counts[r.type].correct, incorrect: counts[r.type].incorrect }));
  const awarded = rows.reduce((n, r) => n + r.correct * 10, 0);
  const deducted = rows.reduce((n, r) => n + r.incorrect * 10, 0);
  return { rows, notes, awarded, deducted, points: awarded - deducted };
}

// The per-placement report passed back to the flow: [{ item, ok, reason, ... }] in placement
// order; ok is null for bad food binned (neither right nor wrong in the original's scoring).
export function reportOf(placements) {
  return placements.map(p => {
    const { verdict, note } = judge(p.item, p.loc);
    return {
      item: p.item.asset, name: p.item.name, location: LOC_NAMES[p.loc],
      ok: verdict === 'correct' ? true : verdict === 'incorrect' ? false : null,
      reason: note, hygiene: hygieneNotes(p.item, p.loc),
      clingfilm: p.item.clingfilm, points: verdict === 'correct' ? 10 : verdict === 'incorrect' ? -10 : 0,
    };
  });
}
