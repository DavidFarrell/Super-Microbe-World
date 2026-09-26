# Flash platform levels: data reference

**Status of this source:** CANONICAL. This file describes the level data of the 2009 Flash game (`reference/Junior_Game`) and how the AS2 runtime interprets it. The Unity remake is compared in section 5 only.

**Generated data:** `reference/analysis/levels.json`, written by `tools/analyse-levels.mjs` (no dependencies; run `node tools/analyse-levels.mjs` from the repository root; last run exited 0). The JSON holds, per level: file, name, cols, rows, next, goals, the file's own tile palette, the placed cells, the cells resolved through the runtime palette (movie, type, runtime class, footprint), counts, a `checks` array, derived physics caps and both ASCII renders. It also holds the parsed `tile_definitions.xml`, the SWF linkage bounds, the play order and the kitchen game data. The engineer should load the JSON rather than re-parse the XML.

**What was parsed:** 37 files in `reference/Junior_Game/levels` whose root element is `<level>`: the 11 `alpha_level*.xml` files, 23 older or test levels, two format notes (`xml format.as`, `desired xml format.as`) and the pre-release `Hello.xml`. Plus `levels/tile_definitions.xml` (114 entries), `movies/introductionToMicrobes_platformer.swf` (100 exports) and `movies/junior_game_assets.swf` (211 exports).

**Citations:** paths are relative to `reference/Junior_Game/src/ebug/` unless they start with `levels/`, `movies/`, `reference/` or `Assets/`.

---

## 0. How the Flash runtime reads a level (rules a port must copy)

1. **File location.** The level is loaded from `"../levels/" + nextLevel` (`junior/PlatformGame.as:242`). If no level is passed, `alpha_level1.xml` is used (`junior/PlatformGame.as:133`).
2. **Children are read by position, not by name.** `childNodes[0]` is taken as `<goals>`, `[1]` as `<tiles>`, `[2]` as `<rows>` (`MapBuilder.as:56-58`). Every `alpha_level*.xml` has that order. Several legacy files have no `<goals>` and would load no cells.
3. **The level's own `<tiles>` block is ignored.** `MapBuilder.parseXML` builds `level.tiles` from `tilesList`, the parse of `levels/tile_definitions.xml`, skipping erasers, and sets each tile's movie to the definition's `<icon>` (`MapBuilder.as:70-82`; the comment at `MapBuilder.as:41-42` says so). `TileDefinitionParser` reads each `<tile>` positionally: child 0 label, child 2 type string, child 3 icon, child 4 movie (`junior/TileDefinitionParser.as:426-429`), and maps the type string to a `Constants` value (`junior/TileDefinitionParser.as:433-506`; unknown strings become `GAME_ENTITY_TILE`). The eraser is the last definition (index 113), so cell ids 0 to 112 map one to one onto `tile_definitions.xml` order. The platformer loads that file in its first frame (`reference/docs/junior-game-documentation.md:716-740`).
   - In all 11 alpha levels the file's own palette has 113 entries and matches `tile_definitions.xml` exactly, except ids 69 and 108. Those two definitions have an empty `<icon>`; `convertLevelToXML` clones the base tile (id 0) and overwrites its movie text with the icon (`MapBuilder.as:226-255`), so with no icon the saved file keeps `C_Chip_L_Tile`. No alpha level places id 69 or 108. **A port can use either palette for the alpha levels; the JSON resolves through `tile_definitions.xml`.**
   - `super_colin`, `super_slarg` and `super_slurm` resolve to the plain types 15, 16 and 17 (`junior/TileDefinitionParser.as:464-472`). `soap_pickup` and `white_pickup` both become type 9 (`:479-486`).
4. **Entities are attached by their `<icon>` linkage** (`lucy_icon`, `portal_exit_icon`, `milk_glass_icon`), not by the `<movie>` column of `tile_definitions.xml` (`junior/PlatformGame.as:419`). The entity art is exported by `movies/introductionToMicrobes_platformer.swf`; the tile art is exported by `movies/junior_game_assets.swf`, which the platformer imports as a runtime shared library through the single symbol `shared_library_link`.
5. **Geometry versus entities.** A cell whose resolved type is 1 goes into `levelDataGeometry`; anything else goes into `levelDataEntities` (`MapBuilder.as:95-113`). A later definition of the same cell overwrites an earlier one (`MapBuilder.as:100`, `:112`); no alpha level has duplicates.
6. **A cell's box is its art's bounds, anchored at the cell's top-left.** Cell (row, col) sits at pixel (col*50, row*50) (`junior/PlatformGame.as:293`, `:418`; `Constants.as:22` `TILE_WIDTH = 50`). `createBoxParticle` sizes the box from the clip's `_width`/`_height` (`ParticleSystem.as:189-195`). Every tile clip has its registration at (0,0), and 37 of the 92 geometry linkages are larger than one cell (table in section 2). So `pepper_obj` placed at (0,0) is a solid 100x200 px pillar covering rows 0-3, cols 0-1. The XML's `<rows>1</rows><cols>1</cols>` does not describe this (see `reference/docs/junior-game-documentation.md:337`). The static collision query looks up to 4 rows up and 4 columns left of a body (`ParticleSystem.as:557-564`) precisely so that these large boxes are found.
7. **Sides, rows, cols, entity and script are dead fields.** In every alpha level every palette entry has sides left 1, right 1, top 1, bottom 0, rows 1, cols 1, entity 0, script `"1"`, and `MapBuilder` never reads them (`MapBuilder.as:71-82`). All geometry is solid on every side and there are no one-way platforms, as the documentation also says (`reference/docs/junior-game-documentation.md:335-341`).
8. **`bodyLevel` defaults to true.** `bodyLevel = (body_level == "false") ? false : true` (`MapBuilder.as:49`), so a missing attribute means a body level. It selects `WhitePickup` versus `SoapPickup` for type 9 (`junior/PlatformGame.as:468-472`) and the white versus soap projectile (`junior/PlatformGame.as:672-708`).
9. **Goals.** `new Goal(Number(goalType), microbeType, required)` (`MapBuilder.as:67`) passes `microbeType` and `required` as strings; AS2's loose `==` makes them work. Parse them as numbers. Handlers are in `junior/Goal.as:43-168`:
   - `0 PHOTOGRAPH_SPECIFIC`: counts a `BE_PHOTOGRAPHED` whose target `type == microbeType` (`junior/Goal.as:48-61`).
   - `1 PHOTOGRAPH_GOOD`: counts a photo of any `GoodMicrobe` instance, microbeType ignored (`junior/Goal.as:62-78`).
   - `2 PHOTOGRAPH_BAD` and `5 KILL_SPECIFIC`: **no handler**; such a goal can never be met.
   - `3 PHOTOGRAPH_ANY`: counts every photo (`junior/Goal.as:79-90`).
   - `4 KILL_ALL`: counts a `BE_KILLED` of any `BadMicrobe` instance, microbeType ignored (`junior/Goal.as:98-113`); the second `case KILL_ALL` at `:128` is unreachable.
   - `6 ANTIBIOTIC`: counts every `EXPLODE_ANTIBIOTIC`, whatever it hits (`junior/Goal.as:153-164`, called from `junior/PlatformGame.as:874-879`).
   - `7 YOGURT`: counts every `MILK_GLASS_EVENT_TURN_TO_YOGURT` (`junior/Goal.as:141-152`).
   - `isGoalMet` is `achieved == required` (`junior/Goal.as:35-41`), so overshooting in one frame never completes it.
   - Runtime classes: Lucy is `LucyLactobacillus extends GoodMicrobe`; Sandy, Steve, Patty (and types 3, 4) are `GoodMicrobe`; Colin, Donna, Iggy, Slarg, Slurm (and type 5) are `BadMicrobe`; `SuperInfection extends BadMicrobe` (`junior/PlatformGame.as:424-524`, `junior/LucyLactobacillus.as:12`, `junior/SuperInfection.as:12`).
   - When all goals are met and the portal is closed, the last goal is popped, the phone shows `exit_status` and the portal is sent `PORTAL_EVENT_OPEN` (`junior/PlatformGame.as:575-593`). The phone GUI only reads `goals[0]` (`junior/PlatformGame.as:331-362`).
10. **Player start and exit.** The last `player_start` in document order wins (`MapBuilder.as:103-110`); with none, `playerPosition` is undefined (`junior/PlatformGame.as:373`). `portalId` starts at 0, which is the player, and the last portal created wins (`junior/PlatformGame.as:117`, `:498`). Every alpha level has exactly one of each.
11. **World and screen.** `worldMin = (0, -100)`, `worldMax = (cols*50, 450)` (`junior/PlatformGame.as:260-261`). The screen is 800x450 (`Constants.as:23-24`) and scrolls horizontally only (`Game.as:56-69`), when the player's clip passes 250 px or 450 px from the left (`junior/PlatformGame.as:45-46`, `:1029-1050`). The `ParticleSystem` is built with `wMax = null`, so its collision grid `levelTileArray` is 9 rows by 16 columns at construction (`junior/PlatformGame.as:153`, `ParticleSystem.as:155`, `:166-179`); rows 9 and beyond can never collide. **Only rows 0-8 exist in play**, whatever `rows` says.
12. **Loop bounds.** Physics boxes are made for `row < rows` and `col <= cols` (inclusive, `junior/PlatformGame.as:288-289`). Drawing covers `row < rows` and any column near the screen, with no `cols` bound (`junior/PlatformGame.as:1081-1090`). Entities are created for every stored cell, with no bounds (`junior/PlatformGame.as:408-409`).
13. **Per level:** 180 s timer (`junior/PlatformGame.as:148`), 3 lives (`junior/PlatformGame.as:381`), `next="exit"` returns to the quiz (`junior/PlatformGame.as:1231-1242`).
14. **The `name` attribute is functional.** `ePhone.grow(level.name)` (`junior/PlatformGame.as:545`) calls `bigScreen.gotoAndPlay(name)` (`general/EPhone.as:16-20`). The intro clip (sprite 1479 in `movies/introductionToMicrobes_platformer.swf`) has frame labels `level1` (frame 1), `level2` (40), `level3` (50), `level4` (70), `level5` (90), `level6` (110), `level7` (140), `level8` (190), `level9` (221), `level10` (241). There is no `level11`.

---

## 1. Levels in play order

**How the order arises.** `GameController.init` pushes the start of each platform round (`junior/GameController.as:65-69`): `alpha_level1.xml`, `alpha_level5.xml`, `alpha_level8.xml`, `NULL_KITCHEN_GAME`, `alpha_level10.xml`. After each blind quiz round, `showHoverboardOrKitchen` (`junior/GameController.as:206-216`) either shows the kitchen (when `round == 2`, bumping it to 3) or calls `nextHoverboardRound`, which increments `round` except on the first call (`junior/GameController.as:238-263`). The quiz has five rounds (`levels/alpha_gameshow_round1.xml` to `round5.xml`, chained by `<next_round>`). Within a platform round, each level's `next` is followed until `"exit"` (`junior/PlatformGame.as:1231-1246`). Round topics come from the designer's plan (`levels/plan2.txt:3-20`).

| # | Quiz round (topic) | File (`name`) | cols x rows (px) | next | Setting | body_level attr: runtime | Goal as written | Goal in plain English | Targets placed |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 (general microbes) | `alpha_level1.xml` (`level1`) | 69 x 9 (3450 x 450) | `alpha_level2.xml` | kitchen | absent: **true** | type 0, microbe 11, req 3 | Photograph 3 Lucy | 3 Lucy |
| 2 | 1 | `alpha_level2.xml` (`level2`) | 44 x **11** (2200 x 450 usable) | `alpha_level3.xml` | skin | absent: **true** | type 1, microbe 11, req 3 | Photograph 3 good microbes (microbe 11 ignored) | 3 Lucy (the only good microbes) |
| 3 | 1 | `alpha_level3.xml` (`level3`) | 44 x **11** (2200 x 450 usable) | `alpha_level4.xml` | skin | absent: **true** | type 0, microbe 14, req 3 | Photograph 3 Steve | 3 Steve |
| 4 | 1 | `alpha_level4.xml` (`level4`) | 69 x 9 | `exit` | kitchen | absent: **true** | type 0, microbe 13, req 3 | Photograph 3 Patty | 3 Patty |
| 5 | 2 (good and bad) | `alpha_level5.xml` (`level5`) | 69 x 9 | `alpha_level6.xml` | skin | `false`: false | type 4, microbe 17, req 3 | Kill any 3 bad microbes; soap level (microbe 17, Slurm, is ignored) | 4 Slurm (bad), 1 Steve (good) |
| 6 | 2 | `alpha_level6.xml` (`level6`) | 69 x 9 | `alpha_level7.xml` | skin | `false`: false | type 4, microbe 17, req 3 | Kill any 3 bad microbes; soap level | 2 Slurm, 1 Slarg, 1 Donna (4 bad) |
| 7 | 2 | `alpha_level7.xml` (`level7`) | 75 x 9 | `exit` | body | `true`: true | type 4, microbe 17, req 3 | Kill any 3 bad microbes; white blood cell level | 3 Iggy (exactly 3) |
| 8 | 3 (usefulness) | `alpha_level8.xml` (`level8`) | 37 x 9 | `alpha_level9.xml` | kitchen | `true`: true | type 7, microbe 17, req 1 | Turn 1 glass of milk into yoghurt (push Lucy into it) | 1 milk glass, 4 Lucy |
| 9 | 3 | `alpha_level9.xml` (`level9`) | 64 x 9 | `exit` | kitchen | `true`: true | type 7, microbe 17, req 3 | Turn 3 glasses of milk into yoghurt | 3 milk glasses, 6 Lucy |
| K | 4 (food hygiene) | `NULL_KITCHEN_GAME` | - | - | kitchen (fridge game) | - | - | Four timed fridge-sorting levels (section 1.2) | - |
| 10 | 5 (antibiotics) | `alpha_level10.xml` (`level10`) | 46 x 9 | `exit` | body | `true`: true | type 6, microbe 17, req 6 | Set off 6 antibiotics (each detonation counts) | 6 antibiotic pickups; superinfection has 6 lives |
| - | not reachable | `alpha_level11.xml` (`level11`) | 35 x 9 | `exit` | body | `true`: true | type 4, microbe 17, req 6 | Kill any 6 bad microbes | **only 5 bad** (2 Iggy, 2 Slurm, 1 Donna) |

Notes on the goal column:
- Before play starts the phone grows and plays the intro at the frame labelled with the level's `name` (rule 14); the level waits in `STATE_INIT_DIALOGUE` until `bigScreen.finished` (`junior/PlatformGame.as:540-551`). All ten played names have a label.
- A yoghurt glass converts on the first Lucy hit and never again: `counterCeiling = 1` and only `WHITE_STATUS` reacts (`junior/MilkGlassEntity.as:24`, `:73-90`). A Lucy that is already diving does not count (`junior/MilkGlassEntity.as:64-69`).
- An antibiotic pickup can only be taken when the player is not already holding one, and it does not respawn (`junior/AntibioticPickup.as:48-58`). So level 10 has exactly the 6 detonations it needs and no spare. The goal counts detonations, not damage: the superinfection starts with `lives = 6` (`junior/SuperInfection.as:26`) and loses one per detonation only if it is on screen (`junior/PlatformGame.as:829-864`, `junior/SuperInfection.as:88-89`), so the portal can open with it still alive.
- Antibiotic blasts kill on-screen Lucy, Sandy, Steve, Slurm, Slarg and Colin, but not Iggy, Donna or Patty (`junior/PlatformGame.as:831-836`). So the Iggy in level 10 survives every blast, which fits the lesson that antibiotics do not work on viruses.

### 1.1 Entity counts by type (resolved through the runtime palette)

| Level | Geometry cells | Player start (row,col) | Exit (row,col) | Lucy | Steve | Patty | Slurm | Slarg | Donna | Iggy | Superinf. | Milk glass | Soap | White | Antibiotic | Good / bad (class) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | 90 | 1,6 | 5,56 | 3 |  |  |  |  |  |  |  |  |  |  |  | 3 / 0 |
| L2 | 127 | 4,3 | 5,36 | 3 |  |  |  |  |  |  |  |  |  |  |  | 3 / 0 |
| L3 | 120 | 2,2 | 4,41 |  | 3 |  |  |  |  |  |  |  |  |  |  | 3 / 0 |
| L4 | 97 | 4,5 | 5,46 |  |  | 3 |  |  |  |  |  |  |  |  |  | 3 / 0 |
| L5 | 121 | 3,1 | 3,63 |  | 1 |  | 4 |  |  |  |  |  | 15 |  |  | 1 / 4 |
| L6 | 128 | 3,6 | 4,51 |  |  |  | 2 | 1 | 1 |  |  |  | 17 |  |  | 0 / 4 |
| L7 | 207 | 3,5 | 2,71 |  |  |  |  |  |  | 3 |  |  |  | 21 |  | 0 / 3 |
| L8 | 71 | 2,3 | 1,31 | 4 |  |  |  |  |  |  |  | 1 |  |  |  | 4 / 0 |
| L9 | 80 | 1,7 | 4,57 | 6 |  |  |  |  |  |  |  | 3 |  |  |  | 6 / 0 |
| L10 | 140 | 3,3 | 2,37 | 1 |  |  | 1 |  |  | 1 | 1 |  |  |  | 6 | 1 / 3 |
| L11 (orphan) | 94 | 1,9 | 4,34 |  | 1 |  | 2 |  | 1 | 2 |  |  |  | 8 | 5 | 1 / 5 |

"Good / bad (class)" counts runtime classes (rule 9); level 10's bad count includes the superinfection.

### 1.2 The kitchen round (no level file)

There is no kitchen level data file. `KitchenGame` generates each level at random in code; the full data is in `levels.json` under `kitchen`.

| Kitchen level | Items | Time (s) | Categories drawn | Category odds (`Math.round(Math.random()*n)`) | Sneezes | Source |
|---|---|---|---|---|---|---|
| 0 | 10 | 60 | vegetables, door | 1/2 each | no | `junior/fridge/KitchenGame.as:910-935` |
| 1 | 10 | 60 | vegetables, door, fruit, cupboard | veg 1/6, door 1/3, fruit 1/3, cupboard 1/6 | yes | `junior/fridge/KitchenGame.as:936-971` |
| 2 | 10 | 60 | all seven | veg 1/12; door, fruit, cupboard, raw meat, cheese 1/6 each; cooked meat 1/12 | yes | `junior/fridge/KitchenGame.as:972-1022` |
| 3 | 20 | 120 | all seven | as level 2 | yes | `junior/fridge/KitchenGame.as:1023-1074` |

- The game starts with `nextLevel(0)` (`junior/fridge/KitchenGame.as:1159`) and exits after level 3 (`if ( level > 3 )`, `junior/fridge/KitchenGame.as:825`). The time is `timeLeft = 120` for level 3, else 60 (`junior/fridge/KitchenGame.as:844-848`). The in-code comments ("30 seconds", "45 seconds") are wrong.
- Within a category the item is `category[Math.round(Math.random()*(length-1))]`, so the first and last items of each category are half as likely as the others.
- Sneezing: each second in `STATE_WAIT`, `if (GeneralFunctions.getRandom(0,10) > sneezeChance)` sneeze and `sneezeChance++` (`junior/fridge/KitchenGame.as:153-160`; `getRandom` is `Math.round(Math.random()*(max-min))+min`, `util/GeneralFunctions.as:3-5`). `sneezeChance = 7` from level 1 (`junior/fridge/KitchenGame.as:857-860`), giving 0.25, then 0.15, then 0.05, then 0 per second. On level 0 it is undefined, so the test is false and there are no sneezes. `levelSneezes` is set but never read.
- 26 food items (`junior/fridge/KitchenGame.as:1236-1285`): mouldy bread, burst yogurt and mouldy orange are spoiled; the four raw meats carry meat microbes. "Orange Juice" appears twice (`:1256`, `:1282`) and "Apple" twice (red and green). Valid places are at `junior/fridge/KitchenGame.as:1204-1230`: fruit in the bowl, vegetables in the drawer, cupboard items in the cupboard, cheese on the upper or middle shelf, door items in the door, raw meat on the lower shelf, cooked meat on the middle or upper shelf.

---

## 2. Tile linkage names and usage

The 113 runtime definitions (ids 0-112 of `levels/tile_definitions.xml`), grouped by setting, with the number of cells that place each one. "Box px" is the union of frame-1 child bounds read from the SWF, which approximates the clip `_width` x `_height` that becomes the physics box (rule 6). Blank ids 69 and 108 and the eraser (113) are omitted.

**Kitchen**

| id | Linkage (`<icon>`) | Label | Box px (frame 1) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | Total L1-L10 | L11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | `C_Chip_L_Tile` | Crinkle Chip Left | 50x50 | 1 |  |  | 1 |  |  |  | 1 | 2 |  | 5 |  |
| 1 | `C_Chip_Mid_Tile` | Crinkle Chip Mid | 50x50 | 2 |  |  | 1 |  |  |  | 1 | 2 |  | 6 |  |
| 2 | `C_Chip_R_Tile` | Crinkle Chip Right | 50x50 | 1 |  |  | 1 |  |  |  | 1 | 2 |  | 5 |  |
| 3 | `Cheese_L_Tile` | Cheese Left | 50x50 | 1 |  |  | 1 |  |  |  |  | 1 |  | 3 |  |
| 4 | `Cheese_Mid_Tile` | Cheese Mid | 50x50 | 2 |  |  | 1 |  |  |  |  | 1 |  | 4 |  |
| 5 | `Cheese_R_Tile` | Cheese Right | 50x50 | 1 |  |  | 1 |  |  |  |  | 1 |  | 3 |  |
| 6 | `Chip_L_Tile` | Chip Left | 50x50 | 1 |  |  | 1 |  |  |  | 1 | 1 |  | 4 |  |
| 7 | `Chip_Mid_Tile` | Chip Mid | 50x50 | 3 |  |  | 1 |  |  |  | 2 | 1 |  | 7 |  |
| 8 | `Chip_R_Tile` | Chip Right | 50x50 | 1 |  |  | 1 |  |  |  | 1 | 1 |  | 4 |  |
| 9 | `Chop_L_Tile` | Chopping Board Left | 50x50 |  |  |  | 1 |  |  |  | 1 | 1 |  | 3 |  |
| 10 | `Chop_Mid1_Tile` | Chopping Board M1 | 50x50 |  |  |  | 3 |  |  |  | 1 |  |  | 4 |  |
| 11 | `Chop_Mid2_Tile` | Chopping Board M2 | 50x50 |  |  |  | 2 |  |  |  | 2 | 1 |  | 5 |  |
| 12 | `Chop_Mid3_Tile` | Chopping Board M3 | 50x50 |  |  |  | 1 |  |  |  | 2 |  |  | 3 |  |
| 13 | `Chop_R_Tile` | Chopping Board Right | 50x50 |  |  |  | 1 |  |  |  | 1 | 1 |  | 3 |  |
| 14 | `loaf_end_L_obj` | Bread Left | 50x200 | 1 |  |  | 2 |  |  |  |  |  |  | 3 |  |
| 15 | `loaf_mid_obj` | Bread Middle | 50x200 | 2 |  |  | 2 |  |  |  |  |  |  | 4 |  |
| 16 | `loaf_mid_mould_obj` | Bread Mould 1 | 50x200 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 17 | `loaf_mid_mould2_obj` | Bread Mould 2 | 50x200 |  |  |  | 2 |  |  |  |  |  |  | 2 |  |
| 18 | `loaf_mid_mould3_obj` | Bread Mould 3 | 50x200 |  |  |  | 2 |  |  |  |  |  |  | 2 |  |
| 19 | `loaf_end_R_obj` | Bread Right | 50x200 | 1 |  |  | 2 |  |  |  |  |  |  | 3 |  |
| 20 | `pepper_obj` | Pepper Whole | 100x200 | 2 |  |  | 3 |  |  |  | 2 | 1 |  | 8 |  |
| 21 | `salt_obj` | Salt Whole | 100x200 | 2 |  |  | 1 |  |  |  | 2 | 1 |  | 6 |  |
| 22 | `Sausage_L_Tile` | Sausage Left | 50x50 | 1 |  |  | 1 |  |  |  | 2 | 1 |  | 5 |  |
| 23 | `Sausage_Mid_Tile` | Sausage Mid | 50x50 | 2 |  |  | 3 |  |  |  | 2 | 1 |  | 8 |  |
| 24 | `Sausage_R_Tile` | Sausage Right | 50x50 | 1 |  |  | 1 |  |  |  | 2 | 1 |  | 5 |  |
| 25 | `Sugar_Tile` | Sugar | 50x50 |  |  |  | 4 |  |  |  | 11 | 6 |  | 21 |  |
| 26 | `toast_jam_obj` | Jammy Toast | 250x50 |  |  |  | 2 |  |  |  |  | 1 |  | 3 |  |
| 27 | `toast_marm_obj` | Butter Toast | 250x50 |  |  |  |  |  |  |  |  | 1 |  | 1 |  |
| 28 | `Unit_1_Tile` | Unit Left 1 | 50x50 | 2 |  |  | 2 |  |  |  | 1 | 2 |  | 7 |  |
| 29 | `Unit_4_Tile` | Unit Left 2 | 50x50 | 2 |  |  | 3 |  |  |  | 1 | 1 |  | 7 |  |
| 30 | `Unit_2_Tile` | Unit Mid 1 | 50x50 | 21 |  |  | 17 |  |  |  | 22 | 28 |  | 88 |  |
| 31 | `Unit_5_Tile` | Unit Mid 2 | 50x50 | 15 |  |  | 27 |  |  |  | 3 | 5 |  | 50 |  |
| 32 | `Unit_3_Tile` | Unit Right 1 | 50x50 | 2 |  |  | 2 |  |  |  | 1 | 2 |  | 7 |  |
| 33 | `Unit_6_Tile` | Unit Right 2 | 50x50 | 2 |  |  | 3 |  |  |  |  | 1 |  | 6 |  |
| 34 | `Yog_L_Tile` | Yogurt Left | 50x50 | 4 |  |  |  |  |  |  | 2 | 2 |  | 8 |  |
| 35 | `Yog_Mid_Tile` | Yogurt Mid | 50x50 | 9 |  |  |  |  |  |  | 4 | 6 |  | 19 |  |
| 36 | `Yog_R_Tile` | Yogurt Right | 50x50 | 4 |  |  |  |  |  |  | 2 | 2 |  | 8 |  |
| 37 | `yoghurt_lid_obj` | Yogurt Lid | 150x150 | 1 |  |  |  |  |  |  |  | 1 |  | 2 |  |
| 38 | `yoghurt_obj` | Yogurt Carton | 150x150 | 3 |  |  | 1 |  |  |  |  | 2 |  | 6 |  |

**Skin**

| id | Linkage (`<icon>`) | Label | Box px (frame 1) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | Total L1-L10 | L11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 72 | `hair_base_obj` | Hair Base | 50x100 |  | 5 | 4 |  | 2 | 2 |  |  |  |  | 13 |  |
| 73 | `hair_vert_obj` | Hair Vertical | 50x50 |  | 8 | 9 |  | 9 | 7 |  |  |  |  | 33 |  |
| 74 | `hair_slope_start_obj` | Hair Slope Start | 100x100 |  | 5 | 4 |  | 3 | 2 |  |  |  |  | 14 |  |
| 75 | `hair_slope_obj` | Hair Slope Mid 1 | 100x50 |  |  | 1 |  |  | 1 |  |  |  |  | 2 |  |
| 76 | `hair_slope_end_obj` | Hair Slope Mid 2 | 100x50 |  | 4 | 5 |  | 1 |  |  |  |  |  | 10 |  |
| 77 | `hair_horiz_obj` | Hair Horizontal | 50x50 |  |  | 5 |  | 5 |  |  |  |  |  | 10 |  |
| 78 | `hair_horiz_end_obj` | Hair Horizontal End | 100x50 |  | 4 | 4 |  | 1 |  |  |  |  |  | 9 |  |
| 79 | `lint_ball_obj` | Lint Ball | 50x50 |  | 2 |  |  | 1 |  |  |  |  |  | 3 |  |
| 80 | `plaster_singular_obj` | Plaster Whole | 200x50 |  | 4 | 1 |  | 6 | 1 |  |  |  |  | 12 |  |
| 81 | `plaster_multi_start_obj` | Plaster Multi Start | 150x50 |  |  | 1 |  | 1 |  |  |  |  |  | 2 |  |
| 82 | `plaster_multi_mid_obj` | Plaster Multi Mid 1 | 100x50 |  |  | 1 |  |  |  |  |  |  |  | 1 |  |
| 83 | `plaster_multi_bridge_obj` | Plaster Multi Mid 2 | 50x50 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 84 | `plaster_multi_end_obj` | Plaster Multi End | 150x50 |  |  | 1 |  | 1 |  |  |  |  |  | 2 |  |
| 85 | `scab_obj` | Scab | 200x100 |  | 1 | 1 |  | 2 | 2 |  |  |  |  | 6 |  |
| 86 | `skin_base_tile` | Skin 1 | 50x50 |  | 57 | 53 |  | 52 | 57 |  |  |  |  | 219 |  |
| 87 | `skin_surface_tile` | Skin 2 | 50x50 |  | 34 | 30 |  | 33 | 49 |  |  |  |  | 146 |  |
| 88 | `splinter_obj` | Splinter | 50x250 |  |  |  |  | 1 | 2 |  |  |  |  | 3 |  |
| 89 | `spot_large_obj` | Large Spot | 100x100 |  | 1 |  |  | 1 | 1 |  |  |  |  | 3 |  |
| 90 | `spot_ooze_obj` | Oozy Spot | 100x100 |  |  |  |  |  | 2 |  |  |  |  | 2 |  |
| 91 | `spot_small_obj` | Small Spot | 50x50 |  | 2 |  |  | 1 | 1 |  |  |  |  | 4 |  |
| 92 | `wart_obj` | Wart | 100x100 |  |  |  |  | 1 | 1 |  |  |  |  | 2 |  |

**Body**

| id | Linkage (`<icon>`) | Label | Box px (frame 1) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | Total L1-L10 | L11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 39 | `acid_pit_start_obj` | Acid Pit Left | 100x150 |  |  |  |  |  |  |  |  |  | 1 | 1 |  |
| 40 | `acid_pit_mid_obj` | Acid Pit Mid | 100x148 |  |  |  |  |  |  |  |  |  | 1 | 1 |  |
| 41 | `acid_pit_end_obj` | Acid Pit Right | 100x150 |  |  |  |  |  |  |  |  |  | 1 | 1 |  |
| 42 | `bone_start_obj` | Bone Left | 100x100 |  |  |  |  |  |  |  |  |  |  | 0 | 1 |
| 43 | `bone_mid_obj` | Bone Mid | 50x100 |  |  |  |  |  |  |  |  |  |  | 0 | 3 |
| 44 | `bone_end_obj` | Bone Right | 100x100 |  |  |  |  |  |  |  |  |  |  | 0 | 1 |
| 45 | `bubble_obj` | Bubble | 50x50 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 46 | `cell_front_obj` | Red Cell Front | 50x50 |  |  |  |  |  |  | 7 |  |  | 1 | 8 | 8 |
| 47 | `cell_side_obj` | Red Cell Side | 50x50 |  |  |  |  |  |  | 9 |  |  | 9 | 18 | 15 |
| 48 | `corner_l_tile` | Red Left | 50x50 |  |  |  |  |  |  | 1 |  |  | 3 | 4 | 2 |
| 49 | `flesh_gristle_1_tile` | Gristle Mid 1 | 50x50 |  |  |  |  |  |  | 1 |  |  | 1 | 2 | 2 |
| 50 | `flesh_gristle_2_tile` | Gristle Mid 2 | 50x50 |  |  |  |  |  |  | 1 |  |  |  | 1 |  |
| 51 | `flesh_gristle_3_tile` | Gristle Mid 3 | 100x50 |  |  |  |  |  |  | 1 |  |  |  | 1 | 1 |
| 52 | `flesh_gristle_4_tile` | Gristle Mid 4 | 50x100 |  |  |  |  |  |  | 2 |  |  |  | 2 |  |
| 53 | `flesh_gristle_5_tile` | Gristle Mid 5 | 50x50 |  |  |  |  |  |  | 1 |  |  |  | 1 | 2 |
| 54 | `flesh_gristle_6_tile` | Gristle Mid 6 | 50x50 |  |  |  |  |  |  | 1 |  |  |  | 1 |  |
| 55 | `corner_r_tile` | Red Right | 50x50 |  |  |  |  |  |  | 4 |  |  | 3 | 7 | 2 |
| 56 | `flesh_tile` | Fleshy Tile 1 | 50x50 |  |  |  |  |  |  | 36 |  |  | 33 | 69 | 20 |
| 57 | `floor_a_tile` | Fleshy Tile 2 | 50x50 |  |  |  |  |  |  | 11 |  |  | 6 | 17 | 9 |
| 58 | `floor_b_tile` | Fleshy Tile 3 | 50x50 |  |  |  |  |  |  | 10 |  |  | 6 | 16 | 9 |
| 59 | `platform_start_obj` | Fleshy Platform Left | 50x50 |  |  |  |  |  |  | 6 |  |  | 2 | 8 | 2 |
| 60 | `platform_mid_obj` | Fleshy Platform Middle | 100x50 |  |  |  |  |  |  | 10 |  |  | 3 | 13 | 5 |
| 61 | `platform_bridge_obj` | Fleshy Platform Bridge | 50x50 |  |  |  |  |  |  | 4 |  |  | 1 | 5 | 3 |
| 62 | `platform_end_obj` | Fleshy Platform Right | 50x50 |  |  |  |  |  |  | 7 |  |  | 2 | 9 | 2 |
| 63 | `roof_a_tile` | Roof 1 | 50x50 |  |  |  |  |  |  | 35 |  |  | 19 | 54 |  |
| 64 | `roof_b_tile` | Roof 2 | 50x50 |  |  |  |  |  |  | 32 |  |  | 18 | 50 |  |
| 65 | `vertical_b_r_tile` | Wall Left 1 | 50x50 |  |  |  |  |  |  | 9 |  |  | 6 | 15 | 1 |
| 66 | `vertical_b_l_tile` | Wall Right 1 | 50x50 |  |  |  |  |  |  | 1 |  |  | 6 | 7 | 1 |
| 67 | `vertical_a_r_tile` | Wall Left 2 | 50x50 |  |  |  |  |  |  | 10 |  |  | 7 | 17 | 2 |
| 68 | `vertical_a_l_tile` | Wall Right 2 | 50x50 |  |  |  |  |  |  | 1 |  |  | 7 | 8 | 2 |
| 70 | `villi_floor_obj` | Villi Floor | 100x100 |  |  |  |  |  |  | 2 |  |  |  | 2 | 1 |
| 71 | `villi_roof_obj` | Villi Roof | 100x100 |  |  |  |  |  |  | 5 |  |  | 4 | 9 |  |

**Entities** (type from the `<type>` string; the class chosen at runtime is in rule 9)

| id | Linkage (`<icon>`) | Label | Box px (frame 1) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | Total L1-L10 | L11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 93 | `lucy_icon` | Lucy Lactobacillus | 42.32x97.58 | 3 | 3 |  |  |  |  |  | 4 | 6 | 1 | 17 |  |
| 94 | `steve_icon` | Steve Staphylococcus | 74.1x72.94 |  |  | 3 |  | 1 |  |  |  |  |  | 4 | 1 |
| 95 | `colin_icon` | Colin Campylobacter | not exported |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 96 | `donna_icon` | Donna Dermatophyte | 100.42x147.74 |  |  |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 97 | `iggy_icon` | Iggy Influenza | 47.96x48.64 |  |  |  |  |  |  | 3 |  |  | 1 | 4 | 2 |
| 98 | `patty_icon` | Patty Pennicillium | 187.89x141.53 |  |  |  | 3 |  |  |  |  |  |  | 3 |  |
| 99 | `sandy_icon` | Sandy Streptococcus | 90.08x226.05 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 100 | `slurm_icon` | Slurm Staphyloccocus | 75.64x72.44 |  |  |  |  | 4 | 2 |  |  |  | 1 | 7 | 2 |
| 101 | `slarg_icon` | Slarg Staphyloccus | 90.37x225.48 |  |  |  |  |  | 1 |  |  |  |  | 1 |  |
| 102 | `superinfection_icon` | Superinfection | 409.15x195.42 |  |  |  |  |  |  |  |  |  | 1 | 1 |  |
| 103 | `super_colin_icon` | Super Campy | 50.51x98.05 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 104 | `super_slarg_icon` | Super Slarg | not exported |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 105 | `super_slurm_icon` | Super Slurm | 75.64x72.43 |  |  |  |  |  |  |  |  |  |  | 0 |  |
| 106 | `milk_glass_icon` | Milk Glass | 150x200 |  |  |  |  |  |  |  | 1 | 3 |  | 4 |  |
| 107 | `portal_exit_icon` | Portal 1 | 103.6x163.8 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 10 | 1 |
| 109 | `soap_pickup` | Soap | 36.1x44.1 |  |  |  |  | 15 | 17 |  |  |  |  | 32 |  |
| 110 | `white_pickup` | White Blood Cell | 39.1x42.1 |  |  |  |  |  |  | 21 |  |  |  | 21 | 8 |
| 111 | `player_start` | Player | 31.2x53.6 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 10 | 1 |
| 112 | `antibiotic_pickup` | Antibiotic Pickup | 38.3x16.3 |  |  |  |  |  |  |  |  |  | 6 | 6 | 5 |

- **Never placed in L1-L10:** `loaf_mid_mould_obj` (16), `bone_start_obj`, `bone_mid_obj`, `bone_end_obj` (42-44, used only in the orphan L11), `bubble_obj` (45), `plaster_multi_bridge_obj` (83), `colin_icon` (95), `sandy_icon` (99), `super_colin_icon` (103), `super_slarg_icon` (104), `super_slurm_icon` (105), blank 69 and `entrance_portal` 108. So Colin, Sandy and every "super" variant never appear in the shipped levels.
- **No exported symbol anywhere:** `colin_icon` and `super_slarg_icon`. `attachMovie` would return nothing, `createBoxParticle` would return null (`ParticleSystem.as:188-189`, `:235-239`) and the entity would have no particle. Neither is placed in a played level.
- `entrance_portal` (108) has no branch in `STATE_CREATE_ENTITIES`, so an undefined entity would be pushed (`junior/PlatformGame.as:526-527`). Only the legacy `spare level.xml` places one.
- Legacy palettes also use `blue_box`, `green_box`, `red_box`, `tile_test`, `default_clip`, `new_tile`, `avatar`, `portal_exit`, `lucy_lactobacillus`, `steve`, the typo `yoghurt_ld_obj` (`levels/lacto.xml`) and an older sliced kitchen set (`kitchen_pepper_r1c1`, `kitchen_salt_r3c2`, `kitchen_jamtoast_left` and so on, 46 names). None of these is in `tile_definitions.xml`.

---

## 3. ASCII renders

One character per 50 px cell. Row 0 is the top. Rows marked `!` are at or beyond row 9 and cannot be seen or collided with (rule 11). Geometry is drawn with its full box (rule 6); `levels.json` also has `asciiAnchors`, which shows only the XML cells. Entity letters mark the anchor cell (top-left of the entity's clip); entity clips are larger than a cell (Lucy about 42x98 px, the portal about 104x164 px, the milk glass 150x200 px, the superinfection about 409x195 px).

- `#` geometry tile: the XML (anchor) cell, i.e. the top-left of its box
- `+` further cells covered by that geometry tile's box (clip bounds wider or taller than 50 px)
- `P` player_start
- `E` portal_exit_icon (exit portal)
- `L` Lucy (good)
- `Y` Sandy (good)
- `T` Steve (good)
- `A` Patty (good)
- `C` Colin (bad)
- `D` Donna (bad)
- `I` Iggy (bad)
- `G` Slarg (bad)
- `U` Slurm (bad)
- `c` super_colin (type 15)
- `g` super_slarg (type 16)
- `u` super_slurm (type 17)
- `X` superinfection
- `M` milk_glass
- `o` soap_pickup (ammo)
- `w` white_pickup (ammo)
- `a` antibiotic_pickup
- `?` blank or unknown id
- `.` empty

**Level 1 (`alpha_level1.xml`, kitchen, photograph 3 Lucy)**

```text
    0         1         2         3         4         5         6        
    012345678901234567890123456789012345678901234567890123456789012345678
 0  #+.........................................................#+........
 1  ++....P......................................L.............++........
 2  ++............................................##...........++........
 3  ++####....................................######++.........++........
 4  #+#######......................................+++.........#+........
 5  ++++++#++..............L................#++....+++......E..++........
 6  +++++++++..........................#####+++....#++...L.....++........
 7  +++++++++....####...#######.....####....+++....+++.........++........
 8  ################.##########..#########.........+++..#########........
```

**Level 2 (`alpha_level2.xml`, skin, photograph 3 good microbes)**

```text
    0         1         2         3         4      
    01234567890123456789012345678901234567890123456
 0  .#+..........L..........................#+#+...
 1  .++.............#+++#+#+...............#+......
 2  .#.........#+++#+#+#+..................++......
 3  .#............#+...++..................#.......
 4  .#.P..L..#+++.++...#....#+......#+#+...#.......
 5  .#......#.....##+++#....++..L.##+...E..#.......
 6  #+#############++++#######...#.++......#.......
 7  ################################......##.......
 8  #######################################+...#+++
 9! ...............................................
10! ...............................................
```

**Level 3 (`alpha_level3.xml`, skin, photograph 3 Steve)**

```text
    0         1         2         3         4       
    012345678901234567890123456789012345678901234567
 0  #+............................................#+
 1  ++...........................................#+.
 2  #.P.......#+++............T..................++.
 3  #..............T.............................#..
 4  #......#+++#+#+.......#+#####+.#+#+T.....E...#..
 5  +######++++#.#++#+#++#+.......#+.............#..
 6  #####################++.......++#+##+........#..
 7  ######################........##+............#..
 8  #####################+........################..
 9! ................................................
10! ................................................
```

**Level 4 (`alpha_level4.xml`, kitchen, photograph 3 Patty)**

```text
    0         1         2         3         4         5         6        
    012345678901234567890123456789012345678901234567890123456789012345678
 0  ...#+..................................................#+............
 1  ...++..................................................++............
 2  ...++..................................................++............
 3  ...++..................................................++............
 4  ...#+P.....A..#####.#####.......#####..................#+............
 5  #++++.........+++++###.A.......#+++++.#++++...E....A...++............
 6  +++++...###...+++++...........##+++++#.................++............
 7  +++++########.+++++........#+++++++++.....###..........++............
 8  #############.###########.###########.###########.########...........
```

**Level 5 (`alpha_level5.xml`, skin, kill 3 bad)**

```text
    0         1         2         3         4         5         6        
    012345678901234567890123456789012345678901234567890123456789012345678
 0  #+................................................................#+.
 1  ++.........................................o.o....................++.
 2  #..........................................#+++..o.o.o............#..
 3  #P........o.o.o......U..................o.......#++#++.........E..#..
 4  #.....o.o###+++...................................................#..
 5  #..o.o#++++.#+++#+######+..............U.#+T..U.............U.....#..
 6  ######+++++....#+.........#+++..........#++.........##+.......#+++#..
 7  ##########+....++..............o.o...################++###########+..
 8  ##########+....#...............#+++################################..
 9! .....................................................................
10! .....................................................................
11! .....................................................................
12! .................................................................#...
```

**Level 6 (`alpha_level6.xml`, skin, kill 3 bad)**

```text
    0         1         2         3         4         5         6        
    012345678901234567890123456789012345678901234567890123456789012345678
 0  .....#+................................................#+............
 1  ....#+.................................................++............
 2  ....++.................................................#.............
 3  ....#.P.................oooo#..............G..........##.............
 4  ....#.......oo.D........#++++......................E..+#.............
 5  ....#.......#+........#+....+.U.......U..#+...........+#.............
 6  #+++#oooooo#++....oo..++....+.....#+o.o.o++..#+++.....+#.............
 7  ##################################++#########++++######+...#.........
 8  ########################################################.............
```

**Level 7 (`alpha_level7.xml`, body, kill 3 bad)**

```text
    0         1         2         3         4         5         6         7    
    012345678901234567890123456789012345678901234567890123456789012345678901234
 0  ##+########################################################################
 1  #++............++..................++..++....................++...........#
 2  #.....................w.......I........................................E..#
 3  #....P....ww..........##+##+##+#.......................www................#
 4  #..........I.....w.ww...........w...w...w..............#.#................#
 5  #.#+....ww#+ww.....##+#.........#.w.#.w.#..w.w.w.I..#.#.#.#........##+#...#
 6  ################..................#...#...#########..#.#.#.#.#..##+##+##+##
 7  ################.##+#.....................#########.......................#
 8  ##################+#......................#########.......................#
 9! ...........................................................................
10! ............#..............................................................
```

**Level 8 (`alpha_level8.xml`, kitchen, make 1 yoghurt)**

```text
    0         1         2         3      
    0123456789012345678901234567890123456
 0  #+.........L.............L.......#+..
 1  ++.............L.....L.........E.++..
 2  ++.P.....####...........###......++..
 3  ++............###...####.........++..
 4  #+...............M..........######+..
 5  ++...........#..........#####....++..
 6  ++........####...................++..
 7  ++........#######...###..........++..
 8  ########################.........####
```

**Level 9 (`alpha_level9.xml`, kitchen, make 3 yoghurts)**

```text
    0         1         2         3         4         5         6   
    0123456789012345678901234567890123456789012345678901234567890123
 0  #+..............................................................
 1  ++...L.P..................L.....................................
 2  ++..............................................L............#++
 3  ++...#++++................##.................................+++
 4  #+M.................########M.............###..###M......E...+++
 5  ++.....L....#++++...............L......................L.....#++
 6  ++...............#++...............###.###...................+++
 7  ++....###..#.....+++............###..............#...####....+++
 8  #############....+++.......#######...........###################
```

**Level 10 (`alpha_level10.xml`, body, set off 6 antibiotics)**

```text
    0         1         2         3         4     
    0123456789012345678901234567890123456789012345
 0  ##.#+###############+#########################
 1  ##.++..............++............U...++..++...
 2  ##...................................E........
 3  ##.P...a...a...a..........#########...........
 4  ##...a...a...a..........L#........I...........
 5  ##############......##+#.X........##+##+#.....
 6  ##############.###+#+#+##.....................
 7  ##############.##++++++##.....................
 8  ##############.##++++++##.....................
```

**Level 11 (`alpha_level11.xml`, body, orphan, not played)**

```text
    0         1         2         3    
    01234567890123456789012345678901234
 0  ...................................
 1  ..#.#....P.a.a...............I.....
 2  .#.#..wwwwwwww.a......##+##+##+#...
 3  ....#.##+##+##a#a#.#.#.............
 4  ...#..#.#.##..#.#.#.#......D......E
 5  #...#..................T.U......U..
 6  ..###########..#+####+...#+...I....
 7  .#.##########..+++++++.############
 8  ...####+#####..........############
```

---

## 4. Data checks

### 4.1 Summary

| Level | Goal targets enough? | Player start | Exit | Other findings |
|---|---|---|---|---|
| L1 | yes, 3 of 3 Lucy (no slack) | (1,6) above the yoghurt-tile ledge | (5,56) | Cols 61-68 lie behind the wall formed by `salt_obj` (0,59) and `pepper_obj` (4,59) at cols 59-60 and are empty: dead space. Gaps in the row-8 floor at col 16, cols 27-28, 38-46 and 50-51 are ditches, not deaths: the world floor is y = 450. |
| L2 | yes, 3 good (all Lucy, no slack) | (4,3) | (5,36) | Declares `rows="11"`; rows 9-10 are empty. Cols 40-43 behind the hair wall at col 39 (rows 1-8, capped by hair tiles at row 0, cols 40-43) look unreachable. `plaster_singular_obj` at (8,43) is 200 px wide and runs past col 43 (world edge x = 2200). Lucy at (0,13) sits on the top platforms, so the player must climb to photograph her. |
| L3 | yes, 3 of 3 Steve (no slack) | (2,2) | (4,41) | Declares `rows="11"`. 8 cells at cols 45-46 are beyond `cols="44"`: drawn but with no physics (rule 12). The visible hair wall at col 45 is therefore 50 px to the right of the real barrier, the world clamp at x = 2200. (8,44) gets a box but lies outside the world. |
| L4 | yes, 3 of 3 Patty (no slack) | (4,5), next to the pepper pillar | (5,46) | Cols 57-68 behind the two `pepper_obj` at cols 55-56 are empty dead space (only the floor tile (8,57)). The phone shows no target picture: `STATE_CREATE_GUI` has no Patty branch (`junior/PlatformGame.as:340-350`). |
| L5 | yes, 4 bad for 3 | (3,1) | (3,63) | Cell (12,65) `hair_vert_obj` is beyond row 8: dead data. Slurm (3,21) drops into the pit at cols 16-30 and walks on the world floor. Overshoot risk: two kills resolved in one frame taking `achieved` from 2 to 4 would never equal 3 (`junior/Goal.as:36`). |
| L6 | yes, 4 bad for 3 | (3,6) | (4,51) | Cols 56-68 are empty except a stray `skin_base_tile` at (7,59): dead space behind the hair wall at col 55. Same overshoot risk. The plan says "kill all bad" (`levels/plan2.txt:11`), but the XML asks for 3 of the 4. |
| L7 | yes, 3 of 3 Iggy (no slack) | (3,5) | (2,71) | Cell (10,12) `platform_end_obj` is beyond row 8: dead data. Fully walled (cols 0 and 74, roof row 0). |
| L8 | yes, 1 glass, 4 Lucy | (2,3) | (1,31), high up; reach it from the `Sugar_Tile` ledge at row 4, cols 28-32 | Cols 35-36 behind the salt/pepper pillar at cols 33-34 are empty. The portal box (about 104 px wide) overlaps the pillar. No row-8 floor at cols 24-32. |
| L9 | yes, 3 glasses, 6 Lucy (3 spare Lucy) | (1,7) | (4,57) | No findings. |
| L10 | yes, 6 of 6 pickups (no slack; see the notes under section 1) | (3,3) | (2,37) | Rows 6-8 are empty from col 25 to col 45, so the world floor (y 450) is the floor there. The superinfection at (5,25) is created gravity-exempt (`junior/PlatformGame.as:514`) and floats where placed. |
| L11 | **no**: 6 kills needed, 5 bad placed | (1,9) | (4,34) | Orphan: nothing points to it. No `level11` intro label. The only level using the bone tiles. |

Every played level has exactly one player start and one exit, uses only defined, exported linkages, and has no duplicate cells or rows.

### 4.2 Findings in detail

1. **Photo goals have no slack.** L1-L4 place exactly the 3 targets they need. If a target is lost (killed by a projectile, or gone off the map), the level cannot be finished and the only way out is the 180 s timer or death, which restarts the level (`junior/GameController.as:283-299`). The same holds for L7 (3 Iggy for 3) and L10 (6 antibiotics for 6).
2. **`bodyLevel` is true in L1-L4 and in the kitchen levels L8 and L9.** L1-L4 omit the attribute; L8 and L9 set `body_level="true"` explicitly. No ammo pickups are placed in those levels, but `infiniteAmmo` starts true (`junior/PlayerEntity.as:124`), so any shot fired there is a white blood cell, not soap (`junior/PlatformGame.as:672-708`). Only L5 and L6 are soap levels.
3. **`microbeType="17"` is decoration on six goals.** L5, L6, L7 (KILL_ALL), L8, L9 (YOGURT) and L10 (ANTIBIOTIC) all carry microbe 17 (Slurm), which their handlers ignore. It looks like a default left by the editor. The phone picture is chosen by goal type for these (`junior/PlatformGame.as:351-358`): `milk_image` for YOGURT, `superinfection_image` for ANTIBIOTIC, and `slurm_image` with `kill_icon` for KILL_ALL.
4. **L2 is "any good microbe", not "Lucy".** Goal type 1 counts any `GoodMicrobe`. It behaves like "photograph 3 Lucy" only because Lucy is the only good microbe placed.
5. **Rows beyond 8.** `alpha_level2.xml` and `alpha_level3.xml` say `rows="11"` but place nothing in rows 9-10. `alpha_level5.xml` (row 12) and `alpha_level7.xml` (row 10) each hold one cell outside `rows`, never drawn or collided. The documentation's "every level has 9 rows" (`reference/docs/junior-game-documentation.md:345`) is what the runtime enforces, not what the data says.
6. **Columns beyond `cols`.** Only `alpha_level3.xml` has them (cols 45-46). `alpha_level2.xml`'s `plaster_singular_obj` at (8,43) has a 200 px box that reaches past the world edge.
7. **Large boxes overlap smaller anchors.** For example `villi_roof_obj` (100x100) swallows neighbouring `roof_a_tile` anchors in L7 and L10, and `scab_obj` (200x100) covers the skin row beneath it in L6. This is harmless for collision, but the port must draw every anchor's art at its own size, in XML order, to match.
8. **Derived per-level speed cap (for the physics notes).** Every dynamic body's step is clamped to `maxChange` (`ParticleSystem.as:337-345`). `createBoxParticle` lowers the cap to w/2 and h/2 whenever `Math.ceil(w/2)` or `Math.ceil(h/2)` is below it (`ParticleSystem.as:221-233`), for every box created without `maxChangeExcempt`: all geometry, the player (forced 49x100, `junior/PlatformGame.as:387`) and every good or bad microbe (`junior/PlatformGame.as:427`, `:440`, `:456`). Pickups, portal, milk glass, superinfection and projectiles are exempt. So **which microbes a level contains changes the player's top speed**: `lucy_icon` is about 42.3 px wide, which drops the horizontal cap from 25 to about 21.2 px per step in every Lucy level. With the player's move force `speed = 3000*1.5` (`junior/PlatformGame.as:396`), drag 0.95 and a 0.03 s step (`junior/PlatformGame.as:151-153`), the uncapped terminal speed would be 81 px per step, so the cap is always what limits it. The jump impulse `-3*jumpForce = -72000` (`junior/PlayerEntity.as:416`, `junior/PlatformGame.as:397`) is capped at 25 px per step, which gives an apex of about 100 px (2 rows) per jump and about 200 px with the double jump (`junior/PlatformGame.as:52`). These numbers are derived, not measured; check them in Ruffle.

| Level | maxChange.x (px/step) | maxChange.y | Lowered to that by | Player top speed px/step | Single jump apex px | Double jump approx px |
|---|---|---|---|---|---|---|
| L1 | 21.16 | 25 | `lucy_icon` | 21.16 | 99.8 | 199.6 |
| L2 | 21.16 | 25 | `lucy_icon` | 21.16 | 99.8 | 199.6 |
| L3 | 25 | 25 | `hair_vert_obj` | 25 | 99.8 | 199.6 |
| L4 | 25 | 25 | `loaf_end_L_obj` | 25 | 99.8 | 199.6 |
| L5 | 25 | 25 | `hair_vert_obj` | 25 | 99.8 | 199.6 |
| L6 | 25 | 25 | `hair_vert_obj` | 25 | 99.8 | 199.6 |
| L7 | 23.98 | 25 | `iggy_icon` | 23.98 | 99.8 | 199.6 |
| L8 | 21.16 | 25 | `lucy_icon` | 21.16 | 99.8 | 199.6 |
| L9 | 21.16 | 25 | `lucy_icon` | 21.16 | 99.8 | 199.6 |
| L10 | 21.16 | 25 | `lucy_icon` | 21.16 | 99.8 | 199.6 |
| L11 | 23.98 | 25 | `iggy_icon` | 23.98 | 99.8 | 199.6 |

9. **Possible collision bug that affects large tiles (for the physics notes).** In the static pass the bounding-ball test uses `staticBoundingBalls[secondIndex]` and `excemptionMatrix[firstIndex][STATIC][secondIndex]`, where `secondIndex` indexes the local `testEntities` list, not `staticEntities` (`ParticleSystem.as:580-588`). The radius used is therefore that of whichever tile was created `secondIndex`-th in the level, not the tile being tested, which can let a body sink into or skip large boxes such as `pepper_obj`. Verify in Ruffle before copying or fixing it.
10. **Level 11 is unfinished.** It is not referenced by `GameController` or any `next`; it needs 6 bad kills with 5 bad microbes placed; its name has no intro label, and it is the only level using the bone tiles.
11. **Documentation contradictions.** `reference/docs/junior-game-documentation.md:280` says level 1's goalType is 3; the XML says 0 (`levels/alpha_level1.xml:2`). `:345` says every level has 9 rows; L2 and L3 declare 11. `:351` says the loader looks up the level's own `<tile>` definitions; the code uses `tile_definitions.xml` (rule 3). `levels/plan2.txt:16` says level 9 makes 2 yoghurts; the XML asks for 3. `levels/plan2.txt:20` says level 10 is "Kill Superbug"; the XML goal is "use 6 antibiotics".
12. **Legacy and test files.** None is reachable from the game. `level1.xml` is a near copy of L4 (96% of cells shared) and `level2.xml` of L2 (95%, but with no player start); both still use the runtime palette. The rest use older palettes (`blue_box`/`red_box` test sets or the sliced `kitchen_*` art), often lack `<goals>` (so the positional parse would fail) and mostly lack a player start or exit.

| File | name | cols x rows | next | Goals (type,microbe,req) | Palette | Notes from the checks |
|---|---|---|---|---|---|---|
| `Hello.xml` | Demo Level | 10 x 14 |  | none | pre-release format | legacy-format |
| `antibiotic.xml` | new level | 21 x 13 | level2.xml | none | own (112 entries) | palette-mismatch, no-exit-portal, player-start-no-floor |
| `apetest.xml` | new level | 21 x 9 | level2.xml | none | own (70 entries) | palette-mismatch, child-order, no-exit-portal |
| `blank.xml` | Kitchen | 28 x 14 | level2.xml | none | own (0 entries) | child-order, no-player-start, no-exit-portal |
| `david.as` | new level | 56 x 9 | level2.xml | none | own (70 entries) | palette-mismatch, child-order, multiple-exit-portals |
| `davidtest,xml.txt` | new level | 29 x 14 | level2.xml | none | own (59 entries) | palette-mismatch, child-order, no-exit-portal |
| `demo.xml` | new level | 12 x 14 | level2 | none | own (7 entries) | palette-mismatch, child-order, cells-outside-cols, cells-below-world, unresolved-tile-id, no-player-start, no-exit-portal |
| `desired xml format.as` | Demo Level | 10 x 14 |  | none | pre-release format | legacy-format |
| `e.xml` | Kitchen | 28 x 14 | Hello.xml | none | own (3 entries) | palette-mismatch, child-order, cells-below-world, unresolved-tile-id, no-player-start, no-exit-portal |
| `face.xml` | Kitchen | 28 x 14 | e.xml | none | own (3 entries) | palette-mismatch, child-order, cells-below-world, unresolved-tile-id, no-player-start, no-exit-portal |
| `lacto.xml` | level1 | 58 x 13 | level5.xml | 7,14,2 | own (111 entries) | palette-mismatch, player-start-no-floor |
| `level1.xml` | level4 | 69 x 9 | alpha_level4.xml | 0,13,3 | runtime-equivalent |  |
| `level2.xml` | level2 | 44 x 11 | alpha_level3.xml | 1,14,3 | runtime-equivalent | no-player-start |
| `level3.xml` | level3 | 60 x 9 | level4.xml | 0,14,3 | own (110 entries) | palette-mismatch |
| `level4.xml` | level4 | 69 x 9 | level5.xml | 0,13,3 | own (110 entries) | palette-mismatch |
| `level5.xml` | level5 | 58 x 13 | exit | 1,14,3 | own (110 entries) | palette-mismatch |
| `nancy.xml` | new level | 29 x 14 | level1.xml | none | own (7 entries) | palette-mismatch, child-order, no-exit-portal |
| `new.xml` | new level | 12 x 14 | level2 | none | own (1 entries) | palette-mismatch, child-order, cells-outside-cols, unresolved-tile-id, no-player-start, no-exit-portal |
| `sandy.level.as` | new level | 29 x 14 | level2.xml | none | own (70 entries) | palette-mismatch, child-order, multiple-exit-portals |
| `sandy.xml` | Kitchen | 28 x 14 | level2 | none | own (4 entries) | palette-mismatch, child-order, cells-below-world, unresolved-tile-id, no-player-start, no-exit-portal |
| `spare level.xml` | level1 | 58 x 13 | level5.xml | 1,14,3 | own (111 entries) | palette-mismatch, entrance-portal, no-exit-portal |
| `super.xml` | new level | 16 x 9 | level2.xml | 6,14,6 | runtime-equivalent | no-exit-portal |
| `test.xml` | new level | 57 x 13 | level2.xml | 4,5,3 | own (70 entries) | palette-mismatch, no-exit-portal, goal-not-enough-targets |
| `test2.xml` | new level | 55 x 12 | test2.xml | none | own (110 entries) | palette-mismatch, cells-below-world, player-start-no-floor |
| `testbig.xml` | new level | 16 x 9 | level2.xml | none | own (70 entries) | palette-mismatch, child-order |
| `xml format.as` | new level | 48 x 14 | level2.xml | none | own (2 entries) | palette-mismatch, child-order, no-exit-portal, player-start-no-floor, entity-inside-geometry |

---

## 5. Comparison with the Unity remake (secondary)

Unity data from `reference/analysis/unity-logic.md` §1-2 (`:47`, `:93-104`). Unity's levels are hand-placed scene objects with no level file (`reference/analysis/unity-logic.md:736-739`), so nothing below is a cell-for-cell port.

The order matches one to one, and so does the grouping into quiz rounds: Unity plays kitchen1, skin1, skin2, kitchen2 after quiz round 1; skin11, skin12, body11 after round 2; kitchen31, kitchen32 after round 3; and superinfection after round 5. Unity never plays round 4, the kitchen fridge game (`reference/analysis/unity-logic.md:42`).

| Flash | Unity scene | Flash goal | Unity goal | Differences |
|---|---|---|---|---|
| L1 kitchen | `kitchen1` | photograph 3 Lucy (3 placed) | photograph 3 lucy (3 placed) | Same goal. Unity adds a milk glass and yoghurt pot props. |
| L2 skin | `skin1` | photograph 3 of any good microbe (3 Lucy, no enemies) | photograph 3 lucy | Unity asks for Lucy specifically and adds two enemies (super_slurm, super_colin) with no pickups to fight them. Flash L2 has no enemies. |
| L3 skin | `skin2` | photograph 3 Steve (3 Steve only) | photograph 3 steve | Unity adds Sandy (good), Slarg (bad), soap, white-cell and antibiotic pickups; an antibiotic there can kill the Steves. Flash L3 has only the three Steves. |
| L4 kitchen | `kitchen2` | photograph 3 Patty | photograph 3 patty | Same goal. Unity adds antibiotic, soap and white-cell pickups. Flash L4's phone shows no Patty picture. |
| L5 skin | `skin11` | kill any 3 bad (4 Slurm, 1 Steve; 15 soap) | wash away 3 slurm (4 slurm, 1 steve; 10 soap) | Closest pair. Flash counts any bad microbe; here only Slurm are bad, so the effect is the same. |
| L6 skin | `skin12` | kill any 3 bad (2 Slurm, 1 Slarg, 1 Donna; 17 soap) | wash away 3 slurm (4 slurm, steve, donna; 12 soap) | Unity requires Slurm specifically and swaps Slarg for two more Slurm plus a Steve. |
| L7 body | `body11` | kill any 3 bad (3 Iggy; 21 white cells) | kill 3 iggy with white blood cells (3 iggy) | Same in effect. Unity also places an antibiotic and a soap pickup. |
| L8 kitchen | `kitchen31` | make 1 yoghurt (1 glass, 4 Lucy) | push 1 lucy into milk/yoghurt (1 glass, 3 lucy) | Same target. One fewer Lucy in Unity. |
| L9 kitchen | `kitchen32` | make 3 yoghurts (3 glasses, 6 Lucy) | push 3 lucy into milk (3 glasses, 4 lucy) | Same target. Two fewer Lucy in Unity, so less slack. |
| Kitchen game | none | 4 fridge-sorting levels | not implemented | Unity skips round 4 entirely. |
| L10 body | `superinfection` | set off 6 antibiotics (6 pickups, no respawn); the superinfection has 6 lives | kill the superinfection: life 20 at 5 per dose, so 4 doses, from 1 antibiotic pickup that respawns after 5 s, carry limit 1 | Flash counts detonations and can end with the superinfection alive; Unity requires the kill. Unity's supporting cast is 4 Iggy, 1 Slurm, 1 Steve; Flash's is 1 Slurm, 1 Iggy, 1 Lucy. |
| L11 body (orphan) | none | kill any 6 bad (5 placed) | - | Not played in either. |

**Rules that differ in every level.** Flash has a 180 s timer (`junior/PlatformGame.as:148`), 3 lives with a "You Died!" screen and a restart (`junior/GameController.as:283-299`), one-shot pickups (`junior/SoapPickup.as:50-60`, `junior/AntibioticPickup.as:48-58`), and ammo that is infinite by default (`junior/PlayerEntity.as:124`). Unity has no timer, restarts the scene on death, and respawns pickups after 5 s (`reference/analysis/unity-logic.md:88`, `:127`).

**Scale.** A Unity tile is 0.5 u, the same 50 px art (`reference/analysis/unity-logic.md:761`). But the Unity camera shows 20 rows by 32 columns (`:763`) against Flash's 9 by 16, and Unity levels are about 160-177 tiles wide (`:764`) against Flash's 37-75. The layouts are re-built, not copied. In one spot check, Lucy's positions as a fraction of level width are 0.33, 0.65 and 0.77 in Flash L1 (cols 23, 45, 53 of 69) and 0.33, 0.58 and 0.74 in Unity kitchen1 (x 17.72, 38.50, 52.03 on the 169-cell grid, `reference/analysis/unity-logic.md:95`, `:786`). So Unity kept the rough rhythm of the Flash level, not its geometry.
