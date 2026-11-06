import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { events } from '../../src/core/events';
import {
  STORY_BROKEN_KEY,
  STORY_KEY,
  disableStorySaving,
  removeStory,
  saveStory,
  savedStory,
  setStoryState,
  storyState,
  useStoryStorage,
} from '../../src/core/story-session';
import { setGameData } from '../../src/data/game-data';
import { gameData } from '../logic/helpers';
import { memoryStorage } from './memory-storage';

describe('story session (flexymon.story.v1)', () => {
  beforeEach(() => setGameData(gameData()));
  afterEach(() => {
    useStoryStorage(null);
    events.clear();
  });

  it('starts fresh without a slot, saves, announces and reads the saved story back', () => {
    const mem = memoryStorage();
    useStoryStorage(mem);
    expect(STORY_KEY).toBe('flexymon.story.v1');
    expect(storyState()).toMatchObject({ stage: 'welcome', euros: 300, beaten: 0 });
    const done: string[] = [];
    events.on('save:done', ({ reason }) => done.push(reason));
    setStoryState({ ...storyState(), stage: 'team' });
    expect(saveStory()).toBe(true);
    expect(saveStory(true)).toBe(true);
    expect(done).toEqual(['story']);
    expect(JSON.parse(savedStory()!)).toMatchObject({ version: 1, stage: 'team' });
    useStoryStorage(mem); // a new page: read from the slot
    expect(storyState().stage).toBe('team');
  });

  it('copies an unreadable slot aside and starts fresh', () => {
    const mem = memoryStorage();
    mem.setItem(STORY_KEY, '{not json');
    useStoryStorage(mem);
    expect(storyState().stage).toBe('welcome');
    expect(mem.map.get(STORY_BROKEN_KEY)).toBe('{not json');
  });

  it('deleting and disabling (debug "Borrar partida") stop the story from being written', () => {
    const mem = memoryStorage();
    useStoryStorage(mem);
    storyState();
    saveStory(true);
    removeStory();
    expect(savedStory()).toBeNull();
    disableStorySaving();
    expect(saveStory()).toBe(false);
    expect(savedStory()).toBeNull();
  });

  it('without storage nothing is saved and nothing throws', () => {
    useStoryStorage(null);
    expect(storyState().stage).toBe('welcome');
    expect(saveStory()).toBe(false);
    expect(savedStory()).toBeNull();
  });
});
