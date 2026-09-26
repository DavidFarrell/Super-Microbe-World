// The kitchen avatar's `upper` timeline (movies/kitchen_game_main.swf sprite 169 inside `harry`;
// Amy's sprite 612 has the same labels, NOTES 5.12). It drives game logic (the midAnimation flag
// that ends hand washing, KitchenGame.as:161-167) so it is kept here as fixed data: the timing is
// then the same for both children and does not depend on the art having loaded. Frame scripts as
// decoded into web/data/atlas/kitchen-harry.json.
export const AVATAR_TIMELINE = {
  frameCount: 600,
  labels: {
    stop: 1, idle: 10, fridge: 47, cupboard: 85, bin: 130, bowl: 165, cling_film_start: 205, cling_film_mid: 235,
    cling_film_end: 285, sneeze_Start: 335, sneeze_mid: 360, sneeze_tissue_end: 390, sneeze_food_end: 440,
    window: 530, wash_hands: 565,
  },
  scripts: {
    1: [['stop'], ['set', 'midAnimation', false]],
    10: [['set', 'midAnimation', false]],
    30: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    47: [['set', 'midAnimation', true]],
    60: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    85: [['set', 'midAnimation', true]],
    97: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    130: [['set', 'midAnimation', true]],
    142: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    165: [['set', 'midAnimation', true]],
    177: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    205: [['set', 'midAnimation', true]],
    217: [['set', 'midAnimation', false], ['gotoAndPlay', 'cling_film_mid']],
    235: [['set', 'midAnimation', false]],
    255: [['set', 'midAnimation', false], ['gotoAndPlay', 'cling_film_mid']],
    285: [['set', 'midAnimation', true]],
    297: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    335: [['set', 'midAnimation', true]],
    347: [['set', 'midAnimation', false], ['gotoAndPlay', 'sneeze_mid']],
    360: [['set', 'midAnimation', false]],
    379: [['set', 'midAnimation', false], ['gotoAndPlay', 'sneeze_mid']],
    390: [['set', 'midAnimation', true]],
    406: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    440: [['set', 'midAnimation', true]],
    456: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    530: [['set', 'midAnimation', true]],
    543: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
    565: [['set', 'midAnimation', true]],
    600: [['set', 'midAnimation', false], ['gotoAndPlay', 'idle']],
  },
};
// (Harry's decoded frame 47 lacks the midAnimation = true that Amy's has; it only matters to
// wash_hands, whose frames 565-600 are identical in both, so Amy's fuller set is used.)

// The sink (sink_area, 50 frames: tab_stop 1, tab_wash_hand 10). The original never played it
// (only the avatar's wash_hands); the port runs it while washing, as juice.
export const SINK_TIMELINE = {
  frameCount: 50,
  labels: { tab_stop: 1, tab_wash_hand: 10 },
  scripts: {
    1: [['stop'], ['set', 'midAnimation', false]],
    10: [['set', 'midAnimation', true]],
    50: [['set', 'midAnimation', false], ['gotoAndPlay', 'tab_stop']],
  },
};
