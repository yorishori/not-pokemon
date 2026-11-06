# Flexymon — rules for Claude Code sessions

Flexymon is an open-source browser game (desktop + mobile, landscape) in the style of the Game Boy Color
monster-collecting RPGs, set in a cartoon Valencia region. The game is complete; sessions now add features, content
and fixes.

**The documentation is the source of truth:** `README.md`, `CONTRIBUTING.md` and `docs/`:

| Doc | Covers |
| --- | --- |
| `docs/ARCHITECTURE.md` | How the code fits together. |
| `docs/GAME-RULES.md` | Every game rule and the design pillars. |
| `docs/CONTENT.md` | Content JSON: flexymon, attacks, items, NPCs, dialogue, enemies, encounters, shops, the story realm, debug menu. |
| `docs/MAPS.md` | Maps, zones, the world builder, Tiled format, tileset ids. |
| `docs/ART.md` | Art style, the code-drawn art pipeline, asset sizes, audio. |
| `docs/SPRITES.md` | The brief for artists: every sprite file, its size, layout and delivery. |
| `docs/TESTING.md` | Unit and browser tests, the frozen test world. |
| `docs/DEPLOY.md` | Building and hosting. |

Folder `README.md` files are the file-by-file reference (`src/*/README.md`, `public/*/README.md`, `tools/README.md`,
`tests/README.md` for the `__E2E__` hooks).

## How to work (every session)

1. Before writing code, read this file, `CONTRIBUTING.md` and the docs relevant to the task.
2. Develop on the branch the harness assigned (or a short descriptive branch made from `develop`). Commit there while
   working. Branches: `develop` collects finished work; `main` is the published game (every push to `main` deploys
   it to GitHub Pages, `docs/DEPLOY.md`).
3. Keep the change focused on what was asked.
4. Never hard-code game content (creature names, numbers, dialogue, prices) in TypeScript. Content lives in
   `public/data/*.json`; UI strings live in `src/i18n/es.json`; tunable rule numbers live in
   `src/logic/constants.ts`.
5. If a rule is unclear, don't silently invent one: pick the safest behaviour, document it in the relevant doc, and
   tell the user.
6. **Every feature or change includes its documentation update, in the same commit.** Undocumented work is not done:
   - a short doc comment (`/** ... */`) on every exported function, class, type and scene, saying what it does and
     any non-obvious rule it follows;
   - rules → `docs/GAME-RULES.md`; content fields, NPC types, debug commands → `docs/CONTENT.md`; maps, zones, tiles,
     world builder → `docs/MAPS.md`; art, sizes, audio → `docs/ART.md`; sprite files, NPC sheets, items, tiles → `docs/SPRITES.md`; scenes, events, modules, patterns →
     `docs/ARCHITECTURE.md`; tests and `__E2E__` hooks → `docs/TESTING.md` and `tests/README.md`; npm scripts →
     `README.md` and `tools/README.md`; validation rules → `public/data/README.md`; new files → the folder's
     `README.md`;
   - any doc made wrong by the change is fixed, even if not listed above;
   - if this file (`CLAUDE.md`) or `CONTRIBUTING.md` no longer matches how the project works, update them too.
   Don't write change logs or history ("added in…") into docs or comments: describe how things work now.
7. **Test before pushing to `develop`.** A change may only reach `develop` when every check of the Definition of done
   passes. If anything fails, fix it first; never push a red build to `develop` or `main`, and never skip, disable or
   weaken a test to get green (a test that pins something changed on purpose is updated, and the reason told to the
   user).
8. **When a change is finished and tested, push it to `develop`.** Bring the branch up to date with `origin/develop`
   first (`git fetch origin develop`, then rebase or merge), re-run the checks if anything changed, then
   `git push origin HEAD:develop`. Also push the working branch. `develop` must always contain only finished,
   tested, documented work.
9. **Never push to `main` unless the user asks to publish.** Pushing to `main` publishes the game. To publish, bring
   `main` up to `develop` (`git fetch origin develop main`, then `git push origin origin/develop:main`, a
   fast-forward; never force-push `main`). If `main` has commits `develop` lacks, merge `main` into `develop` first.

### Definition of done (every change)

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass with zero errors.
- `npx playwright test` passes.
- The change was checked in the running game. In a cloud session with no human at the browser, check it with
  Playwright (via the `window.__E2E__` hooks) and look at screenshots; tell the user what was verified that way.
- No `console.log` except through `log()` in `src/core/log.ts`.
- No new hard-coded content; no Spanish text inside `.ts` files.
- Documentation updated in the same commit (rule 6).
- Pushed to `develop` (rule 8); `main` only when the user asks to publish (rule 9).

## Design pillars (summary — full table in `docs/GAME-RULES.md`)

- Spanish only. The creatures are called **flexymon** (singular and plural). Never use the word "Pokémon" or any
  Nintendo asset in the game, and never copy assets from existing games.
- Stats HP / Ataque / Defensa / Velocidad. No types, no levels, no XP. Max 3 attacks.
- Controls: desktop arrows/WASD, Z = A, X = B, Enter = Start, M = minimap. Mobile: on-screen D-pad, A, B, Start, Mapa;
  landscape only. **No gamepad.**
- Saving: `localStorage`, one slot, key `flexymon.save.v1`; the story realm (Modo historia) keeps its own slot,
  `flexymon.story.v1`. No backend. Static site only.

Changing a pillar is a design decision: ask the user first.

## Stack

| Tool | Notes |
| --- | --- |
| Node.js LTS + npm | Node 22 (`.nvmrc`). |
| TypeScript 6.0, `strict: true` | No `any` without a comment explaining why. Stay on 6.0 until `typescript-eslint` supports 7. |
| Vite | Output `dist/`, fully static, `base: './'`. |
| Phaser | Pinned exactly (`4.2.1`, no `^`); all dependencies are pinned with `npm install -E`. |
| Zod | One schema per JSON file in `src/data/schemas/`. |
| Vitest | Unit tests; required for everything in `src/logic/`. |
| Playwright (`@playwright/test` 1.64.1) | Browser tests in `tests/e2e/`. The version matches the browsers pre-installed in cloud sessions. |
| ESLint (flat config, `eslint.config.js`) + Prettier | `npm run lint` runs both; `npm run format` fixes formatting. |
| Tiled | Maps as `.tmj` (Tiled JSON, CSV layers, embedded tilesets); the real world is generated from `tools/world/`. |

Screen: base resolution **512 × 288** (16 × 9 tiles of 32 px), `pixelArt: true`, `roundPixels: true`, scale `FIT` +
`CENTER_BOTH`. Position everything in tile/base-pixel units.

## Repo layout

```
README.md, CONTRIBUTING.md   overview and contributor workflow
docs/                        the guides listed above
public/data/                 game content JSON (12 files; guide: docs/CONTENT.md)
public/maps/                 Tiled maps, one per zone (generated from tools/world/); test/ = frozen test maps
public/assets/               sprites, tilesets, ui (title, minimaps), audio (sfx, music)
public/test-world/data/      frozen test content (do not add real content)
src/main.ts                  creates the Phaser game, wiring, __E2E__ hooks
src/config/game.ts           resolution, scene list
src/core/                    log, rng, events, input, save store, autosave, session, story session, options, ui sounds
src/data/                    loader, schemas/ (zod), cross-refs, map checks, Tiled parser, atlas
src/logic/                   pure game rules, NO Phaser imports, 100% unit-tested
src/scenes/                  Boot, Preload, Error, Title, Name, Intro, Overworld, Story, Battle, Car, Shop, Storage, Menu,
                             StoryTeam, Hud, Debug
src/ui/                      DialogBox, ChoiceBox, GridMenu, HpBar, frame, Minimap, TouchControls, RotateScreen
src/world/                   Player, NpcActor, zone map drawing, camera, music
src/i18n/                    es.json (every UI string) and t()
tools/                       art/, world/, make-*.ts generators (README.md)
tests/                       Vitest unit tests mirroring src/ and tools/; e2e/ Playwright specs
```

## Architecture rules

- **Game rules are plain TypeScript in `src/logic/`, with no Phaser imports.** They take plain data and return plain
  data (battle resolution returns an `events[]` list the scene animates). Scenes never compute rules.
- **Phaser code is presentation and input only** (`src/scenes/`, `src/ui/`, `src/world/`).
- **Content is data**, validated with zod at boot, plus cross-reference and map checks. Any error stops the game on
  the red ErrorScene listing file › JSON path › message.
- **Randomness only through `src/core/rng.ts`** (seedable), so tests can fix the seed.
- **Input**: one service in `src/core/input.ts` (`isDown`, `justPressed`). Keyboard and touch both feed it; no scene
  reads the keyboard directly.
- **Scenes talk through `src/core/events.ts`** (typed event bus), not by reaching into each other.
- **Saves** go through the save store over `localStorage`, with a `version` field, schema validation and migration.
- **Text**: `t('battle.wild_appeared', { name })` reads `src/i18n/es.json`; a missing key shows `⟦key⟧`.
- Browser hygiene: audio only after the first user gesture; pause on `visibilitychange` (hidden).

## Commands

- `npm run dev` — dev server (`?world=test` loads the frozen test world; F2 = debug overlay/menu)
- `npm run build` — sprite atlas + typecheck + production build to `dist/` (deploying: `docs/DEPLOY.md`)
- `npm run preview` / `npm start` — serve `dist/` / install + build + serve
- `npm run offline` — one self-contained `dist-offline/flexymon.html` + zip
- `npm run lint` / `npm run format` / `npm run typecheck` / `npm test` / `npm run coverage`
- `npm run art` / `npm run world` / `npm run placeholders` / `npm run atlas` / `npm run test-map` — generators
  (never overwrite; `-- --force` regenerates; see `tools/README.md`)
- `npx playwright test` — browser tests (builds with `VITE_E2E=1` and serves `dist/` automatically);
  `--project=iphone` for one device profile

## Test hooks and Playwright

- With `import.meta.env.DEV` or `VITE_E2E=1`, `window.__GAME__` and `window.__E2E__` helpers are exposed (declared in
  `E2EHooks` in `src/main.ts`, listed in `tests/README.md`). Add a helper there when a test needs one.
- Playwright tests read state through these hooks, never by pixel-guessing. Screenshots are for visual review.
- Headless Chromium uses software WebGL (SwiftShader). A black canvas usually means a WebGL init failure.
- In cloud sessions Chromium is pre-installed: do not run `playwright install`. If the pinned version cannot find
  the browser, launch with `executablePath: '/opt/pw-browsers/chromium'`.
- When changing visuals, take a Playwright screenshot (desktop + `iphone` projects) and look at it.
