// Checks the story realm (Modo historia) on the frozen test world's small story (public/test-world/data/story.json:
// the office stop on `test` (2, 1), boss 1 at (6, 1), boss 2 at (12, 2) through (12, 1); team of 2, budget 300 €):
// the first visit runs welcome → team (required) → shop → map; moving goes stop to stop along the path and stops at
// the first unbeaten boss; a boss battle uses the story team and a copy of the loadout (used items come back, the
// team is healed after winning or losing); the next boss appears after a first win; the office menu goes back to
// the main game, whose state the story never touches; the story keeps its own save. The mystery door itself is in
// the real office and is tested in world.spec.ts.
import { test, expect, type Page } from '@playwright/test';

type Hooks = Record<string, (...a: unknown[]) => unknown>;
interface StoryView {
  ui: string;
  stage: string;
  at: number;
  x: number;
  y: number;
  beaten: number;
  bossesShown: string[];
  panel: string[];
  dialogue: { full: string } | null;
  choice: { options: string[]; cursor: number } | null;
}
interface Member {
  uid: string;
  speciesId: string;
  bonus: { hp: number; attack: number; defense: number; speed: number };
  currentHp: number;
}
interface StoryState {
  stage: string;
  team: Member[];
  loadout: Record<string, number>;
  euros: number;
  beaten: number;
  at: number;
}
interface BattleView {
  ui: string;
  kind: string;
  message: string | null;
  menu: { options: { label: string; enabled: boolean }[]; cursor: number } | null;
  player: { speciesId: string };
}

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const story = (page: Page) => hook<StoryView | null>(page, 'story');
const state = (page: Page) => hook<StoryState>(page, 'storyState');
const battle = (page: Page) => hook<BattleView | null>(page, 'battle');
const scene = (page: Page) => hook<string | null>(page, 'currentScene');

/** Press a key after two animation frames (a box or menu ignores input on the frame it opens). */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(60);
}

/** A through the story map's dialogue until it closes; returns the texts seen. */
async function readStory(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await expect.poll(async () => (await story(page))?.dialogue ?? null, { timeout: 10_000 }).not.toBeNull();
  while (true) {
    const d = (await story(page))?.dialogue;
    if (!d) return seen;
    if (seen.at(-1) !== d.full) seen.push(d.full);
    await press(page, 'z');
  }
}

/** Wait until the story map is idle (nothing walking, talking or open). */
async function idle(page: Page, at?: number): Promise<void> {
  await expect
    .poll(async () => {
      const v = await story(page);
      return v && { ui: v.ui, ...(at === undefined ? {} : { at: v.at }) };
    })
    .toEqual({ ui: 'idle', ...(at === undefined ? {} : { at }) });
}

/** A through a battle, choosing the first attack every round, until the battle scene is gone. */
async function fight(page: Page): Promise<string[]> {
  await expect.poll(() => battle(page), { timeout: 10_000 }).not.toBeNull();
  const messages: string[] = [];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const v = await battle(page);
    if (!v) return messages;
    if (v.message) {
      if (messages.at(-1) !== v.message) messages.push(v.message);
      await press(page, 'z');
    } else if (v.ui === 'main' && v.menu?.cursor === 0) {
      await press(page, 'z');
      await expect.poll(async () => (await battle(page))?.ui).toBe('attack');
      await press(page, 'z');
    } else if (v.ui === 'team') await press(page, 'z');
    else await page.waitForTimeout(40);
  }
  throw new Error('fight: never ended');
}

/** Start a new game on the test world, then go through the mystery door (hook) to the story realm. */
async function enterStory(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await expect.poll(() => hook<boolean>(page, 'enterStory'), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => scene(page)).toBe('Story');
  return errors;
}

/** Pick the first `n` species of the list (A, down, A…), then Sí. */
async function pickTeam(page: Page, n: number): Promise<void> {
  await expect.poll(() => scene(page)).toBe('StoryTeam');
  for (let i = 0; i < n; i++) {
    if (i > 0) await press(page, 'ArrowDown');
    await press(page, 'z');
  }
  await expect
    .poll(async () => (await hook<{ confirming: boolean } | null>(page, 'storyTeam'))?.confirming)
    .toBe(true);
  await press(page, 'z');
}

test('first visit: welcome, a required team, the shop with the budget, then the map', async ({
  page,
}, testInfo) => {
  const errors = await enterStory(page);
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');
  expect((await story(page))!.stage).toBe('welcome');
  expect(await readStory(page)).toEqual(['Bienvenida de prueba.']);

  // The team: B does nothing on the first visit; picks are numbered; a full team greys the rest.
  await expect.poll(() => scene(page)).toBe('StoryTeam');
  await press(page, 'x');
  expect(await scene(page)).toBe('StoryTeam');
  await press(page, 'z'); // Portátil
  await press(page, 'ArrowDown');
  await press(page, 'z'); // Ratón: the team is full, the question shows
  const team = (await hook<{ picks: string[]; confirming: boolean }>(page, 'storyTeam'))!;
  expect(team).toMatchObject({ picks: ['portatil', 'raton'], confirming: true });
  await page.screenshot({ path: testInfo.outputPath(`story-team-${testInfo.project.name}.png`) });
  await press(page, 'z'); // Sí

  // The story shop: the budget, buy 2 cafés (100 €), sell one back at the full price.
  await expect.poll(() => scene(page)).toBe('Shop');
  const shop = () =>
    hook<{ shopId: string; euros: number; ui: string; message: string | null }>(page, 'shop');
  expect(await shop()).toMatchObject({ shopId: 'story', euros: 300 });
  await press(page, 'z'); // Comprar
  await press(page, 'z'); // Café
  await press(page, 'ArrowUp'); // 2
  await press(page, 'z');
  await press(page, 'z'); // Sí
  await expect.poll(async () => (await shop()).euros).toBe(200);
  while ((await shop()).message) await press(page, 'z');
  await press(page, 'x'); // back to the main menu
  await press(page, 'ArrowDown');
  await press(page, 'z'); // Vender
  await press(page, 'z'); // Café
  await press(page, 'z'); // 1
  await press(page, 'z'); // Sí
  await expect.poll(async () => (await shop()).euros).toBe(250);
  while ((await shop()).message) await press(page, 'z');
  await press(page, 'x');
  await press(page, 'x'); // close
  await idle(page, 0);
  expect(await state(page)).toMatchObject({ stage: 'map', loadout: { cafe: 1 }, euros: 250 });
  expect((await state(page)).team.map((m) => m.speciesId)).toEqual(['portatil', 'raton']);
  // Saved in its own slot; the main game's bag and team did not change.
  expect(JSON.parse((await hook<string>(page, 'savedStory'))!)).toMatchObject({ stage: 'map', euros: 250 });
  expect(await hook(page, 'items')).not.toHaveProperty('redbull');
  expect((await hook<Member[]>(page, 'team')).map((m) => m.speciesId)).toEqual(['portatil']);
  const v = (await story(page))!;
  expect(v).toMatchObject({ at: 0, x: 2, y: 1, bossesShown: ['jefe_uno'] });
  expect(v.panel[0]).toBe('Parada 0/2 · Inicio de prueba');
  await page.screenshot({ path: testInfo.outputPath(`story-map-${testInfo.project.name}.png`) });
  expect(errors).toEqual([]);
});

test('stop to stop, closed past the next boss; a win opens the way, items come back, a loss heals', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await enterStory(page);
  await readStory(page);
  await pickTeam(page, 2);
  await expect.poll(() => scene(page)).toBe('Shop');
  await press(page, 'x'); // leave the shop without buying
  await idle(page, 0);

  // Left leads nowhere from the office; right walks the path to boss 1 (4 tiles).
  await press(page, 'ArrowLeft');
  await idle(page, 0);
  await press(page, 'ArrowRight');
  await idle(page, 1);
  expect(await story(page)).toMatchObject({
    x: 6,
    y: 1,
    panel: ['Parada 1/2 · Parada uno', expect.any(String)],
  });
  // Boss 2 is closed until boss 1 is beaten.
  await press(page, 'ArrowRight');
  expect(await readStory(page)).toEqual(['Primero tienes que vencer a Jefe uno.']);
  await idle(page, 1);

  // A weak team loses: healed, still on the stop, nobody beaten.
  const weak = (await state(page)).team.map((m) => ({ ...m, currentHp: 1 }));
  await hook(page, 'patchStory', { team: weak, loadout: { cafe: 1 } });
  await press(page, 'z');
  expect(await readStory(page)).toEqual(['Primer jefe de prueba.']);
  expect((await battle(page))?.kind ?? 'npc').toBe('npc');
  await fight(page);
  expect(await readStory(page)).toEqual(['Tu equipo se ha recuperado. ¡Inténtalo otra vez!']);
  let s = await state(page);
  expect(s).toMatchObject({ beaten: 0, at: 1, loadout: { cafe: 1 } });
  expect(s.team.map((m) => m.currentHp)).toEqual([40, 30]);

  // A strong team with one member hurt: use the café in battle, then win.
  const strong = s.team.map((m, i) => ({
    ...m,
    bonus: { hp: 100, attack: 100, defense: 50, speed: 50 },
    currentHp: i === 0 ? 20 : 130,
  }));
  await hook(page, 'patchStory', { team: strong });
  await press(page, 'z');
  await readStory(page);
  await expect.poll(() => battle(page), { timeout: 10_000 }).not.toBeNull();
  while ((await battle(page))?.ui !== 'main') {
    if ((await battle(page))?.message) await press(page, 'z');
    else await page.waitForTimeout(40);
  }
  await press(page, 'ArrowRight'); // Objeto
  await press(page, 'z');
  await expect.poll(async () => (await battle(page))?.ui).toBe('item');
  await press(page, 'z'); // Café
  await expect.poll(async () => (await battle(page))?.ui).toBe('item_target');
  await press(page, 'z'); // the hurt Portátil
  const messages = await fight(page);
  expect(messages.some((m) => m.includes('recupera 20 PS'))).toBe(true);
  expect(await readStory(page)).toEqual(['Derrota de prueba.']);
  s = await state(page);
  expect(s).toMatchObject({ beaten: 1, at: 1, loadout: { cafe: 1 } }); // the café is back
  expect(s.team.map((m) => m.currentHp)).toEqual([140, 130]); // healed to max
  expect((await story(page))!.bossesShown).toEqual(['jefe_uno', 'jefe_dos']);
  expect((await story(page))!.panel[1]).toContain('combate superado');

  // Now boss 2 is open: right, then up the corner, then down to (12, 2).
  await press(page, 'ArrowRight');
  await idle(page, 2);
  expect(await story(page)).toMatchObject({ x: 12, y: 2 });
  // Back the same way, by the direction of the path's first step (up), then left to the office.
  await press(page, 'ArrowUp');
  await idle(page, 1);
  await press(page, 'ArrowLeft');
  await idle(page, 0);
  expect(errors).toEqual([]);
});

test('the office menu: change team, and back to the main game where it was left', async ({ page }) => {
  const errors = await enterStory(page);
  const before = await hook<{ map: string; x: number; y: number }>(page, 'playerTile').catch(() => null);
  expect(before).toBeNull(); // the overworld is not running in the story realm
  await readStory(page);
  await pickTeam(page, 2);
  await expect.poll(() => scene(page)).toBe('Shop');
  await press(page, 'x');
  await idle(page, 0);

  // Cambiar equipo: the current team is already picked; B leaves without changes.
  await press(page, 'z');
  await expect.poll(async () => (await story(page))?.choice?.options[0]).toBe('Cambiar equipo');
  await press(page, 'z');
  await expect.poll(() => scene(page)).toBe('StoryTeam');
  expect((await hook<{ picks: string[]; required: boolean }>(page, 'storyTeam'))!).toMatchObject({
    picks: ['portatil', 'raton'],
    required: false,
  });
  await press(page, 'x');
  await idle(page, 0);

  // Volver al juego: the overworld comes back where the player stood, with the main team.
  await press(page, 'z');
  await expect.poll(async () => (await story(page))?.choice).not.toBeNull();
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Overworld');
  expect((await hook<Member[]>(page, 'team')).map((m) => m.speciesId)).toEqual(['portatil']);
  expect(await hook<string[]>(page, 'saveRequests')).toContain('portal');
  // Through the door again: the story goes on from the map, no welcome.
  await expect.poll(() => hook<boolean>(page, 'enterStory'), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => scene(page)).toBe('Story');
  await idle(page, 0);
  expect((await story(page))!.stage).toBe('map');
  expect(errors).toEqual([]);
});
