# Requests from the kitchen area

Changes the kitchen area needed in files it did not own. Each entry: file, change, reason, and how
it was resolved when the areas were joined (all items are done).

## [Done] 1. `web/precache.json` / `web/sw.js`: include the new kitchen modules

- **Change**: re-run `tools/build-precache.mjs` so the offline precache lists the new files
  `web/js/kitchen/{rules,layout,timeline,art,draw,controls,sounds,kitchenScene}.js`, the
  updated `web/data/lang/en/kitchen.json` and the kitchen atlases
  `web/data/atlas/{kitchen,kitchen-harry,kitchen-amy}{.json,-0.webp}` (none of them is in
  `web/precache.json` as of 16:50; the kitchen area was told not to run the tool).
- **Reason**: without them the kitchen scene cannot load offline.
- **Workaround**: none needed online.
- **Resolution (integration, 2026-09-26)**: done. `tools/build-precache.mjs` was re-run after all the integration changes: the kitchen modules and strings are in the install list and the kitchen atlases in the lazy list (cached on first use, like every atlas outside level 1). The tool now also skips Markdown files (these request notes and `js/flow/contract.md`), which the game never loads.

## [Done] 2. `web/js/core/settings.js`: optional remappable kitchen actions

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
- **Resolution (integration, 2026-09-26)**: done (simple and safe: queued per tick as before, defaults unchanged). `DEFAULT_KEYS` and `CLASSIC_KEYS` gain `tissues: ['KeyT', 'Digit1', 'Numpad1']`, `clingfilm: ['KeyC', 'Digit2', 'Numpad2']`, `wash: ['KeyH', 'Digit3', 'Numpad3']`; `core/input.js` `ACTIONS` and `ui/prompts.js` list them (so Settings > Controls shows three "Kitchen:" rows and `{key_tissues}` / `{key_clingfilm}` / `{key_wash}` fill prompts). A fourth remapping group (the tools with the arrows, confirm, back and pause) keeps one key from meaning two kitchen things. `kitchen/controls.js` still queues raw key events per tick and maps a code to its tool through the live bindings (`toolForCode`); during play a key bound to a tool takes it even if it is also Enter, Space or Backspace. The intro sentences, the legend and the HUD bubbles name the bound keys. No gamepad change (B / X / Y already work). Tested by `integration.spec` (tissues on Y and wash on G: intro, bubbles, legend, H no longer washes, G does) and the existing kitchen specs with the defaults.

## [Done] 3. `web/NOTES.md`: merge the kitchen decisions

- **Change**: merge `web/NOTES-kitchen-decisions.md` into section 5 / 10.3 (the kitchen rows of
  10.3 can move from **Planned** / open to **Fixed**: shared `FoodItem` state, cling film
  overlays, BOWL "Bad Food" repeat, four reminder slots, clock 99, misleading reminders for bad
  food, avatar, raw-meat hands (decision #13), level 4 intro text (decision #12)). Two small
  additions found while porting: the 2 s sneeze interval could outlive the end of the level and
  restart play (`KitchenGame.as:548,602-611` vs `:148-151`; the port cancels it), and the port
  adds a fourth outro page from the original's unused "Points Awarded" / "Points Deducted" /
  "Total Points" strings.
- **Reason**: the orchestrator owns `web/NOTES.md`.
- **Resolution (integration, 2026-09-26)**: done. `web/NOTES.md` 5.13 and 10.3 mark every kitchen row as built (10.3 is now a table, #67-#82, with `KitchenGame.as` citations), including the two additions: the sneeze interval outliving the level (#76) and the fourth outro page from the unused points strings (#81). Section 14 points to `web/NOTES-kitchen-decisions.md`.
