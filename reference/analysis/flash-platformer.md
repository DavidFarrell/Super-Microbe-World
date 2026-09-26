# Flash platform ("hoverboard") engine: port reference

Scope: the platform game of the 2009 Flash original (AS2, SWF 8, 800x450, 25 fps). This is the canonical behaviour for the browser port. Everything here was read from source and checked against the compiled SWF.

Path conventions:
- `src/`, `levels/` and `movies/` are relative to `reference/Junior_Game/`.
- `docs/` is relative to `reference/`.
- The pasted `.as` line numbers are the file's own line numbers.

How this was verified:
- **Source**: every platformer `.as` file was read in full: `PlatformGame`, `ParticleSystem`, `Entity`, `EntityBox`, `Vector3`, `Game`, `Level`, `MapBuilder`, `TileDefinitionParser`, `Constants`, `GameEntity`, `Microbe`, `GoodMicrobe`, `LucyLactobacillus`, `BadMicrobe`, `SuperInfection`, `PlayerEntity`, `BulletEntity`, `CameraFlashEntity`, `SoapPickup`, `WhitePickup`, `AntibioticPickup`, `AntibioticBombEntity`, `MilkGlassEntity`, `PortalEntity`, `Goal`, `Event`, `EPhone`, `ClipLoader` and `GameController`.
- **Compiled code**: the AVM1 bytecode of `movies/introductionToMicrobes_platformer.swf` was disassembled with a throwaway script. Every numeric literal in the 25 compiled platformer classes was compared with the `.as` files. The only differences are compiler artefacts: negated literals, inlined `Key.*` codes 17/18/32/36-40, `Math.SQRT2` and `Math.PI/180`. **The shipped SWF was built from this source.**
- **Frame scripts**: the root timeline, the ePhone, the level intros, the avatar (`movies/harry.swf`, `movies/amy.swf`) and the microbe clips were disassembled. They set `midAnimation` and `shoot`, and they hold the 15 ms loop.
- **Clip sizes**: taken from static SWF bounds, using the frame-1 display list of each exported symbol. They were not measured at runtime (see §11).

The main engine is `ebug.ParticleSystem`, a Jakobsen-style Verlet particle system on axis-aligned boxes. The APE library under `src/physics/ape/` is **not used** by the platformer: nothing in `src/ebug` imports it.

---

## 0. Key numbers at a glance

| Quantity | Value | Source |
|---|---|---|
| Main loop interval | `setInterval(loop, 15)` ms | SWF root frame 20 (label `main`); `GameController.as:259,270`; doc `docs/junior-game-documentation.md:745` |
| Effective simulation step | one UPDATE per two `main()` calls (about 30 ms) whenever anything moved (see §1.4) | `PlatformGame.as:613-616,1163` |
| Physics `timeInterval` | 30/1000 = 0.03 s (so `dt² = 0.0009`) | `PlatformGame.as:153`, `ParticleSystem.as:153` |
| Constraint iterations | 1 | `PlatformGame.as:153`, `ParticleSystem.as:154` |
| Gravity | (0, 3000) per second², which is 2.7 px added per step | `PlatformGame.as:150` |
| Drag (velocity multiplier per step) | 0.95 | `PlatformGame.as:151`, `ParticleSystem.as:324` |
| Residual horizontal velocity | Never reaches 0 on its own. Positions are rounded to 3 dp and x is then snapped to 0.1 px every UPDATE, so coasting settles at **+1.0 px/step (right) or −0.9 px/step (left)** after about 61 steps and creeps forever (about 33 px/s). Any x velocity from −0.9 to +1.0 on the 0.1 grid is a fixed point. | §2.2, `Vector3.as:24-41,61`, `PlatformGame.as:1017` |
| Horizontal force friction | ×0.9 if abs(force.x) > 10, else ×0.8 | `ParticleSystem.as:371-375` |
| Speed clamp (`maxChange`) | per axis, the smallest half-size of any non-exempt box: 25 px/step y; 25, 23.98 or 21.16 px/step x per level (table §2.6) | `ParticleSystem.as:221-233,338-347` |
| Tile size | 50 px (`Constants.TILE_WIDTH`) | `Constants.as:22` |
| Stage | 800 x 450 | `Constants.as:23-24` |
| World bounds | min (0, -100), max (cols×50, 450) | `PlatformGame.as:260-261` |
| Player box | 49 x 100 (forced) | `PlatformGame.as:387` |
| Player "speed" (force per key tick) | gravity.y × 1.5 = 4500 | `PlatformGame.as:396` |
| Player `jumpForce` | gravity.y × 8 = 24000; jump applies −3 × jumpForce = −72000 | `PlatformGame.as:397`, `PlayerEntity.as:416` |
| Max jumps | 2 (`MAX_JUMPS`) | `PlatformGame.as:52`, `PlayerEntity.as:110` |
| Jump apex | about 99.8 px (2 tiles) after 8 steps | §2.6 |
| Lives | 3 per level | `PlatformGame.as:381`, `PlayerEntity.as:125` |
| Level timer | 180 s per level, wall clock (`getTimer`) | `PlatformGame.as:148,558-569` |
| Scroll margins | left 250, right 450 (screen x) | `PlatformGame.as:45-46,1029-1050` |
| Microbe walk speed | 10 px per UPDATE (teleport) | `GoodMicrobe.as:24`, `BadMicrobe.as:28`, `GameEntity.as:227` |
| Default think time | 5 UPDATEs | `GameEntity.as:48` |
| Bullet | box 50x25; own speed 10 px/UPDATE plus Verlet carry; life 15 UPDATEs; range about 484-538 px | `PlatformGame.as:689-690`, `BulletEntity.as:31-91` |
| Camera flash | art 75x75 at offset (−31..44, −35..40); fades 10 alpha per UPDATE, so it lives 10 UPDATEs | `CameraFlashEntity.as:70-91`, SWF bounds |
| Antibiotic bomb fuse | 2000 ms after abs(dy) ≤ 2 | `AntibioticBombEntity.as:31-33,36-57` |
| Superinfection lives | 6 | `SuperInfection.as:26` |

---

## 1. Architecture

### 1.1 Classes

| Class / file | Role |
|---|---|
| `src/ebug/junior/PlatformGame.as` (extends `ebug.Game` which extends `mx.core.UIObject`) | The whole platform game: state machine, event dispatcher, level build, render, scrolling, HUD, input mapping. It is registered to the library symbol `PlatformGame` and placed as the instance `game` on the platformer root (SWF initaction for sprite 1494). |
| `src/ebug/Game.as` | Base: `gameState`, `screenTopLeft`/`screenBottomRight` (`ebug.Point` with `xPos`/`yPos`), scroll flags, `scrollSpeed`, `moveScreenLeft/Right` (`Game.as:56-69`). |
| `src/ebug/ParticleSystem.as` | Physics: box particles, Verlet integration, collision, world bounds. It emits `COLLIDE` events into `PlatformGame.entityEvents`. |
| `src/ebug/Entity.as`, `EntityBox.as` | Physics body: `position` (top-left), `previousPosition`, `force`, `width`/`height`, `centreOffset`, `bottomRightOffset`, the `gravityExcempt`/`physicsExcempt`/`isDynamic` flags, and `theParent` (the owning `GameEntity`). |
| `src/ebug/Vector3.as` | Vector maths. It has rounding side effects (§2.2). |
| `src/ebug/MapBuilder.as`, `Level.as`, `Tile.as` | Level XML parsing into `Level` (`levelDataGeometry`, `levelDataEntities`, `uniqueItems`, `goals`, `tiles`). |
| `src/ebug/junior/TileDefinitionParser.as` | Parses `levels/tile_definitions.xml` into the tile list used by every level. |
| `src/ebug/junior/GameEntity.as` | Base game object: state, think/advance scheduling, generic walk/idle/fall AI, `safeToMove`, `onSolidGround`. |
| `Microbe.as` → `GoodMicrobe.as` → `LucyLactobacillus.as` | Good microbes. |
| `Microbe.as` → `BadMicrobe.as` → `SuperInfection.as` | Bad microbes. |
| `PlayerEntity.as` | Player controls, upper and lower body animation state, jump, fire, photo, antibiotic, damage. |
| `BulletEntity.as` | Soap and white blood cell projectiles (identical logic). |
| `CameraFlashEntity.as` | Photo flash. |
| `SoapPickup.as`, `WhitePickup.as`, `AntibioticPickup.as` | Pickups. |
| `AntibioticBombEntity.as` | Thrown antibiotic. |
| `MilkGlassEntity.as` | Milk glass that turns into yoghurt. |
| `PortalEntity.as` | Exit portal. |
| `Goal.as` | Level goal counting. |
| `Event.as` | Event record `{type, target, params}` and the event type ids. |
| `src/ebug/general/EPhone.as` | The ePhone HUD clip class (grow/shrink). |
| `src/ebug/ClipLoader.as` | Loads the avatar SWF. |
| `src/ebug/junior/GameController.as` | Outer flow: rounds, restart, summary page (§9). |
| Dead / unused | `SuperBug.as` (not compiled into the SWF; references an undeclared `washAway`), `PlayerTile.as` (empty), `ShrinkingZone.as` (game show only), `src/physics/ape/*`, `PlatformGame.as.bak2` (differs only in debug lines and a backslash path). |

### 1.2 Hosting and the loop (15 ms confirmed)

Root timeline of `movies/introductionToMicrobes_platformer.swf`. It has labels `init`(1), `start`(10) and `main`(20).

- **Frame 1**:
  - Defines `tilesReady()`.
  - Registers the `game` instance with `_parent.registerHoverboard(game)` and `_root.registerHoverboard(game)`.
  - Hides `antibiotic_held`.
  - Creates `tdp = new ebug.junior.TileDefinitionParser()` and calls `tdp.loadXML("../levels/tile_definitions.xml")`.
  - Stops.
- **Frame 10 (`start`)**: `gameInterval = setInterval(this, "tilesReady", 40)`. When `tdp.loading == false`, `tilesReady` clears the interval, calls `game.initialiseGame(player, level, tdp.tiles)` and does `gotoAndStop("main")`.
- **Frame 20 (`main`)**: `function loop(){ game.main(); }` and `gameInterval = setInterval(loop, 15)`. This confirms the documentation's 15 ms (`docs/junior-game-documentation.md:745-754`).
- On later rounds and restarts, `GameController` calls `initialiseGame` itself and re-creates `setInterval(hoverboardHolder, "loop", 15)` (`GameController.as:256-259,268-270`).

`TileDefinitionParser` polls its XML every 40 ms (`TileDefinitionParser.as:25`).

`main()` (`PlatformGame.as:194-1254`) runs its FPS counter bookkeeping first (debug only: 197-225, 208 writes `_root.debugOutput`). Then, if `!busy`, it `switch`es on `gameState`. `busy` is set only while `STATE_LOAD_TILES` and the level-transition cleanup run. Line 1052-1053 does `busy = true; busy = !updateScore();`, and since `updateScore()` always returns true this nets to false.

**Unverified**: how often Flash Player actually fired a 15 ms interval inside a 25 fps movie. The display only refreshed at the frame rate. See §11.

### 1.3 State machine

State ids (`Constants.as:63-91`):

| State | Id |
|---|---|
| INIT | 0 |
| LEVEL_LOADING | 1 |
| LEVEL_LOADED | 2 |
| LOAD_TILES | 3 |
| UPDATE_WORLD | 4 |
| RENDER_WORLD | 5 |
| CREATE_GUI | 6 |
| FIND_LEVEL | 7 (unused) |
| LOAD_LEVEL | 8 |
| LEVEL_COMPLETE | 9 |
| INIT_DIALOGUE | 10 |
| CREATE_ENTITIES | 14 |
| GAME_OVER | 997 |

The other ids (11-13 and 15-20) belong to the game show and are unused here.

Sequence per level:

```
initialiseGame() -> INIT -> LOAD_LEVEL -> LEVEL_LOADING (poll) -> LEVEL_LOADED -> LOAD_TILES
  -> CREATE_GUI -> CREATE_ENTITIES -> INIT_DIALOGUE (phone intro) -> UPDATE_WORLD <-> RENDER_WORLD
  -> LEVEL_COMPLETE | GAME_OVER -> (next level: initialiseGame) | (exit: _root.endofHoverboard)
```

| State | What it does | Lines |
|---|---|---|
| `initialiseGame(player, newLevel, tiles)` | Resets `mainTimes`. `newLevel` defaults to `"alpha_level1.xml"`. Sets `gameState=INIT`, `mapBuilder = new MapBuilder(tiles)`, clears the scroll flags, `dirtyScreen=true`, `secondsLeft=180`. Builds a new `ParticleSystem(30, 1, new Vector3(), null, (0,3000,0), .95, (9999999,9999999,0), true)`. Hides the avatar and loads `amy.swf` if `player.avatarSex == Player.FEMALE` (false), else `harry.swf`. Attaches the ePhone `status` screen, hides the `talkie` and shows `heart0..2`. It does **not** reset `score`, `tiles`, `cells`, `staticEntities`, `portalId` or `antibiotic_held`. | 126-185 |
| INIT | `screenTopLeft=(0,0)`, `screenBottomRight=(800,450)`. | 231-239 |
| LOAD_LEVEL | `mapBuilder.loadLevel("../levels/" + nextLevel)`. | 240-247 |
| LEVEL_LOADING | `isLevelLoaded()`. When the bytes reach 100% it calls `parseXML()`, and on the following tick it moves to LEVEL_LOADED. | 248-254, 1313-1329 |
| LEVEL_LOADED | `level = mapBuilder.level`; `bodyLevel = level.bodyLevel`; `worldMin=(0,-100)`, `worldMax=(level.cols*50, 450)`. | 255-269 |
| LOAD_TILES | `attachMovie` of every tile's base clip (`"tile"+i`, hidden, placed off-stage). For each geometry cell (rows `0..rows-1`, cols `0..cols` **inclusive**) it creates a static box at `(col*50,row*50)` sized from the base clip, with `physicsExcempt=true` (solid only while drawn, §2.7). | 270-324 |
| CREATE_GUI | ePhone status icons from `goals[0]` (§8.3). | 325-369 |
| CREATE_ENTITIES | Player first, then every entity cell in row-major order (§3.1, §4). | 370-539 |
| INIT_DIALOGUE | If the phone is not large: `ePhone.swapDepths(...)` and `ePhone.grow(level.name)`. When `ePhone.bigScreen.finished` becomes true: `shrink()`, `secondsTimer=getTimer()`, go to UPDATE_WORLD. | 540-552 |
| UPDATE_WORLD | §1.5. | 553-1059 |
| RENDER_WORLD | §1.6. | 1060-1167 |
| LEVEL_COMPLETE / GAME_OVER | Shared cleanup and transition (§9). | 1169-1250 |

### 1.4 UPDATE/RENDER alternation (effective timestep)

UPDATE_WORLD does two things with the dirty flag:
- At line 613 it switches to RENDER if `dirtyScreen` is set, then clears the flag and carries on with the rest of the update in the same call.
- At lines 1015-1020 it sets `dirtyScreen` again if any entity's `position` differs from `previousPosition`.

RENDER always returns to UPDATE (1163). So whenever anything moves, the pattern is U, R, U, R and so on:
- advance, events and `timeStep` run once per two `main()` calls, which is **about 30 ms per logic and physics step**;
- if nothing moved, UPDATE runs every call (15 ms).

In practice the screen is always dirty:
- Walking microbes teleport, so their position never equals their previous position.
- After the first dynamic `REMOVE`, `entities[k]` is `null`. `null.particle.position.equals(...)` is `undefined` in AS2, and `!undefined` is `true` (1017), so the screen is **permanently dirty** from then on.

**Port recommendation**: run the logic step every 30 ms (or keep the literal 15 ms `main()` with the state alternation), and render every frame. The level timer is wall-clock (`getTimer()`), not tick-based.

### 1.5 UPDATE_WORLD order of operations (`PlatformGame.as:553-1059`)

1. **Timer** (558-569): if `getTimer() - secondsTimer >= 1000`:
   - `secondsTimer = getTimer()` and `secondsLeft--`;
   - `timeLeft.htmlText = "<b>"+secondsLeft+"</b>"`;
   - if `secondsLeft < 0`: set `secondsLeft = 0`, push `TRIGGER_GAME_END`, and set `exitReason = END_REASON_TIME` (0).
   - So the display counts 179 down to 0, shows "-1", and then the game ends. That is about 181 s of play.
2. **Goals** (575-593): `allGoalsAchieved = every goal.isGoalMet()`. The result is true when `level.goals` is empty. If it is true and `entities[portalId].state == PORTAL_STATUS_CLOSED`:
   - `level.goals.pop()`;
   - ePhone background becomes `exit_status`;
   - push `Event(PortalEntity.PORTAL_EVENT_OPEN, portal)`.
3. **Death check** (594-597): if `entities[0].lives <= 0`, push `TRIGGER_GAME_END` and set `exitReason = END_REASON_DIE` (1).
4. **Hearts** (598-601): hide `heart0 .. heart(3-lives-1)`, so the leftmost heart goes first.
5. **Scroll** using the flags computed at the end of the previous UPDATE (605-612): `moveScreenLeft()`/`moveScreenRight()` by `scrollSpeed`, and `dirtyScreen = true`.
6. **Schedule a render**: if `dirtyScreen`, set `gameState = RENDER_WORLD` and `dirtyScreen = false` (613-616).
7. **Advance** (618-631): for `i` in `0..entities.length-1` in index order, if `entities[i].isOnScreen == true`, concatenate `entities[i].advance()` onto `entityEvents`. The player is index 0.
8. **Event loop** (636-1009): `while (entityEvents.length) { e = entityEvents.shift(); switch(e.type) ... ; entityEvents = entityEvents.concat(newEvents) }`. This is FIFO. Handlers can also push straight onto `theGame.entityEvents` (the camera flash does), and those pushes are processed in the same loop. See §1.7.
9. **Physics**: `particleSystem.timeStep()` (1012). Collisions found here push `COLLIDE` events into `entityEvents`. They are processed at step 8 of the **next** UPDATE, ahead of that UPDATE's timer, goal and advance events.
10. **Dirty check** (1015-1020): `Vector3.equals(prev, 1)` **mutates** `position.x` to one decimal place (§2.2).
11. **Scroll decision** (1028-1050), §7.
12. **Score HUD** (1052-1053).

So the event queue at step 8 is ordered like this: COLLIDEs from the last physics step, then timer/portal/game-end events, then advance events. New events go on the end.

### 1.6 RENDER_WORLD (`PlatformGame.as:1060-1167`)

- `leftMostColumn = floor(screenTopLeft.xPos/50) - 5`, `rightMostColumn = ceil(screenBottomRight.xPos/50)` (1066-1067). The "-5" hack exists because large tiles were never removed (1064).
- For each row `0..rows-1` and each col from `leftMostColumn-1` to `rightMostColumn+1` that has geometry:
  - If there is no live cell clip (tested through `cells[r][c].row == undefined`, 1098), duplicate the base clip `tiles[id]` as `"cell"+r+"-"+c`. Store it and set that tile's static particle `physicsExcempt = false`.
  - Position it at `_x = col*50 - screenTopLeft.xPos`, `_y = row*50 + screenTopLeft.yPos` (yPos is always 0).
  - If `_x > 800 || _x + _width <= 0`, set `physicsExcempt = true` and `removeMovieClip()` (1124-1127). **Only tiles overlapping the visible 800 px band are solid.**
- For each entity (1133-1160):
  - **Mirroring**: if `direction == RIGHT` and `_xscale == -100`, set `_xscale = 100`. If `direction == LEFT`, then `mirroredImageOffset = particle.width` and `_xscale = -100`.
  - **Position**: `clip._x = particle.position.x - screenTopLeft.xPos + mirroredImageOffset` and `clip._y = particle.position.y`. There is no vertical camera.
  - **Off-screen** (`_x > 800 || _x + _width <= 0`): `isOnScreen = false` and `particle.physicsExcempt = true`.
  - **On-screen**: `isOnScreen = true`, and `physicsExcempt = false` **only if** `state` is `GAME_ENTITY_STATE_DYNAMIC` (4), `FALL` (8) or `JUMP_MID` (13). Entities with bespoke states (milk 100-102, player 101/102, bullets 100-102) that ever go off-screen stay physics-exempt when they come back.
- **Spawned entities start off-screen.** Bullets, the camera flash and the antibiotic bomb are created in the event loop (`PlatformGame.as:670-821`), and those handlers never set `isOnScreen`. The `GameEntity` constructor sets it to false (`GameEntity.as:103`).
  - They are skipped by the advance loop (621) until a RENDER has positioned them and marked them on screen.
  - They also do not act as the "current" body in collisions until then (`ParticleSystem.as:409`).
  - So a flash's first `takeShot` always uses its rendered (screen) position. **A port must not advance spawned entities on their creation tick.**

### 1.7 Events

Types (`Event.as`):

| Event | Id | Line |
|---|---|---|
| `THINK` | 0 | 22 |
| `IDLE` | 1 (`params[0]` = thinkTime) | 25 |
| `LAND` | 2 (unused) | |
| `BE_HURT` | 3 (`params[0]` = damage) | 28 |
| `BE_KILLED` | 4 | 29 |
| `SLIDE` | 5 (unused) | |
| `BE_PHOTOGRAPHED` | 6 | 31 |
| `BE_LIFTED` | 7 | |
| `COLLIDE` | 8 (`params[0]` = other entity, `params[1]` = half the correction vector) | 36 |
| `WALK` | 9 (`params[0]` = direction) | 39 |
| `FALL` | 10 | 41 |
| `REMOVE` | 11 | 42 |
| `CREATE_SOAP_BULLET` | 12 | 44 |
| `CREATE_WHITE_BULLET` | 13 | 45 |
| `CREATE_CAMERA_FLASH` | 14 | 46 |
| `MODIFY_POINTS` | 15 | 49 |
| `MODIFY_GOAL_STATUS` | 16 | 53 |
| `MILK_GLASS_EVENT_TURN_TO_YOGURT` | 17 | 55 |
| `PICKUP_ANTIBIOTIC` | 18 | 57 |
| `CREATE_ANTIBIOTIC` | 19 | 58 |
| `EXPLODE_ANTIBIOTIC` | 20 | 59 |
| `FAKE_KILL_SUPERINFECTION` | 21 (unused) | 61 |
| `KILL_SUPERINFECTION` | 22 (unused) | 62 |
| Player control events | 50-68 | 68-89 |
| `TRIGGER_LEVEL_END` | 900 | 93 |
| `TRIGGER_GAME_END` | 901 | 94 |

Bespoke ids overlap:
- `PortalEntity.PORTAL_EVENT_OPEN = 50` and `PORTAL_EVENT_CLOSE = 51` (`PortalEntity.as:14-15`);
- `MilkGlassEntity.MILK_GLASS_EVENT_HIT = 50` (`MilkGlassEntity.as:19`);
- `BadMicrobe.EVENT_BAD_MICROBE_WASH_AWAY = 51` (`BadMicrobe.as:19`).

They collide with `PLAYER_ACCELERATE`/`PLAYER_DECELERATE` (50/51). This is harmless only because the `PlatformGame` switch has no case for 50/51, so they fall to `default: target.act(e)`. Keep the ids separate per target in a port.

Dispatcher (`PlatformGame.as:646-1000`):

| Case | Behaviour |
|---|---|
| `COLLIDE` (647-669) | If `target.type == AMMO_PICKUP (9)` and `params[0].type == PLAYER (0)`: `target.act(e)`, then push `MODIFY_POINTS +7`. Else if `target.type == BAD_MICROBE (5)` and `params[0].type == BULLET (8)`: push `MODIFY_POINTS +3` and `target.act(e)`. **This branch is dead**, because bad microbes get types 15-19 and never 5. Else `target.act(e)`. |
| `CREATE_SOAP_BULLET` (670-709) | Non-body level: spawn a soap projectile. Body level: re-queue the event as `CREATE_WHITE_BULLET`. |
| `CREATE_WHITE_BULLET` (710-744) | Spawn a white blood cell projectile. |
| `CREATE_CAMERA_FLASH` (745-783) | Spawn the flash (§3.6). |
| `PICKUP_ANTIBIOTIC` (784-788) | Show `antibiotic_held`, set `player.has_antibiotic = true`. |
| `CREATE_ANTIBIOTIC` (789-821) | Hide `antibiotic_held`, set `has_antibiotic = false`, spawn the bomb. |
| `EXPLODE_ANTIBIOTIC` (822-885) | §3.7. |
| `REMOVE` (886-914) | `target.act(e)`. If the target is the camera flash, `player.canTakePhotograph = true`. If `target.particle.isDynamic`, remove the clip and set `entities[indexId] = null`, `dynamicEntities[i] = null` and `dynamicBoundingBalls[i] = null` (indices are never compacted). Static entities are left in place. |
| `MODIFY_POINTS` (915-917) | `score += params[0]`. |
| `MODIFY_GOAL_STATUS` (918-925) | `ePhone.status["button"+nextButton].gotoAndPlay("tick"); nextButton++`. The params are ignored. |
| `TRIGGER_LEVEL_END` (926-928) | `gameState = LEVEL_COMPLETE`. |
| `TRIGGER_GAME_END` (929-931) | `gameState = GAME_OVER`. |
| `BE_KILLED` (932-954) | `newEvents = goal.updateGoal(e)` for each goal (a later goal overwrites earlier results). Then `newEvents.concat(target.act(e))`, whose result is **discarded** (act runs for its side effects only). Then `MODIFY_POINTS`: `+5` if `target instanceof BadMicrobe`, else `-10`. The trace text says "15pts kill bad". |
| `BE_PHOTOGRAPHED` (955-978) | Goals updated as above, then `target.act(e)` (result discarded), then `+5` if `target instanceof GoodMicrobe`, else `+15`. |
| `MILK_GLASS_EVENT_TURN_TO_YOGURT` (979-992) | Goals updated, then `+50`. |
| `default` (993-999) | `newEvents = target.act(e)`. |

---

## 2. Physics (`src/ebug/ParticleSystem.as`)

### 2.1 Construction

`new ParticleSystem(deltaT=30, its=1, wMin=(0,0,0), wMax=null, grav=(0,3000,0), damp=0.95, limit=(9999999,9999999,0), cs=true)` (`PlatformGame.as:153`):

- `timeInterval = 30/1000 = 0.03`, `numIterations = 1`, `drag = 0.95`, `maxChange = limit`, `constrainSpeeds = true` (`ParticleSystem.as:153-160`).
- `worldMax` defaults to (800,450) at construction. `levelTileArray` is therefore allocated as **9 rows x 16 cols** of `" "` (166-181). Later static inserts past column 15 extend rows sparsely. Rows ≥ 9 do not exist, so inserts there are silently lost.
- `worldMin`/`worldMax` are reassigned in LEVEL_LOADED to (0,-100) and (cols×50, 450) (`PlatformGame.as:260-261`). **The level `rows` attribute never affects the bounds.**
- A fresh system (and a fresh `maxChange`) is built per level.

### 2.2 Vector3 semantics you must reproduce

- `add(v)` returns the sum **rounded to 3 decimal places** per component. `round(precision-1)` is called with `precision` undefined, which gives NaN and so falls back to 3 (`Vector3.as:24-41`).
- `subtract` and `multiply` do **not** round (43-49, 164-170).
- `equals(v, p=1)` first **mutates `this.x`** to `p` decimals (`x = round(x*10)/10`, line 61). It then compares x, y and z **exactly** (65).
- `PlatformGame.as:1017` calls `particle.position.equals(particle.previousPosition, 1)` for every entity every UPDATE. So every entity's `position.x` is snapped to 0.1 px after each physics step.

The snap quantises horizontal velocity, and it **stops drag from ever bringing a body to rest**. After the snap, `position` and `previousPosition` both sit on the 0.1 grid. For a coasting body (force.x = 0) one step is:

```
v' = round1(x + round3(0.95 * v)) - x          // round1/round3: Math.round(v*10^n)/10^n, half rounds up
```

- If 0 < v ≤ 1.0: 0.95v differs from v by at most 0.05, and a half rounds up, so v' = v.
- If −0.9 ≤ v < 0: v' = v. At v = −1.0, x − 0.95 rounds up to x − 0.9.
- Above about 2 px/step, v shrinks by ×0.95 per step. Between 2 and 1 it drops by 0.1 per step.
- Simulated from ±25 over 2000 starting positions, every case settles at **+1.0** (moving right) or **−0.9** (moving left) after 61 steps and never changes again.

What follows from this:
- **Player**: once moved, the player creeps at 1.0 px/step right or 0.9 px/step left (about 30-33 px/s) until a wall, the level bound, or an opposite key press. Braking seldom lands exactly on 0. For example 3.6 − 3.645 gives −0.2, which then creeps left for ever.
- **Floating bodies**: the milk glass and the superinfection are pushable, gravity-exempt and have physics on. After a push they creep the same way until a tile stops them.
- **Rendering**: the screen is dirty permanently once the player has moved (§1.4).
- **y is not affected**: y is not snapped, and gravity dominates vertical motion anyway.

### 2.3 Bodies

- `EntityBox(origin, w, h)`: `position` is the **top-left** corner. `previousPosition = position` initially. `centreOffset = (w/2, h/2)`, `bottomRightOffset = (w, h)`. Flags `gravityExcempt = false`, `physicsExcempt = false` (`Entity.as:52-64`, `EntityBox.as:10-21,55-57`). `type = TYPE_BOX (0)`.
- `teleport(p)`: `previousPosition = position` then `position = p`. Velocity is therefore zero after a teleport (`Entity.as:83-91`).

`createBoxParticle(position, clip, dynamic, force, gravityExcempt, maxChangeExcempt, forceSize)` (`ParticleSystem.as:187-239`):

```
if !(clip instanceof MovieClip) return null            // e.g. missing linkage -> no body
w = clip._width; h = clip._height                      // current frame's art bounds
if forceSize != null: w = forceSize.x; h = forceSize.y
box = new EntityBox(position, w, h)
box.force = force ?? (0,0,0)
if gravityExcempt: box.gravityExcempt = true
box.isDynamic = dynamic
clip._x = position.x; clip._y = position.y            // WORLD coords until next RENDER
radius = round(sqrt(w*w + h*h) / 2)
if dynamic: dynamicEntities.push(box); dynamicBoundingBalls.push(radius); allocate excemptionMatrix[i][DYNAMIC|STATIC]
else:       staticEntities.push(box);  staticBoundingBalls.push(radius);
            levelTileArray[position.y/50][position.x/50] = index   // non-integers make a junk key
if !maxChangeExcempt:
    if ceil(w/2) < maxChange.x: maxChange.x = w/2
    if ceil(h/2) < maxChange.y: maxChange.y = h/2
return index
```

### 2.4 Time step (`ParticleSystem.as:290-305`)

The step runs `hasCollided = []`, then `accumulateForces()`, then `verlet()`, then `satisfyConstraints()`.

```
accumulateForces():                                    // 361-379
  for e in dynamicEntities (non-null):
    f = (0,0,0)
    if !e.gravityExcempt: f = e.force.add(gravity)     // gravity-exempt bodies LOSE their force here
    f.x *= (abs(f.x) > 10) ? 0.9 : 0.8                 // "friction" on force only
    e.force = f

verlet():                                              // 317-355
  for e in dynamicEntities (non-null, !e.physicsExcempt):
    tmp = e.position.clone()
    change = (e.position - e.previousPosition) * drag             // drag = 0.95
    newPos = e.position.add(change)                               // rounds to 0.001
    newPos = newPos.add(e.force * (0.03*0.03))                    // rounds to 0.001
    if constrainSpeeds:
      d = newPos - tmp
      if abs(d.x) > maxChange.x: newPos.x = tmp.x + sign(d.x)*maxChange.x; d = newPos - tmp
      if abs(d.y) > maxChange.y: newPos.y = tmp.y + sign(d.y)*maxChange.y
    e.position = newPos; e.previousPosition = tmp
    e.force = (0,0,0)

satisfyConstraints():                                  // 392-657, numIterations = 1
 for it in 0..numIterations-1:
  for a in 0..dyn.length-1: if dyn[a] == null continue
    A = dyn[a]
    if !(A.theParent.isOnScreen || A.physicsExcempt) continue     // exempt bodies STILL collide
    A.isColiding = false
    A.centre = A.position.add(A.centreOffset)          // computed once; NOT refreshed after dyn pushes
    // --- dynamic vs dynamic (both move half) ---
    for b in 0..dyn.length-1: if dyn[b] == null continue
      lo = min(a,b); hi = max(a,b)
      skip if a == b or hasCollided[lo][hi]
      skip if excemptionMatrix[a][DYNAMIC][b]
      skip if dyn[b].theParent is a Bullet in BULLET_STATE_DEAD (never set)
      skip if dyn[b].theParent.state == BE_KILLED (10) or IGNORE (23)   // only when B is the *compare*
      B = dyn[b]; B.centre = B.position.add(B.centreOffset)
      delta = B.centre - A.centre
      if hypot(delta) >= ball[a] + ball[b]: continue
      ox = (A.w + B.w)/2 - abs(delta.x)                // code calls this penetrationY
      oy = (A.h + B.h)/2 - abs(delta.y)                // code calls this penetrationX
      if oy > 0 and ox > 0:
        A.isColiding = true
        if oy < ox: change = (0, (delta.y >= 0 ? -1 : 1) * oy)
        else:       change = ((delta.x >= 0 ? -1 : 1) * ox, 0)
        A.position = A.position.add(change*0.5)
        B.position = B.position.subtract(change*0.5)
        if it == 0:
          hasCollided[lo][hi] = true
          push COLLIDE(target=A.theParent, [B.theParent, change*0.5])
          if A.theParent.type != BULLET: push COLLIDE(target=B.theParent, [A.theParent, change*-0.5])
    // --- dynamic vs static (only A moves) ---
    myRow = floor(A.position.y/50); myCol = floor(A.position.x/50)
    test = [ staticEntities[levelTileArray[r][c]] for r in myRow-4 .. myRow+ceil(A.h/50)
                                                 for c in myCol-4 .. myCol+ceil(A.w/50)
                                                 if !isNaN(levelTileArray[r][c]) ]      // row-major
    for k in 0..test.length-1:
      S = test[k]
      skip if S.physicsExcempt
      skip if excemptionMatrix[a][STATIC][k]           // BUG: k is the local index (see 2.7)
      S.centre = S.position.add(S.centreOffset)
      delta = S.centre - A.centre
      if hypot(delta) >= ball[a] + staticBoundingBalls[k]: continue   // BUG: local index k
      ox = (A.w + S.w)/2 - abs(delta.x); oy = (A.h + S.h)/2 - abs(delta.y)
      if oy > 0 and ox > 0:
        A.isColiding = true
        change = (oy < ox) ? (0, (delta.y>=0?-1:1)*oy) : ((delta.x>=0?-1:1)*ox, 0)
        A.position = A.position.add(change)
        A.centre   = A.position.add(A.centreOffset)
  // sticks (none are created by the platformer)
  // world bounds, last so they have the highest priority:
  for e in dyn (non-null, !e.physicsExcempt):
    e.position = min(max(e.position, worldMin), worldMax - e.bottomRightOffset)   // component-wise

// Afterwards, back in PlatformGame (1015-1020), for EVERY entity (static ones too):
//   position.x = Math.round(position.x * 10) / 10        (the side effect of Vector3.equals)
```

Static collisions never emit events. Pickups, portals and the flash detect overlap themselves with `hitTest` (§4).

### 2.5 Which bodies are simulated

- **Verlet** moves only non-exempt dynamic bodies.
- **Collision** processes a dynamic body if it is on screen **or** physics-exempt, which means exempt bodies are included. A walking (exempt) microbe is still pushed by the player and by tiles.
- **World bounds** apply only to non-exempt dynamic bodies.
- **Static tiles** are solid only while their cell clip is drawn (§1.6).

### 2.6 Derived motion numbers

`dt² = 0.0009`:
- gravity adds **2.7 px/step²**;
- a held arrow key adds force 4500, which friction reduces to 4050, giving **3.645 px/step²**;
- terminal speeds before clamping are 2.7/0.05 = 54 px/step (falling) and 3.645/0.05 = 72.9 px/step (running). **Both are always clamped by `maxChange`.**

Per-level `maxChange` follows the exact rule at `ParticleSystem.as:221-233`. It takes the minimum over the tile clips, the microbe clips and the player's 49x100.
- Pickups, milk, the superinfection, bullets, the flash and the bomb are created with `maxChangeExcempt`. They do not *lower* `maxChange`, but the clamp still applies to them.
- The table computes this from art bounds.

| Level | maxChange.x (run cap, px/step) | maxChange.y (fall/jump cap) | Smallest body | Bullet travel after 16 UPDATEs |
|---|---|---|---|---|
| 1, 2, 8, 9, 10 | 21.158 | 25 | Lucy (42.32 px wide) | 484 px |
| 3, 4, 5, 6 | 25 | 25 | 50 px tiles | 538 px |
| 7, (11) | 23.980 | 25 | Iggy (47.96 px wide) | 524 px |

Sequences with rounding (simulated):

| Motion | Per-step values |
|---|---|
| Run from rest, vx after the 0.1 snap | 3.6, 7.1, 10.4, 13.5, 16.5, 19.3, 22.0, 24.5, then cap (25). In Lucy levels the cap is 21.2 from step 7. Top speed is reached after about 8 steps. |
| Coasting (keys released) | ×0.95 per step down to about 2 px/step, then −0.1 per step, and it **settles at +1.0 (right) or −0.9 (left) px/step after 61 steps (about 1.8 s) and creeps for ever** (§2.2). There is no ground friction. |
| Jump from rest, cumulative y | −25, −46.05, −63.35, −77.08, −87.42, −94.55, −98.62, **−99.79** (apex, step 8), −98.20, −93.99, −87.29, ... back to 0 after about 17 steps (about 0.5 s). |

The first jump step is clamped from 0.95v − 62.1 to −25. A jump therefore always sets vertical velocity to −25 px/step, whatever it was, and a double jump simply resets it to −25.

### 2.7 Collision quirks and bugs (with port advice)

1. **Wrong index in the static loop**: `excemptionMatrix[a][STATIC][k]` and `staticBoundingBalls[k]` use `k`, the position in the local `test` list, not the static entity's index (`ParticleSystem.as:583,586`).
   - *Radius*: the broadphase uses the radius of the k-th static body created in the level, which is the k-th tile in row-major order.
   - *Measured impact*: I simulated the player standing on every tile top in levels 1-10, sampling x every 5 px. 1375 of 25190 positions (5.5%) fail the broadphase. Per level: L1 11.5%, L2 4.3%, L3 6.1%, L4 0.3%, L5 6.5%, L6 5.7%, L7 7.1%, L8 2.1%, L9 0.3%, L10 7.0%. **Every miss** comes from the wrong radius, and none from the −4 cell window. The misses are all on large tiles (loaves, salt, yoghurt, hair slopes, scab, plaster, villi, acid pit, toast).
   - *Effect*: a body sinks into the far ends of big tiles until the ball test passes, and is then pushed out.
   - *Exemption*: the matrix is never hit in played levels. Exempted statics have indices ≥ 71 (after the tiles), while `k` ≤ about 41.
   - **Recommendation**: use a plain AABB overlap test. The correct radius is exactly equivalent, because it is half the diagonal. Treat this as a bug fix.
2. **Dead bodies still push as "current"**. The BE_KILLED/IGNORE/dead-bullet exclusions (433-435) only skip the *compare* body. Examples:
   - A dying microbe, the dead `SuperInfection` (which never leaves BE_KILLED, §4.8), and a dived Lucy (state IGNORE, `isDynamic=false`, so `REMOVE` never nulls it) all still resolve collisions when they are the outer loop body.
   - `BadMicrobe.remove()` moves its body to (−100,−100) (`BadMicrobe.as:454-455`), and bullets become exempt. The dived Lucy and the dead superinfection stay where they were as **invisible solid boxes**.
   - **Recommendation**: drop removed, killed and ignored entities from collision entirely (bug fix).
3. **One iteration** of constraints, with the stale centre for dyn-dyn pairs. Stacks and multi-contacts jitter. This is faithful and cheap to copy.
4. **The min-penetration axis decides the push direction**. A fast body can be pushed sideways off a ledge corner, and any head bump is a solid ceiling. **There are no one-way platforms** (§6).
5. **Off-screen tiles are not solid** (1109, 1125). Microbes walking off-screen become exempt anyway, and dynamic bodies off-screen are frozen (§1.6).
6. **Only anchor cells are indexed**. `levelTileArray` records only a tile's top-left cell, and multi-cell tiles are found through the −4 row/col window (comment at 559-563).
7. **Nobody can fall out of the world**. The bottom clamp is `worldMax.y - height = 450 - h`: the player's invisible floor is y = 350. Pits just drop you onto the bottom of the screen. The top clamp is y = −100.

### 2.8 Box and clip sizes

Sizes come from frame-1 SWF bounds (px). Flash reports `_width`/`_height` in twips (0.05 px), and they change with the animation frame.

| Body | Box (w x h) | How it is set | Notes |
|---|---|---|---|
| Player | **49 x 100** | forced (`PlatformGame.as:387`) | Avatar art: Harry about 55.7 x 107.3, bounds x −2..53.7, y −11..96.3. Amy about 63.1 x 107.2, x −4..59.1, y −11..96.2 (`movies/harry.swf`, `movies/amy.swf` root frame 1). The scroll and spawn code uses the art `_width`. |
| Soap / WBC bullet | **50 x 25** | forced (`PlatformGame.as:689,729`) | Art: `soap_projectile` frame 1 is empty (`_width` 0). `white_projectile` is 18 x 20. |
| Camera flash | 75 x 75 static | clip | Art bounds x −31..44, y −35..40 around the registration point. |
| Antibiotic bomb | 38.3 x 16.3 | clip `antibiotic_pickup` | Gravity on. |
| Lucy (`lucy_icon`) | 42.32 x 97.58 | clip | |
| Steve (`steve_icon`) | 74.10 x 72.94 | clip | |
| Patty (`patty_icon`) | 203.32 x 150.39 | clip | |
| Sandy (`sandy_icon`) | 90.08 x 226.05 | clip | Not placed in any played level. |
| Slurm (`slurm_icon`) | 75.64 x 72.44 | clip | |
| Slarg (`slarg_icon`) | 90.57 x 225.48 | clip | |
| Donna (`donna_icon`) | 100.42 x 147.74 | clip | |
| Iggy (`iggy_icon`) | 47.96 x 48.64 | clip | |
| Colin (`colin_icon`) | **no such linkage** in either SWF | none | `attachMovie` fails, giving no clip and no body (§10). |
| Superinfection | 409.15 x 195.42 | clip | Gravity exempt. |
| Milk glass (`milk_glass_icon`) | 150 x 200 | clip | Gravity exempt. |
| Portal (`portal_exit_icon`) | 103.6 x 163.8 static | clip | |
| Soap pickup | 36.1 x 44.1 static | clip | |
| White pickup | 39.1 x 42.1 static (art x 6..45.1) | clip | |
| Antibiotic pickup | 38.3 x 16.3 static | clip | |
| Tiles | from art, anchored at the cell's top-left (§6.3) | base clip | |

---

## 3. Player (`src/ebug/junior/PlayerEntity.as` + `PlatformGame.as`)

### 3.1 Creation (`PlatformGame.as:373-403`)

- **Position**: `uniqueItems[PLAYER] * 50`, the top-left of the `player_start` cell.
- **Clip and body**: `new PlayerEntity(this, null, _parent.avatar, MAX_JUMPS)` with `lives = 3`. The clip is moved to the start position and `swapDepths` is called. The body is dynamic, gravity on, not max-change exempt, forced 49x100, and `physicsExcempt = false`.
- **Fields**: `particleArrayId = 0`, `state = PLAYER_STATE_NORMAL (102)`, `speed = 4500`, `jumpForce = 24000`, `indexId = 0`, `type = GAME_ENTITY_PLAYER`, then `mapControls(player)`.

Constructor defaults (`PlayerEntity.as:103-128`):

| Field | Value | Note |
|---|---|---|
| `maxJumps` | 2 | `(!isNaN(inJumps)) ? 2 : inJumps`, an inverted test that still gives 2 |
| `jumpsLeft` | 2 | |
| `jumpReady` | true | |
| `counterCeiling` | 1 | |
| `canTakePhotograph` | true | |
| `ammo` | 0 | |
| `maxAmmo` | 10 | |
| `infiniteAmmo` | **true** | |
| `lives` | 3 | |
| `has_antibiotic` | false | |
| `isShootingSoap` | true | |
| `triggerTractorTime` | 250 | unused |
| `thinkTime` / `defaultThinkTime` | 100 | unused |
| `SHOOT_POINT` | 27 | `PlayerEntity.as:101` |

**Avatar**: `ClipLoader.loadClip("harry.swf"|"amy.swf", _parent.avatar)` runs each level (`PlatformGame.as:161-169`). `onLoadInit` shows the clip and plays `upper` at `"hurt"` as a flourish (`ClipLoader.as:14-18`). `upperClip = clip.upper` and `lowerClip = clip.lower` are read in the constructor (`PlayerEntity.as:108-109`). This relies on the SWF having loaded by CREATE_ENTITIES; it is a latent race, harmless when cached. The placeholder `avatar` symbol on the root is 50x100 at (40.9,116.9).

### 3.2 Controls (`mapControls`, `PlatformGame.as:1260-1311`; `checkKeys`, `PlayerEntity.as:566-636`)

| Key | Flag | Source | Effect |
|---|---|---|---|
| Right / Left arrow | `right_down` / `left_down` | keydown listener **and** polled `Key.isDown` every advance | Accelerate or brake (§3.3). Both held means neither. |
| Up arrow | `up_down` (polled) / `up_up` (keyup) | both | Jump (§3.4). |
| Down arrow | `down_down` | | No effect. |
| Space | `fire_down` / `fire_up` | keydown/keyup events only (edge; OS auto-repeat re-triggers) | Shoot (§3.5). |
| Ctrl | `alt_fire_down` / `alt_fire_up` | events only | Photo, or throw the antibiotic if one is held (§3.6-3.7). |
| **Home or Alt** | | keydown | **Cheat left in**: `gameState = LEVEL_COMPLETE`, which skips the level (1287-1290). |

`reset_keys()` clears every flag at the end of each `checkKeys` (638-644). Flags therefore mean "since the last UPDATE".

`advance()` (134-164) builds `checkKeys()` and `checkStateEvents()` into an internal queue. Events of type `CREATE_SOAP_BULLET`, `CREATE_CAMERA_FLASH` or `CREATE_ANTIBIOTIC` are returned to the game. All others are fed to `act()` immediately, and their results are re-queued. `act()` (166-268) ignores **every** event unless `state == PLAYER_STATE_NORMAL`.

### 3.3 Horizontal movement

```
checkKeys (per UPDATE):
  if !(right && left):
    if right:
      if direction == RIGHT: emit ACCELERATE
      else:
        if checkDirection() == RIGHT: direction = RIGHT; emit ACCELERATE   // not moving left
        emit DECELERATE
    elif left: mirror image of the above
checkDirection(): position.x < previousPosition.x ? LEFT : RIGHT
accelerate(): force += ( speed*direction, 0)      // +/-4500
decelerate(): force += (-speed*direction, 0)
```

Effects:
- Pressing the opposite way while still moving brakes at 3.645 px/step².
- On the tick the board stops or reverses, ACCELERATE and DECELERATE cancel, giving zero force.
- After that the player accelerates the new way.
- The only automatic slowing is drag (0.95 per step).
- With the 0.1 px snap, drag never brings the player to rest. The player keeps creeping at +1.0 or −0.9 px/step until blocked or braked (§2.2).

The animation calls in `accelerate`/`decelerate` are cosmetic (§3.9).

### 3.4 Jumping and the double jump

```
checkKeys: if up_down (polled, held):  if jumpReady: emit JUMP_START
           elif up_up (keyup):         emit KEY_RELEASED_JUMP
act JUMP_START -> jump_start(): lower "jump_start"; force += (0, -3*jumpForce = -72000);
                                jumpsLeft--; jumpReady = false; counter = counterCeiling (1)
act KEY_RELEASED_JUMP: if jumpsLeft > 0: jumpReady = true
checkStateEvents, lowerState == LOWER_JUMP and lowerClip.midAnimation == false -> jump_mid():
   if onSolidGround(): lowerState = LOWER_JUMP_LAND; lower "jump_end"; jumpsLeft = maxJumps
   direction = checkDirection()
onSolidGround() for a physics body (GameEntity.as:472-485):
   if abs(dy) < SAFE_TRAVEL_DISTANCE (1.5): if counter <= 0 return true else counter--
   else counter = counterCeiling
   return false          // so 2 consecutive UPDATEs with abs(dy) < 1.5
```

Consequences:
- **Two jumps**. A second press in the air works only after releasing Up (re-arm) while `jumpsLeft > 0`. You can also double jump after walking off a ledge.
- **Holding Up does not re-jump on landing**.
- **Dead press after a double jump**. The Up release that follows the double jump happens while `jumpsLeft == 0`, so it does not re-arm. Landing restores `jumpsLeft` but not `jumpReady`, so the next Up press only re-arms and the one after that jumps. This is faithful and should be kept.
- **Early landing checks**. The lower `jump_start` animation holds `midAnimation = true` for frames 136-139 (4 frames, 160 ms). `jump_mid` is not checked before then. Hitting a ceiling (dy about 0) counts as "landing" and restores the jumps mid-air.
- **Bad-microbe contact also resets `jumpsLeft`** (240).
- **Unused**: `JUMP_COUNT = 5` (`PlatformGame.as:53`, with the TODO at 51).

### 3.5 Shooting (soap and white blood cells)

```
fire_down -> KEY_PRESSED_FIRE -> fireWeapon() (316-353):
  if upperState in {ACCELERATE, DECELERATE, IDLE, MOVE}:
     if isShootingSoap and (ammo > 0 or infiniteAmmo):      // infiniteAmmo is always true
        upperState = UPPER_SHOOT_SOAP; upper "shoot_soap"; if !infiniteAmmo: ammo--
  elif upperState == UPPER_SHOOT_SOAP:  (also polled every UPDATE by checkStateEvents)
     if upperClip.shoot: upperClip.shoot = false; emit CREATE_SOAP_BULLET
     if !upperClip.midAnimation: upperState = UPPER_MOVE
```

Avatar timing (upper clip frame scripts, `movies/harry.swf` sprite 193):
- `shoot_soap` frame 280 sets `midAnimation=true, shoot=false`;
- frame 283 sets `midAnimation=false, shoot=true`;
- frame 298 goes back to `move`.

So the projectile spawns about 3 frames (120 ms) after the press, and one press gives one shot. The next press can fire as soon as `upperState` is back to MOVE, which is the same UPDATE the bullet spawns.

**Ammo**: `infiniteAmmo` is true from the start. Shooting is possible in every level, including photo levels. Pickups only add `ammo` and 7 points. The bar clips `soap_bar`/`wbc_bar` exist in the library but are never used.

**Projectile type**: `bodyLevel == false` gives `soap_projectile`, otherwise `white_projectile` (`PlatformGame.as:670-744`). The logic is identical. `UPPER_THOW_WHITE_BLOOD` is never entered.

Spawn (`PlatformGame.as:673-704`, same for white):
- `y = player.clip._y + 27`. `clip._y` equals `position.y` from the last render.
- Facing right: `x = player.position.x + player.clip._width - bulletClip._width`. Soap art width is 0, so x = player.x + avatar width. White: player.x + W − 18.
- Facing left: `x = player.position.x - bulletClip._width`, which for soap overlaps the player.
- Body: dynamic, forced 50x25, `maxChangeExcempt`. The initial force (the player's velocity with y=0) is **wiped** by `accumulateForces`, because `BulletEntity` sets `gravityExcempt = true`, so shots do not inherit momentum.
- `new BulletEntity(game, particle, clip, hurtGood=false, hurtBad=true, hurtHuman=false, damage=1, impact=10, speed=10)`. `direction` is the player's.
- The player and the bullet are exempted from each other in the matrix (703-704).

Bullet behaviour (`BulletEntity.as`):

```
ctor: thinkTime = defaultThinkTime = 3; deadTimer = 15; gravityExcempt = true; physicsExcempt = false;
      clip "shoot"; state = NORMAL(100)
advance NORMAL:  if deadTimer <= 0: state = SPLAT; clip "splat" else deadTimer--
                 position.x += speed*direction                  // then Verlet adds 0.95*(pos-prev), clamped
                 if abs(position.x - previousPosition.x) <= 1.5: thinkTime--; if thinkTime <= 0: SPLAT
advance SPLAT:   if clip.midAnimation == false: emit REMOVE; remove()   // hide + exempt
act COLLIDE (NORMAL only): if other.type not BULLET/PLAYER: state = SPLAT; clip "splat";
                 emit COLLIDE(target=other, [this])             // re-notifies the victim
```

Details:
- Speed builds up: displacement per UPDATE is 19.5, then 28.5, then 10 + maxChange.x (35/31.2/34.0) from then on.
- Range is about 484-538 px over 16 UPDATEs, plus a short glide during the splat (the table in §2.6).
- Soap `splat` holds `midAnimation` for frames 39-43. `white_projectile` never sets it, so it is removed on the next UPDATE.
- A bullet pinned against a wall splats after 3 stuck UPDATEs.

### 3.6 Camera photograph

**Trigger** (`PlayerEntity.as:185-199`): on a Ctrl keydown, if `!has_antibiotic` and `canTakePhotograph`:
- upper plays `take_photo_start`;
- `upperState = UPPER_TAKE_PHOTO`;
- `canTakePhotograph = false`;
- emit `CREATE_CAMERA_FLASH`.

**Flash creation** (`PlatformGame.as:745-783`):
- Clip `camera_flash` with `y = player.clip._y + 27`.
- Facing right: `x = player.position.x + player.clip._width`. Facing left: `x = player.position.x - flashClip._width - 2`.
- Body: a **static** box (75x75, gravity exempt, `physicsExcempt = true`), so it never collides physically.
- `CameraFlashEntity` goes into `entities` with `direction` = the player's. The player is exempted from it.
- It does not follow the player afterwards.

**Photo area**: this is the flash **art** bounding box after the next render. The art spans x −31..44 and y −35..40 around the clip origin; when mirrored the x span becomes −44..31. Relative to the player's box top-left (px, py):
- facing right: x from px + W − 31 to px + W + 44, where W is the avatar art width (about 55.7 for Harry, 63.1 for Amy);
- facing left: x from px − 46 to px + 29;
- vertically in both cases: y from py − 8 to py + 67.

So the reach is about 75 px in front of the player, and it is asymmetric.

**Resolution** (`CameraFlashEntity.as`):

```
advance (every UPDATE while state NORMAL(100)): takeShot():
   clip._alpha -= 10; if clip._alpha <= 0: emit REMOVE; state = DEAD(102)
   for i in 0..entities.length-1 while !shotTaken:
      if entities[i] instanceof Microbe and clip.hitTest(entities[i].clip):   // bbox vs bbox, global coords
         emit COLLIDE(target=this, [entities[i]]); shotTaken = true
act COLLIDE: if other instanceof Microbe and !other.hasBeenPhotographed:
               shotTaken = true; theGame.entityEvents.push(BE_PHOTOGRAPHED(target=other))
act REMOVE: remove()   (clip hidden, body exempt)
```

- **One microbe per flash**: the first overlapping microbe in entity order is chosen, **even if it has already been photographed**, in which case the flash is wasted (79-88).
- The game then applies the goal and points (+5 good, +15 bad) and the microbe's act. For good and bad microbes, act runs only if the microbe is on screen and not yet photographed: it sets `hasBeenPhotographed`, plays `be_photographed`, and sets the microbe exempt.
- **Cooldown**: `canTakePhotograph` becomes true on whichever comes first:
  - the flash `REMOVE` (after 10 UPDATEs, about 0.3 s; `PlatformGame.as:895-899`);
  - the end of the `take_photo` animation (`takePhotograph()` once `midAnimation == false`: upper frames 137-170, 34 frames, 1.36 s);
  - any hurt (`PlayerEntity.as:252`).
- In practice the effective cooldown is **10 UPDATEs**.
- The tractor-beam code on Ctrl release is commented out (200-223, 284-314).

### 3.7 Antibiotic

- **Pickup** (`AntibioticPickup.as:27-63`): a `hitTest` against the player clip while `has_antibiotic == false`. It emits `REMOVE` and `PICKUP_ANTIBIOTIC`, which shows the HUD `antibiotic_held` and sets `has_antibiotic`. **You can carry one at a time.**
- **Throw** (`PlayerEntity.as:193-197`, `PlatformGame.as:789-821`):
  - Ctrl with `has_antibiotic` plays upper `shoot_soap` and emits `CREATE_ANTIBIOTIC` immediately (no `shoot` wait).
  - This hides the HUD icon and clears `has_antibiotic`.
  - The bomb uses clip `antibiotic_pickup`. It spawns like a bullet: facing right at x = player.x + W − 38.3, facing left at x = player.x − 38.3, and y = clip._y + 27.
  - Its body is dynamic and sized from the art (38.3x16.3), with **gravity on** and `maxChangeExcempt`. It is exempted from the player.
- **Bomb** (`AntibioticBombEntity.as:36-57`):
  - FALLING: when `abs(dy) <= minimumSpeedTrigger (2)`, go to COUNTING_DOWN and set `bombTimer = getTimer()`.
  - COUNTING_DOWN: once `getTimer() >= bombTimer + 2000`, go to EXPLODE.
  - EXPLODE: emit `EXPLODE_ANTIBIOTIC` and `REMOVE`.
  - It only advances while on screen, so a bomb off-screen will not explode.
- **Explosion** (`PlatformGame.as:822-885`):

```
victims = on-screen entities of type LUCY, SANDY, STEVE, SLURM, SLARG, COLIN     // NOT Patty, Iggy, Donna
for v in victims: v.kill()      // state BE_KILLED + "be_killed"; no BE_KILLED event
                 points += (v is LUCY/SANDY/STEVE) ? -10 : +15
if an on-screen SUPERINFECTION exists: points += 30; emit BE_HURT(target=superinfection)
emit MODIFY_POINTS(points)
for goal in goals: newEvents.push(goal.updateGoal(e).pop())   // pushes undefined if nothing was returned
whiteout._alpha = 100            // full-screen white; its onEnterFrame fades it -10 per frame (0.4 s)
```

The victim list is the lesson: antibiotics kill bacteria, good ones included, but not the fungi (Patty, Donna) or the virus (Iggy). Antibiotic kills **do not count** for KILL_ALL goals and give no +5/−10 `BE_KILLED` points (§5).

### 3.8 Damage, invulnerability, lives, death

- **Contact** (`PlayerEntity.as:233-243`): on a `COLLIDE` with `params[0] instanceof BadMicrobe`, and `state != PLAYER_STATE_BE_HURT`, and `microbe.lives > 0`, emit `BE_HURT(1)` and set `jumpsLeft = maxJumps`.
  - `SuperInfection` is a `BadMicrobe`, and touching it hurts as long as its lives are above 0.
  - The player is dynamic index 0, so the player's `COLLIDE` is queued before the microbe's. The microbe is still alive when the player's event is handled.
  - **Every bad-microbe touch costs one life.** It kills the microbe only if the microbe is IDLE or WALKing (§4.6).
- **BE_HURT** (244-260):
  - `lives -= 1`; upper and lower play `hurt`; `canTakePhotograph = true`;
  - if `lives <= 0`, emit `BE_KILLED`, otherwise `state = PLAYER_STATE_BE_HURT`.
- **Invulnerability**: while in `BE_HURT`, `act()` ignores everything, including COLLIDE (no damage) **and all input** (no control).
  - It ends in `checkStateEvents` (461-468, 522-529) when both hurt animations have finished.
  - The hurt animation is upper frames 255-266 and lower frames 195-206: 12 frames, **480 ms**.
  - There is no knockback force; the only push is the collision separation.
- **Death**: the player's `BE_KILLED` reaches the game's BE_KILLED case, which gives **−10 points** because the player is not a `BadMicrobe`. At the next UPDATE `lives <= 0` pushes `TRIGGER_GAME_END` with `END_REASON_DIE`.
- Lives reset to 3 on each new level (new `PlayerEntity`) and on restart.

### 3.9 Avatar animation (cosmetic, but it gates timing)

Frame labels and `midAnimation` spans at 25 fps (`movies/harry.swf`; Amy has the same labels).

Lower body (sprite 142):

| Label | Frames | Notes |
|---|---|---|
| `idle` | 10-30 | loops |
| `move` | 47-55 | loops |
| `accelerate_start` | 70-75 | then `accelerate_mid` 85-92 (loops) |
| `decelerate_start` | 105-111 | then `decelerate_mid` 119-126 (loops) |
| `jump_start` | 136-140 | `mid` true 136-139, then `jump_mid` 150-156 (loops) |
| `jump_end` | 165-180 | `mid` true 165-179, then `move` |
| `hurt` | 195-207 | `mid` true 195-206 |

Upper body (sprite 193): the same locomotion labels, plus:

| Label | Frames | Notes |
|---|---|---|
| `take_photo_start` | 137 | `mid` true 137-170; `shoot` true 155-162 (unused) |
| `use_tractor_beam_*` | 195-237 | unused |
| `hurt` | 255-267 | |
| `shoot_soap` | 280-298 | `shoot` fires at 283 |
| `throw_white_blood_cell` | 316-330 | unused |

`checkStateEvents` switches the lower body between `idle`, `move` and `accelerate` using `abs(dx)` thresholds of 1.5 and 3 (535-549).

### 3.10 Scoring (all sources)

| Event | Points | Source |
|---|---|---|
| Collect soap/white pickup | +7 | `PlatformGame.as:649-657` |
| Bullet hits bad microbe | +3 **never awarded** (type test against 5) | `PlatformGame.as:658-665` |
| Bad microbe killed or washed away (BE_KILLED) | +5 (the comment says 15) | `PlatformGame.as:945-947` |
| Good microbe killed (BE_KILLED), including by touching a bad one | −10 | `PlatformGame.as:948-950` |
| Player dies (BE_KILLED of the player) | −10 | same |
| Photograph good microbe (incl. Lucy) | +5 | `PlatformGame.as:968-970` |
| Photograph bad microbe (incl. Superinfection, **repeatable**, §4.8) | +15 | `PlatformGame.as:971-973` |
| Lucy touches milk (hit) | +10 | `MilkGlassEntity.as:87-91` |
| Milk turns to yoghurt | +50 | `PlatformGame.as:987-990` |
| Antibiotic explosion | −10 per on-screen Lucy/Sandy/Steve, +15 per on-screen Slurm/Slarg/Colin, +30 if the superinfection is on screen | `PlatformGame.as:825-871` |

The score starts at 0 in the constructor only (`PlatformGame.as:123`). It **persists across levels, rounds and restarts**.

---

## 4. Entity types and behaviour

### 4.1 Type ids (`Constants.as:29-58`)

`tile_definitions.xml` indices are shown as `[n]`. The "Linkage used" column is the tile definition's `<icon>` (§6.1).

| Id | Name | Class | tile_definitions | Linkage used | In played levels |
|---|---|---|---|---|---|
| 0 | PLAYER | `PlayerEntity` (start marker) | [111] `player_start` | (avatar SWF) | all |
| 1 | TILE | static geometry | [0-92] | per tile | all |
| 2 | ERASER | editor only; dropped by MapBuilder | [113] | | no |
| 3 | GENERIC | `GoodMicrobe` branch | none | | no |
| 4 | GOOD_MICROBE | `GoodMicrobe` branch | none | | no |
| 5 | BAD_MICROBE | `BadMicrobe` branch | none | | no |
| 6 | PORTAL_EXIT | `PortalEntity` | [107] `portal` | `portal_exit_icon` | all |
| 7 | PORTAL_ENTRANCE | **unhandled**; its `icon` is empty | [108] | | no |
| 8 | BULLET | `BulletEntity` (runtime) | | `soap_projectile` / `white_projectile` | |
| 9 | AMMO_PICKUP | `SoapPickup` / `WhitePickup` by `bodyLevel` | [109] soap, [110] white | `soap_pickup` / `white_pickup` | 5, 6, 7 |
| 10 | CAMERA_FLASH | `CameraFlashEntity` (runtime) | | `camera_flash` | |
| 11 | LUCY | `LucyLactobacillus` | [93] | `lucy_icon` | 1, 2, 8, 9, 10 |
| 12 | SANDY | `GoodMicrobe` | [99] | `sandy_icon` | none |
| 13 | PATTY | `GoodMicrobe` | [98] | `patty_icon` | 4 |
| 14 | STEVE | `GoodMicrobe` | [94] | `steve_icon` | 3, 5 |
| 15 | COLIN | `BadMicrobe` | [95] `colin`, [103] `super_colin` | `colin_icon` (**missing**) / `super_colin_icon` | none |
| 16 | SLARG | `BadMicrobe` | [101], [104] `super_slarg` | `slarg_icon` / `super_slarg_icon` (missing) | 6 |
| 17 | SLURM | `BadMicrobe` | [100], [105] `super_slurm` | `slurm_icon` / `super_slurm_icon` | 5, 6, 10 |
| 18 | IGGY | `BadMicrobe` | [97] | `iggy_icon` | 7, 10 |
| 19 | DONNA | `BadMicrobe` | [96] | `donna_icon` | 6 |
| 20 | MILK | `MilkGlassEntity` | [106] `milk_glass` | `milk_glass_icon` | 8, 9 |
| 21 | ANTIBIOTIC_PICKUP | `AntibioticPickup` | [112] | `antibiotic_pickup` | 10 |
| 22 | ANTIBIOTIC_BOMB | `AntibioticBombEntity` (runtime) | | `antibiotic_pickup` | |
| 23 | SUPERINFECTION | `SuperInfection` | [102] | `superinfection_icon` | 10 |

The "super_" variants map to the same type ids as the normal microbes (`TileDefinitionParser.as:98-106`). Unknown type strings become TILE (136-139).

**Creation** (`PlatformGame.as:408-533`): entity cells are processed in row order, then column order. Each gets a clip `attachMovie(movie, movie+"_r"+row+"_c"+col, depth, {_x,_y,type})` and a class instance.
- The dynamic particle index order is therefore: **player, then entities in row-major order**. This order decides collision event order (§4.6, §4.7).
- If a type matches no branch (7, 1 or 2), the stale `gameEnt` from the previous iteration is pushed **again** under a new `indexId`, because an AS2 `var` is function-scoped (526-527). This does not happen in played levels.

### 4.2 GameEntity scheduling (`GameEntity.as`)

- **Defaults**: `state = FALL (8)`, `thinkTime = 0`, `defaultThinkTime = 5`, `direction = RIGHT (1)` (LEFT = −1), `counter = 0`, `counterCeiling = 3`, `speed` undefined.
- **Think/advance**: each `advance()` does `thinkTime--`. If `thinkTime >= 0` it runs the state's "move" function; otherwise (thinkTime < 0) it runs the state's "think" function, which usually sets a new `thinkTime`.
- **`act()`** in subclasses also does `thinkTime--` for every event handled while on screen.
- **States** (`GameEntity.as:67-90`):

| State | Id |
|---|---|
| DEFAULT | 0 |
| TURN | 1 |
| DYNAMIC | 4 |
| IDLE | 5 |
| BE_LIFTED | 6 |
| SLIDE | 7 |
| FALL | 8 |
| BE_PHOTOGRAPHED | 9 |
| BE_KILLED | 10 |
| WALK | 11 |
| JUMP_START | 12 |
| JUMP_MID | 13 |
| JUMP_END | 14 |
| BE_FROZEN | 15 |
| BE_WASHED_AWAY | 16 |
| MUNCH | 17 |
| RUN | 18 |
| DIVE | 19 |
| STARE | 20 |
| FLICK_HEAD | 21 |
| BE_HIT | 22 |
| IGNORE | 23 |

Bespoke states use 100+.

### 4.3 Microbe AI (GoodMicrobe and BadMicrobe share it)

Constructor (`GoodMicrobe.as:18-39`, `BadMicrobe.as:22-43`):
- `speed = 10`, `lives = 1`, `hasBeenPhotographed = false`, `direction = RIGHT`, `physicsExcempt = true`;
- `slideTimer = slideTimerDefault = 10`;
- clip `idle`, `state = FALL`, `thinkTime = 0`;
- `colWidth = ceil(clip._width/50)`, `rowHeight = ceil(clip._height/50)`;
- `row`/`col` = the spawn cell.
- AS2 inserts an implicit `super()`, so the GameEntity defaults run first.

```
advance(): thinkTime--; think = thinkTime < 0
  if !isOnScreen: return []
  WALK:   think ? walkThink() : walk()
  IDLE:   think ? idleThink() : []
  FALL:   think ? fallThink() : fall()
  SLIDE:  slideTimer--; think ? slideThink() : slide()
  BE_PHOTOGRAPHED / BE_HIT: think ? (if !clip.midAnimation: snapAfterAnim(); emit FALL) : []
  BE_KILLED: think ? (if !clip.midAnimation: emit REMOVE; remove()) : []
  BE_WASHED_AWAY (bad only): think ? beWashedThink() : beWashed()
  DIVE (Lucy only): think ? diveThink() : dive()

// Two snap variants; they differ only in the direction rule:
snapAfterFallOrSlide(): direction = (x > prevX) ? RIGHT : LEFT       // equal -> LEFT (GameEntity.as:312-316,
                                                                      //   GoodMicrobe.as:232-236, BadMicrobe.as:264-268)
snapAfterAnim():        direction = (x > prevX) ? RIGHT : (x < prevX ? LEFT : direction)   // equal -> unchanged
                                                                      //   (bePhotographedThink / beHitThink)
both:  col = floor(x/50); row = floor(y/50); physicsExcempt = true; previousPosition = position

walk() (GameEntity.as:222-242): teleport(x + speed*direction); if crossed the column edge: col = nextCol

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
  else emit IDLE(defaultThinkTime = 5)

idleThink() (343-404): try the current direction, then the opposite:
  if safeToMove: emit WALK(dir)
  elif !onSolidGround(): emit FALL
  else: thinkTime = 5 (stuck; direction flips back)

safeToMove(colX, nextCol) (410-468):
  d = x - colX
  RIGHT: room = !(d + clip._width + speed > 50)        // uses the current art width, not the box
  LEFT:  room = d > speed
  if room: return onSolidGround()
  // otherwise it would enter nextCol: only ANCHOR cells are visible to this test
  for i in 0..rowHeight-1: if geometry[row+i][nextCol] exists: return false   // wall
  return geometry[row+rowHeight][nextCol] exists                               // floor

onSolidGround() (472-501):
  if !physicsExcempt: return the physics test in 3.4 (abs(dy) < 1.5 twice, using counter)
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

Behaviour in plain terms:
- **Spawn**: microbes start in FALL. The first think often finds "no ground", because tall microbes check their own lower cell. Physics is then switched on and they drop onto the floor. After landing (2+ still UPDATEs) they snap and go IDLE for 5 UPDATEs.
- **First patrol direction is LEFT**. A microbe that fell straight down has x == prevX, and the fall snap turns "equal" into LEFT. So every microbe's first patrol leg is leftwards, even though the constructor default is RIGHT.
- **Patrol**: they walk at 10 px per UPDATE. They turn at walls and at edges (no floor anchor in the next column), pausing an IDLE of 5 UPDATEs at each turn. They never jump, although some art has `jump_*` labels. They never chase the player.
- **Wide tiles**: microbes only see **anchor cells**, so they treat the non-anchor parts of wide tiles as void or no-wall. For example, a 250 px `toast_jam_obj` looks like a 1-cell platform. They may also walk into the art of big tiles, where the physics pushes them out.
- **Ground check precision**: the grid ground test uses `floor((y + clip._height)/50)`. It relies on `y + h` landing exactly on a multiple of 50 (twip-quantised sizes, 3 dp positions). **A port should use an epsilon.**
- **Pushing**: when pushed (COLLIDE), they SLIDE with physics on for at least `slideTimer` = 10 UPDATEs, then re-snap.
- **Off-screen**: off-screen microbes do not advance and do not react to events (`act` is gated on `isOnScreen`).

Microbe `act()` (`GoodMicrobe.as:115-212`, `BadMicrobe.as:126-244`):
- `THINK`, `WALK(dir)`, `IDLE(t)` and `FALL` set the state and animation (`walk`, `idle`, `fall`) and call `advance()`. There is no `fall` label in any microbe clip, so FALL keeps the current frame.
- `COLLIDE` is ignored in the states FALL, SLIDE, BE_PHOTOGRAPHED, BE_HIT and BE_KILLED (bad microbes also ignore it in BE_WASHED_AWAY; Lucy also in DIVE).

Otherwise:

| Microbe | Collided with | Result |
|---|---|---|
| Good | a `BadMicrobe` | Emit `BE_HURT(1)`, then SLIDE (physics on, `counterCeiling = 10`). |
| Good | anything else (player, bullet, other good microbe, milk) | SLIDE and clip `slide`. |
| Lucy | milk | DIVE instead (§4.7). |
| Bad | `GoodMicrobe`, `PlayerEntity` or `BulletEntity` | `washAway = (other is Bullet)`, emit `BE_HURT(1)`, SLIDE. |
| Bad | anything else | SLIDE. |

- `BE_HURT`: `lives -= 1`, clip `be_hit`, state BE_HIT. At `lives <= 0`:
  - good microbes emit `BE_KILLED` and play `be_killed`;
  - bad microbes emit `BE_KILLED` + `be_killed` if `!washAway`, otherwise `EVENT_BAD_MICROBE_WASH_AWAY` + `be_washed_away`.
- `BE_KILLED`: state BE_KILLED. Removal follows when the think fires and `midAnimation == false`.
- Wash away (bad only): physics and gravity exempt, state BE_WASHED_AWAY.
  - `beWashed()`: y −= 15 and alpha −= 5 per non-think UPDATE.
  - `beWashedThink()` runs every 6th UPDATE (`thinkTime = 5`). When alpha ≤ 0 it emits `REMOVE`, calls `remove()` and emits `BE_KILLED`, which is what scores and counts the kill.
  - The microbe rises about 300 px over about 24 UPDATEs.
- `BE_PHOTOGRAPHED`: first time only. Sets `hasBeenPhotographed`, state BE_PHOTOGRAPHED, clip `be_photographed`, `thinkTime = 5` and physics exempt. When the animation ends it re-snaps and falls.
- `remove()`:
  - good microbes: exempt, `isOnScreen = false`, clip hidden (`GoodMicrobe.as:391-403`);
  - bad microbes: the same, plus the body is moved to (−100,−100) (`BadMicrobe.as:451-464`).
  - For dynamic entities the game's `REMOVE` then removes the clip and nulls the entity.

### 4.4 Good microbes

All good microbes use `GoodMicrobe` except Lucy, who uses `LucyLactobacillus`. Lucy (11) adds the milk dive. Sandy (12), Patty (13) and Steve (14) are plain `GoodMicrobe` with type ids for goals and the ePhone image.

Frame-script timings (25 fps; `midAnimation` spans, platformer SWF):

| Clip | be_photographed | be_hit | be_killed | Notes |
|---|---|---|---|---|
| lucy_icon (774) | 50-63 (14 f) | 80-96 (17 f) | 115-141 then stop | `dive` 200-254; walk loops at 175 |
| steve_icon (337) | 61-74 | 91-103 | 126-151 then stop | Frame 1 does `gotoAndPlay("steve_idle")`, a label that does not exist |
| patty_icon (850) | 95-112 | 65-78 | 130-158 then idle | `stare` 166-193 unused |
| sandy_icon (890) | 61-74 | 91-101 | 126-151 then `stop` | Also jumps to `steve_idle` |

### 4.5 Bad microbes

`BadMicrobe` covers Colin (15), Slarg (16), Slurm (17), Iggy (18) and Donna (19).

| Clip | be_photographed | be_hit | be_killed | be_washed_away |
|---|---|---|---|---|
| slurm_icon (988) | 61-74 | 91-103 | **no `midAnimation`** (label at 126, loops to `stop`), so removal is immediate | 295+ loops |
| slarg_icon (942) | 61-74 | 91-101 | 126-151 | 240+ loops |
| iggy_icon (712) | 110-130 | 70-82 | 156-186 then idle | 50+ loops |
| donna_icon (562) | 50-66 | 115-128 | 150-178 then idle | 210+ loops |
| super_colin_icon (488) | 85-104 | 135-147 | 180-210 then stop | 247+ |

Colin in its normal form cannot be spawned (`colin_icon` missing). No played level uses Colin.

### 4.6 Interaction matrix

| A touches B | Outcome |
|---|---|
| Player + bad microbe (lives > 0), player not hurt | The player loses 1 life and gets 480 ms of no control and no damage. **If the microbe is IDLE or WALK**, it gets BE_HURT, is **killed** (not washed), scores +5 and counts for KILL_ALL. If it is FALL, SLIDE, BE_PHOTOGRAPHED, BE_HIT, BE_KILLED or BE_WASHED_AWAY, it ignores the contact and survives. It then hurts the player again every time the 480 ms hurt state ends while they are still touching. |
| Player (already hurting) + bad microbe in IDLE/WALK | The microbe is still killed (+5). The player is unharmed. |
| Player + superinfection | The player is hurt each time the hurt state ends while still touching. The superinfection is unaffected. |
| Player + good microbe | The microbe SLIDEs and is pushed with physics. This is the "push Lucy" mechanic. |
| Player + milk / superinfection | Pushed physically. Both float (gravity exempt). |
| Bullet + bad microbe | The bullet splats. The microbe is **washed away** (+5 when it finishes fading; counts for KILL_ALL). The +3 is dead code. |
| Bullet + good microbe | The bullet splats. The microbe slides and is not hurt (`hurtGood` is never read). |
| Bullet + superinfection / milk | The bullet splats. No effect. |
| Good microbe + bad microbe (both in IDLE/WALK) | **Both die**: good −10, bad +5 (kill, not wash). |
| Lucy + milk | §4.7. |
| Flash + microbe | Photo (§3.6). |
| Antibiotic explosion | §3.7. |

The event order is always `COLLIDE(lower index)` then `COLLIDE(higher index)`. The player (index 0) is always first.

### 4.7 Milk glass and yoghurt (`MilkGlassEntity.as`, `LucyLactobacillus.as`)

- **Body**: milk (20) is a dynamic 150x200 box with gravity exempt, `maxChangeExcempt`, physics on and `state = WHITE_STATUS (100)`. Its clip is stopped. `counterCeiling = 1` and `counter = 0`, so **one Lucy contact is enough** (`MilkGlassEntity.as:22-33`).
- **Movement**: it floats and can be pushed. After a push it keeps creeping at about 1 px/step until a tile stops it (§2.2). Once it has been off-screen it stays physics-exempt (§1.6).
- **Milk `COLLIDE` with type LUCY** whose state is not DIVE: emit `MILK_GLASS_EVENT_HIT` (64-72). When that is handled in WHITE_STATUS:
  - clip `tickle`; `counter++`;
  - if `counter == counterCeiling`, emit `MILK_GLASS_EVENT_TURN_TO_YOGURT` (goal +1, +50 points);
  - state FLASHING (101); +10 points (73-93).
- **FLASHING, animation done**: once `midAnimation == false` (tickle frames 20-49 = 30 frames, 1.2 s), go to YOGURT_STATUS (102) and play clip `yogurt` (35-58). The clip's own `finished` flag is never set by code.
- **Lucy `COLLIDE` with MILK** while she is IDLE or WALK (in any other state she ignores collisions): physics exempt, `isDynamic = false`, state DIVE, clip `dive`.
  - `dive()`: alpha −= 5 per non-think UPDATE.
  - `diveThink()` every 6th UPDATE: when alpha ≤ 10, emit `REMOVE`, call `remove()` and set state IGNORE (`LucyLactobacillus.as:145-175,208-228`).
  - Because `isDynamic` is now false, the game's `REMOVE` does not null her. She stays as an invisible box (§2.7).
- **Order dependence**: both COLLIDEs come from the same contact, and the lower dynamic index is handled first.
  - If Lucy's index is lower and she is walking or idle, she dives before the milk sees her. The milk then ignores her, because she is in DIVE, and **no yoghurt is made**.
  - If Lucy is being **pushed** (SLIDE), she ignores the contact. The milk registers it and turns to yoghurt; Lucy dives later, once she is idle and still touching.
  - If the milk's index is lower, the hit always registers.
  - Level 8: milk at (4,17) and Lucys at rows 0-1. The Lucys have lower indices.
  - Level 9: milk at (4,2), (4,28), (4,50); Lucys at rows 1, 2 and 5.
- A glass in YOGURT or FLASHING ignores further hits.

### 4.8 Superinfection (`SuperInfection.as`)

- **Body**: type 23, a dynamic 409x195 box with gravity exempt, physics on and `maxChangeExcempt`.
- **State**: `state = IDLE`, `lives = 6`, `hitTimes = 0`, clip `idle_1`.
- **No AI**: `advance()` never "thinks" (the think code is commented out at 43-47). So `beHitThink` and `beKilledThink` never run.
- **Only `BE_HURT` is handled** (88-105). It comes only from antibiotic explosions:
  - `lives--`; `clip.lives = lives`; `hitTimes++`;
  - if lives > 0: play `be_hit_<hitTimes>`, or `be_killed` once `hitTimes > 3`. The clip script at the end of `be_killed` returns to `idle_4` while `clip.lives > 0`, so hits 4 and 5 are fake deaths. State BE_HIT;
  - at 0 lives: state BE_KILLED, play `be_killed`. The clip then stops and hides itself.
- **It is never REMOVEd**. It stays an invisible solid box (it still pushes as "current", §2.7). Its `lives == 0` stops it hurting the player.
- **Soap and white blood cells do nothing** to it (the lesson: only antibiotics work).
- **Photo exploit**: it is a `Microbe`, so the flash can photograph it. Its `act` ignores `BE_PHOTOGRAPHED`, so `hasBeenPhotographed` stays false and **every flash that hits it gives +15**.

### 4.9 Pickups

`SoapPickup`, `WhitePickup` and `AntibioticPickup` are static bodies (`physicsExcempt = true`, not solid) in state IDLE.
- Each `advance()` does `clip.hitTest(player.clip)`, which compares bounding boxes, and emits `COLLIDE(target=pickup, [player])`.
- For ammo pickups, the game adds +7 and calls act: `REMOVE`, `ammo++`, `infiniteAmmo = true` if `ammo == maxAmmo`, `remove()` (state DEFAULT, clip removed).
- **Antibiotic pickups** are only taken when `has_antibiotic == false` (§3.7).
- **Which ammo pickup**: `bodyLevel` decides whether an ammo cell becomes `WhitePickup` or `SoapPickup` (`PlatformGame.as:468-472`). The clip is whatever the cell's icon says.
- Pickups never respawn.

### 4.10 Portal (`PortalEntity.as`)

- **Body**: static 103.6x163.8 box, state CLOSED (100), clip stopped. `portalId = entities.length` at creation (`PlatformGame.as:498`).
- **Opening**: `PORTAL_EVENT_OPEN` sets `clip.play()` and state OPEN (101). The symbol has one frame, so any visual change comes from its children. The ePhone background switching to `exit_status` is the reliable cue.
- **Entry check**: `advance` counts `thinkTime`; when it reaches ≤ 0, it checks and then sets `thinkTime = 10`, so it checks **every 10 UPDATEs**. If OPEN, and the distance from the portal's top-left to the player's top-left is under 100 px, and `clip.hitTest(player.clip)`, it emits `TRIGGER_LEVEL_END` (29-48).

---

## 5. Goals (`src/ebug/junior/Goal.as`)

### 5.1 Parsing and types

`new Goal(Number(goalType), microbeType, required)` (`MapBuilder.as:67`). `microbeType` and `required` stay **strings**. AS2 `==` coerces them, so `achieved == "3"` works.

| goalType | Constant | Counts on | Implementation |
|---|---|---|---|
| 0 | PHOTOGRAPH_SPECIFIC | `BE_PHOTOGRAPHED` with `target.type == microbeType` | `Goal.as:48-61` |
| 1 | PHOTOGRAPH_GOOD | `BE_PHOTOGRAPHED` of `GoodMicrobe`, **and also `BE_KILLED` of a `GoodMicrobe`** | 62-78, 114-127 |
| 2 | PHOTOGRAPH_BAD | nothing (unimplemented; default trace) | |
| 3 | PHOTOGRAPH_ANY | any `BE_PHOTOGRAPHED` (incl. the superinfection) | 79-90 |
| 4 | KILL_ALL | `BE_KILLED` of a `BadMicrobe`. **`microbeType` is ignored.** A second `case KILL_ALL` counting any death is unreachable. | 98-113, 128-139 |
| 5 | KILL_SPECIFIC | nothing (unimplemented) | |
| 6 | ANTIBIOTIC | each `EXPLODE_ANTIBIOTIC` (whatever it kills) | 153-164 |
| 7 | YOGURT | each `MILK_GLASS_EVENT_TURN_TO_YOGURT` | 141-152 |

Each counted event does `achieved++` and returns `MODIFY_GOAL_STATUS`, which ticks the next ePhone box.

### 5.2 Completion and the portal

- `isGoalMet()` is `achieved == required`, **equality, not ≥** (35-41).
- The game checks once per UPDATE, at the start. When all goals are met and the portal is CLOSED:
  - the goal is **popped** (`level.goals.pop()`);
  - the phone shows `exit_status`;
  - the portal opens (`PlatformGame.as:575-593`).
- Once the list is empty, later events update nothing.
- **Overshoot deadlock**: if two counted events land in one UPDATE and step past `required` (for example two washed-away microbes finishing on the same UPDATE when one kill was left), `achieved` skips `required` and the level can never complete. **Port**: use `>=`.
- **Antibiotic kills** call `kill()` and emit no `BE_KILLED`, so they never count for KILL_ALL or PHOTOGRAPH_GOOD.

### 5.3 Played levels

The rounds are `alpha_level1`→`2`→`3`→`4`→exit, `alpha_level5`→`6`→`7`→exit, `alpha_level8`→`9`→exit, the kitchen game, then `alpha_level10`→exit (`GameController.as:65-69`).

| Level | name | goal (type, microbeType, required) | Relevant entities | Feasible? |
|---|---|---|---|---|
| alpha_level1 | level1 | 0 PHOTOGRAPH_SPECIFIC, 11 (Lucy), 3 | 3 Lucy | yes |
| alpha_level2 | level2 | 1 PHOTOGRAPH_GOOD, 11, 3 | 3 Lucy | yes |
| alpha_level3 | level3 | 0, 14 (Steve), 3 | 3 Steve | yes |
| alpha_level4 | level4 | 0, 13 (Patty), 3 | 3 Patty | yes |
| alpha_level5 | level5 | 4 KILL_ALL, (17), 3 | 4 Slurm, 1 Steve, 15 soap | yes |
| alpha_level6 | level6 | 4 KILL_ALL, (17), 3 | Slarg, Donna, 2 Slurm, 17 soap | yes |
| alpha_level7 | level7 | 4 KILL_ALL, (17), 3 | 3 Iggy, 21 WBC | yes (all three) |
| alpha_level8 | level8 | 7 YOGURT, (17), 1 | 4 Lucy, 1 milk | yes |
| alpha_level9 | level9 | 7 YOGURT, (17), 3 | 6 Lucy, 3 milk | yes |
| alpha_level10 | level10 | 6 ANTIBIOTIC, (17), 6 | 6 antibiotic pickups, superinfection, Slurm, Lucy, Iggy | yes; all 6 must explode **on screen** |
| alpha_level11 (unused) | level11 | 4 KILL_ALL, 6 | only 5 bad microbes (2 Iggy, Donna, 2 Slurm) | **no** |

### 5.4 goalType 0 vs 3 (documentation contradiction)

The documentation says level 1 uses goalType 3 (`docs/junior-game-documentation.md:280`), but `levels/alpha_level1.xml` has `goalType="0"` with `microbeType="11"`.

The code settles it in favour of 0:
- 0 is PHOTOGRAPH_SPECIFIC, and it only counts Lucys (`Goal.as:48-50`).
- `CREATE_GUI` draws the camera icon and `lucy_image` for type 0 with microbe 11 (`PlatformGame.as:337-341`).
- With 3, the GUI would fall to the `else` branch and draw `slurm_image` with `kill_icon` (355-358).

Level 1 contains only Lucys, so counting would be the same either way, but only 0 gives the correct HUD.

---

## 6. Tiles and level data

### 6.1 How a level XML becomes a level (`MapBuilder.parseXML`, `MapBuilder.as:44-121`)

- **Level attributes used**: `name` (the ePhone intro label), `next`, `rows`, `cols`, `body_level`, `id`.
  - `bodyLevel = (body_level == "false") ? false : true`, so **a missing attribute means true** (49). Levels 1-4 have none, which makes them "body" levels that shoot white blood cells.
  - Levels 5 and 6 set it to false (soap). Levels 7-10 set it to true.
- **Children** are read by position: `childNodes[0]` goals, `[1]` tiles, `[2]` rows (56-58).
- **The level's own `<tiles>` block is ignored entirely.** `level.tiles` is rebuilt from `tilesList`, which is `tile_definitions.xml` in file order, minus ERASER entries (the eraser is last, so indices do not shift) (71-82).
  - `Tile.movie` is taken from the definition's **`<icon>`** field, not `<movie>`. So the runtime linkage names are `lucy_icon`, `portal_exit_icon`, `milk_glass_icon` and so on.
  - `sides` is set to an empty array. `rows` and `cols` are forced to 1. `entity` and `script` are never read.
  - **There are no one-way platforms**: the "can jump under them" defaults (`MapBuilder.as:205-211`) were never implemented.
- **Rows**: `<row id=r><column id=c><tile id=t/>` means cell (r,c) holds tile definition `t`. If that definition is type TILE (1), it goes to `levelDataGeometry[r][c] = t`. Otherwise it goes to `levelDataEntities[r][c] = t`. `player_start` also sets `uniqueItems[PLAYER] = (c, r)`, and the last one wins (95-113).
- Row 0 is the top row. Missing cells are empty.

### 6.2 Tile definitions (`levels/tile_definitions.xml`, parsed by `TileDefinitionParser.as:53-146`)

| Indices | Group |
|---|---|
| 0-13 | Kitchen floor tiles |
| 14-27 | Food |
| 28-38 | Units and yoghurt |
| 39-69 | Body |
| 70-92 | Skin |
| 93-105 | Microbes |
| 106 | Milk |
| 107/108 | Portals |
| 109/110 | Soap / white pickup |
| 111 | Player start |
| 112 | Antibiotic pickup |
| 113 | Eraser |

Index 69 has empty strings (an empty tile).

Type strings map as follows: `tile`, `steve`, `lucy`, `colin`, `donna`, `iggy`, `patty`, `sandy`, `slurm`, `slarg`, `super_*`, `portal`, `entrance_portal`, `soap_pickup`, `white_pickup`, `player_start`, `eraser`, `milk_glass`, `antibiotic_pickup` and `superinfection` go to their constants. Anything else becomes TILE (67-140).

### 6.3 Tile geometry: multi-cell tiles DO exist

Every tile is one grid cell (the anchor = its top-left) in the data. Its physics box and art, however, use the **clip's size**. The clips come from the shared library `movies/junior_game_assets.swf`, which the platformer imports as `shared_library_link`.

Sizes other than 50x50:

| Size | Tiles |
|---|---|
| 50x200 | loaf_* [14-19], splinter is 50x250 [88] |
| 100x200 | pepper [20], salt [21] |
| 250x50 | toast_jam [26], toast_marm [27] |
| 150x150 | yoghurt_lid [37], yoghurt [38] |
| 100x150 | acid_pit_start/end [39,41]; acid_pit_mid is 100x148 [40] |
| 100x100 | bone_start/end [42,44], villi_floor/roof [70,71], hair_slope_start [74], spot_large/ooze [89,90], wart [92] |
| 50x100 | bone_mid [43], flesh_gristle_4 [52], hair_base [72] |
| 100x50 | flesh_gristle_3 [51], platform_mid [60], hair_slope/hair_slope_end/hair_horiz_end [75,76,78], plaster_multi_mid [82] |
| 200x50 | plaster_singular [80] |
| 150x50 | plaster_multi_start/end [81,84] |
| 200x100 | scab [85] |

All others are 50x50. "Slope" tiles are plain rectangles.

This contradicts `docs/junior-game-documentation.md:337`, which says tiles are single-cell. The `<rows>`/`<cols>` fields are unused, but the art size is used.

### 6.4 World coordinates

- A cell (row, col) maps to world pixels (col×50, row×50), as the top-left.
- Every body's `position` is its top-left.
- Entity spawn = cell top-left. The body's size is the clip's frame-1 bounds; for the player it is 49x100 from the cell's top-left.
- Clip registration is assumed to be at the top-left, and most art has bounds starting near (0,0). The flash art and the white pickup are offset.
- Geometry physics is created for rows `0..rows-1` and cols `0..cols` inclusive. Render covers rows `0..rows-1`.

Out-of-range cells:
- level 3 has tiles at cols 45-46 with `cols=44`. They are drawn but have no physics, and they sit beyond the world's right bound (x = 2200) anyway;
- level 5 row 12 and level 7 row 10 are never drawn or solid;
- levels 2 and 3 declare `rows=11` but only use rows 0-8.

### 6.5 Played level summary

| Level | cols x rows | next | body_level | player start (row,col) | portal (row,col) |
|---|---|---|---|---|---|
| 1 | 69x9 | alpha_level2 | (true) | (1,6) | (5,56) |
| 2 | 44x11 | alpha_level3 | (true) | (4,3) | (5,36) |
| 3 | 44x11 | alpha_level4 | (true) | (2,2) | (4,41) |
| 4 | 69x9 | exit | (true) | (4,5) | (5,46) |
| 5 | 69x9 | alpha_level6 | false | (3,1) | (3,63) |
| 6 | 69x9 | alpha_level7 | false | (3,6) | (4,51) |
| 7 | 75x9 | exit | true | (3,5) | (2,71) |
| 8 | 37x9 | alpha_level9 | true | (2,3) | (1,31) |
| 9 | 64x9 | exit | true | (1,7) | (4,57) |
| 10 | 46x9 | exit | true | (3,3) | (2,37) |

---

## 7. Scrolling, camera, bounds

The decision is made at the end of each UPDATE (`PlatformGame.as:1028-1050`) and applied at the start of the next (605-612; `Game.as:56-69`).

```
p = player; dx = p.position.x - p.previousPosition.x
if p.clip._x + p.clip._width >= 450:  scrollRight = true;  scrollLeft = false; scrollSpeed = abs(dx)
elif p.clip._x <= 250:                scrollLeft = true;   scrollRight = false; scrollSpeed = abs(dx)
else:                                 scrollLeft = scrollRight = false
next UPDATE: if scrollLeft:  screenTopLeft.xPos -= scrollSpeed
             if scrollRight: screenTopLeft.xPos += scrollSpeed
             screenBottomRight.xPos = screenTopLeft.xPos + 800
```

- **What the test uses**: `clip._x` is the value from the **last render**. It includes the mirror offset: when facing left it is `pos.x - camX + 49`. `clip._width` is the avatar art width, which changes per frame.
- **Camera speed**: the camera moves exactly as far as the player moved last step, in the margin's direction. There is a one-step lag.
- **Wrong-way pan (sanity check)**: the `abs()` "sanity checks" (1033-1047) make the camera pan **towards the margin even when the player moves away from it**. Standing in the left zone and moving right pans the view left, so the player crosses the screen at twice their speed until screen x passes 250.
- **No clamp at the level edges**: the view can show negative world x or space beyond `cols*50`. Example: level 5 starts the player at x = 50, inside the left zone; any movement pans into negative x by about 100 px before settling. Only the static background shows there.
- **No vertical scrolling**: y is screen y, and the world is 450 px tall.
- **Bounds**: the physics bounds are x in [0, cols×50 − w] and y in [−100, 450 − h]. You cannot fall out of the world and there is no fall death: the bottom of the screen is a floor.
- **Off-screen freeze**: an entity whose clip leaves the screen stops being updated and loses physics (§1.6).

**Port advice**: reproduce the margin rule and the `abs(dx)` speed. Clamping the camera to [0, cols×50 − 800] is a reasonable, clearly flagged improvement, because nothing in the levels relies on seeing past the edges.

---

## 8. HUD and ePhone

### 8.1 Layout

Root timeline of `movies/introductionToMicrobes_platformer.swf`, frame 1-20 display list:

| Instance | Depth | Position (x,y) | Size | Purpose |
|---|---|---|---|---|
| (background, shape 1495) | 1 | 0,0 | 800x450 | Single static background for every level (no parallax, no per-level art in code) |
| `game` (PlatformGame) | 4 | 0,0 | | Container; tiles and entities are attached inside it |
| `avatar` | 6 | 40.9,116.9 | 50x100 placeholder | Holds the loaded `harry.swf`/`amy.swf`; moved by render |
| `ephone` (e_phone 1491) | 8 | bounds x 695.6-788.7, y 267.6-445.3 | about 93x178 | ePhone, bottom-right |
| `score` | 89 | 674.8,14.05 | 73x32.1 | 4 digit clips `thousands/hundreds/tens/units` at x 7.6/22.5/37.4/52.3, y 6.2. Each digit has labels `zero`,`one`..`nine` at frames 1,10..90 |
| `heart0/1/2` | 111/115/119 | x 655.85/699.35/742.85, y 71.7 | 24.2x23.3 | Lives |
| `antibiotic_held` | 123 | 671.15,104.5, scale 2.149 | 82.3x35.0 | Held antibiotic. Hidden at start (root frame 1) and on throw; **not reset between levels** |
| `timeLeft` | 125 | 333.95,17.5 | 104x21.9 | HTML dynamic text, Arial 16, black. Initial text "90"; set to `<b>N</b>` once per second |
| `talkie` | 127 | 8.7,305.4 | 739x143 | Hidden in the platformer (`PlatformGame.as:177`) |
| `whiteout` | 194 | 0,0 | 800x450 | Starts at alpha 0. Set to 100 on an antibiotic explosion; its `onEnterFrame` subtracts 10 per frame while > 0 (sprite 1500 script) |

- **Timer display**: the timer is not written when a level starts, so it shows "90" (or the previous level's last value) until the first second has passed.
- **Score display**: `updateScore()` splits the score into thousands, hundreds, tens and units with `Math.floor`. Negative scores display wrongly: −10 shows as "0990". Scores ≥ 10000 show "zero" in the thousands digit (`PlatformGame.as:1331-1372`).

### 8.2 ePhone (`EPhone.as`, sprite 1491)

**Frames**: `small` (2, stop), `grow` (10-29, sets `midAnimation`), `large` (30, stop), `shrink` (40-59), then back to `small`, and `message` (70, unused). In the large state it rotates to landscape and covers about x 41-773, y 30-414.

**Children**:
- `screen` (sprite 1483) holds the in-game `status` screen (attached as `screen1`, `PlatformGame.as:172-173`);
- `bigScreen` (sprite 1479, `level_intros`) holds the intro pages.

**`grow(name)`**: `gotoAndPlay("grow")`, `isLarge = true`, `bigScreen.gotoAndPlay(name)`, show `bigScreen`, hide `screen`. **`shrink()`** does the reverse (`EPhone.as:16-30`).

**Intro pages** (`bigScreen` frame scripts):
- Each page `stop()`s and starts an autoplay interval (40 ms polling, `waitTime = 5000` ms).
- Clicking the `invisible_button` or waiting 5 s calls `play()`, which goes to the next page.
- The last frame of each level's block sets `finished = true`. `STATE_INIT_DIALOGUE` then shrinks the phone and starts the clock.
- The documentation (`docs/junior-game-documentation.md:1116`) mentions only clicks.
- A new interval is created per page without clearing the previous one, so clicking fast can make later pages skip.

Intro text by level:

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

There is no `level11` label. The typos are original ("with out", "Bodys", "isnt'", "Pennicilium", "defenses"/"defences"). Pages are separated by " / ".

### 8.3 In-game status screen (`status`, sprite 289, 180x293)

**Layout**:
- `background` image at (14.65,15.2), 150.7x168.3;
- mode icon `mode` at (133,6.3);
- six `tick_box_button` clips (`button1`..`button6`, 2 rows of 3 at y 199.3 and 249.4, x 16.45/70.45/124.5). Their labels are `grey`(1), `tick`(10), `cross`(20) and `empty`(30).

**CREATE_GUI** (`PlatformGame.as:331-362`) sets `nextButton = 1` and picks the images from `goals[0]`:

| Goal | Background | Mode icon |
|---|---|---|
| PHOTOGRAPH_GOOD | `lucy_image` (always Lucy) | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, Lucy 11 | `lucy_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, Steve 14 | `steve_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, Sandy 12 | `sandy_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, Slarg 16 | `slarg_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, Slurm 17 | `slurm_image` | `camera_icon` |
| PHOTOGRAPH_SPECIFIC, **Patty 13** | **no branch**: the default `background` stays (level 4) | `camera_icon` |
| YOGURT | `milk_image` | none |
| ANTIBIOTIC | `superinfection_image` | none (the `antibiotic_icon` export is unused) |
| anything else (KILL_ALL) | `slurm_image`, even in the Iggy level 7 | `kill_icon` |

- The first `required` boxes are set to `empty`; the rest stay `grey`.
- Each `MODIFY_GOAL_STATUS` ticks the next box. `cross` is never used.
- When the goal is met, the background becomes `exit_status`.

---

## 9. Level complete, game over, restart and hand-off

### 9.1 Cleanup and transition (`PlatformGame.as:1169-1250`)

Both LEVEL_COMPLETE (portal or the Home/Alt cheat) and GAME_OVER (timer or death) run this:

1. Remove the cell clips for rows `0..rows-1`, cols `0..rightMostColumn+1`.
2. Empty the static and dynamic particle arrays and the ball arrays.
3. Remove `ePhone.status`.
4. Reset `playerClip._xscale = 100`, then `delete entities[0]`. This protects the avatar clip from removal.
5. Pop and remove every other entity clip.
6. `Key.removeListener`.
7. If `level.next == "exit"`: `exitReason = END_REASON_COMPLETE (2)` and `gameState = GAME_OVER`.
8. If GAME_OVER: `_root.endofHoverboard(exitReason)`. Otherwise `initialiseGame(player, level.next, tilesList)`.

`tiles`, `cells` and `staticEntities` are not cleared. This is harmless because every level uses the same tile ids.

### 9.2 GameController

| Exit reason | Summary page text | Next step | Lines |
|---|---|---|---|
| END_REASON_DIE (1) | text0 "You Died!", text1 "click to try again" | Clicking the button calls `restartHoverboardRound()` | `GameController.as:283-308` |
| END_REASON_TIME (0) | text0 "You ran out of time.", text1 "click to try again" | Same | same |
| END_REASON_COMPLETE (2) | none | Hide the platformer, show the game show, call `gameShow.startNonBlindRound()` | same |

- **The summary page** (`movies/summary_page.swf`) has `text0` at (82,21.9), `text1`..`text4` below it, and `click_button` at (292.2,351.9), 218.6x78.9. The button's `onRelease` calls `callObj[callFunc]()`.
- **Restart** calls `restartRound()`, which is `initialiseGame(roundStartPlayer, roundStartLevel, ...)` (`PlatformGame.as:187-192`). `roundStartLevel` is only set in `nextHoverboardRound()` (`GameController.as:249-255`). So **dying or timing out on any level restarts the round from its FIRST level**: dying in level 3 sends you back to level 1.
  - The score is kept.
  - Lives and time reset.
- **Rounds** (`GameController.as:206-263`):
  - The first hoverboard round plays the root timeline. `initialiseGame(player, level, ...)` receives `level` undefined, so the default `"alpha_level1.xml"` applies (`PlatformGame.as:133`).
  - Later calls do `round++` and load `hoverboardLevels[round]`.
  - `showHoverboardOrKitchen` sends round index 2 to the kitchen game.
  - The resulting order is level 1-4, level 5-7, level 8-9, the kitchen game, then level 10.
- **The platformer never writes its score** to `player.score` or to any tracking form.

---

## 10. Bugs, dead code, TODOs and documentation contradictions

Code bugs and quirks. "Port" gives the recommendation: F means keep faithful, X means fix.

| # | Issue | Port |
|---|---|---|
| 1 | Static broadphase uses the local index for `staticBoundingBalls` and `excemptionMatrix` (`ParticleSystem.as:583,586`). Big tiles are partly soft (5.5% of tile-top samples). | X: pure AABB |
| 2 | Dead or removed entities keep colliding as the "current" body (`ParticleSystem.as:409,433-435`). Dived Lucy (`LucyLactobacillus.as:160-161`, never nulled because `isDynamic=false`, `PlatformGame.as:889,901`) and the dead superinfection (`SuperInfection.as:36-76`) stay as invisible solid boxes. | X |
| 3 | `COLLIDE` +3 points branch tests `type == GAME_ENTITY_BAD_MICROBE` (5), which is never assigned (`PlatformGame.as:658`). | F: no +3. Or X with a flag, since the doc intends it |
| 4 | `BE_KILLED`/`BE_PHOTOGRAPHED` call `newEvents.concat(target.act(e))` and discard the result (`PlatformGame.as:940,963`). Any follow-up events from those `act` calls are lost. | F (the current acts return nothing important) |
| 5 | `Goal.isGoalMet` uses `==`, so overshoot can deadlock a level (`Goal.as:36`). | X: `>=` |
| 6 | PHOTOGRAPH_GOOD also counts good-microbe *deaths* (`Goal.as:114-127`). Unreachable duplicate `case KILL_ALL` (128-139). PHOTOGRAPH_BAD and KILL_SPECIFIC are unimplemented. | F |
| 7 | `EXPLODE_ANTIBIOTIC` pushes `goalevents.pop()` even when it is empty, which puts `undefined` in the queue (`PlatformGame.as:874-879`). | X: guard |
| 8 | The superinfection never thinks, so it is never removed (`SuperInfection.as:43-47`). Photographing it is infinitely repeatable for +15 (it is a Microbe whose act ignores the photo; `CameraFlashEntity.as:79-88`, `PlatformGame.as:971`). | X: at least stop the point farming |
| 9 | A flash targets the first overlapping microbe even if it has already been photographed, which wastes the shot (`CameraFlashEntity.as:79-88`). | F |
| 10 | Flash, bullet and bomb clips are placed at WORLD x until the next render (`ParticleSystem.as:204-205`). This is harmless because spawned entities start with `isOnScreen = false` and do not advance until a render has positioned them (`GameEntity.as:103`, `PlatformGame.as:621`). | F: render, then test |
| 11 | Lucy/milk result depends on dynamic index order (§4.7). | F, but make sure pushed Lucys work |
| 12 | Camera: no edge clamp, and it pans towards the margin even when the player moves away from it (`PlatformGame.as:1033-1047`). | F (clamp optional) |
| 13 | `bodyLevel` defaults to true when the attribute is missing (`MapBuilder.as:49`), so levels 1-4 throw white blood cells in the kitchen and on the hand. | F |
| 14 | `infiniteAmmo = true` from the start (`PlayerEntity.as:124`). Ammo pickups only give points. | F |
| 15 | `colin_icon` and `super_slarg_icon` linkages are missing. `PORTAL_ENTRANCE` is unhandled and causes a stale `gameEnt` double push (`PlatformGame.as:419,526-527`). | X: skip unknown or missing |
| 16 | Patty has no ePhone image (`PlatformGame.as:340-350`). KILL_ALL always shows Slurm (356). | F, or add `patty_image` art if it exists |
| 17 | `antibiotic_held` HUD is not reset per level (`PlatformGame.as:126-185`), while `has_antibiotic` is. | X |
| 18 | Timer shows "90" or a stale value during the intro, and "-1" at the end (`PlatformGame.as:558-569`; the initial text lives in the SWF). | X: show 180 at start |
| 19 | Negative or ≥10000 score renders wrongly (`PlatformGame.as:1331-1346`). | X |
| 20 | Double-jump dead press (`PlayerEntity.as:180-184,418-419,432`). | F |
| 21 | Microbe AI sees only anchor cells, so wide tiles look like voids (`GameEntity.as:431-465`). The `walkThink` LEFT branch reuses the right-edge test (275). | F |
| 22 | `onSolidGround` exact floor arithmetic (`GameEntity.as:488-497`). | X: epsilon |
| 23 | Intro autoplay intervals stack when you click quickly (bigScreen frame 1 `startAutoplay`). | X |
| 24 | Avatar `upper`/`lower` read in the constructor, which races the async `loadClip` (`PlayerEntity.as:108-109`, `PlatformGame.as:165-169`). | n/a |
| 25 | Offscreen entities with bespoke states never regain physics (`PlatformGame.as:1154-1158`). This affects the milk glass. | F (rarely visible) |
| 26 | Event id clashes: 50/51 are reused by the portal, the milk and the bad microbe (§1.7). | X: namespace |
| 27 | `levelTileArray` is sized 9x16 from the default bounds (`ParticleSystem.as:166-181`). Static entities at row ≥ 9 are lost. | X: size from the level |
| 28 | A second `player_start` nulls `levelDataGeometry[old]` (`MapBuilder.as:107`), wrongly, because the start is in the entity grid. | n/a |
| 29 | Colliding `SLIDE`-state microbes ignore contacts, so a pushed bad microbe cannot hurt the player or good microbes while sliding. | F |
| 30 | `Home` and `Alt` skip the level (debug cheat) (`PlatformGame.as:1287-1290`). | Keep behind a debug flag |
| 31 | **Perpetual horizontal creep.** `Vector3.equals` snaps x to 0.1 px (`Vector3.as:61`, called at `PlatformGame.as:1017`), and `add` rounds to 3 dp. Together they make every x velocity from −0.9 to +1.0 px/step a fixed point of the drag. Coasting bodies (the player, and the pushed milk or superinfection) settle at +1.0 or −0.9 px/step and never stop until something blocks them (§2.2). | F by default, since it is part of the original hoverboard feel. A clearly flagged fix would zero abs(vx) < 1.05 when no key is held. |
| 32 | The first patrol leg of every microbe is leftwards. After falling straight down, the fall snap maps "no x movement" to LEFT (`GameEntity.as:312-316`). | F |
| 33 | A bad microbe in FALL, SLIDE, BE_PHOTOGRAPHED or BE_HIT ignores contact, but still hurts the player, so it can hurt repeatedly without dying (`BadMicrobe.as:170-172`, `PlayerEntity.as:233-243`). | F |

Dead code and TODOs:
- `JUMP_COUNT` and its TODO (`PlatformGame.as:51-53`).
- `accelerationSpeed` and the commented jump and acceleration code (48, 111-114).
- The tractor beam (`PlayerEntity.as:200-223,284-314,472-495`) and `UPPER_THOW_WHITE_BLOOD`/`BE_LIFTED` (338-348).
- `FAKE_KILL_SUPERINFECTION`, `KILL_SUPERINFECTION`, `LAND` and `SLIDE` events.
- `PORTAL_EVENT_CLOSE`, `weight`, `infiniteLives`, sticks (`createStick*`) and `ParticleSystem.removeEntity`.
- `STATE_FIND_LEVEL`, `SuperBug.as`, `PlayerTile.as` and the APE library.
- The FPS and `mainTimes` instrumentation and the `trace` calls throughout.
- The "TODO should come from level def" at `PlatformGame.as:263`.
- The "hack todo" at 1064.
- `levelTileArray` "infiniwobble" rounding comments.

Documentation versus code:
- **15 ms loop**: confirmed (SWF frame 20).
- **Level 1 goalType is 3** (doc :280): wrong. It is 0 (§5.4).
- **"<rows>/<cols> must be 1; tiles are single-cell"** (:337): the fields are unused, but tiles are multi-cell by art size (§6.3).
- **"<sides> has no functionality"** (:335): true. The whole level `<tiles>` block is ignored and ids index `tile_definitions.xml` (:351 implies the level's own block is used).
- **"invisible box ... defined by cols and rows"** (:263): only `cols` is used; the height is fixed at 450 and the top is −100.
- **"Every level has 9 rows"** (:345): levels 2 and 3 declare 11.
- **"one or two columns of tiles are loaded on either side"** (:805): the loop spans −6..+1 columns, but off-screen cells are removed at once, so only visible tiles exist or collide.
- **"+3 when a bullet hits a bad microbe ... microbe removes itself"** (:1234): the branch never fires. Bullets wash microbes away through the microbe's own COLLIDE handling.
- **"the ammo will remove itself"** (:1226): true, but pickups are detected by `hitTest` in `advance`, not by the physics system.
- **"a microbe will ... decide whether it is safe to move for 10 loops"** (:1183): think time is computed per move and is 5 for idle (`GameEntity.as:48`).
- **"level intro ... listens for clicks"** (:1116): it also autoplays every 5 s.
- **"MAX_JUMPS/JUMP_COUNT used for double jumping"** (:820): only `MAX_JUMPS` is used.
- **"dynamic entities are always drawn"** (:977): they are positioned every render, but off-screen ones stop updating and lose physics.

---

## 11. Unverified or assumed

- **Interval cadence**: the real rate at which Flash Player 8-10 fired `setInterval(15)` in a 25 fps SWF inside a browser. Nominal 15 ms and a 30 ms effective step are assumed. A Ruffle capture (`tools/ruffle/`) could measure it.
- **`isNaN(" ")` in AS2 (SWF 8)**: the code treats `" "` as an empty cell (`PlatformGame.as:309`), and either reading leads to "no tile".
- **Clip dimensions** come from static SWF bounds of the frame-1 display list, computed without twip rounding. Flash's `_width`/`_height` are twip-quantised (0.05 px) and change per animation frame. Box sizes use the values at creation.
- **Frame-script timing**: when `gotoAndPlay` frame scripts run relative to the same interval tick. This affects the `midAnimation` and `shoot` flags by at most one tick.
- **Portal opening visuals** (the one-frame symbol; its children were not inspected).

---

## 12. Unity remake differences (secondary; do not port)

From `reference/analysis/unity-logic.md`:

| Topic | Unity remake | Source |
|---|---|---|
| Level timer and game over | None; losing restarts the level | `unity-logic.md:88,121` |
| Keys | Ctrl = photo or antibiotic; Space = throw; jump on Up only | `unity-logic.md:143-146` |
| Double jump | None | `unity-logic.md:172` |
| Invulnerability | 2 s | `unity-logic.md:125` |
| Pickups | Respawn after 5 s | `unity-logic.md:127` |
| Level set and goals | Differ | `unity-logic.md:90-104` |

The Flash values in this document take precedence.
