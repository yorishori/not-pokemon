# tests

Testing guide: [docs/TESTING.md](../docs/TESTING.md). This file is the reference for the browser-test hooks and the
tricks the specs use.

- `tests/core/`, `tests/data/`, `tests/i18n/`, `tests/logic/`, `tests/tools/`, `tests/ui/`, `tests/world/`: Vitest unit
  tests mirroring `src/` and `tools/` (`npm test`; coverage with `npm run coverage`). The data and rule tests use the
  frozen test world `public/test-world/data/` as fixture (`tests/data/fixture.ts`); `tests/logic/helpers.ts` adds
  `gameData()`, `inst()` and `scriptedRng()`; the real world is checked by `tests/data/world.test.ts`.
- `tests/e2e/`: Playwright browser tests (`npx playwright test`). They build with `VITE_E2E=1` and serve `dist/`.

**The test world.** `playwright.config.ts` starts every profile with `localStorage['flexymon.e2e.world'] = 'test'`,
which makes the build load `public/test-world/data/` and the maps in `public/maps/test/` (`src/data/world.ts`;
`?world=test` in the URL does the same with `npm run dev`). `page.route('**/data/…json')` interceptions match that
folder too. A spec about the real world removes the key before the page loads (`page.addInitScript`), like
`tests/e2e/world.spec.ts`.

`tests/e2e/world.spec.ts` walks the real world with a small path finder (`walkTo`: it reads the `.tmj` maps,
re-plans every tile around the NPCs, plays through enemy battles and dialogue) and `visit` (enter a door, check the
doormat, leave). The two long walks run on `desktop` only. To run it next to another Playwright run, give it its
own port and build folder:
`E2E_PORT=4180 E2E_SERVER_CMD="VITE_E2E=1 npx vite build --outDir dist-world && npx vite preview --outDir dist-world --port 4180 --strictPort" npx playwright test tests/e2e/world.spec.ts`.

## Test hooks (`src/main.ts`)

Exposed when `import.meta.env.DEV` is true or the build has `VITE_E2E=1`:

| Hook | What it is |
| --- | --- |
| `window.__GAME__` | The `Phaser.Game` instance (`isBooted`, `scene`, `config`…). |
| `window.__E2E__.activeScenes()` | Keys of the active scenes, bottom to top. |
| `window.__E2E__.currentScene()` | Key of the topmost active scene, ignoring the Debug overlay and the HUD (`'Title'`, `'Name'`, `'Intro'`, `'Overworld'`…), or `null`. |
| `window.__E2E__.dataSummary()` | Counts per content collection, or `null` if data is not loaded. |
| `window.__E2E__.dataErrors()` | The `file › path › message` lines shown by the ErrorScene (`[]` if not shown). |
| `window.__E2E__.preloadComplete()` | True once Preload loaded every asset. |
| `window.__E2E__.failedAssets()` | Keys of assets that failed to load. |
| `window.__E2E__.hasTexture(key)` / `hasSound(key)` | Whether an asset (key = its JSON path) is loaded. |
| `window.__E2E__.playerTile()` | `{ map, x, y, facing, moving }` in the overworld (tiles as in Tiled), else `null`. |
| `window.__E2E__.debugLines()` | The Debug overlay's lines while shown (F2; needs a dev build or `?debug=1`), else `null`. |
| `window.__E2E__.debugMode()` | `'hidden'`, `'info'` or `'menu'` (teleport list); `null` when debugging is disabled. |
| `window.__E2E__.currentMusic()` | Sound key of the music playing or fading in (the zone's, or `sounds.json › battleMusic` during a battle) (e.g. `assets/audio/music/test.ogg`), or `null`. |
| `window.__E2E__.overworldLocked()` | True while the overworld ignores movement (warp fade, debug menu, an open dialogue or choice box). |
| `window.__E2E__.npcs()` | NPCs on the current map: `{ id, x, y, facing, moving, talking, state, alert }` (tile = the step's start while moving; `state` `ready`/`cooldown` for enemies, `null` otherwise; `alert` = the "!" bubble shows); `[]` outside the overworld. |
| `window.__E2E__.dialogue()` | The open dialogue box: `{ page, pages, text (visible), full, typed, more, voicePlays }`, or `null`. |
| `window.__E2E__.openChoice(options)` | Opens a ChoiceBox in the overworld (test helper). |
| `window.__E2E__.choice()` / `choiceResult()` | Open choice box `{ options, cursor }` or `null`; the last result (index, `null` = cancelled with B, `undefined` = none yet). |
| `window.__E2E__.startBattle(seed, species?, kind?)` | Starts a battle from the overworld against a fresh flexymon (`raton`, `wild` by default; `kind` `npc` greys out Huir); the RNG is seeded with `seed` when the battle starts. `false` if refused (locked, mid-step, box open). |
| `window.__E2E__.battle()` | The battle screen: `{ kind, phase, result, round, ui ('anim'/'main'/'attack'/'team'/'catch'/'end'; `catch` = the Llevármelo/Dejarlo choice after a wild win, shown in `menu`), menu { options[{label, enabled}], cursor }, message, player, opponent }`; each side `{ uid, speciesId, name, hp, maxHp (logic), shownHp (bar), hpText }`. `null` outside a battle. |
| `window.__E2E__.team()` / `setTeam(members)` | The team in the game state; replace it with fresh flexymon `[{ speciesId, currentHp? }]`. |
| `window.__E2E__.party()` | `{ team, storage, teamSlots }` from the game state (copies). |
| `window.__E2E__.safeSteps()` | Steps left without encounter rolls (3 after every map entry and battle); `null` outside the overworld. |
| `window.__E2E__.encountersEnabled()` / `setEncounters(on)` | Read / set the debug flag that switches wild encounters off (same as the F2 menu's "Encuentros" option). |
| `window.__E2E__.euros()` / `setEuros(n)` | Read / set the player's euros in the game state. |
| `window.__E2E__.items()` / `setItems(items)` | Read / replace the bag `{ itemId: count }` in the game state. |
| `window.__E2E__.setParty({ team?, storage?, teamSlots? })` | Replace team and/or storage with fresh flexymon `[{ speciesId, currentHp? }]` and/or set the slots. |
| `window.__E2E__.useFieldItem(itemId, targetUid?)` | Runs `useFieldItem` on the game state: the `use` (`heal` / `revive` / `team_slot`) or `{ error }`. |
| `window.__E2E__.shop()` | The open shop: `{ shopId, ui ('main'/'list'/'quantity'/'confirm'/'message'/'closed'), mode, euros, menu, itemId, quantity, total, prompt, message }`, else `null`. |
| `window.__E2E__.storage()` | The open storage box: `{ column, cursor, team[], storage[] (species ids), teamSlots, message }`, else `null`. |
| `window.__E2E__.saveRequests()` | Reasons of every `save:request` since load (`healer`, `shop`; `map`, `battle`, `menu`). |
| `window.__E2E__.savesWritten()` | Reasons of every save written since load (`quiet` = page hidden / closed). |
| `window.__E2E__.savedGame()` | The raw `flexymon.save.v1` text, or `null`. |
| `window.__E2E__.saveIcon()` | True while the "Guardando…" icon shows (600 ms after each save). |
| `window.__E2E__.menu()` | The open Start menu: `{ ui ('main'/'team'/'detail'/'move'/'bag'/'bag_target'/'options'/'message'/'closed'), menu { options, cursor }, detail (stats `{ stat, value, base, bonus }`, attacks) on the detail page, options { music, sfx, textSpeed, cursor }, description (Mochila), message, messageTyped }`, else `null`. |
| `window.__E2E__.options()` / `setOptions(o)` | Read / replace the options `{ music, sfx (0–10), textSpeed ('slow'/'normal'/'fast') }` (stored in `flexymon.options` and applied). |
| `window.__E2E__.musicGain()` | The music option's gain applied to the music player (0–1). |
| `window.__E2E__.patchState(patch)` | Merge fields into the game state (e.g. `team` with bonuses, `npcs`); the position follows the player. |
| `window.__E2E__.npcStates()` | Enemy NPC states from the game state: `{ id: 'ready' \| 'cooldown' }` (an NPC never beaten is missing = `ready`). |
| `window.__E2E__.title()` | The title screen: `{ ui ('press'/'menu'/'confirm'/'leaving'), options (menu labels), cursor, confirm (Sí/No box or null), hasSave, brokenSave, logo, hint }`, else `null`. |
| `window.__E2E__.quickStart()` | On the title: continue a valid save, else a new game with the default name at `start.json › spawn`, skipping menu, name and intro. `false` if the title is not showing. |
| `window.__E2E__.nameEntry()` | The name screen: `{ name, cursor, cell (label under the cursor), cells (labels), message, rects (cell rectangles in base pixels) }`, else `null`. |
| `window.__E2E__.intro()` | The intro: `{ step, type, name, player, coworker ({ x, y, facing }), dialogue, handedOver, secretMessage, jinglePlays }`, else `null`. |
| `window.__E2E__.playerName()` | The player's name in the game state. |
| `window.__E2E__.touchControls()` | The touch overlay: `{ shown, controls [{ id ('dpad'/'a'/'b'/'start'/'map'), x, y, width, height }] (CSS pixels), pressed (ids held; the D-pad as 'dpad:<dir>') }`; `{ shown: false, controls: [], pressed: [] }` on non-touch devices. |
| `window.__E2E__.inputDown()` | Actions the Input service holds down now (keys and touch alike). |
| `window.__E2E__.rotateScreen()` | `{ shown ("Gira el móvil" on screen), paused (game loop), touch (touch device) }`. |
| `window.__E2E__.fullscreenRequested()` | True once the first tap asked for fullscreen. |
| `window.__E2E__.carTrip()` | The Audi trip while the Car scene runs: `{ to ('murcia' / 'valencia'), elapsedMs, skippable (a button would skip it), finished (ended, fading out), skipped, flipped (car faces left) }`, else `null`. The `finished` state lasts only one 200 ms fade, so check the outcome with `lastCarTrip()`. |
| `window.__E2E__.lastCarTrip()` | The last trip that ended this page load (kept after the Car scene stopped): the `carTrip()` fields at the moment it ended (`finished: true`, `skipped`, `elapsedMs`), else `null`. |
| `window.__E2E__.uiSounds()` | Interface sounds played since the page loaded, oldest first (`cursor` / `confirm` / `cancel` / `error` / `money`; the last 100). |
| `window.__E2E__.lastUiSound()` | `{ kind, volume }` of the last interface sound (volume = the effects option, 0–1), else `null`. |
| `window.__E2E__.audio()` | `{ unlockRequested (the first gesture asked to unlock), locked (Phaser's sound manager), contextState (Web Audio context, or `null`) }`. |
| `window.__E2E__.debugReload()` | The debug menu's last "Recargar datos": `{ state: 'idle' / 'loading' / 'ok' / 'error', errors (formatted lines) }`; `null` when debugging is off. |
| `window.__E2E__.atlasSprites()` | How many sprites Preload took from the sprite atlas (`0` without one). |
| `window.__E2E__.minimap()` | The minimap in the overworld: `{ zone, shown (player's choice), visible (drawn), available (outdoors with an image), frame { x, y, width, height, scale } (base pixels), mapSize, tile, dot { x, y } (base pixels), dotOn (blink) }`, else `null`. |

To reach the overworld in a test: wait for `preloadComplete()`, then call `quickStart()` until it returns true
(`page.waitForFunction(() => window.__E2E__.quickStart())`; the title needs a frame to start). To test the
real flow, press Enter on the title and choose from its menu (`tests/e2e/title-intro.spec.ts`). In the name
screen letter keys (Z and X too) type text, so press Enter for OK.

`tests/e2e/neutral-intro.ts`: the boot checks reject an `intro.json` whose coworker or walks do not fit the
`start.json › spawn` map. A test that moves the spawn (intercepting `start.json`) also calls `neutralIntro(page, map)`,
which serves an intro with no walks and the coworker on a free tile of that map (the helpers `startAt` / `patchData`
in several specs do this).
Keys pressed with Playwright are seen on the next game frame: poll for the expected state
(`expect.poll(...)`) instead of reading it right after the key press, and wait for one press to take effect
before the next (two presses in one frame count once). After a warp, also wait for `overworldLocked()` to be false
(see the `standing()` helper in `tests/e2e/warps.spec.ts`).

`tests/e2e/dialogue.spec.ts` adds NPCs by intercepting `data/npcs.json` with `page.route` (so "a new talker needs
no code change" is tested without touching the shipped data). Its wander watch lasts `WANDER_WATCH_MS` ms (default
20000); run it with `WANDER_WATCH_MS=120000 npx playwright test tests/e2e/dialogue.spec.ts --project=desktop -g wandering`
for a 2-minute watch.

**Portrait phones.** On a touch device in portrait the game shows "Gira el móvil" and pauses. The `android`
and `iphone` profiles are portrait, so `playwright.config.ts` starts them with `localStorage['flexymon.e2e.allowPortrait']
= '1'`, an E2E-only switch (`src/main.ts`, ignored in production builds) that turns the guard off so the specs
still drive the game there. `tests/e2e/mobile-minimap.spec.ts` removes it (`addInitScript`) to test the guard, and turns
the phones to landscape (`setViewportSize`) for its touch tests. Touch taps use `page.touchscreen.tap` (real touch
events, Chromium and WebKit); holds, slides and multi-touch dispatch `PointerEvent`s of type `touch` on the controls,
since Playwright's touchscreen can only tap.

`tests/e2e/battle.spec.ts` drives battles with `advance()` (presses A through messages until a menu or the overworld is
back). Loss and forced-switch tests try seeds 1–10 until the case happens, since the opponent's attack is random.

The overworld hooks (`playerTile`, `overworldLocked`, `npcs`, `dialogue`…) also answer while the overworld
is paused under the Shop or Storage scene; `battle().ui` can be `item` / `item_target`.
`tests/e2e/items-shops-storage.spec.ts` serves `start.json` with a spawn inside `test_house` next to the NPC under test.

Every page load that reaches the overworld writes `flexymon.save.v1`, and the next quick start (or Continuar) on the title
continues that game: tests start with an empty `localStorage` (a new browser context per test), so only tests that
reload see a save. `currentScene()` ignores the always-on `Hud` scene. `tests/e2e/menu-save.spec.ts` reloads with
`page.reload()` (the quiet save on `pagehide` keeps the exact tile) and writes garbage with `localStorage.setItem`.

Add new helpers to the `E2EHooks` interface in `src/main.ts` and to this table.

`tests/e2e/enemy-npcs.spec.ts` injects enemy NPCs (`npcs.json`) and boosted stats (`flexymon.json`) with `page.route`,
so NPC battles end the same way every time without seeds: Portátil wins in one blow unless it misses, and the boss's
Ratón always wins. `dialogue.spec.ts`'s wander watch serves the shipped enemies as talkers (an enemy leaves
its rectangle to challenge the player).

`tests/e2e/audio-debug.spec.ts` checks the audio unlock and the interface sounds through `uiSounds()` (it waits
for the expected sounds with `expect.poll`, since a key is handled on a later frame under load), and the debug menu
(`?debug=1`): it serves `items.json` through `page.route`, changes it between two "Recargar datos" and finally serves
broken JSON. The E2E build (`npm run build`) includes the sprite atlas, so every spec runs with it.
