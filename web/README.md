# Super Microbe World

A browser remake of the **e-Bug Junior Game** (also called Super Microbe World), the Flash game David Farrell built in 2007 to 2009 to teach primary school children about microbes, hygiene and antibiotics. Flash is gone, so the whole game has been rebuilt in plain HTML, CSS and JavaScript. It plays on phones, tablets and desktops, installs as an app (PWA) and works offline.

The 2009 Flash original is the reference throughout: the levels, the quiz, the art, the timings and the physics all come from the original SWF files, ActionScript source and level XML. The differences are deliberate and are listed, with the reasons, in [`NOTES.md`](NOTES.md). The [fidelity gallery](screenshots/index.html) shows every screen of the remake next to the original.

## The game

You are Amy or Harry, a contestant on the **Super Microbe World Game Show**. After meeting the host you are shrunk down and sent into the world of microbes, five rounds in a row. Each round has three parts:

1. **The shrinking zone**: the shrink ray makes you smaller than a microbe.
2. **The action**:
   - Rounds 1, 2, 3 and 5 are **hoverboard platform levels** (ten in all) in the kitchen, on the skin and inside the body. Each level opens with a briefing on your ePhone and sets one goal: photograph good microbes, wash bad ones away with soap, throw white blood cells at a flu virus, push Lucy Lactobacillus into milk to make yoghurt, or use antibiotics against a super infection. Then find the portal.
   - Round 4 is the **kitchen game**: four levels of putting the shopping away in the right places before the clock runs out, while catching sneezes with a tissue, wrapping meat in cling film and washing your hands.
3. **The quiz**: back in the studio, the host asks questions about what you have just learnt (Agree, Don't Know or Disagree). The other child answers too, and the quiz points decide the winner.

Everything is saved on the device: Continue picks up where you left off, and every level you have finished once can be replayed from **Level select**. Settings has volumes, the original's "blind" warm-up questions, text size, reduced motion, touch-button opacity, key remapping and the quiz language (11 languages; the rest of the game is in English).

## How to play

Every screen works with touch alone and with the keyboard alone, and a gamepad works too. Prompts on screen always name the keys or buttons for whatever you used last. The on-screen touch controls hide when you press a key and come back when you touch the screen.

### Platform levels

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Ride left / right | Arrow keys or A / D | Left and right arrows, bottom left | D-pad or left stick |
| Jump (press again in the air to double jump) | Space, Up or W | Jump button (up arrow), bottom right | A |
| Take a photo, or use the antibiotic in level 10 | C, K, Ctrl or Left Shift | Camera button | B |
| Throw soap or a white blood cell | X or J | Throw button | X |
| Show the ePhone briefing again | P or Tab | Phone button, top left | Y |
| Pause | Esc | Pause button, top left | Start |
| Next page, confirm | Enter (or Space) | Tap | A |

The 2009 controls (Up to jump, Space to throw, Ctrl for photos) are one button away: Settings, Controls, "Classic 2009 keys". Every action can be remapped there.

### Game show

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Next line | Enter or Space | Tap the host's text box | A |
| Answer Agree / Don't Know / Disagree | 1, 2, 3, or Up / Down and Enter | Tap the answer | D-pad and A |
| Pause | Esc | Pause button | Start |

### Kitchen

| Action | Keyboard | Touch or mouse | Gamepad |
|---|---|---|---|
| Put the item away | Tab or the arrow keys to choose a place, then Enter (or Enter on the item to pick it up, then choose the place and press Space) | Tap the place, or drag the item there | D-pad to choose, A |
| Tissues (when you start to sneeze) | T or 1 | Tap the tissues | B |
| Cling film (before meat goes in the fridge) | C or 2 | Tap the cling film | X |
| Wash your hands | H or 3 | Tap the sink | Y |

### Menus

Arrow keys or the d-pad move between buttons, Tab and Shift+Tab also work, Enter or Space presses, and Esc, Backspace or the gamepad's Back button goes back. The splash menu offers New Game, Continue (once a game is saved), Level select and Settings.

## Play it

- **Online:** https://gameologist.com/Super-Microbe-World/play/ (GitHub Pages). A copy also lives as a claude.ai artifact at https://claude.ai/artifact/VGSd4HuhbJKFW77wswuRr3, which opens only for someone signed in to claude.ai with access to it. Either copy is only as new as its last deployment (see [Deploying](#deploying)); if it looks older than this branch, it has not been redeployed yet.
- **On your own computer:**

  ```sh
  git fetch origin claude/zealous-euler-6krofv && git checkout claude/zealous-euler-6krofv
  npx serve web        # or: python3 -m http.server 8000 -d web
  ```

  Then open the address it prints (http://localhost:3000 for `serve`, http://localhost:8000 for Python). The game is ES modules, which browsers do not load from `file://`, so opening `index.html` straight from disk does not work: it needs a web server, but any static one will do. There is no build step and nothing to install.

- **As an app:** open it in Chrome, Edge or Safari and use "Install app" or "Add to Home Screen". The service worker starts once the first level has begun: it caches the shell, every level file, level 1's art, the splash and the summary card, adopts every file the game had already downloaded (the menus, the cutscene), and caches the rest of the art as it is first used, so everything you have played also plays offline. Service workers only run on `https://` or `localhost`.

Handy URL parameters: `?lang=fr_fr` (quiz language, using the original codes `en`, `bg_fl`, `bg_fr`, `cz_cz`, `dk_dk`, `fr_fr`, `gk_gk`, `it_it`, `pl_pl`, `por_por`, `sp_sp`), `?seed=42` (a fixed random seed), and for testing `?scene=platform&level=alpha_level5` (open one screen directly; the scene names and their parameters are in [`js/flow/contract.md`](js/flow/contract.md)).

## Tests

On your own machine, with Node 22:

```sh
npm ci && npx playwright install chromium && npm test
```

`npx playwright install chromium` downloads the browser Playwright drives. That is the right thing to do on your own machine; it was not run in the development container, which has Chromium preinstalled and must not download browsers.

`npm test` (`node web/tests/run.mjs`) runs the Node unit tests (physics, timelines, level data, controls), then serves `web/` on a local port and runs every `web/tests/*.spec.mjs` in headless Chromium. The whole run takes about 27 minutes (the two full journeys take about 10 of them). What it covers:

- **Every platform level completed through real inputs:** a recorded winning input trace per level (`web/tests/traces`) is replayed tick by tick from a fresh load and must finish with the recorded score, lives and step count; level 10 is replayed twice to prove the simulation is deterministic. Level 1 is also played live by a bot on a desktop with the keyboard and on an emulated phone (915 x 412, touch) with the on-screen controls, including multi-touch.
- **Data checks:** goal targets exist in sufficient numbers, spawns land on solid ground and nothing spawns inside a tile, every placed object has art, every briefing has its text; every quiz round in all 11 languages loads with no missing strings.
- **The flow:** New Game through the cutscene, the shrinking zone and into level 1, with the keyboard and with touch; Continue after a reload; a failed level; Level select; settings and key remapping; the ending.
- **The game show:** whole rounds with the keyboard and with taps, scores checked against the rules; the blind half; pause.
- **The kitchen:** all four levels with taps and with the keyboard, the gamepad, scoring, timing and drag and drop.
- **Phones:** every button at least 44 CSS px on a 667 x 375 phone; the touch controls never cover the player or the HUD.
- **The full journey** (`journey.spec.mjs`): one test plays a first visit from the language chooser and the splash through the cutscene, every shrinking zone, all ten platform levels (the planning bot), the four kitchen levels (the kitchen bot), all five quiz rounds and the ending with its scores, twice: on an emulated phone (915 x 412 landscape) with touch alone, every level played on the on-screen controls, and on a 1280 x 720 desktop with the keyboard alone. Screenshots of every screen go to `tools/.cache/journey/`.
- **Performance and payload** (`perf.spec.mjs`): frame time under 4x CPU throttling in real time for level 10, level 7 and a game show round (median 20 ms, 95th percentile 40 ms per 60 Hz frame; checked with GPU canvas, the software-canvas numbers reported), the bytes level 1 downloads, and the whole game under 15 MB.
- **Offline** (`pwa.spec.mjs`): the manifest and its icons; a first visit installs the service worker and its cache, and the rest of the game follows in the background; then, with the server shut down, a reload boots to the splash, plays level 1 from Level select, and plays levels 2 and 5 with their own art.
- **Patchy connections and memory** (`robustness.spec.mjs`, `memory.spec.mjs`): a file that fails to download (the atlas index, a level, an atlas page) is fetched again rather than remembered as missing; a whole journey keeps the decoded art under 150 MB at every scene.
- **Whole-game review fixes** (`review.spec.mjs`): the game show's echo in the quiz language, the blind-rounds setting changed mid-quiz, Full screen on a phone, the HUD ePhone fading over the player, scroll-safe Settings sliders and a cancellable key capture, language tags, and the level 1 download during the cutscene.
- **Content** (`content.spec.mjs`): every quiz file (5 rounds of 4, 4, 2, 5 and 6 questions, checked against the 2009 XML), every text key the code uses, every level file, every atlas file, and that `precache.json` is up to date.
- Most specs also fail on any console error or failed request.

Useful variations:

```sh
node web/tests/run.mjs --no-unit levels        # only the specs whose name contains "levels"
node web/tests/run.mjs --screenshots level1    # also write the level 1 screenshots to web/screenshots/
node tools/check-boot.mjs                      # quick gate: syntax check and a headless boot (a few seconds)
```

Screenshots from a normal run go to `tools/.cache/test-shots/` (not committed). If you change the simulation or level data, re-record the traces with `node web/tests/bots/record-traces.mjs` and run the tests again.

Safari and Firefox are untested (only Chromium is installed in the development container), and real phones need a person. The development container has no GPU: its default headless Chromium draws the canvas in software on the main thread, which misses the frame budget under 4x throttling (see the numbers `perf.spec.mjs` prints), so the budget is checked in Chromium with GPU canvas (SwiftShader), as phones draw canvas on their GPU.

## Fidelity gallery

[`screenshots/index.html`](screenshots/index.html) pairs every screen with the Flash original: Ruffle captures of the 2009 build (`reference/captures`) and screens composed from the original SWFs (`screenshots/reference`), each with what to compare and the deliberate differences. Open it from the repository or from any server. To retake the remake's screenshots and rebuild the page:

```sh
node tools/build-gallery.mjs                   # all screens (about 4 minutes)
node tools/build-gallery.mjs --only kitchen*   # some sessions only
node tools/build-gallery.mjs --html-only       # only the page
```

## Where the content comes from

The originals are in [`../reference/`](../reference): `Junior_Game/` holds the 2009 SWFs, ActionScript 2 source and level XML, `captures/` the Ruffle screenshots of the original, `analysis/` the survey notes, and `docs/` the design documents. Everything in `web/data/` and `web/js/platformer/data/` is generated from them by dev-only Node scripts in [`../tools/`](../tools) and committed, so the game never needs the tools. After `npm ci`:

| What | Command | Writes |
|---|---|---|
| Level layouts | `node tools/convert-levels.mjs` | `web/data/levels/*.json` from the level XML |
| Timeline data the platformer reads (labels, frame scripts, clip sizes) | `node tools/extract-timelines.mjs` | `web/js/platformer/data/clips.js` |
| Both of the above | `npm run levels` | |
| Quiz and host text, 11 languages | `node tools/convert-text.mjs` | `web/data/quiz/<code>.json`, `web/data/lang/manifest.json` |
| Render art from the SWFs through Ruffle | `node tools/swf-sheet/sheet.mjs tools/swf-sheet/jobs/<area>.json` | `tools/.cache/sheets/` (not committed; minutes per area) |
| Pack the art into WebP atlases | `node tools/build-atlas.cjs tools/atlas/<area>.json` | `web/data/atlas/*.webp`, `*.json`, `index.json` |
| Check the atlases cover everything, within budget | `node tools/atlas/coverage.mjs` | report only |
| Service-worker file list and version | `node tools/build-precache.mjs` | `web/precache.json`, `web/sw.js` stamp |

The art areas are `level1`, `levels`, `flow`, `gameshow` and `kitchen`, with the same name in `tools/swf-sheet/jobs/` and `tools/atlas/`. Render the sheets first, then pack; rerun `build-precache` after any change to `web/` (the test runner does it too). [`../tools/swf-sheet/README.md`](../tools/swf-sheet/README.md) explains how the SWF renderer works and every job option; `verify-atlas.mjs`, `verify-rig.mjs` and `compose.mjs` in the same folder check the atlases against Ruffle renders of the originals. `tools/ruffle/journey.cjs` replays the original game in Ruffle to make the reference captures. The whole art set is 9.8 MB of WebP.

## Deploying

- **GitHub Pages:** `tools/deploy-pages.sh ["message"]` takes `web/` as committed at `HEAD` (never unsaved edits), leaves out the tests, screenshots and Markdown, refreshes the precache list and pushes it to `/play/` on the `gh-pages` branch, served at https://gameologist.com/Super-Microbe-World/play/. Nothing else on `gh-pages` is touched. It needs push access to the repository.
- **claude.ai artifact:** `node tools/build-artifact.mjs artifact-dist` builds the artifact variant in `artifact-dist/`: the page without its own document skeleton (the host adds one), no web app manifest or service worker (the host runs pages in a frame without service workers), a 16 px side gutter, the language tables bundled into one file, and `files.json`, the map of published paths to files. Publish it with Claude's Artifact tool to the same URL each time, so the link stays the same. The current build is 170 files and 14.1 MB, inside the artifact limits (255 files and 64 MB per publish, 16 MB per file).
- Hosted builds carry no e-Bug, HPA or UKHSA logos or names; the page title is "Super Microbe World" ([`NOTES.md`](NOTES.md) section 11.2).

## Project layout

```
web/                    the game (serve this folder)
  index.html            page shell: stage, UI layer, touch controls, boot screen, rotate prompt
  manifest.webmanifest  PWA manifest; sw.js is the service worker, precache.json its file list
  js/core/              engine: 15 ms fixed-step loop, input (keyboard, touch, gamepad), audio and
                        procedural music, scenes and transitions, settings, saves, seeded RNG, test hooks
  js/ui/                DOM helpers, on-screen touch controls, device-aware key prompts
  js/platformer/        the platform game: physics and entities ported from the ActionScript,
                        HUD, ePhone briefings, renderer, camera
  js/gameshow/          the game show: studio, talkie, question board, rules
  js/kitchen/           the kitchen game
  js/flow/              splash menu, cutscene, shrinking zone, summary, ending, level select,
                        settings and the flow controller (contract.md describes the scene API)
  js/scenes/            scene registry and the splash
  data/                 generated content: atlases, levels, quiz text, UI strings
  fonts/                Baloo 2 and Atkinson Hyperlegible (OFL)
  icons/                app icons
  tests/                npm test: run.mjs, *.spec.mjs, unit/, bots/, traces/
  screenshots/          fidelity gallery (index.html), remake and Flash images, reference screens
  NOTES.md              design reference: flow, rules, physics, data, every Flash/Unity difference
                        and every bug fixed; NOTES-*-decisions.md are the per-area logs
  PROGRESS.md           checklist of the remake
  requests/             cross-area requests and their resolutions
tools/                  dev-only scripts (art pipeline, converters, Ruffle harness, deploy)
reference/              the 2009 originals, Ruffle captures, analysis and documents
Assets/, ProjectSettings/, LastBuild/   the 2013-14 Unity remake (untouched)
```

## Credits

- **The original game:** the e-Bug Junior Game by **David Farrell** (City University London, 2007 to 2009), made for the e-Bug schools project with European Commission (DG SANCO) funding, with artwork by **Nancy Lai** and **Sandy Beveridge** (Farrell et al., *J Antimicrob Chemother* 2011; 66 Suppl 5: v39-v44). The art, levels and text in this remake are rendered or converted from that game's files.
- **The Unity remake** (2013-14) by **Pedro Rodriguez**, the Unity project in this repository, was a secondary source: its copies of the live quiz and conversation text in 11 languages are used; its art and level layouts were compared with the Flash original, whose own art and levels are the ones used.
- **Fonts:** Baloo 2 by Ek Type and Atkinson Hyperlegible by the Braille Institute, both under the SIL Open Font License 1.1 (`web/fonts/OFL-*.txt`).
- **Tools:** [Ruffle](https://ruffle.rs) runs the original SWFs for the reference captures and art renders, [swf-parser](https://github.com/open-flash/swf-parser) reads them, and [Playwright](https://playwright.dev) drives the tests. None of them ship with the game.
- The remake was built with Claude Code (Anthropic) for David Farrell in 2026.

e-Bug is a trademark of its owners. The remake carries no e-Bug branding and is not endorsed by the e-Bug project.

## Licence

The repository is licensed under the GNU General Public License v3.0 ([`../LICENSE.md`](../LICENSE.md)). The bundled fonts keep their own licence, the SIL Open Font License 1.1.
