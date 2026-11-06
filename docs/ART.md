# Art and audio

All of Flexymon's art is **original and drawn by code** (`tools/art/`), so anyone can regenerate, restyle or extend
it without image tools. Any generated file can be replaced by a hand-made one at the same path and size: the game
only cares about paths.

Never copy, trace or recreate assets, characters, buildings or logos from existing games, and never use Nintendo
assets or the word "Pokémon".

## Asset sizes

| Asset | Path | Size | Made by |
| --- | --- | --- | --- |
| Flexymon front / back | `assets/sprites/flexymon/<id>_front.png`, `_back.png` | 64 × 64 | `npm run art` |
| Flexymon icon | `assets/sprites/flexymon/<id>_icon.png` | 16 × 16 | `npm run art` |
| Item | `assets/sprites/items/<id>.png` | 16 × 16 | `npm run art` |
| Player | `assets/sprites/player.png` | 64 × 128 walk sheet | `npm run art` |
| NPC | `assets/sprites/npcs/<name>.png` | 64 × 128 walk sheet (or any still image, e.g. 32 × 32) | `npm run art` |
| Audi (trip scene) | `assets/sprites/car/audi.png` | any; side view, nose right (96 × 40 now) | `npm run art` |
| Title | `assets/ui/title.png` | 512 × 288 | `npm run art` |
| World tileset | `assets/tilesets/world.png` | 8 columns of 32 × 32 tiles | `npm run world` |
| Minimaps | `assets/ui/minimap_<zone>.png` | any (shrunk to fit 128 × 96) | `npm run placeholders` |
| Sounds | `assets/audio/sfx/*.ogg` + `.mp3` | short | `npm run placeholders` (beeps) |
| Music | `assets/audio/music/*.ogg` + `.mp3` | a loop | hand-made |

**Walk sheets** are 2 columns (stand, stride) × 4 rows (down, left, right, up) of 32 × 32 frames. The game reads a
64 × 128 NPC sprite as a sheet and anything else as one still image (no facing).

Paths come from the content JSON (and the player sheet from `src/world/player.ts`). All of `public/` is copied to
the build as-is.

## Style guide

The look is a bright handheld-RPG pixel style (Game Boy Color / Advance era, top-down overworld) with a cartoon
Valencia theme.

- **View:** top-down, slightly 3/4: roofs and tree crowns seen from above, building fronts and doors from the front.
  Characters are about 1 tile wide and 1.5 tiles tall, big head, short body.
- **Pixels:** designed at 16 px per tile (32 px for flexymon) and scaled ×2, so the pixels are chunky. No
  anti-aliasing, no gradients, every colour solid.
- **Outlines and shading:** every object has a dark outline (near-black brown or navy, never pure black on large
  areas) and 2–3 shades per hue (light, base, shadow). Light comes from the top-left.
- **Texture:** ground tiles carry a subtle repeating pattern (dots, dashes, herringbone, cobbles) so large areas never
  look flat.
- **Palette cues:** mint grass (`#58c890`) with lighter speckles and darker tall-grass tufts; sandy paths (`#e8d090`);
  cream plazas (`#f0ecd0`) with herringbone; teal water (`#38a8b8`) with white ripples; pines in three greens;
  terracotta, blue, teal or ochre roofs with shingle rows; cream walls with timber trim; red and pink flowers.
- **Valencia flavour:** orange trees, terracotta roofs, blue-and-white tiled domes, palm trees, the beach and the
  Turia gardens, white emblematic buildings, office buildings.
- **Maps:** fill edges with trees, water or walls instead of void; mix ground variants so no screen is one flat tile;
  signposts by doors, fences and lampposts framing paths.
- **UI:** one box style (`src/ui/frame.ts`): cream fill, dark outer line, soft blue inner line, dark text. The battle
  screen has a pale sky-to-grass backdrop and a rimmed grassy platform under each flexymon.
- **Text:** there is no pixel font yet; texts use the browser's monospace font. A pixel font is a welcome
  contribution (it would be loaded in Preload and used by the UI widgets in `src/ui/`).

## The art pipeline

| Command | Draws | Code |
| --- | --- | --- |
| `npm run art` | player, NPC sheets, flexymon, items, the car, the title | `tools/make-art.ts` + `tools/art/{characters,flexymon,sprites}.ts` |
| `npm run world` | the world tileset (and the maps) | `tools/make-world.ts` + `tools/art/tiles.ts` + `tools/world-tiles.ts` |
| `npm run placeholders` | anything still missing: beeps for sounds, minimaps, simple coloured squares | `tools/make-placeholders.ts` |
| `npm run atlas` | packs every content sprite into one texture atlas (run by `npm run build`) | `tools/make-atlas.ts` |

`npm run art` and `npm run world` never overwrite existing files; add `-- --force` to redraw everything after
changing the art code (and `-- --dry-run` to `art` to list what it would write). `npm run art` reads both content
folders (`public/data/` and the test world) for sprite paths, so every new path in the JSON gets art.

`tools/art/pixels.ts` is the shared painter. A `Pix` is a small RGBA canvas with chainable drawing calls: `set`,
`rect`, `ellipse`, `round` (rounded rectangle), `ascii` (paint from rows of characters and a palette), `blit`,
`crop`, `recolor`, `outline(colour)` (adds the dark outline around everything drawn), `scale(n)`, `shrink(n)` and
`png()`. `hex('#rrggbb')`, `shade(colour, t)` (lighter for t > 0, darker for t < 0) and `mix(a, b, t)` build colours.

### Give a new flexymon its look

Without a drawing, a new species gets a generic round creature coloured from its id. To draw it, add an entry to
`SPECIES` in `tools/art/flexymon.ts`:

```ts
impresora: {
  outline: hex('#283040'),
  draw: (p, front) => {
    box(p, 6, 8, 20, 14, hex('#d0d4dc'));          // body (32 × 32 design canvas)
    if (front) face(p, 12, 13);                     // eyes, mouth, blush
    else p.rect(9, 10, 14, 3, hex('#505868'));      // paper slot on the back
    feet(p, 8, 20, 22, hex('#505868'));
  },
},
```

`draw` paints on a 32 × 32 design canvas, once for the front and once for the back (`front` false). Helpers in the
same file: `box` (shaded rounded box), `face`, `eye`, `feet`. The outline, the ×2 scale and the 16 × 16 icon (the
front, shrunk) are done for you. Then:

```bash
npm run art -- --force
```

### Give a new item its look

Add a function to `ITEMS` in `tools/art/sprites.ts`; it paints directly at 16 × 16. Unknown ids get a parcel.

### Give a new NPC (or story boss) its look

Add the sprite's file name to `NPC_LOOKS` in `tools/art/characters.ts`:

```ts
impresor: { skin: SKIN.mid, hair: HAIR.black, style: 'short', shirt: hex('#3878c8'), pants: hex('#404050'), tie: hex('#c03838') },
```

`style` is `short`, `long`, `cap` (with `hat` colour), `bald` or `bun`; optional `shoes`, `hat`, `front` (an
apron / vest colour) and `tie`. All four directions and both frames are drawn from these colours. Unknown names get
a look picked from the name.

### Change the world's tiles

`tools/art/tiles.ts` draws every tile at 16 × 16 and `VARIANT_TILES` lists the variants; `autotile()` in
`tools/make-world.ts` chooses variants from the neighbours. After a change run `npm run world -- --force` (this also
rewrites the maps from `tools/world/`, see [MAPS.md](MAPS.md)). Keep the base tile ids 0–31 and their `solid` /
`encounter` properties: maps and the unit tests rely on them.

`tools/world-tiles.ts` draws the extra world tiles (huerta crops, sea, industrial estate, stations and trains, the
office, the Turia park, the CAC…) as 16 × 16 character grids with a small palette (`C`); they have no variants. The
office and its façade use the company logo's colours (deep navy, light blue, white) with an orange accent for the
product brand (`C.f`); the brand colour could not be confirmed, so change `C.f` if it is wrong.

## Replacing art with hand-made files

The full list of sprite files to draw, with sizes and layouts, is the artists' brief in [SPRITES.md](SPRITES.md).

Drop a PNG at the same path, the same size and (for sheets) the same layout. Nothing else changes; the generators
will not overwrite it (unless someone runs them with `--force`, so mention hand-made files in your PR). For the
tileset, keep the tile order. `npm run build` repacks the atlas automatically.

## Sounds and music

- Every sound is shipped twice: `<name>.ogg` and `<name>.mp3` (fallback for browsers without OGG). The JSON names one
  of them; both are loaded.
- `npm run placeholders` makes a 0.2 s beep for any missing sound (distinct tones for the interface sounds, a hum
  for the car engine) when `ffmpeg` is installed, or silent files otherwise.
- Music: one loop per region (`valencia`, `murcia`) plus `interior` for every indoor zone, chosen per zone in
  `zones.json › music` (the story board plays `story.json › music`, the Valencia loop), and `battle` for every battle (`sounds.json › battleMusic`).
- The music, the interface sounds, the two dialogue voices, the starter jingle and the car engine are hand-made
  recordings; the cries and attack sounds are still placeholder beeps.
- Dialogue voices play every few typed characters (`VOICE_EVERY_CHARS`), so a voice file must be a blip of under
  0.1 s; longer clips stack up into noise.
- Audio starts after the first key, click or touch (browser autoplay rules) and pauses when the tab is hidden. The
  player sets music and effects volume in Start › Opciones.

## The sprite atlas

`npm run build` runs `npm run atlas` first: every content sprite up to 128 × 128 is packed into
`public/assets/atlas/sprites.png` + `sprites.json` (a build artifact, not committed), so a phone downloads one image
instead of about 70. The game still refers to each sprite by its own path; Preload copies atlas frames into
textures under those paths. `npm run dev` before any build loads the separate files.
