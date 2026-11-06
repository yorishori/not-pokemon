/**
 * `npm run world` — builds the real world's Tiled maps from plain-text layouts, since no human can draw them in
 * Tiled in a cloud session:
 * - `tools/world/<zone>.txt`: one character per tile (legend: {@link LEGEND}, documented in `tools/README.md`);
 * - `tools/world/world.json`: per map the base ground under buildings and trees, doors, map-edge links, the Audi,
 *   encounter rectangles and the `default` spawn.
 *
 * Output: `public/assets/tilesets/world.png` (8 columns of 32 px tiles: the 32 base tiles of {@link WT}, then the
 * look-alike variants that {@link autotile} picks; art in `tools/art/tiles.ts`; then the world redesign's extra
 * tiles, `tools/world-tiles.ts`) and `public/maps/<zone>.tmj` for every map (Tiled JSON, CSV layers, embedded tileset, layers
 * `ground`, `deco`, `collision`, `above`, `warps`, `encounters`, `spawns`).
 *
 * Warps are generated so every door and edge has its matching way back:
 * - a door `{ x, y, to }` on an outdoor map is a step warp on the door tile to the interior's doormat (`_` on its
 *   bottom row) facing up; the interior gets an off-map step warp below its doormat back to the tile under the
 *   door, facing down;
 * - an edge `{ side, from, to, map }` is an off-map step warp along that side (`from`–`to` are columns for
 *   north/south, rows for east/west) that keeps the column/row, plus the reverse warp on the other map;
 * - `car` puts the Audi's two tiles (`A`, `a` in the layout) under an `action` warp with the `car` property;
 * - `portal` puts the mystery door (`?` in the layout) under an `action` warp with the bool property `portal = true`.
 *
 * Like the other tools it NEVER overwrites an existing file (hand-edited maps are safe); pass `--force` to
 * regenerate everything.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_TILES, D, ROOF_ORDER, SIDE, VARIANT_TILES } from './art/tiles';
import { Pix } from './art/pixels';
import { EXTRA_ENCOUNTER, EXTRA_SOLID, EXTRA_TILES, XT } from './world-tiles';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
/** Folder with `world.json` and the `<zone>.txt` layouts. */
export const WORLD_DIR = join(ROOT, 'tools', 'world');
const T = 32;
const COLS = 8;

/** Local tile ids of `assets/tilesets/world.png` (0–13 are the same tiles as the test tileset). */
export const WT = {
  grass: 0,
  path: 1,
  wall: 2,
  water: 3,
  trunk: 4,
  treetop: 5,
  flowers: 6,
  tallgrass: 7,
  blocker: 8,
  door: 9,
  floor: 10,
  doormat: 11,
  carLeft: 12,
  carRight: 13,
  sand: 14,
  dune: 15,
  mountain: 16,
  vineyard: 17,
  road: 18,
  plaza: 19,
  roof: 20,
  counter: 21,
  desk: 22,
  cactus: 23,
  fence: 24,
  bridge: 25,
  desert: 26,
  shelf: 27,
  rock: 28,
  bush: 29,
  fountain: 30,
  whiteWall: 31,
} as const;

/** Tiles with `solid = true`. */
const SOLID: number[] = [
  WT.wall,
  WT.water,
  WT.blocker,
  WT.carLeft,
  WT.carRight,
  WT.mountain,
  WT.roof,
  WT.counter,
  WT.desk,
  WT.cactus,
  WT.fence,
  WT.shelf,
  WT.rock,
  WT.bush,
  WT.fountain,
  WT.whiteWall,
  ...EXTRA_SOLID,
];
/** Tiles with `encounter = true` (tall grass, dune grass, vineyard, the huerta's crops, dry scrub). */
const ENCOUNTER: number[] = [WT.tallgrass, WT.dune, WT.vineyard, ...EXTRA_ENCOUNTER];

/**
 * Layout characters. `ground` chars are drawn in the `ground` layer; `deco` chars are drawn in `deco` over the
 * map's base ground (`world.json › ground`). `T` is a tree: trunk in `deco`, blocked by the hidden `collision`
 * layer, top drawn in `above` on the tile above.
 */
export const LEGEND: Record<string, { layer: 'ground' | 'deco' | 'tree'; tile: number }> = {
  '.': { layer: 'ground', tile: WT.grass },
  ':': { layer: 'ground', tile: WT.path },
  '~': { layer: 'ground', tile: WT.water },
  ',': { layer: 'ground', tile: WT.tallgrass },
  '=': { layer: 'ground', tile: WT.floor },
  _: { layer: 'ground', tile: WT.doormat },
  s: { layer: 'ground', tile: WT.sand },
  S: { layer: 'ground', tile: WT.dune },
  v: { layer: 'ground', tile: WT.vineyard },
  r: { layer: 'ground', tile: WT.road },
  p: { layer: 'ground', tile: WT.plaza },
  d: { layer: 'ground', tile: WT.desert },
  b: { layer: 'ground', tile: WT.bridge },
  T: { layer: 'tree', tile: WT.trunk },
  '#': { layer: 'deco', tile: WT.wall },
  M: { layer: 'deco', tile: WT.mountain },
  f: { layer: 'deco', tile: WT.flowers },
  D: { layer: 'deco', tile: WT.door },
  A: { layer: 'deco', tile: WT.carLeft },
  a: { layer: 'deco', tile: WT.carRight },
  '^': { layer: 'deco', tile: WT.roof },
  C: { layer: 'deco', tile: WT.counter },
  K: { layer: 'deco', tile: WT.desk },
  c: { layer: 'deco', tile: WT.cactus },
  F: { layer: 'deco', tile: WT.fence },
  H: { layer: 'deco', tile: WT.shelf },
  R: { layer: 'deco', tile: WT.rock },
  '*': { layer: 'deco', tile: WT.bush },
  L: { layer: 'deco', tile: WT.fountain },
  W: { layer: 'deco', tile: WT.whiteWall },
  // World redesign (tiles from `world-tiles.ts`).
  u: { layer: 'ground', tile: XT.soil },
  o: { layer: 'ground', tile: XT.onion },
  l: { layer: 'ground', tile: XT.lettuce },
  e: { layer: 'ground', tile: XT.eggplant },
  w: { layer: 'ground', tile: XT.sea },
  '<': { layer: 'ground', tile: XT.wave },
  z: { layer: 'ground', tile: XT.shore },
  k: { layer: 'ground', tile: XT.sidewalk },
  x: { layer: 'ground', tile: XT.crosswalk },
  q: { layer: 'ground', tile: XT.paseo },
  n: { layer: 'ground', tile: XT.officeFloor },
  N: { layer: 'ground', tile: XT.carpet },
  P: { layer: 'ground', tile: XT.platform },
  J: { layer: 'ground', tile: XT.rails },
  m: { layer: 'ground', tile: XT.stationFloor },
  '/': { layer: 'ground', tile: XT.stairs },
  '7': { layer: 'ground', tile: XT.stoneBridge },
  '6': { layer: 'ground', tile: XT.boat },
  '"': { layer: 'ground', tile: XT.dryGrass },
  O: { layer: 'deco', tile: XT.orangeTree },
  Y: { layer: 'deco', tile: XT.palm },
  h: { layer: 'deco', tile: XT.whiteHouse },
  y: { layer: 'deco', tile: XT.creamHouse },
  I: { layer: 'deco', tile: XT.industrial },
  i: { layer: 'deco', tile: XT.industrialWindows },
  V: { layer: 'deco', tile: XT.ahoraFacade },
  Q: { layer: 'deco', tile: XT.logoA },
  U: { layer: 'deco', tile: XT.logoB },
  G: { layer: 'deco', tile: XT.logoC },
  Z: { layer: 'deco', tile: XT.shutter },
  B: { layer: 'deco', tile: XT.brick },
  E: { layer: 'deco', tile: XT.metroSign },
  X: { layer: 'deco', tile: XT.train },
  j: { layer: 'deco', tile: XT.trainDoor },
  g: { layer: 'deco', tile: XT.glass },
  '(': { layer: 'deco', tile: XT.sofa },
  '%': { layer: 'deco', tile: XT.plant },
  t: { layer: 'deco', tile: XT.meetingTable },
  '&': { layer: 'deco', tile: XT.modernDesk },
  $: { layer: 'deco', tile: XT.coffeeBar },
  '[': { layer: 'deco', tile: XT.screen },
  '!': { layer: 'deco', tile: XT.umbrella },
  '-': { layer: 'deco', tile: XT.towel },
  '|': { layer: 'deco', tile: XT.bench },
  '0': { layer: 'deco', tile: XT.bankWall },
  '1': { layer: 'deco', tile: XT.agora },
  '2': { layer: 'deco', tile: XT.cac },
  '3': { layer: 'deco', tile: XT.oldStone },
  '4': { layer: 'deco', tile: XT.plumTree },
  '5': { layer: 'deco', tile: XT.stationFacade },
  '+': { layer: 'deco', tile: XT.officeWall },
  '8': { layer: 'deco', tile: XT.flatRoof },
  '9': { layer: 'deco', tile: XT.greyRoof },
  '@': { layer: 'deco', tile: XT.assut },
  ')': { layer: 'deco', tile: XT.bullring },
  ';': { layer: 'deco', tile: XT.lamp },
  '?': { layer: 'deco', tile: XT.mysteryDoor },
  '{': { layer: 'ground', tile: XT.storyNode },
};

/** Base grounds a map can put under its deco tiles. */
const GROUNDS = {
  grass: WT.grass,
  sand: WT.sand,
  desert: WT.desert,
  road: WT.road,
  floor: WT.floor,
  sea: XT.sea,
  sidewalk: XT.sidewalk,
  office: XT.officeFloor,
  station: XT.stationFloor,
  soil: XT.soil,
} as const;

type Side = 'north' | 'south' | 'east' | 'west';

/** One map's entry in `world.json`. */
export interface WorldMapSpec {
  ground: keyof typeof GROUNDS;
  indoor?: boolean;
  /** `default` spawn; interiors default to the doormat. */
  spawn?: [number, number];
  doors?: { x: number; y: number; to: string }[];
  edges?: { side: Side; from: number; to: number; map: string }[];
  car?: { x: number; y: number; to: 'murcia' | 'valencia' };
  /** The mystery door to the story realm (`?` at (x, y)): an `action` warp with the property `portal = true`. */
  portal?: { x: number; y: number };
  /**
   * One-way step warps to any tile of another map (the metro and the train): `{ x, y, to, toX, toY, facing }`.
   * Not mirrored: the station on the other side lists its own link back.
   */
  links?: { x: number; y: number; to: string; toX: number; toY: number; facing: string }[];
  encounters?: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    group: string;
    mode: 'tiles' | 'all';
  }[];
}

/** `world.json`. */
export interface WorldSpec {
  maps: Record<string, WorldMapSpec>;
}

/** Read `world.json`. */
export function readWorld(dir: string = WORLD_DIR): WorldSpec {
  return JSON.parse(readFileSync(join(dir, 'world.json'), 'utf8')) as WorldSpec;
}

/** Read a layout file into rows; every row must have the same length and only legend characters. */
export function readLayout(id: string, dir: string = WORLD_DIR): string[] {
  const rows = readFileSync(join(dir, `${id}.txt`), 'utf8')
    .replace(/\r/g, '')
    .split('\n');
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  return checkLayout(id, rows);
}

/** Validate layout rows (pure): same width, known characters. Returns the rows. */
export function checkLayout(id: string, rows: string[]): string[] {
  if (rows.length === 0) throw new Error(`${id}.txt: empty layout`);
  const w = rows[0]!.length;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${id}.txt: row ${y} has ${row.length} tiles, expected ${w}`);
    [...row].forEach((ch, x) => {
      if (!(ch in LEGEND)) throw new Error(`${id}.txt: unknown tile "${ch}" at (${x}, ${y})`);
    });
  });
  return rows;
}

/** Every tile of `world.png` in local-id order: the 32 base tiles, then the variants. */
const ALL_TILES = [...BASE_TILES, ...VARIANT_TILES, ...EXTRA_TILES];
/** Number of tile rows in `world.png` (8 tiles per row). */
export const ROWS = Math.ceil(ALL_TILES.length / COLS);
/** Local id of every tile key (`grass`, `roof:blue:tl`, …). */
export const TILE_ID: ReadonlyMap<string, number> = new Map(ALL_TILES.map((t, i) => [t.key, i]));

/**
 * Draw the world tileset (`tools/art/tiles.ts`): 8 columns of 32 px tiles, the 32 base tiles first (ids 0–31, the
 * ids in {@link WT}), then every variant. Each tile is drawn at 16 × 16 and scaled ×2.
 */
export function drawWorldTileset(): Buffer {
  const sheet = new Pix(COLS * T, ROWS * T);
  ALL_TILES.forEach((t, i) => sheet.blit(t.draw().scale(T / D), (i % COLS) * T, Math.floor(i / COLS) * T));
  return sheet.png();
}

/** Tiled object (point spawn, warp or encounter rectangle) in tiles; written in pixels. */
interface ObjSpec {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: { name: string; type: 'string' | 'int' | 'bool'; value: string | number | boolean }[];
}

/** A warp object. `toX` / `toY` left out = keep the player's column / row. */
function warp(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  to: { map: string; x?: number; y?: number; facing?: string },
): ObjSpec {
  const properties: ObjSpec['properties'] = [{ name: 'toMap', type: 'string', value: to.map }];
  if (to.x !== undefined) properties.push({ name: 'toX', type: 'int', value: to.x });
  if (to.y !== undefined) properties.push({ name: 'toY', type: 'int', value: to.y });
  if (to.facing) properties.push({ name: 'toFacing', type: 'string', value: to.facing });
  properties.push({ name: 'trigger', type: 'string', value: 'step' });
  return { name, ...rect, properties };
}

const OPPOSITE: Record<Side, Side> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** The off-map warp rectangle along `side` of a `w × h` map, covering `from`–`to`. */
function edgeRect(side: Side, from: number, to: number, w: number, h: number) {
  const n = to - from + 1;
  if (side === 'north') return { x: from, y: -1, width: n, height: 1 };
  if (side === 'south') return { x: from, y: h, width: n, height: 1 };
  if (side === 'west') return { x: -1, y: from, width: 1, height: n };
  return { x: w, y: from, width: 1, height: n };
}

/** Where an edge warp lands on the target map (`w × h`) entering through `side` (column/row kept). */
function edgeArrival(side: Side, w: number, h: number): { x?: number; y?: number } {
  if (side === 'north') return { y: 0 };
  if (side === 'south') return { y: h - 1 };
  if (side === 'west') return { x: 0 };
  return { x: w - 1 };
}

/** The doormat (`_`) of an interior layout: on its bottom row. */
export function findDoormat(id: string, rows: string[]): { x: number; y: number } {
  const y = rows.length - 1;
  const x = rows[y]!.indexOf('_');
  if (x < 0) throw new Error(`${id}.txt: an interior needs a doormat "_" on its bottom row`);
  return { x, y };
}

/** Layout character of each base ground. */
const GROUND_CHAR: Record<keyof typeof GROUNDS, string> = {
  grass: '.',
  sand: 's',
  desert: 'd',
  road: 'r',
  floor: '=',
  sea: 'w',
  sidewalk: 'k',
  office: 'n',
  station: 'm',
  soil: 'u',
};

/**
 * Swap base tiles for their look-alike variants (`tools/art/tiles.ts › VARIANT_TILES`) from their neighbours, so
 * buildings get edges and windows, paths, roads, plazas and sand get a grass border, and water a shore. Off-map
 * neighbours count as "same", so nothing gets an edge along the map border. Only the art changes: every variant
 * has its base tile's `solid` / `encounter` properties.
 *
 * - `^` roof: ridge (top row), eave (bottom row), left and right edges; one colour per building (a connected block
 *   of `^`), cycling terracotta → blue → teal → ochre in reading order.
 * - `#` / `W` outdoor walls: under-the-eave shadow on a building's top wall row, a plinth (or tile band) on its
 *   bottom row, plain middle rows, side edges, and a window on every third column (not next to a door). Indoors, `#` is a papered wall face when the tile below is floor, else a
 *   dark wall top.
 * - `D` door: white frame when it stands in a `W` wall.
 * - `M` mountain: a cliff face when the tile below is not mountain.
 * - `:` path, `r` road, `p` plaza, `s` sand: grass border on each side whose neighbour stands on grass (`.` or
 *   `,`, or a deco tile on a grass map; a door never counts).
 * - `~` water: bank line and foam on each side touching land (a `b` bridge counts as water).
 */
export function autotile(rows: string[], spec: WorldMapSpec, layers: BuiltMap['layers']): void {
  const w = rows[0]!.length;
  const at = (x: number, y: number): string | undefined => rows[y]?.[x];
  const groundAt = (x: number, y: number): string | undefined => {
    const ch = at(x, y);
    if (ch === undefined) return undefined;
    return LEGEND[ch]!.layer === 'ground' ? ch : GROUND_CHAR[spec.ground];
  };
  // A door stands on the base ground, but the path in front of it should run into it without a border.
  const grassy = (x: number, y: number) => {
    if (at(x, y) === 'D') return false;
    const g = groundAt(x, y);
    return g === '.' || g === ',';
  };
  const mask = (x: number, y: number, edge: (x: number, y: number) => boolean) =>
    (edge(x, y - 1) ? SIDE.n : 0) |
    (edge(x + 1, y) ? SIDE.e : 0) |
    (edge(x, y + 1) ? SIDE.s : 0) |
    (edge(x - 1, y) ? SIDE.w : 0);
  const id = (key: string) => {
    const n = TILE_ID.get(key);
    if (n === undefined) throw new Error(`make-world: no tile "${key}"`);
    return n;
  };

  // Roof colour per connected block of `^`.
  const roofColour = new Map<number, string>();
  let blocks = 0;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '^' || roofColour.has(y * w + x)) return;
      const colour = ROOF_ORDER[blocks % ROOF_ORDER.length]!;
      blocks += 1;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (at(cx!, cy!) !== '^' || roofColour.has(cy! * w + cx!)) continue;
        roofColour.set(cy! * w + cx!, colour);
        stack.push([cx! + 1, cy!], [cx! - 1, cy!], [cx!, cy! + 1], [cx!, cy! - 1]);
      }
    }),
  );

  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const i = y * w + x;
      if (ch === '^') {
        const top = at(x, y - 1) !== '^';
        const bottom = at(x, y + 1) !== '^';
        const left = at(x - 1, y) !== '^';
        const right = at(x + 1, y) !== '^';
        const r = bottom ? 'b' : top ? 't' : 'm';
        const c = left && !right ? 'l' : right && !left ? 'r' : 'm';
        const colour = roofColour.get(i)!;
        layers.deco[i] =
          colour === 'terracotta' && r === 'm' && c === 'm' ? WT.roof : id(`roof:${colour}:${r}${c}`);
      } else if (ch === '#' && spec.indoor) {
        const below = at(x, y + 1);
        layers.deco[i] = id(below !== undefined && below !== '#' ? 'wall:indoorFace' : 'wall:indoorTop');
      } else if (ch === '#' || ch === 'W') {
        const same = (c: string | undefined) => c === ch || c === 'D';
        const upper = !same(at(x, y - 1));
        const left = !same(at(x - 1, y));
        const right = !same(at(x + 1, y));
        const c = left && !right ? 'l' : right && !left ? 'r' : 'm';
        const win = c === 'm' && x % 3 === 1 && at(x - 1, y) !== 'D' && at(x + 1, y) !== 'D';
        const base = ch === '#' ? 'wall' : 'whiteWall';
        const row = upper ? 'u' : same(at(x, y + 1)) ? 'c' : 'l';
        const key = `${base}:${row}${c}${win ? 'w' : ''}`;
        layers.deco[i] = TILE_ID.get(key) ?? (ch === '#' ? WT.wall : WT.whiteWall);
      } else if (ch === 'D') {
        if (at(x - 1, y) === 'W' || at(x + 1, y) === 'W') layers.deco[i] = id('door:white');
      } else if (ch === 'M') {
        const below = at(x, y + 1);
        if (below !== undefined && below !== 'M') layers.deco[i] = id('mountain:face');
      } else if (ch === '~') {
        const m = mask(x, y, (nx, ny) => {
          const n = at(nx, ny);
          return n !== undefined && n !== '~' && n !== 'b';
        });
        if (m) layers.ground[i] = id(`water:${m}`);
      } else if (ch === ':' || ch === 'r' || ch === 'p' || ch === 's') {
        const m = mask(x, y, grassy);
        const kind = { ':': 'path', r: 'road', p: 'plaza', s: 'sand' }[ch];
        if (m) layers.ground[i] = id(`${kind}:${m}`);
      }
    }),
  );
}

/** Layer grids, warps, encounters and spawns of one built map. */
export interface BuiltMap {
  width: number;
  height: number;
  layers: { ground: number[]; deco: number[]; collision: number[]; above: number[] };
  warps: ObjSpec[];
  encounters: ObjSpec[];
  spawns: ObjSpec[];
}

/** Build every map of the world (pure apart from reading the layouts through `layout`). */
export function buildWorld(
  world: WorldSpec,
  layout: (id: string) => string[] = (id) => readLayout(id),
): Map<string, BuiltMap> {
  const rows = new Map(Object.keys(world.maps).map((id) => [id, layout(id)]));
  const size = (id: string) => {
    const r = rows.get(id);
    if (!r) throw new Error(`world.json: unknown map "${id}"`);
    return { w: r[0]!.length, h: r.length };
  };
  const built = new Map<string, BuiltMap>();

  for (const [id, spec] of Object.entries(world.maps)) {
    const r = rows.get(id)!;
    const { w, h } = size(id);
    const base = GROUNDS[spec.ground];
    if (base === undefined) throw new Error(`world.json › ${id}: unknown ground "${spec.ground}"`);
    const grid = (fill: number) => new Array<number>(w * h).fill(fill);
    const layers = { ground: grid(base), deco: grid(-1), collision: grid(-1), above: grid(-1) };
    r.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const entry = LEGEND[ch]!;
        const i = y * w + x;
        if (entry.layer === 'ground') layers.ground[i] = entry.tile;
        else layers.deco[i] = entry.tile;
        if (entry.layer === 'tree') {
          layers.collision[i] = WT.blocker;
          if (y > 0) layers.above[i - w] = WT.treetop;
        }
      }),
    );
    autotile(r, spec, layers);
    const doormat = spec.indoor ? findDoormat(id, r) : null;
    built.set(id, {
      width: w,
      height: h,
      layers,
      warps: [],
      encounters: (spec.encounters ?? []).map((e) => ({
        name: e.name,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        properties: [
          { name: 'group', type: 'string', value: e.group },
          { name: 'mode', type: 'string', value: e.mode },
        ],
      })),
      spawns: [
        {
          name: 'default',
          x: spec.spawn?.[0] ?? doormat?.x ?? 0,
          y: spec.spawn?.[1] ?? doormat?.y ?? 0,
          point: true,
        },
      ],
    });
  }

  const charAt = (id: string, x: number, y: number) => rows.get(id)![y]?.[x];
  for (const [id, spec] of Object.entries(world.maps)) {
    const map = built.get(id)!;
    for (const door of spec.doors ?? []) {
      if (charAt(id, door.x, door.y) !== 'D')
        throw new Error(`world.json › ${id}: door to ${door.to} at (${door.x}, ${door.y}) is not a "D" tile`);
      const inside = world.maps[door.to];
      if (!inside?.indoor) throw new Error(`world.json › ${id}: door target "${door.to}" is not an interior`);
      const mat = findDoormat(door.to, rows.get(door.to)!);
      map.warps.push(
        warp(
          `door_${door.to}`,
          { x: door.x, y: door.y, width: 1, height: 1 },
          { map: door.to, ...mat, facing: 'up' },
        ),
      );
      built
        .get(door.to)!
        .warps.push(
          warp(
            'exit',
            { x: mat.x, y: mat.y + 1, width: 1, height: 1 },
            { map: id, x: door.x, y: door.y + 1, facing: 'down' },
          ),
        );
    }
    for (const edge of spec.edges ?? []) {
      const { w, h } = size(id);
      const other = size(edge.map);
      const back = OPPOSITE[edge.side];
      map.warps.push(
        warp(`edge_${edge.map}`, edgeRect(edge.side, edge.from, edge.to, w, h), {
          map: edge.map,
          ...edgeArrival(back, other.w, other.h),
        }),
      );
      built.get(edge.map)!.warps.push(
        warp(`edge_${id}`, edgeRect(back, edge.from, edge.to, other.w, other.h), {
          map: id,
          ...edgeArrival(edge.side, w, h),
        }),
      );
    }
    for (const link of spec.links ?? []) {
      if (!world.maps[link.to]) throw new Error(`world.json › ${id}: link to unknown map "${link.to}"`);
      map.warps.push(
        warp(
          `link_${link.to}`,
          { x: link.x, y: link.y, width: 1, height: 1 },
          { map: link.to, x: link.toX, y: link.toY, facing: link.facing },
        ),
      );
    }
    if (spec.car) {
      const { x, y, to } = spec.car;
      if (charAt(id, x, y) !== 'A' || charAt(id, x + 1, y) !== 'a')
        throw new Error(`world.json › ${id}: the car at (${x}, ${y}) needs "Aa" in the layout`);
      map.warps.push({
        name: 'audi',
        x,
        y,
        width: 2,
        height: 1,
        properties: [
          { name: 'car', type: 'string', value: to },
          { name: 'trigger', type: 'string', value: 'action' },
        ],
      });
    }
    if (spec.portal) {
      const { x, y } = spec.portal;
      if (charAt(id, x, y) !== '?')
        throw new Error(`world.json › ${id}: the portal at (${x}, ${y}) needs "?" in the layout`);
      map.warps.push({
        name: 'puerta_misteriosa',
        x,
        y,
        width: 1,
        height: 1,
        properties: [
          { name: 'portal', type: 'bool', value: true },
          { name: 'trigger', type: 'string', value: 'action' },
        ],
      });
    }
  }
  return built;
}

/** Tile properties written into the embedded tileset. */
function tileProps(): { id: number; properties: { name: string; type: 'bool'; value: boolean }[] }[] {
  const out = new Map<number, { name: string; type: 'bool'; value: boolean }[]>();
  // A variant tile has the properties of its base tile; an extra tile (world-tiles.ts) is its own base.
  const variantEnd = BASE_TILES.length + VARIANT_TILES.length;
  const baseOf = (id: number) =>
    id < BASE_TILES.length || id >= variantEnd
      ? id
      : TILE_ID.get(VARIANT_TILES[id - BASE_TILES.length]!.base)!;
  for (let id = 0; id < ALL_TILES.length; id += 1) {
    const base = baseOf(id);
    if (SOLID.includes(base)) out.set(id, [{ name: 'solid', type: 'bool', value: true }]);
    if (ENCOUNTER.includes(base))
      out.set(id, [...(out.get(id) ?? []), { name: 'encounter', type: 'bool', value: true }]);
  }
  return [...out].sort(([a], [b]) => a - b).map(([id, properties]) => ({ id, properties }));
}

/** Tiled JSON for a built map. */
export function tiledJson(map: BuiltMap): object {
  const { width: w, height: h } = map;
  const csv = (layer: number[]) => layer.map((id) => (id < 0 ? 0 : id + 1));
  let nextId = 1;
  let nextObj = 1;
  const tileLayer = (name: string, data: number[], visible = true) => ({
    id: nextId++,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: w,
    height: h,
    opacity: 1,
    visible,
    data: csv(data),
  });
  const obj = (o: ObjSpec) => ({
    id: nextObj++,
    name: o.name,
    type: '',
    x: o.x * T,
    y: o.y * T,
    width: (o.width ?? 0) * T,
    height: (o.height ?? 0) * T,
    rotation: 0,
    visible: true,
    ...(o.point ? { point: true } : {}),
    ...(o.properties ? { properties: o.properties } : {}),
  });
  const objectLayer = (name: string, list: ObjSpec[]) => ({
    id: nextId++,
    name,
    type: 'objectgroup',
    draworder: 'topdown',
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    objects: list.map(obj),
  });
  const layers = [
    tileLayer('ground', map.layers.ground),
    tileLayer('deco', map.layers.deco),
    tileLayer('collision', map.layers.collision, false),
    tileLayer('above', map.layers.above),
    objectLayer('warps', map.warps),
    objectLayer('encounters', map.encounters),
    objectLayer('spawns', map.spawns),
  ];
  return {
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: w,
    height: h,
    tilewidth: T,
    tileheight: T,
    nextlayerid: nextId,
    nextobjectid: nextObj,
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: 'world',
        image: '../assets/tilesets/world.png',
        imagewidth: COLS * T,
        imageheight: ROWS * T,
        tilewidth: T,
        tileheight: T,
        tilecount: COLS * ROWS,
        columns: COLS,
        margin: 0,
        spacing: 0,
        tiles: tileProps(),
      },
    ],
  };
}

/** Write `data` to `public/<rel>` unless it exists (or `force`). Returns true if written. */
function write(rel: string, data: Buffer | string, force: boolean): boolean {
  const path = join(PUBLIC_DIR, rel);
  if (existsSync(path) && !force) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return true;
}

/** Run the tool; returns the files written (relative to `public/`). */
export function makeWorld(force: boolean): string[] {
  const written: string[] = [];
  if (write('assets/tilesets/world.png', drawWorldTileset(), force))
    written.push('assets/tilesets/world.png');
  for (const [id, map] of buildWorld(readWorld())) {
    const rel = `maps/${id}.tmj`;
    if (write(rel, `${JSON.stringify(tiledJson(map), null, 1)}\n`, force)) written.push(rel);
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = makeWorld(process.argv.includes('--force'));
  process.stdout.write(
    written.length ? `Wrote:\n  ${written.join('\n  ')}\n` : 'Nothing to write (use --force).\n',
  );
}
