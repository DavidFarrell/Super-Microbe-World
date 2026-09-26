# Requests from the levels area (platform levels 2-10)

Changes the levels area wanted in files it did not own. Each entry: file, change, reason,
workaround, and how it was resolved when the areas were joined (all items are done).

## [Done] 1. `web/data/lang/en.json`: drop the platform briefing pages now in `en/levels.json`

- **Change**: remove the keys `intro.level1.1` to `intro.level10.6` (including
  `intro.level1.5.title` and `intro.level1.5.tag`) from `web/data/lang/en.json`.
- **Reason**: the level briefing text now lives in the levels namespace,
  `web/data/lang/en/levels.json` (same keys, same text). Two copies of the same strings invite
  edits to the wrong one; translators should find the level text in one place.
- **Workaround**: none needed. Namespace files are merged after `en.json` (`web/js/core/i18n.js`
  `loadTable`), so `en/levels.json` already wins; the copies are identical today.
- **Resolution (integration, 2026-09-26)**: done. The 35 `intro.levelN.*` keys (all identical to `en/levels.json`) were removed from `en.json`, whose comment now points to `en/levels.json`; `levels.spec` (d) and `level1.spec` read the pages from the namespace file.

## [Done] 2. `web/NOTES-platformer-decisions.md`: its follow-ups are done

- **Change**: in "Follow-ups (not done here)", mark "Level bots for levels 4 to 10" and "Art for the
  other levels" as done, pointing to `web/NOTES-levels-decisions.md`.
- **Reason**: every level 1-10 is completed by the planner bot with recorded traces, and every
  level draws its own atlas set; the old text says levels 2-10 use debug shapes.
- **Workaround**: `web/NOTES-levels-decisions.md` section 6 says so.
- **Resolution (integration, 2026-09-26)**: done. "Follow-ups (not done here)" marks the level bots and the art for levels 2-10 as done, pointing to `web/NOTES-levels-decisions.md` sections 2 and 4.

## [Done] 3. Art (`web/data/atlas/`, `tools/swf-sheet/jobs/`): the level 8 and 9 briefing glass in its yoghurt state

- **Change**: re-render `level_intros_level8` frames 200 and 210 (level 8 pages 2 and 3) and
  `level_intros_level9` frame 230 (level 9 page 2) so the milk glass shows its yoghurt state (pink,
  with drips), as captured.
- **Reason**: captures `105-level8-intro-p2.png`, `106-level8-intro-p3.png` and
  `109-level9-intro-p1.png` (level 9 page 2) show the pink yoghurt glass that illustrates "Lucy
  Lactobacillus can turn milk into yogurt"; the atlas pages show plain white milk. The HUD
  picture `milk_image` already gets this through the `pin` job option (its frame-1 script
  `glass.gotoAndStop("yogurt")`, `reference/analysis/swf-scripts/introductionToMicrobes_platformer.txt:679-680`,
  `web/NOTES-art-decisions.md` section 5). The page glass is probably a `milk_image` instance (or a
  nested glass clip) rendered without that pin; not verified.
- **Workaround**: none; the pages draw what the atlas holds (`intro.js` needs no change).
- **Resolution (integration, 2026-09-26)**: done. The page glass is a `milk_image` instance (level_intros depth 75, frames 200-240, the only `glass` in the clip), so a new render job `level_intros_r3` (frames 190-240, `pin: { glass: "yogurt" }`) feeds the `intro-r3` atlas (levels 8 and 9 only; the other intro atlases are untouched). Frame 200 now shows the pink glass with drips, as capture `105`; `coverage.mjs` passes and `index.json` was written atomically.

## [Done] 4. `web/NOTES.md` 4.4 (row 13), the box-size notes (about lines 978, 1807, 1932) and 12.6 item 1: Patty's box is settled

- **Change**: record Patty's physics box as **187.89 x 141.53** (the `levels.json` survey, "union
  of frame-1 child bounds, mask layers excluded"), settled by the Ruffle captures, and drop it from
  the open questions. Slarg (90.57 vs 90.37) stays open.
- **Reason**: with 203.32 x 150.39 level 4's first Patty is pushed off her spawn cell on step 2
  (53.3 px left by the loaf at (4,14), then 50.4 px up by the cheese at (6,8)) and hovers 60 px
  above the bread stick for the whole level. Captures `050-level4-opening` and `051-level4-moving`
  show her standing on the bread stick at her spawn cell, which is what 187.89 x 141.53 gives (the
  two pushes cancel within one constraint pass and she stays at (550, 200)). Only level 4 places
  Patty. The clip bounds used for `hitTest` and the on-screen test (`clips.js`, Flash's live
  `_width`) are a separate question the captures do not answer and are unchanged.
- **Done in this area**: `tools/convert-levels.mjs` `BOX_OVERRIDES`, regenerated
  `web/data/levels/alpha_level4.json` and `tile_definitions.json`, re-recorded the level 4 trace
  (`web/NOTES-levels-decisions.md` section 5).
- **Resolution (integration, 2026-09-26)**: done. `web/NOTES.md` records 187.89 x 141.53 as settled by the captures in 3.16 (row 13), 4.2, 4.4, 10.4 (#83), 11.4 (risk 8), 12.6 and 13; only Slarg stays open.

## [Done] 5. `web/NOTES-platformer-decisions.md` "Briefing" (about lines 182-199): two claims are out of date

- **Change**: (a) replace "The level and the HUD around the phone stay at full brightness, as in the
  original (no dimmed backdrop)" with: there is no dimmed backdrop; while the first briefing is up
  only the background, the level's entities and the HUD show around the phone (the original had
  not built any tiles yet: `INIT_DIALOGUE` never reaches `RENDER_WORLD`, `PlatformGame.as:540-551`,
  `1090-1107`); the re-opened briefing (port only) shows the whole level. (b) Add: play and the
  level clock start as the phone starts shrinking, as the original did (`PlatformGame.as:545-549`),
  so the level runs under the phone as it turns away; a re-opened briefing resumes once the phone
  has gone. (c) "the control hint under the phone (outlined so it reads on any background)" is now
  drawn on a dark pill; (d) the briefing's autoplay stops while the window is blurred or hidden and
  restarts with the player's next key or tap.
- **Reason**: review findings on the briefing; the code (`intro.js`, `platformScene.js`,
  `render.js`) now does this. See `web/NOTES-levels-decisions.md` section 7.
- **Workaround**: the levels decisions file records the behaviour.
- **Resolution (integration, 2026-09-26)**: done. The "Briefing" paragraph now says: no dimmed backdrop, only the background, entities and HUD around the first briefing's phone (no tiles yet, `PlatformGame.as:540-551,1090-1107`) and the whole level around a re-opened one; play and the clock start as the phone starts shrinking (`PlatformGame.as:545-549`), a re-opened briefing resumes once the phone has gone; the control hint sits on a dark pill; the autoplay stops while the window is blurred or hidden and restarts with the next key or tap.
