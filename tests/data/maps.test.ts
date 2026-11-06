import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDataError } from '../../src/data/errors';
import { loadGameData, type TextFetcher } from '../../src/data/loader';
import type { Json } from './fixture';

const pub = join(__dirname, '..', '..', 'public');
const disk: TextFetcher = async (url) => readFileSync(join(pub, url), 'utf8');

/** Load data + maps from disk, letting `edit(file, json)` change any file first. */
async function load(edit: (file: string, json: Json) => void = () => undefined): Promise<string[] | 'ok'> {
  const fetcher: TextFetcher = async (url) => {
    const json = JSON.parse(await disk(url)) as Json;
    edit(url.replace(/^test-world\/data\//, ''), json);
    return JSON.stringify(json);
  };
  const result = await loadGameData('test-world/data/', fetcher, { mapsBaseUrl: '' });
  return result.ok ? 'ok' : result.errors.map(formatDataError);
}

/** Set a property of a warp object in a map's `warps` layer. */
const setWarp = (map: Json, name: string, prop: string, value: unknown) => {
  const warp = map.layers.find((l: Json) => l.name === 'warps').objects.find((o: Json) => o.name === name);
  const p = warp.properties.find((x: Json) => x.name === prop);
  if (p) p.value = value;
  else warp.properties.push({ name: prop, type: typeof value === 'number' ? 'int' : 'string', value });
};

describe('maps at load time', () => {
  it('the test-world data and maps load, with the parsed maps in GameData', async () => {
    const result = await loadGameData('test-world/data/', disk, { mapsBaseUrl: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.data.maps.keys()]).toEqual(['test', 'test_house', 'test_east']);
    const house = result.data.maps.get('test_house')!;
    expect(house.info).toMatchObject({ width: 10, height: 8 });
    expect(Object.isFrozen(house.info)).toBe(true);
    expect(Object.isFrozen(house.json)).toBe(false);
  });

  it('without mapsBaseUrl, maps are skipped', async () => {
    const result = await loadGameData('test-world/data/', disk);
    expect(result.ok && result.data.maps.size).toBe(0);
  });

  it('a warp pointing at a wall fails with a clear message', async () => {
    expect(
      await load((file, json) => {
        if (file === 'maps/test/test.tmj') {
          setWarp(json, 'house_door', 'toX', 0);
          setWarp(json, 'house_door', 'toY', 0);
        }
      }),
    ).toEqual([
      'maps/test/test.tmj › warps.house_door › target tile (0, 0) on map "test_house" is not walkable',
    ]);
  });

  it('a warp to an unknown map or outside the target map fails', async () => {
    expect(
      await load((f, j) => f === 'maps/test/test.tmj' && setWarp(j, 'house_door', 'toMap', 'luna')),
    ).toEqual(['maps/test/test.tmj › warps.house_door › unknown map "luna"']);
    expect(await load((f, j) => f === 'maps/test/test.tmj' && setWarp(j, 'house_door', 'toY', 8))).toEqual([
      'maps/test/test.tmj › warps.house_door › target tile (4, 8) is outside map "test_house" (10 × 8)',
    ]);
  });

  it('a car warp is not checked as a warp target; car.json endpoints are', async () => {
    expect(await load()).toBe('ok');
    expect(
      await load((file, json) => {
        if (file === 'car.json') json.toValencia = { map: 'test', x: 8, y: 11, facing: 'down' }; // the Audi itself
      }),
    ).toEqual(['car.json › toValencia › tile (8, 11) on map "test" is not walkable']);
  });

  it('an edge warp checks every row it can land on', async () => {
    const errors = await load((file, json) => {
      if (file !== 'maps/test/test_east.tmj') return;
      const deco = json.layers.find((l: Json) => l.name === 'deco');
      deco.data[7 * 30 + 0] = 3; // wall at (0, 7): test's east_edge lands there for row 7
    });
    expect(errors).toEqual([
      'maps/test/test.tmj › warps.east_edge › target tile (0, 7) on map "test_east" is not walkable',
    ]);
  });

  it('NPC spawns, start points, car points and map spawn points must be walkable', async () => {
    expect(
      await load((file, json) => {
        if (file === 'npcs.json') json[0].spawn = { x: 0, y: 0 }; // wall in test_house
        if (file === 'start.json') json.respawn.x = 11; // wall west of the spawn (y 11)
        if (file === 'car.json') json.toMurcia = { map: 'test_east', x: 20, y: 10, facing: 'down' };
        if (file === 'maps/test/test.tmj') {
          const spawns = json.layers.find((l: Json) => l.name === 'spawns');
          spawns.objects[0].x = 11 * 32;
        }
      }),
    ).toEqual([
      'npcs.json › [0].spawn › tile (0, 0) on map "test_house" is not walkable',
      'start.json › respawn › tile (11, 11) on map "test" is not walkable',
      'car.json › toMurcia › tile (20, 10) on map "test_east" is not walkable',
      'maps/test/test.tmj › spawns.default › tile (11, 10) on map "test" is not walkable',
    ]);
  });

  it('an encounter rectangle with a group missing from zones.json is an error', async () => {
    expect(
      await load((file, json) => {
        if (file !== 'maps/test/test.tmj') return;
        const layer = json.layers.find((l: Json) => l.name === 'encounters');
        layer.objects[1].properties[0].value = 'plaza_mayor';
      }),
    ).toEqual([
      'maps/test/test.tmj › encounters.plaza › unknown encounter group "plaza_mayor" (not in zones.json › test.encounters)',
    ]);
  });

  it('a group in zones.json that no rectangle uses is only a warning', async () => {
    const fetcher: TextFetcher = async (url) => {
      const json = JSON.parse(await disk(url)) as Json;
      if (url === 'test-world/data/zones.json') {
        json[2].encounters = { playa: { rate: 5, flexymon: [{ id: 'raton', weight: 1 }] } };
      }
      return JSON.stringify(json);
    };
    const result = await loadGameData('test-world/data/', fetcher, { mapsBaseUrl: '' });
    expect(result.ok).toBe(true);
    expect(result.ok && result.warnings?.map(formatDataError)).toEqual([
      'zones.json › test_east.encounters.playa › group not used by any rectangle in maps/test/test_east.tmj',
    ]);
    const shipped = await loadGameData('test-world/data/', disk, { mapsBaseUrl: '' });
    expect(shipped.ok && shipped.warnings).toEqual([]);
  });

  it('a missing or broken map file is reported against the map file', async () => {
    const fetcher: TextFetcher = async (url) => {
      if (url.endsWith('test_east.tmj')) throw new Error('HTTP 404');
      if (url.endsWith('test_house.tmj')) return '{"orientation":"isometric"}';
      return disk(url);
    };
    const result = await loadGameData('test-world/data/', fetcher, { mapsBaseUrl: '' });
    expect(result.ok ? [] : result.errors.map(formatDataError)).toEqual([
      'maps/test/test_house.tmj › (root) › orientation: Invalid input: expected "orthogonal"',
      'maps/test/test_east.tmj › (root) › could not load map (HTTP 404)',
    ]);
  });

  it('the intro may not walk into walls or into the other actor', async () => {
    // The player walks left from (15, 8) into the wall at x = 11.
    expect(
      await load((file, json) => {
        if (file === 'intro.json')
          json.steps.push({ type: 'walk', actor: 'player', path: ['left', 'left', 'left', 'left'] });
      }),
    ).toEqual(['intro.json › steps[8] › player: tile (11, 8) on map "test" is not walkable']);
    // The coworker starts on the wall.
    const errors = await load((file, json) => {
      if (file === 'intro.json') Object.assign(json.coworker, { x: 11, y: 12 });
    });
    expect(errors).toContain('intro.json › coworker › coworker: tile (11, 12) on map "test" is not walkable');
    expect(
      await load((file, json) => {
        if (file === 'intro.json') json.steps[3].path.push('down'); // into the player at (15, 8)
      }),
    ).toEqual(["intro.json › steps[3] › coworker would stand on the other actor's tile (15, 8)"]);
  });

  it('the story map: stops walkable, legs straight and walkable, bosses inside the map', async () => {
    expect(
      await load((file, json) => {
        if (file === 'story.json') {
          Object.assign(json.bosses[0], { x: 5, y: 4, path: [{ x: 5, y: 1 }] }); // down into a wall
          json.bosses[1].path = [{ x: 9, y: 2 }]; // a diagonal leg from (5, 4)
          json.bosses[1].stand = { x: 40, y: 0, facing: 'down' };
        }
      }),
    ).toEqual([
      'story.json › bosses[0] › tile (5, 4) on map "test" is not walkable',
      'story.json › bosses[0].path › tile (5, 3) on map "test" is not walkable',
      'story.json › bosses[0].path › tile (5, 4) on map "test" is not walkable',
      'story.json › bosses[1].path › every leg must be a straight line',
      'story.json › bosses[1].stand › tile (40, 0) is outside map "test"',
    ]);
  });
});
