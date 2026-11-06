/**
 * Schema for `public/data/story.json`: the story realm (*Modo historia*) behind the office's mystery door.
 *
 * - `map`: the zone (a key of `zones.json`) drawn as the story board; `music` plays while it shows.
 * - `budget`: euros to spend on items; `teamSize`: how many different flexymon the player picks; `shop`: the item
 *   ids sold at the office point (they must have a price and be usable in battle; cross-references).
 * - `door`, `welcome`, `victory`: dialogue for the mystery door, the first visit and the last boss beaten.
 * - `office`: the first stop on the map (no boss). `bosses`: the other stops in order, each with its landmark
 *   name (`place`), the tile the boss stands on (`stand`), speeches and a team (1–6) with optional stat bonuses.
 * - Each stop is reached from the previous one along `path`: the corner tiles in between (both ends left out);
 *   every leg must be a straight line. The map checks walk every tile of it (`src/data/map-checks.ts`).
 */
import { z } from 'zod';
import { EUROS_MAX, TEAM_MAX } from '../../logic/constants';
import {
  dialogueSchema,
  facingSchema,
  idSchema,
  imagePathSchema,
  soundPathSchema,
  textSchema,
  tileCoordSchema,
  tilePointSchema,
} from './common';

/** A stat bonus added to a boss's flexymon (each stat 0–999, left out = 0). */
export const storyBonusSchema = z.strictObject({
  hp: z.int().min(0).max(999).optional(),
  attack: z.int().min(0).max(999).optional(),
  defense: z.int().min(0).max(999).optional(),
  speed: z.int().min(0).max(999).optional(),
});

/** One member of a boss team: a species id and an optional bonus. */
export const storyMemberSchema = z.strictObject({ id: idSchema, bonus: storyBonusSchema.optional() });

const stop = {
  place: textSchema,
  x: tileCoordSchema,
  y: tileCoordSchema,
  path: z.array(tilePointSchema),
};

/** One boss stop on the story map. */
export const storyBossSchema = z.strictObject({
  ...stop,
  id: idSchema,
  name: textSchema,
  sprite: imagePathSchema,
  voice: soundPathSchema,
  stand: z.strictObject({ x: tileCoordSchema, y: tileCoordSchema, facing: facingSchema }),
  dialogue: dialogueSchema,
  defeatDialogue: dialogueSchema,
  team: z.array(storyMemberSchema).min(1).max(TEAM_MAX),
});

/** The whole file. */
export const storyFileSchema = z.strictObject({
  map: idSchema,
  music: soundPathSchema,
  budget: z.int().min(0).max(EUROS_MAX),
  teamSize: z.int().min(1).max(TEAM_MAX),
  shop: z.array(idSchema).min(1, 'needs at least one item'),
  door: dialogueSchema,
  welcome: dialogueSchema,
  victory: dialogueSchema,
  office: z.strictObject({ ...stop, path: z.array(tilePointSchema).max(0, 'the first stop has no path') }),
  bosses: z.array(storyBossSchema).min(1, 'needs at least one boss'),
});

export type StoryBonus = z.infer<typeof storyBonusSchema>;
export type StoryBoss = z.infer<typeof storyBossSchema>;
export type Story = z.infer<typeof storyFileSchema>;
