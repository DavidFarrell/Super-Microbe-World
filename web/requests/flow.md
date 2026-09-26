# Requests from the flow area

Changes the flow area needed in files it did not own. Each entry: file, change, reason, and how it
was resolved when the areas were joined (all items are done).

## [Done] 1. `web/js/core/i18n.js`: keep the chosen language active when it has no UI tables

- **Change**: in `loadLanguage(code)`, set `active = code` whenever `code` is listed in the
  manifest, even if `loadTable(code)` returned `null` (every key then falls back to English
  through `t()`), and only fall back to `'en'` for unknown codes. `language()` should return the
  chosen code.
- **Reason**: only English UI tables exist (NOTES 7.1), so today `loadLanguage('fr_fr')` leaves
  `language()` at `'en'`, and any area that picks `web/data/quiz/<code>.json` by `language()`
  shows English quiz text to a French player. The quiz and the host's introduction exist in all
  11 languages.
- **Workaround**: the flow reads `settings.get('language')` (then `?lang=`) directly for
  `web/data/quiz/<code>.json`, and exports `quizLanguage()` from `web/js/flow/flow.js` for other
  areas.
- **Resolution (integration, 2026-09-26)**: done. `loadLanguage(code)` keeps any language listed in the manifest active (`language()` returns it) and falls back to `'en'` only for unknown codes; `t()` falls back to English key by key. `web/js/flow/flow.js` now also calls `loadLanguage()` for every `?lang=` code (it did only for `en`), so the URL's language is active from the first boot and `<html lang>` follows it. `quizLanguage()` still reads the setting, so the right quiz file is chosen even before `loadLanguage()` has finished.

## [Done] 2. `web/js/core/i18n.js`: do not request string files that do not exist

- **Change**: for a language other than `en`, skip the per-namespace fetches when the manifest
  says the language has none (for example a `"tables": { "en": ["common", "platform", ...] }`
  entry in `web/data/lang/manifest.json`, which the flow area would then maintain), or load a
  single optional bundle.
- **Reason**: choosing any of the 10 other languages makes six requests that all return 404
  (`data/lang/<code>.json` and `data/lang/<code>/<namespace>.json`). Browsers log each one as a
  console error, and `web/tests/run.mjs` counts every HTTP 4xx as a test error, so no end-to-end
  test can switch language.
- **Workaround**: the flow's tests stay in English; the language chooser is exercised without
  applying a non-English choice.
- **Resolution (integration, 2026-09-26)**: done. `web/data/lang/manifest.json` has `uiTables: ["en"]` and `loadTable()` makes no requests for a language outside it, so choosing any of the other 10 languages causes no 404s (release builds load one bundle per language).

## [Done] 3. Game show area (`web/js/gameshow/gameshowScene.js`): new parameters

See `web/js/flow/contract.md` ("Game show parameters"). The flow passes:
`blind` (true: the blind half only, ending with "Step right this way ..."), `stepRight` (true: end
the sighted half with "Step right this way ..." because a shrink follows), `cpuName` (the other
child) and `seed` (the run seed for the CPU's answers). `nickname` is never empty.
- **Resolution (integration, 2026-09-26)**: done. The game show takes `blind`, `stepRight`, `cpuName` and `seed` as `web/js/flow/contract.md` describes (`web/NOTES-gameshow-decisions.md` port decisions 8 and 12); covered by `gameshow.spec` and `flow.spec`.

## [Done] 4. Kitchen area (`web/js/kitchen/kitchenScene.js`): score semantics

`score` in is the running kitchen total for the journey; `result.score` should be the new
running total (as the platform scene does with hoverboard points). The flow also passes `seed`.
- **Resolution (integration, 2026-09-26)**: done. `score` in is the running kitchen total and `result.score` the new total (`score + points`); the scene seeds `gameRng` with `seed` (`web/NOTES-kitchen-decisions.md` "Contract").

## [Done] 5. Platform area (`web/js/platformer/platformScene.js`): optional

- Pause menu: a "Settings" button that calls `openSettings(app, { onClose })` from
  `web/js/flow/settings.js` (the overlay keeps the pause state), and a "Level select" button that
  calls `app.flow.openLevelSelect()` (NOTES 11.1 #3 lists the pause menu as an entry point).
- Probe: add `avatar` to `probe()` so tests can confirm the chosen child reached the level (the
  flow's own probe records the params it passed meanwhile).
- **Resolution (integration, 2026-09-26)**: done. The pause card has a new row with **Settings** (`openSettings(app, { onClose })`: the level stays paused, the card's own arrow navigation and Tab trap are off while the panel is open, and the card is built again on close with the focus on Settings, so its sound and motion toggles show any change made in the panel) and **Level select** (`app.flow.openLevelSelect()`; a journey is saved at the start of every step, so Continue resumes the level). `update()` ignores input while `app.flow.overlayOpen`. The `platform` probe reports `avatar` (also while loading). Tested by `integration.spec` (44 CSS px targets on a 667 x 375 phone, the panel over the paused level, focus back on Settings, Resume, Level select, the probe's avatar).

## [Done] 6. Art (`web/data/atlas/splash*`, tools/swf-sheet/jobs/flow.json): branding check

- **Change**: in `splash_studio` (splash.swf sprite 58, depths 72-398, frame 120), check the grey
  spiky smiley face at the top left of the TV picture (about stage (125, 120)) and the blue
  smiley on the host's podium (about (255, 277)). Both look like the e-Bug mascot; if they are,
  erase them in the render job as was done for the studio sign (`erase` on shape 36).
- **Reason**: NOTES 11.2 (no e-Bug marks in the hosted build).
- **Workaround**: the splash covers the podium smiley with the same "?" medallion the game
  show studio uses; the grey face is left as it is until the art audit decides.
- **Resolution (integration, 2026-09-26)**: done, both are e-Bug smileys and both are erased in the render job: the podium smiley (`splash_studio` shape 38) and the grey spiky face, which is the smiley on the sticker at the top left of the TV screen (`splash_shine` shape 54 and, under the TV mask, `splash_studio` shape 31); checked by composing the splash from the shipped atlases against capture `303`, which shows both marks (`web/NOTES-art-decisions.md` section 6). The splash's gold "?" medallion on the podium stays as decoration, matching the game show studio.

## [Done] 7. `web/tests/level1.spec.mjs`: the "splash: New Game starts level 1" test asserts the placeholder splash

- **Change**: that test opens `index.html` with no parameters, clicks `#btn-new-game` at once and
  expects level 1's briefing within 20 s. That was the placeholder splash's shortcut ("for now New
  Game goes straight to level 1"). With the real flow (NOTES 2.1, 2.3) the menu appears at frame
  150 of the tuning (6 s, or at once after a tap / Enter), a first-run language chooser comes
  first unless `?lang=` is given, and New Game leads to the cutscene and the shrinking zone before
  level 1. Suggested replacement: open `index.html?lang=en`, skip the tuning (tap or Enter), then
  either play New Game through the cutscene (as `web/tests/flow.spec.mjs` does with the keyboard
  and with touch) or go through Level select (`#btn-level-select`, then `#level-alpha_level1`),
  which opens level 1 with its briefing.
- **Reason**: the journey itself is the brief; keeping the shortcut would skip the cutscene.
- **Workaround**: none from the flow side; `web/tests/flow.spec.mjs` covers splash to level 1 with
  the keyboard and with touch.
- **Resolution (integration, 2026-09-26)**: done. The test (`level1: splash: Level select starts level 1 with its briefing (keyboard and tap)`) opens `index.html?lang=en` and reaches level 1 through Level select, as suggested; `flow.spec` covers New Game through the cutscene and the shrinking zone.

## [Done] 8. `web/js/platformer/hud.js`: export the goal portrait canvas

- **Change**: export `portraitCanvas(name)` (or a `goalPortraitCanvas(goal, badTypes)` wrapper)
  so Level select can draw the same Patty (level 4) and Iggy (level 7) ePhone portraits the HUD
  builds (decision 11.9 #9).
- **Reason**: one composition for both screens; today the layout constants live in two files.
- **Workaround**: `web/js/flow/levelSelect.js` uses the exported `goalPortrait()` and
  `goalImage()` to choose the picture, and composes the two portraits itself with the same
  layout (the microbe sheet loaded privately and freed at once when no level has loaded it).
- **Resolution (integration, 2026-09-26)**: done. `hud.js` exports `PORTRAITS`, `PORTRAIT_SIZE`, `composePortrait(name, sym, drawIdle)` (the one composition, fed by any art source) and `portraitCanvas(name)` (the HUD's cached copy from the shared sprites). `web/js/flow/levelSelect.js` calls `composePortrait()` with the shared sheet when a level has loaded it, or with a privately loaded sheet that it frees at once, so the layout constants live in one file. `flow-fixes` (level select: Patty and Iggy portraits) passes.
