/**
 * Reading Tiled maps (`public/maps/*.tmj`: Tiled JSON, orthogonal, CSV layers, embedded tilesets).
 * Pure (no Phaser): the OverworldScene hands Phaser the same JSON for drawing, and uses
 * {@link parseTiledMap} for the rules (which tiles block, where the spawn points are).
 *
 * Map conventions (docs/MAPS.md):
 * - Tile layers `ground`, `deco`, `above` (drawn over the player) and `collision` (hidden in game).
 * - A cell is solid if ANY tile layer has a tile there whose tileset tile has the bool property
 *   `solid = true`. Tiles with `encounter = true` mark grass/sand/vineyard.
 * - Object layer `warps`: rectangles with `toMap` (string), `toX` / `toY` (int, optional = keep
 *   the player's column / row), `toFacing` (optional) and `trigger` (`step` or `action`); see
 *   `src/logic/warp.ts`. Rectangles may lie one tile outside the map (edge warps). A warp with the
 *   string property `car` (`murcia` or `valencia`) is the Audi: it must use `trigger = action`, and its
 *   destination comes from car.json, so it needs no `toMap`. A warp with the bool property `portal = true` is
 *   the mystery door to the story realm (`story.json`): it must use `trigger = action` and needs no `toMap`.
 * - Object layer `encounters`: rectangles with the string properties `group` (a key of the zone's
 *   `encounters` in zones.json) and `mode` (`tiles`: only tiles with `encounter = true`; `all`: every
 *   tile, urban crowds); see `src/logic/encounter.ts`. The object name is only used in messages.
 * - Object layer `spawns`. Spawn points are point (or tile-sized)
 *   objects in `spawns`; their tile is `floor(x / tilewidth)`, `floor(y / tileheight)`. The one named
 *   `default` is the zone's spawn (used by debug teleport and when no position is given).
 */
import { z } from 'zod';
import type { EncounterRect } from '../logic/encounter';
import type { Warp } from '../logic/warp';
import { facingSchema } from './schemas/common';

const propertySchema = z.object({ name: z.string(), type: z.string().optional(), value: z.unknown() });

const objectSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  type: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().default(0),
  height: z.number().default(0),
  point: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
});

const tileLayerSchema = z.object({
  type: z.literal('tilelayer'),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  data: z.array(z.number()),
  visible: z.boolean().optional(),
});

const objectLayerSchema = z.object({
  type: z.literal('objectgroup'),
  name: z.string(),
  objects: z.array(objectSchema),
});

const tilesetSchema = z.object({
  firstgid: z.number().int().min(1),
  name: z.string(),
  image: z.string(),
  tilewidth: z.number(),
  tileheight: z.number(),
  tilecount: z.number(),
  columns: z.number(),
  tiles: z.array(z.object({ id: z.number(), properties: z.array(propertySchema).optional() })).optional(),
});

/** The subset of the Tiled JSON format the game reads. Unknown fields are allowed (Tiled writes many). */
export const tiledMapSchema = z.object({
  orientation: z.literal('orthogonal'),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tilewidth: z.number(),
  tileheight: z.number(),
  layers: z.array(
    z.union([tileLayerSchema, objectLayerSchema, z.object({ type: z.string(), name: z.string() })]),
  ),
  tilesets: z.array(tilesetSchema).min(1, 'needs an embedded tileset'),
});

/** Raw Tiled JSON (validated subset). */
export type TiledMap = z.infer<typeof tiledMapSchema>;
/** One embedded tileset. */
export type TiledTileset = z.infer<typeof tilesetSchema>;
/** One Tiled object. */
export type TiledObject = z.infer<typeof objectSchema>;

/** Tile layer names the game draws, bottom to top (`collision` is never drawn). */
export const TILE_LAYERS = ['ground', 'deco', 'above', 'collision'] as const;

/** A named spawn point in tiles. */
export interface SpawnPoint {
  name: string;
  x: number;
  y: number;
}

/** What the game needs from a map besides the picture. */
export interface MapInfo {
  width: number;
  height: number;
  /** Row-major: `solid[y * width + x]`. */
  solid: boolean[];
  /** Row-major: tiles with `encounter = true`. */
  encounter: boolean[];
  spawns: SpawnPoint[];
  /** Warp rectangles in tiles, in layer order. */
  warps: Warp[];
  /** Encounter rectangles in tiles, in layer order (the first match wins). */
  encounters: (EncounterRect & { name: string })[];
  /** Tileset images, resolved relative to `public/` (e.g. `assets/tilesets/test.png`), by tileset name. */
  tilesetImages: { name: string; path: string }[];
}

/** Read a Tiled custom property (bool/int/string) from a property list. */
export function tiledProperty(
  props: readonly { name: string; value: unknown }[] | undefined,
  name: string,
): unknown {
  return props?.find((p) => p.name === name)?.value;
}

/** Resolve a path written inside a map file (relative to the map) to a path relative to `public/`. */
export function resolveMapPath(mapFile: string, relative: string): string {
  const parts = mapFile.split('/').slice(0, -1);
  for (const seg of relative.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

/** Global tile ids (gids) whose tileset tile has the bool property `name = true`. */
function gidsWith(map: TiledMap, name: string): Set<number> {
  const out = new Set<number>();
  for (const ts of map.tilesets) {
    for (const tile of ts.tiles ?? []) {
      if (tiledProperty(tile.properties, name) === true) out.add(ts.firstgid + tile.id);
    }
  }
  return out;
}

/** Warp object properties (after reading them from the Tiled property list). */
const warpPropsSchema = z
  .object({
    toMap: z.string(),
    toX: z.int().nullable(),
    toY: z.int().nullable(),
    toFacing: facingSchema.nullable(),
    trigger: z.enum(['step', 'action']),
    car: z.enum(['murcia', 'valencia']).nullable(),
    portal: z.boolean(),
  })
  .superRefine((w, ctx) => {
    if (w.car === null && !w.portal && w.toMap === '')
      ctx.addIssue({ code: 'custom', path: ['toMap'], message: 'needs a toMap property' });
    if (w.car !== null && w.trigger !== 'action')
      ctx.addIssue({ code: 'custom', path: ['trigger'], message: 'a car warp needs trigger = action' });
    if (w.portal && w.trigger !== 'action')
      ctx.addIssue({ code: 'custom', path: ['trigger'], message: 'a portal warp needs trigger = action' });
  });

/** Read one warp object; throws a message naming the warp if a property is missing or wrong. */
function parseWarp(o: TiledObject, index: number, map: TiledMap, mapFile: string): Warp {
  const prop = (name: string) => tiledProperty(o.properties, name) ?? null;
  const parsed = warpPropsSchema.safeParse({
    toMap: prop('toMap') ?? '',
    toX: prop('toX'),
    toY: prop('toY'),
    toFacing: prop('toFacing'),
    trigger: prop('trigger'),
    car: prop('car'),
    portal: prop('portal') === true,
  });
  const label = o.name ? `"${o.name}"` : `#${index}`;
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${mapFile}: warp ${label}: ${issue?.path.join('.') ?? ''} ${issue?.message ?? 'invalid'}`.trim(),
    );
  }
  return {
    name: o.name || `#${index}`,
    x: Math.floor(o.x / map.tilewidth),
    y: Math.floor(o.y / map.tileheight),
    width: Math.max(1, Math.round(o.width / map.tilewidth)),
    height: Math.max(1, Math.round(o.height / map.tileheight)),
    ...parsed.data,
  };
}

/** Encounter object properties (after reading them from the Tiled property list). */
const encounterPropsSchema = z.object({
  group: z.string().min(1, 'needs a group property'),
  mode: z.enum(['tiles', 'all'], 'mode must be "tiles" or "all"'),
});

/** Read one encounter rectangle; throws a message naming it if `group` or `mode` is missing or wrong. */
function parseEncounter(
  o: TiledObject,
  index: number,
  map: TiledMap,
  mapFile: string,
): EncounterRect & { name: string } {
  const parsed = encounterPropsSchema.safeParse({
    group: tiledProperty(o.properties, 'group') ?? '',
    mode: tiledProperty(o.properties, 'mode'),
  });
  const label = o.name ? `"${o.name}"` : `#${index}`;
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${mapFile}: encounter ${label}: ${issue?.message ?? 'invalid'}`);
  }
  return {
    name: o.name || `#${index}`,
    x: Math.floor(o.x / map.tilewidth),
    y: Math.floor(o.y / map.tileheight),
    width: Math.max(1, Math.round(o.width / map.tilewidth)),
    height: Math.max(1, Math.round(o.height / map.tileheight)),
    ...parsed.data,
  };
}

/** Tiled stores flip flags in the top 3 bits of a gid; strip them. */
const GID_MASK = 0x1fffffff;

/**
 * Validate and read a map. `mapFile` is its path relative to `public/` (for resolving tileset images).
 * Throws a readable `Error` if the JSON is not a map the game can use.
 */
export function parseTiledMap(json: unknown, mapFile: string): MapInfo {
  const parsed = tiledMapSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${mapFile}: ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'invalid map'}`);
  }
  const map = parsed.data;
  const size = map.width * map.height;
  const solidGids = gidsWith(map, 'solid');
  const encounterGids = gidsWith(map, 'encounter');
  const solid = new Array<boolean>(size).fill(false);
  const encounter = new Array<boolean>(size).fill(false);

  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer' || !('data' in layer)) continue;
    const data = layer.data as number[];
    if (data.length !== size)
      throw new Error(`${mapFile}: layer "${layer.name}" has ${data.length} cells, expected ${size}`);
    data.forEach((raw, i) => {
      const gid = raw & GID_MASK;
      if (solidGids.has(gid)) solid[i] = true;
      if (encounterGids.has(gid)) encounter[i] = true;
    });
  }

  const spawns: SpawnPoint[] = [];
  const spawnLayer = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'spawns');
  if (spawnLayer && 'objects' in spawnLayer) {
    for (const o of spawnLayer.objects as TiledObject[]) {
      spawns.push({ name: o.name, x: Math.floor(o.x / map.tilewidth), y: Math.floor(o.y / map.tileheight) });
    }
  }

  const warps: Warp[] = [];
  const warpLayer = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'warps');
  if (warpLayer && 'objects' in warpLayer) {
    (warpLayer.objects as TiledObject[]).forEach((o, i) => warps.push(parseWarp(o, i, map, mapFile)));
  }

  const encounters: MapInfo['encounters'] = [];
  const encounterLayer = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'encounters');
  if (encounterLayer && 'objects' in encounterLayer) {
    (encounterLayer.objects as TiledObject[]).forEach((o, i) =>
      encounters.push(parseEncounter(o, i, map, mapFile)),
    );
  }

  return {
    width: map.width,
    height: map.height,
    solid,
    encounter,
    spawns,
    warps,
    encounters,
    tilesetImages: map.tilesets.map((ts) => ({ name: ts.name, path: resolveMapPath(mapFile, ts.image) })),
  };
}

/** True if (x, y) is inside the map and not solid (a valid place to stand). */
export function isWalkable(info: MapInfo, x: number, y: number): boolean {
  return !isBlocked(info, x, y);
}

/** True if (x, y) is outside the map or on a solid cell. */
export function isBlocked(info: MapInfo, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= info.width || y >= info.height) return true;
  return info.solid[y * info.width + x] === true;
}

/** The spawn point named `name` (default `default`), or `null`. */
export function findSpawn(info: MapInfo, name = 'default'): SpawnPoint | null {
  return info.spawns.find((s) => s.name === name) ?? null;
}
