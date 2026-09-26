# Super Microbe World remake: design reference

The single authoritative design reference for the browser remake of **Super Microbe World** (the e-Bug Junior Game, 2007-2009 Flash, AS2 / SWF 8, 800 x 450 at 25 fps). Everything an engineer needs to port a screen is meant to be here: rules, constants, formulas and algorithms are reproduced, not just cited. Where a surveyor's analysis goes deeper (ASCII level maps, full export lists, frame-script dumps), this file says where.

Status: written 2026-09-26 from the Flash, Unity and documentation surveys and the Ruffle capture survey (`reference/analysis/flash-ruffle.md`, 340 captures in `reference/captures/`, described one by one in `reference/captures/index.md`). Ruffle 0.6.0 ran under SwiftShader at about half speed, so its timings confirm order and rough size only; items that still need a measurement are listed in section 12.6 and marked **[Ruffle]** where they appear.

`web/NOTES-platformer-decisions.md` is the platformer engine agent's working log. Its content is folded in here (sections 3, 9, 10 and 12); where the two disagree, this file wins, and the engine log should be updated to match. **Where this file overrides the engine log**: (1) the +3 "bullet hits bad microbe" points are to be awarded (10.1 #18; the engine keeps them dead); (2) L4 and L7 get composed Patty and Iggy phone portraits (10.1 #19; the engine keeps the blank and Slurm pictures). Everything else in the engine log stands.

## Contents

1. Sources and precedence
2. Game flow and round structure
3. Platformer
4. Levels
5. Kitchen game
6. Game show and quiz
7. Text and translations
8. Assets
9. Flash vs Unity differences and decisions
10. Bugs fixed (and bug candidates)
11. Decisions and open questions
12. Engine porting notes (timing)
13. Verification log (completeness check against the sources; section 1.4 lists every source file and its status)

---

## 1. Sources and precedence

### 1.1 Precedence

1. **The 2009 Flash original is canonical.** Source of truth, in order: the AS2 source (`reference/Junior_Game/src/`), the level XML (`reference/Junior_Game/levels/`), then the compiled SWFs (`reference/Junior_Game/movies/`) for timeline scripts, art, bounds and frame labels. The shipped `introductionToMicrobes_platformer.swf` was built from this source: every numeric literal in its 25 compiled platformer classes matches the `.as` files (`reference/analysis/flash-platformer.md` header). The copy that actually runs is the main movie's (`movies/e-Bug Junior Game.swf` DoInitAction sprite 75, `__Packages.ebug.junior.PlatformGame`), because the first SWF to register a class wins; it differs from the `.as` only in debug lines (the `_root.fps.text = fps` write, as in `PlatformGame.as.bak2:201`), see 1.4. The kitchen SWF was built 2 s after its source was saved and matches it (`flash-flow.md` §0.3).
2. **Two Flash builds exist; never blur them** (`flash-flow.md` §0.2):
   - **Build A** is the repo: `src/`, `levels/alpha_*`, `movies/` (main SWF dated 2009-07-03). It is the build used in the May-August 2009 evaluation: its quiz questions match the paper's Table 2 word for word (`eval:101-121`). It has the **blind round**, English only.
   - **Build B** is the later live build, known only from the documentation (`doc:418-704`, `doc:1594-2118`): no blind round (`doc:156`, `doc:582-592`, `doc:1727`; `eval:36`), a `language` flashvar, `Translations.as` (184 strings, not recovered). None of its code is in the repo. Its quiz and conversation XML survive as the Unity copies in `Assets/Resources/TextFiles/` (11 languages).
   - Build A is the behaviour to port; build B tells us what the author changed afterwards (blind round removed, last-question CPU turn, translations).
3. **The 2013-14 Unity remake is secondary.** Use its assets and data only where they match Flash or where Flash has nothing. It skips the kitchen game entirely, re-lays out every level, and changes goals, timers and physics (section 9). Do not port its Heroku tracking (`Assets/Scripts/DBconnector.js`).
4. **Documentation** (`reference/docs/junior-game-documentation.md`) describes build B and is wrong in several places (section 3.27 lists the contradictions). The code wins.
5. **The 2011 evaluation paper** (`reference/docs/farrell-2011-evaluation.md`) gives design evidence: 50% drop-out per level (`eval:78-91`), the quiz rounds hurt playability (`eval:135`), the milk/Lucy mechanic taught best (`eval:131`), and "the junior game will be split into individual levels" (`eval:135`).

### 1.2 Citation conventions

- `src/...`, `levels/...`, `movies/...` are relative to `reference/Junior_Game/`.
- A bare class file name means its path in `src/ebug/`: `PlatformGame.as`, `PlayerEntity.as`, `GameEntity.as`, `GoodMicrobe.as`, `BadMicrobe.as`, `LucyLactobacillus.as`, `SuperInfection.as`, `BulletEntity.as`, `CameraFlashEntity.as`, `MilkGlassEntity.as`, `PortalEntity.as`, `AntibioticPickup.as`, `AntibioticBombEntity.as`, `SoapPickup.as`, `Goal.as`, `Event.as`, `GameController.as`, `GameShow.as`, `GameShowRound.as`, `GameShowQuestionLoader.as`, `Question.as`, `ShrinkingZone.as`, `CutSceneXMLParser.as`, `TileDefinitionParser.as` are in `src/ebug/junior/`; `KitchenGame.as`, `FoodItem.as` in `src/ebug/junior/fridge/`; `ParticleSystem.as`, `Entity.as`, `EntityBox.as`, `Vector3.as`, `Game.as`, `Level.as`, `MapBuilder.as`, `Constants.as`, `Player.as`, `ClipLoader.as` in `src/ebug/`; `EPhone.as`, `Talkie.as` in `src/ebug/general/`; `GeneralFunctions.as` in `src/ebug/util/`.
- `doc:N` = `reference/docs/junior-game-documentation.md` line N. `eval:N` = `reference/docs/farrell-2011-evaluation.md` line N.
- Analysis files (all in `reference/analysis/`) are cited by short name and section: **[P §n]** `flash-platformer.md`, **[F §n]** `flash-flow.md`, **[L §n]** `flash-levels.md`, **[S §n]** `flash-swf-assets.md`, **[UL §n]** `unity-logic.md`, **[UA]** `unity-assets.md`, **[R §n]** `flash-ruffle.md`, **[PD]** `web/NOTES-platformer-decisions.md`. Captures are cited by file name in `reference/captures/` (for example `038-level1-opening.png`).
- SWF timeline code: `movies/<file>.swf` plus sprite id and frame (decompiled in `reference/analysis/swf-scripts/<key>.txt`).
- Unity: `Assets/...` paths; scripts as `File.js:NN` under `Assets/Scripts/`.

### 1.3 Machine-readable data

| File | Contents |
|---|---|
| `reference/analysis/levels.json` | Every level parsed and resolved through the runtime palette, derived physics caps, ASCII renders, kitchen tables (generator `tools/analyse-levels.mjs`) |
| `reference/analysis/swf-inventory.json` | Every SWF: exports, labels, frame scripts, frame-1 and all-frames bounds, bitmaps, fonts (generator `tools/analyse-swfs.mjs`) |
| `reference/analysis/translations.json` | `{lang: {key: string}}`, 12 tables (generator `tools/extract-translations.mjs`) |
| `reference/analysis/unity-assets.json` | Unity texture catalogue |
| `reference/analysis/bitmaps/` | All 543 SWF bitmaps decoded |
| `web/data/levels/*.json` | Runtime level data for the port (generator `tools/convert-levels.mjs`; schema in section 4.4) |
| `web/js/platformer/data/clips.js` | Flash timelines (labels, frame scripts, per-frame bounds) for the port (generator `tools/extract-timelines.mjs`) |
| `web/data/atlas/*` | WebP atlases rendered from the SWFs through Ruffle (`tools/swf-sheet/`, `tools/build-atlas.cjs`) |

### 1.4 Source coverage (every file in `src/` and `levels/`)

Checked file by file (section 13). "Runtime" means compiled into a SWF the shipped game loads and reached by play; everything else is listed so that nobody ports it by mistake.

**Which compiled copy runs.** AS2 classes are compiled into every SWF that uses them and the first SWF to register a class wins (`if (!_global.ebug...)` guard in each DoInitAction). The main movie registers `GameController`, `Player`, `GameShow`, `ShrinkingZone`, `Talkie`, `GameShowRound`, `Question`, `GameShowQuestionLoader`, `Answer`, `Constants`, all platform classes and `ebug.util.AssetLibrary` first, so **its copies are what runs** [F §0.3]. That copy of `PlatformGame.main()` is not exactly `src/ebug/junior/PlatformGame.as`: it writes `_root.fps.text = fps` (active in `PlatformGame.as.bak2:201`, commented out in `PlatformGame.as:201`) while keeping the forward-slash `"../levels/" + nextLevel` path of `PlatformGame.as:242` (decompiled `movies/e-Bug Junior Game.swf`, `r2.fps.text = r1.fps` and `loadLevel(("../levels/" + r1.nextLevel))`). The difference is debug output only.

**`ebug.util.AssetLibrary` has no source file.** It is imported by `GameController.as:4` and `fridge/KitchenGame.as:5` but exists only compiled (main SWF DoInitAction sprite 103, `movies/KitchenGame.swf` sprite 9); its behaviour (one file at a time, `"<word>: <name>"` and `Math.ceil(assetsLoaded * (1/n*100)) + " %"`, each loaded clip hidden with `_alpha = 0`) is in 2.1 row 0 and [F §1.1].

`src/` (relative to `reference/Junior_Game/src/`):

| Files | Status | Notes |
|---|---|---|
| `ebug/junior/PlatformGame.as`, `PlayerEntity.as`, `GameEntity.as`, `Microbe.as`, `GoodMicrobe.as`, `BadMicrobe.as`, `LucyLactobacillus.as`, `SuperInfection.as`, `BulletEntity.as`, `CameraFlashEntity.as`, `MilkGlassEntity.as`, `PortalEntity.as`, `SoapPickup.as`, `WhitePickup.as`, `AntibioticPickup.as`, `AntibioticBombEntity.as`, `Goal.as`, `Event.as`, `TileDefinitionParser.as`; `ebug/ParticleSystem.as`, `Entity.as`, `EntityBox.as`, `Vector3.as`, `Vector2.as`, `Game.as`, `Level.as`, `MapBuilder.as`, `Tile.as`, `Point.as`, `Constants.as`, `ClipLoader.as`; `ebug/general/EPhone.as` | runtime (platformer) | Section 3. `Microbe.as` only adds `hasBeenPhotographed = false` and `lives` to `GameEntity` (`Microbe.as:12-18`). `WhitePickup.as` is `SoapPickup.as` with extra traces (identical logic). `Vector2` is only the unused default gravity of `ParticleSystem.as:157`; `Point` holds `screenTopLeft/BottomRight` (`PlatformGame.as:233-234`); `Tile` is the definition record built in `MapBuilder.as:73`; `Game.as:56-69` supplies `moveScreenLeft/Right` (3.23). |
| `ebug/junior/GameController.as`, `GameShow.as`, `GameShowRound.as`, `GameShowQuestionLoader.as`, `Question.as`, `Answer.as`, `ShrinkingZone.as`, `CutSceneXMLParser.as`; `ebug/general/Talkie.as`; `ebug/Player.as` | runtime (flow, quiz) | Sections 2 and 6. `Answer.as` defaults `label = "?"`, `value = 0` (`Answer.as:7-11`); only `value` is used (6.3). `Player()` defaults matter: `forename = inSex ? "Harry" : "Amy"`, `nickname = forename`, `age = 100`, `score = 0`, `playerAnswers = []`, `avatarSex` undefined (`Player.as:28-42`). |
| `ebug/junior/fridge/KitchenGame.as`, `FoodItem.as`; `ebug/util/GeneralFunctions.as` | runtime (kitchen) | Section 5. `FoodItem.clone()` exists but is never called (5.13). |
| `ebug/junior/SuperBug.as` | dead | A `Microbe` subclass (`lives = 4`, starts IDLE, its own `advance`/`act`/`beHit`/`beKilled`, `SuperBug.as:15-176`) that references an undeclared `washAway`; compiled into no SWF and never instantiated [P §1.1]. The level superinfection is `SuperInfection.as` (3.18). Not ported. |
| `ebug/junior/PlayerTile.as` | dead | Empty subclass of `Tile` (`PlayerTile.as:7-8`). |
| `ebug/junior/PlatformGame.as.bak2` | backup | Differs from `PlatformGame.as` only at lines 201 and 208 (debug text) and 242 (backslash path), see above. |
| `ebug/general/CutSceneController.as` | prototype | Compiled only into the unused `movies/cut_scene_director.swf` (the SWF that `ebug_code.as2proj` injects its classes into); a 100-tick timer that jumps to a `shrinking_zone` label (`CutSceneController.as:18-31`). The shipped cutscene is `cutscene_introduction.swf` with `CutSceneXMLParser` (2.4). |
| `ebug/DialogueDevice.as`, `ebug/EBugStrings.as` | prototype | Compiled into the unused `dialogue_tutorial.swf`, `introductionToMicrobes_comicIntroduction.swf` and `introductionToMicrobes_exitQuiz.swf`; `EBugStrings` texts are kept as `ebugStrings.<i>` in `translations.json` (7.2). |
| `ebug/LevelEditor.as` | tool | The level editor (`movies/map_builder.swf`, `movies/EBug Level Editor.swf`); it wrote the level XML (4.3) and the `<tiles>` palettes the game ignores. |
| `ebug/FridgeGame.as`, `ebug/junior/fridge/FridgeMain.as` | prototype | Older food-sorting games (`movies/fridge_game.swf`, `movies/ebug_food_sorting_game.swf`) [F §0.3]. They hold the only uses of `STATE_LEVEL_SUMMARY` (12) and `STATE_TRIGGER_WIN/LOSE` (995/996); `STATE_CLOSE` (999) is also used by `LevelEditor.as:102` (3.2). |
| `ColourSwap.as`, `EBugColouredItem.as` and the 48 `*ColouredObject.as` files (12 `Amy*`, 28 `Harry*`, 7 plain colours such as `SkinColouredObject.as`, and `MultiColouredObject.as`, whose `init()` call is commented out) | inert at run time | Unfinished avatar colour customisation. Each part class sets `eBugColour` (`"skin"` 21 times, `"pink"` 7, `"yellow"` 5, and so on) and calls `EBugColouredItem.init()`, which builds a `ColourSwap`; `ColourSwap` returns at once unless `_root.paramContainer.done` is defined (`ColourSwap.as:14-17`), and the game never creates `paramContainer`. The classes are bound with `Object.registerClass` to the child body-part symbols in the cutscene, game show, shrinking, kitchen and asset SWFs [S §5.10], so they load but change nothing. `movies/params.txt` (`skin=0xFF0000&done=true`) is its test input. Not ported (a colour picker would be new work). |
| `physics/ape/*.as` (19 classes) and `physics/ape/demos/*` (8 `.as`, 3 SWFs, `CarDemo.html`, `AC_RunActiveContent.js`) | third-party, unused | APE, Alec Cove's ActionScript physics engine (copyright 2006-2007, `APEngine.as:2`), and its demos. No game class imports it; the platformer uses `ParticleSystem.as` (3.5). |

`levels/` (relative to `reference/Junior_Game/levels/`):

| Files | Status | Notes |
|---|---|---|
| `alpha_level1.xml` .. `alpha_level10.xml` | runtime | Section 4.1. |
| `alpha_level11.xml` | orphan | Unreachable and unwinnable (4.1, 10.4 #56). |
| `tile_definitions.xml` | runtime | The only palette read (4.3 rule 5). |
| `alpha_gameshow_round1.xml` .. `_round5.xml` | runtime | Build A quiz (6.3, 6.8). |
| `conversations/en_en_introductions.xml` | runtime | Cutscene text (2.4). |
| `gameshow_round1.xml`, `gameshow_round2.xml`, `gameshow_round1_questions.xml`, `realgameshow_round1-3.xml`, `alpha_realgameshow_round3.xml`, `Copy of realgameshow_round1.xml`, `Copy of realgameshow_round2.xml` | drafts | Earlier quiz files; `gameshow_round2.xml` is a one-question "Treatment of infection" stub chained to `exit`; `gameshow_round1_questions.xml` is a bare `<questions>` list with no round wrapper. Not read by any code. |
| `level1.xml` .. `level5.xml`, `lacto.xml`, `super.xml`, `antibiotic.xml`, `spare level.xml`, `test.xml`, `test2.xml`, `testbig.xml`, `apetest.xml`, `demo.xml`, `e.xml`, `face.xml`, `sandy.xml`, `nancy.xml`, `new.xml`, `blank.xml`, `Hello.xml`, `david.as`, `sandy.level.as`, `davidtest,xml.txt`, `desired xml format.as`, `xml format.as`, `tilesformat.xml` | legacy and test levels | None is reachable. `level1.xml` is a near copy of L4 and `level2.xml` of L2; `antibiotic.xml` (21 x 13, no goal), `super.xml` (16 x 9, antibiotic goal `6,14,6`) and `lacto.xml` (58 x 13, yoghurt goal `7,14,2`) are the commented-out debug defaults at `PlatformGame.as:132,134,135`. The rest use older palettes (`blue_box`/`red_box`, sliced `kitchen_*` art) and often lack goals, a player start or a portal. Full table: [L §4.2 item 12]. `Hello.xml` and `desired xml format.as` are the same pre-release format sketch; `tilesformat.xml` is a bare 3-tile `<tiles>` block (`red_box`, `blue_box`, `green_box`). |
| `plan.txt`, `plan2.txt` | design notes | `plan.txt` is an earlier 7-level plan (`1 kitchen 3 lucys` ... `5 any 1 slurm photo`, `6 skin kill all bad`, `7 body kill all iggy`); `plan2.txt` is the alpha plan quoted in 4.1. |

---

## 2. Game flow and round structure

### 2.1 Screens in order (build A as built, then the port)

| # | Screen | Flash behaviour | Source | Port |
|---|---|---|---|---|
| 0 | Loader | Main SWF preloads 10 SWFs **one at a time** (`junior_game_assets`, `splash`, `eBugGameShow`, `introductionToMicrobes_mainMenu` (never shown), `cutscene_introduction`, `introductionToMicrobes_platformer`, `harry`, `amy`, `summary_page`, `KitchenGame`). Text `"Looding: <name>"` (typo) and `Math.ceil(assetsLoaded * (1/n*100)) + " %"`. A red debug `fps` text (Arial 26, `#ff0000`, top left) is never hidden: it reads "FPS" until the first platform level, then the platformer's `main()` calls per second (the compiled class still does `_root.fps.text = fps`, commented out in `PlatformGame.as:201`), frozen over the quiz and kitchen afterwards [R §6.3]. Every sub-SWF runs its frame 1 while hidden (game show constructor, cutscene XML, kitchen level 0), see 2.8 for the bugs this causes. | `GameController.as:60,63-97,99-113`; `movies/e-Bug Junior Game.swf` root frame 1; [F §1.1] | Load lazily per area; no preload side effects; progress bar; no FPS text. |
| 1 | Splash | Animated wooden 1950s TV on a pale green floor under a pale blue sky (sprite 58, **170 frames = 6.8 s**); its screen goes dark, then static with "Tuning" and green bars, then the studio, then the e-Bug logo [R §8.1]; `NewGame` button ("New Game", export `button_new_game`) appears at **frame 150 (6.0 s)**; frame 170 `stop(); NewGame.onRelease = function(){ _root.newGame(); }`. | `movies/splash.swf` sprite 58; [F §1.2] | Same timing, TV shows the "Super Microbe World" title instead of the e-Bug logo (branding, 11.2). Add Continue / Level select / Settings once there is progress (11.1). |
| 2 | New game | `player = new Player(); player.forename = "david"` (debug leftover, never shown). | `GameController.as:118-129` | Fresh run state. |
| 3 | Cutscene | Host lines 0-2 in the talkie, avatar choice, host line 4, details form, host line 8, then `_root.startQuizShow()`. | `movies/cutscene_introduction.swf` root frames 1-30; [F §3]; section 2.4 | Form keeps the nickname only (11.2). |
| 4 | Rounds 1-5 | Quiz, action, quiz per round (2.2, 2.3). | `GameController.as:131-160,206-263`; `GameShow.as` | Explicit round table (2.2). |
| 5 | Ending | Host line only: win `"Well done! You beat " + cpu.nickname + ".  Thank you for playing.  To play again, reload this web page."` (always "Amy": `cpu = new Player()` (`GameShow.as:73`) never gets a nickname, and `Player()` defaults `forename` to `inSex ? "Harry" : "Amy"` and `nickname` to `forename` (`Player.as:30-32`), so this is independent of `cpuName` and would still say "Amy" if the preload bug were fixed; the port takes the name from the CPU child), otherwise, **including a tie**, `"At the end of the game, I'm sorry to say you lost.  Thank you for playing.  To play again, reload this web page."`. Click calls `GameShow.exit()` -> `_root.exit()`, but the main SWF's root frame 1 defines no `exit` hook, so **nothing happens**: the game simply ends on this line (Ruffle `190`-`193`, [R §6.3]; this corrects [F §1.6]; `GameController.exit()` and its `gotoAndPlay("init")` at `GameController.as:325-328` are unreachable). **No winner screen.** | `GameShow.as:451-459`; `GameController.as:325-328`; [F §1.6] | Winner screen with both scoreboards (GOAL_PROMPT scope; Unity added one, [UL §6]), Play again (real restart), Level select. Tie rule: open question 11.3. |

### 2.2 Round table (replaces the `round == 2` counter trick)

The Flash controller finds the kitchen with `if (round == 2) { round++; showKitchen(); } else { showHoverboard(); }` (`GameController.as:206-216`), which works only because `round` is incremented lazily inside `nextHoverboardRound()` after the test and only from the second platform round (`:238-263`); the start levels are pushed at `GameController.as:65-69` (`"alpha_level1.xml"`, `"alpha_level5.xml"`, `"alpha_level8.xml"`, `"NULL_KITCHEN_GAME"` (never read), `"alpha_level10.xml"`). The port uses an explicit table:

| Round | Quiz file (build A) | Live file (build B, Unity copy) | `round_id` | Topic (`<name>`) | Evaluation name (`eval:85-89`) | Questions | Action | Chain (`next=`) |
|---|---|---|---|---|---|---|---|---|
| 1 | `levels/alpha_gameshow_round1.xml` | `<lang>_gameshow_round1.xml` | 0 | All About Microbes | Introduction to Microbes | 4 | platform | L1 -> L2 -> L3 -> L4 -> exit |
| 2 | `alpha_gameshow_round2.xml` | `..._round2.xml` | 1 | Good and Bad Bugs | Harmful Microbes | 4 | platform | L5 -> L6 -> L7 -> exit |
| 3 | `alpha_gameshow_round3.xml` | `..._round3.xml` | 2 | Good Microbes | Useful Microbes | 2 | platform | L8 -> L9 -> exit |
| 4 | `alpha_gameshow_round4.xml` | `..._round4.xml` | 3 | Food Hygiene | Hygiene | 5 | kitchen game, sub-levels 0-3 | none |
| 5 | `alpha_gameshow_round5.xml` | `..._round5.xml` | 4 | Treatment of infection | Antibiotics | 6 | platform | L10 -> exit |

- `alpha_level11.xml` is reachable from nothing, has no `level11` intro label, and cannot be won (6 kills needed, 5 bad microbes placed) [L §4.1]. Not ported as a level (optional bonus only if fixed, 11.3).
- The first platform round does not read `hoverboardLevels[0]`: the platformer's frame 10 passes an undefined `level`, and `PlatformGame.initialiseGame` falls back to `"alpha_level1.xml"` (`PlatformGame.as:133`). Same result.
- The `<next_round>` element chains the quiz files; `exit` ends the game (`GameShow.as:445-476`).
- `web/data/levels/index.json` already carries this table (`rounds[]`, `order[]`, `unused[]`).

### 2.3 One round, step by step

**Build A (blind round on; the evaluation build)** [F §1.5]:

1. **Blind intro**: host lines `<intro_text><blind>` one at a time in the talkie (6.4).
2. **Blind questions**: for each question the host says `"Question number " + (questionId+1) + ": " + text + "..."`; click shows the board; the player answers; host echoes the choice plus `"\nBecause this is a Blind question round, you'll find out how you did later."`. No score, no CPU turn.
3. Host: **"Step right this way and prepare to enter the world of microbes!"** (`GameShow.as:289`). Click: **shrinking zone** (2.5), 149 frames, about 6.0 s.
4. **Action**: platform level chain (2.6) or the kitchen game (section 5).
5. **Sighted intro**: `<intro_text><normal>` lines (`GameShow.startNonBlindRound()`, `GameShow.as:421-439`, called from `GameController.as:273-281,300-307`).
6. **Sighted questions**: the same questions, now scored, each followed by a CPU turn, **except the last question**, after which `nextRound()` runs at once: no host feedback and no CPU turn for it (`GameShow.as:293-298`).
7. `nextRound()` submits the research form (not ported) and loads the next quiz file, starting its blind intro, or ends the game.

**Build B (live; blind round removed)** [F §1.9]: splash, cutscene, "Step right this way", shrink, platform round 1, then quiz round 1 (sighted only, normal intro "Well done, you're a hoverboard natural!"), questions with CPU turns including the last (`pickCpuResponseSpecialCaseLastQuestion`, `doc:1911-1915`), the last CPU line leads straight to the shrink, platform round 2, quiz round 2, and so on. After round 5's quiz, the ending line.

**Port** (decisions 11.1): blind round **off** by default (build B flow above), switchable on in Settings ("Warm-up questions", build A flow). The quiz after each action asks **that same round's** questions (the documentation's `endOfKitchen` still calls `startNonBlindRound()` while `endofHoverboard` calls `nextRound()` (`doc:650-673`); under build A semantics that would ask the wrong round, so the round/topic pairing of the evaluation (`eval:44-72`, Figure 1) decides: kitchen, then round 4 Food Hygiene). The last question of every round gets its host feedback and CPU turn (build B).

```
Port flow (blind off):
Loader -> Splash [New Game] -> Cutscene (3 host lines, pick Amy/Harry, 1 line, nickname form, 1 line)
 -> for r in 1..5:
      "Step right this way and prepare to enter the world of microbes!" -> shrinking zone (149 frames)
      -> action: r in {1,2,3,5}: platform chain (fail -> summary card -> retry, 2.6); r = 4: kitchen levels 0..3
      -> sighted intro lines -> questions 1..n, each: host reads, board, answer, host feedback, CPU turn
 -> ending line -> winner screen [Play again] [Level select]
Blind on: insert "blind intro -> blind questions" before "Step right this way" in every round.
```

### 2.4 Cutscene detail

`movies/cutscene_introduction.swf` (59 frames, root labels `init` 1, `start_intro` 10, `choose_avatar` 20, `get_details` 30). Text from `levels/conversations/en_en_introductions.xml` (hard-coded path), parsed by `CutSceneXMLParser.as:44-54` (every `<statement>` text in order). Root frame 1 constants: `choose_avatar = 3`, `get_details = 5`, `finished = 9`, `stringCounter = 0`. Talkie at (15, 307.5), speaker `"Gameshow Host"`.

```
nextLine():   // root frame 10; called at start_intro and as the talkie callback
  if stringCounter == choose_avatar: gsh.gotoAndPlay("stop"); stringCounter++; gotoAndPlay("choose_avatar")
  elif stringCounter == get_details: gsh.gotoAndPlay("stop"); gotoAndPlay("get_details")
  elif stringCounter == finished:    gsh.gotoAndPlay("stop"); exit()          // exit() = _root.startQuizShow()
  else: gsh.gotoAndPlay("excited"); talkie.init("Gameshow Host", strings[stringCounter], "start",
                                                 "wait_for_click", null, this, "nextLine"); stringCounter++
```

| Index | Build A (`levels/conversations/en_en_introductions.xml`, 9 lines) | Live (`Assets/Resources/TextFiles/conversations/en_en_introductions.xml`, 10 lines) | Use |
|---|---|---|---|
| 0 | Hello and welcome to the e-Bug Game Show! | same | host line (port: "Super Microbe World Game Show", 11.2) |
| 1 | Soon you will be visiting the weird world of the microbe. | same | host line |
| 2 | But first, who do you want to play as? | same | host line |
| 3 | Excellent! | (empty) | never shown (index 3 opens the avatar screen and is skipped) |
| 4 | Tell me a little about yourself: | same | host line after the avatar choice |
| 5 | Nickname | same | form label |
| 6 | Age | same | form label (dropped in port) |
| 7 | email address | same | form label (dropped in port) |
| 8 | Allright, Lets begin by seeing what you know about microbes. | You don't need to give us this information, but if you do you'll be able to take part in competitions and hear about new versions of the game. | build A: host line after the form. Live: privacy line (not used by the port, 11.2) |
| 9 | (none) | Let's see what you know about microbes. | live closing line (build A code would never show it: `finished = 9`) |

- **Avatar choice** (frame 20): invisible buttons `amyButton` at (436.8, 99.7) and `harryButton` at (584.15, 123.7), both scaled 2.68 x 5.26. Hover: hovered child plays `happy`, the other `disappointed`; roll out: both `idle`. Click: Amy sets `nickname = "Amy"; sex = false; avatarSex = false`; Harry `"Harry"`, `true`, `true` (`Player.MALE = true`, `Player.FEMALE = false`, `Player.as:21-22`). Back to `start_intro`, host says line 4.
- **Form** (frame 30): labels at x 92.5, y 43.7 / 116.4 / 195.75; inputs at x 400.6: `nickname_input` (310 px wide, pre-filled with the chosen name), `age_input` (56 px, pre-filled `"2"`), `email_input` (pre-filled `"dont@have.one"`); `submit_button` "Submit" at (398.65, 275.95). Submit sets `nickname`, `age = parseInt(...)`, `email`; no validation.
- **Port**: nickname only (pre-filled with the avatar's name, max 25 characters, empty falls back to the avatar's name), kept in memory and optionally in `localStorage`; no age, no e-mail, no submission. Closing line after the form: with blind rounds on, build A line 8 with its spelling corrected ("All right, let's begin by seeing what you know about microbes."); with blind rounds off (default) the quiz comes after the level, so neither build A line 8 nor live line 9 ("Let's see what you know about microbes.") fits, and the port uses a new neutral English line (open question 11.3 item 14).
- Nickname use: host speech `"<nickname>, you chose Agree."`.

### 2.5 Shrinking zone

- `ShrinkingZone.as` (library clip `shrinking_zone` in the game show) loads `movies/shrinking_harry.swf` and `movies/shrinking_amy.swf` (`:14-27`). Each holds one clip `avatar` (Harry sprite 192, Amy sprite 208), **150 frames**: frame 1 (`start`) sets `midAnimation = true` and stops, frame 150 sets `midAnimation = false` and stops. Authored at 24 fps, played at the host's 25 fps: **149 frames, about 6.0 s**. Placed at scale 0.7174 at (508.25, 390.1).
- Visual: the chosen child on a red and white target platform, studio spotlights, a large red shrink ray top right.
- `GameShow.showShrinkingZone()` (`GameShow.as:388-412`): shows the zone and the real player's avatar (`avatarSex == MALE` gives Harry), plays it, hides studio and talkie, polls `isFinishedAnimation` every 40 ms; when `midAnimation == false` it rewinds and calls `_root.showHoverboardOrKitchen()` (`ShrinkingZone.as:57-74`).
- Ruffle confirms the **chosen** child is shrunk (Harry `032`-`034`, Amy `504`, `505`) [R §6.3].
- Quirks (not ported): the zone's `userAvatar` is always Harry (constructor runs at preload, 2.8); Amy's frame 150 rescues the poll through `forceReassignAvatar` (`ShrinkingZone.as:76-82`); Harry's frame 1 does `_alpha -= 50` each time it is entered, hence `_alpha = 100` in `showShrinkingZone`.
- Port: play the chosen child's 149-frame shrink, then an iris into the level intro. Unity cut the clip at 3.5 s and shook the camera ([UL §6]); the port plays it in full (skippable after first viewing).

### 2.6 Platform chain: complete, fail, restart

| Exit reason | Flash result | Source |
|---|---|---|
| `END_REASON_COMPLETE` (2): portal entered on a level whose `next == "exit"` | Hide the platformer, show the game show, `gameShow.startNonBlindRound()` | `PlatformGame.as:1231-1242`; `GameController.as:283-308` |
| Portal entered, `next` is another level | `initialiseGame(player, level.next, tilesList)`: next level, new `PlayerEntity` (3 lives, timer 180), **score kept** | `PlatformGame.as:1245` |
| `END_REASON_DIE` (1): lives reach 0 | Summary page: `text0` "You Died!", `text1` "click to try again"; click calls `restartHoverboardRound()` | `GameController.as:283-308` |
| `END_REASON_TIME` (0): timer passes 0 | Summary page: `text0` "You ran out of time.", `text1` "click to try again"; same restart | same |

- **Restart** is `PlatformGame.restartRound()` = `initialiseGame(roundStartPlayer, roundStartLevel, ...)` (`PlatformGame.as:187-192`); `roundStartLevel` is only set in `nextHoverboardRound()` (`GameController.as:249-255`), so **dying on any level restarts the round from its first level** (dying in L3 sends you to L1). Score kept; lives and time reset.
- In Ruffle the summary page appears over the frozen level, dimmed by a 50% black layer (orange turns brown), and the retry replays the round's first level **with its ePhone intro**; the clock shows "-1" from the previous attempt until its first tick (`509`, `510`) [R §6.3].
- Summary page (`movies/summary_page.swf`, 139 frames): `text0` at (82, 21.9) (bold heading, static "Things to remember"), `text1`..`text4` below, `click_button` "Click" at (292.2, 351.9), 218.6 x 78.9, calling `callObj[callFunc]()`. Yellow-olive `#cccc00` background. The documentation's claim that it summarises kitchen levels (`doc:393`) is wrong.
- **Port**: restart **the failed level**, score kept (engine brief; `platformScene` exposes `params.onGameOver(result)` so the flow controller could restore round restarts) [PD "Differences in flow"]. Rationale: the evaluation lost 50% of players per level (`eval:78`); replaying up to four levels after one death is the likeliest cause. Logged in 9 and 11.
- Level complete card (port addition): score, photos, time, lives; Next level / Play again / Quit [PD].

### 2.7 Kitchen hand-off

`GameController.showKitchen()` (`GameController.as:218-226`) only makes the preloaded kitchen visible; the kitchen ends with `player.score += overallScore; _root.endOfKitchen(player)` (`KitchenGame.as:802-811`), and `endOfKitchen` only traces the score then calls `gameShow.startNonBlindRound()` (`GameController.as:273-281`). There is no fail state.

### 2.8 Flow bugs in the original (not ported)

All from [F §8] unless noted:

1. Game show constructed during preload: the player avatar, podium and CPU name are fixed to the **male branch**: player = Harry (right podium), CPU = Amy (middle podium), `cpuName = "Amy"`, even when the child chose Amy (`GameShow.as:52,85-104`). Inferred from code plus a preload trace, not watched end to end. **Port**: the chosen child is the player, the other child is the CPU and is named after that child.
2. `player.playerAnswers[...] = ...` writes silently fail (`GameShow.as:107-109,234-269`); research data used `roundAnswersBlind/Sighted` instead. Not ported.
3. `showRoundText` leaves `busy = true` when switching to questions (`GameShow.as:147-166`): after the **last intro line of every quiz half the first click does nothing** and a second click is needed (the second `nextRoundText()` clears `busy`, then `main()` asks the question). Seen at the end of all ten quiz halves in Ruffle, and in the Amy run: as-built behaviour, not a Ruffle artefact [R §6.1]. **Port**: one click goes to the first question.
4. The kitchen is handed a throwaway `new Player()` (`movies/KitchenGame.swf` root frame 1): the kitchen avatar is always Harry, and kitchen points never reach the real score (`KitchenGame.as:806`, `GameController.as:273-281`).
5. The ending click does nothing (`_root.exit` is not defined); `GameController.exit()` (`GameController.as:325-328`), which would re-run root frame 1, is unreachable [R §6.3].
6. Loading word "Looding" (`GameController.as:60`); FPS counter left visible.
7. `introductionToMicrobes_mainMenu.swf` preloaded but never shown; its buttons call `gotoGameScreen`, which is commented out (`GameController.as:336-375`).
8. `timestamp()` uses the day of the week and no padding (`GameController.as:162-168`); only used for the research ID.

---

## 3. Platformer

The hoverboard platform game: `PlatformGame.as` (state machine, event dispatcher, level build, render, scroll, HUD, input), `ParticleSystem.as` (a Jakobsen-style Verlet particle system on axis-aligned boxes; the APE library in `src/physics/ape/` is **not used**), and the entity classes. Full analysis: [P]. Port: `web/js/platformer/` ([PD] "Module layout").

### 3.1 Key numbers

| Quantity | Value | Source |
|---|---|---|
| Main loop | `setInterval(loop, 15)` ms calling `game.main()` | platformer SWF root frame 20 (label `main`); `GameController.as:259,270`; `doc:745` |
| Logic/physics step | one UPDATE per two `main()` calls (UPDATE and RENDER alternate), so **30 ms per step** in practice | `PlatformGame.as:613-616,1163`; [P §1.4] |
| Physics `timeInterval` | 30/1000 = 0.03 s, so `dt^2 = 0.0009` | `PlatformGame.as:153`; `ParticleSystem.as:153` |
| Constraint iterations | 1 | same |
| Gravity | (0, 3000) px/s^2 = **2.7 px/step^2** | `PlatformGame.as:150` |
| Drag (velocity multiplier per step) | 0.95 | `PlatformGame.as:151`; `ParticleSystem.as:324` |
| Force friction | `force.x *= (abs(force.x) > 10) ? 0.9 : 0.8` | `ParticleSystem.as:371-375` |
| Speed clamp `maxChange` | per axis, min over half-sizes of non-exempt boxes: y always 25; x 25, 23.98 (Iggy levels) or 21.158 (Lucy levels) px/step | `ParticleSystem.as:221-233,338-347` |
| Tile | 50 px (`Constants.TILE_WIDTH`) | `Constants.as:22` |
| Stage | 800 x 450 | `Constants.as:23-24` |
| World bounds | min (0, -100), max (cols*50, 450) | `PlatformGame.as:260-261` |
| Player box | 49 x 100 (forced) | `PlatformGame.as:387` |
| Player move force | `gravity.y * 1.5` = 4500 per key tick | `PlatformGame.as:396` |
| Player `jumpForce` | `gravity.y * 8` = 24000; a jump adds `-3 * jumpForce` = -72000 | `PlatformGame.as:397`; `PlayerEntity.as:416` |
| Jumps | `MAX_JUMPS = 2` (double jump); `JUMP_COUNT = 5` unused | `PlatformGame.as:51-53` |
| Lives | 3 per level (reset per level and on restart) | `PlatformGame.as:381`; `PlayerEntity.as:125` |
| Level timer | 180 s (`secondsLeft = 180`), wall clock | `PlatformGame.as:148,558-569` |
| Scroll margins | screen x 250 (left) and 450 (right) | `PlatformGame.as:45-46,1029-1050` |
| Microbe walk | 10 px per UPDATE (teleport) | `GoodMicrobe.as:24`; `BadMicrobe.as:28`; `GameEntity.as:227` |
| Microbe idle think | 5 UPDATEs (`defaultThinkTime`) | `GameEntity.as:48` |
| Bullet | box 50 x 25; own speed 10 px/UPDATE plus Verlet carry; `deadTimer` 15 UPDATEs; range 484-538 px | `PlatformGame.as:689-690`; `BulletEntity.as:31-91` |
| Camera flash | art 75 x 75 at (-31..44, -35..40); alpha -10 per UPDATE, so 10 UPDATEs | `CameraFlashEntity.as:70-91` |
| Antibiotic fuse | 2000 ms of `getTimer()` after `abs(dy) <= 2` | `AntibioticBombEntity.as:31-33,36-57` |
| Superinfection lives | 6 | `SuperInfection.as:26` |

### 3.2 States and per-level sequence

State ids (`Constants.as:63-91`): INIT 0, LEVEL_LOADING 1, LEVEL_LOADED 2, LOAD_TILES 3, UPDATE_WORLD 4, RENDER_WORLD 5, CREATE_GUI 6, FIND_LEVEL 7 (unused), LOAD_LEVEL 8, LEVEL_COMPLETE 9, INIT_DIALOGUE 10, CREATE_ENTITIES 14, GAME_OVER 997. Of the other ids, the game show uses ROUND_TEXT 13, ASK_QUESTION 16 and ROUND_OVER 20 (plus 0, 1, 2 and 8); DIALOGUE 11, CLEAN_UP 15, SHOW_BOARD 17, CHECK_ANSWER 18 and IDLE 998 are never referenced; FIND_LEVEL 7 appears only in `LevelEditor.as:87-89`, LEVEL_SUMMARY 12 and TRIGGER_WIN/LOSE 995/996 only in the unused `FridgeGame.as`, CLOSE 999 only in those two (grep of `Constants.STATE_` over `src/`). `Constants.LEFT/TOP/RIGHT/BOTTOM` (0/1/2/3, `Constants.as:15-18`) are never used; entity direction is `GameEntity.LEFT = -1`, `RIGHT = 1` (`GameEntity.as:57-58`).

```
initialiseGame(player, newLevel = "alpha_level1.xml", tiles)      // PlatformGame.as:126-185
  -> INIT (screen (0,0)-(800,450)) -> LOAD_LEVEL -> LEVEL_LOADING (poll bytes, parseXML)
  -> LEVEL_LOADED (bodyLevel; worldMin (0,-100); worldMax (cols*50, 450))
  -> LOAD_TILES (static box per geometry cell, rows 0..rows-1, cols 0..cols INCLUSIVE, physicsExcempt = true)
  -> CREATE_GUI (ePhone status from goals[0], 3.24) -> CREATE_ENTITIES (player first, then cells row-major)
  -> INIT_DIALOGUE (ePhone grows, plays the level's intro pages; when bigScreen.finished: shrink,
                    secondsTimer = getTimer())
  -> UPDATE_WORLD <-> RENDER_WORLD -> LEVEL_COMPLETE | GAME_OVER
```

`initialiseGame` builds `new ParticleSystem(30, 1, new Vector3(), null, (0,3000,0), 0.95, (9999999,9999999,0), true)`, loads `harry.swf` or `amy.swf` into the `avatar` holder, attaches the ePhone `status` screen, hides the `talkie`, shows `heart0..2`. It does **not** reset `score`, `tiles`, `cells`, `staticEntities`, `portalId` or the `antibiotic_held` HUD icon.

### 3.3 UPDATE_WORLD order of operations (`PlatformGame.as:553-1059`)

1. **Timer** (558-569): `if (getTimer() - secondsTimer >= 1000) { secondsTimer = getTimer(); secondsLeft--; timeLeft.htmlText = "<b>" + secondsLeft + "</b>"; if (secondsLeft < 0) { secondsLeft = 0; push TRIGGER_GAME_END; exitReason = END_REASON_TIME } }`. The display counts 179 down to 0, shows "-1", then the game ends: 181 decrements.
2. **Goals** (575-593): `allGoalsAchieved = every goal.isGoalMet()` (true for an empty list). If true and the portal is CLOSED: `level.goals.pop()`, ePhone background becomes `exit_status`, push `PORTAL_EVENT_OPEN` to the portal.
3. **Death** (594-597): if `entities[0].lives <= 0`, push `TRIGGER_GAME_END`, `exitReason = END_REASON_DIE`.
4. **Hearts** (598-601): hide `heart0 .. heart(3 - lives - 1)`: the leftmost heart goes first.
5. **Scroll** with the flags computed at the end of the previous UPDATE (605-612).
6. **Schedule a render**: if `dirtyScreen`, `gameState = RENDER_WORLD; dirtyScreen = false` (the rest of this UPDATE still runs).
7. **Advance** (618-631): for `i` in index order, if `entities[i].isOnScreen`, append `entities[i].advance()` to `entityEvents`. The player is index 0.
8. **Event loop** (636-1009): FIFO `while (entityEvents.length) { e = shift(); dispatch(e); append new events }`. Handlers may also push directly onto `entityEvents` (the camera flash does); those run in the same loop.
9. **Physics**: `particleSystem.timeStep()` (1012). Collisions push `COLLIDE` events that are processed at step 8 of the **next** UPDATE, before that UPDATE's timer, goal and advance events.
10. **Dirty check** (1015-1020): `particle.position.equals(particle.previousPosition, 1)` for every entity, which **mutates `position.x` to 1 decimal place** (3.4). Any difference sets `dirtyScreen`. After the first dynamic REMOVE, `entities[k]` is null and `!undefined` is true, so the screen stays dirty for ever.
11. **Scroll decision** (1028-1050), 3.23.
12. **Score HUD** (1052-1053).

So a step's event order is: COLLIDEs from the last physics step, then timer/goal/death events, then advance events, then whatever those produce.

**RENDER_WORLD** (1060-1167), which also has gameplay effects:
- Tiles: `leftMostColumn = floor(screenLeft/50) - 5`, `rightMostColumn = ceil(screenRight/50)`; for rows `0..rows-1` and cols `leftMostColumn-1 .. rightMostColumn+1` with geometry: create the cell clip if missing and set that tile's static body `physicsExcempt = false`; place at `_x = col*50 - screenLeft`, `_y = row*50`; if `_x > 800 || _x + _width <= 0`, set `physicsExcempt = true` and remove the clip. **Only tiles overlapping the visible 800 px band are solid.**
- Entities: mirror (`direction == LEFT`: `_xscale = -100` and `mirroredImageOffset = particle.width`); `clip._x = position.x - screenLeft + mirroredImageOffset`, `clip._y = position.y` (no vertical camera). Off screen (`_x > 800 || _x + _width <= 0`): `isOnScreen = false`, `physicsExcempt = true`. On screen: `isOnScreen = true`, and `physicsExcempt = false` **only if** `state` is DYNAMIC (4), FALL (8) or JUMP_MID (13). Entities with bespoke states (milk 100-102, player 101/102, bullets 100-102) that once go off screen stay physics-exempt when they return.
- **Spawned entities start off screen** (`GameEntity` constructor sets `isOnScreen = false`, `GameEntity.as:103`): bullets, the flash and the bomb do not advance or act as the outer collision body until a RENDER has positioned them. A port must not advance a spawned entity on its creation step [P §1.6].

### 3.4 Vector3 rounding (must be reproduced)

- `add(v)` returns the sum **rounded to 3 decimal places** per component (`Vector3.as:24-41`). `subtract` and `multiply` do not round (`:43-49,164-170`). Exact code:

```
add(vector, precision): sum = this + vector; sum.round(precision - 1); return sum   // precision undefined -> NaN
round(precision): if isNaN(precision): precision = 3
                  factor = Math.pow(10, precision)                                   // 1000
                  x = Math.round(x*factor)/factor; y = Math.round(y*factor)/factor; z = ...
equals(vector, precision): if isNaN(precision): precision = 1
                  x = Math.round(x*10)/10                                            // MUTATES this.x
                  return x == vector.x && y == vector.y && z == vector.z
```

- `equals(v, p = 1)` first **mutates `this.x`** to `Math.round(x*10)/10` (`:61`), then compares x, y, z exactly (`:65`). Called on every entity every UPDATE (`PlatformGame.as:1017`), so every `position.x` is snapped to 0.1 px after each physics step. y is not snapped.
- Consequence: **drag never brings a body to rest horizontally.** For a coasting body `v' = round1(x + round3(0.95*v)) - x` (half rounds up). Every x velocity from -0.9 to +1.0 on the 0.1 grid is a fixed point. From any speed a coasting body settles at **+1.0 px/step (moving right) or -0.9 px/step (moving left) after about 61 steps (1.8 s) and creeps for ever** (about 30-33 px/s) until a wall, a world bound or an opposite key press. Braking rarely lands on exactly 0 (3.6 - 3.645 gives -0.2, which then creeps left). Applies to the player and to the pushed milk glass and superinfection [P §2.2].
- Port: kept faithful by default ([PD] "Kept faithful"); a flagged option could zero `abs(vx) < 1.05` when no key is held (open question 11.3).

### 3.5 Physics algorithm (`ParticleSystem.as`)

Bodies: `EntityBox(origin, w, h)`: `position` is the **top-left**; `previousPosition = position`; `centreOffset = (w/2, h/2)`; `bottomRightOffset = (w, h)`; flags `gravityExcempt`, `physicsExcempt`, `isDynamic` (`Entity.as:52-64`, `EntityBox.as:10-21,55-57`). `teleport(p)` sets `previousPosition = position; position = p`, so velocity is zero after a teleport (`Entity.as:83-91`).

```
createBoxParticle(position, clip, dynamic, force, gravityExcempt, maxChangeExcempt, forceSize):   // 187-239
  if !(clip instanceof MovieClip) return null            // missing linkage -> no body
  w = clip._width; h = clip._height                      // current frame's art bounds
  if forceSize != null: w = forceSize.x; h = forceSize.y
  box = new EntityBox(position, w, h); box.force = force ?? (0,0,0)
  if gravityExcempt: box.gravityExcempt = true
  box.isDynamic = dynamic
  clip._x = position.x; clip._y = position.y            // WORLD coords until the next RENDER
  radius = round(sqrt(w*w + h*h) / 2)
  if dynamic: dynamicEntities.push(box); dynamicBoundingBalls.push(radius)
  else:       staticEntities.push(box);  staticBoundingBalls.push(radius)
              levelTileArray[position.y/50][position.x/50] = index      // anchor cell only
  if !maxChangeExcempt:
    if ceil(w/2) < maxChange.x: maxChange.x = w/2
    if ceil(h/2) < maxChange.y: maxChange.y = h/2
  return index

timeStep(): hasCollided = []; accumulateForces(); verlet(); satisfyConstraints()      // 290-305

accumulateForces():                                      // 361-379
  for e in dynamicEntities (non-null):
    f = (0,0,0)
    if !e.gravityExcempt: f = e.force.add(gravity)       // gravity-exempt bodies LOSE their force here
    f.x *= (abs(f.x) > 10) ? 0.9 : 0.8
    e.force = f

verlet():                                                // 317-355
  for e in dynamicEntities (non-null, !e.physicsExcempt):
    tmp = e.position.clone()
    change = (e.position - e.previousPosition) * 0.95
    newPos = e.position.add(change)                      // rounds to 0.001
    newPos = newPos.add(e.force * (0.03*0.03))           // rounds to 0.001
    d = newPos - tmp                                     // constrainSpeeds = true
    if abs(d.x) > maxChange.x: newPos.x = tmp.x + sign(d.x)*maxChange.x; d = newPos - tmp
    if abs(d.y) > maxChange.y: newPos.y = tmp.y + sign(d.y)*maxChange.y
    e.position = newPos; e.previousPosition = tmp; e.force = (0,0,0)

satisfyConstraints():                                    // 392-657, one iteration
  for a in 0..dyn.length-1 (non-null):
    A = dyn[a]
    if !(A.theParent.isOnScreen || A.physicsExcempt) continue      // exempt bodies STILL collide
    A.centre = A.position.add(A.centreOffset)            // computed once; stale after dyn pushes
    // dynamic vs dynamic: both move half
    for b in 0..dyn.length-1 (non-null):
      skip if a == b or hasCollided[min(a,b)][max(a,b)] or excemptionMatrix[a][DYNAMIC][b]
      skip if dyn[b].theParent.state in {BE_KILLED (10), IGNORE (23)} // only the COMPARE body is skipped
      B = dyn[b]; B.centre = B.position.add(B.centreOffset); delta = B.centre - A.centre
      if hypot(delta) >= ball[a] + ball[b]: continue
      ox = (A.w + B.w)/2 - abs(delta.x); oy = (A.h + B.h)/2 - abs(delta.y)
      if oy > 0 and ox > 0:
        change = (oy < ox) ? (0, (delta.y >= 0 ? -1 : 1)*oy) : ((delta.x >= 0 ? -1 : 1)*ox, 0)
        A.position = A.position.add(change*0.5); B.position = B.position.subtract(change*0.5)
        hasCollided[lo][hi] = true
        push COLLIDE(target = A.theParent, [B.theParent, change*0.5])
        if A.theParent.type != BULLET: push COLLIDE(target = B.theParent, [A.theParent, change*-0.5])
    // dynamic vs static: only A moves; anchors found in a window 4 rows up / 4 cols left
    myRow = floor(A.position.y/50); myCol = floor(A.position.x/50)
    test = [staticEntities[levelTileArray[r][c]] for r in myRow-4..myRow+ceil(A.h/50)
                                                 for c in myCol-4..myCol+ceil(A.w/50) if defined]
    for k, S in test:
      skip if S.physicsExcempt
      skip if excemptionMatrix[a][STATIC][k]             // BUG: local index k (section 10.1, #1)
      delta = S.centre - A.centre
      if hypot(delta) >= ball[a] + staticBoundingBalls[k]: continue   // BUG: local index k
      ox, oy as above; if both > 0: A.position += smaller-axis push (full, not half)
      A.centre = A.position.add(A.centreOffset)
  // world bounds last (highest priority), non-exempt dynamic bodies only:
  for e in dyn: e.position = clamp(e.position, worldMin, worldMax - e.bottomRightOffset)
// then PlatformGame.as:1015-1020 snaps position.x to 0.1 for EVERY entity
```

Rules that follow:
- Verlet moves only non-exempt dynamic bodies; collision processes a dynamic body if it is on screen **or** exempt (a walking, exempt microbe is still pushed); world bounds apply only to non-exempt dynamic bodies.
- Static collisions never emit events. Pickups, the portal and the flash detect overlap themselves with `hitTest` (bounding box against bounding box).
- **The smaller penetration axis decides the push**: a fast body can be pushed sideways off a ledge corner; any head bump is a solid ceiling. **No one-way platforms** (the `<sides>` data is never read).
- **Nobody can fall out of the world**: the bottom clamp is `450 - h`, so the player's invisible floor is y = 350. Pits drop you onto the bottom of the screen. The top clamp is y = -100.
- Gaps in a floor are ditches, not deaths.

### 3.6 Derived motion numbers

With `dt^2 = 0.0009`: gravity adds 2.7 px/step^2; a held arrow adds 4500, friction makes it 4050, so **3.645 px/step^2**. Unclamped terminal speeds (54 falling, 72.9 running px/step) are always cut by `maxChange`.

| Motion | Per-step values (after the 0.1 x snap) |
|---|---|
| Run from rest, vx | 3.6, 7.1, 10.4, 13.5, 16.5, 19.3, 22.0, 24.5, then the cap 25 (Lucy levels 21.16 from step 7). Top speed after about 8 steps (240 ms). |
| Coast (keys released) | x0.95 per step down to about 2, then -0.1 per step, settles at +1.0 or -0.9 after about 61 steps and never stops. |
| Jump from rest, cumulative y | -25, -46.05, -63.35, -77.08, -87.42, -94.55, -98.62, **-99.79** (apex, step 8), -98.20, -93.99, -87.29, ... back to 0 after about 17 steps (0.5 s). |
| Double jump | Every jump sets vy to -25 whatever it was (the first step 0.95v - 62.1 is clamped to -25), so a double jump from the apex reaches about 200 px. |
| Bullet displacement per UPDATE | 19.5, 28.5, then 10 + maxChange.x (35 / 33.98 / 31.16) |

Per-level caps (from frame-1 art bounds; derived, not measured, **[Ruffle]**):

| Levels | maxChange.x | maxChange.y | Set by | Bullet travel over 16 UPDATEs |
|---|---|---|---|---|
| 1, 2, 8, 9, 10 | 21.158 | 25 | `lucy_icon` 42.32 px wide | 484 px |
| 3, 4, 5, 6 | 25 | 25 | 50 px tiles | 538 px |
| 7 (and 11) | 23.980 | 25 | `iggy_icon` 47.96 px wide | 524 px |

Pickups, milk, the superinfection, bullets, the flash and the bomb are created `maxChangeExcempt`: they do not lower the cap but are still clamped by it. The test compares `ceil(w/2)` but assigns `w/2`, so **creation order matters**: tiles come first (LOAD_TILES) and set 25; the player's 49 px box then gives `ceil(24.5) = 25`, not below 25, so 24.5 never applies; Lucy (`ceil(21.16) = 22`) and Iggy (`ceil(23.98) = 24`) do lower it. Every y half-size of a non-exempt box is at least 25 after `ceil` (Iggy: `ceil(24.32) = 25`), so y stays 25. A port must compute the cap with the same order and the same `ceil` test.

### 3.7 Collision quirks (port decisions in section 10)

1. **Wrong index in the static loop** (`ParticleSystem.as:583,586`): `staticBoundingBalls[k]` and `excemptionMatrix[a][STATIC][k]` use `k`, the position in the local `test` list, so the broadphase uses the radius of the k-th tile created in the level. Simulated: 1375 of 25190 tile-top positions (5.5%) miss the broadphase; per level L1 11.5%, L2 4.3%, L3 6.1%, L4 0.3%, L5 6.5%, L6 5.7%, L7 7.1%, L8 2.1%, L9 0.3%, L10 7.0%; all misses are on large tiles, where a body sinks in until the ball test passes. **Fixed**: plain AABB overlap (exactly what the correct radius would give).
2. **Dead bodies still push as the outer body**: the BE_KILLED/IGNORE/dead-bullet exclusions only skip the compare body. A dived Lucy (state IGNORE, `isDynamic = false`, so REMOVE never nulls her) and the dead superinfection stay as **invisible solid boxes**. **Fixed**: removed, killed and ignored entities leave collision entirely.
3. One constraint iteration with the stale centre for dynamic pairs: stacks jitter. Kept.
4. Only anchor cells are indexed; multi-cell tiles are found through the -4 window. Kept (the port sizes its lookup grid from the level).
5. Off-screen tiles are not solid; off-screen dynamic bodies freeze. Kept (the port's camera differs, 3.23).
6. Seams: with the smaller-penetration rule a player sinking 2.7 px into a floor of 50 px tiles can be kicked sideways at seams. **Fixed** in the port: a sideways push out of a tile into a flush neighbour whose top is level or higher is resolved vertically [PD bug 15].

### 3.8 Player: creation and fields

- Position: `uniqueItems[PLAYER] * 50`, the top-left of the `player_start` cell (`PlatformGame.as:373-403`). Dynamic box, gravity on, not max-change exempt, forced 49 x 100, `physicsExcempt = false`, `state = PLAYER_STATE_NORMAL (102)`, `indexId = 0`, `particleArrayId = 0`.
- Constructor defaults (`PlayerEntity.as:103-128`): `maxJumps` 2 (inverted `isNaN` test that still gives 2), `jumpsLeft` 2, `jumpReady` true, `counterCeiling` 1, `canTakePhotograph` true, `ammo` 0, `maxAmmo` 10, **`infiniteAmmo` true**, `lives` 3, `has_antibiotic` false, `isShootingSoap` true, `SHOOT_POINT` 27 (`PlayerEntity.as:101`); `triggerTractorTime` 250 and `thinkTime` 100 unused.
- Avatar: `ClipLoader.loadClip("harry.swf" | "amy.swf", _parent.avatar)` each level (`PlatformGame.as:161-169`); `onLoadInit` shows it and plays `upper` at `"hurt"` as a flourish, whose last frame goes to `move` (`ClipLoader.as:14-18`). The port starts the upper body on `move` directly; the lower body stays on frame 1 [PD].
- The art is two halves (`upper`, `lower`) drawn at about 11x and placed at scale 0.089. Harry is about 55.7 x 107.3 (bounds x -2..53.7, y -11..96.3), Amy about 63.1 x 107.2 (x -4..59.1, y -11..96.2). **The code reads the live `clip._width` (union of both halves at their current frames)** for spawn points, the scroll test and hitTests: riding right in `accelerate_mid` widens it to about 78.7-92.4 px because of the exhaust. The port reproduces this from per-frame bounds (`frameBounds` in `web/js/platformer/data/clips.js`), checked against `reference/captures/ruffle-level1-photo-standing.png` (offset about 55) and `ruffle-level1-photo-riding-right.png` (offset at least 75) [PD].

### 3.9 Controls

`mapControls` (`PlatformGame.as:1260-1311`) and `checkKeys` (`PlayerEntity.as:566-636`). Flags mean "since the last UPDATE": `reset_keys()` clears them at the end of each `checkKeys` (`:638-644`). `act()` ignores **every** event unless `state == PLAYER_STATE_NORMAL`.

| Original key | Flag / source | Effect | Port default (`DEFAULT_KEYS` in `web/js/core/settings.js`) |
|---|---|---|---|
| Right / Left arrow | `right_down` / `left_down`, keydown listener **and** polled `Key.isDown` | Accelerate or brake (3.10). Both held: neither. | Arrows, A/D; touch d-pad; gamepad stick/d-pad |
| Up arrow | `up_down` polled (held) / `up_up` keyup | Jump (3.11) | Space, Up, W; touch jump button |
| Down arrow | `down_down` | nothing | nothing |
| Space | `fire_down` / `fire_up`, key events only (OS auto-repeat re-triggers) | Throw soap / white blood cell (3.12) | X, J; touch throw button (the brief put jump on Space) |
| Ctrl | `alt_fire_down` / `alt_fire_up`, events only | Photo, or throw the antibiotic if one is held (3.13, 3.14) | C, K, Ctrl, Shift; touch camera button |
| Home or Alt | keydown | **Debug cheat left in**: `gameState = LEVEL_COMPLETE` (`PlatformGame.as:1287-1290`) | Removed (debug flag only) |
| (none) | | | Esc pause; phone key re-opens the briefing; Enter confirms |

Port input notes [PD]: keys and touches pressed between two 15 ms polls are kept for one poll so quick taps are never lost; fire and camera auto-repeat while held after about 510 ms, every 60 ms (the animations still limit the real rate); prompts name the live binding for the active device ("press C", "tap the camera button", "press B").

### 3.10 Horizontal movement

```
checkKeys (per UPDATE):
  if !(right && left):
    if right:
      if direction == RIGHT: emit ACCELERATE
      else:
        if checkDirection() == RIGHT: direction = RIGHT; emit ACCELERATE   // not moving left
        emit DECELERATE
    elif left: mirror image
checkDirection(): position.x < previousPosition.x ? LEFT : RIGHT
accelerate(): force += ( speed*direction, 0)      // +/-4500
decelerate(): force += (-speed*direction, 0)
```

Pressing the opposite way while moving brakes at 3.645 px/step^2; on the step the board stops or reverses, ACCELERATE and DECELERATE cancel (zero force); then it accelerates the new way. The only automatic slowing is drag, and with the 0.1 snap the player never comes to rest (3.4). No ground friction. The lower-body animation switches between `idle`, `move` and `accelerate` on `abs(dx)` thresholds 1.5 and 3 (`PlayerEntity.as:535-549`).

### 3.11 Jumping

```
checkKeys: if up_down (held):  if jumpReady: emit JUMP_START
           elif up_up (keyup): emit KEY_RELEASED_JUMP
JUMP_START -> jump_start(): lower "jump_start"; force += (0, -72000); jumpsLeft--; jumpReady = false;
                            counter = counterCeiling (1)
KEY_RELEASED_JUMP: if jumpsLeft > 0: jumpReady = true
checkStateEvents: if lowerState == LOWER_JUMP and !lowerClip.midAnimation: jump_mid():
   if onSolidGround(): lowerState = LOWER_JUMP_LAND; lower "jump_end"; jumpsLeft = maxJumps
   direction = checkDirection()
onSolidGround() for a physics body (GameEntity.as:472-485):
   if abs(dy) < 1.5 (SAFE_TRAVEL_DISTANCE): if counter <= 0 return true else counter--
   else counter = counterCeiling
   return false                              // i.e. 2 consecutive UPDATEs with abs(dy) < 1.5
```

- Two jumps; the second needs Up released and pressed again while `jumpsLeft > 0`. A double jump is also possible after walking off a ledge. Holding Up does not re-jump on landing.
- **Dead press after a double jump**: the release after the double jump happens at `jumpsLeft == 0`, so it does not re-arm; landing restores `jumpsLeft` but not `jumpReady`; the next press only re-arms, the one after jumps (`PlayerEntity.as:180-184,418-419,432`).
- The lower `jump_start` holds `midAnimation` for frames 136-139 (4 frames, **160 ms**) before landing is checked. Hitting a ceiling (dy about 0) counts as landing and restores the jumps mid-air.
- A bad-microbe contact also resets `jumpsLeft` (`PlayerEntity.as:240`).
- **Port feel change** [PD "Feel improvements"]: edge-triggered jumps with a 4-step (120 ms) buffer and 4-step coyote time; the dead press and lost quick taps are gone; the double jump, re-arming on landing, jumping after walking off a ledge and the bad-microbe reset are kept; holding jump still does not re-jump. `options.jumpFeel = false` restores the original.

### 3.12 Throwing soap and white blood cells

```
fire_down -> KEY_PRESSED_FIRE -> fireWeapon() (PlayerEntity.as:316-353):
  if upperState in {ACCELERATE, DECELERATE, IDLE, MOVE}:
     if isShootingSoap and (ammo > 0 or infiniteAmmo):          // infiniteAmmo is always true
        upperState = UPPER_SHOOT_SOAP; upper "shoot_soap"; if !infiniteAmmo: ammo--
  elif upperState == UPPER_SHOOT_SOAP:        // also polled every UPDATE by checkStateEvents
     if upperClip.shoot: upperClip.shoot = false; emit CREATE_SOAP_BULLET
     if !upperClip.midAnimation: upperState = UPPER_MOVE
```

- **Ammo is infinite from the start** in every level, including photo levels. Pickups only add `ammo` and 7 points. The `soap_bar` / `wbc_bar` HUD clips are never used.
- Projectile type: `bodyLevel == false` gives `soap_projectile`, otherwise `white_projectile` (`PlatformGame.as:670-744`); identical logic. `body_level` missing means **true**, so L1-L4, L7-L10 throw white blood cells; only L5 and L6 throw soap.
- Timing: Harry's `shoot_soap` (upper sprite 193) sets `midAnimation = true, shoot = false` at frame 280 and `midAnimation = false, shoot = true` at 283, back to `move` at 298: the bullet spawns **3 frames (120 ms)** after the press. **Amy differs** (`movies/amy.swf` sprite 208): the throw fires on frame 4 (160 ms) and keeps the upper body busy for 18 frames (720 ms), so she throws at most about once every 0.7 s. Kept [PD].
- Spawn (`PlatformGame.as:673-704`): `y = player.clip._y + 27`; facing right `x = player.x + player.clip._width - bulletClip._width` (soap art width is 0 on frame 1, so x = player.x + avatar width; white: player.x + W - 18); facing left `x = player.x - bulletClip._width`. Dynamic body forced 50 x 25, `maxChangeExcempt`; `BulletEntity` sets `gravityExcempt = true`, which wipes the initial force in `accumulateForces`, so shots do not inherit the player's momentum. `new BulletEntity(game, particle, clip, hurtGood = false, hurtBad = true, hurtHuman = false, damage = 1, impact = 10, speed = 10)`. The player and bullet are exempted from each other.

```
BulletEntity: thinkTime = defaultThinkTime = 3; deadTimer = 15; clip "shoot"; state NORMAL (100)
advance NORMAL: if deadTimer <= 0: state = SPLAT; clip "splat" else deadTimer--
                position.x += speed*direction           // then Verlet adds 0.95*(pos-prev), clamped
                if abs(position.x - previousPosition.x) <= 1.5: thinkTime--; if thinkTime <= 0: SPLAT
advance SPLAT:  if !clip.midAnimation: emit REMOVE; remove()   // hide + exempt
act COLLIDE (NORMAL only): if other.type not BULLET/PLAYER: state = SPLAT; clip "splat";
                emit COLLIDE(target = other, [this])     // re-notifies the victim
```

Soap `splat` holds `midAnimation` for frames 39-43; `white_projectile` never sets it, so it is removed on the next UPDATE. A bullet pinned against a wall splats after 3 stuck UPDATEs.

### 3.13 Camera photograph

- Trigger (`PlayerEntity.as:185-199`): Ctrl keydown, `!has_antibiotic` and `canTakePhotograph`: upper `take_photo_start`, `upperState = UPPER_TAKE_PHOTO`, `canTakePhotograph = false`, emit `CREATE_CAMERA_FLASH`.
- Flash (`PlatformGame.as:745-783`): clip `camera_flash`, `y = player.clip._y + 27`; facing right `x = player.x + player.clip._width`; facing left `x = player.x - flashClip._width - 2`. **Static** body 75 x 75, gravity exempt, `physicsExcempt = true` (never collides physically), exempted from the player; does not follow the player.
- Photo area = the flash **art** bounds after the next render: art x -31..44, y -35..40 about the clip origin (mirrored: -44..31). Relative to the player box top-left (px, py): facing right x from px + W - 31 to px + W + 44 (W = live avatar width), facing left x from px - 46 to px + 29; y from py - 8 to py + 67. Reach about 75 px in front, asymmetric.

```
CameraFlashEntity.advance (every UPDATE while NORMAL (100)): takeShot():
   clip._alpha -= 10; if clip._alpha <= 0: emit REMOVE; state = DEAD (102)
   for i in 0..entities.length-1 while !shotTaken:
      if entities[i] instanceof Microbe and clip.hitTest(entities[i].clip):     // bbox vs bbox
         emit COLLIDE(target = this, [entities[i]]); shotTaken = true
act COLLIDE: if other instanceof Microbe and !other.hasBeenPhotographed:
               shotTaken = true; theGame.entityEvents.push(BE_PHOTOGRAPHED(target = other))
```

- **One microbe per flash**: the first overlapping microbe in entity order, **even one already photographed** (then the flash is wasted) (`CameraFlashEntity.as:79-88`). Kept.
- The microbe's act (on screen, not yet photographed): `hasBeenPhotographed = true`, clip `be_photographed`, `thinkTime = 5`, physics exempt; afterwards it re-snaps and falls.
- Points: +5 good, +15 bad (the superinfection counts as bad and ignored the photo, so it paid +15 every time: fixed, section 10).
- Cooldown: `canTakePhotograph` returns on whichever comes first: the flash REMOVE (10 UPDATEs, 300 ms, `PlatformGame.as:895-899`), the end of the `take_photo` animation (`takePhotograph()` once `midAnimation == false`), or any hurt (`PlayerEntity.as:252`). In practice **10 UPDATEs** (details below). The animation span is **15 frames (600 ms) for Harry and 7 frames (280 ms) for Amy**, as [PD] says; [P §3.6]'s "frames 137-170 (1.36 s)" ignores two jumps. Harry's upper (`movies/harry.swf` sprite 193): frame 137 `midAnimation = true; shoot = false`, frame 144 `gotoAndPlay("take_photo_mid")` (155), frame 163 `gotoAndPlay("take_photo_end")` (171), frame 171 `midAnimation = false`, frame 179 `gotoAndPlay("move")`: shown frames 137-143, 155-162, 171-178. Amy's upper (`movies/amy.swf` sprite 208): frame 137 `midAnimation = true`, frame 144 `midAnimation = false; gotoAndPlay("take_photo_mid")`, frame 163 `gotoAndPlay("take_photo_mid")` again, so **Amy's photo pose loops frames 155-162 until the code requests another upper animation** (the next ACCELERATE/DECELERATE from `upperState == UPPER_MOVE`, a throw or a hurt, `PlayerEntity.as:366-372,392-398,434-437`); standing still she keeps holding the camera up (port: follow the loop, or play `move` once `midAnimation` clears; cosmetic). Cooldown consequence: the flash is spawned in the press step's event loop, first advances on the next step and emits its REMOVE on the 10th advance, which is handled in the same event loop, so the flash REMOVE comes **10 UPDATEs after the press step (300 ms)**; for Harry (600 ms animation) that always decides. For Amy `takePhotograph()` sees `midAnimation == false` after 7 frames (280 ms) at the next UPDATE, which lands within about one step of the flash REMOVE; which comes first depends on the frame phase. The port uses the frame clock for the animation gate and step counts for the flash, which reproduces this.

### 3.14 Antibiotic

- Pickup (`AntibioticPickup.as:27-63`): `hitTest` against the player clip while `has_antibiotic == false`; emits REMOVE and `PICKUP_ANTIBIOTIC` (shows HUD `antibiotic_held`, sets `has_antibiotic`). **Carry one at a time.** Never respawns.
- Throw (`PlayerEntity.as:193-197`, `PlatformGame.as:789-821`): Ctrl while holding: upper `shoot_soap`, `CREATE_ANTIBIOTIC` at once (no `shoot` wait); HUD icon hidden, `has_antibiotic = false`. Bomb clip `antibiotic_pickup`, spawned like a bullet (facing right x = player.x + W - 38.3, left x = player.x - 38.3, y = clip._y + 27), dynamic 38.3 x 16.3, **gravity on**, `maxChangeExcempt`, exempted from the player.
- Bomb (`AntibioticBombEntity.as:36-57`): FALLING until `abs(dy) <= 2` (`minimumSpeedTrigger`), then COUNTING_DOWN with `bombTimer = getTimer()`; at `getTimer() >= bombTimer + 2000`: EXPLODE, emit `EXPLODE_ANTIBIOTIC` and REMOVE. It only advances while on screen: **an off-screen bomb never explodes** (and so never counts for L10).

```
EXPLODE_ANTIBIOTIC (PlatformGame.as:822-885):
victims = on-screen entities of type LUCY, SANDY, STEVE, SLURM, SLARG, COLIN    // NOT Patty, Iggy, Donna
for v in victims: v.kill()        // state BE_KILLED + "be_killed"; NO BE_KILLED event
                  points += (v is LUCY/SANDY/STEVE) ? -10 : +15
if an on-screen SUPERINFECTION exists: points += 30; emit BE_HURT(target = superinfection)
emit MODIFY_POINTS(points)
for goal in goals: newEvents.push(goal.updateGoal(e).pop())   // pushed undefined when empty (fixed)
whiteout._alpha = 100             // full-screen white, onEnterFrame -10 per frame (0.4 s)
```

The victim list is the lesson: antibiotics kill bacteria, good ones included, but not fungi (Patty, Donna) or the virus (Iggy). Antibiotic kills **do not count** for KILL_ALL and give no BE_KILLED points.

### 3.15 Damage, lives, death

- Contact (`PlayerEntity.as:233-243`): on a COLLIDE with a `BadMicrobe` (the superinfection included) whose `lives > 0`, while the player is not in BE_HURT: emit `BE_HURT(1)` and `jumpsLeft = maxJumps`. The player (index 0) is handled before the microbe, so the microbe is still alive then.
- BE_HURT (`:244-260`): `lives -= 1`; upper and lower play `hurt`; `canTakePhotograph = true`; if `lives <= 0` emit BE_KILLED, else `state = PLAYER_STATE_BE_HURT`.
- **Hurt state = 480 ms of no damage and no control**: `act()` ignores everything, including all input. It ends when both hurt animations finish (upper 255-266, lower 195-206: 12 frames). No knockback beyond the collision push.
- Every bad-microbe touch costs a life; it kills the microbe only if the microbe was IDLE or WALKing (3.18). A microbe in FALL, SLIDE, BE_PHOTOGRAPHED or BE_HIT ignores the contact but still hurts the player, again each time the hurt state ends while touching.
- Death: the player's BE_KILLED reaches the game's BE_KILLED case: **-10 points**. Next UPDATE `lives <= 0` triggers GAME_OVER with `END_REASON_DIE`.
- Port juice [PD]: 4-step hit-stop, light shake, red-tinted blinking while invulnerable, haptics, heart burst.

### 3.16 Entities

Type ids (`Constants.as:29-58`); `tile_definitions.xml` index in brackets; the linkage used at run time is the definition's `<icon>` (4.3). Names are the `tile_definitions.xml` labels; their spelling slips are shown with the name the port displays.

| Id | Entity (label; port name) | Class | Good/bad | Box w x h (frame 1) | Body | Behaviour | How it dies / ends | Points | Antibiotic | Levels |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Player (`player_start` [111]) | `PlayerEntity` | - | 49 x 100 forced | dynamic, gravity | 3.8-3.15 | 3 hits; timer | death -10 | unaffected | all |
| 1 | Tile [0-92] | static geometry | - | art size (3.22) | static; solid only while drawn | - | - | - | - | all |
| 6 | Exit portal (`portal_exit_icon` [107], "Portal 1") | `PortalEntity` | - | 103.6 x 163.8 | static, not solid | 3.19 | - | - | - | all |
| 7 | Entrance portal [108] | **unhandled** (empty icon) | - | - | - | pushes a stale entity (bug) | - | - | - | none |
| 8 | Bullet (runtime) | `BulletEntity` | - | 50 x 25 forced | dynamic, gravity exempt | 3.12 | 15 UPDATEs or first hit | - | - | - |
| 9 | Ammo pickup (`soap_pickup` [109] / `white_pickup` [110]) | `SoapPickup` / `WhitePickup` by `bodyLevel` | - | 36.1 x 44.1 / 39.1 x 42.1 (art x 6..45.1) | static, not solid | `hitTest` with the player each advance | collected | +7 | - | 5, 6 (soap), 7 (white) |
| 10 | Camera flash (runtime) | `CameraFlashEntity` | - | 75 x 75 | static, exempt | 3.13 | alpha 0 after 10 UPDATEs | - | - | - |
| 11 | Lucy Lactobacillus (`lucy_icon` [93]) | `LucyLactobacillus` | good (bacterium) | 42.32 x 97.58 | dynamic, exempt while walking | patrol; slides when pushed; dives into milk | touching a walking/idle bad microbe; antibiotic; milk dive (removed, no points) | photo +5; death -10 | killed | 1, 2, 8, 9, 10 |
| 12 | Sandy Streptococcus (`sandy_icon` [99]) | `GoodMicrobe` | good | 90.08 x 226.05 | as Lucy | patrol | as Lucy | photo +5; death -10 | killed | none |
| 13 | Patty Pennicillium (sic; port "Patty Penicillium") (`patty_icon` [98]) | `GoodMicrobe` | good (fungus) | 203.32 x 150.39 ([P], [S], web data) or 187.89 x 141.53 ([L] §2) **[Ruffle]** | as Lucy | patrol | bad-microbe contact | photo +5; death -10 | **immune** | 4 |
| 14 | Steve Staphylococcus (`steve_icon` [94]) | `GoodMicrobe` | good (bacterium) | 74.10 x 72.94 | as Lucy | patrol | bad contact; antibiotic | photo +5; death -10 | killed | 3, 5 |
| 15 | Colin Campylobacter (`colin_icon` [95]); Super Campy (`super_colin_icon` [103], 50.51 x 98.05) | `BadMicrobe` | bad | `colin_icon` **not exported** (no clip, no body) | - | patrol | - | - | killed +15 | none |
| 16 | Slarg Staphyloccus (sic; port "Slarg Staphylococcus") (`slarg_icon` [101]); Super Slarg [104] **not exported** | `BadMicrobe` | bad | 90.57 x 225.48 ([L] §2: 90.37) | dynamic, exempt while walking | patrol | contact kill, wash away, antibiotic | kill/wash +5; photo +15 | killed +15 | 6 |
| 17 | Slurm Staphyloccocus (sic; port "Slurm Staphylococcus") (`slurm_icon` [100]); Super Slurm (`super_slurm_icon` [105], 75.64 x 72.43) | `BadMicrobe` | bad | 75.64 x 72.44 | as Slarg | patrol | as Slarg; `be_killed` has no `midAnimation`, so removal is immediate | kill/wash +5; photo +15 | killed +15 | 5, 6, 10 |
| 18 | Iggy Influenza (`iggy_icon` [97]) | `BadMicrobe` | bad (virus) | 47.96 x 48.64 | as Slarg | patrol | contact kill, wash away | kill/wash +5; photo +15 | **immune** | 7, 10 |
| 19 | Donna Dermatophyte (`donna_icon` [96]) | `BadMicrobe` | bad (fungus) | 100.42 x 147.74 | as Slarg | patrol | contact kill, wash away | kill/wash +5; photo +15 | **immune** | 6 |
| 20 | Milk glass (`milk_glass_icon` [106]) | `MilkGlassEntity` | - | 150 x 200 | dynamic, gravity exempt, pushable, `maxChangeExcempt` | 3.18 | becomes yoghurt | Lucy hit +10; yoghurt +50 | - | 8, 9 |
| 21 | Antibiotic pickup (`antibiotic_pickup` [112]) | `AntibioticPickup` | - | 38.3 x 16.3 | static, not solid | only while not carrying one | collected | - | - | 10 |
| 22 | Antibiotic bomb (runtime, clip `antibiotic_pickup`) | `AntibioticBombEntity` | - | 38.3 x 16.3 | dynamic, gravity on | 3.14 | explodes 2000 ms after landing (on screen only) | 3.14 | - | 10 |
| 23 | Superinfection (`superinfection_icon` [102]) | `SuperInfection` | bad | 409.15 x 195.42 | dynamic, gravity exempt, pushable, `maxChangeExcempt` | no AI (3.18) | 6 antibiotic hits; never removed | photo +15; on-screen explosion +30 | loses 1 life | 10 |

**Microbe movement (all rows 11-19)**: patrol at **10 px per step** by teleport (333 px/s at 30 ms steps), idle think **5 steps** (150 ms) at each turn, fall/slide re-check every 10 steps, pushed slides last at least 10 steps; they never jump or chase (3.17). The player runs up to the level's `maxChange.x` (21.16 / 23.98 / 25 px/step, 3.6); bullets travel 10 px/step plus Verlet carry (484-538 px range); the milk glass and superinfection move only when pushed and then creep at +1.0 / -0.9 px/step (3.4).

Unknown `<type>` strings become TILE; `super_*` map to the plain types (`TileDefinitionParser.as:98-106,136-139`). Types 3 (GENERIC), 4 (GOOD_MICROBE) and 5 (BAD_MICROBE) have class branches but no tile definitions. Entity creation (`PlatformGame.as:408-533`) processes cells row by row, column by column, so the **dynamic index order is: player, then entities in row-major order**; this order decides collision event order (3.18).

Microbe frame-script timings (25 fps, `midAnimation` spans) [P §4.4-4.5], [S §5.2]:

| Clip | idle loop | walk loop | be_photographed | be_hit | be_killed | be_washed_away |
|---|---|---|---|---|---|---|
| `lucy_icon` (255 f) | 10-30 | 150-175 | 50-63 | 80-96 | 115-141, stops at 142 | (none); `dive` 200-254 |
| `steve_icon` (261 f) | 10-35 | 166-181 | 61-74 | 91-103 | 126-151, stops | (none) |
| `patty_icon` (194 f) | 20-40 | (none) | 95-112 | 65-78 | 130-158, back to idle | (none) |
| `sandy_icon` (185 f) | 10-28 | (none) | 61-74 | 91-101 | 126-151 | (none) |
| `slurm_icon` (340 f) | 10-35 | 166-181 | 61-74 | 91-103 | label 126, **no `midAnimation`** | 295-297 loop |
| `slarg_icon` (263 f) | 10-28 | (none) | 61-74 | 91-101 | 126-151 | 240-242 loop |
| `iggy_icon` (360 f) | 10-15 | 230-254 | 110-130 | 70-82 | 156-186, back to idle | 50-52 loop |
| `donna_icon` (311 f) | 15-35 | 240-264 | 50-66 | 115-128 | 150-178, back to idle | 210-212 loop |
| `super_colin_icon` (546 f) | 15-35 | 285-291 | 85-104 | 135-147 | 180-210, stops | 245-247 loop |
| `superinfection_icon` (318 f) | `idle_1` 11-33, `idle_2` 125-147, `idle_3` 190-212, `idle_4` 260-279 | - | - | `be_hit_1` 45-124, `be_hit_2` 165-189, `be_hit_3` 225-259 | 290-318, back to `idle_4` while `lives > 0` (frame 1 declares `var lives = 6`) | - |

Patty, Sandy and Slarg have no `walk` label: they still patrol (the position teleports) while the clip keeps playing its idle loop, because Flash ignores a `gotoAndPlay` to a missing label. In Flash a script on frame N runs before frame N is drawn, so a `gotoAndPlay("idle")` on frame 30 shows frames 10-29. Labels the code asks for but no clip has: `fall` (FALL keeps the current frame), and `sandy_icon`/`steve_icon` frame 1 jump to a missing `steve_idle` (ignored, playback runs on into `idle`). Several labels share a frame (`idle`/`slide`/`be_lifted`); a lookup must accept any of them. Label typos: `be_lifed` (colin), `condifent` (game show), `Level3`, `sneeze_Start` [S §11].

### 3.17 Microbe AI (`GameEntity.as`, `GoodMicrobe.as`, `BadMicrobe.as`)

GameEntity defaults: `state = FALL (8)`, `thinkTime = 0`, `defaultThinkTime = 5`, `direction = RIGHT (1)` (LEFT = -1), `counter = 0`, `counterCeiling = 3`. States (`GameEntity.as:67-90`): DEFAULT 0, TURN 1, DYNAMIC 4, IDLE 5, BE_LIFTED 6, SLIDE 7, FALL 8, BE_PHOTOGRAPHED 9, BE_KILLED 10, WALK 11, JUMP_START 12, JUMP_MID 13, JUMP_END 14, BE_FROZEN 15, BE_WASHED_AWAY 16, MUNCH 17, RUN 18, DIVE 19, STARE 20, FLICK_HEAD 21, BE_HIT 22, IGNORE 23; bespoke states 100+.

Microbe constructor (`GoodMicrobe.as:18-39`, `BadMicrobe.as:22-43`): `speed = 10`, `lives = 1`, `hasBeenPhotographed = false`, `direction = RIGHT`, `physicsExcempt = true`, `slideTimer = slideTimerDefault = 10`, clip `idle`, `state = FALL`, `thinkTime = 0`, `colWidth = ceil(clip._width/50)`, `rowHeight = ceil(clip._height/50)`, `row`/`col` = spawn cell.

```
advance(): thinkTime--; think = thinkTime < 0
  if !isOnScreen: return []                          // off-screen microbes freeze and ignore events
  WALK:   think ? walkThink() : walk()
  IDLE:   think ? idleThink() : []
  FALL:   think ? fallThink() : fall()
  SLIDE:  slideTimer--; think ? slideThink() : slide()
  BE_PHOTOGRAPHED / BE_HIT: think ? (if !clip.midAnimation: snapAfterAnim(); emit FALL) : []
  BE_KILLED: think ? (if !clip.midAnimation: emit REMOVE; remove()) : []
  BE_WASHED_AWAY (bad only): think ? beWashedThink() : beWashed()
  DIVE (Lucy only): think ? diveThink() : dive()
act() in subclasses also does thinkTime-- for every event handled while on screen.

snapAfterFallOrSlide(): direction = (x > prevX) ? RIGHT : LEFT     // equal -> LEFT (first patrol leg is LEFT)
snapAfterAnim():        direction = (x > prevX) ? RIGHT : (x < prevX ? LEFT : direction)
both: col = floor(x/50); row = floor(y/50); physicsExcempt = true; previousPosition = position

walk() (GameEntity.as:222-242): teleport(x + speed*direction); if the column edge was crossed: col = nextCol

walkThink() (244-291): colX = col*50; nextCol = col + direction; nextColX = nextCol*50
  if safeToMove(colX, nextCol):
     RIGHT: thinkTime = floor((nextColX - (x + particle.width)) / speed)
            if x + speed + width > colX + 50:
               dangerous = any geometry at [row+i][nextCol+1] for i in 0..rowHeight-1
               if !dangerous: thinkTime += floor(50/speed) - 1
               thinkTime += floor(50/speed) - 1
     LEFT:  thinkTime = floor((x - colX) / speed)
            if x + speed + width > colX + 50: thinkTime += floor(50/speed) - 1   // right-hand test reused (sic)
     if thinkTime <= 0: thinkTime = 1
  else emit IDLE(5)

idleThink() (343-404): try the current direction, then the opposite:
  if safeToMove: emit WALK(dir)
  elif !onSolidGround(): emit FALL
  else: thinkTime = 5                                // stuck

safeToMove(colX, nextCol) (410-468):
  d = x - colX
  RIGHT: room = !(d + clip._width + speed > 50)      // current ART width, not the box
  LEFT:  room = d > speed
  if room: return onSolidGround()
  for i in 0..rowHeight-1: if geometry[row+i][nextCol] exists: return false     // wall (anchor cells only)
  return geometry[row+rowHeight][nextCol] exists                                // floor (anchor cells only)

onSolidGround() (472-501):
  if !physicsExcempt: physics test of 3.11 (abs(dy) < 1.5 on consecutive UPDATEs, via counter)
  else: c = floor(x/50); r = floor((y + clip._height)/50)
        if no geometry at [r][c]: return false
        pen = clip._y + clip._height - (row + rowHeight)*50; if pen > 0: position.y -= pen
        return true

fallThink() (305-331): if !onSolidGround(): physicsExcempt = false; thinkTime = 10
                       else: snapAfterFallOrSlide(); counterCeiling = 3; emit IDLE(5)
slideThink(): if slideTimer > 0 and !onSolidGround(): physicsExcempt = false; thinkTime = 10
              else: snapAfterFallOrSlide(); counterCeiling = 3; emit IDLE(1)
slide()/fall(): if dy < 1.5: counter-- else counter = counterCeiling
```

In plain terms: microbes spawn in FALL (tall ones often find "no ground" at first, switch physics on and drop), then snap and idle 5 UPDATEs; **every first patrol leg is leftwards**; they patrol at 10 px per UPDATE (333 px/s), turn at walls and at edges (no floor anchor in the next column) with a 5-UPDATE idle, never jump and never chase. They see **only anchor cells**, so the non-anchor parts of wide tiles look like voids (a 250 px toast looks like a 1-cell platform) and they may walk into big tile art, where physics pushes them out. The grid ground test relies on `y + clip._height` landing exactly on a multiple of 50: **the port uses an epsilon** (bug fix). When pushed (COLLIDE) they SLIDE with physics on for at least 10 UPDATEs, then re-snap.

Microbe `act()` (`GoodMicrobe.as:115-212`, `BadMicrobe.as:126-244`): THINK, WALK(dir), IDLE(t), FALL set the state and animation and call `advance()`. COLLIDE is **ignored** in FALL, SLIDE, BE_PHOTOGRAPHED, BE_HIT, BE_KILLED (bad also BE_WASHED_AWAY; Lucy also DIVE). Otherwise:

| Microbe | Collided with | Result |
|---|---|---|
| Good | a `BadMicrobe` | emit BE_HURT(1), then SLIDE (physics on, `counterCeiling = 10`) |
| Good | anything else (player, bullet, good microbe, milk) | SLIDE, clip `slide` |
| Lucy | milk | DIVE instead (3.18) |
| Bad | `GoodMicrobe`, `PlayerEntity` or `BulletEntity` | `washAway = (other is Bullet)`; emit BE_HURT(1); SLIDE |
| Bad | anything else | SLIDE |

- BE_HURT: `lives -= 1`, clip `be_hit`, state BE_HIT. At `lives <= 0`: good microbes emit BE_KILLED and play `be_killed`; bad microbes emit BE_KILLED + `be_killed` if `!washAway`, else `EVENT_BAD_MICROBE_WASH_AWAY` + `be_washed_away`.
- Wash away (bad only): physics and gravity exempt, state BE_WASHED_AWAY; `beWashed()` does `y -= 15; alpha -= 5` per non-think UPDATE; `beWashedThink()` runs every 6th UPDATE (`thinkTime = 5`) and at `alpha <= 0` emits REMOVE, calls `remove()` and emits BE_KILLED (which scores and counts). It rises about 300 px over about 24 UPDATEs.
- `remove()`: good: exempt, `isOnScreen = false`, clip hidden (`GoodMicrobe.as:391-403`); bad: the same plus the body moved to (-100, -100) (`BadMicrobe.as:451-464`); the game's REMOVE then nulls dynamic entities.

### 3.18 Interactions, milk and superinfection

| A touches B | Outcome |
|---|---|
| Player + bad microbe (lives > 0), player not hurt | Player loses 1 life, 480 ms hurt. If the microbe is IDLE or WALK it is **killed** (not washed): +5, counts for KILL_ALL. Otherwise it survives and can hurt again when the hurt state ends. |
| Player (already hurt) + bad microbe IDLE/WALK | The microbe is still killed (+5); the player is unharmed. |
| Player + superinfection | Hurt each time the hurt state ends while touching; the superinfection is unaffected. |
| Player + good microbe | The microbe SLIDEs, pushed with physics: the "push Lucy" mechanic. |
| Player + milk / superinfection | Pushed; both float (gravity exempt) and creep afterwards (3.4). |
| Bullet + bad microbe | Bullet splats; microbe **washed away** (+5 when the fade ends; counts). The dispatcher's +3 bonus is dead code in Flash (planned fix, 10.1 #18). |
| Bullet + good microbe | Bullet splats; microbe slides, unhurt (`hurtGood` is never read). |
| Bullet + superinfection / milk | Bullet splats; no effect. |
| Good + bad microbe, both IDLE/WALK | **Both die**: good -10, bad +5 (kill, not wash). The bad death counts for KILL_ALL (L5 places Steve among the Slurms; L10 Lucy near Slurm); the good death would count for PHOTOGRAPH_GOOD, but L2 (the only level with that goal) has no bad microbes. |
| Flash + microbe | Photo (3.13). |
| Antibiotic explosion | 3.14. |

Event order is always COLLIDE(lower index) then COLLIDE(higher index); the player (index 0) is first.

**Milk glass and yoghurt** (`MilkGlassEntity.as`, `LucyLactobacillus.as`):
- Dynamic 150 x 200, gravity exempt, `maxChangeExcempt`, physics on, `state = WHITE_STATUS (100)`, clip stopped, `counterCeiling = 1`, `counter = 0`: **one Lucy contact is enough** (`MilkGlassEntity.as:22-33`).
- Milk COLLIDE with a LUCY not in DIVE: emit `MILK_GLASS_EVENT_HIT`; handled in WHITE_STATUS: clip `tickle`, `counter++`; if `counter == counterCeiling` emit `MILK_GLASS_EVENT_TURN_TO_YOGURT` (goal +1, +50 points); state FLASHING (101); +10 points (`:64-93`).
- FLASHING: when `midAnimation == false` (tickle frames 20-49, 30 frames, 1.2 s) go to YOGURT_STATUS (102), clip `yogurt` (frames 60-80). A glass in FLASHING or YOGURT ignores further hits.
- Lucy COLLIDE with MILK while IDLE or WALK: physics exempt, `isDynamic = false`, state DIVE, clip `dive`; `dive()` alpha -= 5 per non-think UPDATE; `diveThink()` every 6th UPDATE: at alpha <= 10 emit REMOVE, `remove()`, state IGNORE (`LucyLactobacillus.as:145-175,208-228`).
- **Order dependence** (kept faithful): both COLLIDEs come from one contact and the lower dynamic index is handled first. A walking/idle Lucy with the lower index dives before the milk sees her and **no yoghurt is made**; a **pushed** (SLIDE) Lucy ignores the contact, so the milk registers it and she dives later; a milk with the lower index always registers. L8: milk at (4,17), Lucys in rows 0-1 (lower indices). L9: milk at (4,2), (4,28), (4,50); Lucys in rows 1, 2, 5. In practice the player must push Lucy into the glass, which is what the briefing says ("just push Lucy into the glass"). Open question 11.3.
- Once a milk glass has been off screen it stays physics-exempt (bespoke state; 10.1 #30, kept).

**Superinfection** (`SuperInfection.as`): type 23; dynamic 409 x 195, gravity exempt, physics on, `maxChangeExcempt`; `state = IDLE`, `lives = 6`, `hitTimes = 0`, clip `idle_1`. **No AI** (the think code is commented out, `:43-47`). Only BE_HURT is handled (`:88-105`), and it only comes from on-screen antibiotic explosions: `lives--; clip.lives = lives; hitTimes++`; if `lives > 0` play `be_hit_<hitTimes>` (or `be_killed` once `hitTimes > 3`; the clip returns to `idle_4` while `clip.lives > 0`, so hits 4 and 5 are fake deaths), state BE_HIT; at 0 lives state BE_KILLED, play `be_killed`, the clip stops and hides. **Never REMOVEd** (stays an invisible solid box in the original; fixed). `lives == 0` stops it hurting the player. Soap and white blood cells do nothing to it. Photographing it paid +15 every time (fixed: counts once).

### 3.19 Pickups and portal

- Pickups (`SoapPickup`, `WhitePickup`, `AntibioticPickup`): static, `physicsExcempt = true` (not solid), state IDLE. Each `advance()` does `clip.hitTest(player.clip)` and emits `COLLIDE(target = pickup, [player])`. Ammo: the game adds +7, then act: REMOVE, `ammo++`, `infiniteAmmo = true` if `ammo == maxAmmo`, `remove()`. Which class an ammo cell becomes is decided by `bodyLevel`, not by the cell's icon (`PlatformGame.as:468-472`). Pickups never respawn.
- Portal (`PortalEntity.as:29-48`): static 103.6 x 163.8, state CLOSED (100), clip stopped, `portalId = entities.length` at creation (`PlatformGame.as:498`). `PORTAL_EVENT_OPEN`: `clip.play()`, state OPEN (101). The symbol has one frame, so open and closed look the same; the ePhone picture switching to `exit_status` is the only cue. Entry is checked **every 10 UPDATEs**: OPEN, distance from the portal's top-left to the player's top-left under 100 px, and `clip.hitTest(player.clip)`: emit TRIGGER_LEVEL_END.
- Port additions [PD]: a closed portal is drawn dimmed and greyed; opening plays a chime, stars, shockwave rings and a banner ("The portal is open!"), the ePhone picture flips and the phone wiggles; an edge arrow points to an off-screen open portal; entering draws the player in (spin and shrink) and an iris closes.
- Depth order (SWF): level entities are inside the `game` clip below the tile cells duplicated as they scroll in, so **tiles cover level entities** (the exit portal's bottom 14 px sit behind the worktop in L1, `reference/captures/ruffle-level1-portal-closed-tile-over-portal.png`); projectiles and the flash are attached later, above tiles; the avatar (root depth 6) is above everything in `game` (depth 4) [PD "Depth order"].

### 3.20 Goals (`Goal.as`)

`new Goal(Number(goalType), microbeType, required)` (`MapBuilder.as:67`); `microbeType` and `required` stay strings (AS2 `==` coerces). Parse them as numbers.

| goalType | Name | Counts on | Source |
|---|---|---|---|
| 0 | PHOTOGRAPH_SPECIFIC | BE_PHOTOGRAPHED with `target.type == microbeType` | `Goal.as:48-61` |
| 1 | PHOTOGRAPH_GOOD | BE_PHOTOGRAPHED of any `GoodMicrobe` **and also BE_KILLED of any `GoodMicrobe`**; microbeType ignored | `:62-78,114-127` |
| 2 | PHOTOGRAPH_BAD | nothing (unimplemented); never met | - |
| 3 | PHOTOGRAPH_ANY | any BE_PHOTOGRAPHED (the superinfection included) | `:79-90` |
| 4 | KILL_ALL | BE_KILLED of any `BadMicrobe`; **microbeType ignored**; a second `case KILL_ALL` is unreachable | `:98-113,128-139` |
| 5 | KILL_SPECIFIC | nothing (unimplemented); never met | - |
| 6 | ANTIBIOTIC | each EXPLODE_ANTIBIOTIC, whatever it hits | `:153-164` |
| 7 | YOGURT | each MILK_GLASS_EVENT_TURN_TO_YOGURT | `:141-152` |

- Each counted event does `achieved++` and returns MODIFY_GOAL_STATUS, which ticks the next ePhone box (`ePhone.status["button" + nextButton].gotoAndPlay("tick"); nextButton++`, `PlatformGame.as:918-925`).
- `isGoalMet()` is `achieved == required` (`Goal.as:35-41`). Two counted events in one UPDATE can step past `required` and deadlock the level (exposed: L5, L6). **Fixed: `>=`.**
- Checked once per UPDATE at its start; when all goals are met and the portal is CLOSED, the goal is popped, the phone shows `exit_status`, the portal opens.
- Antibiotic kills emit no BE_KILLED, so they never count for KILL_ALL or PHOTOGRAPH_GOOD.
- **goalType 0 vs 3**: the documentation says level 1 uses 3 (`doc:280`); `levels/alpha_level1.xml` says `goalType="0"` with `microbeType="11"`. Only 0 draws the Lucy picture and camera icon (`PlatformGame.as:337-341`); 3 would fall to the `else` branch and draw Slurm with the kill icon (`:355-358`). **0 is right**; the data keeps 0.

### 3.21 Scoring (all sources)

| Event | Points | Source |
|---|---|---|
| Collect soap / white pickup | +7 | `PlatformGame.as:649-657` |
| Bullet hits bad microbe | +3 **never awarded** in Flash (tests type 5, never assigned); planned fix awards it (10.1 #18) | `:658-665` |
| Bad microbe killed or washed away (BE_KILLED) | +5 (the trace text says 15) | `:945-947` |
| Good microbe killed (BE_KILLED) | -10 | `:948-950` |
| Player dies | -10 | same |
| Photograph good microbe | +5 | `:968-970` |
| Photograph bad microbe (superinfection included; repeatable on it in Flash, once in the port) | +15 | `:971-973` |
| Lucy touches milk | +10 | `MilkGlassEntity.as:87-91` |
| Milk turns to yoghurt | +50 | `PlatformGame.as:987-990` |
| Antibiotic explosion | -10 per on-screen Lucy/Sandy/Steve, +15 per on-screen Slurm/Slarg/Colin, +30 if the superinfection is on screen | `:825-871` |

The score starts at 0 once (`PlatformGame.as:123`) and **persists across levels, rounds and restarts**. It is never copied to `player.score` or any form: platform points do not affect the quiz result (only quiz points decide the winner, 6.6). Port: the platform score is shown on level cards and the final screen.

### 3.22 Tiles

- 50 px grid; cell (row, col) is world (col*50, row*50), top-left anchored. Row 0 is the top.
- The level's own `<tiles>` block is **ignored**: ids index `levels/tile_definitions.xml` in file order minus erasers (the eraser is last, id 113, so ids 0-112 map one to one), and the linkage is the definition's **`<icon>`** (`MapBuilder.as:70-82`). `sides`, `rows`, `cols`, `entity` and `script` are never read.
- **Tiles are multi-cell by art size**: the static box is the clip's `_width` x `_height` anchored at the cell's top-left. 37 of 92 geometry tiles are bigger than a cell:

| Size (px) | Tiles [id] |
|---|---|
| 50 x 200 | `loaf_*` [14-19] |
| 50 x 250 | `splinter_obj` [88] |
| 100 x 200 | `pepper_obj` [20], `salt_obj` [21] |
| 250 x 50 | `toast_jam_obj` [26], `toast_marm_obj` [27] |
| 150 x 150 | `yoghurt_lid_obj` [37], `yoghurt_obj` [38] |
| 100 x 150 | `acid_pit_start_obj` [39], `acid_pit_end_obj` [41]; `acid_pit_mid_obj` [40] is 100 x 148 |
| 100 x 100 | `bone_start/end_obj` [42, 44], `villi_floor/roof_obj` [70, 71], `hair_slope_start_obj` [74], `spot_large/ooze_obj` [89, 90], `wart_obj` [92] |
| 50 x 100 | `bone_mid_obj` [43], `flesh_gristle_4_tile` [52], `hair_base_obj` [72] |
| 100 x 50 | `flesh_gristle_3_tile` [51], `platform_mid_obj` [60], `hair_slope_obj` [75], `hair_slope_end_obj` [76], `hair_horiz_end_obj` [78], `plaster_multi_mid_obj` [82] |
| 200 x 50 | `plaster_singular_obj` [80] |
| 150 x 50 | `plaster_multi_start/end_obj` [81, 84] |
| 200 x 100 | `scab_obj` [85] |

- All others are 50 x 50. "Slope" tiles are plain rectangles. Acid pits are ordinary solid ground (no hazard tiles exist).
- Groups: 0-13 kitchen floor tiles, 14-27 food, 28-38 units and yoghurt, 39-69 body (69 blank), 70-92 skin, 93-105 microbes, 106 milk, 107/108 portals, 109/110 soap/white pickup, 111 player start, 112 antibiotic pickup, 113 eraser.
- Large boxes overlap neighbouring anchors (`villi_roof_obj` over `roof_a_tile` in L7/L10, `scab_obj` over skin in L6); draw every anchor's art at its own size in XML order [L §4.2 item 7].
- Full per-level usage counts: [L §2].

### 3.23 Camera

Decision at the end of each UPDATE (`PlatformGame.as:1028-1050`), applied at the start of the next (`:605-612`; `Game.as:56-69`):

```
dx = player.position.x - player.previousPosition.x
if player.clip._x + player.clip._width >= 450: scrollRight = true;  scrollLeft = false; scrollSpeed = abs(dx)
elif player.clip._x <= 250:                   scrollLeft = true;   scrollRight = false; scrollSpeed = abs(dx)
else:                                         scrollLeft = scrollRight = false
next UPDATE: screenLeft -= scrollSpeed (left) or += scrollSpeed (right); screenRight = screenLeft + 800
```

- `clip._x` is from the last render and includes the mirror offset (facing left: `pos.x - camX + 49`); `clip._width` is the live avatar art width.
- One-step lag; the camera moves exactly as far as the player moved last step, **towards the margin even when the player moves away from it** (standing in the left zone and moving right pans left; the player crosses the screen at twice their speed until past 250).
- **No clamp at level edges** (L5 starts at x = 50 and pans about 100 px into negative x; only the background shows). No vertical scrolling.
- Because on-screen status drives tile solidity (3.3) and entity freezing, **the camera is part of the simulation**.
- **Port** [PD]: same margins (250, 450), but the view eases towards the target (25% per step), is clamped to `[0, cols*50 - 800]`, never pans the wrong way, and slides up to 70 px of look-ahead against the direction of travel while riding (`options.cameraLookAhead`, 0 turns it off). Still simulation state (deterministic). Shake is a render-only offset.

### 3.24 HUD and ePhone

Root timeline of `movies/introductionToMicrobes_platformer.swf` [P §8.1]:

| Instance | Depth | Position (x, y) | Size | Purpose |
|---|---|---|---|---|
| background (shape 1495) | 1 | 0, 0 | 800 x 450 (bounds -0.5..799.45) | **flat `#ff9900` orange** for every level (verified: fill colour of shape 1495; the SWF stage colour `#0099cc` is hidden under it, so [S §5.8] "no background symbol" is incomplete). Port draws `#ff9900` without the 1 px outline. |
| `game` (PlatformGame) | 4 | 0, 0 | | container for tiles and entities |
| `avatar` | 6 | 40.9, 116.9 | 50 x 100 placeholder | holds `harry.swf`/`amy.swf` |
| `ephone` (`e_phone`, 1491) | 8 | bounds x 695.6-788.7, y 267.6-445.3 | about 93 x 178 | ePhone, bottom right |
| `score` | 89 | 674.8, 14.05 | 73 x 32.1 | four `digit` clips `thousands/hundreds/tens/units` at x 7.6 / 22.5 / 37.4 / 52.3, y 6.2; labels `zero`..`nine` at frames 1, 10..90 |
| `heart0/1/2` | 111/115/119 | x 655.85 / 699.35 / 742.85, y 71.7 | 24.2 x 23.3 | lives; lost from the left |
| `antibiotic_held` | 123 | 671.15, 104.5, scale 2.149 | 82.3 x 35.0 | held antibiotic; hidden at start and on throw; **not reset between levels** (fixed) |
| `timeLeft` | 125 | 333.95, 17.5 | 104 x 21.9 | HTML text, Arial 16 bold black; initial text "90" until the first second passes (fixed: shows 180) |
| `talkie` | 127 | 8.7, 305.4 | 739 x 143 | hidden in the platformer |
| `whiteout` | 194 | 0, 0 | 800 x 450 | alpha 0; set to 100 on an explosion, -10 per frame (sprite 1500 script) |

- Score display: `updateScore()` splits into digits with `Math.floor`; negative scores show wrongly (-10 as "0990") and scores >= 10000 lose the ten-thousands (`PlatformGame.as:1331-1372`). Port draws the true number, clamped 0-9999 in the four-digit art [PD].
- **ePhone** (`EPhone.as`, sprite 1491): frames `small` 2 (stop), `grow` 10-29, `large` 30 (stop), `shrink` 40-59 (then `small`), `message` 70 (unused). Large, it turns to landscape and covers about x 41-773, y 30-414. Children: `screen` (sprite 1483) holding the `status` screen, and `bigScreen` (sprite 1479, `level_intros`). `grow(name)`: `gotoAndPlay("grow")`, `isLarge = true`, `bigScreen.gotoAndPlay(name)`, show `bigScreen`, hide `screen`; `shrink()` the reverse (`EPhone.as:16-30`).
- **Intro pages** (`level_intros`, 421 frames; labels `level1` 1, `level2` 40, `level3` 50, `level4` 70, `level5` 90, `level6` 110, `level7` 140, `level8` 190, `level9` 221, `level10` 241; no `level11`): each page `stop()`s and starts an autoplay interval (40 ms polling, `waitTime = 5000` ms); a click on `invisible_button` or 5 s calls `play()` for the next page; the last frame of a level's block sets `finished = true`, and INIT_DIALOGUE then shrinks the phone and starts the clock. A new interval is created per page without clearing the old one, so fast clicking skips pages (fixed). Page texts: section 7.4.
- **Status screen** (`status`, sprite 289, 180 x 293): `background` image at (14.65, 15.2), 150.7 x 168.3; mode icon `mode` at (133, 6.3); six `tick_box_button` clips `button1`..`button6`, two rows of three at y 199.3 and 249.4, x 16.45 / 70.45 / 124.5; labels `grey` 1, `tick` 10, `cross` 20 (never used), `empty` 30. CREATE_GUI (`PlatformGame.as:331-362`) sets `nextButton = 1`, sets the first `required` boxes to `empty` (the rest stay `grey`) and picks from `goals[0]`:

| Goal | Background | Mode icon |
|---|---|---|
| PHOTOGRAPH_GOOD (1) | `lucy_image` (always Lucy) | `camera_icon` |
| PHOTOGRAPH_SPECIFIC (0), Lucy 11 / Steve 14 / Sandy 12 / Slarg 16 / Slurm 17 | `lucy_image` / `steve_image` / `sandy_image` / `slarg_image` / `slurm_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, **Patty 13** | **no branch**: the default `background` stays (L4 shows no Patty) | `camera_icon` |
| YOGURT (7) | `milk_image` | none (`yog_icon` export unused) |
| ANTIBIOTIC (6) | `superinfection_image` | none (`antibiotic_icon` export unused) |
| anything else (KILL_ALL) | `slurm_image`, even in the Iggy level 7 | `kill_icon` |

When the goal is met the background becomes `exit_status`.

**The ePhone is not an encyclopaedia.** The brief calls the in-game phone "the microbe encyclopaedia", but in Flash it only ever shows this status screen and the level intro pages; there is no browsable microbe catalogue, no `message` use and no call screen (the `button_ok/hangup/answer` and `text_message` exports are unused). The port's phone button re-opens the current level's briefing. A microbe gallery built from the intro-page facts would be new content (not planned).

Port [PD]: a sparkle flies from each photographed microbe to its tick box; the phone moves to the left edge in touch play; the "e-Bug" wordmark on the phone art is removed; the HUD's unused `timer` stopwatch clip sits left of the time, which turns red and pops each second in the last 20 s; a hidden live region mirrors lives, score, time and goal for screen readers.

### 3.25 Level complete, game over, restart (`PlatformGame.as:1169-1250`)

Both LEVEL_COMPLETE (portal, or the removed Home/Alt cheat) and GAME_OVER (timer, death) run the same cleanup: remove cell clips; empty the particle and ball arrays; remove `ePhone.status`; reset `playerClip._xscale = 100` and `delete entities[0]` (keeps the avatar clip); pop and remove every other entity clip; `Key.removeListener`. Then: if `level.next == "exit"`, `exitReason = END_REASON_COMPLETE (2)` and GAME_OVER; if GAME_OVER, `_root.endofHoverboard(exitReason)`; else `initialiseGame(player, level.next, tilesList)`. Flow consequences: 2.6.

### 3.26 Events and dispatch

Types (`Event.as`): THINK 0, IDLE 1 (`params[0]` thinkTime), LAND 2 (unused), BE_HURT 3 (`params[0]` damage), BE_KILLED 4, SLIDE 5 (unused), BE_PHOTOGRAPHED 6, BE_LIFTED 7, COLLIDE 8 (`params[0]` other entity, `params[1]` half the correction), WALK 9 (`params[0]` direction), FALL 10, REMOVE 11, CREATE_SOAP_BULLET 12, CREATE_WHITE_BULLET 13, CREATE_CAMERA_FLASH 14, MODIFY_POINTS 15, MODIFY_GOAL_STATUS 16, MILK_GLASS_EVENT_TURN_TO_YOGURT 17, PICKUP_ANTIBIOTIC 18, CREATE_ANTIBIOTIC 19, EXPLODE_ANTIBIOTIC 20, FAKE_KILL_SUPERINFECTION 21 and KILL_SUPERINFECTION 22 (unused), player control events 50-68, TRIGGER_LEVEL_END 900, TRIGGER_GAME_END 901. Bespoke ids overlap the player's 50/51: `PORTAL_EVENT_OPEN = 50`, `PORTAL_EVENT_CLOSE = 51`, `MILK_GLASS_EVENT_HIT = 50`, `EVENT_BAD_MICROBE_WASH_AWAY = 51` (harmless in Flash because the dispatcher has no case for 50/51; the port namespaces them).

`PlayerEntity.advance()` (`:134-164`) builds `checkKeys()` and `checkStateEvents()` into an internal queue: CREATE_SOAP_BULLET, CREATE_CAMERA_FLASH and CREATE_ANTIBIOTIC go to the game; all others are fed to `act()` at once and their results re-queued.

| Dispatcher case (`PlatformGame.as:646-1000`) | Behaviour |
|---|---|
| COLLIDE (647-669) | Ammo pickup + player: `target.act(e)`, then MODIFY_POINTS +7. Bad microbe (type 5) + bullet: +3 (dead branch). Else `target.act(e)`. |
| CREATE_SOAP_BULLET (670-709) | Soap level: spawn soap. Body level: re-queue as CREATE_WHITE_BULLET. |
| CREATE_WHITE_BULLET (710-744) | Spawn a white blood cell. |
| CREATE_CAMERA_FLASH (745-783) | Spawn the flash. |
| PICKUP_ANTIBIOTIC (784-788) | Show `antibiotic_held`; `has_antibiotic = true`. |
| CREATE_ANTIBIOTIC (789-821) | Hide the icon; `has_antibiotic = false`; spawn the bomb. |
| EXPLODE_ANTIBIOTIC (822-885) | 3.14. |
| REMOVE (886-914) | `target.act(e)`; if the target is the flash, `canTakePhotograph = true`; if `target.particle.isDynamic`, remove the clip and null `entities[indexId]`, `dynamicEntities[i]`, `dynamicBoundingBalls[i]` (never compacted). Statics stay. |
| MODIFY_POINTS (915-917) | `score += params[0]` |
| MODIFY_GOAL_STATUS (918-925) | tick the next ePhone box |
| TRIGGER_LEVEL_END (926-928) | LEVEL_COMPLETE |
| TRIGGER_GAME_END (929-931) | GAME_OVER |
| BE_KILLED (932-954) | each goal's `updateGoal(e)` (a later goal overwrites earlier results), `target.act(e)` (its result is **discarded**), MODIFY_POINTS +5 if `BadMicrobe` else -10 |
| BE_PHOTOGRAPHED (955-978) | goals, act (result discarded), +5 if `GoodMicrobe` else +15 |
| MILK_GLASS_EVENT_TURN_TO_YOGURT (979-992) | goals, +50 |
| default (993-999) | `newEvents = target.act(e)` |

### 3.27 Documentation versus code (platformer)

The code wins in each case [P §10]: 15 ms loop confirmed; level 1 goalType is 0, not 3 (`doc:280`); tiles are multi-cell by art size (`doc:337`); the level's own `<tiles>` block is ignored (`doc:351`); the world's height is fixed at 450 with top -100, only `cols` is used (`doc:263`); levels 2 and 3 declare 11 rows (`doc:345`); only visible tiles exist or collide (`doc:805`); the +3 bullet bonus never fires (`doc:1234`); pickups are detected by `hitTest`, not physics (`doc:1226`); idle think time is 5, not 10 (`doc:1183`); intros also autoplay every 5 s (`doc:1116`); only `MAX_JUMPS` is used (`doc:820`); off-screen dynamic entities freeze and lose physics (`doc:977`).

---

## 4. Levels

Full analysis with ASCII maps of every level: [L §1-4]; resolved data: `reference/analysis/levels.json`; runtime data for the port: `web/data/levels/`.

### 4.1 Levels in play order

Every level: 180 s timer, 3 lives, one player start, one exit portal, no duplicate cells, only defined and exported linkages [L §4.1].

| # | File (`name` = intro label, intro frame) | Round | Setting | cols x rows declared (usable) | `body_level` attr: runtime | Throws | Goal (type, microbe, required) | Goal in plain English | Targets placed (slack) | Start (row, col) | Portal (row, col) | maxChange.x | ePhone picture / icon |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `alpha_level1.xml` (`level1`, frame 1) | 1 | kitchen | 69 x 9 (3450 x 450 px) | absent: **true** | white blood cells | 0, 11, 3 | Photograph 3 Lucy | 3 Lucy (**none**) | 1, 6 | 5, 56 | 21.158 | `lucy_image` / camera |
| 2 | `alpha_level2.xml` (`level2`, 40) | 1 | skin | 44 x **11** (rows 0-8 only) | absent: **true** | white | 1, (11), 3 | Photograph (or kill) 3 good microbes; microbe ignored | 3 Lucy (**none**) | 4, 3 | 5, 36 | 21.158 | `lucy_image` / camera |
| 3 | `alpha_level3.xml` (`level3`, 50) | 1 | skin | 44 x **11** (rows 0-8) | absent: **true** | white | 0, 14, 3 | Photograph 3 Steve | 3 Steve (**none**) | 2, 2 | 4, 41 | 25 | `steve_image` / camera |
| 4 | `alpha_level4.xml` (`level4`, 70) | 1 | kitchen | 69 x 9 | absent: **true** | white | 0, 13, 3 | Photograph 3 Patty | 3 Patty (**none**) | 4, 5 | 5, 46 | 25 | **none** (default `background`) / camera |
| 5 | `alpha_level5.xml` (`level5`, 90) | 2 | skin | 69 x 9 | `false`: false | **soap** | 4, (17), 3 | Kill or wash away any 3 bad microbes | 4 Slurm (1 spare target), 1 Steve (good); 15 soap pickups | 3, 1 | 3, 63 | 25 | `slurm_image` / kill |
| 6 | `alpha_level6.xml` (`level6`, 110) | 2 | skin | 69 x 9 | `false`: false | **soap** | 4, (17), 3 | Kill or wash away any 3 bad microbes | 2 Slurm, 1 Slarg, 1 Donna (1 spare target); 17 soap pickups | 3, 6 | 4, 51 | 25 | `slurm_image` / kill |
| 7 | `alpha_level7.xml` (`level7`, 140) | 2 | body | 75 x 9 | `true`: true | white | 4, (17), 3 | Kill any 3 bad microbes | 3 Iggy; 21 white pickups (**none**) | 3, 5 | 2, 71 | 23.980 | `slurm_image` (sic) / kill |
| 8 | `alpha_level8.xml` (`level8`, 190) | 3 | kitchen | 37 x 9 | `true`: true | white | 7, (17), 1 | Make 1 yoghurt (push Lucy into the milk) | 1 milk, 4 Lucy | 2, 3 | 1, 31 | 21.158 | `milk_image` / none |
| 9 | `alpha_level9.xml` (`level9`, 221) | 3 | kitchen | 64 x 9 | `true`: true | white | 7, (17), 3 | Make 3 yoghurts | 3 milk, 6 Lucy | 1, 7 | 4, 57 | 21.158 | `milk_image` / none |
| K | kitchen fridge game (no file) | 4 | kitchen scene | - | - | - | - | Four timed sorting levels (section 5) | - | - | - | - | - |
| 10 | `alpha_level10.xml` (`level10`, 241) | 5 | body | 46 x 9 | `true`: true | white; antibiotics | 6, (17), 6 | Set off 6 antibiotics (each **on-screen** detonation counts, whatever it hits) | 6 antibiotic pickups (**none**, no respawn); superinfection (6 lives), 1 Slurm, 1 Iggy, 1 Lucy | 3, 3 | 2, 37 | 21.158 | `superinfection_image` / none |
| (11) | `alpha_level11.xml` (`level11`, no intro label) | - | body (bone tiles) | 35 x 9 | `true`: true | white | 4, (17), 6 | Kill any 6 bad microbes: **impossible** (5 placed) | 2 Iggy, 2 Slurm, 1 Donna, 1 Steve; 8 white, 5 antibiotic | 1, 9 | 4, 34 | 23.980 | - |

`microbeType="17"` on L5-L10 is decoration: KILL_ALL, YOGURT and ANTIBIOTIC ignore it. Designer plan `levels/plan2.txt:3-20`: 1 photo 3 Lucy (kitchen), 2 photo 3 Lucy (skin), 3 photo 3 Staph (skin), 4 photo 3 Patty (kitchen), 5 kill 3 Slurm, 6 kill all bad (skin), 7 kill all bad (Iggy, body), 8 make 1 yogurt, 9 make 2 yogurt (XML: 3), 10 kill superbug (XML: 6 antibiotics).

### 4.2 Per-level notes (data checks)

From [L §4]:

- **No-slack levels**: L1-L4 place exactly their 3 targets, L7 exactly 3 Iggy, L10 exactly 6 antibiotics. In L1-L4 nothing can kill a target (no bad microbes, no antibiotics, no milk), so the risk there is only a target stuck out of reach; in L7 every Iggy death (wash or contact) counts; in **L10 a bomb that scrolls off screen never explodes**, and with no spare pickup the level becomes unwinnable until time-out or death. L2's goal would also count good-microbe deaths, but nothing in L2 can kill a Lucy.
- **L1**: cols 61-68 behind the salt/pepper wall at cols 59-60 are empty dead space. Row-8 floor gaps (col 16, 27-28, 38-46, 50-51) are ditches: the world floor is y 450.
- **L2**: declares 11 rows; rows 9-10 are empty. Cols 40-43 behind the hair wall at col 39 look unreachable. `plaster_singular_obj` at (8,43) is 200 px wide and runs past the world edge (x 2200). The Lucy at (0,13) sits on the top platforms.
- **L3**: declares 11 rows. 8 cells at cols 45-46 are beyond `cols="44"`: **drawn but not solid** (physics covers cols `0..cols` inclusive), so the visible hair wall at col 45 is 50 px right of the real barrier, the world clamp at x 2200. (8,44) gets a box but lies outside the world.
- **L4**: cols 57-68 behind the two pepper pillars at cols 55-56 are dead space. **The ePhone shows no Patty picture** (no Patty branch in CREATE_GUI).
- **L5**: cell (12,65) is beyond row 8: dead data. Row-8 gaps at cols 11-14 and 16-30 are ditches. Overshoot deadlock risk in the original (4 bad for 3; fixed by `>=`).
- **L6**: cols 56-68 empty except a stray `skin_base_tile` at (7,59). Plan says "kill all bad", XML asks 3 of 4. Same overshoot risk.
- **L7**: cell (10,12) beyond row 8: dead data. Fully walled (cols 0 and 74, roof row 0).
- **L8**: portal at (1,31), high up, reached from the `Sugar_Tile` ledge (row 4, cols 28-32); the portal box overlaps the salt/pepper pillar at cols 33-34. Cols 35-36 empty. No row-8 floor at cols 24-32.
- **L9**: no findings (3 spare Lucy).
- **L10**: rows 6-8 empty from col 25 to col 45 (the world floor is the floor). The superinfection at (5,25) is gravity exempt and floats where placed. Antibiotic blasts spare Iggy (virus), Donna and Patty (fungi): the lesson.
- **L11**: orphan, impossible goal, no intro label; the only level with bone tiles. `ePhone.grow("level11")` does `bigScreen.gotoAndPlay("level11")` (`EPhone.as:16-23`), which Flash ignores for a missing label: loaded fresh, the phone shows level 1's pages (seen in Ruffle, [R] section 4, `flash-ruffle.md:125`); after another level it would sit on that level's last page with `finished == true` and shrink at once. Its status screen would show `slurm_image` with `kill_icon` and 6 boxes (KILL_ALL branch, 3.24).
- Microbes spawn in the air at their anchor cell and fall; a data check "spawns sit on solid ground" must be defined as "solid ground exists below the spawn within the level" (and for the player: the fall from `player_start` lands on a tile or the world floor), not "the spawn cell is on a floor".

### 4.3 How a level is read (rules the port copies)

1. Loaded from `"../levels/" + nextLevel` (`PlatformGame.as:242`); default `alpha_level1.xml` (`:133`).
2. Children are read **by position**: `childNodes[0]` goals, `[1]` tiles (ignored), `[2]` rows (`MapBuilder.as:56-58`).
3. Level attributes used: `name` (ePhone intro frame label: functional), `next`, `rows`, `cols`, `body_level`, `id`. `bodyLevel = (body_level == "false") ? false : true` (`MapBuilder.as:49`): missing means true.
4. Cell `<row id=r><column id=c><tile id=t/>` means cell (r, c) holds definition t. Type TILE (1) goes to `levelDataGeometry[r][c]`, anything else to `levelDataEntities[r][c]`. A later definition of the same cell overwrites (none in alpha levels). `player_start` sets `uniqueItems[PLAYER] = (c, r)`; the last one wins.
5. Definitions: `levels/tile_definitions.xml`, each `<tile>` read positionally (child 0 `label`, 2 `type` string, 3 `icon`, 4 `movie`) (`TileDefinitionParser.as:59-63`; type strings mapped at `:67-140`, unknown strings become TILE at `:136-139`); runtime linkage = `icon`. In all 11 alpha levels the file's own palette equals `tile_definitions.xml` except ids 69 and 108 (blank definitions saved as clones of `C_Chip_L_Tile`, `MapBuilder.as:226-255`), which no alpha level places.
6. World: `worldMin = (0, -100)`, `worldMax = (cols*50, 450)`. The physics lookup grid was allocated 9 rows x 16 cols from the default bounds, so **only rows 0-8 exist in play** whatever `rows` says (`ParticleSystem.as:166-181`; the port sizes its grid from the level, which changes nothing for the alpha data because rows 9+ are empty or out of range).
7. Loop bounds: static boxes for `row < rows` and `col <= cols` (inclusive, `PlatformGame.as:288-289`); drawing for `row < rows` and any column near the screen (no `cols` bound, `:1081-1090`); entities for every stored cell.
8. Entities are attached by `<icon>` linkage from `introductionToMicrobes_platformer.swf`; tiles come from `junior_game_assets.swf` through the imported `shared_library_link`.

### 4.4 Runtime level data schema (port)

Generated by `node tools/convert-levels.mjs` into `web/data/levels/`:

`<name>.json` (one per level, `alpha_level1` .. `alpha_level11`):

| Field | Type | Meaning |
|---|---|---|
| `name` | string | file stem, e.g. `"alpha_level1"` |
| `title` | string | the XML `name` attribute (`"level1"`): intro label and ePhone page key |
| `id` | number or null | XML `id` (unused) |
| `cols`, `rows` | number | as declared (rows may be 11; see rule 6) |
| `next` | string | next level stem or `"exit"` |
| `bodyLevel` | boolean | runtime value (missing attribute = true) |
| `bodyLevelAttr` | string or null | the raw attribute |
| `goals` | `[{goalType, microbeType, required}]` | numbers |
| `playerStart` | `{row, col}` | last `player_start` |
| `tiles` | `[[row, col, id], ...]` | geometry cells in XML order |
| `entities` | `[[row, col, id], ...]` | entity cells in XML order (row-major; includes the `player_start` cell) |
| `palette` | `{id: {movie, type, w, h, ax, ay}}` | the definitions this level uses: linkage, type, frame-1 box size, art offset from the registration point |
| `intro` | `[string]` | the level's ePhone intro pages (original wording) |
| `outOfRange` | `[{row, col, id, movie, solid: false, drawn}]` or `[{row, col, id, movie, entity: true}]` | cells outside the physics range (L3 cols 45-46: `drawn: true`; L5 (12,65) and L7 (10,12): `drawn: false`) |
| `source` | string | original XML path |

`index.json`: `source`, `order` (the ten played levels), `rounds` (`[{round, kind: "platform" or "kitchen", levels}]`, section 2.2), `unused` (`["alpha_level11"]`), `levels` (per level `title`, `next`, `cols`, `rows`, `bodyLevel`, `goals`).

`tile_definitions.json`: `source`, `note`, `types` (name to id, as in 3.16), `definitions[]` with `id`, `label`, `typeString`, `type`, `typeName`, `movie` (runtime linkage), `w`, `h`, `ax`, `ay`.

Box sizes come from frame-1 SWF bounds, not from runtime measurement; two surveys disagree for Patty (203.32 x 150.39 vs 187.89 x 141.53) and Slarg (90.57 vs 90.37 wide). The port uses the first values (matching [P] and [S]). **[Ruffle]**

### 4.5 Unity layouts (not used)

Unity levels are hand-built scenes (160-177 tiles wide, 32 x 20 tiles visible) that keep only the rough rhythm of the Flash levels, not their geometry [L §5], [UL §10]. The Flash XML is the only layout source for the port.

---

## 5. Kitchen game (round 4, "Food Hygiene")

Coordinator `movies/KitchenGame.swf` (frame 1: `new ebug.junior.fridge.KitchenGame(this, container, new ebug.Player()); kitchenGame.init()`) and `KitchenGame.as`; scene and art in `movies/kitchen_game_main.swf`; intros `movies/kitchen_game_intro_level_0.swf` .. `_3.swf`; outro `movies/kitchen_game_outro.swf`. Full analysis: [F §5]. The Unity remake never implemented it: everything here comes from Flash. No level file: `KitchenGame` generates four random levels in code.

### 5.1 Lifecycle

`init()` (`KitchenGame.as:119-142`) loads the six SWFs with its own `AssetLibrary` (loading word `"Loading"`), builds the food list (`:1234-1325`), valid locations (`:1204-1232`, never used) and outro strings (`:1163-1202`); `level = 0; timeLeft = 60`. `assetsLoaded()` (`:1095-1160`) wires clips, attaches the avatar, makes the counter items and 27 rest points clickable, and calls `nextLevel(0)`.

Level loop: **intro screens** (until the intro clip sets `finished = true`, polled every 40 ms, `:874-887`) -> **play** (`main()` every 40 ms, `:144-191`) -> **outro**, 3 pages -> `nextLevel()`; after level 3's outro, `level > 3` -> `exitKitchenGame()` (`:802-811`): `player.score += overallScore; _root.endOfKitchen(player)`.

`nextLevel(levelId)` (`:813-872`): removes displayed items from the rest points (**but not their cling film overlays**, bug), resets reminder flags, food list, hand states and scores; `timeLeft = (levelId == 3) ? 120 : 60` (`:844-848`); `if (level > 0) { levelSneezes = true; sneezeChance = 7 }` (`:857-860`; at level 0 `sneezeChance` is undefined, `n > undefined` is false: no sneezes); shows the intro. `introFinished` shows the kitchen, resets the one-second timer and starts `main`.

### 5.2 Level parameters

| Code level | Shown as | Intro SWF | Items | Categories (probabilities) | Time | Sneezes |
|---|---|---|---|---|---|---|
| 0 | (untitled first level) | `kitchen_game_intro_level_0.swf` | 10 | vegetables 1/2, door 1/2 | 60 s | none |
| 1 | "Level 2" | `_1.swf` | 10 | veg 1/6, door 1/3, fruit 1/3, cupboard 1/6 | 60 s | yes |
| 2 | "Level 3" | `_2.swf` | 10 | veg 1/12; door, fruit, cupboard, raw meat, cheese 1/6 each; cooked meat 1/12 | 60 s | yes |
| 3 | "Level 4" | `_3.swf` | 20 | as level 2 | **120 s** (the intro says "45 seconds"; code comments say 30 and 45) | yes |

Draw (`prepareLevelFood()`, `:906-1075`), per item, with replacement:

```
category = Math.round(Math.random() * high)          // high = 1, 3, 6, 6; category order:
                                                    // 0 veg, 1 door, 2 fruit, 3 cupboard, 4 raw meat, 5 cheese, 6 cooked meat
index    = Math.round(Math.random() * (categoryArray.length - 1))
levelFood.push(categoryArray[index])
```

`Math.round` gives the two end values half the weight of the others; the probabilities above and in 5.3 follow exactly. Port: same formulas on the seeded kitchen RNG stream.

### 5.3 Food items

Type constants (`FoodItem.as:12-21`): FRUIT 0, VEGETABLES 1, CUPBOARD 4, CHEESE 5, DOOR 6, RAW_MEAT 7, COOKED_MEAT 9. State flags (`:26-31`): CLEAN 0, SNEEZE_MICROBES 1, MEAT_MICROBES 2, CLINGFILMED 3, BURST 4, MOULDY 5.

| # | Name | Symbol (`assetName`) | Type | Initial flags | Frame-1 size (px) |
|---|---|---|---|---|---|
| 0 | Mouldy Bread | `mouldy_bread` | cupboard | MOULDY | 83.75 x 60.65 |
| 1 | Burst Yogurt | `burst_yogurt` | door | BURST | 50.6 x 51.2 |
| 2 | Carrots | `carrots` | vegetables | CLEAN | 66.35 x 36.8 |
| 3 | Tomatoes | `tomatoes` | vegetables | CLEAN | 66.7 x 29.45 |
| 4 | Orange | `orange` | fruit | CLEAN | 34.5 x 34.45 |
| 5 | Bananas | `bananas` | fruit | CLEAN | 65 x 67.2 |
| 6 | Mouldy Orange | `mouldy_orange` | fruit | MOULDY | 34.5 x 34.45 |
| 7 | Yogurt | `yogurt` | door | CLEAN | 37.85 x 43.8 |
| 8 | cheese | `cheese` | cheese | CLEAN | 53.75 x 34.1 |
| 9 | Orange Juice | `orange_juice` | door | CLEAN | 35.7 x 64.55 |
| 10 | Apple | `red_apple` | fruit | CLEAN | 35.9 x 40.8 |
| 11 | Raw Lamb | `raw_lamb` | raw meat | MEAT_MICROBES | 63.4 x 29.5 |
| 12 | Raw Chicken | `raw_chicken` | raw meat | MEAT_MICROBES | 55.85 x 38.75 |
| 13 | Raw Sausages | `raw_sausages` | raw meat | MEAT_MICROBES | 61.65 x 42.05 |
| 14 | Raw Steak | `raw_steak` | raw meat | MEAT_MICROBES | 48.05 x 28.3 |
| 15 | Cooked Steak | `cooked_steak` | cooked meat | CLEAN | 48.05 x 28.3 |
| 16 | Cooked Lamb | `cooked_lamb` | cooked meat | CLEAN | 63.95 x 29.5 |
| 17 | Cooked Chicken | `cooked_chicken` | cooked meat | CLEAN | 55.85 x 38.75 |
| 18 | Apple | `green_apple` | fruit | CLEAN | 35.9 x 40.85 |
| 19 | Pear | `pear` | fruit | CLEAN | 33.7 x 58.95 |
| 20 | Milk | `milk` | door | CLEAN | 35.6 x 64.5 |
| 21 | Soup | `soup` | cupboard | CLEAN | 40.15 x 65.65 |
| 22 | Orange Juice | `orange_juice` | door | CLEAN (a second, separate entry) | 35.7 x 64.55 |
| 23 | Broccoli | `broccoli` | vegetables | CLEAN | 66.1 x 54.9 |
| 24 | Bread | `bread` | cupboard | CLEAN | 83.75 x 60.6 |
| 25 | Spring Onion | `spring_onion` | vegetables | CLEAN | 72.35 x 36.8 |

Each of the 25 distinct symbols has a `clingfilm_<assetName>` overlay in `kitchen_game_main.swf`. Category arrays (indices into the table, in table order) and within-category probabilities:

| Array | Indices | Probabilities |
|---|---|---|
| `foodVegetables` | 2, 3, 23, 25 | 1/6, 1/3, 1/3, 1/6 |
| `foodDoor` | 1, 7, 9, 20, 22 | 1/8, 1/4, 1/4, 1/4, 1/8 |
| `foodFruit` | 4, 5, 6, 10, 18, 19 | 1/10, 1/5, 1/5, 1/5, 1/5, 1/10 |
| `foodCupboard` | 0, 21, 24 | 1/4, 1/2, 1/4 |
| `foodRawMeat` | 11, 12, 13, 14 | 1/6, 1/3, 1/3, 1/6 |
| `foodCookedMeat` | 15, 16, 17 | 1/4, 1/2, 1/4 |
| `foodCheese` | 8 | 1 |

### 5.4 Screen layout (stage coordinates)

- Scene: green wall cupboards top left (one door open showing shelves); counter across the left half with a shopping bag, a tissue box (far left), cling film, a soap dispenser and the sink (centre) and a blue fruit bowl; an open fridge centre right (three shelves over two drawers; the open door with shelves on the right); a pedal bin bottom right; chequered floor. Symbols `kitchen_bg` (891 x 486.3, registration at its centre), `kitchen_fg` (518.65 x 288.75), `fridge_shelf_1..3`, `fruitbowl`, `sink_area` (50 frames: `tab_stop` 1, `tab_wash_hand` 10), `bag`, `tissues`, `clingfilm`.
- Clock: text field `clock` (Verdana Bold 20, `#20648c`, centred) at (669.95, 5.9), 110 x 35, `htmlText = "<font face=\"verdana\"><b>" + timeLeft + "</b></face>"` (sic) every 40 ms.
- Counter clip `kitchen_counter` at (400.05, 219.05) with click targets `tissues` at (5.35, 210.75), `clingfilm` at (204.2, 211.25), `sink_area` at (273.6, 174.65) (counter origin plus child offsets).
- Avatar: `attachMovie("amy" | "harry", "avatar", ..., {_x: 65.5, _y: 8.7})`, placed behind the counter (`KitchenGame.as:1106-1114`); the animated part is `avatar.upper`.
- Current item: `food_throw_area.foodContainer`, a 90 x 90 box at (120.3, 171.5); the item is attached inside and shifted by `(container - content)` in both axes (bottom-right aligned, `:780-800`). The throw animations exist but are unused ("since throwing is broken, going straight to store", `:640-642`).
- **27 rest points**: instances of one invisible 30 x 30 box clip whose frame 1 does `this.onRelease = function () { callObj[callFunc](this._name); }` (sprite 655). Displayed box = 30 x scale:

| Rest point | Location type | x | y | Box (px) |
|---|---|---|---|---|
| restpointCupboardTopLeft | CUPBOARD (0) | 263.2 | 28.9 | 28 |
| restpointCupboardTopRight | CUPBOARD | 295.1 | 28.9 | 28 |
| restpointCupboardMidLeft | CUPBOARD | 263.2 | 63.6 | 28 |
| restpointCupboardMidRight | CUPBOARD | 295.1 | 63.6 | 28 |
| restpointCupboardBottomLeft | CUPBOARD | 264.7 | 94.85 | 25 |
| restpointCupboardBottomRight | CUPBOARD | 296.6 | 94.85 | 25 |
| restpointFruitBowlRight | BOWL (1) | 370.4 | 165.8 | 23 x 22 |
| restpointFruitBowlMid | BOWL | 390.75 | 170.1 | 24 x 23 |
| restpointFruitBowlLeft | BOWL | 410.25 | 169.15 | 23 x 22 |
| restpointFruitBowlTop | BOWL | 383.5 | 152.85 | 23 x 22 |
| restpointFridgeTopLeft | FRIDGE_UPPER (2) | 479.9 | 72.85 | 45 |
| restpointFridgeTopRight | FRIDGE_UPPER | 528.2 | 73.35 | 45 |
| restpointFridgeMidLeft | FRIDGE_MID (3) | 478.4 | 122.65 | 45 |
| restpointFridgeMidRight | FRIDGE_MID | 527.5 | 123.65 | 45 |
| restpointFridgeBottomLeft | FRIDGE_LOWER (4) | 480.7 | 171.2 | 40 |
| restpointFridgeBottomRight | FRIDGE_LOWER | 529 | 171.2 | 40 |
| restpointFridgeBoxLeftBack | FRIDGE_DRAWER (5) | 488.5 | 219.2 | 25 |
| restpointFridgeBoxLeftFrontLeft | FRIDGE_DRAWER | 475 | 235.45 | 25 x 24 |
| restpointFridgeBoxLeftFrontRight | FRIDGE_DRAWER | 501.5 | 234.35 | 25 |
| restpointFridgeBoxRightBack | FRIDGE_DRAWER | 537.5 | 219.2 | 25 |
| restpointFridgeBoxRightFrontLeft | FRIDGE_DRAWER | 527.55 | 235.45 | 25 x 24 |
| restpointFridgeBoxRightFrontRight | FRIDGE_DRAWER | 554.15 | 234.35 | 25 |
| restpointFridgeSideTopBack | FRIDGE_DOOR (6) | 609.65 | 104.35 | 42 x 47 |
| restpointFridgeSideTopFront | FRIDGE_DOOR | 651.9 | 106.85 | 41 x 47 |
| restpointFridgeSideBottomFront | FRIDGE_DOOR | 603.45 | 191.15 | 40 x 44 |
| restpointFridgeSideBottomBack | FRIDGE_DOOR | 646.95 | 201.45 | 40 x 44 |
| restpointBin | BIN (7) | 713.8 | 331.2 | 64 x 69 |

Location type by name prefix in `receiveInput` (`:646-675`): `restpointCupboard*` CUPBOARD (avatar `cupboard`), `restpointFridgeTop*` UPPER, `restpointFridgeMid*` MID, `restpointFridgeBot*` LOWER, `restpointFridgeBox*` DRAWER, `restpointFridgeSid*` DOOR (all avatar `fridge`), `restpointFruitBowl*` BOWL (avatar `bowl`), `restpointBin` BIN (avatar `bin`). Constants: `KitchenGame.as:97-104`.

**Port (touch)**: the rest points are 23-69 px; at a landscape phone scale of about 0.83 a 25 px box is about 21 CSS px, far below the 44 px minimum. The port makes each **location** (cupboard, bowl, upper shelf, middle shelf, lower shelf, drawers, door, bin) one large tap region covering its slots, fills the next free slot of that location, and keeps a visible focus ring and keyboard order (Tab / arrows / number keys) over the eight locations plus tissues, cling film and sink. Scoring only depends on the location type, so this changes nothing in the rules.

### 5.5 States and the per-second tick

States (`:86-95`): PICK_ITEM 0, WAIT 1, THROW 2 (unused), STORE_FOOD 3 (unused), SNEEZE_START 4, SNEEZE_FOOD 5 (unused), SNEEZE_TISSUE 6 (unused), WASH_HANDS 7, END_OF_LEVEL 8, CLEANUP 9 (unused).

```
main() every 40 ms (KitchenGame.as:144-191):
  if getTimer() - timer > 1000:
     timeLeft--; timer = getTimer()
     if timeLeft < 0: timeLeft = 0; gameState = END_OF_LEVEL; timeLeft = 99    // clock shows 99 for a second
     else:
        if gameState == WAIT:                              // sneeze roll, levels 1-3 only
           if GeneralFunctions.getRandom(0, 10) > sneezeChance: startSneeze(); sneezeChance++
        elif gameState == WASH_HANDS and avatar.midAnimation == false:
           handStates[SNEEZE_MICROBES] = handStates[MEAT_MICROBES] = false; gameState = WAIT
        elif gameState == END_OF_LEVEL: stop the loop; calculateScores(); hide kitchen; show outro page 1
  redraw clock
  if gameState == PICK_ITEM: pickItem()
pickItem() (780-800): if all items used: gameState = END_OF_LEVEL   // outro up to 1 s later
                      else show the next item; gameState = WAIT
GeneralFunctions.getRandom(min, max) = Math.round(Math.random() * (max - min)) + min   // util/GeneralFunctions.as:3-4
```

A level ends when the clock passes 0 or every item has been placed. Unplaced items cost nothing.

### 5.6 Input (`receiveInput(buttonName)`, `:632-777`)

Processed only in WAIT (and SNEEZE_START, 5.7); clicks during hand washing are ignored.

- **Rest point**: play the location's avatar animation; apply hand contamination (5.8); move the item into the rest point's box: `scale = box._width / content._width` if the item is wider than tall, else `box._height / content._height`; bottom-aligned (`_y = box._height - content._height * scale`); the cling film overlay follows if the item is wrapped (`:696-727`). An item already shown in that slot is replaced visually, but every placement is recorded in `levelFoodChoices[locationType]` for scoring (`:730-733`). The bin fades its item out, `_alpha -= 5` every 40 ms (0.8 s, `removeBinItem`, `:621-629`). Then `currentFoodItemId++`, PICK_ITEM.
- **`clingfilm`**: attach `clingfilm_<assetName>` over the current item and set CLINGFILMED (`:764-770`). Allowed on any item; no avatar animation (the `cling_film_*` labels are unused).
- **`sink_area`**: WASH_HANDS, avatar `wash_hands` (`:772-774`).
- **`tissues`** outside a sneeze: nothing.

### 5.7 Sneezes and tissues

- Roll once per second in WAIT from level 1: sneeze if `getRandom(0, 10) > sneezeChance`, then `sneezeChance++` (`:153-160`). With `sneezeChance` 7, 8, 9, 10 the per-second chance is **1/4, 3/20, 1/20, 0**: at most three sneezes per level, the first expected after about 4 s of idle waiting.
- `startSneeze()` (`:545-550`): SNEEZE_START, avatar `sneeze_Start`, `setInterval(makeSneeze, 2000)`.
- Click `tissues` within 2 s: `sneezeHankie()` (`:613-619`): back to WAIT, **hands get sneeze microbes**, avatar `sneeze_tissue_end`.
- Click anything else, or wait 2 s: `makeSneeze()` (`:602-611`): back to WAIT, the **current item** gets SNEEZE_MICROBES (and the hands), avatar `sneeze_food_end`. A rest-point click during the sneeze does not place the item.

### 5.8 Hands, washing and cling film

- On every placement (`:680-694`): if the hands carry sneeze microbes, the placed item gets SNEEZE_MICROBES and the hands are cleaned ("limit spread to just one item"). Placing raw meat sets `handStates[MEAT_MICROBES] = true`.
- Raw-meat cross-contamination is broken: the code tests `handStates[FOOD_STATE_CLINGFILMED]` instead of `MEAT_MICROBES` and writes `currentFoodItem[MEAT_MICROBES]` instead of `currentFoodItem.foodState[MEAT_MICROBES]` (`:685-689`), and `calculateScores` never reads MEAT_MICROBES anyway. Meat on the hands affects nothing; "Raw Meat Hands" is never shown. Intent (spread) is clear, but the consequence was never designed: kept as built, open question 11.3.
- Washing: avatar `wash_hands` (36 frames, 1.44 s); the next one-second tick clears both hand flags, so washing takes 1.4-2.4 s.
- Net effect as built: washing matters only after a tissue sneeze (to stop the next item being contaminated).

### 5.9 Scoring (`calculateScores()`, `:353-543`)

Every placed item is checked per location (locations in id order 0-7, items in placement order). First, any item with SNEEZE_MICROBES adds the "Sneeze" admonishment (once per level; no points). Then:

| Location | Correct (+1 correct for the item's type) | Incorrect (+1 incorrect for the item's type) and admonishment |
|---|---|---|
| BIN | mouldy or burst item: counts **nothing** either way | any good item: incorrect + that type's location reminder |
| BOWL | fruit, not mouldy | mouldy orange: incorrect + "Bad Food" (repeatable: `badFood` not set here, `:396-398`); any other type: incorrect + reminder |
| CUPBOARD | cupboard type, not mouldy (soup, bread) | mouldy bread: incorrect + "Bad Food" (once); other: incorrect + reminder |
| FRIDGE_DOOR | door type, not burst (yogurt, orange juice, milk) | burst yogurt: incorrect + "Burst Container" (once); other: incorrect + reminder |
| FRIDGE_DRAWER | vegetables | other: incorrect + reminder |
| FRIDGE_LOWER | raw meat **with** cling film | raw meat without: incorrect + "Clingfilm" (once); other: incorrect + reminder |
| FRIDGE_MID, FRIDGE_UPPER | cheese (cling film irrelevant); cooked meat with cling film | cooked meat without: incorrect + "Clingfilm" (once); other: incorrect + reminder |

- Reminder = `addFoodLocationAdmonishments` (`:552-600`), once per type per level (flags reset in `nextLevel`, `:832-838`). A mouldy or burst item put anywhere other than the bin or its own category's place gets its category's reminder (misleading, e.g. mouldy bread in the fridge gets "Things like cans and bread should be put in the cupboard.").
- Not enforced although the intros state them: cooked meat on its own shelf, raw meat alone on its shelf, washing hands after raw meat.
- Points: page 1 adds `10 x correct` for each of the seven categories, page 2 subtracts `10 x incorrect` (`:228-261,272-305`). **Net per level = `10 x (total correct - total incorrect)`**, summed in `overallScore` over the four levels (can go negative). No total is displayed ("Points Awarded", "Points Deducted", "Total Points" are unused).
- The total goes to a throwaway `Player`, so as built **kitchen points never count** (2.8). Port: show the kitchen total on the kitchen results; whether it joins the final result is open question 11.3.

### 5.10 Outro pages (`movies/kitchen_game_outro.swf`)

Frames `init` 1 (a `click_button` "Click"), `achievements` 10, `missed` 20, `admonishments` 30. A light rounded panel with a black border (white in the Ruffle captures `133`, `146`-`148`), Verdana 20 black rows ("X" and "=" in Verdana Bold), a blue "Click" button at (292.2, 351.9); standalone the surround is olive `#666600` (a 50% black layer over the `#cccc00` stage) [R §8.1].

1. **Achievements** (`showOutroAchievements`, `:193-265`): title `text0` = "Shopping Placed Correctly" (the static text says "Items Placed Correctly"); seven rows `textN  multiplierN  X ... = sumN`, N = 1..7: Fruit, Vegetables, Cupboard Items, Cheese, Raw Meat, Cooked Meat, Liquids; multiplier = correct count, sum = count x 10.
2. **Missed** (`showOutroMissed`, `:267-312`): title "Items Placed Incorrectly"; the same rows with incorrect counts and sums `"- " + count x 10`.
3. **Admonishments** (`showAdmonishments`, `:314-351`): title "Microbial Mistakes" (overwrites the static "Things to remember"); `text1`..`text4` = the first four admonishments. **Only four slots**: further ones are lost (port: show all, scrolling if needed).
4. Click: `nextLevel()`.

Strings (`outroStrings`, `KitchenGame.as:1165-1192`; `translations.json` keys `kitchen.outro.<camelCase>`):

| Key | Text | Used |
|---|---|---|
| Shopping Placed Correctly / Items Placed Incorrectly / Microbial Mistakes | as the key | page titles |
| Fruit, Vegetables, Cupboard Items, Cheese, Raw Meat, Cooked Meat, Liquids | as the key | row labels 1-7 |
| Clingfilm | Raw and Cooked meat should be covered before putting away. | uncovered meat on a shelf |
| Sneeze | If you don't cover your mouth when you sneeze, you can spread harmful microbes. | any sneeze-contaminated item |
| Bad Food | If food is mouldy or off, you should throw it away. | mouldy item in bowl or cupboard |
| Burst Container | If a liquid container is burst you should throw it away. | burst yogurt in the door |
| Fruit Location | Fruit should be put in the fruit bowl. | reminder |
| Vegetables Location | Vegetables should be put in the bottom drawer in the fridge. | reminder |
| Cheese Location | Cheese should go in the top or middle shelf. | reminder |
| Cooked Meat Location | Cooked Meat should go in the top or middle shelf - and have a shelf all on its own. | reminder |
| Raw Meat Location | Raw Meat should go on the solid shelf above the drawers. | reminder |
| Liquids Location | Liquids should be put in the fridge door. | reminder |
| Cupboard Items Location | Things like cans and bread should be put in the cupboard. | reminder |
| Sneeze Hands | Even if you use a tissue when you sneeze, you should wash your hands before handling food. | unused (tissue case produces "Sneeze") |
| Cooked Meat Shelf | Cooked meat should be covered and placed on its own shelf. | unused |
| Raw Meat Shelf | Raw meat should have a solid shelf all to itself to prevent harmful microbes transferring to other food. | unused |
| Raw Meat Hands | After you handle raw meat, you should wash your hands to prevent harmful microbes from spreading. | unused |
| Points Awarded, Points Deducted, Total Points | as the key | unused |

### 5.11 Intro screens (`kitchen_game_intro_level_N.swf`)

Each shows a dimmed kitchen picture (a full-screen 824 x 457 JPEG `bitmaps/kitchen_game_intro_level_N/1.jpg`; level 0's shows Amy at the counter whatever avatar was chosen) with centred white Verdana 20 bold text and a blue "Click" button. Frame 1 fills a `strings` array, `finished = false`; `click_button` advances; the last click sets `finished = true` (polled by `KitchenGame.introFinished`). Screens are separated by `//`, lines by `/`:

- **Level 0**: "In this mini-game, you have to put away the shopping." / "Sounds simple, doesn't it?" // "But be careful!" / "You need to put things in the right place." // "Here are the rules:" / "Vegetables go in the bottom drawer of the fridge." / "Drinks and Yogurt go in the fridge door." // "On the next screen, click on the correct place in the fridge to put away the spring onion." Then the tutorial frame `spring_onion`: the kitchen picture with five `wrong_button`s and one `right_button` (the drawer, at (473.05, 215.9)). Wrong: "Wrong!  Try again." plus the two rule lines, click returns to the tutorial. Right: "Excellent, well done." / "Try to put away 10 things before the timer runs out." / "Click the button when you're ready to start the level..." and the click sets `finished`.
- **Level 1**: "Level 2" / "This time, you also have to put away fruit, tins and bread." // "Remember, vegetables go in the bottom drawers in the fridge." / "Liquids like milk, yogurt and juice go in the fridge door." // "There are some new things this time." / "If you see fruit, put it in the fruit bowl." / "Tins and bread go in the cupboard." // "One more thing - if you start to sneeze, click on the tissues quick! Otherwise, you'll cover the food in harmful microbes." / "Click on the button when ready to start."
- **Level 2**: "Level 3" / "Things are about to get tricky..." // "This time, you also have to put away meat." / "Meat should always be kept away from vegetables to prevent microbes from spreading." // "Click on the cling film to cover meat before putting it in the fridge." / "Cooked meat has to have its own shelf." / "Raw meat needs to have a solid shelf.  So put the raw meat on the bottom shelf, above the fridge drawers." // "Also, if you find cheese, it goes on the top or middle shelf.  " / "Ready?"
- **Level 3**: "Level 4" / "Let's see what you can do." // "You know all the rules now. " / "Can you put away all the food correctly?" // "You have 45 seconds this time." / "You have to put away 20 items." / "Ready?" (the fourth screen is unreachable). Port: "45 seconds" is corrected to match the time actually given (open question 11.3: 120 s as coded, or 45 s as written).

### 5.12 Kitchen avatar animations

Avatar `upper` labels (`kitchen_game_main.swf` sprite 169 in `harry`, sprite 612 in `amy`, 600 frames each): `stop` 1, `idle` 10-30 loop, `fridge` 47-60, `cupboard` 85-97, `bin` 130-142, `bowl` 165-177, `cling_film_start` 205-217 then `cling_film_mid` 235-255 loop, `cling_film_end` 285-297 (cling film animations unused), `sneeze_Start` 335-347 then `sneeze_mid` 360-379 loop, `sneeze_tissue_end` 390-406, `sneeze_food_end` 440-456, `window` 530-543 (unused), `wash_hands` 565-600. One-shots return to `idle`. Port: the chosen child is the kitchen avatar (the original always showed Harry). The SWF's developer test buttons (`clickme1`-`clickme12`, `animation_test`) are hidden on frame 1 and not ported.

### 5.13 Kitchen bugs and port decisions

| Bug | Source | Intent clear? | Port |
|---|---|---|---|
| `FoodItem` objects shared, never cloned: cling film and sneeze flags stick to that food for the rest of the kitchen game (a sneezed-on "Carrots" is contaminated in every later level; earlier cling film counts later), and an item drawn twice in one level shares its state (Ruffle `633`: a Raw Sausages put away without cling film scored correct because its later twin was wrapped; the sneeze reminder reappears in later levels, `157`, `166`, `635`, `644`, [R §6.4]) | `KitchenGame.as:784`; `FoodItem.clone()` unused (`FoodItem.as:48-55`) | yes | **fix**: clone per draw |
| Cling film overlays not removed between levels | `:820-823` | yes | **fix** |
| Raw-meat hand contamination wrong index and property; no scoring effect | `:685-689` | partly | keep (no effect); open question |
| `badFood` not set in the BOWL case: "Bad Food" can repeat | `:396-398` | yes | **fix** (once per level) |
| Only four admonishment slots | outro frame 30; `:340-342` | yes | **fix** (show all) |
| Level times contradict comments and the level 3 intro | `:844-848,911,1024` | no | keep 60/60/60/120; fix the intro text |
| Clock shows 99 for a second at time-out; malformed `</face>` | `:151,180` | yes | **fix** (show 0) |
| Mouldy/burst items in the wrong place get their category's location reminder | `:552-600` | yes | **fix**: give "Bad Food" / "Burst Container" instead |
| `validLocations` built but unused | `:1204-1232` | - | ignore |
| Kitchen gets a throwaway `Player`: avatar always Harry, points lost | `movies/KitchenGame.swf` frame 1 | yes (avatar) | **fix** avatar; points: open question |
| One-second tick is `> 1000` polled every 40 ms, so a "second" is 1040 ms | `:145` | - | port uses exact 1000 ms seconds (section 12) |

---

## 6. Game show and quiz

`GameShow.as` is the class of the `game_show` instance in `movies/eBugGameShow.swf`. Full analysis: [F §2]. Unity's quiz: [UL §6].

### 6.1 Scene and characters

- Constructor (`GameShow.as:51-118`): attaches `question_board` (hidden), `gameshow_set` (the studio), `shrinking_zone` (hidden) and `talkie` at `_x = 20, _y = 308` (hidden); `cpu = new Player(); cpu.score = 0`; sets up the avatars; `questionFile = "../levels/alpha_gameshow_round1.xml"`; state INIT; `main` every **40 ms** (`:120-122`).
- Studio `gameshow_set` (sprite 897, 800 x 450): instances `harry` (sprite 480 wrapping the 1124-frame sprite 479), `amy` (733 wrapping 732), `gsh` the host (894, 471 frames), `podia` (896). The host stands at the left podium; `studio.podia.amy_score` is the middle podium, `studio.podia.harry_score` the right one.
- Host `gsh` labels: `stop` 1, `excited` 21-145 (loops), `serious` 171-296, `disappointed` 345-470. Each loops until another is requested.
- Contestant `upper` labels (both children): `stop` 1, `idle` 10-50 loop, `neutral` 82-207, `cautious` 255-380, `condifent` (sic) 420-545, `happy` 600-725, `disappointed` 800-925, `curious` 999-1124; each returns to `idle`. `GameShow` requests `"confident"`, which does not exist, so that random blind reaction never plays (port: play `condifent`). The emotions are built from 18 nested clips of exactly 125 frames each.
- **Avatar mapping as built** (2.8 item 1): the constructor runs at preload, so the player is always Harry on the right podium and the CPU always "Amy" on the middle podium. **Port**: the chosen child is the player on their own podium; the other child is the CPU, named after that child.

### 6.2 State machine and control flow

| State (`Constants.as`) | Action |
|---|---|
| INIT (0) | when both shrinking SWFs have loaded, LOAD_LEVEL (`:124-128`) |
| LOAD_LEVEL (8) | `busy = true; loadLevel()`: new `GameShowQuestionLoader` on `questionFile`, reset `statementCounter`, `roundAnswersBlind`, `roundAnswersSighted`; `busy = false`; LEVEL_LOADING (`:130-138`) |
| LEVEL_LOADING (1) | when loaded, `currentRound = round`, LEVEL_LOADED (`:140-145`) |
| LEVEL_LOADED (2) | ROUND_TEXT |
| ROUND_TEXT (13) | `showRoundText()` |
| ASK_QUESTION (16) | `askQuestion()` |
| ROUND_OVER (20) | nothing (set by `showShrinkingZone`) |

After that, control passes through talkie callbacks: `nextRoundText` -> ... -> `askQuestion` -> (click) `showBoard` -> (button) `receiveAnswer` -> (click) `pickCpuResponse` -> (click) `askQuestion` ... Port: an explicit async sequence (await each host line), no polling.

### 6.3 Question file schema

```xml
<round id="0">                                      <!-- attribute ignored -->
  <name>All About Microbes</name>                   <!-- child 0: parsed, never shown -->
  <round_id>0</round_id>                            <!-- child 1: 0-based round index -->
  <next_round>alpha_gameshow_round2.xml</next_round><!-- child 2: next file, or "exit" -->
  <intro_text>                                      <!-- child 3 -->
    <blind><statement>...</statement>...</blind>    <!-- child 0 -->
    <normal><statement>...</statement>...</normal>  <!-- child 1 -->
  </intro_text>
  <questions>                                       <!-- child 4 -->
    <question id="0">                               <!-- id: "Question N" = id+1, answer storage -->
      <type>0</type>                                <!-- always 0 (QUESTION_TYPE_YND), unused -->
      <score>10</score>                             <!-- points for a correct answer -->
      <value>1</value>                              <!-- research weighting, unused -->
      <text>If you cannot see a microbe it is not there</text>
      <answers>                                     <!-- exactly 3, button order Agree, Don't Know, Disagree -->
        <answer><label>Agree</label><value>-1</value></answer>     <!-- 1 correct, 0 don't know, -1 wrong -->
        <answer><lable>Don't Know</lable><value>0</value></answer>
        <answer><lable>Disagree</lable><value>1</value></answer>
      </answers>
    </question>
  </questions>
</round>
```

- `GameShowQuestionLoader.parseRound()` reads **by child index**, never by tag name (`GameShowQuestionLoader.as:46-103`; `XML.ignoreWhite = true`), so the typos `<statment>` (last blind line of rounds 1, 2, 3, 5) and `<lable>` are harmless in Flash (in Unity they drop those lines and mis-score "Disagree", [UL §9]). The typos come from the `OutputXMLFiles` template itself (`doc:2018,2041`), so every language file carries them. **The port converts to JSON with positional parsing.**
- `Answer.label` is never displayed: the board buttons have static text. Only `answers[i].value` matters and `i` is the button index, so **answer order is always Agree, Don't Know, Disagree** (checked for all 55 live files).
- Answer values: `ANSWER_WRONG = -1`, `ANSWER_DUNNO = 0`, `ANSWER_CORRECT = 1` (`Question.as:8-10`). Every question's `score` is 10.

### 6.4 Host dialogue: the talkie

`Talkie.as`; library clip `talkie` (`eBugGameShow.swf` sprite 22; 761.75 x 143.45): speaker name box `speaker_box`, text field `statement_text_field`, and `big_invisible_button` over the whole box. Labels `init` 1, `start` 10, `wait_for_click` 20 (shows a right-pointing arrow), `collect_text` 30 (unused), `end` 50.

- `init(speakerName, statement, "start", "wait_for_click", null, obj, methodName)` (`:40-60`): `gotoAndStop("start")`, placeholder text `"df"` (seen in Ruffle at one transition; never show it), speaker text, `counter = statementSoFar = 0`, `onEnterFrame = update`, `play()`.
- **The arrow appears too early**: `init()` does `gotoAndStop(inState)` then `play()`, so the timeline runs from frame 10 to the `wait_for_click` stop at frame 20 and shows the blinking white arrow (about (730-757, 378-408)) **0.4 s after every line starts, while the text is still typing** (`x01-talkie-arrow-while-typing.png`) [R §6.2]. Intent (arrow when complete) is clear: the port shows it only when the line is complete.
- **Typewriter: one character per frame, 25 characters per second** (`speed = 1`, `:26`; `update`, `:62-77`). When complete: `gotoAndPlay("wait_for_click")`, `nextState = "end"`.
- **First click completes the line; the second click advances** (`buttonClick`, `:85-99`).
- Speaker name in the game show and cutscene: always `"Gameshow Host"` (`GameShow.as:150`).
- `showRoundText()` (`:147-166`) shows `introText[BLIND or NOT_BLIND][statementCounter]` with callback `nextRoundText` (`statementCounter++; busy = false`, `:168-171`); when the lines run out it switches to ASK_QUESTION.
- Port: same 25 cps typewriter (instant with reduced motion), tap / Space / Enter to complete then advance, the arrow shown when complete, host animation `excited` while intro lines play.

### 6.5 Asking and answering

- `askQuestion()` (`:173-182`): host says `"Question number " + (questionId+1) + ": " + questionText + "..."`, callback `showBoard`.
- `showBoard()` (`:184-203`): `question_heading = "Question " + (questionId+1)`, `question_body` = text, `point_value = score + " Points"` ("10 Points"); `agree_button` (value index 0), `dont_know_button` (1), `disagree_button` (2) call `receiveAnswer(index)`; hides the talkie **and the studio** and shows the board full screen. Board (`question_board`, sprite 77, 800 x 450): blue microbe-pattern background, heading and question text top left, "10 Points" and a stopwatch graphic top right, three large stacked buttons centred ("Agree", "Don't Know", "Disagree", static DefineText 68, 73, 75). The stopwatch `timer` (frames `p0`..`p12`) is never driven: **no time limit**. Measured layout [R §8.1]: the board art is about 730 px wide, so the stage's black shows at x 0-35 and 765-800; "Question N" white at (85, 40), Verdana Bold 22; the question in Verdana Bold 16 white (556 x 88 field); "10 Points" Verdana Bold 16, right-aligned, beside the silver stopwatch at x 650-725; buttons centred at x 400, y 209 / 298 / 388, about 216 x 73, face `#6CC3FE`, dark blue border, white bold labels. Port keys: 1 / 2 / 3 or arrows plus Enter; touch: the three buttons (at least 44 CSS px).

`receiveAnswer(index)` (`GameShow.as:205-301`): `response = player.nickname + ", you chose "` + `"Agree."` / `"Don't Know."` / `"Disagree."`; `v = answers[index].value`.

Blind round: `response += "\nBecause this is a Blind question round, you'll find out how you did later."`; host `serious`; the player's avatar plays a random one of `neutral`, `cautious`, `confident` (`Math.floor(Math.random() * 3)`, `:220-228`; "confident" does not exist); stores `v` in `roundAnswersBlind[questionId]`; no score, no CPU turn (the next callback sees a blind round and goes straight to `askQuestion()`, `:326-328`).

Sighted round: `response += "\nThis is the...."` then:

| `v` | Host (`gsh`) | Player avatar | Appended text | Score |
|---|---|---|---|---|
| -1 wrong | `disappointed` | `disappointed` | `WRONG answer!` | **CPU `+ Math.floor(score / 2)`** = +5 |
| 0 don't know | `serious` | `neutral` | `SAFE answer.` | none |
| 1 correct | `excited` | `happy` | `CORRECT answer.` | **player `+ score`** = +10 |

Stored in `roundAnswersSighted[questionId]`; `questionIndex++`. If more questions remain: host says the response (callback `pickCpuResponse`), studio shown, board hidden (`:278-283`). After the **last** question: blind round -> "Step right this way..." (callback `showShrinkingZone`); sighted round -> `nextRound()` at once (no feedback, no CPU turn: build A; the port follows build B and gives both).

### 6.6 CPU opponent and scores

`pickCpuResponse()` (`:304-329`), sighted rounds only:

```
randomChoice = Math.floor(Math.random() * 3)       // uniform over the three buttons, independent of the question
v = answers[randomChoice].value
host: cpuName + ", you chose the " + ("WRONG answer!" | "SAFE answer." | "CORRECT answer.")   // e.g. "Amy, you chose the CORRECT answer."
v == -1: CPU avatar "disappointed"; PLAYER + Math.floor(score / 2)  (+5)
v ==  0: CPU avatar "neutral"
v ==  1: CPU avatar "happy";        CPU + score  (+10)
callback: askQuestion (next question); the host's own animation is unchanged
```

- The CPU is right 1/3, "don't know" 1/3, wrong 1/3 on every question. Port: the same, on the seeded quiz RNG stream.
- `changeScore(isPlayer, change)` (`:331-343`) adds to `player.score` or `cpu.score` and redraws that podium. Scoreboards: clip `score` with four `digit` clips (`zero` 1, `one` 10 ... `nine` 90), green LCD look, range 0-9999 (`:345-386`). Scores never go negative (only additions).
- Totals: 21 questions. Build A gives 16 of them a CPU turn (no turn after each round's last question); the port (build B rule) gives all 21. Player maximum 210 plus up to 105 from CPU mistakes.
- **Only quiz points decide the winner** (platform and kitchen points never reach `player.score`). Win: `player.score > cpu.score`; a **tie counts as a loss** in Flash (`GameShow.as:452`). Unity: tie = draw ("We have a draw!! Well done both! Play again for another chance to win!"). Port default: draw (open question 11.3).

### 6.7 Blind round decision

| | Build A (repo, evaluation) | Build B (live) | Unity |
|---|---|---|---|
| Blind round | every round starts blind (`GameShowRound.as:21` `isBlind = true`) | removed: "For the purposes of the final release, the game is always NOT_BLIND" (`doc:1727`); `eval:36` | on by default, W toggles |
| Purpose | research pre/post pairs (McNemar, `eval:36-42`) | - | tracking |

**Decision: blind rounds off by default**, available as a Settings toggle ("Warm-up questions: ask each round's questions before the level too"). Reasons: the author's final release removed them (`doc:1727`, `eval:36`); the focus group found the quiz rounds hurt playability (`eval:135`); the promised "great bonus later" was never implemented (`levels/alpha_gameshow_round1.xml:10`), so with blind on the port either drops that line or implements a bonus (open question 11.3); the research submission they fed is not ported. With blind off the first quiz comes after levels 1-4, which fits the round 1 intro "Well done, you're a hoverboard natural!".

### 6.8 Quiz text: which English

**Decision: the live `en_en` set** (`Assets/Resources/TextFiles/quiz/en_en_gameshow_roundN.xml`, keys `quiz.*` in `translations.json` `en_en`) is the English source; build A's `alpha` set is kept for reference. Reasons: it is the final shipped Flash wording; all 10 translations follow it; its sighted intros ("Now let's see what you have learned.") do not presuppose a blind round, while alpha's "Now it's time to ask you those questions again" only makes sense with blind rounds; it uses British "defences" and the "useful/harmful" wording. The evaluation used alpha (Table 2).

| Round, Q | Build A (`alpha`) text | A: correct | Live `en_en` text (if different) | Live: correct |
|---|---|---|---|---|
| 1 Q1 | If you cannot see a microbe it is not there | Disagree | | Disagree |
| 1 Q2 | Bacteria and Viruses are the same | Disagree | | Disagree |
| 1 Q3 | Fungi are microbes | Agree | | Agree |
| 1 Q4 | Microbes are found on our hands | Agree | | Agree |
| 2 Q1 | All bacteria are harmful | Disagree | | Disagree |
| 2 Q2 | Soap can be used to wash away bad bugs | Agree | Soap can be used to wash away harmful bugs | Agree |
| 2 Q3 | Most coughs and colds get better without medicine | Agree | | Agree |
| 2 Q4 | Our bodies have natural defenses that protect us against infection. | Agree | ...defences... | Agree |
| 3 Q1 | We use good microbes to make things like bread and yogurt | Agree | We use useful microbes to make things like bread and yogurt | Agree |
| 3 Q2 | All microbes are bad for us | Disagree | All microbes are harmful for us | Disagree |
| 4 Q1 | Raw meat should go on the top shelf of the fridge. | Disagree | Raw meat should have a solid shelf all to itself to prevent harmful microbes getting on to other food. | **Agree** |
| 4 Q2 | Milk and other liquids should go in the fridge door. | Agree | Liquids like milk, yogurt and juice go in the fridge door. | Agree |
| 4 Q3 | It is safe to put opened tins in the fridge. | Disagree | | Disagree |
| 4 Q4 | You should wash your hands after handling raw meat. | Agree | Fruit should be put in the fruit bowl. | Agree |
| 4 Q5 | If you sneeze, you should wash your hands before handling food. | Agree | | Agree |
| 5 Q1 | Antibiotics kill bacteria | Agree | | Agree |
| 5 Q2 | Antibiotics kill viruses | Disagree | | Disagree |
| 5 Q3 | Antibiotics will cure any illness | Disagree | | Disagree |
| 5 Q4 | Antibiotics can harm our good bacteria as well as bad bacteria | Agree | ...useful bacteria as well as harmful bacteria | Agree |
| 5 Q5 | Antibiotics help when you have a cough | Disagree | | Disagree |
| 5 Q6 | Most coughs and colds get better without antibiotics | Agree | | Agree |

Intro lines, live `en_en` (used by the port; spelling and spacing normalised, e.g. "Ready ?" -> "Ready?"):

| Round | Blind (only if enabled) | Sighted |
|---|---|---|
| 1 | "Welcome to the first BLIND QUESTION ROUND!" / "I'm going to ask you some questions but I'm NOT going to tell you if you get them right!" / "If you get them right, you'll get a great bonus later though, so try your best." / "Let's Go!" | "Well done, you're a hoverboard natural!" / "Now let's see what you have learned." / "You get 10 points for a correct answer, but if you get it wrong, the other player gets points." / "so if you DON'T KNOW the answer, it's best to play it safe and say so!" / "Ready ?" / "Let's Go!" |
| 2 | "Welcome to the SECOND round" / (the bonus line) / "Let's Go!" | "Now let's see what you have learned." / (the 10 points line) / (the DON'T KNOW line) / "Ready ?" / "Let's Go!" |
| 3 | "Welcome to the THIRD round" / "What do you know about USEFUL microbes?" / "Let's Go!" | "Now let's see what you have learned." / "Remember, 10 points for a correct answer, but if you get it wrong, the other player gets the points." / (DON'T KNOW) / "Ready?" / "Let's Go!" |
| 4 | "Welcome to the FOURTH round" | as round 3 |
| 5 | "Welcome to the FINAL round" / "This time we're going to see what you know about how you get better from infections" / "Let's go!" | as round 3 |

Build A (`alpha`) intro lines, for reference: round 1 blind "Welcome to the first BLIND QUESTION ROUND!" / "I'm going to ask you some questions but I'm NOT going to tell you if you got them right!" / "If you got them right, you'll get a great bonus later though so try your best." / "Lets go!"; sighted "Well done, you're a hoverboard natural!" / "Now it's time to ask you those questions again" / "This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points." / "so if you DON'T KNOW the answer, it's best to play it safe and say so!" / "Ready?" / "Let's go!". Rounds 2, 3, 5 sighted open with "Nice one!", "Yum Yogurt!", "Not bad.  Not bad at all..." then "Let's see how you do on those questions again..." and the round 3 closing lines; round 4 sighted starts at "Let's see how you do...". Round 2/3/5 blind: "Welcome to the SECOND ROUND!" / "This time, we're going to see what you know about good and bad bugs." (round 3: "good microbes"; round 5: "how you get better from infections.") / "Remember, this is a BLIND QUESITON ROUND so you'll get a bonus later if you get these right." / "Lets go!"; round 4 blind: "Welcome to the FOURTH  ROUND!" / "This time, we're going to see what you know about food.". The alpha sighted openers ("Nice one!", "Yum Yogurt!", "Not bad...") are livelier; the port may prepend them in English only (open question 11.3).

### 6.9 Host and UI strings (English only; build A hard-coded)

`translations.json` keys (`alpha` and copied into `en_en`): `gameshow.hostName` "Gameshow Host"; `gameshow.questionNumber` "Question number "; `gameshow.boardHeading` "Question "; `gameshow.boardPoints` " Points"; `gameshow.youChose` ", you chose "; `gameshow.choiceAgree` "Agree."; `gameshow.choiceDontKnow` "Don't Know."; `gameshow.choiceDisagree` "Disagree."; `gameshow.blindNotice` "\nBecause this is a Blind question round, you'll find out how you did later."; `gameshow.thisIsThe` "\nThis is the...."; `gameshow.wrongAnswer` "WRONG answer!"; `gameshow.safeAnswer` "SAFE answer."; `gameshow.correctAnswer` "CORRECT answer."; `gameshow.cpuYouChoseThe` ", you chose the "; `gameshow.stepRightThisWay` "Step right this way and prepare to enter the world of microbes!"; `gameshow.wellDoneYouBeat` "Well done! You beat "; `gameshow.thankYouForPlaying` ".  Thank you for playing.  To play again, reload this web page."; `gameshow.youLost` "At the end of the game, I'm sorry to say you lost.  Thank you for playing.  To play again, reload this web page."; `board.agree/dontKnow/disagree`; `summary.youDied` "You Died!"; `summary.outOfTime` "You ran out of time."; `summary.clickToTryAgain` "click to try again"; `summary.heading` "Things to remember"; `summary.click` "Click"; `splash.newGame` "New Game"; `splash.tuning` "Tuning"; `cutscene.submit` "Submit"; `loader.*`.

Port wording changes: "reload this web page" becomes a Play again button (the line ends at "Thank you for playing."); the tie line (if draw) is new text; winner screen lines are new text (Unity's "Congratulations ...! You win the contest!!." is a model, not a source).

### 6.10 Research submission (describe only; never ported)

`MovieClip.loadVariables(url, "POST")` to Lotus Domino forms: an **ID form** once in `startQuizShow()` (`GameController.as:134-145`: `http://www.e-bug.eu/ebug_secret.nsf/ID_Form?CreateDocument` with `name`, `UID`, `age`, `sex`, `email`, a hard-coded `IP`, `hasBeenTaught = "no"`, `school_code = "DF"`, `timestamp_1`), and **round forms** after each sighted round (`submitPlayerData`, `:170-196`: `Round_<n>_Form` with `pre_question_<q>_rnd_<n>` / `post_question_<q>_rnd_<n>` = -1/0/1). The URLs died when the HPA took the domain (`doc:2136-2159`). Unity replaced it with a Heroku tracker [UL §7]. **The port collects and sends nothing.** Answers may be kept locally only for the player's own summary.

---

## 7. Text and translations

### 7.1 Languages

| Code | Language | Build A | Live XML (Unity copies) | Port code |
|---|---|---|---|---|
| `en_en` | English | hard-coded English, `alpha_*` files | yes | `en` |
| `bg_fl` | Belgium, Flemish (Dutch) | no | yes | `bg_fl` (open: map to `nl-BE`) |
| `bg_fr` | Belgium, French | no | yes | `bg_fr` |
| `cz_cz` | Czech | no | yes | `cz_cz` |
| `dk_dk` | Danish | no | yes | `dk_dk` |
| `fr_fr` | French | no | yes | `fr_fr` |
| `gk_gk` | Greek | no | yes | `gk_gk` |
| `it_it` | Italian | no | yes | `it_it` |
| `pl_pl` | Polish | no | yes | `pl_pl` |
| `por_por` | Portuguese | no | yes | `por_por` |
| `sp_sp` | Spanish | no | yes | `sp_sp` |

- Sources: `levels/` holds only English (`alpha_gameshow_round1-5.xml`, `conversations/en_en_introductions.xml`, plus unused drafts `gameshow_round*.xml`, `realgameshow_round*.xml`, `alpha_realgameshow_round3.xml`, `Copy of realgameshow_round*.xml`). The 11 live languages survive as `Assets/Resources/TextFiles/quiz/<lang>_gameshow_round1-5.xml` and `conversations/<lang>_introductions.xml`, almost certainly copied from the deployed Flash site (naming as in `doc:41`, generated by `OutputXMLFilesMovie.fla` from `Translations.as`, `doc:1984-2118`). Unity's copy of `alpha_gameshow_round4.xml` is a machine-looking French translation pointing at `fr_fr_gameshow_round5.xml`: excluded.
- **Build B selected the language with a `language` flashvar** passed by the embedding page (`doc:418,449`); strings came from `Translations(_root.translations).getString(Translations.STRING_X)`, quiz and conversation XML by file prefix (`doc:41,2012`). There was **no in-game language screen**. Build A has none of this (both HTML wrappers pass no flashvars; `movies/e-Bug_Junior_Game.html:418-421`, `movies/e-Bug_Junior_Game2.html:418-421`). `movies/params.txt` (`skin=0xFF0000&done=true`) is a test input for an unfinished avatar colour feature, not a flashvar file.
- **`Translations.as` (184 strings) is lost**: not in the repo, any SWF or on disk. Known: indices 0-4 for `en_en` ("English ", "New Game", then the first three conversation lines) and `cz_cz` ("cz_cz", "Nová hra", "Ahoj, vítej v e-Bug hře!", "Za chvíli navštívíš tajemný svět mikrobů.", "Ale nejprve si vyber, zda budeš soutěžit jako holka nebo kluk.") (`doc:1946-1960`), and constant names such as `STRING_NEW_GAME`, `STRING_STEP_RIGHT_THIS_WAY`, `STRING_YOU_DIED`, `STRING_QUESTION_NUMBER`, `STRING_YOU_CHOSE`, `STRING_PRIVACY_STATEMENT` (184) (`doc:591,628-636,1854,1871-1884,2015-2104`) [F §7.3].
- Consequently **only these texts exist in all 11 languages**: the 10 conversation lines and the quiz (round intros, questions, answer labels). **English only**: every game show response and host string (6.9), the summary page, splash, loader, the platformer intro pages (7.4; Unity's intro cards are English PNGs too), the kitchen intros, outro and admonishments (5.10, 5.11), and all new port UI. Plus the Czech "Nová hra".
- Data points: every language has the same number of rounds, intro lines, questions and answers as `en_en`, `next_round` chains within the language, every `score` is 10, and every answer-value triple equals `en_en`'s, so the answer key (6.8, live column) holds for all 11. Greek `ui.dontKnow` has a trailing space; `sp_sp` uses "Verdadero"/"Falso" (true/false) rather than agree/disagree; every non-English conversation line 3 is empty, like `en_en`.

### 7.2 Files and schema

- `reference/analysis/translations.json` (generator `node tools/extract-translations.mjs`; `--translations <file>` would ingest a recovered `Translations.as` as keys `translations.<index>` and `STRING_*`). Shape `{ "<lang>": { "<key>": "<string>" } }`, 12 tables: the 11 live languages plus `alpha` (build A English). Counts: `en_en` 246 keys, `cz_cz` 144, the other nine 142 each, `alpha` 266.

| Key | Source |
|---|---|
| `conversation.<i>` | `<lang>_introductions.xml` statement i (2.4) |
| `quiz.round<N>.name` | round `<name>` (never translated) |
| `quiz.round<N>.blind.<i>`, `quiz.round<N>.normal.<i>` | intro lines |
| `quiz.round<N>.q<i>.text`, `quiz.round<N>.q<i>.answer.<j>.label` | question text; answer labels (j = 0 Agree, 1 Don't Know, 2 Disagree) |
| `ui.agree`, `ui.dontKnow`, `ui.disagree` | most common answer label per position in that language (board buttons) |
| `ui.languageName`, `ui.newGame` | `en_en` and `cz_cz` only (`doc:1946-1957`) |
| `gameshow.*`, `board.*`, `summary.*`, `splash.*`, `cutscene.submit`, `loader.*`, `kitchen.outro.*`, `kitchen.outroStatic.*`, `kitchen.intro<L>.<i>`, `kitchen.introStatic.click` | English UI strings hard-coded in build A; in `alpha`, copied into `en_en` |
| `ebugStrings.<i>` | `alpha` only: the unused `src/ebug/EBugStrings.as` prototype |

Answer correctness is **not** in the text tables; the port keeps it in the round data (value -1/0/1 per button, identical across languages).

- **Port runtime text**: `web/data/lang/manifest.json` (`languages: ["en"]`, `namespaces: ["platform", "levels", "gameshow", "kitchen", "flow"]`), per-namespace files `web/data/lang/<code>/<namespace>.json` (flat `key: string`, currently empty placeholders) and `web/data/lang/en.json` (the platformer strings in use: prompts, key names, `intro.levelN.i` pages, with `{press_camera}`-style placeholders filled from live bindings by `web/js/ui/prompts.js`). Missing keys fall back to English. Language choice: `?lang=<code>` (mirroring the flashvar), then a saved setting, then `navigator.language` mapped to the nearest code, then English; a language picker in Settings and on the splash.
- Data check (E2E): every text file parses in every language; every key used by the code exists in English; per language, every quiz key present in `en_en` exists (English fallback allowed only for the English-only groups above).

### 7.3 Brand strings in the text

"e-Bug" appears in conversation line 0 of every language ("Hello and welcome to the e-Bug Game Show!", Czech "Ahoj, vítej v e-Bug hře!") and on art (splash TV logo, ePhone wordmark). The hosted build must not carry e-Bug or HPA/UKHSA branding (11.2), so the port replaces "e-Bug Game Show" with "Super Microbe World Game Show" (the Unity remake's own wording, [UL §6]). English is straightforward; for the other 10 languages the replacement is a per-language string edit of line 0 that keeps the rest of the sentence (open question 11.3: needs a native check; until then substitute the literal token "e-Bug" with "Super Microbe World" and keep the grammar of the original).

### 7.4 Platformer intro pages (`level_intros`, English only)

Original wording (`introductionToMicrobes_platformer.swf` sprite 1479), pages separated by " / "; `[P §8.2]`:

| Label (frame) | Pages |
|---|---|
| level1 (1) | "We have shrunken you so small that you can't be seen with out a microscope!" / "With your trusty hoverboard and camera phone, you have to explore the tiny world of the microbe." / "Microbes are everywhere, including the kitchen. Some are good and some are bad - so watch out!" / "Your mission is to photograph 3 Lucy Lactobacillus." / "Lucy Lactobacillus - Bacteria. Lucy is a bacteria." / "When you are near Lucy, press the CTRL button to use your camera phone to take a picture." / "When you have taken all the photos, find the PORTAL to go to level 2." |
| level2 (40) | "Now we have sent you onto a human hand. There are millions of microbes on everyone's hands!" / "Photograph 3 more Lucy Lactobacillus Bacteria." |
| level3 (50) | "This time you have to photograph 3 Steve Staphylococcus" / "Steve is also a bacteria like Lucy." |
| level4 (70) | "In this level, you need to photograph 3 Patty Penicillium" / "Unlike Steve and Lucy, Patty is a FUNGUS! Fungi are bigger than bacteria." |
| level5 (90) | "This time, use soap to wash away Slurm Staphylococcus." / "Press SPACE BAR to throw soap that you collect." |
| level6 (110) | "Skin has good and bad microbes on it. Using soap is a good way to get rid of the bad microbes." / "This time, use soap to wash away all the bad microbes. Press the SPACE BAR to throw soap that you've picked up." / "Watch out for Donna Dermatophyte though! She's a fungus like Patty Pennicilium but she's not as friendly!" |
| level7 (140) | "We have sent you inside the body! Sometimes bacteria and viruses can get inside your body." / "Iggy Influenza is a flu virus. Viruses are the smallest of the microbe but that doesn't make them easy for the body to cope with." / "Bodys have natural defenses that kill intruders. Help the body by collecting and throwing white blood cells to kill all the bad microbes." / "Use the SPACE BAR to throw the body's defences at Iggy." |
| level8 (190) | "We've sent you back into the kitchen. This time you're going to see what good microbes can REALLY do!" / "Lucy Lactobacillus can turn milk into yogurt. That's how yogurt gets made. Amazing isnt' it?" / "To turn the milk into yogurt, just push Lucy into the glass." |
| level9 (221) | "Well done! We also use microbes to make things like bread and even cheese!" / "This time you have to turn THREE glasses of milk into yogurt." |
| level10 (241) | "In an earlier level, you used the body's own defenses to kill bad microbes. That works almost all of the time." / "Sometimes people get really sick and the doctor has to prescribe them special drugs called Antibiotics." / "The most important thing when using antibiotics is to do exactly what the doctor says." / "In this level you're going to use antibiotics to defeat a SUPER infection that can't be killed with the body's defense." / "You can only carry one antibiotic at a time, so you'll need to go back to get more until you kill the super infection." / "Press CTRL to use the antibiotic. Watch what it does. Does it kill all other microbes too?" |

Port text (`web/data/lang/en.json` `intro.levelN.i`): spelling slips corrected ("without", "Bodies", "isn't", "Penicillium", "defences", "the smallest of the microbes"), key names replaced by device-aware placeholders (`{press_camera}`, `{Press_fire}`), page 5 of level 1 split into title "Lucy Lactobacillus", tag "Bacteria" and "Lucy is a bacteria."; the wording is otherwise unchanged. Unity's `GUI/TextIntroLevels` PNGs carry the same English text baked into images (33 cards, [UL §5]). Known text/goal mismatches kept as written: L6 says "wash away all the bad microbes" (goal is 3 of 4); L10 says "until you kill the super infection" (goal is 6 detonations; they coincide only if every bomb explodes with the superinfection on screen).

---

## 8. Assets

### 8.1 Stage and formats

- **Stage 800 x 450 at 25 fps** (main movie and every screen it loads). All 71 SWFs are `CWS` (zlib), SWF version 8, AVM1 (ActionScript 1/2; no DoABC, no AS3). Exceptions: `introductionToMicrobes_mainMenu.swf` 12 fps (unused), the shrinking avatars authored at 24 fps (played at the host's 25). The stage size of a SWF loaded into a holder (`amy.swf` 550 x 400, `harry.swf` 1000 x 600, `junior_game_assets.swf` 800 x 600) has no effect [S §1, §3].
- Run-time set: 19 SWFs, 2.1 MB: the main movie's 10 (section 2.1), plus `kitchen_game_main`, `kitchen_game_intro_level_0..3`, `kitchen_game_outro` (loaded by `KitchenGame.as:121-126`) and `shrinking_harry`, `shrinking_amy` (`ShrinkingZone.as:25-26`). Everything else under `movies/` is an editor, test, demo or superseded build (for example `introductionToMicrobes_platformer9.swf` is an 800 x 750 debug build; `Game_Show.swf` holds an unused raster copy of the studio) [S §3, §5.11].
- Tiles reach the platformer through a runtime shared library: the platformer imports `shared_library_link` (its id 1496) from `junior_game_assets.swf` (id 622), which exports all 92 tiles [S §4].
- The port renders the display at 800 x 450 stage units, letterboxed, with a DOM UI layer scaled with the stage; the canvas backing store is capped at 2 device pixels per CSS pixel with a render-time governor [PD "Engine and platform"].

### 8.2 Where each piece of art comes from

"Flash form": B = bitmap in the SWF, V = vector. The port's pipeline renders SWF symbols through Ruffle into WebP atlases with exact frame labels, frame scripts and registration points (`tools/swf-sheet/README.md`; `node tools/swf-sheet/sheet.mjs <job>`, then `node tools/build-atlas.cjs <atlas job>`), because the Unity PNGs do not line up frame for frame with the Flash timelines, lack registration points and are lower resolution.

| Art | Flash symbols | Form | Unity PNG | Port source |
|---|---|---|---|---|
| 92 tiles | `junior_game_assets.swf` `*_Tile` / `*_obj` / `*_tile` | B (one bitmap each; mostly JPEG) | `Textures/Tiles/{Body,Skin,Kitchen}`: **same pixels** (mean difference 0-6.2/255), lossless | SWF render at 2x (done for kitchen). Unity lossless PNGs are an acceptable drop-in for tiles only (same 50 px grid, same size) if JPEG artefacts show [S §9] |
| 11 microbes, all states | `*_icon` in the platformer SWF (185-546 frames) | V | yes, but cuts differ: Lucy 178 vs 255 frames, Slarg 242 vs 263, Slurm/Super Slurm 332 vs 340, superinfection lacks frames 1-10 and 286-318 | **SWF** (Lucy done) |
| Player halves | `amy.swf`, `harry.swf` `upper`/`lower` (hoverboard = 5 shared bitmaps; soap bottle bitmap 204) | V + B | Amy full, Harry sparse (154 of 330 up, 101 of 207 low) | **SWF** (done, with per-frame bounds) |
| Soap / white pickups (28 frames each), projectiles, camera flash, milk glass (3 states), antibiotic | platformer SWF | B | soap missile, splat, flash and milk identical; pickups re-rendered (white at about 1.33x) | SWF (done for level 1) |
| Exit portal | `portal_exit_icon` (static) | V | **no** (Unity `Portal2` is the other, animated `portal_exit`) | SWF (done) |
| HUD: score, digits, hearts, timer stopwatch, antibiotic icon | platformer SWF | V | heart and score background only | SWF (done) |
| ePhone, status screen, tick boxes, mode icons, `*_image` portraits, `exit_status`, `level_intros` pages | platformer SWF | V (+ bitmaps in `milk_image`, `superinfection_image`) | phone animation and re-framed portraits only; no digits, tick boxes, mode icons, intro pages | SWF (done for level 1; pages 40+ to do) |
| Platformer background | root shape 1495 | flat `#ff9900` | - | colour fill |
| Splash TV (170 frames) | `splash.swf` sprite 58 + 3 TV-static bitmaps (584 x 345) | V + B | `GameShow/TVSet` 25 of 170 frames | SWF with the e-Bug logo replaced |
| Studio, podia | `gameshow_set` (`eBugGameShow.swf`, `cutscene_introduction.swf`); raster copy `Game_Show.swf` bitmaps 308/868 (803 x 453) | V | `GameShow/Scenario/Background.png`, `Foreground.png` = the raster copy at 1.2x | SWF |
| Game show Amy / Harry (1124 frames, 18 nested 125-frame emotion clips) and host (471 frames) | inside `gameshow_set` | V | Amy/Harry 796 frames each; host 28 poses | SWF, **decimated** (payload) |
| Question board, talkie, scoreboards, shrinking zone | `question_board`, `talkie`, `score`/`digit`, `shrinking_zone` | V | board no; talkie, score, zone stills only | SWF |
| Shrinking avatars (150 frames each) | `shrinking_amy.swf` / `shrinking_harry.swf` `avatar` | V + B | yes (150 each) | SWF |
| Cutscene chooser and form | `cutscene_introduction.swf` | V | no | studio art from SWF; form as DOM UI |
| Kitchen scene, 600-frame kitchen avatars (15 states), 25 foods + 25 cling film overlays | `kitchen_game_main.swf` | V | **no** (Unity has no kitchen) | SWF |
| Kitchen intro backdrops | `kitchen_game_intro_level_N.swf` | B (824 x 457 JPEG) | no | extracted bitmaps (`reference/analysis/bitmaps/kitchen_game_intro_level_N/1.jpg`), level 0's Amy replaced or accepted (it shows Amy whatever the avatar) |
| Kitchen outro, summary page | `kitchen_game_outro.swf`, `summary_page.swf` | V (grey panel on `#cccc00`) | no | redraw as UI |
| Loader | main SWF root clip `loader`: two text fields only (`loading_text`, `percentage_text`, Arial Bold 25 white) on the black stage, no art [F §1.1], capture `001-loader.png` | text | no | new DOM progress bar (2.1 row 0) |
| Whiteout (antibiotic flash) | platformer root `whiteout` (sprite 1500), a plain white 800 x 450 rectangle | V | no | colour fill (3.14) |
| Winner screen, Level select, Settings, pause menu, level-complete card, touch controls | none in Flash (2.1 row 5, 11.1) | - | Unity has a final screen only [UL §6] | new UI art in the port's own style, no e-Bug marks |

Unity-only art with no Flash counterpart (not used): `Background/*_bg.png` swatches, `GameShow/Scenario/DonnaQuiz1..3.png`, `GameShow/TextBox.png`, `GUI/TextIntroLevels` (33 English text cards), `Projectiles/drop.png`, `Projectiles/whitebcell.png`, `Players/Final Tractor Beam.png`; the red/green check icons `GUI/InGamePhone/200px-P_{no_red,yes_green}.svg.png` look like Wikimedia thumbnails (attribution unknown: do not use) [S §9], [UA].

### 8.2a Screens, stage colour and palette (from the captures) [R §8]

- **Stage colour black** (`#000000`, SWF header and HTML `bgcolor`): anything the art does not cover shows black (the question board's side bands).
- **Splash**: a wooden 1950s television (cabinet about `#C19561`, round dial and speaker grille on the right) on a pale green floor under a pale blue sky; the screen goes dark, then static with "Tuning" and green bars, then the studio, then the e-Bug logo (yellow-green "e-BUG" on a blue splat) with a glossy blue "New Game" button at about (197-328, 240-287).
- **Studio**: pale blue wall with light blue and lavender "circuit" stripes, dark blue cogs, black spotlights top left and right; a purple and pink "e-Bug" arch with yellow bulbs behind the host (white lab coat, yellow bow tie, glasses, silver microphone) at a purple podium with a blue e-Bug smiley (**branded: the arch and podium logos need replacing**); contestant podiums (tops `#FFA6D0`, bodies `#B059D1`) with green LCD scoreboards (digits `#61D346`) for Amy (centre, x about 460-560) and Harry (right, x about 600-690); dark checkered floor. The avatar-choice frame is darker behind the podiums.
- **Talkie**: speaker box as above; a translucent dark panel with a white border from (20, 337) to (780, 447).
- **Details form**: the board's blue microbe background; labels at x 92, y 44 / 116 / 196; inputs at x 397; "Submit" at about (398-612, 276-350).
- **Shrinking zone**: pale blue wall with circuit stripes, three spotlights, a large red and yellow shrink ray top right, the child on a red and white target platform at centre bottom, black and white radial floor.
- **Platform levels**: flat `#FF9900`; HUD clock top centre, score top right (675, 14), hearts y 72, small ePhone bottom right; the grown ePhone covers about x 41-773, y 30-414 with the host's head bottom left and the page text on the right; grow and shrink rotate the phone.
- **Kitchen**: yellow walls `#FFF697`, mint cupboards and counter `#80BB9E` (top `#96DAB8`), pale blue open fridge `#9ED3F0`, blue bowl, pink tissue box; intro screens are a dimmed kitchen picture with Amy at the counter, Click button at (282.7, 335.4).

| Where | Colour |
|---|---|
| Platform background | `#FF9900` |
| Scoreboard LCD digits (game show and HUD) | `#61D346` |
| Hearts | about `#E35E5E` |
| Talkie speaker box | `#5994C0` |
| Question board and form background | about `#027AB3` |
| Glossy blue buttons: face, highlight | about `#6CC3FE`, `#DAF0FF` |
| Podium tops, bodies | `#FFA6D0`, `#B059D1` |
| Kitchen wall, counter, counter top, fridge | `#FFF697`, `#80BB9E`, `#96DAB8`, `#9ED3F0` |
| Kitchen clock text | `#20648C` |
| Shrinking zone wall, target red, floor dark / light | about `#94BBDD`, `#EB403D`, `#424242` / `#EBEAEB` |
| Summary and outro surround (standalone) | `#666600` |
| Splash New Game button | about `#66C2FE` |

Sampled values are Ruffle's anti-aliased output; take exact colours from the SWF shapes when extracting art.

### 8.3 Gotchas [S §11]

- **Names**: leading-space exports `" Harry_Hand_R_Skin_12"`, `" Harry_Hand_R_Skin_11"`, `" Harry_Hand_L_Skin_11"`; `eBugGameShow.swf` id 280 exported as `Amy_Eyes_Game_Default_Skin_02Harry_Eyes_Game_Cautious_Skin_02`; the level editor exports id 590 as `" "`. Match byte-exactly or trim deliberately.
- **Missing linkages**: `colin_icon`, `super_slarg_icon` (defined in every level palette, never placed).
- **Registration points**: tiles, pickups and HUD symbols are top-left registered; `camera_flash` is centred (75 x 75 at (-31, -35)); `kitchen_bg` centred; `e_phone` is placed so its small state sits at (697.4, 263.4) in its own space; `white_pickup` art starts at x 6.
- **Scale**: the player art is authored at about 11x and placed at 0.089; shrinking avatars at 0.7174. Render at on-screen scale x device pixel ratio, not authoring scale.
- **Clip sizes are live in Flash** (`_width`/`_height` change per frame): the physics boxes use the value at creation; `safeToMove`, the ground test and hitTests read them live. The port reads per-frame bounds for the avatar and frame-1 bounds for microbes, pickups and projectiles [PD "Unverified"].
- JPEG3 alpha in the SWFs is premultiplied (measured on all 300); the extractor un-premultiplies [S §2].

### 8.4 Payload and texture memory

- Budget about **15 MB** total payload (GOAL_PROMPT). `web/` is 7.1 MB today with level 1's atlases (2.7 MB). Unity's referenced PNGs alone are 40 MB, which is why the port renders only the frames each clip uses, deduplicates, trims and packs to WebP.
- Level 1 decodes about **58 MB of RGBA** atlas pages (Lucy 2048 x 2048, Harry 2044 x 2048, HUD 1516 x 1528) [PD "Follow-ups"]. iOS Safari evicts or crashes well before 400-500 MB, and older iPhones earlier. Plan: split `level_intros` and `e_phone` out of the HUD atlas, 1.5x pages for large animated sheets on coarse-pointer devices, load atlases per area (platformer setting, game show, kitchen), `ImageBitmap.close()` on atlases the next area does not use, and decimate the game-show emotion clips (Unity shows 5-7 poses per emotion at 5 fps; the port can hold every second frame at 12.5 fps).
- The service worker precaches the shell, every level JSON and level 1's atlases (2.5 MB); other atlases are cached on first fetch [PD].

### 8.5 Sound

- **The original is silent.** None of the 71 SWFs contains a DefineSound, StartSound, StartSound2, DefineButtonSound, SoundStreamHead, SoundStreamHead2 or SoundStreamBlock tag (raw tag walk including sprites), the AS2 source never uses `Sound`, `attachSound`, `loadSound`, `.mp3` or `.wav`, and the Unity remake has no audio files or AudioSources [S §6]. All audio is new work.
- Port: Web Audio unlocked on the first gesture (`touchend` on iOS), master / music / sfx buses with saved volumes and mute, **synthesised effects** (`web/js/core/audio.js` `SYNTHS`) and procedural music per area (`web/js/core/music.js`), ducked under menus.

| Game event | Synth name |
|---|---|
| UI press / hover | `tap` / `hover` |
| Jump / double jump / landing | `jump` / `doubleJump` / `land` |
| Soap or white blood cell thrown; antibiotic thrown | `throw` |
| Projectile splat: soap / white blood cell | `bubblePop` / `squelch` (`web/js/platformer/platformScene.js:433`) |
| Bad microbe washed away (bubble rise) | `wash` |
| Bad microbe killed by contact (+5) | `splat` (`platformScene.js:442`) |
| Photo taken | `photo` |
| Goal tick lands on the ePhone | `tickLand` |
| Pickup collected (ammo, antibiotic) | `pickup` |
| Player hurt; heart lost | `hurt`; `heartLost` |
| Good microbe killed (-10) | `wrong` |
| Portal opens | `portalOpen` (`goal` and `portal` are defined in `SYNTHS` but not played) |
| Entering the portal; level complete | `suck`; `levelComplete` |
| Death or time-out | `gameOver` |
| Last seconds of the timer | `lowTime` (the port code plays it in the last **10** s, `platformScene.js:609`, while 3.24 turns the clock red for the last 20 s: align one to the other) |
| Milk turns to yoghurt | `yogurt` |
| Antibiotic explosion (whiteout) | `whoosh` (plus shake) |
| Summary counters | `countTick` |
| ePhone grows / shrinks / page turn | `phoneGrow` / `phoneShrink` / `pageTurn` |
| Talkie typewriter | `typeBlip` (throttled) |
| Quiz answer: correct / wrong / don't know | `right` / `wrong` / `neutral` |
| Shrinking zone | `shrink` |
| Winner screen | `cheer` |
| Kitchen: sneeze / wash hands / bin / place item | `sneeze` / `wash` / `bin` / `tick` |

**Events with no sound assigned yet** (checked against sections 2-6; each needs a choice from the existing `SYNTHS` or a new synth): Lucy touches the milk (+10, `tickle`) and Lucy dives; antibiotic bomb lands and fuse runs (2000 ms); superinfection hit (`be_hit_N`) and its final `be_killed`; a good microbe pushed into a slide; a wasted photo (flash on an already photographed microbe); bad microbe photographed (+15) versus good (+5), if they should differ from `photo`; splash New Game button appearing (frame 150); cutscene avatar hover (`happy` / `disappointed`) and choice; details form submit; question board appearing; the CPU's answer (`right` / `wrong` / `neutral` reused?); scoreboard digit change; kitchen: next item appearing, cling film applied, tissue caught in time (`sneeze_tissue_end`) versus sneeze on the food (`sneeze_food_end`), kitchen clock last seconds and time-out, outro page turn; summary page (death / time-out) appearing; ending line.

### 8.6 Fonts

- Flash text fields use **device fonts**: the SWFs embed Arial, Arial Bold, Verdana, Verdana Bold and Myriad Pro Bold as DefineFont3 with only 2-15 glyphs each (placeholders), so the player's installed Arial/Verdana rendered the text. Where they appear: HUD timer bold Arial 16 black (DefineEditText 1499); ePhone intro pages regular white Arial, titles bold Arial 16 (`level_intros` DefineEditText 1200-1232); game show, cutscene, kitchen, splash, summary page: Verdana Bold / Verdana (20 px in the kitchen screens); the main movie and platformer also carry Myriad Pro Bold [S §3], [PD].
- No `DefineEditText` sets `UseOutlines`, so every dynamic and input field used the player's own fonts; Ruffle substitutes Noto Sans, so **treat typography in the captures as layout only** [R §4.4]. Static text (`DefineText` or shapes: "Agree", "Don't Know", "Disagree", "Click", "Submit", "New Game", the phone's "e-Bug") is exact. Field fonts read from the SWFs [R §8.2]:

| Field | Font, size, colour, alignment | Box (w x h) |
|---|---|---|
| Loader `loading_text`, `percentage_text` | Arial Bold 25, white, centred | 491 x 32, 104 x 32 |
| Debug `fps` | Arial 26, `#ff0000`, left | 375 x 36.5 |
| Talkie `statement_text_field` | Arial 20, white, left, multiline, word wrap (at most two lines, from (37, 358)) | 667 x 79 |
| Talkie `speaker_box` | Arial 20, white, in a blue `#5994C0` box with a 2 px white border at (20, 308)-(213, 335) (cutscene: 5 px further left) | 170 x 26 |
| Board `question_heading` / `question_body` / `point_value` | Verdana Bold 22 / 16 / 16 (right), white | 186 x 31 / 556 x 88 / 131 x 23 |
| Form labels / inputs | Verdana Bold 26, white / black on white | 230, 104, 240 wide / 312 (age 58) x 36 |
| Splash "Tuning" / "New Game" | Verdana Bold 30 `#00ff00` / Verdana Bold 33 white, centred | 133 x 40 / 238 x 44 |
| ePhone intro text | Arial 10, white, multiline (drawn about 2.4x larger in the grown phone); titles bold | 104 x 100 |
| Platform `timeLeft` | Arial 16, black, `<b>N</b>` | 104 x 22 |
| Kitchen `clock` | Verdana Bold 20, `#20648c`, centred | 110 x 35 |
| Kitchen intro `text0`-`text11` | Verdana Bold 20 (23 for "Wrong!"), white, centred | up to 622 wide |
| Kitchen outro rows | Verdana 20, black, centred; "X" and "=" Verdana Bold | |
| Summary `text0`, `text1`-`text4` | Verdana Bold 20 / Verdana 16, black, centred | 648 / 556 wide |
- Unity's fonts (`Assets/Other/`): Radioland and Radioland Slim ("DO NOT DISTRIBUTE WITHOUT AUTHOR'S PERMISSION!") and Another Typewriter ("No rights reserved"). **Not used** [UA "Fonts"].
- Port: bundled OFL fonts only, no network requests: **Baloo 2** (700, 800) for headings and buttons, **Atkinson Hyperlegible** (400, 700) for body text and UI (`web/fonts/`, licences `OFL-*.txt`). Text drawn inside original art (intro pages, HUD timer, board) uses Arial / Verdana with the platform sans-serif as fallback, as Flash did with device fonts.

---

## 9. Flash vs Unity differences and decisions

Unity sources: [UL] sections as cited. "Port" is the decision for the remake. Flash wins unless a reason is given.

| # | Topic | Flash (canonical) | Unity remake | Port decision |
|---|---|---|---|---|
| 1 | Round structure | 5 rounds; round 4 is the kitchen game | kitchen never built; round 4 quiz never played; `gameShow_quiz4` is really round 3 ([UL §1]) | Flash: 5 rounds including the kitchen |
| 2 | Blind rounds | build A: every round; build B: removed | on by default, W toggles ([UL §1]) | off by default, Settings toggle (6.7) |
| 3 | Shrinking zone | before every action, full 149 frames (6 s) | only after blind rounds (or every round with blind off); cut at 3.5 s; camera shake | Flash: before every action, full clip (skippable after first viewing) |
| 4 | Level layouts | `alpha_level*.xml` (37-75 x 9 tiles) | hand-built scenes about 160-177 tiles wide, 32 x 20 tiles visible ([UL §10]) | Flash XML only |
| 5 | L2 goal | photograph 3 of any good microbe (kills count) | photograph 3 Lucy specifically | Flash |
| 6 | L6 goal | kill any 3 bad (2 Slurm, Slarg, Donna) | wash away 3 Slurm (4 Slurm, Steve, Donna) | Flash |
| 7 | L10 goal | 6 antibiotic detonations; 6 pickups, no respawn; superinfection 6 lives | kill the superinfection: life 20 at 5 per dose (4 doses), 1 pickup that respawns after 5 s | Flash |
| 8 | Level population | as placed in the XML | adds super_slurm and super_colin to skin1, Sandy, Slarg and antibiotic pickups to skin2, pickups to kitchen2; different L10 cast | Flash |
| 9 | Level timer | 180 s, then "You ran out of time." | none | Flash (180 s) |
| 10 | Death | "You Died!", restart **the round** from its first level, score kept | restart the scene (same level) | restart **the same level**, score kept (deliberate; 2.6, 11.1) |
| 11 | Hurt | 3 lives; 480 ms hurt with no control and no damage | 3 lives; 2 s invulnerability, control kept | Flash timings; blinking added |
| 12 | Jump | double jump; apex about 100 px (2 tiles); always -25 px/step | single jump, apex about 3.6 u (7 tiles at 0.5 u) | Flash, with coyote time and buffering (3.11) |
| 13 | Movement | Verlet hoverboard, 3.645 px/step^2, drag 0.95, perpetual creep, per-level speed cap | Rigidbody2D, force 50, max 5.7 u/s, collider friction | Flash |
| 14 | Keys | Up jump, Space throw, Ctrl photo/antibiotic, Home/Alt skip | Up jump, Space/RMB throw, Ctrl/LMB photo/antibiotic, Q skip, W blind toggle | remappable: Space/Up/W jump, X/J throw, C/K/Ctrl/Shift camera; touch and gamepad; no cheats |
| 15 | Ammo | infinite from the start; pickups only +7 points | starts at 0; pickups +3 (soap and WBC counted separately, never displayed), respawn after 5 s | Flash |
| 16 | Which projectile | by level: white blood cells when `body_level` is true (L1-L4, L7-L10), soap in L5-L6 | WBC if you hold any, else soap | Flash |
| 17 | Microbe durability | 1 life each; any bullet washes a bad microbe away; soap and WBC identical | per-microbe life and immunities (soap vs WBC vs antibiotic, [UL §4]) | Flash |
| 18 | Photo | 75 x 75 flash area in front; first overlapping microbe only, even if already photographed | 3 u ray, up to 3 hits | Flash |
| 19 | Antibiotics | on-screen only; kill Lucy/Sandy/Steve (-10) and Slurm/Slarg/Colin (+15); spare Patty, Iggy, Donna; superinfection -1 life (+30) | every tagged object in the scene, visible or not; per-microbe flags | Flash |
| 20 | Good vs bad contact | both die; good death -10 and counts for PHOTOGRAPH_GOOD; bad +5 and counts for KILL_ALL | both die; no goal counts | Flash |
| 21 | Milk | one Lucy contact converts a glass (+10, +50); order dependent; yoghurt glasses ignore more hits | trigger-based dive; a glass accepts repeated dives; yoghurt pots count too | Flash |
| 22 | Superinfection | 409 x 195, floats, pushable, antibiotic-only, never removed | life 20, static | Flash (removal fix) |
| 23 | Pickup respawn | never | 5 s | Flash |
| 24 | Camera | margin push at 250 / 450, `abs(dx)` speed, no clamp, can pan the wrong way | lerp to target with margins and edge clamps | Flash margins, eased, clamped, look-ahead (3.23) |
| 25 | HUD | score digits, 3 hearts, timer, antibiotic icon, ePhone with goal picture and 6 tick boxes | 3 hearts, antibiotic icon, phone overlay with up to 3 checks | Flash |
| 26 | Briefing | ePhone grows, `level_intros` pages, click or 5 s autoplay | PNG text cards, any key | Flash (animated phone), typewriter, autoplay after the text is shown |
| 27 | Quiz scoring | +10 correct; other side +5 on wrong; 0 don't know; CPU uniform | same; Unity's `<lable>` typo scores some "Disagree" as safe ([UL §9]) | Flash rules |
| 28 | Last question of a round | build A: no feedback, no CPU turn; build B: both | feedback and opponent | feedback and CPU turn |
| 29 | Question UI | full-screen board, "Question N" 1-based, no timer | OnGUI form, 0-based number | Flash board |
| 30 | Quiz text | positional XML; build A English | English strings embedded in scripts; `Resources` XML unused | live `en_en` + 10 languages, positional JSON (6.8) |
| 31 | Host name / brand | "Gameshow Host"; "e-Bug Game Show" | "Game host"; "Super Microbe World Game Show" | "Gameshow Host"; "Super Microbe World Game Show" |
| 32 | Opponent | always named "Amy" (preload bug) | "Your opponent" | the child not chosen, by name |
| 33 | Details form | nickname, age, e-mail pre-filled "2", "dont@have.one" | nickname, age, e-mail default "?", posted to Heroku | nickname only, local |
| 34 | Ending | host line only; tie = loss; broken restart | final screen: win / draw / loss, credits loop | winner screen, tie = draw (open), Play again, Level select |
| 35 | Tracking | `loadVariables` to e-bug.eu | Heroku tracker | none |
| 36 | Typewriter | 1 character per frame (25 cps); click completes, then advances | 20 letters/s (probably 0 period), 75-character wrap | Flash |
| 37 | Kitchen game | full (section 5) | absent | Flash |
| 38 | Art | vector SWF clips | PNG exports with different cuts, no registration points | SWF renders (8.2) |
| 39 | Sound | none | none | synthesised effects and procedural music |
| 40 | Level select | none | none | added after a level is completed (11.1) |
| 41 | Debug cheats | Home/Alt skip | Q skip, W blind toggle | removed from the release |

---

## 10. Bugs fixed

Every candidate bug in the original, with its citation, whether the intent is clear, and what the port does. GOAL_PROMPT rule: fix where the intent is clear; otherwise keep the original behaviour and note it. Status: **Fixed** (in the port now), **Planned** (to fix when that area is built), **Kept** (faithful on purpose), **Changed** (deliberate design change, not a bug fix), **n/a** (not ported). "PD n" is the engine log's numbering.

### 10.1 Platformer

| # | Bug | Source | Intent clear? | Status |
|---|---|---|---|---|
| 1 | Static broadphase uses the local list index for `staticBoundingBalls` / `excemptionMatrix`: large tiles are partly soft (5.5% of tile-top positions) | `ParticleSystem.as:583,586` | yes | **Fixed** (plain AABB; PD 1) |
| 2 | Killed, ignored and removed bodies still collide as the outer body: dived Lucy and the dead superinfection are invisible solid boxes | `ParticleSystem.as:409,433-435`; `LucyLactobacillus.as:160-161`; `SuperInfection.as:36-76` | yes | **Fixed** (PD 2) |
| 3 | `isGoalMet` uses `==`: two counted events in one step overshoot and deadlock the level (L5, L6 exposed) | `Goal.as:36` | yes | **Fixed** (`>=`; PD 3) |
| 4 | EXPLODE_ANTIBIOTIC pushes `goalevents.pop()` even when empty (`undefined` in the queue) | `PlatformGame.as:874-879` | yes | **Fixed** (PD 4) |
| 5 | Superinfection ignores BE_PHOTOGRAPHED, so every flash on it pays +15 (point farming); it is never removed | `SuperInfection.as:43-47,79-105`; `CameraFlashEntity.as:79-88` | yes | **Fixed** (photo counts once; inert when dead; PD 5) |
| 6 | Missing linkages (`colin_icon`, `super_slarg_icon`) give body-less entities; unhandled PORTAL_ENTRANCE re-pushes the previous entity under a new index | `PlatformGame.as:419,526-527` | yes | **Fixed** (skipped; PD 6). No played level is affected |
| 7 | `antibiotic_held` HUD icon not reset per level (the flag is) | `PlatformGame.as:126-185` | yes | **Fixed** (PD 7) |
| 8 | Timer shows "90" (or the last level's value) during the intro and "-1" at the end; 181 decrements of about 1020 ms (about 184.6 s) | `PlatformGame.as:558-569` | yes | **Fixed** (shows 180; ends at 0; exactly 180 s; PD 8) |
| 9 | Score HUD wrong for negative scores (-10 shows "0990") and 10000+ | `PlatformGame.as:1331-1372` | yes | **Fixed** (PD 9) |
| 10 | Grid ground test needs `y + clip._height` to land exactly on a multiple of 50 | `GameEntity.as:488-497` | yes | **Fixed** (epsilon; PD 10) |
| 11 | Event ids 50/51 shared by player accelerate/decelerate, portal open/close, milk hit, bad-microbe wash-away | `PortalEntity.as:14-15`; `MilkGlassEntity.as:19`; `BadMicrobe.as:19` | yes | **Fixed** (namespaced; PD 11) |
| 12 | Static lookup grid sized 9 x 16 from default bounds; rows 9+ silently dropped | `ParticleSystem.as:166-181` | yes | **Fixed** (sized from the level; PD 12). No behavioural change for the alpha data |
| 13 | Removing a camera flash nulls whichever dynamic body shares the flash's static index (can delete a live bullet after many shots) | `CameraFlashEntity.as:27`; `PlatformGame.as:888-912` | yes | **Fixed** (PD 13) |
| 14 | A flash created on a cell corner can shadow a tile's entry in the static lookup grid | `ParticleSystem.as:219`; `PlatformGame.as:770` | yes | **Fixed** (PD 14) |
| 15 | Seams between flush tiles push bodies sideways (smaller-penetration rule) | `ParticleSystem.as:590-611` | yes | **Fixed** (PD 15) |
| 16 | Home / Alt skip the level (debug cheat in the release) | `PlatformGame.as:1287-1290` | yes | **Fixed** (removed; debug flag only; PD 16) |
| 17 | Intro autoplay intervals stack when clicking quickly, skipping pages | `level_intros` frame scripts (`startAutoplay`) | yes | **Fixed** (`web/js/platformer/intro.js`) |
| 18 | "+3 when a bullet hits a bad microbe" never fires (tests type 5, never assigned) | `PlatformGame.as:658-665`; `doc:1234` describes it | yes (documented) | **Planned** (award +3 on the bullet COLLIDE; the engine currently keeps it out: update `web/js/platformer/game.js` and PD) |
| 19 | L4's ePhone shows no Patty picture (no `patty_image` branch or art); KILL_ALL always shows Slurm, even in the Iggy level | `PlatformGame.as:340-358` | yes | **Planned** (compose a portrait from the microbe's own idle frame: Patty for L4, Iggy for L7) |
| 20 | Quick taps between two input polls are lost | engine | yes | **Fixed** (PD 17, `web/js/core/input.js`) |
| 21 | Double-jump dead press: the press after landing from a double jump only re-arms | `PlayerEntity.as:180-184,418-419,432` | no (side effect of the re-arm rule) | **Changed** (jump buffer and coyote time; `options.jumpFeel = false` restores) |
| 22 | Camera has no edge clamp and pans towards the margin even when the player moves away | `PlatformGame.as:1033-1047` | no | **Changed** (eased, clamped, look-ahead) |
| 23 | Perpetual horizontal creep (0.1 px snap + 3 dp rounding: coasting never stops) | `Vector3.as:24-41,61`; `PlatformGame.as:1017` | no | **Kept** (part of the hoverboard feel; open question 11.3) |
| 24 | PHOTOGRAPH_GOOD also counts good-microbe deaths; unreachable second KILL_ALL case; types 2 and 5 unimplemented | `Goal.as:62-139` | no | **Kept** |
| 25 | A flash takes the first overlapping microbe even if already photographed (wasted shot) | `CameraFlashEntity.as:79-88` | no | **Kept** |
| 26 | Lucy/milk result depends on dynamic index order (a walking Lucy can dive without making yoghurt) | `MilkGlassEntity.as:64-93`; `LucyLactobacillus.as:145-175` | no | **Kept** (pushing always works; open question 11.3) |
| 27 | `bodyLevel` missing means true: L1-L4 throw white blood cells in the kitchen and on the hand | `MapBuilder.as:49` | no | **Kept** |
| 28 | `infiniteAmmo = true` from the start: pickups only give points | `PlayerEntity.as:124` | no | **Kept** |
| 29 | Microbes see only anchor cells (wide tiles look like voids); `walkThink` LEFT branch reuses the right-edge test | `GameEntity.as:275,431-465` | no | **Kept** |
| 30 | Off-screen entities with bespoke states never regain physics (the milk glass) | `PlatformGame.as:1154-1158` | no | **Kept** |
| 31 | SLIDE-state bad microbes ignore contacts; bad microbes in FALL/SLIDE/BE_PHOTOGRAPHED/BE_HIT hurt the player repeatedly without dying | `BadMicrobe.as:170-172`; `PlayerEntity.as:233-243` | no | **Kept** |
| 32 | First patrol leg is always leftwards (fall snap maps "no x movement" to LEFT) | `GameEntity.as:312-316` | no | **Kept** |
| 33 | BE_KILLED / BE_PHOTOGRAPHED discard `target.act(e)` results | `PlatformGame.as:940,963` | - | **Kept** (the discarded results are empty) |
| 34 | Spawned clips sit at world x until the next render | `ParticleSystem.as:204-205` | - | **Kept** (spawned entities do not advance until rendered) |
| 35 | Avatar `upper`/`lower` read in the constructor race the async `loadClip` | `PlayerEntity.as:108-109`; `PlatformGame.as:165-169` | - | n/a |
| 36 | A second `player_start` nulls `levelDataGeometry[old]` | `MapBuilder.as:107` | - | n/a (one start per level) |
| 37 | Antibiotic bomb off screen never explodes (L10 then lacks a detonation) | `AntibioticBombEntity.as:36-57`; `PlatformGame.as:621` | no | **Kept** (open question 11.3) |

### 10.2 Game flow and quiz

| # | Bug | Source | Intent clear? | Status |
|---|---|---|---|---|
| 38 | Kitchen found with `round == 2` (counter incremented lazily elsewhere) | `GameController.as:206-216,238-263` | yes | **Fixed** by design (explicit round table, 2.2) |
| 39 | Game show built during preload: player always Harry on the right podium, CPU always "Amy"; shrinking zone's `userAvatar` always Harry | `GameShow.as:52,85-104`; `ShrinkingZone.as:14-42,76-82` | yes | **Planned** (chosen child is the player; the other child is the CPU, by name) |
| 40 | `player.playerAnswers` never initialised; writes silently fail | `GameShow.as:107-109,234-269` | - | n/a |
| 41 | Last question of every sighted round: no host feedback, no CPU turn | `GameShow.as:293-298` | yes (build B added it, `doc:1911-1915`) | **Planned** |
| 42 | `showRoundText` leaves `busy = true`: the last intro line of every quiz half needs a second click (confirmed in Ruffle) | `GameShow.as:147-166`; [R §6.1] | yes | **Planned** (one click goes to question 1) |
| 43 | Blind reaction requests `"confident"`; the label is `condifent` | `GameShow.as:227`; `eBugGameShow.swf` sprites 479, 732 | yes | **Planned** (play `condifent`) |
| 44 | Blind intro promises "a great bonus later"; no bonus exists | `levels/alpha_gameshow_round1.xml:10` | no | open question 11.3 (blind rounds are off by default) |
| 45 | Tie counts as a loss (`player.score > cpu.score`) | `GameShow.as:452` | no | open question 11.3 (default: draw) |
| 46 | Ending click does nothing (`_root.exit` undefined; the `gotoAndPlay("init")` restart is unreachable); host says "reload this web page" | [R §6.3]; `GameController.as:325-328`; `GameShow.as:451-459` | yes | **Planned** (winner screen, real Play again) |
| 47 | Cutscene: build A line 3 "Excellent!" never shown; live 10-line XML's last line never shown by build A code; privacy line spoken after the form; pre-filled age "2" and e-mail "dont@have.one"; no validation | `cutscene_introduction.swf` root frames 1-30 | yes | **Changed** (nickname-only form, 2.4) |
| 48 | Death or time-out restarts the round from its first level | `PlatformGame.as:187-192`; `GameController.as:249-255,283-308` | no (possibly intended) | **Changed** (restart the same level; 2.6) |
| 49 | Loading word "Looding"; debug `fps` counter visible for the whole game (shows `main()` calls per second, then frozen) | `GameController.as:60`; main SWF root | yes | **Fixed** by design (new loader) |
| 50 | `introductionToMicrobes_mainMenu.swf` preloaded, never shown | `GameController.as:86,336-375` | - | n/a |
| 51 | `timestamp()` uses day of week, no padding | `GameController.as:162-168` | - | n/a (not ported) |
| 52 | Talkie shows placeholder text `"df"` at a transition | `Talkie.as:40-60` | yes | **Planned** (never show it) |
| 52a | Talkie "next" arrow blinks 0.4 s after every line starts, while still typing | `Talkie.as:40-59,62-77`; [R §6.2] | yes | **Planned** (arrow only when complete) |
| 53 | Board stopwatch `timer` never driven | `question_board` sprite 77 | no | **Kept** (no answer time limit; the stopwatch may be decorative) |
| 54 | Documentation's live build: `endOfKitchen` calls `startNonBlindRound()`, `endofHoverboard` calls `nextRound()` (inconsistent) | `doc:650-673` | - | resolved by decision (each action is followed by its own round's questions) |
| 55 | `<statment>` / `<lable>` typos in every quiz file | `levels/alpha_gameshow_round*.xml`; `doc:2018,2041` | - | harmless with positional parsing (port) |

### 10.3 Kitchen

See 5.13 for details. Summary: shared `FoodItem` state across levels (**Planned** fix: clone), cling film overlays left on screen (**Planned**), BOWL "Bad Food" repeat (**Planned**), four admonishment slots (**Planned**: show all), clock shows 99 at time-out and malformed `</face>` (**Planned**), misleading reminders for mouldy/burst items (**Planned**), throwaway `Player` avatar (**Planned**: chosen child), raw-meat hand contamination (`KitchenGame.as:685-689`; **Kept** as no effect, open), level 3 intro "45 seconds" vs 120 s (open), one-second tick is 1040 ms (**Changed**: exact seconds).

### 10.4 Level data

| # | Issue | Source | Status |
|---|---|---|---|
| 56 | `alpha_level11.xml` unreachable and unwinnable (6 kills needed, 5 bad placed); no intro label | `levels/alpha_level11.xml`; [L §4.2 item 10] | n/a (not in the journey; open question 11.3 for a bonus) |
| 57 | L2 and L3 declare `rows="11"` (only rows 0-8 used) | `levels/alpha_level2.xml`, `alpha_level3.xml` line 1 | **Kept** (harmless) |
| 58 | L3 cells at cols 45-46 beyond `cols="44"` are drawn but not solid; the visible wall is 50 px past the real barrier | `levels/alpha_level3.xml` | **Kept** in data (`outOfRange`); with the port's camera clamp to `cols*50 - 800` they are never on screen |
| 59 | L5 (12,65) and L7 (10,12) cells beyond row 8 | level XML | **Kept** (never drawn or solid) |
| 60 | L2 `plaster_singular_obj` at (8,43) runs past the world edge | `levels/alpha_level2.xml` | **Kept** |
| 61 | `microbeType="17"` on L5-L10 goals is decoration | level XML | **Kept** (ignored) |
| 62 | Documentation says L1 goalType 3; XML says 0 | `doc:280`; `levels/alpha_level1.xml:2` | 0 is right (3.20) |

---

## 11. Decisions and open questions

### 11.1 Design decisions for the remake

1. **Flow**: the five rounds of 2.2, with an explicit round table. Blind rounds **off** by default (build B), on as a Settings toggle (build A) (6.7). After each action the quiz asks that round's questions. Every question, including the last, gets host feedback and a CPU turn.
2. **Failure**: death or time-out shows the summary card ("You Died!" / "You ran out of time.") and restarts **the same level**; score kept; lives and time reset (Flash restarted the round, 2.6). The flow controller keeps a `restartScope` option ("level" default, "round" faithful).
3. **Level select after unlock** (the 2011 paper: "the junior game will be split into individual levels", `eval:135`; 50% drop-out per level, `eval:78`): every platform level and kitchen sub-level the player has completed once is unlocked in a Level select reachable from the splash, pause menu and winner screen. Playing from Level select runs that level alone (briefing, level, results card), without shrink or quiz, and records a best score. The New Game journey stays linear. Progress (unlocked levels, best scores, journey checkpoint) is saved in `localStorage`; Continue resumes the journey at the start of the step (quiz, level or kitchen level) the player was on.
4. **Avatars**: the chosen child is the player everywhere (platformer, game show podium, shrinking zone, kitchen); the other child is the CPU and is named after that child (fixes 2.8 item 1 and the kitchen's Harry-only avatar).
5. **Scores**: quiz points decide the winner (faithful). Platform and kitchen points are shown on their result cards and on the winner screen as "hoverboard points" and "kitchen points", but do not decide the winner (open question 11.3 item 4).
6. **Ending**: a winner screen with both podium scores, the host's win / lose (/ draw) line without "reload this web page", Play again and Level select.
7. **Text**: live `en_en` for English quiz and conversation text; 11 languages via `?lang=`, Settings and `navigator.language`; English fallback for English-only groups (7.1).
8. **Timing**: level timer exactly 180.0 s from the end of the briefing (6000 steps); kitchen seconds exactly 1000 ms; the rest of section 12.
9. **Feel and juice** (all deterministic or render-only): jump buffer and coyote time, eased and clamped camera with look-ahead, hit-stop, shake, particles, squash and stretch, popups, eased counters, haptics, synthesised sound and procedural music; reduced motion and reduced shake settings honour `prefers-reduced-motion` [PD].
10. **Controls**: keyboard (arrows/WASD move; Space/Up/W jump; X/J throw; C/K/Ctrl/Shift camera or antibiotic; Esc pause; Enter confirm; 1/2/3 quiz answers), touch (d-pad, jump, throw, camera, phone, pause; adjustable opacity; fades over targets), gamepad; remappable; prompts follow the active device [PD].
11. **Kitchen input**: one large tap region per location (5.4), keyboard focus order over locations and counter items.

### 11.2 Privacy, branding and hosting

- **E-mail is not collected. Age is not collected.** The form asks only for a nickname (optional, defaults to the avatar's name), kept on the device. The live "competitions" privacy line (conversation 8) is not used.
- **Research submission removed**: no `loadVariables` equivalent, no tracking, no analytics, no network requests other than same-origin assets. Quiz answers stay in memory (and optionally in the local save for the player's own summary).
- **Branding**: the hosted build carries **no e-Bug, HPA or UKHSA logos or names**; the page and app title is **"Super Microbe World"**; "e-Bug Game Show" becomes "Super Microbe World Game Show" (David, 2026-09-26: the artifact wording may say "Super Microbe World Game Show"; `web/PROGRESS.md`). Known branded art: the splash TV logo (yellow-green "e-BUG" on a blue splat, `splash.swf` sprite 58), the studio's purple and pink "e-Bug" arch behind the host and the blue e-Bug smiley on the host's podium (`gameshow_set`, also in the cutscene) [R §8.1], the ePhone wordmark "e-Bug" (removed in the port's atlases), conversation line 0 in 11 languages. Every rendered SWF sheet needs a visual check for further logos before publishing.
- **Fonts**: OFL fonts only (8.6). Unity's Radioland fonts are not redistributable.
- **Hosting**: GitHub Pages under `/play/` (live: https://gameologist.com/Super-Microbe-World/play/, `tools/deploy-pages.sh`) plus a claude.ai artifact; relative paths only; PWA with offline cache (service worker may be unavailable on the artifact origin).
- **Storage**: `localStorage` only (`smw:settings` overrides schema 2, progress, unlocks), every access wrapped so a blocked store still lets the game run.

### 11.3 Open questions (each with a recommended default)

1. **Blind round default**: off (recommended; build B, `doc:1727`, `eval:36,135`) or on (build A, the evaluation build)?
2. **"Great bonus later"** when blind rounds are on: drop the sentence (recommended) or implement a bonus (for example +5 per blind answer that was correct)?
3. **Tie**: draw (recommended; kinder, Unity) or loss (Flash `>`)?
4. **Hoverboard and kitchen points**: shown but not counted towards the winner (recommended, faithful) or added to the player's total?
5. **Restart after failure**: the same level (recommended, current engine behaviour) or the round's first level (Flash)?
6. **Lucy and the milk**: keep the order dependence (recommended; pushing Lucy always works and is what the briefing teaches) or make any Lucy contact convert the glass?
7. **Level 10**: the goal is 6 detonations, so the superinfection can survive, and an off-screen bomb never explodes (the level then becomes unwinnable). Keep (recommended) with an on-screen hint when a thrown bomb scrolls off, or make the bomb explode anywhere?
8. **Perpetual creep**: keep the +1.0 / -0.9 px/step coasting (recommended, faithful feel) or zero `abs(vx) < 1.05` when no key is held?
9. **Missing phone portraits**: compose Patty (L4) and Iggy (L7) portraits from their idle frames (recommended) or keep the blank / Slurm pictures?
10. **+3 bullet bonus**: award it (recommended; documented at `doc:1234`, branch exists) or keep it dead?
11. **Brand line in the 10 other languages**: machine replacement of "e-Bug" with "Super Microbe World" pending a native check (recommended), or English brand line only?
12. **Kitchen level 3 time**: 120 s as coded with the intro corrected (recommended) or 45 s as the intro says?
13. **Raw-meat hands**: keep no effect (recommended) or add the unused "Raw Meat Hands" admonishment when an item is placed after raw meat without washing?
14. **Cutscene closing line with blind rounds off**: a new neutral English line (for example "All right, let's shrink you down and explore the world of microbes!") or live line 9 "Let's see what you know about microbes." (which then precedes a level, not a quiz)?
15. **Build A sighted openers** ("Nice one!", "Yum Yogurt!", "Not bad.  Not bad at all..."): English-only extras or not (recommended: not, for parity across languages)?
16. **Level 11**: leave out (recommended) or ship as a bonus with a fixed goal (5 kills)?
17. **Tiles**: keep SWF renders (recommended) or swap in Unity's lossless PNGs?
18. **Nickname**: persist locally (recommended, clearable in Settings) or ask every new game?
19. **Language codes**: keep the original codes (`bg_fl`, `cz_cz`, ...) in URLs (recommended, mirrors the flashvar) or also accept BCP 47 tags (`nl-BE`, `cs`)?
20. **Level select scope**: platform levels and kitchen sub-levels only (recommended), or also single quiz rounds?

### 11.4 Top risks for the build

1. **Timing rests on an unconfirmed Flash cadence.** Every speed assumes one logic step per 30 ms (`setInterval(15)` with UPDATE/RENDER alternation). Ruffle measured a median 64 `main()` calls per second (range 11-74) with nothing else running, consistent with the nominal 66.7 [R §7], but Ruffle ran under SwiftShader and is not Flash Player 9/10; if the real player fired the interval less often, the original ran slower than the port.
2. **Texture memory and payload.** Level 1 alone decodes about 58 MB RGBA; the game show (two 1124-frame children, a 471-frame host), the kitchen (two 600-frame avatars, 50 food symbols) and 10 microbes still to come can exceed the 15 MB payload and iOS memory unless decimated and loaded per area.
3. **No-slack levels and bots.** L1-L4, L7 and L10 have zero spare targets; quirks (perpetual creep, entity-order dependence, off-screen freezing, the leftward first patrol leg, microbes seeing only anchor cells) make scripted bots fragile, and in L10 one bomb that scrolls off screen before exploding makes the level unwinnable until time-out.
4. **Camera changes alter gameplay.** On-screen status decides tile solidity, AI freezing and bomb detonation; the port's clamp and look-ahead change what is on screen versus Flash, which can shift outcomes (notably L10 bombs and the L3 out-of-range wall).
5. **L8/L9 Lucy-milk order dependence**: a walking Lucy can dive without making yoghurt; players and bots must push her; losing Lucys in L9 (6 for 3) is survivable, in L8 less forgiving if pushed wrongly.
6. **Kitchen from scratch**: no Unity version, all art vector-only (scene, avatars, foods, cling film), random item draws, sneezes on timers, tiny original tap targets (23-69 px) that need a new location-based input layer.
7. **Frame-script and clip-size approximations**: `midAnimation` gates run on a fixed-phase 25 fps clock and microbes use frame-1 bounds, while Flash read live `_width` in `safeToMove`, ground tests and hitTests: subtle differences in AI turning, photo hits and pickups.
8. **Box size uncertainty**: Patty 203.32 x 150.39 vs 187.89 x 141.53, Slarg 90.57 vs 90.37 wide; affects L4 collisions and speed caps; pending Ruffle.
9. **Translations are partial**: platformer intros, kitchen text, host responses and all new UI are English-only; 10 languages will be mixed unless new translations are commissioned; the brand line needs native checks.
10. **Full-journey E2E length and flakiness**: cutscene, 10 levels, 4 kitchen levels and 21 questions (42 with blind on), under mobile emulation and desktop, through real inputs only.
11. **Game show animation fidelity vs size**: emotions are 18 nested 125-frame clips on their own clocks; decimation must keep them readable.
12. **Data checks need careful definitions**: microbes spawn in the air; "spawns on solid ground" must mean "ground below"; L2/L3 `rows="11"`, L3 cols 45-46 and dead cells must not fail the checks spuriously.
13. **Hosting and PWA**: the artifact origin may block the service worker; a private artifact needs sign-in; WebKit is not installed, so iOS Safari (audio unlock, memory, fullscreen) is untested.
14. **Design changes need sign-off**: blind off, restart the level, jump feel, camera, scoring fixes and the open questions above depart from build A; late reversals cost rework in flow code and tests.
15. **Branding and licences in rendered art**: the e-Bug logo inside the splash TV, the studio arch and host podium, and the ePhone art, Amy baked into kitchen intro level 0's backdrop, Wikimedia-style check icons in Unity, Radioland fonts: each must be scrubbed or avoided before a public link.

---

### 11.9 Resolved decisions (orchestrator, 2026-09-26)

The open questions above are settled as follows so the build can proceed. David can override
any of them; each is isolated behind a setting or a single constant where practical.

| # | Question | Decision |
|---|---|---|
| 1 | Blind round | Off by default (live 2009 build), with a Settings toggle to turn it on. |
| 2 | "Great bonus later" line when blind rounds are on | Drop that sentence; no bonus is implemented. |
| 3 | Tie at the end | A draw, with its own friendly ending line (Flash counted it as a loss). |
| 4 | Hoverboard and kitchen points | Shown and saved, but the winner is decided by quiz points only, as in Flash. |
| 5 | Restart after failing a level | Restart the same level (kinder; the engine already does this). |
| 6 | Lucy and the milk | Keep the original entity-order behaviour (pushing Lucy in always works). |
| 7 | Level 10 bombs | **Fix**: a thrown antibiotic bomb explodes even when off screen, so the level can never become unwinnable; also add the off-screen hint. |
| 8 | Perpetual coasting creep | Keep (it is part of the hoverboard feel). |
| 9 | Missing phone portraits | Build Patty (L4) and Iggy (L7) pictures from their idle frames. |
| 10 | +3 for a bullet hit | Award it, as documented. |
| 11 | Brand line in other languages | Replace "e-Bug" with "Super Microbe World" (David approved the branding change; a native-speaker check is a follow-up). |
| 12 | Kitchen level 3 time | 120 s as coded; correct the intro text to match. |
| 13 | Raw meat on the hands | **Fix**: handling raw meat contaminates the hands until they are washed (the educational intent is clear; the original used the wrong index), with the "Raw Meat Hands" reminder. |
| 14 | Cutscene closing line with blind rounds off | A new neutral English line; translations fall back to English until checked. |
| 15 | Build A's English-only quiz openers | Leave out, to keep languages in step. |
| 16 | Level 11 | Leave out (it was unreachable and unwinnable in the original). |
| 17 | Tiles | SWF renders. |
| 18 | Nickname | Kept locally, clearable in Settings; email is never asked. |
| 19 | Language codes | Original codes (`en_en` -> `en`, `bg_fl`, `cz_cz`, ...). |
| 20 | Level select | Platform levels and kitchen sub-levels, unlocked by progress. |

## 12. Engine porting notes: timing

Goal: a deterministic fixed-timestep JS engine that feels like the Flash original. The original mixed four clocks: a 15 ms interval driving `main()`, UPDATE/RENDER alternation (30 ms logic steps), the 25 fps timeline (frame scripts that gate gameplay) and wall-clock `getTimer()` for seconds and fuses.

### 12.1 Every clock in the original and its port mapping

| Clock | Original | Effective value | Port |
|---|---|---|---|
| Platformer `main()` | `setInterval(loop, 15)` (platformer root frame 20; `GameController.as:259,270`) | nominal 15 ms (66.7 calls/s); Ruffle measured a median 64 calls/s alone (range 11-74), 49 in a loaded run [R §7]; Flash Player's own cadence unverified | `TICK_MS = 15` fixed accumulator (`web/js/core/loop.js:6`), at most 8 catch-up ticks per frame, then the backlog is dropped (a slow device runs slow instead of skipping) |
| Logic and physics step | UPDATE and RENDER alternate whenever anything moved, which is always in practice (`PlatformGame.as:613-616,1015-1020,1163`) | one UPDATE per 30 ms; physics `dt` is the constant 0.03 s, so the game's speed is tied to the step rate | `STEP_MS = 30`, `TICKS_PER_STEP = 2` (`web/js/platformer/constants.js:12-13`); everything in steps: gravity 2.7 px/step^2, run 3.645 px/step^2, walk 10 px/step |
| Timeline (frame scripts: `midAnimation`, `shoot`, loops, fades) | 25 fps display frames, independent of the interval | 40 ms per frame | global frame clock derived from the tick count: `frame = floor(tick * 15 / 40) = floor(tick * 3 / 8)`, i.e. `floor(step * 3 / 4)` at step boundaries: **3 frames every 4 steps**, fixed phase 0 (`FRAME_MS = 40`, `constants.js:14`). Gates keep their length in milliseconds |
| Level timer | `if (getTimer() - secondsTimer >= 1000)` polled per UPDATE, `secondsTimer` reset to the poll time; starts when the briefing ends | each "second" is the first 30 ms multiple >= 1000, about 1020 ms; 181 decrements (179..0, then "-1") = about 184.6 s | `LEVEL_TIME_STEPS = 6000` (exactly 180.0 s, `constants.js:15`); display `ceil(stepsLeft * 30 / 1000)`, shows 180 at the start, game over at 0; pauses during hit-stop, pause and the re-opened briefing |
| Antibiotic fuse | `getTimer() >= bombTimer + 2000` after `abs(dy) <= 2`, polled per UPDATE while on screen | about 2010 ms | `BOMB_FUSE_STEPS = ceil(2000 / 30) = 67` (`constants.js:16`), counted only while on screen |
| Hurt / invulnerability | upper and lower `hurt` animations, 12 frames | 480 ms | frame clock (12 frames = 16 steps) |
| Jump start gate | lower `jump_start` `midAnimation` frames 136-139 | 160 ms | frame clock (4 frames, 5-6 steps by phase) |
| Throw delay | Harry `shoot_soap` 280 -> 283; Amy fires on frame 4, busy 18 frames | 120 ms (Harry); 160 ms, 720 ms busy (Amy) | frame clock |
| Photo cooldown | flash alpha -10 per UPDATE | 10 UPDATEs = 300 ms | 10 steps |
| Microbe think | counts UPDATEs | idle 5 = 150 ms; fall/slide re-check 10 = 300 ms; wash/dive think every 6th | steps |
| Portal entry check | every 10 UPDATEs | 300 ms | 10 steps |
| Bullet life | `deadTimer` 15 UPDATEs, then the splat animation | 450 ms + splat | steps + frame clock |
| Wash away / dive | alpha -5 per non-think UPDATE, y -15 per UPDATE (wash) | about 24 UPDATEs (720 ms) | steps |
| Milk tickle | clip frames 20-49 | 1.2 s | frame clock |
| Whiteout | `onEnterFrame` alpha -10 | 10 frames = 400 ms | render only (frame clock) |
| Intro pages | 40 ms polling interval, `waitTime = 5000` | about 5.0-5.04 s per page, stacked intervals when clicked | cosmetic scene timer: 5 s **after the text is fully shown** (deliberate) |
| Talkie typewriter | `onEnterFrame`, 1 character per frame | 25 characters per second | 40 ms per character on the frame clock; tap completes |
| Game show `main` | `setInterval(main, 40)` | 25 Hz | event-driven sequence on the frame clock |
| Shrinking zone | 149 frames at 25 fps (authored 24) | about 5.96 s | 149 frames |
| Splash | 170 frames; New Game from frame 150 | 6.8 s; button at 6.0 s | same |
| Kitchen `main` | `setInterval(main, 40)`; seconds `getTimer() - timer > 1000` | each "second" about 1040 ms (60 s level about 62.4 s), plus 1 s showing "99" | frame clock: 1 s = 25 frames exactly; clock shows 0 at the end |
| Kitchen sneeze window | `setInterval(makeSneeze, 2000)` | 2 s | 50 frames |
| Kitchen wash hands | `wash_hands` 36 frames, flags cleared at the next one-second tick | 1.4-2.4 s | 36 frames then clear at the next second tick (faithful) |
| Kitchen bin fade | `_alpha -= 5` every 40 ms | 0.8 s | 20 frames |
| Tile definitions / level XML load polls | 40 ms | - | async fetch |

### 12.2 Loop structure

```
per animation frame (requestAnimationFrame):
  acc += min(now - last, 250) * timeScale; last = now      // web/js/core/loop.js _frame
  while acc >= 15 and n < 8: tick(); acc -= 15; n++        // fixed 15 ms ticks
  if n == 8: acc = 0                                      // drop the backlog
  render(alpha)                                           // interpolate, never simulate

tick():
  input.poll()                                            // latch presses since the last poll (none lost)
  tickCount++
  if scene is platform and tickCount % 2 == 0 and not paused and hitStop == 0: step()   // 30 ms logic step
  frameClock = floor(tickCount * 3 / 8)                   // 25 fps timeline for gates and loops
  other scenes (quiz, kitchen, menus) advance on frameClock changes
```

- **One UPDATE = one `step()`**: run 3.3 steps 1-12 in the original order (timer, goals, death, hearts, scroll, advance, event loop, physics, x snap, scroll decision, HUD). Keep the queue FIFO and the COLLIDE-from-last-step-first ordering; keep "spawned entities do not advance until rendered" as "spawned entities become active on the next step".
- **RENDER side effects become simulation**: tile solidity and entity on-screen flags are recomputed from the simulation camera once per step (after the scroll), never from the display.
- **Hit-stop** (juice) holds whole logic steps inside the scene (4 on hurt, 3 on a kill, 2 on a photo) and pauses the level clock, so a run is identical for the same per-step inputs [PD].
- **Pause** (Esc, visibility change, window blur, portrait orientation) stops ticks entirely; resuming resets `last` so no catch-up burst occurs.
- **Tests**: `?manual=1` disables real-time ticking; E2E steps every tick through `window.__test` (scene, goal counters, player state, input injection, seed) [PD].

### 12.3 Determinism

- No wall-clock reads inside the simulation: every `getTimer()` use becomes a step or frame counter (12.1).
- **Randomness**: the platformer consumes none (no `Math.random` in any platformer class). The only random draws in the original are the kitchen (`KitchenGame.as:155,919-1075`: category, index, sneeze roll) and the quiz (`GameShow.as:220,308`: blind reaction pose, CPU answer). The port uses seeded streams: `kitchen`, `quiz`, and `fx` (juice only, never read by the simulation). Seeds come from the run seed so a journey can be replayed.
- Keep the rounding semantics exactly (3.4): `add` rounds to 3 dp with `Math.round(v*1000)/1000`, the x snap is `Math.round(x*10)/10` (JavaScript `Math.round` rounds halves up like AS2). Do not substitute `toFixed` (string-based, and not identical at halves because of binary representation) or `Math.fround`.
- Input is sampled per tick and latched per step, so the same per-step input log reproduces a run on any device and refresh rate.

### 12.4 Rendering without changing feel

- The original only showed 25 pictures per second while logic ran at 33 Hz. The port renders at display rate and interpolates between the previous and current **step** states: `alpha = (ticksSinceStep * 15 + acc) / 30`.
- Keep a render-side `prevPos` per entity captured at the start of each step; do **not** interpolate from the physics `previousPosition`, which teleports, the fall/slide snap and the 0.1 x snap rewrite.
- Snap (no interpolation) on spawn, removal, level start, restart and camera cuts; interpolate the underlying position and apply mirroring at draw time (mirroring moves the clip by `particle.width`, which must not be interpolated).
- Walking microbes move 10 px per step by teleport; interpolating that is smoother than Flash but keeps the same speed and turn timing.
- Timeline frames are drawn from the frame clock (no interpolation between frames).

### 12.5 Porting checklist for new platformer content

1. Level JSON from `tools/convert-levels.mjs`; entity boxes from `palette` (frame-1 sizes); the speed cap computed per level from the non-exempt boxes exactly as `createBoxParticle` does (3.5).
2. Timelines for every new clip from `tools/extract-timelines.mjs` (labels, frame scripts, bounds), with the `steve_idle` / `fall` / `condifent` label quirks.
3. Atlases rendered from the SWF (`tools/swf-sheet`), branding checked.
4. A reactive bot per level (`web/tests/bots/platform-bot.mjs`) that pushes Lucy into milk, keeps bombs on screen in L10 and never loses a no-slack target.

### 12.6 Pending Ruffle verification

The Ruffle survey ([R]) settled several points (below). Ruffle ran at about half speed under SwiftShader, so measured durations are not usable as values. Still open:

- Flash Player's own `setInterval(15)` cadence in a 25 fps movie (Ruffle: median 64 calls/s, consistent with 15 ms).
- Per-level speed caps (21.16 / 23.98 / 25 px/step), run acceleration and the 99.8 px jump apex.
- Frame-script ordering within a tick (`midAnimation` and `shoot` gates; the port pins durations with unit tests).
- Patty and Slarg box sizes; microbes' live `_width` during walk animations. The two figures come from two bounds methods: `swf-inventory.json` `boundsFrame1` (203.32 x 150.39, 90.57 x 225.48; nested clips followed to their frame-1 playheads, masks not applied, `tools/analyse-swfs.mjs:760-766`) and `levels.json` (187.89 x 141.53, 90.37 wide; "union of frame-1 child bounds, mask layers excluded", `tools/analyse-levels.mjs:728`). The box is sized straight after `attachMovie` and before the microbe constructor's `gotoAndPlay("idle")` (`attachMovie` at `PlatformGame.as:419`, `createBoxParticle` at `:427`, `new GoodMicrobe` at `:432`), so frame 1 is the right frame; which method matches Flash's `_width` needs a runtime read of `clip._width`.
- Settled from the SWF frame scripts (section 3.13): Harry's `take_photo` `midAnimation` span is 15 frames and Amy's 7 ([PD] was right, [P §3.6]'s 34 ignores the frame-144 and frame-163 jumps).
- The game-show avatar mapping when Amy is chosen (inferred: Harry animated as the player; not confirmed by the captures, `502`). The shrinking zone does use the chosen child.
- Settled by Ruffle: the `showRoundText` busy path (a second click on the last intro line, 6.4); the ending click does nothing (2.1); the talkie arrow shows while typing (6.4); the time-out summary replays the intro and shows "-1" (2.6); shared `FoodItem` state across twins and levels (5.13); the shrink uses the chosen child (2.5); the platform clock runs 181 ticks (188.7 s measured, including the first tick and slow polling).
- The shrinking zone measured shorter than 149 frames in Ruffle (4.4-5.6 s; unexplained): keep the source value.
- Portal-open visuals (children of the one-frame `portal_exit_icon`).
- Already verified against captures: the avatar's live width for photo placement (`reference/captures/ruffle-level1-photo-standing.png`, `ruffle-level1-photo-riding-right.png`), tiles drawn over level entities (`ruffle-level1-portal-closed-tile-over-portal.png`), the level 1 opening layout and HUD (`ruffle-level1-opening.png`) and intro page 2 (`ruffle-level1-intro-page2.png`).

---

## 13. Verification log

A completeness check of this file against the primary sources, done on 2026-09-26 after the first draft. Each row is one claim as the notes state it, the source read to check it (paths as in 1.2), and the result: **Confirmed** (no change), **Corrected** (the notes were changed; the new text is in the section named), **Added** (a gap filled), or **Open** (not decidable from the source; listed in 12.6 or 11.3). The coverage check of every file in `src/` and `levels/` is section 1.4.

| # | Section | Claim checked | Source read | Result |
|---|---|---|---|---|
| 1 | 3.1 | Gravity (0, 3000), drag 0.95, `ParticleSystem(30, 1, ...)` giving `timeInterval = 30/1000`, 1 iteration | `PlatformGame.as:150-153`; `ParticleSystem.as:153-158` | Confirmed |
| 2 | 3.1, 3.8 | Move force `gravity.y * 1.5` (4500), `jumpForce = gravity.y * 8`, jump adds `-3 * jumpForce`, box forced 49 x 100, `lives = 3`, `maxJumps` from `MAX_JUMPS` | `PlatformGame.as:380-397`; `PlayerEntity.as:110-125,416` | Confirmed |
| 3 | 3.1, 3.23 | `MAX_JUMPS = 2`, `JUMP_COUNT = 5` unused, scroll margins right 450, left 250 | `PlatformGame.as:44-45,51-52` | Confirmed |
| 4 | 3.3, 12.1 | `secondsLeft = 180`; tick when `getTimer() - secondsTimer >= 1000`; game over only once `secondsLeft < 0` (181 decrements) | `PlatformGame.as:148,558-569` | Confirmed |
| 5 | 3.5, 3.6, 4.3 | `maxChange` test `ceil(w/2) < maxChange` but assignment `w/2`; static lookup grid 9 x 16 from the default world bounds; static anchors indexed at `position/50` | `ParticleSystem.as:153-181,187-239` | Confirmed |
| 6 | 3.2 | "11-13, 15-20 belong to the game show" | `Constants.as:15-18,63-91`; grep of `Constants.STATE_` over `src/` | **Corrected**: the game show uses 13, 16, 20 (and 0, 1, 2, 8); 11, 15, 17, 18, 998 are never used; 7, 12, 995, 996, 999 only in `LevelEditor.as` / `FridgeGame.as`. Added the unused `Constants.LEFT/RIGHT` (0/2) versus `GameEntity.LEFT/RIGHT` (-1/+1) |
| 7 | 3.14 | Antibiotic victims (Lucy, Sandy, Steve, Slurm, Slarg, Colin, on screen only), -10 / +15, +30 and BE_HURT for an on-screen superinfection, `goal.updateGoal(e).pop()`, whiteout 100 | `PlatformGame.as:822-885` | Confirmed |
| 8 | 3.14 | `kill()` plays `be_killed` and sets BE_KILLED but emits no event (so no points, no KILL_ALL count) | `GameEntity.as:504-511` | Confirmed |
| 9 | 3.21, 3.26 | +7 pickup, +3 bullet branch dead (tests `GAME_ENTITY_BAD_MICROBE = 5`, which no entity gets), BE_KILLED +5 bad / -10 otherwise (player death included), BE_PHOTOGRAPHED +5 good / +15 otherwise, yoghurt +50 | `PlatformGame.as:647-669,932-990`; `Constants.as:34,48-52` | Confirmed |
| 10 | 3.20 | Goal types 0-7; `isGoalMet` uses `==`; PHOTOGRAPH_GOOD also counts good deaths; second `case KILL_ALL` unreachable; types 2 and 5 do nothing | `Goal.as:15-22,35-41,43-168` | Confirmed |
| 11 | 3.24 | CREATE_GUI: no Patty branch; the `else` (KILL_ALL) always draws `slurm_image` + `kill_icon`; `required` boxes set to `empty`. Hearts hidden from `heart0` up | `PlatformGame.as:331-362,598-601` | Confirmed |
| 12 | 3.3 | Goals met and portal CLOSED: `level.goals.pop()`, `exit_status`, PORTAL_EVENT_OPEN | `PlatformGame.as:575-593` | Confirmed |
| 13 | 3.19 | Portal checks entry every 10 advances (`thinkTime = defaultThinkTime*2`), top-left distance < 100, then `hitTest` | `PortalEntity.as:29-47` | Confirmed |
| 14 | 3.19 | Ammo pickup: `hitTest` in `advance`, act does REMOVE, `ammo++`, `infiniteAmmo = true` at `maxAmmo`; `WhitePickup` identical to `SoapPickup` | `SoapPickup.as`, `WhitePickup.as` (diff: traces only) | Confirmed |
| 15 | 3.1, 3.12-3.18 | Bullet `thinkTime = defaultThinkTime = 3`, `deadTimer = 15`; flash `_alpha -= 10`; bomb `minimumSpeedTrigger = 2`, `explodeSeconds = 2000`; superinfection `lives = 6`; milk `counterCeiling = 1`; microbes `speed = 10`, `lives = 1`, `slideTimer = 10`; `defaultThinkTime = 5` | `BulletEntity.as:34,47`; `CameraFlashEntity.as:73`; `AntibioticBombEntity.as:31-33`; `SuperInfection.as:26`; `MilkGlassEntity.as:24`; `GoodMicrobe.as:24-35`; `BadMicrobe.as:28-39`; `GameEntity.as:48` | Confirmed |
| 16 | 3.13, 12.6 | Photo animation span "137-170 (1.36 s)" [P] versus "15 / 7 frames" [PD] | `movies/harry.swf` sprite 193 and `movies/amy.swf` sprite 208 frame scripts (`swf-inventory.json`) | **Corrected** (resolved): 15 frames Harry, 7 frames Amy; [P]'s figure ignores the frame-144 and frame-163 jumps. **Added**: Amy's photo pose loops frames 155-162 until another upper animation is requested; cooldown detail |
| 17 | 4.1 | All 11 levels: `cols`, `rows`, `next`, `name`, `body_level`, goal triple | `levels/alpha_level1.xml` .. `alpha_level11.xml` line 1-2 | Confirmed (every cell of those columns) |
| 18 | 4.1, 4.2 | Targets placed and slack, player start, portal, milk and superinfection cells | the same XML parsed through `levels/tile_definitions.xml` ids 93-112 | Confirmed (L1-L4 3 targets each; L5 4 Slurm + Steve + 15 soap; L6 2 Slurm, Slarg, Donna, 17 soap; L7 3 Iggy, 21 white; L8 1 milk (4,17), 4 Lucy; L9 3 milk (4,2) (4,28) (4,50), 6 Lucy; L10 6 antibiotics, superinfection (5,25), Slurm, Iggy, Lucy; L11 2 Iggy, 2 Slurm, Donna, Steve, 8 white, 5 antibiotics) |
| 19 | 3.16, 4.4 | Frame-1 box sizes of the 13 entity symbols | `swf-inventory.json` `boundsFrame1` for `introductionToMicrobes_platformer.swf` | Confirmed for the values used; Patty and Slarg alternatives traced to a different bounds method (12.6). **Open**: which one Flash's `_width` returns |
| 20 | 3.22 | Tile definitions: 93 Lucy ... 111 player start, 112 antibiotic pickup, 113 eraser (last); labels `Patty Pennicillium`, `Slurm Staphyloccocus`, `Slarg Staphyloccus`; 108 has no icon | `levels/tile_definitions.xml` | Confirmed |
| 21 | 2.2 | Start levels pushed `alpha_level1/5/8`, `NULL_KITCHEN_GAME`, `alpha_level10`; kitchen found by `round == 2`; `round++` only from the second platform round | `GameController.as:65-69,206-263` | Confirmed (traced: round 1 index 0 via `hoverboardHolder.play()`, round 2 index 1, round 3 index 2, round 4 `round == 2` so kitchen and `round = 3`, round 5 index 4) |
| 22 | 2.6 | Summary texts "You Died!" / "You ran out of time." / "click to try again"; restart = `roundStartLevel` | `GameController.as:265-308`; `PlatformGame.as:187-192` | Confirmed |
| 23 | 2.1, 6.6 | Ending lines; tie counts as a loss (`player.score > cpu.score`) | `GameShow.as:451-459` | Confirmed |
| 24 | 2.1 | Win line always says "Amy" | `GameShow.as:73,453`; `Player.as:28-42` | **Corrected** (reason): it comes from `cpu.nickname`, which `new Player()` defaults to "Amy", independent of `cpuName` and of the preload bug |
| 25 | 6.5, 6.6 | Sighted: correct +10 to the player, wrong `Math.floor(score / 2)` to the CPU, don't know nothing; CPU picks `Math.floor(Math.random() * 3)`; after the last question `nextRound()` runs at once | `GameShow.as:245-300,304-329` | Confirmed |
| 26 | 6.1, 2.8 | Constructor at preload takes the male branch: player Harry (right podium), CPU Amy (middle), `cpuName = "Amy"`; `playerAnswers` writes fail | `GameShow.as:51-118,205-273`; `Player.as:40` | Confirmed from code (runtime mapping with Amy chosen still **Open**, 12.6) |
| 27 | 6.3, 6.8 | Quiz files: 4, 4, 2, 5, 6 questions (21), every `score` 10, answer values per button, `next_round` chain, correct answers in both English sets | `levels/alpha_gameshow_round1-5.xml`; `Assets/Resources/TextFiles/quiz/en_en_gameshow_round1-5.xml` | Confirmed (all 21 rows of the 6.8 table) |
| 28 | 6.4 | Talkie types one character per frame (`speed = 1`); first click completes, second advances | `Talkie.as:26,62-77,85-99` | Confirmed |
| 29 | 2.4 | Build A conversation has 9 statements (line 3 "Excellent!", line 8 "Allright, Lets begin ..."), live has 10 (line 3 empty); `choose_avatar = 3`, `get_details = 5`, `finished = 9`; the form labels consume lines 5-7 | `levels/conversations/en_en_introductions.xml`; `Assets/Resources/TextFiles/conversations/en_en_introductions.xml`; `movies/cutscene_introduction.swf` root frames 1-30 (`swf-scripts/cutscene_introduction.txt:21-49,109-114`) | Confirmed |
| 30 | 2.5 | Shrink clips: frame 1 `midAnimation = true` and stop, frame 150 `midAnimation = false`; Amy's frame 150 calls `forceReassignAvatar(this._parent)`; Harry's frame 1 `_alpha -= 50` | `ShrinkingZone.as:14-82`; `swf-scripts/shrinking_amy.txt`, `shrinking_harry.txt` | Confirmed |
| 31 | 5.2 | Kitchen times 60 / 60 / 60 / 120 s; `sneezeChance = 7` from level 1; category `high` 1 / 3 / 6 / 6; 10 / 10 / 10 / 20 items | `KitchenGame.as:844-860,906-1075` | Confirmed |
| 32 | 5.3 | 26 food entries, types, initial flags, category arrays | `KitchenGame.as:1234-1325`; `FoodItem.as:12-31` | Confirmed |
| 33 | 5.5, 5.7 | Tick `getTimer() - timer > 1000` every 40 ms; clock shows 99 at time-out; sneeze roll `getRandom(0, 10) > sneezeChance` giving 1/4, 3/20, 1/20, 0 | `KitchenGame.as:144-191`; `GeneralFunctions.as:3-4` | Confirmed |
| 34 | 5.9 | Net kitchen score `10 x (correct - incorrect)`, summed as the outro pages are shown | `KitchenGame.as:193-312` | Confirmed. A suspected `NaN` total for categories with no placed item was checked and ruled out: `calculateScores` zero-fills `levelScores[0..9]` (`:527-533`), as capture `133-kitchen-l0-outro1.png` shows |
| 35 | 2.8, 5.12 | Kitchen avatar always Harry (throwaway `new Player()`, `avatarSex` undefined) | `KitchenGame.as:1105-1109`; `Player.as:35` | Confirmed |
| 36 | 3.24, 7.4 | `level_intros` labels 1, 40, 50, 70, 90, 110, 140, 190, 221, 241; pages per level 7, 2, 2, 2, 2, 3, 4, 3, 2, 6 | `swf-inventory.json` sprite 1479 (stop frames and `finished = true` frames 39, 49, 69, 89, 109, 139, 180, 220, 240, 300) | Confirmed; frames 301-421 are never reached |
| 37 | 4.2 | L11 intro behaviour | `EPhone.as:16-23`; `flash-ruffle.md:125` | **Added** (missing label keeps the current page) |
| 38 | 3.27 | Documentation says L1 goalType 3, idle think 10, +3 bullet bonus, always NOT_BLIND | `doc:280`, `doc:1183`, `doc:1234`, `doc:1727` | Confirmed (the doc says so; the code wins as stated) |
| 39 | 1.1 | "The shipped platformer SWF was built from this source" | decompiled `movies/e-Bug Junior Game.swf` (the copy that runs) | **Added**: the running copy has the `_root.fps.text = fps` line active (as in `.bak2`) with the `.as` level path (1.4) |
| 40 | 1.4 | Every file in `src/` (136 files) and `levels/` (56 files) accounted for | directory listings; grep of each file name in this file | **Added** section 1.4 (before it, about 95 `src/` files (the 50 colour-swap files, 13 `ebug` classes such as `SuperBug.as`, `CutSceneController.as`, `FridgeGame.as`, and the APE library with its demos) and about 30 `levels/` files (the legacy levels, format sketches, `plan.txt`, `tilesformat.xml`, `gameshow_round1_questions.xml`) were not named anywhere) |
| 41 | 8.2 | Every screen's art has a source | 2.1 screen list | **Added** rows for the loader (text only), the whiteout and the new port UI |
| 42 | 8.5 | Sound table matches the port code | `web/js/core/audio.js:135-172`; `web/js/platformer/platformScene.js:366-469,609` | **Corrected**: splat sounds are `bubblePop` (soap) / `squelch` (white); `splat` is the contact kill; `goal`/`portal` unused; `lowTime` fires at 10 s, not 20. **Added** the list of events with no sound |

Remaining items that need a person or a decision (beyond 11.3, which stands):

1. Patty and Slarg box sizes (row 19): a runtime read of `clip._width` after `attachMovie` in Ruffle or Flash decides 203.32 versus 187.89 (Patty) and 90.57 versus 90.37 (Slarg); it changes L4 collisions only.
2. `lowTime` at 10 s versus the red clock at 20 s (row 42): pick one threshold for both.
3. Sounds for the events listed under 8.5 ("Events with no sound assigned yet").
4. Amy's looping photo pose (row 16): keep (faithful, cosmetic) or return her to `move` when `midAnimation` clears.
5. The two places where this file overrides the engine log (header: the +3 bullet bonus and the L4/L7 portraits) still need `web/NOTES-platformer-decisions.md` and `web/js/platformer/game.js` updated to match.
