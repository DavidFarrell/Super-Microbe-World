# Requests from the kitchen area

Changes the kitchen area needs in files it does not own. Each entry: file, change, reason. The
kitchen works around each one meanwhile.

## 1. `web/precache.json` / `web/sw.js`: include the new kitchen modules

- **Change**: re-run `tools/build-precache.mjs` so the offline precache lists the new files
  `web/js/kitchen/{rules,layout,timeline,art,draw,controls,sounds,kitchenScene}.js` and the
  updated `web/data/lang/en/kitchen.json` (the kitchen area was told not to run it).
- **Reason**: without them the kitchen scene cannot load offline.
- **Workaround**: none needed online.

## 2. `web/js/core/settings.js`: optional remappable kitchen actions

- **Change**: add three actions to `DEFAULT_KEYS` (and `ACTIONS` in `web/js/core/input.js`), for
  example `tissues: ['KeyT', 'Digit1']`, `clingfilm: ['KeyC', 'Digit2']`, `wash: ['KeyH', 'Digit3']`,
  and matching gamepad buttons if wanted.
- **Reason**: the kitchen's dedicated keys (tissues, cling film, hand washing) cannot be remapped
  in Settings today. `Space` and `ArrowUp` share the `jump` action and `Tab` is `phone`, so the
  kitchen reads those keys itself too.
- **Workaround**: `web/js/kitchen/controls.js` listens for `KeyT` / `KeyC` / `KeyH`, `Digit1-3`,
  `Enter`, `Space`, `Tab` and `Backspace` directly (queued and processed per tick, so runs stay
  deterministic). Arrow keys and WASD come from the remappable `left` / `right` / `up` / `down`
  actions, `Esc` from `pause`.

## 3. `web/NOTES.md`: merge the kitchen decisions

- **Change**: merge `web/NOTES-kitchen-decisions.md` into section 5 / 10.3 (the kitchen rows of
  10.3 can move from **Planned** / open to **Fixed**: shared `FoodItem` state, cling film
  overlays, BOWL "Bad Food" repeat, four reminder slots, clock 99, misleading reminders for bad
  food, avatar, raw-meat hands (decision #13), level 4 intro text (decision #12)). Two small
  additions found while porting: the 2 s sneeze interval could outlive the end of the level and
  restart play (`KitchenGame.as:548,602-611` vs `:148-151`; the port cancels it), and the port
  adds a fourth outro page from the original's unused "Points Awarded" / "Points Deducted" /
  "Total Points" strings.
- **Reason**: the orchestrator owns `web/NOTES.md`.
