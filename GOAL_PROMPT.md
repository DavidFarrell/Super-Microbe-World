# Goal: Bring Super Microbe World back to life as a browser-native JavaScript game

## Background
Super Microbe World (aka the e-Bug Junior Game) is a Flash game David Farrell built in 2007-2009 to teach children about microbes and hygiene. Flash is dead. This repo holds a 2013-14 Unity (UnityScript) remake by Pedro Rodriguez, which is also unplayable now because the Unity Web Player is dead. Recreate the full game in modern browser-native JavaScript so it runs in any current browser with no plugins. It should be faithful in content, but a bit more polished and "juicy" than either original.

**Target version:** use the Unity remake's content (levels, quiz, languages) as the base. Where the original Flash reference is available and differs in feel (physics, timing, cutscenes), prefer Flash. Record every such decision in `web/NOTES.md`.

## Sources
1. **This repo (primary):**
   - `Assets/Textures/**` has PNG frame sequences for:
     - players: Amy and Harry, each with up, low and shrink;
     - 12 microbes: lucy, patty, donna, slarg, colin, super_colin, slurm, super_slurm, steve, sandy, iggy, super_infection;
     - tiles: Kitchen, Skin, Body;
     - pickups: white blood cell, liquid soap;
     - the GUI, the in-game phone, and the game show (host, TV set, Amy, Harry).
   - `Assets/Scenes/*.unity` and `Assets/Prefabs/**` are text YAML. Extract level layouts programmatically, never by hand. Known traps:
     - Objects reference prefabs and textures by GUID. Resolve them through the `.meta` files.
     - For prefab instances, positions often sit in the `m_Modification` overrides (for example `propertyPath: m_LocalPosition.x`), not in the Transform.
     - Convert Unity units to pixels using the camera `orthographicSize` and the sprite import settings.
   - `ProjectSettings/EditorBuildSettings.asset` gives the scene order. Cross-check it against `GameLogic.js`. The order is:
     1. gameShow
     2. kitchen1
     3. skin1
     4. skin2
     5. kitchen2
     6. gameShow_quiz
     7. skin11
     8. skin12
     9. body11
     10. kitchen31
     11. kitchen32
     12. superinfection
     13. gameShow_game_end

     That is 10 platformer scenes. `TextFiles/plan.txt` lists 7 levels, so map the sub-stages (skin11/12, kitchen31/32) from the code.
   - `Assets/Scripts/**` is about 3.5k lines of UnityScript and holds the game rules:
     - goals: `LevelLogic*.js`, `Goals.js`;
     - enemies: `IEnemy.js`, the microbe scripts;
     - HUD: `GUIHandler.js`;
     - phone: `InGamePhone.js`;
     - game show: `Scripts/GameShow/`.
   - The XML text is in about 11 languages:
     - canonical quiz files: `Assets/Resources/TextFiles/quiz/<lang>_gameshow_round{1..5}.xml` (ignore the `alpha_*` files and the duplicate `en_en_*` in `Resources/`, unless they are newer);
     - conversations: `TextFiles/conversations/`.
   - Fonts are in `Assets/Other/*.ttf`. The last Unity web build is in `LastBuild/`.
   - Do not port the Heroku database code or any credentials from `DBconnector.js`.
2. **Original Flash (best effort, time-boxed, never blocking):** the user's latest 2009 build is in Google Drive, folder `comu346 / Lecture 1 / Junior Game / movies`. It includes:
   - `introductionToMicrobes_platformer.swf`
   - `e-Bug Junior Game.swf`
   - `cutscene_introduction.swf`
   - `splash.swf`
   - `level_intros.swf`
   - `junior_game_assets.swf`

   The Drive connector returns files as base64 in the context, so do not download large binaries through it. If the user has placed the SWFs in a gitignored `reference/` folder, inspect them with open-source tools. JPEXS/ffdec needs Java, which is installed, and it can extract sounds, shapes and ActionScript. If `reference/` is empty, carry on with Unity only and note what is missing.

## Technical constraints
- Use plain HTML, CSS and ES modules with Canvas 2D. **There must be no runtime dependencies and no build step.** Serving `web/index.html` from any static server must just work. Use relative paths only, so it can be hosted on GitHub Pages or under any subpath.
- Dev-only tooling is fine, as long as the committed output is all the game needs at runtime:
  - Node 22 scripts to convert YAML/XML to JSON and to pack atlases (use a Playwright Chromium canvas or a pure-JS PNG codec; Pillow is not installed);
  - the Playwright tests.
- Use a fixed-timestep loop. Scale to any resolution while keeping the original aspect ratio.
- Support keyboard and gamepad, plus on-screen touch controls for tablets.
- Pack the frame sequences into sprite-sheet atlases with JSON. Target a total payload under 30 MB.
- Put the game in `web/` and leave the Unity project untouched.

## Scope: the full game
- Splash screen, language select (every language in the XML), player select (Amy or Harry), intro cutscene, TV intro and game-show framing.
- All 10 platformer scenes, each with:
  - its goal (collect or kill N microbes, photograph microbes, kill all bad microbes, and so on);
  - its enemies and their behaviours;
  - its pickups (soap, white blood cells);
  - the shrink sequence and the level intro text;
  - the HUD, and the in-game phone (the microbe encyclopaedia).
- The game-show quiz across all 5 rounds, including the blind questions round, with the host, scoreboard and final winner screen.
- Progress and settings saved to `localStorage`, with no server.

## Juice and polish (low-hanging, keep it tasteful)
- **Sound:** the repo has no audio at all. Use the original SWF sounds if they are available. Otherwise synthesise the effects in code with Web Audio (jump, land, stomp or kill, pickup, soap squirt, photo snap, hurt, level complete, quiz right and wrong, UI click). Add a simple procedural chiptune loop for each area. Include master, music and SFX volume and a mute toggle, saved to storage. Start audio on the first user gesture.
- **Scene transitions:** fades or iris wipes between screens and levels, plus animated level-intro cards.
- **Game feel:**
  - coyote time and jump buffering;
  - squash and stretch on jump and landing;
  - hit-stop and a small screen shake on kills and hurt;
  - particles (soap bubbles, microbe splats, sparkles on pickups);
  - floating score popups and eased HUD counters;
  - a smooth camera with look-ahead;
  - a brief invulnerability flash after a hit.
- **UI:** button hover and press feedback, a pause menu, and animated quiz answer reveals.
- **Accessibility:** reduced-motion and reduced-shake options (respect `prefers-reduced-motion`), remappable keys, and readable text scaling.

These must never change the educational content or the level goals.

## Bugs
Fix bugs you find in the original logic, such as broken goal counts, collision holes or stuck states, wherever the intended behaviour is clear. List each fix in `web/NOTES.md` under "Bugs fixed", with what you changed and why. If the intent is unclear, keep the original behaviour and note it.

## Working method
1. **Survey:** read the scripts and the scene YAML. Write `web/NOTES.md` with the game flow, each level's goal, the enemy behaviours, the data schemas and any Flash/Unity differences.
2. **Build in this order:**
   1. asset pipeline;
   2. engine core (loop, input, renderer, tilemap collision, camera, audio);
   3. one complete vertical slice (kitchen1 end to end, including juice and sound);
   4. the remaining levels;
   5. the game show;
   6. menus, cutscenes and transitions;
   7. polish.
3. Keep `web/PROGRESS.md` as a checklist and update it at every milestone, so the work survives context compaction.
4. Every commit must leave `web/index.html` bootable. Commit at each milestone and push to `claude/zealous-euler-6krofv`.
5. Write docs and commits in British English, with no em dashes.

## Verification
Use Playwright with the preinstalled Chromium. Do not run `playwright install`.
- **Smoke test:** serve `web/` statically, load it, and confirm there are zero console errors.
- **Debug routes:** each level and each quiz round must be reachable through a URL parameter (for example `?level=kitchen1`, `?quiz=3&lang=fr_fr`), with a screenshot captured for each.
- **Level data checks:** for each level,
  - every goal target exists in the extracted data (for example, 3 lucys present);
  - the player spawns above solid ground;
  - no microbes spawn inside solid tiles;
  - forcing the goal state moves the game on to the next scene.
- **Content checks:** every quiz and conversation XML parses in every language, with no missing strings.
- **Gallery:** generate `web/screenshots/index.html` showing every screen, for the user to review by eye. A full playthrough still needs a human; say so.

## Definition of done
- The whole game is playable from start to finish in Chromium from `web/index.html`, with no plugins and no network requests.
- All scenes, quiz rounds and languages work, with sound, transitions and juice.
- The Playwright suite passes and the screenshot gallery exists.
- `web/README.md` explains how to run the game, how the data pipeline works and how to regenerate assets.
- Report what was verified, what could not be recreated faithfully and why, and state that Firefox and Safari are untested (avoid APIs known to differ between browsers).
