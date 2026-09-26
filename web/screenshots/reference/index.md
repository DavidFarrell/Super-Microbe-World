# Flash reference screens

These 800 x 450 images are the "Flash reference" column of the fidelity gallery. Ruffle cannot click past the splash, so each screen is composed from the original SWFs instead: every element is a Ruffle render of the original symbol (the cached sheets in `tools/.cache/sheets`, 2x, drawn at 1x), and every position comes from the SWFs themselves (root timelines, instance placements, the tracks recorded by the render jobs) or from the `attachMovie` coordinates in the AS2 source. Nothing is hand placed.

Regenerate with:

```sh
node tools/swf-sheet/compose.mjs --source sheets --out-dir web/screenshots/reference
node tools/swf-sheet/compose.mjs --source both        # also draws each screen from the shipped atlases and diffs the two
```

The scene definitions are at the bottom of `tools/swf-sheet/compose.mjs`.

## What is deliberately different from the running original

- **No text.** Dynamic text (host lines, question text, scores in text fields, form labels, the clock, the level timer) is filled in by code at run time, and static button labels are translated by the remake, so all text is left out. The remake draws its own.
- **No e-Bug branding.** The e-Bug logo on the studio sign (in the studio and in the TV picture of the splash), the large splash logo, the e-Bug smiley (on the host's podium, on the sticker at the top left of the TV glass and on the shopping bag in the kitchen and its intro picture) and the ePhone wordmark are removed, as in the atlases (`web/NOTES-art-decisions.md` section 6). The hosted build must not carry third-party branding.
- **Animation phase.** Characters are shown at the first frame of the label named below. The original was usually mid-animation when a screen appeared.
- **Nothing that only exists after play starts:** no bullets, popups, sparkles or placed food.

## Screens

| File | Composed from |
|---|---|
| `splash-tuning.png` | `splash.swf` TV (sprite 58, root placement 0.983 x 0.979 at (5.9, -69)) at frame 60: room and TV body (depths 0-71), TV static (depth 486), screen outline (485), "Tuning" bars (490, text omitted), glass (496), on black. |
| `splash-new-game.png` | The same TV at frame 170: studio picture (depths 72-398, sign logo and podium smiley erased), New Game button (depth 390, full alpha at 170, label omitted), outline, the sticker on the glass (489, its smiley erased) and the second glass shape. The e-Bug logo (sprite 57, depth 399) is left out. |
| `cutscene-host.png` | `cutscene_introduction.swf` frame 10 layout: studio set, host at the first frame of `excited`, Harry and Amy at the first frame of `idle`, podia with 0000 on both scoreboards, talkie at (15, 307.5) on its `wait_for_click` frame (arrow showing). |
| `cutscene-avatar-choice.png` | Frame 20 (`choose_avatar`): set and host with their colour transform (x 0.7 on red, green and blue, drawn as 30% black over them), host on `stop`, children on `idle`, podia. The two avatar buttons are invisible hit areas. |
| `cutscene-details-form.png` | Frame 30 (`get_details`): the form background (sprite 848 and the input boxes) and the Submit button at (398.65, 275.95). Labels and inputs are text. |
| `gameshow.png` | `eBugGameShow.swf`: `gameshow_set` at (0, 0) as `GameShow.as:59` attaches it, host `excited`, children `idle`, scores 0055 (Amy, middle podium) and 0225 (Harry, right podium) through the podium and score tracks, talkie at (20, 308) (`GameShow.as:66-67`). |
| `gameshow-question-board.png` | `question_board` with the three answer buttons at their instance positions (up state, labels omitted) and the unused stopwatch on `p0`. |
| `shrink.png` | `shrinking_zone` at (0, 0) and `shrinking_harry.swf`'s avatar at frame 1 (its root placement, scale 0.717 at (508.25, 390.1)), on white. |
| `kitchen.png` | `kitchen_game_main.swf` root: `kitchen_bg` and `kitchen_counter` at (400.05, 219.05), Harry (`harry` symbol, `idle`) at (65.5, 8.7) behind the counter (`KitchenGame.as:1106-1114`), the sink on `tab_stop`. |
| `kitchen-intro.png` | `kitchen_game_intro_level_0.swf` frame 10: the kitchen picture at 30% alpha over black (its colour transform on the text screens) and the Click button (label omitted). |
| `kitchen-outro.png` | `kitchen_game_outro.swf` frame 10: 50% black backdrop, panel and Click button, over black. |
| `summary.png` | `summary_page.swf`: 50% black backdrop, panel and Click button, over the platform level's orange, which is what shows behind it in the game. |
| `level1-opening.png` to `level11-opening.png` | The level XML resolved through `levels/tile_definitions.xml` (`reference/analysis/levels.json`), camera at x = 0: orange backdrop (shape 1495), every tile and entity at (col x 50, row x 50), microbes at the first frame of `idle` (the superinfection `idle_1`, the milk glass `start`), Harry (`lower` and `upper`, frame 10) at the player start, and the HUD from the platformer's root timeline: score 0000, three hearts, the resting ePhone (frame 2) with the goal picture and mode icon chosen as in `PlatformGame.as:331-362` and one empty tick box per required goal. Level 4 has no goal picture because the original has none for Patty. Level 11 is unreachable in the original but is included. |
