# Flow area: decisions and bug fixes

Working log of the flow area (splash, cutscene, shrinking zone, summary, ending, level select,
settings and the flow controller). `web/NOTES.md` is the authoritative spec; section 11.9's
resolved decisions are applied as they stand. Source paths are relative to
`reference/Junior_Game/` unless they start with `web/`. Code: `web/js/flow/*.js`,
`web/js/scenes/splash.js`; scene contract: `web/js/flow/contract.md`.

## 1. Journey and scores (`web/js/flow/flow.js`, port of `GameController.as`)

| # | Decision | Source | Port |
|---|---|---|---|
| F1 | Round order from an explicit table (`web/data/levels/index.json` `rounds`) instead of the `round == 2` counter trick | `src/ebug/junior/GameController.as:65-69,206-263`; NOTES 2.2 | `roundTable()`; kitchen round = `kitchen0..3` |
| F2 | Live build order by default: cutscene, then per round shrink, action, that round's sighted quiz; with the `blindRounds` setting on (default off, 11.9 #1) the round's blind quiz comes first (build A) | NOTES 2.3; `doc:1727`; `GameShow.as:421-439` | steps `blind`, `shrink`, `action`, `quiz`; the setting is read at each round start |
| F3 | "Step right this way ..." precedes every shrink. Round 1 with blind rounds off: the cutscene says it after its closing line (build B: splash, cutscene, "Step right this way", shrink, platform round 1). Later rounds: the flow passes `stepRight: true` to the sighted quiz when a shrink follows (blind off, rounds 1-4), and the blind half always ends with it | `GameShow.as:289`; NOTES 2.3 port flow and build B | `cutscene.js` `closing()`; contract.md "Game show parameters" |
| F4 | Four separate scores: quiz (player), CPU quiz, hoverboard, kitchen. `PlatformGame.score` is zeroed only in the constructor, so hoverboard points run across every level, round and retry; kitchen points likewise (the kitchen returns the new running total) | `PlatformGame.as:88,123,916`; `KitchenGame.as:802-811`; NOTES 11.9 #4 | `run.quiz/cpu/hover/kitchen`; only quiz points go to the game show |
| F5 | A failed level (lives or time) shows the summary and restarts **the same level**, score kept, lives and time reset (11.9 #5). The retry straight after the summary card skips the briefing just read (`intro: '0'`), as the platform scene's own retry does; the flag lives in the flow controller only (never saved), so a level resumed with Continue, after a reload or a trip to the menu, shows its briefing ("at the start of the step", NOTES 11.1 #3) | `GameController.as:283-308`; NOTES 2.6, 11.1 #3 | `onGameOver` sets `run.hover = result.score` and the in-memory `retrying`; `continueGame()` and `toSplash()` clear it |
| F5b | `restartScope` (NOTES 11.1 #2): the setting `restartScope` is `'level'` by default; `'round'` restores Flash's `restartRound() = initialiseGame(roundStartPlayer, roundStartLevel)`: the round's first level with its ePhone briefing (capture 510), hoverboard score kept (`PlatformGame.score` was never reset). Settings, Game: "Restart the whole round" | `GameController.as:249-255,265-271,283-308`; `PlatformGame.as:187-192` | `restartScope()` in `flow.js`; `onGameOver` sets `run.part = 0` |
| F6 | Progress is saved at the start of every step (`smw:progress`: round, step, part, the four scores, avatar, nickname, run seed; `shrinkSeen`). Continue resumes that step with the scores it started with. A finished journey is cleared (Continue disappears) and its result kept as `lastEnding`. Saves from earlier builds lose their `age` and `retry` fields on load | NOTES 11.1 #3, 11.2 | `goStep()` persists first; `cleanRun()` |
| F7 | Determinism: a new journey draws a fresh 32-bit run seed from `crypto.getRandomValues` (`Date.now()` as fallback), or takes `?seed=`; it is saved with the run, so a saved journey and a bot replay stay deterministic. Each step gets a seed derived from it and a per-step tag, passed as `params.seed` to platform, kitchen and quiz. **Bug fixed**: the run seed came from the seeded `gameRng`, whose first draw is the same after every page load (nothing consumes it before the cutscene ends), so every first journey of a visit had the same CPU answers, kitchen draws and sneezes | NOTES 12.3 | `freshSeed()`, `seedFor(tag)` |
| F7b | Level select seeds: a fresh seed per practice run (as a replay of a 2009 level drew new random numbers), recorded in the flow probe's `lastLaunch`; `?seed=` makes it reproducible (`hash('single:' + id) ^ seed`). **Bug fixed**: practice seeds mixed in the saved journey's seed, so the same level with the same inputs played differently depending on an unrelated save | NOTES 12.3 | `singleSeed(id)` |
| F8 | The chosen child is the player everywhere; the other child is the CPU and is named after that child (`cpuName`) | NOTES 2.8 #1, 11.1 #4; `GameShow.as:52,85-104`; `Player.as:30-32` | fixes the preload-time male branch |
| F9 | Unlocks: level 1 is always open; a level opens when the journey reaches it, or when the level before it is completed from Level select. NOTES 11.1 #3 says "completed once"; unlocking on reaching makes practice of a level the player keeps failing possible (the evaluation lost 50% of players per level, `eval:78`) | NOTES 11.1 #3, 11.9 #20 | `unlock()` in `playAction()` and `playSingle()` |
| F10 | Level select plays one level alone (briefing, level, results card) with no shrink or quiz, records a best score (points scored in that run), and offers Next level / Play again / Level select; failures offer Try again / Level select. "New best score!" only when the score beats the previous best (**bug fixed**: a tie showed it, because the card compared with the already updated best) | NOTES 11.1 #3 | `playSingle()` passes `prevBest`; results on the summary card (`kind: 'complete'`) |
| F11 | Art for the next screen is fetched while the current one plays, as Flash preloaded every SWF before the splash (NOTES 2.1): the shrinking zone's sheet from New Game, Continue, and every quiz that a shrink follows; the next level's sheets (`sprites.loadForLevel`) or the kitchen's (`loadKitchenArt`) during the shrinking zone; the summary card's sheet while a level plays. Each area's loader is memoised, so nothing loads twice | NOTES 2.1 (port: lazy per area, no placeholder gameplay art) | `prefetchShrink()`, `prefetchAction()` |

## 2. Splash (`web/js/scenes/splash.js`)

- **Timeline**: `splash.swf` sprite 58, 170 frames at 25 fps, driven on the frame clock `floor(ticks * 3 / 8)` (NOTES 12.1). Layers and placements as `tools/swf-sheet/compose.mjs` (back, studio, casing, screen frames 1-119, tuning group frames 49-134 with its "Tuning" text drawn in Verdana Bold `#00ff00`, shine and glass from frame 120).
- **Menu at frame 150**: New Game is the 2009 button art (`button_new_game`, splash.swf character 5) on track `d390` (132.6 x 48.4 at (197.2, 239.8)) with its alpha ramp (frames 150-170), under a transparent real button `#btn-new-game` that is at least 44 CSS px high on any phone; its label (a text field in the SWF, not in the art render) is drawn in white; hover and focus lift it with a soft glow, a press sinks it. Continue (with a save, blue, focused first), Level select and Settings are smaller glossy buttons on the cabinet's bottom rail, like a TV's own buttons, so nothing covers the studio's podiums or the original button (**changed**: they were a 2 x 2 grid over the TV picture). Frame 170 `stop()`.
- **Menu wake** (16 ticks after it appears): until then the menu takes no taps (`passthrough`) and nothing is focused, and the flow's key handler ignores auto-repeat, so the Enter that skipped the tuning (or its auto-repeat while held) cannot start a game the player never saw (**bug fixed**). A deliberate press on an explicitly focused button still works at once.
- **Title instead of the e-Bug logo** (NOTES 11.2): a canvas-drawn "SUPER MICROBE WORLD" on a blue splat follows the logo's own track `d399` (frames 150-170): the whole matrix relative to its frame-170 rest matrix, so it swings in as the logo did (+13.8 degrees and x +62.7 at frame 155, -13 degrees and x -31.9 at frame 160; **bug fixed**: only the y offset was used), drawn between the studio and the casing so the TV frame clips it, with a small squash on landing. `compose.mjs` places the splash timeline at identity, so the track is in stage space.
- **Skip**: tap, click, Enter or Space during the tuning jumps to frame 150. Coming back to the splash later starts at frame 170.
- **Loading**: the splash waits for its sheet on black with a small loading ring (after a 12-tick grace); a skip asked for meanwhile applies once the art is in. The placeholder TV is drawn only if the load fails (**changed**: it used to play the placeholder after 200 ticks).
- **Idle animation**: bubbles drifting up behind the glass, a slow glint across the glass every 6.3 s, a gentle title bob (all off with reduced motion); menu music (new procedural track `menu`).
- **Branding**: the host podium in the TV picture carries the blue e-Bug smiley; a "?" medallion covers it, as the game show studio does. The grey spiky face at the top left of the TV picture is left for the art audit (`web/requests/flow.md` #6).
- **Language**: the TV dial is the language button. On the first run (no language saved) a chooser comes up at frame 150 listing the 11 languages by native name, with the browser language preselected; `?lang=<code>` applies a language and skips it (the 2009 build took the language from a flashvar, NOTES 7.1; original codes kept, 11.9 #19). The chooser says that only the quiz and the host's welcome are translated.
- **New Game over a save** asks first (in-page dialog; `window.confirm` is unavailable in the artifact host).

## 3. Cutscene (`web/js/flow/cutscene.js`)

- **Script** (`cutscene_introduction.swf` frames 1-30; `CutSceneXMLParser.as:44-54`; NOTES 2.4): host lines 0-2, avatar choice, line 4, details form, closing line. Lines come from `web/data/quiz/<lang>.json` `intro` (line 0 already rebranded). Line 3 ("Excellent!" in build A, empty live) is skipped as in Flash. The talkie, studio and cast are the game show area's modules (`createTalkie`, `Studio`), so the two screens match; the talkie sits at (15, 307.5).
- **Avatar choice** (frame 20): the room behind the podiums darkens (dim 0.3, capture 010), the host stops, hovering a child plays `happy` and the other `disappointed`, leaving plays `idle` (as `amyButton` / `harryButton`). The hit areas are the original invisible buttons: sprite 846 is a 50 x 50 square scaled 2.68 x 5.26 at (436.8, 99.7) and (584.15, 123.7), so each covers the child and their podium. Keyboard: arrows move the focus and focus counts as hover; Enter chooses. Name pills appear on hover and focus; podium name tags show both names. Choice juice: chime, applause, star burst.
- **Details form** (frame 30): the original asked for nickname (pre-filled with the avatar name), age (pre-filled "2") and e-mail (pre-filled "dont@have.one") and sent them to the research server (NOTES 6.10). The port asks for a **nickname only** (pre-filled with the saved nickname or the avatar's name, at most 25 characters, empty falls back to the avatar's name): **no age and no e-mail** (NOTES 11.2, the authoritative spec: "Age is not collected"; **changed**: an earlier area brief had asked for an optional age, which was stored in the local save; the field, `run.age` and the "age is cleared too" text are gone, and old saves drop the field on load). The live "competitions" line (statement 8) is not used: a privacy panel (with a padlock) says the nickname stays on the device and can be cleared in Settings; it covers the age and e-mail boxes baked into the form art (y 102-240), so it never reaches Submit at any text size. The label is capped at 290 px and wraps, so a translated label never runs under its field; the field is at least 44 CSS px high on phones.
- **Closing line** (11.9 #14): with blind rounds off, a new English line that uses the nickname ("All right, {name}! Let's shrink you down and explore the weird world of microbes!"), then "Step right this way and prepare to enter the world of microbes!" (F3); with blind rounds on the quiz follows, so the live closing line 9 ("Let's see what you know about microbes.") is used in the chosen language.
- **Avatar choice input**: the hint names the active device's controls and changes with it ("Tap Amy or Harry"; keyboard "Click Amy or Harry, or pick with ← → and press Enter"; gamepad "Pick with ← → and press A"; NOTES 11.1 #10). When the mouse enters a child while the other has keyboard focus, the focus moves to the hovered child, so the reacting child is always the one Enter picks (**bug fixed**: Amy focused, Harry hovered, Enter chose Amy).
- **Leaving**: Escape / Backspace asks before leaving for the main menu; a small Main menu button (a house, top left, at least 44 CSS px) does the same for touch players (**bug fixed**: touch had no way out before level 1).

## 4. Shrinking zone (`web/js/flow/shrink.js`)

- 150-frame clip (`shrinking_harry.swf` / `shrinking_amy.swf` `avatar`, frame 1 `midAnimation = true`, frame 150 false), authored at 24 fps and played at 25: 149 frame advances on the frame clock, about 5.96 s (`ShrinkingZone.as:14-74`; NOTES 2.5). The chosen child is shown (Ruffle 032-034, 504-505), not the always-Harry `userAvatar` of the preload bug.
- Juice, render only: the ray charges (frames 1-27), a flickering beam and sparkles while the rig shrinks the child (frames 28-82: pose scale 0.22 to 0.086), whoosh and the shrink synth, light shake (reduced by the setting), a sparkle pop at the end, then an iris into the level centred on the child.
- **Skipping** (NOTES 2.5: "plays it in full (skippable after first viewing)"): the player's first shrink plays in full (`progress.shrinkSeen`, set when a shrink completes; the flow passes `skippable`). After that a tap, click, Enter, Space or Backspace skips it, but only from tick 40 (0.6 s), when the device-aware hint ("Tap to skip" / "Press Enter to skip") appears and the full-screen skip area starts taking taps, and never with a key or finger that was already down on the scene's first tick (it must be let go first: input is off during the fade, so a held key reads as a new press then). **Bug fixed**: taps or Enter presses mashed through the host's lines, or Enter held across the fade, skipped the whole shrink before it was seen.
- **Loading**: the clip starts only when its sheet is in (prefetched during the cutscene and the quiz, F11); until then a dark stage with a small loading ring, and no skip. The placeholder drawing is only for a failed load (**bug fixed**: on a slow first visit the placeholder played for up to 3 s and then the clip started on it).

## 5. Summary page (`web/js/flow/summary.js`)

- Drawn over a snapshot of the frozen level with the page's own 50% black layer, so orange turns brown as in capture 509; heading "You Died!" / "You ran out of time." in Verdana Bold; `text1` "click to try again" becomes a device-aware prompt ("Press Enter to try again" / "Tap to try again"); the original glossy button art (up / over / down frames) carries the label "Try again" (the static text was "Click").
- The buttons respond only after 16 ticks, so a key or finger still held from the level cannot pick a choice by accident.
- The same card shows the Level select results (points counting up, best score, "New best score!" only when the previous best is beaten, confetti).

## 6. Ending (`web/js/flow/ending.js`)

- Host line as Flash (`GameShow.as:451-459`) without "To play again, reload this web page." (the click did nothing: `_root.exit` undefined, NOTES 2.8 #5): win "Well done! You beat {cpu}. Thank you for playing." with the real opponent's name (Flash always said "Amy", `GameShow.as:73,453`); loss unchanged; a **tie is a draw** with its own line (11.9 #3; Flash `player.score > cpu.score` counted a tie as a loss).
- Winner card: title, both quiz scores (which alone decide the winner, 11.9 #4, stated on the card), hoverboard and kitchen points, Play again / Level select / Main menu. The card is at most 410 stage px high and scrolls, with its button row sticky at the foot, so the buttons stay on screen at text size 130% and with a 25-character nickname (**bug fixed**: at 130% Level select and Main menu fell below the stage, leaving touch players only Play again); long names in the table end with an ellipsis. Reactions: winner `happy`, loser `disappointed`, host `excited` (`serious` on a loss); fanfare, applause, confetti and a spotlight on the winner's podium (loss: applause only). The card's buttons wake after 24 ticks, so the presses that skipped the host's line cannot start a new game by accident.

## 7. Settings (`web/js/flow/settings.js`)

- Scene and overlay (`openSettings(app, { onClose })`). The overlay makes the rest of the UI `inert`, reads keys in the capture phase and stops them, so a paused level below sees nothing (tested).
- Sliders and switches are at least 44 CSS px high on phones (the `.fl-btn` rule: `max(44px, calc(46px / var(--stage-scale)))`; **bug fixed**: 37 CSS px on a 667 x 375 phone).
- Tabs: Sound (main, music, effects volume sliders; mute), Game (blind question rounds, restart the whole round (F5b), language), Display (reduce motion and reduce shake as Auto / On / Off, where Auto follows `prefers-reduced-motion`; text size 100 / 115 / 130%; touch button opacity; vibration, disabled where `navigator.vibrate` is missing), Controls, Saved data (clear nickname, reset progress; both confirm in page).
- **Key remapping**: every action in `core/input.js` `ACTIONS`. "Change" waits for the next key (window capture phase, so the game never sees it) and makes it the action's first key (the one prompts advertise); the key is freed from other actions of the same group (play, menus, quiz), and the note says which. Escape cancels, except when remapping Pause or Back. **Classic 2009 keys** preset: arrows move, **Up jumps, Space throws, Ctrl takes photos** (`mapControls`, `PlatformGame.as:1260-1311`; `checkKeys`, `PlayerEntity.as:566-636`; NOTES 3.9), P / Tab ePhone, Esc pause, Enter confirm. Reset to default clears the override.
- **Text size**: `settings.textScale` mirrored to `--text-scale` on `:root` at boot and on change (contract.md), used by every flow screen; the game show talkie reads the setting itself.
- The flow owns the `blindRounds` key (default false, `!!settings.get('blindRounds')`).

## 8. Accessibility and input

- Every flow control is a real button (or a focusable slider with `role="slider"`), with visible yellow focus rings and screen-reader labels; screens announce themselves through the live region.
- Spatial arrow-key / d-pad navigation with a focus stack (`web/js/flow/ui.js`), so dialogs trap navigation; Escape / Backspace / gamepad Back go back; gamepad A activates the focused button. The arrows also reach text fields (the nickname).
- **Tab, Space and key repeat** (`ui.js` `onKeyDown`, window capture phase, active only while a flow screen or dialog is on top): Tab / Shift+Tab move the focus in document order within the top container and wrap (dialogs keep it inside); Space activates the focused button; an auto-repeated Enter or Space never activates a flow button. `core/input.js` cancels Space and Tab outside `[data-native-keys]`, and the flow's roots do not use that attribute because native arrows would scroll the settings panel and native Tab would leave dialogs (**bug fixed**: Space did nothing on flow buttons, Tab never moved, and Shift+Tab could not return from Submit to the nickname). Settings key remapping suspends it (`suspendMenuKeys`).
- Tap targets at least 44 CSS px (tested on 915 x 412 and 667 x 375 phones, including the settings controls, the nickname field and the cutscene's Main menu button); menus hide the touch controls.
- Text size 130% on a 667 x 375 phone (tested): the ending card's buttons and the language chooser's Cancel (now in its title row) stay on screen; the chooser and Level select scroll inside themselves (`touch-action: pan-y`) when needed.

## 9. Bugs in the original flow, as handled

| Original bug (NOTES 2.8) | Port |
|---|---|
| #1 game show built at preload: player always Harry, CPU always "Amy" | chosen child is the player; `cpuName` the other child (F8) |
| #4 kitchen handed a throwaway `Player`: kitchen avatar always Harry, points lost | the flow passes the avatar and keeps kitchen points (F4) |
| #5 ending click does nothing; `GameController.exit()` unreachable | winner card with Play again / Level select / Main menu |
| #6 "Looding" and the visible FPS counter | not shown |
| #7 `introductionToMicrobes_mainMenu.swf` preloaded but never shown | the splash has a real menu |
| `round == 2` kitchen test relying on lazy increments (`GameController.as:206-263`) | explicit round table (F1) |
| Talkie arrow shown while typing; first click after the last intro line ignored | handled by the game show area's talkie |

## 10. Timing conversions (all on the 15 ms tick)

| Original | Port |
|---|---|
| Splash 170 frames, New Game at 150 (25 fps) | frame = `floor(ticks * 3 / 8)` + 1 |
| Shrink 149 frames (`midAnimation` poll every 40 ms) | same frame clock, ends at frame 150 plus 4 ticks |
| Talkie 1 character per frame | game show talkie (40 ms per character in ticks) |
| (new) Summary and ending button wake | 16 and 24 ticks |
| (new) Splash menu wake | 16 ticks after it appears |
| (new) Shrink skip wake | 40 ticks of the clip (the hint appears then) |
| (new) Art waits in splash and shrink | until the sheet is in (loading ring after 12 ticks); placeholder only after a failed load |

## 10b. Level select (`web/js/flow/levelSelect.js`)

- Thumbnails: the level's first screen from its tile art, with the goal's ePhone picture chosen as the HUD chooses it (`goalImage()`, `goalPortrait()` from `platformer/hud.js`), including the Patty (level 4) and Iggy (level 7) portraits of decision 11.9 #9, composed with the HUD's layout from the microbe's idle frame (**bug fixed**: level 4 showed a letter "P" and level 7 the Slurm picture). `hud.js` keeps its portrait canvas private, so the layout is repeated here (request #8).
- Cards: one `minmax(0, 1fr)` column, so the goal line ends with an ellipsis instead of widening the card; rows are `calc(89px + 29.5px * text scale)` high (the card's fixed parts plus its two text lines), so they grow with the text size and the grid scrolls at 115% (by about 9 stage px) and 130%; the round badge sits at the thumbnail's bottom left and the best score at its top right, so a six-digit best never covers the round (**bug fixed**: long goals spilled out of the cards, and at 130% the thumbnails shifted out and the goal line was clipped).

## 11. Open items

- `web/requests/flow.md`: i18n keeps `language()` at English for languages without UI tables and requests missing string files (404s); the art audit should check the splash studio's two smileys.
- The platform pause menu does not yet open Settings or Level select (request #5).

## 12. Review fixes (2026-09-26)

| Finding | Action | Verified by |
|---|---|---|
| Shrink / splash played placeholder art on a slow first load | Prefetch (F11); both scenes wait on a loading ring, placeholder only after a failed load (the splash then draws a plain New Game button in the art's place) | `flow-fixes`: shrinking zone test holds the sheet back and checks a dark stage, frame 1, no skip; a scratch run with the sheets aborted: the splash menu comes up on the placeholder TV, the placeholder shrink plays and hands over to level 1 |
| Round 1 lacked "Step right this way" | Cutscene says it after the closing line (F3) | `flow`: keyboard journey sees the line before the shrink |
| `restartScope` missing | Setting and Game-tab toggle (F5b) | `flow-fixes`: flow rules test (round restart to level 1 with briefing, score kept) |
| Continue after a fail skipped the briefing | Retry flag in memory only (F5) | `flow-fixes`: flow rules test; saved run has no `retry` |
| Level select portraits | Section 10b | `flow-fixes`: level select test (`patty`, `iggy`) |
| Title ignored the d399 swing | Full relative matrix (section 2) | screenshots at frames 155 and 160 |
| New Game not the original art | Button art on d390, rail buttons (section 2) | `flow`: 44 px checks; screenshots |
| Hint always "Tap" / hover and focus disagree | Section 3 | `flow-fixes`: cutscene test |
| Ending buttons off screen at 130% | Section 6 | `flow-fixes`: 667 x 375 at 130% test |
| Shrink skipped from its first tick | Section 4 | `flow-fixes` and `flow` (touch tap does not skip the first shrink) |
| Held Enter started a game from the splash | Section 2 menu wake; `ui.js` repeat guard | `flow-fixes`: splash test (held Enter with auto-repeat) |
| Space / Tab dead in flow menus | Section 8 | `flow-fixes`: splash test (Tab order, Space once), cutscene test (form keys); `flow`: Tab / Shift+Tab in the form |
| Touch targets under 44 px | Section 7, section 3 | `flow-fixes`: 667 x 375 test (sliders, switches, nickname field) |
| Same run seed every page load; practice seed tied to the save | F7, F7b | `flow-fixes`: flow rules test |
| Level select cards overflow | Section 10b | `flow-fixes`: level select test at 130% |
| Form labels ran under the fields | Section 3 | screenshots at 130% |
| Language chooser Cancel off screen at 130% | Section 8 | `flow-fixes`: 667 x 375 at 130% test |
| Tied best shown as new | F10 | `flow-fixes`: flow rules test |
| No touch exit from the cutscene | Section 3 | `flow-fixes`: cutscene test |
| Age collected against NOTES 11.2 | Removed (section 3) | `flow`: no `#form-age`, no `age` in the run |
