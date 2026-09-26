# SWF sheet pipeline

Dev-only tools that render the game's art straight from the original 2009 SWFs, through Ruffle in headless Chromium. The output is animation frames at high resolution, with the exact Flash frame labels, frame scripts and registration points. These are then packed into WebP atlases for the game in `web/`. Nothing here ships: the game only loads `web/data/atlas/*`.

The Unity remake's PNG exports are not used for level 1. They do not line up frame for frame with the Flash timelines (Unity's Lucy has 178 frames; the SWF's `lucy_icon` has 255). They also lack registration points, and their art is lower resolution.

## How it works

```
original SWF ──► swf-io.mjs: decompress CWS, walk tags, keep definition tags byte for byte
             ──► timeline.mjs: replay a sprite's timeline to frame k, build "snapshot sprites"
             ──► sheet SWF: definitions + snapshots + one root frame laying frames out in a grid
             ──► ruffle-capture.mjs: Ruffle (wgpu-webgl on SwiftShader), transparent stage, screenshot
             ──► sheet.mjs: slice cells, trim, record origins ──► tools/.cache/sheets/<swf>/<symbol>/
             ──► tools/build-atlas.cjs: dedupe, MaxRects pack, WebP ──► web/data/atlas/<name>.webp + .json
```

1. **Reader and writer** (`swf-io.mjs`). Parses the header and tag stream (short and long headers). It also parses RECT, MATRIX, CXFORM(WITHALPHA), PlaceObject 1/2/3 (ratio, clip depth, name, filter lists copied verbatim, blend mode, bitmap caching), DefineSprite, DefineButton(2) records, and definition bounds. It writes PlaceObject2/3, DefineSprite and an uncompressed `FWS` movie. Root control tags are dropped: frames, placements, scripts, labels, sounds and imports. Every definition tag is kept untouched, so gradients, bitmap fills, JPEG tables, fonts and morph shapes reach Ruffle exactly as authored. This includes the DefineMorphShape tags that `swf-parser` cannot read. There is also a shape-record parser and rewriter. It round-trips all 2,023 shapes in the six main SWFs byte for byte, and can drop outlines inside a rectangle (see `erase`).
2. **Timeline flattener** (`timeline.mjs`). To show frame k of sprite S, it replays S's PlaceObject and RemoveObject tags from frame 1 to k.
   - **Nested sprites advance with their parent.** A child placed on parent frame b has been ticked k - b times at frame k. Its own constant frame scripts are honoured: `stop()`, `play()`, `gotoAndPlay`/`gotoAndStop` with a literal label or number, `nextFrame` and `prevFrame`. Anything conditional or computed is ignored.
   - **The state is written as a snapshot sprite.** This is a synthetic one-frame DefineSprite with the same depths, matrices, colour transforms, morph ratios, clip depths, filters and blend modes as the original. Nested sprites become their own snapshots, and shapes, morphs and text stay as leaves.
   - **Nesting is kept rather than flattened.** Masks (clip depth) then apply at the level they were authored at, and filters and blend modes apply to whole groups, as in Flash.
   - **Snapshots are memoised by content,** so identical frames share one id and are rendered once.
   - **Buttons render their up state.** The level intros' `invisible_button` therefore draws nothing.
3. **Capture** (`sheet.mjs`, `ruffle-capture.mjs`, `capture.html`).
   - **Layout.** Each distinct frame gets a cell sized from its computed bounds, plus a margin for filters. Cells are shelf-packed onto sheets of up to 4096 x 4096. Each cell's registration point sits on a whole stage pixel at the chosen scale (default 2x the in-game size).
   - **Rendering.** Ruffle runs with `wmode: transparent`, `scale: noScale` and `quality: best`, on a transparent page. The screenshot uses `omitBackground`, and Ruffle's overlays are hidden.
   - **Stability.** Screenshots repeat until two in a row match, so slow bitmap decoding cannot leave a half-drawn sheet.
   - **Slicing and origins.** PNG decoding and slicing happen in Node (`png.mjs`) to keep exact straight alpha. Each cell is trimmed to its alpha bounds and its origin is recorded. If any art touches a cell's outer ring, a warning is raised, since that would mean the bounds were too small.
4. **Output** per symbol in `tools/.cache/sheets/<swf>/<name>/` (gitignored): `fNNN.png` per distinct frame, `meta.json`, and `preview.png`, a contact sheet with the registration point marked by a red cross.
5. **Atlases** (`tools/build-atlas.cjs`). Builds from sheets, or from PNG sequences as a fallback. It keeps origins, labels, decoded frame scripts and tracks, and removes duplicate images. It packs pages with MaxRects, trying the smallest single page first. Pages are encoded to WebP by Chromium. There are no PNG pages unless `"png": true`. The JSON format is documented at the top of that file and repeated below.

## Usage

```sh
# Render every level-1 symbol (cached per symbol; --force re-renders, --only a,b picks jobs)
node tools/swf-sheet/sheet.mjs tools/swf-sheet/jobs/level1.json

# One-off render
node tools/swf-sheet/sheet.mjs --swf movies/introductionToMicrobes_platformer.swf --symbol lucy_icon
node tools/swf-sheet/sheet.mjs --swf movies/harry.swf --symbol root:lower --name harry_lower

# Pack the atlases and write web/data/atlas/index.json
node tools/build-atlas.cjs tools/atlas/level1.json

# End-to-end check: draw a level-1 screen from the atlases with Canvas 2D, as the engine will
node tools/swf-sheet/verify-atlas.mjs out.png --camera 1013 --zoom 2.5 --avatar amy
```

Playwright's preinstalled Chromium is used (`import 'playwright'` resolves from the repository's `node_modules`). Never run `playwright install` in this environment. A full level-1 render takes about 5 minutes, and the ePhone and avatars take the longest. Packing takes about 15 seconds.

### Job options (`tools/swf-sheet/jobs/*.json`)

| Option | Meaning |
|---|---|
| `swf` | Path relative to `reference/Junior_Game/` |
| `symbol` | Export name, character id, `root` (the whole root timeline) or `root:<instance>` (an instance on the root's frame 1, with its root placement applied, so it shares the movie's registration point) |
| `name` | Output folder and atlas symbol name (default: the symbol) |
| `scale` | Output pixels per Flash pixel (default 2) |
| `frames` | `"1-39,50"`; other frames are left empty in `meta.json` |
| `ticks` | Render frame `atFrame` (default 1) as it looks 0..N-1 ticks after being placed, for one-frame symbols animated by nested clips (the portal) |
| `omitText` | Skip static and edit text (device fonts are substituted by Ruffle; the engine draws text itself) |
| `hide` | Instance names to skip, for example the ePhone's `screen`, which the engine fills |
| `track` | Instance names whose per-frame matrix is recorded in `meta.tracks` |
| `groupTrack` | Reference frame R; records `tracks.group`, the rigid transform taking frame R's layout to each frame (null when the children did not move together) |
| `erase` | `[{ "shape": id, "rect": [x0, y0, x1, y1] }]`: removes every outline of that shape lying entirely inside the rectangle (Flash px, shape space), for this render only |
| `margin` | Extra cell padding in pixels (default 4) |
| `pageMax` | Largest sheet side (default 4096; 2048 renders faster for heavy symbols such as `slurm_icon`) |
| `keepSwf` | Also write the generated sheet SWFs, for debugging |

### `meta.json`

```json
{ "symbol": "lucy_icon", "name": "lucy_icon", "swf": "movies/introductionToMicrobes_platformer.swf",
  "charId": 774, "scale": 2, "frameCount": 255, "mode": "frames",
  "labels": { "idle": 10, "be_photographed": 50, "walk": 150 },
  "scripts": { "30": [["set", "midAnimation", false], ["gotoAndPlay", "idle"]], "142": [["set", "midAnimation", false], ["stop"]] },
  "placement": null, "tracks": { "screen": [[a, b, c, d, tx, ty], null] },
  "frames": [ { "file": "f001.png", "originX": 1, "originY": 1, "w": 85, "h": 196 } ] }
```

`frames[i]` is Flash frame i + 1. `originX`/`originY` is the registration point measured from the trimmed image's top-left, in output pixels. It can be negative: the avatar's lower body starts 99 px (49.5 Flash px) below its origin. Empty frames have `file: null`. Script ops are `set`, `gotoAndPlay`, `gotoAndStop`, `stop`, `play`, `nextFrame`, `prevFrame`, and `script` for anything not decoded (conditionals, calls).

## Atlas format (`smw-atlas/1`)

```json
{ "format": "smw-atlas/1",
  "images": ["microbe-lucy-0.webp"],
  "symbols": {
    "lucy_icon": {
      "source": "swf", "swf": "movies/introductionToMicrobes_platformer.swf", "symbol": "lucy_icon", "charId": 774,
      "scale": 2, "frameCount": 255,
      "labels": { "idle": 10 }, "scripts": { "30": [["set", "midAnimation", false], ["gotoAndPlay", "idle"]] },
      "entryLabels": ["idle"], "tracks": { "screen": [[a, b, c, d, tx, ty]] },
      "frames": [[0, 0, 0, 85, 196, 1, 1], null]
    } } }
```

Each frame is `[image, x, y, w, h, originX, originY]`: a rectangle on page `images[image]`, and the registration point measured from that rectangle's top-left in atlas pixels. `null` means the frame draws nothing. The frame may be empty, not requested, or unreachable from the labels the game uses. `scale` is atlas pixels per Flash pixel, and the stage is 800 x 450 Flash pixels. `tracks` matrices are in Flash pixels in the symbol's own space. `entryLabels` (optional) lists the labels the frame set was reduced to. `web/data/atlas/index.json` lists every atlas (files, bytes, decoded pixels, symbols), maps each symbol to its atlas, and names sets: `level1`, `player-harry`, `player-amy`.

Drawing frame f with the registration point at Flash coordinates (px, py):

```js
const [img, x, y, w, h, ox, oy] = sym.frames[f - 1], k = 1 / sym.scale;
ctx.drawImage(images[img], x, y, w, h, px - ox * k, py - oy * k, w * k, h * k);
```

Flash mirroring (`_xscale = -100`) is `scale(-1, 1)` about the registration point. Nested parts use tracks: `ctx.transform(...track[f - 1])`, then draw the part at the origin.

## Level 1 (`tools/swf-sheet/jobs/level1.json`, `tools/atlas/level1.json`)

| Atlas | Contents | WebP |
|---|---|---|
| `tiles-kitchen` | the 28 kitchen tiles used by `alpha_level1.xml`, **lossless**, 2 px edge extrusion | 171 KB |
| `microbe-lucy` | `lucy_icon`, frames reachable from its labels (173 of 255) | 629 KB |
| `entities` | `portal_exit_icon` (30 ticks), `white_pickup`, `soap_pickup`, `white_projectile`, `soap_projectile`, `wbc_projectile`, `camera_flash` | 199 KB |
| `hud` | `heart`, `heart_half`, `digit`, `score` (+ digit tracks), `timer`, `e_phone` (frames 2 and 30, tracks), `status` (+ part tracks), `status_background`, `lucy_image`, `exit_status`, `camera_icon`, `tick_box_button`, `ephone_ingame`, `level_background` (at 0.5x) | 78 KB |
| `intro-level1` | `level_intros` frames 1-39 (the level-1 pages), text omitted | 25 KB |
| `player-harry` / `player-amy` | `<who>_lower` and `<who>_upper`, reduced to the labels the game drives | 755 / 783 KB |

The total is 2.78 MB on disk. A session needs the `level1` set (1.10 MB) plus one avatar, and decodes to about 55 MB of RGBA.

Decisions and findings:

- **Avatar.** `harry.swf` and `amy.swf` are two independently animated clips, `lower` and `upper`. Each is rendered with its root placement matrix, so both share the avatar's origin, which is the player box's top-left. Draw lower first, then upper. Checked: compositing the two halves reproduces Ruffle's render of the whole avatar (mean error 0.012/255). The upper body is reduced to `idle, move, accelerate_start, decelerate_start, take_photo_start, hurt, shoot_soap`, since the tractor beam and `throw_white_blood_cell` are unused (`reference/analysis/flash-platformer.md` §3.9). The lower body keeps every label.
- **Level 1 is a body level** (no `body_level` attribute), so its projectile is `white_projectile`. Soap is included for later levels.
- **The ePhone moves rigidly.** Every frame of `e_phone` is one rigid transform of frame 30 (the large landscape layout), with a per-depth spread of 0.000. The atlas therefore holds only frame 30 (large) and frame 2 (small, resting). `tracks.group[f - 1]` is the transform to apply to frame 30's art for any frame f, and `tracks.screen`/`tracks.bigScreen` place the status screen and the intro pages (both hidden in the render). `status` is rendered with its children hidden. Its `background`, `mode` and `button1`..`button6` positions are tracks.
- **Branding.** The phone's "e-Bug" wordmark is 9 outlines inside shape 248 (under the earpiece). It is erased with `erase` and nothing else in that shape changes. No other level-1 symbol carries a logo.
- **Background.** Shape 1495 is a flat orange (#ff9900) 800 x 450 rectangle with a 1 px outline, confirmed against Ruffle running the platformer. It is stored at 0.5x, and the engine may simply fill the colour.
- **Portal.** `portal_exit_icon` (and `movies/new portal.swf`) is a solid blue ellipse whose alpha pulses over 30 ticks through a colour transform. The Unity remake's glowing ring is a later redesign, so the Flash ellipse is used.
- **Tiles.** Tile bitmaps are native 50 x 50 with unsmoothed fills, so 2x is pixel-doubled, exactly as Flash would scale them. Lossy WebP changed tile edges by up to 37 levels, which showed as faint seams, so the tile atlas is lossless: every tile pixel now matches the SWF exactly. Seams were checked at 2.5x with a fractional camera, with and without device-pixel snapping.
- **Fallbacks.** No Unity PNGs were needed for level 1. A bad microbe was also checked outside the level-1 set: `slurm_icon` (340 frames, 321 distinct) renders every animation, including `be_frozen`, `be_washed_away` and `munch`. `colin_icon` cannot be rendered because no SWF exports it. The platformer cannot spawn it either (flash-platformer.md §4.5), but a Colin encyclopaedia or quiz picture would need `super_colin_icon`, another SWF's `colin` export (for example `ad.swf`) or a Unity PNG.
- **Camera flash.** The red corner marks are painted into bitmap 1042, so they are authored art, not a rendering artefact.
- **ePhone check.** `verify-atlas.mjs` draws frame 30 through `tracks.group[1]` and compares it with frame 2: the mean difference is 1.93/255, which is resampling only.

## Limitations

- Only constant frame scripts are followed inside nested clips. Clips driven by ActionScript at runtime show their timeline state, and anything the game attaches at runtime is absent. That includes the ePhone status screen and the avatar inside the platformer's `avatar` holder.
- A top-level symbol's frame k is rendered as if it played from frame 1. A clip reached by `gotoAndPlay` from elsewhere would, in Flash, keep children that persisted across the jump, so they could be at another phase of their own loops.
- Device-font text (Arial, Myriad Pro) is substituted by Ruffle's fallback font. Use `omitText` and draw text in the engine (it also has to be translated).
- Rendering fidelity is Ruffle's (wgpu-webgl on SwiftShader, MSAA). Filters, gradients, masks and morphs looked right in every level-1 symbol checked, but the result is not Flash Player.
- Bounds for cell layout come from definition bounds and filter reach. Every capture checks that the outer ring of each cell is empty and warns otherwise.
- LZMA (`ZWS`) SWFs are not supported. None exist in this project.
