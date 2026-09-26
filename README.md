Super Microbe World
====

Super Microbe World (the e-Bug Junior Game) is a game about microbes, hygiene and antibiotics that David Farrell built in Flash in 2007 to 2009. This repository now holds a **browser-native remake** of the 2009 original in [`web/`](web): plain HTML, CSS and JavaScript with no build step, playable on phones, tablets and desktops, installable as an app and playable offline.

- **Play online:** https://gameologist.com/Super-Microbe-World/play/
- **Play locally:** `npx serve web` (or `python3 -m http.server 8000 -d web`) and open the address it prints. A web server is needed; the game does not load from `file://`.
- **Run the tests:** `npm ci && npx playwright install chromium && npm test`
- **How it works, how to regenerate the assets and how to deploy:** [`web/README.md`](web/README.md)
- **Every screen next to the Flash original:** [`web/screenshots/index.html`](web/screenshots/index.html)
- **Design notes and every difference from the original:** [`web/NOTES.md`](web/NOTES.md)

The rest of the repository:

- `reference/`: the 2009 Flash originals (SWFs, ActionScript source, level XML), Ruffle captures of them, and analysis notes.
- `tools/`: dev-only scripts that turn the originals into the remake's data and art, the test harness helpers and the deploy scripts.
- `Assets/`, `ProjectSettings/` and `LastBuild/`: the 2013-14 Unity remake by Pedro Rodriguez, kept as it was. It was used as a secondary source for the remake. The Heroku deployment it once had (supermicrobeworld.herokuapp.com) is no longer online.

Licensed under the GNU General Public License v3.0 ([`LICENSE.md`](LICENSE.md)).
