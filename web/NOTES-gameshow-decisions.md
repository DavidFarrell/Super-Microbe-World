# Game show area: decisions and fixes

Working log for `web/js/gameshow/` (scene `gameshow`, the shared talkie, studio and art helpers).
`web/NOTES.md` sections 6, 8.2a, 8.6, 10.2 and 11.9 are the specification; this file records how
the port applies them, with sources. Source paths are relative to `reference/Junior_Game/src/ebug/`.

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
| G1 | No host feedback and no CPU turn after the last question of a sighted round (build A calls `nextRound()` at once) | Every question, including the last, gets its reply and CPU turn (build B, `doc:1911-1915`) | `GameShow.as:293-298`; NOTES 10.2 #41 |
| G2 | Player always Harry on the right podium, CPU always "Amy" | The chosen child is the player on their own podium; the other child is the CPU, named after that child (or the flow's `cpuName`) | `GameShow.as:52,85-104`; NOTES 10.2 #39 |
| G3 | The last intro line needs a second click (`showRoundText` leaves `busy = true`) | One press moves on to question 1 | `GameShow.as:147-166`; NOTES 10.2 #42 |
| G4 | Blind reaction asks for `"confident"`, which does not exist | Plays `condifent` (falls back to `cautious` until the atlas has those frames, see `web/requests/gameshow.md` #1) | `GameShow.as:227`; NOTES 10.2 #43 |
| G5 | Talkie "next" arrow shows 0.4 s after every line starts, while still typing | The arrow blinks only once the page is complete | `Talkie.as:40-59`; NOTES 10.2 #52a |
| G6 | Talkie placeholder text "df" visible at a transition | Never shown (text is drawn from the statement only) | `Talkie.as:44`; NOTES 10.2 #52 |
| G7 | Blind intro promises "a great bonus later" (never implemented) | The sentence is dropped by position (round 1 line 3, round 2 line 2; same slots in all 11 languages) | `levels/alpha_gameshow_round1.xml:10`; NOTES 11.9 #2 |

## Port decisions

1. **Language**: quiz text from `web/data/quiz/<code>.json`, code = `params.lang` (tests), else
   `settings.get('language')` (the flow's choice; i18n's `language()` stays `en` without UI
   tables, `web/requests/flow.md` #1), else English; a missing file falls back to `en.json`. Host
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
9. **Input**: 1 / 2 / 3 answer at once; up / down (or left / right) select and Enter or Space
   confirms (Space only when Up is not held, since Up and W are also jump keys); a press with
   nothing selected selects Agree rather than answering. Answers are ignored for 0.3 s after the
   board appears, so a press that dismissed the host's line cannot answer. Touch: tap a button
   (219 x 79 stage px, at least 44 CSS px on phones), tap anywhere to advance the talkie.
10. **Sound** (the original was silent, NOTES 8.5): `gsCorrect`, `gsWrong`, `gsNeutral`,
    `gsDrum` and `gsDrumroll`, `gsCrash`, `gsApplause`, `gsFanfare`, `gsBoard`, `gsLock`,
    `gsSelect`, `gsDigit`, plus the core `typeBlip` and `tap`; music track `gameshow` (C major,
    126 bpm), ducked on the board and under the pause menu.
11. **Result**: `{ playerScore, cpuScore, answers: [{ q, choice, value, score, blind, cpu }],
    round, blind, lang }` (the contract's fields plus extras).
