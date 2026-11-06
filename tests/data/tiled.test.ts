import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSpawn, isBlocked, parseTiledMap, resolveMapPath, tiledProperty } from '../../src/data/tiled';
import { buildTestEast, buildTestHouse, buildTestMap } from '../../tools/make-test-map';

const shipped = (name = 'test') =>
  JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'public', 'maps', 'test', `${name}.tmj`), 'utf8'),
  ) as unknown;

describe('Tiled maps', () => {
  it('resolves tileset paths relative to the map', () => {
    expect(resolveMapPath('maps/test.tmj', '../assets/tilesets/test.png')).toBe('assets/tilesets/test.png');
    expect(resolveMapPath('maps/sub/a.tmj', './b.png')).toBe('maps/sub/b.png');
  });

  it('reads properties', () => {
    expect(tiledProperty([{ name: 'solid', value: true }], 'solid')).toBe(true);
    expect(tiledProperty(undefined, 'solid')).toBeUndefined();
  });

  it('the shipped test map: 30 × 20, walls, water, hidden collision, open path, edges, spawn', () => {
    const info = parseTiledMap(shipped(), 'maps/test/test.tmj');
    expect(info.width).toBe(30);
    expect(info.height).toBe(20);
    expect(info.tilesetImages).toEqual([{ name: 'test', path: 'assets/tilesets/test.png' }]);
    expect(findSpawn(info)).toEqual({ name: 'default', x: 15, y: 10 });
    expect(findSpawn(info, 'nope')).toBeNull();
    expect(isBlocked(info, 11, 10)).toBe(true); // wall (deco, solid property)
    expect(isBlocked(info, 20, 13)).toBe(true); // water (ground, solid property)
    expect(isBlocked(info, 18, 6)).toBe(true); // tree trunk: blocked by the hidden collision layer
    expect(isBlocked(info, 18, 5)).toBe(false); // tree top is drawn above, walkable
    expect(isBlocked(info, 12, 10)).toBe(false);
    expect(isBlocked(info, 13, 7)).toBe(false); // flowers
    for (let y = 0; y <= 10; y += 1) expect(isBlocked(info, 15, y)).toBe(false);
    expect(isBlocked(info, -1, 0)).toBe(true);
    expect(isBlocked(info, 30, 0)).toBe(true);
    expect(isBlocked(info, 0, 20)).toBe(true);
  });

  it('the shipped test map has tall grass and two encounter rectangles', () => {
    const info = parseTiledMap(shipped(), 'maps/test/test.tmj');
    const grass = (x: number, y: number) => info.encounter[y * info.width + x];
    expect(grass(20, 2)).toBe(true);
    expect(grass(23, 5)).toBe(true);
    expect(grass(19, 3)).toBe(false); // inside the rectangle, plain grass
    expect(grass(15, 10)).toBe(false);
    expect(info.encounter.filter(Boolean)).toHaveLength(16);
    expect(info.encounters).toEqual([
      { name: 'jardin', x: 19, y: 1, width: 5, height: 5, group: 'jardin_turia', mode: 'tiles' },
      { name: 'plaza', x: 1, y: 13, width: 4, height: 4, group: 'plaza_ayuntamiento', mode: 'all' },
    ]);
    expect(isBlocked(info, 20, 2)).toBe(false);
  });

  it('rejects encounter rectangles without a group or with a bad mode', () => {
    type Obj = { name: string; properties?: { name: string; value: unknown }[] };
    const map = buildTestMap() as { layers: { name: string; objects?: Obj[] }[] };
    const objs = map.layers.find((l) => l.name === 'encounters')!.objects!;
    objs[0]!.properties = [
      { name: 'group', value: 'g' },
      { name: 'mode', value: 'some' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(
      'maps/x.tmj: encounter "jardin": mode must be "tiles" or "all"',
    );
    objs[0]!.properties = [{ name: 'mode', value: 'all' }];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/encounter "jardin": needs a group property/);
    objs[0]!.name = '';
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/encounter #0/);
    map.layers = map.layers.filter((l) => l.name !== 'encounters');
    expect(parseTiledMap(map, 'maps/x.tmj').encounters).toEqual([]);
  });

  it('the shipped maps are what the tool generates (no hand edits lost)', () => {
    expect(shipped()).toEqual(JSON.parse(JSON.stringify(buildTestMap())));
    expect(shipped('test_house')).toEqual(JSON.parse(JSON.stringify(buildTestHouse())));
    expect(shipped('test_east')).toEqual(JSON.parse(JSON.stringify(buildTestEast())));
  });

  it('reads warps: door, off-map edge (row kept), interior exit, the Audi', () => {
    const test = parseTiledMap(shipped(), 'maps/test/test.tmj');
    expect(test.warps).toEqual([
      {
        name: 'house_door',
        x: 6,
        y: 6,
        width: 1,
        height: 1,
        toMap: 'test_house',
        toX: 4,
        toY: 7,
        toFacing: 'up',
        trigger: 'step',
        car: null,
        portal: false,
      },
      {
        name: 'east_edge',
        x: 30,
        y: 0,
        width: 1,
        height: 20,
        toMap: 'test_east',
        toX: 0,
        toY: null,
        toFacing: null,
        trigger: 'step',
        car: null,
        portal: false,
      },
      {
        name: 'audi',
        x: 8,
        y: 11,
        width: 2,
        height: 1,
        toMap: '',
        toX: null,
        toY: null,
        toFacing: null,
        trigger: 'action',
        car: 'murcia',
        portal: false,
      },
    ]);
    expect(isBlocked(test, 6, 6)).toBe(false); // the door tile is walkable
    expect(isBlocked(test, 8, 11)).toBe(true); // the Audi is solid (both tiles)
    expect(isBlocked(test, 9, 11)).toBe(true);
    const house = parseTiledMap(shipped('test_house'), 'maps/test/test_house.tmj');
    expect(house.warps[0]).toMatchObject({ x: 4, y: 8, toMap: 'test', toX: 6, toY: 7, toFacing: 'down' });
    const east = parseTiledMap(shipped('test_east'), 'maps/test/test_east.tmj');
    expect(east.warps[0]).toMatchObject({ x: -1, y: 0, height: 20, toMap: 'test', toX: 29, toY: null });
    expect(east.warps[1]).toMatchObject({ x: 2, y: 9, width: 2, trigger: 'action', car: 'valencia' });
    expect(isBlocked(east, 2, 9) && isBlocked(east, 3, 9)).toBe(true);
  });

  it('a car warp needs no toMap but must use trigger = action and a known destination', () => {
    const map = buildTestMap() as {
      layers: { name: string; objects?: { name: string; properties?: object[] }[] }[];
    };
    const audi = map.layers.find((l) => l.name === 'warps')!.objects!.find((o) => o.name === 'audi')!;
    audi.properties = [
      { name: 'car', value: 'murcia' },
      { name: 'trigger', value: 'step' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(
      /warp "audi": trigger a car warp needs trigger = action/,
    );
    audi.properties = [
      { name: 'car', value: 'luna' },
      { name: 'trigger', value: 'action' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/warp "audi": car/);
  });

  it('a portal warp (the mystery door) needs no toMap but must use trigger = action', () => {
    const map = buildTestMap() as {
      layers: { name: string; objects?: { name: string; properties?: object[] }[] }[];
    };
    const door = map.layers.find((l) => l.name === 'warps')!.objects!.find((o) => o.name === 'audi')!;
    door.properties = [
      { name: 'portal', type: 'bool', value: true },
      { name: 'trigger', value: 'action' },
    ];
    const warp = parseTiledMap(map, 'maps/x.tmj').warps.find((w) => w.name === 'audi');
    expect(warp).toMatchObject({ portal: true, car: null, toMap: '', trigger: 'action' });
    door.properties = [
      { name: 'portal', type: 'bool', value: true },
      { name: 'trigger', value: 'step' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/a portal warp needs trigger = action/);
  });

  it('rejects a warp with missing or wrong properties, naming it', () => {
    const map = buildTestMap() as {
      layers: { name: string; objects?: { name: string; properties?: object[] }[] }[];
    };
    const warps = map.layers.find((l) => l.name === 'warps')!.objects!;
    warps[0]!.properties = [{ name: 'toMap', type: 'string', value: 'x' }];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/maps\/x\.tmj: warp "house_door": trigger/);
    warps[0]!.name = '';
    warps[0]!.properties = [
      { name: 'toMap', value: 'x' },
      { name: 'trigger', value: 'step' },
      { name: 'toFacing', value: 'sideways' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/warp #0: toFacing/);
    warps[0]!.properties = [{ name: 'trigger', value: 'step' }];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/needs a toMap property/);
  });

  it('flags encounter tiles and strips flip bits', () => {
    const map = buildTestMap() as { layers: { name: string; data?: number[] }[] };
    const ground = map.layers.find((l) => l.name === 'ground')!;
    ground.data![0] = 8; // tall grass (local id 7)
    ground.data![1] = (0x80000000 | 3) >>> 0; // flipped wall (local id 2)
    const info = parseTiledMap(map, 'maps/test/test.tmj');
    expect(info.encounter[0]).toBe(true);
    expect(isBlocked(info, 1, 0)).toBe(true);
  });

  it('rejects invalid maps with a readable message', () => {
    expect(() => parseTiledMap({ orientation: 'isometric' }, 'maps/x.tmj')).toThrow(
      /maps\/x\.tmj: orientation/,
    );
    const map = buildTestMap() as { layers: { data?: number[] }[] };
    map.layers[0]!.data = [1, 2, 3];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/has 3 cells, expected 600/);
    expect(() => parseTiledMap(null, 'maps/x.tmj')).toThrow(/\(root\)/);
  });

  it('maps without a spawns layer have no spawn points', () => {
    const map = buildTestMap() as { layers: { name: string }[] };
    map.layers = map.layers.filter((l) => l.name !== 'spawns');
    expect(parseTiledMap(map, 'maps/x.tmj').spawns).toEqual([]);
  });
});
