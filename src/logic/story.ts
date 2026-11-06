/**
 * The story realm (*Modo historia*, docs/GAME-RULES.md › Story mode): a linear run of boss fights behind the
 * office's mystery door, with its own team, bag and save, apart from the main game.
 *
 * - Stages: `welcome` (the explanation, first visit only) → `team` (pick `teamSize` different species) → `shop`
 *   (spend the budget) → `map` (walk between stops and fight).
 * - Stops: index 0 is the office (`story.json › office`), then one per boss in order. The player stands on a stop
 *   and can only walk to the previous or the next one. The next one is open only once every boss before it is
 *   beaten: the furthest reachable stop is `beaten + 1` (capped at the last boss).
 * - A boss is `beaten` (index < `beaten`), `ready` (the next one to fight; the character waits there) or `hidden`
 *   (further on; nobody stands there yet).
 * - After every story battle the team is fully healed, and the bag is the loadout again (battles use a copy of it,
 *   so used items come back). Beating the `ready` boss opens the next stop; rematches change nothing.
 * - The shop sells at the item's price and buys back at the same price (`refundPrice`), so euros plus the
 *   loadout's value always equal `story.json › budget`. A loaded save that breaks this is refunded in full.
 * - Story team members are fresh (zero bonus); boss members get the bonus from `story.json`.
 *
 * Pure: no Phaser, no storage, randomness only through the given `Rng`.
 */
import { z } from 'zod';
import type { Rng } from '../core/rng';
import type { Item, Species, Story, StoryBoss } from '../data/schemas';
import { STORY_SAVE_VERSION } from './constants';
import { buy, refundPrice, sell, type ShopResult } from './economy';
import { createInstance, healFull, zeroBonus, type FlexymonInstance } from './instance';
import type { Inventory } from './inventory';
import type { Point } from './npc-state';

/** Where the player is in the story realm's setup. */
export type StoryStage = 'welcome' | 'team' | 'shop' | 'map';

/** The story realm's whole state (saved as `flexymon.story.v1`). */
export interface StoryState {
  stage: StoryStage;
  /** The story team, in battle order (empty until picked). */
  team: FlexymonInstance[];
  /** The items bought: the bag every story battle starts with. */
  loadout: Inventory;
  /** Budget left to spend. */
  euros: number;
  /** How many bosses are beaten, in order (0 … bosses). */
  beaten: number;
  /** The stop the player stands on (0 = the office). */
  at: number;
}

/** One stop on the story map: the office or a boss's landmark. */
export interface StoryStop {
  place: string;
  x: number;
  y: number;
  /** Corner tiles walked through from the previous stop (both ends left out). */
  path: readonly Point[];
}

/** A boss's state on the map. */
export type BossStatus = 'beaten' | 'ready' | 'hidden';

/** A fresh story realm: the welcome is still to show, budget unspent, nobody beaten. */
export function newStoryState(story: Pick<Story, 'budget'>): StoryState {
  return { stage: 'welcome', team: [], loadout: {}, euros: story.budget, beaten: 0, at: 0 };
}

/** Start the story again from the team choice (Reiniciar historia): new team, budget refunded, no boss beaten. */
export function restartStory(story: Pick<Story, 'budget'>): StoryState {
  return { ...newStoryState(story), stage: 'team' };
}

/** The welcome was read: go on to the team choice (or straight on if the team is already picked). */
export function finishWelcome(state: StoryState): StoryState {
  if (state.stage !== 'welcome') return state;
  return { ...state, stage: 'team' };
}

/** Every stop in order: the office, then the bosses. */
export function storyStops(story: Pick<Story, 'office' | 'bosses'>): StoryStop[] {
  return [story.office, ...story.bosses];
}

/** The furthest stop the player may walk to: the next unbeaten boss (or the last one when all are beaten). */
export function maxReachable(state: Pick<StoryState, 'beaten'>, story: Pick<Story, 'bosses'>): number {
  return Math.min(state.beaten + 1, story.bosses.length);
}

/** Status of boss `i` (0-based, so stop `i + 1`). */
export function bossStatus(state: Pick<StoryState, 'beaten'>, i: number): BossStatus {
  if (i < state.beaten) return 'beaten';
  return i === state.beaten ? 'ready' : 'hidden';
}

/** The boss at stop `at`, or `null` for the office. */
export function bossAt(story: Pick<Story, 'bosses'>, at: number): StoryBoss | null {
  return at >= 1 ? (story.bosses[at - 1] ?? null) : null;
}

/** True once every boss is beaten. */
export function storyFinished(state: Pick<StoryState, 'beaten'>, story: Pick<Story, 'bosses'>): boolean {
  return state.beaten >= story.bosses.length;
}

/**
 * The stop one step `dir` (+1 next, −1 previous) from where the player stands, or `null` if there is none or it is
 * still closed (a boss before it is unbeaten). Only on the map stage.
 */
export function stepTarget(state: StoryState, story: Pick<Story, 'bosses'>, dir: 1 | -1): number | null {
  if (state.stage !== 'map') return null;
  const to = state.at + dir;
  if (to < 0 || to > maxReachable(state, story)) return null;
  return to;
}

/**
 * The tiles walked from `from` through the `corners` to `to`, in order, without `from` and with `to`; `null` if a
 * leg is not a straight horizontal or vertical line.
 */
export function legTiles(from: Point, corners: readonly Point[], to: Point): Point[] | null {
  const out: Point[] = [];
  let cur = { x: from.x, y: from.y };
  for (const next of [...corners, to]) {
    if (cur.x !== next.x && cur.y !== next.y) return null;
    const dx = Math.sign(next.x - cur.x);
    const dy = Math.sign(next.y - cur.y);
    while (cur.x !== next.x || cur.y !== next.y) {
      cur = { x: cur.x + dx, y: cur.y + dy };
      out.push(cur);
    }
  }
  return out;
}

/**
 * The tiles to walk from stop `from` to the neighbouring stop `to` (`|from − to| = 1`), ending on `to`; `[]` for
 * anything else or a path that is not made of straight legs (the map checks reject those at boot).
 */
export function walkTiles(stops: readonly StoryStop[], from: number, to: number): Point[] {
  const a = stops[Math.min(from, to)];
  const b = stops[Math.max(from, to)];
  if (!a || !b || Math.abs(from - to) !== 1) return [];
  const forward = legTiles(a, b.path, b);
  if (!forward) return [];
  if (to > from) return forward;
  // Walking back: the same tiles in reverse, ending on the earlier stop.
  return [{ x: a.x, y: a.y }, ...forward].reverse().slice(1);
}

/** Add `id` to the picks, or take it out if it is already there; a full list (`size`) takes no more. */
export function togglePick(picks: readonly string[], id: string, size: number): string[] {
  if (picks.includes(id)) return picks.filter((p) => p !== id);
  return picks.length >= size ? [...picks] : [...picks, id];
}

/** Why a team cannot be the story team. */
export type TeamError = 'wrong_size' | 'duplicate' | 'unknown';

/**
 * Make the story team from `ids` (in battle order): exactly `teamSize` different known species, each a fresh
 * instance at full HP. On the `team` stage it moves on to the `shop`.
 */
export function pickTeam(
  state: StoryState,
  ids: readonly string[],
  story: Pick<Story, 'teamSize'>,
  flexymon: ReadonlyMap<string, Species>,
  rng: Rng,
): { ok: true; state: StoryState } | { ok: false; reason: TeamError } {
  if (ids.length !== story.teamSize) return { ok: false, reason: 'wrong_size' };
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'duplicate' };
  const species = ids.map((id) => flexymon.get(id));
  if (species.some((s) => !s)) return { ok: false, reason: 'unknown' };
  const team = (species as Species[]).map((s) => createInstance(s, rng));
  return { ok: true, state: { ...state, team, stage: state.stage === 'team' ? 'shop' : state.stage } };
}

/** Leave the shop: on the `shop` stage the run starts on the map. */
export function finishShop(state: StoryState): StoryState {
  return state.stage === 'shop' ? { ...state, stage: 'map' } : state;
}

/** Buy `qty` of `item` with the story budget into the loadout (money checked first, then bag room). */
export function storyBuy(state: StoryState, item: Item, qty: number): ShopResult {
  return buy(state.euros, state.loadout, item, qty);
}

/** Sell `qty` of `item` from the loadout back at its full price. */
export function storySell(state: StoryState, item: Item, qty: number): ShopResult {
  return sell(state.euros, state.loadout, item, qty, refundPrice);
}

/** What the loadout is worth at full price (unknown or unpriced items count 0). */
export function loadoutValue(loadout: Readonly<Inventory>, items: ReadonlyMap<string, Item>): number {
  return Object.entries(loadout).reduce((sum, [id, n]) => {
    const price = items.get(id)?.price ?? 0;
    return sum + price * n;
  }, 0);
}

/** A boss's team for one battle: fresh instances with the boss bonus, at full HP. */
export function bossTeam(
  boss: Pick<StoryBoss, 'team'>,
  flexymon: ReadonlyMap<string, Species>,
  rng: Rng,
): FlexymonInstance[] {
  return boss.team.map((m) => {
    const species = flexymon.get(m.id);
    if (!species) throw new Error(`story: unknown flexymon "${m.id}"`);
    const inst = createInstance(species, rng);
    const bonus = { ...zeroBonus(), ...m.bonus };
    return healFull(species, { ...inst, bonus });
  });
}

/** The team at full HP. */
export function healStoryTeam(
  team: readonly FlexymonInstance[],
  flexymon: ReadonlyMap<string, Species>,
): FlexymonInstance[] {
  return team.map((m) => {
    const sp = flexymon.get(m.speciesId);
    return sp ? healFull(sp, m) : { ...m };
  });
}

/** What a story battle changed: the new state, and whether it beat the `ready` boss / the last boss. */
export interface StoryBattleOutcome {
  state: StoryState;
  /** The `ready` boss was beaten for the first time (the next stop opens). */
  firstWin: boolean;
  /** That win was the last boss: the story is complete. */
  completed: boolean;
}

/**
 * After a battle against the boss at stop `at`: the team is fully healed (win or lose; the bag needs nothing, the
 * battle used a copy of the loadout); a win against the `ready` boss counts it as beaten.
 */
export function afterStoryBattle(
  state: StoryState,
  at: number,
  result: 'win' | 'lose' | 'fled',
  story: Pick<Story, 'bosses'>,
  flexymon: ReadonlyMap<string, Species>,
): StoryBattleOutcome {
  const team = healStoryTeam(state.team, flexymon);
  const firstWin = result === 'win' && at >= 1 && at - 1 === state.beaten;
  const beaten = firstWin ? state.beaten + 1 : state.beaten;
  return {
    state: { ...state, team, beaten },
    firstWin,
    completed: firstWin && beaten >= story.bosses.length,
  };
}

const instanceSchema = z.object({
  uid: z.string().min(1),
  speciesId: z.string().min(1),
  bonus: z.object({ hp: z.int(), attack: z.int(), defense: z.int(), speed: z.int() }),
  currentHp: z.int(),
});

/** The saved story realm (`flexymon.story.v1`). */
export const storySaveSchema = z.object({
  version: z.literal(STORY_SAVE_VERSION),
  savedAt: z.string(),
  stage: z.enum(['welcome', 'team', 'shop', 'map']),
  team: z.array(instanceSchema),
  loadout: z.record(z.string(), z.int().min(0)),
  euros: z.int().min(0),
  beaten: z.int().min(0),
  at: z.int().min(0),
});

/** Turn the story state into its saved JSON string. */
export function serializeStory(state: StoryState, now: Date): string {
  return JSON.stringify({
    version: STORY_SAVE_VERSION,
    savedAt: now.toISOString(),
    ...structuredClone(state),
  });
}

/** The content a story save is checked against. `GameData` satisfies it. */
export interface StoryCheckData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly items: ReadonlyMap<string, Item>;
  readonly story: Pick<Story, 'budget' | 'teamSize' | 'shop' | 'bosses'>;
}

/** Result of {@link parseStory}. */
export type ParseStoryResult =
  | { ok: true; state: StoryState; warnings: string[] }
  | { ok: false; reason: 'invalid_json' | 'invalid_schema'; detail: string };

/**
 * Parse, validate and fit a story save to the current content. Never throws. Fixes (each with a warning): a team
 * that is no longer valid (unknown species, wrong size, repeats) is dropped and the stage goes back to `team`;
 * members get zero bonus and full HP; items the shop no longer sells are dropped; if euros plus the loadout's value
 * is no longer the budget, everything is refunded; `beaten` and `at` are clamped to the bosses.
 */
export function parseStory(text: string, data: StoryCheckData): ParseStoryResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'invalid_json', detail: e instanceof Error ? e.message : String(e) };
  }
  const parsed = storySaveSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'invalid';
    return { ok: false, reason: 'invalid_schema', detail };
  }
  const save = parsed.data;
  const warnings: string[] = [];
  const { story } = data;

  let stage: StoryStage = save.stage;
  let team: FlexymonInstance[] = [];
  const ids = save.team.map((m) => m.speciesId);
  const teamOk =
    ids.length === story.teamSize &&
    new Set(ids).size === ids.length &&
    ids.every((id) => data.flexymon.has(id));
  if (teamOk)
    team = healStoryTeam(
      save.team.map((m) => ({ ...m, bonus: zeroBonus() })),
      data.flexymon,
    );
  else if (save.team.length > 0 || stage === 'shop' || stage === 'map') {
    warnings.push('story team no longer valid; pick it again');
    if (stage !== 'welcome') stage = 'team';
  }

  const loadout: Inventory = {};
  for (const [id, n] of Object.entries(save.loadout)) {
    if (n <= 0) continue;
    if (story.shop.includes(id) && data.items.has(id)) loadout[id] = n;
    else warnings.push(`dropped story item "${id}"`);
  }
  let euros = save.euros;
  if (euros + loadoutValue(loadout, data.items) !== story.budget) {
    warnings.push('story budget changed; every item refunded');
    for (const id of Object.keys(loadout)) delete loadout[id];
    euros = story.budget;
  }

  const beaten = Math.min(save.beaten, story.bosses.length);
  if (beaten !== save.beaten) warnings.push(`beaten clamped to ${beaten}`);
  const at = Math.min(save.at, maxReachable({ beaten }, story));
  if (at !== save.at) warnings.push(`stop clamped to ${at}`);

  return { ok: true, warnings, state: { stage, team, loadout, euros, beaten, at } };
}
