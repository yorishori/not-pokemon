/**
 * Map-dependent load checks, run after the content passed its schemas and cross-references and
 * every zone's map was loaded:
 * - every NPC spawn, the start spawn/respawn and both car endpoints are walkable tiles of their map;
 * - every named spawn point in a map's `spawns` layer is walkable;
 * - every warp points at an existing zone, and every tile it can land on there is walkable (for edge
 *   warps that keep the row/column, every tile of the rectangle is checked). Car warps have no target
 *   of their own: they use the car.json endpoints checked above. Portal warps (the mystery door) have none either.
 * - every encounter rectangle's `group` exists in its zone's `encounters` in zones.json.
 * - the intro (`intro.json`) plays on the `start.json › spawn` map: the coworker's start tile and every
 *   tile either actor walks onto are walkable, and no walk enters the tile where the other actor stands.
 * - the story map (`story.json › map`): every stop is walkable, every leg of `path` between two stops is a straight
 *   line over walkable tiles, and every boss's `stand` tile lies inside the map.
 * {@link mapWarnings} lists the opposite case (a group in zones.json drawn on no rectangle): a warning,
 * not an error, so content can be added to zones.json before the map is drawn.
 * "Walkable" = inside the map and not solid (`src/data/tiled.ts`). Errors use the usual
 * `file › path › message` format; warp errors name the map file and the warp, e.g.
 * `maps/test.tmj › warps.house_door › target (4, 7) on map "test_house" is not walkable`.
 */
import type { DataError } from './errors';
import type { GameData } from './game-data';
import type { MapPoint } from './schemas';
import { isWalkable, type MapInfo } from './tiled';
import { warpTargetTiles } from '../logic/warp';
import { traceIntro } from '../logic/intro';
import { legTiles, storyStops } from '../logic/story';

/** Why a tile on `mapId` is not a valid place to stand, or `null` if it is. */
function tileProblem(maps: ReadonlyMap<string, MapInfo>, mapId: string, x: number, y: number): string | null {
  const info = maps.get(mapId);
  if (!info) return null; // Missing map is reported once by the loader.
  if (x >= info.width || y >= info.height || x < 0 || y < 0)
    return `tile (${x}, ${y}) is outside map "${mapId}" (${info.width} × ${info.height})`;
  return isWalkable(info, x, y) ? null : `tile (${x}, ${y}) on map "${mapId}" is not walkable`;
}

/** Run every map-dependent check. `maps` holds the parsed map of every zone that loaded. */
export function checkMaps(data: GameData, maps: ReadonlyMap<string, MapInfo>): DataError[] {
  const errors: DataError[] = [];
  const point = (file: string, path: PropertyKey[], p: MapPoint | { map: string; x: number; y: number }) => {
    const problem = tileProblem(maps, p.map, p.x, p.y);
    if (problem) errors.push({ file, path, message: problem });
  };

  [...data.npcs.values()].forEach((npc, i) =>
    point('npcs.json', [i, 'spawn'], { map: npc.map, x: npc.spawn.x, y: npc.spawn.y }),
  );
  point('start.json', ['spawn'], data.start.spawn);
  point('start.json', ['respawn'], data.start.respawn);
  point('car.json', ['toMurcia'], data.car.toMurcia);
  point('car.json', ['toValencia'], data.car.toValencia);

  // The intro script walks on the start map.
  const { spawn } = data.start;
  const { coworker } = data.intro;
  const trace = traceIntro(data.intro.steps, spawn, coworker);
  for (const v of trace.visits) {
    const path: PropertyKey[] = v.step < 0 ? (v.actor === 'coworker' ? ['coworker'] : []) : ['steps', v.step];
    if (v.step < 0 && v.actor === 'player') continue; // start.json › spawn is checked above.
    const problem = tileProblem(maps, spawn.map, v.x, v.y);
    if (problem) errors.push({ file: 'intro.json', path, message: `${v.actor}: ${problem}` });
    else if (v.x === v.other.x && v.y === v.other.y)
      errors.push({
        file: 'intro.json',
        path,
        message: `${v.actor} would stand on the other actor's tile (${v.x}, ${v.y})`,
      });
  }

  // The story map: every stop is walkable, every leg between stops is straight and walkable, bosses stand inside.
  const { story } = data;
  const storyInfo = maps.get(story.map);
  if (storyInfo) {
    const stops = storyStops(story);
    stops.forEach((stop, i) => {
      const path: PropertyKey[] = i === 0 ? ['office'] : ['bosses', i - 1];
      const problem = tileProblem(maps, story.map, stop.x, stop.y);
      if (problem) errors.push({ file: 'story.json', path, message: problem });
      const prev = stops[i - 1];
      if (prev) {
        const tiles = legTiles(prev, stop.path, stop);
        if (!tiles)
          errors.push({
            file: 'story.json',
            path: [...path, 'path'],
            message: 'every leg must be a straight line',
          });
        for (const t of tiles ?? []) {
          const bad = tileProblem(maps, story.map, t.x, t.y);
          if (bad) errors.push({ file: 'story.json', path: [...path, 'path'], message: bad });
        }
      }
      if (i > 0) {
        const { x, y } = story.bosses[i - 1]!.stand;
        if (x >= storyInfo.width || y >= storyInfo.height)
          errors.push({
            file: 'story.json',
            path: [...path, 'stand'],
            message: `tile (${x}, ${y}) is outside map "${story.map}"`,
          });
      }
    });
  }

  for (const zone of data.zones.values()) {
    const info = maps.get(zone.id);
    if (!info) continue;
    for (const sp of info.spawns) {
      const problem = tileProblem(maps, zone.id, sp.x, sp.y);
      if (problem) errors.push({ file: zone.file, path: ['spawns', sp.name], message: problem });
    }
    info.encounters.forEach((rect) => {
      if (!Object.hasOwn(zone.encounters, rect.group)) {
        errors.push({
          file: zone.file,
          path: ['encounters', rect.name],
          message: `unknown encounter group "${rect.group}" (not in zones.json › ${zone.id}.encounters)`,
        });
      }
    });
    for (const warp of info.warps) {
      const path = ['warps', warp.name];
      if (warp.car) continue; // The Audi drives to car.json › toMurcia / toValencia (checked above).
      if (warp.portal) continue; // The mystery door opens the story realm (story.json), not a map tile.
      if (!data.zones.has(warp.toMap)) {
        errors.push({ file: zone.file, path, message: `unknown map "${warp.toMap}"` });
        continue;
      }
      for (const t of warpTargetTiles(warp)) {
        const problem = tileProblem(maps, warp.toMap, t.x, t.y);
        if (problem) errors.push({ file: zone.file, path, message: `target ${problem}` });
      }
    }
  }
  return errors;
}

/**
 * Encounter groups in zones.json that no rectangle of the zone's map uses. Logged as warnings at
 * boot, e.g. `zones.json › test.encounters.playa › group not used by any rectangle in maps/test.tmj`.
 */
export function mapWarnings(data: GameData, maps: ReadonlyMap<string, MapInfo>): DataError[] {
  const warnings: DataError[] = [];
  for (const zone of data.zones.values()) {
    const info = maps.get(zone.id);
    if (!info) continue;
    const used = new Set(info.encounters.map((r) => r.group));
    for (const group of Object.keys(zone.encounters)) {
      if (!used.has(group)) {
        warnings.push({
          file: 'zones.json',
          path: [zone.id, 'encounters', group],
          message: `group not used by any rectangle in ${zone.file}`,
        });
      }
    }
  }
  return warnings;
}
