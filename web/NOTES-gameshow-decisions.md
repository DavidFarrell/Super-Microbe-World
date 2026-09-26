# Game show area: decisions and fixes

Working log for `web/js/gameshow/` (scene `gameshow`, the shared talkie, studio and art helpers).
`web/NOTES.md` sections 6, 8.2a, 8.6, 10.2 and 11.9 are the specification and the entry point
(its section 10.2 lists these fixes, cited as [GS Gn]); this file records how the port applies
them, with sources. Source paths are relative to `reference/Junior_Game/src/ebug/`.

## Files

| File | What it is |
|---|---|
| `js/gameshow/gameshowScene.js` | The scene: loading, round title card, intro lines, questions, answers, CPU turns, verdict juice, pause, standalone results card, `__test` probe `gameshow` |
| `js/gameshow/talkie.js` | `createTalkie()`, the host's dialogue box (port of `general/Talkie.as`), shared with the flow area's cutscene and ending |
| `js/gameshow/studio.js` | `Studio`: set, host, Harry, Amy, podia, LCD scoreboards with eased counters, name tags, podium plaque (also used by the cutscene and ending) |
| `js/gameshow/board.js` | `Board`: the question board, canvas art and text plus transparent DOM answer buttons |
| `js/gameshow/art.js` | Atlas access, rig drawing (following `tools/swf-sheet/atlas-draw.js`; the flow's cutscene imports it too), `Clip` timeline player, pre-scaled copies of the large static frames |
| `js/gameshow/rules.js` | Pure scoring rules, CPU choice, reactions, blind intro filter, button labels (no browser dependencies; the spec imports it in Node) |
| `js/gameshow/sound.js` | Synthesised effects (`gs*`) and the `gameshow` music track |
| `js/gameshow/text.js`, `style.js` | Canvas text wrapping and fitting; the scene's CSS (`gs-` classes) |
| `data/lang/en/gameshow.json` | English strings (namespace `gameshow`) |
| `tests/gameshow.spec.mjs` | Playwright spec |

## Behaviour kept from the original

1. **Round order** (build B, NOTES 2.3): the round's `<normal>` intro lines, then for every
   question: "Question number N: text..." (`junior/GameShow.as:179`), the board
   (`:184-203`), the player's answer and the host's reply "<name>, you chose X.\nThis is the....
   VERDICT" (`:207-273`), then the CPU's turn "<cpu>, you chose the VERDICT" (`:304-329`).
2. **Scoring** (`:247-273`, `:312-322`, `:331-343`; `js/gameshow/rules.js`): correct adds the
   question's `score` (10) to whoever answered; wrong adds `floor(score / 2)` (5) to the other
   side; don't know adds nothing. Scores only grow and are shown on four LCD digits (0-9999).
3. **CPU**: one of the three buttons uniformly, whatever the question (`:308`), drawn from the
   seeded `gameRng` (the flow passes a per-round seed), so a run replays exactly.
4. **Reactions**: player correct: host `excited`, child `happy`; don't know: `serious` /
   `neutral`; wrong: `disappointed` / `disappointed` (`:247-273`). CPU: `happy` / `neutral` /
   `disappointed` on the CPU child only; the host keeps its animation (`:312-322`). Blind: host
   `serious`, the player's child one of `neutral`, `cautious`, `condifent` at random (`:218-228`).
5. **Timelines** run the atlas frame scripts on the 25 fps frame clock (`frame = floor(tick * 3 /
   8)`): the host loops each mood until the next (`gs_host` scripts 145/296/470); Harry's moods
   return to `idle` while Amy's loop until the next request (the `gs_amy` scripts at
   207/380/545/725/925 jump back to their own label). This asymmetry is in the SWF
   (`eBugGameShow.swf` sprites 479 and 732) and is kept; NOTES 6.1 describes only Harry's.
6. **Talkie** (`general/Talkie.as`): one character per 40 ms (`speed = 1` per 25 fps frame,
   `:26,62-77`), converted to ticks (`floor(age * 15 / 40)`); the first press completes the line,
   the second advances (`buttonClick`, `:85-99`); the arrow blinks 4 frames on, 6 off (the nested
   clip's cycle while Flash holds `wait_for_click`); Arial 20 white at talkie-local (17, 50), speaker
   "Gameshow Host" (`GameShow.as:150`), talkie at (20, 308) (`:65-67`).
7. **Board**: "Question N", the question text, "10 Points" (`:185-187`), buttons Agree / Don't
   Know / Disagree in that order (`:189-191`), placed from the `question_board` tracks. No time
   limit: the stopwatch was never driven (10.2 #53).
8. **Blind half** (build A, only when the flow passes `blind: true`): the `<blind>` intro, the
   questions with "\nBecause this is a Blind question round, you'll find out how you did later."
   (`:217`), no scores and no CPU turn (`:326-328`), then "Step right this way and prepare to
   enter the world of microbes!" (`:289`).

## Bugs fixed (intent clear)

| # | Original | Port | Source |
|---|---|---|---|
| G1 | No host feedback and no CPU turn after the last question of a sighted round (build A calls `nextRound()` at once). In the blind half the last answer's reply ("<name>, you chose X." and the blind notice) is built but never shown: the talkie goes straight to "Step right this way..." (capture 031) | Every question, including the last, gets its reply: in a sighted round the verdict and the CPU turn (build B, `doc:1911-1915`); in the blind half the echo and the blind notice, then "Step right this way..." (NOTES 11.1 #1: "Every question, including the last, gets host feedback") | `GameShow.as:278-298`; `reference/captures/index.md` 031; NOTES 10.2 #41, 11.1 #1 |
| G2 | Player always Harry on the right podium, CPU always "Amy" | The chosen child is the player on their own podium; the other child is the CPU, named after that child (or the flow's `cpuName`) | `GameShow.as:52,85-104`; NOTES 10.2 #39 |
| G3 | The last intro line needs a second click (`showRoundText` leaves `busy = true`) | One press moves on to question 1 | `GameShow.as:147-166`; NOTES 10.2 #42 |
| G4 | Blind reaction asks for `"confident"`, which does not exist | Plays `condifent`; its poses (and `curious`) are in the `gameshow-cast` atlas since the areas were joined (`web/requests/gameshow.md` #1); the fallback to `cautious` only guards an atlas built without them | `GameShow.as:227`; NOTES 10.2 #43 |
| G5 | Talkie "next" arrow shows 0.4 s after every line starts, while still typing | The arrow blinks only once the page is complete | `Talkie.as:40-59`; NOTES 10.2 #52a |
| G6 | Talkie placeholder text "df" visible at a transition | Never shown (text is drawn from the statement only) | `Talkie.as:44`; NOTES 10.2 #52 |
| G7 | Blind intro promises "a great bonus later" (never implemented) | The sentence is dropped by position (round 1 line 3, round 2 line 2; same slots in all 11 languages) | `levels/alpha_gameshow_round1.xml:10`; NOTES 11.9 #2 |
| G8 | Live `en_en` intro has "Ready ?" (rounds 1 and 2) | "Ready?", as capture 056 shows: corrected in the data by `tools/convert-text.mjs` (a counted correction, exactly 2); `rules.js` `normaliseIntro()` keeps an English-only guard that drops any space before `?` or `!` (French "Prêt ?" and "Allons-y !" are correct French spacing and stay) | `web/data/quiz/en.json` `rounds[0].intro.normal[4]`, `rounds[1].intro.normal[3]`; NOTES 6.8, 10.2 #66 |
| G9 | Known 2009 data defect: the `por_por` sighted intro of rounds 1 and 2 has the Polish points line ("Za prawidłową odpowiedź otrzymasz 10 punktów, ...") | Replaced by the Portuguese translator's own points line from rounds 3 to 5 without "Lembra-te que" ("Remember"): "Ganhas 10 pontos por cada resposta certa. Se estiver errada o outro jogador é que ganha.", which says the same as the English line. Corrected in the data by `tools/convert-text.mjs` as a counted per-language correction (exactly 2 replacements, or the tool fails; `pl_pl` keeps its sentence), which replaced the play-time override (`web/requests/gameshow.md` #3; NOTES 10.2 #65) | `Assets/Resources/TextFiles/quiz/por_por_gameshow_round1.xml`, `_round2.xml`; `web/data/quiz/por_por.json` `rounds[0].intro.normal[2]`, `rounds[1].intro.normal[1]` |
| G10 | (port bug, review) Enter or Space on the pause menu's Resume button also reached the game on the next tick: on the board it submitted the highlighted answer, in the talkie it completed or advanced the line. A gamepad A on Resume leaked the same way within the tick | `resume()` calls `input.clearAll()` (as `flow/settings.js` `close()` does), and `update()` returns early on the tick the menu resumed (a gamepad A clicks Resume from `focusNavigator()` inside the tick, after `pressedSet` is built) | `js/core/input.js:52-59,117-135`; `js/ui/dom.js:52`; spec "pause: Enter, Space or gamepad A on Resume ..." |
| G11 | (port bug, review) The mouse lit one answer while the keyboard selection lit another, and Enter picked the keyboard one (Enter on a focused answer clicks it natively) | A mouse entering an answer selects and focuses it, and a keyboard move clears the hover light, so the one lit button is the one Enter picks. Each answer the mouse enters plays the `gsSelect` blip, as an arrow press does (the flow's menus likewise play `hover` on every focus move) | `js/gameshow/board.js` `pointerenter`, `select()` |

## Port decisions

1. **Language**: quiz text from `web/data/quiz/<code>.json`, code = `params.lang` (tests), else
   `settings.get('language')` (the flow's choice, also i18n's active language), else English; a
   missing file falls back to `en.json`. Host
   lines, board heading and points are English UI strings (NOTES 7.1: English only in 2009 too).
2. **Button labels**: the most common label at each position across the language's questions
   (the `ui.*` rule of NOTES 7.2). The original never displayed per-question labels (6.3), and one
   `cz_cz` answer (round 5 question 1, "Disagree") was never translated.
3. **Question text size**: Verdana Bold 20 at 100% text size (the original field was 16), shrunk
   step by step to fit the 556 x 106 box above the buttons; it scales with Settings > Text size.
   The talkie scales too (Arial 20 x text size) and splits long text into pages at word breaks
   rather than shrinking it.
4. **Verdict timing** (juice): the score change, reactions and effects land when the typewriter
   reaches the first letter of the verdict, after a drumroll on "This is the....", instead of the
   moment the button is pressed. A press that completes the line lands it at once. The CPU's
   verdict lands the same way. Rules and outcomes are unchanged.
5. **Animations**: the children idle (their authored `idle` loop) instead of standing on frame 1;
   the host starts at `stop` and turns `excited` for the title card and intro lines (NOTES 6.4).
6. **New UI**: a round title card ("Round N" and the topic from `<name>`, or "Warm-up questions"
   in the blind half), podium name tags (the player's gold), a pause button and menu (Resume,
   Settings, Quit to title), key badges and an input hint on the board, and a results card when
   the scene is opened without a callback. None of these existed in Flash.
7. **Podium emblem**: the e-Bug smiley on the host's podium is erased in the art (NOTES 11.2,
   `web/NOTES-art-decisions.md` 6). A gold "?" medallion of the same size keeps a bright emblem
   where the original had one (`Studio.drawPodiumBadge()`, also used by the cutscene and ending).
8. **Step right this way**: said at the end of the blind half (as in build A) and, when the flow
   passes `stepRight: true`, at the end of the sighted half (a shrink follows). Otherwise the
   sighted half ends on the last CPU line and a short pause (build B: "the last CPU line leads
   straight to the shrink").
9. **Input**: 1 / 2 / 3 (or whatever `answer1`-`answer3` are bound to) answer at once; up / down (or left / right) select and Enter or Space
   confirms (Space only when Up is not held, since Up and W are also jump keys); a press with
   nothing selected selects Agree rather than answering. Answers are ignored for 0.3 s after the
   board appears, so a press that dismissed the host's line cannot answer. Touch: tap a button
   (219 x 79 stage px, at least 44 CSS px on phones), tap anywhere to advance the talkie. A mouse
   over an answer selects it (G11). Resuming from the pause menu drops the press that did it (G10).
10. **Sound** (the original was silent, NOTES 8.5): `gsCorrect`, `gsWrong`, `gsNeutral`,
    `gsDrum` and `gsDrumroll`, `gsCrash`, `gsApplause`, `gsFanfare`, `gsBoard`, `gsLock`,
    `gsSelect`, `gsDigit`, plus the core `typeBlip` and `tap`; music track `gameshow` (C major,
    126 bpm), ducked on the board and under the pause menu.
11. **Result**: `{ playerScore, cpuScore, answers: [{ q, choice, value, score, blind, cpu }],
    round, blind, lang }`, as `web/js/flow/contract.md` documents it.
12. **Blind rounds setting**: the flow owns the `blindRounds` setting and always passes `blind`
    (`js/flow/flow.js` `playQuiz()`; `js/flow/contract.md`), so a flow launch is never second-guessed
    by the scene (reading the setting there would run the blind half twice). Only when the scene
    is opened on its own (no `onComplete`, no `blind` param, e.g. `?scene=gameshow`) does it read
    `settings.get('blindRounds')` itself (undefined counts as off, NOTES 11.9 #1): it then plays the
    warm-up (blind) half first, and its results card ("Warm-up done!") offers "On to the scored
    questions", the same round's sighted half with the scores carried over.
13. **Board labels**: "Agree", "Don't Know" and "Disagree" were static DefineText in the SWF
    (white, bold, no outline; NOTES 8.6 and `flash-ruffle.md` 8.1), and the atlas's `gs_button_*`
    art has them omitted, so the port draws them: white Verdana Bold, no outline, 23 stage px at
    100% text size (the three labels measure 151 / 76.5 / 115 px wide in capture 021, which 23 px
    matches), shrunk with `fitLine` for long translations (minimum 14). Baloo stays for the port's
    own DOM UI only.
14. **Control prompts follow the bindings and the device**: the title card says
    `{Press_confirm} to start` through `ui/prompts.js` `tp()` ("Press Enter to start", "Press A to
    start" on a gamepad, "Tap to start" on touch); the board hint says "Press {key_answer1},
    {key_answer2} or {key_answer3}, or use {key_up} {key_down} and {key_confirm}" with the live
    keys (`keyFor()`), and each key badge shows the key bound to that answer (none when unbound).
    Known edge: if the player unbinds `confirm` entirely, the prompts show "?" for it (as
    `ui/prompts.js` does everywhere); the jump keys still confirm.
15. **Board hint legibility**: white Verdana Bold 17 stage px at full opacity with a dark outline
    (about 14 CSS px on a 667 x 375 phone; white on the board blue is above 5:1 before the outline),
    fitted to 700 px for long remapped key names.
16. **Name tags**: 15 px, shrinking to no less than 13 stage px (11 CSS px or more on a 667 px wide
    phone), then cut with an ellipsis at 112 px of text, so two long tags (centres 136 px apart)
    never overlap. The talkie and the results card show the whole nickname.
17. **Memory**: the pre-scaled copies of the set, board, podia and talkie frames (about 12 MB on a
    2x phone) are released in the scene's `exit()` (`art.js` `releaseBlits()`); the cutscene and
    ending rebuild their own on first draw.
18. **Reduced motion**: the pause and results cards skip their bounce-in when either the OS
    preference or the game's own Reduced motion setting (`html.reduced-motion`) is on.
19. **Gallery shot**: `gameshow-verdict.png` is taken once the player's verdict has landed (board
    gone, host `excited`, the +10 popup showing) rather than on the first frame of the CPU turn,
    which caught the board still fading out.

## Verification

- `web/tests/gameshow.spec.mjs` (10 tests): full rounds by keyboard (1/2/3, arrows + Enter, Space)
  and by touch taps with per-step score checks against `rules.js`; all 11 languages x 5 rounds
  (231 boards, every intro line as normalised by `normaliseIntro()` and every question read; no
  space before `?` in English, no Polish in `por_por`); the blind half; talkie timing and paging;
  pause and quit with 44 px targets; standalone play with the results card; the blind-rounds
  setting when standalone; Enter, Space and gamepad A on Resume neither answer the board nor move
  the talkie (G10; the test fails with either half of the fix removed); mouse hover and keyboard
  selection agree and Enter picks the lit answer (G11); key badges, hint and title prompt follow a
  remapped key and the device; 23 px labels; long name tags; the reduced-motion class stops the
  card animation; the blit cache is empty after the scene exits.
- The flow's cutscene and ending use `createTalkie`, `Studio`, `art.js` and `sound.js`; the flow
  spec (`web/tests/flow.spec.mjs`) covers them and passes.
