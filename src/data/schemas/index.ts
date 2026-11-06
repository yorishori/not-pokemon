/** The content files (`DATA_FILES`) and the zod schema of each. */
import { attacksFileSchema } from './attacks';
import { carFileSchema } from './car';
import { flexymonFileSchema } from './flexymon';
import { introFileSchema } from './intro';
import { itemsFileSchema } from './items';
import { npcsFileSchema } from './npcs';
import { secretNamesFileSchema } from './secret-names';
import { shopsFileSchema } from './shops';
import { soundsFileSchema } from './sounds';
import { startFileSchema } from './start';
import { storyFileSchema } from './story';
import { zonesFileSchema } from './zones';

/** File name (inside `public/data/`) → schema. The order is the load and report order. */
export const FILE_SCHEMAS = {
  'flexymon.json': flexymonFileSchema,
  'attacks.json': attacksFileSchema,
  'items.json': itemsFileSchema,
  'npcs.json': npcsFileSchema,
  'zones.json': zonesFileSchema,
  'shops.json': shopsFileSchema,
  'start.json': startFileSchema,
  'secret-names.json': secretNamesFileSchema,
  'car.json': carFileSchema,
  'intro.json': introFileSchema,
  'sounds.json': soundsFileSchema,
  'story.json': storyFileSchema,
} as const;

/** Name of one content file. */
export type DataFileName = keyof typeof FILE_SCHEMAS;

/** Every content file name, in load order. */
export const DATA_FILES = Object.keys(FILE_SCHEMAS) as DataFileName[];

export * from './attacks';
export * from './car';
export * from './common';
export * from './flexymon';
export * from './intro';
export * from './items';
export * from './npcs';
export * from './secret-names';
export * from './shops';
export * from './sounds';
export * from './start';
export * from './story';
export * from './zones';
