# data — the game's content

Every creature, attack, item, NPC, zone, shop and the new-game setup, as JSON. **How to add or change content:
[docs/CONTENT.md](../../docs/CONTENT.md).** Rules behind the numbers: [docs/GAME-RULES.md](../../docs/GAME-RULES.md).

| File | Holds |
| --- | --- |
| `flexymon.json` | Every species: name, sprites, cry, base stats, attacks. |
| `attacks.json` | Every attack: name, sound, accuracy, target, effect. |
| `items.json` | Every item: name, description, sprite, price, where usable, effect. |
| `npcs.json` | Every NPC: type, sprite, voice, map, spawn, wander area, dialogue; team and reward for enemies; shop for shopkeepers. |
| `zones.json` | Every map: file, name, region, music, indoor, wild encounter groups. |
| `shops.json` | Shop id → item ids sold. |
| `start.json` | New game: starter, euros, team slots, items, spawn, respawn after losing. |
| `secret-names.json` | Player names that grant bonus items. |
| `car.json` | The Audi: unlock item pairs, locked dialogue, trip sprite and sound, arrival points. |
| `intro.json` | Title image, handover jingle, the intro coworker and the intro script. |
| `sounds.json` | Interface sounds (cursor, confirm, cancel, error, money) and the battle music (`battleMusic`). |
| `story.json` | The story realm (Modo historia): its board map and music, budget, team size, shop, door / welcome / victory lines, the office stop and the bosses (landmark, stop, path, where they stand, speeches, team with bonuses). |

Validated at boot by the zod schemas in `src/data/schemas/` (one per file), then by cross-reference checks
(`src/data/cross-refs.ts`) and map checks (`src/data/map-checks.ts`). Any error stops the game on a red screen as
`file › JSON path › message`. Validation rules in short:

- Every object is strict: unknown keys are errors (catches typos).
- Ids are `snake_case` and unique inside each file; every referenced id must exist.
- Visible texts and dialogue lines must not be empty; dialogue lists need at least one line.
- Image paths match `assets/….png`; sound paths match `assets/….ogg` (or `.mp3`) and both an `.ogg` and an `.mp3`
  with the same name are loaded; zone `file` matches `maps/….tmj`.
- `flexymon.json`: stats whole 1–999, 1–3 attacks.
- `attacks.json`: accuracy 1–100; damage power 1–200; heal percent 1–100; buff/debuff stat
  attack|defense|speed, percent 1–100, turns 1–9; heal/buff target `self`, damage/debuff target `enemy`.
- `items.json`: `price` whole 0–999 999 or `null`; `usableIn` ⊂ {battle, field}, no duplicates; effects heal
  (`amount` 1–999), heal_full, revive (`percent` 1–100), buff, team_slot, key, catch. Shops may only list items with
  a price.
- `npcs.json`: per-type fields (enemy: `sight` 1–16, `team` 1–6, `reward {min ≤ max}`, `defeatDialogue`;
  shopkeeper: `shop`); `wander.stepEveryMs` is `[min, max]` with min ≤ max; spawn inside the wander rectangle and
  walkable.
- `zones.json`: `encounters` is required (`{}` for none); rate 1–100; weights whole ≥ 1; every group must be used by
  an encounter rectangle on the map (else a warning).
- `start.json`: euros 0–999 999, `teamSlots` 1–6, item counts 1–99, spawn/respawn `{ map, x, y, facing }` walkable.
- `secret-names.json`: names may not collide after normalising (case, accents, spaces; ñ is kept).
- `car.json`: at least one pair of two item ids; arrival points walkable.
- `intro.json`: exactly one `handover` step; the coworker's tile and every walked tile walkable; no walk enters the
  other actor's tile.
- `sounds.json`: all five interface sounds and `battleMusic` required.
- `story.json`: `map` is a zone; budget 0–999 999; `teamSize` 1–6 and at most the number of species; `shop` lists
  priced battle items, no repeats; `office.path` is empty; at least one boss, ids unique, team 1–6 known species, each
  `bonus` stat 0–999; every stop walkable, every leg of `path` a straight line over walkable tiles, every `stand`
  inside the map.

`public/test-world/data/` is a frozen copy of an early, small content set used by the tests. Do not add real content
there (see `docs/TESTING.md`).
