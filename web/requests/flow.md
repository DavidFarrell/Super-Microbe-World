# Requests from the flow area

Changes the flow area needs in files it does not own. Each entry: file, change, reason. The flow
works around each one meanwhile.

## 1. `web/js/core/i18n.js`: keep the chosen language active when it has no UI tables

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

## 2. `web/js/core/i18n.js`: do not request string files that do not exist

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

## 3. Game show area (`web/js/gameshow/gameshowScene.js`): new parameters

See `web/js/flow/contract.md` ("Game show parameters"). The flow passes:
`blind` (true: the blind half only, ending with "Step right this way ..."), `stepRight` (true: end
the sighted half with "Step right this way ..." because a shrink follows), `cpuName` (the other
child) and `seed` (the run seed for the CPU's answers). `nickname` is never empty.

## 4. Kitchen area (`web/js/kitchen/kitchenScene.js`): score semantics

`score` in is the running kitchen total for the journey; `result.score` should be the new
running total (as the platform scene does with hoverboard points). The flow also passes `seed`.

## 5. Platform area (`web/js/platformer/platformScene.js`): optional

- Pause menu: a "Settings" button that calls `openSettings(app, { onClose })` from
  `web/js/flow/settings.js` (the overlay keeps the pause state), and a "Level select" button that
  calls `app.flow.openLevelSelect()` (NOTES 11.1 #3 lists the pause menu as an entry point).
- Probe: add `avatar` to `probe()` so tests can confirm the chosen child reached the level (the
  flow's own probe records the params it passed meanwhile).

## 6. Art (`web/data/atlas/splash*`, tools/swf-sheet/jobs/flow.json): branding check

- **Change**: in `splash_studio` (splash.swf sprite 58, depths 72-398, frame 120), check the grey
  spiky smiley face at the top left of the TV picture (about stage (125, 120)) and the blue
  smiley on the host's podium (about (255, 277)). Both look like the e-Bug mascot; if they are,
  erase them in the render job as was done for the studio sign (`erase` on shape 36).
- **Reason**: NOTES 11.2 (no e-Bug marks in the hosted build).
- **Workaround**: the splash covers the podium smiley with the same "?" medallion the game
  show studio uses; the grey face is left as it is until the art audit decides.

## 7. `web/tests/level1.spec.mjs`: the "splash: New Game starts level 1" test asserts the placeholder splash

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
