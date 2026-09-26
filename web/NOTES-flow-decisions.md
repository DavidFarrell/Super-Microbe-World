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
| F3 | "Step right this way ..." precedes every shrink: the flow passes `stepRight: true` to the sighted quiz when a shrink follows (blind off, rounds 1-4), and the blind half always ends with it | `GameShow.as:289`; NOTES 2.3 port flow | contract.md "Game show parameters" |
| F4 | Four separate scores: quiz (player), CPU quiz, hoverboard, kitchen. `PlatformGame.score` is zeroed only in the constructor, so hoverboard points run across every level, round and retry; kitchen points likewise (the kitchen returns the new running total) | `PlatformGame.as:88,123,916`; `KitchenGame.as:802-811`; NOTES 11.9 #4 | `run.quiz/cpu/hover/kitchen`; only quiz points go to the game show |
| F5 | A failed level (lives or time) shows the summary and restarts **the same level**, score kept, lives and time reset (11.9 #5). Flash restarted the round's first level (`roundStartLevel`) and replayed its ePhone intro (capture 510); the port skips the briefing on a retry (`intro: '0'`), as the platform scene's own retry does | `GameController.as:283-308`; `PlatformGame.as:187-192`; NOTES 2.6 | `onGameOver` sets `run.hover = result.score`, `run.retry = true` |
| F6 | Progress is saved at the start of every step (`smw:progress`: round, step, part, the four scores, avatar, nickname, age, run seed). Continue resumes that step with the scores it started with. A finished journey is cleared (Continue disappears) and its result kept as `lastEnding` | NOTES 11.1 #3 | `goStep()` persists first |
| F7 | Determinism: each step gets a seed derived from the run seed (`?seed=` or the seeded game RNG) and a per-step tag, passed as `params.seed` to platform, kitchen and quiz | NOTES 12.3 | `seedFor(tag)` |
| F8 | The chosen child is the player everywhere; the other child is the CPU and is named after that child (`cpuName`) | NOTES 2.8 #1, 11.1 #4; `GameShow.as:52,85-104`; `Player.as:30-32` | fixes the preload-time male branch |
| F9 | Unlocks: level 1 is always open; a level opens when the journey reaches it, or when the level before it is completed from Level select. NOTES 11.1 #3 says "completed once"; unlocking on reaching makes practice of a level the player keeps failing possible (the evaluation lost 50% of players per level, `eval:78`) | NOTES 11.1 #3, 11.9 #20 | `unlock()` in `playAction()` and `playSingle()` |
| F10 | Level select plays one level alone (briefing, level, results card) with no shrink or quiz, records a best score (points scored in that run), and offers Next level / Play again / Level select; failures offer Try again / Level select | NOTES 11.1 #3 | `playSingle()`; results on the summary card (`kind: 'complete'`) |

## 2. Splash (`web/js/scenes/splash.js`)

- **Timeline**: `splash.swf` sprite 58, 170 frames at 25 fps, driven on the frame clock `floor(ticks * 3 / 8)` (NOTES 12.1). Layers and placements as `tools/swf-sheet/compose.mjs` (back, studio, casing, screen frames 1-119, tuning group frames 49-134 with its "Tuning" text drawn in Verdana Bold `#00ff00`, shine and glass from frame 120).
- **Menu at frame 150**: the NewGame button's alpha ramp (track `d390`, frames 150-170) fades the menu in. New Game keeps its id `btn-new-game`; Continue (with a save, focused first), Level select and Settings join it. Frame 170 `stop()`.
- **Title instead of the e-Bug logo** (NOTES 11.2): a canvas-drawn "SUPER MICROBE WORLD" on a blue splat drops in on the logo's own track (`d399`, frames 150-170), drawn between the studio and the casing so the TV frame clips it, with a small squash on landing.
- **Skip**: tap, click, Enter or Space during the tuning jumps to frame 150. Coming back to the splash later starts at frame 170. The tuning waits for its art (at most 200 ticks) so a slow phone does not play it as a placeholder.
- **Idle animation**: bubbles drifting up behind the glass, a slow glint across the glass every 6.3 s, a gentle title bob (all off with reduced motion); menu music (new procedural track `menu`).
- **Branding**: the host podium in the TV picture carries the blue e-Bug smiley; a "?" medallion covers it, as the game show studio does. The grey spiky face at the top left of the TV picture is left for the art audit (`web/requests/flow.md` #6).
- **Language**: the TV dial is the language button. On the first run (no language saved) a chooser comes up at frame 150 listing the 11 languages by native name, with the browser language preselected; `?lang=<code>` applies a language and skips it (the 2009 build took the language from a flashvar, NOTES 7.1; original codes kept, 11.9 #19). The chooser says that only the quiz and the host's welcome are translated.
- **New Game over a save** asks first (in-page dialog; `window.confirm` is unavailable in the artifact host).

## 3. Cutscene (`web/js/flow/cutscene.js`)

- **Script** (`cutscene_introduction.swf` frames 1-30; `CutSceneXMLParser.as:44-54`; NOTES 2.4): host lines 0-2, avatar choice, line 4, details form, closing line. Lines come from `web/data/quiz/<lang>.json` `intro` (line 0 already rebranded). Line 3 ("Excellent!" in build A, empty live) is skipped as in Flash. The talkie, studio and cast are the game show area's modules (`createTalkie`, `Studio`), so the two screens match; the talkie sits at (15, 307.5).
- **Avatar choice** (frame 20): the room behind the podiums darkens (dim 0.3, capture 010), the host stops, hovering a child plays `happy` and the other `disappointed`, leaving plays `idle` (as `amyButton` / `harryButton`). The hit areas are the original invisible buttons: sprite 846 is a 50 x 50 square scaled 2.68 x 5.26 at (436.8, 99.7) and (584.15, 123.7), so each covers the child and their podium. Keyboard: arrows move the focus and focus counts as hover; Enter chooses. Name pills appear on hover and focus; podium name tags show both names. Choice juice: chime, applause, star burst.
- **Details form** (frame 30): the original asked for nickname (pre-filled with the avatar name), age (pre-filled "2") and e-mail (pre-filled "dont@have.one") and sent them to the research server (NOTES 6.10). The port asks for a **nickname** (pre-filled with the saved nickname or the avatar's name, at most 25 characters, empty falls back to the avatar's name) and an **optional age** (empty by default, digits only), and **no e-mail**. The live "competitions" line (statement 8) is not used: a privacy line on the form says the nickname stays on the device and can be cleared in Settings; its panel also covers the e-mail field baked into the form art. **Discrepancy logged**: NOTES 11.2 says age is not collected, the area brief asks for an optional age; the port follows the brief but keeps age only in the local save of the current journey, never pre-fills it, uses it for nothing and clears it with the nickname.
- **Closing line** (11.9 #14): with blind rounds off, a new English line that uses the nickname ("All right, {name}! Let's shrink you down and explore the weird world of microbes!"); with blind rounds on the quiz follows, so the live closing line 9 ("Let's see what you know about microbes.") is used in the chosen language.
- Escape / Backspace asks before leaving for the main menu.

## 4. Shrinking zone (`web/js/flow/shrink.js`)

- 150-frame clip (`shrinking_harry.swf` / `shrinking_amy.swf` `avatar`, frame 1 `midAnimation = true`, frame 150 false), authored at 24 fps and played at 25: 149 frame advances on the frame clock, about 5.96 s (`ShrinkingZone.as:14-74`; NOTES 2.5). The chosen child is shown (Ruffle 032-034, 504-505), not the always-Harry `userAvatar` of the preload bug.
- Juice, render only: the ray charges (frames 1-27), a flickering beam and sparkles while the rig shrinks the child (frames 28-82: pose scale 0.22 to 0.086), whoosh and the shrink synth, light shake (reduced by the setting), a sparkle pop at the end, then an iris into the level centred on the child.
- Skippable at any time with a tap, click, Enter, Space or Backspace; a device-aware hint ("Tap to skip" / "Press Enter to skip") appears after 0.6 s. The clip waits up to 200 ticks for its art.

## 5. Summary page (`web/js/flow/summary.js`)

- Drawn over a snapshot of the frozen level with the page's own 50% black layer, so orange turns brown as in capture 509; heading "You Died!" / "You ran out of time." in Verdana Bold; `text1` "click to try again" becomes a device-aware prompt ("Press Enter to try again" / "Tap to try again"); the original glossy button art (up / over / down frames) carries the label "Try again" (the static text was "Click").
- The buttons respond only after 16 ticks, so a key or finger still held from the level cannot pick a choice by accident.
- The same card shows the Level select results (points counting up, best score, "New best score!", confetti).

## 6. Ending (`web/js/flow/ending.js`)

- Host line as Flash (`GameShow.as:451-459`) without "To play again, reload this web page." (the click did nothing: `_root.exit` undefined, NOTES 2.8 #5): win "Well done! You beat {cpu}. Thank you for playing." with the real opponent's name (Flash always said "Amy", `GameShow.as:73,453`); loss unchanged; a **tie is a draw** with its own line (11.9 #3; Flash `player.score > cpu.score` counted a tie as a loss).
- Winner card: title, both quiz scores (which alone decide the winner, 11.9 #4, stated on the card), hoverboard and kitchen points, Play again / Level select / Main menu. Reactions: winner `happy`, loser `disappointed`, host `excited` (`serious` on a loss); fanfare, applause, confetti and a spotlight on the winner's podium (loss: applause only). The card's buttons wake after 24 ticks, so the presses that skipped the host's line cannot start a new game by accident.

## 7. Settings (`web/js/flow/settings.js`)

- Scene and overlay (`openSettings(app, { onClose })`). The overlay makes the rest of the UI `inert`, reads keys in the capture phase and stops them, so a paused level below sees nothing (tested).
- Tabs: Sound (main, music, effects volume sliders; mute), Game (blind question rounds, language), Display (reduce motion and reduce shake as Auto / On / Off, where Auto follows `prefers-reduced-motion`; text size 100 / 115 / 130%; touch button opacity; vibration, disabled where `navigator.vibrate` is missing), Controls, Saved data (clear nickname, reset progress; both confirm in page).
- **Key remapping**: every action in `core/input.js` `ACTIONS`. "Change" waits for the next key (window capture phase, so the game never sees it) and makes it the action's first key (the one prompts advertise); the key is freed from other actions of the same group (play, menus, quiz), and the note says which. Escape cancels, except when remapping Pause or Back. **Classic 2009 keys** preset: arrows move, **Up jumps, Space throws, Ctrl takes photos** (`mapControls`, `PlatformGame.as:1260-1311`; `checkKeys`, `PlayerEntity.as:566-636`; NOTES 3.9), P / Tab ePhone, Esc pause, Enter confirm. Reset to default clears the override.
- **Text size**: `settings.textScale` mirrored to `--text-scale` on `:root` at boot and on change (contract.md), used by every flow screen; the game show talkie reads the setting itself.
- The flow owns the `blindRounds` key (default false, `!!settings.get('blindRounds')`).

## 8. Accessibility and input

- Every flow control is a real button (or a focusable slider with `role="slider"`), with visible yellow focus rings and screen-reader labels; screens announce themselves through the live region.
- Spatial arrow-key / d-pad navigation with a focus stack (`web/js/flow/ui.js`), so dialogs trap navigation; Escape / Backspace / gamepad Back go back; gamepad A activates the focused button.
- Tap targets at least 44 CSS px (tested on a 915 x 412 phone); menus hide the touch controls.

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
| (new) Art waits in splash and shrink | at most 200 ticks |

## 11. Open items

- `web/requests/flow.md`: i18n keeps `language()` at English for languages without UI tables and requests missing string files (404s); the art audit should check the splash studio's two smileys.
- The platform pause menu does not yet open Settings or Level select (request #5).
