/**
 * Content loader: fetches the content JSON files (`DATA_FILES`) from `public/data/`, parses them, validates each with
 * its zod schema, runs the cross-reference checks and builds the frozen {@link GameData}. With
 * `mapsBaseUrl` it then fetches every zone's Tiled map, parses it (`src/data/tiled.ts`) and runs the
 * map checks (`src/data/map-checks.ts`).
 * Any problem is returned as a list of {@link DataError}s for the ErrorScene; nothing throws.
 */
import type { z } from 'zod';
import { checkCrossRefs } from './cross-refs';
import type { DataError } from './errors';
import { buildGameData, withMaps, type GameData, type LoadedMap, type RawGameData } from './game-data';
import { checkMaps, mapWarnings } from './map-checks';
import { parseTiledMap, type MapInfo } from './tiled';
import { DATA_FILES, FILE_SCHEMAS, type DataFileName } from './schemas';

/**
 * Result of loading or validating content. `warnings` (unused encounter groups) do not stop the
 * game; Boot logs them.
 */
export type LoadResult =
  { ok: true; data: GameData; warnings?: DataError[] } | { ok: false; errors: DataError[] };

/** Raw file contents: already-parsed JSON, or a {@link FileFailure} if it could not be read/parsed. */
export type RawFiles = Record<DataFileName, unknown>;

/** Marks a file that could not be fetched or parsed. */
export class FileFailure {
  /** @param message why the file could not be used */
  constructor(readonly message: string) {}
}

/**
 * Validate already-parsed file contents (pure; used by the loader and by unit tests).
 * Schema errors are reported for every file; cross-references are checked only when all schemas pass.
 */
export function validateGameData(files: RawFiles): LoadResult {
  const errors: DataError[] = [];
  const parsed: Partial<Record<DataFileName, unknown>> = {};

  for (const file of DATA_FILES) {
    const value = files[file];
    if (value instanceof FileFailure) {
      errors.push({ file, path: [], message: value.message });
      continue;
    }
    const schema: z.ZodType = FILE_SCHEMAS[file];
    const result = schema.safeParse(value);
    if (result.success) parsed[file] = result.data;
    else
      for (const issue of result.error.issues)
        errors.push({ file, path: issue.path, message: issue.message });
  }
  if (errors.length > 0) return { ok: false, errors };

  const raw = {
    flexymon: parsed['flexymon.json'],
    attacks: parsed['attacks.json'],
    items: parsed['items.json'],
    npcs: parsed['npcs.json'],
    zones: parsed['zones.json'],
    shops: parsed['shops.json'],
    start: parsed['start.json'],
    secretNames: parsed['secret-names.json'],
    car: parsed['car.json'],
    intro: parsed['intro.json'],
    sounds: parsed['sounds.json'],
    story: parsed['story.json'],
  } as RawGameData; // Safe: every entry passed its schema above.

  const refErrors = checkCrossRefs(raw);
  if (refErrors.length > 0) return { ok: false, errors: refErrors };
  return { ok: true, data: buildGameData(raw) };
}

/** Fetches one file's text; rejects (or throws) on failure. */
export type TextFetcher = (url: string) => Promise<string>;

/** Default fetcher: `fetch` that treats non-2xx responses as failures. */
export const fetchText: TextFetcher = async (url) => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/**
 * Fetch and parse every zone's map from `baseUrl` + `zone.file` (e.g. `./` + `maps/test.tmj`), then run
 * the map checks (plus the warnings of `mapWarnings`). A map that cannot be fetched, parsed or read is reported as `maps/x.tmj › (root) › …`.
 */
export async function loadMaps(
  data: GameData,
  baseUrl: string,
  fetcher: TextFetcher = fetchText,
): Promise<LoadResult> {
  const errors: DataError[] = [];
  const loaded = await Promise.all(
    [...data.zones.values()].map(async (zone): Promise<[string, LoadedMap] | null> => {
      try {
        const json = JSON.parse(await fetcher(`${baseUrl}${zone.file}`)) as unknown;
        return [zone.id, { info: parseTiledMap(json, zone.file), json }];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({
          file: zone.file,
          path: [],
          message: msg.startsWith(`${zone.file}: `)
            ? msg.slice(zone.file.length + 2)
            : `could not load map (${msg})`,
        });
        return null;
      }
    }),
  );
  const maps = new Map(loaded.filter((m): m is [string, LoadedMap] => m !== null));
  const infos = new Map<string, MapInfo>([...maps].map(([id, m]) => [id, m.info]));
  errors.push(...checkMaps(data, infos));
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: withMaps(data, maps), warnings: mapWarnings(data, infos) };
}

/** Options for {@link loadGameData}. */
export interface LoadOptions {
  /** Where `zones.json › file` paths are relative to (the `public/` root URL). Omit to skip maps. */
  mapsBaseUrl?: string;
}

/**
 * Fetch, parse and validate every content file from `baseUrl` (e.g. `./data/`), then (with
 * `options.mapsBaseUrl`) the maps. Fetch and JSON errors become `file › (root) › …` errors.
 */
export async function loadGameData(
  baseUrl: string,
  fetcher: TextFetcher = fetchText,
  options: LoadOptions = {},
): Promise<LoadResult> {
  const entries = await Promise.all(
    DATA_FILES.map(async (file): Promise<[DataFileName, unknown]> => {
      let text: string;
      try {
        text = await fetcher(`${baseUrl}${file}`);
      } catch (e) {
        return [file, new FileFailure(`could not load file (${e instanceof Error ? e.message : String(e)})`)];
      }
      try {
        return [file, JSON.parse(text) as unknown];
      } catch (e) {
        return [file, new FileFailure(`invalid JSON (${e instanceof Error ? e.message : String(e)})`)];
      }
    }),
  );
  const result = validateGameData(Object.fromEntries(entries) as RawFiles);
  if (!result.ok || options.mapsBaseUrl === undefined) return result;
  return loadMaps(result.data, options.mapsBaseUrl, fetcher);
}
