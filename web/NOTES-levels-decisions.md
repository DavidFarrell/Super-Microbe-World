# Platform levels 2-10: decisions, fixes and verification

Scope: levels 2 to 10 of the hoverboard platform game (`web/js/platformer/`), on top of the level 1
engine documented in `web/NOTES-platformer-decisions.md` ("PD" below). Sources are cited as in
`web/NOTES.md` 1.2 (`PlatformGame.as` is `reference/Junior_Game/src/ebug/junior/PlatformGame.as`).
The resolved decisions of `web/NOTES.md` 11.9 are applied as written and are not reopened here.
To be merged into `web/NOTES.md` (sections 3, 4 and 10).

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
  They supersede the identical copies in `web/data/lang/en.json` (namespace files are merged after
  it); removing those copies is requested in `web/requests/levels.md`. Known text/goal mismatches
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
- **Bombs**: the fuse blink and the off-screen badge of decision 7.
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
  | 4 | 137 | 286 | 15 | 3 | 3 Patty photos |
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
  expected picture and mode icon.
- **`web/tests/unit/levels.test.mjs`**: decision 7 (an off-screen bomb explodes and counts),
  decision 10 (+3 then +5; nothing on the superinfection), decision 6 (both entity orders).
- **`web/tests/level1.spec.mjs`**: the last test opened level 1 through the splash's New Game,
  which now starts the flow's journey (a first-run language chooser, the cutscene and the
  shrinking zone; `flow.spec.mjs` covers that path). It now reaches level 1 through Level select
  (`?lang=en`, keyboard and tap) and still checks that the briefing opens first.

## 5. Original data quirks found by the data checks (kept)

- **Wide microbe boxes reach into tiles** (frame-1 art bounds, NOTES.md 4.4): level 4 Patty at
  (4,11) into the loaf at (4,14)-(4,15), Patty at (5,23) into the jam toast at (7,27), Patty at
  (5,51) into the pepper pot at (4,55); level 5 Slurm at (5,39) into the small spot at (6,40);
  level 6 Slarg at (3,43) into the skin at (7,43)-(7,44). They spawn in FALL and, like any microbe
  walking into big tile art, are pushed out by the physics (NOTES.md 3.17). The spec lists them explicitly, so a data change that adds
  or removes one is flagged.
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
  are done by this work; that file is outside this area and is left as it is.
