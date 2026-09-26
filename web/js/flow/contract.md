# Scene contract for the game flow

Every screen is a scene registered in `web/js/scenes/index.js`. The flow controller
(`web/js/flow/flow.js`, a port of `GameController.as`) drives the order by calling
`app.scenes.go(name, params, transition)` and receives results through callbacks in `params`.
Scenes never decide what comes next on their own when a callback is given; without callbacks
(opened directly through `?scene=...` for testing) they fall back to sensible standalone behaviour.

| Scene | Owner folder | Params in | Callback(s) out |
|---|---|---|---|
| `splash` | `web/js/scenes/splash.js` (flow) | `{}` | `app.flow.newGame()` / continue / level select |
| `cutscene` | `web/js/flow/` | `{}` | `onComplete({ avatar: 'harry'\|'amy', nickname, age })` |
| `shrink` | `web/js/flow/` | `{ avatar, round }` | `onComplete()` |
| `platform` | `web/js/platformer/` | `{ level, avatar, score, intro, onComplete(result), onGameOver(result), onQuit() }` | `result = { level, score, won, lives, timeLeftSteps, next }` |
| `kitchen` | `web/js/kitchen/` | `{ level: 0..3, avatar, score, onComplete(result), onQuit() }` | `result = { level, score, report: [{ item, ok, reason }] }` |
| `gameshow` | `web/js/gameshow/` | `{ round: 1..5, avatar, nickname, playerScore, cpuScore, onComplete(result), onQuit() }` | `result = { playerScore, cpuScore, answers: [{ q, value }] }` |
| `summary` | `web/js/flow/` | `{ kind, result, onComplete() }` | `onComplete()` |
| `ending` | `web/js/flow/` | `{ playerScore, cpuScore, avatar, nickname }` | (replay / level select / splash) |
| `levelSelect` | `web/js/flow/` | `{}` | starts a single level or round |
| `settings` | `web/js/flow/` | `{ back }` | returns to `back` |

Shared state lives in `app.flow` (`web/js/flow/flow.js`): the player (avatar, nickname, age,
score), the CPU opponent score, the current round index and the unlocked levels, saved with
`web/js/core/save.js`. The round table follows `web/data/levels/index.json` (`rounds`) and
`web/NOTES.md`.

Strings: each area owns `web/data/lang/<code>/<namespace>.json` (`platform`, `levels`,
`gameshow`, `kitchen`, `flow`); common UI strings stay in `web/data/lang/<code>.json`.
Use `t(key, vars)` from `web/js/core/i18n.js` for every visible string.

Art: atlases in `web/data/atlas/` (see `web/data/atlas/index.json`); draw with
`web/js/platformer/sprites.js`. While an atlas is missing, scenes draw clean placeholders so
they stay testable.

Tests: each area adds `web/tests/<area>*.spec.mjs` picked up by `web/tests/run.mjs`, and
registers a `__test` probe named after the scene (`__test.probe('gameshow')` and so on) so the
full-journey test can play the whole game with real inputs.
