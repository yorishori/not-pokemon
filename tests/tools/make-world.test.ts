import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  buildWorld,
  checkLayout,
  drawWorldTileset,
  findDoormat,
  makeWorld,
  readWorld,
  ROWS,
  TILE_ID,
  tiledJson,
  WT,
  type WorldSpec,
} from '../../tools/make-world';
import { SIDE, VARIANT_TILES } from '../../tools/art/tiles';
import { EXTRA_FIRST, EXTRA_TILES, XT } from '../../tools/world-tiles';

describe('make-world', () => {
  it('draws an 8-column tileset of 32 px tiles: 32 base tiles, then the variants', () => {
    const ts = PNG.sync.read(drawWorldTileset());
    expect(ts.width).toBe(256);
    expect(ts.height).toBe(ROWS * 32);
    expect(TILE_ID.size).toBe(32 + VARIANT_TILES.length + EXTRA_TILES.length);
    expect(TILE_ID.size).toBeLessThanOrEqual(ROWS * 8);
    // The base ids the maps have always used keep their place.
    expect(TILE_ID.get('grass')).toBe(WT.grass);
    expect(TILE_ID.get('whiteWall')).toBe(WT.whiteWall);
    expect(TILE_ID.get(VARIANT_TILES[0]!.key)).toBe(32);
  });

  it('appends the world redesign tiles after the variants, each drawn and with its own properties', () => {
    const ts = PNG.sync.read(drawWorldTileset());
    expect(EXTRA_FIRST).toBe(32 + VARIANT_TILES.length);
    expect(TILE_ID.get('x:soil')).toBe(XT.soil);
    expect(TILE_ID.get(EXTRA_TILES.at(-1)!.key)).toBe(XT.storyNode);
    for (let id = EXTRA_FIRST; id <= XT.storyNode; id += 1) {
      const ox = (id % 8) * 32;
      const oy = Math.floor(id / 8) * 32;
      let opaque = 0;
      for (let y = 0; y < 32; y += 1)
        for (let x = 0; x < 32; x += 1) opaque += ts.data[((oy + y) * 256 + ox + x) * 4 + 3]! > 0 ? 1 : 0;
      expect(opaque, `tile ${id}`).toBeGreaterThan(0);
    }
    const map = buildWorld({ maps: { m: { ground: 'grass' } } }, () => ['.']).get('m')!;
    const tiles = (
      tiledJson(map) as { tilesets: { tiles: { id: number; properties: { name: string }[] }[] }[] }
    ).tilesets[0]!.tiles;
    const props = (id: number) =>
      (tiles.find((t) => t.id === id)?.properties ?? []).map((p) => p.name).sort();
    expect(props(XT.sea)).toEqual(['solid']);
    expect(props(XT.onion)).toEqual(['encounter']);
    expect(props(XT.paseo)).toEqual([]);
    expect(props(XT.mysteryDoor)).toEqual(['solid']);
    expect(props(XT.storyNode)).toEqual([]);
  });

  it('builds one-way links (metro, train) to any tile of another map', () => {
    const world: WorldSpec = {
      maps: {
        a: {
          ground: 'floor',
          indoor: true,
          links: [{ x: 1, y: 0, to: 'b', toX: 0, toY: 1, facing: 'down' }],
        },
        b: { ground: 'floor', indoor: true },
      },
    };
    const built = buildWorld(world, (id) => (id === 'a' ? ['XjX', 'PPP', '#_#'] : ['jX', 'PP', '_#']));
    const props = (o: { properties?: { name: string; value: unknown }[] }) =>
      Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
    const link = built.get('a')!.warps.find((w) => w.name === 'link_b')!;
    expect([link.x, link.y, props(link)]).toEqual([
      1,
      0,
      { toMap: 'b', toX: 0, toY: 1, toFacing: 'down', trigger: 'step' },
    ]);
    expect(built.get('b')!.warps.some((w) => w.name.startsWith('link'))).toBe(false);
    expect(() =>
      buildWorld(
        {
          maps: { a: { ground: 'floor', links: [{ x: 0, y: 0, to: 'nope', toX: 0, toY: 0, facing: 'up' }] } },
        },
        () => ['.'],
      ),
    ).toThrow('world.json › a: link to unknown map "nope"');
  });

  it('gives every variant tile the solid / encounter properties of its base tile', () => {
    const map = buildWorld({ maps: { m: { ground: 'grass' } } }, () => ['.']).get('m')!;
    const tiles = (
      tiledJson(map) as { tilesets: { tiles: { id: number; properties: { name: string }[] }[] }[] }
    ).tilesets[0]!.tiles;
    const props = (id: number) =>
      (tiles.find((t) => t.id === id)?.properties ?? []).map((p) => p.name).sort();
    for (const v of VARIANT_TILES)
      expect([v.key, props(TILE_ID.get(v.key)!)]).toEqual([v.key, props(TILE_ID.get(v.base)!)]);
    expect(props(TILE_ID.get('roof:blue:tl')!)).toEqual(['solid']);
    expect(props(TILE_ID.get('water:5')!)).toEqual(['solid']);
    expect(props(TILE_ID.get('path:3')!)).toEqual([]);
  });

  it('picks building edges, roof colours, shores and path borders from the neighbours', () => {
    const layout = [
      '.^^^.^^.', // two buildings: the first roof block is terracotta, the second blue
      '.^^^.^^.',
      '.WWW.##.',
      '.WDW.#D.',
      '..:..~~.',
    ];
    const g = buildWorld({ maps: { m: { ground: 'grass' } } }, () => layout).get('m')!.layers;
    const at = (layer: number[], x: number, y: number) => layer[y * 8 + x];
    expect(at(g.deco, 1, 0)).toBe(TILE_ID.get('roof:terracotta:tl'));
    expect(at(g.deco, 2, 0)).toBe(TILE_ID.get('roof:terracotta:tm'));
    expect(at(g.deco, 3, 1)).toBe(TILE_ID.get('roof:terracotta:br'));
    expect(at(g.deco, 5, 0)).toBe(TILE_ID.get('roof:blue:tl'));
    expect(at(g.deco, 1, 2)).toBe(TILE_ID.get('whiteWall:ul'));
    expect(at(g.deco, 3, 3)).toBe(TILE_ID.get('whiteWall:lr'));
    expect(at(g.deco, 2, 3)).toBe(TILE_ID.get('door:white'));
    expect(at(g.deco, 6, 3)).toBe(WT.door);
    // Path below grass on the west, east and south sides; the north neighbour is a door (not grass).
    expect(at(g.ground, 2, 4)).toBe(TILE_ID.get(`path:${SIDE.e | SIDE.w}`));
    // Water: land to the north (a wall) and the west / east; nothing past the map's bottom edge.
    expect(at(g.ground, 5, 4)).toBe(TILE_ID.get(`water:${SIDE.n | SIDE.w}`));
    // Collision is unchanged: the art changes, the tiles' meaning does not.
    expect(at(g.collision, 2, 3)).toBe(-1);
  });

  it('draws indoor walls as a papered face above the floor and a dark top elsewhere', () => {
    const g = buildWorld({ maps: { r: { ground: 'floor', indoor: true } } }, () => ['###', '#=#', '#_#']).get(
      'r',
    )!.layers;
    expect(g.deco[1]).toBe(TILE_ID.get('wall:indoorFace'));
    expect(g.deco[0]).toBe(TILE_ID.get('wall:indoorTop'));
    expect(g.deco[3]).toBe(TILE_ID.get('wall:indoorTop'));
  });

  it('rejects uneven rows and unknown characters', () => {
    expect(() => checkLayout('x', ['..', '.'])).toThrow('x.txt: row 1 has 1 tiles, expected 2');
    expect(() => checkLayout('x', ['.`'])).toThrow('x.txt: unknown tile "`" at (1, 0)');
    expect(() => checkLayout('x', [])).toThrow('x.txt: empty layout');
    expect(() => findDoormat('room', ['###', '#=#', '###'])).toThrow(/doormat/);
  });

  it('builds doors and edges with their way back', () => {
    const world: WorldSpec = {
      maps: {
        out: {
          ground: 'grass',
          spawn: [1, 2],
          doors: [{ x: 1, y: 1, to: 'room' }],
          edges: [{ side: 'east', from: 2, to: 3, map: 'east' }],
        },
        east: { ground: 'sand' },
        room: { ground: 'floor', indoor: true },
      },
    };
    const layouts: Record<string, string[]> = {
      out: ['###', '#D#', '...', '.T.'],
      east: ['ss', 'ss', 'ss', 'ss'],
      room: ['###', '#=#', '#_#'],
    };
    const built = buildWorld(world, (id) => layouts[id]!);
    const props = (o: { properties?: { name: string; value: unknown }[] }) =>
      Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
    const out = built.get('out')!;
    expect(out.warps.map((w) => [w.name, w.x, w.y, w.width, w.height, props(w)])).toEqual([
      ['door_room', 1, 1, 1, 1, { toMap: 'room', toX: 1, toY: 2, toFacing: 'up', trigger: 'step' }],
      ['edge_east', 3, 2, 1, 2, { toMap: 'east', toX: 0, trigger: 'step' }],
    ]);
    expect(built.get('room')!.warps.map((w) => [w.name, w.x, w.y, props(w)])).toEqual([
      ['exit', 1, 3, { toMap: 'out', toX: 1, toY: 2, toFacing: 'down', trigger: 'step' }],
    ]);
    expect(built.get('east')!.warps.map((w) => [w.name, w.x, w.y, w.height, props(w)])).toEqual([
      ['edge_out', -1, 2, 2, { toMap: 'out', toX: 2, trigger: 'step' }],
    ]);
    // Trees: trunk in deco, blocked in collision, top drawn above on the tile above.
    expect(out.layers.deco[3 * 3 + 1]).toBe(WT.trunk);
    expect(out.layers.collision[3 * 3 + 1]).toBe(WT.blocker);
    expect(out.layers.above[2 * 3 + 1]).toBe(WT.treetop);
    // Deco tiles sit on the map's base ground; spawns default to the doormat indoors.
    expect(out.layers.ground[0]).toBe(WT.grass);
    expect(built.get('room')!.spawns[0]).toMatchObject({ name: 'default', x: 1, y: 2 });
    expect(out.spawns[0]).toMatchObject({ x: 1, y: 2 });
  });

  it('checks that doors and cars are drawn where world.json says', () => {
    const base = { room: { ground: 'floor' as const, indoor: true } };
    const layouts: Record<string, string[]> = { out: ['..'], room: ['_'] };
    expect(() =>
      buildWorld(
        { maps: { out: { ground: 'grass', doors: [{ x: 0, y: 0, to: 'room' }] }, ...base } },
        (id) => layouts[id]!,
      ),
    ).toThrow('world.json › out: door to room at (0, 0) is not a "D" tile');
    expect(() =>
      buildWorld(
        { maps: { out: { ground: 'grass', car: { x: 0, y: 0, to: 'murcia' } } } },
        (id) => layouts[id]!,
      ),
    ).toThrow(/needs "Aa"/);
    expect(() =>
      buildWorld({ maps: { out: { ground: 'grass', portal: { x: 0, y: 0 } } } }, (id) => layouts[id]!),
    ).toThrow(/the portal at \(0, 0\) needs "\?"/);
    const portal = buildWorld({ maps: { out: { ground: 'grass', portal: { x: 1, y: 0 } } } }, () => ['.?']);
    expect(portal.get('out')!.warps[0]).toMatchObject({
      x: 1,
      y: 0,
      properties: [
        { name: 'portal', value: true },
        { name: 'trigger', value: 'action' },
      ],
    });
  });

  it('the shipped layouts build, and the tool never overwrites without --force', () => {
    expect(buildWorld(readWorld()).size).toBe(20);
    expect(makeWorld(false)).toEqual([]);
  });
});
