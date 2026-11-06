# Maps: editing and expanding the world

The world is a set of **zones**. Each zone is one map file `public/maps/<zone>.tmj` (Tiled JSON, 32 × 32 px tiles)
plus one entry in `public/data/zones.json`. Zones are joined by **warps**: doors, map edges, the metro and the train, and the Audi. One more zone, the story
board `historia`, is not joined to anything: the office's mystery door opens it (see *The story map*).

## Two ways to edit maps

| | Text layouts (recommended) | Tiled |
| --- | --- | --- |
| Source | `tools/world/<zone>.txt` + `tools/world/world.json` | `public/maps/<zone>.tmj` |
| Tool | any text editor, then `npm run world -- --force` | the [Tiled](https://www.mapeditor.org/) desktop app |
| Doors, edges, way back | generated for you | drawn by hand, both directions |
| Tile variants (roof edges, shores…) | picked automatically | placed by hand |
| Diff-friendly / reviewable | yes | large JSON diffs |

The shipped world is built from the text layouts. `npm run world -- --force` **regenerates every map and the
tileset**, so a map edited in Tiled is overwritten the next time someone runs it. Pick one source per map: if you
switch a map to Tiled for good, say so in its PR and stop regenerating it (or remove it from `world.json`).

Either way, after changing an outdoor map delete its minimap (`public/assets/ui/minimap_<zone>.png`) and run
`npm run placeholders` to redraw it, then `npm run dev` and fix anything the red error screen reports.

## The current world

Four big outdoor maps plus their interiors. The world is a cartoon of the Valencia region, not to scale:

```
   Alboraya  (village | huerta | industrial estate | huerta | tourist beach)
    |   |__________________ the road and the whole beach lead south (and the metro)
    |                    |
Valencia  (wide city map: Turia river park, Ciutat Vella, Estació del Nord, CAC)
    |  train from the Estació del Nord only
El Pueblo
                 the Audi only
Murcia  (El Ciruelo | vineyards | desert | small coastal town)
```

- **Alboraya ↔ Valencia:** two edges (the road, x 42–44; the whole beach and its paseo, x 99–111) and the metro
  (Alboraya's village square ↔ Xàtiva, next to the Estació del Nord).
- **El Pueblo** is reached only by the train from the Estació del Nord.
- **Murcia** is reached only by the Audi from the office (a design pillar, `docs/GAME-RULES.md`); it arrives next to
  the client company in the El Ciruelo part. A unit test walks the whole world and checks all of this.

Zones and landmarks (coordinates are tiles):

| Zone | Size | Links | Contains |
| --- | --- | --- | --- |
| `alboraya` | 120 × 44 | south x 42–44 (road) and x 99–111 (beach) → `valencia` | Orange orchards along the top and bottom edges, mountains west, sea east. **Village** (x 6–34): white and cream Valencian houses with terracotta roofs, the church, the plaza with the metro (door (20, 14) → `metro_alboraya`), shop (14, 18) → `tienda_alboraya`. **Huerta** between the parts: irregular plots of onions, lettuces, eggplants and orange trees (`huerta_alboraya`). **Industrial estate** (x 53–86): warehouses on two streets, a bar at its west end (56, 6) → `bar_este`, the office at its east end (navy façade with the logo, door (83, 7) → `oficina`), the office Audi on (85–86, 8) (`toValencia` lands on (85, 9)), a bar across the street in front of the office (81, 16) → `bar_centro`, a loading yard (crowd `poligono_alboraya`). **Tourist beach** (x 91–119): holiday houses, M.P.'s house (94, 13) → `casa_mp`, the paseo, sand with umbrellas and dune grass (`playa_patacona`), the Port Saplaya breakwater. Spawn (83, 8). |
| `valencia` | 128 × 64 | north x 42–44 and x 99–111 → `alboraya` | All city: blocks of flat and terracotta roofs on irregular streets, a few small parks, no fields. The **Turia** park: a sunken bed (retaining walls `0`, stairs `/`, stone bridges `7`) from the Parque de Cabecera pond in the west, arcing north round the old town and down to the CAC (tall grass `jardin_turia`, also in the Jardines del Real). **Ciutat Vella**: Torres de Serranos, Plaza de la Virgen with the cathedral (crowd `plaza_virgen`), the Mercado Central, Plaza del Ayuntamiento (crowd `plaza_ayuntamiento`). **Estació del Nord** (orange façade, door (44, 53) → `estacion_norte`), the Xàtiva metro beside it (33, 52) → `metro_xativa`, the bullring. Avenida Blasco Ibáñez to the **Malvarrosa** beach (`playa_malvarrosa`) and the port. The **CAC** at the end of the park: Hemisfèric pool, Museu de les Ciències, Palau de les Arts, l'Assut de l'Or, the **Àgora** (door (86, 56) → `agora`, the convention), esplanade (crowd `explanada_cac`). Shop (68, 39) → `tienda_valencia`. Spawn (43, 1). |
| `pueblo` (El Pueblo) | 48 × 32 | none (train only) | A seaside village among orange and vegetable plots (`huerta_pueblo`): the railway on top with the little station (8, 3) → `estacion_pueblo`, the plaza and church, a client company (18, 19) → `empresa_sur`, shop (22, 19) → `tienda_pueblo`, the paseo, beach and sea east, the impassable range south. Spawn (8, 4). |
| `murcia` | 136 × 40 | none (Audi only) | West to east: **El Ciruelo** (stone-fruit orchards, `huerto_frutal`; a client company's warehouse (21, 12) → `empresa_poligono`; the arrival Audi on (16–17, 14), `toMurcia` lands on (16, 15)), **vineyards** (`vinas`, a bodega), **desert** (cacti, rocks, dry scrub `desierto`), a **small coastal town** (houses, plaza crowd `paseo_murcia`, shop (117, 13) → `tienda_murcia`, beach, boats). Mountains north, west and south; the sea east. Spawn (16, 15). |

Every outdoor zone has several wandering townsfolk (`talker` NPCs with a `wander` rectangle) besides its enemies.

Interiors (smaller than the screen, centred on black):

| Zone | Size | Contains |
| --- | --- | --- |
| `oficina` | 22 × 14 | Open plan in the company's navy / light blue / white with an orange accent: desk islands, a glass meeting room, sofa corner, coffee bar, wall screens, the logo on the back wall, and the mystery door (`?`, (8, 1)) to the story realm. The new game starts on its doormat (10, 13); healer (5, 12) by the reception counter, storage (19, 9), two coworkers; the intro coworker walks from (10, 5) to (10, 9) and back up to (10, 2). |
| `metro_alboraya`, `metro_xativa` | 12 × 8 | A train on the top row (its door `j` is the link to the other station), platform `P`, a ticket clerk. |
| `estacion_norte` | 17 × 9 | Orange mosaic hall, the train to El Pueblo, a ticket clerk. |
| `estacion_pueblo` | 10 × 7 | The train back to the Estació del Nord. |
| `casa_mp` | 10 × 8 | M.P.'s beach house (M.P. talks). |
| `bar_centro`, `bar_este` | 10 × 8 | Counter and shopkeeper. |
| `tienda_alboraya`, `tienda_valencia`, `tienda_pueblo`, `tienda_murcia` | 8 × 7 | Shopkeeper at (5, 3). |
| `agora` | 16 × 10 | The convention: screens, two enemies. |
| `empresa_sur`, `empresa_poligono` | 10 × 8 | A client who talks. |

## Editing with text layouts

### Layout files (`tools/world/<zone>.txt`)

One character per tile, one line per row, all rows the same width. For example `tools/world/tienda_alboraya.txt`:

```
########
########
#H====H#
#CCCC=H#
#======#
#======#
###_####
```

Ground characters:

| Char | Tile | | Char | Tile |
| --- | --- | --- | --- | --- |
| `.` | grass | | `d` | desert ground |
| `:` | path | | `r` | road |
| `~` | water (solid) | | `p` | plaza paving |
| `,` | tall grass (encounter) | | `b` | bridge |
| `s` | sand | | `=` | wooden floor |
| `S` | dune grass (encounter) | | `_` | doormat (an interior's exit, on its bottom row) |
| `v` | vineyard (encounter) | | | |
| `u` | tilled soil | | `k` | sidewalk |
| `o` `l` `e` | onions / lettuces / eggplants (encounter) | | `x` | crosswalk |
| `"` | dry scrub (encounter) | | `q` | paseo marítimo |
| `w` | sea (solid) | | `<` | sea with a wave (solid) |
| `6` | a boat on the water (solid) | | `z` | shore |
| `n` | office floor | | `N` | carpet |
| `m` | station mosaic floor | | `P` | station platform |
| `J` | rails (solid) | | `/` | stairs (into the sunken Turia park) |
| `7` | stone bridge | | | |

Objects, drawn over the map's base ground (`world.json › ground`). All of them block, except `f` and `D`:

| Char | Object | | Char | Object |
| --- | --- | --- | --- | --- |
| `T` | tree (its crown is drawn on the tile above, over the player) | | `*` | bush |
| `#` | wall | | `F` | fence |
| `^` | roof | | `f` | flowers (walkable) |
| `W` | white wall (emblematic buildings) | | `c` | cactus |
| `D` | door (walkable; needs a `doors` entry) | | `L` | fountain |
| `M` | mountain | | `C` | counter |
| `R` | rock | | `K` | desk |
| `A` `a` | the Audi (rear, front; needs a `car` entry) | | `H` | shelf |
| `O` | orange tree | | `4` | plum tree |
| `Y` | palm | | `;` | street lamp |
| `h` | white Valencian house wall (blue trim) | | `y` | cream house wall |
| `8` | flat city roof | | `9` | grey industrial roof |
| `I` `i` | corrugated industrial wall (plain / windows) | | `Z` | roller shutter |
| `B` | brick | | `V` | the company's navy façade |
| `Q` `U` `G` | the company logo over three tiles | | `E` | metro sign |
| `X` | train | | `j` | train door (walkable; needs a `links` entry) |
| `0` | the Turia's retaining wall | | `3` | old stone (towers, cathedral) |
| `1` | the Àgora (purple) | | `2` | the CAC's white ribs |
| `@` | the Assut de l'Or bridge mast | | `5` | the Estació del Nord's orange façade |
| `)` | bullring | | `+` | office wall |
| `g` | glass | | `(` | sofa |
| `%` | plant | | `t` | meeting table |
| `&` | modern desk | | `$` | coffee bar |
| `[` | wall screen | | `!` | beach umbrella |
| `-` | towel (walkable) | | `\|` | bench |
| `?` | the mystery door (needs a `portal` entry) | | `{` | a stop on the story map's path (walkable ground) |

The tool picks the right look-alike **variant** of each tile from its neighbours (roof ridges and eaves, one of four
roof colours per building, facade windows, cliff faces, grass borders, shore foam…). Variants keep their base tile's
`solid` / `encounter` property, so only the picture changes.

### `tools/world/world.json`

`maps.<zone>` describes everything that is not a tile:

| Field | Meaning |
| --- | --- |
| `ground` | Base ground under the object characters: `grass`, `sand`, `desert`, `road`, `floor`, `sea`, `sidewalk`, `office`, `station` or `soil`. |
| `indoor` | `true` for interiors (needs a `_` doormat on the bottom row; the exit warp is generated). |
| `spawn` | `[x, y]` of the zone's `default` spawn point (debug teleport target). Interiors use the doormat. |
| `doors` | `[{ "x", "y", "to" }]`: a `D` tile at (x, y) leading to interior `to`. The way back is generated. |
| `edges` | `[{ "side", "from", "to", "map" }]`: walking off `side` (`north` / `south` / `east` / `west`) over columns (or rows) `from`–`to` enters `map`, keeping the column (or row). The reverse warp on `map` is generated. |
| `car` | `{ "x", "y", "to" }`: the Audi (`Aa` at (x, y)) with an action warp; `to` is `murcia` or `valencia`. |
| `portal` | `{ "x", "y" }`: the mystery door (`?` at (x, y)) with an action warp carrying `portal = true`; it opens the story realm. |
| `links` | `[{ "x", "y", "to", "toX", "toY", "facing" }]`: a one-way step warp from (x, y) to tile (toX, toY) of map `to`. Used for the metro and the train: the `j` train door of one station to the platform tile under the other station's train door. Not mirrored: the other station lists its own link back. |
| `encounters` | `[{ "name", "x", "y", "width", "height", "group", "mode" }]`: encounter rectangles (see below). |

Example (El Pueblo, shortened):

```json
"pueblo": {
  "ground": "grass",
  "spawn": [8, 4],
  "doors": [{ "x": 8, "y": 3, "to": "estacion_pueblo" }, { "x": 22, "y": 19, "to": "tienda_pueblo" }],
  "encounters": [{ "name": "huerta", "x": 2, "y": 3, "width": 32, "height": 25, "group": "huerta_pueblo", "mode": "tiles" }]
},
"estacion_pueblo": {
  "ground": "station",
  "indoor": true,
  "links": [{ "x": 4, "y": 0, "to": "estacion_norte", "toX": 8, "toY": 1, "facing": "down" }]
}
```

Then run:

```bash
npm run world -- --force
```

It checks the layouts (equal row widths, known characters, doors on `D`, cars on `Aa`) and writes
`public/assets/tilesets/world.png` and every `public/maps/<zone>.tmj` listed in `world.json`. Without `--force` it
writes only missing files.

### Recipe: change an existing map

1. Edit `tools/world/<zone>.txt` (keep every row the same width).
2. If you moved a door, edge, car or encounter area, update `world.json`.
3. If anything that stood on a tile now blocked is in the content (an NPC spawn, `start.json`, `car.json` arrival
   points, the intro), move it in the JSON.
4. `npm run world -- --force`, delete `public/assets/ui/minimap_<zone>.png`, `npm run placeholders`.
5. `npm run dev`, walk it, then run the tests (`npm test` includes a full walkability check of the real world).

### Recipe: add an outdoor zone

1. Create `tools/world/<zone>.txt`, surrounded by blocking tiles (trees, mountains, water) except where it connects.
2. Add `maps.<zone>` to `world.json` with `ground`, `spawn`, and an `edges` entry joining it to a neighbour (the
   neighbour gets the reverse warp automatically; leave a walkable gap on both maps along that edge).
3. Add the zone to `public/data/zones.json`:

   ```json
   { "id": "huerta_sur", "name": "Huerta Sur", "file": "maps/huerta_sur.tmj", "region": "valencia",
     "music": "assets/audio/music/valencia.ogg", "indoor": false, "encounters": {} }
   ```

   `region` says which side of the range it is on (`valencia` or `murcia`); the game itself does not read it, the
   world test does. `name` is a readable name (not shown in the game yet).
4. `npm run world -- --force` and `npm run placeholders` (draws the new minimap).
5. Add NPCs (`npcs.json › map`), encounter groups and areas (below).
6. Add the zone id to the zone lists at the top of `tests/data/world.test.ts` (`VALENCIA_SIDE`, `MURCIA_SIDE` or
   `INTERIORS`): that test pins the set of shipped zones and walks the world to prove every zone is reachable.

### Recipe: add a building with an interior

1. On the outdoor layout, draw the building with `^` roof and `#` (or `W`) walls, and a `D` where the door goes.
2. Create the interior layout `tools/world/<interior>.txt`: walls `#` around, floor `=`, furniture (`C` counter,
   `K` desk, `H` shelf), and exactly one `_` doormat on the bottom row.
3. In `world.json`: add `{ "x", "y", "to": "<interior>" }` to the outdoor map's `doors` and
   `"<interior>": { "ground": "floor", "indoor": true }` to `maps`.
4. Add the interior to `zones.json` with `"indoor": true`, `"music": "assets/audio/music/interior.ogg"` and
   `"encounters": {}`.
5. `npm run world -- --force`. Entering the door puts the player on the doormat facing up; stepping down off the
   doormat puts them below the door facing down.
6. Add NPCs inside (e.g. a `shopkeeper` behind the counter, with a new shop in `shops.json`). Add the interior to
   `INTERIORS` in `tests/data/world.test.ts`.

## Encounter areas

Wild battles happen only inside encounter rectangles. Each rectangle has:

- `group`: a key of the zone's `encounters` in `zones.json` (which species, how often; see
  [CONTENT.md](CONTENT.md) › Wild encounters);
- `mode`: `tiles` (only encounter tiles roll: tall grass `,`, dune grass `S`, vineyard `v`) or `all` (every tile
  rolls, for city crowds on paving).

Draw the grass in the layout, add the rectangle to `world.json › maps.<zone>.encounters`, add the group to
`zones.json`, and regenerate. Overlapping rectangles: the first one containing the tile wins.

## Placing NPCs and points

NPCs, the start and respawn points, the car arrival points and the intro are placed in the JSON by tile
coordinates, not in the map. Find a tile with **F2** in the game (`Casilla: x, y`) or by counting characters in the
layout (column = x, line = y, both from 0). Every such point must be walkable; NPC wander rectangles must contain the
spawn. See [CONTENT.md](CONTENT.md) › Add an NPC.

## The metro and the train

A station is an interior whose top row is a train (`X`) with one train door (`j`), above a platform row (`P`). Its
`links` entry turns the train door into a step warp to the other station's platform, right under that station's
train door, facing down. Each station lists its own link, so both directions need an entry. Stations are entered
like any building (a `doors` entry on the outdoor map).

## The Audi

A car is two solid tiles (`A` rear, `a` front) with an `action` warp (press A facing it) carrying the property
`car` = `murcia` (the office car) or `valencia` (the car in Murcia). Its arrival points are not on the map but in
`car.json › toMurcia` / `toValencia`: put each next to the *other* car. In the text layouts, draw `Aa` and add
`"car": { "x", "y", "to" }` to `world.json`.

## Editing in Tiled

Open `public/maps/<zone>.tmj` in Tiled. The format the game reads (`src/data/tiled.ts`):

- Orthogonal, 32 × 32 px tiles, **tile layer format CSV**, tilesets **embedded** in the map. Tileset image paths are
  relative to the map (`../assets/tilesets/world.png`).
- Tile layers: `ground`, `deco`, `above` (drawn over the player: tree crowns, roof edges) and `collision` (never
  drawn). A cell blocks if **any** tile layer has a tile with the tileset property `solid = true`; the map edge also
  blocks. Tiles with `encounter = true` are encounter tiles.
- Object layer `spawns`: point objects; the one named `default` is the zone's spawn point. Its tile is
  `floor(x / 32), floor(y / 32)`.
- Object layer `warps`: rectangles with properties `toMap` (zone id), `toX` / `toY` (ints; leave one out to keep the
  player's column or row, as edge warps do), `toFacing` (optional) and `trigger` (`step`: fires when a step ends
  inside it, for doors and edges; `action`: press A facing it). A step warp may sit one tile outside the map: those
  off-map tiles become walkable, so walking off the edge enters it. Every door needs a matching warp back on the
  other map. A car warp has the string property `car` and `trigger = action`, and no `toMap` / `toX` / `toY`. The
  mystery door is an `action` warp with the bool property `portal = true` and no `toMap` either.
- Object layer `encounters`: rectangles with string properties `group` and `mode`.

Boot checks (any error stops on the red screen): every warp targets an existing zone and only walkable tiles; every
encounter `group` exists in that zone's `zones.json` entry; every spawn and content point is walkable. A group in
`zones.json` that no rectangle uses is a warning.

To make a brand-new map in Tiled: create it with the settings above, add the tileset `world.png` (or copy the
tileset from an existing map so the tile properties come along), save it as `public/maps/<zone>.tmj`, then add the
zone to `zones.json`. Don't add it to `tools/world/world.json`, or `npm run world -- --force` will overwrite it.

## The story map

`historia` (32 × 16, `tools/world/historia.txt`) is the story realm's board, drawn with the same tileset as the world:
a sandy path (`:`) with round stone stops (`{`) in two rows joined on the right, each stop under a landmark built
from world tiles. Top row, left to right: the office (4, 6), the Torres de Serranos (11, 6), the Mercado Central
(18, 6), the bullring (25, 6); down the right side by the sea; bottom row, right to left: the Malvarrosa beach
(25, 13), the Ciutat de les Arts (18, 13), the Estació del Nord (11, 13) and the Albufera lake (4, 13). Each boss
stands on the tile above its stop. It is a zone in `zones.json` (so it loads and is checked like any map) but has no
warps: the StoryScene draws it (the debug teleport can still put the overworld player on it, to look at the map).

The stops, the path between them and where each boss stands are not in the map but in `story.json`
([CONTENT.md](CONTENT.md) › The story realm), checked at boot against the map: every stop and every tile of every leg
must be walkable. To add a stop, draw its landmark and a `{` on the path, then add the boss to `story.json`.

## The world tileset

`public/assets/tilesets/world.png`: 8 columns of 32 px tiles, drawn by `npm run world` from `tools/art/tiles.ts`
and `tools/world-tiles.ts`. Ids 0–31 are the base tiles; then the look-alike variants with their base tile's
properties (order: `tools/art/tiles.ts › VARIANT_TILES`); then the extra world tiles (`tools/world-tiles.ts ›
XT`, ids computed after the variants: huerta crops, sea, industrial and station tiles, the office, the Turia park,
the CAC, the mystery door and the story map's stop…), each its own base: `encounter` on the crops and dry scrub,
`solid` on every building, tree, water and furniture tile (and the mystery door).

| Id | Tile | | Id | Tile |
| --- | --- | --- | --- | --- |
| 0 | grass | | 16 | mountain (solid) |
| 1 | path | | 17 | vineyard (encounter) |
| 2 | wall (solid) | | 18 | road |
| 3 | water (solid) | | 19 | plaza paving |
| 4 | tree trunk | | 20 | roof (solid) |
| 5 | tree crown | | 21 | counter (solid) |
| 6 | flowers | | 22 | desk (solid) |
| 7 | tall grass (encounter) | | 23 | cactus (solid) |
| 8 | collision marker (solid, hidden layer) | | 24 | fence (solid) |
| 9 | door | | 25 | bridge |
| 10 | wooden floor | | 26 | desert ground |
| 11 | doormat | | 27 | shelf (solid) |
| 12–13 | the Audi from above, rear / front (solid) | | 28 | rock (solid) |
| 14 | sand | | 29 | bush (solid) |
| 15 | dune grass (encounter) | | 30 | fountain (solid) |
| | | | 31 | white wall (solid) |

Changing how tiles look: [ART.md](ART.md).

## Minimaps

Every outdoor zone has `public/assets/ui/minimap_<zone>.png`, drawn by `npm run placeholders` from the map's
collision data (3 px per tile: solid dark blue, encounter tiles green, the rest sand). It is never overwritten:
delete it after editing the map. Real art may replace it at any size; the game shrinks it to fit 128 × 96 base pixels
and places the player's dot by tiles. Indoor zones have no minimap.
