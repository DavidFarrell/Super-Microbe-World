# Super Microbe World remake: progress

Living checklist for the remake (see `../GOAL_PROMPT.md` for the full brief and `NOTES.md` for the design reference). Updated at every milestone so work survives context resets. Last checked against the repository on 2026-09-26, after integration and the whole-game review fixes: every box below was verified by looking at the code, the tests or the live links, not taken from earlier reports.

## Step 0: originals
- [x] Inventory the "Junior Game" Drive folder (387 files, 20 folders, fully paged)
- [x] Download 273 useful files via the Drive connector, decode from persisted results, verify every byte size (no Drive sharing needed; permissions untouched)
- [x] Commit to `reference/Junior_Game/` (SWFs, AS2 source, level XML; FLA/backup files skipped)
- [x] Extract Flash-era design docs to `reference/docs/` (implementation documentation, 2011 evaluation paper, poster)
- [x] Ruffle harness runs the original SWFs headless (`tools/ruffle/`); 340 reference captures in `reference/captures/`

## Deploy probe
- [x] Probe artifact published with a results channel: https://claude.ai/artifact/NVGD8ms58Z8bdEF9dY3iFT
- [ ] David opens it on a phone and sends results (no results received yet)
- [x] Hosting decided by David (2026-09-26): GitHub Pages under `/play/` on gh-pages (approved) plus the artifact; artifact wording may say "Super Microbe World Game Show" instead of e-Bug branding
- [x] Pages deploy script `tools/deploy-pages.sh`; artifact build script `tools/build-artifact.mjs`

## Survey
- [x] Unity remake: asset catalogue (`reference/analysis/unity-assets.md`)
- [x] Unity remake: logic (`reference/analysis/unity-logic.md`)
- [x] Flash: platformer engine, flow/quiz/kitchen, levels, SWF assets and sounds, Ruffle captures (`reference/analysis/flash-*.md`)
- [x] `web/NOTES.md` synthesised and checked against the primary sources (section 13, 42 claims); area decision logs folded in (section 14)

## Engine core
- [x] Fixed 15 ms tick loop (matches the original `setInterval(loop, 15)`), manual stepping for tests
- [x] Unified input: keyboard (remappable), touch controls (DOM, stable ids, sliding d-pad), gamepad, injected
- [x] 800x450 stage letterboxed with safe areas; DOM UI layer scaled with the stage
- [x] Audio: unlock on gesture, master/music/sfx buses, synthesised effects, procedural music sequencer
- [x] Scenes with fade and iris transitions; tweens; particles, shake, popups, haptics
- [x] Bundled OFL fonts (Baloo 2, Atkinson Hyperlegible), no network requests
- [x] `window.__test` hooks
- [x] PWA: manifest, icons, service worker with stamped precache; artifact build script

## Content
- [x] SWF art pipeline (`tools/swf-sheet`): sprites rendered from the 2009 SWFs via Ruffle into WebP atlases
- [x] Level JSON for all 11 platform levels (`tools/convert-levels.mjs`; level 11 is converted but not in the journey, decision 11.9 #16)
- [x] Text: quiz and host introduction in all 11 languages (`web/data/quiz/`); every other string in English with an English fallback for the other languages (NOTES 7.1; the original had no other translations for them)
- [x] Atlases for every screen: 9.83 MB of WebP against a 12 MB budget, `tools/atlas/coverage.mjs` passes (the original has no sounds; effects are synthesised)
- [x] Vertical slice: level 1 end to end with touch, juice, sound and bot test, published to the artifact and to Pages at the time
  - [x] Original art in play: tiles, Lucy, Harry/Amy (upper + lower clips), pickups, projectiles, camera flash, portal, background
  - [x] Canvas HUD from the original art (score digits, hearts, timer, ePhone status with goal picture and tick boxes); touch layout variant
  - [x] Animated ePhone briefing from the original art, translatable text, device-aware prompts, re-open with the phone
  - [x] Juice: squash/stretch, particles, hit-stop, shake, hit flashes, sparkle trails to the ePhone, popups, eased counters, camera look-ahead, portal burst, suck-in + iris to level complete
  - [x] Synthesised effects and procedural music per area
  - [x] `web/tests/level1.spec.mjs` (keyboard bot, touch bot, viewport and multi-touch checks)
- [x] Platform levels 2-10, each completed in `web/tests/levels.spec.mjs` by replaying the planner bot's recorded winning input trace (`web/tests/traces/`), plus data checks and briefing checks
- [x] Kitchen game, four levels (`web/js/kitchen/`, `kitchen.spec.mjs`, `kitchen-controls.spec.mjs`)
- [x] Game show: host dialogue, blind and sighted quiz rounds, scoreboards, CPU opponent (`web/js/gameshow/`, `gameshow.spec.mjs`)
- [x] Splash, intro cutscene, avatar select, nickname form, shrinking zone, level intros, summary cards, winner card (`web/js/flow/`, `flow.spec.mjs`, `flow-fixes.spec.mjs`)
- [x] Pause menu (with Settings and Level select), settings (volumes, mute, blind rounds, restart rule, reduced motion/shake, key remap, touch opacity, haptics, text size, language, data reset)
- [x] Level select after unlock (2011 paper's recommendation; platform levels and kitchen levels)

## Integration (2026-09-26)
- [x] Cross-area requests resolved (`web/requests/*.md`, every item marked done with its resolution)
- [x] Art: game show `condifent` / `curious` poses, level 8 and 9 yoghurt pages, level 1 portal page motion; splash smileys confirmed erased
- [x] `web/NOTES.md` section 10 consolidates every bug fixed across areas; section 14 points to the area logs
- [x] Next-screen art prefetched during the current screen (decoded when certain, downloaded only when likely); loading ring instead of placeholder art
- [x] Platform pause menu: Settings and Level select; kitchen tool keys remappable
- [x] Full suite at the end of integration: 73 passed, 0 failed (unit tests plus 72 browser specs, about 13 minutes); `tools/check-boot.mjs` passes

## Whole-game review fixes (2026-09-26)
- [x] Blocker: failed downloads were cached for the session; no loader keeps a failure now, network errors are retried once, the level error card offers Try again (`robustness.spec.mjs`)
- [x] Texture memory: one atlas store with `release()`; the flow closes what the next screen does not use; a whole journey peaks at 127 MB decoded instead of about 383 MB (`memory.spec.mjs`, budget 150 MB)
- [x] Offline beyond level 1: the service worker caches the rest of the game in the background once play begins; levels 2 and 5 play offline with their art (`pwa.spec.mjs`)
- [x] Portuguese round 4 question 3 (a blind-round notice in the 2009 data) replaced by the opened-tins question; `content.spec` guards every language (NOTES 10.2 #87; native-speaker check pending)
- [x] Cutscene choice and form can no longer be skipped unseen by mashing keys or taps; Full screen on phones (splash, pause cards, touch New Game)
- [x] Minor fixes: game show echo in the quiz language, closing line, yoghurt goal text, blind-rounds toggle mid-quiz, HUD ePhone fade, dimmed Throw button, held controls never fade, briefing pace, scroll-safe sliders, pause-card confirmations, key-capture Cancel, language tags, artifact without brand strings, dead code removed, level 1 art prefetched during the cutscene (NOTES 10.6)
- [ ] Not done (NOTES 10.6): lazy scene registration and compact rig poses (slow-3G boot and cutscene waits); a "New version ready" prompt for an installed app
- [x] Full suite after these fixes: 95 passed, 0 failed (53 unit tests plus 94 browser specs, about 27 minutes, three new spec files: `robustness`, `memory`, `review`); `tools/check-boot.mjs` passes; the artifact build is 170 files plus index.html (172 on disk with files.json), 13.96 MB, no brand strings, and boots with the bundled language
- [x] Payload after these fixes: whole game 14.93 MB (15 MB budget, 71 kB headroom); level 1 downloads 2.95 MB; decoded texture peak 127 MB over a journey

## Verification and delivery
- [x] Playwright suite runnable with one command (`npm test`)
  - [x] Boot gate (`tools/check-boot.mjs`) and no console errors in the specs
  - [x] Data checks: goal targets, spawns on solid ground and clear of tiles, art for everything placed, every quiz round in every language
  - [x] Every platform level completed through real inputs (trace replays), level 10 determinism, level 1 live bot on desktop keyboard and phone touch
  - [x] Flow with keyboard and with touch from New Game through the cutscene and shrinking zone into level 1; whole game show rounds with keyboard and with touch; all four kitchen levels with keyboard, touch and gamepad
  - [x] Full journey in one test (`web/tests/journey.spec.mjs`): first visit, splash, cutscene, every shrinking zone, all ten levels (planning bot), the four kitchen levels (kitchen bot), every quiz round, the ending with its scores; on a 915 x 412 phone with touch alone (every level on the on-screen controls) and on a 1280 x 720 desktop with the keyboard alone
  - [x] Performance (`web/tests/perf.spec.mjs`): frame time under 4x CPU throttling for level 10, level 7 and a game show round, checked with GPU canvas; software-canvas numbers reported (over budget: the container has no GPU); payload of level 1 and of the whole game
  - [x] PWA (`web/tests/pwa.spec.mjs`): manifest and icons, service worker install, offline reload (server shut down) boots to the splash and plays level 1 from Level select. Found and fixed: offline, the splash drew placeholders and Level select's art failed (files downloaded before the worker took over were never cached); the worker now adopts them and precaches the splash and summary art
  - [x] Content (`web/tests/content.spec.mjs`): quiz files against the 2009 XML, every i18n key the code uses, level files, atlas files, precache freshness
  - [x] Full suite with these four specs: 84 passed, 0 failed (unit tests plus 83 browser specs, about 24 minutes); `tools/check-boot.mjs` passes
  - [x] Payload: 14.1 MB of runtime files in the artifact build (9.8 MB of it WebP art), inside the 15 MB budget; `tools/atlas/coverage.mjs` checks the art budget (not part of `npm test`)
- [x] Fidelity gallery `web/screenshots/index.html`: 33 comparisons covering every screen, each next to its Ruffle capture (and the composed Flash screen where there is one) or marked as new in the remake, with the deliberate differences linked to NOTES; regenerate with `tools/build-gallery.mjs`
- [x] `web/README.md` with the game, controls, play and test commands, asset pipeline, deployment, layout, credits and licence; root `README.md` points to the remake
- [x] Full game published at a clickable link (2026-09-26, build 858a86039072): Pages at https://gameologist.com/Super-Microbe-World/play/ (all 181 runtime files fetched back and byte-identical to the tested build) and the artifact https://claude.ai/artifact/VGSd4HuhbJKFW77wswuRr3 (version 2, 170 files plus the page). A browser boot against the live Pages site could not run here: the container's egress proxy re-signs TLS and Chromium rejects it, and verification is never disabled
- [x] Final report (verified and how, differences from Flash and why, untested: iOS Safari, Firefox, real devices)

## Known limits
- WebKit is not installed in the development container, so iOS Safari (audio unlock, memory, fullscreen) is untested; Firefox is untested too.
- Playwright cannot sign in to the private artifact URL, so the tests run on the identical files locally and the artifact is checked by reading it back.
- A real-device playthrough needs David.
