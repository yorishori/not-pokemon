/**
 * Schema for `public/data/sounds.json`: the interface sounds. Every key is required; each value is a sound
 * path like the other files' (`assets/….ogg`, the MP3 with the same name is the fallback).
 *
 * - `cursor`: a menu cursor moved. `confirm`: an option chosen. `cancel`: B backed out of a menu.
 * - `error`: a refused action (a greyed option, not enough money, the storage box refusing a move…).
 * - `money`: euros changed hands (shop purchase or sale, an enemy's reward).
 * - `battleMusic`: the music loop of every battle (wild and NPC). It is not an interface sound: `main.ts`
 *   crossfades to it when a battle starts and back to the zone's music when it ends.
 */
import { z } from 'zod';
import { soundPathSchema } from './common';

/** The whole file. */
export const soundsFileSchema = z.strictObject({
  cursor: soundPathSchema,
  confirm: soundPathSchema,
  cancel: soundPathSchema,
  error: soundPathSchema,
  money: soundPathSchema,
  battleMusic: soundPathSchema,
});

/** The interface sounds by kind, plus the battle music. */
export type Sounds = z.infer<typeof soundsFileSchema>;

/** One kind of interface sound (a key of `sounds.json` other than `battleMusic`). */
export type UiSoundKind = Exclude<keyof Sounds, 'battleMusic'>;
