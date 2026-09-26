# Goal: Bring Super Microbe World back to life as a mobile-first, browser-native game

## Background
Super Microbe World (aka the e-Bug Junior Game) is a Flash game David Farrell built in 2007-2009 to teach children about microbes and hygiene. Flash is dead. This repo holds a 2013-14 Unity (UnityScript) remake by Pedro Rodriguez, which is also unplayable now and of unknown fidelity. Recreate the full game in modern browser-native JavaScript. It must play well on phones and tablets as well as desktop, be deployed somewhere David can open with a link, and be tested end to end. It should be faithful in content, but more polished and "juicy" than the original.

**The 2009 Flash original is canonical.** The Unity remake is a secondary source: use it for its assets and extracted data only where they match the Flash original, or where the Flash source is unavailable. Log every place where Unity differs from Flash, or where Flash could not confirm a decision, in `web/NOTES.md`.

## Step 0: get the originals (critical path, do this first)
The original Flash project is on David's Google Drive in the folder `comu346 / Lecture 1 / Junior Game` (folder id `0Bw62SxAHx-pjYWtSb1JEZDl4MTA`). It contains:
- **`src/`**: the ActionScript source, including `physics/`, `ebug/` and `test/`;
- **`levels/`**: `plan.txt`, `plan2.txt` (2009-01), `conversations/`, `xml format.as` and `davidtest,xml.txt`;
- **`movies/`**: the latest build (June/July 2009):
  - `introductionToMicrobes_platformer.fla/.swf` (the game itself);
  - `e-Bug Junior Game.fla/.swf` (the wrapper);
  - `EBug Level Editor.fla/.swf`;
  - `junior_game_assets`, `cutscene_introduction`, `splash`, `level_intros`;
  - subfolders `assets/`, `Sandy Art/`, `Microbes_Motions/`, `tests/`;
- **`senior/`**: a different game, so ignore it.

This listing is partial. Every Drive listing returned a `nextPageToken`, so page every folder to the end before treating the inventory as complete. Also read these as text: `e-Bug_Junior_Game.html` / `e-Bug_Junior_Game2.html` (the SWF wrappers, which show how the SWFs load each other) and `params.txt`.

**Flash level layouts win over Unity's.** Find the original level data first. Candidates:
- the output of the `EBug Level Editor`;
- XML under `levels/`;
- `xml format.as` and `davidtest,xml.txt`;
- layouts baked into the platformer SWF.

Use the Unity scene layouts only as a fallback, and check them against Ruffle captures. The CS3-era `.fla` files are OLE binaries (Drive reports them as `application/msword`), so treat them as unparseable. The SWF and `.as` files are the sources.

Related Flash-era design docs, readable as text with the Drive `read_file_content` tool:
- `e-Bug Junior Game Documentation.doc` (in `e-Bug Source Folder`);
- `Learning Outcomes and Game Mechanics.xls`, `food rules.txt` and `games strategy.txt` (under `e-Bug Source Folder / ebug_latest / games`).

**Decisions already made by David (2026-09-26):** route (b) below is approved (temporarily share the `Junior Game` folder by link), and "mobile native" means an installable PWA.

**Getting the binaries:** the Drive connector returns files as base64 into your context, so never pull large files that way. Use route (b), which David has approved. Route (a) is only relevant if `reference/` already exists:
- **(a)** David has put the `Junior Game` folder into `reference/` and pushed it. Check for it first.
- **(b)** David has approved temporary link sharing. Steps:
  1. Record the current permissions of the `Junior Game` folder with `get_file_permissions`.
  2. Share the **folder** once, as viewable by anyone with the link. The files inside inherit it.
  3. List every file through the Drive tools. Download each one with `curl -L` from `drive.usercontent.google.com/download?id=<id>&export=download&resourcekey=<key>` (the host is confirmed reachable).
  4. Check every file's byte size against the Drive `fileSize`. A small HTML file means a login or virus-scan page came back instead of the file.
  5. Revoke the folder share, and confirm with `get_file_permissions` that the permissions match the originals.

If neither route is available, text-sized files (`.as`, `.txt`, `.xml`) can still come through `read_file_content`. Build from Unity plus those, and flag everything unconfirmed.

**Analysis tools (dev-only, from npm; GitHub release downloads are blocked):**
- `@ruffle-rs/ruffle` runs the original SWFs headless in Playwright Chromium. Use it as the oracle:
  - capture reference screenshots of every screen and level;
  - measure jump height, run speed, gravity and timings with scripted inputs.
- `swf-parser`:
  - check the ActionScript version (AS2 DoAction vs AS3 DoABC) before relying on Ruffle;
  - extract sounds, bitmaps and shapes.
- Read the `.as` source directly for rules, physics constants and level formats. Prefer the `.as` source over decompiling.

## Secondary source: this repo (Unity remake)
- **Assets:** `Assets/Textures/**` has PNG frame sequences for the players (Amy, Harry), 12 microbes, tiles (Kitchen, Skin, Body), pickups, GUI, in-game phone and game show. Reuse these PNGs only where they match the Flash reference captures. Otherwise extract the art from the SWFs.
- **Scene YAML:** `Assets/Scenes/*.unity` and `Assets/Prefabs/**` are text YAML. If you use them, extract the data programmatically. Known traps:
  - Objects reference prefabs and textures by GUID. Resolve them through the `.meta` files.
  - Positions often sit in the prefab `m_Modification` overrides.
  - Convert Unity units to pixels using the camera `orthographicSize`.
- **Scene order** (`ProjectSettings/EditorBuildSettings.asset`):
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

  Check this against the Flash `plan.txt`/`plan2.txt`. The Flash order wins.
- **Logic:** `Assets/Scripts/**` is about 3.5k lines of UnityScript. **Text:** the quiz and conversation XML in about 11 languages under `Assets/Resources/TextFiles/`. Fonts are in `Assets/Other/*.ttf`.
- The repo has **no audio files**.
- Do not port the Heroku database code or credentials from `DBconnector.js`.

## Technical constraints
- Use plain HTML, CSS and ES modules with Canvas 2D. **There must be no runtime dependencies and no build step.** Use relative paths only. Serving `web/` from any static server must just work.
- Dev-only tooling is fine: Node 22 scripts, npm packages (Ruffle, swf-parser, Playwright and PNG/WebP codecs), converters and atlas packers. Commit the generated output, so the game never needs them at runtime. Pillow is not installed.
- Use a fixed timestep, a seeded RNG and a deterministic simulation, so input replays are reproducible.
- Pack the art into WebP atlases (PNG fallback) plus JSON. The total payload budget is about **15 MB**; watch texture memory on iOS.
- Put the game in `web/` and leave the Unity project untouched.

## Mobile-first, keyboard equally first-class
"Mobile native" means an installable PWA, not a native wrapper:
- a web app manifest and icons;
- a service worker for offline play;
- home-screen install;
- landscape layout with letterboxing that respects safe-area insets;
- a "rotate your device" prompt in portrait.

Design touch controls into the engine core from day one, not bolted on later. That means:
- on-screen d-pad and buttons, sized for thumbs, with adjustable opacity;
- multi-touch;
- no pinch-zoom, scroll bounce, text selection or long-press menus;
- Web Audio unlocked on the first `touchend` (required on iOS);
- pausing on `visibilitychange`;
- the fullscreen API where it is supported.

**Keyboard is a first-class desktop experience too, not an afterthought.** That means:
- arrow keys and WASD for movement;
- space for jump;
- clear keys for action and phone;
- Esc to pause;
- Enter to confirm;
- number keys or arrows plus Enter to answer quiz questions;
- keyboard focus that is visible across every menu, remappable keys, and key prompts in the UI that match the active input device. Hide the on-screen controls once a key is pressed and show them again on touch.

Gamepad is a bonus. Every screen must be fully playable with touch alone and with keyboard alone. Every tap target must be large.

## Scope: the full game
Recreate everything in the Flash original:
- the splash screen;
- language select, if the original had it;
- player select (Amy or Harry);
- the intro cutscene;
- every platformer level, with its goals, enemies, pickups (soap, white blood cells), shrink sequence, level intros, HUD and in-game phone (the microbe encyclopaedia);
- the game-show quiz, host, scoreboard and winner screen.

Include the Unity remake's extra languages and content only if they fit the Flash design, and note them. Save progress and settings to `localStorage`, with no server.

## Juice and polish (tasteful, never changing educational content or goals)
- **Sound:**
  - Use the original sounds extracted from the SWFs.
  - Where none exist, synthesise the effect with Web Audio: jump, land, stomp, pickup, soap, photo snap, hurt, level complete, quiz right and wrong, UI tap.
  - Add simple procedural music for each area.
  - Include volume sliders and a mute toggle, saved to storage.
- **Transitions:** fades or iris wipes between scenes, plus animated level-intro cards.
- **Feel:**
  - coyote time and jump buffering;
  - squash and stretch;
  - hit-stop and light screen shake;
  - particles (bubbles, splats, sparkles);
  - score popups and eased HUD counters;
  - a camera with look-ahead;
  - an invulnerability flash after a hit;
  - haptics via `navigator.vibrate` where it is available.
- **UI:** press feedback, a pause menu and animated quiz reveals.
- **Accessibility:** reduced motion and reduced shake (respect `prefers-reduced-motion`), remappable keys and text scaling.

## Bugs
Fix bugs you find in the original logic wherever the intent is clear. Log each fix in `web/NOTES.md` under "Bugs fixed". If the intent is unclear, keep the original behaviour and note it.

## Deployment (David must get a clickable link)
1. **Early probe.** Before building the game, load the `artifact-design` skill. Then publish a tiny probe artifact using the multi-file `files` publish. It should test:
   - ES module imports;
   - `fetch` of JSON and a WebP from relative paths;
   - Web Audio unlock on touch;
   - pointer and multi-touch events;
   - fullscreen and orientation lock;
   - gamepad;
   - service worker registration (it may be blocked on that origin, in which case offline mode is simply off there).

   The probe must also check that the artifact page contract (the added document skeleton, gutters and theme tokens) does not break a fullscreen, letterboxed canvas. If it does, move hosting to GitHub Pages.

   Give David the link and ask them to open it on their phone and report back. Mention that they must be signed in to claude.ai on that phone to open a private artifact.
2. **Hosting.**
   - If the probe works, host the game as a claude.ai Artifact. The limits are 16 MB per file, 255 files and 64 MB per publish.
   - Publish after the vertical slice, then republish to the **same URL** at every milestone, so David can play along on a phone.
   - Keep third-party logos (e-Bug, HPA/UKHSA) out of the hosted build, because artifacts must not carry an organisation's branding. Title the page "Super Microbe World".
   - If the artifact route fails, try GitHub Pages through a workflow on the branch. If that fails too, say so.
3. **Local fallback,** always documented in `web/README.md`:
   ```
   git fetch origin claude/zealous-euler-6krofv && git checkout claude/zealous-euler-6krofv
   npx serve web        # or: python3 -m http.server 8000 -d web
   ```
   ES modules do not load from `file://`, so a local server is required.

   The README must also give David a one-liner to run the E2E suite on their own machine, for example `npm ci && npx playwright install chromium && npm test`. Installing Playwright browsers is correct there, but forbidden in this environment. The final report must include both the play command and the test command.

## End-to-end testing
Use Playwright with the preinstalled Chromium. Do not run `playwright install`. Commit the tests under `web/tests/`, runnable with one command.
- **Test hooks:** `window.__test` exposes the scene, goal counters, player state, a way to inject input, and a seed.
- **Level bot:** every platformer level must be completed through **real inputs**, using a scripted bot or recorded input traces replayed deterministically. Debug skips don't count. The assertions:
  - the goal is reached;
  - the game moves on to the next scene;
  - there are no console errors.
- **Full journey:** one test runs from the splash screen, through player select and every level, answers the quiz by tapping, and finishes on the winner screen. Run it under Playwright **mobile emulation** (`isMobile`, `hasTouch`, a phone viewport in landscape) using the on-screen touch controls. Run it again on a desktop viewport with the keyboard.
- **Data checks:**
  - every goal target exists;
  - spawns sit on solid ground;
  - nothing spawns inside solid tiles;
  - every text file parses in every language, with no missing strings.
- **Fidelity:** compare side by side with Ruffle captures of the Flash original for every screen.
- **Performance:** frame-time budget checks under 4x CPU throttling. The payload must stay under budget.
- **PWA:** the manifest is valid, the service worker registers and the game loads offline (tested locally).
- **Gallery:** `web/screenshots/index.html` lists every screen, alongside its Flash reference where one exists.
- **Known limits, state them plainly:**
  - WebKit is not installed, so real iOS Safari is untested.
  - Playwright cannot log in to the private artifact URL, so run E2E on the identical files locally, and check the published artifact by reading it back.
  - A real-device playthrough needs David.

## Working method
1. **Do step 0** (the originals) and publish the deploy probe.
2. **Survey.** Write `web/NOTES.md` covering the game flow, each level's goal, enemy behaviours, physics constants, data schemas and the Flash/Unity differences.
3. **Build in this order:**
   1. asset pipeline;
   2. engine core (loop, input including touch, renderer, collision, camera, audio);
   3. a vertical slice: the first level end to end, with touch, juice, sound and its E2E bot test, **published**;
   4. the remaining levels, each with a bot test;
   5. the game show;
   6. menus, cutscenes and transitions;
   7. PWA and polish.
4. Keep `web/PROGRESS.md` as a checklist and update it at every milestone, so the work survives context compaction.
5. Every commit must leave `web/` bootable, with the tests passing. Push to `claude/zealous-euler-6krofv` at each milestone.
6. Write docs and commits in British English, with no em dashes.

## Definition of done
- The full Flash game is playable from start to finish at a link David can click, on a phone and on desktop.
- The branch runs locally with one command.
- The E2E suite passes: every level is completed by the bot, and the full journey passes on mobile emulation and desktop.
- The PWA installs and works offline, at least when served locally.
- Sound, transitions and juice are in, and bug fixes are logged.
- `web/README.md` explains how to run the game, test it, regenerate assets and redeploy.
- Final report:
  - what was verified and how;
  - what differs from the Flash original and why;
  - what is untested (iOS Safari, Firefox and real devices).
