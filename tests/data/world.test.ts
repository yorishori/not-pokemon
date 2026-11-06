// The real world (public/data/ + public/maps/<zone>.tmj) and the switch to the frozen test world.
// Four big outdoor maps — Alboraya, Valencia, El Pueblo (train only) and Murcia (Audi only).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatDataError } from '../../src/data/errors';
import type { GameData } from '../../src/data/game-data';
import { loadGameData } from '../../src/data/loader';
import { isBlocked } from '../../src/data/tiled';
import { chooseDataDir, TEST_WORLD_DATA_DIR, WORLD_DATA_DIR } from '../../src/data/world';
import { blockedWithWarps, warpAt } from '../../src/logic/warp';

const pub = join(__dirname, '..', '..', 'public');

let data: GameData;
let warnings: string[];

beforeAll(async () => {
  const result = await loadGameData('data/', async (url) => readFileSync(join(pub, url), 'utf8'), {
    mapsBaseUrl: '',
  });
  if (!result.ok) throw new Error(result.errors.map(formatDataError).join('\n'));
  data = result.data;
  warnings = (result.warnings ?? []).map(formatDataError);
});

/** Tiles (`map:x,y`) a player can stand on, walking from `start` through step warps (doors and edges). */
function reachable(start: { map: string; x: number; y: number }): Set<string> {
  // Still NPCs block their tile; wanderers move, so they never wall a path off for good.
  const still = new Set(
    [...data.npcs.values()].filter((n) => n.wander === null).map((n) => `${n.map}:${n.spawn.x},${n.spawn.y}`),
  );
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const key = `${cur.map}:${cur.x},${cur.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const map = data.maps.get(cur.map)!.info;
    const blocked = blockedWithWarps(map, map.warps, (x, y) => isBlocked(map, x, y));
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const x = cur.x + dx;
      const y = cur.y + dy;
      if (blocked(x, y) || still.has(`${cur.map}:${x},${y}`)) continue;
      const w = warpAt(map.warps, x, y, 'step');
      if (w) queue.push({ map: w.toMap, x: w.toX ?? x, y: w.toY ?? y });
      else queue.push({ map: cur.map, x, y });
    }
  }
  return seen;
}

/** True if some tile next to (x, y) on `map` is in `tiles`. */
const nextTo = (tiles: Set<string>, map: string, x: number, y: number) =>
  [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ].some(([dx, dy]) => tiles.has(`${map}:${x + dx!},${y + dy!}`));

const VALENCIA_SIDE = ['alboraya', 'valencia', 'pueblo'];
const MURCIA_SIDE = ['murcia'];
/** The story realm's board: reached only through the office's mystery door. */
const STORY = ['historia'];
const INTERIORS = [
  'oficina',
  'bar_centro',
  'bar_este',
  'casa_mp',
  'metro_alboraya',
  'metro_xativa',
  'estacion_norte',
  'estacion_pueblo',
  'tienda_alboraya',
  'tienda_valencia',
  'agora',
  'tienda_pueblo',
  'empresa_sur',
  'tienda_murcia',
  'empresa_poligono',
];

describe('the real world', () => {
  it('loads with zero errors and zero warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('has every shipped zone and no test map', () => {
    expect([...data.zones.keys()].sort()).toEqual(
      [...VALENCIA_SIDE, ...MURCIA_SIDE, ...INTERIORS, ...STORY].sort(),
    );
    expect(
      [...data.zones.values()]
        .filter((z) => z.indoor)
        .map((z) => z.id)
        .sort(),
    ).toEqual([...INTERIORS].sort());
    for (const id of MURCIA_SIDE) expect(data.zones.get(id)!.region).toBe('murcia');
  });

  it('uses all its content: at least the shipped amounts, every attack used, every species obtainable', () => {
    // Minimums, not exact counts, so new content does not break this test.
    expect(data.flexymon.size).toBeGreaterThanOrEqual(12);
    expect(data.attacks.size).toBeGreaterThanOrEqual(24);
    expect(data.items.size).toBeGreaterThanOrEqual(8);
    expect(data.npcs.size).toBeGreaterThanOrEqual(73);
    expect([...data.npcs.values()].filter((n) => n.type === 'enemy').length).toBeGreaterThanOrEqual(15);
    // Several wandering talkers in every outdoor zone, so the world looks alive.
    for (const id of [...VALENCIA_SIDE, ...MURCIA_SIDE]) {
      const walkers = [...data.npcs.values()].filter((n) => n.map === id && n.type === 'talker' && n.wander);
      expect(walkers.length, id).toBeGreaterThanOrEqual(3);
    }
    // Every attack is known by some species.
    const used = new Set([...data.flexymon.values()].flatMap((s) => s.attacks));
    expect([...data.attacks.keys()].filter((id) => !used.has(id))).toEqual([]);
    // Every species but the starter (handed over in the intro) is met in the wild.
    const met = new Set<string>();
    for (const z of data.zones.values())
      for (const g of Object.values(z.encounters)) for (const f of g.flexymon) met.add(f.id);
    met.add(data.start.starter);
    expect([...data.flexymon.keys()].filter((id) => !met.has(id))).toEqual([]);
  });

  it('follows the balance guide: totals 60–100 in Valencia, 100–140 for the Murcia species', () => {
    const total = (id: string) => Object.values(data.flexymon.get(id)!.stats).reduce((a, b) => a + b, 0);
    const murcia = new Set<string>();
    for (const id of MURCIA_SIDE)
      for (const g of Object.values(data.zones.get(id)!.encounters))
        for (const f of g.flexymon) murcia.add(f.id);
    for (const id of data.flexymon.keys()) {
      if (murcia.has(id)) expect(total(id), id).toBeGreaterThanOrEqual(100);
      if (murcia.has(id)) expect(total(id), id).toBeLessThanOrEqual(140);
      else {
        expect(total(id), id).toBeGreaterThanOrEqual(60);
        expect(total(id), id).toBeLessThanOrEqual(100);
      }
    }
  });

  it('from the new-game spawn, every Valencia zone and interior can be walked to, but not Murcia', () => {
    const tiles = reachable(data.start.spawn);
    const maps = new Set([...tiles].map((t) => t.split(':')[0]));
    for (const id of [
      ...VALENCIA_SIDE,
      ...INTERIORS.filter((i) => !['tienda_murcia', 'empresa_poligono'].includes(i)),
    ])
      expect(maps.has(id), id).toBe(true);
    for (const id of [...MURCIA_SIDE, ...STORY, 'tienda_murcia', 'empresa_poligono'])
      expect(maps.has(id), id).toBe(false);
    // The respawn point is on the same walkable network.
    expect(tiles.has(`${data.start.respawn.map}:${data.start.respawn.x},${data.start.respawn.y}`)).toBe(true);
  });

  it('the office car can be reached, and from Murcia every Murcia zone and the car back', () => {
    const valencia = reachable(data.start.spawn);
    const officeCar = data.maps.get('alboraya')!.info.warps.find((w) => w.car === 'murcia')!;
    expect(
      nextTo(valencia, 'alboraya', officeCar.x, officeCar.y + 1) ||
        valencia.has(`alboraya:${officeCar.x},${officeCar.y + 1}`),
    ).toBe(true);
    const murcia = reachable(data.car.toMurcia);
    const maps = new Set([...murcia].map((t) => t.split(':')[0]));
    for (const id of [...MURCIA_SIDE, 'tienda_murcia', 'empresa_poligono'])
      expect(maps.has(id), id).toBe(true);
    for (const id of VALENCIA_SIDE) expect(maps.has(id), id).toBe(false);
    const murciaCar = data.maps.get('murcia')!.info.warps.find((w) => w.car === 'valencia')!;
    expect(murcia.has(`murcia:${murciaCar.x},${murciaCar.y + 1}`)).toBe(true);
    // Coming back lands right under the office car.
    expect(data.car.toValencia).toMatchObject({ map: 'alboraya', x: officeCar.x, y: officeCar.y + 1 });
    expect(data.car.toMurcia).toMatchObject({ map: 'murcia', x: murciaCar.x, y: murciaCar.y + 1 });
  });

  it('every NPC can be walked up to and talked to', () => {
    const tiles = new Set([...reachable(data.start.spawn), ...reachable(data.car.toMurcia)]);
    for (const npc of data.npcs.values())
      expect(nextTo(tiles, npc.map, npc.spawn.x, npc.spawn.y), npc.id).toBe(true);
  });

  it('the car items have a source: the keys at the start, a double coffee or a licence in a shop', () => {
    expect(data.start.items).toMatchObject({ llaves_audi: 1 });
    const sold = (id: string) => [...data.shops].filter(([, items]) => items.includes(id)).map(([s]) => s);
    expect(sold('cafe_doble')).toEqual(['bar_este']);
    expect(sold('carnet')).toEqual(['tienda_pueblo']);
    expect(data.items.get('cafe_doble')!.price).toBeGreaterThan(0);
    expect(data.items.get('carnet')!.price).toBeGreaterThan(0);
    for (const pair of data.car.unlockPairs) expect(pair).toContain('llaves_audi');
    // Every shop belongs to a shopkeeper, and every town (and both bars) has one.
    const shopkeepers = [...data.npcs.values()].filter((n) => n.type === 'shopkeeper');
    expect(new Set(shopkeepers.map((n) => n.shop))).toEqual(new Set(data.shops.keys()));
    expect(shopkeepers.map((n) => n.map).sort()).toEqual(
      [
        'bar_este',
        'bar_centro',
        'tienda_alboraya',
        'tienda_murcia',
        'tienda_pueblo',
        'tienda_valencia',
      ].sort(),
    );
  });

  it('the mystery door is in the office, can be walked up to, and the story map is its own board', () => {
    const doors = [...data.maps].flatMap(([map, m]) =>
      m.info.warps.filter((w) => w.portal).map((w) => ({ map, w })),
    );
    expect(doors.map(({ map }) => map)).toEqual(['oficina']);
    const door = doors[0]!.w;
    expect(nextTo(reachable(data.start.spawn), 'oficina', door.x, door.y)).toBe(true);
    expect(data.story.map).toBe(STORY[0]);
    // Nothing warps onto the story board, and the board has no way out but the office menu.
    expect([...data.maps.values()].some((m) => m.info.warps.some((w) => w.toMap === data.story.map))).toBe(
      false,
    );
    expect(data.maps.get(data.story.map)!.info.warps).toEqual([]);
    expect(data.story.bosses.length).toBe(7);
  });

  it('the office has the healer and the storage box; the intro plays there', () => {
    const office = [...data.npcs.values()].filter((n) => n.map === 'oficina').map((n) => n.type);
    expect(office.filter((t) => t !== 'talker').sort()).toEqual(['healer', 'storage']);
    expect(data.start.spawn.map).toBe('oficina');
    expect(data.start.respawn.map).toBe('oficina');
  });
});

describe('the redesigned map links', () => {
  /** Every warp (with its map) that lands on `map`. */
  const into = (map: string) =>
    [...data.maps].flatMap(([from, m]) =>
      m.info.warps.filter((w) => w.toMap === map).map((w) => ({ from, w })),
    );

  it('Alboraya joins Valencia by the road, the whole beach and the metro', () => {
    const edges = into('valencia').filter(({ from }) => from === 'alboraya');
    expect(edges.map(({ w }) => [w.x, w.width]).sort()).toEqual(
      [
        [42, 3],
        [99, 13],
      ].sort(),
    );
    // Metro: Alboraya's station ↔ Xàtiva, next to the north station.
    expect(into('metro_xativa').map(({ from }) => from)).toContain('metro_alboraya');
    expect(
      into('metro_alboraya')
        .map(({ from }) => from)
        .sort(),
    ).toEqual(['alboraya', 'metro_xativa']);
  });

  it('El Pueblo is reached only by the train from the Estació del Nord', () => {
    // Only the station and the town's own interiors lead into El Pueblo: no edge, no other door.
    expect([...new Set(into('pueblo').map(({ from }) => from))].sort()).toEqual(
      ['estacion_pueblo', 'empresa_sur', 'tienda_pueblo'].sort(),
    );
    expect(
      into('estacion_pueblo')
        .map(({ from }) => from)
        .sort(),
    ).toEqual(['estacion_norte', 'pueblo']);
    expect(
      into('estacion_norte')
        .map(({ from }) => from)
        .sort(),
    ).toEqual(['estacion_pueblo', 'valencia']);
  });

  it('the landmarks are on the right maps', () => {
    const doors = (map: string) =>
      data.maps
        .get(map)!
        .info.warps.filter((w) => w.toMap && data.zones.get(w.toMap)?.indoor)
        .map((w) => w.toMap)
        .sort();
    expect(doors('alboraya')).toEqual(
      ['bar_este', 'bar_centro', 'casa_mp', 'metro_alboraya', 'oficina', 'tienda_alboraya'].sort(),
    );
    expect(doors('valencia')).toEqual(['agora', 'estacion_norte', 'metro_xativa', 'tienda_valencia'].sort());
    expect(doors('pueblo')).toEqual(['estacion_pueblo', 'empresa_sur', 'tienda_pueblo'].sort());
    expect(doors('murcia')).toEqual(['empresa_poligono', 'tienda_murcia'].sort());
    // Valencia and Murcia are the big horizontal maps.
    for (const id of ['valencia', 'murcia']) {
      const m = data.maps.get(id)!.info;
      expect(m.width, id).toBeGreaterThan(m.height * 2 - 1);
      expect(m.width, id).toBeGreaterThanOrEqual(120);
    }
  });
});

describe('chooseDataDir', () => {
  it('uses the real world unless a dev / E2E build asks for the test world', () => {
    expect(chooseDataDir(false, '?world=test', 'test')).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '', null)).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '?world=test', null)).toBe(TEST_WORLD_DATA_DIR);
    expect(chooseDataDir(true, '', 'test')).toBe(TEST_WORLD_DATA_DIR);
    // The URL wins over localStorage.
    expect(chooseDataDir(true, '?world=real', 'test')).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '?debug=1', 'other')).toBe(WORLD_DATA_DIR);
  });
});
