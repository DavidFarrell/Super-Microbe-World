# Art pipeline decisions (all screens, levels 1 to 11)

Everything the remake draws comes from the 2009 SWFs, rendered through Ruffle by `tools/swf-sheet` and packed by `tools/build-atlas.cjs` into `web/data/atlas/`. This note lists what exists, how to draw it, and the decisions behind it. The pipeline itself is documented in `tools/swf-sheet/README.md`.

## 1. Sizes and load sets

Total: 33 atlases, 67 files (66 plus `index.json`), **9.37 MiB of WebP** (9.83 MB), plus 3.8 MB of JSON (556 KB gzipped; almost all of it is rig pose data). The game show children's `condifent` and `curious` poses, the level 8 and 9 yoghurt pages and the level 1 portal page's motion were added when the areas were joined (sections 4, 5 and 7). Every atlas is a single page of at most 4096 px. "Decoded" is RGBA memory once the pages are loaded.

| Set | Atlases | WebP | JSON gzip | Decoded |
|---|---|---:|---:|---:|
| `splash` | splash | 321 KB | 1 KB | 20 MB |
| `cutscene` | gameshow-bg, gameshow-cast, cutscene | 1461 KB | 147 KB | 91 MB |
| `gameshow` | gameshow-bg, gameshow-cast | 1436 KB | 147 KB | 84 MB |
| `shrink` | shrink (zone and both shrinking avatars) | 192 KB | 106 KB | 10 MB |
| `kitchen` | kitchen, kitchen-harry, kitchen-amy | 845 KB | 124 KB | 58 MB |
| `kitchen-harry`, `kitchen-amy` | one kitchen avatar each | 164 / 252 KB | 59 / 62 KB | 8 / 10 MB |
| `summary` | summary | 11 KB | 0 KB | 9 MB |
| `level1` | tiles-kitchen, microbe-lucy, entities, hud, intro-level1 | 1121 KB | 8 KB | 48 MB |
| `level2` | tiles-skin, microbe-lucy, entities, hud, hud2, intro-r1 | 1446 KB | 9 KB | 59 MB |
| `level3` | tiles-skin, microbe-steve, entities, hud, hud2, intro-r1 | 957 KB | 11 KB | 47 MB |
| `level4` | tiles-kitchen, tiles-kitchen2, microbe-patty, entities, hud, hud2, intro-r1 | 1106 KB | 37 KB | 51 MB |
| `level5` | tiles-skin, microbe-steve, microbe-slurm, entities, hud, hud2, intro-r2 | 1284 KB | 17 KB | 79 MB |
| `level6` | tiles-skin, microbe-slurm, microbe-slarg, microbe-donna, entities, hud, hud2, intro-r2 | 1686 KB | 36 KB | 95 MB |
| `level7` | tiles-body, microbe-iggy, entities, hud, hud2, intro-r2 | 1328 KB | 19 KB | 74 MB |
| `level8`, `level9` | tiles-kitchen, tiles-kitchen2, microbe-lucy, entities2, entities, hud, hud2, intro-r3 | 1268 KB | 9 KB | 47 MB |
| `level10` | tiles-body, microbe-lucy, microbe-slurm, microbe-iggy, microbe-superinfection, entities2, entities, hud, hud2, intro-r5 | 2347 KB | 79 KB | 71 MB |
| `level11` (unreachable in the original) | tiles-body, microbe-steve, microbe-slurm, microbe-donna, microbe-iggy, entities2, entities, hud, hud2 | 1574 KB | 40 KB | 52 MB |
| `intro-level2` to `-4` / `-5` to `-7` / `-8`, `-9` / `-10` | intro-r1 / intro-r2 / intro-r3 / intro-r5 | 297 / 416 / 30 / 25 KB | 1 KB | 20 / 45 / 3 / 2 MB |
| `player-harry`, `player-amy` (unchanged) | | 755 / 783 KB | 3 KB | 16 / 14 MB |
| `extras` (in no level) | microbe-extras: Sandy, Super Colin, Super Slurm | 752 KB | 26 KB | 20 MB |

In `index.json`, each atlas's `bytes` is its WebP pages and `jsonBytes` its JSON, so a loading bar should add both (`totalBytes` and `totalJsonBytes` are the sums). Each `levelN` set lists every atlas that level draws, including `entities` and `hud`, which `sprites.js` also adds on its own. Add the player set (`player-harry` or `player-amy`) at run time. Tiles are lossless WebP (quality 1); everything else is lossy at 0.8.

## 2. Cut-out rigs (new atlas feature)

The game show host, both contestants, the kitchen avatars, the shrinking avatars and the level 2 to 11 microbes are stored as **rigs**, not one image per frame. As frames they would have cost roughly 13 MB (game show cast) plus 19 MB (microbes) of WebP at 2x, against a 12 MB budget. They are Flash cut-out animation: about 30 parts per frame moved by motion tweens. So each distinct part is rendered once and each frame is stored as a list of `[part, a, b, c, d, tx, ty]`. They look the same as whole-frame renders and stay sharp at any zoom.

- **Decomposition** (`tools/swf-sheet/rig.mjs`): a sprite whose own display list holds a mask, a blend mode or a filtered child is kept whole as one part, so masks (eyes), glows and blurs render exactly as Flash does inside that part. Other sprites are opened and their matrices and colour transforms are composed. Colour transforms are baked into the part image.
- **Checked against Ruffle** (`tools/swf-sheet/verify-rig.mjs`, whole-character render vs composed parts, mean absolute difference per channel): host, contestants and kitchen avatars 2.2 to 2.8/255, Slurm 1.7 to 2.3, Donna 2.3 to 3.0, superinfection 2.3 to 2.7 (9.6 on its glow-heavy death frames), Patty 2.7 to 7.0 (many thin anti-aliased stalks). The images are visually identical.
- **Format**: see the header of `tools/build-atlas.cjs`. A rig symbol has `"mode": "rig"` and `rig: { parts, poses, frames }`. Its ordinary `frames` array holds whole images at the **label start frames only**, so the current `sprites.drawSymbol` (which falls back to the nearest earlier drawn frame of the label) already shows a correct static pose per label.
- **Drawing**: `tools/swf-sheet/atlas-draw.js` is a dependency-free Canvas 2D reference (`drawAtlasFrame`). `web/js/flow/art.js` and `web/js/gameshow/art.js` follow it, and `web/js/platformer/sprites.js` draws rig poses for the level 2 to 11 microbes (flip and tint applied around the whole pose).
- Lucy (`microbe-lucy`) and the player avatars stay as frames (level 1, unchanged).

## 3. Symbol names and coordinate spaces

Symbol names are global (`index.json` maps each to one atlas, and `build-atlas.cjs` now refuses duplicates). Names that exist in several SWFs get a scene prefix: `gs_` (game show), `cut_` (cutscene form), `shrink_`, `kitchen_`, `food_`, `splash_`, `summary_`. Tiles, microbes, pickups and HUD pictures keep their export names.

Symbols rendered through an instance path keep that instance's placement, so they share their scene's origin and are drawn at (0, 0) in scene space:

- `gs_host`, `gs_harry`, `gs_amy`, `gs_podia`: game show set space (the set is at (0, 0) on the stage in both the game show and the cutscene). `gs_set.tracks` gives harry (592.8, 118.4), amy (649.65, 423), gsh (0.4 scale at 134.8, 87.75) and podia (172.8, 244), for reference only.
- `shrink_harry`, `shrink_amy`: stage space (the shrinking SWF root placement, scale 0.717 at (508.25, 390.1)).
- `kitchen_harry`, `kitchen_amy`: the kitchen `harry` symbol's space; draw at (65.5, 8.7) (`KitchenGame.as:1106-1108`).
- All `splash_*` layers: stage space.
- `level_intros_levelN`: the ePhone big-screen page space, exactly like level 1's `level_intros`.

Tracks recorded for such symbols are in the same space as their images (the placement is applied).

## 4. Screens

### Splash (`splash`)
The TV is split into depth layers so the engine can reproduce the 170-frame timeline (25 fps) and replace the logo. Back to front: `splash_back` (room and cabinet, static), `splash_studio` (studio picture, from frame 120), `splash_new_game` (button, frames 150-170, label omitted), [the e-Bug logo sat here: draw the title instead], `splash_casing` (screen outline), `splash_shine` (from 120: despite its name, a translucent card stuck on the glass at the top left of the screen, which carried the e-Bug smiley; the smiley is erased, see section 6), `splash_screen` (frames 1-24 dark screen with stripes, 25-119 TV static in 3 frames, stored at 1x because noise is expensive), `splash_tuning` (frames 49-134, the green bars; the "Tuning" word is device-font text, drawn by the engine in green at the text field's place), `splash_glass` (frame 1 shape until 119, frame 120 shape after). `splash_timeline` carries no art, only data: `tracks.d390` (button placement), `alphas.d390` (0 at 150 to 1 at 170), `tracks.d399` (the logo's swing from 150 to 162, for the title) and tracks for the other layers. Frame 170 stops.

### Cutscene (`cutscene`)
Same studio and cast as the game show (checked pixel-identical: host, Harry, podia and set 0.00/255; Amy 1.9/255 from a 0.1 px placement difference, and identical frame scripts). Extra: `cut_details_form` (frame 30 background with the white input boxes) and `cut_submit_button` (up, over, down) at (398.65, 275.95). At `choose_avatar` (frame 20) the set and host carry a colour transform of x 0.7 on red, green and blue: draw 30% black over them before the children and podia. The avatar buttons are invisible hit areas (Amy (436.8, 99.7), Harry (584.15, 123.7), scale 2.68 x 5.26 of a 50 px box).

### Game show (`gameshow`)
- `gs_set`: studio background without the characters and podia; the e-Bug logo on the sign behind the host is erased (the translucent panel stays).
- `gs_host` rig: labels `stop` 1, `excited` 21, `serious` 171, `disappointed` 345 (each loops, `midAnimation` scripts kept).
- `gs_harry`, `gs_amy` rigs: `stop`, `idle` (10-50), `neutral`, `cautious`, `condifent` (sic, 420), `happy`, `disappointed`, `curious` (999). The 2009 code never reached `condifent` (`GameShow.as:227` asks for the missing label "confident"), but the port plays it as the blind-round reaction (`web/NOTES.md` 10.2 #43), so it was added to the jobs' `entryLabels` when the areas were joined, with `curious` so every authored emotion exists (`web/requests/gameshow.md` #1; 126 reachable frames each). `verify-rig.mjs` gives 3.5-3.8/255 against Ruffle on the new frames; the previously shipped render of the same rigs measures the same on this machine (3.5-3.8 on frames 100, 300, 650), while the untouched host reads 2.5, so the children simply compare a little worse than the host and the new render is no worse than the old. Harry's emotions return to `idle`; Amy's loop on themselves (as authored).
- `gs_podia` with the scoreboard digits removed; `tracks.amy_score` (middle podium) and `tracks.harry_score` (right). Digits: `gs_digit` frame `zero` 1, `one` 10 ... `nine` 90, placed at `gs_podia.tracks.<who> x gs_score.tracks.<thousands|hundreds|tens|units>`.
- `gs_talkie`: labels as in `Talkie.as`; text omitted. While Flash holds `wait_for_click` (frame 20), the arrow keeps blinking on a 10-frame cycle (4 on, 6 off): loop frames 11-20. Game show position (20, 308), cutscene (15, 307.5).
- `gs_question_board` (full screen, stopwatch on `p0`), with `tracks` for the three buttons: `gs_button_agree`, `gs_button_dont_know`, `gs_button_disagree` (frames 1, 2, 3 = up, over, down; labels omitted).

### Shrinking zone (`shrink`)
`gs_shrinking_zone` (full screen) plus the `shrink_harry` / `shrink_amy` rigs: 150 frames, label `start` 1. The code plays them from frame 1 and the shrink ends at frame 150.

### Kitchen (`kitchen`)
- `kitchen_bg` and `kitchen_counter` both at (400.05, 219.05) (registration at the centre). The fridge (open), shelves, fruit bowl, cupboards and bin are part of `kitchen_bg`, as in the original; there is no closed fridge in the shipped game. Draw order: background, food in the rest points, avatar, counter, sink, current item. The rest points sit below the counter in the original.
- `kitchen_sink`: 50 frames, `tab_stop` 1 and `tab_wash_hand` 10, placed at `kitchen_counter.tracks.sink_area` (counter space). `tissues` and `clingfilm` stay in the counter image; their tracks give the click areas.
- Food: `food_<assetName>` and `food_clingfilm_<assetName>` for all 25 items in `KitchenGame.as:1236-1285`. Mouldy bread, mouldy orange and burst yogurt are their own symbols. Sneeze contamination has no art in the original. Registration is top-left; the cling film overlay goes on top at the same place and scale.
- Avatars: `kitchen_harry` and `kitchen_amy` rigs with `stop`, `idle`, `fridge`, `cupboard`, `bin`, `bowl`, `sneeze_Start` (runs into `sneeze_mid`), `sneeze_tissue_end`, `sneeze_food_end`, `wash_hands`. The cling film and window animations are unused and left out.
- **Kitchen Amy comes from `avatar_amy_Fridge.swf`**, not `kitchen_game_main.swf`. The runtime file's Amy (`amy/upper`) is unfinished: her parts are placed and removed on alternate frames, so she flickers. The shipped game never showed her, because the kitchen always used Harry (`flash-flow.md` 5.12). The same wrapper in `avatar_amy_Fridge.swf` (sprite 310) has identical geometry and a complete animation.
- Intro screens: `kitchen_intro0_bg` to `kitchen_intro3_bg` (the four JPEG pictures, rendered at 1x, which is their native resolution). On the text screens they are drawn at alpha 0.3 over black, and on level 0's "ready" frame at full alpha (`kitchen_intro0_screen.cxforms.background`). `kitchen_intro0_screen` holds data only: the Click button position (282.7, 335.4) and the invisible tutorial targets (`wrong_button0` to `4`, `right_button`, frame 50 tracks). `kitchen_click_button` is the blue button (up, over, down).
- Outro: `kitchen_outro_bg` (50% black backdrop and panel) with the Click button at (292.2, 351.9).

### Summary (`summary`)
`summary_page_bg` (50% black backdrop and panel, drawn over the frozen platform screen) and `summary_click_button` at (292.2, 351.9). `gameOver.swf` is only a text field ("Game Over :-(" on black): there is nothing to render.

## 5. Levels 2 to 11

- **Tiles**: `tiles-skin` (21 skin tiles), `tiles-body` (32 body tiles), `tiles-kitchen2` (the 11 kitchen tiles level 1 does not use: `Chop_*`, `Sugar_Tile`, the mouldy loaves and the toasts). Lossless, 2 px edge extrusion, 2x (pixel-doubled, as level 1). A check confirms that every tile and entity placed in levels 1 to 11 resolves to an atlas in that level's set.
- **Microbes** (rigs, reduced to the labels the code drives, `flash-platformer.md` 4.3-4.8): good microbes `idle`/`slide`, `be_hit`, `be_photographed`, `be_killed` (+ `walk` for Steve); bad microbes add `walk` (not Slarg, which has none) and `be_washed_away`; the superinfection keeps `idle_1` to `idle_4`, `be_hit_1` to `be_hit_3` and `be_killed`. Unused labels (`stare`, `bounce`, `be_frozen`, `munch`, `jump_*`, `flick_head`) are left out. Frames between labels that no script reaches are null.
- **Entities**: `entities2` has `milk_glass_icon` (80 frames: `start`, `tickle`, `return_to_start`, `yogurt`) and `antibiotic_pickup` (also the thrown bomb, `PlatformGame.as:800`). Soap and white blood cell pickups and projectiles are already in `entities`.
- **HUD** (`hud2`): goal pictures `steve_image`, `slurm_image`, `milk_image`, `superinfection_image` (plus the unused `sandy_image` and `slarg_image`) and mode icons `kill_icon`, `antibiotic_icon`, `yog_icon`. Choose them as `PlatformGame.as:331-362` does: photograph-good gives Lucy and the camera; photograph-specific gives the camera and Lucy, Steve, Sandy, Slarg or Slurm (**Patty has no picture**, so level 4's phone stayed black; the port composes Patty and Iggy portraits from their idle frames, `web/js/platformer/hud.js` `composePortrait()`); yoghurt gives milk and no mode icon; antibiotic gives the superinfection and no mode icon; anything else gives Slurm and the kill icon. `milk_image` shows its glass on `yogurt`, because its own frame script does `glass.gotoAndStop("yogurt")` (handled with the new `pin` job option).
- **Intro pages**: `level_intros_level2` to `level_intros_level10` are `level_intros` with only that level's frames (same frame numbers and labels as level 1's `level_intros`), in atlases grouped by round. Look them up as `level_intros_<name>` with `level_intros` as the fallback for level 1. Each page is a `stop()` frame (for example 140, 150, 160, 170, 180 for level 7), and `play()` runs to the next one, so the frames in between are real transitions. While a page is held, Flash keeps its small inset animations running (levels 1, 4, 6 and 7). The frames from one stop to the next show exactly that motion, so an engine can loop them while it waits (the loop seam is not exact). There is no `level11` label in the original.
- **The yoghurt glass on the level 8 and 9 pages** (frames 200-240): the page's glass is a `milk_image` instance, whose frame-1 script runs `glass.gotoAndStop("yogurt")`, so Flash shows the pink glass with drips (captures `105`, `106`, `109`). The `level_intros_all` render follows only constant scripts and showed plain milk, so `intro-r3` (levels 8 and 9) now comes from its own job, `level_intros_r3` (frames 190-240, `pin: { glass: "yogurt" }`, the option `milk_image` already used); no other intro frame holds a `glass` (`web/requests/levels.md` #3).
- **Backgrounds**: every level uses the same flat orange `level_background` (already in `hud`), as the Flash platformer does.
- **Extras** (`microbe-extras`, set `extras`, loaded by no level): `sandy_icon`, `super_colin_icon` and `super_slurm_icon` rigs, for a level select, encyclopaedia or quiz picture. None is placed in any alpha level. `colin_icon` is exported by no SWF, so Super Colin is the only Colin available.

## 6. Branding

The hosted build must not show the e-Bug, HPA or UKHSA names or logos (`web/NOTES.md` 11.2). Two marks carry the brand in the art: the **e-Bug logo** (the yellow-green "e-BUG" wordmark on a blue splat, with a pink dotted ring and pink microbes) and the **e-Bug smiley** (a round microbe with a smiling face and short spikes, blue on the host's podium, grey or brown as a stamp elsewhere). `web/NOTES.md` 11.2 names the podium smiley as branded, so every copy of the smiley is treated as a logo. No SWF was edited: every change is an option in a render job, so a rebuild reproduces it.

| Where | Symbol (atlas) | Change (render job) | Result |
|---|---|---|---|
| Sign behind the host, game show and cutscene | `gs_set` (gameshow-bg) | `erase` shape 336, rect [129, 112, 388, 349] (151 outlines: wordmark, splat, ring, microbes) | the sign keeps its translucent chequered panel |
| Sign in the TV picture of the splash | `splash_studio` (splash) | `erase` shape 36, same rect | as above |
| Large splash logo (sprite 57, depth 399) | none | not rendered (`excludeDepths`); `splash_timeline.tracks.d399` keeps its motion | the engine draws the "Super Microbe World" title in its place |
| Host podium, game show and cutscene | `gs_podia` (gameshow-bg) | `erase` shape 895, rect [55, 36, 106, 108] (the 8 outlines of the smiley) | plain purple podium; its light and shade split is kept |
| Host podium in the TV picture | `splash_studio` (splash) | `erase` shape 38, rect [228, 280, 279, 352] (the same 8 outlines) | as above |
| Sticker on the TV glass, top left of the screen | `splash_shine` (splash) | `erase` shape 54, rect [94, 165, 151, 233] (the smiley's 3 outlines) | a blank translucent card, like a glint on the glass |
| The same sticker inside the masked TV picture (depth 76) | `splash_studio` (splash) | `erase` shape 31, same rect | as above |
| Shopping bag on the kitchen counter | `kitchen_counter` (kitchen) | `erase` shape 637, rect [58, 31, 91, 64] (the stamp's 3 outlines) | plain brown paper bag |
| Shopping bag in the kitchen intro picture (a JPEG, shared by all four intros) | `kitchen_intro0_bg` to `kitchen_intro3_bg` (kitchen) | new `recolour` option: rect [63, 195, 97, 229], stamp colour (145, 106, 72) to bag colour (208, 154, 107), tolerance 34, `flatten` | plain bag; the tissue box that overlaps the stamp's corner is untouched |
| ePhone wordmark "e-Bug" (under the earpiece) | `e_phone` (hud, level 1) | `erase` shape 248 (unchanged since level 1) | plain earpiece |

- **Why the podium is left plain.** The job lists allow erasing or recolouring, not drawing, so the podium, bag and sticker are blanked in their own colours rather than given new art. The game show code (`web/js/gameshow/studio.js`, `drawPodiumBadge`) also draws its own plaque over the podium area; with the smiley gone from the atlas that plaque is decoration, not a cover-up, and the art is clean without it.
- **`recolour`** (new job option, `tools/swf-sheet/sheet.mjs`) is for marks painted into bitmaps, where `erase` cannot reach. Inside a rectangle it removes the mark's colour component from pixels that lie on the line between the surrounding colour and the mark's colour; pixels of any other colour are left alone. With `flatten` those pixels are set to the surrounding colour exactly, which also clears the JPEG ringing around the stamp (checked at 4x).
- **Checked and clean** (every atlas page opened and looked at): tiles (kitchen, skin, body), all microbe rigs and `microbe-extras`, `entities`, `entities2`, `hud`, `hud2`, the intro pages of every round, both player avatars, the kitchen avatars and food, the shrinking zone and avatars, the question board, the cutscene form, the talkie and the summary and outro panels. All text is left out of the atlases, so the brand name in the original's dialogue (conversation line 0) is the engine's to replace.
- **Left alone, not e-Bug or HPA:** the soup tin reads "Brambells" in script on a red label (`food_soup`), an invented pastiche of a real soup brand, and the children's trainers have three stripes. Neither is covered by the branding rule; say so if they should go too (the tin's word is a set of outlines that `erase` can take off).
- The reference screenshots in `web/screenshots/reference/` are composed from the same sheets, so they follow the same rules.

## 7. Timing model change (nested clips)

The original snapshot renderer advanced a nested clip by its parent's frame number, which freezes clips inside stopped or one-frame parents. The game show characters are built exactly like that: 125-frame emotion clips inside one-frame wrappers. With the old model the host showed 23 distinct frames out of 471; the new default (`nested: "age"`) plays every nested clip by its own age since creation and follows Flash's rules for keeping instances across loops and gotos, giving 259. `tools/swf-sheet/jobs/level1.json` pins `"nested": "frame"`, so a forced rebuild reproduces the shipped level-1 art. Under the Flash-correct model the level-1 player upper bodies gain some nested motion (Harry 141 to 161 distinct frames, Amy 154 to 170) and the level-1 intro pages 4 to 13.

Decided when the areas were joined (both renders compared frame by frame, with the art only; the simulation reads `web/js/platformer/data/clips.js`, not the atlas, so no trace can move):

- **Level-1 intro pages: re-rendered with `"nested": "age"`** (a per-job override in `jobs/level1.json`). The only visible change is the portal on the last page (frame 30): its ring now pulses through frames 30-39 as in Flash, and `intro.js` loops it while the page waits (`PAGE_LOOPS`, as for levels 4, 6 and 7). Every other page is identical. Cost: `intro-level1` grows from 25 to 44 KB and 3 to 13 MB decoded.
- **Level-1 player upper bodies: left on the frame model.** The whole difference is the eyes: a nested blink clip on a 20-frame cycle counted from frame 1 (closed at frames 5-7, 25-27, 45-47, ...). Baked into the frames, a blink lands at a fixed point of each loop, so in the 11-frame `move` and `accelerate_mid` loops the child would blink every 0.44 s, where Flash (whose eye clip keeps its own clock across the loops) blinks every 0.8 s. That is not more faithful than never blinking, so the shipped upper bodies stay as they are; a faithful blink would need the eyes drawn as their own layer on their own clock.

## 8. Not rendered, and why

- `introductionToMicrobes_mainMenu.swf`: preloaded but never shown; it holds only mx component buttons.
- `talkie.swf`: a test copy with an extra `popup` label; the game uses `eBugGameShow.swf`'s `talkie`.
- `ebug_food_sorting_game.swf` (a 1 kB stub), `fridge_game.swf` (an unused prototype), `Game_Show.swf` (an unused raster copy of the studio): not loaded by the shipped game.
- `food_throw_area` (the kitchen throw animations): unused in the original ("since throwing is broken, going straight to store").
- The platformer's own `talkie` is hidden in play (`PlatformGame.as:177`).
- There is no separate TV intro beyond the splash.
- All text is left to the engine: device fonts, run-time content and translation.

## 9. Tools added

- `tools/swf-sheet/rig.mjs` (rig rendering), `verify-rig.mjs` (rig vs Ruffle), `atlas-draw.js` (reference Canvas drawing), `compose.mjs` (full screens from the sheets or from the atlases, with a diff; the atlas-drawn screens match the sheet-drawn ones within 0.1 to 1.7/255, and 4.8 for the splash static stored at 1x), `tree.mjs` (display tree dump and pixel survey).
- New job options: instance paths (`a/b/c`, `root:#depth`), `nested`, `rig`, `entryLabels` for rigs, `depths`/`excludeDepths`, `trackDepths`, `alphaTrack`, `cxTrack`, `pin`, `ticks: "auto"`, `recolour` (section 6), and button states (a button job renders up, over, down as frames 1-3).
- `tools/atlas/coverage.mjs`: the coverage, index and budget check of section 10. Run it after every atlas build; it exits with status 1 on any gap.
- Jobs: `tools/swf-sheet/jobs/{gameshow,kitchen,flow,levels}.json`. Manifests: `tools/atlas/{gameshow,kitchen,flow,levels}.json`. Each manifest merges into `index.json`, which is written atomically.

## 10. Coverage audit (`tools/atlas/coverage.mjs`)

The script prints three tables and fails on any gap.

- **Levels 1 to 11**: every tile and entity placed (cross-checked against `reference/analysis/levels.json`), the projectile the level spawns (`white_projectile` in body levels, `soap_projectile` otherwise), `camera_flash`, `antibiotic_pickup` where antibiotics are placed (the thrown bomb and the HUD counter), the HUD (`hud.js`), the goal picture and mode icon chosen as `goalImage`/`goalMode` do, both avatars with the labels `player.js` plays, and every intro page frame from the level's label to the frame that sets `finished`. Each must draw from `levelN` plus `hud`, `entities` and a player set, which is what `sprites.js` `atlasesFor()` loads. For microbes, the milk glass and projectiles, every label the platformer plays that the symbol has must draw at its first frame. All 11 levels pass.
- **Screens**: splash, cutscene, game show, shrinking zone, kitchen and summary against `reference/analysis/flash-flow.md` (the 25 food symbols of section 5.3 and the character labels of sections 2.10 and 5.12 are read from that file). All pass.
- **Colin** is placed in no level (type 15, ids 95 and 103 appear in no level file), so no `colin_icon` art is needed; `super_colin_icon` is in `extras` for any future screen that wants him.
- **Level 11** has no intro label in the original. `bigScreen.gotoAndPlay("level11")` (`EPhone.as:20`) finds no label, so the unreachable level would have shown level 1's pages (captures 409 to 414); its JSON has no intro text, so its set carries no intro atlas.
- **Budget**: 9.83 MB of WebP (9.37 MiB) in 67 files, under 12 MB. The largest set is `level6` at 95 MB decoded, 111 MB with a player set, under about 120 MB. Atlases are never freed once decoded, so over a whole journey the decoded total grows past any one set; the flow therefore decodes ahead only what surely comes next and merely downloads what may come next (`web/js/flow/contract.md` "Loading"). Nothing needed reducing. The one easy saving, if memory gets tight, is `intro-r2` (45 MB decoded for the level 5 to 7 pages, most of it the host's portrait repeated in every page frame).

