# src/logic — pure game rules

NO Phaser imports (enforced by ESLint). Plain data in, plain data out; nothing is mutated (functions return new
objects). Randomness only through an `Rng` passed in (`src/core/rng.ts`), so tests fix every roll. Logging is the
caller's job (e.g. `parseSave` returns `warnings[]`). Tunable numbers: `constants.ts`. Tests: `tests/logic/`
(one file per module; `tests/logic/helpers.ts` has the shipped content as `GameData` and `scriptedRng()`, a fake
`Rng` that returns queued values so a test proves the exact RNG call order).

| Module | Rules (docs/GAME-RULES.md) |
| --- | --- |
| `constants.ts` | Every tunable rule number and timing (`DAMAGE_SCALE`, `TEAM_MAX`, `NPC_COOLDOWN_DISTANCE`, `WALK_MS`, `TEXT_SPEED_CPS`…), each with a doc comment. |
| `instance.ts` | Owned flexymon `{ uid, speciesId, bonus, currentHp }`: create, stat value, max HP, heal, full heal, revive, damage, fainted. |
| `modifiers.ts` | Buff/debuff list per active flexymon: effective stat (clamp 25–250 %, floor, min 1), same source replaces, tick per round. |
| `damage.ts` | Hit roll, damage roll and formula, heal-attack amount. |
| `ai.ts` | Opponent attack choice (wild random; NPC heal below 25 % / best `power × accuracy`). |
| `battle.ts` | The battle state machine: `createBattle`, `introEvents`, `chooseAction` → `{ state, events[] }`, plus `actionError`, `availableSwitches`, `battleItems` for the menus. Event list and RNG order are documented in the file. |
| `team.ts` | `Party { team, storage, teamSlots }`: add (team or storage), move to/from storage (last member stays), reorder, add slot (max 6), find owned, full heal. |
| `merge.ts` | `canCatch()` hook, `takeFlexymon()` (add new or merge: random open stat +`max(1, round(base × 10 %))`, cap 2× base). |
| `inventory.ts` | Bag `{ itemId: count }` 0–99: count, add (capped), remove. |
| `economy.ts` | Euro clamp, NPC reward roll, loss penalty, buy (money checked first), sell (`floor(price / 2)` by default, or any price function such as `refundPrice`, the story shop's full price; no keys / `price: null`). |
| `encounter.ts` | Encounter rectangles (`tiles` / `all`), rate roll + weighted pick, safe steps (`checkStep`). Used by the overworld . |
| `npc-state.ts` | `ready` / `cooldown`, sight line with blockers, approach path, cooldown end (Manhattan > 6 or other map), reset all. |
| `save.ts` | `GameState`, zod `saveSchema`, `serializeSave`, `parseSave` (validate + migrate; never throws). |
| `names.ts` | Name normalisation for secret names. |
| `name-entry.ts` | Name entry: `typeChar` (letters and spaces only, max `NAME_MAX_LENGTH` 10, no leading / double space), `deleteChar`, `canConfirm` (needs a letter), `finalName` (trimmed), `nameGrid(letters)` (letter cells, space, Borrar, OK). |
| `intro.ts` | New-game intro: `fillIntroText` (`{name}`, `{starter}`), `findSecretName` (case / accent / space-insensitive, via `normalizeName`), `applySecretName` (items into the bag, capped per item), `traceIntro` (every tile both actors walk on, for the boot checks). |
| `dialogue.ts` | Dialogue box rules: word wrap, strings → pages (a string too long for one box continues on the next), typing at `TEXT_CPS` (`typeTick(…, cps)` takes the text speed option's rate), voice every `VOICE_EVERY_CHARS` characters (1st, 4th, 7th…), A = reveal / next. |
| `npc-wander.ts` | NPC movement: random wait in `stepEveryMs`, one random tile inside the wander rectangle, never onto a blocked tile; both tiles count as taken during a step; talking pauses the NPC and turns it to the player. `engage` / `forceStep` / `faceTo` walk an enemy up to the player; outside its rectangle an NPC only steps towards it (`distanceToArea`). RNG order documented in the file. |
| `new-game.ts` | New-game state from `start.json`: starter alone at full HP, euros, slots, items, spawn, no NPC states. |
| `battle-view.ts` | Battle presentation rules: `viewSteps(events, ctx)` → message / sound / show / hit / hp / faint / withdraw / need_switch / end steps (HP only from the events), opponent names "{name} salvaje" / "{name} rival", `mainMenu` / `attackMenu` / `teamMenu` (enabled via `actionError`), `hpColor`; `catchMessages(outcome, name, t)` words a catch: joins the team / sent to storage / merged "{stat} +{n}" / already at the maximum; `itemMenu` (battle items "x{n}", greyed with no valid target), `itemTargetMenu`, `itemNeedsTarget`. |
| `talk.ts` | What an NPC says by type: dialogue; enemy = dialogue while `ready`, only `defeatDialogue` in `cooldown`; Healer = "Tus flexymon están como nuevos." then dialogue; `talkAction` says what happens around the talk (`heal` before, `storage` / `shop` after). |
| `field-items.ts` | Items outside battle: `useFieldItem(state, data, itemId, targetUid?)` (heal / heal_full / revive on a team member, Regleta +1 slot up to 6, one consumed per use; buff / key / catch refused), `fieldItemError`, `fieldItemNeedsTarget`. Used by the Mochila. |
| `shop.ts` | Shop screen rules: `shopStock`, `buyRows` (price, limit by money / bag room / 99), `stockRows` (the same rows for any list of items, e.g. the story shop), `sellRows` (bag order, half price or a given price function, key and `price: null` items listed but unsellable), `rowError`, `stepQuantity` (1 … limit, no wrap), `totalPrice`. |
| `storage-box.ts` | Storage box rules: `boxRows`, `boxMove` (via `team.ts`: last member stays, slot limit), `otherColumn`, `clampCursor`, `scrollTop` (scrolling window). |
| `options.ts` | Player options: `Options { music, sfx (0–VOLUME_STEPS), textSpeed (slow / normal / fast) }`, `defaultOptions` (full volumes, normal), `parseOptions` (never throws; each bad field falls back alone, with a warning), `serializeOptions`, `stepOption` (Left / Right one step, no wrap), `textCps`, `volumeGain`. |
| `menu.ts` | Start menu rules: `START_MENU` (Equipo, Mochila, Mapa, Opciones, Cerrar), `teamRows`, `flexymonDetail` (stats as `base + bonus`, attacks with accuracy), `bagRows` (count > 0, bag order; `usable` = `fieldUsable`: `"field"` and a heal / heal_full / revive / team_slot effect), `bagTargetRows` (greyed when the item does nothing), `fieldUseMessages`, `fieldErrorMessage`. |
| `minimap.ts` | Minimap rules: `minimapPath(zone)` (`assets/ui/minimap_<zone>.png`), `minimapLayout` (keep the image size or shrink it uniformly to fit, never enlarge), `minimapDot` (centre of the player's tile, by map tiles so real art of any size works), `minimapCells` (solid / encounter / open per tile, used by the placeholder tool). |
| `story.ts` | The story realm (Modo historia): `StoryState` (stage, team, loadout, euros, beaten, at), `newStoryState`, `restartStory`, `finishWelcome`, `pickTeam` (exactly `teamSize` different species, fresh; `togglePick` for the picker), `finishShop`, `storyBuy` / `storySell` (full-price buy-back, `loadoutValue`), `storyStops`, `maxReachable` / `stepTarget` (only up to the next unbeaten boss), `bossStatus` (`beaten` / `ready` / `hidden`), `bossAt`, `legTiles` / `walkTiles` (the straight legs between stops), `bossTeam` (bonus + full HP), `afterStoryBattle` (heal, count a first win), `storyFinished`, and the save format (`serializeStory`, `parseStory` with its fixes). |
| `car.ts` | The Audi: `ownsUnlockPair` (both items of any `car.json › unlockPairs` pair, count ≥ 1), `carUnlocked` (the trip to `murcia` needs a pair, the way back to `valencia` nothing), `carArrival` (`toMurcia` / `toValencia`), `canSkipTrip` (after `CAR_SKIP_AFTER_MS`), `tripOver` (`CAR_TRIP_MS`). Items are only checked, never consumed. |
| `accessibility.ts` | Flash limits: `blinkRate(halfPeriodMs)`, `burstRate(count, durationMs)` (most flashes in any second), `flashRateOk` (under `MAX_FLASHES_PER_SECOND`, 3). `tests/logic/accessibility.test.ts` checks every blink and flash constant (title, dialogue arrow, minimap dot, battle transition `BATTLE_FLASHES`, hit dim). |
| `debug-tools.ts` | Debug menu state changes: `giveEuros` (+`DEBUG_GIVE_EUROS`, clamped), `giveItem` (+`DEBUG_GIVE_ITEMS` of any item, capped at 99). |
| `enemy-npc.ts` | Enemy NPC battles: `findSpotter` (first free `ready` enemy that sees the player + its approach path), `npcTeam` (fresh instances of its team), `winAgainstNpc` (reward `rng.int(min, max)` + `cooldown`), `loseBattle` (Losing rule: half the euros, heal team and storage, every NPC `ready`, respawn), `placedEnemies` / `refreshCooldowns` (cooldown ends > 6 tiles away or on another map). |

## Battle events (`battle.ts`)

`who` is the attacker for `attack` / `miss`, otherwise the side whose flexymon is affected. `damage.amount` is
the HP actually lost (overkill is not reported).

| Event | Fields |
| --- | --- |
| `appear` | `who, uid, speciesId` (from `introEvents`) |
| `attack` / `miss` | `who, uid` (+ `attackId`) |
| `damage` / `heal` | `who, uid, amount, hp, maxHp` |
| `revive` | `who, uid, hp, maxHp` |
| `modifier` / `modifier_end` | `who, uid, kind, stat` (+ `percent, turns`) |
| `faint` | `who, uid` |
| `switch` | `who, fromUid, toUid` (player choice, or an NPC's next flexymon) |
| `item` | `itemId, targetUid` |
| `flee`, `need_switch`, `end` | `end.result`: `win` / `lose` / `fled` |
