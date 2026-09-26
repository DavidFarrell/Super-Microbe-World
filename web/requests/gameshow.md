# Requests from the game show area

Changes the game show area needs in files it does not own. Each entry: file, change, reason, and
the workaround in place meanwhile.

## 1. Art (`tools/swf-sheet/jobs/gameshow.json`, then `web/data/atlas/gameshow-cast.*`): render `condifent`

- **Change**: add `"condifent"` (and, optionally, `"curious"`) to `entryLabels` of the `gs_harry`
  and `gs_amy` jobs and re-pack `gameshow-cast`.
- **Reason**: in a blind round the player's child plays one of `neutral`, `cautious` or the
  misspelt `condifent` at random (`GameShow.as:220-228`; NOTES 6.1 and 10.2 #43 say the port plays
  `condifent`). The rig render left those frames out (`rig.frames` 420-599 and 999-1124 are all
  null), so the confident face cannot be shown.
- **Workaround**: `web/js/gameshow/studio.js` falls back to `cautious` (and `curious` to
  `neutral`) while a label has no poses. The check runs at play time, so the new art is used as
  soon as it lands; nothing else needs to change.

## 2. Art (`gameshow_set/podia`, atlas `gameshow-bg` symbol `gs_podia`): remove the podium logo

- **Change**: erase the blue e-Bug smiley (with its gear outline) from the front of the host's
  podium in the `gs_podia` render, as was done for the arch sign in `gs_set` (an `erase` entry on
  the podium shape, stage area about x 228-279, y 281-350).
- **Reason**: the hosted build must carry no e-Bug branding (NOTES 11.2, 11.4 #15). The same
  podia art also appears in the cutscene and ending, which use `Studio` from this area.
- **Workaround**: `Studio.drawPodiumBadge()` covers the logo with a gold "?" quiz-show plaque.
  If the logo is erased the plaque can stay (it reads as part of the set) or be removed.

## 3. Flow area (`web/js/flow/contract.md`): result fields

- **Change (documentation only)**: note that the game show's `result.answers` entries are
  `{ q, choice, value, score, blind, cpu: { choice, value } | null }` and that `result` also
  carries `round`, `blind` and `lang`.
- **Reason**: the contract lists `answers: [{ q, value }]`; the extra fields are additive and let a
  summary or the ending show how each question went.
- **Workaround**: none needed (the listed fields are present).
