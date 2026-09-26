# Scene contract for the game flow

Every screen is a scene registered in `web/js/scenes/index.js`. The flow controller
(`web/js/flow/flow.js`, a port of `GameController.as`) drives the order by calling
`app.scenes.go(name, params, transition)` and receives results through callbacks in `params`.
Scenes never decide what comes next on their own when a callback is given; without callbacks
(opened directly through `?scene=...` for testing) they fall back to sensible standalone behaviour.

| Scene | Owner folder | Params in | Callback(s) out |
|---|---|---|---|
| `splash` | `web/js/scenes/splash.js` (flow) | `{}` (`?lang=<code>` applies a language and skips the first-run chooser) | `app.flow.newGame()` / `continueGame()` / level select / settings |
| `cutscene` | `web/js/flow/` | `{ onComplete }` | `onComplete({ avatar: 'harry'\|'amy', nickname })` (no age or e-mail is collected, NOTES 11.2) |
| `shrink` | `web/js/flow/` | `{ avatar, round, skippable, onComplete }` (`skippable` false for the player's first shrink, NOTES 2.5; default true when opened directly) | `onComplete({ focus: { x, y } })` (stage point of the shrunk child; the flow centres the iris into the level on it) |
| `platform` | `web/js/platformer/` | `{ level, avatar, score, intro, seed, onComplete(result), onGameOver(result), onQuit() }` | `result = { level, score, next, reason }`; `score` in is the running hoverboard total, `result.score` the new total. The pause menu also offers Settings (`openSettings`, below) and Level select (`app.flow.openLevelSelect()`); the `platform` probe reports the `avatar` in play |
| `kitchen` | `web/js/kitchen/` | `{ level: 0..3, avatar, score, seed, onComplete(result), onQuit() }` | `result = { level, score, points, report, rows, notes, awarded, deducted, reason, placed, items }`; `score` in is the running kitchen total, `result.score` the new total and `points` this level's; `report` has one entry per placement, `{ item, name, location, ok, reason, hygiene, clingfilm, points }` (`ok` is `null` for mouldy or burst food in the bin, which the original counted neither way) |
| `gameshow` | `web/js/gameshow/` | `{ round: 1..5, avatar, nickname, cpuName, playerScore, cpuScore, blind, stepRight, seed, onComplete(result), onQuit() }` | `result = { playerScore, cpuScore, answers, round, blind, lang }`; one `answers` entry per question, `{ q, choice, value, score, blind, cpu: { choice, value } \| null }` (`choice` 0 Agree, 1 Don't Know, 2 Disagree; `value` 1 correct, 0 safe, -1 wrong; `score` the question's points, 10; `cpu` the CPU's turn, null in the blind half) |
| `summary` | `web/js/flow/` | `{ kind: 'died'\|'time'\|'complete'\|'kitchen', result, lines?, title?, backdrop?, buttons?, onComplete(choice) }`; `backdrop` is a canvas (the flow copies `app.view.canvas` when the level ends, so the card sits over the frozen, dimmed level) | `onComplete('retry' \| 'next' \| 'levelSelect' \| 'menu' \| 'continue')` |
| `ending` | `web/js/flow/` | `{ playerScore, cpuScore, hoverScore, kitchenScore, avatar, nickname }` | Play again / Level select / Main menu |
| `levelSelect` | `web/js/flow/` | `{}` | starts a single level (platform or kitchen sub-level) standalone |
| `settings` | `web/js/flow/` | `{ back, backParams }` | returns to `back` (default `splash`) |

## Game show parameters (quiz rounds)

- `playerScore` / `cpuScore` are **quiz points only** (the winner is decided by them, decision 11.9 #4).
  Hoverboard and kitchen points never go to the game show.
- `blind: true` runs the **blind half** only (build A): the round's `<blind>` intro lines, the
  questions with the blind notice and no scoring or CPU turn, then the host line "Step right this
  way and prepare to enter the world of microbes!", then `onComplete`. It is only used when the
  player turns on the "blind rounds" setting (decision 11.9 #1; the "great bonus later" sentence is
  dropped, #2).
- `blind: false` (default) runs the **sighted half**: the `<normal>` intro lines, every question
  scored with host feedback and a CPU turn, including the last (build B).
- `stepRight: true` asks the game show to end the sighted half with "Step right this way and
  prepare to enter the world of microbes!" before `onComplete`, because a shrinking zone follows
  (blind rounds off, rounds 1-4). `false` after the final round (the ending follows) and when blind
  rounds are on (the next round's blind half follows).
- `cpuName` is the other child's name ("Amy" when the player is Harry, "Harry" when the player is Amy).
- `nickname` is never empty: the flow falls back to the avatar's name.

## Flow order (see `web/NOTES.md` 2.3 and 11.9)

```
splash -> cutscene -> for round r = 1..5:
    [blind rounds on: gameshow { blind: true }]
    shrink -> action (platform chain, or kitchen levels 0..3 for round 4)
    gameshow { blind: false, stepRight: !blindRounds && r < 5 }
 -> ending
```

- "Step right this way and prepare to enter the world of microbes!" precedes every shrink: for
  round 1 with blind rounds off the cutscene says it after its closing line; otherwise the game
  show says it (`blind: true`, or `stepRight: true`).
- A failed platform level (lives or time) shows `summary` over the frozen, dimmed level and then
  restarts **the same level** with the score kept (decision 11.9 #5). With the setting
  `restartScope: 'round'` (Settings, Game: "Restart the whole round") it restarts the round's
  first level with its briefing, as Flash did (NOTES 11.1 #2). The retry straight after the
  summary card skips the briefing (`intro: '0'`); a level resumed with Continue shows it.
- Seeds: a new journey draws a fresh run seed (`?seed=<n>` fixes it) and every journey step
  derives its `seed` from it. A level played from Level select gets a fresh seed of its own
  (`?seed=<n>` makes it reproducible), never the saved journey's.
- Progress is saved at the start of every step (`smw:progress`); Continue on the splash resumes
  the step the player was on. Level select plays one level alone, with no shrink or quiz, and
  records a best score.

## Shared services (`app.flow`, `web/js/flow/*.js`)

- `app.flow.state` (read only): `{ run, unlocked, best }`; `app.flow.newGame()`,
  `continueGame()`, `hasSave()`, `playLevel(id)` (`'alpha_level3'` or `'kitchen2'`),
  `toSplash()`, `openLevelSelect()`.
- `openSettings(app, { onClose })` from `web/js/flow/settings.js` opens the settings as an
  overlay over any scene (for pause menus). While it is open the host scene must not act on
  input (check `app.flow.overlayOpen`); `onClose()` runs when it closes.
- Settings keys owned by the flow: `blindRounds` (default `false`), `restartScope` (`'level'`
  default, `'round'`). Text size: `textScale`
  (1, 1.15, 1.3); the flow mirrors it to the CSS variable `--text-scale` on `:root`, so area CSS
  can use `calc(16px * var(--text-scale, 1))`.
- `?lang=<code>` (original codes: `en`, `bg_fl`, `cz_cz`, ...) selects the language like the
  2009 `language` flashvar. Game show quiz and host introduction text exist in all 11 languages
  (`web/data/quiz/<code>.json`); all other text falls back to English.

Strings: each area owns `web/data/lang/<code>/<namespace>.json` (`platform`, `levels`,
`gameshow`, `kitchen`, `flow`); common UI strings stay in `web/data/lang/<code>.json`.
Use `t(key, vars)` from `web/js/core/i18n.js` for every visible string.

Art: atlases in `web/data/atlas/` (see `web/data/atlas/index.json`); draw with
`web/js/platformer/sprites.js`, or `web/js/flow/art.js` for cut-out rigs (`mode: "rig"`, the
game show cast and the shrinking avatars). While an atlas is missing, scenes draw clean
placeholders so they stay testable.

Keyboard in flow menus (`web/js/flow/ui.js`): arrows and the d-pad move the focus spatially,
Tab / Shift+Tab move it in document order within the top screen or dialog (wrapping), Enter
and Space activate the focused button, and a held key's auto-repeat never activates one. This
runs only while a flow screen or dialog is on top (for example the settings overlay over a
pause menu); other areas' screens keep their own handling.

Loading: art for the next screen is fetched while the current one plays, once the current
screen's own art is in. When the next screen is certain its sheets are loaded and decoded
through each area's own memoised loader: the shrinking zone's during the cutscene and the quiz,
the level's (or the kitchen's) during the shrinking zone, the summary card's during a level.
When it is only likely they are downloaded but not decoded (`sprites.prefetchSet()`, so no
texture memory is spent on a screen that may never come; the real load decodes from those
bytes): the cutscene's (the game show studio and cast) on the splash, and during a level the
round's next level or, after the last level of a round (or kitchen level 3), the game show's.
Scenes wait for their art on a dark stage with a loading ring (splash, cutscene, shrinking
zone, ending) or a loading bar (platform, game show, kitchen); the placeholder drawings appear
only if a load fails.

Tests: each area adds `web/tests/<area>*.spec.mjs` picked up by `web/tests/run.mjs`, and
registers a `__test` probe named after the scene (`__test.probe('gameshow')` and so on) so the
full-journey test can play the whole game with real inputs. The flow registers `flow` (journey
state, the last scene it launched and its params) and one probe per flow scene (`splash`,
`cutscene`, `shrink`, `summary`, `ending`, `levelSelect`, `settings`). Stub scenes expose a
Continue button with the id `stub-<scene>-continue`.
