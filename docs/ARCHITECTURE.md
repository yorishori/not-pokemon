# Architecture

Flexymon is a static web app: TypeScript, [Phaser 4](https://phaser.io/) for rendering and input, Vite for the dev
server and build, zod for content validation, Vitest and Playwright for tests. There is no server: the build in
`dist/` is plain files, and the save lives in the browser's `localStorage`.

## The big picture

```
public/data/*.json ─┐                     ┌─────────── src/logic/ (pure rules, no Phaser) ───────────┐
public/maps/*.tmj  ─┼─► src/data/ ──► GameData ──►  battle, damage, encounter, merge, npc-state, shop…   │
public/assets/…    ─┘   (load, zod,   (frozen,   └──────────────▲─────────────────────────┬────────────┘
                         cross-refs)   lookups)                 │ plain data in            │ plain data out
                                                                │                          ▼
src/core/ (input, rng, events, save store, session) ◄──► src/scenes/ + src/ui/ + src/world/ (Phaser: draw, animate, read input)
```

Four rules hold the code together:

1. **Game rules are plain TypeScript in `src/logic/`** with no Phaser imports (ESLint enforces it). They take plain
   data and return plain data, never mutate their inputs, and are 100 % unit-tested. Example: the battle returns a
   list of `events[]` that the Battle scene animates one by one.
2. **Phaser code only presents and reads input** (`src/scenes/`, `src/ui/`, `src/world/`). A scene never computes a
   rule.
3. **Content is data.** Everything the player sees (creatures, numbers, dialogue, prices, maps) is in
   `public/data/*.json`, `public/maps/` and `src/i18n/es.json`, validated at boot.
4. **Randomness only through `src/core/rng.ts`** (seedable: `int`, `float`, `chance`, `pick`, `weighted`, `id`), so
   every test can fix the rolls.

## Folders

| Folder | What lives there | Reference |
| --- | --- | --- |
| `src/main.ts` | Creates the game; wires keyboard, touch, music (zone and battle), options, audio unlock, auto-save; exposes the test hooks. | — |
| `src/config/` | Phaser config: 512 × 288, pixel art, `FIT` scaling, the scene list. | — |
| `src/core/` | Infrastructure: `log`, `rng`, typed event bus, Input service, save store, auto-save, live game state (`session.ts`), options, UI sounds, audio unlock, debug flags. | `src/core/README.md` |
| `src/data/` | Content loader, zod schemas (`schemas/`), cross-reference and map checks, Tiled map parser, asset list, sprite atlas index, which content set to load. | `src/data/README.md` |
| `src/logic/` | Every game rule, pure. | `src/logic/README.md` |
| `src/scenes/` | One Phaser scene per screen. | `src/scenes/README.md` |
| `src/ui/` | Reusable widgets: dialogue box, choice box, grid menu, HP bar, box frame, minimap, touch controls, portrait guard. | `src/ui/README.md` |
| `src/world/` | Overworld objects: player, NPC actor, map drawing, camera bounds, music player. | `src/world/README.md` |
| `src/i18n/` | `es.json` (every UI string) and `t()`. | — |
| `public/` | Shipped as-is: `data/` (content), `maps/`, `assets/`, and the frozen `test-world/`. | `public/*/README.md` |
| `tools/` | Node scripts (run with `tsx`): art, world builder, placeholders, atlas, offline build, test maps. | `tools/README.md` |
| `tests/` | Vitest unit tests mirroring `src/` and `tools/`; Playwright specs in `tests/e2e/`. | `tests/README.md`, [TESTING.md](TESTING.md) |

## Boot sequence

1. **`Boot`** (`src/scenes/boot-scene.ts`) calls `loadGameData()` (`src/data/loader.ts`): fetch every file in
   `DATA_FILES`, parse, validate each with its zod schema, then run the cross-reference checks
   (`src/data/cross-refs.ts`), then fetch and parse every zone's map and run the map checks
   (`src/data/map-checks.ts`). It never throws: it returns `{ ok: true, data }` or `{ ok: false, errors }`.
2. On errors → **`Error`** scene: a red, scrollable list of `file › JSON path › message`. The game stops there.
3. On success → `setGameData()` stores a deeply frozen `GameData` with lookup maps (`data.flexymon.get('portatil')`),
   and **`Preload`** loads every image and sound the data names, using the asset's path as its Phaser key (sounds
   try `.ogg` then `.mp3`; sprites come from the atlas when it exists).
4. Preload launches the always-on **`Hud`** and **`Debug`** (when enabled) scenes and starts **`Title`**.

## Scenes

```
Boot ─► Preload ─► Title ─► Name ─► Intro ─► Overworld ◄──────────────┐
  └─► Error                 └─(Continuar)─────────► │                 │
                                                    ├─► Battle ───────┤  (Overworld sleeps; wakes on battle:ended)
                                                    ├─► Car ──────────┤  (sleeps; restarts at the arrival on car:ended)
                                                    ├─► Shop / Storage / Menu  (launched over the paused Overworld;
                                                    │                           overlay:closed resumes it)
                                                    └─► Story ─► Battle (Story sleeps; wakes on battle:ended)
                                                     (mystery door;  ├─► StoryTeam / Shop (over the paused Story)
                                                      replaces it)   └─► Overworld (Volver al juego)
Hud (save icon) and Debug (F2 overlay) run on top of everything.
```

| Scene | Job |
| --- | --- |
| `Title` | Title image, *Continuar* (only with a valid save) / *Nueva partida*. |
| `Name` | Letter grid or physical keyboard; 1–10 letters. |
| `Intro` | Runs the `intro.json` script on the spawn map, builds the new game, hands over the starter. |
| `Overworld` | Draws the zone's map, moves the player, warps, NPCs (wander, talk, enemies spotting the player), wild encounters, the minimap, the Audi. |
| `Battle` | Drives `src/logic/battle.ts`: menus, playing the events, catching, rewards, losing. |
| `Car` | The side-scrolling Audi trip. |
| `Shop`, `Storage`, `Menu` | Overlays over the paused overworld (the Shop also over the story map, as the story shop). |
| `Story` | The story realm's board (*Modo historia*): stops, bosses, walking stop to stop, the office menu, boss battles. |
| `StoryTeam` | Picks the story team, over the paused story map. |

Full per-scene details: `src/scenes/README.md`.

## State

- **`GameData`** (`src/data/game-data.ts`): the content, read-only. Replaced only by the debug *Recargar datos*.
- **Game state** (`src/core/session.ts`, type `GameState` in `src/logic/save.ts`): the player's name, position,
  euros, team slots, team, storage, bag and enemy NPC states. It is the same shape as the save file. Scenes read it
  with `gameState()` and write it back after applying a logic function (e.g. the Battle writes the team and bag back
  when it ends).
- **Story state** (`src/core/story-session.ts`, type `StoryState` in `src/logic/story.ts`): the story realm's stage,
  team, bought items, budget left, bosses beaten and stop. Separate from the game state, with its own save slot; the
  story scenes, the story shop and story battles read and write only this.
- **Scene-local state**: menus, cursors, animations. Never saved.
- **Options** (`src/core/options.ts`): volumes and text speed, in `localStorage['flexymon.options']`.

## Events

Scenes talk through the typed event bus in `src/core/events.ts`, never by reaching into each other. The
`GameEvents` interface lists every event and its payload: for example `zone:entered`, `player:moved`,
`battle:started`, `battle:ended`, `save:request`, `save:done`, `overlay:closed`, `options:changed`, `car:ended`,
`story:entered` and the `debug:*` commands. To add an event, add it to `GameEvents` with a doc comment.

## Input

One Input service (`src/core/input.ts`) with `isDown(action)` and `justPressed(action)` for the actions `up`,
`down`, `left`, `right`, `a`, `b`, `start`, `map` (and `debug` = F2). The keyboard (`bindKeyboard` in `main.ts`) and
the touch controls (`src/ui/touch-controls.ts`, an HTML overlay shown only on `(pointer: coarse)` devices) both feed
it with separate source ids. Phaser's keyboard plugin is turned off: **no scene reads the keyboard directly.** The
name screen switches the service to *text mode*, where letter keys type instead of pressing actions.

Keyboard: arrows / WASD move, Z = A, X = B, Enter = Start, M = minimap, F2 = debug. No gamepad.

## Saving

`src/core/save-store.ts` wraps `localStorage` (key `flexymon.save.v1`): `load()` returns `none`, `loaded` (with
migration warnings) or `broken` (the raw text is copied to `flexymon.save.broken`); `write()` and `remove()` never
throw. `src/logic/save.ts` holds the format, its zod schema and the migration. `src/core/autosave.ts` writes on every
`save:request` (map change, battle, shop, healer, menu close, the mystery door) and quietly on page hide. Rules:
[GAME-RULES.md](GAME-RULES.md) › Saving.

The story realm saves separately: `src/core/story-session.ts` keeps its state and writes `flexymon.story.v1` with
`saveStory()` (announced as `save:done` `story`) at every story change; `src/logic/story.ts` holds its format and the
fixes applied on load. Rules: [GAME-RULES.md](GAME-RULES.md) › Story mode.

## Text

`t('battle.wild_appeared', { name })` reads `src/i18n/es.json` and fills `{name}`. A missing key shows `⟦key⟧` and
logs a warning. Content text (names, dialogue) comes from the JSON, not from `es.json`. No Spanish text in `.ts`
files; developer diagnostics (validation errors, logs) are in English on purpose.

## Logging

Only `log()`, `warn()` and `error()` from `src/core/log.ts` may touch `console` (ESLint enforces it); they are
silent in production builds.

## Browser behaviour

- Rendering: 512 × 288 base resolution (16 × 9 tiles of 32 px), `pixelArt` and `roundPixels`, scaled with `FIT` and
  centred. Everything is positioned in tiles or base pixels.
- Audio is unlocked on the first key press, click or touch (`src/core/audio-unlock.ts`).
- When the tab is hidden, Phaser pauses the game loop and audio, the Input service releases every key, and a quiet
  save is written.
- Touch devices in portrait show "Gira el móvil" and pause; the first tap requests fullscreen.

## Two content sets

`src/data/world.ts` decides which content folder Boot loads. Production always loads `public/data/` (the real
world). Dev and E2E builds can load the frozen test world `public/test-world/data/` (maps in `public/maps/test/`)
with `?world=test` or `localStorage['flexymon.e2e.world'] = 'test'`. See [TESTING.md](TESTING.md).

## Debug and test hooks

- The **debug overlay** (`src/scenes/debug-scene.ts`) is on in dev builds and with `?debug=1`: F2 shows map, tile,
  FPS and euros, then a menu to teleport, start battles, give items and euros, reload data, delete the save and
  toggle encounters. See [CONTENT.md](CONTENT.md) › The debug menu.
- With `import.meta.env.DEV` or a `VITE_E2E=1` build, `window.__GAME__` (the Phaser game) and `window.__E2E__`
  (helpers such as `currentScene()`, `playerTile()`, `startBattle(seed)`, `battle()`, `setTeam()`…) are exposed for
  Playwright. The helpers are declared in the `E2EHooks` interface in `src/main.ts` and listed in
  `tests/README.md`.

## Extending the code

- **A new rule** goes in `src/logic/` as a pure function with a unit test in `tests/logic/`, and is documented in
  [GAME-RULES.md](GAME-RULES.md). Its numbers go in `src/logic/constants.ts`.
- **A new content field** needs: the zod schema in `src/data/schemas/`, cross-reference checks if it names ids
  (`cross-refs.ts`), map checks if it names tiles (`map-checks.ts`), assets in `collectAssets` if it names files
  (`src/data/assets.ts`), the frozen test world's copy of the file if the field is required, and a section in
  [CONTENT.md](CONTENT.md).
- **A new screen** is a scene in `src/scenes/`, registered in `src/config/game.ts`, built from the widgets in
  `src/ui/`, reading input only through the Input service and talking to other scenes through events.
- **A new UI string** is a key in `src/i18n/es.json`.
- **A new test hook** goes in `E2EHooks` (`src/main.ts`) and the table in `tests/README.md`.
