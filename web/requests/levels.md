# Requests from the levels area (platform levels 2-10)

Changes the levels area would like in files it does not own. Each entry: file, change, reason,
workaround. None blocks the area.

## 1. `web/data/lang/en.json`: drop the platform briefing pages now in `en/levels.json`

- **Change**: remove the keys `intro.level1.1` to `intro.level10.6` (including
  `intro.level1.5.title` and `intro.level1.5.tag`) from `web/data/lang/en.json`.
- **Reason**: the level briefing text now lives in the levels namespace,
  `web/data/lang/en/levels.json` (same keys, same text). Two copies of the same strings invite
  edits to the wrong one; translators should find the level text in one place.
- **Workaround**: none needed. Namespace files are merged after `en.json` (`web/js/core/i18n.js`
  `loadTable`), so `en/levels.json` already wins; the copies are identical today.

## 2. `web/NOTES-platformer-decisions.md`: its follow-ups are done

- **Change**: in "Follow-ups (not done here)", mark "Level bots for levels 4 to 10" and "Art for the
  other levels" as done, pointing to `web/NOTES-levels-decisions.md`.
- **Reason**: every level 1-10 is completed by the planner bot with recorded traces, and every
  level draws its own atlas set; the old text says levels 2-10 use debug shapes.
- **Workaround**: `web/NOTES-levels-decisions.md` section 6 says so.
