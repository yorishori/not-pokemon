# tools — developer scripts run with tsx (not shipped in the game)

## `npm run placeholders` (`make-placeholders.ts`)

Scans every JSON file in `public/data/` and in the frozen test world `public/test-world/data/` for asset paths (`assets/….png|ogg|mp3`, relative to `public/`) and
creates any missing file. **Never overwrites** an existing file, so a second run creates nothing and real art
dropped at the same path is kept. `--dry-run` (`npm run placeholders -- --dry-run`) only lists what is missing.

- PNG: solid colour square (colour from the file name) with the file name in a pixel font.
  `*_front` / `*_back` → 64×64, `*_icon` and anything in `sprites/items/` → 16×16, everything else → 32×32.
  Exception: `assets/ui/title.png` (the title image named in `intro.json`) is a 512×288 pixel office front
  (sky, building with windows and a door, path, grass) so the title screen has a picture until real art exists.
  Exception: anything under `sprites/car/` (`car.json › sprite`) is a 96×40 white car seen from the side, nose
  to the right, on a transparent background.
- Audio: an `.ogg` or `.mp3` path creates both `<name>.ogg` and `<name>.mp3`, a 0.2 s 880 Hz beep made with
  `ffmpeg` (libvorbis / libmp3lame); a name containing `engine` (`car.json › sound`) gets a 1 s 90 Hz hum instead,
  so it loops well during the car trip. The interface sounds of `sounds.json` (`ui_cursor`, `ui_confirm`,
  `ui_cancel`, `ui_error`, `ui_money`) get short tones of their own pitch and length (`audioSource()`), so they can be
  told apart. If `ffmpeg` is not on the PATH, it copies the silent files in
  `tools/fallback/` instead and says how many audio files are silent.
- Minimaps: every outdoor zone in either `zones.json` gets `assets/ui/minimap_<zone>.png`, drawn from its `.tmj`
  (`parseTiledMap` → `minimapCells`): 3 px per tile (`MINIMAP_TILE_PX`), solid tiles dark blue, `encounter` tiles
  green, the rest sand. These paths are not in the JSON (they follow the zone id), so `--dry-run` lists them too.
  Not overwritten either: delete a minimap after editing its map to redraw it.

## `npm run test-map` (`make-test-map.ts`)

Writes the frozen test world's maps and the art they need: `public/maps/test/test.tmj`, `test_house.tmj` and
`test_east.tmj` (layouts in `public/maps/test/README.md`), the placeholder tileset `public/assets/tilesets/test.png`
(8 × 2 tiles of 32 px, with `solid` / `encounter` tile properties) and the player sheet
`public/assets/sprites/player.png` (the same drawing as `npm run art`; 2 columns stand/stride × 4 rows
down/left/right/up, 32 × 32 frames). Never overwrites existing files; `npm run test-map -- --force` regenerates all
five files. A unit test checks that the shipped maps still equal the generator's output — after editing a map
in Tiled, update the generator too or drop that comparison.

## `npm run world` (`make-world.ts`)

Builds the real world's maps from plain text (reviewable diffs, no Tiled needed):
`tools/world/<zone>.txt` (one character per tile) and `tools/world/world.json`. Writes
`public/assets/tilesets/world.png` (8 columns; the 32 base tiles, then their variants, art in `tools/art/tiles.ts`;
then the world redesign's extra tiles, 16 × 16 grids in `tools/world-tiles.ts`; tile ids in `public/maps/README.md`)
and `public/maps/<zone>.tmj` for
every map in `world.json`. Never overwrites existing files; `npm run world -- --force` regenerates everything (after
editing a layout). Then run `npm run placeholders` (after deleting the zone's minimap, if the map changed).

Layout characters — ground: `.` grass, `:` path, `~` water (solid), `,` tall grass (encounter), `s` sand, `S` dune
grass (encounter), `v` vineyard (encounter), `d` desert ground, `r` road, `p` plaza paving, `b` bridge, `=` wooden
floor, `_` doormat (an interior's door, on its bottom row). Drawn over the map's base ground (`world.json › ground`:
`grass`, `sand`, `desert`, `road`, `floor`): `T` tree (blocked; its top is drawn above, on the tile above), `#` wall,
`^` roof, `W` white wall, `D` door, `M` mountain, `R` rock, `*` bush, `F` fence, `f` flowers (walkable), `c` cactus,
`L` fountain, `C` counter, `K` desk, `H` shelf, `A` + `a` the Audi (rear, front). All of these block except `f`
(flowers) and `D` (door).

World redesign — more ground: `u` tilled soil, `o` onions / `l` lettuces / `e` eggplants (huerta crops,
encounter), `"` dry scrub (encounter), `w` sea and `<` sea with a wave (both solid), `6` a boat on the water (solid),
`z` shore, `k` sidewalk, `x` crosswalk, `q` paseo marítimo, `n` office floor, `N` carpet (ahora blue), `m` station
mosaic floor, `P` station platform, `J` rails (solid), `/` stairs (into the sunken Turia park), `7` stone bridge.
More deco (all solid unless noted): `O` orange tree, `4` plum tree, `Y` palm, `h` white Valencian house wall (blue
trim), `y` cream house wall, `^` terracotta roof, `8` flat city roof, `9` grey industrial roof, `I` / `i`
corrugated industrial wall (plain / with windows), `Z` roller shutter, `B` brick, `V` the ahora navy façade, `Q` `U`
`G` the ahora logo over three tiles, `E` metro sign, `X` train, `j` train door (walkable; put a `links` entry on it),
`0` the Turia's retaining wall, `1` the Àgora (purple), `2` the CAC's white ribs, `@` the Assut de l'Or bridge mast,
`3` old stone (Torres de Serranos, the cathedral), `5` the Estació del Nord's orange façade, `)` the bullring, `+`
office wall, `g` glass, `(` sofa, `%` plant, `t` meeting table, `&` modern desk, `$` coffee bar, `[` wall screen,
`!` beach umbrella, `-` towel (walkable), `|` bench, `;` street lamp, `?` the mystery door (put a `portal` entry on
it), `{` a stop on the story map's path (walkable).

`world.json › maps.<zone>`:

| Field | Meaning |
| --- | --- |
| `ground` | Base ground under deco characters. |
| `indoor` | `true` for interiors (needs a `_` doormat on the bottom row). |
| `spawn` | `[x, y]` of the `default` spawn point (interiors: the doormat). |
| `doors` | `[{ x, y, to }]`: a `D` tile leading to the interior `to`; the way back is generated. |
| `edges` | `[{ side, from, to, map }]`: an off-map warp along `side` (`north`/`south`/`east`/`west`) over columns (or rows) `from`–`to`, keeping the column (row); the reverse warp on `map` is generated. |
| `car` | `{ x, y, to }`: the Audi (`Aa` at (x, y)) with an `action` warp, `to` = `murcia` or `valencia`. |
| `portal` | `{ x, y }`: the mystery door (`?` at (x, y)) with an `action` warp carrying the bool property `portal = true`. |
| `links` | `[{ x, y, to, toX, toY, facing }]`: a one-way step warp from (x, y) to any tile of map `to` (the metro and the train: the `j` train door to the other station's platform). Not mirrored: the other station lists its own link back. |
| `encounters` | `[{ name, x, y, width, height, group, mode }]`: encounter rectangles (`group` must be in `zones.json`). |

The tool checks the layout (equal row widths, known characters) and that doors, the car and the portal stand on
`D` / `Aa` / `?`.

after placing the base tiles, `autotile()` swaps them for look-alike **variants** chosen from the
neighbours (roof ridge / eave / edges and one of four roof colours per building, facade edges and windows, indoor
wall face / top, cliff face, grass borders on `:` `r` `p` `s`, shore foam on `~`). A variant keeps its base tile's
`solid` / `encounter` property, so only the picture changes; the rules are in `autotile`'s doc comment.

## `npm run art` (`make-art.ts`)

Draws the game's sprites in the style of `docs/ART.md` at the paths the content JSON names (both content
folders), plus `assets/sprites/player.png`:

| Path | Drawn by | Size |
| --- | --- | --- |
| `player.png`, `sprites/npcs/<name>.png` | `art/characters.ts` (look per name in `NPC_LOOKS`; unknown names get one from the name) | 64 × 128 walk sheet |
| `sprites/flexymon/<id>_front/_back.png`, `_icon.png` | `art/flexymon.ts` (hand-made per id; unknown ids get a round creature) | 64 × 64, 16 × 16 |
| `sprites/items/<id>.png` | `art/sprites.ts` (unknown ids get a parcel) | 16 × 16 |
| `sprites/car/*.png` | `art/sprites.ts` | 96 × 40 |
| the title (`intro.json › titleImage`) | `art/sprites.ts` (built from the world tiles) | 512 × 288 |

Never overwrites: `npm run art -- --force` redraws everything after changing the art code, `-- --dry-run` lists what
would be written. Other PNG paths (minimaps) are left to `npm run placeholders`. `tools/art/pixels.ts` is the shared
painter: art is drawn at design size (16 px tiles and characters, 32 px flexymon), auto-outlined with `outline()` and
scaled ×2 with `scale()`. `npm run test-map`'s player sheet is the same drawing.

## `npm run atlas` (`make-atlas.ts`)

Packs every content sprite (PNG paths under `assets/sprites/` in either content folder, at most 128 × 128) into one
texture atlas: `public/assets/atlas/sprites.png` + `sprites.json` (Phaser JSON hash, each frame named by its asset
path, 1 px padding, shelf packing 1024 px wide). Always rewritten; a build artifact ignored by git. `npm run build`
runs it first, so production and E2E builds load one sprite image instead of ~70 (about 0.5 s less to the title on
4G). Without it (`npm run dev` before any build) sprites load as separate files. `--dry-run` only prints the count.
Run `npm run placeholders` first: missing files are skipped with a warning.

## `npm run offline` (`make-offline.ts`)

Runs `npm run build`, then packages `dist/` as **one HTML file anyone can open from disk** (double-click, no server):
`dist-offline/flexymon.html`, zipped as `dist-offline/flexymon.zip` to share. The zip holds only that file. Browsers block
`fetch` / XHR on `file://` pages, so a plain zip of `dist/` would not run. Instead the JS bundle is inlined and every
shipped file of `dist/` (data, maps, art, sounds, atlas) is embedded as a `data:` URL. A small script that runs before
the game sends its `fetch` / `XMLHttpRequest` calls for those relative paths to the embedded copies. The frozen test
world (`test-world/`, `maps/test/`) and the `README.md` files are left out. A file with an extension not in the
tool's `MIME` table stops the tool with an error. `dist-offline/` is git-ignored (`dist-*/`). The save lives in that
browser's `localStorage` for local files, so it is separate from the hosted site's save.
