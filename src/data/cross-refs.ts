/**
 * Cross-reference checks run after every file passed its schema: every id used somewhere exists,
 * ids are unique, shops sell only buyable items, secret names do not collide, and the story realm's map, shop
 * (priced battle items) and boss teams exist.
 * Map-dependent checks (walkable spawns, warps) live in `map-checks.ts`.
 */
import { normalizeName } from '../logic/names';
import type { DataError } from './errors';
import type { RawGameData } from './game-data';

/** Run every cross-reference rule; returns the list of problems (empty = valid). */
export function checkCrossRefs(raw: RawGameData): DataError[] {
  const errors: DataError[] = [];
  const add = (file: string, path: PropertyKey[], message: string): void => {
    errors.push({ file, path, message });
  };

  // Unique ids per collection.
  const uniqueIds = (file: string, list: { id: string }[]): Set<string> => {
    const seen = new Set<string>();
    list.forEach((it, i) => {
      if (seen.has(it.id)) add(file, [i, 'id'], `duplicate id "${it.id}"`);
      seen.add(it.id);
    });
    return seen;
  };
  const flexymon = uniqueIds('flexymon.json', raw.flexymon);
  const attacks = uniqueIds('attacks.json', raw.attacks);
  const items = uniqueIds('items.json', raw.items);
  uniqueIds('npcs.json', raw.npcs);
  const zones = uniqueIds('zones.json', raw.zones);
  const shops = new Set(Object.keys(raw.shops));
  const itemById = new Map(raw.items.map((it) => [it.id, it]));

  const needFlexymon = (file: string, path: PropertyKey[], id: string): void => {
    if (!flexymon.has(id)) add(file, path, `unknown flexymon "${id}"`);
  };
  const needItem = (file: string, path: PropertyKey[], id: string): void => {
    if (!items.has(id)) add(file, path, `unknown item "${id}"`);
  };
  const needMap = (file: string, path: PropertyKey[], id: string): void => {
    if (!zones.has(id)) add(file, path, `unknown map "${id}"`);
  };

  // flexymon.json: attack ids.
  raw.flexymon.forEach((sp, i) =>
    sp.attacks.forEach((a, j) => {
      if (!attacks.has(a)) add('flexymon.json', [i, 'attacks', j], `unknown attack "${a}"`);
    }),
  );

  // npcs.json: maps, enemy teams, shops.
  raw.npcs.forEach((npc, i) => {
    needMap('npcs.json', [i, 'map'], npc.map);
    if (npc.type === 'enemy') npc.team.forEach((id, j) => needFlexymon('npcs.json', [i, 'team', j], id));
    if (npc.type === 'shopkeeper' && !shops.has(npc.shop))
      add('npcs.json', [i, 'shop'], `unknown shop "${npc.shop}"`);
  });

  // zones.json: encounter species.
  raw.zones.forEach((zone, i) =>
    Object.entries(zone.encounters).forEach(([group, g]) =>
      g.flexymon.forEach((e, k) =>
        needFlexymon('zones.json', [i, 'encounters', group, 'flexymon', k, 'id'], e.id),
      ),
    ),
  );

  // shops.json: items exist and can be bought.
  Object.entries(raw.shops).forEach(([shop, list]) =>
    list.forEach((id, j) => {
      const item = itemById.get(id);
      if (!item) add('shops.json', [shop, j], `unknown item "${id}"`);
      else if (item.price === null)
        add('shops.json', [shop, j], `item "${id}" has price null and cannot be sold`);
    }),
  );

  // start.json: starter, items, maps.
  needFlexymon('start.json', ['starter'], raw.start.starter);
  Object.keys(raw.start.items).forEach((id) => needItem('start.json', ['items', id], id));
  needMap('start.json', ['spawn', 'map'], raw.start.spawn.map);
  needMap('start.json', ['respawn', 'map'], raw.start.respawn.map);

  // secret-names.json: items, and no two names that match each other.
  const names = new Map<string, number>();
  raw.secretNames.forEach((s, i) => {
    Object.keys(s.items).forEach((id) => needItem('secret-names.json', [i, 'items', id], id));
    const key = normalizeName(s.name);
    const other = names.get(key);
    if (other !== undefined)
      add('secret-names.json', [i, 'name'], `"${s.name}" matches the same names as entry [${other}]`);
    else names.set(key, i);
  });

  // car.json: items and endpoint maps.
  raw.car.unlockPairs.forEach((pair, i) =>
    pair.forEach((id, j) => needItem('car.json', ['unlockPairs', i, j], id)),
  );
  needMap('car.json', ['toMurcia', 'map'], raw.car.toMurcia.map);
  needMap('car.json', ['toValencia', 'map'], raw.car.toValencia.map);

  // story.json: the board is a zone; the shop sells priced battle items; boss ids are unique; teams exist.
  const story = raw.story;
  needMap('story.json', ['map'], story.map);
  story.shop.forEach((id, j) => {
    const item = itemById.get(id);
    if (!item) add('story.json', ['shop', j], `unknown item "${id}"`);
    else if (item.price === null)
      add('story.json', ['shop', j], `item "${id}" has price null and cannot be sold`);
    else if (!item.usableIn.includes('battle'))
      add('story.json', ['shop', j], `item "${id}" cannot be used in battle`);
  });
  if (new Set(story.shop).size !== story.shop.length) add('story.json', ['shop'], 'lists an item twice');
  if (story.teamSize > raw.flexymon.length)
    add(
      'story.json',
      ['teamSize'],
      `needs ${story.teamSize} different flexymon but only ${raw.flexymon.length} exist`,
    );
  const bossIds = new Set<string>();
  story.bosses.forEach((boss, i) => {
    if (bossIds.has(boss.id)) add('story.json', ['bosses', i, 'id'], `duplicate id "${boss.id}"`);
    bossIds.add(boss.id);
  });
  story.bosses.forEach((boss, i) =>
    boss.team.forEach((m, j) => needFlexymon('story.json', ['bosses', i, 'team', j, 'id'], m.id)),
  );

  return errors;
}
