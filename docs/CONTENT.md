# Content guide

How to add or change game content: flexymon, attacks, items, NPCs and their dialogue, enemy trainers, wild
encounters, shops, the new game, secret names, the Audi, the intro, the story realm, sounds and UI text.

**Content is data.** Adding content means editing JSON (and maps, see [MAPS.md](MAPS.md)); no TypeScript change is
needed. Never hard-code content in `.ts` files.

## The workflow

1. Edit the JSON in `public/data/`.
2. Create any new image or sound the JSON names:
   - `npm run art` draws styled art for every new sprite path (see [ART.md](ART.md));
   - `npm run placeholders` makes beeps for new sounds and any other missing file.

   Both never overwrite existing files, so they are always safe to run.
3. `npm run dev` and open the printed URL. If something is wrong, the game stops on a **red error screen** listing
   `file › JSON path › message`, for example `npcs.json › [3].team[0] › unknown flexymon "teclado"`. Fix it and
   reload.
4. Try it in the game. The debug menu (below) teleports you anywhere, starts any battle and gives items.
5. Run the checks before opening a pull request (`CONTRIBUTING.md`).

**Live reload of data:** with the dev server running, press **F2** twice to open the debug menu and choose
*Recargar datos*: every JSON and map is reloaded and validated without reloading the page (on an error the old data
is kept and the errors are shown). A replaced image or sound under the same path still needs a page reload.

**Finding a tile's coordinates:** stand on it and press **F2** (`Casilla: x, y`), or hover it in Tiled and read the
status bar. Both use the same numbers: x from the left, y from the top, starting at 0.

## Where things live

| What | Where | Validated by |
| --- | --- | --- |
| Flexymon species | `public/data/flexymon.json` | `src/data/schemas/flexymon.ts` |
| Attacks | `public/data/attacks.json` | `src/data/schemas/attacks.ts` |
| Items | `public/data/items.json` | `src/data/schemas/items.ts` |
| NPCs (talkers, enemies, shopkeepers, healer, storage) | `public/data/npcs.json` | `src/data/schemas/npcs.ts` |
| Zones: map file, name, region, music, wild encounters | `public/data/zones.json` | `src/data/schemas/zones.ts` |
| Shop stock | `public/data/shops.json` | `src/data/schemas/shops.ts` |
| New-game state | `public/data/start.json` | `src/data/schemas/start.ts` |
| Secret names | `public/data/secret-names.json` | `src/data/schemas/secret-names.ts` |
| The Audi | `public/data/car.json` | `src/data/schemas/car.ts` |
| Title image and intro script | `public/data/intro.json` | `src/data/schemas/intro.ts` |
| Interface sounds, battle music | `public/data/sounds.json` | `src/data/schemas/sounds.ts` |
| The story realm (Modo historia): budget, shop, bosses | `public/data/story.json` | `src/data/schemas/story.ts` |
| Maps | `public/maps/<zone>.tmj` (built from `tools/world/`) | `src/data/tiled.ts`, `src/data/map-checks.ts` |
| UI strings (menus, battle messages) | `src/i18n/es.json` | missing keys show `⟦key⟧` |
| Tunable rule numbers | `src/logic/constants.ts` | unit tests |

All asset paths in the JSON are relative to `public/`. All visible content text is Spanish, written directly in the
JSON (content text is not duplicated in `es.json`).

### Rules every file follows

- Every object is **strict**: an unknown or misspelled field is an error (this catches typos).
- Ids are `snake_case` and unique within their file.
- Visible texts and dialogue lines must not be empty; dialogue lists need at least one line.
- Image paths match `assets/….png`. Sound paths match `assets/….ogg` (or `.mp3`); both `<name>.ogg` and
  `<name>.mp3` are loaded, so ship both.
- Every id you reference must exist (attacks in flexymon, flexymon in teams and encounters, items in shops, maps in
  NPCs…). These cross-references are checked at boot (`src/data/cross-refs.ts`).
- Every map point (NPC spawn, start, respawn, car arrival, warp target, intro walk) must be a walkable tile
  (`src/data/map-checks.ts`).

## Add a flexymon

1. **Attacks first.** Reuse existing ids from `attacks.json` or add new ones (see *Add an attack*).
2. **Add the species** to `flexymon.json`:

   ```json
   {
     "id": "impresora",
     "name": "Impresora",
     "sprite": {
       "front": "assets/sprites/flexymon/impresora_front.png",
       "back": "assets/sprites/flexymon/impresora_back.png",
       "icon": "assets/sprites/flexymon/impresora_icon.png"
     },
     "cry": "assets/audio/sfx/cry_impresora.ogg",
     "stats": { "hp": 36, "attack": 11, "defense": 9, "speed": 10 },
     "attacks": ["atasco_papel", "toner"]
   }
   ```

   - `id`: new, `snake_case`. `name`: what the player sees.
   - `stats`: whole numbers 1–999. Balance guide: the four stats add up to **60–100** for species met on the
     Valencia side and **100–140** for the Murcia side (`tests/data/world.test.ts` enforces this).
   - `attacks`: 1–3 attack ids.
3. **Art and sound.** Run `npm run art` and `npm run placeholders`. A new id gets a generic round creature in its own
   colour and a beep for its cry. For a real look, either drop PNGs at those paths (front / back 64 × 64, icon
   16 × 16) or add a drawing for the id to `SPECIES` in `tools/art/flexymon.ts` and run `npm run art -- --force`
   (see [ART.md](ART.md)).
4. **Make it appear**, otherwise nobody can get it:
   - in the wild: add `{ "id": "impresora", "weight": 30 }` to an encounter group in `zones.json`
     (see *Wild encounters*);
   - and/or in an enemy NPC's `team`.

   The world test requires every species except the starter to be met in the wild somewhere.

## Add an attack

```json
{
  "id": "atasco_papel",
  "name": "Atasco de papel",
  "sound": "assets/audio/sfx/atasco_papel.ogg",
  "accuracy": 90,
  "target": "enemy",
  "effect": { "type": "damage", "power": 45 }
}
```

| `effect.type` | Fields | `target` |
| --- | --- | --- |
| `damage` | `power` 1–200 | `enemy` |
| `heal` | `percent` of max HP, 1–100 | `self` |
| `buff` | `stat` (`attack` / `defense` / `speed`), `percent` 1–100, `turns` 1–9 | `self` |
| `debuff` | same as `buff` | `enemy` |

`accuracy` is 1–100 (percent chance to hit). How these numbers turn into damage: [GAME-RULES.md](GAME-RULES.md) ›
Hit and damage. Every attack must be known by at least one species (world test). Run `npm run placeholders` for
its sound.

## Add an item

```json
{
  "id": "cafe",
  "name": "Café",
  "description": "Recupera 20 PS.",
  "sprite": "assets/sprites/items/cafe.png",
  "price": 50,
  "usableIn": ["battle", "field"],
  "effect": { "type": "heal", "amount": 20 }
}
```

- `price`: whole euros 0–999 999, or `null` = cannot be bought or sold. Selling pays half, rounded down.
- `usableIn`: any of `"battle"` (Objeto in battle) and `"field"` (Start › Mochila).
- `effect`: `heal` (`amount` 1–999 HP), `heal_full`, `revive` (`percent` 1–100 of max HP), `buff` (`stat`,
  `percent`, `turns`, on the active flexymon), `team_slot` (+1 team slot), `key` (never consumed or sold; only
  checked, e.g. by the Audi), `catch` (reserved, does nothing yet). Details: [GAME-RULES.md](GAME-RULES.md) › Items.
- `sprite`: 16 × 16 PNG. `npm run art` draws a generic parcel for unknown ids; add a drawing to `ITEMS` in
  `tools/art/sprites.ts` for a real one.

Then give the player a way to get it: list it in a shop (`shops.json`, only items with a price), put it in
`start.json › items`, or reward it through a secret name.

## Add an NPC

Every NPC is one entry in `npcs.json`. Common fields:

```json
{
  "id": "camarero_bar_centro",
  "type": "shopkeeper",
  "name": "Camarero",
  "sprite": "assets/sprites/npcs/camarero.png",
  "voice": "assets/audio/sfx/voice_low.ogg",
  "map": "bar_centro",
  "spawn": { "x": 7, "y": 3 },
  "facing": "down",
  "wander": null,
  "dialogue": ["¿Lo de siempre?"],
  "shop": "bar_centro"
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique `snake_case` id. Enemy states in the save are stored under it, so don't rename shipped NPCs lightly. |
| `type` | `talker`, `enemy`, `shopkeeper`, `healer` or `storage` (below). |
| `name` | Shown above its lines. |
| `sprite` | A 64 × 128 walk sheet (2 columns stand / stride × 4 rows down / left / right / up, 32 × 32 frames) so it shows its facing and steps; any other size (e.g. 32 × 32) is drawn as one still image. |
| `voice` | A short sound played every 3 characters while it speaks (`voice_low` and `voice_high` exist). |
| `map` | Zone id (`zones.json`). |
| `spawn` | Tile `{ x, y }` where it starts. Must be walkable. |
| `facing` | `up` / `down` / `left` / `right`. |
| `wander` | `null` to stand still, or `{ "x", "y", "width", "height", "stepEveryMs": [min, max] }`: a rectangle in tiles that must contain the spawn. Every random `min`–`max` ms it steps one tile inside it, never onto a solid tile, another NPC, the player or a warp. |
| `dialogue` | List of strings, one text box each. Long strings wrap and continue on more boxes; no text is ever cut. |

### NPC types

| `type` | Extra fields | Behaviour |
| --- | --- | --- |
| `talker` | — | Says `dialogue`. |
| `enemy` | `sight`, `team`, `reward`, `defeatDialogue` | A trainer who fights. See *Add an enemy trainer*. |
| `shopkeeper` | `shop` (a key of `shops.json`) | Says `dialogue`, then opens that shop. |
| `healer` | — | Heals the team and the storage box, says "Tus flexymon están como nuevos." then `dialogue`, and auto-saves. |
| `storage` | — | Says `dialogue`, then opens the storage box. |

### Give the NPC its own look

Run `npm run art`: a new sprite path gets a walk sheet with clothes picked from its file name. For a chosen look,
add the file name (without `.png`) to `NPC_LOOKS` in `tools/art/characters.ts` (skin, hair style and colour, shirt,
trousers, optional hat, apron front or tie) and run `npm run art -- --force`. Or drop a hand-drawn 64 × 128 sheet at
the path. Several NPCs may share one sprite.

## Change NPC dialogue

Edit the strings in `npcs.json`:

- `dialogue`: what it says when you talk to it (and, for enemies, before the battle).
- `defeatDialogue` (enemies only): after you win, and whenever you talk to it while it is in cooldown.
- Each string is one text box. Keep them short (about two lines of 40 characters); a longer one simply continues on
  the next box.
- Plain Spanish text, any characters. There are no variables in NPC dialogue (`{name}` and `{starter}` only work in
  `intro.json`).
- Text speed is a player option; you don't control it per line.

Shop, healer and storage reactions ("Tus flexymon están como nuevos.", shop menus…) are UI strings in
`src/i18n/es.json`, not NPC dialogue.

## Add an enemy trainer

An enemy is an NPC with `"type": "enemy"` and four more fields:

```json
{
  "id": "becario_alboraya",
  "type": "enemy",
  "name": "Becario",
  "sprite": "assets/sprites/npcs/becario.png",
  "voice": "assets/audio/sfx/voice_high.ogg",
  "map": "alboraya",
  "spawn": { "x": 12, "y": 17 },
  "facing": "left",
  "wander": { "x": 11, "y": 16, "width": 3, "height": 4, "stepEveryMs": [1200, 3000] },
  "dialogue": ["¡Eh! ¿Tú también eres nuevo?", "¡Vamos a ver quién despliega antes!"],
  "sight": 4,
  "defeatDialogue": ["Vale, vale... me vuelvo a mi tarea de Jira."],
  "team": ["raton", "teclado"],
  "reward": { "min": 60, "max": 100 }
}
```

- `sight`: how many tiles it sees in a straight line in front of it (1–16; the game uses 4). Walls and other NPCs
  block it. A wandering enemy looks wherever it last stepped.
- `team`: 1–6 flexymon ids, sent out in order. Each battle uses fresh, full-HP copies with no bonus.
- `reward`: euros paid on a win, a random whole number between `min` and `max` (min ≤ max).
- `defeatDialogue`: said after you win, and while it is in cooldown.

After a defeat it won't fight again until you walk more than 6 tiles away or leave the map; losing any battle makes
every enemy fightable again. Full rules: [GAME-RULES.md](GAME-RULES.md) › Enemy NPCs.

Balance: rewards and teams grow with distance from the start, from about 60–100 € with two weak flexymon in
Alboraya to 250–420 € with Murcia-side species. Place enemies where the player can walk up to them: the world test
checks that every NPC has a reachable neighbouring tile.

## Wild encounters

Wild flexymon are configured per zone in `zones.json › encounters`, a map of *group name* → group:

```json
{
  "id": "valencia",
  "name": "Valencia",
  "file": "maps/valencia.tmj",
  "region": "valencia",
  "music": "assets/audio/music/valencia.ogg",
  "indoor": false,
  "encounters": {
    "jardin_turia": { "rate": 10, "flexymon": [ { "id": "raton", "weight": 60 }, { "id": "monitor", "weight": 40 } ] },
    "plaza_ayuntamiento": { "rate": 6, "flexymon": [ { "id": "movil", "weight": 100 } ] }
  }
}
```

- `rate`: percent chance (1–100) of a battle per completed step on a qualifying tile.
- `weight`: relative chance of each species (whole numbers ≥ 1; they need not add up to 100).
- `encounters` is required; use `{}` for none.

A group only does something where the **map** has an encounter rectangle with that `group` name. To add wild
flexymon to a new area, add the group here and the rectangle on the map ([MAPS.md](MAPS.md) › Encounter areas).
Rectangles in mode `tiles` roll only on encounter tiles (tall grass, dune grass, vineyard); mode `all` rolls on every
tile, for city crowds. A group on a map but missing here stops the game at boot; a group here that no map uses is a
warning (and fails the world test).

## Shops

`shops.json` maps a shop id to the item ids it sells, in the order shown:

```json
{ "tienda_alboraya": ["cafe", "bocadillo", "redbull", "regleta"], "bar_centro": ["cafe", "bocadillo"] }
```

Only items with a price can be listed. A shop opens through a `shopkeeper` NPC whose `shop` names it; usually the
shopkeeper stands behind a counter inside a small shop interior (see [MAPS.md](MAPS.md) › Add a building). Every
shop can buy any sellable item from the player.

## The new game (`start.json`)

```json
{
  "starter": "portatil",
  "euros": 200,
  "teamSlots": 2,
  "spawn": { "map": "oficina", "x": 7, "y": 12, "facing": "up" },
  "respawn": { "map": "oficina", "x": 7, "y": 10, "facing": "down" },
  "items": { "cafe": 3, "llaves_audi": 1 }
}
```

`starter` is handed over in the intro; `spawn` is where the intro starts; `respawn` is where you wake up after
losing. `euros` 0–999 999, `teamSlots` 1–6, item counts 1–99. **Moving `spawn` means updating `intro.json`** too:
the intro's walks are checked against the spawn's map at boot.

## Secret names (`secret-names.json`)

```json
[{ "name": "paco", "items": { "cafe": 10 }, "message": "El de siempre te ha guardado unos cafés." }]
```

If the player's name matches `name` (ignoring case, accents and surrounding spaces), `items` are added and `message`
is shown right after the starter handover. Two entries may not match the same name. Don't put real people's names in
a public repository.

## The Audi (`car.json`)

```json
{
  "unlockPairs": [["llaves_audi", "carnet"], ["llaves_audi", "cafe_doble"]],
  "lockedDialogue": ["El Audi está cerrado. Tienes las llaves, pero te falta algo...", "..."],
  "sprite": "assets/sprites/car/audi.png",
  "sound": "assets/audio/sfx/car_engine.ogg",
  "toMurcia": { "map": "murcia", "x": 16, "y": 15, "facing": "down" },
  "toValencia": { "map": "alboraya", "x": 85, "y": 9, "facing": "down" }
}
```

- `unlockPairs`: owning both items of any pair opens the office car (items are not consumed). The shipped sources:
  the keys at the start, *Café doble* at the bar `bar_este`, *Carnet* at El Pueblo's shop `tienda_pueblo`.
- `lockedDialogue`: what the locked car says.
- `sprite`: the car seen from the side, nose to the right (flipped for the way back), used by the trip scene.
- `sound`: the engine, looped during the trip.
- `toMurcia` / `toValencia`: where each trip arrives (next to the other car).

The cars on the maps are action warps with a `car` property ([MAPS.md](MAPS.md) › The Audi). The game knows exactly
two destinations, `murcia` and `valencia`; a third region reachable by car would need code changes in
`src/logic/car.ts` and the car warp schema.

## The title and the intro (`intro.json`)

- `titleImage`: 512 × 288 PNG behind the title screen.
- `jingle`: sound played at the handover.
- `coworker`: `{ name, sprite, voice, x, y, facing }`, an intro-only character placed on the `start.json › spawn`
  map.
- `steps`, run in order, the player starting on the spawn tile:

| Step | Fields | What happens |
| --- | --- | --- |
| `fade_in` | `ms` 0–10 000 | Fades in from black. |
| `wait` | `ms` 0–10 000 | Pauses. |
| `walk` | `actor` (`player` / `coworker`), `path` (`["up", "up", …]`) | Walks one tile per direction. |
| `face` | `actor`, `facing` | Turns. |
| `say` | `lines` | The coworker speaks. `{name}` = the player's name, `{starter}` = the starter's name. |
| `handover` | — | Exactly one. Jingle, "¡Recibes a {starter}!", then the secret name's items and message. |

The shipped intro also tells the player about the mystery door to the story realm. The player gets control where the
script leaves them; walk the coworker out of view at the end. Boot checks that
the coworker's tile and every walked tile are walkable and that no walk enters the other actor's tile.

## The story realm (`story.json`)

The *Modo historia* behind the office's mystery door (rules: [GAME-RULES.md](GAME-RULES.md) › Story mode). Shortened:

```json
{
  "map": "historia",
  "music": "assets/audio/music/valencia.ogg",
  "budget": 1500,
  "teamSize": 4,
  "shop": ["cafe", "bocadillo", "redbull", "ibuprofeno"],
  "door": ["Una puerta que no estaba aquí ayer..."],
  "welcome": ["Has cruzado la puerta misteriosa. Bienvenido al Modo historia.", "..."],
  "victory": ["¡Has vencido a todos los jefes del camino!", "..."],
  "office": { "place": "La oficina", "x": 4, "y": 6, "path": [] },
  "bosses": [
    {
      "id": "paellero_playa",
      "name": "Paellero",
      "place": "Playa de la Malvarrosa",
      "sprite": "assets/sprites/npcs/paellero.png",
      "voice": "assets/audio/sfx/voice_low.ogg",
      "x": 25, "y": 13,
      "path": [{ "x": 28, "y": 6 }, { "x": 28, "y": 13 }],
      "stand": { "x": 25, "y": 12, "facing": "down" },
      "dialogue": ["La paella no se toca hasta que esté el socarrat.", "..."],
      "defeatDialogue": ["Bien jugado. Ni una gamba te has dejado."],
      "team": [{ "id": "cafetera", "bonus": { "hp": 8, "attack": 3, "defense": 2, "speed": 2 } }, { "id": "movil" }]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `map` | The zone drawn as the story board (a `zones.json` id; the shipped one, `historia`, is built from `tools/world/historia.txt`, see [MAPS.md](MAPS.md) › The story map). |
| `music` | The loop played on the board (battles use `sounds.json › battleMusic` as usual). |
| `budget` | Euros to spend in the story shop, 0–999 999. Selling gives the full price back, so this never shrinks. |
| `teamSize` | How many *different* flexymon the player picks, 1–6 (at most the number of species). |
| `shop` | Item ids the story shop sells, in order: each must have a price and be usable in battle, no repeats. |
| `door` | What the mystery door says before "¿Cruzar la puerta?". |
| `welcome` | The explanation shown on the first visit, before the team choice. |
| `victory` | Shown after the last boss's `defeatDialogue`. |
| `office` | Stop 0: `place` (shown in the panel) and its tile `x`, `y`; `path` must be `[]`. |
| `bosses` | The other stops, in order (at least one). |

Each boss: a unique `id`, `name` (the character), `place` (the landmark, shown in the panel), `sprite` (a 64 × 128
walk sheet like the NPCs'; `npm run art` draws one from `NPC_LOOKS`) and `voice`, the stop's tile `x`, `y`, `path`
(the corner tiles walked through from the previous stop, both ends left out; every leg must be a straight line over
walkable tiles), `stand` (the tile and facing of the character, next to the stop), `dialogue` (before the battle),
`defeatDialogue` (after a first win and when talked to later) and `team` (1–6 members in battle order, each a
species `id` and an optional `bonus` of `hp` / `attack` / `defense` / `speed`, 0–999 each, added to the base stats).

Boot checks: the map, items and species exist; every stop is walkable; every leg is straight and walkable; every
`stand` tile is inside the map. To add a boss, add a landmark to the layout, append the boss (its `path` leads from
the previous stop), and run the game: a mistake stops on the red error screen.

## Sounds and music

- **Zone music:** `zones.json › music`, one loop per region (`valencia.ogg`, `murcia.ogg`; every interior plays
  `interior.ogg`). The same file keeps playing across zones; a different one crossfades over 500 ms.
- **Battle music:** `sounds.json › battleMusic` (`battle.ogg`), the same loop for every battle (wild, NPC, debug).
  It crossfades in when a battle starts and the zone's music crossfades back when it ends.
- **Attack sounds** (`attacks.json › sound`), **cries** (`flexymon.json › cry`), **voices** (`npcs.json › voice`),
  the jingle and the car engine are content paths like any other.
- **Story realm music:** `story.json › music` plays on the story board and comes back after its battles.
- **Interface sounds:** `sounds.json` has `cursor` (a menu cursor moved), `confirm` (an option chosen), `cancel` (B
  backed out), `error` (a refused action) and `money` (a purchase, a sale, a reward). All five, plus
  `battleMusic`, are required.
- Every path is an OGG with an MP3 of the same name next to it as a fallback.
- Audio starts only after the first key press, click or touch (a browser rule). Volumes are player options.

## UI text (`src/i18n/es.json`)

Every string the interface shows that is not content (menu labels, battle messages, shop prompts…) is a flat key in
`src/i18n/es.json`, grouped by prefix (`battle.*`, `shop.*`, `menu.*`…). Code reads them with
`t('battle.wild_appeared', { name })`; `{var}` placeholders are filled from the second argument. To reword the UI,
edit the value; to add a string, add a key and use it with `t()`. A missing key shows `⟦key⟧` on screen and logs a
warning. Never write Spanish text in a `.ts` file.

## Tunable numbers (`src/logic/constants.ts`)

Damage scale, merge percent, team size, cooldown distance, safe steps, walk speed, text speeds, timings and sizes are
constants with a doc comment each. Some are pinned by unit tests that encode a rule (e.g. the damage examples in
`tests/logic/damage.test.ts`); if you change a rule number, update [GAME-RULES.md](GAME-RULES.md) and those tests in
the same change.

## The debug menu

Available with `npm run dev`, or on any build with `?debug=1` in the URL. **F2** cycles: hidden → info (map, tile,
FPS, euros) → menu → hidden. In the menu (arrows, A, B):

- teleport to any zone's `default` spawn (the story board too: there it is only a map to look at; the story itself
  is reached through the mystery door);
- *Combate: {name}*: a wild battle against any species;
- *Dar 1000 €*, *Dar: {item}*: give euros or one of any item;
- *Recargar datos*: reload and validate every JSON and map;
- *Borrar partida*: delete the save (and the story realm's save) and reload;
- *Encuentros: sí/no*: switch wild encounters off;
- *NPC: todos listos*: make every enemy fightable again.

## The frozen test world

`public/test-world/data/` and `public/maps/test/` are a small, frozen content set (3 flexymon, 3 test maps) that many
tests run on, so their numbers never change. **Do not add real content there.** Details: [TESTING.md](TESTING.md).
