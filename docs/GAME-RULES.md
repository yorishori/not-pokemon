# Game rules

This is the specification of how Flexymon plays. Every rule here is implemented as a pure function in
`src/logic/` (no Phaser) and unit-tested in `tests/logic/` with the worked examples below. Every tunable number
lives in `src/logic/constants.ts`; the names in `CONSTANT_CASE` below refer to it.

If you change a rule, change this file, the code and the test in the same commit.

## Design pillars

These decisions shape the whole game. Changing one is a design change, not a bug fix: discuss it in an issue first.

| Area | Decision |
| --- | --- |
| Genre | A top-down monster-collecting RPG in the style of the Game Boy Color era, set in a cartoon Valencia region. |
| Language | Spanish only. UI strings in `src/i18n/es.json`; content text in `public/data/*.json`; never in code. |
| Creatures | Called *flexymon* (singular and plural). Never use the word "Pokémon" or any Nintendo asset. |
| Goal | The main game has none: free wandering, no story, no final boss, no credits. The *Modo historia* behind the office's mystery door is the fast mode: a linear run of boss fights with no exploration and no growth (see *Story mode*). |
| Stats | HP (*PS*), Ataque, Defensa, Velocidad. No types, no levels, no XP. |
| Attacks | At most 3 per flexymon. Effects: damage, heal, buff, debuff. Each has an accuracy; no critical hits. |
| Starter | Every new game starts with one flexymon (`start.json › starter`, *Portátil*), handed over in the intro. |
| Catching | 100 % on victory against a wild flexymon; the player chooses *Llevármelo* or *Dejarlo*. |
| Growth | Catching a species you already own *merges* it into yours: one random stat grows. |
| Team | Starts at 2 slots; each *Regleta* item adds one, up to 6. Extras go to the storage box at the office. |
| Enemy NPCs | Wander in an area, spot the player in a straight line, walk up, talk, fight. Rematches after you walk away. |
| Losing | Wake up at the office with half your euros and a fully healed team. |
| Murcia | The Murcia map is reached only by the white Audi at the office, which needs certain items. |
| Controls | Desktop: arrows/WASD move, Z = A, X = B, Enter = Start, M = minimap. Mobile: on-screen D-pad, A, B, Start, Mapa; landscape only. No gamepad. |
| Saving | Auto-save to `localStorage` (key `flexymon.save.v1`), one slot. The story realm keeps its own slot (`flexymon.story.v1`). No backend, no accounts. |
| Hosting | A fully static site. |
| Screen | 512 × 288 base pixels (16 × 9 tiles of 32 px), pixel art, scaled to fit. |

## Owned flexymon

Each flexymon the player owns is an *instance*: `{ uid, speciesId, bonus: { hp, attack, defense, speed }, currentHp }`.
`uid` comes from `rng.id()`. A stat's value is `base + bonus`; max HP is `base.hp + bonus.hp`. A flexymon with
`currentHp = 0` is *debilitado* (fainted) and cannot fight until healed or revived. (`src/logic/instance.ts`)

## Battle flow

`src/logic/battle.ts` is a state machine: `createBattle(player, opponent, kind)` returns a state, and
`chooseAction(state, action)` returns `{ state, events[] }`. The Battle scene only animates the events; it never
computes a rule. The event list is documented in `src/logic/README.md`.

1. The opponent appears, then the player's first non-fainted team member is sent out.
2. Each round the player picks one action: **Atacar** (one of up to 3 attacks), **Cambiar** (a non-fainted team
   member that is not active), **Objeto** (an item usable in battle, then its target) or **Huir** (wild battles
   only; it always works).
3. The opponent picks an attack (see *Opponent AI*).
4. Actions resolve in this order: Huir, Cambiar, Objeto, then attacks. If both attack, the higher *effective* speed
   goes first; a tie is decided by `rng.chance(50)`.
5. A flexymon that faints does nothing for the rest of the round.
6. End of round: every active buff/debuff loses 1 turn; at 0 it is removed.
7. The player's active flexymon faints: if another team member is alive the player must pick it (this does not
   cost a turn and cannot be cancelled). If none is alive, the player loses.
8. The opponent faints: wild → victory. NPC → its next flexymon comes in automatically; none left → victory.

Cambiar and Objeto use the player's turn: the opponent still attacks.

## Hit and damage

An attack hits if `rng.int(1, 100) <= accuracy`; otherwise "¡Ha fallado!" and nothing else happens. A damage
attack deals:

```
damage = max(1, floor(power × Atk_eff / Def_eff × DAMAGE_SCALE × r))     r = rng.float(0.85, 1.00)
```

`DAMAGE_SCALE` is 0.3 and `DAMAGE_ROLL` is `[0.85, 1]`. Example: power 40, Atk 12, Def 10, r = 1.0 → floor(14.4)
= 14; with r = 0.85 → floor(12.24) = 12. HP never goes below 0.

A heal attack restores `floor(maxHp × percent / 100)`, never above max HP. (`src/logic/damage.ts`)

## Buffs and debuffs

An effective stat is `stat × (100 + Σ buff percents − Σ debuff percents) / 100`, clamped between `MOD_MIN` (25 %)
and `MOD_MAX` (250 %) of the stat, then floored (minimum 1). Example: Defense 10 with one −25 % debuff → 7.

Using the same attack or item again on the same flexymon replaces its old modifier (turns reset) instead of
stacking. Modifiers are removed when a flexymon switches out or the battle ends. (`src/logic/modifiers.ts`)

## Opponent AI

- **Wild:** picks a random attack (equal chance).
- **Enemy NPC:** if its HP is below `NPC_LOW_HP` (25 %) of max and it has a heal attack, it heals. Otherwise it
  uses the damage attack with the highest `power × accuracy`. With no damage attack, a random one. NPCs never use
  items or switch voluntarily.

(`src/logic/ai.ts`)

## Catching and merging

After beating a wild flexymon the battle screen asks "¿Te llevas a {name}?" with *Llevármelo* / *Dejarlo* (B =
Dejarlo). `canCatch()` always returns true; it is the hook for a future catch item (the item effect `catch` is
reserved for it).

If taken and the player does **not** own that species, a new instance (zero bonus, full HP) joins the team if
there is a free slot, otherwise the storage box (a message says so).

If the player **does** own it, it merges into the first owned instance (team first, then storage):

1. Collect the stats whose `bonus` is below `base` (value below `MERGE_CAP` × base = 2 × base).
2. If none: "{name} ya está al máximo", stop.
3. Pick one with `rng.pick` and add `max(1, round(base × MERGE_PERCENT / 100))`, never past `bonus = base`.
4. If the stat is HP, `currentHp` rises by the same amount (this can revive a fainted instance).
5. Show "¡{name} se ha fusionado! {stat} +{n}".

Example: base attack 12 → +1 per merge (round(1.2) = 1); at most 24 after 12 merges. (`src/logic/merge.ts`)

## Team and storage

The team size starts at `start.json › teamSlots` and each *Regleta* (item effect `team_slot`) adds one, up to
`TEAM_MAX` (6); the item is refused at 6. The team can never be empty: the last member cannot be moved to storage.
Storage has no limit and is opened by the `storage` NPC at the office. A moved flexymon goes to the end of the other
column; fainted ones can be moved. The first team member is the first sent into battle (reorder it in Start ›
Equipo › Mover). (`src/logic/team.ts`, `src/logic/storage-box.ts`)

## Wild encounters

Checked once each time the player *finishes* a step (not on warps). An encounter is possible if the tile is inside
an encounter rectangle of the current map (the first rectangle containing it wins) and either the rectangle's mode
is `all` (urban crowds) or the tile has the Tiled property `encounter = true` (tall grass, dune grass, vineyard).
Then `rng.chance(rate)`; on success a species is picked by weight from the zone's encounter group. After any battle
or map change there are `SAFE_STEPS` (3) completed steps with no rolls. If the same step also puts the player in an
enemy NPC's sight, the enemy wins and no encounter is rolled. (`src/logic/encounter.ts`)

## Enemy NPCs

States: `ready` and `cooldown` (an NPC never beaten is `ready`). A `ready` enemy *sees* the player if the player
stands in a straight line in front of it, at most `sight` tiles away, with no blocking tile or NPC in between. The
check runs after every completed player step and every NPC step while the player stands still; not on map entry
and not when the player only turns.

When spotted: player input locks, a "!" bubble shows for `NPC_ALERT_MS` (600 ms), the NPC walks until adjacent,
both face each other, it says its `dialogue`, and the battle starts against a fresh copy of its `team` (in order).
While walking, NPCs never trigger other NPCs. Facing a `ready` enemy and pressing A starts the same sequence
(without the walk).

After the player wins: euros `+= rng.int(reward.min, reward.max)` ("¡Has ganado {n} €!"), the NPC says its
`defeatDialogue` and becomes `cooldown`. A `cooldown` NPC only says `defeatDialogue`. It returns to `ready` when the
player is more than `NPC_COOLDOWN_DISTANCE` tiles away (Manhattan: |dx| + |dy| > 6) or on another map. After the
battle an enemy that walked out of its wander rectangle steps back towards it. (`src/logic/npc-state.ts`,
`src/logic/enemy-npc.ts`)

## Losing

When every team member has fainted (wild or NPC battle): fade to black, `euros = floor(euros / 2)`, every team and
storage flexymon fully healed, every enemy NPC set to `ready`, the player placed at `start.json › respawn`, and the
message "Te has despertado en la oficina...".

## Healing

Free at the office healer NPC (team and storage, then an auto-save). Elsewhere only with items, sold in shops and
bars. There is deliberately no healer on the Murcia side.

## Items

Effects (`items.json › effect.type`):

| Effect | Where | What it does |
| --- | --- | --- |
| `heal` | battle / field | `+amount` HP to a non-fainted member that is not at full HP. |
| `heal_full` | battle / field | Full HP to a non-fainted member that is not at full HP. |
| `revive` | battle / field | A fainted member back to `percent` % of max HP. |
| `buff` | battle | A modifier on the active flexymon, like a buff attack. Refused in the field. |
| `team_slot` | field | +1 team slot, consumed; refused at 6. |
| `key` | — | Never used, consumed or sold; only checked (e.g. by the Audi). |
| `catch` | — | Reserved for a future catch item; does nothing yet. |

Using an item in battle costs the turn. An item that would do nothing (heal at full HP…) is refused and costs
nothing. Bag counts are 0–`ITEM_COUNT_MAX` (99); gains above that are capped. (`src/logic/field-items.ts`,
`src/logic/inventory.ts`)

## Euros and shops

Euros are whole numbers from 0 to `EUROS_MAX` (999 999). Buying checks money first and is also limited by bag room.
Selling pays `floor(price / 2)` (the story realm's shop pays the full price, see *Story mode*). Key items and items with `price: null` cannot be sold; `price: null` items cannot
be bought either. (`src/logic/economy.ts`, `src/logic/shop.ts`)

## The Audi

The office car opens if the bag holds **both** items of **any** pair in `car.json › unlockPairs` (count ≥ 1; items
are never consumed); otherwise it says `lockedDialogue`. Both cars ask "¿Subir al Audi?" (Sí / No, B = No). The trip
scene lasts `CAR_TRIP_MS` (5 s); after `CAR_SKIP_AFTER_MS` (1 s) any button skips it. The car in Murcia needs
nothing. (`src/logic/car.ts`)

## New game, intro and secret names

A new game is built from `start.json` (starter alone at full HP, euros, slots, items, spawn) and the intro script in
`intro.json`. The player name is 1–`NAME_MAX_LENGTH` (10) letters and single spaces. If the name matches an entry in
`secret-names.json` — ignoring case, accents and surrounding spaces ("  PÁCO " matches "paco"; ñ is kept) — its
items are added and its message shown right after the handover. (`src/logic/intro.ts`, `src/logic/name-entry.ts`)

## Saving

Auto-save to `localStorage` key `flexymon.save.v1` after every map change, battle, shop visit, healer visit, Start
menu close and trip through the mystery door (a "Guardando…" icon shows for 600 ms), plus a quiet save when the page is hidden or closed. Format:

```json
{ "version": 1, "savedAt": "2026-11-04T21:00:00Z",
  "player": { "name": "Rogelio", "map": "valencia", "x": 40, "y": 22, "facing": "down" },
  "euros": 340, "teamSlots": 2,
  "team": [ { "uid": "a1", "speciesId": "portatil", "bonus": { "hp": 4, "attack": 0, "defense": 1, "speed": 0 }, "currentHp": 31 } ],
  "storage": [], "items": { "cafe": 2 }, "npcs": { "becario_rio": "cooldown" } }
```

Loading never crashes. If the JSON cannot be read or fails its schema, it is copied to `flexymon.save.broken` and the
title offers only *Nueva partida*. A save that no longer fits the content is repaired with a warning: unknown
flexymon, items and NPCs are dropped; bonus and HP are clamped; an unknown map sends the player to the respawn point;
extra team members go to storage; an empty team takes the first stored flexymon; no flexymon at all = broken save.
If you change the format, bump `SAVE_VERSION` and add a migration in `src/logic/save.ts`.

Player options (music and effects volume 0–10, text speed lenta / normal / rápida = 15 / 30 / 60 characters per
second) live separately in `localStorage` key `flexymon.options`.

## Story mode

A fast mode without exploration or growth, in its own realm. The rules are pure functions in `src/logic/story.ts`;
the content is `story.json` ([CONTENT.md](CONTENT.md) › The story realm).

- **Entry.** A mystery door in the office's back wall (an `action` warp with `portal = true`): A facing it shows
  `story.json › door`, then "¿Cruzar la puerta?" (Sí / No, B = No). Sí saves the main game (the player stays in front
  of the door) and opens the realm. The new-game intro mentions the door. Reloading the page in the realm comes back
  to the main game in front of the door; the story goes on from where it was the next time through.
- **Separate realms.** The story has its own team, bag, budget and save slot (`flexymon.story.v1`). Nothing moves
  between the realms; only the player's name is shared. The main game's healer, storage, shops, Start menu and
  minimap are not used in the realm.
- **Setup.** The first visit shows `story.json › welcome` (the explanation), then the team choice, then the shop:
  - **Team:** exactly `teamSize` (4) *different* species, any of `flexymon.json`, fresh (base stats, no bonus). The
    pick order is the battle order. The team can be changed at the office at any time.
  - **Shop:** the items in `story.json › shop` (priced battle items), bought with the `budget` (1500 €). No limit on
    how many, other than the budget and the bag's 99 per item. **Selling gives back the full price**, so euros plus
    the bag's value always equal the budget. Buy and sell at the office at any time.
- **The map.** A board of stops joined by a fixed path: stop 0 is the office, then one stop per boss (7) at a
  Valencia landmark. The player only walks from a stop to the previous or the next one, by pressing the direction of
  the path's first step that way, and walks the whole leg automatically. The next stop opens only once every boss
  before it is beaten: the furthest reachable stop is `beaten + 1`. Trying to go further says "Primero tienes que
  vencer a {name}.".
- **Bosses.** Only the next boss to fight stands at its landmark; the ones further on are not there yet (a
  surprise). Beaten bosses stay, with a flag on their stop. A on the waiting boss: its `dialogue`, then a battle (the
  normal battle rules, kind `npc`: no fleeing, no catching, no reward) against its team, each member with its
  optional stat `bonus` and full HP. A on a beaten boss: its `defeatDialogue` and "¿Revancha?" (Sí / No).
- **After every story battle** (won or lost) the team is fully healed and the bag is the bought items again: a
  battle uses a copy of the bag, so used items come back.
  - **Win** against the waiting boss: it counts as beaten, it says its `defeatDialogue`, and the next boss appears.
    After the last boss `story.json › victory` shows; the map stays open and every boss can be fought again.
  - **Loss:** "Tu equipo se ha recuperado. ¡Inténtalo otra vez!", on the same stop; nothing else is lost (the main
    game's Losing rule does not apply).
- **The office menu** (A at stop 0): *Cambiar equipo*, *Tienda*, *Volver al juego* (back to the main game in front of
  the door), *Reiniciar historia* (Sí / No: new team, budget refunded, no boss beaten; welcome not shown again) and
  *Salir*.
- **Saving.** The story slot is written after the team choice, every shop visit, every battle and every arrival at a
  stop. A slot that no longer fits the content is fixed on load: an invalid team is dropped (pick again), items the
  shop no longer sells are dropped, and if euros plus the bag's value no longer equal the budget everything is
  refunded; beaten bosses and the stop are clamped to the bosses there are. A slot that cannot be read is copied to
  `flexymon.story.broken` and the story starts fresh.

## Accessibility

Every blinking or flashing effect stays under `MAX_FLASHES_PER_SECOND` (3); `tests/logic/accessibility.test.ts`
checks every blink constant. No information is shown by colour alone (disabled menu options are greyed *and*
struck through). Text speed is an option.
