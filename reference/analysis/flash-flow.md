# Flash original: game flow, game show quiz, cutscene, shrinking zone, kitchen game, summary pages and translations

Scope: everything in the 2009 Flash e-Bug Junior Game ("Super Microbe World") outside the platform game itself: the controller that strings the screens together, the game show quiz, the introduction cutscene, the shrinking zone, the kitchen (food sorting) game, the summary and outro pages, research data submission and translations. The platform game is covered elsewhere; only its entry and exit contract is described here.

## 0. Sources, builds and method

### 0.1 Citation conventions

- `src/...`, `levels/...`, `movies/...` are relative to `reference/Junior_Game/`.
- `doc:N` is `reference/docs/junior-game-documentation.md` line N. `eval:N` is `reference/docs/farrell-2011-evaluation.md` line N.
- `Assets/...` is the Unity remake. `unity-logic.md` is `reference/analysis/unity-logic.md`.
- SWF timeline code is cited as `movies/<file>.swf` plus sprite id, frame number and frame label. It was read with `reference/analysis/tools/avm1-dump.mjs` (a small AVM1 pseudo-decompiler written for this analysis; run `node reference/analysis/tools/avm1-dump.mjs reference/Junior_Game/movies/<file>.swf --text`). In its output `rN` are registers: inside AS2 class methods `r1` is `this`; inside timeline functions the preloaded registers are usually `_root` or `_parent` (checked from the DefineFunction2 flags where it mattered).
- "Ruffle" means an observation made by running the original SWF in Ruffle 0.6.0 (`node_modules/@ruffle-rs/ruffle`, harness `tools/ruffle/harness.html`).

### 0.2 Two builds exist; never blur them

| | Build A: in this repo (2009 evaluation build) | Build B: the later live build |
|---|---|---|
| Where | `src/`, `levels/`, `movies/` (main SWF dated 2009-07-03, HTML wrappers 2009-07-08, `reference/inventory.json`) | Only described in the documentation (`doc:418-704`, `doc:1594-2118`). Its code and SWFs are **not** in the repo. |
| Blind question round | Present. Every round is "blind" first (`src/ebug/junior/GameShowRound.as:21` `isBlind = true`) | Removed (`doc:156`, `doc:582-592`, `doc:704`, `doc:1727`; `eval:36`) |
| Language | English only, hard-coded strings; quiz files `levels/alpha_gameshow_roundN.xml`; conversation `levels/conversations/en_en_introductions.xml` | `language` flashvar, `Translations.as` (184 strings, `doc:1927`), files `<lang>_gameshow_roundN.xml` (`doc:41`) |
| `GameController` constructor | `(theRoot, theStage)` (`src/ebug/junior/GameController.as:40`) | `(theRoot, theStage, language)` plus `System.security.allowDomain` and asset path `"../movies/"` (`doc:424-446`) |

Evidence that build A is exactly the build used in the May to August 2009 evaluation: the questions in `eval:101-121` (Table 2) are word for word the `levels/alpha_gameshow_round*.xml` questions (for example round 4 "Raw meat should go on the top shelf of the fridge", which the live `en_en` set rewrote), and the paper describes the pre-level "blind round" (`eval:36`).

Build A is therefore the canonical behaviour to port, with build B consulted for what changed afterwards (section 1.9).

### 0.3 Compiled code versus source

- AS2 classes are compiled into every SWF that uses them, and the first SWF to register a class wins (`if (!_global.ebug.junior.GameShow) ...` guard in each DoInitAction). The main SWF `movies/e-Bug Junior Game.swf` registers `GameController`, `Player`, `GameShow`, `ShrinkingZone`, `Talkie`, `GameShowRound`, `Question`, `GameShowQuestionLoader`, `Answer`, `Constants`, the platform game classes and `ebug.util.AssetLibrary` first, so its copies are what runs.
- Its compiled `GameController`, `GameShow` and `Talkie` match `src/` (same strings, constants and control flow). `movies/KitchenGame.swf` was built two seconds after `src/ebug/junior/fridge/KitchenGame.as` was saved (2009-06-01 09:23:08 and 09:23:10) and matches it.
- `ebug.util.AssetLibrary` has **no source file** in `src/` (imported by `src/ebug/junior/GameController.as:4`); it exists only compiled, in `movies/e-Bug Junior Game.swf` DoInitAction sprite 103 and `movies/KitchenGame.swf` sprite 9. Its behaviour is in section 1.1.
- `src/ebug/EBugStrings.as` is an unused 2008 prototype string table (no reference to it in any `.as` file or SWF).
- `src/ebug/FridgeGame.as` and `src/ebug/junior/fridge/FridgeMain.as` are older prototypes of the food game (`movies/fridge_game.swf`), not used by the junior game.

## 1. Screen-by-screen flow (build A)

### 1.1 Boot and preload

1. The page embeds `movies/e-Bug Junior Game.swf` (section 7.2). Stage 800x450, 25 fps, SWF 8 (header of `movies/e-Bug Junior Game.swf`).
2. Root frame 1 (label `init`) of the main SWF declares the hook functions that every sub-movie calls through `_root` (`newGame`, `startQuizShow`, `showHoverboardOrKitchen`, `getPlayer`, `setGameShow`, `registerHoverboard`, `endofHoverboard`, `endOfKitchen`, `restartHoverboardRound`, `submitPlayerData`), then `stop(); var gameController = new ebug.junior.GameController(this, this.gameScreen); gameController.init();` (`movies/e-Bug Junior Game.swf` root frame 1). Stage clips: `gameScreen` (empty container), `loader` (texts `loading_text` "Loading..." and `percentage_text` "xx%"), and a red `fps` text "FPS" which is **left visible** in this build (seen in Ruffle).
3. `GameController.init()` (`src/ebug/junior/GameController.as:63-97`) records the round start levels (section 1.4), creates six empty holder clips, sets the loading text to `"loading..."` and asks `AssetLibrary` to load, in order: `junior_game_assets.swf`, `splash.swf`, `eBugGameShow.swf`, `introductionToMicrobes_mainMenu.swf`, `cutscene_introduction.swf`, `introductionToMicrobes_platformer.swf`, `harry.swf`, `amy.swf`, `summary_page.swf`, `KitchenGame.swf`.
4. `AssetLibrary` (compiled only; main SWF sprite 103) loads the list **one file at a time** with a `MovieClipLoader` into new child clips of `gameScreen` named after the file without its extension. While loading it hides `gameScreen`, shows `"<loadingWord>: <name>"` (the word is `"Looding"`, a typo passed at `src/ebug/junior/GameController.as:60`) and `Math.ceil(assetsLoaded * (1 / n * 100)) + " %"`. Each loaded clip gets `_alpha = 0; _visible = false` in `onLoadComplete`. When all are loaded it calls `GameController.assetsLoaded()`.
5. `assetsLoaded()` (`src/ebug/junior/GameController.as:99-113`) swaps the holder variables for the loaded clips, hides the loader, shows `gameScreen` and the splash.
6. `introductionToMicrobes_mainMenu.swf` is loaded but never used (it only contains Macromedia UI component classes; no `GameController` reference to `assets["introductionToMicrobes_mainMenu"]`).

**Side effects of preloading (as built, confirmed by Ruffle traces).** Each sub-SWF runs its frame 1 as soon as it loads, while hidden:
- `eBugGameShow.swf` places its `game_show` instance on frame 1, so the `GameShow` constructor runs during preload, before a player exists. It starts its 40 ms loop, waits for the two shrinking-zone SWFs, loads `levels/alpha_gameshow_round1.xml` and types the first blind intro statement into the (hidden) talkie. Ruffle trace at 1.3 s: `an amy:avatar and it is + _level0.gameScreen.eBugGameShow.game_show.sz.harry`. Consequence: section 2.11.
- `cutscene_introduction.swf` loads its XML and shows statement 0 (Ruffle trace `next line: 0` at 1.5 s).
- `KitchenGame.swf` frame 1 runs `var kitchenGame = new ebug.junior.fridge.KitchenGame(this, container, new ebug.Player()); kitchenGame.init();` (`movies/KitchenGame.swf` root frame 1), which loads its six SWFs, picks the level 0 food list and shows level 0 intro screen 1, all hidden (Ruffle trace `Starting Level: 0` followed by the ten random items at 2.2 s).
- `introductionToMicrobes_platformer.swf` frame 1 calls `_root.registerHoverboard(game)` and stops.

A port should build these screens lazily; nothing here is gameplay.

### 1.2 Splash

`movies/splash.swf`: an animated TV (sprite 58, 170 frames = 6.8 s) showing the e-Bug logo in front of the game show studio; a "Tuning" text is part of the animation. The `NewGame` button (exported `button_new_game`, label "New Game") appears at sprite 58 frame 150 (6.0 s) and frame 170 does `stop(); NewGame.onRelease = function () { _root.newGame(); }`. Note the animation starts when the SWF finishes loading, so on a fast connection it may have finished before the splash is revealed.

`GameController.newGame()` (`src/ebug/junior/GameController.as:118-129`): `player = new Player(); player.forename = "david";` (debug leftover; `forename` is never shown), unload the splash, show the cutscene.

### 1.3 Cutscene introduction

Host speech, avatar choice and personal details form; section 3. It ends with `_root.startQuizShow()`.

### 1.4 Round structure

`GameController.startQuizShow()` (`src/ebug/junior/GameController.as:131-160`) sets `player.id = timestamp()`, submits the ID form (section 6.3), unloads the cutscene, sets `gameShow.player = player`, shows the game show and calls `gameshowHolder.play()`. From here the game is five rounds. Each round is **quiz (blind) then action then quiz (sighted)**:

| Round | Quiz file (build A) | `round_id` | Topic (`<name>`) | Questions | Action | `GameController.round` at action start | Start level / chain via `next=` |
|---|---|---|---|---|---|---|---|
| 1 | `levels/alpha_gameshow_round1.xml` | 0 | All About Microbes | 4 | platform | 0 (first time: `hoverboardHolder.play()`) | `alpha_level1` -> `alpha_level2` -> `alpha_level3` -> `alpha_level4` -> `exit` |
| 2 | `levels/alpha_gameshow_round2.xml` | 1 | Good and Bad Bugs | 4 | platform | 1 | `alpha_level5` -> `alpha_level6` -> `alpha_level7` -> `exit` |
| 3 | `levels/alpha_gameshow_round3.xml` | 2 | Good Microbes | 2 | platform | 2 | `alpha_level8` -> `alpha_level9` -> `exit` |
| 4 | `levels/alpha_gameshow_round4.xml` | 3 | Food Hygiene | 5 | kitchen game (4 sub-levels) | 3 (`NULL_KITCHEN_GAME`) | none |
| 5 | `levels/alpha_gameshow_round5.xml` | 4 | Treatment of infection | 6 | platform | 4 | `alpha_level10` -> `exit` |

- Start levels: `src/ebug/junior/GameController.as:65-69` pushes `"alpha_level1.xml"`, `"alpha_level5.xml"`, `"alpha_level8.xml"`, `"NULL_KITCHEN_GAME"`, `"alpha_level10.xml"`. The sentinel string is never loaded; the kitchen is chosen by the `round == 2` test below.
- Chains: the `next` attribute of each `<level>` (`levels/alpha_level1.xml` to `alpha_level10.xml`, first line). `next="exit"` makes the platform game call `_root.endofHoverboard(END_REASON_COMPLETE)` (`src/ebug/junior/PlatformGame.as:1231-1242`); any other value loads that level (`:1245`).
- `levels/alpha_level11.xml` (`next="exit"`, goalType 4) is not reachable from any chain.
- The first platform round does not actually use `gameStructure.hoverboardLevels[0]`: the platformer's frame 10 calls `game.initialiseGame(player, level, ...)` with its timeline variable `level` never set, so `PlatformGame.initialiseGame` falls back to its default `"alpha_level1.xml"` (`src/ebug/junior/PlatformGame.as:133`). Same result, different mechanism.
- Round topics match the evaluation's level names: "Introduction to Microbes", "Harmful Microbes", "Useful Microbes", "Hygiene", "Antibiotics" (`eval:85-89`).

### 1.5 One round, step by step (build A)

1. **Blind intro**: host lines from `<intro_text><blind>` one at a time in the talkie (section 2.4).
2. **Blind questions**: for each question, host says `"Question number " + (id+1) + ": " + text + "..."`, click shows the board, the player answers, host echoes the choice plus the blind notice; no score, no CPU turn (section 2.6).
3. After the last blind answer the host says **"Step right this way and prepare to enter the world of microbes!"** (`src/ebug/junior/GameShow.as:289`). Click: **shrinking zone** (section 4).
4. When the shrink animation ends `ShrinkingZone.isFinishedAnimation` calls `_root.showHoverboardOrKitchen()` (`src/ebug/junior/ShrinkingZone.as:57-62`):
   ```
   // should be round ==3 but round is being incremented inside hoverboard thing
   if ( round == 2 ) { round++; showKitchen(); } else { showHoverboard(); }
   ```
   (`src/ebug/junior/GameController.as:206-216`). `showHoverboard()` stops the game show loop, hides it, shows the platformer and calls `nextHoverboardRound()`, which the first time just plays the platformer and afterwards does `round++` then `initialiseGame(player, hoverboardLevels[round], ...)` and restarts the 15 ms loop (`:238-263`). Trace of `round`: shrink 1 sees 0 (platform, stays 0), shrink 2 sees 0 (platform, becomes 1), shrink 3 sees 1 (platform, becomes 2), shrink 4 sees 2 (kitchen, becomes 3), shrink 5 sees 3 (platform, becomes 4, level 10).
5. **Action**:
   - Platform: 180 s per level (`src/ebug/junior/PlatformGame.as:148`), 3 lives. On death or time-out `endofHoverboard` shows the summary page ("You Died!" or "You ran out of time." and "click to try again"; section 6.1). Clicking it calls `restartHoverboardRound()` which calls `PlatformGame.restartRound()` = `initialiseGame(roundStartPlayer, roundStartLevel, ...)` (`src/ebug/junior/PlatformGame.as:187-191`), i.e. the player restarts from the **first level of the round**, not the level they died on.
   - Kitchen: section 5. No fail state.
6. **Sighted intro**: on completion `endofHoverboard` (or `endOfKitchen`) shows the game show and calls `gameShow.startNonBlindRound()` (`src/ebug/junior/GameController.as:273-281`, `:300-307`), which sets `isBlind = false`, rewinds `questionIndex` and `statementCounter` and restarts the loop (`src/ebug/junior/GameShow.as:421-439`). Host reads `<intro_text><normal>`.
7. **Sighted questions**: the same questions again, now scored, each followed by a CPU turn (sections 2.6, 2.7), except the last question (next step).
8. After the last sighted answer `receiveAnswer` calls `nextRound()` **immediately**: no host feedback and no CPU turn for that question (`src/ebug/junior/GameShow.as:293-298`). `nextRound()` submits the round's answers (section 6.3) and either loads `"../levels/" + next_round` and starts the next blind intro (`:460-475`) or, when `next_round` is `exit`, ends the game.

### 1.6 Ending

`GameShow.nextRound()` with `nextRoundFile == "exit"` (`src/ebug/junior/GameShow.as:451-459`):
- `player.score > cpu.score`: host says `"Well done! You beat " + cpu.nickname + ".  Thank you for playing.  To play again, reload this web page."`. `cpu` is `new Player()` with no arguments, whose `forename` defaults to `"Amy"` because `inSex` is undefined (`src/ebug/Player.as:30-32`), so the line always reads "You beat Amy".
- otherwise (including a **tie**): `"At the end of the game, I'm sorry to say you lost.  Thank you for playing.  To play again, reload this web page."`
- Click: `GameShow.exit()` -> `_root.exit()` -> `GameController.exit()` -> `theRoot.gotoAndPlay("init")` (`src/ebug/junior/GameController.as:325-328`). This re-runs root frame 1, building a second `GameController` and reloading every asset on top of the old clips. It is effectively broken, hence the "reload this web page" wording. There is no winner screen in Flash; the Unity remake added one (`unity-logic.md` section 6, "Final screen").
- Only quiz points take part: kitchen points go to a throwaway `Player` (section 5.12) and the platform score is a separate `PlatformGame.score` never copied to the player.

### 1.7 Flow diagram (build A)

```
Preload (10 SWFs) -> Splash [New Game]
 -> Cutscene: 3 host lines -> choose Amy/Harry -> 1 host line -> details form -> 1 host line
 -> ID form submitted
 -> for round r = 1..5:
      blind intro lines -> blind questions (no scoring) -> "Step right this way..."
      -> shrinking zone (6 s)
      -> r in {1,2,3,5}: platform level chain (die/time-out -> summary page -> restart chain)
         r = 4: kitchen levels 0..3 (intro, play, 3 outro pages each)
      -> sighted intro lines -> sighted questions with CPU turns (last question: no feedback)
      -> Round_r form submitted
 -> final host line (win if player > CPU, else loss) -> click -> broken restart
```

### 1.8 What the port should keep and what it may fix

Keep: the five-round structure, the blind-then-sighted pattern (the evaluation build had it), the chains, restart-from-round-start, the host lines. Candidate fixes, each a port decision: give the last question of each round its feedback and CPU turn (build B did, section 1.9), a proper restart instead of `gotoAndPlay("init")`, and avatar mapping (section 2.11).

### 1.9 Build B (live) flow and differences

The live build is only known from the documentation:

| Point | Build A (repo) | Build B (live), per documentation |
|---|---|---|
| After the cutscene | `gameshowHolder.play()`; blind round 1 starts (`src/ebug/junior/GameController.as:153-156`) | Still plays the show but immediately re-initialises the talkie with `STRING_STEP_RIGHT_THIS_WAY` and callback `showShrinkingZone`, so the player goes straight to the shrink (`doc:582-592`) |
| After a platform round | `gameShow.startNonBlindRound()` (`src/ebug/junior/GameController.as:306`) | `gameShow.nextRound()` with `//nomoreblind //gameShow.startNonBlindRound();` (`doc:650-658`) |
| After the kitchen | `gameShow.startNonBlindRound()` | Unchanged: `gameShow.startNonBlindRound()` (`doc:665-673`) |
| Blind flag | `isBlind = true` per new round | "For the purposes of the final release, the game is always NOT_BLIND" (`doc:1727`) |
| Last question of a round | `nextRound()` with no feedback | CPU turn through `pickCpuResponseSpecialCaseLastQuestion`, then `talkie.init(hostname, response, ..., "showShrinkingZone")` (`doc:1911-1915`) |
| Host strings | Hard-coded English | `Translations(_root.translations).getString(Translations.STRING_...)` (`doc:1854`, `doc:1871-1885`) |
| Data submission | Blind and sighted arrays | Same call; "an empty blind submission is still made" (`doc:704`); URLs dead after the HPA took the domain (`doc:2138`) |

Reconstructed live sequence: splash, cutscene, "Step right this way", shrink, platform round 1, then quiz round 1 (sighted only: normal intro "Well done, you're a hoverboard natural!", questions, CPU turns), last question leads straight to the shrink, platform round 2, quiz round 2, and so on. Every quiz follows the action it tests, matching `eval:36` ("In the final version ... the 'blind round' has been removed").

**Unresolved**: the documentation shows `endofHoverboard` calling `nextRound()` (which in build A submits the current round and loads the *next* file) but `endOfKitchen` still calling `startNonBlindRound()` (which replays whatever round is loaded). Under build A semantics that would replay the round 3 questions after the kitchen and push Food Hygiene after the last platform round. The live `nextRound` must have changed in ways the documentation does not show. **Port decision**: after the kitchen, ask round 4 (Food Hygiene, `round_id` 3), and after each action ask the questions of that same round; this is what the evaluation (`eval:44-72`, Figure 1) and the round/topic pairing require.

## 2. Game show quiz

### 2.1 Question file schema and parsing

```xml
<?xml version="1.0" encoding="utf-8" ?>
<round id="0">                        <!-- attribute ignored -->
  <name>All About Microbes</name>     <!-- child 0: parsed, never shown (doc:152) -->
  <round_id>0</round_id>              <!-- child 1: 0-based, used for data submission -->
  <next_round>alpha_gameshow_round2.xml</next_round>  <!-- child 2: file name relative to levels/, or "exit" -->
  <intro_text>                        <!-- child 3 -->
    <blind><statement>...</statement> ... </blind>     <!-- child 0: blind intro lines -->
    <normal><statement>...</statement> ... </normal>   <!-- child 1: sighted intro lines -->
  </intro_text>
  <questions>                         <!-- child 4 -->
    <question id="0">                 <!-- id attribute = questionId, used for "Question N" (id+1) and answer storage -->
      <type>0</type>                  <!-- always 0 (QUESTION_TYPE_YND), unused -->
      <score>10</score>               <!-- points for a correct answer; floor(score/2) to the other side on a wrong one -->
      <value>1</value>                <!-- research weighting, never used -->
      <text>If you cannot see a microbe it is not there</text>
      <answers>                       <!-- exactly 3, in button order: Agree, Don't Know, Disagree -->
        <answer><label>Agree</label><value>-1</value></answer>   <!-- 1 correct, 0 don't know, -1 wrong -->
        <answer><lable>Don't Know</lable><value>0</value></answer>
        <answer><lable>Disagree</lable><value>1</value></answer>
      </answers>
    </question>
  </questions>
</round>
```

- `GameShowQuestionLoader.parseRound()` reads **by child index**, never by tag name (`src/ebug/junior/GameShowQuestionLoader.as:46-103`; `XML.ignoreWhite = true` at `:17`). The typos `<statment>` (last blind line of rounds 1, 2, 3, 5) and `<lable>` are therefore harmless in Flash; the line "Lets go!" **is** shown. (They are not harmless in the Unity remake, `unity-logic.md` section 9.)
- `Answer.label` is parsed but never displayed: the board buttons have static text (section 2.5). Only `answers[i].value` matters, and `i` is the button index, so **answer order must be Agree, Don't Know, Disagree**.
- The loader polls `getBytesLoaded/getBytesTotal` every 40 ms (`:25`, `:31-44`); a missing file hangs the game silently.
- Answer value constants: `ANSWER_WRONG = -1`, `ANSWER_DUNNO = 0`, `ANSWER_CORRECT = 1` (`src/ebug/junior/Question.as:8-10`). Every question in every file has `score` 10.

### 2.2 Question content and correct answers

C = correct button. Build A (`levels/alpha_*`) versus the live English set (`Assets/Resources/TextFiles/quiz/en_en_gameshow_roundN.xml`); the 10 other languages have exactly the `en_en` answer values (checked by `tools/extract-translations.mjs`, section 7.4).

| Round, Q | Build A text | A: C | Live `en_en` text (if different) | Live: C |
|---|---|---|---|---|
| 1 Q1 | If you cannot see a microbe it is not there | Disagree | | Disagree |
| 1 Q2 | Bacteria and Viruses are the same | Disagree | | Disagree |
| 1 Q3 | Fungi are microbes | Agree | | Agree |
| 1 Q4 | Microbes are found on our hands | Agree | | Agree |
| 2 Q1 | All bacteria are harmful | Disagree | | Disagree |
| 2 Q2 | Soap can be used to wash away bad bugs | Agree | ...wash away harmful bugs | Agree |
| 2 Q3 | Most coughs and colds get better without medicine | Agree | | Agree |
| 2 Q4 | Our bodies have natural defenses that protect us against infection. | Agree | ...defences... | Agree |
| 3 Q1 | We use good microbes to make things like bread and yogurt | Agree | We use useful microbes... | Agree |
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

Intro lines, build A (verbatim, including typos; these are the `alpha` keys in `translations.json`):

| Round | Blind intro | Sighted intro |
|---|---|---|
| 1 | "Welcome to the first BLIND QUESTION ROUND!" / "I'm going to ask you some questions but I'm NOT going to tell you if you got them right!" / "If you got them right, you'll get a great bonus later though so try your best." / "Lets go!" | "Well done, you're a hoverboard natural!" / "Now it's time to ask you those questions again" / "This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points." / "so if you DON'T KNOW the answer, it's best to play it safe and say so!" / "Ready?" / "Let's go!" |
| 2 | "Welcome to the SECOND ROUND!" / "This time, we're going to see what you know about good and bad bugs." / "Remember, this is a BLIND QUESITON ROUND so you'll get a bonus later if you get these right." / "Lets go!" | "Nice one!" / "Let's see how you do on those questions again..." / "Remember, 10 points for a correct answer, but if you get it wrong, the other player gets the points." / "So if you DON'T KNOW the answer, it's best to play it safe and say so!" / "Ready?" / "Let's go!" |
| 3 | "Welcome to the THIRD ROUND!" / "This time, we're going to see what you know about good microbes." / (same "Remember, ... QUESITON ..." line) / "Lets go!" | "Yum Yogurt!" / then the same four lines as round 2 |
| 4 | "Welcome to the FOURTH  ROUND!" / "This time, we're going to see what you know about food." | "Let's see how you do on those questions again..." / then the same three closing lines as round 2 |
| 5 | "Welcome to the FINAL  ROUND!" / "This time, we're going to see what you know about how you get better from infections." / "Remember, this is a BLIND QUESTION ROUND so you'll get a bonus later if you get these right." / "Lets go!" | "Not bad.  Not bad at all..." / then the same four lines as round 2 |

The promised "great bonus later" for blind answers does not exist in the code. The live `en_en` intro lines are in `translations.json` (keys `quiz.roundN.blind.i`, `quiz.roundN.normal.i`); the live round 4 blind intro has a single line, "Welcome to the FOURTH round".

### 2.3 GameShow state machine

`GameShow` (`src/ebug/junior/GameShow.as`) is the class of the `game_show` instance in `movies/eBugGameShow.swf` (registered at DoInitAction sprite 900). Constructor (`:51-118`): attaches library clips `question_board` (hidden), `gameshow_set` ("studio"), `shrinking_zone` (hidden) and `talkie` at `_x = 20, _y = 308` (hidden); `cpu = new Player(); cpu.score = 0`; sets up avatars (section 2.11); `questionFile = "../levels/alpha_gameshow_round1.xml"`; `gameState = STATE_INIT`; starts `main` every **40 ms** (`:120-122`).

`main()` (`:483-513`) does nothing while `busy` is true, otherwise:

| State (value, `src/ebug/Constants.as`) | Action |
|---|---|
| `STATE_INIT` (0, `:63`) | `isZoneLoaded()`: when both shrinking SWFs have loaded, go to `STATE_LOAD_LEVEL` (`:124-128`) |
| `STATE_LOAD_LEVEL` (8, `:71`) | `busy = true; loadLevel()`: new `GameShowQuestionLoader` on `questionFile`, reset `statementCounter`, `roundAnswersBlind`, `roundAnswersSighted`, `busy = false`, go to `STATE_LEVEL_LOADING` (`:130-138`) |
| `STATE_LEVEL_LOADING` (1, `:64`) | when the loader is done, `currentRound = round`, go to `STATE_LEVEL_LOADED` (`:140-145`) |
| `STATE_LEVEL_LOADED` (2, `:65`) | go to `STATE_ROUND_TEXT` |
| `STATE_ROUND_TEXT` (13, `:76`) | `showRoundText()` (section 2.4) |
| `STATE_ASK_QUESTION` (16, `:79`) | `askQuestion()` |
| `STATE_ROUND_OVER` (20, `:82`) | nothing; set by `showShrinkingZone` |

After that, control passes by talkie callbacks: `nextRoundText` -> ... -> `askQuestion` -> (click) `showBoard` -> (button) `receiveAnswer` -> (click) `pickCpuResponse` -> (click) `askQuestion` ...

### 2.4 Host dialogue: the talkie

`ebug.general.Talkie` (`src/ebug/general/Talkie.as`), library clip `talkie` (in `movies/eBugGameShow.swf` sprite 22; a copy in `movies/cutscene_introduction.swf` sprite 844 and `movies/talkie.swf`). The clip has a speaker name box (`speaker_box`), a text field (`statement_text_field`) and a `big_invisible_button` over the whole box. Frame labels (sprite 22): `init` 1, `start` 10, `wait_for_click` 20 (shows a right-pointing arrow, seen in Ruffle), `collect_text` 30 (an unused text-input variant), `end` 50 (its script calls the callback too).

- `init(speakerName, statement, "start", "wait_for_click", null, obj, methodName)` (`:40-60`): `gotoAndStop("start")`, text placeholder `"df"`, speaker text, `counter = statementSoFar = 0`, `onEnterFrame = update`, `play()`.
- Typewriter: `speed = 1` (`:26`), so **one character per frame, 25 characters per second** (`update`, `:62-77`). When the whole string is shown it does `gotoAndPlay("wait_for_click")` and sets `nextState = "end"`.
- Click (`buttonClick`, `:85-99`): if the text is still typing, reveal it all at once; if it is complete, call `obj[methodName]()` (or the plain function). So **first click completes, second click advances**.
- Speaker name in the game show is always `"Gameshow Host"` (`src/ebug/junior/GameShow.as:150`).
- `showRoundText()` (`:147-166`) shows `introText[BLIND or NOT_BLIND][statementCounter]` with callback `nextRoundText` (`:168-171`, `statementCounter++; busy = false`), and when the lines run out sets `STATE_ASK_QUESTION`.
- As-built quirk: `showRoundText` sets `busy = true` unconditionally at its end (`:164`), including the call that switches to `STATE_ASK_QUESTION`, so by static reading `main` never calls `askQuestion`. In practice the game proceeds: the evaluation collected thousands of answers, and in Ruffle the standalone `eBugGameShow.swf` goes from the last blind intro line ("Lets go!") to "Question number 1" and the board. The extra call presumably comes from the talkie's own timeline, which `init()` sets playing (`src/ebug/general/Talkie.as:59`) and whose `end` frame script also fires the callback; the exact AVM1 path was not pinned down. Ruffle also showed the talkie's placeholder `"df"` at that transition. **Port**: after the last intro line, go straight to the first question.

### 2.5 Asking a question and the board

- `askQuestion()` (`:173-182`): host says `"Question number " + (questionId+1) + ": " + questionText + "..."`, callback `showBoard`.
- `showBoard()` (`:184-203`) fills `question_board`: `question_heading` = `"Question " + (questionId + 1)`, `question_body` = text, `point_value` = `score + " Points"` ("10 Points"); wires `agree_button` (value 0), `dont_know_button` (1), `disagree_button` (2) to `receiveAnswer(value)`; hides the talkie and **the studio** and shows the board (full screen).
- Board layout (`movies/eBugGameShow.swf` sprite 77 `question_board`, confirmed in Ruffle): blue microbe-pattern background, heading and question text top left, "10 Points" and a stopwatch graphic top right, three large stacked buttons centred ("Agree", "Don't Know", "Disagree", static DefineText 68, 73, 75). The stopwatch is a clip `timer` with frames `p0` to `p12` that no code drives: there is **no time limit** on answering.

### 2.6 Answer handling

`receiveAnswer(value)` (`src/ebug/junior/GameShow.as:205-301`). `response = player.nickname + ", you chose "` + `"Agree."` / `"Don't Know."` / `"Disagree."`.

Blind round (`currentRound.isBlind`):
- `response += "\nBecause this is a Blind question round, you'll find out how you did later."`
- Host `gsh` plays `"serious"`; the player avatar plays a random one of `"neutral"`, `"cautious"`, `"confident"` (`Math.floor(Math.random() * 3)`, `:220-228`).
- Stores -1/0/1 in `roundAnswersBlind[questionId]` (and tries `player.playerAnswers[...]`, which silently fails, section 8).
- No score change, no CPU turn: the next callback `pickCpuResponse` sees a blind round and calls `askQuestion()` directly (`:326-328`).

Sighted round: `response += "\nThis is the...."` then:

| Player answer value | Host (`studio.gsh`) | Player avatar (`upper`) | Text appended | Score |
|---|---|---|---|---|
| -1 wrong | `disappointed` | `disappointed` | `WRONG answer!` | CPU `+ Math.floor(score / 2)` = +5 |
| 0 don't know | `serious` | `neutral` | `SAFE answer.` | none |
| 1 correct | `excited` | `happy` | `CORRECT answer.` | player `+ score` = +10 |

Stored in `roundAnswersSighted[questionId]`. Then `questionIndex++`; if more questions remain, the host says the response (callback `pickCpuResponse`), studio shown, board hidden (`:278-283`). If it was the last question: blind round -> "Step right this way..." (callback `showShrinkingZone`); sighted round -> `nextRound()` at once (section 1.5 step 8).

### 2.7 CPU opponent

`pickCpuResponse()` (`:304-329`), sighted rounds only, after every question except the last of the round:
- `randomChoice = Math.floor(Math.random() * 3)`: uniform over the three buttons, so the CPU is right 1/3, "don't know" 1/3, wrong 1/3, independent of the question.
- Host line: `cpuName + ", you chose the "` + `WRONG answer!` / `SAFE answer.` / `CORRECT answer.` (e.g. "Amy, you chose the CORRECT answer.").
- CPU wrong: CPU avatar `disappointed`, **player** `+ Math.floor(score / 2)` (+5). Don't know: CPU avatar `neutral`. Correct: CPU avatar `happy`, CPU `+ score` (+10).
- Callback `askQuestion` (next question). The host's own animation is not changed for the CPU turn.

### 2.8 Scores and scoreboards

- `changeScore(isPlayer, change)` (`:331-343`) adds to `player.score` (the real player from `_root.getPlayer()`) or `cpu.score` and redraws that podium.
- Podium scoreboards: clip `score` with four `digit` clips `thousands`, `hundreds`, `tens`, `units`; each digit clip has frames labelled `zero` (1), `one` (10), `two` (20) ... `nine` (90) (`movies/eBugGameShow.swf` sprites 131 and 134). `updateScoreBoard` splits the score into digits and `gotoAndStop(translateNumbersToWords(d))` (`:345-386`). Display range 0 to 9999, green LCD look.
- Podiums: `studio.podia.amy_score` (middle podium) and `studio.podia.harry_score` (right podium); the host stands at the left podium.
- Maximum: 21 questions, of which 16 get a CPU turn in build A. The player can reach 210 plus up to 80 from CPU mistakes.

### 2.9 Round chaining

`nextRound()` (`:445-476`): `_root.submitPlayerData(roundId, roundAnswersBlind, roundAnswersSighted)`; if `nextRoundFile == "exit"` end the game (section 1.6); else `roundIndex++`, `questionFile = "../levels/" + nextRoundFile`, show the studio, `STATE_LOAD_LEVEL`. The new `GameShowRound` starts blind again (`GameShowRound.as:21`). `startNonBlindRound()` (`:421-439`) is the only way into the sighted half.

### 2.10 Character animations

Host `gsh` (`movies/eBugGameShow.swf` sprite 894; same in the cutscene, sprite 758). Each labelled animation loops until another is requested (the host clip sets `midAnimation = true` at each label and `false` at its loop point):

| Label | Frames | Used for |
|---|---|---|
| `stop` | 1 | cutscene pauses (`gsh.gotoAndPlay("stop")`) |
| `excited` | 21 to 145, loops | cutscene lines; player correct |
| `serious` | 171 to 296, loops | blind answers; player "don't know" |
| `disappointed` | 345 to 470, loops | player wrong |

Contestants: the `upper` body clip of Harry (`movies/eBugGameShow.swf` sprite 479; cutscene sprite 240) and Amy (sprite 732; cutscene sprite 599). Every animation returns to `idle` when done:

| Label | Frames |
|---|---|
| `stop` | 1 |
| `idle` | 10 to 50, loops |
| `neutral` | 82 to 207 |
| `cautious` | 255 to 380 |
| `condifent` (sic) | 420 to 545 |
| `happy` | 600 to 725 |
| `disappointed` | 800 to 925 |
| `curious` | 999 to 1124 |

`GameShow` requests `"confident"` (`src/ebug/junior/GameShow.as:227`), a label that does not exist, so that random blind reaction never plays. In the cutscene's Amy (sprite 599) `idle` jumps to `curious`.

### 2.11 Which avatar is the player's (as built)

The constructor picks the player's avatar and podium from `_root.getPlayer().avatarSex` (`src/ebug/junior/GameShow.as:52`, `:85-104`), but it runs during preload when there is no player yet (section 1.1). `undefined == Player.FEMALE` is false, so it always takes the male branch: player = Harry (right podium), CPU = Amy (middle podium), `cpuName = "Amy"`, `shrinkingZone.setUserAvatar(MALE)`. If the child chose Amy, the game show still animates Harry for the player's answers and names the CPU "Amy". The shrinking zone itself uses the real player at call time, so the right child is shrunk (section 4). This consequence is inferred from the code and the preload trace; the Ruffle harness could not drive the splash button, so it was not watched end to end. **Port decision**: use the intended mapping (the other child is the CPU, named after that child) unless strict fidelity is wanted.

## 3. Cutscene introduction

### 3.1 Files and structure

`movies/cutscene_introduction.swf` (59 frames, root labels `init` 1, `start_intro` 10, `choose_avatar` 20, `get_details` 30), text from `levels/conversations/en_en_introductions.xml` (hard-coded path in root frame 1: `var textSource = "../levels/conversations/en_en_introductions.xml"`), parsed by `ebug.junior.CutSceneXMLParser` (`src/ebug/junior/CutSceneXMLParser.as:44-54`: every child `<statement>`'s text, in order). The same studio, host and contestants as the game show; the talkie at (15, 307.5).

Root frame 1 (`init`) constants: `choose_avatar = 3`, `get_details = 5`, `finished = 9`, `stringCounter = 0`; when the XML is loaded, `gotoAndPlay("start_intro")`.

`nextLine()` (root frame 10, `start_intro`), called at `start_intro` and as the talkie callback:
```
if (stringCounter == choose_avatar) { gsh.gotoAndPlay("stop"); stringCounter++; gotoAndPlay("choose_avatar"); }
else if (stringCounter == get_details) { gsh.gotoAndPlay("stop"); gotoAndPlay("get_details"); }
else if (stringCounter == finished) { gsh.gotoAndPlay("stop"); exit(); }          // exit() = _root.startQuizShow()
else { gsh.gotoAndPlay("excited"); talkie.init("Gameshow Host", strings[stringCounter], "start", "wait_for_click", null, this, "nextLine"); stringCounter++; }
```

### 3.2 Statement index to screen

| Index | Build A XML (`levels/conversations/en_en_introductions.xml`, 9 lines) | Live XML (`Assets/Resources/TextFiles/conversations/en_en_introductions.xml`, 10 lines) | Use |
|---|---|---|---|
| 0 | Hello and welcome to the e-Bug Game Show! | same | host line |
| 1 | Soon you will be visiting the weird world of the microbe. | same | host line |
| 2 | But first, who do you want to play as? | same | host line |
| 3 | Excellent! | (empty) | never shown: index 3 triggers the avatar screen and is skipped |
| 4 | Tell me a little about yourself: | same | host line after the avatar choice |
| 5 | Nickname | same | form label |
| 6 | Age | same | form label |
| 7 | email address | same | form label |
| 8 | Allright, Lets begin by seeing what you know about microbes. | You don't need to give us this information, but if you do you'll be able to take part in competitions and hear about new versions of the game. | host line after the form |
| 9 | (none) | Let's see what you know about microbes. | build A SWF exits at index 9, so this line would never show with build A code; the live cutscene SWF was presumably changed to 10 lines (`doc:188`) |

So the live privacy line is spoken after the form is submitted, which is odd; a port should show it on the form (as the Unity remake does, `unity-logic.md` section 6).

### 3.3 Avatar choice (frame 20, `choose_avatar`)

Two invisible buttons over the contestants: `amyButton` at (436.8, 99.7) and `harryButton` at (584.15, 123.7), both scaled 2.68 x 5.26. Hover over one: it plays `happy`, the other `disappointed`; roll out: both `idle`. Click (`whichButton`): Amy sets `player.nickname = "Amy"; player.sex = false; player.avatarSex = false`, Harry sets `"Harry"`, `true`, `true`; then back to `start_intro`, so the host says line 4. `Player.MALE = true`, `Player.FEMALE = false` (`src/ebug/Player.as:21-22`). `sex` is not asked separately: it is the avatar choice.

### 3.4 Personal details form (frame 30, `get_details`)

- Labels `nickname_label`, `age_label`, `email_label` at x 92.5, y 43.7 / 116.4 / 195.75, text from statements 5, 6, 7 (`stringCounter` ends at 8).
- Inputs at x 400.6: `nickname_input` (y 43.7, 310 px wide) pre-filled with the chosen name ("Amy" or "Harry"), `age_input` (y 116.4, 56 px) pre-filled `"2"`, `email_input` (y 195.75) pre-filled `"dont@have.one"`. A `submit_button` "Submit" at (398.65, 275.95).
- Submit: `player.nickname = nickname_input.text; player.age = parseInt(age_input.text); player.email = email_input.text;` then back to `start_intro`. No validation (an empty nickname is accepted; a non-numeric age gives `NaN`).
- **The port will not collect e-mail.** Drop the e-mail field and its label (statement 7) and the "competitions" line (statement 8 of the live XML), or replace the latter with a neutral line. Nickname is used in host speech ("<nickname>, you chose Agree.") and may be kept locally. Age is used by nothing except the data submission, so the port can drop it or keep it purely local.

### 3.5 What is stored

Only in memory, in the `Player` object (`src/ebug/Player.as:28-42`): `nickname`, `age`, `sex`, `avatarSex`, `email`, `id` (timestamp string), `score`, `forename` ("david", unused), `surname` ("Smith" default), `playerAnswers` (never filled, section 8). Nothing is saved on the machine (no `SharedObject` anywhere). The details leave the machine only through the research submission (section 6.3).

## 4. Shrinking zone

- `ebug.junior.ShrinkingZone` (`src/ebug/junior/ShrinkingZone.as`), library clip `shrinking_zone` inside the game show. Its constructor creates child clips `harry` and `amy` and loads `movies/shrinking_harry.swf` and `movies/shrinking_amy.swf` into them (`:14-27`); `onLoadInit` hides both and gives each a `callObj/callFunc` pointing at `forceReassignAvatar` (`:29-42`).
- Each SWF holds one clip `avatar` (Harry: sprite 192; Amy: sprite 208) of **150 frames**. Frame 1 (label `start`) sets `midAnimation = true` and stops; frame 150 sets `midAnimation = false` and stops. The SWFs are authored at 24 fps but play at the host's 25 fps: the shrink lasts **149 frames, about 6.0 s**.
- Visual (Ruffle): the chosen child stands on a red and white target platform in a studio with spotlights and a large red shrink ray at top right.
- `GameShow.showShrinkingZone()` (`src/ebug/junior/GameShow.as:388-412`): shows the zone and the real player's avatar (Harry if `avatarSex == MALE`, else Amy), `avatar.play()`, hides studio and talkie, forces Harry's `_alpha = 100`, stops the show's loop and polls `shrinkingZone.isFinishedAnimation` every 40 ms; `STATE_ROUND_OVER`.
- `isFinishedAnimation()` (`src/ebug/junior/ShrinkingZone.as:57-74`): when `userAvatar.avatar.midAnimation == false`, rewind with `gotoAndStop("start")` and call `_root.showHoverboardOrKitchen()`.
- Quirks: `userAvatar` is set by `setUserAvatar` in the constructor, i.e. always Harry (section 2.11). When Amy is shrunk, Harry's clip sits on frame 1 with `midAnimation = true`, so the poll would wait forever; Amy's frame 150 rescues it by calling `callObj[callFunc](this._parent)` = `forceReassignAvatar(amy)` (`movies/shrinking_amy.swf` sprite 208 frame 150; the "hacky way to fix" of `:76-82`). Harry's frame 1 also runs `_alpha -= 50` every time it is entered (`movies/shrinking_harry.swf` sprite 192 frame 1, `setProperty("", 6, ...)`), which is why `showShrinkingZone` forces `_alpha = 100`.
- The 40 ms poll is stored in `GameShow.interval` and cleared by `showHoverboard`/`showKitchen` (`src/ebug/junior/GameController.as:219`, `:229`).

## 5. Kitchen game

### 5.1 Files and lifecycle

- Coordinator: `movies/KitchenGame.swf` (frame 1 creates `KitchenGame(this, container, new ebug.Player())`) and class `ebug.junior.fridge.KitchenGame` (`src/ebug/junior/fridge/KitchenGame.as`). Food items: `src/ebug/junior/fridge/FoodItem.as`.
- `init()` (`:119-142`) loads `kitchen_game_main.swf`, `kitchen_game_intro_level_0.swf` to `_3.swf`, `kitchen_game_outro.swf` with its own `AssetLibrary` (loading word `"Loading"`, `:112`), builds the food list (`:1234-1325`), valid locations (`:1204-1232`, never used afterwards) and outro strings (`:1163-1202`); `level = 0; timeLeft = 60`.
- `assetsLoaded()` (`:1095-1160`) wires the clips, attaches the kitchen avatar (section 5.12), makes the counter items and 27 rest points clickable and calls `nextLevel(0)`.
- Because `KitchenGame.swf` runs at preload, level 0's intro is waiting (hidden) from the start; `GameController.showKitchen()` (`src/ebug/junior/GameController.as:218-226`) only makes it visible.
- Level loop: **intro screens** (until the intro clip sets `finished = true`, polled every 40 ms, `:874-887`) -> **play** (`main()` every 40 ms, `:144-191`) -> **outro** 3 pages -> `nextLevel()` -> ... after level 3's outro, `level > 3` -> `exitKitchenGame()` (`:802-811`) -> `player.score += overallScore; _root.endOfKitchen(player)`.

### 5.2 Level parameters

| Level | Intro SWF | Items | Categories (weights) | Time (s) | Sneezes |
|---|---|---|---|---|---|
| 0 | `kitchen_game_intro_level_0.swf` | 10 | vegetables 1/2, door 1/2 | 60 | none |
| 1 | `kitchen_game_intro_level_1.swf` | 10 | veg 1/6, door 1/3, fruit 1/3, cupboard 1/6 | 60 | yes |
| 2 | `kitchen_game_intro_level_2.swf` | 10 | veg 1/12, door 1/6, fruit 1/6, cupboard 1/6, raw meat 1/6, cheese 1/6, cooked meat 1/12 | 60 | yes |
| 3 | `kitchen_game_intro_level_3.swf` | 20 | as level 2 | **120** | yes |

- Item count and category draws: `prepareLevelFood()` (`:906-1075`). For each item, `category = Math.round(Math.random() * high)` with `high` = 1, 3, 6, 6, then `index = Math.round(Math.random() * (categoryArray.length - 1))`. `Math.round` gives the two end values half the weight of the others; the weights above and in 5.3 follow from that exactly. Draws are with replacement (duplicates are normal).
- Time: `timeLeft = 120` if `levelId == 3` else 60 (`:844-848`). The code comments ("10 items, 30 seconds", "20 items, 45 seconds", `:911`, `:1024`) and level 3's intro ("You have 45 seconds this time.") disagree with the code.
- Sneezes: `if (level > 0) { levelSneezes = true; sneezeChance = 7; }` (`:857-860`). At level 0 `sneezeChance` is undefined and `n > undefined` is always false, so no sneezes.

### 5.3 Food items

`allPossibleFood` in order (`:1234-1285`). Type constants (`src/ebug/junior/fridge/FoodItem.as:12-21`): `TYPE_FRUIT 0`, `TYPE_VEGETABLES 1`, `TYPE_CUPBOARD 4`, `TYPE_CHEESE 5`, `TYPE_DOOR 6`, `TYPE_RAW_MEAT 7`, `TYPE_COOKED_MEAT 9`. State flags (`:26-31`): `CLEAN 0`, `SNEEZE_MICROBES 1`, `MEAT_MICROBES 2`, `CLINGFILMED 3`, `BURST 4`, `MOULDY 5`.

| # | Name | Library symbol (`assetName`) | Type | Initial flags |
|---|---|---|---|---|
| 0 | Mouldy Bread | `mouldy_bread` | cupboard | MOULDY, not CLEAN |
| 1 | Burst Yogurt | `burst_yogurt` | door | BURST, not CLEAN |
| 2 | Carrots | `carrots` | vegetables | CLEAN |
| 3 | Tomatoes | `tomatoes` | vegetables | CLEAN |
| 4 | Orange | `orange` | fruit | CLEAN |
| 5 | Bananas | `bananas` | fruit | CLEAN |
| 6 | Mouldy Orange | `mouldy_orange` | fruit | MOULDY, not CLEAN |
| 7 | Yogurt | `yogurt` | door | CLEAN |
| 8 | cheese | `cheese` | cheese | CLEAN |
| 9 | Orange Juice | `orange_juice` | door | CLEAN |
| 10 | Apple | `red_apple` | fruit | CLEAN |
| 11 | Raw Lamb | `raw_lamb` | raw meat | MEAT_MICROBES, not CLEAN |
| 12 | Raw Chicken | `raw_chicken` | raw meat | MEAT_MICROBES, not CLEAN |
| 13 | Raw Sausages | `raw_sausages` | raw meat | MEAT_MICROBES, not CLEAN |
| 14 | Raw Steak | `raw_steak` | raw meat | MEAT_MICROBES, not CLEAN |
| 15 | Cooked Steak | `cooked_steak` | cooked meat | CLEAN |
| 16 | Cooked Lamb | `cooked_lamb` | cooked meat | CLEAN |
| 17 | Cooked Chicken | `cooked_chicken` | cooked meat | CLEAN |
| 18 | Apple | `green_apple` | fruit | CLEAN |
| 19 | Pear | `pear` | fruit | CLEAN |
| 20 | Milk | `milk` | door | CLEAN |
| 21 | Soup | `soup` | cupboard | CLEAN |
| 22 | Orange Juice | `orange_juice` | door | CLEAN (a second, separate entry) |
| 23 | Broccoli | `broccoli` | vegetables | CLEAN |
| 24 | Bread | `bread` | cupboard | CLEAN |
| 25 | Spring Onion | `spring_onion` | vegetables | CLEAN |

Category arrays (indices into the table, built by type in table order, `:1288-1324`) and the within-category weights produced by `Math.round`:

| Array | Indices | Weights |
|---|---|---|
| `foodVegetables` | 2, 3, 23, 25 | 1/6, 1/3, 1/3, 1/6 |
| `foodDoor` | 1, 7, 9, 20, 22 | 1/8, 1/4, 1/4, 1/4, 1/8 |
| `foodFruit` | 4, 5, 6, 10, 18, 19 | 1/10, 1/5, 1/5, 1/5, 1/5, 1/10 |
| `foodCupboard` | 0, 21, 24 | 1/4, 1/2, 1/4 |
| `foodRawMeat` | 11, 12, 13, 14 | 1/6, 1/3, 1/3, 1/6 |
| `foodCookedMeat` | 15, 16, 17 | 1/4, 1/2, 1/4 |
| `foodCheese` | 8 | 1 |

`movies/kitchen_game_main.swf` exports every `assetName` above and a matching `clingfilm_<assetName>` overlay for each of the 25 distinct symbols.

### 5.4 Screen layout (`movies/kitchen_game_main.swf`, stage coordinates)

- Picture (Ruffle): green wall cupboards top left (one door open showing shelves), a counter across the left half carrying a shopping bag and a tissue box (far left), cling film, a soap dispenser and the sink (centre) and a blue fruit bowl; an open fridge centre right (three shelves over two drawers, the open door with shelves on the right); a pedal bin bottom right; chequered floor. `clock` text field at (669.95, 5.9), 110 x 35 (placeholder "30"), `htmlText = "<font face=\"verdana\"><b>" + timeLeft + "</b></face>"` (sic) updated every 40 ms.
- Counter clip `kitchen_counter` at (400.05, 219.05) with three click targets: `tissues` at (5.35, 210.75), `clingfilm` at (204.2, 211.25), `sink_area` at (273.6, 174.65) (counter origin plus child offsets).
- Avatar clip attached at (65.5, 8.7) and placed behind the counter (`swapDepths`, `:1106-1114`); the animated part is `avatar.upper`.
- Current item: `food_throw_area.foodContainer`, a 90 x 90 box at (120.3, 171.5); the item is attached inside it and shifted by `(container - content)` in both axes, i.e. bottom-right aligned (`:780-800`). The throw animations of `food_throw_area` exist but are unused ("since throwing is broken, going straight to store", `:640-642`).
- 27 rest points (instances of one 30 x 30 invisible box clip whose frame 1 does `this.onRelease = function () { callObj[callFunc](this._name); }`, `movies/kitchen_game_main.swf` sprite 655). Displayed box = 30 x scale:

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

Location type is decided by name prefix in `receiveInput` (`:646-675`): `restpointCupboard*` -> CUPBOARD (avatar `cupboard`), `restpointFridgeTop*` UPPER, `restpointFridgeMid*` MID, `restpointFridgeBot*` LOWER, `restpointFridgeBox*` DRAWER, `restpointFridgeSid*` DOOR (all avatar `fridge`), `restpointFruitBowl*` BOWL (avatar `bowl`), `restpointBin` BIN (avatar `bin`). Location constants: `src/ebug/junior/fridge/KitchenGame.as:97-104`.

### 5.5 Game states and the per-second tick

States (`:86-95`): `PICK_ITEM 0`, `WAIT 1`, `THROW 2` (unused), `STORE_FOOD 3` (unused), `SNEEZE_START 4`, `SNEEZE_FOOD 5` (unused), `SNEEZE_TISSUE 6` (unused), `WASH_HANDS 7`, `END_OF_LEVEL 8`, `CLEANUP 9` (unused).

`main()` every 40 ms (`:144-191`):
- Once per second (`getTimer() - timer > 1000`): `timeLeft--`. If `timeLeft < 0`: `gameState = END_OF_LEVEL; timeLeft = 99` (so the clock shows **99** for one second). Otherwise: in `WAIT`, roll for a sneeze; in `WASH_HANDS`, if the wash animation has finished clear both hand flags and return to `WAIT`; in `END_OF_LEVEL`, stop the loop, `calculateScores()`, hide the kitchen and show outro page 1.
- Every tick: redraw the clock; in `PICK_ITEM` call `pickItem()`.
- `pickItem()` (`:780-800`): if all items are used, `END_OF_LEVEL` (the outro then appears at the next one-second tick); otherwise show the next item and go to `WAIT`.

So a level ends when the clock passes 0 or when every item has been placed, and the outro appears up to one second later. Unplaced items cost nothing.

### 5.6 Player input (`receiveInput(buttonName)`, `:632-777`)

Only processed in `WAIT` (and `SNEEZE_START`, 5.7); clicks during hand washing are ignored.
- **Rest point**: play the avatar animation for the location, apply hand contamination (5.8), then move the item into the rest point's box: scale `box._width / content._width` if the item is wider than tall, else `box._height / content._height`; bottom-aligned (`_y = box._height - content._height * scale`); the cling film overlay follows if the item is cling-filmed (`:696-727`). Any item already displayed in that slot is replaced visually, but every placement is recorded in `levelFoodChoices[locationType]` for scoring (`:730-733`). The bin fades its item out, `_alpha -= 5` every 40 ms (0.8 s, `removeBinItem`, `:621-629`). Then `currentFoodItemId++`, `PICK_ITEM`.
- **`clingfilm`**: attach `clingfilm_<assetName>` over the current item and set `CLINGFILMED` (`:764-770`). Allowed on any item; no avatar animation.
- **`sink_area`**: `WASH_HANDS`, avatar `wash_hands` (`:772-774`).
- **`tissues`** outside a sneeze: nothing.

### 5.7 Sneezes and tissues

- Roll: once per second in `WAIT` from level 1 on: `GeneralFunctions.getRandom(0, 10)` = `Math.round(Math.random() * 10)` (`src/ebug/util/GeneralFunctions.as:3-4`), sneeze if the result `> sneezeChance`, then `sneezeChance++` (`:153-160`). With `sneezeChance` 7, 8, 9, 10 the chance per second is 1/4, 3/20, 1/20, 0, so **at most three sneezes per level**, the first expected after about 4 s of idle waiting.
- `startSneeze()` (`:545-550`): `SNEEZE_START`, avatar `sneeze_Start`, `setInterval(makeSneeze, 2000)`.
- Within 2 s, click `tissues`: `sneezeHankie()` (`:613-619`): back to `WAIT`, **hands get sneeze microbes**, avatar `sneeze_tissue_end`.
- Click anything else, or wait 2 s: `makeSneeze()` (`:602-611`): back to `WAIT`, the **current item** gets `SNEEZE_MICROBES`, hands too, avatar `sneeze_food_end`. A click on a rest point during the sneeze does not place the item.

### 5.8 Hands, washing and cling film

- On every placement (`:680-694`): if the hands carry sneeze microbes, the placed item gets `SNEEZE_MICROBES` and the hands are cleaned ("limit spread to just one item"). Placing raw meat sets `handStates[MEAT_MICROBES] = true`.
- Intended raw-meat cross-contamination is broken: the code tests `handStates[FoodItem.FOOD_STATE_CLINGFILMED]` instead of `MEAT_MICROBES` and writes `currentFoodItem[MEAT_MICROBES]` instead of `currentFoodItem.foodState[MEAT_MICROBES]` (`:685-689`). Meat on the hands therefore never affects anything, and "Raw Meat Hands" is never shown.
- Washing (`sink_area`): avatar `wash_hands` (36 frames, 1.44 s); the one-second tick then clears both hand flags (`:161-167`), so washing takes 1.4 to 2.4 s.
- Net effect as built: washing matters only after a tissue sneeze (to stop the next item being contaminated).

### 5.9 Scoring rules (`calculateScores()`, `:353-543`)

Every placed item is checked per location, locations in id order 0 to 7, items in placement order. First, any item with `SNEEZE_MICROBES` adds the "Sneeze" admonishment (once per level; no point effect). Then:

| Location | Correct (+1 correct for its type) | Incorrect (+1 incorrect for its type) and admonishment |
|---|---|---|
| BIN | mouldy or burst item: counts nothing either way | any good item: incorrect + that type's location reminder |
| BOWL | fruit, not mouldy | mouldy orange: incorrect + "Bad Food" (repeatable, `badFood` not set here, `:396-398`); any other type: incorrect + reminder |
| CUPBOARD | cupboard type, not mouldy (soup, bread) | mouldy bread: incorrect + "Bad Food" (once); other: incorrect + reminder |
| FRIDGE_DOOR | door type, not burst (yogurt, orange juice, milk) | burst yogurt: incorrect + "Burst Container" (once); other: incorrect + reminder |
| FRIDGE_DRAWER | vegetables | other: incorrect + reminder |
| FRIDGE_LOWER | raw meat with cling film | raw meat without: incorrect + "Clingfilm" (once); other: incorrect + reminder |
| FRIDGE_MID, FRIDGE_UPPER | cheese (cling film irrelevant); cooked meat with cling film | cooked meat without: incorrect + "Clingfilm" (once); other: incorrect + reminder |

- "Reminder" = `addFoodLocationAdmonishments` (`:552-600`), once per type per level (flags reset in `nextLevel`, `:832-838`). A mouldy or burst item put anywhere other than the bin or its own category's place gets its category's reminder (e.g. mouldy bread in the fridge: "Things like cans and bread should be put in the cupboard."), which is misleading.
- Not enforced although the intros and strings state them: cooked meat on its own shelf, raw meat alone on its shelf, washing hands after raw meat.
- Points: page 1 adds `10 x correct` for each of the seven categories, page 2 subtracts `10 x incorrect` (`:228-261`, `:272-305`). Net per level = `10 x (total correct - total incorrect)`, accumulated in `overallScore` over the four levels (can go negative). No total is displayed ("Points Awarded", "Points Deducted", "Total Points" strings are unused).

### 5.10 Outro pages (`movies/kitchen_game_outro.swf`)

Frames: `init` 1 (a `click_button` "Click", an unused local `strings` table), `achievements` 10, `missed` 20, `admonishments` 30. A grey rounded panel with a black border on an olive background, Verdana 20 black text, a blue "Click" button bottom centre (Ruffle).
1. **Achievements** (`showOutroAchievements`, `:193-265`): title `text0` = "Shopping Placed Correctly" (static text says "Items Placed Correctly"); seven rows `textN  multiplierN  X ... = sumN` for N = 1..7: Fruit, Vegetables, Cupboard Items, Cheese, Raw Meat, Cooked Meat, Liquids; multiplier = correct count, sum = count x 10.
2. **Missed** (`showOutroMissed`, `:267-312`): title "Items Placed Incorrectly"; same rows with incorrect counts and sums `"- " + count x 10`.
3. **Admonishments** (`showAdmonishments`, `:314-351`): title "Microbial Mistakes" (overwrites the static "Things to remember"); `text1` to `text4` = the first four admonishments. **Only four slots exist**; any further ones are silently lost.
4. Click: `nextLevel()` (next intro, or exit after level 3).

Outro and admonishment strings (`outroStrings`, `src/ebug/junior/fridge/KitchenGame.as:1165-1192`; `translations.json` key `kitchen.outro.<camelCase key>`):

| Key | Text | Used |
|---|---|---|
| Shopping Placed Correctly | Shopping Placed Correctly | page 1 title |
| Fruit / Vegetables / Cupboard Items / Cheese / Raw Meat / Cooked Meat / Liquids | same as the key | row labels 1 to 7 on pages 1 and 2 |
| Items Placed Incorrectly | Items Placed Incorrectly | page 2 title |
| Microbial Mistakes | Microbial Mistakes | page 3 title |
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
| Points Awarded, Points Deducted, Total Points | same as the key | unused |
| Sneeze Hands | Even if you use a tissue when you sneeze, you should wash your hands before handling food. | unused (the tissue case produces "Sneeze") |
| Cooked Meat Shelf | Cooked meat should be covered and placed on its own shelf. | unused |
| Raw Meat Shelf | Raw meat should have a solid shelf all to itself to prevent harmful microbes transferring to other food. | unused |
| Raw Meat Hands | After you handle raw meat, you should wash your hands to prevent harmful microbes from spreading. | unused |

### 5.11 Intro screens (`movies/kitchen_game_intro_level_N.swf`)

Each intro shows a dimmed kitchen picture (`background`; in level 0 it includes Amy at the counter, whatever avatar was chosen) with centred white Verdana 20 bold text and a blue "Click" button (Ruffle). Frame 1 (`init`) fills a `strings` array and sets `finished = false`; `click_button` advances frame by frame; the last click sets `finished = true`, which `KitchenGame.introFinished` polls. Texts (the static placeholder texts inside the SWFs are overwritten at run time):

- **Level 0** (`screen1` texts 0-1, `screen2` 2-3, `screen3` 4-6, `screen4` 7, then a tutorial): "In this mini-game, you have to put away the shopping." / "Sounds simple, doesn't it?" // "But be careful!" / "You need to put things in the right place." // "Here are the rules:" / "Vegetables go in the bottom drawer of the fridge." / "Drinks and Yogurt go in the fridge door." // "On the next screen, click on the correct place in the fridge to put away the spring onion." Then frame `spring_onion`: the kitchen picture with five `wrong_button`s and one `right_button` (the drawer, at (473.05, 215.9) in the intro's coordinates); wrong: "Wrong!  Try again." with the two rule lines, click returns to the tutorial; right: "Excellent, well done." / "Try to put away 10 things before the timer runs out." / "Click the button when you're ready to start the level..." and the click sets `finished`.
- **Level 1**: "Level 2" / "This time, you also have to put away fruit, tins and bread." // "Remember, vegetables go in the bottom drawers in the fridge." / "Liquids like milk, yogurt and juice go in the fridge door." // "There are some new things this time." / "If you see fruit, put it in the fruit bowl." / "Tins and bread go in the cupboard." // "One more thing - if you start to sneeze, click on the tissues quick! Otherwise, you'll cover the food in harmful microbes." / "Click on the button when ready to start."
- **Level 2**: "Level 3" / "Things are about to get tricky..." // "This time, you also have to put away meat." / "Meat should always be kept away from vegetables to prevent microbes from spreading." // "Click on the cling film to cover meat before putting it in the fridge." / "Cooked meat has to have its own shelf." / "Raw meat needs to have a solid shelf.  So put the raw meat on the bottom shelf, above the fridge drawers." // "Also, if you find cheese, it goes on the top or middle shelf.  " / "Ready?"
- **Level 3**: "Level 4" / "Let's see what you can do." // "You know all the rules now. " / "Can you put away all the food correctly?" // "You have 45 seconds this time." / "You have to put away 20 items." / "Ready?" (this intro ends after the third screen; its fourth screen is unreachable).

Note the numbering: code levels 0 to 3 are shown to the player as an untitled first level and then "Level 2" to "Level 4".

### 5.12 Kitchen avatar and animations

- `KitchenGame.swf` passes a fresh `new ebug.Player()`, not the real player. `avatarSex` is undefined, so `player.avatarSex == Player.FEMALE` is false and **Harry is always the kitchen avatar** (`:1105-1109`), and the kitchen score is added to this throwaway object (`:806`); `GameController.endOfKitchen` only traces it (`src/ebug/junior/GameController.as:273-281`). Port decision: use the chosen avatar; whether kitchen points count towards the final result is a design choice (as built they do not).
- Avatar `upper` labels (`movies/kitchen_game_main.swf` sprite 169 inside exported `harry`; sprite 612 inside exported `amy` has the same labels): `stop` 1, `idle` 10 to 30 loop, `fridge` 47 to 60, `cupboard` 85 to 97, `bin` 130 to 142, `bowl` 165 to 177, `cling_film_start` 205 to 217 then `cling_film_mid` 235 to 255 loop, `cling_film_end` 285 to 297 (cling film animations unused), `sneeze_Start` 335 to 347 then `sneeze_mid` 360 to 379 loop, `sneeze_tissue_end` 390 to 406, `sneeze_food_end` 440 to 456, `window` 530 to 543 (unused), `wash_hands` 565 to 600. Each one-shot returns to `idle`.
- The SWF also contains developer test buttons (`clickme1` to `clickme12`, `animation_test`) that its frame 1 hides.

### 5.13 Level transitions

`nextLevel(levelId)` (`:813-872`): removes the displayed items from the 27 rest points (but not their cling film overlays, which stay on screen into later levels), resets reminder flags, food list, hand states and scores, sets time and sneeze chance, shows the intro. `introFinished` then shows the kitchen, resets the one-second timer and starts `main`.

## 6. Summary pages and research data submission (describe only; do not port the submission)

### 6.1 Platform "summary page" (`movies/summary_page.swf`)

A 139-frame clip with fields `text0` (bold heading, static "Things to remember"), `text1` to `text4`, and `click_button` ("Click") whose release calls `_parent.callObj[_parent.callFunc]()`. Only `GameController.endofHoverboard` uses it (`src/ebug/junior/GameController.as:283-299`): `text0` = "You Died!" or "You ran out of time.", `text1` = "click to try again", callback `restartHoverboardRound`. The documentation's claim that it summarises kitchen levels (`doc:393`) does not match the code; the kitchen uses `kitchen_game_outro.swf` (5.10).

### 6.2 End of game

Host line only (section 1.6). No score table, no replay button.

### 6.3 Research submission (must not be ported)

- Mechanism: `MovieClip.loadVariables(url, "POST")` posts every variable set on a throwaway clip as form fields to a Lotus Domino form (`?CreateDocument`).
- **Identity form**, once, in `startQuizShow()` (`src/ebug/junior/GameController.as:134-145`): POST `http://www.e-bug.eu/ebug_secret.nsf/ID_Form?CreateDocument` with `name` (nickname), `UID` (`player.id`), `age`, `sex` (true = Harry chosen), `email`, `IP` = `"18.15.16.111"` (hard-coded), `hasBeenTaught` = `"no"`, `school_code` = `"DF"`, `timestamp_1`.
- **Round forms**, after each sighted round in `nextRound()` via `submitPlayerData(roundId, blind, sighted)` (`:170-196`): POST `http://www.e-bug.eu/ebug_secret.nsf/Round_<roundId+1>_Form?CreateDocument` with `timestamp_rnd_<n>`, `UID`, `name`, `pre_question_<q>_rnd_<n>` = blind answer and `post_question_<q>_rnd_<n>` = sighted answer, values -1 wrong, 0 don't know, 1 correct, `q` 1-based. The last sighted answer of a round is included (it is recorded before `nextRound` runs).
- `timestamp()` (`:162-168`) concatenates `getUTCYear()` (years since 1900), `getUTCMonth()` (0-11), `getUTCDay()` (**day of the week**, not of the month), hours, minutes, seconds and milliseconds with no padding, so IDs are neither unique nor parseable.
- Build B: same calls with an empty blind array (`doc:704`); the URLs stopped working once the HPA took over the domain (`doc:2136-2159`). The Unity remake replaced this with a Heroku logger (`unity-logic.md` section 7).
- The evaluation analysed these pre/post pairs with McNemar's test (`eval:36-42`, `eval:97-123`).

## 7. Translations

### 7.1 Languages

| Code | Country and language | Build A | Live XML (Unity copy) |
|---|---|---|---|
| `en_en` | England, English | hard-coded English, `alpha_*` files | yes |
| `bg_fl` | Belgium, Flemish (Dutch) | no | yes |
| `bg_fr` | Belgium, French | no | yes |
| `cz_cz` | Czech Republic, Czech | no | yes |
| `dk_dk` | Denmark, Danish | no | yes |
| `fr_fr` | France, French | no | yes |
| `gk_gk` | Greece, Greek | no | yes |
| `it_it` | Italy, Italian | no | yes |
| `pl_pl` | Poland, Polish | no | yes |
| `por_por` | Portugal, Portuguese | no | yes |
| `sp_sp` | Spain, Spanish | no | yes |

Sources: `levels/` holds only English (`alpha_gameshow_round1-5.xml`, `conversations/en_en_introductions.xml`, plus older unused drafts `gameshow_round*.xml`, `realgameshow_round*.xml`, `alpha_realgameshow_round3.xml`, `Copy of realgameshow_round*.xml`). `Assets/Resources/TextFiles/quiz/<lang>_gameshow_round1-5.xml` and `conversations/<lang>_introductions.xml` hold the 11 live languages, almost certainly copied from the deployed Flash site (file naming as in `doc:41`, generated by `OutputXMLFilesMovie.fla` from `Translations.as`, `doc:1984-2118`). The Unity copies of `alpha_gameshow_round*.xml` are the Flash `alpha` files except round 4, which is a machine-looking French translation pointing at `fr_fr_gameshow_round5.xml`; it is excluded.

### 7.2 How the language was selected (build B)

The embedding page passed the language as a flashvar; root frame code did `new GameController(this, this["gameScreen"], language)` (`doc:418`, `doc:449`). `Translations(language)` filled `translationText[language]` through a `switch` on the code (`populateEnglish()`, `populateGreek()`, ... and a separate `SpanishTranslation` class, `doc:1963-1980`); strings were read with `Translations(_root.translations).getString(Translations.STRING_X)`; quiz and conversation XML were chosen by file prefix (`<lang>_gameshow_roundN.xml`, `next_round` pointing at the same language, `doc:41`, `doc:2012`).

Build A has none of this: both wrappers `movies/e-Bug_Junior_Game.html` and `movies/e-Bug_Junior_Game2.html` embed `e-Bug Junior Game.swf` with **no flashvars** (they differ only in size, 1000 x 562 versus 800 x 450; `allowScriptAccess="sameDomain"`, black background, Flash 8 codebase; `movies/e-Bug_Junior_Game.html:418-421`, `movies/e-Bug_Junior_Game2.html:418-421`); the rest of each file is a comment listing the loader's text fields. `movies/params.txt` (`skin=0xFF0000&done=true`) is a 2008 test input for the unfinished avatar colour customisation (`src/ColourSwap.as:14-37` reads `_root.paramContainer`, which the junior game never creates), not a flashvar file. The site's launcher banner `movies/ad2.swf` reads flashvars `line1Text`, `line2Text` and `juniorURL` and opens `juniorURL` in a new window on click (root frame 1), but `movies/ad2.html` passes none.

**Port**: select the language with a URL parameter (for example `?lang=cz_cz`, mirroring the flashvar) falling back to `en_en`.

### 7.3 Translations.as is not available

`Translations.as` (184 strings, `doc:1927-1937`) and `OutputXMLFiles.as` are not in the repo, in any SWF, or anywhere on disk. What is known of it: indices 0 to 4 for `en_en` ("English ", "New Game", then the three first conversation lines) and `cz_cz` ("cz_cz", "Nová hra", "Ahoj, vítej v e-Bug hře!", "Za chvíli navštívíš tajemný svět mikrobů.", "Ale nejprve si vyber, zda budeš soutěžit jako holka nebo kluk.") (`doc:1946-1960`), and these constant names: `STRING_NEW_GAME` (1), `STRING_HELLO_AND_WELCOME` (2), `STRING_SOON_WILL_VISIT_WORLD` (3), `STRING_BUT_FIRST_WHO_PLAY` (4), `STRING_PRIVACY_STATEMENT` (184), `STRING_STEP_RIGHT_THIS_WAY`, `STRING_YOU_DIED`, `STRING_QUIZ_CLICK_BUTTON_TO_CONTINUE`, `STRING_QUIZ_NO_TIME`, `STRING_QUESTION_NUMBER`, `STRING_YOU_CHOSE`, `STRING_AGREE`, `STRING_DONT_KNOW`, `STRING_DISAGREE`, `STRING_WRONG_ANSWER`, `STRING_FIRST_BLIND_ROUND`, `STRING_ASK_QS_NO_ANSWER`, `STRING_BONUS_LATER`, `STRING_LETS_GO`, `STRING_QUIZ_HOVEBOARD_NATURAL`, `STRING_QUIZ_LETS_SEE_QUESTIONS_AGAIN`, `STRING_QUIZ_TEN_POINTS_OR_OTHER_PLAYER`, `STRING_QUIZ_NO_KNOW_ANSWER_DONT_GUESS`, `STRING_KITCHEN_READY_QUESTION_MARK`, `STRING_QUIZ_CANNY_SEE_NO_THERE`, `STRING_QUIZ_BACTERIA_VIRUSES_SAME`, `STRING_QUIZ_FUNGI_MICROBES`, `STRING_QUIZ_MICROBES_ON_HANDS` (`doc:591`, `doc:628-636`, `doc:1854`, `doc:1871-1884`, `doc:2015-2104`). The Czech index 2 to 4 values match `cz_cz` conversation lines 0 to 2, confirming the XML was generated from the same table. The remaining UI strings (game show responses, kitchen texts, summary page) therefore exist only in English.

### 7.4 translations.json

`reference/analysis/translations.json`, produced by `tools/extract-translations.mjs` (`node tools/extract-translations.mjs`; `--translations <file>` would also ingest a real `Translations.as` if one turns up, as keys `translations.<index>` and `STRING_*`). Shape: `{ "<lang>": { "<key>": "<string>" } }`, 12 tables: the 11 live languages plus `alpha` (build A English).

Keys (XML read positionally like the game does):

| Key | Source |
|---|---|
| `conversation.<i>` | `<lang>_introductions.xml` statement i (section 3.2) |
| `quiz.round<N>.name` | round `<name>` (never translated: always the English name) |
| `quiz.round<N>.blind.<i>`, `quiz.round<N>.normal.<i>` | intro lines |
| `quiz.round<N>.q<i>.text`, `quiz.round<N>.q<i>.answer.<j>.label` | question text and the three answer labels (j = 0 Agree, 1 Don't Know, 2 Disagree) |
| `ui.agree`, `ui.dontKnow`, `ui.disagree` | the most common answer label per position in that language (for the board buttons) |
| `ui.languageName`, `ui.newGame` | `en_en` and `cz_cz` only, from `doc:1946-1957` |
| `gameshow.*`, `board.*`, `summary.*`, `splash.*`, `cutscene.submit`, `loader.*`, `kitchen.outro.*`, `kitchen.outroStatic.*`, `kitchen.intro<L>.<i>`, `kitchen.introStatic.click` | English UI strings hard-coded in build A (cited in the script); present in `alpha` and copied into `en_en` because no live English UI table survives |
| `ebugStrings.<i>` | `alpha` only: the unused `src/ebug/EBugStrings.as` prototype table |

Counts: `en_en` 246 keys, `cz_cz` 144, the other nine live languages 142 each, `alpha` 266. Integrity check across all 55 live quiz files: every language has the same number of rounds, intro lines, questions and answers as `en_en`, `next_round` chains to the same language, every `score` is 10 and every answer-value triple equals `en_en`'s. So the answer key in section 2.2 (live column) holds for all 11 languages. Minor data points: Greek `ui.dontKnow` has a trailing space; `sp_sp` uses "Verdadero"/"Falso" (true/false) rather than agree/disagree; all non-English conversation line 3 entries are empty, like `en_en`.

## 8. Bugs and inconsistencies

1. **Round counter off by one**: `// should be round ==3 but round is being incremented inside hoverboard thing` then `if ( round == 2 )` (`src/ebug/junior/GameController.as:208-210`). `round` is incremented lazily inside `nextHoverboardRound`, after this test and only from the second platform round (`:253`), so the test compares against the previous round's index: at the fourth shrink it is 2, and the check works as the comment explains. The kitchen branch then does its own `round++` (`:211`) so round 5 picks `hoverboardLevels[4]`. The documentation repeats it (`doc:597-606`) and calls it "Round 3" meaning index 3 (`doc:662`). A port should use an explicit round table.
2. `NULL_KITCHEN_GAME` in the level list is never read (`:68`); the kitchen is selected by the counter test alone.
3. Game show constructed during preload: player avatar, podium and CPU name are fixed to the male branch (section 2.11; `src/ebug/junior/GameShow.as:52`, `:85-104`); `player.playerAnswers[level] = new Array()` on an undefined player (`:107-109`) never initialises the answer arrays, so all `player.playerAnswers[...][...][...] = ...` writes (`:234-269`) silently fail. Research data still works because it uses `roundAnswersBlind/Sighted`.
4. `cpu.nickname` is always "Amy" (`src/ebug/Player.as:30-32`), used in the win line (`src/ebug/junior/GameShow.as:453`).
5. Tie counts as a loss (`player.score > cpu.score`, `:452`).
6. Last question of every sighted round: no host feedback and no CPU turn (`:293-298`).
7. `showRoundText` leaves `busy = true` when switching to questions (`:164`); progress relies on the talkie's timeline callback (section 2.4).
8. Avatar label `condifent` (SWF) versus requested `"confident"` (`:227`).
9. Blind rounds promise "a great bonus later" (`levels/alpha_gameshow_round1.xml:10`) but no bonus exists.
10. Board stopwatch `timer` (`p0` to `p12`) is never driven.
11. `GameShow.player.forename = "Farrell"` (`:53`) and `GameController.newGame` `player.forename = "david"` (`src/ebug/junior/GameController.as:120`): developer leftovers, harmless.
12. Cutscene: build A XML's index 3 "Excellent!" is never shown; with the live 10-line XML, the build A cutscene would never show the last line (`finished = 9`); the privacy line is spoken after the form (section 3.2). Form pre-fills age "2" and e-mail "dont@have.one"; no validation.
13. `restartHoverboardRound` restarts the whole round from its first level, not the failed level (`src/ebug/junior/PlatformGame.as:187-191`). Possibly intended; flag for design.
14. `GameController.exit()` re-runs root frame 1 (`:325-328`), stacking a second game on the first; the host tells players to reload the page instead.
15. Loading word typo "Looding" (`src/ebug/junior/GameController.as:60`); FPS counter left visible.
16. Kitchen gets a throwaway `Player` (`movies/KitchenGame.swf` root frame 1): avatar always Harry, kitchen points never reach the real score (`src/ebug/junior/fridge/KitchenGame.as:806`, `src/ebug/junior/GameController.as:273-281`).
17. `FoodItem` objects are shared, never cloned (`KitchenGame.as:784`; `FoodItem.clone()` at `FoodItem.as:48-55` is unused): cling film and sneeze flags stick to that food for the rest of the kitchen game, so a sneezed-on "Carrots" is contaminated in every later level and an earlier cling film counts later.
18. Raw-meat hand contamination wrong index and wrong property (`KitchenGame.as:685-689`); "Raw Meat Hands", "Sneeze Hands", "Cooked Meat Shelf", "Raw Meat Shelf", "Points Awarded", "Points Deducted", "Total Points" strings unused (`:1173-1185`).
19. `badFood` not set in the BOWL case, so "Bad Food" can repeat (`:396-398`).
20. Only four admonishment slots on the outro (`movies/kitchen_game_outro.swf` frame 30; `KitchenGame.as:340-342`).
21. Level times contradict comments and the level 3 intro (60/60/60/120 versus "30 seconds", "45 seconds"; `:844-848`, `:911`, `:1024`); the clock shows 99 for a second at time-out (`:151`); malformed `</face>` in the clock HTML (`:180`).
22. Cling film overlays are not removed between kitchen levels (`:820-823`).
23. Mouldy or burst items in the wrong place get their category's location reminder (`:552-600`).
24. `validLocations` is built but never used (`:1204-1232`).
25. `timestamp()` uses day of week and no padding (`src/ebug/junior/GameController.as:165`); `player.id` is declared `Number` but holds a string.
26. `Summary_page.fla` described as the kitchen summary (`doc:393`) but only used for platform death and time-out.
27. `introductionToMicrobes_mainMenu.swf` preloaded but unused (`:86`); `levels/alpha_level11.xml` unreachable.
28. Live build (documentation only): `endOfKitchen` still calls `startNonBlindRound()` while `endofHoverboard` calls `nextRound()` (`doc:650-673`), inconsistent without further unseen changes (section 1.9).
29. The `OutputXMLFiles` template itself emits `<statment>` and `<lable>` (`doc:2018`, `doc:2041`), so every generated language file carries the typos: harmless to Flash's positional parser, fatal to those lines in Unity's name-based serializer (`unity-logic.md` section 9).

## 9. Port checklist (from this analysis)

- Screens: loader, splash, cutscene (3 lines, avatar pick, 1 line, form without e-mail, closing line), then 5 rounds as in 1.4 and 1.5, end line. Build lazily; no preload side effects.
- Talkie: 25 characters per second, click completes then advances, arrow when complete, speaker "Gameshow Host".
- Quiz: positional XML or JSON equivalent, answer order Agree/Don't Know/Disagree, +10 correct, other side +5 on wrong, 0 on don't know, CPU uniform random over the three buttons, 4-digit scoreboards, tie = loss (or decide otherwise), no time limit.
- Decide: blind round on (build A) or off (build B); feedback and CPU turn on the last question; avatar mapping; kitchen points counting.
- Kitchen: data tables 5.2 to 5.4 exactly, per-second tick, sneeze odds, scoring 5.9, three outro pages with four admonishment slots (or more, if fixing), four intros.
- Text: `translations.json` with `?lang=` selection and English fallback for UI keys.
- Do not port any network submission.
