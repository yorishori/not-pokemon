# Testing

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint and `prettier --check` (`npm run format` fixes formatting) |
| `npm run typecheck` | `tsc --noEmit` (strict TypeScript) |
| `npm test` | Vitest unit tests (`tests/**/*.test.ts`) |
| `npm run coverage` | Vitest with v8 coverage |
| `npx playwright test` | Browser tests in `tests/e2e/`, on four device profiles |
| `npx playwright test --project=desktop` | One profile (`desktop`, `android`, `android-landscape`, `iphone`) |
| `npx playwright test tests/e2e/battle.spec.ts` | One spec |

Every pull request must pass all of them (see `CONTRIBUTING.md`).

## Unit tests (Vitest)

`tests/` mirrors the source tree: `tests/logic/` for `src/logic/`, `tests/core/`, `tests/data/`, `tests/ui/`,
`tests/world/`, `tests/i18n/` and `tests/tools/`. Vitest only picks up `tests/**/*.test.ts` and ignores
`tests/e2e/` (`vite.config.ts`).

- **Every rule in `src/logic/` has a unit test**, using the worked examples from [GAME-RULES.md](GAME-RULES.md)
  (damage 14 and 12, defense 10 → 7, merge +1 up to 24…).
- **Fix the randomness.** Logic functions take an `Rng`. Use a seeded `createRng(seed)` from `src/core/rng.ts`, or
  `scriptedRng()` from `tests/logic/helpers.ts`, a fake that returns queued values so a test proves the exact order
  of random calls. `tests/logic/helpers.ts` also has `gameData()` (the test-world content as `GameData`) and
  `inst()` (a quick flexymon instance).
- **Data tests** (`tests/data/`) validate fixtures against the schemas and check one broken fixture per rule. Their
  fixture is the frozen test world (`tests/data/fixture.ts`). `tests/data/world.test.ts` checks the **real** world:
  zero load errors and warnings, every species and attack used, the balance guide, and a walk of every map proving
  each zone, NPC and the car are reachable (and Murcia only by car).
- **Tool tests** (`tests/tools/`) run the generators in memory.

## Browser tests (Playwright)

`npx playwright test` builds the game with `VITE_E2E=1` (which turns on the test hooks), serves `dist/` and runs every
spec on four profiles: `desktop`, `android` and `iphone` (portrait) and `android-landscape`. In cloud containers
Chromium is pre-installed; don't run `playwright install`. Headless Chromium renders WebGL in software (SwiftShader,
set in `playwright.config.ts`); a black canvas usually means WebGL failed to start, so check the console first.

| Spec | Covers |
| --- | --- |
| `smoke.spec.ts` | The game boots. |
| `title-screen.spec.ts` | 16:9 canvas, scaling without blur. |
| `data-validation.spec.ts` | Valid data loads; a broken id shows the red error screen. |
| `overworld.spec.ts` | Grid movement, walls, tap to turn, F2 coordinates. |
| `warps.spec.ts` | Doors, map edges, music. |
| `dialogue.spec.ts` | NPCs wander inside their area, talk, choice boxes. |
| `battle.spec.ts` | Win, lose, flee, switch, items, menus. |
| `encounters.spec.ts` | Encounter rate, safe steps, catching, merging, storage. |
| `enemy-npcs.spec.ts` | Sight, approach, rewards, cooldown, losing. |
| `items-shops-storage.spec.ts` | Buying, selling, items in battle, healer, storage box. |
| `menu-save.spec.ts` | Start menu, options, saving and reloading, broken saves. |
| `title-intro.spec.ts` | Title, name entry, intro, secret names. |
| `mobile-minimap.spec.ts` | Touch controls, portrait guard, minimap. |
| `car.spec.ts` | The Audi: locked, trip, skip, way back. |
| `story.spec.ts` | The story realm on the test world's small story: welcome, required team, the story shop (full-price buy-back), walking stop to stop, a closed stop, losing and winning a boss (healed, items back, the next boss appears), the office menu and back to the main game. |
| `world.spec.ts` | Walks the real world with a path finder: the office, the bars, the shops and M.P.'s house in Alboraya, both Alboraya ↔ Valencia edges, the metro, the Àgora, the train to El Pueblo (buys the licence), back north by road, the Audi to Murcia; then Murcia west to east and the car back. Also the office's mystery door into the story realm (and a reload coming back in front of it). |
| `audio-debug.spec.ts` | Audio unlock, interface sounds, the debug menu and data reload. |

### Writing a browser test

- **Read state through `window.__E2E__`**, never by guessing pixels. The helpers (`currentScene()`, `playerTile()`,
  `battle()`, `startBattle(seed)`, `setTeam()`, `npcs()`, `dialogue()`…) are listed in `tests/README.md` and declared
  in `E2EHooks` in `src/main.ts`. Add a helper there (and to the table) when you need one.
- To reach the overworld: wait for `preloadComplete()`, then
  `page.waitForFunction(() => window.__E2E__.quickStart())` (continues a save or starts a new game at the spawn,
  skipping the title, name and intro).
- Keys are seen on the next game frame: poll for the expected state (`expect.poll`) instead of reading it right
  after a key press, and wait for one press to take effect before the next.
- To test with different content, intercept the JSON with `page.route('**/data/npcs.json', …)` rather than editing
  the shipped files. If you move `start.json › spawn`, also serve a neutral intro (`tests/e2e/neutral-intro.ts`).
- Screenshots (`testInfo.outputPath(...)`) are for looking at, not for assertions. When you change visuals, take
  one on `desktop` and `iphone` and look at it.

## The frozen test world

The real world grows; tests need numbers that never change. So there are two content sets:

- `public/data/` + `public/maps/*.tmj`: the real game.
- `public/test-world/data/` + `public/maps/test/*.tmj`: a small, **frozen** set (3 flexymon, 3 test maps `test`,
  `test_house`, `test_east`; a two-boss `story.json` on the `test` map) used by the unit-test fixture and most
  browser specs. Layouts:
  `public/maps/test/README.md`.

Dev and E2E builds load the test world with `?world=test` in the URL or `localStorage['flexymon.e2e.world'] = 'test'`
(`playwright.config.ts` sets that key for every profile; `world.spec.ts` removes it). Production builds always load
the real world.

**Do not change the test world's numbers or add real content to it.** The only reason to edit it is a schema change
that makes a field required: then add the field to the test world's file too. The test maps are generated by
`npm run test-map` (`tools/make-test-map.ts`), and a unit test checks that the shipped files still equal its output.

## Checking a change in the running game

`npm run dev`, then use the debug menu (F2 twice) to teleport, start battles and give items. For a cloud or CI
session without a human, verify through Playwright and the `__E2E__` hooks, and look at screenshots.
