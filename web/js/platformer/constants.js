// Constants of the 2009 Flash platform game (src/ebug/Constants.as, Event.as, GameEntity.as,
// PlayerEntity.as, PlatformGame.as and friends under reference/Junior_Game/src/ebug/).
// Pure data: safe to import from node unit tests.

export const TILE = 50;                 // Constants.TILE_WIDTH (Constants.as:22)
export const STAGE_W = 800;             // Constants.as:23-24
export const STAGE_H = 450;

// Timing. The original ran one UPDATE (logic + physics) every two 15 ms main() calls, i.e. about
// every 30 ms (PlatformGame.as:613-616,1163; flash-platformer.md section 1.4). The port runs one
// logic step every two engine ticks (TICK_MS = 15) and interpolates rendering in between.
export const STEP_MS = 30;
export const TICKS_PER_STEP = 2;
export const FRAME_MS = 40;             // Flash timelines play at 25 fps
export const LEVEL_TIME_STEPS = 6000;   // 180 s (PlatformGame.as:148) at 30 ms per step
export const BOMB_FUSE_STEPS = Math.ceil(2000 / STEP_MS); // AntibioticBombEntity.as:33 (2000 ms of getTimer)

// Physics construction (PlatformGame.as:150-153)
export const GRAVITY_Y = 3000;
export const DRAG = 0.95;
export const DELTA_T_MS = 30;           // ParticleSystem timeInterval = 30 / 1000
export const WORLD_MIN_Y = -100;        // PlatformGame.as:260-261
export const WORLD_MAX_Y = 450;

export const PLAYER_BOX = { w: 49, h: 100 };   // forced size (PlatformGame.as:387)
export const BULLET_BOX = { w: 50, h: 25 };    // forced size (PlatformGame.as:689,729)
export const MAX_JUMPS = 2;                    // PlatformGame.MAX_JUMPS
export const SHOOT_POINT = 27;                 // PlayerEntity.SHOOT_POINT
export const PLAYER_LIVES = 3;
export const SAFE_TRAVEL_DISTANCE = 1.5;       // GameEntity.SAFE_TRAVEL_DISTANCE

// Scroll margins in screen x (PlatformGame.as:45-46)
export const SCROLL_MARGIN_LEFT = 250;
export const SCROLL_MARGIN_RIGHT = 450;

// Directions (GameEntity.as:57-58)
export const LEFT = -1;
export const RIGHT = 1;

// Entity type ids (Constants.as:29-58)
export const T = Object.freeze({
  PLAYER: 0, TILE: 1, ERASER: 2, GENERIC: 3, GOOD_MICROBE: 4, BAD_MICROBE: 5, PORTAL_EXIT: 6,
  PORTAL_ENTRANCE: 7, BULLET: 8, AMMO_PICKUP: 9, CAMERA_FLASH: 10, LUCY: 11, SANDY: 12, PATTY: 13,
  STEVE: 14, COLIN: 15, SLARG: 16, SLURM: 17, IGGY: 18, DONNA: 19, MILK: 20, ANTIBIOTIC_PICKUP: 21,
  ANTIBIOTIC_BOMB: 22, SUPERINFECTION: 23,
});
export const TYPE_NAME = Object.freeze(Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k.toLowerCase()])));

export const GOOD_MICROBE_TYPES = [T.GOOD_MICROBE, T.GENERIC, T.SANDY, T.STEVE, T.PATTY];
export const BAD_MICROBE_TYPES = [T.BAD_MICROBE, T.COLIN, T.DONNA, T.IGGY, T.SLARG, T.SLURM];

// GameEntity states (GameEntity.as:67-90). Bespoke states are 100+ and are namespaced per class.
export const S = Object.freeze({
  DEFAULT: 0, TURN: 1, DYNAMIC: 4, IDLE: 5, BE_LIFTED: 6, SLIDE: 7, FALL: 8, BE_PHOTOGRAPHED: 9,
  BE_KILLED: 10, WALK: 11, JUMP_START: 12, JUMP_MID: 13, JUMP_END: 14, BE_FROZEN: 15,
  BE_WASHED_AWAY: 16, MUNCH: 17, RUN: 18, DIVE: 19, STARE: 20, FLICK_HEAD: 21, BE_HIT: 22, IGNORE: 23,
});

// Event types (Event.as). The original reused 50/51 for portal, milk and bad-microbe events as
// well as PLAYER_ACCELERATE/DECELERATE (flash-platformer.md section 1.7, bug 26). The port gives
// each its own id; the numeric values of the shared ones are otherwise unchanged.
export const E = Object.freeze({
  THINK: 0, IDLE: 1, LAND: 2, BE_HURT: 3, BE_KILLED: 4, SLIDE: 5, BE_PHOTOGRAPHED: 6, BE_LIFTED: 7,
  COLLIDE: 8, WALK: 9, FALL: 10, REMOVE: 11, CREATE_SOAP_BULLET: 12, CREATE_WHITE_BULLET: 13,
  CREATE_CAMERA_FLASH: 14, MODIFY_POINTS: 15, MODIFY_GOAL_STATUS: 16, MILK_GLASS_EVENT_TURN_TO_YOGURT: 17,
  PICKUP_ANTIBIOTIC: 18, CREATE_ANTIBIOTIC: 19, EXPLODE_ANTIBIOTIC: 20,
  PLAYER_ACCELERATE: 50, PLAYER_DECELERATE: 51, PLAYER_JUMP_START: 58, PLAYER_KEY_RELEASED_JUMP: 64,
  PLAYER_KEY_PRESSED_FIRE: 65, PLAYER_KEY_RELEASED_FIRE: 66, PLAYER_KEY_PRESSED_ALT_FIRE: 67,
  PLAYER_KEY_RELEASED_ALT_FIRE: 68,
  TRIGGER_LEVEL_END: 900, TRIGGER_GAME_END: 901,
  // Namespaced replacements for the clashing bespoke ids (originally 50 / 51 / 50 / 51).
  PORTAL_OPEN: 1050, PORTAL_CLOSE: 1051, MILK_GLASS_HIT: 1150, BAD_MICROBE_WASH_AWAY: 1251,
});

// Goal types (Goal.as:15-22)
export const G = Object.freeze({
  PHOTOGRAPH_SPECIFIC: 0, PHOTOGRAPH_GOOD: 1, PHOTOGRAPH_BAD: 2, PHOTOGRAPH_ANY: 3, KILL_ALL: 4,
  KILL_SPECIFIC: 5, ANTIBIOTIC: 6, YOGURT: 7,
});

// Level end reasons (PlatformGame.as:56-58)
export const END = Object.freeze({ TIME: 0, DIE: 1, COMPLETE: 2 });

// Scoring (flash-platformer.md section 3.10)
export const POINTS = Object.freeze({
  PICKUP: 7, KILL_BAD: 5, KILL_GOOD: -10, PHOTO_GOOD: 5, PHOTO_BAD: 15, MILK_HIT: 10, YOGURT: 50,
  ANTIBIOTIC_GOOD: -10, ANTIBIOTIC_BAD: 15, ANTIBIOTIC_SUPER: 30,
});
