/**
 * The validated, frozen content of the game, with lookup maps by id
 * (`data.flexymon.get('portatil')`). Built once at boot by the loader; read anywhere via {@link getGameData}.
 */
import type {
  Attack,
  Car,
  Intro,
  Item,
  Npc,
  SecretName,
  Sounds,
  Species,
  Start,
  Story,
  Zone,
} from './schemas';
import type { MapInfo } from './tiled';

/** A zone's map: what the rules need (`info`, frozen) and the raw Tiled JSON (for Phaser to draw). */
export interface LoadedMap {
  readonly info: Readonly<MapInfo>;
  /** The parsed `.tmj` JSON. Not frozen; give Phaser a copy. */
  readonly json: unknown;
}

/** All game content after validation. Every collection is read-only and deeply frozen. */
export interface GameData {
  readonly flexymon: ReadonlyMap<string, Readonly<Species>>;
  readonly attacks: ReadonlyMap<string, Readonly<Attack>>;
  readonly items: ReadonlyMap<string, Readonly<Item>>;
  readonly npcs: ReadonlyMap<string, Readonly<Npc>>;
  readonly zones: ReadonlyMap<string, Readonly<Zone>>;
  /** Shop id → item ids it sells. */
  readonly shops: ReadonlyMap<string, readonly string[]>;
  readonly start: Readonly<Start>;
  readonly secretNames: readonly Readonly<SecretName>[];
  readonly car: Readonly<Car>;
  /** Title image and new-game intro script (`intro.json`). */
  readonly intro: Readonly<Intro>;
  /** Interface sounds by kind (`sounds.json`). */
  readonly sounds: Readonly<Sounds>;
  /** The story realm behind the mystery door (`story.json`). */
  readonly story: Readonly<Story>;
  /** Zone id → its loaded map. Empty when only the JSON content was validated (unit tests). */
  readonly maps: ReadonlyMap<string, LoadedMap>;
}

/** The parsed (schema-valid) contents of the content files, before lookup maps are built. */
export interface RawGameData {
  flexymon: Species[];
  attacks: Attack[];
  items: Item[];
  npcs: Npc[];
  zones: Zone[];
  shops: Record<string, string[]>;
  start: Start;
  secretNames: SecretName[];
  car: Car;
  intro: Intro;
  sounds: Sounds;
  story: Story;
}

/** Recursively freeze plain objects and arrays. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * Freeze a ReadonlyMap: its mutating methods throw. (`Object.freeze` does not stop `Map.set`.)
 */
function frozenMap<V>(entries: Iterable<[string, V]>): ReadonlyMap<string, V> {
  const map = new Map(entries);
  const fail = (): never => {
    throw new TypeError('GameData is read-only');
  };
  Object.assign(map, { set: fail, delete: fail, clear: fail });
  return Object.freeze(map);
}

const byId = <T extends { id: string }>(list: T[]): ReadonlyMap<string, T> =>
  frozenMap(list.map((it) => [it.id, it] as [string, T]));

/** Build the frozen {@link GameData} from schema-valid raw data (ids are assumed unique). */
export function buildGameData(raw: RawGameData): GameData {
  const frozen = deepFreeze(raw);
  return Object.freeze({
    flexymon: byId(frozen.flexymon),
    attacks: byId(frozen.attacks),
    items: byId(frozen.items),
    npcs: byId(frozen.npcs),
    zones: byId(frozen.zones),
    shops: frozenMap(Object.entries(frozen.shops)),
    start: frozen.start,
    secretNames: frozen.secretNames,
    car: frozen.car,
    intro: frozen.intro,
    sounds: frozen.sounds,
    story: frozen.story,
    maps: frozenMap<LoadedMap>([]),
  });
}

/** A copy of `data` with its maps set (`info` is deep-frozen, `json` is left as is). */
export function withMaps(data: GameData, maps: Iterable<[string, LoadedMap]>): GameData {
  const entries = [...maps].map(([id, m]): [string, LoadedMap] => [
    id,
    Object.freeze({ info: deepFreeze(m.info), json: m.json }),
  ]);
  return Object.freeze({ ...data, maps: frozenMap(entries) });
}

let current: GameData | null = null;

/** Store the loaded data (called by BootScene). */
export function setGameData(data: GameData): void {
  current = data;
}

/** The loaded data. Throws if called before BootScene finished loading. */
export function getGameData(): GameData {
  if (!current) throw new Error('GameData not loaded yet');
  return current;
}

/** True once data has been loaded. */
export function hasGameData(): boolean {
  return current !== null;
}
