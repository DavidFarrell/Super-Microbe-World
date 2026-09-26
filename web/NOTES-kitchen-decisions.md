# Kitchen game port: decisions, fixes and fidelity notes

Scope: the kitchen game of round 4 ("Food Hygiene"), scene `kitchen` in `web/js/kitchen/`, ported
from `reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as` and `FoodItem.as` following
`web/NOTES.md` section 5 (cited as "NOTES 5.x") and the resolved decisions in NOTES 11.9. Merged
into `web/NOTES.md` (5.13 and 10.3, cited there as [KD]), which is the entry point. Everything not
listed here behaves as the original did.

## Module layout

| File | Role |
|---|---|
| `rules.js` | Pure rules: the 26-entry food table (`KitchenGame.as:1234-1285`), category arrays (`:1288-1324`), level table, `drawLevelFood` (`:906-1075`), per-draw item state, the sneeze roll, `judge` / `scoreLevel` / `reportOf` (`calculateScores`, `:353-543`). No DOM, clock or audio. |
| `layout.js` | Stage layout: background, counter, sink, avatar and item-box positions; the 27 rest points (NOTES 5.4 table); the fit formula (`:696-727`); the port's touch/keyboard targets and spatial navigation. |
| `timeline.js` | The avatar `upper` timeline (labels and frame scripts, NOTES 5.12) and the sink timeline, as fixed data. |
| `art.js` | Loads the kitchen atlas set from `web/data/atlas/index.json` and draws symbols, including the avatars' cut-out rigs (`mode: "rig"`, which `platformer/sprites.js` does not draw); a small Flash timeline player (`Clip`). |
| `draw.js` | Food, background, counter and sink drawing with clean placeholders when an atlas is missing; feedback marks, germs, hand badge, bubbles, glows. |
| `controls.js` | The location-based input layer: DOM targets in the scaled `#ui` layer; taps, drags, hover and keys are queued and drained by the scene each tick. |
| `sounds.js` | Synthesised effects (`audio.defineSynth`) and the `kitchenGame` music loop (`defineTrack`). |
| `kitchenScene.js` | Scene `kitchen`: loading, intro screens and tutorial, play (the `main()` state machine on the frame clock), outro pages, pause, standalone chaining, juice, `__test` probe `kitchen`. |

Strings: `web/data/lang/en/kitchen.json` (namespace `kitchen`). Tests: `web/tests/kitchen.spec.mjs`
and `web/tests/kitchen-controls.spec.mjs`.

## Contract (web/js/flow/contract.md)

- Params `{ level: 0..3, avatar, score, seed, onComplete, onQuit }`. One scene visit is one level:
  intro screens, play, outro. `score` in is the running kitchen total; `result.score` is the new
  total (`score + points`), as the flow's request asks (`web/requests/flow.md` item 4).
- `result = { level, score, points, report, rows, notes, awarded, deducted, reason, placed, items }`.
  `report` has one entry per placement in order: `{ item (asset), name, location, ok, reason,
  hygiene, clingfilm, points }`; `ok` is `true` / `false`, or `null` for mouldy or burst food in the
  bin (the original counts it neither way, `:382-384`); `reason` is the admonishment key the
  placement raised (`badFood`, `clingfilm`, `fruitLocation`, ...).
- `seed` seeds `gameRng` on entry (as the platform scene does), so the food list and the sneeze
  rolls of a level replay exactly.
- Without `onComplete` (`?scene=kitchen&level=N`), the scene carries on to the next level like
  `nextLevel()` (`:813-872`) and ends on a card back to the main menu after level 3.
- Kitchen points are shown (outro page 4) and passed back (decision 11.9 #4); the winner is decided
  elsewhere.

## Timing (NOTES 12.1, kitchen rows)

- Play time runs on the 25 fps frame clock derived from the engine's 15 ms ticks,
  `frame = floor(playTicks * 3 / 8)`, counted only while playing (not in intros, outros or pause).
  One `main()` frame per clock frame.
- A game second is exactly 25 frames (the original's `getTimer() - timer > 1000` polled every
  40 ms made each "second" about 1040 ms, `:145`). The clock starts at 60 (120 in level 3), counts
  down once a second, and the level ends when it would pass 0, as `timeLeft < 0` did
  (`:146-151`): 61 seconds of play for a 60 s level. After a time-out the outro follows at the
  next second tick, as in the original (`:168-177`). **Port change** when every item is placed
  (`pickItem` `:781-782` sets `END_OF_LEVEL`): the outro waits for the first second tick at least
  40 ticks (0.6 s) after the last placement (`BANNER_MIN`), so the last item lands and the "All put
  away!" banner can be read; it appears 0.6 to 1.6 s after the last placement instead of 0 to 1 s.
  The clock stops meanwhile, and nothing is scored after `END_OF_LEVEL`, so results are unchanged.
- The sneeze window is 50 frames (`setInterval(makeSneeze, 2000)`, `:548`). Because the window and
  the seconds share one clock, a sneeze always ends on a second boundary; the second is handled
  first in that frame (no roll while sneezing), then the window, so a new sneeze never starts in
  the frame the last one ended. (In the original the two clocks drifted, so the order varied.)
- Hand washing lasts until the avatar's `wash_hands` animation clears `midAnimation` (frames
  565-600) and then the next second tick (`:161-167`): 1.4 to 2.4 s, as built.
- The bin fades its item by 5 % alpha per frame (`removeBinItem`, `:621-629`), 20 frames.
- The avatar's timeline (labels and frame scripts) is fixed data in `timeline.js`, so game timing
  never depends on whether the art loaded, and is the same for both children. Harry's decoded
  frame 47 lacks the `midAnimation = true` that Amy's has; only `wash_hands` (identical in both)
  affects play, so Amy's fuller script set is used.
- Randomness: the food draw (`Math.round(Math.random() * high)` then
  `Math.round(Math.random() * (len - 1))`, `:915-1069`) and the sneeze roll
  (`GeneralFunctions.getRandom(0, 10)`, `util/GeneralFunctions.as:3-4`) use `gameRng`, in the
  original order. All juice uses `fxRng` or no randomness.

## Fixes (NOTES 5.13 and 11.9)

| Original | Source | Port |
|---|---|---|
| Kitchen avatar always Harry (throwaway `Player`) | `KitchenGame.swf` frame 1; `:1105-1109` | The chosen child (`params.avatar`), with its own atlas (`kitchen-harry` / `kitchen-amy`). The intro screens, which were a JPEG with Amy whatever the choice, are drawn from the live kitchen with the chosen child, dimmed (11.9 fix of the avatar). |
| `FoodItem` objects shared, never cloned: flags leak between twins and levels | `:784`; `FoodItem.as:48-55` | Every draw is a new item with its own state (`makeItem`); a new level draws new items. |
| Cling film overlays left in the fridge between levels | `:820-823` | Nothing carries over: each level (one scene visit) starts with an empty kitchen. |
| Raw meat on the hands: wrong index and property, no effect | `:685-689` | Decision #13: placing raw meat contaminates the hands until they are washed; every other item placed meanwhile (except into the bin) carries raw-meat microbes and raises the "Raw Meat Hands" reminder (the original's unused string, `:1185`). No points change, like the sneeze reminder. A red-germ hand badge shows while the hands are dirty. |
| "Bad Food" could repeat in the BOWL case (`badFood` not set) | `:396-398` | Every reminder is raised once per level. |
| Only four reminder slots on the "Microbial Mistakes" page | outro frame 30; `:340-342` | All reminders are listed: more than six use a compact layout (all twelve possible reminders fit at the default text size), and a list that still overflows (larger text sizes) scrolls with a fade at the bottom until its end; an empty page says "No microbial mistakes this time. Well done!" (new string). |
| Level 4 intro says "45 seconds"; the code gives 120 | `:844-848`; intro level 3 | Decision #12: 120 s kept; the intro says "You have 120 seconds this time." |
| Clock shows 99 for a second at time out; malformed `</face>` | `:151,180` | The clock shows 0. |
| Mouldy or burst items in a wrong place get their category's location reminder | `:552-600` | They get "Bad Food" or "Burst Container" instead (`judge` checks mouldy/burst before the location rules). |
| The 2 s sneeze interval outlives the end of the level and can set the state back to WAIT (time out during a sneeze would restart play at 99 s) | `:548,602-611` vs `:148-151` | The sneeze is cancelled when the level ends. |
| One-second tick is 1040 ms | `:145` | Exact 25-frame seconds (NOTES 12.1). |

## Kept as built

- Level parameters: 10 / 10 / 10 / 20 items, 60 / 60 / 60 / 120 s, category weights and item
  draws with replacement (NOTES 5.2, 5.3). No sneezes in level 0 (`sneezeChance` undefined there);
  from level 1, a roll once a second in WAIT with `sneezeChance` 7, +1 after each sneeze: 1/4,
  3/20, 1/20, then never (at most three per level).
- Sneeze handling (`:632-639`, `:602-619`): during the 2 s window the tissues catch it (the hands
  get sneeze microbes: "infect hand with sneeze microbes"); any other input, or the window running
  out, sneezes on the item on the counter (and the hands). A placement during the window does not
  place the item. The tissues do nothing outside a sneeze (a small shrug in the port).
- Hands to food on every placement (`:680-684`): sneeze microbes move to the placed item and the
  hands are clean again ("limit spread to just one item").
- The "Sneeze" reminder is raised for any sneeze-contaminated item, including the tissue case,
  whose better-fitting "Sneeze Hands" string the original never used. `rules.js` has
  `SNEEZE_HANDS_NOTE = false`; set it to `true` to use "Sneeze Hands" for items contaminated by
  hands after a tissue (the port tracks `sneezeFrom`).
- Cling film can be put on any item (no avatar animation, `:764-770`); only meat needs it.
- Scoring (NOTES 5.9) walks locations 0-7 and items in placement order; points per level are
  `10 x (correct - incorrect)`; bad food in the bin counts nothing; unplaced items cost nothing.
  The outro's three pages keep their titles and rows ("Shopping Placed Correctly", "Items Placed
  Incorrectly" with sums written `- N`, "Microbial Mistakes").
- Rest point fit (`:696-727`): scale by width if the item is wider than tall, else by height,
  bottom-aligned in the box. Checked against the clean standalone captures (`608`: broccoli in
  the drawer 25 x 21 at (488.5, 223.4), yogurt in the door 40.6 x 47 at (609.7, 104.4); `640`:
  lamb on the middle shelf 45 x 21, bottom 167.6). The main playthrough's odd sizes (`154`, `162`:
  a 63 x 130 milk carton, a 66-wide cheese, top-aligned items) come from clicks that arrived
  while the original was not in `STATE_WAIT` (flash-ruffle.md 6.4) and are not reproduced.
- Depths: background, rest points, avatar, counter (with the sink), then the item on the counter
  on top (`:1111-1112,1137`).

## Port changes (input, presentation)

- **Location-based input** (NOTES 5.4 "Port (touch)"). The 27 rest points become eight location
  targets (cupboard, bowl, top / middle / bottom shelf, drawers, door, bin); a placement fills the
  location's next free slot, and when all are full it reuses the oldest (the original replaced the
  item shown in the clicked slot; every placement still counts). The tissues, cling film, sink and
  the item on the counter are targets too. Every target is at least 56 stage px in both
  directions, i.e. 44 CSS px down to a stage scale of 0.79 (a 640 x 360 landscape phone; checked
  by both specs). The fridge's four bands share the fridge column and are stretched to its top
  frame and body: top 38-112, middle 112-168, bottom 168-224, drawers 224-300. The middle/bottom
  boundary is the shelf in the art (y 168); the middle band takes the bottom 6 px of the top
  shelf's art and the bottom band the top 12 px of the drawers'. Highlights follow the shelves'
  art.
- Ways to place: tap (or click) a place directly, as the original's click did; or tap the item to
  pick it up (the places light up), then tap a place; or drag the item onto a place (mouse or
  finger; a drop elsewhere puts it back). Keyboard: Tab / Shift+Tab and the arrow keys move
  between targets (spatially), Enter or Space picks up and puts away (Enter on a place puts the
  item there directly), T tissues, C cling film, H wash hands (also 1, 2, 3; all three remappable
  in Settings as the tissues, cling film and wash actions), Backspace puts a
  lifted item back, Esc pauses. Gamepad: d-pad to choose, A to pick up and put away (and for the
  intro, outro and pause buttons), B tissues (or, with an item lifted, puts it back), X cling
  film, Y wash hands, Start pause. A control legend shows on keyboard and gamepad devices; it
  names the pause, move and tool keys as bound in Settings (`keyFor`, "Arrows" while the arrows
  are first), while Tab and Enter stay literal because `controls.js` reads them directly. The
  tool keys are the `tissues`, `clingfilm` and `wash` actions (`core/settings.js` `DEFAULT_KEYS`,
  defaults T / C / H and 1 / 2 / 3; added when the areas were joined, `web/requests/kitchen.md`
  #2): `controls.js` still queues the raw key events per tick (runs stay deterministic) and maps a
  code to its tool through the live bindings; during play a key bound to a tool takes that tool
  even if it is also Enter, Space or Backspace (the player's own choice wins), elsewhere the fixed
  meaning applies. In Settings the tools share a group with the arrows, confirm, back and pause, so
  one key is never bound to two of them. The HUD bubbles name the key or button too: "Tissue! (T)" /
  "Tissue! (B)", "Wash (H)" / "Wash (Y)", and just "Tissue!" / "Wash" on touch. Touch: a pause
  button.
- A sneeze drops a lifted item (the player needs their hands); picking up is ignored during a
  sneeze and while washing.
- Intro screens: the 2009 texts (NOTES 5.11) as the SWFs set them: white Verdana Bold 20 (23 for
  "Wrong! Try again."), centred, every line the same colour and size, "Level N" included (NOTES
  8.6; the port uses the Verdana stack the other areas use, `Verdana, "DejaVu Sans", ...`). Each
  line starts at the top of its original text field (`text0`..`text11`, DefineEditText rectangles
  of `kitchen_game_intro_level_N.swf`, e.g. level 0 `text0` at y 63.75 and `text1` at 158.9, the
  wrong page's lines at 54.95 / 204.2 / 256.75); a line that wraps further (larger text sizes)
  pushes the following ones down instead of overlapping them. Fields are widened by up to 40 px a
  side about their centre, because the browser's stand-in for Verdana Bold can run a little wider
  than Flash's; "Level N"'s 84 px field is widened about its centre (x 393). A faint text shadow
  (0 1px 2px, 35 % black) is the only addition. The backdrop is the live kitchen with the chosen
  child at 30 % over dark grey (`rgba(51,51,51,0.7)` on top; the SWFs' background cxform is alpha
  77/256 and the grey is the stage behind, sampled from captures 600 and 607). A blue button
  ("Next", "Start" on the last screen) stands where the original's "Click" button was. The
  sentences that name a control use the input in use: touch reads the 2009 wording with "tap";
  keyboard (which also covers the mouse) keeps "click" and adds the key, e.g. "click on the tissues
  (or press T)", "Click on the cling film (or press C)", "Click the button (or press Enter)", with
  the tool keys filled from the bindings (`{key_tissues}`, `{key_clingfilm}`);
  gamepad names the buttons, e.g. "press B for the tissues", "Press A when ready to start"
  (`kitchen.intro.N.K.keyboard` / `.gamepad` variants of intro 0.8, 0.ready, 1.8, 1.9 and 2.5; the
  rest of the 2009 wording is unchanged). Level 0's tutorial keeps the original logic (the drawer
  is right; the cupboard, bowl, shelves, door and bin are wrong; "Wrong! Try again." repeats the
  two rules) with a short hint line for how to answer, per device.
- Outro: the three original pages on the white panel, in the outro SWF's fonts (NOTES 8.6,
  `kitchen_game_outro.swf`): titles Verdana Bold 20, rows Verdana 20 with bold "X" and "=",
  reminders Verdana 16. The reminders start just under the title, as `text1`..`text4` do (y 63.9,
  71 px apart); up to four sit on those 71 px slots. Then a new fourth page, "Points This Level"
  (new string), using the original's unused "Points Awarded", "Points Deducted" and "Total Points"
  strings (`:1173-1177`): awarded and deducted side by side, the level's total large, then the
  running kitchen score, in one column so larger text sizes push the blocks down rather than
  overlap (the 30 to 56 px numerals keep their size; the labels scale). Only non-zero values are
  coloured (green right, red wrong), on every page.
  Page 1 throws a little confetti from the panel's top corners when the level scored points (kept
  clear of the rows).
- HUD additions: an items-put-away counter (a tick glyph and "n of N") beside the clock, a
  dirty-hands badge (green germs: sneeze, red: raw meat) with a "Wash" hint and a pulse on the
  sink, and a sneeze warning: an "Ah... ah..." bubble by the avatar, the tissues glowing, and above
  the tissue box a ring counting down the two-second window under a "Tissue!" bubble (the ring
  used to sit under the bubble, hidden). Hover highlights stop once the level has ended.
- Immediate feedback (the original only showed results in the outro): a tick or cross and +10 /
  -10 where the item lands, a chime or a soft "uh-oh", a small shake on a mistake; bad food in the
  bin gets a tick and "Binned". Germs orbit sneezed-on or meat-contaminated items.
- Juice: items hop out of the shopping bag onto the counter and arc into place; a lifted item
  bobs with a shadow; cling film shimmers; the sink runs (its unused `tab_wash_hand` animation) with
  bubbles; the clock (Verdana Bold 20, `#20648c`, as `KitchenGame.as:180` sets it) turns red and
  pulses with a tick in the last ten seconds; "All put away!" / "Time's up!" banner. Reduced
  motion (read every tick, so switching it in pause > Settings takes effect at once) removes the
  particle effects (sneeze spray, tissue puff, cling film stars, landing bursts, bin dust, arrival
  puff, confetti, bubbles) and the movement, and keeps the popups, marks and sounds.
- Text size (Settings): every kitchen DOM text scales with `--text-scale`, the pause card
  included; the canvas HUD (clock, items pill, bubbles, popups) scales with `textScale`; bubbles
  stay on the stage.
- Pause: available on the intro, tutorial, play and outro. "Restart level" from play starts the
  level again at once; from the intro or the tutorial it shows the intro screens (and level 0's
  tutorial) again; it is not offered on the outro, where it would throw the finished result away.
  A switch of input device while paused (a phone with a Bluetooth keyboard, a touchscreen laptop)
  updates the prompts, hint and legend on resume; in the tutorial only the hint changes (a lifted
  spring onion stays lifted).
- Sound (the original was silent): synthesised fridge door, cupboard, bowl, bin, cling film,
  water, sneeze build-up, sneeze, tissue, right, wrong, germs, pop and page effects; music track
  `kitchenGame` (a jaunty 1950s-kitchen loop).

## Verification

`web/tests/kitchen.spec.mjs` (run with `node web/tests/run.mjs --no-unit kitchen`):
- the draw weights of `Math.round` (exact category and in-category weights);
- a touch run (Pixel 7 landscape, Amy) and a keyboard run (desktop, Harry) through all four levels
  chained through `onComplete`, every item correct, sneezes caught with the tissues, hands washed
  after a tissue and after raw meat, meat covered; checks the outro rows and notes, points, the
  running score and every report entry;
- deliberate mistakes (level 4, seed 185) scored against the spec file's own reading of NOTES 5.9
  (points, rows, notes and their order, "Bad Food" once, "Burst Container" not "Liquids", raw-meat
  hands, a sneeze landing on food, more than four reminders listed);
- exact timing (a second is 67 ticks the first time, the sneeze window 50 frames, washing, time
  out after 61 s with the clock at 0 and the outro a second later), pause freezing the clock;
- drag and drop with a mouse and a finger; tap-target sizes at 915 x 412 and 667 x 375; the touch
  pause button; standalone chaining and arrow-key navigation.

`web/tests/kitchen-controls.spec.mjs` (`node web/tests/run.mjs --no-unit kitchen-controls`):
- intro lines at the SWF field tops in white Verdana Bold 20 (23 on the wrong page), "Level 2"
  like the others, and the dim measured on the canvas (0.3 x lit + 0.7 x 51, within 8);
- a gamepad alone (a `navigator.getGamepads` stub): intro, tutorial (wrong then right), play,
  Start to pause, A on Resume and on Restart not also acting on the kitchen or the outro, the
  outro paged with A
  into the next level, and A / B / X / Y / Start / D-pad in the texts, hint, legend and bubbles;
- keyboard wording ("or press T", "or press Enter"), then a switch to touch on the pause card:
  the intro says "tap" and play drops the legend after Resume;
- Restart from the intro and the tutorial (intro page 1 again) and from play (play at once);
  reduced motion switched on mid-level (no particles after a placement);
- remapped keys (WASD, P) in the hint and legend; at 130 % text a long reminders list starts under
  the title, scrolls, and keeps the page on Space; the points page's blocks do not overlap and
  clear the button;
- every target at least 44 CSS px at 640 x 360.

## Review fixes (second review)

| Finding | Fix | Source |
|---|---|---|
| Clock and intro text in the port's UI fonts and colours | Clock Verdana Bold 20 `#20648c` (red pulse in the last ten seconds kept, logged above); intro lines white Verdana Bold 20, "Wrong!" 23, no per-line colour or size | NOTES 8.6; `KitchenGame.as:180`; intro SWF DefineEditText |
| Intro backdrop darker than the original | `rgba(51,51,51,0.70)` over the kitchen (30 % picture over #333) | captures 600 / 607; SWF cxform alpha 77 |
| Intro lines spread evenly | Lines start at their text fields' tops | `kitchen_game_intro_level_N.swf` text0..text11 |
| Reminders centred in the panel | Start under the title; up to four on the 71 px slots | outro frame 30, text1..text4 |
| `BANNER_MIN` contradicted the timing note | Kept as a deliberate change; the timing note above now says so | `KitchenGame.as:168-177, 781-782` |
| Gamepad stuck on intro and outro pages; keyboard or touch wording for gamepads | A clicks the focused button; a card button pressed with A no longer also acts on the page it brings back; gamepad strings, hint, legend and bubbles | `web/js/ui/prompts.js` names |
| Device switch while paused left stale prompts | Device check after the pause card, so resume sees the change | |
| Restart skipped the intro and tutorial; offered on the outro | Restart replays the intro and tutorial when paused there; not offered on the outro | |
| Reduced motion read only at level start; particles ignored it | Read every tick; particle effects skipped | |
| Points page cramped at 130 % text; pause card and HUD ignored text size | Points page in one column; card fonts and canvas HUD scale | |
| Legend hard-coded Esc and Arrows | Pause and move keys from Settings (`keyFor`) | |
| Space on the reminders list turned the page | Space, Enter and the arrows scroll the list natively while it has the focus; the arrows and d-pad also scroll it from the button | |
| Focus ring low contrast on the fridge | Two-tone ring: 8 px dark (`#1b1640`) under 4 px cyan | |
| Keyboard players told to "click" | Keyboard and gamepad variants of the five intro sentences that name a control | |
| Fridge shelves under 44 CSS px at 640 x 360 | 56 px bands meeting at the art's shelf (the reviewer's 60 px bands would have put the top/middle boundary 20 px above the top shelf's floor, so taps on the lower half of a top-shelf item would have gone to the middle shelf) | `layout.js` |

Also found while fixing: a touch-to-keyboard switch on an intro page ate the first Enter (the page
was rebuilt and focused its button in the same tick; the key is now judged by where the focus was
when it went down), and the pause card's arrow and gamepad navigation kept running under the
flow's settings overlay (now paused while that overlay is open).
