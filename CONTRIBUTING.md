# Contributing to Flexymon

Thanks for helping! New flexymon, NPCs, zones, art, bug fixes and tests are all welcome. Start with the
[README](README.md), then the guide for what you want to change:

- content (creatures, attacks, items, NPCs, dialogue, shops): [docs/CONTENT.md](docs/CONTENT.md)
- the world (maps, zones, buildings): [docs/MAPS.md](docs/MAPS.md)
- art and sound: [docs/ART.md](docs/ART.md); the sprite brief for artists: [docs/SPRITES.md](docs/SPRITES.md)
- code: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/GAME-RULES.md](docs/GAME-RULES.md)
- tests: [docs/TESTING.md](docs/TESTING.md)

## Branches

- **`develop`**: where all work lands. Branch from it and open pull requests against it.
- **`main`**: the published game. Every push to `main` deploys it to GitHub Pages
  ([docs/DEPLOY.md](docs/DEPLOY.md)). Nothing is pushed or merged to `main` except a release: a maintainer brings
  `main` up to `develop` (a pull request from `develop` to `main`, or a fast-forward push).

## Workflow

1. Fork, create a branch from `develop` (`add-flexymon-impresora`, `fix-shop-quantity`…).
2. Make one focused change. Small commits in English, imperative mood ("Add the Impresora flexymon").
3. **Update the documentation in the same change** (see below).
4. Run every check below and try the change in the running game.
5. Open a pull request **against `develop`** using the template. Say how you checked it.

Design changes (anything in [GAME-RULES.md](docs/GAME-RULES.md) › Design pillars, or a rule change) are best
discussed in an issue first.

## Documentation

**Every feature or change ships with its documentation in the same commit or pull request. Undocumented work is
not done.**

- A short doc comment (`/** ... */`) on every exported function, class, type and scene: what it does and any
  non-obvious rule it follows.
- A new or changed **rule** → [docs/GAME-RULES.md](docs/GAME-RULES.md).
- A new or changed **JSON field, content type, map property or tool option** → [docs/CONTENT.md](docs/CONTENT.md),
  [docs/MAPS.md](docs/MAPS.md) or [docs/ART.md](docs/ART.md), and `public/data/README.md` for validation rules.
- A new **scene, event, module or architectural pattern** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the
  folder's `README.md`.
- A new **debug command** → [docs/CONTENT.md](docs/CONTENT.md) › The debug menu.
- A new **`__E2E__` helper** → `tests/README.md`; a new spec → [docs/TESTING.md](docs/TESTING.md).
- A new **npm script** → [README.md](README.md) › Scripts and `tools/README.md`.
- If a doc is now wrong because of your change, fix it — even if it is not in this list.

## Checklist (every pull request)

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass with zero errors.
- `npx playwright test` passes.
- The change was tried in the running game (`npm run dev`; the F2 debug menu helps). Changes to visuals: look at a
  screenshot on desktop and on a phone profile (`--project=iphone`).
- No `console.log` (use `log()` / `warn()` / `error()` from `src/core/log.ts`).
- No hard-coded content in TypeScript and no Spanish text in `.ts` files: content goes in `public/data/*.json`,
  UI text in `src/i18n/es.json`, rule numbers in `src/logic/constants.ts`.
- Tests are never skipped, disabled or weakened to get green. A test that pins something you changed on purpose is
  updated in the same change, with the reason in the PR.
- Documentation updated (above).

## Code rules

- Game rules live in `src/logic/` as pure functions with no Phaser imports, each with unit tests. Scenes only draw,
  animate and read input.
- Randomness only through `src/core/rng.ts`; input only through `src/core/input.ts`; scenes talk only through
  `src/core/events.ts`.
- TypeScript `strict`; no `any` without a comment explaining why.
- Files `kebab-case.ts`, classes `PascalCase`, functions and variables `camelCase`, content ids `snake_case`.
- Dependencies are pinned exactly (`npm install -E`). Don't add a dependency without explaining why in the PR.
- Prettier formats everything (`npm run format`).

## Hard rules for content and art

- The creatures are *flexymon* (singular and plural). Never use the word "Pokémon" or any Nintendo asset, and never
  copy, trace or recreate assets, characters or logos from existing games.
- The game is Spanish only.
- Don't put real people's names (e.g. as secret names) in the repository.
- Don't add real content to the frozen test world (`public/test-world/`, `public/maps/test/`).
