# Flash SWF assets: inventory, extraction and mapping

Source of truth: the 2009 Flash original in `reference/Junior_Game` (all 71 `.swf` files, including the stray top-level `ad.swf` and the three APE physics demos under `src/`). Everything below was produced by [`tools/analyse-swfs.mjs`](../../tools/analyse-swfs.mjs) and checked by hand where stated.

Outputs:

| File | What it holds |
|---|---|
| [`swf-inventory.json`](swf-inventory.json) | Per SWF: header, tag counts by real tag code, every ExportAssets/ImportAssets entry, every exported sprite (frame count, frame labels, frame scripts, frame-1 and all-frames bounds, named children, bitmaps used, vector-only flag), notable internal sprites, fonts, bitmaps, sounds, the level-XML and source-code linkage cross-reference, and the list of SWFs the shipped game loads. |
| [`bitmaps/<key>/<id>.png\|.jpg`](bitmaps/) | All 543 embedded bitmaps, decoded. `<key>` is the SWF path under `reference/Junior_Game/movies/` with `/` turned into `__` and other unsafe characters into `_` (`root__ad` is the top-level `ad.swf`; `src__physics__...` are the APE demos). |
| [`swf-scripts/<key>.txt`](swf-scripts/) | Decompiled ActionScript 2 timeline code for 61 SWFs: every frame script, button handler, `onClipEvent` handler and `#initclip` block. The compiled classes (`__Packages.*`) are left out because their source is in `reference/Junior_Game/src`. |
| `sounds/` | Not created: there are no sounds (section 6). |

Run it again with `node tools/analyse-swfs.mjs` (about 16 s). `--no-extract` skips writing bitmaps; `--no-browser` skips the headless Chromium JPEG decoder (DefineBitsJPEG3 then comes out as `<id>.jpg` plus `<id>_alpha.png`).

Conventions: frame numbers are 1-based as in the Flash IDE. Bounds are in pixels (twips / 20) in the symbol's own coordinate space, written `w×h at (x, y)` where (x, y) is the top-left corner relative to the symbol's registration point. "Frame-1 bounds" is what `_width`/`_height` return straight after `attachMovie` (the platform physics sizes every box from this: see `reference/docs/junior-game-documentation.md`, section "State: STATE_LOAD_TILES"). "All-frames bounds" is the union over every frame of the symbol's own timeline, with nested clips advanced by their own playheads (unconditional `stop()`/`gotoAndPlay()` frame scripts are honoured, code-driven jumps are not), so treat it as an approximate canvas size for pre-rendering. Masks are not applied to bounds (the `hasMask` flag in the JSON says where they occur).

## 1. Headline findings

1. **There is no audio anywhere.** None of the 71 SWFs contains a DefineSound, StartSound, StartSound2, DefineButtonSound, SoundStreamHead, SoundStreamHead2 or SoundStreamBlock tag, at the top level or inside any sprite (checked by a raw walk of every tag header, independent of swf-parser). The AS2 source has no `new Sound`, `attachSound`, `loadSound`, `.mp3` or `.wav`, and the Unity remake's `Assets/` holds no audio files either. The original game is silent; any audio in the remake is new work.
2. **Every SWF is `CWS` (zlib-compressed), SWF version 8, ActionScript 1/2 (AVM1).** There is no DoABC tag, so no AS3 anywhere. The main movie and every screen it loads run at **800×450, 25 fps** except `introductionToMicrobes_mainMenu.swf` (12 fps, 1 frame, only mx buttons) and the shrinking avatars (24 fps); the stage size of a SWF loaded into a holder clip (`amy.swf` 550×400, `harry.swf` 1000×600, `junior_game_assets.swf` 800×600) has no effect.
3. **Bitmaps are used for tiles, pickups and projectiles; characters, GUI and scenes are vectors.** All 92 tile symbols are one bitmap each (DefineBitsJPEG3, DefineBitsLossless/2 or DefineBits), and the Unity `Assets/Textures/Tiles` PNGs are the same pixels (mean absolute difference 0 to 6.2 on a 0-255 scale; most Flash copies are JPEG-compressed, the Unity ones are lossless), so the Unity tile PNGs are the better source. The soap and white-blood-cell pickups (28 bitmap frames each), projectiles, camera flash, milk glass, antibiotic, the hoverboard and the kitchen intro backdrops are also bitmaps. Microbes, Amy and Harry (apart from hoverboard and soap bottle), the host, the studio, ePhone, HUD, kitchen scene and food are vector art and must be rendered to images or redrawn.
4. **Tiles reach the platformer through a runtime shared library.** `introductionToMicrobes_platformer.swf` exports none of the `*_tile`/`*_obj`/`*_Tile` names; it imports `shared_library_link` (its id 1496) from `junior_game_assets.swf` (id 622 there) with ImportAssets2, and `junior_game_assets.swf` exports all 92 tiles. Every `<movie>` placed in `levels/alpha_level1.xml` to `alpha_level11.xml` resolves through that chain or through the platformer's own exports (section 8).
5. **The SWFs carry timeline code that is not in `src/`.** Microbe, avatar and GUI animations are driven by frame scripts (`midAnimation` flags, `gotoAndPlay("idle")` loops, `var lives = 6` in the superinfection clip). They are decompiled in `swf-scripts/` and summarised per state below.
6. **Linkage names are not clean.** Three Harry body parts have a leading space in every SWF that exports them (`" Harry_Hand_R_Skin_12"`, `" Harry_Hand_R_Skin_11"`, `" Harry_Hand_L_Skin_11"`), `eBugGameShow.swf` id 280 is exported as `Amy_Eyes_Game_Default_Skin_02Harry_Eyes_Game_Cautious_Skin_02` (two names run together), `EBug Level Editor.swf` exports id 590 as a single space, and several labels are misspelt (section 11). Match names byte-exactly or trim deliberately.

## 2. What the tool does, and how it was verified

- **Parsing.** Tag counts come from a raw walk of the decompressed file (`rawWalk`), which keeps the real tag codes (DefineShape 1-4, DefineBits/JPEG2/JPEG3/Lossless/Lossless2 and every sound tag), recursing into DefineSprite. Structured data comes from `swf-parser` 0.14.1. swf-parser gives up on 28 morph shapes (8 each in `introductionToMicrobes_platformer.swf` and `introductionToMicrobes_platformer9.swf`, 4 in `EBug Level Editor.swf`, 2 each in both `ad.swf`, `ad2.swf` and `Colin_motion.swf`) and on 3 DebugID tags; they are listed per SWF under `unparsedBySwfParser`, and the morph shapes' StartBounds/EndBounds are read directly so bounds stay correct.
- **Header values.** Stage = FrameSize twips / 20; frame rate = `frameRate.epsilons / 256` (8.8 fixed point, 6400/256 = 25); frame count from the header, cross-checked against ShowFrame tags.
- **Display lists.** Each sprite's timeline is simulated (PlaceObject 1/2/3 including move/replace, RemoveObject 1/2, ShowFrame, FrameLabel, DoAction) to get labels per frame (frame = 1 + ShowFrames before the FrameLabel; several labels can share a frame), named instances, clip masks and bounds (child rectangle transformed by the placement matrix, axis-aligned, as Flash does for `_width`).
- **Scripts.** A small stack-based AVM1 decompiler (`decompileAvm1`) turns DoAction/DoInitAction/button/clip-event bytecode into readable statements. It handles the constant pool, registers (including DefineFunction2 preloaded `this`/`_parent`/`_root` and parameter registers), members, calls, function bodies and property get/set; branches are printed as `if (cond) jump N bytes`.
- **Bitmaps.** DefineBitsLossless/2: zlib-inflate, then colour-mapped (palette RGB for v1, RGBA for v2, rows padded to 4 bytes), 15-bit RGB (v1) or 32-bit (`X R G B` for v1, `A R G B` premultiplied for v2, un-premultiplied on output); the inflated length is checked against the expected size (no mismatches). DefineBits (JPEG1): the SWF's JPEGTables are merged in and every SOI/EOI before the first SOS removed (this also strips Flash's erroneous `FFD9 FFD8` prefix). DefineBitsJPEG2/3: same JPEG clean-up; JPEG3's zlib alpha plane (one byte per pixel) is applied after decoding the JPEG in headless Chromium through Playwright. PNGs are written by a minimal encoder (IHDR, one IDAT with filter 0, IEND; CRC via `zlib.crc32`).
- **JPEG3 alpha is premultiplied.** The spec does not say; it was measured on all 300 JPEG3 bitmaps: where alpha is 0 the mean of max(R,G,B) is 0.37 to 23.6 (black), and for alpha 16-127 the median ratio max(R,G,B)/alpha is 0.39 to 1.31, while straight-alpha art would sit near opaque-colour/alpha (the opaque pixels average 83 to 244, so about 3 and up). All 300 test as premultiplied and were un-premultiplied before PNG encoding (values clamp at 255 where JPEG noise pushes colour above alpha). The measurements are in `bitmaps[].alphaCheck` in the JSON.
- **Checks done.** Every written PNG was re-read (chunk CRCs, IDAT inflates to exactly (w×channels+1)×h bytes); every JPEG starts with FFD8 and ends with FFD9 and all 53 decode in Chromium to the dimensions in the tag header; contact sheets of tiles, lossless art, the TV-static frames, a JPEG with shared tables, JPEG3 pickups and the hoverboard pieces were inspected by eye; the tiles, pickups, projectiles, camera flash, antibiotic, milk and studio bitmaps were compared pixel by pixel with the Unity PNGs in headless Chromium (section 9; this comparison was a one-off script, not part of the tool, and its results are the numbers quoted in 5.1 and 9).
- **Sound code paths.** MP3 (write DefineSound data after the 2-byte SI16 SeekSamples, check the 0xFFE frame sync, walk MPEG-1/2 layer III frame headers for a duration), IMA-style SWF ADPCM (2-bit code size, 4096-sample packets of SI16 sample + UB[6] step index, 2 to 5-bit sign-magnitude codes, spec step and index tables) and raw PCM to 16-bit WAV, plus SoundStreamHead/Block collection, are implemented but **untested on real data: no SWF in this project contains a sound**. The helpers were only smoke-tested on synthetic input (an ADPCM bit stream decodes to the requested sample count in mono and stereo, a three-frame 128 kbit/s MPEG-1 layer III stream walks to 3,456 samples, 0.08 s).

## 3. Per-SWF summary

"Run-time" means the shipped game loads the file: `e-Bug Junior Game.swf` (the main movie) loads the list in `reference/Junior_Game/src/ebug/junior/GameController.as:83-92` (junior_game_assets, splash, eBugGameShow, introductionToMicrobes_mainMenu, cutscene_introduction, introductionToMicrobes_platformer, harry, amy, summary_page, KitchenGame); `KitchenGame.as:121-126` adds kitchen_game_main, kitchen_game_intro_level_0-3 and kitchen_game_outro; `ShrinkingZone.as:25-26` loads shrinking_harry and shrinking_amy; `PlatformGame.as:166-168` and `fridge/FridgeMain.as:43` load amy/harry into the `avatar` holder. The documentation says the subfolders of `movies/` are not used at run time (`reference/docs/junior-game-documentation.md`, "Movies Folder"). Everything else is an editor, test, demo or superseded build. `introductionToMicrobes_mainMenu.swf` is preloaded but never shown: `GameController.as:99-107` assigns a holder to every preloaded SWF except it, and its two buttons call `gotoGameScreen("introductionToMicrobes_comicIntroduction.swf")` and `gotoGameScreen("blue_box.swf")`, a method that sits inside a comment block (`GameController.as:336-375`). The timeline code in `swf-scripts/` was searched too: no other `.swf` is loaded by a run-time SWF, and its only `attachMovie` literal (`spring_onion` in `kitchen_game_main.swf`) resolves. "Exports art / AS2 class" counts ExportAssets names that are symbols versus `__Packages.*` class registrations.

| SWF (under reference/Junior_Game/) | Run-time | KB | Stage | fps | Frames | Bg | Script | Shapes (+morph) | Sprites | Bitmaps | Fonts | Text static/edit | Buttons | Labels | Exports art / AS2 class |
|---|---|---:|---|---:|---:|---|---|---:|---:|---:|---:|---|---:|---:|---|
| movies/e-Bug Junior Game.swf | yes | 87.4 | 800×450 | 25 | 135 | #000000 | AS2 + classes | 7 | 88 | 0 | 3 | 0/4 | 1 | 2 | 20 / 65 |
| movies/junior_game_assets.swf | yes | 267.2 | 800×600 | 25 | 1 | #000000 | AS2 + classes | 262 | 283 | 103 | 0 | 0/0 | 0 | 4 | 185 / 26 |
| movies/splash.swf | yes | 46.0 | 800×450 | 25 | 1 | #000000 | AVM1 timeline only | 42 | 10 | 3 | 1 | 0/2 | 0 | 10 | 1 / 0 |
| movies/eBugGameShow.swf | yes | 201.9 | 800×450 | 25 | 1 | #000000 | AS2 + classes | 482 | 417 | 1 | 2 | 4/12 | 5 | 48 | 157 / 23 |
| movies/introductionToMicrobes_mainMenu.swf | yes | 26.9 | 800×450 | 12 | 1 | #ffffff | AS2 + classes | 7 | 45 | 0 | 0 | 0/0 | 1 | 0 | 20 / 24 |
| movies/cutscene_introduction.swf | yes | 195.2 | 800×450 | 25 | 59 | #000000 | AS2 + classes | 449 | 408 | 1 | 2 | 3/14 | 3 | 39 | 154 / 16 |
| movies/introductionToMicrobes_platformer.swf | yes | 766.2 | 800×450 | 25 | 40 | #0099cc | AS2 + classes | 646 (+248) | 526 | 66 | 2 | 1/48 | 2 | 216 | 61 / 39 |
| movies/harry.swf | yes | 56.6 | 1000×600 | 25 | 1 | #2c2c2c | AVM1 timeline only | 89 | 98 | 6 | 0 | 0/0 | 0 | 27 | 54 / 0 |
| movies/amy.swf | yes | 63.2 | 550×400 | 25 | 1 | #ffffff | AVM1 timeline only | 95 | 107 | 6 | 0 | 0/0 | 0 | 27 | 59 / 0 |
| movies/summary_page.swf | yes | 4.5 | 800×450 | 25 | 139 | #cccc00 | AVM1 timeline only | 6 | 1 | 0 | 2 | 1/5 | 1 | 1 | 0 / 0 |
| movies/KitchenGame.swf | yes | 11.9 | 800×450 | 25 | 1 | #000000 | AS2 + classes | 2 | 7 | 0 | 1 | 0/2 | 0 | 1 | 0 / 5 |
| movies/kitchen_game_main.swf | yes | 157.2 | 800×450 | 25 | 1 | #2c2c2c | AS2 + classes | 422 | 391 | 0 | 2 | 0/49 | 12 | 55 | 186 / 16 |
| movies/kitchen_game_intro_level_0.swf | yes | 45.4 | 800×450 | 25 | 90 | #000000 | AS2 + classes | 6 | 5 | 1 | 1 | 1/14 | 1 | 9 | 0 / 3 |
| movies/kitchen_game_intro_level_1.swf | yes | 45.8 | 800×450 | 25 | 49 | #000000 | AS2 + classes | 5 | 5 | 1 | 1 | 1/9 | 1 | 5 | 0 / 4 |
| movies/kitchen_game_intro_level_2.swf | yes | 45.1 | 800×450 | 25 | 49 | #000000 | AS2 + classes | 5 | 4 | 1 | 1 | 1/9 | 1 | 5 | 0 / 3 |
| movies/kitchen_game_intro_level_3.swf | yes | 50.5 | 800×450 | 25 | 49 | #000000 | AS2 + classes | 5 | 6 | 1 | 1 | 1/9 | 1 | 5 | 0 / 5 |
| movies/kitchen_game_outro.swf | yes | 15.1 | 800×450 | 25 | 100 | #cccc00 | AS2 + classes | 7 | 6 | 0 | 2 | 1/77 | 1 | 4 | 0 / 5 |
| movies/shrinking_harry.swf | yes | 31.5 | 800×450 | 24 | 1 | #ffffff | AS2 + classes | 93 | 114 | 5 | 0 | 0/0 | 0 | 2 | 62 / 20 |
| movies/shrinking_amy.swf | yes | 35.5 | 800×450 | 24 | 1 | #ffffff | AS2 + classes | 109 | 108 | 5 | 0 | 0/0 | 0 | 2 | 58 / 14 |
| ad.swf |  | 163.2 | 300×154 | 12 | 110 | #ffffff | AVM1 timeline only | 181 (+10) | 142 | 6 | 0 | 0/0 | 0 | 43 | 55 / 0 |
| movies/ad.swf |  | 184.9 | 300×154 | 12 | 110 | #ffffff | AS2 + classes | 217 (+18) | 178 | 6 | 0 | 0/0 | 0 | 53 | 56 / 15 |
| movies/ad2.swf |  | 313.6 | 300×151 | 12 | 50 | #ffffff | AS2 + classes | 410 (+58) | 354 | 12 | 0 | 0/0 | 0 | 106 | 115 / 26 |
| movies/animation_test_dummy.swf |  | 35.6 | 550×400 | 25 | 1 | #ffffff | AS2 + classes | 123 | 105 | 0 | 2 | 4/0 | 7 | 5 | 52 / 15 |
| movies/antibiotic_pickup.swf |  | 1.0 | 550×400 | 12 | 1 | #ffffff | none | 1 | 1 | 1 | 0 | 0/0 | 0 | 0 | 1 / 0 |
| movies/assets/KitchenGame.swf |  | 0.4 | 800×450 | 25 | 1 | #000000 | AS2 + classes | 0 | 1 | 0 | 0 | 0/0 | 0 | 0 | 0 / 1 |
| movies/avatar_amy_Fridge.swf |  | 106.9 | 800×450 | 25 | 1 | #2c2c2c | AS2 + classes | 233 | 232 | 0 | 1 | 12/0 | 12 | 40 | 92 / 13 |
| movies/avatar_harry_Fridge.swf |  | 89.2 | 800×450 | 25 | 134 | #2c2c2c | AS2 + classes | 208 | 189 | 0 | 1 | 0/48 | 12 | 41 | 64 / 11 |
| movies/blue_box.swf |  | 0.1 | 50×50 | 24 | 1 | #ffffff | none | 1 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| movies/cut_scene_director.swf |  | 185.9 | 800×450 | 25 | 70 | #000000 | AS2 + classes | 448 | 406 | 1 | 1 | 1/8 | 2 | 39 | 154 / 16 |
| movies/dialogue_tutorial.swf |  | 20.7 | 800×450 | 12 | 25 | #ffffff | AS2 + classes | 0 | 2 | 0 | 1 | 0/1 | 0 | 1 | 1 / 1 |
| movies/EBug Level Editor.swf |  | 913.7 | 1180×700 | 24 | 1 | #ffffff | AS2 + classes | 652 (+204) | 647 | 154 | 0 | 0/0 | 1 | 187 | 223 / 79 |
| movies/ebug_food_sorting_game.swf |  | 1.0 | 800×450 | 25 | 1 | #666666 | AS2 + classes | 0 | 1 | 0 | 0 | 0/0 | 0 | 1 | 0 / 1 |
| movies/Expression Test with Class Method.swf |  | 29.9 | 300×490 | 12 | 1 | #ffffff | AS2 + classes | 86 | 59 | 0 | 0 | 0/0 | 0 | 14 | 25 / 10 |
| movies/fridge_game.swf |  | 410.4 | 800×450 | 60 | 50 | #ffffff | AS2 + classes | 36 | 73 | 0 | 4 | 2/20 | 1 | 7 | 41 / 24 |
| movies/Game_Show.swf |  | 265.0 | 800×450 | 25 | 1 | #232323 | AVM1 timeline only | 490 | 427 | 2 | 4 | 29/0 | 10 | 20 | 181 / 0 |
| movies/gameOver.swf |  | 17.0 | 800×450 | 12 | 1 | #000000 | none | 0 | 0 | 0 | 1 | 0/1 | 0 | 0 | 0 / 0 |
| movies/ghd_demo.swf |  | 249.6 | 800×450 | 25 | 664 | #000000 | AS2 + classes | 519 | 429 | 4 | 3 | 6/22 | 6 | 64 | 161 / 22 |
| movies/introductionToMicrobes_comicIntroduction.swf |  | 236.7 | 800×450 | 12 | 20 | #999999 | AS2 + classes | 176 | 159 | 1 | 0 | 0/0 | 0 | 2 | 78 / 22 |
| movies/introductionToMicrobes_exitQuiz.swf |  | 230.1 | 800×450 | 12 | 20 | #999999 | AS2 + classes | 181 | 161 | 1 | 0 | 0/0 | 0 | 2 | 78 / 23 |
| movies/introductionToMicrobes_platformer_Scene 1.swf |  | 54.2 | 800×450 | 60 | 40 | #ccff66 | AS2 + classes | 71 | 83 | 0 | 1 | 0/1 | 0 | 5 | 39 / 39 |
| movies/introductionToMicrobes_platformer9.swf |  | 614.0 | 800×750 | 25 | 40 | #0099cc | AS2 + classes | 551 (+168) | 467 | 87 | 1 | 0/16 | 1 | 162 | 161 / 30 |
| movies/introductionToMicrobes.swf |  | 44.6 | 800×450 | 60 | 135 | #000000 | AS2 + classes | 7 | 46 | 0 | 1 | 0/1 | 1 | 2 | 20 / 24 |
| movies/level_intros.swf |  | 148.4 | 800×450 | 25 | 1 | #cc3366 | AVM1 timeline only | 200 (+80) | 150 | 0 | 1 | 0/22 | 0 | 53 | 14 / 0 |
| movies/map_builder.swf |  | 90.8 | 1000×450 | 24 | 1 | #ffffff | AS2 + classes | 48 | 149 | 1 | 0 | 0/0 | 1 | 0 | 94 / 52 |
| movies/Microbes_Motions/Colin_motion.swf |  | 105.1 | 1000×600 | 25 | 1 | #2c2c2c | AVM1 timeline only | 92 (+10) | 44 | 0 | 0 | 0/0 | 0 | 16 | 1 / 0 |
| movies/Microbes_Motions/Donna_motion.swf |  | 30.7 | 1000×600 | 25 | 1 | #2c2c2c | AVM1 timeline only | 39 (+16) | 33 | 0 | 0 | 0/0 | 0 | 11 | 1 / 0 |
| movies/Microbes_Motions/Steve_motion.swf |  | 12.8 | 1000×600 | 25 | 1 | #2c2c2c | AVM1 timeline only | 33 (+16) | 12 | 0 | 0 | 0/0 | 0 | 14 | 1 / 0 |
| movies/new portal.swf |  | 0.3 | 800×450 | 25 | 1 | #000000 | none | 1 | 2 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| movies/platformTest.swf |  | 34.9 | 800×450 | 25 | 1 | #000000 | AS2 + classes | 0 | 38 | 0 | 0 | 0/0 | 0 | 0 | 0 / 38 |
| movies/red_box.swf |  | 0.1 | 50×50 | 24 | 1 | #ffffff | none | 1 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| movies/Sandy Art/Liquid Soap.swf |  | 21.9 | 550×400 | 24 | 1 | #ffffff | none | 28 | 1 | 28 | 0 | 0/0 | 0 | 0 | 1 / 0 |
| movies/Sandy Art/milk.swf |  | 12.6 | 150×200 | 25 | 20 | #000000 | AVM1 timeline only | 3 | 1 | 3 | 0 | 0/0 | 0 | 4 | 0 / 0 |
| movies/Sandy Art/White Blood Cell Pick Up.swf |  | 30.7 | 49×49 | 24 | 1 | #ffffff | none | 28 | 1 | 28 | 0 | 0/0 | 0 | 0 | 1 / 0 |
| movies/Sandy Art/White Blood Cell Projectile.swf |  | 1.3 | 550×400 | 24 | 1 | #ffffff | AVM1 timeline only | 1 | 2 | 1 | 0 | 0/0 | 0 | 1 | 2 / 0 |
| movies/senior/BI2_mask.swf |  | 11.1 | 800×450 | 12 | 121 | #000000 | AS2 + classes | 27 | 29 | 0 | 0 | 0/0 | 0 | 0 | 25 / 3 |
| movies/senior/BI2_Scene 1.swf |  | 45.3 | 800×450 | 12 | 50 | #000000 | AS2 + classes | 101 | 92 | 0 | 1 | 0/9 | 0 | 3 | 25 / 3 |
| movies/senior/BI2_Symbol 1.swf |  | 279.6 | 800×450 | 12 | 20 | #000000 | AVM1 timeline only | 27 | 28 | 0 | 1 | 0/1 | 0 | 0 | 25 / 0 |
| movies/senior/BI2.swf |  | 343.0 | 800×450 | 12 | 76 | #000000 | AS2 + classes | 141 | 119 | 1 | 3 | 0/8 | 0 | 3 | 25 / 3 |
| movies/Shrinking Zone_Harry.swf |  | 31.5 | 800×450 | 24 | 1 | #ffffff | AS2 + classes | 93 | 114 | 5 | 0 | 0/0 | 0 | 2 | 62 / 20 |
| movies/talkie.swf |  | 6.1 | 800×450 | 25 | 1 | #000000 | AS2 + classes | 9 | 4 | 1 | 1 | 1/11 | 2 | 6 | 1 / 1 |
| movies/test submit form.swf |  | 0.6 | 550×400 | 12 | 1 | #ffffff | AVM1 timeline only | 1 | 1 | 0 | 1 | 0/1 | 0 | 0 | 0 / 0 |
| movies/test.swf |  | 11.8 | 550×400 | 12 | 1 | #ffffff | none | 1 | 1 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| movies/tests/CollissionTest.swf |  | 46.5 | 800×450 | 60 | 1 | #ffffff | AS2 + classes | 70 | 70 | 0 | 1 | 0/5 | 0 | 2 | 37 / 27 |
| movies/tests/CollissionTest2.swf |  | 44.2 | 800×450 | 60 | 1 | #ffffff | AS2 + classes | 67 | 71 | 0 | 1 | 0/5 | 0 | 0 | 37 / 28 |
| movies/tests/fruits.swf |  | 0.5 | 800×600 | 25 | 1 | #000000 | none | 2 | 2 | 0 | 0 | 0/0 | 0 | 0 | 2 / 0 |
| movies/tests/receiver.swf |  | 0.2 | 800×600 | 25 | 1 | #000000 | AVM1 timeline only | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| movies/tests/RuntimeSharing.swf |  | 1.1 | 800×600 | 25 | 1 | #000000 | none | 3 | 3 | 0 | 0 | 0/0 | 0 | 0 | 3 / 0 |
| movies/tests/test shared 2.swf |  | 0.5 | 800×600 | 25 | 1 | #000000 | AVM1 timeline only | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 / 0 |
| src/physics/ape/demos/ApeTest.swf |  | 12.5 | 630×300 | 60 | 1 | #ffffff | AS2 + classes | 0 | 18 | 0 | 0 | 0/0 | 0 | 0 | 0 / 18 |
| src/physics/ape/demos/CarDemo copy.swf |  | 15.8 | 630×300 | 60 | 1 | #000000 | AS2 + classes | 0 | 26 | 0 | 0 | 0/0 | 0 | 0 | 0 / 26 |
| src/physics/ape/demos/CarDemo.swf |  | 16.0 | 630×300 | 60 | 1 | #000000 | AS2 + classes | 0 | 26 | 0 | 0 | 0/0 | 0 | 0 | 0 / 26 |

Totals over all 71 SWFs: 8,346 shapes (4,776 DefineShape, 1,356 DefineShape2, 452 DefineShape3, 1,762 DefineShape4), 828 morph shapes, 7,828 sprites, 543 bitmaps, 0 sounds, 52 fonts (all DefineFont3: Arial, Arial Bold, Verdana, Verdana Bold, Myriad Pro Bold), 69 static texts, 434 edit texts, 86 buttons, 1,371 frame labels, 1,961 DoAction and 2,556 DoInitAction tags, 3,856 export names. The run-time set is 19 files, 2.1 MB.

## 4. How the run-time files fit together

- `e-Bug Junior Game.swf` (135 frames, root label `init`) holds the compiled game classes (`ebug.junior.GameController`, `GameShow`, `PlatformGame` and the rest) and the mx v2 Button component; its only exports are mx component symbols. It has instance `gameScreen` (the holder for loaded screens), `loader` and a debug `fps` text field.
- `junior_game_assets.swf` is a 1-frame library: 92 tile symbols, 9 editor placeholders (`entity_test`, `new_tile`, `default_clip`, `tile_test`, `blue_box`, `eraser`, `green_box`, `red_box`, `player_start`), the shrinking avatars (`shrinking_amy`, `shrinking_harry`), `ephone_ingame` and 80 avatar body parts, plus `shared_library_link` (id 622); 185 art exports and 26 compiled classes in all. The documentation describes it as the pre-loaded asset file (`junior-game-documentation.md`, "Movies Folder").
- `introductionToMicrobes_platformer.swf` (40 frames, labels 1 `init`, 10 `start`, 20 `main`) exports the microbes, pickups, projectiles, HUD and ePhone and the `PlatformGame` symbol, and imports `shared_library_link` from `junior_game_assets.swf` (ImportAssets2; local id 1496). Root instances: `game` (PlatformGame), `avatar` (empty holder, sprite 1498), `ephone` (`e_phone`), `score`, `heart0`-`heart2`, `antibiotic_held` (`antibiotic_pickup`), `timeLeft` (edit text), `talkie`, `whiteout` (sprite 1500, fades `_alpha` by 10 per frame).
- `amy.swf` / `harry.swf` are loaded into `avatar` and contain the two-part player (`upper` and `lower`); their exports are body parts only.
- `eBugGameShow.swf` places one `GameShow` symbol (`game_show`); `ebug.junior.GameShow` attaches `question_board`, `gameshow_set`, `shrinking_zone` and `talkie` (`GameShow.as:56-65`).
- `KitchenGame.swf` is the kitchen coordinator (instances `container`, `loader`); `kitchen_game_main.swf` holds the kitchen scene, avatars and food; the four intro SWFs and the outro are text screens.

## 5. Linkage names by purpose (run-time SWFs)

Complete per-SWF export lists, with ids, are in `swf-inventory.json` (`swfs[].exports`). Below, grouped by purpose.

### 5.1 Tiles (`junior_game_assets.swf`)

Every tile symbol is one bitmap-filled shape with its registration point at the top-left, so frame-1 bounds are exactly the bitmap size. Tiles bigger than 50×50 (for example `acid_pit_end_obj` 100×150, `splinter_obj` 50×250, `toast_jam_obj` 250×50) still occupy one grid cell in the XML; the physics box takes the clip's full `_width`/`_height`.

| Linkage name | Frame-1 size (px) | Bitmap (id, tag) | Extracted file | Unity PNG | Pixel match (mean abs diff, 0-255) | Placed in alpha_level1-11 |
|---|---|---|---|---|---|---:|
| `acid_pit_end_obj` | 100×150 | 346 DefineBitsJPEG3 | `bitmaps/junior_game_assets/346.png` | `Tiles/Body/acid_pit_end.png` | 3.08 (max 66) | 1 |
| `acid_pit_mid_obj` | 100×148 | 349 DefineBitsJPEG3 | `bitmaps/junior_game_assets/349.png` | `Tiles/Body/acid_pit_mid.png` | 2.51 (max 57) | 1 |
| `acid_pit_start_obj` | 100×150 | 352 DefineBitsJPEG3 | `bitmaps/junior_game_assets/352.png` | `Tiles/Body/acid_pit_start.png` | 2.96 (max 68) | 1 |
| `bone_end_obj` | 100×100 | 355 DefineBitsLossless2 | `bitmaps/junior_game_assets/355.png` | `Tiles/Body/bone_end.png` | 0.02 (max 3) | 1 |
| `bone_mid_obj` | 50×100 | 358 DefineBitsLossless2 | `bitmaps/junior_game_assets/358.png` | `Tiles/Body/bone_mid.png` | 0 (max 0) | 3 |
| `bone_start_obj` | 100×100 | 361 DefineBitsLossless2 | `bitmaps/junior_game_assets/361.png` | `Tiles/Body/bone_start.png` | 0.02 (max 3) | 1 |
| `bubble_obj` | 50×50 | 364 DefineBitsJPEG3 | `bitmaps/junior_game_assets/364.png` | `Tiles/Body/bubble.png` | 4.31 (max 47) | 0 |
| `cell_front_obj` | 50×50 | 367 DefineBitsJPEG3 | `bitmaps/junior_game_assets/367.png` | `Tiles/Body/cell_front.png` | 2.94 (max 67) | 16 |
| `cell_side_obj` | 50×50 | 370 DefineBitsLossless2 | `bitmaps/junior_game_assets/370.png` | `Tiles/Body/cell_side.png` | 0.04 (max 2) | 33 |
| `corner_l_tile` | 50×50 | 373 DefineBitsJPEG3 | `bitmaps/junior_game_assets/373.png` | `Tiles/Body/corner_l.png` | 3.15 (max 63) | 6 |
| `corner_r_tile` | 50×50 | 376 DefineBitsJPEG3 | `bitmaps/junior_game_assets/376.png` | `Tiles/Body/corner_r.png` | 3.16 (max 53) | 9 |
| `flesh_tile` | 50×50 | 379 DefineBits | `bitmaps/junior_game_assets/379.jpg` | `Tiles/Body/flesh.png` | 3.56 (max 20) | 89 |
| `flesh_gristle_1_tile` | 50×50 | 382 DefineBits | `bitmaps/junior_game_assets/382.jpg` | `Tiles/Body/flesh_gristle_1.png` | 3.98 (max 30) | 4 |
| `flesh_gristle_2_tile` | 50×50 | 385 DefineBits | `bitmaps/junior_game_assets/385.jpg` | `Tiles/Body/flesh_gristle_2.png` | 4.24 (max 32) | 1 |
| `flesh_gristle_3_tile` | 100×50 | 388 DefineBits | `bitmaps/junior_game_assets/388.jpg` | `Tiles/Body/flesh_gristle_3.png` | 4.1 (max 36) | 2 |
| `flesh_gristle_4_tile` | 50×100 | 391 DefineBits | `bitmaps/junior_game_assets/391.jpg` | `Tiles/Body/flesh_gristle_4.png` | 4.33 (max 35) | 2 |
| `flesh_gristle_5_tile` | 50×50 | 394 DefineBits | `bitmaps/junior_game_assets/394.jpg` | `Tiles/Body/flesh_gristle_5.png` | 4.3 (max 35) | 3 |
| `flesh_gristle_6_tile` | 50×50 | 397 DefineBits | `bitmaps/junior_game_assets/397.jpg` | `Tiles/Body/flesh_gristle_6.png` | 4.38 (max 33) | 1 |
| `floor_a_tile` | 50×50 | 400 DefineBitsJPEG3 | `bitmaps/junior_game_assets/400.png` | `Tiles/Body/floor_a.png` | 3.1 (max 30) | 26 |
| `floor_b_tile` | 50×50 | 403 DefineBitsJPEG3 | `bitmaps/junior_game_assets/403.png` | `Tiles/Body/floor_b.png` | 3.15 (max 36) | 25 |
| `platform_bridge_obj` | 50×50 | 406 DefineBitsJPEG3 | `bitmaps/junior_game_assets/406.png` | `Tiles/Body/platform_bridge.png` | 3 (max 57) | 8 |
| `platform_end_obj` | 50×50 | 409 DefineBitsJPEG3 | `bitmaps/junior_game_assets/409.png` | `Tiles/Body/platform_end.png` | 1.2 (max 48) | 11 |
| `platform_mid_obj` | 100×50 | 412 DefineBitsJPEG3 | `bitmaps/junior_game_assets/412.png` | `Tiles/Body/platform_mid.png` | 3.23 (max 78) | 18 |
| `platform_start_obj` | 50×50 | 415 DefineBitsJPEG3 | `bitmaps/junior_game_assets/415.png` | `Tiles/Body/platform_start.png` | 3.03 (max 63) | 10 |
| `roof_a_tile` | 50×50 | 418 DefineBitsJPEG3 | `bitmaps/junior_game_assets/418.png` | `Tiles/Body/roof_a.png` | 3.13 (max 27) | 54 |
| `roof_b_tile` | 50×50 | 421 DefineBitsJPEG3 | `bitmaps/junior_game_assets/421.png` | `Tiles/Body/roof_b.png` | 3.12 (max 31) | 50 |
| `vertical_a_l_tile` | 50×50 | 424 DefineBitsJPEG3 | `bitmaps/junior_game_assets/424.png` | `Tiles/Body/vertical_a_l.png` | 3.41 (max 43) | 10 |
| `vertical_a_r_tile` | 50×50 | 427 DefineBitsJPEG3 | `bitmaps/junior_game_assets/427.png` | `Tiles/Body/vertical_a_r.png` | 3.44 (max 53) | 19 |
| `vertical_b_l_tile` | 50×50 | 430 DefineBitsJPEG3 | `bitmaps/junior_game_assets/430.png` | `Tiles/Body/vertical_b_l.png` | 3.46 (max 45) | 8 |
| `vertical_b_r_tile` | 50×50 | 433 DefineBitsJPEG3 | `bitmaps/junior_game_assets/433.png` | `Tiles/Body/vertical_b_r.png` | 3.42 (max 52) | 16 |
| `villi_floor_obj` | 100×100 | 436 DefineBitsJPEG3 | `bitmaps/junior_game_assets/436.png` | `Tiles/Body/villi_floor.png` | 3.26 (max 48) | 3 |
| `villi_roof_obj` | 100×100 | 439 DefineBitsJPEG3 | `bitmaps/junior_game_assets/439.png` | `Tiles/Body/villi_roof.png` | 3.25 (max 52) | 9 |
| `lint_ball_obj` | 50×50 | 442 DefineBitsJPEG3 | `bitmaps/junior_game_assets/442.png` | `Tiles/Skin/lint_ball.png` | 6.24 (max 80) | 3 |
| `plaster_multi_bridge_obj` | 50×50 | 445 DefineBits | `bitmaps/junior_game_assets/445.jpg` | `Tiles/Skin/plaster_multi_bridge.png` | 3.07 (max 30) | 0 |
| `plaster_multi_end_obj` | 150×50 | 448 DefineBitsJPEG3 | `bitmaps/junior_game_assets/448.png` | `Tiles/Skin/plaster_multi_end.png` | 3.06 (max 47) | 2 |
| `plaster_multi_start_obj` | 150×50 | 451 DefineBitsJPEG3 | `bitmaps/junior_game_assets/451.png` | `Tiles/Skin/plaster_multi_start.png` | 3.02 (max 40) | 2 |
| `plaster_multi_mid_obj` | 100×50 | 454 DefineBits | `bitmaps/junior_game_assets/454.jpg` | `Tiles/Skin/plaster_multi_mid.png` | 2.98 (max 32) | 1 |
| `plaster_singular_obj` | 200×50 | 457 DefineBitsJPEG3 | `bitmaps/junior_game_assets/457.png` | `Tiles/Skin/plaster_singular.png` | 3.06 (max 43) | 12 |
| `scab_obj` | 200×100 | 460 DefineBitsJPEG3 | `bitmaps/junior_game_assets/460.png` | `Tiles/Skin/scab.png` | 2.01 (max 37) | 6 |
| `splinter_obj` | 50×250 | 463 DefineBitsJPEG3 | `bitmaps/junior_game_assets/463.png` | `Tiles/Skin/splinter.png` | 2.35 (max 60) | 3 |
| `spot_large_obj` | 100×100 | 466 DefineBitsJPEG3 | `bitmaps/junior_game_assets/466.png` | `Tiles/Skin/spot_large.png` | 1.98 (max 49) | 3 |
| `spot_ooze_obj` | 100×100 | 469 DefineBitsJPEG3 | `bitmaps/junior_game_assets/469.png` | `Tiles/Skin/spot_ooze.png` | 2.65 (max 65) | 2 |
| `spot_small_obj` | 50×50 | 472 DefineBitsJPEG3 | `bitmaps/junior_game_assets/472.png` | `Tiles/Skin/spot_small.png` | 2.8 (max 61) | 4 |
| `wart_obj` | 100×100 | 475 DefineBitsJPEG3 | `bitmaps/junior_game_assets/475.png` | `Tiles/Skin/wart.png` | 1.83 (max 45) | 2 |
| `hair_base_obj` | 50×100 | 478 DefineBits | `bitmaps/junior_game_assets/478.jpg` | `Tiles/Skin/hair_base.png` | 1.36 (max 36) | 13 |
| `hair_horiz_obj` | 50×50 | 481 DefineBitsLossless2 | `bitmaps/junior_game_assets/481.png` | `Tiles/Skin/hair_horiz.png` | 0 (max 0) | 10 |
| `hair_horiz_end_obj` | 100×50 | 484 DefineBitsLossless2 | `bitmaps/junior_game_assets/484.png` | `Tiles/Skin/hair_horiz_end.png` | 0.01 (max 2) | 9 |
| `hair_slope_obj` | 100×50 | 487 DefineBitsLossless2 | `bitmaps/junior_game_assets/487.png` | `Tiles/Skin/hair_slope.png` | 0.02 (max 2) | 2 |
| `hair_slope_end_obj` | 100×50 | 490 DefineBitsJPEG3 | `bitmaps/junior_game_assets/490.png` | `Tiles/Skin/hair_slope_end.png` | 0.94 (max 29) | 10 |
| `hair_slope_start_obj` | 100×100 | 493 DefineBitsJPEG3 | `bitmaps/junior_game_assets/493.png` | `Tiles/Skin/hair_slope_start.png` | 0.77 (max 28) | 14 |
| `hair_vert_obj` | 50×50 | 496 DefineBitsLossless | `bitmaps/junior_game_assets/496.png` | `Tiles/Skin/hair_vert.png` | 0 (max 0) | 33 |
| `skin_base_tile` | 50×50 | 499 DefineBits | `bitmaps/junior_game_assets/499.jpg` | `Tiles/Skin/skin_base.png` | 1.44 (max 9) | 219 |
| `skin_surface_tile` | 50×50 | 502 DefineBits | `bitmaps/junior_game_assets/502.jpg` | `Tiles/Skin/skin_surface.png` | 1.56 (max 11) | 146 |
| `C_Chip_L_Tile` | 50×50 | 505 DefineBitsLossless2 | `bitmaps/junior_game_assets/505.png` | `Tiles/Kitchen/C_Chip_L.png` | 0.06 (max 3) | 5 |
| `C_Chip_Mid_Tile` | 50×50 | 508 DefineBitsLossless2 | `bitmaps/junior_game_assets/508.png` | `Tiles/Kitchen/C_Chip_Mid.png` | 0.05 (max 3) | 6 |
| `C_Chip_R_Tile` | 50×50 | 511 DefineBitsLossless2 | `bitmaps/junior_game_assets/511.png` | `Tiles/Kitchen/C_Chip_R.png` | 0.06 (max 3) | 5 |
| `Cheese_L_Tile` | 50×50 | 514 DefineBitsLossless2 | `bitmaps/junior_game_assets/514.png` | `Tiles/Kitchen/Cheese_L.png` | 0.01 (max 3) | 3 |
| `Cheese_Mid_Tile` | 50×50 | 517 DefineBitsLossless2 | `bitmaps/junior_game_assets/517.png` | `Tiles/Kitchen/Cheese_Mid.png` | 0.01 (max 1) | 4 |
| `Cheese_R_Tile` | 50×50 | 520 DefineBitsLossless2 | `bitmaps/junior_game_assets/520.png` | `Tiles/Kitchen/Cheese_R.png` | 0 (max 1) | 3 |
| `Chip_L_Tile` | 50×50 | 523 DefineBitsLossless2 | `bitmaps/junior_game_assets/523.png` | `Tiles/Kitchen/Chip_L.png` | 0.02 (max 3) | 4 |
| `Chip_Mid_Tile` | 50×50 | 526 DefineBitsLossless | `bitmaps/junior_game_assets/526.png` | `Tiles/Kitchen/Chip_Mid.png` | 0 (max 0) | 7 |
| `Chip_R_Tile` | 50×50 | 529 DefineBitsLossless2 | `bitmaps/junior_game_assets/529.png` | `Tiles/Kitchen/Chip_R.png` | 0.02 (max 3) | 4 |
| `Chop_L_Tile` | 50×50 | 532 DefineBitsLossless2 | `bitmaps/junior_game_assets/532.png` | `Tiles/Kitchen/Chop_L.png` | 0.02 (max 2) | 3 |
| `Chop_Mid1_Tile` | 50×50 | 535 DefineBitsLossless | `bitmaps/junior_game_assets/535.png` | `Tiles/Kitchen/Chop_Mid1.png` | 0 (max 0) | 4 |
| `Chop_Mid2_Tile` | 50×50 | 538 DefineBitsLossless | `bitmaps/junior_game_assets/538.png` | `Tiles/Kitchen/Chop_Mid2.png` | 0 (max 0) | 5 |
| `Chop_Mid3_Tile` | 50×50 | 541 DefineBitsLossless2 | `bitmaps/junior_game_assets/541.png` | `Tiles/Kitchen/Chop_Mid3.png` | 0.02 (max 2) | 3 |
| `Chop_R_Tile` | 50×50 | 544 DefineBitsLossless2 | `bitmaps/junior_game_assets/544.png` | `Tiles/Kitchen/Chop_R.png` | 0.03 (max 3) | 3 |
| `Sausage_L_Tile` | 50×50 | 547 DefineBitsLossless2 | `bitmaps/junior_game_assets/547.png` | `Tiles/Kitchen/Sausage_L.png` | 0.04 (max 2) | 5 |
| `Sausage_Mid_Tile` | 50×50 | 550 DefineBitsLossless | `bitmaps/junior_game_assets/550.png` | `Tiles/Kitchen/Sausage_Mid.png` | 0 (max 0) | 8 |
| `Sausage_R_Tile` | 50×50 | 553 DefineBitsLossless2 | `bitmaps/junior_game_assets/553.png` | `Tiles/Kitchen/Sausage_R.png` | 0.04 (max 2) | 5 |
| `Sugar_Tile` | 50×50 | 556 DefineBitsLossless2 | `bitmaps/junior_game_assets/556.png` | `Tiles/Kitchen/Sugar.png` | 0.01 (max 1) | 21 |
| `Unit_1_Tile` | 50×50 | 559 DefineBitsLossless | `bitmaps/junior_game_assets/559.png` | `Tiles/Kitchen/Unit_1.png` | 0 (max 0) | 7 |
| `Unit_2_Tile` | 50×50 | 562 DefineBitsLossless | `bitmaps/junior_game_assets/562.png` | `Tiles/Kitchen/Unit_2.png` | 0 (max 0) | 88 |
| `Unit_3_Tile` | 50×50 | 565 DefineBitsLossless | `bitmaps/junior_game_assets/565.png` | `Tiles/Kitchen/Unit_3.png` | 0 (max 0) | 7 |
| `Unit_4_Tile` | 50×50 | 568 DefineBitsLossless | `bitmaps/junior_game_assets/568.png` | `Tiles/Kitchen/Unit_4.png` | 0 (max 0) | 7 |
| `Unit_5_Tile` | 50×50 | 571 DefineBitsLossless | `bitmaps/junior_game_assets/571.png` | `Tiles/Kitchen/Unit_5.png` | 0 (max 0) | 50 |
| `Unit_6_Tile` | 50×50 | 574 DefineBitsLossless | `bitmaps/junior_game_assets/574.png` | `Tiles/Kitchen/Unit_6.png` | 0 (max 0) | 6 |
| `Yog_L_Tile` | 50×50 | 577 DefineBitsLossless2 | `bitmaps/junior_game_assets/577.png` | `Tiles/Kitchen/Yog_L.png` | 0.04 (max 3) | 8 |
| `Yog_Mid_Tile` | 50×50 | 580 DefineBitsLossless2 | `bitmaps/junior_game_assets/580.png` | `Tiles/Kitchen/Yog_Mid.png` | 0.01 (max 2) | 19 |
| `Yog_R_Tile` | 50×50 | 583 DefineBitsLossless2 | `bitmaps/junior_game_assets/583.png` | `Tiles/Kitchen/Yog_R.png` | 0.04 (max 3) | 8 |
| `loaf_end_L_obj` | 50×200 | 586 DefineBitsJPEG3 | `bitmaps/junior_game_assets/586.png` | `Tiles/Kitchen/loaf_end_left.png` | 3.57 (max 44) | 3 |
| `loaf_end_R_obj` | 50×200 | 589 DefineBitsJPEG3 | `bitmaps/junior_game_assets/589.png` | `Tiles/Kitchen/loaf_end_right.png` | 3.64 (max 48) | 3 |
| `loaf_mid_obj` | 50×200 | 592 DefineBits | `bitmaps/junior_game_assets/592.jpg` | `Tiles/Kitchen/loaf_mid.png` | 3.61 (max 33) | 4 |
| `loaf_mid_mould_obj` | 50×200 | 595 DefineBits | `bitmaps/junior_game_assets/595.jpg` | `Tiles/Kitchen/loaf_mid_mould.png` | 3.89 (max 56) | 0 |
| `loaf_mid_mould2_obj` | 50×200 | 598 DefineBits | `bitmaps/junior_game_assets/598.jpg` | `Tiles/Kitchen/loaf_mid_mould2.png` | 3.87 (max 61) | 2 |
| `loaf_mid_mould3_obj` | 50×200 | 601 DefineBits | `bitmaps/junior_game_assets/601.jpg` | `Tiles/Kitchen/loaf_mid_mould3.png` | 4.15 (max 61) | 2 |
| `pepper_obj` | 100×200 | 604 DefineBitsJPEG3 | `bitmaps/junior_game_assets/604.png` | `Tiles/Kitchen/pepper.png` | 1.83 (max 32) | 8 |
| `salt_obj` | 100×200 | 607 DefineBitsJPEG3 | `bitmaps/junior_game_assets/607.png` | `Tiles/Kitchen/salt.png` | 1.1 (max 36) | 6 |
| `toast_jam_obj` | 250×50 | 610 DefineBitsJPEG3 | `bitmaps/junior_game_assets/610.png` | `Tiles/Kitchen/toast_jam.png` | 4.08 (max 57) | 3 |
| `toast_marm_obj` | 250×50 | 613 DefineBitsJPEG3 | `bitmaps/junior_game_assets/613.png` | `Tiles/Kitchen/toast_marm.png` | 4.04 (max 62) | 1 |
| `yoghurt_obj` | 150×150 | 616 DefineBitsJPEG3 | `bitmaps/junior_game_assets/616.png` | `Tiles/Kitchen/yoghurt.png` | 3.52 (max 80) | 6 |
| `yoghurt_lid_obj` | 150×150 | 619 DefineBitsJPEG3 | `bitmaps/junior_game_assets/619.png` | `Tiles/Kitchen/yoghurt_lid.png` | 0.84 (max 29) | 2 |

Other non-body-part exports in junior_game_assets.swf: `shrinking_amy` (1 f, 127.11×206.16, bitmap 49/50/51/52/53), `ephone_ingame` (1 f, 1.8×21.45, vector), `shrinking_harry` (1 f, 108.19×198.26, bitmap 219/220/221/222/223), `entity_test` (1 f, 51×51.5, vector), `new_tile` (1 f, 51×51, vector), `default_clip` (1 f, 51×51, vector), `tile_test` (1 f, 51×51, vector), `blue_box` (1 f, 51×51, vector), `eraser` (1 f, 50×50, bitmap 337), `green_box` (1 f, 51×51, vector), `red_box` (1 f, 51×51, vector), `player_start` (1 f, 31.2×53.6, vector), `shared_library_link` (1 f, empty, vector).

### 5.2 Microbes (`introductionToMicrobes_platformer.swf`)

The level XML places microbes by these `*_icon` names (not by `lucy`, `steve` and so on, which only the editor and test SWFs export). All are vector only. Every clip declares `midAnimation = false` on frame 1; one-shot states set `midAnimation = true` on their first frame and back to `false` where they end, and `GoodMicrobe.as`/`BadMicrobe.as` only start a new state while `clip.midAnimation == false` (for example `GoodMicrobe.as:328`). Frame 1 is labelled `stop`: `lucy_icon`, `patty_icon` and `iggy_icon` hold there (`gotoAndPlay("stop")` on frame 1), `donna_icon`, `slarg_icon`, `slurm_icon`, `super_slurm_icon` and `super_colin_icon` jump straight to `idle`, `sandy_icon` and `steve_icon` jump to the missing label `steve_idle`, and `superinfection_icon` sets `var lives = 6` and runs on. `idle`, `slide` and `be_lifted` share one frame in every microbe except the superinfection.

| Linkage (platformer) | XML entity type | Frames | Frame-1 bounds (px) | All-frames bounds (px) | Vector? | Level Editor twin | Unity folder (frames) |
|---|---:|---:|---|---|---|---|---|
| `lucy_icon` (id 774) | 11 | 255 | 42.32×97.58 at (-0.46, -0.38) | 155.69×139.49 at (-58.47, -31.97) | vector only | `lucy` 255 f | `Microbes/00lucy` (178) |
| `patty_icon` (id 850) | 13 | 194 | 203.32×150.39 at (-6.42, -8.94) | 237.54×286.92 at (-23.28, -107.08) | vector only | `patty` 194 f | `Microbes/01patty` (194) |
| `donna_icon` (id 562) | 19 | 311 | 100.42×147.74 at (-0.56, -0.36) | 362.67×318.56 at (-91.75, -54.71) | vector only | `donna` 311 f | `Microbes/02donna` (310) |
| `slarg_icon` (id 942) | 16 | 263 | 90.57×225.48 at (-0.37, 0.06) | 184.78×283.79 at (-52.58, -26.99) | vector only | `slarg` 242 f | `Microbes/03slarg` (242) |
| `slurm_icon` (id 988) | 17 | 340 | 75.64×72.44 at (-0.34, 0.08) | 146.6×190.41 at (-30.28, -76.95) | vector only | `slurm` 340 f | `Microbes/04slurm` (332) |
| `super_colin_icon` (id 488) | 15 | 546 | 50.51×98.05 at (-3.5, -0.55) | 186.75×213.99 at (-59.64, -53.97) | vector only | `super_colin` 546 f | `Microbes/05colin (and 06super_colin)` (546) |
| `sandy_icon` (id 890) | 12 | 185 | 90.08×226.05 at (-0.54, -0.53) | 160.57×261.35 at (-54.5, -27.65) | vector only | `sandy` 185 f | `Microbes/07sandy` (185) |
| `steve_icon` (id 337) | 14 | 261 | 74.1×72.94 at (-0.4, -0.6) | 124.17×166.03 at (-30.73, -78.96) | vector only | `steve` 261 f | `Microbes/08steve` (261) |
| `iggy_icon` (id 712) | 18 | 360 | 47.96×48.64 at (1.33, 2.81) | 111.66×116.94 at (-26.85, -27.05) | vector only | `iggy` 360 f | `Microbes/09iggy` (360) |
| `super_slurm_icon` (id 1041) | 17 | 340 | 75.64×72.43 at (-0.34, 0.08) | 146.65×190.41 at (-30.28, -76.95) | vector only | `super_slurm` 340 f | `Microbes/10super_slurm` (332) |
| `superinfection_icon` (id 62) | 23 | 318 | 409.15×195.42 at (2.35, 4.14) | 549.27×315.68 at (-105.05, -56.4) | vector only | `superinfection` 318 f | `Microbes/11super_infection` (226) |

State timing (frame numbers are the clip's own, 1-based; "loops a-b" means a script at frame b jumps back to the label at a; "holds frame a" means the script on frame a jumps to its own label, so the clip stays there; "at f X" means the script at frame f does X; "runs on" means no script ends the state, so playback continues into the next label; the timeline runs at 25 fps):

- `lucy_icon`: `stop` 1-9: holds frame 1; `be_lifted`/`slide`/`idle` 10-49: loops 10-30; `be_photographed` 50-79: at 64 gotoAndPlay("idle"); `be_hit` 80-114: at 97 gotoAndPlay("idle"); `be_killed` 115-149: stops at 142; `walk` 150-199: loops 150-175; `dive` 200-255 (no script: runs on).
- `patty_icon`: `stop` 1-19: holds frame 1; `be_lifted`/`slide`/`idle` 20-64: loops 20-40; `be_hit` 65-94: at 79 gotoAndPlay("idle"); `be_photographed` 95-129: at 113 gotoAndPlay("idle"); `be_killed` 130-165: at 159 gotoAndPlay("idle"); `stare` 166-194: at 194 gotoAndPlay("idle").
- `donna_icon`: `stop` 1-14: at 1 gotoAndPlay("idle"); `slide`/`be_lifted`/`idle` 15-49: loops 15-35; `be_photographed` 50-89: at 67 gotoAndPlay("idle"); `be_frozen` 90-114: loops 90-92; `be_hit` 115-149: at 129 gotoAndPlay("idle"); `be_killed` 150-209: at 179 gotoAndPlay("idle"); `be_washed_away` 210-239: loops 210-212; `walk` 240-289: loops 240-264; `flick_head` 290-311: at 310 gotoAndPlay("idle").
- `slarg_icon`: `stop` 1-9: at 1 gotoAndPlay("idle"); `slide`/`be_lifted`/`idle` 10-60: loops 10-28; `be_photographed` 61-90: at 75 gotoAndPlay("idle"); `be_hit` 91-125: at 102 gotoAndPlay("idle"); `be_killed` 126-167: at 152 gotoAndPlay("stop"); `bounce` 168-204: at 185 gotoAndPlay("idle"); `be_frozen` 205-239: loops 205-207; `be_washed_away` 240-263: loops 240-242.
- `slurm_icon`: `stop` 1-9: at 1 gotoAndPlay("idle"); `slide`/`be_lifted`/`idle` 10-60: loops 10-35; `be_photographed` 61-90: at 75 gotoAndPlay("idle"); `be_hit` 91-125: at 104 gotoAndPlay("idle"); `be_killed` 126-165: at 152 gotoAndPlay("stop"); `walk` 166-200: loops 166-181; `bounce_start`/`jump_start` 201-224: at 212 gotoAndPlay("jump_mid"); `bounce_mid`/`jump_mid` 225-249: loops 225-230; `bounce_end`/`jump_end` 250-274: at 261 gotoAndPlay("idle"); `be_frozen` 275-294: loops 275-277; `be_washed_away` 295-314: loops 295-297; `munch` 315-340: loops 315-332.
- `super_colin_icon`: `stop` 1-14: at 1 gotoAndPlay("idle"); `be_lifed`/`slide`/`idle` 15-64: loops 15-35; `be_frozen` 65-84: loops 65-67; `be_photographed` 85-134: at 105 gotoAndPlay("idle"); `be_hit` 135-179: at 148 gotoAndPlay("idle"); `be_killed` 180-244: stops at 211; `be_washed_away` 245-284: loops 245-247; `walk` 285-329: loops 285-291; `run` 330-359: loops 330-335; `jump_start` 360-389: at 370 gotoAndPlay("jump_mid"); `jump_mid` 390-434: loops 390-406; `jump_end` 435-484: at 452 gotoAndPlay("idle"); `scream` 485-539: at 513 gotoAndPlay("idle"); `munch` 540-546: loops 540-546.
- `sandy_icon`: `stop` 1-9: at 1 gotoAndPlay("steve_idle"); `slide`/`be_lifted`/`idle` 10-60: loops 10-28; `be_photographed` 61-90: at 75 gotoAndPlay("idle"); `be_hit` 91-125: at 102 gotoAndPlay("idle"); `be_killed` 126-167: at 152 gotoAndPlay("stop"); `bounce` 168-185: at 185 gotoAndPlay("idle").
- `steve_icon`: `stop` 1-9: at 1 gotoAndPlay("steve_idle"); `slide`/`be_lifted`/`idle` 10-60: loops 10-35; `be_photographed` 61-90: at 75 gotoAndPlay("idle"); `be_hit` 91-125: at 104 gotoAndPlay("idle"); `be_killed` 126-165: stops at 152; `walk` 166-200: loops 166-181; `bounce_start`/`jump_start` 201-224: at 212 gotoAndPlay("jump_mid"); `bounce_mid`/`jump_mid` 225-249: loops 225-230; `bounce_end`/`jump_end` 250-261: at 261 gotoAndPlay("idle").
- `iggy_icon`: `stop` 1-9: holds frame 1; `be_lifted`/`slide`/`idle` 10-29: loops 10-15; `be_frozen` 30-49: loops 30-32; `be_washed_away` 50-69: loops 50-52; `be_hit` 70-109: at 83 gotoAndPlay("idle"); `be_photographed` 110-155: at 131 gotoAndPlay("idle"); `be_killed` 156-229: at 187 gotoAndPlay("idle"); `walk` 230-289: loops 230-254; `jump_start` 290-314: at 302 gotoAndPlay("jump_mid"); `jump_mid` 315-344: loops 315-323; `jump_end` 345-360: at 360 gotoAndPlay("idle").
- `super_slurm_icon`: `stop` 1-9: at 1 gotoAndPlay("idle"); `slide`/`be_lifted`/`idle` 10-60: loops 10-35; `be_photographed` 61-90: at 75 gotoAndPlay("idle"); `be_hit` 91-125: at 104 gotoAndPlay("idle"); `be_killed` 126-165: stops at 152; `walk` 166-200: loops 166-181; `bounce_start`/`jump_start` 201-224: at 212 gotoAndPlay("jump_mid"); `bounce_mid`/`jump_mid` 225-249: loops 225-230; `bounce_end`/`jump_end` 250-274: at 261 gotoAndPlay("idle"); `be_frozen` 275-294: loops 275-277; `be_washed_away` 295-314: loops 295-297; `munch` 315-340: loops 315-332.
- `superinfection_icon`: `stop` 1-10 (no script: runs on); `idle_1` 11-44: loops 11-33; `be_hit_1` 45-124: at 58 gotoAndPlay("idle_2"); `idle_2` 125-164: loops 125-147; `be_hit_2` 165-189: at 178 gotoAndPlay("idle_3"); `idle_3` 190-224: loops 190-212; `be_hit_3` 225-259: at 238 gotoAndPlay("idle_4"); `idle_4` 260-289: loops 260-279; `be_killed` 290-318: at 318 gotoAndPlay("idle_4") (conditional: see script dump).

Reading the timings: in Flash the script on frame N runs before frame N is drawn, so for a script `gotoAndPlay("idle")` on frame 30 the visible loop is normally frames 10-29 (the Unity range files agree for the player, section 5.3). The code asks for labels that no microbe has: `fall` (`GoodMicrobe.as:152`, `BadMicrobe.as:164`), and the `sandy_icon`/`steve_icon` frame-1 scripts jump to `steve_idle`, which does not exist; Flash ignores a goto to a missing label and keeps playing, which here runs on into `idle`.

### 5.3 Player avatar (`amy.swf`, `harry.swf`, shrinking avatars)

The player is two independently animated halves, driven by `ebug.junior.PlayerEntity` (`upperClip`/`lowerClip`, `midAnimation` on both, `PlayerEntity.as:20-24`). The art is drawn at about 11 times its on-screen size and placed at scale 0.089.

**amy.swf** (stage 550×400, loaded into the platformer's `avatar` clip). Root timeline, frame 1:

- instance `lower` = sprite 158, 224 frames, placed with scale 0.0891×0.089 at (2.75, 49.5). Frame-1 bounds as placed: 48.79×46.66 at (2.75, 49.5); approximate all-frames bounds as placed: 216.32×156.75 at (-76.69, -20.33) (own coordinates 2427.81×1761.2 at (-891.53, -784.61)). Timing: `stop` 1-9: stops at 1; `idle` 10-46: loops 10-30; `move` 47-69: loops 47-55; `accelerate_start` 70-84: at 75 gotoAndPlay("accelerate_mid"); `accelerate_mid` 85-104: loops 85-92; `decelerate_start` 105-118: at 111 gotoAndPlay("decelerate_mid"); `decelerate_mid` 119-135: loops 119-126; `jump_start` 136-149: at 140 gotoAndPlay("jump_mid"); `jump_mid` 150-164: loops 150-156; `jump_end` 165-194: at 180 gotoAndPlay("move"); `hurt` 195-224: at 207 gotoAndPlay("move").
- instance `upper` = sprite 208, 330 frames, placed with scale 0.089×0.089 at (-4, -11). Frame-1 bounds as placed: 63.08×81.82 at (-4, -10.99); approximate all-frames bounds as placed: 96.45×87.44 at (-25.9, -13.12) (own coordinates 1083.7×982.47 at (-246.06, -23.85)). Timing: `stop` 1-9: stops at 1; `idle` 10-46: loops 10-30; `move` 47-69: loops 47-58; `accelerate_start` 70-82: at 74 gotoAndPlay("accelerate_mid"); `accelerate_mid` 83-101: loops 83-94; `decelerate_start` 102-114: at 108 gotoAndPlay("decelerate_mid"); `decelerate_mid` 115-136: loops 115-121; `take_photo_start` 137-154: at 144 gotoAndPlay("take_photo_mid"); `take_photo_mid` 155-170: loops 155-163; `take_photo_end` 171-194: at 179 gotoAndPlay("move"); `use_tractor_beam_start` 195-212: at 202 gotoAndPlay("use_tractor_beam_mid"); `use_tractor_beam_mid` 213-228: loops 213-221; `use_tractor_beam_end` 229-254: at 237 gotoAndPlay("move"); `hurt` 255-279: at 267 gotoAndPlay("move"); `shoot_soap` 280-315: at 298 gotoAndPlay("move"); `throw_white_blood_cell` 316-330: at 330 gotoAndPlay("move").

**harry.swf** (stage 1000×600, loaded into the platformer's `avatar` clip). Root timeline, frame 1:

- instance `lower` = sprite 142, 207 frames, placed with scale 0.0889×0.0889 at (-2, 49.7). Frame-1 bounds as placed: 48.65×46.62 at (-2, 49.73); approximate all-frames bounds as placed: 215.83×156.58 at (-80.89, -19.98) (own coordinates 2427.76×1761.27 at (-887.43, -783.8)). Timing: `stop` 1-9: stops at 1; `idle` 10-46: loops 10-30; `move` 47-69: loops 47-55; `accelerate_start` 70-84: at 75 gotoAndPlay("accelerate_mid"); `accelerate_mid` 85-104: loops 85-92; `decelerate_start` 105-118: at 111 gotoAndPlay("decelerate_mid"); `decelerate_mid` 119-135: loops 119-126; `jump_start` 136-149: at 140 gotoAndPlay("jump_mid"); `jump_mid` 150-164: loops 150-156; `jump_end` 165-194: at 180 gotoAndPlay("move"); `hurt` 195-207: at 207 gotoAndPlay("move").
- instance `upper` = sprite 193, 330 frames, placed with scale 0.0889×0.0889 at (-2, -11). Frame-1 bounds as placed: 55.68×81.45 at (-2.01, -11); approximate all-frames bounds as placed: 88.97×84.32 at (-25.64, -11.92) (own coordinates 1000.81×948.48 at (-265.88, -10.3)). Timing: `stop` 1-9: stops at 1; `idle` 10-46: loops 10-30; `move` 47-69: loops 47-58; `accelerate_start` 70-82: at 74 gotoAndPlay("accelerate_mid"); `accelerate_mid` 83-101: loops 83-94; `decelerate_start` 102-114: at 108 gotoAndPlay("decelerate_mid"); `decelerate_mid` 115-136: loops 115-121; `take_photo_start` 137-154: at 144 gotoAndPlay("take_photo_mid"); `take_photo_mid` 155-170: at 163 gotoAndPlay("take_photo_end"); `take_photo_end` 171-194: at 179 gotoAndPlay("move"); `use_tractor_beam_start` 195-212: at 202 gotoAndPlay("use_tractor_beam_mid"); `use_tractor_beam_mid` 213-228: loops 213-221; `use_tractor_beam_end` 229-254: at 237 gotoAndPlay("move"); `hurt` 255-279: at 267 gotoAndPlay("move"); `shoot_soap` 280-315: at 298 gotoAndPlay("move"); `throw_white_blood_cell` 316-330: at 330 gotoAndPlay("move").

**shrinking_amy.swf** (stage 800×450 at 24 fps): instance `avatar` = sprite 208, 150 frames, label 1 `start`, placed with scale 0.7174 at (508.25, 390.1); frame-1 bounds as placed 127.11×206.16 at (350.22, 149.72); own-coordinate all-frames bounds 189.68×308.71 at (-226.88, -356.14); 5 bitmaps (132 847×18, 133 847×18, 134 74×53, 135 50×34, 136 204×62).

**shrinking_harry.swf** (stage 800×450 at 24 fps): instance `avatar` = sprite 192, 150 frames, label 1 `start`, placed with scale 0.7174 at (508.25, 390.1); frame-1 bounds as placed 108.19×198.26 at (342.57, 160.76); own-coordinate all-frames bounds 161.43×296.2 at (-238.13, -339.15); 5 bitmaps (136 847×18, 137 847×18, 138 74×53, 139 50×34, 140 204×62).

The Unity range file `Players/Amy/up/amy_up.AnimFrames.txt` (reproduced in `unity-assets.md`) has the same label start frames as the Flash `upper` clip (10, 47, 70, 83/84, 102, 115, 137, 155, 171, 195, 213, 229, 255, 280, 316), and its `idle 10-29` matches the loop script on frame 30. `amy.swf` `lower` has 224 frames against Harry's 207 (Unity `Players/Amy/low` has 207); the labels are identical, Amy's `hurt` state is simply longer.

### 5.4 Pickups, projectiles and level entities

| Linkage | SWF | Frames | Frame-1 bounds (px) | All-frames bounds | Art | Labels and timing |
|---|---|---:|---|---|---|---|
| `player_start` | junior_game_assets | 1 | 31.2×53.6 at (9.4, -0.5) | 31.2×53.6 at (9.4, -0.5) | vector |  |
| `portal_exit_icon` | platformer | 1 | 103.6×163.8 at (-0.5, -0.5) | 103.6×163.8 at (-0.5, -0.5) | vector |  |
| `soap_pickup` | platformer | 28 | 36.1×44.1 at (0, 0) | 36.1×44.1 at (0, 0) | bitmap 28 bitmaps (134-188) |  |
| `white_pickup` | platformer | 28 | 39.1×42.1 at (6, 0) | 47.1×42.1 at (0, 0) | bitmap 28 bitmaps (77-131) |  |
| `antibiotic_pickup` | platformer | 1 | 38.3×16.3 at (0, 0) | 38.3×16.3 at (0, 0) | bitmap 1141 |  |
| `milk_glass_icon` | platformer | 80 | 150×200 at (0, 0) | 150×200 at (0, 0) | bitmap 1144, 1146, 1148 | `start` 2-19: stops at 2; `tickle` 20-49 (no script: runs on); `return_to_start` 50-59: at 50 gotoAndPlay("start") (conditional: see script dump); `yogurt` 60-80: stops at 60 |
| `soap_projectile` | platformer | 49 | empty | 50×34 at (0, -9.65) | bitmap 1045, 1048 | `start` 1-9: stops at 1; `shoot` 10-38: stops at 15; `splat` 39-49: stops at 44 |
| `soap_missile` | platformer | 1 | 50×16 at (0, 0) | 50×16 at (0, 0) | bitmap 1045 |  |
| `soap_missile_splat` | platformer | 1 | 25×50 at (0, 0) | 25×50 at (0, 0) | bitmap 1048 |  |
| `white_projectile` | platformer | 24 | 18×20 at (0, 0) | 26.9×26.84 at (-4.45, -3.39) | bitmap 73 | `splat` 24-24 (no script: runs on) |
| `wbc_projectile` | platformer | 1 | 18×20 at (0, 0) | 18×20 at (0, 0) | bitmap 73 |  |
| `camera_flash` | platformer | 1 | 75×75 at (-31, -35) | 75×75 at (-31, -35) | bitmap 1042 |  |

`antibiotic_pickup` is also a standalone `movies/antibiotic_pickup.swf` (same 50×21 DefineBits bitmap). `white_pickup` and `liquid_soap` (the soap pickup) also exist as `movies/Sandy Art/White Blood Cell Pick Up.swf` and `movies/Sandy Art/Liquid Soap.swf` with the same 28 JPEG3 frames each; `white_projectile`/`wbc_projectile` also exist in `Sandy Art/White Blood Cell Projectile.swf`. The 28 pickup frames are trimmed bitmaps of varying width (soap 24-36 px wide by 44, white blood cell 37-47 px by 42), each positioned by its shape's bitmap-fill matrix. `camera_flash` is a 101×101 lossless bitmap (`bitmaps/introductionToMicrobes_platformer/1042.png`) drawn at 75×75 around the registration point (bounds start at (-31, -35)). The exit portal in the shipped levels is the static vector `portal_exit_icon`; the 10-frame animated `portal_exit` (241.9×241.9) exists only in `level_intros.swf`, `introductionToMicrobes_platformer9.swf` and the level editor.

### 5.5 GUI, HUD and ePhone (`introductionToMicrobes_platformer.swf`)

Named children are listed as `instance=exported symbol`. The `*_image` symbols (150.7×168.3) are the ePhone status portraits that `PlatformGame.as:335-357` attaches into `ePhone.status.background`; `camera_icon`, `kill_icon` go into `ePhone.status.mode`; `exit_status` is attached at `PlatformGame.as:591`. `status` has six `tick_box_button` children (`button1`-`button6`); code sends the first `goal.required` of them to `empty` (`junior-game-documentation.md`, "State: STATE_CREATE_GUI").

| Linkage | Frames | Frame-1 bounds (px) | Art | Labels and timing | Named children |
|---|---:|---|---|---|---|
| `sandy_image` | 1 | 150.7×168.3 at (0, 0) | vector |  |  |
| `heart_half` | 1 | 11.95×23.3 at (0.05, 0) | vector |  |  |
| `shine` | 1 | 17.5×11.7 at (0, 0) | vector |  |  |
| `timer` | 130 | 59.8×68.5 at (0, 0) | vector | `p0` 1-9: stops at 1; `p1` 10-19: stops at 10; `p2` 20-29: stops at 20; `p3` 30-39: stops at 30; `p4` 40-49: stops at 40; `p5` 50-59: stops at 50; `p6` 60-69: stops at 60; `p7` 70-79: stops at 70; `p8` 80-89: stops at 80; `p9` 90-99: stops at 90; `p10` 100-109: stops at 100; `p11` 110-119: stops at 110; `p12` 120-130: stops at 120 |  |
| `bar_mask` | 1 | 314.9×22.9 at (0, 0) | vector |  |  |
| `wbc_bar` | 1 | 364.7×36.6 at (0, 0) | vector |  |  |
| `soap_bar` | 1 | 364.7×36.6 at (0, 0) | vector |  |  |
| `text_message` | 1 | 42.2×41.6 at (-0.5, -0.5) | vector |  |  |
| `ephone_ingame` | 1 | 2.85×21.45 at (0.05, 0) | vector |  |  |
| `button_ok` | 1 | 30×30 at (0, 0) | vector |  |  |
| `button_hangup` | 1 | 46.5×26.55 at (0, 0) | vector |  |  |
| `button_answer` | 1 | 46.5×26.55 at (0, 0) | vector |  |  |
| `phone_screen` | 1 | 180×293.05 at (0, 0) | vector |  |  |
| `e-phone` | 1 | 219.7×419.1 at (0, 0) | vector |  | screen=phone_screen |
| `camera_icon` | 1 | 40×32.1 at (0.1, 0) | vector |  |  |
| `antibiotic_icon` | 1 | 40×39.8 at (0, 0) | vector |  |  |
| `kill_icon` | 1 | 40×40 at (-0.05, 0) | vector |  |  |
| `yog_icon` | 1 | 30.4×40 at (0, 0) | vector |  |  |
| `steve_image` | 1 | 150.7×168.3 at (0, 0) | vector |  |  |
| `slarg_image` | 1 | 150.7×170.8 at (0, -2.14) | vector |  |  |
| `exit_status` | 1 | 150.7×169.25 at (0, -0.95) | vector |  |  |
| `background` | 1 | 150.7×168.3 at (0, 0) | vector |  |  |
| `tick_box_placer` | 1 | 18×18 at (0, 0) | vector |  |  |
| `tick_box_tick` | 1 | 18×18 at (0, 0) | vector |  |  |
| `tick_box_cross` | 1 | 18×18 at (0, 0) | vector |  |  |
| `tick_box_empty` | 1 | 18×18 at (0, 0) | vector |  |  |
| `tick_box_button` | 40 | 18×18 at (0, 0) | vector | `grey` 1-9: stops at 1; `tick` 10-19: stops at 10 (+1 more stop/goto scripts in range); `cross` 20-29: stops at 20; `empty` 30-40: stops at 30 |  |
| `status` | 1 | 180×293.1 at (0, 0) | vector |  | background, button1=tick_box_button, button2=tick_box_button, button3=tick_box_button, button4=tick_box_button, button5=tick_box_button, button6=tick_box_button, mode |
| `talkie` | 111 | 739.05×143.45 at (-1.6, -1.5) | vector + bitmap 1065 | `init` 1-9: stops at 1; `start` 10-19: stops at 10; `wait_for_click` 20-29: stops at 20; `collect_text` 30-49: stops at 30; `popup` 50-99: stops at 99; `end` 100-111: stops at 100 (conditional: see script dump) | statement_text_field, speaker_box, big_invisible_button, user_input, input_button, head |
| `heart` | 1 | 24.2×23.3 at (0, 0) | vector |  |  |
| `digit` | 99 | 10.4×17.5 at (0, 0) | vector | `zero` 1-9: stops at 1; `one` 10-19: stops at 10; `two` 20-29: stops at 20; `three` 30-39: stops at 30; `four` 40-49: stops at 40; `five` 50-59: stops at 50; `six` 60-69: stops at 60; `seven` 70-79: stops at 70; `eight` 80-89: stops at 80; `nine` 90-99: stops at 90 |  |
| `score` | 1 | 73×32.1 at (0, 0) | vector |  | thousands=digit, hundreds=digit, tens=digit, units=digit |
| `superinfection_image` | 1 | 150.7×168.3 at (0, 0) | vector + bitmap 1138 |  |  |
| `milk_image` | 1 | 150.7×168.3 at (0, 0) | vector + bitmap 1144, 1146, 1148 |  | glass=milk_glass_icon |
| `lucy_image` | 1 | 150.7×168.3 at (0, 0) | vector |  |  |
| `slurm_image` | 1 | 150.7×168.3 at (0, 0) | vector |  |  |
| `level_intros` | 421 | 180×304.05 at (0, -10.95) | vector + bitmap 1138, 1141, 1144, 1146, 1148 | `level1` 1-39: stops at 3 (+6 more stop/goto scripts in range); `level2` 40-49: stops at 40 (+2 more stop/goto scripts in range); `level3` 50-69: stops at 50 (+2 more stop/goto scripts in range); `level4` 70-89: stops at 70 (+2 more stop/goto scripts in range); `level5` 90-109: stops at 90 (+2 more stop/goto scripts in range); `level6` 110-139: stops at 110 (+3 more stop/goto scripts in range); `level7` 140-189: stops at 140 (+4 more stop/goto scripts in range); `level8` 190-220: stops at 190 (+3 more stop/goto scripts in range); `level9` 221-240: stops at 221 (+2 more stop/goto scripts in range); `level10` 241-421: stops at 241 (+6 more stop/goto scripts in range) | invisible_button |
| `e_phone` | 129 | 93.12×177.67 at (697.4, 263.4) | vector + bitmap 1138, 1141, 1144, 1146, 1148 | `small` 2-9: stops at 2; `grow` 10-29 (no script: runs on); `large` 30-39: stops at 30; `shrink` 40-69: at 60 gotoAndPlay("small"); `message` 70-129 (no script: runs on) | screen, bigScreen=level_intros |

### 5.6 Game show and cut-scenes (`eBugGameShow.swf`, `cutscene_introduction.swf`)

| Linkage (eBugGameShow.swf) | Frames | Frame-1 bounds (px) | Art | Labels | Named children |
|---|---:|---|---|---|---|
| `talkie` | 60 | 761.75×143.45 at (-1.6, -1.5) | vector + bitmap 14 | 1 init, 10 start, 20 wait_for_click, 30 collect_text, 50 end | statement_text_field; speaker_box; big_invisible_button; user_input; input_button |
| `shrinking_zone` | 1 | 800.45×452.65 at (0, -0.05) | vector |  |  |
| `shine` | 1 | 17.5×11.7 at (0, 0) | vector |  |  |
| `timer` | 130 | 59.8×68.5 at (0, 0) | vector | 1 p0, 10 p1, 20 p2, 30 p3, 40 p4, 50 p5, 60 p6, 70 p7, 80 p8, 90 p9, 100 p10, 110 p11, 120 p12 |  |
| `question_board` | 1 | 800×450.01 at (0, 0) | vector |  | question_heading; question_body; point_value; timer (labels 1:p0, 10:p1, 20:p2, 30:p3, 40:p4, 50:p5, 60:p6, 70:p7, 80:p8, 90:p9, 100:p10, 110:p11, 120:p12); agree_button; dont_know_button; disagree_button |
| `digit` | 99 | 10.4×17.5 at (0, 0) | vector | 1 zero, 10 one, 20 two, 30 three, 40 four, 50 five, 60 six, 70 seven, 80 eight, 90 nine |  |
| `score` | 1 | 73×32.1 at (0, 0) | vector |  | thousands (labels 1:zero, 10:one, 20:two, 30:three, 40:four, 50:five, 60:six, 70:seven, 80:eight, 90:nine); hundreds (labels 1:zero, 10:one, 20:two, 30:three, 40:four, 50:five, 60:six, 70:seven, 80:eight, 90:nine); tens (labels 1:zero, 10:one, 20:two, 30:three, 40:four, 50:five, 60:six, 70:seven, 80:eight, 90:nine); units (labels 1:zero, 10:one, 20:two, 30:three, 40:four, 50:five, 60:six, 70:seven, 80:eight, 90:nine) |
| `gameshow_set` | 1 | 800×450 at (0, 0) | vector |  | harry; amy; gsh (labels 1:stop, 21:excited, 171:serious, 345:disappointed); podia |
| `GameShow` | 1 | 801×451 at (-0.5, -0.5) | vector |  |  |

Characters nested in `gameshow_set` (not exported, reached by instance name):

- sprite 479: 1124 frames, labels 1 `stop`, 10 `idle`, 82 `neutral`, 255 `cautious`, 420 `condifent`, 600 `happy`, 800 `disappointed`, 999 `curious`; frame-1 bounds 124.9×191.3 at (10.82, 5.01); all-frames 194.36×215.54 at (-34.89, -13.58); vector only.
- sprite 732: 1124 frames, labels 1 `stop`, 10 `idle`, 82 `neutral`, 255 `cautious`, 420 `condifent`, 600 `happy`, 800 `disappointed`, 999 `curious`; frame-1 bounds 163.66×207.72 at (2.21, -1.53); all-frames 233.67×242.9 at (-33.46, -31.29); vector only.
- sprite 894: 471 frames, labels 1 `stop`, 21 `excited`, 171 `serious`, 345 `disappointed`; frame-1 bounds 343.45×585.43 at (78.7, -3.88); all-frames 523.06×753.63 at (-5.17, -8.28); vector only.

In `gameshow_set` (sprite 897) the instances are `harry` = sprite 480 (wrapping the 1124-frame sprite 479), `amy` = sprite 733 (wrapping 732), `gsh` (the host) = sprite 894 and `podia` = sprite 896. The emotion animations are assembled from 18 nested clips of exactly 125 frames each (for example sprite 371 inside one-frame wrapper 372), which run on their own clocks once placed; this is why the Unity remake has about 125 PNG frames per emotion.

**cutscene_introduction.swf** root labels: 1 `init`, 10 `start_intro`, 20 `choose_avatar`, 30 `get_details`. Named instances: `gameshow_set`, `harry`, `amy`, `gsh`, `podia`, `talkie`, `xmlParseMovieClip`, `shrinking_zone`, `amyButton`, `harryButton`, `nickname_label`, `age_label`, `email_label`, `nickname_input`, `email_input`, `age_input`, `submit_button`.

`cutscene_introduction.swf` holds its own copies of `gameshow_set` (sprite 8), Harry (241, 1124-frame sprite 240), Amy (600, 1124-frame sprite 599) and the host (`gsh`, 758, 471 frames), exports `talkie` and `digit`, and adds the avatar-choice buttons and the nickname/age/email form.

### 5.7 Kitchen game (`kitchen_game_main.swf`)

The food symbols are the `FoodItem` asset names from `KitchenGame.as:1236-1285`; each has a `clingfilm_` twin attached on top when the food is wrapped (`KitchenGame.as:715`, `:769`). All are vector. `kitchen_game_main.swf` also places 27 `restpoint*` markers (sprite 655) on its root timeline that give the resting positions for food in the fridge, cupboards, fruit bowl and bin.

| Food linkage | Frame-1 bounds (px) | `clingfilm_` variant bounds | Art |
|---|---|---|---|
| `yogurt` | 37.85×43.8 at (0, 0) | 37.85×43.8 at (0, 0) | vector |
| `tomatoes` | 66.7×29.45 at (0, 0) | 66.64×29.46 at (0, 0) | vector |
| `mouldy_bread` | 83.75×60.65 at (0, 0) | 83.77×60.63 at (0, 0) | vector |
| `burst_yogurt` | 50.6×51.2 at (0, 0) | 50.58×51.24 at (0, 0) | vector |
| `carrots` | 66.35×36.8 at (0, 0) | 66.38×36.81 at (0, 0) | vector |
| `orange` | 34.5×34.45 at (0, 0) | 34.45×34.45 at (0, 0) | vector |
| `bananas` | 65×67.2 at (0, 0) | 65.02×67.21 at (0, 0) | vector |
| `mouldy_orange` | 34.5×34.45 at (0, 0) | 34.45×34.45 at (0, 0) | vector |
| `cheese` | 53.75×34.1 at (0, 0) | 53.74×34.09 at (0, 0) | vector |
| `orange_juice` | 35.7×64.55 at (0, 0) | 35.65×64.52 at (0, 0) | vector |
| `red_apple` | 35.9×40.8 at (0, 0) | 35.95×40.8 at (0, 0) | vector |
| `raw_lamb` | 63.4×29.5 at (0, 0) | 63.39×29.5 at (0, 0) | vector |
| `cooked_lamb` | 63.95×29.5 at (0, 0) | 63.39×29.5 at (0, 0) | vector |
| `green_apple` | 35.9×40.85 at (0, 0) | 35.95×40.8 at (0, 0) | vector |
| `pear` | 33.7×58.95 at (0, 0) | 33.69×58.96 at (0.02, 0) | vector |
| `milk` | 35.6×64.5 at (0, 0) | 35.65×64.52 at (0, 0) | vector |
| `soup` | 40.15×65.65 at (0, 0) | 40.21×65.71 at (0, 0) | vector |
| `raw_chicken` | 55.85×38.75 at (0, 0) | 55.87×38.74 at (0, 0) | vector |
| `broccoli` | 66.1×54.9 at (0, 0) | 66.15×54.91 at (0.02, 0) | vector |
| `cooked_chicken` | 55.85×38.75 at (0, 0) | 55.87×38.74 at (0, 0) | vector |
| `raw_sausages` | 61.65×42.05 at (0, 0) | 61.66×41.97 at (0, 0.02) | vector |
| `raw_steak` | 48.05×28.3 at (0, 0) | 48.02×28.2 at (0, 0) | vector |
| `cooked_steak` | 48.05×28.3 at (0, 0) | 48.02×28.2 at (0, 0) | vector |
| `spring_onion` | 72.35×36.8 at (0, 0) | 72.26×36.85 at (0, 0) | vector |
| `bread` | 83.75×60.6 at (0, 0) | 83.77×60.63 at (0, 0) | vector |

| Scene linkage | Frames | Frame-1 bounds (px) | Art | Labels |
|---|---:|---|---|---|
| `kitchen_bg` | 1 | 891×486.3 at (-448.95, -236.2) | vector |  |
| `kitchen_fg` | 1 | 518.65×288.75 at (-458.95, -57.15) | vector |  |
| `fridge_shelf_1` | 1 | 94.6×29.7 at (0, 0) | vector |  |
| `fridge_shelf_2` | 1 | 92.7×54.6 at (0, 0) | vector |  |
| `fridge_shelf_3` | 1 | 106.15×47.5 at (0, 0) | vector |  |
| `fruitbowl` | 1 | 75.05×33.95 at (0, 0) | vector |  |
| `sink_area` | 50 | 149.5×86.55 at (0, 0) | vector | 1 tab_stop, 10 tab_wash_hand |
| `bag` | 1 | 113×95.3 at (0, 0) | vector |  |
| `tissues` | 1 | 90.55×58.45 at (0, 0) | vector |  |
| `clingfilm` | 1 | 62.7×44.5 at (0, 0) | vector |  |
| `ephone_ingame` | 1 | 1.8×21.45 at (0.35, -0.1) | vector |  |
| `harry` | 1 | 193.23×282.78 at (19.04, 8.48) | vector |  |
| `amy` | 1 | 226.03×285.76 at (4.84, 4.41) | vector |  |

Animated clips inside the kitchen avatars and the throw area (not exported):

- sprite 169 (inside harry): 600 frames, labels 1 `stop`, 10 `idle`, 47 `fridge`, 85 `cupboard`, 130 `bin`, 165 `bowl`, 205 `cling_film_start`, 235 `cling_film_mid`, 285 `cling_film_end`, 335 `sneeze_Start`, 360 `sneeze_mid`, 390 `sneeze_tissue_end`, 440 `sneeze_food_end`, 530 `window`, 565 `wash_hands`.
- sprite 612 (inside amy): 600 frames, labels 1 `stop`, 10 `idle`, 47 `fridge`, 85 `cupboard`, 130 `bin`, 165 `bowl`, 205 `cling_film_start`, 235 `cling_film_mid`, 285 `cling_film_end`, 335 `sneeze_Start`, 360 `sneeze_mid`, 390 `sneeze_tissue_end`, 440 `sneeze_food_end`, 530 `window`, 565 `wash_hands`.
- sprite 659 (inside (root timeline)): 1020 frames, labels 1 `idle`, 1 `foodContainer`, 47 `fridge_top_left`, 85 `cupboard_top_left`, 130 `bin`, 165 `bowl`, 530 `window`, 600 `fridge_top_right`, 625 `fridge_mid_left`, 655 `fridge_mid_right`, 685 `fridge_bottom_left`, 710 `fridge_bottom_right`, 734 `fridge_box_left`, 760 `fridge_box_right`, 795 `fridge_side_top_back`, 820 `fridge_side_top_front`, 845 `fridge_side_bottom_back`, 870 `fridge_side_bottom_front`, 895 `cupboard_top_right`, 920 `cupboard_mid_left`, 940 `cupboard_mid_right`, 966 `cupboard_bottom_left`, 991 `cupboard_bottom_right`.

The kitchen avatars are attached with `theGame.attachMovie("amy"|"harry", "avatar", ..., {_x: 65.5, _y: 8.7})` (`KitchenGame.as:1106-1108`). `kitchen_game_intro_level_0.swf` to `_3.swf` each have one full-screen DefineBits JPEG (824×457, `bitmaps/kitchen_game_intro_level_N/1.jpg`, a kitchen illustration) and text fields; `kitchen_game_outro.swf` and `summary_page.swf` are vector/text screens on a `#cccc00` background.

### 5.8 Backgrounds and full-screen art

| Screen | Where | Art |
|---|---|---|
| Platformer backdrop | `introductionToMicrobes_platformer.swf` stage colour `#0099cc`; no background symbol | flat colour |
| Splash (TV) | `splash.swf` root: one 170-frame sprite (id 58) at scale 0.983×0.979; three 584×345 DefineBitsLossless frames of TV static (`bitmaps/splash/16.png`, `18.png`, `20.png`) plus vector TV and a 99-frame digit counter | vector + 3 bitmaps |
| Game show studio | `gameshow_set` (800×450) in `eBugGameShow.swf` and `cutscene_introduction.swf`; raster copy in the unused `Game_Show.swf` (bitmaps 308 and 868, 803×453) | vector (raster copy exists) |
| Shrinking zone | `shrinking_zone` (800.45×452.65) | vector |
| Question board | `question_board` (800×450) | vector |
| Kitchen | `kitchen_bg` (891×486.3, registration at its centre) and `kitchen_fg` (518.65×288.75) | vector |
| Kitchen intros | `kitchen_game_intro_level_N.swf` 824×457 JPEG | bitmap |
| Advert buttons | `ad.swf`/`ad2.swf` (300×154 / 300×151, 12 fps) | vector + small bitmaps |

### 5.9 Avatar body-part symbols

These are exported only because each is bound with `Object.registerClass` to a colour-swap class (`AmySkinColouredObject`, `HarryShirtColouredObject` and so on) for the avatar customisation that was never finished (`junior-game-documentation.md`, "Src Folder"). They are not referenced by name in code.

<details><summary>movies/amy.swf: 58 body-part symbols</summary>

`Amy_Hand_R_Skin_12`, `Amy_Hand_R_Skin_11`, `Amy_Hand_R_Skin_10`, `Amy_Hand_R_Skin_08`, `Amy_Hand_R_Skin_07`, `Amy_Hand_R_Skin_06`, `Amy_Hand_R_Skin_04`, `Amy_Hand_R_Skin_02`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_06`, `Amy_Hand_L_Skin_05`, `Amy_Hand_L_Skin_04`, `Amy_Hand_L_Skin_03`, `Amy_Hand_L_Skin_02`, `Amy_Hand_L_Skin_01`, `Amy_Hand_R_Skin_09`, `Amy_Hand_R_Skin_03`, `Amy_Hand_R_Skin_05`, `Amy_Arms_Game_R_Lower_02`, `Amy_Hand_R_Skin_01`, `Amy_Arms_Game_R_Upper_02`, `Amy_Eyes_Game_Default_Skin_02`, `Amy_Eyes_Game_Default_Skin_01`, `Amy_Head_Game_Side_Hair_Top`, `Amy_Head_Game_Side_Ear_Skin`, `Amy_Head_Game_Side_Face_Skin`, `Amy_Head_Game_Side_Hair_Band`, `Amy_Head_Game_Side_Hair_Bunches`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Shirt`, `Amy_Arms_Game_L_Lower_02`, `Amy_Arms_Game_L_Upper_02`, `Avatar_Hand_L_Skin_10_A`, `Avatar_Hand_L_Skin_10_B`, `Amy_Hand_L_Skin_10`, `Amy_Belt_Skirt_01`, `Amy_Belt`, `Amy_Torso_Game_Side_Skin`, `Amy_Skirt_02`, `Amy_Shoe_Game_Side_R_02`, `Amy_Shoe_Game_Side_R_01`, `Amy_Shoe_Game_Side_L_02`, `Amy_Shoe_Game_Side_L_01`, `Amy_Legs_Side_Upper_Game_R_B`, `Amy_Legs_Side_Upper_Game_R_A`, `Amy_Legs_Side_Upper_Game_L_B`, `Amy_Legs_Side_Upper_Game_L_A`, `Amy_Legs_Side_Lower_Game_R_01_C`, `Amy_Legs_Side_Lower_Game_R_01_B`, `Amy_Legs_Side_Lower_Game_R_01_A`, `Amy_Legs_Side_Lower_Game_L_01_C`, `Amy_Legs_Side_Lower_Game_L_01_A`, `Amy_Legs_Side_Lower_Game_L_01_B`

</details>

<details><summary>movies/cutscene_introduction.swf: 148 body-part symbols</summary>

`Harry_Arms_Game_L_Upper_01`, `Harry_Arms_Game_L_Upper_02`, `Harry_Arms_Game_L_Lower_02`, `Harry_Hand_L_Skin_10`, `Harry_Torso_Game_Side_Skin`, `Harry_Torso_Game_Side_Shirt`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Head_Game_Side_Neck`, `Harry_Head_Game_Side_Idle_Face_Skin`, `Harry_Head_Game_Side_Idle_Hair_Top`, `Harry_Head_Game_Side_Idle_Ear_Skin`, `Harry_Arms_Game_R_Upper_01`, `Harry_Arms_Game_R_Upper_02`, `Harry_Arms_Game_R_Lower_02`, `Harry_Hand_R_Skin_01`, `Harry_Hand_L_Skin_06`, `Harry_Head_Game_Side_Neutral_Face_Skin`, `Harry_Head_Game_Side_Neutral_Hair_Top`, `Harry_Head_Game_Side_Neutral_Ear_Skin`, `Harry_Eyes_Game_Neutral_Skin_01`, `Harry_Eyes_Game_Neutral_Skin_02`, `Harry_Hand_L_Skin_09`, `Harry_Hand_L_Skin_05`, `Harry_Hand_R_Skin_03`, `Harry_Head_Game_Side_Cautious_Face_Skin`, `Harry_Head_Game_Side_Cautious_Hair_Top`, `Harry_Head_Game_Side_Cautious_Ear_Skin`, `Amy_Eyes_Game_Default_Skin_02Harry_Eyes_Game_Cautious_Skin_02`, `Harry_Eyes_Game_Cautious_Skin_01`, `Harry_Hand_R_Skin_04`, `Harry_Head_Game_Side_Confident_Face_Skin`, `Harry_Head_Game_Side_Confident_Hair_Top`, `Harry_Head_Game_Side_Confident_Ear_Skin`, `Harry_Eyes_Game_confident_Skin_01`, `Harry_Eyes_Game_confident_Skin_02`, `Harry_Hand_L_Skin_02`, `" Harry_Hand_R_Skin_11"`, `Harry_Hand_L_Skin_01`, `Harry_Hand_R_Skin_05`, `Harry_Head_Game_Side_Happy_Face_Skin`, `Harry_Head_Game_Side_Happy_Hair_Top`, `Harry_Head_Game_Side_Happy_Ear_Skin`, `Harry_Eyes_Game_Happy_Skin_01`, `Harry_Eyes_Game_Happy_Skin_02`, `Harry_Head_Game_Side_Disappointed_Face_Skin`, `Harry_Eyes_Game_Disappointed_Skin_01`, `Harry_Eyes_Game_Disappointed_Skin_02`, `Harry_Head_Game_Side_Disappointed_Hair_Top`, `Harry_Head_Game_Side_Disappointed_Ear_Skin`, `Harry_Hand_L_Skin_04`, `Harry_Head_Game_Side_Curious_Face_Skin`, `Harry_Head_Game_Side_Curious_Hair_Top`, `Harry_Head_Game_Side_Curious_Ear_Skin`, `Harry_Eyes_Game_Curious_Skin_02`, `Harry_Eyes_Game_Curious_Skin_01`, `Amy_Arms_Game_L_Upper_02`, `Amy_Hand_L_Skin_10`, `Amy_Arms_Game_L_Lower_02`, `Amy_Torso_Game_Side_Skin`, `Amy_Torso_Game_Side_Shirt`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Idle_Hair_Bunches`, `Amy_Head_Game_Side_Idle_Hair_Band`, `Amy_Head_Game_Side_Idle_Face_Skin`, `Amy_Head_Game_Side_Idle_Ear_Skin`, `Amy_Head_Game_Side_Idle_Hair_Top`, `Amy_Arms_Game_R_Upper_02`, `Amy_Hand_R_Skin_01`, `Amy_Arms_Game_R_Lower_02`, `Amy_Head_Game_Side_Neutral_Hair_Bunches`, `Amy_Head_Game_Side_Neutral_Hair_Band`, `Amy_Head_Game_Side_Neutral_Face_Skin`, `Amy_Head_Game_Side_Neutral_Ear_Skin`, `Amy_Head_Game_Side_Neutral_Hair_Top`, `Amy_Eyes_Game_Neutral_Skin_01`, `Amy_Eyes_Game_Neutral_Skin_02`, `Amy_Hand_L_Skin_06`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_05`, `Amy_Hand_R_Skin_03`, `Amy_Head_Game_Side_Cautious_Hair_Bunches`, `Amy_Head_Game_Side_Cautious_Hair_Band`, `Amy_Head_Game_Side_Cautious_Face_Skin`, `Amy_Head_Game_Side_Cautious_Ear_Skin`, `Amy_Head_Game_Side_Cautious_Hair_Top`, `Amy_Eyes_Game_Cautious_Skin_01`, `Amy_Eyes_Game_Cautious_Skin_02`, `Amy_Hand_R_Skin_04`, `Amy_Head_Game_Side_Confident_Hair_Bunches`, `Amy_Head_Game_Side_Confident_Hair_Band`, `Amy_Head_Game_Side_Confident_Face_Skin`, `Amy_Head_Game_Side_Confident_Ear_Skin`, `Amy_Head_Game_Side_Confident_Hair_Top`, `Amy_Eyes_Game_confident_Skin_01`, `Amy_Eyes_Game_confident_Skin_02`, `Amy_Hand_L_Skin_02`, `Amy_Hand_R_Skin_11`, `Amy_Hand_L_Skin_01`, `Amy_Hand_R_Skin_05`, `Amy_Head_Game_Side_Happy_Hair_Bunches`, `Amy_Head_Game_Side_Happy_Hair_Band`, `Amy_Head_Game_Side_Happy_Face_Skin`, `Amy_Head_Game_Side_Happy_Ear_Skin`, `Amy_Head_Game_Side_Happy_Hair_Top`, `Amy_Eyes_Game_Happy_Skin_01`, `Amy_Eyes_Game_Happy_Skin_02`, `Amy_Head_Game_Side_Disappointed_Hair_Bunches`, `Amy_Head_Game_Side_Disappointed_Hair_Band`, `Amy_Head_Game_Side_Disappointed_Face_Skin`, `Amy_Head_Game_Side_Disappointed_Ear_Skin`, `Amy_Head_Game_Side_Disappointed_Hair_Top`, `Amy_Eyes_Game_Disappointed_Skin_01`, `Amy_Eyes_Game_Disappointed_Skin_02`, `Amy_Hand_L_Skin_04`, `Amy_Head_Game_Side_Curious_Hair_Bunches`, `Amy_Head_Game_Side_Curious_Hair_Band`, `Amy_Head_Game_Side_Curious_Face_Skin`, `Amy_Head_Game_Side_Curious_Ear_Skin`, `Amy_Head_Game_Side_Curious_Hair_Top`, `Amy_Eyes_Game_Curious_Skin_02`, `Amy_Eyes_Game_Curious_Skin_01`, `Amy_Hand_R_Skin_06`, `Amy_Hand_R_Skin_12`, `Amy_Hand_R_Skin_09`, `Amy_Hand_R_Skin_08`, `Amy_Hand_R_Skin_07`, `Amy_Hand_R_Skin_02`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_03`, `" Harry_Hand_R_Skin_12"`, `Harry_Hand_R_Skin_10`, `Harry_Hand_R_Skin_09`, `Harry_Hand_R_Skin_08`, `Harry_Hand_R_Skin_07`, `Harry_Hand_R_Skin_06`, `Harry_Hand_R_Skin_02`, `Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_03`

</details>

<details><summary>movies/eBugGameShow.swf: 148 body-part symbols</summary>

`Amy_Hand_R_Skin_12`, `Amy_Hand_R_Skin_09`, `Amy_Hand_R_Skin_08`, `Amy_Hand_R_Skin_07`, `Amy_Hand_R_Skin_02`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_03`, `" Harry_Hand_R_Skin_12"`, `Harry_Hand_R_Skin_10`, `Harry_Hand_R_Skin_09`, `Harry_Hand_R_Skin_08`, `Harry_Hand_R_Skin_07`, `Harry_Hand_R_Skin_06`, `Harry_Hand_R_Skin_02`, `Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_03`, `Amy_Hand_R_Skin_06`, `Amy_Eyes_Game_Curious_Skin_01`, `Amy_Eyes_Game_Curious_Skin_02`, `Amy_Head_Game_Side_Curious_Hair_Top`, `Amy_Head_Game_Side_Curious_Ear_Skin`, `Amy_Head_Game_Side_Curious_Face_Skin`, `Amy_Head_Game_Side_Curious_Hair_Band`, `Amy_Head_Game_Side_Curious_Hair_Bunches`, `Amy_Hand_L_Skin_04`, `Amy_Eyes_Game_Disappointed_Skin_02`, `Amy_Eyes_Game_Disappointed_Skin_01`, `Amy_Head_Game_Side_Disappointed_Hair_Top`, `Amy_Head_Game_Side_Disappointed_Ear_Skin`, `Amy_Head_Game_Side_Disappointed_Face_Skin`, `Amy_Head_Game_Side_Disappointed_Hair_Band`, `Amy_Head_Game_Side_Disappointed_Hair_Bunches`, `Amy_Eyes_Game_Happy_Skin_02`, `Amy_Eyes_Game_Happy_Skin_01`, `Amy_Head_Game_Side_Happy_Hair_Top`, `Amy_Head_Game_Side_Happy_Ear_Skin`, `Amy_Head_Game_Side_Happy_Face_Skin`, `Amy_Head_Game_Side_Happy_Hair_Band`, `Amy_Head_Game_Side_Happy_Hair_Bunches`, `Amy_Hand_R_Skin_05`, `Amy_Hand_L_Skin_01`, `Amy_Hand_R_Skin_11`, `Amy_Hand_L_Skin_02`, `Amy_Eyes_Game_confident_Skin_02`, `Amy_Eyes_Game_confident_Skin_01`, `Amy_Head_Game_Side_Confident_Hair_Top`, `Amy_Head_Game_Side_Confident_Ear_Skin`, `Amy_Head_Game_Side_Confident_Face_Skin`, `Amy_Head_Game_Side_Confident_Hair_Band`, `Amy_Head_Game_Side_Confident_Hair_Bunches`, `Amy_Hand_R_Skin_04`, `Amy_Eyes_Game_Cautious_Skin_02`, `Amy_Eyes_Game_Cautious_Skin_01`, `Amy_Head_Game_Side_Cautious_Hair_Top`, `Amy_Head_Game_Side_Cautious_Ear_Skin`, `Amy_Head_Game_Side_Cautious_Face_Skin`, `Amy_Head_Game_Side_Cautious_Hair_Band`, `Amy_Head_Game_Side_Cautious_Hair_Bunches`, `Amy_Hand_R_Skin_03`, `Amy_Hand_L_Skin_05`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_06`, `Amy_Eyes_Game_Neutral_Skin_02`, `Amy_Eyes_Game_Neutral_Skin_01`, `Amy_Head_Game_Side_Neutral_Hair_Top`, `Amy_Head_Game_Side_Neutral_Ear_Skin`, `Amy_Head_Game_Side_Neutral_Face_Skin`, `Amy_Head_Game_Side_Neutral_Hair_Band`, `Amy_Head_Game_Side_Neutral_Hair_Bunches`, `Amy_Arms_Game_R_Lower_02`, `Amy_Hand_R_Skin_01`, `Amy_Arms_Game_R_Upper_02`, `Amy_Head_Game_Side_Idle_Hair_Top`, `Amy_Head_Game_Side_Idle_Ear_Skin`, `Amy_Head_Game_Side_Idle_Face_Skin`, `Amy_Head_Game_Side_Idle_Hair_Band`, `Amy_Head_Game_Side_Idle_Hair_Bunches`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Shirt`, `Amy_Torso_Game_Side_Skin`, `Amy_Arms_Game_L_Lower_02`, `Amy_Hand_L_Skin_10`, `Amy_Arms_Game_L_Upper_02`, `Harry_Eyes_Game_Curious_Skin_01`, `Harry_Eyes_Game_Curious_Skin_02`, `Harry_Head_Game_Side_Curious_Ear_Skin`, `Harry_Head_Game_Side_Curious_Hair_Top`, `Harry_Head_Game_Side_Curious_Face_Skin`, `Harry_Hand_L_Skin_04`, `Harry_Head_Game_Side_Disappointed_Ear_Skin`, `Harry_Head_Game_Side_Disappointed_Hair_Top`, `Harry_Eyes_Game_Disappointed_Skin_02`, `Harry_Eyes_Game_Disappointed_Skin_01`, `Harry_Head_Game_Side_Disappointed_Face_Skin`, `Harry_Eyes_Game_Happy_Skin_02`, `Harry_Eyes_Game_Happy_Skin_01`, `Harry_Head_Game_Side_Happy_Ear_Skin`, `Harry_Head_Game_Side_Happy_Hair_Top`, `Harry_Head_Game_Side_Happy_Face_Skin`, `Harry_Hand_R_Skin_05`, `Harry_Hand_L_Skin_01`, `" Harry_Hand_R_Skin_11"`, `Harry_Hand_L_Skin_02`, `Harry_Eyes_Game_confident_Skin_02`, `Harry_Eyes_Game_confident_Skin_01`, `Harry_Head_Game_Side_Confident_Ear_Skin`, `Harry_Head_Game_Side_Confident_Hair_Top`, `Harry_Head_Game_Side_Confident_Face_Skin`, `Harry_Hand_R_Skin_04`, `Harry_Eyes_Game_Cautious_Skin_01`, `Amy_Eyes_Game_Default_Skin_02Harry_Eyes_Game_Cautious_Skin_02`, `Harry_Head_Game_Side_Cautious_Ear_Skin`, `Harry_Head_Game_Side_Cautious_Hair_Top`, `Harry_Head_Game_Side_Cautious_Face_Skin`, `Harry_Hand_R_Skin_03`, `Harry_Hand_L_Skin_05`, `Harry_Hand_L_Skin_09`, `Harry_Eyes_Game_Neutral_Skin_02`, `Harry_Eyes_Game_Neutral_Skin_01`, `Harry_Head_Game_Side_Neutral_Ear_Skin`, `Harry_Head_Game_Side_Neutral_Hair_Top`, `Harry_Head_Game_Side_Neutral_Face_Skin`, `Harry_Hand_L_Skin_06`, `Harry_Hand_R_Skin_01`, `Harry_Arms_Game_R_Lower_02`, `Harry_Arms_Game_R_Upper_02`, `Harry_Arms_Game_R_Upper_01`, `Harry_Head_Game_Side_Idle_Ear_Skin`, `Harry_Head_Game_Side_Idle_Hair_Top`, `Harry_Head_Game_Side_Idle_Face_Skin`, `Harry_Head_Game_Side_Neck`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Shirt`, `Harry_Torso_Game_Side_Skin`, `Harry_Hand_L_Skin_10`, `Harry_Arms_Game_L_Lower_02`, `Harry_Arms_Game_L_Upper_02`, `Harry_Arms_Game_L_Upper_01`

</details>

<details><summary>movies/harry.swf: 53 body-part symbols</summary>

`Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_09`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_06`, `Harry_Hand_L_Skin_05`, `Harry_Hand_L_Skin_04`, `Harry_Hand_L_Skin_03`, `Harry_Hand_L_Skin_02`, `Harry_Hand_L_Skin_01`, `" Harry_Hand_R_Skin_12"`, `" Harry_Hand_R_Skin_11"`, `Harry_Hand_R_Skin_10`, `Harry_Hand_R_Skin_08`, `Harry_Hand_R_Skin_07`, `Harry_Hand_R_Skin_06`, `Harry_Hand_R_Skin_04`, `Harry_Hand_R_Skin_02`, `Harry_Hand_R_Skin_09`, `Harry_Hand_R_Skin_03`, `Harry_Hand_R_Skin_05`, `Harry_Hand_R_Skin_01`, `Harry_Arms_Game_R_Lower_02`, `Harry_Arms_Game_R_Upper_02`, `Harry_Arms_Game_R_Upper_01`, `Harry_Eyes_Game_Default_Skin_02`, `Harry_Eyes_Game_Default_Skin_01`, `Harry_Head_Game_Side_Ear_Skin`, `Harry_Head_Game_Side_Hair_Top`, `Harry_Head_Game_Side_Face_Skin`, `Harry_Head_Game_Side_Neck`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Shirt`, `Harry_Hand_L_Skin_10`, `Harry_Arms_Game_L_Lower_02`, `Harry_Arms_Game_L_Upper_02`, `Harry_Arms_Game_L_Upper_01`, `Harry_Belt`, `Amy_Torso_Game_Side_Skin`, `Harry_Shoe_Game_Side_R_01`, `Harry_Shoe_Game_Side_R_02`, `Harry_Shoe_Game_Side_L_01`, `Harry_Shoe_Game_Side_L_02`, `Harry_Legs_Side_Upper_Game_R_B`, `Harry_Legs_Side_Upper_Game_R_A`, `Harry_Legs_Side_Upper_Game_L_A`, `Harry_Legs_Side_Upper_Game_L_B`, `Harry_Legs_Side_Lower_Game_R_01`, `Harry_Legs_Side_Lower_Game_L_01`

</details>

<details><summary>movies/junior_game_assets.swf: 80 body-part symbols</summary>

`Amy_Legs_Side_Lower_Game_L_01_B`, `Amy_Legs_Side_Lower_Game_L_01_A`, `Amy_Legs_Side_Lower_Game_L_01_C`, `Amy_Legs_Side_Lower_Game_R_01_A`, `Amy_Legs_Side_Lower_Game_R_01_B`, `Amy_Legs_Side_Lower_Game_R_01_C`, `Amy_Legs_Side_Upper_Game_L_A`, `Amy_Legs_Side_Upper_Game_L_B`, `Amy_Legs_Side_Upper_Game_R_A`, `Amy_Legs_Side_Upper_Game_R_B`, `Amy_Shoe_Game_Side_L_01`, `Amy_Shoe_Game_Side_L_02`, `Amy_Belt_Skirt_01`, `Amy_Belt`, `Amy_Arms_Game_L_Upper_02`, `Amy_Hand_R_Skin_10_A`, `Amy_Hand_R_Skin_10_B`, `Amy_Arms_Game_L_Lower_02`, `Amy_Torso_Game_Side_Shirt`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Hair_Bunches`, `Amy_Head_Game_Side_Hair_Band`, `Amy_Head_Game_Side_Face_Skin`, `Amy_Head_Game_Side_Ear_Skin`, `Amy_Head_Game_Side_Hair_Top`, `Amy_Arms_Game_R_Upper_02`, `Amy_Hand_R_Skin_12`, `Amy_Arms_Game_R_Lower_02`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_06`, `Amy_Hand_L_Skin_05`, `Amy_Hand_L_Skin_04`, `Amy_Hand_L_Skin_03`, `Amy_Hand_L_Skin_02`, `Amy_Hand_L_Skin_01`, `Harry_Legs_Side_Lower_Game_L_01`, `Harry_Legs_Side_Lower_Game_R_01`, `Harry_Legs_Side_Upper_Game_L_B`, `Harry_Legs_Side_Upper_Game_L_A`, `Harry_Legs_Side_Upper_Game_R_A`, `Harry_Legs_Side_Upper_Game_R_B`, `Harry_Shoe_Game_Side_L_02`, `Harry_Shoe_Game_Side_L_01`, `Amy_Torso_Game_Side_Skin`, `Harry_Belt`, `Harry_Arms_Game_L_Upper_01`, `Harry_Arms_Game_L_Upper_02`, `Harry_Arms_Game_L_Lower_02`, `Harry_Hand_L_Skin_10`, `Harry_Torso_Game_Side_Shirt`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Head_Game_Side_Neck`, `Harry_Head_Game_Side_Face_Skin`, `Harry_Head_Game_Side_Hair_Top`, `Harry_Head_Game_Side_Ear_Skin`, `Amy_Eyes_Game_Default_Skin_01`, `Amy_Eyes_Game_Default_Skin_02`, `Harry_Arms_Game_R_Upper_01`, `Harry_Arms_Game_R_Upper_02`, `Harry_Arms_Game_R_Lower_02`, `" Harry_Hand_R_Skin_12"`, `Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_09`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_06`, `Harry_Hand_L_Skin_05`, `Harry_Hand_L_Skin_04`, `Harry_Hand_L_Skin_03`, `Harry_Hand_L_Skin_02`, `Harry_Hand_L_Skin_01`

</details>

<details><summary>movies/kitchen_game_main.swf: 123 body-part symbols</summary>

`Harry_Belt`, `Harry_Arms_Game_L_Lower_02`, `Harry_Hand_L_Skin_01`, `Harry_Head_Game_Side_Face_Skin`, `Harry_Head_Game_Side_Hair_Top`, `Harry_Head_Game_Side_Ear_Skin`, `Harry_Eyes_Game_Default_Skin_01`, `Harry_Eyes_Game_Default_Skin_02`, `Harry_Arms_Game_R_Lower_02`, `Harry_Hand_R_Skin_03`, `Harry_Hand_L_Skin_05`, `Harry_Hand_R_Skin_05`, `Harry_Hand_R_Skin_01`, `Harry_Hand_L_Skin_06`, `Harry_Head_Game_Side_Cupboard_Face_Skin`, `Harry_Head_Game_Side_Cupboard_Hair_Top`, `Harry_Head_Game_Side_Cupboard_Ear_Skin`, `Harry_Hand_R_Skin_02`, `Harry_Head_Game_Side_Bin_Face_Skin`, `Harry_Head_Game_Side_Bin_Hair_Top`, `Harry_Head_Game_Side_Bin_Ear_Skin`, `Harry_Hand_R_Skin_04`, `Harry_Hand_L_Skin_02`, `Harry_Hand_L_Skin_10`, `Harry_Head_Game_Side_Sneeze_Face_Skin`, `Harry_Head_Game_Side_Sneeze_Hair_Top`, `Harry_Head_Game_Side_Sneeze_Ear_Skin`, `Harry_Hand_L_Skin_04`, `Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_09`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_03`, `" Harry_Hand_R_Skin_12"`, `" Harry_Hand_R_Skin_11"`, `Harry_Hand_R_Skin_10`, `Harry_Hand_R_Skin_09`, `Harry_Hand_R_Skin_08`, `Harry_Hand_R_Skin_07`, `Harry_Hand_R_Skin_06`, `Amy_Eyes_Game_Bin_Skin_02`, `Amy_Eyes_Game_Bin_Skin_01`, `Amy_Eyes_Game_Fridge_Skin_02`, `Amy_Eyes_Game_Fridge_Skin_01`, `Amy_Eyes_Game_Cupboard_Skin_02`, `Amy_Eyes_Game_Cupboard_Skin_01`, `Amy_Eye_Skin_02`, `Amy_Eye_Sad_Skin_02`, `Amy_Eye_Sad_Skin_01`, `Amy_Eye_Skin_01`, `Amy_Eye_Happt_Skin_01`, `Amy_Eye_Happt_Skin_02`, `Amy_Eye_Skin_Open_01`, `Amy_Eye_Skin_Open_02`, `Amy_Eyes_Game_Default_Skin_01`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_10`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_03`, `Amy_Hand_R_Skin_12`, `Amy_Hand_R_Skin_11`, `Amy_Hand_R_Skin_10`, `Amy_Hand_R_Skin_09`, `Amy_Hand_R_Skin_08`, `Amy_Hand_R_Skin_07`, `Amy_Hand_R_Skin_06`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Arms_Game_L_Upper_01`, `Harry_Arms_Game_R_Upper_01`, `Amy_Hand_L_Skin_04`, `Amy_Head_Game_Side_Sneeze_Hair_Top`, `Amy_Head_Game_Side_Sneeze_Ear_Skin`, `Amy_Head_Game_Side_Sneeze_Face_Skin`, `Amy_Head_Game_Side_Sneeze_Hair_Band`, `Amy_Head_Game_Side_Sneeze_Hair_Bunches`, `Amy_Hand_L_Skin_02`, `Amy_Hand_R_Skin_04`, `Amy_Head_Game_Side_Bin_Hair_Top`, `Amy_Head_Game_Side_Bin_Ear_Skin`, `Amy_Head_Game_Side_Bin_Face_Skin`, `Amy_Head_Game_Side_Bin_Hair_Band`, `Amy_Head_Game_Side_Bin_Hair_Bunches`, `Amy_Hand_R_Skin_02`, `Amy_Hand_L_Skin_06`, `Amy_Head_Game_Side_Cupboard_Hair_Top`, `Amy_Head_Game_Side_Cupboard_Ear_Skin`, `Amy_Head_Game_Side_Cupboard_Face_Skin`, `Amy_Head_Game_Side_Cupboard_Hair_Band`, `Amy_Head_Game_Side_Cupboard_Hair_Bunches`, `Amy_Hand_R_Skin_01`, `Amy_Hand_R_Skin_05`, `Amy_Head_Game_Side_Fridge_Hair_Top`, `Amy_Head_Game_Side_Fridge_Ear_Skin`, `Avatar_Head_Game_Side_Fridge_Ear_All`, `Amy_Head_Game_Side_Fridge_Face_Skin`, `Amy_Head_Game_Side_Fridge_Hair_Band`, `Amy_Head_Game_Side_Fridge_Hair_Bunches`, `Amy_Hand_L_Skin_05`, `Amy_Arms_Game_R_Lower_02`, `Amy_Arms_Game_R_Upper_02`, `Amy_Hand_R_Skin_03`, `Amy_Head_Game_Side_Hair_Top`, `Amy_Head_Game_Side_Ear_Skin`, `Amy_Eyes_Game_Default_Skin_02`, `Amy_Head_Game_Side_Face_Skin`, `Amy_Head_Game_Side_Hair_Band`, `Amy_Head_Game_Side_Hair_Bunches`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Shirt`, `Amy_Arms_Game_L_Lower_02`, `Amy_Arms_Game_L_Upper_02`, `Amy_Hand_L_Skin_01`, `Amy_Belt`, `Amy_Torso_Game_Side_Skin`, `Amy_Arms_Game_R_Lower_Front`

</details>

<details><summary>movies/shrinking_amy.swf: 57 body-part symbols</summary>

`Amy_Shoe_Game_Side_R_02`, `Amy_Shoe_Game_Side_R_01`, `Amy_Skirt_02`, `Amy_Hand_L_Skin_12`, `Amy_Hand_L_Skin_11`, `Amy_Hand_L_Skin_09`, `Amy_Hand_L_Skin_08`, `Amy_Hand_L_Skin_07`, `Amy_Hand_L_Skin_06`, `Amy_Hand_L_Skin_05`, `Amy_Hand_L_Skin_04`, `Amy_Hand_L_Skin_03`, `Amy_Hand_L_Skin_02`, `Amy_Hand_L_Skin_01`, `Amy_Hand_R_Skin_11`, `Amy_Hand_R_Skin_10`, `Amy_Hand_R_Skin_09`, `Amy_Hand_R_Skin_08`, `Amy_Hand_R_Skin_07`, `Amy_Hand_R_Skin_06`, `Amy_Hand_R_Skin_05`, `Amy_Hand_R_Skin_04`, `Amy_Hand_R_Skin_03`, `Amy_Hand_R_Skin_02`, `Amy_Hand_R_Skin_01`, `Amy_Arms_Game_R_Lower_02`, `Amy_Hand_R_Skin_12`, `Amy_Arms_Game_R_Upper_02`, `Amy_Eyes_Game_Default_Skin_02`, `Amy_Eyes_Game_Default_Skin_01`, `Amy_Head_Game_Side_Hair_Top`, `Amy_Head_Game_Side_Ear_Skin`, `Amy_Head_Game_Side_Face_Skin`, `Amy_Head_Game_Side_Hair_Band`, `Amy_Head_Game_Side_Hair_Bunches`, `Amy_Torso_Game_Side_Tie_01`, `Amy_Head_Game_Side_Neck`, `Amy_Torso_Game_Side_Shirt`, `Amy_Arms_Game_L_Lower_02`, `Amy_Hand_R_Skin_10_B`, `Amy_Hand_R_Skin_10_A`, `Amy_Arms_Game_L_Upper_02`, `Amy_Belt`, `Amy_Torso_Game_Side_Skin`, `Amy_Belt_Skirt_01`, `Amy_Shoe_Game_Side_L_02`, `Amy_Shoe_Game_Side_L_01`, `Amy_Legs_Side_Upper_Game_R_B`, `Amy_Legs_Side_Upper_Game_R_A`, `Amy_Legs_Side_Upper_Game_L_B`, `Amy_Legs_Side_Upper_Game_L_A`, `Amy_Legs_Side_Lower_Game_R_01_C`, `Amy_Legs_Side_Lower_Game_R_01_B`, `Amy_Legs_Side_Lower_Game_R_01_A`, `Amy_Legs_Side_Lower_Game_L_01_C`, `Amy_Legs_Side_Lower_Game_L_01_A`, `Amy_Legs_Side_Lower_Game_L_01_B`

</details>

<details><summary>movies/shrinking_harry.swf: 61 body-part symbols</summary>

`Amy_Legs_Side_Lower_Game_L_01_C`, `Amy_Legs_Side_Lower_Game_L_01_A`, `Amy_Legs_Side_Lower_Game_L_01_B`, `Amy_Legs_Side_Lower_Game_R_01_C`, `Amy_Legs_Side_Lower_Game_R_01_B`, `Amy_Legs_Side_Lower_Game_R_01_A`, `Harry_Shoe_Game_Side_R_01`, `Harry_Shoe_Game_Side_R_02`, `Harry_Hand_L_Skin_12`, `" Harry_Hand_L_Skin_11"`, `Harry_Hand_L_Skin_09`, `Harry_Hand_L_Skin_08`, `Harry_Hand_L_Skin_07`, `Harry_Hand_L_Skin_06`, `Harry_Hand_L_Skin_05`, `Harry_Hand_L_Skin_04`, `Harry_Hand_L_Skin_03`, `Harry_Hand_L_Skin_02`, `Harry_Hand_L_Skin_01`, `" Harry_Hand_R_Skin_11"`, `Harry_Hand_R_Skin_10`, `Harry_Hand_R_Skin_09`, `Harry_Hand_R_Skin_08`, `Harry_Hand_R_Skin_07`, `Harry_Hand_R_Skin_06`, `Harry_Hand_R_Skin_05`, `Harry_Hand_R_Skin_04`, `Harry_Hand_R_Skin_03`, `Harry_Hand_R_Skin_02`, `Harry_Hand_R_Skin_01`, `Amy_Head_Game_Side_Hair_Band`, `Amy_Head_Game_Side_Hair_Bunches`, `" Harry_Hand_R_Skin_12"`, `Harry_Arms_Game_R_Lower_02`, `Harry_Arms_Game_R_Upper_02`, `Harry_Arms_Game_R_Upper_01`, `Amy_Eyes_Game_Default_Skin_02`, `Amy_Eyes_Game_Default_Skin_01`, `Harry_Head_Game_Side_Ear_Skin`, `Harry_Head_Game_Side_Hair_Top`, `Harry_Head_Game_Side_Face_Skin`, `Harry_Head_Game_Side_Neck`, `Harry_Torso_Game_Side_Collar_02`, `Harry_Torso_Game_Side_Collar_01`, `Harry_Torso_Game_Side_Collar_03`, `Harry_Torso_Game_Side_Buttons`, `Harry_Torso_Game_Side_Shirt`, `Harry_Hand_L_Skin_10`, `Harry_Arms_Game_L_Lower_02`, `Harry_Arms_Game_L_Upper_02`, `Harry_Arms_Game_L_Upper_01`, `Harry_Belt`, `Amy_Torso_Game_Side_Skin`, `Harry_Shoe_Game_Side_L_01`, `Harry_Shoe_Game_Side_L_02`, `Harry_Legs_Side_Upper_Game_R_B`, `Harry_Legs_Side_Upper_Game_R_A`, `Harry_Legs_Side_Upper_Game_L_A`, `Harry_Legs_Side_Upper_Game_L_B`, `Harry_Legs_Side_Lower_Game_R_01`, `Harry_Legs_Side_Lower_Game_L_01`

</details>

### 5.10 AS2 classes compiled into each run-time SWF

| SWF | Compiled AS2 classes (`__Packages.*` exports) | Symbols bound with `Object.registerClass` (linkage -> class) |
|---|---|---|
| movies/amy.swf | none |  |
| movies/cutscene_introduction.swf | ebug.junior.CutSceneXMLParser, EBugColouredItem, ColourSwap, HarrySkinColouredObject, HarryShirtColouredObject, HarryShirtButtonsColouredObject, HarryShirtCollar03ColouredObject, HarryShirtCollar01ColouredObject, HarryShirtCollar02ColouredObject, HarryHairColouredObject, AmySkinColouredObject, AmyShirtColouredObject, AmyTieColouredObject, AmyHairColouredObject, AmyHairBandColouredObject, ebug.general.Talkie | xmlParser -> ebug.junior.CutSceneXMLParser; talkie -> ebug.general.Talkie; plus 148 body parts bound to *ColouredObject classes |
| movies/e-Bug Junior Game.swf | ebug.junior.GameController, ebug.Player, ebug.junior.GameShow, ebug.junior.ShrinkingZone, ebug.general.Talkie, ebug.junior.GameShowRound, ebug.junior.Question, ebug.junior.GameShowQuestionLoader, ebug.junior.Answer, ebug.Constants, mx.core.UIObject, mx.skins.SkinElement, mx.styles.CSSTextStyles, mx.styles.CSSStyleDeclaration, mx.styles.StyleManager, ebug.Game, ebug.Point, ebug.junior.PlatformGame, ebug.MapBuilder, ebug.Level, ebug.junior.Goal, ebug.junior.Event, ebug.junior.GameEntity, ebug.Entity, ebug.Vector3, ebug.junior.Microbe, ebug.junior.GoodMicrobe, ebug.junior.BadMicrobe, ebug.junior.PlayerEntity, ebug.junior.BulletEntity, ebug.Tile, ebug.ParticleSystem, ebug.Vector2, ebug.EntityBox, ebug.ClipLoader, ebug.general.EPhone, ebug.junior.LucyLactobacillus, ebug.junior.WhitePickup, ebug.junior.SoapPickup, ebug.junior.MilkGlassEntity, ebug.junior.PortalEntity, ebug.junior.AntibioticPickup, ebug.junior.SuperInfection, ebug.junior.CameraFlashEntity, ebug.junior.AntibioticBombEntity, ebug.util.AssetLibrary, mx.core.UIComponent, mx.controls.SimpleButton, mx.controls.Button, mx.events.EventDispatcher, mx.events.UIEventDispatcher, mx.skins.ColoredSkinElement, mx.core.ext.UIObjectExtensions, mx.skins.halo.Defaults, mx.managers.DepthManager, mx.managers.SystemManager, mx.managers.FocusManager, mx.skins.halo.FocusRect, mx.managers.OverlappedWindows, mx.styles.CSSSetStyle, mx.core.ext.UIComponentExtensions, mx.skins.Border, mx.skins.RectBorder, mx.skins.halo.RectBorder, mx.skins.halo.ButtonSkin | Defaults -> mx.skins.halo.Defaults; UIObjectExtensions -> mx.core.ext.UIObjectExtensions; UIObject -> mx.core.UIObject; FocusRect -> mx.skins.halo.FocusRect; FocusManager -> mx.managers.FocusManager; UIComponentExtensions -> mx.core.ext.UIComponentExtensions; UIComponent -> mx.core.UIComponent; SimpleButton -> mx.controls.SimpleButton; Border -> mx.skins.Border; RectBorder -> mx.skins.halo.RectBorder; ButtonSkin -> mx.skins.halo.ButtonSkin; Button -> mx.controls.Button |
| movies/eBugGameShow.swf | ebug.junior.ShrinkingZone, ebug.Player, EBugColouredItem, ColourSwap, AmySkinColouredObject, HarrySkinColouredObject, AmyHairColouredObject, AmyHairBandColouredObject, AmyShirtColouredObject, AmyTieColouredObject, HarryHairColouredObject, HarryShirtColouredObject, HarryShirtCollar02ColouredObject, HarryShirtCollar01ColouredObject, HarryShirtCollar03ColouredObject, HarryShirtButtonsColouredObject, ebug.junior.GameShow, ebug.general.Talkie, ebug.junior.GameShowRound, ebug.junior.Question, ebug.junior.GameShowQuestionLoader, ebug.junior.Answer, ebug.Constants | talkie -> ebug.general.Talkie; shrinking_zone -> ebug.junior.ShrinkingZone; GameShow -> ebug.junior.GameShow; plus 148 body parts bound to *ColouredObject classes |
| movies/harry.swf | none |  |
| movies/introductionToMicrobes_mainMenu.swf | mx.core.UIObject, mx.core.UIComponent, mx.controls.SimpleButton, mx.controls.Button, mx.skins.SkinElement, mx.styles.CSSTextStyles, mx.styles.StyleManager, mx.styles.CSSStyleDeclaration, mx.events.EventDispatcher, mx.events.UIEventDispatcher, mx.skins.ColoredSkinElement, mx.core.ext.UIObjectExtensions, mx.skins.halo.Defaults, mx.managers.DepthManager, mx.managers.SystemManager, mx.managers.FocusManager, mx.skins.halo.FocusRect, mx.managers.OverlappedWindows, mx.styles.CSSSetStyle, mx.core.ext.UIComponentExtensions, mx.skins.Border, mx.skins.RectBorder, mx.skins.halo.RectBorder, mx.skins.halo.ButtonSkin | Defaults -> mx.skins.halo.Defaults; UIObjectExtensions -> mx.core.ext.UIObjectExtensions; UIObject -> mx.core.UIObject; FocusRect -> mx.skins.halo.FocusRect; FocusManager -> mx.managers.FocusManager; UIComponentExtensions -> mx.core.ext.UIComponentExtensions; UIComponent -> mx.core.UIComponent; SimpleButton -> mx.controls.SimpleButton; Border -> mx.skins.Border; RectBorder -> mx.skins.halo.RectBorder; ButtonSkin -> mx.skins.halo.ButtonSkin; Button -> mx.controls.Button |
| movies/introductionToMicrobes_platformer.swf | ebug.junior.TileDefinitionParser, ebug.Constants, ebug.Player, ebug.general.EPhone, mx.core.UIObject, mx.skins.SkinElement, mx.styles.CSSTextStyles, mx.styles.CSSStyleDeclaration, mx.styles.StyleManager, ebug.Game, ebug.Point, ebug.junior.PlatformGame, ebug.general.Talkie, ebug.MapBuilder, ebug.Level, ebug.junior.Goal, ebug.junior.Event, ebug.junior.GameEntity, ebug.Entity, ebug.Vector3, ebug.junior.Microbe, ebug.junior.GoodMicrobe, ebug.junior.BadMicrobe, ebug.junior.PlayerEntity, ebug.junior.BulletEntity, ebug.Tile, ebug.ParticleSystem, ebug.Vector2, ebug.EntityBox, ebug.ClipLoader, ebug.junior.LucyLactobacillus, ebug.junior.WhitePickup, ebug.junior.SoapPickup, ebug.junior.MilkGlassEntity, ebug.junior.PortalEntity, ebug.junior.AntibioticPickup, ebug.junior.SuperInfection, ebug.junior.CameraFlashEntity, ebug.junior.AntibioticBombEntity | talkie -> ebug.general.Talkie; e_phone -> ebug.general.EPhone; PlatformGame -> ebug.junior.PlatformGame |
| movies/junior_game_assets.swf | EBugColouredItem, ColourSwap, AmyLegAColouredObject, AmyLegCColouredObject, AmyLegBColouredObject, AmyShoeAColouredObject, AmyShoeBColouredObject, AmySkirtColouredObject, AmyBeltColouredObject, AmyShirtColouredObject, AmySkinColouredObject, AmyTieColouredObject, AmyHairColouredObject, AmyHairBandColouredObject, HarrySkinColouredObject, HarryJeansBColouredObject, HarryJeansAColouredObject, HarryShoeBColouredObject, HarryShoeAColouredObject, HarryBeltColouredObject, HarryShirtColouredObject, HarryShirtButtonsColouredObject, HarryShirtCollar03ColouredObject, HarryShirtCollar01ColouredObject, HarryShirtCollar02ColouredObject, HarryHairColouredObject | plus 80 body parts bound to *ColouredObject classes |
| movies/kitchen_game_intro_level_0.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.junior.fridge.FoodItem |  |
| movies/kitchen_game_intro_level_1.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.Player, ebug.junior.fridge.FoodItem |  |
| movies/kitchen_game_intro_level_2.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.junior.fridge.FoodItem |  |
| movies/kitchen_game_intro_level_3.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.junior.fridge.FoodItem, ebug.Player, ebug.util.GeneralFunctions |  |
| movies/kitchen_game_main.swf | EBugColouredItem, ColourSwap, HarrySkinColouredObject, HarryHairColouredObject, AmySkinColouredObject, HarryShirtButtonsColouredObject, HarryShirtCollar02ColouredObject, HarryShirtCollar01ColouredObject, HarryShirtCollar03ColouredObject, HarryShirtColouredObject, AmyHairColouredObject, AmyHairBandColouredObject, AmyShirtColouredObject, AmyTieColouredObject, AmyBeltColouredObject, HarryBeltColouredObject | plus 122 body parts bound to *ColouredObject classes |
| movies/kitchen_game_outro.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.junior.fridge.FoodItem, ebug.Player, ebug.util.GeneralFunctions |  |
| movies/KitchenGame.swf | ebug.junior.fridge.KitchenGame, ebug.util.AssetLibrary, ebug.junior.fridge.FoodItem, ebug.Player, ebug.util.GeneralFunctions |  |
| movies/shrinking_amy.swf | EBugColouredItem, ColourSwap, AmyShoeAColouredObject, AmySkirtColouredObject, AmySkinColouredObject, AmyShirtColouredObject, AmyHairColouredObject, AmyHairBandColouredObject, AmyTieColouredObject, AmyBeltColouredObject, AmyShoeBColouredObject, AmyLegBColouredObject, AmyLegAColouredObject, AmyLegCColouredObject | plus 57 body parts bound to *ColouredObject classes |
| movies/shrinking_harry.swf | EBugColouredItem, ColourSwap, AmyLegAColouredObject, AmyLegBColouredObject, AmyLegCColouredObject, HarryShoeAColouredObject, HarryShoeBColouredObject, HarrySkinColouredObject, AmyHairBandColouredObject, AmyHairColouredObject, HarryShirtColouredObject, AmySkinColouredObject, HarryHairColouredObject, HarryShirtCollar02ColouredObject, HarryShirtCollar01ColouredObject, HarryShirtCollar03ColouredObject, HarryShirtButtonsColouredObject, HarryBeltColouredObject, HarryJeansBColouredObject, HarryJeansAColouredObject | plus 61 body parts bound to *ColouredObject classes |
| movies/splash.swf | none |  |
| movies/summary_page.swf | none |  |

### 5.11 The other 52 SWFs

| SWF | What it is (from its exports, instances and labels) |
|---|---|
| ad.swf | Exports: colin (546), ephone_ingame (1). Root instances: lower, upper, colin. |
| movies/ad.swf | Exports: lucy_icon (255), colin (546), ephone_ingame (1). Root labels: 43 lucy. Root instances: colin, lucy. |
| movies/ad2.swf | Exports: ephone_ingame (1), steve (261), lucy (255), iggy (360), colin (546). Root instances: amy, colin, iggy, lucy, steve, harry. |
| movies/animation_test_dummy.swf | No art exports. Root instances: avatar, button_upper1, button_lower1, button_both, button_lower_stop, button_upper_stop, clickme1, clickme2, clickme, clickme4, .... |
| movies/antibiotic_pickup.swf | Exports: antibiotic_pickup (1). |
| movies/assets/KitchenGame.swf | No art exports. |
| movies/avatar_amy_Fridge.swf | Exports: tissues (1), clingfilm (1), sink_area (50), bag (1), kitchen_fg (1), fridge_shelf_3 (1), fridge_shelf_2 (1), fridge_shelf_1 (1), fruitbowl (1), kitchen_bg (1). Root instances: restpointFridgeBoxRightBack, restpointCupboardTopLeft, restpointCupboardTopRight, restpointCupboardMidLeft, restpointCupboardMidRight, restpointCupboardBottomLeft, restpointFridgeTopRight, restpointFruitBowlRight, restpointFruitBowlMid, restpointFruitBowlLeft, .... |
| movies/avatar_harry_Fridge.swf | Exports: ephone_ingame (1), food_sample_orange (1), tissues (1), clingfilm (1), sink_area (50), bag (1), kitchen_fg (1), fridge_shelf_3 (1), fridge_shelf_2 (1), fridge_shelf_1 (1), fruitbowl (1), kitchen_bg (1). Root labels: 2 throw . Root instances: food_throw, restpointFridgeBoxRightBack, restpointCupboardTopLeft, restpointCupboardTopRight, restpointCupboardMidLeft, restpointCupboardMidRight, restpointCupboardBottomLeft, restpointFridgeTopRight, restpointFruitBowlRight, restpointFruitBowlMid, .... |
| movies/blue_box.swf | No art exports. |
| movies/cut_scene_director.swf | Exports: digit (99), score (1), gameshow_set (1), cut_scene_controller (1), talkie (60), shrinking_zone (1). Root labels: 1 init, 10 choose_avatar, 25 player_details, 40 shrinking_zone. Root instances: shrinking_zone, gameshow_set, harry, amy, gsh, podia, cut_scene_controller. |
| movies/dialogue_tutorial.swf | Exports: DialogueDevice (1). Root labels: 25 theEnd. |
| movies/EBug Level Editor.swf | Exports: superinfection (318), superinfection_icon (1), antibiotic_pickup (1), milk_glass_icon (1), milk_glass (80), portal_exit_icon (1), white_pickup (28), soap_pickup (28), acid_pit_end_obj (1), acid_pit_mid_obj (1), acid_pit_start_obj (1), bone_end_obj (1), bone_mid_obj (1), bone_start_obj (1), bubble_obj (1), cell_front_obj (1), +120 more. Plus 87 mx component symbols. |
| movies/ebug_food_sorting_game.swf | No art exports. Root labels: 1 init. |
| movies/Expression Test with Class Method.swf | Exports: Amy (121). Root instances: avatar. |
| movies/fridge_game.swf | Exports: soup (1), bird (1), ball (1), cat (1), cross (1), tick (1), cucumber (1), springonion (1), lettuce (1), cheese (1), sausages (1), chicken (1), FridgeGame (1), sadgirl (1), cupboard (1), table (1), +3 more. Plus 20 mx component symbols. Root labels: 1 init, 3 kitchen, 10 dialogue, 20 level_end, 21 next_level, 30 you_win, 40 you_lose. Root instances: rubbish, shelf4, shelf3, shelf2, shelf1, drawer3, drawer2, drawer1, door1, door2, .... |
| movies/Game_Show.swf | No art exports. Root instances: avatar, gameshowhost, clickme1, clickme4, clickme5, clickme6, clickme2, clickme3, clickme7, clickme8, .... |
| movies/gameOver.swf | No art exports. |
| movies/ghd_demo.swf | Exports: button_about (1), button_how_to_play (1), button_continue_game (1), talkie (60), shrinking_zone (1), shine (1), timer (130), question_board (1), digit (99), score (1), gameshow_set (1), GameShow (1), button_new_game (1). Root labels: 1 intro, 50 gameshow, 100 hoverboard, 290 hoverboard2, 336 return_to_gameshow, 357 teaser. Root instances: gameshow, bluesquare, tv. |
| movies/introductionToMicrobes_comicIntroduction.swf | Exports: DialogueDevice (1). Root labels: 1 init, 10 start. Root instances: girl_neutral, boy_neutral, host_happy, host_clipboard, studio_interior, host_chart. |
| movies/introductionToMicrobes_exitQuiz.swf | Exports: DialogueDevice (1). Root labels: 1 init, 10 start. Root instances: studio_exterior, girl_neutral, boy_neutral, host_happy, host_clipboard, studio_interior, host_chart. |
| movies/introductionToMicrobes_platformer_Scene 1.swf | Exports: blue_box (1), green_box (1), red_box (1), harry_Hair (1), harry (2), Symbol 1 (1), player_start (1), player_male (1), avatar_male (1), PlatformGame (1). Root labels: 1 init, 10 start, 20 main. Root instances: game. |
| movies/introductionToMicrobes_platformer9.swf | Exports: heart_half (1), shine (1), timer (130), bar_mask (1), wbc_bar (1), text_message (1), ephone_ingame (1), button_ok (1), button_hangup (1), button_answer (1), phone_screen (1), e-phone (1), camera_icon (1), antibiotic_icon (1), kill_icon (1), yog_icon (1), +145 more. Root labels: 1 init, 10 start, 20 main. Root instances: debugPanel, game, avatar, ephone, score, heart0, heart1, heart2. |
| movies/introductionToMicrobes.swf | No art exports. Plus 20 mx component symbols. Root labels: 1 init, 20 main. Root instances: gameScreen. |
| movies/level_intros.swf | Exports: slurm_icon (340), tick_box_placer (1), tick_box_tick (1), tick_box_cross (1), tick_box_empty (1), tick_box_button (40), iggy_icon (360), donna_icon (311), steve_image (1), portal_exit (10), exit_status (1), lucy_image (1), camera_icon (1), level_intros_phone_screen (270). |
| movies/map_builder.swf | Exports: blue_box (1), erasor (1), LevelEditor (1), circle (1), green_box (1), red_box (1), player_start (1). Plus 87 mx component symbols. |
| movies/Microbes_Motions/Colin_motion.swf | Exports: colin (546). |
| movies/Microbes_Motions/Donna_motion.swf | Exports: donna (311). |
| movies/Microbes_Motions/Steve_motion.swf | Exports: steve (261). |
| movies/new portal.swf | No art exports. |
| movies/platformTest.swf | No art exports. |
| movies/red_box.swf | No art exports. |
| movies/Sandy Art/Liquid Soap.swf | Exports: liquid_soap (28). |
| movies/Sandy Art/milk.swf | No art exports. Root instances: milk. |
| movies/Sandy Art/White Blood Cell Pick Up.swf | Exports: white_pickup (28). |
| movies/Sandy Art/White Blood Cell Projectile.swf | Exports: wbc_projectile (1), white_projectile (24). |
| movies/senior/BI2_mask.swf | No art exports. |
| movies/senior/BI2_Scene 1.swf | No art exports. Root labels: 1 Intro Choose, 10 Choosing Harry, 35 scene1 e-Bug Central. |
| movies/senior/BI2_Symbol 1.swf | No art exports. Root instances: text_mc, mask_mc. |
| movies/senior/BI2.swf | No art exports. Root labels: 1 Intro Choose, 10 Choosing Harry, 35 scene1 e-Bug Central. Root instances: scene1, dialogue_box. |
| movies/Shrinking Zone_Harry.swf | Exports: ephone_ingame (1). Root instances: avatar. |
| movies/talkie.swf | Exports: talkie (111). Root instances: talkie. |
| movies/test submit form.swf | No art exports. Root instances: name, btn. |
| movies/test.swf | No art exports. |
| movies/tests/CollissionTest.swf | Exports: harry_Hair (1), b6 (2), Symbol 1 (1), b4 (1), b3 (1), b5 (1), b2 (1), b1 (1). Root instances: board1, board2, t1, t2, t3, delx, dely. |
| movies/tests/CollissionTest2.swf | Exports: harry_Hair (1), b6 (1), Symbol 1 (1), b4 (1), b3 (1), b5 (1), b2 (1), b1 (1). Root instances: board1, board2, t1, t2, t3, delx, dely. |
| movies/tests/fruits.swf | Exports: banana (1), orange (1). |
| movies/tests/receiver.swf | No art exports. |
| movies/tests/RuntimeSharing.swf | Exports: banana (1), orange (1), grape (1). |
| movies/tests/test shared 2.swf | No art exports. |
| src/physics/ape/demos/ApeTest.swf | No art exports. |
| src/physics/ape/demos/CarDemo copy.swf | No art exports. |
| src/physics/ape/demos/CarDemo.swf | No art exports. |

## 6. Sounds

No sound data exists in the Flash original. Raw tag census over all 71 files (every tag, including those inside sprites): DefineSound (14) 0, StartSound (15) 0, DefineButtonSound (17) 0, SoundStreamHead (18) 0, SoundStreamBlock (19) 0, SoundStreamHead2 (45) 0, StartSound2 (89) 0. The same census found 170,535 PlaceObject2 tags, so the walk does reach sprite interiors. `grep -i` over `reference/Junior_Game` for `new Sound`, `attachSound`, `loadSound`, `.mp3`, `.wav` finds nothing, and in the Unity remake there are no audio files (`.mp3`, `.wav`, `.ogg`, `.aif*`, `.m4a`, tracker formats), no AudioSource or AudioClip in any scene, prefab, controller or asset; the only audio references are the default AudioListener on cameras (15 scenes, 5 prefabs) and iTween's generic audio helpers in `Assets/Plugins/iTween/Plugins/iTween.cs`. So there is no sound list, no durations and nothing under `sounds/`; `swfs[].sounds`, `soundStreams` and `startSounds` are empty arrays in the JSON. If sounds are added to the remake they are a new design decision, not a port.

## 7. Bitmaps extracted

543 bitmaps (234 distinct by source bytes; 200 of them, 169 distinct, in run-time SWFs): 300 DefineBitsJPEG3 (JPEG plus alpha, written as PNG), 138 DefineBitsLossless2 (PNG), 52 DefineBitsLossless (PNG), 51 DefineBits with shared JPEGTables (JPG), 2 DefineBitsJPEG2 (JPG). 167 groups of byte-identical bitmaps recur across SWFs (listed in `identicalBitmapsAcrossSwfs`). Each record in `swfs[].bitmaps` gives id, tag, size, SHA-1 of the source bytes and of the decoded pixels, the exported symbols that use it and the output file.

| SWF | Bitmaps | By tag | Used by (exported symbols) |
|---|---:|---|---|
| ad.swf | 6 | DefineBitsLossless2 4, DefineBitsLossless 1, DefineBitsJPEG3 1 | root timeline / internal clips only |
| movies/ad.swf | 6 | DefineBitsLossless2 4, DefineBitsLossless 1, DefineBitsJPEG3 1 | root timeline / internal clips only |
| movies/ad2.swf | 12 | DefineBitsLossless2 8, DefineBitsLossless 2, DefineBitsJPEG3 2 | root timeline / internal clips only |
| movies/amy.swf (run-time) | 6 | DefineBitsLossless2 4, DefineBitsLossless 1, DefineBitsJPEG3 1 | root timeline / internal clips only |
| movies/antibiotic_pickup.swf | 1 | DefineBits 1 | `antibiotic_pickup` |
| movies/cut_scene_director.swf | 1 | DefineBits 1 | `talkie` |
| movies/cutscene_introduction.swf (run-time) | 1 | DefineBits 1 | `talkie` |
| movies/EBug Level Editor.swf | 154 | DefineBits 18, DefineBitsJPEG3 101, DefineBitsLossless2 24, DefineBitsLossless 11 | `antibiotic_pickup`, `milk_glass_icon`, `milk_glass`, `white_pickup`, `soap_pickup`, `acid_pit_end_obj`, `acid_pit_mid_obj`, `acid_pit_start_obj`, `bone_end_obj`, `bone_mid_obj`, `bone_start_obj`, `bubble_obj`, `cell_front_obj`, `cell_side_obj` +84 more |
| movies/eBugGameShow.swf (run-time) | 1 | DefineBits 1 | `talkie` |
| movies/Game_Show.swf | 2 | DefineBitsJPEG2 1, DefineBitsJPEG3 1 | root timeline / internal clips only |
| movies/ghd_demo.swf | 4 | DefineBits 1, DefineBitsLossless 3 | `talkie` |
| movies/harry.swf (run-time) | 6 | DefineBitsLossless2 4, DefineBitsLossless 1, DefineBitsJPEG3 1 | root timeline / internal clips only |
| movies/introductionToMicrobes_comicIntroduction.swf | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/introductionToMicrobes_exitQuiz.swf | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/introductionToMicrobes_platformer.swf (run-time) | 66 | DefineBitsJPEG3 61, DefineBitsLossless2 2, DefineBits 3 | `wbc_projectile`, `white_projectile`, `white_pickup`, `soap_pickup`, `camera_flash`, `soap_missile`, `soap_projectile`, `soap_missile_splat`, `talkie`, `superinfection_image`, `level_intros`, `e_phone`, `antibiotic_pickup`, `milk_glass_icon` +1 more |
| movies/introductionToMicrobes_platformer9.swf | 87 | DefineBitsLossless2 44, DefineBitsJPEG3 30, DefineBitsLossless 13 | `camera_flash`, `soap_pickup`, `soap_missile`, `soap_projectile`, `soap_missile_splat`, `Toast_Jam4_Tile`, `kitchen_jamtoast_right`, `Toast_Jam3_Tile`, `kitchen_jamtoast_middle2`, `Toast_Jam2_Tile`, `kitchen_jamtoast_middle1`, `Toast_Jam1_Tile`, `kitchen_jamtoast_left`, `Toast_Mar4_Tile` +93 more |
| movies/junior_game_assets.swf (run-time) | 103 | DefineBitsLossless2 32, DefineBitsLossless 13, DefineBits 17, DefineBitsJPEG3 41 | `shrinking_amy`, `shrinking_harry`, `eraser`, `acid_pit_end_obj`, `acid_pit_mid_obj`, `acid_pit_start_obj`, `bone_end_obj`, `bone_mid_obj`, `bone_start_obj`, `bubble_obj`, `cell_front_obj`, `cell_side_obj`, `corner_l_tile`, `corner_r_tile` +81 more |
| movies/kitchen_game_intro_level_0.swf (run-time) | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/kitchen_game_intro_level_1.swf (run-time) | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/kitchen_game_intro_level_2.swf (run-time) | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/kitchen_game_intro_level_3.swf (run-time) | 1 | DefineBits 1 | root timeline / internal clips only |
| movies/map_builder.swf | 1 | DefineBits 1 | `erasor` |
| movies/Sandy Art/Liquid Soap.swf | 28 | DefineBitsJPEG3 28 | `liquid_soap` |
| movies/Sandy Art/milk.swf | 3 | DefineBitsJPEG3 3 | root timeline / internal clips only |
| movies/Sandy Art/White Blood Cell Pick Up.swf | 28 | DefineBitsJPEG3 28 | `white_pickup` |
| movies/Sandy Art/White Blood Cell Projectile.swf | 1 | DefineBitsJPEG3 1 | `wbc_projectile`, `white_projectile` |
| movies/senior/BI2.swf | 1 | DefineBitsJPEG2 1 | root timeline / internal clips only |
| movies/Shrinking Zone_Harry.swf | 5 | DefineBitsLossless2 4, DefineBitsLossless 1 | root timeline / internal clips only |
| movies/shrinking_amy.swf (run-time) | 5 | DefineBitsLossless2 4, DefineBitsLossless 1 | root timeline / internal clips only |
| movies/shrinking_harry.swf (run-time) | 5 | DefineBitsLossless2 4, DefineBitsLossless 1 | root timeline / internal clips only |
| movies/splash.swf (run-time) | 3 | DefineBitsLossless 3 | root timeline / internal clips only |
| movies/talkie.swf | 1 | DefineBits 1 | `talkie` |

The five bitmaps shared by `amy.swf`, `harry.swf`, `junior_game_assets.swf`, the shrinking SWFs and the adverts (two 847×18 red strips and three grey metal pieces, 74×53, 50×34 and 204×62) together fill one shape (`amy.swf` shape 122 in sprite 123) inside the `lower` clip: they are the hoverboard. `amy.swf` bitmap 204 (26×44 JPEG3) is the soap bottle inside `upper`. `Game_Show.swf`, which the game does not load, holds a raster copy of the studio: bitmap 308 (803×453 DefineBitsJPEG2, the set without podia) and bitmap 868 (803×453 DefineBitsJPEG3, the three podia on transparency).

## 8. Level XML linkage cross-reference

Each `alpha_levelN.xml` defines the same 113 tiles (ids 0-112) and places a subset in its grid (`<column><tile id/>`). "Resolved at run time from" follows the chain in section 4. Entity types are the `Constants.as` values (`reference/Junior_Game/src/ebug/Constants.as:29-58`; 0 player, 1 tile, 6 portal exit, 7 portal entrance, 9 ammo pickup, 11-19 microbes, 20 milk, 21 antibiotic pickup, 23 superinfection).

| Linkage name | XML type | Tile id(s) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | L11 | Total | Resolved at run time from |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `acid_pit_end_obj` | 1 tile | 41 |  |  |  |  |  |  |  |  |  | 1 |  | 1 | junior_game_assets.swf (import) |
| `acid_pit_mid_obj` | 1 tile | 40 |  |  |  |  |  |  |  |  |  | 1 |  | 1 | junior_game_assets.swf (import) |
| `acid_pit_start_obj` | 1 tile | 39 |  |  |  |  |  |  |  |  |  | 1 |  | 1 | junior_game_assets.swf (import) |
| `antibiotic_pickup` | 21 antibiotic pickup | 112 |  |  |  |  |  |  |  |  |  | 6 | 5 | 11 | introductionToMicrobes_platformer.swf |
| `bone_end_obj` | 1 tile | 44 |  |  |  |  |  |  |  |  |  |  | 1 | 1 | junior_game_assets.swf (import) |
| `bone_mid_obj` | 1 tile | 43 |  |  |  |  |  |  |  |  |  |  | 3 | 3 | junior_game_assets.swf (import) |
| `bone_start_obj` | 1 tile | 42 |  |  |  |  |  |  |  |  |  |  | 1 | 1 | junior_game_assets.swf (import) |
| `C_Chip_L_Tile` | 1 tile, 7 portal entrance | 0, 69, 108 | 1 |  |  | 1 |  |  |  | 1 | 2 |  |  | 5 | junior_game_assets.swf (import) |
| `C_Chip_Mid_Tile` | 1 tile | 1 | 2 |  |  | 1 |  |  |  | 1 | 2 |  |  | 6 | junior_game_assets.swf (import) |
| `C_Chip_R_Tile` | 1 tile | 2 | 1 |  |  | 1 |  |  |  | 1 | 2 |  |  | 5 | junior_game_assets.swf (import) |
| `cell_front_obj` | 1 tile | 46 |  |  |  |  |  |  | 7 |  |  | 1 | 8 | 16 | junior_game_assets.swf (import) |
| `cell_side_obj` | 1 tile | 47 |  |  |  |  |  |  | 9 |  |  | 9 | 15 | 33 | junior_game_assets.swf (import) |
| `Cheese_L_Tile` | 1 tile | 3 | 1 |  |  | 1 |  |  |  |  | 1 |  |  | 3 | junior_game_assets.swf (import) |
| `Cheese_Mid_Tile` | 1 tile | 4 | 2 |  |  | 1 |  |  |  |  | 1 |  |  | 4 | junior_game_assets.swf (import) |
| `Cheese_R_Tile` | 1 tile | 5 | 1 |  |  | 1 |  |  |  |  | 1 |  |  | 3 | junior_game_assets.swf (import) |
| `Chip_L_Tile` | 1 tile | 6 | 1 |  |  | 1 |  |  |  | 1 | 1 |  |  | 4 | junior_game_assets.swf (import) |
| `Chip_Mid_Tile` | 1 tile | 7 | 3 |  |  | 1 |  |  |  | 2 | 1 |  |  | 7 | junior_game_assets.swf (import) |
| `Chip_R_Tile` | 1 tile | 8 | 1 |  |  | 1 |  |  |  | 1 | 1 |  |  | 4 | junior_game_assets.swf (import) |
| `Chop_L_Tile` | 1 tile | 9 |  |  |  | 1 |  |  |  | 1 | 1 |  |  | 3 | junior_game_assets.swf (import) |
| `Chop_Mid1_Tile` | 1 tile | 10 |  |  |  | 3 |  |  |  | 1 |  |  |  | 4 | junior_game_assets.swf (import) |
| `Chop_Mid2_Tile` | 1 tile | 11 |  |  |  | 2 |  |  |  | 2 | 1 |  |  | 5 | junior_game_assets.swf (import) |
| `Chop_Mid3_Tile` | 1 tile | 12 |  |  |  | 1 |  |  |  | 2 |  |  |  | 3 | junior_game_assets.swf (import) |
| `Chop_R_Tile` | 1 tile | 13 |  |  |  | 1 |  |  |  | 1 | 1 |  |  | 3 | junior_game_assets.swf (import) |
| `corner_l_tile` | 1 tile | 48 |  |  |  |  |  |  | 1 |  |  | 3 | 2 | 6 | junior_game_assets.swf (import) |
| `corner_r_tile` | 1 tile | 55 |  |  |  |  |  |  | 4 |  |  | 3 | 2 | 9 | junior_game_assets.swf (import) |
| `donna_icon` | 19 Donna | 96 |  |  |  |  |  | 1 |  |  |  |  | 1 | 2 | introductionToMicrobes_platformer.swf |
| `flesh_gristle_1_tile` | 1 tile | 49 |  |  |  |  |  |  | 1 |  |  | 1 | 2 | 4 | junior_game_assets.swf (import) |
| `flesh_gristle_2_tile` | 1 tile | 50 |  |  |  |  |  |  | 1 |  |  |  |  | 1 | junior_game_assets.swf (import) |
| `flesh_gristle_3_tile` | 1 tile | 51 |  |  |  |  |  |  | 1 |  |  |  | 1 | 2 | junior_game_assets.swf (import) |
| `flesh_gristle_4_tile` | 1 tile | 52 |  |  |  |  |  |  | 2 |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `flesh_gristle_5_tile` | 1 tile | 53 |  |  |  |  |  |  | 1 |  |  |  | 2 | 3 | junior_game_assets.swf (import) |
| `flesh_gristle_6_tile` | 1 tile | 54 |  |  |  |  |  |  | 1 |  |  |  |  | 1 | junior_game_assets.swf (import) |
| `flesh_tile` | 1 tile | 56 |  |  |  |  |  |  | 36 |  |  | 33 | 20 | 89 | junior_game_assets.swf (import) |
| `floor_a_tile` | 1 tile | 57 |  |  |  |  |  |  | 11 |  |  | 6 | 9 | 26 | junior_game_assets.swf (import) |
| `floor_b_tile` | 1 tile | 58 |  |  |  |  |  |  | 10 |  |  | 6 | 9 | 25 | junior_game_assets.swf (import) |
| `hair_base_obj` | 1 tile | 72 |  | 5 | 4 |  | 2 | 2 |  |  |  |  |  | 13 | junior_game_assets.swf (import) |
| `hair_horiz_end_obj` | 1 tile | 78 |  | 4 | 4 |  | 1 |  |  |  |  |  |  | 9 | junior_game_assets.swf (import) |
| `hair_horiz_obj` | 1 tile | 77 |  |  | 5 |  | 5 |  |  |  |  |  |  | 10 | junior_game_assets.swf (import) |
| `hair_slope_end_obj` | 1 tile | 76 |  | 4 | 5 |  | 1 |  |  |  |  |  |  | 10 | junior_game_assets.swf (import) |
| `hair_slope_obj` | 1 tile | 75 |  |  | 1 |  |  | 1 |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `hair_slope_start_obj` | 1 tile | 74 |  | 5 | 4 |  | 3 | 2 |  |  |  |  |  | 14 | junior_game_assets.swf (import) |
| `hair_vert_obj` | 1 tile | 73 |  | 8 | 9 |  | 9 | 7 |  |  |  |  |  | 33 | junior_game_assets.swf (import) |
| `iggy_icon` | 18 Iggy | 97 |  |  |  |  |  |  | 3 |  |  | 1 | 2 | 6 | introductionToMicrobes_platformer.swf |
| `lint_ball_obj` | 1 tile | 79 |  | 2 |  |  | 1 |  |  |  |  |  |  | 3 | junior_game_assets.swf (import) |
| `loaf_end_L_obj` | 1 tile | 14 | 1 |  |  | 2 |  |  |  |  |  |  |  | 3 | junior_game_assets.swf (import) |
| `loaf_end_R_obj` | 1 tile | 19 | 1 |  |  | 2 |  |  |  |  |  |  |  | 3 | junior_game_assets.swf (import) |
| `loaf_mid_mould2_obj` | 1 tile | 17 |  |  |  | 2 |  |  |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `loaf_mid_mould3_obj` | 1 tile | 18 |  |  |  | 2 |  |  |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `loaf_mid_obj` | 1 tile | 15 | 2 |  |  | 2 |  |  |  |  |  |  |  | 4 | junior_game_assets.swf (import) |
| `lucy_icon` | 11 Lucy | 93 | 3 | 3 |  |  |  |  |  | 4 | 6 | 1 |  | 17 | introductionToMicrobes_platformer.swf |
| `milk_glass_icon` | 20 milk | 106 |  |  |  |  |  |  |  | 1 | 3 |  |  | 4 | introductionToMicrobes_platformer.swf |
| `patty_icon` | 13 Patty | 98 |  |  |  | 3 |  |  |  |  |  |  |  | 3 | introductionToMicrobes_platformer.swf |
| `pepper_obj` | 1 tile | 20 | 2 |  |  | 3 |  |  |  | 2 | 1 |  |  | 8 | junior_game_assets.swf (import) |
| `plaster_multi_end_obj` | 1 tile | 84 |  |  | 1 |  | 1 |  |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `plaster_multi_mid_obj` | 1 tile | 82 |  |  | 1 |  |  |  |  |  |  |  |  | 1 | junior_game_assets.swf (import) |
| `plaster_multi_start_obj` | 1 tile | 81 |  |  | 1 |  | 1 |  |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `plaster_singular_obj` | 1 tile | 80 |  | 4 | 1 |  | 6 | 1 |  |  |  |  |  | 12 | junior_game_assets.swf (import) |
| `platform_bridge_obj` | 1 tile | 61 |  |  |  |  |  |  | 4 |  |  | 1 | 3 | 8 | junior_game_assets.swf (import) |
| `platform_end_obj` | 1 tile | 62 |  |  |  |  |  |  | 7 |  |  | 2 | 2 | 11 | junior_game_assets.swf (import) |
| `platform_mid_obj` | 1 tile | 60 |  |  |  |  |  |  | 10 |  |  | 3 | 5 | 18 | junior_game_assets.swf (import) |
| `platform_start_obj` | 1 tile | 59 |  |  |  |  |  |  | 6 |  |  | 2 | 2 | 10 | junior_game_assets.swf (import) |
| `player_start` | 0 player | 111 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 11 | junior_game_assets.swf (import) |
| `portal_exit_icon` | 6 portal exit | 107 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 11 | introductionToMicrobes_platformer.swf |
| `roof_a_tile` | 1 tile | 63 |  |  |  |  |  |  | 35 |  |  | 19 |  | 54 | junior_game_assets.swf (import) |
| `roof_b_tile` | 1 tile | 64 |  |  |  |  |  |  | 32 |  |  | 18 |  | 50 | junior_game_assets.swf (import) |
| `salt_obj` | 1 tile | 21 | 2 |  |  | 1 |  |  |  | 2 | 1 |  |  | 6 | junior_game_assets.swf (import) |
| `Sausage_L_Tile` | 1 tile | 22 | 1 |  |  | 1 |  |  |  | 2 | 1 |  |  | 5 | junior_game_assets.swf (import) |
| `Sausage_Mid_Tile` | 1 tile | 23 | 2 |  |  | 3 |  |  |  | 2 | 1 |  |  | 8 | junior_game_assets.swf (import) |
| `Sausage_R_Tile` | 1 tile | 24 | 1 |  |  | 1 |  |  |  | 2 | 1 |  |  | 5 | junior_game_assets.swf (import) |
| `scab_obj` | 1 tile | 85 |  | 1 | 1 |  | 2 | 2 |  |  |  |  |  | 6 | junior_game_assets.swf (import) |
| `skin_base_tile` | 1 tile | 86 |  | 57 | 53 |  | 52 | 57 |  |  |  |  |  | 219 | junior_game_assets.swf (import) |
| `skin_surface_tile` | 1 tile | 87 |  | 34 | 30 |  | 33 | 49 |  |  |  |  |  | 146 | junior_game_assets.swf (import) |
| `slarg_icon` | 16 Slarg | 101 |  |  |  |  |  | 1 |  |  |  |  |  | 1 | introductionToMicrobes_platformer.swf |
| `slurm_icon` | 17 Slurm | 100 |  |  |  |  | 4 | 2 |  |  |  | 1 | 2 | 9 | introductionToMicrobes_platformer.swf |
| `soap_pickup` | 9 ammo pickup | 109 |  |  |  |  | 15 | 17 |  |  |  |  |  | 32 | introductionToMicrobes_platformer.swf |
| `splinter_obj` | 1 tile | 88 |  |  |  |  | 1 | 2 |  |  |  |  |  | 3 | junior_game_assets.swf (import) |
| `spot_large_obj` | 1 tile | 89 |  | 1 |  |  | 1 | 1 |  |  |  |  |  | 3 | junior_game_assets.swf (import) |
| `spot_ooze_obj` | 1 tile | 90 |  |  |  |  |  | 2 |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `spot_small_obj` | 1 tile | 91 |  | 2 |  |  | 1 | 1 |  |  |  |  |  | 4 | junior_game_assets.swf (import) |
| `steve_icon` | 14 Steve | 94 |  |  | 3 |  | 1 |  |  |  |  |  | 1 | 5 | introductionToMicrobes_platformer.swf |
| `Sugar_Tile` | 1 tile | 25 |  |  |  | 4 |  |  |  | 11 | 6 |  |  | 21 | junior_game_assets.swf (import) |
| `superinfection_icon` | 23 superinfection | 102 |  |  |  |  |  |  |  |  |  | 1 |  | 1 | introductionToMicrobes_platformer.swf |
| `toast_jam_obj` | 1 tile | 26 |  |  |  | 2 |  |  |  |  | 1 |  |  | 3 | junior_game_assets.swf (import) |
| `toast_marm_obj` | 1 tile | 27 |  |  |  |  |  |  |  |  | 1 |  |  | 1 | junior_game_assets.swf (import) |
| `Unit_1_Tile` | 1 tile | 28 | 2 |  |  | 2 |  |  |  | 1 | 2 |  |  | 7 | junior_game_assets.swf (import) |
| `Unit_2_Tile` | 1 tile | 30 | 21 |  |  | 17 |  |  |  | 22 | 28 |  |  | 88 | junior_game_assets.swf (import) |
| `Unit_3_Tile` | 1 tile | 32 | 2 |  |  | 2 |  |  |  | 1 | 2 |  |  | 7 | junior_game_assets.swf (import) |
| `Unit_4_Tile` | 1 tile | 29 | 2 |  |  | 3 |  |  |  | 1 | 1 |  |  | 7 | junior_game_assets.swf (import) |
| `Unit_5_Tile` | 1 tile | 31 | 15 |  |  | 27 |  |  |  | 3 | 5 |  |  | 50 | junior_game_assets.swf (import) |
| `Unit_6_Tile` | 1 tile | 33 | 2 |  |  | 3 |  |  |  |  | 1 |  |  | 6 | junior_game_assets.swf (import) |
| `vertical_a_l_tile` | 1 tile | 68 |  |  |  |  |  |  | 1 |  |  | 7 | 2 | 10 | junior_game_assets.swf (import) |
| `vertical_a_r_tile` | 1 tile | 67 |  |  |  |  |  |  | 10 |  |  | 7 | 2 | 19 | junior_game_assets.swf (import) |
| `vertical_b_l_tile` | 1 tile | 66 |  |  |  |  |  |  | 1 |  |  | 6 | 1 | 8 | junior_game_assets.swf (import) |
| `vertical_b_r_tile` | 1 tile | 65 |  |  |  |  |  |  | 9 |  |  | 6 | 1 | 16 | junior_game_assets.swf (import) |
| `villi_floor_obj` | 1 tile | 70 |  |  |  |  |  |  | 2 |  |  |  | 1 | 3 | junior_game_assets.swf (import) |
| `villi_roof_obj` | 1 tile | 71 |  |  |  |  |  |  | 5 |  |  | 4 |  | 9 | junior_game_assets.swf (import) |
| `wart_obj` | 1 tile | 92 |  |  |  |  | 1 | 1 |  |  |  |  |  | 2 | junior_game_assets.swf (import) |
| `white_pickup` | 9 ammo pickup | 110 |  |  |  |  |  |  | 21 |  |  |  | 8 | 29 | introductionToMicrobes_platformer.swf |
| `Yog_L_Tile` | 1 tile | 34 | 4 |  |  |  |  |  |  | 2 | 2 |  |  | 8 | junior_game_assets.swf (import) |
| `Yog_Mid_Tile` | 1 tile | 35 | 9 |  |  |  |  |  |  | 4 | 6 |  |  | 19 | junior_game_assets.swf (import) |
| `Yog_R_Tile` | 1 tile | 36 | 4 |  |  |  |  |  |  | 2 | 2 |  |  | 8 | junior_game_assets.swf (import) |
| `yoghurt_lid_obj` | 1 tile | 37 | 1 |  |  |  |  |  |  |  | 1 |  |  | 2 | junior_game_assets.swf (import) |
| `yoghurt_obj` | 1 tile | 38 | 3 |  |  | 1 |  |  |  |  | 2 |  |  | 6 | junior_game_assets.swf (import) |

Defined in every alpha_level tile list but never placed in any grid (8): `bubble_obj`, `colin_icon` (**not exported by the platformer or junior_game_assets**), `loaf_mid_mould_obj`, `plaster_multi_bridge_obj`, `sandy_icon`, `super_colin_icon`, `super_slarg_icon` (**not exported by the platformer or junior_game_assets**; exported only by movies/EBug Level Editor.swf), `super_slurm_icon`.

Names in the other 20 XML files (test, editor and pre-release levels) that the shipped platformer cannot resolve:

| Name | XML files | Exported by |
|---|---|---|
| (empty `<movie>`) | tile_definitions.xml | nothing |
| `colin` | tile_definitions.xml | ad.swf, ad.swf, ad2.swf, EBug Level Editor.swf, Microbes_Motions/Colin_motion.swf |
| `colin_icon` | antibiotic.xml, apetest.xml, lacto.xml, level1.xml +9 more | nothing |
| `donna` | tile_definitions.xml | EBug Level Editor.swf, Microbes_Motions/Donna_motion.swf |
| `iggy` | tile_definitions.xml | ad2.swf, EBug Level Editor.swf |
| `kitchen_cabinettop_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cabinettop_left1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cabinettop_middle1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cabinettop_middle2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cabinettop_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cabinettop_right2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_cheese_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_chip_left` | apetest.xml, test.xml, testbig.xml | nothing |
| `kitchen_chip_middle` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_chip_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_choppingboard_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_choppingboard_left1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_choppingboard_middle` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_choppingboard_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_choppingboard_right1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_jamtoast_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_jamtoast_middle1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_jamtoast_middle2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_jamtoast_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_peanuttoast_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_peanuttoast_middle1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_peanuttoast_middle2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_peanuttoast_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_r1c1` | apetest.xml, test.xml, testbig.xml | nothing |
| `kitchen_pepper_r1c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_r2c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_r2c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_r3c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_r3c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_topleft` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_pepper_topright` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r1c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r1c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r2c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r2c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r3c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_salt_r3c2` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_sausage_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_sausage_middle` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_sausage_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_straightchip_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_straightchip_middle` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_straightchip_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_sugar` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_yogurcartonfull` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_yogurtdollop_left` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_yogurtdollop_middle` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_yogurtdollop_pepper_r1c1` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `kitchen_yogurtdollop_right` | apetest.xml, test.xml, testbig.xml | introductionToMicrobes_platformer9.swf |
| `lucy` | tile_definitions.xml | ad2.swf, EBug Level Editor.swf |
| `milk_glass` | tile_definitions.xml | EBug Level Editor.swf |
| `patty` | tile_definitions.xml | EBug Level Editor.swf |
| `portal_exit` | apetest.xml, level3.xml, level4.xml, level5.xml +4 more | EBug Level Editor.swf, introductionToMicrobes_platformer9.swf, level_intros.swf |
| `sandy` | tile_definitions.xml | EBug Level Editor.swf |
| `slarg` | tile_definitions.xml | EBug Level Editor.swf |
| `slurm` | tile_definitions.xml | EBug Level Editor.swf |
| `steve` | tile_definitions.xml | ad2.swf, EBug Level Editor.swf, Microbes_Motions/Steve_motion.swf |
| `super_colin` | tile_definitions.xml | EBug Level Editor.swf |
| `super_slarg` | tile_definitions.xml | EBug Level Editor.swf |
| `super_slarg_icon` | antibiotic.xml, apetest.xml, lacto.xml, level1.xml +9 more | EBug Level Editor.swf |
| `super_slurm` | tile_definitions.xml | EBug Level Editor.swf |
| `superinfection` | tile_definitions.xml | EBug Level Editor.swf |
| `yoghurt_ld_obj` | lacto.xml | nothing |

Linkage names used from code: every literal `attachMovie` name in `src/ebug` and every `FoodItem` asset name (with its `clingfilm_` twin) resolves in the SWF that the code runs in (`crossReference.codeRefs` in the JSON): `status`, `lucy_image`, `camera_icon`, `steve_image`, `sandy_image`, `slarg_image`, `slurm_image`, `milk_image`, `superinfection_image`, `kill_icon`, `exit_status`, `soap_projectile`, `white_projectile`, `camera_flash`, `antibiotic_pickup` (platformer); `question_board`, `gameshow_set`, `shrinking_zone`, `talkie` (eBugGameShow); `amy`, `harry` and the 25 foods plus 25 `clingfilm_*` (kitchen_game_main). The old `FridgeGame.as` names (`cheese`, `chicken`, `cucumber`, `lettuce`, `sausages`, `springonion`, `cat`, `ball`, `bird`, `soup`, `tick`, `cross`) belong to the unused `fridge_game.swf`.

## 9. Flash to Unity mapping

| Flash symbol(s) | Unity `Assets/Textures/...` | Evidence | Notes |
|---|---|---|---|
| 32 body tiles `acid_pit_*`, `bone_*`, `bubble_obj`, `cell_*`, `corner_*`, `flesh_tile`, `flesh_gristle_1..6_tile`, `floor_*`, `platform_*`, `roof_*`, `vertical_*`, `villi_*` | `Tiles/Body/<name>.png` (32) | same name minus `_tile`/`_obj`; same size; pixels match (table 5.1) | Unity copies are lossless; prefer them |
| 21 skin tiles `lint_ball_obj`, `plaster_*`, `scab_obj`, `splinter_obj`, `spot_*`, `wart_obj`, `hair_*`, `skin_base_tile`, `skin_surface_tile` | `Tiles/Skin` (24) | as above | Unity also has `hair_end`, `hair_slope_mid`, `hair_vertical` with no Flash tile |
| 39 kitchen tiles `C_Chip_*`, `Cheese_*`, `Chip_*`, `Chop_*`, `Sausage_*`, `Sugar_Tile`, `Unit_1..6_Tile`, `Yog_*`, `loaf_*`, `pepper_obj`, `salt_obj`, `toast_*`, `yoghurt*` | `Tiles/Kitchen` (39) | as above; `loaf_end_L_obj` = `loaf_end_left.png`, `loaf_end_R_obj` = `loaf_end_right.png` | lossless tiles match to within 0.06 |
| `lucy_icon` (255 f) | `Microbes/00lucy` (178) | same character and labels | different cut: Unity has 77 fewer frames |
| `patty_icon` (194 f) | `Microbes/01patty` (194) | frame count equal | |
| `donna_icon` (311 f) | `Microbes/02donna` (310) | frame count within 1 | |
| `slarg_icon` (263 f); editor `slarg` (242 f) | `Microbes/03slarg` (242) | equals the editor/"motions" version | platformer copy has 21 more frames |
| `slurm_icon`, `super_slurm_icon` (340 f each) | `Microbes/04slurm`, `10super_slurm` (332 each) | same labels | Unity 8 frames shorter |
| `super_colin_icon` (546 f); `colin` in `Microbes_Motions/Colin_motion.swf`, `ad.swf`, `ad2.swf`, editor (546 f) | `Microbes/05colin` (546) | frame count equal | `06super_colin` (202 frames) has no Flash clip of that length |
| `sandy_icon` (185), `steve_icon` (261), `iggy_icon` (360) | `Microbes/07sandy` (185), `08steve` (261), `09iggy` (360) | frame counts equal | |
| `superinfection_icon` (318 f) | `Microbes/11super_infection` (frames 11-285, 226 files) | same labels, frame numbers are Flash's | frames 1-10 (`stop`) and 286-318 not exported |
| `amy.swf` `upper` (330 f), `lower` (224 f) | `Players/Amy/up` (330), `Players/Amy/low` (207) | label starts equal (5.3) | |
| `harry.swf` `upper` (330 f), `lower` (207 f) | `Players/Harry/up` (154 of 330), `Players/Harry/low` (101 of 207) | file numbers are Flash frame numbers | sparse exports |
| `shrinking_amy.swf` / `shrinking_harry.swf` `avatar` (150 f each) | `Players/Amy/shrink`, `Players/Harry/shrink` (150 each) | frame count equal | |
| game show Amy (sprite 732 in 733) and Harry (479 in 480), 1124 f | `GameShow/Amy`, `GameShow/Harry` (796 each) | same emotions; built from 125-frame nested clips | Unity re-timed: 1 stop frame, 40 idle frames, then about 125 frames per emotion; note Flash label typo `condifent` |
| host `gsh` (sprite 894, 471 f) | `GameShow/Host` (28 of 360) | same three emotions | sparse pose flips in Unity |
| `splash.swf` sprite 58 (170 f) | `GameShow/TVSet` (`TVIntro0002..0170`, 25 files) | frame numbering matches 1-170 | also in `ghd_demo.swf` (sprite 958) |
| `gameshow_set` (800×450); `Game_Show.swf` bitmaps 308 and 868 (803×453) | `GameShow/Scenario/Background.png`, `Foreground.png` (964×544) | Background vs bitmap 308: mean difference 1.3 after scaling; Foreground vs bitmap 868: 0.34 | same images at 1.2×; the set is split into studio and podia layers |
| `shrinking_zone` (800.45×452.65) | `GameShow/Scenario/ShrinkingZone.png` (848×480) | 1.06× | probable |
| `talkie` (761.75×143.45) | `GameShow/Scenario/talkie.png` (914×172) | 1.2× | probable |
| `score` (73×32.1) | `GameShow/Score.png` (95×42) | 1.3× | probable |
| `e_phone` grow/large states (own-coordinate all-frames bounds 794.95×410.77) | `GUI/InGamePhone` (43 frames, 752×412) | size and role | probable |
| `*_image` ePhone portraits, `exit_status`, `milk_image` | `GUI/InGamePhone/12Microbes` (15 PNGs, 100 px tall) | same role | framing differs; probably re-rendered from the microbe clips |
| `heart` (24.2×23.3) | `GUI/Heart.png` (32×30) | 1.3× | probable |
| `antibiotic_pickup` bitmap 1141 (50×21) | `Pickups/antibiotic_pickup.png` (51×22) | scaled pixel difference 4.5 | same art; `Pickups/Antibiotic 1.png` and `GUI/Antibiotic.png` (119×53) are larger renders |
| `soap_pickup` / `liquid_soap` (28 JPEG3 frames) | `Pickups/Liquid soap` (28, 36×44) | frame count, height 44 | Flash frames are trimmed and offset, Unity frames padded to 36×44 |
| `white_pickup` (28 JPEG3 frames, 37-47×42) | `Pickups/White blood cell` (28, 63×56) | frame count | Unity re-rendered at about 1.33× |
| `soap_missile` bitmap 1045 | `Projectiles/Soap Missile.png` | mean difference 0.09 | identical |
| `soap_missile_splat` bitmap 1048 | `Projectiles/Soap Splat.png` | mean difference 5.0 | identical (JPEG noise) |
| `camera_flash` bitmap 1042 | `Players/Flash Idea 1.png` | mean difference 0.22 | identical |
| `milk_glass_icon` bitmaps 1144/1146/1148 (150×200) | `Tiles/Kitchen/Milk/milk0001/0025/0060.png` (156×208) | scaled difference 1.2-1.4 | same three glass states |
| `portal_exit` (10 f, `level_intros.swf`, platformer9, editor) | `Tiles/Portal2` (10 frames, 148×220) | frame count | the shipped platformer uses the static `portal_exit_icon` |
| `upper` tractor-beam frames 195-237 | `Players/Final Tractor Beam.png` (157×197) | subject | probable |

No evident Flash counterpart: `Background/*/..._bg.png` (30×19 colour swatches), `Background/Kitchen/ground.png`, `GameShow/Scenario/DonnaQuiz1..3.png`, `GameShow/TextBox.png`, `GameShow/Temp Button.png`, `GUI/TextIntroLevels` (33 frames, 444×272), `Projectiles/drop.png` (33×20) and `Projectiles/whitebcell.png` (40×38; the Flash `wbc_projectile` bitmap is 18×20).

## 10. Art that exists only as vectors

Everything in this list is vector art in the SWFs. "Unity PNG" says whether the remake already has rendered frames; where it does not, the art has to be rendered from the SWF (for example with Ruffle, which `tools/ruffle/` already drives) or redrawn.

| Art | SWF symbols | Unity PNG? |
|---|---|---|
| 11 microbes, all states | `*_icon` in the platformer (185-546 frames each) | yes for all 11 (Lucy is a shorter cut; superinfection frames 1-10 and 286-318 missing) |
| Player avatar, two halves | `amy.swf`, `harry.swf` `upper`/`lower` | yes (Harry sparse) |
| Shrinking avatars | `shrinking_amy.swf`, `shrinking_harry.swf` | yes |
| Game show Amy, Harry, host | inside `gameshow_set` | yes (host sparse, 28 poses) |
| Studio, shrinking zone, talkie | `gameshow_set`, `shrinking_zone`, `talkie` | single stills only (the studio also as `Game_Show.swf` bitmaps) |
| Question board with agree/don't know/disagree buttons and timer | `question_board`, `timer` (130 frames, 13 stops) | **no** |
| ePhone and HUD | `e_phone` (129 f), `e-phone`, `phone_screen`, `status`, `tick_box_*`, `camera_icon`, `kill_icon`, `antibiotic_icon`, `yog_icon`, `heart`, `heart_half`, `score`, `digit`, `button_ok/hangup/answer`, `text_message`, `wbc_bar`, `soap_bar`, `bar_mask`, `shine` | partly: phone animation, heart, score background; **no** digits, tick boxes, mode icons, bars |
| ePhone status portraits | `lucy_image`, `steve_image`, `sandy_image`, `slarg_image`, `slurm_image`, `exit_status`, `background` (`milk_image`, `superinfection_image` add bitmaps) | re-framed equivalents only |
| Level intro phone screens | `level_intros` (421 f, 10 level pages) | **no** (Unity uses its own text cards) |
| Exit portal used in the shipped levels | `portal_exit_icon` | **no** (Unity's Portal2 is the other, animated portal) |
| Player start marker, editor boxes | `player_start`, `blue_box`, `red_box`, `green_box` | not needed at run time |
| Kitchen scene | `kitchen_bg`, `kitchen_fg`, `fridge_shelf_1..3`, `fruitbowl`, `sink_area` (50 f), `bag`, `tissues`, `clingfilm` | **no** |
| Kitchen avatars | `amy`, `harry` in `kitchen_game_main.swf` (600-frame clips, 15 states) | **no** |
| 25 foods and 25 cling-film overlays | table 5.7 | **no** |
| Kitchen outro and summary screens | `kitchen_game_outro.swf`, `summary_page.swf` | **no** |
| Cut-scene avatar chooser and details form | `cutscene_introduction.swf` | **no** |
| Main menu | `introductionToMicrobes_mainMenu.swf` (two mx Buttons) | **no** |
| TV splash | `splash.swf` (vector TV with 3 static bitmaps) | 25 of 170 frames |

## 11. Gotchas for the port

- **Names.** Leading-space exports: `" Harry_Hand_R_Skin_12"`, `" Harry_Hand_R_Skin_11"`, `" Harry_Hand_L_Skin_11"` (in every SWF that has them); concatenated name `Amy_Eyes_Game_Default_Skin_02Harry_Eyes_Game_Cautious_Skin_02` (`eBugGameShow.swf` id 280); an export named `" "` (`EBug Level Editor.swf` id 590); `Yog_L_Lv3-Tile` uses a hyphen (platformer9); `erasor` (map_builder) versus `eraser` (junior_game_assets). Two exports per symbol are possible (`UIObject`, `Button` and other mx symbols appear twice).
- **Label spelling.** `be_lifed` (for `be_lifted`) in `super_colin_icon` and every `colin`; `condifent` in the game-show avatars; `Level3` (capital L) in `level_intros_phone_screen`; `sneeze_Start` in the kitchen avatars (the code uses the same spelling, `KitchenGame.as`).
- **Labels the code or scripts ask for that do not exist:** `fall` (microbes), `steve_idle` (`sandy_icon` and `steve_icon` frame 1).
- **Several labels on one frame** are normal here (`idle`/`slide`/`be_lifted`; `bounce_start`/`jump_start`); a label lookup must accept any of them.
- **Microbe and player state ends are in frame scripts**, not in the AS2 classes: see 5.2 and 5.3 and `swf-scripts/`. The superinfection keeps its own `lives` counter (`var lives = 6` on frame 1; `be_killed` returns to `idle_4` while `lives > 0`, else hides itself).
- **Registration points.** Tiles, pickups and HUD symbols are top-left registered; `camera_flash` is centred (75×75 at (-31, -35)); `kitchen_bg` is centred; `e_phone` is placed so that its small state sits at (697.4, 263.4) inside its own space, which is why its bounds do not start at 0.
- **Scale.** The player art is authored at about 11× and placed at 0.089; the shrinking avatars at 0.7174. Render vectors at the on-screen scale times the device pixel ratio, not at authoring scale.
- **`introductionToMicrobes_platformer9.swf`** is an 800×750 debug build (it has a `debugPanel`) with kitchen tile names (`kitchen_*`) that only `apetest.xml`, `test.xml` and `testbig.xml` use; do not treat it as the shipped platformer.
