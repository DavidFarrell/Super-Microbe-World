# Super Microbe World remake: progress

Living checklist for the remake (see `../GOAL_PROMPT.md` for the full brief and `NOTES.md` for the design reference). Updated at every milestone so work survives context resets.

## Step 0: originals
- [x] Inventory the "Junior Game" Drive folder (387 files, 20 folders, fully paged)
- [x] Download 273 useful files via the Drive connector, decode from persisted results, verify every byte size (no Drive sharing needed; permissions untouched)
- [x] Commit to `reference/Junior_Game/` (SWFs, AS2 source, level XML; FLA/backup files skipped)
- [x] Extract Flash-era design docs to `reference/docs/` (implementation documentation, 2011 evaluation paper, poster)
- [x] Ruffle harness runs the original SWFs headless (`tools/ruffle/`)

## Deploy probe
- [x] Probe artifact published with a results channel: https://claude.ai/artifact/NVGD8ms58Z8bdEF9dY3iFT
- [ ] David opens it on a phone and sends results
- [x] Hosting decided by David (2026-09-26): GitHub Pages under `/play/` on gh-pages (approved) plus the artifact; artifact wording may say "Super Microbe World Game Show" instead of e-Bug branding
- [x] Pages deploy script `tools/deploy-pages.sh`; bring-up build live at https://gameologist.com/Super-Microbe-World/play/

## Survey
- [x] Unity remake: asset catalogue (`reference/analysis/unity-assets.md`)
- [x] Unity remake: logic (`reference/analysis/unity-logic.md`)
- [ ] Flash: platformer engine, flow/quiz/kitchen, levels, SWF assets and sounds, Ruffle captures
- [ ] `web/NOTES.md` synthesised and verified by a completeness critic

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
- [ ] Asset pipeline: atlases (WebP), level JSON, text JSON (11 languages), sounds
- [ ] Vertical slice: level 1 end to end with touch, juice, sound, bot test; published
- [ ] Remaining platform levels, each with a bot test
- [ ] Kitchen game
- [ ] Game show: host dialogue, quiz rounds, scoreboard, winner screen
- [ ] Splash, intro cutscene, avatar select, shrinking zone, level intros, summary pages
- [ ] Pause menu, settings (volumes, mute, reduced motion/shake, key remap, touch opacity, text size, language)
- [ ] Level select after unlock (2011 paper's recommendation)

## Verification and delivery
- [ ] Playwright suite: smoke, data checks, level bots, full journey (mobile touch + desktop keyboard), perf, PWA offline
- [ ] Fidelity gallery `web/screenshots/index.html` with Ruffle references
- [ ] `web/README.md` with play and test commands
- [ ] Published at a clickable link; final report
