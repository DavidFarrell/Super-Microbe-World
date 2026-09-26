# Platform levels 2-10: decisions, fixes and verification

Scope: levels 2 to 10 of the hoverboard platform game (`web/js/platformer/`), on top of the level 1
engine documented in `web/NOTES-platformer-decisions.md` ("PD" below). Sources are cited as in
`web/NOTES.md` 1.2 (`PlatformGame.as` is `reference/Junior_Game/src/ebug/junior/PlatformGame.as`).
The resolved decisions of `web/NOTES.md` 11.9 are applied as written and are not reopened here.
Merged into `web/NOTES.md` (sections 4, 10.1 and 10.4, cited there as [LV §n]), which is the entry
point.

## 1. Resolved decisions as built (NOTES.md 11.9)

| # | Decision | What the port does | Original | Where |
|---|---|---|---|---|
| 5 | Restart the same level after failing | Standalone, the game-over card's "Try again" restarts the failed level with the score kept; in the journey the scene hands `onGameOver({ level, score, reason })` to the flow, which shows the summary and relaunches the same level. | `PlatformGame.as:187-192`, `GameController.as:249-255,283-308` (restart the round) | `platformScene.js` `onGameOver()` |
| 6 | Keep the Lucy / milk entity-order behaviour | Unchanged: a walking Lucy that comes before the glass in entity order dives in without making yogurt; a pushed (sliding) Lucy always counts. Unit test `decision #6` pins both orders. | `MilkGlassEntity.as:64-93`, `LucyLactobacillus.as:145-175` | `actors.js` `MilkGlassEntity`, `entities.js` `LucyLactobacillus` |
| 7 | Bombs explode off screen, with a hint | A thrown antibiotic keeps advancing when it leaves the view (`advancesOffScreen`), so its 67-step fuse always runs out and every detonation counts; its body still freezes off screen, so a bomb that leaves the view in mid-air starts its fuse where it hangs. Off-screen bombs get an edge badge (the capsule, an arrow, a ring that empties with the fuse); on screen the capsule blinks red faster as the fuse runs down. The explosion still kills only the bacteria that are on screen, wherever the bomb is (the blast's victims were always "every bacterium on screen", `PlatformGame.as:829-843`), so the whiteout over the screen still marks where the antibiotic acted. | The update loop only advanced on-screen entities (`PlatformGame.as:621`), so an off-screen bomb never reached `EXPLODE` (`AntibioticBombEntity.as:36-57`) and level 10 (6 detonations, 6 pickups, no respawn) could become unwinnable | `actors.js` `AntibioticBombEntity`, `game.js` `update()` step 7, `render.js` `drawBombHints()` / `bombBlink()` |
| 8 | Keep the coasting creep | Unchanged (PD "Kept faithful"). | `Vector3.as:24-41,61`, `PlatformGame.as:1017` | `physics.js`, `game.js` |
| 9 | Patty (L4) and Iggy (L7) phone pictures | The ePhone status screen shows a picture composed from the microbe's own `idle` frame in the style of the shipped pictures (black, soft white glow, 151 x 168.5 status units): one Patty for "photograph 3 Patty", a cluster of five Iggys for a KILL_ALL level whose bad microbes are all Iggy (level 7). Levels 5 and 6 keep `slurm_image`, as in the original. Composed once per session at 2x and cached. | CREATE_GUI had no Patty branch (level 4's phone stayed black) and drew Slurm for every KILL_ALL goal (`PlatformGame.as:331-362`) | `hud.js` `PORTRAITS`, `goalPortrait()`, `portraitCanvas()` |
| 10 | Award the +3 bullet bonus | A soap bubble or white blood cell that hits an on-screen bad microbe pays +3 once per projectile (one contact reaches the microbe twice: the physics pair event and the bullet's re-notify), then +5 when it is washed away. The superinfection shrugs bullets off and pays nothing. Unit tests pin +3 then +5, and nothing on the superinfection. | The dispatcher tested type 5 (`GAME_ENTITY_BAD_MICROBE`), which no entity is given, so it never paid (`PlatformGame.as:658-665`; `doc:1234` documents it) | `game.js` `dispatch()` COLLIDE |

The ePhone picture is exposed to tests as `probe('platform').hud.picture` / `.mode`
(`portrait:patty`, `portrait:iggy`, or the atlas symbol).

## 1a. Bug fixed (intent clear)

| Fix | Original | Where |
|---|---|---|
| An antibiotic no longer kills a bacterium that is already dying. A killed microbe stays in the entity list, on screen, in `BE_KILLED` while its `be_killed` animation plays (Lucy about 1.1 s), and the original's victim search had no state test, so every further blast in that time killed it again (restarting the animation) and charged -10 (Lucy, Sandy, Steve) or paid +15 (Slurm, Slarg, Colin) once more. With decision 7 bombs thrown in quick succession go off within a second of each other: the bot's level 10 route lost 50 points to one dead Lucy before the fix. Unit test: "an antibiotic does not kill a bacterium that is already dying". | `PlatformGame.as:829-857`, `GameEntity.as:504-511` | `game.js` `explodeAntibiotic()` |

## 2. Presentation for levels 2-10

- **Art.** Every level draws from its `levelN` atlas set (`web/data/atlas/index.json`): skin, body and
  second kitchen tiles, the rigged microbes (Steve, Patty, Slurm, Slarg, Donna, Iggy, the
  superinfection; `sprites.js` draws rig poses), the milk glass, soap and white blood cell pickups
  and projectiles, antibiotic pickups (also the thrown bomb and the held-antibiotic HUD icon, whose
  white box is in the original art), the goal pictures and mode icons of `hud2`, and the intro
  pages `level_intros_levelN` (`intro.js` falls back to `level_intros` for level 1). Checked
  side by side with the Ruffle captures of the openings (`reference/captures/042`, `050`, `079`,
  `091`, `107`, `111`, `183`, `184`) and intro pages (`045`, `084`, `087`): tiles, microbes,
  pickups, HUD and pages match; the view is placed a little differently at the start because of
  the port's clamped, eased camera (PD "Camera").
- **Music.** The level's setting is the majority tile range (kitchen 0-38, body 39-69, skin 70-92,
  `tile_definitions.xml`): levels 1, 4, 8, 9 kitchen; 2, 3, 5, 6 skin; 7, 10 body
  (`AREA_MUSIC` in `web/js/core/music.js`).
- **Briefing text** for every level lives in `web/data/lang/en/levels.json` (`intro.levelN.i`, the
  original wording with the spelling fixes of NOTES.md 7.4 and device-aware key placeholders).
  The identical copies that `web/data/lang/en.json` used to hold were removed when the areas were
  joined (`web/requests/levels.md` #1). Known text/goal mismatches
  (L6 "wash away all the bad microbes" for 3 of 4; L10 "until you kill the super infection" for 6
  detonations) are kept as written.
- **Level-complete card** (standalone play only): the goal counter is labelled for the goal type
  ("Photos", "Bad microbes", "Yogurts", "Antibiotics"; it said "Photos" everywhere).

## 3. Juice added for the later mechanics (cosmetic only)

All of these read the game's `fx` notifications, which the simulation never reads, so runs and
traces are unaffected except through hit-stop (whole logic steps, PD "Feel improvements").

- **Antibiotic explosion**: a thump-and-sparkle sound (`antibioticBoom`), capsule shards and stars
  where it went off (when in view), a white flash and stars on every bacterium it kills, shake
  and haptics, on top of the original whiteout.
- **Superinfection hit**: a low growl (`superHit`), a white hit flash, purple bubbles, a "-1"
  popup kept inside the view, 3 steps of hit-stop and shake. When its last life goes: a bigger
  burst, a fanfare (`superDefeated`) and the banner "Superinfection defeated!".
- **Milk**: a splash sound and milk droplets when Lucy lands in the glass (`milkHit`); the yogurt
  turn adds rising bubbles, a "Yogurt!" popup, a flash of the glass, light shake and haptics.
- **Bombs**: the fuse blink and the off-screen badge of decision 7. With reduced motion the fuse
  is a steady red tint that deepens as it runs down, and the badge neither pulses nor bobs. A
  badge appears only once the capsule's art is wholly off screen; several on one side are spread
  50 px apart in world-height order (the one that goes off first drawn on top), so each badge and
  its fuse ring can be read (level 10 often has three pending bombs at the same height).
- **HUD banner** ("The portal is open!", "Superinfection defeated!") moves down to mid-screen while
  the player rides along the top of the screen (levels 8 and 10 end high up), so it never covers
  the player.
- **Touch camera button**: while an antibiotic is carried the camera button throws it
  (`PlayerEntity.as:193-197`), so the button wears a small capsule badge and its accessible name
  becomes "Throw the antibiotic" (added to the button node from the scene; `web/js/ui/touch.js`
  is untouched).
- **Touch layout**: edge hints (the portal arrow and the bomb badge) are placed clear of the HUD:
  in touch play the left hint sits to the right of the ePhone, which moves to the top left, and
  both stay in the middle band above the thumb buttons.

## 4. Bots, traces and tests

- **Planner bot** (`web/tests/bots/planner.mjs`, re-exported by `platform-bot.mjs`): keeps a shadow
  copy of the pure simulation fed with exactly the inputs it sends, and chooses each step's held
  actions by rolling out a menu of short input plans on clones (`PlatformGame.clone()`), scored on
  a gravity-aware travel-cost field to the current mission's region (photograph, wash away, push
  Lucy into the milk, fetch and throw antibiotics, enter the portal), with a beam search when
  progress stalls. It never touches the game: it reads `__test.probe('platform')` and answers with
  actions that the recorder holds with `__test.hold()` for two engine ticks per logic step. It
  checks every step that the page and its shadow agree (`desync`).
- **Traces** (`web/tests/traces/<level>.json`, format `smw-trace/1`): the per-tick input log
  (`__test.recordInput()` / `takeInputLog()`), the page query (seed 1, Harry, `manual=1`,
  `intro=0`) and the final state. Recorded by `node web/tests/bots/record-traces.mjs [levels]`,
  which also runs the bot headless in node and refuses a recording that differs from it.

  | Level | Steps | Ticks | Score | Lives | What the route does (counted from the game's notifications in a headless run of the same bot) |
  |---|---|---|---|---|---|
  | 1 | 239 | 490 | 15 | 3 | 3 Lucy photos (+5 each), portal |
  | 2 | 138 | 288 | 15 | 3 | 3 Lucy photos |
  | 3 | 215 | 442 | 15 | 3 | 3 Steve photos |
  | 4 | 181 | 374 | 15 | 3 | 3 Patty photos (re-recorded with Patty's 187.89 x 141.53 box, section 5) |
  | 5 | 276 | 570 | 109 | 3 | 14 soap pickups (+7), 2 Slurms washed away (+3, +5 each), 1 Slurm and Steve kill each other (+5, -10) |
  | 6 | 249 | 516 | 87 | 3 | 9 soap pickups, 3 bad microbes washed away (+3, +5 each) |
  | 7 | 258 | 534 | 136 | 3 | 16 white blood cell pickups, 3 Iggys washed away (+3, +5 each) |
  | 8 | 80 | 160 | 60 | 3 | 1 Lucy pushed into the glass (+10, +50) |
  | 9 | 196 | 392 | 180 | 3 | 3 Lucys pushed into 3 glasses |
  | 10 | 182 | 406 | 178 | 3 | 6 antibiotics fetched and thrown one after another; 6 detonations, the superinfection in view for all six (+30 each, it loses its 6 lives), the only Lucy killed by the first (-10); 1 Slurm washed away on the way |

  Level 8 and level 10 are short: level 8's first Lucy is a few tiles from the glass, and in level
  10 every detonation counts wherever it happens (decision 7; the goal is 6 detonations, not the
  superinfection's death), so the bot throws each antibiotic as soon as it has one and the fuses
  overlap. Both are legitimate routes a child could take.
- **Maintenance rule**: the traces are exact per-tick replays. Any change to the simulation
  (`game.js`, `entities.js`, `actors.js`, `player.js`, `physics.js`, `timeline.js`, the level
  data, or anything that changes hit-stop in `platformScene.js`) must be followed by re-recording
  all ten traces; `levels.spec.mjs` fails on purpose when a replay no longer matches its recorded
  score, lives and step count. Cosmetic changes (render, HUD, sounds, particles) do not affect
  them.
- **`web/tests/levels.spec.mjs`**: (a) every trace replayed from a fresh load (`stepCount` and
  `tick` 0 checked first) completes with the recorded score, lives, goal and step count, then the
  level-complete card appears; (b) the level 10 trace replayed twice gives identical simulation
  states at every 40-tick checkpoint (cosmetic probe fields excluded); (c) level data: exactly one
  player start and one exit portal, no entrance portal, one goal whose targets are placed in
  sufficient numbers, no entity anchored on a tile anchor, no entity box inside a solid tile except
  the known cases below, the player lands on a tile (not the world floor), every placed tile and
  entity and the briefing pages have art in the level's atlas set; (d) every level's briefing plays
  with real Space presses, shows as many pages as `levels.json` has, fills every placeholder with
  keyboard keys ("Press X to throw soap", "Press C to use the antibiotic"), and the ePhone shows the
  expected picture and mode icon. (c) also checks that level 4's first Patty is still on her
  spawn cell after 80 steps (section 5).
- **`web/tests/levels-ui.spec.mjs`** (section 7): (e) the first briefing draws no tiles, a window
  blur stops its autoplay (no play and no clock after 2500 ticks), a key press brings it back, play
  starts as the phone starts shrinking and the level runs under it, the re-opened briefing keeps
  the tiles; (f) with `reducedMotion: 'reduce'` the briefing autoplays through to play; (g) the
  game-over card: Enter retries with nothing focused; on a touch viewport the prompt says "Tap",
  reads "Press Enter" after a key press and a tap on the backdrop retries; (h) the level 10 trace
  on a 667 x 375 touch viewport: the whiteout's first frame is white over the score, a heart and the
  timer, and off-screen badges on one side are at least 45 px apart (three at once at tick 86).
- **`web/tests/unit/levels.test.mjs`**: decision 7 (an off-screen bomb explodes and counts),
  decision 10 (+3 then +5; nothing on the superinfection), decision 6 (both entity orders).
- **`web/tests/level1.spec.mjs`**: the last test opened level 1 through the splash's New Game,
  which now starts the flow's journey (a first-run language chooser, the cutscene and the
  shrinking zone; `flow.spec.mjs` covers that path). It now reaches level 1 through Level select
  (`?lang=en`, keyboard and tap) and still checks that the briefing opens first.

## 5. Original data quirks found by the data checks (kept)

- **Patty's box is 187.89 x 141.53** (fixed after review; was 203.32 x 150.39). The two bounds
  surveys disagree (NOTES.md 4.4 row 13 and 12.6 left it to Ruffle): `swf-inventory.json`
  `boundsFrame1` gives 203.32 x 150.39, `reference/analysis/levels.json:1699-1706` (and
  `flash-levels.md:225`) 187.89 x 141.53. With the larger box level 4's first Patty (4,11) was
  pushed 53.3 px left by the loaf at (4,14) and 50.4 px up by the cheese at (6,8) on step 2 and
  hovered at (496.7, 149.6), her pot 60 px above the bread stick, for the whole level. Captures
  `050-level4-opening@2x.png` (clock 176) and `051-level4-moving.png` (clock 172) show her
  standing on the bread stick at her spawn cell. With 187.89 x 141.53 the loaf and cheese pushes
  cancel within one constraint pass and she stays at (550, 200) (headless: 300 steps, no drift),
  as captured; the 3.32 px overlaps of Patty (5,23) into the jam toast and Patty (5,51) into the
  pepper pot disappear too. Only the physics box (the palette's `w`/`h`, through
  `BOX_OVERRIDES` in `tools/convert-levels.mjs`) changes; the clip bounds that `hitTest`, the
  photo range and the on-screen test read (`web/js/platformer/data/clips.js`, Flash's live
  `_width`) are a separate question the captures do not answer and stay as they were. Only level 4
  places Patty; its trace is re-recorded (section 4). `web/NOTES.md` records it as settled (4.4,
  10.4 #83).
- **Wide microbe boxes reach into tiles** (frame-1 art bounds, NOTES.md 4.4): level 4 Patty at
  (4,11) into the loaf end at (4,14) (37.9 px; she is not pushed out because the cheese below
  pushes back, see above); level 5 Slurm at (5,39) into the small spot at (6,40); level 6 Slarg
  at (3,43) into the skin at (7,43)-(7,44). The Slurm and the Slarg spawn in FALL and, like any
  microbe walking into big tile art, are pushed out by the physics (NOTES.md 3.17). The spec
  lists them explicitly, so a data change that adds or removes one is flagged.
- **The exit portal** (103.6 x 163.8 on a 100 x 150 slot) sinks 13.8 px into the floor and 3.6 px
  into the next column in every level; it is not solid and the tiles are drawn over it, as in the
  SWF (PD "Depth order"). In level 8 it also touches the salt pot at (0,33) by 3.6 px.
- Level 11 stays out of the journey (decision 16) and out of these checks (its goal needs 6 kills
  with 5 bad microbes placed).

## 6. Known gaps

- The planner's routes are efficient rather than representative: in level 10 it throws each
  antibiotic as soon as it has one, from the first stretch of the level (the superinfection is
  already in view there, so all six blasts still hit it). A scratch variant that only throws near
  the superinfection also completes level 10 (453 steps); it was used to look at the hit effects
  up close and is not part of the suite.
- Only Harry's traces are recorded. Amy throws more slowly (PD "Amy and Harry are not identical"),
  so her runs differ in the throwing levels (5, 6, 7); `record-traces.mjs --avatar=amy --check`
  completes all ten levels with her too (checked, page and headless agree), without writing traces.
- `web/NOTES-platformer-decisions.md` "Follow-ups" (bots for levels 4-10, art for the other levels)
  are done by this work, and that file now says so.

## 7. Review fixes (briefing, cards, level 10 hints, Patty)

| Finding | What changed | Source | Where | Verified by |
|---|---|---|---|---|
| L4 Patty hovers in mid-air | Patty's physics box 187.89 x 141.53 (section 5) | captures 050, 051; `levels.json:1699-1706` | `tools/convert-levels.mjs` `BOX_OVERRIDES`, `web/data/levels/alpha_level4.json`, `tile_definitions.json`, L4 trace | headless run (Patty stays at (550, 200) for 300 steps), `levels.spec` (a) L4 and (c) |
| Briefing drawn over the tiles | While the first briefing is up the level is drawn without its tiles (background, entities, player and HUD only), as the original, which duplicated tile clips only in RENDER_WORLD. The re-opened briefing (port only) keeps them. | `PlatformGame.as:540-551` (INIT_DIALOGUE), `1090-1107` (RENDER_WORLD); captures 035, 044, 048, 049, 087, 105, 106, 109, 180 | `render.js` `draw(..., { tiles })`, `platformScene.js` `render()` | `levels-ui` (e): `tilesDrawn` 0 under the first briefing, > 0 once play starts and in the re-opened briefing |
| Play started 800 ms late | The first briefing starts play (and the clock) when the phone starts shrinking; the shrinking phone is drawn over the running level. A re-opened briefing still resumes when the phone has gone. Opening the briefing again, restarting or pausing during the shrink is handled (the old phone is dropped; paused, it waits). | `PlatformGame.as:545-549`; capture 182 | `intro.js` `onShrinkStart`, `platformScene.js` `showIntro()`, `update()` | `levels-ui` (e): `ui` 'play' while `intro.phase` is 'shrink', `stepCount` advances under it; `level1.spec` (P during the shrink) |
| Milk glass white on the L8/L9 pages | Rendered when the areas were joined: the level 8 and 9 pages come from a `level_intros_r3` render job that pins the page's `milk_image/glass` to its `yogurt` frame, as the clip's own frame-1 script does (`web/requests/levels.md` #3; `web/NOTES-art-decisions.md` section 5). | captures 105, 106, 109 | `tools/swf-sheet/jobs/levels.json`, `tools/atlas/levels.json`, `web/data/atlas/intro-r3.*` | by eye against capture 105; `levels.spec` (c) and (d) |
| Whiteout under the HUD | The whiteout is drawn by `Hud.draw()` over the timer, score, hearts and held antibiotic; the ePhone and the banner stay above it (the phone's depth after `swapDepths(this.getNextHighestDepth())` cannot be read from the sources). Particles and popups are drawn before the HUD, so they sit under the white for its first frames too. | NOTES.md 3.24 (whiteout depth 194; score 89, hearts 111-119, held 123, timer 125); `PlatformGame.as:542` | `render.js` (fill removed), `hud.js` `draw({ whiteout })` | `levels-ui` (h): white pixels over the score, a heart and the timer at the first whiteout frame |
| Tick boxes capped at `required` | Every counted goal event ticks the next box, up to the six boxes, so an overshoot ticks a grey box as in the original. | `PlatformGame.as:918-925` | `hud.js` `drawStatus()` and the fallback phone | code review (overshoot is rare: two kills in one step in L5/L6) |
| Blur during the briefing started the level unattended | `onHidden()` during the first briefing suspends its autoplay (the pause card is for play only, `main.js:37-40`); the player's next key (jump, confirm, arrows, back) or tap turns it back on and restarts the 5 s count. No `document.hasFocus()` test at play start (headless browsers report no focus). | review run t4 | `platformScene.js` `onHidden()`, `intro.js` `suspendAutoplay()` / `resumeAutoplay()` | `levels-ui` (e): 2500 ticks after a blur: still page 0, step 0, 180 s; Space then autoplay reaches play. Since the whole-game review (NOTES 10.6) a key that turns a page ends the autoplay for the rest of the briefing, and the autoplay never turns the last page, so `levels-ui` (e) now presses through to play. |
| Reduced motion: no autoplay, hint dimmed | `revealedAt` is set wherever the page is shown at once, so the autoplay, the full-opacity hint and the progress bar work the same with reduced motion. | review run t8 | `intro.js` `advance()`, `update()` | `levels-ui` (f): play reached after 670 ticks. Since the whole-game review (NOTES 10.6) the autoplay stops on the last page, and `levels-ui` (f) checks that only a press starts the level. |
| Game-over prompt only true with focus | Enter on the game-over or level-complete card presses its main button when no card button has focus (a focused button takes Enter natively, so nothing is pressed twice); a click or tap anywhere off the buttons retries, as the original's "click to try again" page; the prompt is re-worded when the input device changes. | original summary page ("click to try again"); review run t15 | `platformScene.js` `onGameOver()`, `confirmCard()`, `update()` | `levels-ui` (g) |
| Briefing hint hard to read | The hint is drawn at 17 stage px on a dark pill, at 85 % opacity while the text types and 92.5-100 % (a gentle pulse) after. | review screenshots | `intro.js` `drawChrome()` | screenshot `levels-ui-briefing.png` |
| Off-screen bomb badges stacked | See section 3 "Bombs": art-rectangle test, 50 px spread per side. | review run t10 | `render.js` `drawBombHints()`, `spreadInBand()` | `levels-ui` (h): up to 3 badges on one side, at least 45 px apart |
| Fuse blink and hurt blink ignore reduced motion | Reduced motion: steady fuse tint (0.3 + 0.45 x fuse used); the hurt player is steadily see-through (60 %) instead of the 9 Hz blink. | `GOAL_PROMPT.md:145`, NOTES.md 11.1 item 9 (reduced motion honours `prefers-reduced-motion`) | `render.js` `bombBlink()`, `drawPlayer()` | code review |
| "Snap!" not translatable | `platform.snap` in `web/data/lang/en/platform.json`. | - | `platformScene.js` `handleFx()` | `levels.spec`, `level1.spec` (no missing-key errors) |

New test probe fields (cosmetic, not in the determinism check): `tilesDrawn`, `bombHints`,
`whiteout`, `intro.autoplay`.

Starting play on the tick of the closing key press does not make the player hop: that press's
edge is used by the briefing, `beginPlay()` clears the step input, and jumps are edge-triggered
(`jumpFeel`, `player.js`), so a Space still held when play starts is not a jump. The traces are
recorded with `intro=0` and are unaffected; the other nine replayed unchanged after these fixes.
