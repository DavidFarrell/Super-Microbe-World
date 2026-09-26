# Unity remake (2013-14): logic and data reference

**Status of this source:** SECONDARY. The 2009 Flash game is canonical. This file records what the Unity/UnityScript remake in `Assets/` actually does, so the two can be compared. It does not say what the port should do.

**Scope read:** every `Assets/Scripts/**/*.js` (48 files, ~5.3k lines including the embedded XML strings), all 13 `Assets/Scenes/*.unity`, `ProjectSettings/*.asset`, the prefabs in `Assets/Prefabs/**`, texture `.meta` import settings, and the text/XML under `Assets/Resources/`.

**Citations:** `File.js:NN` means `Assets/Scripts/File.js` (or `Assets/Scripts/GameShow/…` / `Assets/Scripts/Quiz/…` where the name is unambiguous). Scene and prefab values come from parsing the YAML. The parser is saved at `reference/analysis/tools/unity_scene.py` (see §10).

**Derived physics numbers** assume Unity 4.3 Box2D behaviour. `AddForce` uses the default `ForceMode2D.Force`, and a force added in `Update` is applied for one fixed step (`Fixed Timestep: 0.02`, `ProjectSettings/TimeManager.asset`). So Δv = F·0.02/mass. Global 2D gravity is **(0, −30)** (`ProjectSettings/Physics2DSettings.asset`). These values are derived from that assumption and were **not measured at runtime**.

---

## 1. Scene flow and order

### Build settings (`ProjectSettings/EditorBuildSettings.asset`)
The build order is: 0 `gameShow`, 1 `kitchen1`, 2 `skin1`, 3 `skin2`, 4 `kitchen2`, 5 `gameShow_quiz`, 6 `skin11`, 7 `skin12`, 8 `body11`, 9 `kitchen31`, 10 `kitchen32`, 11 `superinfection`, 12 `gameShow_game_end`. All 13 are enabled.

Every quiz round uses the single `gameShow_quiz` scene.

### State machine (`GameLogic.js`)
- A `GameLogic` prefab instance lives in `gameShow.unity` and is marked `DontDestroyOnLoad` (`GameLogic.js:60`). It carries `GameLogic.js`, `Goals.js` and `DBconnector.js`.
- Every other scene holds an **inactive** copy of `GameLogic` for editor testing. Because `GameObject.Find` ignores inactive objects, playing any scene other than `gameShow` directly gives null references. The file warns about this at `LevelLogic.js:59-65`.
- The `GameLevel` enum (`GameLogic.js:26`) lists these states in order:

  `gameShow, gameShow_quiz1b, kitchen1, skin1, skin2, kitchen2, gameShow_quiz1, gameShow_quiz2b, skin11, skin12, body11, gameShow_quiz2, gameShow_quiz3b, kitchen31, kitchen32, gameShow_quiz3, gameShow_quiz4, gameShow_quiz5b, superinfection, gameShow_quiz5, gameShow_game_end`

  The `…b` states are blind rounds. `gameShow_quiz3` is never used.
- `NextLevel()` (`GameLogic.js:108-197`) advances only when `goals.GoalsAchieved()` is true. Otherwise it logs a message and shows nothing to the player (`:193-196`, "TODO Show a message").
- `ChangeLevel()` (`:199-226`):
  - Any state named `gameShow_quiz*` (14 or 15 characters) loads the scene `"gameShow_quiz"`.
  - Any other state loads the scene with the enum's name.
  - There is a web-streaming fallback (`updateProgress`, `:228-237`) that shows "Loading... N". The quiz branch calls `level.ToString("gameShow_quiz")` instead (`:213`), which does nothing, so a quiz scene that is not yet streamed never loads.
- The **quiz round number** is set on exit from a state (`:114-186`):

  | Exit from | Round number set |
  |---|---|
  | `gameShow` | 1 |
  | `gameShow_quiz1` | 2 |
  | `gameShow_quiz2` | 3 |
  | `gameShow_quiz4` | 5 |

  **Round 4 ("Food Hygiene") is never played.** Comments at `:26`, `:157` and `:172` say it belongs to the fridge-sorting kitchen game, which was not implemented. `gameShow_quiz4` is therefore really round 3; the comment at `:172` admits the name is wrong.
- **Blind rounds are ON by default.** `ShowBlindRounds: 1` is set on the GameLogic prefab and in `gameShow.unity`. Pressing **W** toggles it at any time and shows "Blind rounds enabled/disabled" for 2 s (`GameLogic.js:89-99`).
- `IsBlindRound()` (`:353-376`) returns true when blind mode is on and either the level name is 15 characters long (`gameShow_quizNb`) or the level is `gameShow`. `IsLastRound()` returns true only for `gameShow_quiz5` (`:383-386`).

**Default flow (blind ON):**
`gameShow` (host says "Thanks!", no shrink) → `quiz1b` (blind, round 1, then shrink) → `kitchen1` → `skin1` → `skin2` → `kitchen2` → `quiz1` (normal, round 1, no shrink) → `quiz2b` (blind, round 2, shrink) → `skin11` → `skin12` → `body11` → `quiz2` (normal, round 2) → `quiz3b` (blind, round 3, shrink) → `kitchen31` → `kitchen32` → `quiz4` (normal, round 3) → `quiz5b` (blind, round 5, shrink) → `superinfection` → `quiz5` (normal, round 5, last round so no shrink) → `gameShow_game_end`.

**Flow with blind OFF:**
`gameShow` (host "Step this way…", then shrink) → `kitchen1` → `skin1` → `skin2` → `kitchen2` → `quiz1` (round 1, shrink) → `skin11` → `skin12` → `body11` → `quiz2` (round 2, shrink) → `kitchen31` → `kitchen32` → `quiz4` (round 3, shrink) → `superinfection` → `quiz5` (round 5) → end.

The shrink rule lives in `LevelLogicQuiz.checkShrinkingZone` (`Quiz/LevelLogicQuiz.js:450-474`). The last round never shrinks. With blind mode off, every other round shrinks. With blind mode on, only the blind rounds shrink.

The screen-fitting default for the web player is **960×600** (`ProjectSettings.asset: defaultScreenWidthWeb/HeightWeb`). The standalone default is 1024×768.

**Other transitions:**
- Death calls `GameLogic.RestartLevel()`, which reloads the same scene (`:258-261`).
- **Q** in any platform level completes all goals and calls `NextLevel` (`LevelLogic.js:124-128`). This debug cheat is live in the shipped build.
- The `default:` branch that calls `Application.Quit()` (`GameLogic.js:187-190`) is never reached, because `LevelLogicFinal` loops forever.

---

## 2. Platform levels

### Common structure (`LevelLogic.js`)
Each level's root is a `base_level_<theme>` prefab. It holds the `LevelLogicXxx` script and these children: `level_start`, `main_camera`, `main_camera_LowerLeftEdge`, `main_camera_UpperRightEdge`, `ground`, `levelEnd` (the portal) and `bg`.

Awake (`LevelLogic.js:37-98`):
1. Instantiates `Prefabs/GUI/GUI.prefab`, parents it to `main_camera`, and names it "GUI(Clone)" (`:40-43`).
2. Instantiates `player_amy` or `player_harry` at `level_start`. The choice comes from `PlayerPrefs "player"`, defaulting to harry (`:80-93`).

Start (`:100-109`):
1. Sends the camera its target and bounds. The bounds are the positions of the two edge markers, and they clamp the camera **centre**.
2. Posts a "Level X loaded" track.
3. Calls `AddLevelGoals()`.
4. Each subclass then calls `ShowInfoLevel()`. This disables the player's controls and plays the phone briefing (§5). Controls come back in `ShowInfoLevelFinished()` (`:159-170`).
5. `SetPickups()` exists (`:139`), but every call to it is commented out in the subclasses.

### Goals system (`Goals.js`)
- Goals are stored in a matrix `counter[12,5]` (`Goals.js:22`).
- Rows are microbes: 0 lucy, 1 patty, 2 donna, 3 slarg, 4 slurm, 5 colin, 6 super_colin, 7 sandy, 8 steve, 9 iggy, 10 super_slurm, 11 superinfection (`:28-39`, `:175-213`).
- Columns are actions: 0 `"photo"`, 1 `"washed up"`, 2 `"white blood cell"`, 3 `"antibiotics"`, 4 `"thrown to yoghurt"` (`:214-232`).
- `SetGoals(m, a, n)` sets the target count and pushes the microbe icon and goal count to the phone (`:63-94`).
- `UpdateGoals(m, a)` decrements a cell only if it is above 0 (`:125-141`).
- The microbe name comes from the GameObject name with its first 2 characters removed, so `"00lucy"` becomes `"lucy"` (`Microbe.js:62-63`). The superinfection instance in the scene is renamed `11superinfection` so that this lookup works (the prefab is named `11super_infection`).
- `GoalsAchieved()` returns true once every cell is 0 (`:96-123`).
- **Winning a level** means achieving all goals and then touching the portal. `levelEnd` has `portal.js`: its trigger checks `tag == "Player"`, then calls `NextLevel`, then waits 1 s before it can check again (`portal.js:23-37`).
- **Losing** means life reaching 0, which restarts the level. There is no game over and no level timer. Platform performance never affects the quiz scores.

### Per-level table
World units throughout. A tile is 0.5 u (§10). Camera bounds are the clamp limits for the camera centre. Microbe scale and base stats come from prefabs (§4); only values the scene overrides are listed. "Pages" refers to `TextIntroLevelNoGaps00NN.png` (§5).

| Level | Goal (script:line) | Start → portal | Camera bounds LL / UR; follow margins x/y | Microbes (world x,y; overrides) | Pickups (all respawn after 5 s) | Other |
|---|---|---|---|---|---|---|
| **kitchen1** | photograph 3 lucy (`LevelLogicKitchen1.js:25`) | (−8.43,−0.44) → (65.75,−3.87) | (−1.68,−1.48)/(61.77,3.46); **0.5/1** | lucy (17.72,−4.60), (38.50,−2.44), (52.03,−4.56) [dive y-force 27000] | none | milk glass (33.72,−3.98). Yoghurt pots (−7.38,−3.96), which the player spawns above, and (71.55,−3.91), outside the camera bounds. Pages 1-7 |
| **skin1** | photograph 3 lucy (`LevelLogicSkin1.js:26`; the comment says "patty") | (−7.79,−0.47) → (65.83,−3.97) | (−1.10,−2.23)/(61.77,3.46); 0.5/2 | lucy (12.63,−1.65), (32.79,1.11), (53.36,−5.14); **enemies** super_slurm (38.95,−5.47), super_colin (43.52,−5.67), both with jump disabled | **none** (the `Pickups` root is empty), so the enemies can only be avoided | pages 8-9 |
| **skin2** | photograph 3 steve (`LevelLogicSkin2.js:26`) | (−7.91,−3.55) → (62.19,−4.01) | (−1.68,−2.15)/(70.84,5.77); 0.5/2 | steve (1.15,−5.19), (18.51,−5.19), (38.43,1.85, jumps), all speed 1.5 wait 1.5; sandy (22.30,1.18) good; slarg (38.98,−4.68) bad | soap (−0.95,−4.00), (14.82,−1.31); WBC (1.37,−4.01), (14.57,−4.62); **antibiotic** (4.01,−3.90), (10.46,−1.48) | Antibiotics kill steve (§4, §9). Pages 10-11 |
| **kitchen2** | photograph 3 patty (`LevelLogicKitchen2.js:26`) | (−8.43,−0.44) → (65.68,−3.96) | same as kitchen1; 0.5/2 | patty (17.83,1.99), (35.91,−4.66), (37.42,1.14) | antibiotic (4.01,−3.90), soap (5.18,−1.91), WBC (6.27,−4.36) | yoghurt pots (−7.38), (30.84), (71.55). Pages 12-13 |
| **skin11** | wash away 3 slurm (`LevelLogicSkin11.js:28`) | (−7.79,−0.47) → (65.53,−4.01) | (−1.10,−2.23)/(61.77,3.46); **2/2** | slurm (4.13,−5.53), (34.53,−5.46; speed 2, wait 0), (35.86,−2.98), (53.70,−5.43); none jump. steve (37.16,−5.17; speed 2, faces left, wait 0) | 10 soap: (−2.97,−4.86), (−0.87,−3.77), (7.39,−4.77), (23.63,−5.40), (31.23,−3.31), (39.79,−2.11), (40.83,−2.62), (41.88,−3.08), (42.97,−3.71), (45.88,−4.76) | pages 14-15 |
| **skin12** | wash away 3 slurm (`LevelLogicSkin12.js:27`) | (−7.79,−0.47) → (65.18,−3.99) | (−1.10,−2.23)/(61.77,3.46); 0.5/2 | slurm (2.93,−1.27; jumps), (25.47,−1.19; speed 2, wait 0.1), (42.06,−5.45; wait 1), (54.86,−5.45; wait 0.1); steve (22.87,−0.90; speed 2); donna (59.30,−5.56) | 12 soap: (−3.92,−5.01), (−1.68,−1.62), (0.69,−0.97), (2.04,−1.23), (3.47,−0.90), (4.85,−1.27), (5.71,−5.45), (11.94,−3.70), (14.55,−3.06), (31.23,−3.53), (44.80,−4.87), (50.45,−4.78) | The briefing says "wash away **all** the bad microbes", but the goal is only 3 slurm. A stray `InGamePhone` sprite sits in the world at (3.14,−2.26). Pages 16-18 |
| **body11** | kill 3 iggy with white blood cells (`LevelLogicBody11.js:26`) | (−8.43,−0.44) → (65.45,−2.81) | (−1.68,−2.18)/(61.77,3.46); 0.5/2 | iggy (14.11,−4.09; jumps, wait 0.3), (28.94,−4.09; wait 0.4), (43.33,−3.45; jumps, wait 0.1) | antibiotic (4.01,−3.90), soap (5.18,−1.91), WBC (6.27,−4.36), (10.01,−3.89), (27.56,−0.04), (40.92,−3.20) | pages 19-22 |
| **kitchen31** | push 1 lucy into milk/yoghurt (`LevelLogicKitchen31.js:26`) | (−8.43,−0.44) → (66.10,−4.11) | same as kitchen1; 0.5/2 | lucy (1.45,−5.11), (2.02,0.34), (25.88,−0.36; wait 0.5) | none | milk glass (7.55,−3.23); yoghurt pots (−7.38), (21.52), (71.55). Pages 23-25 |
| **kitchen32** | push 3 lucy into milk (`LevelLogicKitchen32.js:26`; the comment says 2) | (−7.90,2.68) → (64.95,−3.06) | (−1.68,−1.48)/(61.77,**7.03**); 0.5/2 | lucy (6.59,0.26), (17.57,3.01), (30.04,4.89), (34.91,4.18); waits 0.3-0.7 | none | milk glasses (12.91,−0.85), (25.28,1.23), (38.18,0.64); yoghurt (71.55). A second `GUI` is baked under the camera (§9). Pages 26-27 |
| **superinfection** | kill 1 superinfection with antibiotics (`LevelLogicSuperInfection.js:28`): life 20 at 5 per dose, so **4 doses** | (−8.43,−0.44) → (66.29,−2.84) | (−1.97,−1.52)/(61.77,**−0.66**); 0.5/**3** | superinfection (30.75,−4.63), static; iggy (17.56,−1.42; jumps), (35.42,−3.86; faces left), (47.31,−1.72; jumps), (63.89,−3.32; jumps); slurm (37.33,−4.24; speed 0.2); steve (22.18,−4.56; speed 0.5, wait 5) | WBC (0.30,−3.53), (13.46,−3.92), (39.08,−2.91), (57.44,−3.04); **antibiotic** (19.26,−1.75), carry limit 1 | This is the only platform camera with `CameraShake`. Pages 28-33 |

**Design plan:** `Resources/TextFiles/plan2.txt` is the intended level list:

1. Photo 3 lucy (kitchen)
2. Photo 3 lucy (skin)
3. Photo 3 Staph (skin)
4. Photo 3 Patty (kitchen)
5. Kill 3 Slurm
6. Kill all bad (skin)
7. Kill all bad (iggy, body)
8. Make 1 yogurt (kitchen)
9. Make 2 yogurt (kitchen)
10. Kill superbug (body)

Unity differs in three places: level 6 is "wash 3 slurm", level 7 is "3 iggy", and level 9 is 3 yoghurts. `plan.txt` is an older 7-level version.

**Timers:** there is no level timer. The timed values are:

| What | Duration | Source |
|---|---|---|
| Player invulnerability after a hit | 2 s | `playerController.js:306` |
| Microbe hit cooldown | 2 s | `Microbe.js:157` |
| Pickup respawn | 5 s | `pickups.js:7` and prefabs |
| Portal re-check | 1 s | `portal.js:34-37` |
| Photo flash | appears after 0.3 s, lasts 0.2 s | `playerController.js:454-457` |
| Throw anticipation | 0.2 s | `playerController.js:352`, `:373` |
| Microbe wait at wall or edge | `timeWaiting`, default 3 s | `WalkingMicrobe.js:11` |
| Wait before a ledge jump | 1 s | `WalkingMicrobe.js:18` |

---

## 3. Player controller (`playerController.js`, prefabs `Players/player_{amy,harry}.prefab`)

### Controls
From `ProjectSettings/InputManager.asset` and `playerController.js:167-205`:

| Action | Keys | Behaviour |
|---|---|---|
| Move | ←/→ or A/D (axis "Horizontal") | Read with `GetAxisRaw`, so input is digital −1/0/+1 |
| Jump | **↑ only** ("Jump"; joystick button 3) | Space is *not* jump. W is *not* jump: W toggles blind rounds |
| Fire1 | Left Ctrl or left mouse button | Uses an **antibiotic if you hold one, otherwise takes a photo** (`:175-180`) |
| Fire2 | Space or right mouse button | Throws a **white blood cell if you hold any, otherwise soap** (`:182-190`) |
| Fire3 | Left Cmd | Unused |
| Debug | Q, W | Q skips the level, W toggles blind rounds |

All input is ignored while `controlsEnabled` is false, which covers the whole phone briefing.

### Body and physics
Amy and Harry have identical values.

**Rigidbody and colliders**
- Rigidbody2D: mass 1, **gravityScale 1.5**, so effective gravity is −45 u/s². Fixed angle, continuous collision detection.
- CircleCollider2D r 0.53 at (0.03,−0.40) forms the feet.
- BoxCollider2D 1.05×1.68 at (0.02,0.54) forms the body. The player is about 2.3 u (4.6 tiles) tall.
- A thin trigger box 0.05×1.94 at (0.59,0.41) is left over from abandoned wall-contact code (`:420-441`, commented out).

**Serialized values** (these override the script defaults)
- `life 3`
- `soapDrops 0`, `whiteBloodCells 0`, `Antibiotics 0`. The script defaults of 5/5/5 at `:23-26` are overridden, so the player starts every level with no pickups.
- `groundDistance 1.3`
- `maxSpeed 5.7`
- `jumpForce 900`
- `moveForce 50`
- `throwForce 10`

**Movement**
- **Ground check** (`:146-165`): three downward raycasts of length 1.3 from x−0.3, x and x+0.3 against the `groundAndBugs` mask (layers Ground, Enemies, NonEnemies). Standing on a microbe therefore counts as grounded. The ray reaches about 0.37 u below the feet.
- **Jump** (`:168-171`): when grounded and "Jump" is pressed, `AddForce(0, 900)` is applied. Derived: Δv ≈ 18 u/s, apex ≈ 3.6 u (~7 tiles), time to apex 0.4 s. There is no variable-height jump and no air jump.
- **Run** (`FixedUpdate`, `:237-248`):
  - Adds a force of `horizAxis·50`, which is 50 u/s² at mass 1.
  - When |vx| > 0.6 and `horizAxis·vx ≥ maxSpeed`, vx is clamped to ±5.7 u/s.
  - With no input, no force is applied. The player decelerates only through collider friction. The default physics material is unset and the friction value was not verified.
- **Facing** (`:259-262`): the sprite flips when vx > 0.15 or vx < −0.15, by mirroring the transform scale.

### Health and damage
- `OnCollisionEnter2D` with any **non-trigger collider on layer 8 (Enemies)** calls `beHit()` (`:268-273`).
- `beHit()` (`:275-309`):
  1. Plays the "hurt" animation.
  2. Subtracts 1 life.
  3. Leaves the player invulnerable for 2 s (`canBeHit`).
  4. There is no knockback.
- At 0 life, it posts a "Player has died" track and restarts the level. Life is back to 3 on reload, and lives are not carried between levels.
- There are no hazardous tiles. Every level-geometry prefab is on the Ground layer, including body `acid_pit`. Only microbes are on layers 8 and 13.

### Photo
`takePhoto` (`:445-459`):
- Plays the up-body `take_photo` animation.
- Casts a ray from `photo_point` (local (0.58,0.30)) in the facing direction, length **3 u** (`photoLength = 3`, `:50`), against the Enemies and NonEnemies layers.
- Records up to 3 hits and sends each one `bePhotographed`.
- The flash sprite appears after 0.3 s for 0.2 s.
- Each microbe instance counts toward a photo goal only the first time it is photographed (`Microbe.js:139-147`).

### Projectiles (`Projectiles/*.prefab`, `Drop.js`)

**Spawning**
- `shootSoap` and `shootWBC` (`:346-385`):
  1. Decrement the count.
  2. Play the throw animation.
  3. Wait 0.2 s.
  4. Instantiate the projectile at `shoot_point` (local (0.83,0.32)).
  5. `AddForce(facing·10)`.
- Projectile body: mass 0.01, gravityScale 0.01. Derived Δv is about 20 u/s, so the flight is almost straight.
- Soap is `soapDropThrow`: layer 11 Projectiles, box collider 0.27×0.20, and its sprite is mirrored when the player faces left.
- The white blood cell is `whiteBCellThrow`: layer 0, circle collider r 0.2, not mirrored.
- The layer-collision matrix only stops projectiles hitting other projectiles (and unused layer 10).

**Collision**
- On its first collision with anything (`Drop.js:20-42`):
  1. If the other object is on layer 8 or 13, it receives `receiveDrop(name)`.
  2. The projectile plays its "collide" animation.
  3. It is destroyed 0.15 s later.
- A projectile that leaves the screen is destroyed 0.5 s later (`:45-47`).

### Antibiotics
`useAntibiotics` (`:388-410`):
1. Decrements the count.
2. Calls `CameraShake.AntibioticShake()`: amplitude 0.05, 1 s.
3. Sends `receiveAntibiotics` to **every GameObject tagged `Enemy` or `NonEnemy` in the scene**, visible or not.

### Pickups (`pickups.js`, `Pickups/*.prefab`)
- The pickup is a trigger. When the player touches it, `AddSoap`, `AddWhiteBloodCells` or `AddAntibiotics(UnitsAdded)` is called (`:46-73`).
- **Soap +3**, **WBC +3**. These have no cap.
- **Antibiotic +1**, but only when the current count is 0 (`playerController.js:340-343`). This is the "carry only one" rule quoted on phone page 32.
- `AutoRespawn` is true everywhere with `TimeToRespawn 5`. The script never hides the sprite or disables the collider: `makeInvisible` is empty. The "collide" animator trigger does the visual, and the pickup can be collected again after 5 s.

### Shrink mechanic
There is no in-level shrink. Shrinking is only the game-show cutscene (§6).

---

## 4. Microbes (`Microbe.js`, `WalkingMicrobe.js`, `MicrobeLucy.js`, `ThreeBallStaph.js`, `SuperInfection.js`; prefabs `Prefabs/Microbes/NNname.prefab`)

### Shared behaviour

**Physics body**
- All walking microbes have a Rigidbody2D with mass 30, gravityScale 1 and fixed angle.
- Each has solid colliders plus an **EdgeCollider2D trigger** at the front, which acts as the wall and obstacle sensor.
- Each has a `platformChecker` child placed ahead of and below its feet, which acts as the ledge sensor.

**Walking** (`WalkingMicrobe.js:141-145`)
- Movement is `iTween.MoveAdd(x: ±moveDistance(50), speed: Speed, linear, oncomplete: Flip)`.
- The transform is moved directly while gravity still acts on y.

**Turning**
- If the front trigger touches Ground, Player, Enemies or NonEnemies (`:95-108`), the microbe stops.
- It idles for `timeWaiting` seconds, then flips (`StopThenFlip`, `:150-162`).
- `Flip` also nudges the microbe by `turningOffset` to compensate for off-centre sprites (`:207-221`).

**Ledges** (`:66-86`, `:168-190`)
- If `OverlapPoint(platformChecker, Ground)` finds nothing and the microbe is **off-screen**, it simply turns.
- If it is on screen and `MustJumpOnLedge` is set:
  1. It idles 1 s.
  2. It jumps with `AddForce(±3600, 25000)`. Derived Δv ≈ (±2.4, 16.7) u/s, apex ≈ 4.6 u.
  3. On the next collision it lands, and flips with 50% probability (`JumpFinished`, `:195-201`).
- If it is on screen without `MustJumpOnLedge`, it turns.
- Jumpers need the jump animation (the comment at `:15` lists slurm, super_slurm, colin, super_colin, steve and iggy).

**ThreeBallStaph (slarg, sandy)**
- At a ledge they play "bounce" and turn instead of jumping (`ThreeBallStaph.js:9-16`).

**Good against bad**
- When an Enemy-layer microbe and a NonEnemy-layer microbe touch while the microbe is visible, and `DestroysOnEnemyContact` is set (it is true on every prefab), it runs `beKilled()` (`WalkingMicrobe.js:120-136`).
- Both microbes therefore die.
- This does **not** count toward any goal.

**No AI beyond patrolling**
- Microbes do not chase and do not fire projectiles.
- Touching an Enemy only hurts the player.
- An enemy that touches the player plays `be_hit` and gets a negligible upward force of 20 N on mass 30 (`Microbe.js:92-96`, `:150-160`).

### How microbes are damaged and die
`Microbe.js:99-136`, `:163-195`:
- **Soap** subtracts `soapDamage` only if `affectedBySoap`. At life ≤ 0 it calls `UpdateGoals(name,"washed up")` and then `beWashedAway`:
  - The microbe becomes kinematic with colliders off.
  - It plays `be_washed_away`.
  - `iTween.MoveAdd y +70` over 3 s with easeInQuart, so it floats off-screen.
  - It is destroyed after 3 s.
- **WBC** subtracts `whiteBCDamage` only if `affectedByWhiteBC`. At life ≤ 0 it calls `UpdateGoals(name,"white blood cell")` and then `beKilled`:
  - It plays `be_killed`.
  - Gravity drops to 0 and colliders turn off.
  - It is destroyed after 1 s.
- A projectile that does no damage still triggers `beHit()`, which only plays an animation.
- **Antibiotic** applies only if `affectedByAntibiotics`: `beHit`, subtract life, and at ≤ 0 call `UpdateGoals(name,"antibiotics")` then `beKilled`.

### Stat table (prefab values; the scene values match unless listed in §2)

| # | Microbe | Script | Layer/tag | Life | Soap dmg | WBC dmg | Antibiotic dmg | Speed | Ledge jump (prefab) | Scale | Used in |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 00 | lucy (Lactobacillus, good bacterium) | MicrobeLucy | 13 NonEnemy | 10 | immune | immune | immune | 1 | n/a (dives) | 1.96 | kitchen1 ×3, skin1 ×3, kitchen31 ×3, kitchen32 ×4 |
| 01 | patty (Penicillium, good fungus) | Walking | 13 NonEnemy | 5 | immune | immune | immune | 1 | no | 1.5 | kitchen2 ×3 |
| 02 | donna (Dermatophyte, bad fungus) | Walking | 8 Enemy | 10 | 5, so 2 hits | immune | immune | 1 | no | 1.5 | skin12 ×1 |
| 03 | slarg (bad, three-ball staph) | ThreeBallStaph | 8 Enemy | 15 | 5, so 3 hits | immune | 5, so 3 doses | 1 | bounces | 1.5 | skin2 ×1 |
| 04 | slurm (bad Staphylococcus) | Walking | 8 Enemy | 5 | **5, so 1 hit** | immune | 5, so 1 dose | 1 | yes (turned off in most scenes) | 2 | skin11 ×4, skin12 ×4, superinfection ×1 |
| 05 | colin | Walking | 8 Enemy | 15 | 5 | immune | immune | 2 | yes | 1.5 | **not placed in any scene** |
| 06 | super_colin | Walking | 8 Enemy | 20 | 5, so 4 hits | immune | immune | 2 | yes (scene: no) | 1.5 | skin1 ×1 |
| 07 | sandy (good, three-ball) | ThreeBallStaph | 13 NonEnemy | 10 | immune | immune | immune | 1 | bounces | 1.5 | skin2 ×1 |
| 08 | steve (Staphylococcus, good) | Walking | 13 NonEnemy | 5 | immune | immune | **5, so killed by 1 antibiotic** | 1 | yes | 2 | skin2 ×3, skin11 ×1, skin12 ×1, superinfection ×1 |
| 09 | iggy (Influenza virus) | Walking | 8 Enemy | 5 | immune | **5, so 1 hit** | immune (dmg 5 set but the flag is off) | 1 | yes | 1.5 | body11 ×3, superinfection ×4 |
| 10 | super_slurm | Walking | 8 Enemy | 15 | 5, so 3 hits | immune | immune | 1 | yes (scene: no) | 2 | skin1 ×1 |
| 11 | superinfection | SuperInfection | 8 Enemy | 20 | immune | immune | **5, so 4 doses** | static (no Rigidbody) | – | 1.5 | superinfection ×1 |

**Lucy's yoghurt dive** (`MicrobeLucy.js`)
1. When Lucy enters a **trigger tagged `Yoghurt`**, she records which side the pot is on and sets `canJump` (`:20-42`). Both the milk glass (`jump_platfotm`, sic) and the yoghurt pots (`jump_platform`) carry such triggers along their top edges, so pushing Lucy into a yoghurt pot also counts.
2. Leaving the trigger clears `canJump` (`:44-50`).
3. While `canJump` is set, a player collision from the side **away from** the pot calls `jumpToYoghurt()` (`:53-65`):
   - Stops her walk.
   - Applies `AddForce(jumpForce.x·side, jumpForce.y)`. The serialized value is (3600, 25000), or 27000 for one kitchen1 Lucy.
   - Plays "dive".
   - **Updates the goal immediately**, before she lands.
   - Sends `DrawYoghurt(1.9)` upward to the container.
   - Disables her colliders and destroys her after 3 s (`:74-88`).
4. Lucy never turns after jumping (`:67-72`).
5. `Milk.js` plays the animator trigger "turn" (milk becomes yoghurt). `Yoghurt.js` enables three topping sprites.

**SuperInfection**
- Overrides `beHit` to do nothing, because it has no hit animation (`SuperInfection.js:6-9`).
- `receiveAntibiotics` plays the "antibiotics" animation and subtracts 5 (`:11-23`).
- `beKilled` disables its colliders and destroys it after 1 s, with no death animation (`:25-31`).
- Its two solid boxes are on the Enemy layer, so touching it hurts the player.

---

## 5. HUD, phone and camera

### HUD (`GUIHandler.js` on `Prefabs/GUI/GUI.prefab`)
The HUD is drawn with immediate-mode `OnGUI` at fixed pixel positions designed for 960×600 (`GUIHandler.js:149-161`):
- Up to **3 hearts** (`Textures/GUI/Heart.png`) at x = 900, 870, 840 and y = 14.
- One **antibiotic icon** at (827,50) while `antibiotic > 0`.
- **The soap and WBC counts are stored (`UpdateGUI`, `:163-168`) but never drawn.** The player gets no ammo display.

Other GUI pieces:
- `GUITextGoalsInfo.js` and `GUITextPlayerInfo.js` are the old debug HUD. Their bodies are commented out, and the `GUITemp`/`GUI` objects that hold them in each scene are inactive.
- `Prefabs/GUI/Heart.prefab` and `Antibiotic.prefab` (with DeadHeart/NewHeart animations) are unused.

### In-game phone
The `InGamePhone` sprite is a child of GUI, which is parented to the camera. It sits at local (2.81,−2.52), scale 1.7, bottom-right. Its Animator has "PhoneBig" (0.875 s) and "PhoneSmall" triggers.

`InGamePhone.js` is a stub that only logs "This function should not be used!" (`InGamePhone.js:13-31`). All phone logic is in `GUIHandler`.

**Briefing sequence** (`showInfoLevel`, `:173-220`; `showNextInfoImage`, `:222-238`):
1. Controls are disabled.
2. "PhoneBig" plays.
3. After 0.8 s the first page is drawn as a borderless `GUI.Button` at pixel (290.3,189), size 444×272.
4. **Any key or mouse press** (`Input.anyKeyDown`, `:128-131`) moves to the next page.
5. After the last page, "PhoneSmall" plays and controls come back.
6. 1 s later the minimized phone shows its goal overlay.

**Goal overlay** (`DisplayGoals`, `:276-306`; `DisplayMicrobe`, `:308-341`):
- The target microbe's icon appears at `microbePos` (3.54,−1.19). For a "thrown to yoghurt" goal, the milk-glass icon appears instead.
- Up to 3 red/green check sprites appear at `goalsPos` (3.25,−1.76), spaced 0.5 apart. Nothing is drawn if the total is more than 3.
- When all goals are completed, the icon changes to the **portal**.
- Icons come from `Textures/GUI/InGamePhone/12Microbes/*` and `200px-P_{yes_green,no_red}.svg.png`.

**Phone page text.** The pages are images, `Textures/GUI/TextIntroLevels/TextIntroLevelNoGaps00NN.png`. Each shows the host with a microphone plus a microbe, camera, milk or pill picture. The level-to-array mapping is in `GUI.prefab`: kitchen1 has 7 pages, skin1 2, skin2 2, kitchen2 2, skin11 2, skin12 3, body11 4, kitchen31 3, kitchen32 2 and superinfection 6. Transcribed text:

| Level | # | Text |
|---|---|---|
| kitchen1 | 1 | We have shrunken you so small that you can't be seen without a microscope! |
| | 2 | With your trusty hoverboard and camera phone, you have to explore the tiny world of the microbe. |
| | 3 | Microbes are everywhere, including the kitchen. Some are good and some are bad - so watch out! |
| | 4 | Your mission is to photograph 3 Lucy Lactobacillus. (camera icon) |
| | 5 | Lucy is a bacteria. |
| | 6 | When you are near Lucy, press the CTRL button to use your camera phone to take a picture. |
| | 7 | When you have taken all the photos, find the PORTAL to go to level 2. (portal picture) |
| skin1 | 8 | Now we have sent you onto a human hand. There are millions of microbes on everyone's hands! |
| | 9 | Photograph 3 more Lucy Lactobacillus Bacteria. |
| skin2 | 10 | This time you have to photograph 3 Steve Staphylococcus |
| | 11 | Steve is also a bacteria like Lucy. |
| kitchen2 | 12 | In this level, you need to photograph 3 Patty Penicillium |
| | 13 | Unlike Steve and Lucy, Patty is a FUNGUS! Fungi are bigger than bacteria. |
| skin11 | 14 | This time, use soap to wash away Slurm Staphylococcus. |
| | 15 | Press SPACE BAR to throw soap that you collect. |
| skin12 | 16 | Skin has good and bad microbes on it. Using soap is a good way to get rid of the bad microbes. |
| | 17 | This time, use soap to wash away all the bad microbes. Press the SPACE BAR to throw soap that you've picked up. |
| | 18 | Watch out for Donna Dermatophyte though! She's a fungus like Patty Pennicilium but she's not as friendly! |
| body11 | 19 | We have sent you inside the body! Sometimes bacteria and viruses can get inside your body. |
| | 20 | Iggy Influenza is a flu virus. Viruses are the smallest of the microbe but that doesn't make them easy for the body to cope with. |
| | 21 | Bodys have natural defenses that kill intruders. Help the body by collecting and throwing white blood cells to kill all the bad microbes. |
| | 22 | Use the SPACE BAR to throw the body's defences at Iggy. |
| kitchen31 | 23 | We've sent you back into the kitchen. This time you're going to see what good microbes can REALLY do! |
| | 24 | Lucy Lactobacillus can turn milk into yogurt. That's how yogurt gets made. Amazing isnt' it? |
| | 25 | To turn the milk into yogurt, just push Lucy into the glass. |
| kitchen32 | 26 | Well done! We also use microbes to make things like bread and even cheese! |
| | 27 | This time you have to turn THREE glasses of milk into yogurt. |
| superinfection | 28 | In an earlier level, you used the body's own defenses to kill bad microbes. That works almost all of the time. |
| | 29 | Sometimes people get really sick and the doctor has to prescribe them special drugs called Antibiotics. |
| | 30 | The most important thing when using antibiotics is to do exactly what the doctor says. |
| | 31 | In this level you're going to use antibiotics to defeat a SUPER infection that can't be killed with the body's defense. |
| | 32 | You can only carry one antibiotic at a time, so you'll need to go back to get more until you kill the super infection. |
| | 33 | Press CTRL to use the antibiotic. Watch what it does. Does it kill all other microbes too? |

The "hoverboard" on page 2 is Flash-era wording. Unity has no hoverboard stage.

### Camera
**Projection**
- Every scene uses an orthographic camera with **size 5**, so the view is 10 u tall. At the 960×600 web default it is 16 u wide, which is **32×20 tiles** of 0.5 u.
- That works out to 60 screen px per world unit, while sprites are authored at 100 px/u.

**Follow** (`CameraFollow.js`, run in `FixedUpdate`)
- On each axis, if the player is further than the margin from the camera centre, the camera lerps toward the player by `smooth·dt` (`:63-80`).
- The result is clamped to the LL/UR edge markers.
- Prefab margins are xMargin 0.5, yMargin 2 and smooth 2/2. Per-scene overrides are in the §2 table: kitchen1 y 1, skin11 x 2, superinfection y 3.
- The script defaults of 2/2/2/2 are overridden.

**Shake** (`CameraShake.js`)
- Static functions only. The zoom feature was abandoned: "running out of time" (`:8`).
- `ShrinkingZone()` waits 0.3 s, then runs `iTween.ShakePosition` with amplitude 0.1 for 3.5 s (`:35-57`).
- `AntibioticShake()` uses amplitude 0.05 for 1 s (`:59-61`).
- The component exists on the game-show cameras and on the superinfection camera only (§9).

---

## 6. Game show (scenes `gameShow`, `gameShow_quiz`, `gameShow_game_end`)

### Scene contents
All three scenes contain:
- Background and Foreground sprites at scale 1.85.
- `gamehost` at (−3.68,0.66), with animator triggers excited, stop and serious. Clips exist for hostExcited, hostSerious, hostStop and hostDisappointed.
- `amy` at (2.66,0.34) and `harry` at (5.50,0.10), each at scale 1.33. They have animator triggers idle, happy and disappointed; clips also exist for cautious, confident, curious and neutral. Each has a child `Score` plate sprite, a `ScoreBoard.js`, and a BoxCollider2D so it can be clicked.
- `TextBox` (a prefab sprite) with `TextBox.js`.
- `Main Camera` with `CameraShake`.

`gameShow` additionally has an **active** GameLogic and `TVIntro`.

### Intro scene (`GameShow/LevelLogicGameShow.js`)
`levelActions()` (`:170-190`) runs these steps in order:
1. **TV intro** (`:192-218`):
   - Scoreboards are hidden.
   - The code waits 3 s. The TVIntro clip is 3.47 s at 15 fps.
   - It then waits for any key or click, destroys `TVIntro`, and shows the scoreboards.
   - `TVIntro.js` has its own `enableClick()`/`finishedTVIntro()`, but no animation event calls them, so they are dead code. The project contains no animation events at all.
2. **Intro talk** (`:220-241`): host "excited". The TextBox speaker is "Game host" and it says three lines:
   1. "Hello and welcome to the Super Microbe World Game Show!"
   2. "Soon you will be visiting the weird world of the microbe."
   3. "But first, who do you want to play as?"

   Then host "stop". The strings are hard-coded. `Resources/TextFiles/conversations/*_introductions.xml` has the same lines with "e-Bug Game Show" and 11 translations, but nothing loads it.
3. **Player selection** (`PlayerSelect`, `:245-263`; `PlayerSelection.js`):
   - Hovering a character makes it "happy" and the other one "disappointed".
   - Moving away returns both to "idle".
   - Clicking calls `PlayerChosen(name)` with `"amy"` or `"harry"`, which is stored in `PlayerPrefs "player"` (`GameLogic.js:263-270`).
4. **Talk2**: "Tell me a little about yourself:"
5. **Data form** (`OnGUI`, `:143-168`), shown over `FormBackground`:
   - Fields: Nickname (max 25), Age (max 3) and E-mail (max 25). Each defaults to "?".
   - A "Submit form" button (tooltip: "If you don't want to submit any info just leave the question marks.").
   - Footer text: "You don't need to give us this information, but if you do you'll be able to take part in competitions and hear about new versions of the game."
   - Submitting starts `GameLogic.StartDataBaseConnection` in the background (§7).
6. **Branch**:
   - Not blind (`!IsBlindRound()`): **Talk3** "Step this way and prepare to enter the world of microbe!", then **ShrinkingZone** (`:335-361`):
     - Scoreboards are hidden.
     - The `shrinking_zone` background and the chosen `amy_shrink`/`harry_shrink` object are enabled. The shrink clip is 6.25 s at 24 fps.
     - The camera shakes.
     - The code waits **3.5 s**, which cuts the clip off, then shows "Loading next level...".
   - Blind: **Talk4** "Thanks!"
7. `gameLogic.NextLevel()`.

`ShrinkPlayer.js`, whose `EndAnimation()` calls `LevelLogicGameShow.ShrinkingZone`, is not attached to anything. It is dead code.

### Quiz scene (`Quiz/LevelLogicQuiz.js`)
**Setup**
- Awake reads the round number, `blindRound = IsBlindRound()` and `blindMode = IsBlindGame()` (`:67-109`).
- On the first `Update`:
  1. Scoreboards are loaded from `PlayerPrefs` `PlayerScore` and `OpponentScore`. These are set to 0 in `GameLogic.Awake`, `:80-81`.
  2. `GetQuestions()` (`:216-247`) parses the **hard-coded English XML string** in `Quiz/Dialogues/en_en_gameshow_roundN.js` with `XmlSerializer(Round)` (`Round.js:49-60`).
- **No Resources XML is read at runtime, and there is no language selection.** `RoundHandler.LoadRoundFromWeb` targets `http://localhost:3030…` (`Round.js:101`) and is never called.

**Sequence**
1. Host "excited".
2. `SayThis(intro_text.blind)` or `SayThis(intro_text.normal)` (`:270-278`).
3. For each question (`ShowQuestion`, `:294-310`):
   - The host reads the question text.
   - The scoreboards hide and the blue `FormBackground` appears.
   - The OnGUI form (`:172-194`) shows the label "Question number N", which is 0-based, plus the question text and a hard-coded "10 points" label.
   - Three buttons appear: **Agree** (40%,35%), **Don't Know** (40%,50%) and **Disagree** (40%,65%), each 20%×10% of the screen.

**Scoring** (`Answer`, `:312-402`)
- The pressed button's label is matched against the XML `<label>` to get `value`: +1 correct, −1 wrong, 0 "don't know".
- In a **normal round**:

  | Player's answer | Player animation | Host says | Score change |
  |---|---|---|---|
  | Correct | "happy" | "Your answer was: X\nThis is the CORRECT answer" | player **+score (10)** |
  | Wrong | "disappointed" | "Your answer was: X\nThis is the WRONG answer" | **opponent +5**, player +0 |
  | Don't Know | – | "You chose the safe answer" | none |

  Then the **simulated opponent** answers with `Random.Range(0,3)`, uniform:

  | Roll | Host says | Score change |
  |---|---|---|
  | 0 | "Your opponent's answer was WRONG" | **player +5**, opponent "disappointed" |
  | 1 | "Your opponent chose the safe answer" | none |
  | 2 | "Your opponent's answer was CORRECT" | **opponent +10**, opponent "happy" |

- `ScoreBoard.ChangePoints` never lets a score go below 0 (`ScoreBoard.js:34-39`).
- In a **blind round** there is no feedback, no score change and no opponent. Answers are only recorded as 1/−1/0.
- **The "great bonus later" that the blind intro promises is never implemented.**

**End of round**
- After the last question, `SubmitResults` (`:404-448`):
  1. Stores the scores back in PlayerPrefs.
  2. Posts a track with the answer string (for example "1, -1, 0, ") and the blind flag.
- Then `checkShrinkingZone` runs (see §1), and then `NextLevel`.

**Scoreboard display** (`ScoreBoard.js:27-31`): an OnGUI label, 100×20, font size 20, bold, right-aligned. Amy's is at pixel (529.7,378.7) and Harry's at (718.8,405.2).

### TextBox (`GameShow/TextBox.js`)
**Layout**
- The speaker name is drawn at pixel (35.2,418.3) and the dialogue text at (39,467.5). Font size 17, bold.
- The text box sprite is enabled only while text is shown.

**Typewriter**
- Letters appear one at a time with period `1/lettersPerSecond`, where `lettersPerSecond = 20`. See §9: the period is probably 0.
- A line break is inserted at the last space every **75** characters. A sentence stops after 4 lines.
- Pressing any key once more than half the line is written prints the rest instantly (`:236-241`).
- The box then waits for any key or click (`WaitForClick`, `:262-269`).

**Input**
- A 50-slot circular FIFO buffers the sentences (`TextBuffer`, `:282-361`).
- `SayThis` has overloads for `String[]`, `List<String>` and `String` (`:118-162`).

### Final screen (`GameShow/LevelLogicFinal.js`)
1. Scores are loaded from PlayerPrefs (`:83-94`).
2. Host "serious" says:
   - "It looks that you have completed the game."
   - "Now it's time to take a look to the scoreboards and see who is the winner!"
   - "Are you ready? Let's go!"
3. Scoreboards are shown, then 1 s passes.
4. The result is announced (`:112-131`):

   | Result | Animations | Host says |
   |---|---|---|
   | Player > opponent | player happy, opponent disappointed | "Congratulations amy/harry! You win the contest!!." (the lowercase internal name) |
   | Player < opponent | player disappointed, opponent happy | "Your opponent wins the game! Well done both. Play again for a chance to defeat your opponent." |
   | Equal | both happy | "We have a draw!! Well done both! Play again for another chance to win!" |

5. It then loops forever, every 15 s, through (`:139-148`):
   1. "Reload the page to play again!"
   2. "This game was programmed by Pedro Rodriguez Diaz, with the help of David Farrell."
   3. "Hope you had fun with it :)"

### Language handling
None at runtime. Every string the player sees is English: it is either hard-coded in the scripts or baked into the phone PNGs. The 11-language XML sets in `Resources` are unused (§8).

---

## 7. DBconnector / Heroku tracking (describe only; do not port)

**Connection**
- `DBconnector.js` sits on the GameLogic object. The base URL is `http://supermicrobeworld.herokuapp.com` (`DBconnector.js:13`), and a localhost:3030 alternative is commented out at `:11`.
- `GameLogic.online` is hard-coded `false` (`GameLogic.js:39`). It only decides whether quiz XML is fetched, and that path is dead anyway. Tracking still runs when a session key is obtained.

**Handshake:** `ConnectToGleaner(userID, session)` (`:48-95`)
1. POST `url + "/start/" + session` with body `"empty"` and header `Authorization: <nickname>`.
2. Parse the JSON response for `sessionKey` and store it in `PlayerPrefs "sessionKey"`.
3. `GameLogic.StartDataBaseConnection` (`:274-326`) calls it with a **hard-coded session keyword string** (`GameLogic.js:279`, "has to be created in the database"). The value is not reproduced here.
4. It retries the check once after 1 s.
5. On success it posts the first track: `{type:"logic", event:"Player started the game.", nickname, email, age}`. This is personal data typed into the form.

**Tracking:** `Track(JSONObject[])` (`:102-119`)
- Creates a `Connection`, which spawns a `Coroutiner` GameObject per post that destroys itself after `timelimit` = 15 s.
- POSTs `url + "/track"` with headers `Authorization: <sessionKey>` and `Content-type: application/json`. The body is a JSON array, and each item gets a `timestamp` (`:136-220`).
- The timestamp format string is `"yyy-MM-dd"+"T"+"hh:mm:ss.fff"+"Z"` (`:171-173`). That is a 12-hour clock with no AM/PM marker.
- A 10-slot ring buffer keeps `Connection` objects alive (`:224-246`).

**Events posted**

| Event | Extra fields | Source |
|---|---|---|
| "Level X loaded" | – | `LevelLogic.js:143-157` |
| "Player has died" | level | `playerController.js:290-298` |
| "Loading quiz level number N" | round, blind | `LevelLogicQuiz.js:196-214` |
| "Quiz level number N score" | round, blind, score = answer list | `:427-443` |
| "Game finished. Player wins / loses / There was a draw." | scores | `LevelLogicFinal.js:154-182` |

**Credentials:** none are stored in the scripts. The only secret-like values are the Heroku URL (also in `README.md`) and the session keyword at `GameLogic.js:279`. Every platform password and token field in `ProjectSettings/ProjectSettings.asset` is empty (metro/blackberry/tizen; checked). The server code is not in this repository.

---

## 8. Data files (`Assets/Resources`)

| Path | What | Loaded at runtime? |
|---|---|---|
| `Resources/en_en_gameshow_round{1-5}.xml` | Quiz rounds (English) | No |
| `Resources/TextFiles/quiz/{lang}_gameshow_round{1-5}.xml` | Quiz rounds in 12 sets: `alpha`, `bg_fl`, `bg_fr`, `cz_cz`, `dk_dk`, `en_en`, `fr_fr`, `gk_gk`, `it_it`, `pl_pl`, `por_por`, `sp_sp` | No |
| `Resources/TextFiles/conversations/{lang}_introductions.xml` | Host intro lines, 11 languages (all of the above except `alpha`) | No; the lines are hard-coded instead |
| `Resources/TextFiles/plan.txt`, `plan2.txt` | Level design plans (§2) | No |
| `Scripts/Quiz/Dialogues/en_en_gameshow_round{1-5}.js` | The same English XML embedded as strings | **Yes, this is the only quiz source** |

### Quiz schema (`Quiz/Round.js:115-177`)
```xml
<round id="0">
  <name>All About Microbes</name>
  <round_id>0</round_id>
  <next_round>en_en_gameshow_round2.xml</next_round>
  <intro_text>
    <blind><statement>…</statement>…</blind>
    <normal><statement>…</statement>…</normal>
  </intro_text>
  <questions>
    <question id="0">
      <type>0</type><score>10</score><value>1</value>
      <text>If you cannot see a microbe it is not there</text>
      <answers>
        <answer><label>Agree</label><value>-1</value></answer>
        <answer><label>Don't Know</label><value>0</value></answer>
        <answer><label>Disagree</label><value>1</value></answer>
      </answers>
    </question>
  </questions>
</round>
```
- An answer `value` of 1 marks the correct answer, −1 a wrong one and 0 "don't know".
- `type` and `value` on a question are never used.
- The serializer binds `Question.id` to the attribute `name`, which the XML does not have (`Round.js:159`), so ids are always 0.
- Mis-spelt `<statment>` and `<lable>` elements are silently dropped (see §9).

The introductions schema is `<conversation><statement>…</statement>×10</conversation>`. It holds the welcome lines, "Tell me a little about yourself:", Nickname/Age/email address, the disclaimer, and "Let's see what you know about microbes."

### Which set looks canonical?
- **The embedded `.js` strings, `Resources/en_en_*.xml` and `TextFiles/quiz/en_en_*.xml` are the same text.** The two XML copies are byte-identical. The JS strings match after normalizing whitespace and quotes.
- All the XML was committed together on 2014-01-28 (`c246c82b`). The JS strings were last edited on 2014-04-30, and only for whitespace (`8467b5a6`).
- **`alpha_*` is an earlier English draft.** Evidence:
  - It uses "good/bad" wording where `en_en` uses "useful/harmful".
  - Its host intros are richer, such as "Nice one! / Let's see how you do on those questions again...", "Yum Yogurt!" and "Not bad. Not bad at all...". These may be closer to the Flash host lines and are worth comparing.
  - Its round 4 is **in French**, with a different fridge question ("La viande crue doit aller sur l'étagère du haut du réfrigérateur", where Disagree is correct) and `next_round` pointing at `fr_fr_…round5`.
  - It has more `<lable>` typos.
- The 10 translations follow `en_en` wording. For example, dk round 4 Q0 reads "Råt kød skal have en hylde for sig selv", matching en_en's "solid shelf". So **`en_en` is the canonical Unity-era text, and the translations are derived from it.**
- All sets have the same shape: round 1 has 4 questions, round 2 has 4, round 3 has 2, round 4 has 5 and round 5 has 6.

### Canonical Unity quiz content (`en_en`; the correct answer follows each arrow)
- **R1 "All About Microbes"** (4 questions):
  - If you cannot see a microbe it is not there → Disagree
  - Bacteria and Viruses are the same → Disagree
  - Fungi are microbes → Agree
  - Microbes are found on our hands → Agree
- **R2 "Good and Bad Bugs"** (4 questions):
  - All bacteria are harmful → Disagree
  - Soap can be used to wash away harmful bugs → Agree
  - Most coughs and colds get better without medicine → Agree
  - Our bodies have natural defences that protect us against infection. → Agree
- **R3 "Good Microbes"** (2 questions):
  - We use useful microbes to make things like bread and yogurt → Agree
  - All microbes are harmful for us → Disagree
- **R4 "Food Hygiene"** (5 questions, never played):
  - Raw meat should have a solid shelf all to itself to prevent harmful microbes getting on to other food. → Agree
  - Liquids like milk, yogurt and juice go in the fridge door. → Agree
  - It is safe to put opened tins in the fridge. → Disagree
  - Fruit should be put in the fruit bowl. → Agree
  - If you sneeze, you should wash your hands before handling food. → Agree
- **R5 "Treatment of infection"** (6 questions):
  - Antibiotics kill bacteria → Agree
  - Antibiotics kill viruses → Disagree
  - Antibiotics will cure any illness → Disagree
  - Antibiotics can harm our useful bacteria as well as harmful bacteria → Agree
  - Antibiotics help when you have a cough → Disagree
  - Most coughs and colds get better without antibiotics → Agree
- **Intro lines:**
  - Normal: R1 starts "Well done, you're a hoverboard natural!" (Flash-era). Then every round says "Now let's see what you have learned." / "(Remember,) 10 points for a correct answer, but if you get it wrong, the other player gets (the) points." / "so if you DON'T KNOW the answer, it's best to play it safe and say so!" / "Ready?" / "Let's Go!"
  - Blind: R1 is "Welcome to the first BLIND QUESTION ROUND!" / "I'm going to ask you some questions but I'm NOT going to tell you if you get them right!" / "If you get them right, you'll get a great bonus later though, so try your best."
  - Other blind rounds: R2 "Welcome to the SECOND round" plus the bonus line; R3 "Welcome to the THIRD round" / "What do you know about USEFUL microbes?"; R4 "Welcome to the FOURTH round"; R5 "Welcome to the FINAL round" / "This time we're going to see what you know about how you get better from infections".
  - Every blind "Let's Go!" is lost to the `<statment>` typo.

---

## 9. Bugs, hacks and incomplete features

### Flow and state
- **The commit "Bug on the kitchen32 level fixed." (`a04b576d`, 2014-05-06) actually edits `kitchen31.unity`.** It moves the Sausage, Chop and Chip platforms near x≈56-61 lower, for example Sausage (54.30,−1.04) to (58.98,−3.48). It also adds a DBconnector to the inactive test GameLogic. In the same commit, skin2's `spot_large` moved from x 8.68 to 6.47 ("ending easier to reach").
- The debug keys **Q** (skip level) and **W** (toggle blind rounds) ship in the build (`LevelLogic.js:124`, `GameLogic.js:90`).
- `GameLogic.ChangeLevel`'s streaming fallback for quiz scenes is a no-op, `level.ToString("gameShow_quiz")` (`GameLogic.js:213`).
- Round 4 is never played, the enum `gameShow_quiz3` is unused, and the `gameShow_quiz4` name is wrong (it is round 3).
- The `Application.Quit` branch is unreachable.
- Every scene except `gameShow` carries an inactive `GameLogic` copy and dead `GUITemp`/`GUI` debug-text objects.

### Goals
- `Goals.Awake`'s inner loop tests and increments `i` instead of `j` (`Goals.js:49`), so the initialization is a no-op. This is harmless because int arrays start at 0.
- `NameToNumber` checks `actNumber == -1` twice instead of also checking `micNumber` (`:233`).
- There is no feedback when the portal is touched with goals unfinished (`GameLogic.js:193-196`).
- Microbes killed by good/bad contact never count toward goals. In levels with exactly the target number of microbes (kitchen1, skin1, skin2, kitchen2, body11), losing one makes the level impossible until the player dies and restarts. The same happens if a kitchen1 Lucy is pushed into the milk glass next to her at x≈36: she dives and is destroyed, and "thrown to yoghurt" is not a kitchen1 goal.

### Antibiotics
- Antibiotics hit every `Enemy`- and `NonEnemy`-tagged object in the scene, whether or not it is on screen. **Steve is `affectedByAntibiotics` with life 5**, so in skin2 (goal: photograph 3 steve) the antibiotic pickup at x≈4 can wipe out the goal.
- Holding an antibiotic also replaces the photo action on Fire1.
- **Likely bug (static-reference analysis, not runtime-verified):** `CameraShake` keeps `myGameObject` in a static field set in `Start`. Only the game-show cameras and the superinfection camera have the component. In skin2, kitchen2 and body11, `AntibioticShake()` would therefore call `iTween.ShakePosition` on the destroyed camera from the previous scene and throw inside `useAntibiotics` after the count was decremented but before `receiveAntibiotics` is sent (`playerController.js:390-405`). The antibiotic would be consumed with no effect.

### Milk and yoghurt
- `Milk.js:32` and `Yoghurt.js:30` set `toppingActive = false` where they mean `true`, so the guard never trips.
- `DrawYoghurt(delay: int)` is sent `1.9`, a float, through `SendMessageUpwards` (`MicrobeLucy.js:83`). The parameter type mismatch may make Unity reject the call. **Unverified.**

### Quiz XML
- `<lable>` typo in the `en_en` rounds 3, 4 and 5, Q0, on "Disagree". The "Disagree" button then matches no label and is **scored as "safe answer"** even though it is the wrong answer. Round 1 is fixed in `en_en` but broken in `alpha` and in every translation.
- The `<statment>` typo drops "Let's Go!" from every blind intro.
- `Question.id` is bound to the attribute `"name"` (`Round.js:159`), so ids are always 0.
- The quiz form shows "Question number N" counting from 0 (`LevelLogicQuiz.js:176`), and the "10 points" label is hard-coded.

### Game show
- **Blind rounds promise "a great bonus later", but no code awards one.** Blind answers only go to the database.
- `checkShrinkingZone`'s else-branch log says the animation "is played" when it is not (`LevelLogicQuiz.js:471`).
- `IsBlindRound` has an unreachable `Debug.Log` after `return false` (`GameLogic.js:359-360`).
- The shrink cutscene clip is 6.25 s long, but the code moves on after 3.5 s.
- `LevelLogicFinal.SendInfoToDB()` runs in `Start` (`:79`), before `Update` loads the scores (`:87-88`). The database therefore always receives "There was a draw." with scores "0,0".
- `TextBox.period = 1 / lettersPerSecond` (`TextBox.js:34`) is int/int, evaluated when the field is initialized. It is **probably 0 in UnityScript**, which would type one letter per frame rather than 20 per second. This is a language-semantics inference, not runtime-verified. The file also carries a word-wrap TODO (`:17`).
- `PlayerSelection.OnMouseDown` calls `PlayerSelect()` again (`PlayerSelection.js:48`), starting a redundant second coroutine. It is harmless.

### Scenes and prefabs
- kitchen32 has a complete `GUI` (GUIHandler plus InGamePhone) baked under `main_camera` **in addition to** the runtime `GUI(Clone)`, so two phones are drawn on top of each other.
- skin12 has a stray world-space `InGamePhone` at (3.14,−2.26).
- Leftover yoghurt pots sit at x≈71.55 in kitchen1, kitchen2, kitchen31 and kitchen32, past the camera bound of 61.77, plus pots near the start in kitchen1, kitchen2 and kitchen31.
- Level-logic comments do not match their code: skin1 says "3 patty", kitchen31 and kitchen32 say "2 lucy".
- The soap and WBC counts are never displayed.
- `pickups.makeInvisible()` is empty.

### Dead or scaffold code
- `IEnemy.js` (an interface nobody implements; it mentions `beFrozen`, and super_slurm even has a `be_frozen` clip)
- `InGamePhone.js`
- `GUITextGoalsInfo.js` and `GUITextPlayerInfo.js`
- `TVIntro.enableClick`/`finishedTVIntro`
- `ShrinkPlayer.js`
- `RoundHandler.LoadRoundFromWeb`
- The CameraShake zoom
- `LevelLogic.SetPickups` (never called)
- Heart and Antibiotic GUI prefabs
- `colin` (never placed in a scene)

### Old build
`LastBuild/4mar14.2WORK.html` and `.unity3d` are a web-player build from 4 March 2014. It predates the phone, the GUI, the blind rounds and the final screen.

---

## 10. How levels are stored and how to extract them

**Levels are hand-built Unity scenes. There is no level data file.**
- Designers placed prefab instances in each `.unity` scene.
- No level XML exists. The only XML is quiz and dialogue text.
- The body levels are the extreme case: almost the whole layout (about 2,400 objects) lives *inside* the `Levels/Body/base_level_body 1.prefab` hierarchy.

### Object naming
- **Level root:** `base_level_kitchen`, `base_level_skin` or `base_level_body`. It carries `LevelLogicXxx.js`. Its children are `level_start` (spawn), `levelEnd` (the portal, with `portal.js`), `main_camera` plus `main_camera_LowerLeftEdge` and `main_camera_UpperRightEdge` (the camera-centre clamp), `ground` (a long strip: kitchen at (29.98,−6.68) scaled 79.8×0.99; skin and body floors are built from tiles), and `bg`.
- **Platform prefabs.** Each is a root with the collider, plus 0.5 u sprite children named `_L`/`_Mid`/`_R` (or `_ini`/`_mid`/`_end`):
  - Kitchen: `countertop`, `Cheese`, `Chip`, `Chop`, `CurlyChip`, `Loaf`, `Loaf_mould`, `Sausage`, `salt`, `pepper`, `toast_jam`, `toast_marm`, `milk` (tag `Yoghurt`, `Milk.js`), `yoghurt` (tag `Yoghurt`, `Yoghurt.js`).
  - Skin: `Hair`, `Hair_short`, `plaster_multi`, `plaster_singular`, `scab`, `splinter`, `spot_small`, `spot_large`, `spot_ooze`, `wart`, `lint_ball`, `NormalSkinTile`.
  - Body: `flesh_*`, `floorTile*`, `platform`, `big_platform*`, `bone_small`, `acid_pit*`, `cell_*`, `villi_floor`.
- **Microbes** are `NN` plus a name, for example `00lucy` or `11superinfection`. The two-digit prefix is stripped at runtime to get the goal key.
- **Pickups** are `soapDrop_pickup`, `whiteBloodCell` and `antibiotic_pickup`, usually under a `Pickups` root.
- **Layers** (`ProjectSettings/TagManager.asset`, `utils.js:28-46`): 8 Enemies, 9 Player, 11 Projectiles, 12 **Ground** (every solid piece of level geometry), 13 NonEnemies.
- **Tags:** Ground, NonEnemy, Enemy, Yoghurt, Level_end, Level_start, Player, MainCamera.

### Unity 4.3 text YAML
- The file is a sequence of documents headed `--- !u!<classID> &<fileID>`.
- Class IDs: 1 GameObject, 4 Transform, 20 Camera, 50 Rigidbody2D, 58 CircleCollider2D, 60 PolygonCollider2D, 61 BoxCollider2D, 68 EdgeCollider2D, 95 Animator, 114 MonoBehaviour, 212 SpriteRenderer, 1001 Prefab.
- **Unity 4.3 writes every object of an instantiated prefab into the scene in full.** Each GameObject and component carries `m_PrefabParentObject: {fileID, guid}` and resolved values. The `Prefab` (1001) document also lists `m_Modification` property overrides (`propertyPath: m_LocalPosition.x`, `value: …`), but these are redundant with the resolved objects. **You do not need to merge prefabs.**
- **World position:** multiply the local TRS (`m_LocalPosition`, `m_LocalRotation` quaternion, `m_LocalScale`) up the `m_Father` chain. Rotations are almost all about z. Four objects have y-flips, and many rotated pieces exist: countertop walls at −90°, rotated CurlyChip/Cheese/plaster, and the body levels at many angles. **Rotation must be handled.**
- **GUIDs → assets:** read `guid:` from every `Assets/**/*.meta`; the repository has 6,960 of them. Scripts resolve through `m_Script` guid to `.js`. Sprites resolve through `m_Sprite: {fileID: 21300000, guid}` to a single-sprite `.png` (`spriteMode 1`) whose `.meta` holds `spritePixelsToUnits` and `spritePivot` (0.5,0.5).
- **PyYAML caveat:** Unity writes floats such as `-.699999988`, which the YAML 1.1 resolver leaves as strings. Coerce them.

### Scale constants
- **Tile size: 0.5 Unity units.** Every tile texture is 50×50 px at `spritePixelsToUnits: 100` (for example `Textures/Tiles/Kitchen/*_Mid.png`, `Skin/skin_surface.png`, `Body/flesh.png`). Larger props are whole multiples of 0.5 u, such as loaf 0.5×2.0, toast 2.5×0.5 and yoghurt 1.5×1.5.
- Character and microbe sprites use 80-100 ppu and are scaled 1.5-2× in scenes. Examples: harry_low is 208×128 px at 100 ppu, scaled 1.5; lucy is 137×128 at 100 ppu, scaled 1.96; the superinfection is 456×236 at 80 ppu, scaled 1.5.
- **Camera `orthographicSize = 5`** in all 13 scenes: 10 u = 20 tiles visible vertically, and 16 u = 32 tiles horizontally at the 960×600 web default.
- Typical level extent is x ≈ −10 to 70 u (about 160-177 tiles) by y ≈ −7.5 to 3 u. kitchen32 goes up to about +6.5 u.

### Extraction tool
`reference/analysis/tools/unity_scene.py <scene>` prints an ASCII grid with 0.5 u cells; `--json` dumps every entity with its world position, prefab, script fields and collider world AABBs. It needs PyYAML and should be run from the repository root.

Grid method:
1. Take every active GameObject on layer 12.
2. Transform each non-trigger Box, Polygon, Edge or Circle collider through the object's world matrix and fill the cells its AABB covers, with 0.25-cell tolerance.
3. Overlay markers for scripted entities.

### kitchen1 layout (extracted, 0.5 u cells, north up)
Legend:
- `#` solid Ground collider
- `@` player spawn (`level_start`)
- `L` Lucy
- `M` milk glass
- `Y` yoghurt pot
- `P` portal

The left-hand number is the world y of each row. Column 0 is at x = −10.5.

```
# grid origin (col 0,row 0 bottom-left) = world (-10.5, -7.5); cell = 0.5 u; 169x22
   3.0 .#.......................................................................................................................................................................
   2.5 .#.......................................................................................................................................................................
   2.0 .#.......................................................................................................................................................................
   1.5 .#.......................................................................................................................................................................
   1.0 .#.......................................................................................................................................................................
   0.5 .#.......................................................................................................................................................................
   0.0 .#.............................................................................................................................................................##........
  -0.5 .#..@..........................................................................................................................................................##........
  -1.0 .#.............................................................................................................................................................##........
  -1.5 .#.............................................................................................................................................................##........
  -2.0 .##########............................................................######################...................................................................#########
  -2.5 ..#########............................................................######################.....L.............................................................#########
  -3.0 ..#########............................................................##...........#########...................................................................#########
  -3.5 ..#########............................................................##...........#########...................................................................#########
  -4.0 ..####Y####..................................................############...........####M###############................................................P.......####Y####
  -4.5 ..#########..................................................############...........#####################.......................................................#########
  -5.0 ..#########.............................................L...........................###############...########...............L........#####.....................#########
  -5.5 ..#########.........................................................................###############...########........................###########...............#########
  -6.0 ..#########...................###########......###########..........................###############...############.......############.#####......#####..........#########
  -6.5 .########################################################################################################################################################################
  -7.0 .################################################################################################################################################################........
  -7.5 .################################################################################################################################################################........
```

**Reading the grid**
- Far left: a countertop rotated −90° forms a wall at x≈−10, from y −2 to +3.
- The player spawns at (−8.43,−0.44), above the left yoghurt pot. The pot is a 4.3×4.5 u solid block, x −9.5 to −5.3.
- The kitchen floor strip runs at y −7.2 to −6.2.
- Low countertops follow at y≈−6: x 4.8-9.8, 13.3-18.3 and 50.4-55.4.
- At x 20-26, a countertop at y −4.1 steps up to a vertical CurlyChip (rotated 84°) and the high countertop at y −1.8 (x 26.3-31.3).
- The milk glass is a solid 4.3×4.5 u block at x 31.6-35.9, next to the Loaf and a countertop at y −3.85 (x 34.9-41.0).
- Next come salt, cheese and toast at y≈−5.5, and then Chip and Sausage at x≈57-59.
- The portal is at (65.75,−3.87), a pepper pot is at x≈69, and the right-hand yoghurt pot is at 71.55. The camera's right clamp of 61.77 means the view ends at about x 69.8.
- The two floating `L`s show where Lucy spawns; she then falls onto the surface below.
- **Caveats:** cells are AABB-filled, so rotated or sloped pieces look boxier than they are. Decorative sprites without colliders, such as the background, are omitted.
