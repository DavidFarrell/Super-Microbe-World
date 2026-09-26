# Flash original in Ruffle: reference captures, compatibility issues, timings and visual notes

Scope: running the 2009 Flash build of the e-Bug Junior Game ("Super Microbe World", build A in `flash-flow.md` section 0.2) in Ruffle 0.6.0, driving it with real mouse and keyboard input, and recording how it looks and behaves. The captures are in `reference/captures/` and are listed one by one, with a description checked against the image, in `reference/captures/index.md`. This note explains how they were made, what Ruffle gets wrong (and how that was worked around), the timings measured and the visual facts a faithful port needs.

Citation conventions follow `flash-flow.md` section 0.1: `src/...`, `levels/...` and `movies/...` are relative to `reference/Junior_Game/`; `doc:N` is `reference/docs/junior-game-documentation.md` line N; captures are named by file (`038-level1-opening.png` is `reference/captures/038-level1-opening.png`). Facts read from SWF bytecode cite the SWF and sprite; `swf-scripts/X.txt:N` is `reference/analysis/swf-scripts/X.txt` line N.

## 1. How far it got

The whole game was played through in one unattended run of 40 minutes (`journey.cjs main`, Harry), plus five shorter runs:

| Stage | Reached | Where |
|---|---|---|
| Preloader ("Looding: ...") | yes | `001-loader.png`, `002-loader-later.png` |
| Splash and New Game | yes | `003` to `005`; the click the earlier analysis could not make (`flash-flow.md` section 2.11) works once Ruffle's hardware-acceleration dialog is hidden (section 4.1) |
| Cutscene, avatar choice (with hover reactions), details form | yes | `006` to `015` |
| Five quiz rounds, blind and sighted halves, CPU turns, scoreboards | yes | every line and board of round 1 (`016` to `071`); the first line of each part of rounds 2 to 5 |
| Shrinking zone | yes, all five | `032` to `034`, `076`, `103`, `122`, `176`; with Amy `504`, `505` |
| Platform levels 1 to 10 (every level of every chain) | yes | ePhone intro pages (some missed in this run, section 6.5), opening view, a few seconds of movement, then the game's own Home-key cheat (`src/ebug/junior/PlatformGame.as:1287-1290`) to finish the level. Needs the shared-library merge of section 4.3; without it the levels have no tiles, and a first attempt drew the wrong art |
| Kitchen game levels 0 to 3 | yes | inside the game `123` to `166`; played cleanly on its own `600` to `644` (section 6.4) |
| Final host line and the click after it | yes | `190` to `193`: the click does nothing (section 6.3) |
| Platform time-out, summary page, retry | yes (Amy run) | `509-amy-timeout-summary.png`, `510-amy-after-retry.png` |
| Level 11 (`levels/alpha_level11.xml`, in no chain) | yes, loaded directly | `408` to `415` (section 5) |
| Every level's layout without playing | yes | level editor, `450` to `460` |
| Every SWF in `movies/` that belongs to the game or its art | yes | 47 SWFs, `300` to `362` |

Totals: 340 native captures, 78 of them also at 2x (`index.md`).

Not captured: dying ("You Died!" is the same summary page with a different `text0`, `src/ebug/junior/GameController.as:283-290`); the loss ending line (the script answered well and beat the CPU; the text is in `flash-flow.md` section 1.6); completing a level goal and entering the portal (the Home cheat skips both); a photo flash or a thrown projectile in flight (too brief for the capture rate, section 4.5).

## 2. Reproducing

Everything runs headless in the preinstalled Playwright Chromium (never run `playwright install`). One mode at a time; see section 4.5 for why.

```
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs main        # 001-193, about 40 min
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs standalone  # 300-362, about 6 min
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs level       # 400-415, about 2 min
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs editor      # 450-460, about 1.5 min
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs timeout     # 500-510, about 7.5 min
NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/journey.cjs kitchen     # 600-644, about 2.5 min
```

Options (all documented in the header of `tools/ruffle/journey.cjs`): `--until=<stage>` (`splash`, `avatar`, `form`, `round1-blind`, `level4`, `round1`, `kitchen0`, ...), `--avatar=amy`, `--out=<dir>` (default `reference/captures`), `--prefix=<n>`, `--no-hires`, `--shim=off` (serve the untouched platformer, section 4.3), `--ruffle=<folder>` (another Ruffle build, for example an unpacked `npm pack @ruffle-rs/ruffle@0.7.0-nightly.2026.9.26`), `--level=a.xml,b.xml`, `--only=...` (standalone), `--verbose` (print every AVM1 trace). The standalone set in `reference/captures` was made in two runs (the second with `--prefix=348 --only=...` for the art and prototype SWFs); their manifests are merged.

Each mode writes `reference/captures/_manifest-<mode>.json`: every capture with its time, the measured timings, every Ruffle warning with a count and the symbol names involved, the platformer loop rate, the quirks met, and the AVM1 `trace()` log with repeats folded.

### 2.1 What the harness loads

- `tools/ruffle/harness.html` loads Ruffle 0.6.0 from `node_modules/@ruffle-rs/ruffle` and calls `load({ url, base, parameters })` from the query parameters `swf`, `base` and `vars`. Added for this work, all optional and backward compatible (`tools/ruffle/capture.cjs` was re-run afterwards and still works): `log` (Ruffle log level; `info` forwards AVM1 `trace()` to the console), `renderer` (`wgpu-webgl`, `webgl`, `canvas`; Ruffle's config key is `preferredRenderer`), `quality` (`low`, `medium`, `high`) and `ruffle` (URL folder of another Ruffle build).
- `base` is the movies folder URL, so the relative loads resolve as they did on the web server: `AssetLibrary` loads `junior_game_assets.swf`, `splash.swf` and the rest from `movies/`; `"../levels/alpha_gameshow_round1.xml"` (`src/ebug/junior/GameShow.as` constructor), `"../levels/conversations/en_en_introductions.xml"` (`movies/cutscene_introduction.swf` root frame 1), `"../levels/tile_definitions.xml"` (platformer root frame 1) and `"../levels/" + nextLevel` (`src/ebug/junior/PlatformGame.as:242`) resolve to `levels/`. No request failed apart from the research POSTs below.
- Flashvars: the wrappers `movies/e-Bug_Junior_Game.html:418-420` (1000 x 562) and `movies/e-Bug_Junior_Game2.html` (800 x 450; the two files differ only in those sizes) pass **no FlashVars**: `quality high`, `bgcolor #000000`, `allowScriptAccess sameDomain`, `align middle`, Flash Player 8 codebase. Build A is English only and its `GameController(theRoot, theStage)` takes no language (`src/ebug/junior/GameController.as:40`). The script passes `language=en_en` (what build B's wrapper sent, `doc:424-446`); build A ignores it.
- The viewport is 800 x 450, the stage size, so page and stage coordinates coincide (no letterbox offset). Standalone SWFs with other stage sizes get a matching viewport (level editor 1180 x 700, `harry.swf` and the `Microbes_Motions` SWFs 1000 x 600, `junior_game_assets.swf` 800 x 600, `introductionToMicrobes_platformer9.swf` 800 x 750, 550 x 400 and smaller art SWFs at their own size).
- The research-data POSTs to `http://www.e-bug.eu/ebug_secret.nsf/...` (`src/ebug/junior/GameController.as:145`, `:190`) are aborted by the script; Ruffle logs each as `ERROR web/src/navigator.rs:477 Asynchronous error occurred: Could not fetch: "Got JS error"` (6 per full game) and the game carries on (it never reads a reply).
- In `main` the nine asset SWFs are delayed 250 ms each so the preloader stays up long enough to capture.

### 2.2 How the script knows where it is

- **AVM1 traces.** With `log=info` every `trace()` reaches the console (`web/src/log_adapter.rs:18`). The classes compiled into `movies/e-Bug Junior Game.swf` keep the developer traces, which give exact anchors: `next line: N` (cutscene), `Round is: N` (end of a shrinking zone, `src/ebug/junior/GameController.as:207`), `Init game - level == ...` (`src/ebug/junior/PlatformGame.as:127`), `CHEAT: end level` (`:1288`), `Starting Level: N` followed by that level's food items in order (`src/ebug/junior/fridge/KitchenGame.as:827`, `:934`), `Now Exiting Kitchen Game`, `Submit player data for round: N`, `exit`. `Total physics: ...` is traced on every platformer `main()` call (`src/ebug/junior/PlatformGame.as:195`) and was counted to measure the loop rate (section 7).
- **Pixel probes.** A screenshot is decoded in the page (no image library is installed) and a few pixels decide the screen: talkie (speaker box blue at (30, 320)), question board (black at (30, 320) and board blue at (190, 330)), large ePhone (five bezel pixels), small ePhone (corner bezel at (700, 400)), kitchen intro (Click button at (390, 372)), tutorial, play and outro.
- **Typewriter.** A line counts as finished when the text area (26, 352, 680 x 88) has not changed for 1.6 s and at least `length / 12` seconds have passed. The blinking arrow cannot be used (section 6.2).
- **Keyboard.** A click on the stage gives Ruffle focus; `page.keyboard` then sends `ArrowLeft/Right/Up/Down`, `Space`, `Control` and `Home`, which Ruffle maps to the AS2 key codes `mapControls` listens for (`src/ebug/junior/PlatformGame.as:1260-1311`). All worked; the Home cheat was acknowledged by its trace on every level.
- **Kitchen.** The item list comes from the `Starting Level` trace; each item goes to its correct place (`journey.cjs` `foodPlan`, after `flash-flow.md` sections 5.3 and 5.9), with a click on the tissues first (a no-op in `STATE_WAIT`, and it ends a sneeze without losing the item, `src/ebug/junior/fridge/KitchenGame.as:632-640`), cling film first for meat, and a check that the bottom of the counter's item box (120.3, 171.5, 90 x 90) changed before the next click. Deliberate mistakes: the last item of level 0 goes in the bin; the first meat of level 2 goes in without cling film. The check on the counter's item box was added after the main run: the kitchen captures inside the game (`123` to `166`) were made without it, the standalone kitchen captures (`600` to `644`) with it (section 6.4).
- **2x captures.** For frames worth reusing, the viewport is enlarged to 1600 x 900 for one screenshot, so Ruffle redraws the vector stage at twice the size (Stage `showAll` scaling; no SWF sets `Stage.scaleMode`), then restored. A run at `deviceScaleFactor: 2` was tried first and was too slow (section 4.5). Embedded bitmaps (food photos, textures) are upscaled, not re-rendered. Each 2x capture takes several seconds, during which the game keeps running; that cost some ePhone intro pages (section 6.5).

## 3. Files

| File | What |
|---|---|
| `tools/ruffle/journey.cjs` | the driver (modes above) |
| `tools/ruffle/swf-shim.cjs` | in-memory SWF merge applied to the platformer (section 4.3); `node tools/ruffle/swf-shim.cjs out.swf` writes the merged SWF for inspection |
| `tools/ruffle/harness.html` | Ruffle page; four optional query parameters added (section 2.1) |
| `tools/ruffle/capture.cjs` | the original one-shot capture script, unchanged |
| `reference/captures/<nnn>-<name>.png`, `...@2x.png` | captures; `index.md` describes each |
| `reference/captures/_manifest-<mode>.json` | machine-readable record per mode (section 2) |

`reference/captures/` is shared: `platformer-standalone-frame1.png`, `ruffle-level1-*.png` and `port-level1-*.png` were written by other tasks, are not made by `journey.cjs`, and are listed separately at the end of `index.md`; do not delete them as strays.

## 4. Ruffle compatibility issues

### 4.1 The hardware-acceleration dialog swallows input (worked around)

Under SwiftShader Ruffle opens a modal ("It looks like hardware acceleration is disabled. While Ruffle may work, it could be very slow. You can find out how to enable hardware acceleration by following the link below:", element `#hardware-acceleration-modal`, class `modal`, in the player's shadow root). While it is open:
- it covers the stage, so clicks never reach the SWF (the reason the earlier analysis could not press New Game);
- Ruffle's `showContextMenu()` returns early whenever a `.modal:not(.hidden)` exists (`ruffle.js`), so right-click menus do not open either.

Setting `display: none` on it, or removing only its inner panel, is not enough. The script adds the class `hidden` to the modal every 50 ms (`journey.cjs` `Session.open`). A browser with a GPU never shows it.

### 4.2 An empty browser locale stops Ruffle loading

A Playwright context without `locale` gave `pageerror: Incorrect locale information provided` (thrown by `new Intl.Locale(navigator.language)` in `ruffle.js`) and a black stage. Always set a locale (`en-GB` here).

### 4.3 Shared-library imports: platform levels without tiles, or with the wrong art (worked around)

The one issue that changes what the game looks like.

- `movies/introductionToMicrobes_platformer.swf` has a single `ImportAssets2` tag importing one empty sprite, `shared_library_link` (id 1496), from `junior_game_assets.swf`. The code then `attachMovie()`s linkage names that only `junior_game_assets.swf` exports: 211 names, every tile (`C_Chip_L_Tile`, `Unit_2_Tile`, `pepper_obj`, ...), microbe icons, pickups and the Amy and Harry body parts. Flash Player 8 made every export of a loaded shared library attachable once one symbol was imported; that is what the one-symbol import and the main SWF's early preload of `junior_game_assets.swf` (`src/ebug/junior/GameController.as:83`) are for.
- Ruffle 0.6.0 registers only the names listed in the import tag. Unmodified, every tile fails: `WARN core/src/avm1/globals/movie_clip.rs:808 Unable to attach 'C_Chip_L_Tile'` and `ERROR core/src/library.rs:250 Tried to instantiate a non-registered character C_Chip_L_Tile`, 97 names per level load, and the level is an empty orange screen with only the avatar, the HUD and the ePhone. `0.7.0-nightly.2026.9.26` gives the same 97 failures (`movie_clip.rs:812`).
- Listing all 211 names in the import tag (the first shim tried) makes `attachMovie()` succeed but draws the wrong art, in 0.6.0 and in the nightly: an imported sprite's children are looked up by character id in the *importing* movie. `Unit_2_Tile` is sprite 564 in `junior_game_assets.swf` and places its shape 563; the platformer's own character 563 is an unrelated `DefineShape4`, so the kitchen counter came out as crinkle-cut chips, `pepper_obj` (sprite 606, child 605) as a giant pair of cartoon eyes, and other tiles as black silhouettes.
- Work-around, `tools/ruffle/swf-shim.cjs`, applied by `journey.cjs` to every request for the platformer: copy every shape, bitmap and sprite definition of `junior_game_assets.swf` into the platformer with character ids shifted by 2000 (platformer ids go up to 1540, the library's to 648); rewrite the ids they reference (`PlaceObject` inside sprites; bitmap fills inside shape records, including those in `StateNewStyles` records; the empty-bitmap id 65535 is kept); turn the library's 17 `DefineBits` (which rely on its `JPEGTables`) into self-contained `DefineBitsJPEG2`; export the 210 names under the new ids (the platformer's own `ephone_ingame` wins); replace the import tag with the merged definitions plus an empty sprite 1496; leave out the library's 106 `DoInitAction` tags (they only `registerClass` the unfinished avatar-colouring classes, `doc:397-403`). Totals: 262 shapes, 103 bitmaps, 283 sprites, 114 bitmap-fill references. The merged SWF (1.92 MB uncompressed) is built in memory and served in place of the file; nothing on disk changes.
- With the merge every level matches its level-editor view (compare `038-level1-opening.png` with `450-editor-alpha_level1.png`). Three names still fail, in Flash as well, because no SWF exports them: `undefined` (tile entries without a movie), `colin_icon` (tile 95) and `super_slarg_icon` (tile 104) in each level's tile list (`levels/alpha_level1.xml`); they are attached once per level load and never placed (40 warnings per full game).
- The port does not inherit this; it only matters for the art pipeline: tiles, microbes and pickups live in `junior_game_assets.swf`, not in the platformer.

### 4.4 Device fonts: all dynamic text uses Ruffle's fallback

No `DefineEditText` in the game sets `UseOutlines` (read from the SWFs, section 8.2), so every dynamic and input text field uses a **device font**, the player's own Arial, Verdana or Myriad Pro. Ruffle has none and logs, once each, `WARN core/src/library.rs:567 Unknown device font "Arial" (bold: false, italic: false)`, and the same for `"Arial"` bold, `"Verdana"` bold and regular, `"Myriad Pro"` bold, `"Times New Roman"` and `"Noto Sans"` bold. It substitutes its built-in sans (Noto Sans) and does not embolden. So, in the captures:
- talkie text, question text, form labels and inputs, the kitchen clock, the ePhone intro text, the loader, the platform clock and the kitchen outro rows are Noto Sans regular, where the original showed Arial, Verdana Bold and so on at the sizes in section 8.2;
- descenders are clipped where a field is tight: the loader reads "Loodinq: junior_qame_assets" (`001-loader.png`), and the 491 px loader field cuts `introductionToMicrobes_platformer` to "introductionToMicrobes_platform" (`002-loader-later.png`);
- static text (`DefineText` and text drawn as shapes: "Agree", "Don't Know", "Disagree", "Click", "Submit", "New Game", "e-Bug" on the phone) is exact.

Treat typography in the captures as layout only; take fonts and sizes from section 8.2.

### 4.5 Speed: SwiftShader is slow, so timings stretch

With no GPU, Chromium renders WebGL on the CPU (the GPU process used about three of the four cores). Measured here: `requestAnimationFrame` ran about 6.5 times a second at 800 x 450 with Ruffle quality `high`, 16.5 with `low`, 3.5 at `deviceScaleFactor: 2`; the `canvas` renderer managed 2.5 and threw `IndexSizeError: Failed to execute 'addColorStop' on 'CanvasGradient': The provided value (1.04) is outside the range (0.0, 1.0)` on some gradients. Ruffle runs several SWF frames per browser frame to keep time, but not fully: with nothing else running the typewriter managed about 12.6 characters (frames) a second instead of 25 (57 characters in 4.53 s, `_manifest-timeout.json`); the picture refreshes only a few times a second, and clicks can land between game states (section 6.4). Two browsers at once slow everything further; some of the main run's timings were taken while a short test run was also going, which is noted in section 7. Port the source values, not the measurements.

### 4.6 Other log lines (harmless)

Counts for one full game (`_manifest-main.json`): `WARN core/src/avm1/runtime.rs:385 Avm1::pop: Stack underflow` (170, while the SWFs register their classes during preload); `WARN core/src/avm1/activation.rs:1121 Cannot enumerate Undefined` (6); `WARN core/src/avm1/activation.rs:1492 GoToLabel: Frame label '"steve_idle"' not found` (24: the Steve Staphylococcus clip has no `steve_idle` label, a content bug Flash also ignores); `INFO core/src/loader.rs:349 Loading imported movie` (the import of section 4.3). The level editor on its own also requests `movies/` itself (HTTP 404), because `STATE_FIND_LEVEL` falls through to `STATE_LOAD_LEVEL` with `levelURL = ""` before a file is chosen (`src/ebug/LevelEditor.as:88-104`, `:66`).

## 5. Loading levels directly

Three routes, all used:

1. **Through the game, with the Home cheat.** `mapControls` treats `Key.HOME` or `Key.ALT` as "end level" (`src/ebug/junior/PlatformGame.as:1287-1290`), so after each opening view the script presses Home and the next level of the chain loads (`next=` attribute of the level XML). This gives levels 1 to 10 as a player meets them (`035` to `051`, `077` to `093`, `104` to `112`, `177` to `184`).
2. **The platformer on its own, started from Ruffle's context menu.** Alone, `movies/introductionToMicrobes_platformer.swf` stops on root frame 1 (`init`), because normally the game controller calls `play()` (`src/ebug/junior/GameController.as:251`). Its frame 10 (`start`) calls `game.initialiseGame(player, level, tdp.tiles)` with the timeline variable `level` (`swf-scripts/introductionToMicrobes_platformer.txt:5-16`), which frame 1 only declares (`var level`, an AVM1 `DefineLocal2` that keeps an existing value). So: pass the flashvar `level=alpha_level11.xml`, right-click the stage, choose **Play** in Ruffle's context menu (it offers Play, Rewind, Forward, Back, Quality Low/Medium/High, Enter Full Screen, Volume Controls, Copy Debug Info, About Ruffle), and the level loads with Harry (`player` is undefined, so `avatarSex` is not `FEMALE`). `journey.cjs level` does this for `alpha_level1.xml` (`400` to `407`) and for `alpha_level11.xml` (`408` to `415`), which is in no chain (`next="exit"`, `name="level11"`, goal type 4). Level 11's ePhone plays the level 1 pages because `level_intros` has no `level11` label (`flash-platformer.md` section 8.2). The context menu only opens once the modal of section 4.1 is hidden; the merge of section 4.3 applies here too. At the end of the level `_root.endofHoverboard` does not exist, so nothing follows.
3. **The level editor.** `movies/EBug Level Editor.swf` asks for a level with `FileReference.browse()` as soon as its tiles are parsed (`src/ebug/LevelEditor.as:88-104`); Ruffle turns that into a real file chooser, which Playwright answers with `levels/alpha_levelN.xml` (`onSelect` builds `"..\\levels\\" + file.name`, `:73-76`; the backslashes resolve as slashes in the URL). The editor draws the first 800 px of the level on a beige background with its own copies of the tiles (no import problem), with Left / Generate Level Code / Load / Right buttons (Macromedia v2 components) and the "Paint With e-Bug!" tile palette (`450` to `460`). Its stage is 1180 x 700.

## 6. Behaviour confirmed in Ruffle

### 6.1 The last intro line of every quiz half needs a second click

After the last intro line of a quiz half ("Lets go!", "Let's go!", "Ready?" in round 4, and so on), the first click changes nothing: it runs `nextRoundText()` (`statementCounter++; busy = false`), `main()` then calls `showRoundText()`, which finds no more lines, sets `STATE_ASK_QUESTION` **and** `busy = true` (`src/ebug/junior/GameShow.as:147-166`), so nothing asks the question and the line stays up, still waiting. A second click on it calls `nextRoundText()` again, which clears `busy`, and `main()` runs `askQuestion()`. This happened at the end of the intro of all ten quiz halves (`_manifest-main.json` `quirks`: `r1-blind-intro4`, `r1-sighted-intro6`, `r2-blind-intro4`, `r2-sighted-intro6`, `r3-blind-intro4`, `r3-sighted-intro6`, `r4-blind-intro2`, `r4-sighted-intro5`, `r5-blind-intro4`, `r5-sighted-intro6`) and again in the Amy run, so it is the as-built behaviour, not a Ruffle artefact, and it settles the open point in `flash-flow.md` section 2.4. Port: go to the first question on one click.

### 6.2 The "next" arrow blinks while the host is still talking

`Talkie.init()` does `gotoAndStop(inState)` and then `play()` (`src/ebug/general/Talkie.as:40-59`). The `stop()` on frame 10 (`start`) has already run, so the talkie's timeline plays on and stops on frame 20 (`wait_for_click`, the blinking white arrow at about (730 to 757, 378 to 408)) ten frames later, whatever the typewriter is doing (`update`, `:62-77`, only jumps to `wait_for_click` when it finishes). `x01-talkie-arrow-while-typing.png` shows the arrow beside a half-typed line. Showing the arrow only when the line is complete is the obvious intent; strict fidelity shows it after 0.4 s.

### 6.3 Other confirmations and one correction

- **Talkie clicks**: first click completes the line, second advances (`src/ebug/general/Talkie.as:85-99`).
- **Avatar choice**: hovering Amy plays her `happy` and Harry's `disappointed`, and the reverse (`011`, `012`); on this frame the room behind the podiums is darker than during speech (`010`).
- **Details form**: pre-filled "Harry" (or "Amy"), "2" and "dont@have.one" (`014`); Ruffle text input works (`500`: "Sam" typed after End and Backspace; Ctrl+A was not tried), the host then uses it ("Sam, you chose Disagree.", `502`), and the Submit trace is `dont@have.one, true, Harry` (email, sex, nickname).
- **Blind answers**: host `serious`, no score change (`022`). **Sighted answers**: scoreboards (green LCD, four digits) change on every scored answer and CPU turn; the CPU's choice is random (`061` CORRECT, `065` CORRECT, `069` SAFE, `098` CORRECT, `117` WRONG, `171` WRONG, `189` CORRECT). After the last sighted answer of a round the next round's blind intro starts at once, with no response line (`071` then `072`).
- **The shrinking zone uses the chosen avatar** (Harry `032` to `034`, Amy `504`, `505`). The static-reading claim that with Amy chosen the game show still animates Harry for her answers (`flash-flow.md` section 2.11) could not be confirmed from the captures: in `502` neither child is mid-reaction.
- **Red FPS counter**: the root text `fps` (Arial 26, `#ff0000`, top left) is never hidden. It reads "FPS" until the first platform level, then shows the platformer's `main()` calls per second, because the class compiled into `movies/e-Bug Junior Game.swf` (DoInitAction sprite 75, `__Packages.ebug.junior.PlatformGame`, `main`) still does `_root.fps.text = fps`, a line commented out in `src/ebug/junior/PlatformGame.as:201`. It stays on screen, frozen at its last value, over the quiz and the kitchen for the rest of the game (for example "71" in `117`). A port should drop it.
- **Ending (correction to `flash-flow.md` section 1.6)**: the final line is "Well done! You beat Amy.  Thank you for playing.  To play again, reload this web page." (`190`). Clicking it calls `GameShow.exit()`, which traces `exit` and calls `_root.exit()` (`src/ebug/junior/GameShow.as:478-481`), but root frame 1 of `movies/e-Bug Junior Game.swf` defines only ten hooks and no `exit` (`swf-scripts/e-Bug_Junior_Game.txt:6-38`), so nothing happens: three clicks traced `exit` three times and the screen stayed as it was (`191` to `193`). `GameController.exit()` and its `gotoAndPlay("init")` restart (`src/ebug/junior/GameController.as:325-328`) are unreachable; the game simply ends on this line.
- **Time-out**: after the 180 s clock runs out the platformer calls `endofHoverboard(END_REASON_TIME)`; `summary_page.swf` appears over the level, dimmed by a 50 % black layer, with "You ran out of time." and "click to try again" (`509`). Its Click restarts the round from its first level with the ePhone intro again, and the clock still shows "-1" from the previous attempt until its first tick (`510`; `flash-platformer.md` section 8.1).

### 6.4 Kitchen game

- Inside the game (`123` to `166`) the kitchen always shows Harry (`flash-flow.md` section 5.12). Level 0 and level 3 were played as intended (level 3: 17 correct, 0 incorrect, `164`, `165`). In levels 1 and 2 several of the script's clicks arrived while the game was not in `STATE_WAIT` (Ruffle was running slowly, section 4.5), so items went to the wrong places and both levels ran to their 60 s limit; their outro pages (`146` to `148`, `155` to `157`) are therefore a good sample of the "Items Placed Incorrectly" and "Microbial Mistakes" pages, with all four admonishment slots used in `148`. The script was fixed afterwards.
- On its own, `movies/KitchenGame.swf` runs at full speed, and the same script played all four levels cleanly (`600` to `644`), including a real sneeze caught by the tissues (`619`, `620`), hand washing (`621`), cling film (`631`) and early level ends once every item was placed.
- As-built quirk found this way: the 26 food items are single `FoodItem` objects created once (`src/ebug/junior/fridge/KitchenGame.as:1234-1285`); a level's list holds indices into them, and the sneeze and cling-film flags are set on the shared object (`:605`, `:681`, `:770`) and never cleared (`nextLevel`, `:813-872`). So an item drawn twice shares its state: in `633` the first Raw Sausages, put away without cling film on purpose, still scores as correct because its twin later in the list was cling-filmed. The flags also survive into later levels, which fits the sneeze reminder reappearing in levels 2 and 3 of both runs (`157`, `166`, `635`, `644`). A port should give each placed item its own state.
- Intro screens per level: 4 plus the tutorial for level 0, 4 for level 1, 4 for level 2, 3 for level 3 (`123` to `129`, `136` to `139`, `149` to `152`, `158` to `160`). Level 3's third screen says "You have 45 seconds this time." while the clock starts at 120 (`160`, `161`; `src/ebug/junior/fridge/KitchenGame.as:844-848`).

### 6.5 ePhone intro pages that were missed

Pages auto-advance every 5 s, and a 2x capture or a slow probe can take longer, so some pages went by uncaptured in the main run (for example level 1 kept only pages 2 and 6, `035`, `036`; see `index.md`). Every level 1 page is in the other runs (`506` page 1, `401` to `406` pages 2 to 7); the texts of all levels' pages are in `flash-platformer.md` section 8.2.

## 7. Timings

Port the "source" column. The measured column is Ruffle 0.6.0 under SwiftShader (section 4.5), from `_manifest-main.json` (main run), `_manifest-timeout.json` (Amy run, nothing else running) and one earlier main run of the same script; it confirms order and rough size, not exact speed.

| Thing | Source value | Measured in Ruffle |
|---|---|---|
| Frame rate | 25 fps (header of every SWF in the flow; the two shrinking-zone SWFs are authored at 24 but play at the host's 25) | browser repaints about 6.5 per second; about 12.6 SWF frames per second with nothing else running (typewriter, section 4.5) |
| Typewriter | one character per frame (`speed = 1`, `src/ebug/general/Talkie.as:26`, `update` `:62-77`): 25 characters per second, 57 characters in 2.28 s | 57 characters in 4.53 s alone (`_manifest-timeout.json`), 2.83 s in the earlier run; 8.13 s in the main run (a 2x capture and a second browser were running) |
| Talkie arrow after `init()` | 10 frames, 0.4 s (section 6.2) | seen during typing |
| Splash TV | sprite 58, 170 frames = 6.8 s; New Game from frame 150 = 6.0 s (`flash-flow.md` section 1.2) | standalone: blank at 1 s, static and "Tuning" at 3 s, green bars at 5 s, studio at 6.5 s, logo and New Game by 9 s (`300` to `304`) |
| Screen changes | instant `_visible` / `_alpha = 100` switches (`src/ebug/junior/GameController.as:99-160`, `:218-307`); the fade code is commented out (`:336-357`) | instant |
| Shrinking zone | 149 frames, 5.96 s (`flash-flow.md` section 4) | from about 0.3 to 1 s after the click (when the script noticed the talkie close) to the `Round is:` trace: 4.4 to 5.6 s (8.2 s when a 2x capture ran during it). Even allowing for that, shorter than 149 frames at 25 fps, which is unexplained; keep the source value |
| ePhone grow and shrink | 20 frames each, 0.8 s (`src/ebug/general/EPhone.as:16-30`; frames `grow` 10-29, `shrink` 40-59) | large to small: 0.36 to 1.4 s (probe granularity about 0.3 s) |
| ePhone intro page | `waitTime = 5000` ms, polled every 40 ms (`level_intros`, sprite 1479 frame 1, `swf-scripts/introductionToMicrobes_platformer.txt:776-797`), or a click on `invisible_button` | 4.2 to 6.9 s between pages alone; up to 22 s when a 2x capture held the script |
| Platformer loop | `setInterval(loop, 15)` (root frame 20), nominal 66.7 calls per second | median 64 calls per second alone (range 11 to 74), median 49 in the main run (range 6 to 73); the game's own trace `average FPS(...)` reads 16 to 48 (mostly 33 to 48) |
| Platform clock | 180 s, one decrement per 1000 ms of `getTimer()`, summary when it passes 0, so 181 s (`src/ebug/junior/PlatformGame.as:148`, `:558-563`) | 188.7 s from the opening capture to the summary page (includes the first tick and the 1 s poll) |
| Game show loop | `setInterval(main, 40)` (`src/ebug/junior/GameShow.as:121`) | not measured |
| Kitchen level | 60 s (120 s for level 3), or when every item is placed, then the outro at the next one-second tick (`src/ebug/junior/fridge/KitchenGame.as:144-191`, `:844-848`) | play to outro alone, every item placed: 16.1, 24.7 (includes a deliberate 15 s of idling and washing), 18.1 and 31.0 s; in the main run levels 1 and 2 hit the 60 s limit (64 s measured) |
| Kitchen bin fade | `_alpha -= 5` every 40 ms, 0.8 s (`src/ebug/junior/fridge/KitchenGame.as:621-629`) | seen |
| Kitchen hand wash | `wash_hands` 36 frames (1.44 s) plus up to 1 s to the next tick (`:161-167`) | clicks ignored for several seconds under Ruffle |
| Antibiotic white-out | `whiteout._alpha` 100, minus 10 per frame, 0.4 s | not triggered |
| Preloader | ten SWFs one after another, "Looding: <name>" and `Math.ceil(assetsLoaded * (1 / n * 100)) + " %"` (`flash-flow.md` section 1.1) | without the script's delay all ten load in about 1.5 s from localhost; with 250 ms per file the splash appeared at 7.5 s |

## 8. Visual notes for a faithful recreation

### 8.1 Screens and layout (stage pixels, 800 x 450)

- **Stage**: black (`#000000`, SWF header and HTML `bgcolor`). Anything uncovered shows black: the question board art is about 730 px wide, so the board screen has black bands at x 0 to 35 and 765 to 800 (`021`).
- **Preloader**: black; red "FPS" at about (52, 30); centred white "Looding: <name>" at y about 200 and "<n> %" under it (`001`).
- **Splash**: a wooden 1950s television (brown cabinet about `#C19561`, round dial and speaker grille on the right) on a pale green floor under a pale blue sky. Its screen goes from dark, to static with "Tuning" (Verdana Bold 30, `#00ff00`) and green bars, to the studio, to the e-Bug logo (yellow-green "e-BUG" on a blue splat) with a glossy blue "New Game" button (Verdana Bold 33 white) at about (197 to 328, 240 to 287) (`300` to `305`, `005`).
- **Studio** (cutscene and game show): pale blue wall with light blue and lavender "circuit" stripes, dark blue cogs, black spotlights top left and top right; a purple and pink "e-Bug" arch with yellow bulbs behind the host (white lab coat, yellow bow tie, glasses, silver microphone) at a purple podium with a blue e-Bug smiley; two contestant podiums (pink tops `#FFA6D0`, purple bodies `#B059D1`) with green LCD scoreboards (`#61D346` digits) for Amy (centre, x about 460 to 560) and Harry (right, x about 600 to 690); dark checkered floor (`006`).
- **Talkie**: speaker box "Gameshow Host" (blue `#5994C0`, white 2 px border) at (20, 308) to (213, 335) in the game show, 5 px further left in the cutscene (placed at (15, 307.5) against (20, 308)); under it a translucent dark panel with a white border from (20, 337) to (780, 447); white text from (37, 358), at most two lines; the white arrow at about (730 to 757, 378 to 408) (`022`).
- **Question board**: full-screen blue microbe-pattern background (`#027AB3` as area colour); "Question N" in white at the top left (85, 40), the question under it, "10 Points" and a silver stopwatch at the top right (650 to 725); three stacked glossy blue buttons (face `#6CC3FE`, dark blue border) centred at x 400, y 209, 298 and 388, about 216 x 73, labelled "Agree", "Don't Know", "Disagree" in white bold (`021`).
- **Details form**: the same blue microbe background; white labels "Nickname", "Age", "email address" at x 92, y 44 / 116 / 196; white input boxes with black borders at x 397 (310 px wide, age 58 px); "Submit" button about (398 to 612, 276 to 350) (`014`).
- **Shrinking zone**: pale blue wall with the circuit stripes, three spotlights, a large red and yellow shrink ray top right, the child on a red and white target platform at centre bottom, black and white radial floor (`034`). The shrinking SWFs hold only the child; the room is the game show's `shrinking_zone` clip (`325`, `327`).
- **Platform levels**: one flat orange background `#FF9900` for every level (shape 1495, `flash-platformer.md` section 8.1); HUD: clock top centre (black, about (335, 18) to (440, 40)), green LCD score top right (675, 14), three hearts at x 656 / 699 / 743, y 72, and the small ePhone bottom right (about 696 to 789, 268 to 445) with the goal picture, the mode icon and six tick boxes (2 rows of 3). During intros the ePhone grows, turns landscape and covers about x 41 to 773, y 30 to 414, with the host's head bottom left and the page text on the right (`506`, `038`). The phone's grow and shrink animation rotates it (`110`, `182`).
- **Kitchen**: yellow walls (`#FFF697`), mint green wall cupboards and counter (`#80BB9E`, top `#96DAB8`), a pale blue open fridge (`#9ED3F0`) with three shelves over two drawers and door shelves, blue bowl, pink tissue box, cling film, soap and sink on the counter, black and white checkered floor, pedal bin bottom right; clock top right in Verdana Bold 20 `#20648c` (`130`). Intro screens are a separate, dimmed kitchen picture with Amy at the counter and centred white text, Click button at (282.7, 335.4) (`123`); outro pages are a white rounded panel with a black border over a near-black background, Click button at (292.2, 351.9) (`133`).
- **Summary page** (death or time-out): the same white panel over the level, which a 50 % black layer turns from orange to brown (`509`); on its own the surround is olive `#666600`, that layer over the SWF's `#cccc00` stage (`317`).

### 8.2 Text fields (read from the SWFs' `DefineEditText` tags)

All are device fonts (section 4.4). Size is the field's font height in pixels.

| Field (SWF, sprite) | Font, size, colour, alignment | Box (w x h) |
|---|---|---|
| Loader `loading_text`, `percentage_text` (`e-Bug Junior Game.swf`, sprite 60) | Arial Bold 25, white, centred | 491 x 32, 104 x 32 |
| Root `fps` (`e-Bug Junior Game.swf`) | Arial 26, `#ff0000`, left | 375 x 36.5 |
| Talkie `statement_text_field` (`eBugGameShow.swf` sprite 22; same in `cutscene_introduction.swf` sprite 844) | Arial 20, white, left, multiline, word wrap | 667 x 79 |
| Talkie `speaker_box` | Arial 20, white | 170 x 26 |
| Board `question_heading` (`eBugGameShow.swf` sprite 77) | Verdana Bold 22, white | 186 x 31 |
| Board `question_body` | Verdana Bold 16, white, multiline | 556 x 88 |
| Board `point_value` | Verdana Bold 16, white, right | 131 x 23 |
| Form labels (`cutscene_introduction.swf`) | Verdana Bold 26, white | 230 / 104 / 240 wide |
| Form inputs | Verdana Bold 26, black, editable | 312 (age 58) x 36 |
| Splash "Tuning", "New Game" (`splash.swf`) | Verdana Bold 30 `#00ff00`; Verdana Bold 33 white; centred | 133 x 40; 238 x 44 |
| ePhone intro text (`level_intros.swf`, copies in the platformer) | Arial 10, white, multiline (drawn about 2.4 times larger inside the grown phone) | 104 x 100 |
| Platform `timeLeft` | Arial 16, black, `<b>N</b>` (`flash-platformer.md` section 8.1) | 104 x 22 |
| Kitchen `clock` (`kitchen_game_main.swf`) | Verdana Bold 20, `#20648c`, centred | 110 x 35 |
| Kitchen intro `text0` to `text11` (`kitchen_game_intro_level_N.swf`) | Verdana Bold 20 (23 for "Wrong!"), white, centred | up to 622 wide |
| Kitchen outro rows (`kitchen_game_outro.swf`) | Verdana 20, black, centred; "X" and "=" in Verdana Bold | |
| Summary `text0`, `text1` to `text4` (`summary_page.swf`) | Verdana Bold 20 / Verdana 16, black, centred | 648 / 556 wide |

### 8.3 Palette (sampled from the captures)

| Where | Colour |
|---|---|
| Platform background | `#FF9900` |
| Scoreboard LCD digits (game show and platform HUD) | `#61D346` |
| Hearts | about `#E35E5E` |
| Talkie speaker box | `#5994C0` |
| Question board and form background, base blue | about `#027AB3` |
| Glossy blue buttons: face, highlight | about `#6CC3FE`, `#DAF0FF` |
| Podium tops, bodies | `#FFA6D0`, `#B059D1` |
| Kitchen wall, counter, counter top, fridge | `#FFF697`, `#80BB9E`, `#96DAB8`, `#9ED3F0` |
| Kitchen clock text | `#20648C` (from the SWF) |
| Shrinking zone wall, target red, floor dark and light | about `#94BBDD`, `#EB403D`, `#424242` and `#EBEAEB` |
| Summary and outro surround when standalone | `#666600` |
| Splash New Game button | about `#66C2FE` |

The sampled values are Ruffle's anti-aliased output at single points; take exact colours from the SWF shapes when extracting art.
