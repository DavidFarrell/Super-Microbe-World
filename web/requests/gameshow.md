# Requests from the game show area

Changes the game show area needed in files it did not own. Each entry: file, change, reason, the
workaround it used, and how it was resolved when the areas were joined (all items are done).

## [Done] 1. Art (`tools/swf-sheet/jobs/gameshow.json`, then `web/data/atlas/gameshow-cast.*`): render `condifent`

- **Change**: add `"condifent"` (and, optionally, `"curious"`) to `entryLabels` of the `gs_harry`
  and `gs_amy` jobs and re-pack `gameshow-cast`. (The art notes left them out because the 2009
  code never reaches them; the port does, per NOTES 10.2 #43.)
- **Reason**: in a blind round the player's child plays one of `neutral`, `cautious` or the
  misspelt `condifent` at random (`GameShow.as:220-228`; NOTES 6.1 and 10.2 #43 say the port plays
  `condifent`). The rig render left those frames out (`rig.frames` 420-599 and 999-1124 are all
  null), so the confident face cannot be shown.
- **Workaround**: `web/js/gameshow/studio.js` falls back to `cautious` (and `curious` to
  `neutral`) while a label has no poses. The check runs at play time, so the new art is used as
  soon as it lands; nothing else needs to change.
- **Resolution (integration, 2026-09-26)**: done. `condifent` and `curious` are in the `entryLabels` of the `gs_harry` and `gs_amy` jobs; both rigs were re-rendered (798 of 1124 frames each, 126 reachable frames per new label) and `gameshow-cast` re-packed (1.36 MB WebP, was 1.03 MB; `index.json` written atomically; `tools/atlas/coverage.mjs` passes). `verify-rig.mjs` gives 3.5-3.8/255 against Ruffle on the new frames, as the previously shipped render of the same rigs does on existing frames (3.5-3.8; the untouched host reads 2.5), so the re-render is no worse than the old one. The fallback in `studio.js` stays as a guard only. Tested by `integration.spec` (both labels play without a fallback and have poses).

## [Done] 2. Flow area (`web/js/flow/contract.md`): result fields

- **Change (documentation only)**: note that the game show's `result.answers` entries are
  `{ q, choice, value, score, blind, cpu: { choice, value } | null }` and that `result` also
  carries `round`, `blind` and `lang`.
- **Reason**: the contract lists `answers: [{ q, value }]`; the extra fields are additive and let a
  summary or the ending show how each question went.
- **Workaround**: none needed (the listed fields are present).
- **Resolution (integration, 2026-09-26)**: done. `contract.md` lists `result = { playerScore, cpuScore, answers, round, blind, lang }` with each `answers` entry `{ q, choice, value, score, blind, cpu: { choice, value } | null }` and their meanings.

## [Done] 3. Text data (`tools/convert-text.mjs`, then `web/data/quiz/por_por.json`; owner of the quiz data): Portuguese points line

- **Change**: in the `por_por` conversion, replace the Polish sentence "Za prawidłową odpowiedź
  otrzymasz 10 punktów, ale jeśli odpowiesz źle, wtedy punkty otrzymuje przeciwnik." at
  `rounds[0].intro.normal[2]` and `rounds[1].intro.normal[1]` with a Portuguese line of the same
  meaning, as a counted override (expect exactly 2 replacements, fail otherwise). Suggested text,
  the translator's own rounds 3 to 5 line without "Lembra-te que": "Ganhas 10 pontos por cada
  resposta certa. Se estiver errada o outro jogador é que ganha." Optionally also normalise the
  English "Ready ?" to "Ready?" there (NOTES 6.8).
- **Reason**: a 2009 data defect (`Assets/Resources/TextFiles/quiz/por_por_gameshow_round1.xml`
  and `_round2.xml`): Portuguese players hear a Polish sentence. The educational content is
  unchanged (same meaning as the English line). `pl_pl` has the same sentence legitimately.
- **Workaround**: `web/js/gameshow/rules.js` `normaliseIntro()` makes both replacements at play
  time, matched on the exact text in `por_por` only, so it becomes a no-op once the data is fixed
  (`web/NOTES-gameshow-decisions.md` G8, G9).
- **Resolution (integration, 2026-09-26)**: done. `tools/convert-text.mjs` has a documented `CORRECTIONS` table of counted per-language corrections (each must match exactly its expected count or the conversion fails): the Polish points line in `por_por` becomes "Ganhas 10 pontos por cada resposta certa. Se estiver errada o outro jogador é que ganha." (2 replacements, `rounds[0].intro.normal[2]`, `rounds[1].intro.normal[1]`), and English "Ready ?" becomes "Ready?" (2). The tool was first re-run unchanged (output identical to the committed data), then with the corrections: the diff is exactly those four lines. The play-time override in `rules.js` was removed; `normaliseIntro()` keeps only an English spacing guard. `gameshow.spec` (every round of every language) still checks both.
