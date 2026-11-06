/**
 * The story realm's live state and its own save slot (docs/GAME-RULES.md › Story mode), apart from the main game:
 * nothing is shared between the two but the player's name.
 *
 * - The slot is `localStorage['flexymon.story.v1']` ({@link STORY_KEY}); format and fixes in `src/logic/story.ts`.
 * - {@link storyState} reads the slot the first time it is asked (no slot = a fresh story; a slot that cannot be
 *   read is copied to {@link STORY_BROKEN_KEY} and the story starts fresh), then keeps the state in memory.
 * - {@link saveStory} writes it and, unless `quiet`, emits `save:done` (`story`) so the HUD shows "Guardando…".
 *   The story scenes save at every change (team, shop, battle, reaching a stop); writes never throw.
 */
import { getGameData } from '../data/game-data';
import { newStoryState, parseStory, serializeStory, type StoryState } from '../logic/story';
import { events } from './events';
import { log, warn } from './log';
import { browserStorage, type KeyValueStore } from './save-store';

/** `localStorage` key of the story realm's save. */
export const STORY_KEY = 'flexymon.story.v1';

/** `localStorage` key where a story save that could not be read is copied. */
export const STORY_BROKEN_KEY = 'flexymon.story.broken';

let storage: KeyValueStore | null = browserStorage();
let current: StoryState | null = null;
let disabled = false;

/** Read the slot: the saved story fitted to the content, or a fresh one. */
function load(): StoryState {
  const data = getGameData();
  const text = savedStory();
  if (text === null) return newStoryState(data.story);
  const parsed = parseStory(text, data);
  if (!parsed.ok) {
    warn(
      `Story: cannot read ${STORY_KEY} (${parsed.reason}: ${parsed.detail}); copied to ${STORY_BROKEN_KEY}`,
    );
    try {
      storage?.setItem(STORY_BROKEN_KEY, text);
    } catch {
      // Nowhere to keep the copy; the story starts fresh anyway.
    }
    return newStoryState(data.story);
  }
  for (const w of parsed.warnings) warn(`Story: ${w}`);
  return parsed.state;
}

/** The story state (read from the slot on first use). Needs the content loaded. */
export function storyState(): StoryState {
  current ??= load();
  return current;
}

/** Replace the story state (it is saved only by {@link saveStory}). */
export function setStoryState(state: StoryState): void {
  current = state;
}

/** Write the story to its slot; announce it (`save:done` `story`) unless `quiet`. False if nothing was written. */
export function saveStory(quiet = false): boolean {
  if (disabled || !storage || !current) return false;
  try {
    storage.setItem(STORY_KEY, serializeStory(current, new Date()));
  } catch (e) {
    warn('Story: could not save', e);
    return false;
  }
  log('Story: saved');
  if (!quiet) events.emit('save:done', { reason: 'story' });
  return true;
}

/** The raw saved story text, or `null` (E2E hooks). */
export function savedStory(): string | null {
  try {
    return storage?.getItem(STORY_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Stop all story saving until the page reloads (the debug "delete save" command). */
export function disableStorySaving(): void {
  disabled = true;
}

/** Delete the story slot (the debug "delete save" command). */
export function removeStory(): void {
  try {
    storage?.removeItem(STORY_KEY);
  } catch (e) {
    warn('Story: could not delete', e);
  }
}

/** Tests: use `store` as the storage and forget the state in memory. */
export function useStoryStorage(store: KeyValueStore | null): void {
  storage = store;
  current = null;
  disabled = false;
}
