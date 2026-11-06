# Flexymon

A browser monster-collecting RPG in the style of the Game Boy Color classics, set in a cartoon version of the
Valencia region (Spain). Wander the huerta, the city, the beach and, if you get the right items for the office Audi,
the Murcia desert. Meet wild **flexymon**, fight enemy trainers in turn-based battles, collect and merge creatures,
earn euros and buy items. The main game has no story and no ending: just wander and collect. For a quick game, a
mystery door in the office leads to the **Modo historia**: pick a team of four, spend a fixed budget on items, and
beat seven bosses in a row on a board-game map of Valencia's landmarks.

- Plays in any modern browser, on desktop and on phones (landscape, on-screen controls).
- A fully static site: no server, no accounts; the game saves in the browser.
- Spanish only (the in-game text); the code and these docs are in English.
- All content is data (JSON + maps) and all art is drawn by code, so adding creatures, NPCs or whole zones needs no
  engine work.

Built with TypeScript, [Phaser 4](https://phaser.io/), Vite and zod; tested with Vitest and Playwright.

## Quick start

You need [Node.js](https://nodejs.org/) 22 (see `.nvmrc`) and npm.

```bash
npm ci
```

```bash
npm run dev
```

Open the printed URL (usually <http://localhost:5173>). Press **F2** in a dev build for the debug overlay; F2 again
for the debug menu (teleport, battles, items, reload data).

`npm start` installs, builds and serves the production build in one go.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrows / WASD | D-pad |
| A (talk, confirm) | Z | A |
| B (back, cancel) | X | B |
| Start (menu) | Enter | Start |
| Minimap | M | Mapa |

## Documentation

| Guide | For |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code fits together: boot, scenes, logic, data, input, saving. |
| [docs/GAME-RULES.md](docs/GAME-RULES.md) | The rules: battles, damage, catching, merging, enemies, economy, saving. |
| [docs/CONTENT.md](docs/CONTENT.md) | Adding flexymon, attacks, items, NPCs and dialogue, enemy trainers, encounters, shops… |
| [docs/MAPS.md](docs/MAPS.md) | Editing and expanding the world: layouts, new zones, buildings, doors, encounter areas. |
| [docs/ART.md](docs/ART.md) | The art style, the code-drawn art pipeline, sizes, sounds and music. |
| [docs/SPRITES.md](docs/SPRITES.md) | The brief for artists: every sprite file, its size, layout and delivery. |
| [docs/TESTING.md](docs/TESTING.md) | Unit and browser tests, test hooks, the frozen test world. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Building and hosting the static site; the offline single-file build. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, conventions and the checklist every change must pass. |

Each source folder also has a `README.md` with a file-by-file reference.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload, debug overlay and test hooks. |
| `npm run build` | Sprite atlas + typecheck + production build to `dist/`. |
| `npm run preview` | Serve `dist/`. |
| `npm start` | Install, build, then serve `dist/`. |
| `npm run offline` | Build, then write one self-contained `dist-offline/flexymon.html` (and a zip) that opens from disk. |
| `npm run lint` / `npm run format` | ESLint + Prettier check / Prettier write. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` / `npm run coverage` | Vitest unit tests / with coverage. |
| `npx playwright test` | Browser tests (builds with test hooks and serves `dist/` itself). |
| `npm run art` | Draw sprites, NPCs, flexymon, items, the car and the title (`-- --force` to redraw). |
| `npm run world` | Build the world maps and tileset from `tools/world/` (`-- --force` to rebuild). |
| `npm run placeholders` | Create any missing asset (sounds, minimaps…); never overwrites. |
| `npm run atlas` | Pack sprites into one texture atlas (part of `npm run build`). |
| `npm run test-map` | Regenerate the frozen test world's maps. |

## Project layout

```
public/data/      game content (JSON)            src/logic/    pure game rules (no Phaser), fully unit-tested
public/maps/      Tiled maps, one per zone       src/scenes/   Phaser scenes (one per screen)
public/assets/    sprites, tilesets, UI, audio   src/ui/       widgets: dialogue box, menus, HP bar, touch controls
tools/world/      text sources of the maps       src/world/    player, NPCs, map drawing, music
tools/art/        code that draws all the art    src/data/     content loading and validation (zod)
tests/            Vitest + Playwright            src/core/     input, rng, events, saving, options
docs/             guides                         src/i18n/     es.json (every UI string) and t()
```

## A note on names

Flexymon is an original fan-style game. It is not affiliated with Nintendo, Game Freak or The Pokémon Company, uses
none of their assets, and never uses the word "Pokémon" in the game. The world is a cartoon of real places in the
Valencia region.

## License

[MIT](LICENSE). Contributions are accepted under the same license.
