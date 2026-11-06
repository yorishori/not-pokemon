import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { STORY_SAVE_VERSION } from '../../src/logic/constants';
import {
  afterStoryBattle,
  bossAt,
  bossStatus,
  bossTeam,
  finishShop,
  finishWelcome,
  legTiles,
  loadoutValue,
  maxReachable,
  newStoryState,
  parseStory,
  pickTeam,
  restartStory,
  serializeStory,
  stepTarget,
  storyBuy,
  storyFinished,
  storySell,
  storyStops,
  togglePick,
  walkTiles,
  type StoryState,
} from '../../src/logic/story';
import { gameData, inst } from './helpers';

const data = gameData();
const story = data.story;
const item = (id: string) => data.items.get(id)!;

/** A story run on the map stage with a team picked. */
const onMap = (over: Partial<StoryState> = {}): StoryState => ({
  stage: 'map',
  team: [inst('raton', 'a'), inst('teclado', 'b')],
  loadout: {},
  euros: story.budget,
  beaten: 0,
  at: 0,
  ...over,
});

describe('story realm: setup', () => {
  it('starts on the welcome with the whole budget, then the team, the shop and the map', () => {
    const s = newStoryState(story);
    expect(s).toEqual({ stage: 'welcome', team: [], loadout: {}, euros: 300, beaten: 0, at: 0 });
    const t = finishWelcome(s);
    expect(t.stage).toBe('team');
    expect(finishWelcome(t)).toBe(t);
    const picked = pickTeam(t, ['teclado', 'raton'], story, data.flexymon, createRng(1));
    expect(picked.ok && picked.state.stage).toBe('shop');
    if (!picked.ok) return;
    expect(picked.state.team.map((m) => m.speciesId)).toEqual(['teclado', 'raton']);
    expect(picked.state.team.every((m) => m.currentHp === data.flexymon.get(m.speciesId)!.stats.hp)).toBe(
      true,
    );
    expect(finishShop(picked.state).stage).toBe('map');
    expect(finishShop(onMap())).toEqual(onMap());
  });

  it('a team is exactly teamSize different known species; changing it later keeps the stage', () => {
    const s = onMap();
    const rng = createRng(2);
    expect(pickTeam(s, ['raton'], story, data.flexymon, rng)).toEqual({ ok: false, reason: 'wrong_size' });
    expect(pickTeam(s, ['raton', 'raton'], story, data.flexymon, rng)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(pickTeam(s, ['raton', 'monitor'], story, data.flexymon, rng)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    const changed = pickTeam(s, ['portatil', 'raton'], story, data.flexymon, rng);
    expect(changed.ok && changed.state.stage).toBe('map');
  });

  it('toggles picks: in order, out again, and no more than the size', () => {
    expect(togglePick([], 'raton', 2)).toEqual(['raton']);
    expect(togglePick(['raton'], 'teclado', 2)).toEqual(['raton', 'teclado']);
    expect(togglePick(['raton', 'teclado'], 'portatil', 2)).toEqual(['raton', 'teclado']);
    expect(togglePick(['raton', 'teclado'], 'raton', 2)).toEqual(['teclado']);
  });

  it('restarting keeps nothing: team choice again, budget refunded, no boss beaten', () => {
    expect(restartStory(story)).toEqual({ ...newStoryState(story), stage: 'team' });
  });
});

describe('story realm: the shop', () => {
  it('buys with the budget and sells back at the full price, so the total never changes', () => {
    const s = onMap();
    const bought = storyBuy(s, item('redbull'), 2);
    expect(bought).toEqual({ ok: true, euros: 60, items: { redbull: 2 } });
    if (!bought.ok) return;
    expect(storyBuy({ ...s, euros: 60, loadout: bought.items }, item('cafe'), 2)).toEqual({
      ok: false,
      reason: 'not_enough_money',
    });
    const sold = storySell({ ...s, euros: bought.euros, loadout: bought.items }, item('redbull'), 1);
    expect(sold).toEqual({ ok: true, euros: 180, items: { redbull: 1 } });
    if (!sold.ok) return;
    expect(sold.euros + loadoutValue(sold.items, data.items)).toBe(story.budget);
    expect(storySell(s, item('llaves_audi'), 1)).toEqual({ ok: false, reason: 'not_for_sale' });
  });

  it('values a loadout at full price (unknown items count 0)', () => {
    expect(loadoutValue({ cafe: 2, redbull: 1, chupito: 3 }, data.items)).toBe(220);
  });
});

describe('story realm: the map', () => {
  it('lists the office then the bosses as stops', () => {
    const stops = storyStops(story);
    expect(stops.map((s) => s.place)).toEqual(['Inicio de prueba', 'Parada uno', 'Parada dos']);
    expect(bossAt(story, 0)).toBeNull();
    expect(bossAt(story, 2)!.id).toBe('jefe_dos');
  });

  it('opens only up to the next unbeaten boss', () => {
    expect(maxReachable({ beaten: 0 }, story)).toBe(1);
    expect(maxReachable({ beaten: 1 }, story)).toBe(2);
    expect(maxReachable({ beaten: 2 }, story)).toBe(2);
    expect(stepTarget(onMap(), story, 1)).toBe(1);
    expect(stepTarget(onMap(), story, -1)).toBeNull();
    expect(stepTarget(onMap({ at: 1 }), story, 1)).toBeNull(); // boss 1 not beaten yet
    expect(stepTarget(onMap({ at: 1, beaten: 1 }), story, 1)).toBe(2);
    expect(stepTarget(onMap({ at: 2, beaten: 2 }), story, 1)).toBeNull(); // the end of the road
    expect(stepTarget(onMap({ stage: 'shop' }), story, 1)).toBeNull();
  });

  it('shows the next boss, keeps the beaten ones and hides the rest', () => {
    expect([0, 1].map((i) => bossStatus({ beaten: 0 }, i))).toEqual(['ready', 'hidden']);
    expect([0, 1].map((i) => bossStatus({ beaten: 1 }, i))).toEqual(['beaten', 'ready']);
    expect(storyFinished({ beaten: 2 }, story)).toBe(true);
    expect(storyFinished({ beaten: 1 }, story)).toBe(false);
  });

  it('walks straight legs through the corners, both ways', () => {
    expect(legTiles({ x: 0, y: 0 }, [{ x: 2, y: 0 }], { x: 2, y: 2 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(legTiles({ x: 0, y: 0 }, [], { x: 1, y: 1 })).toBeNull();
    const stops = storyStops(story);
    expect(walkTiles(stops, 1, 2)).toEqual([
      { x: 7, y: 1 },
      { x: 8, y: 1 },
      { x: 9, y: 1 },
      { x: 10, y: 1 },
      { x: 11, y: 1 },
      { x: 12, y: 1 },
      { x: 12, y: 2 },
    ]);
    expect(walkTiles(stops, 2, 1)).toEqual([
      { x: 12, y: 1 },
      { x: 11, y: 1 },
      { x: 10, y: 1 },
      { x: 9, y: 1 },
      { x: 8, y: 1 },
      { x: 7, y: 1 },
      { x: 6, y: 1 },
    ]);
    expect(walkTiles(stops, 0, 2)).toEqual([]);
  });
});

describe('story realm: battles', () => {
  it('a boss team gets its bonus and full HP', () => {
    const team = bossTeam(story.bosses[1]!, data.flexymon, createRng(3));
    expect(team.map((m) => [m.speciesId, m.bonus.hp, m.currentHp])).toEqual([
      ['teclado', 5, 43],
      ['raton', 0, 30],
    ]);
  });

  it('heals the team after every battle; only beating the ready boss counts', () => {
    const hurt = onMap({
      at: 1,
      team: [inst('raton', 'a', { currentHp: 0 }), inst('teclado', 'b', { currentHp: 3 })],
    });
    const lost = afterStoryBattle(hurt, 1, 'lose', story, data.flexymon);
    expect(lost.state.team.map((m) => m.currentHp)).toEqual([30, 38]);
    expect(lost).toMatchObject({ firstWin: false, completed: false, state: { beaten: 0, at: 1 } });
    const won = afterStoryBattle(hurt, 1, 'win', story, data.flexymon);
    expect(won).toMatchObject({ firstWin: true, completed: false, state: { beaten: 1 } });
    // A rematch of a beaten boss changes nothing but HP.
    expect(afterStoryBattle({ ...hurt, beaten: 1 }, 1, 'win', story, data.flexymon)).toMatchObject({
      firstWin: false,
      state: { beaten: 1 },
    });
    const last = afterStoryBattle(onMap({ at: 2, beaten: 1 }), 2, 'win', story, data.flexymon);
    expect(last).toMatchObject({ firstWin: true, completed: true, state: { beaten: 2 } });
  });
});

describe('story realm: saving', () => {
  const now = new Date('2026-11-06T12:00:00Z');

  it('round-trips a story', () => {
    const s = onMap({ loadout: { cafe: 2 }, euros: 200, beaten: 1, at: 1 });
    const text = serializeStory(s, now);
    expect(JSON.parse(text)).toMatchObject({
      version: STORY_SAVE_VERSION,
      savedAt: '2026-11-06T12:00:00.000Z',
    });
    expect(parseStory(text, data)).toEqual({ ok: true, state: s, warnings: [] });
  });

  it('refuses text that is not a story save', () => {
    expect(parseStory('{', data)).toMatchObject({ ok: false, reason: 'invalid_json' });
    expect(parseStory('{"version":1}', data)).toMatchObject({ ok: false, reason: 'invalid_schema' });
  });

  it('fits an old save to the content: invalid team, unsold items, a changed budget, too far', () => {
    const save = (over: Partial<StoryState>) => serializeStory(onMap(over), now);
    const badTeam = parseStory(save({ team: [inst('raton', 'a')] }), data);
    expect(badTeam.ok && badTeam.state).toMatchObject({ stage: 'team', team: [] });
    const boosted = parseStory(
      save({
        team: [inst('raton', 'a', { bonus: { hp: 3, attack: 0, defense: 0, speed: 0 } }), inst('teclado')],
      }),
      data,
    );
    expect(boosted.ok && boosted.state.team[0]).toMatchObject({ bonus: { hp: 0 }, currentHp: 30 });
    const unsold = parseStory(save({ loadout: { regleta: 1 }, euros: 300 }), data);
    expect(unsold.ok && unsold.state).toMatchObject({ loadout: {}, euros: 300 });
    const refunded = parseStory(save({ loadout: { cafe: 1 }, euros: 280 }), data);
    expect(refunded.ok && refunded.state).toMatchObject({ loadout: {}, euros: 300 });
    expect(refunded.ok && refunded.warnings).toEqual(['story budget changed; every item refunded']);
    const far = parseStory(save({ beaten: 9, at: 9 }), data);
    expect(far.ok && far.state).toMatchObject({ beaten: 2, at: 2 });
  });
});
