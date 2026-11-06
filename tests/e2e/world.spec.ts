// Checks: every landmark exists and can be entered; a tester can walk the whole world and use the car without the
// debug menu; boot validation passes with zero warnings; the new game's intro plays in the real office. The layout:
// Alboraya (village, industrial estate with the office,
// tourist beach), Valencia (Turia park, Estació del Nord, CAC), El Pueblo by train only, Murcia by the Audi only;
// the walk also takes the metro, the train, both Alboraya ↔ Valencia edges (beach and road) and M.P.'s house.
//
// These tests run on the REAL world: playwright.config.ts starts every profile on the frozen test world
// (`flexymon.e2e.world = test`, src/data/world.ts), so this spec removes that key before the page loads.
// Layout of the world: docs/MAPS.md; source layouts in tools/world/.
//
// The walks use a small path finder over the real .tmj maps (solid tiles, step warps, the NPCs where they stand
// now), pressing one arrow per tile. Wild encounters are switched off with the `setEncounters` hook (the same
// flag as the F2 menu option, but no debug menu is opened) so the walks are deterministic; enemy NPCs that spot
// the player are fought for real (A through the battle) with a strong team set through `patchState` (stats at the
// merge cap, healed after each fight), so the walk
// never depends on luck. Euros for the licence are topped up with `setEuros` (earning them would need luck too);
// the purchase itself goes through the shop screens.
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface NpcView {
  id: string;
  x: number;
  y: number;
}
interface MapGrid {
  width: number;
  height: number;
  solid: boolean[];
  warps: { x: number; y: number; width: number; height: number; trigger: string }[];
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const scene = (page: Page) => hook<string | null>(page, 'currentScene');
const dialogue = (page: Page) => hook<{ full: string } | null>(page, 'dialogue');
const choice = (page: Page) => hook<{ options: string[]; cursor: number } | null>(page, 'choice');
const shop = (page: Page) =>
  hook<{ ui: string; itemId: string | null; message: string | null; euros: number } | null>(page, 'shop');

/** Real-world page: drop the test-world switch before any script runs. */
async function realWorld(page: Page): Promise<string[]> {
  await page.addInitScript(() => window.localStorage.removeItem('flexymon.e2e.world'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    // Boot load warnings (src/scenes/boot-scene.ts) are `file › path › message` lines logged with warn().
    if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().includes(' › ')))
      errors.push(`${msg.type()}: ${msg.text()}`);
  });
  return errors;
}

/** Press a key after two animation frames (a box or menu ignores input on the frame it opens). */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(60);
}

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }), {
      timeout: 15_000,
    })
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Load the real world and start a new game at `start.json › spawn` without the intro (`quickStart`). */
async function quickStart(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, { map: 'oficina', x: 10, y: 13 });
  await hook(page, 'setEncounters', false);
  await strongTeam(page);
}

/**
 * A strong, healthy team so the enemy NPCs met on the way never stop the walk: the three Murcia species with every
 * stat at its merge cap (2 × base) and full HP. Set again after every battle.
 */
async function strongTeam(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const species = (await (await fetch('data/flexymon.json')).json()) as {
      id: string;
      stats: { hp: number; attack: number; defense: number; speed: number };
    }[];
    const team = ['servidor', 'proyector', 'router'].map((id, i) => {
      const s = species.find((f) => f.id === id)!.stats;
      return { uid: `walker${i}`, speciesId: id, bonus: { ...s }, currentHp: s.hp * 2 };
    });
    const e2e = (window as unknown as { __E2E__: Record<string, (...a: unknown[]) => unknown> }).__E2E__;
    e2e.patchState!({ team, teamSlots: 3 });
  });
}

const gridCache = new Map<string, MapGrid>();

/** Solid cells and warps of a map, read from its .tmj like src/data/tiled.ts does. */
async function grid(page: Page, map: string): Promise<MapGrid> {
  const cached = gridCache.get(map);
  if (cached) return cached;
  const g = await page.evaluate(async (m) => {
    interface Prop {
      name: string;
      value: unknown;
    }
    const json = (await (await fetch(`maps/${m}.tmj`)).json()) as {
      width: number;
      height: number;
      tilewidth: number;
      tilesets: { firstgid: number; tiles?: { id: number; properties?: Prop[] }[] }[];
      layers: { type: string; name: string; data?: number[]; objects?: Record<string, unknown>[] }[];
    };
    const solidGids = new Set<number>();
    for (const ts of json.tilesets)
      for (const t of ts.tiles ?? [])
        if (t.properties?.some((p) => p.name === 'solid' && p.value === true))
          solidGids.add(ts.firstgid + t.id);
    const solid = new Array<boolean>(json.width * json.height).fill(false);
    for (const l of json.layers)
      if (l.type === 'tilelayer')
        l.data!.forEach((gid, i) => solidGids.has(gid & 0x1fffffff) && (solid[i] = true));
    const warps = (json.layers.find((l) => l.name === 'warps')?.objects ?? []).map((o) => ({
      x: Math.floor((o.x as number) / json.tilewidth),
      y: Math.floor((o.y as number) / json.tilewidth),
      width: Math.max(1, Math.round((o.width as number) / json.tilewidth)),
      height: Math.max(1, Math.round((o.height as number) / json.tilewidth)),
      trigger: String((o.properties as Prop[]).find((p) => p.name === 'trigger')?.value),
    }));
    return { width: json.width, height: json.height, solid, warps };
  }, map);
  gridCache.set(map, g);
  return g;
}

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
type Dir = keyof typeof DIRS;

/** First step of a shortest path on `g` from `from` to `to`, or null. Other step warps (doors) are avoided. */
function firstStep(
  g: MapGrid,
  from: { x: number; y: number },
  to: { x: number; y: number },
  npcs: NpcView[],
): Dir | null {
  const inWarp = (x: number, y: number) =>
    g.warps.some(
      (w) => w.trigger === 'step' && x >= w.x && y >= w.y && x < w.x + w.width && y < w.y + w.height,
    );
  const free = (x: number, y: number) => {
    if (x === to.x && y === to.y) return true;
    if (npcs.some((n) => n.x === x && n.y === y)) return false;
    if (x < 0 || y < 0 || x >= g.width || y >= g.height) return false;
    return !g.solid[y * g.width + x] && !inWarp(x, y);
  };
  const key = (x: number, y: number) => `${x},${y}`;
  const first = new Map<string, Dir | null>([[key(from.x, from.y), null]]);
  const queue: { x: number; y: number }[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return first.get(key(cur.x, cur.y)) ?? null;
    for (const dir of Object.keys(DIRS) as Dir[]) {
      const [dx, dy] = DIRS[dir];
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (first.has(key(nx, ny)) || !free(nx, ny)) continue;
      first.set(key(nx, ny), first.get(key(cur.x, cur.y)) ?? dir);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Play through an NPC battle with A (B on a catch question), then the NPC's words; fails on a loss. */
async function fightThrough(page: Page, map: string): Promise<void> {
  const until = Date.now() + 90_000;
  while ((await scene(page)) === 'Battle') {
    expect(Date.now(), 'battle took too long').toBeLessThan(until);
    const b = await hook<{ ui: string } | null>(page, 'battle');
    await press(page, b?.ui === 'catch' ? 'x' : 'z');
  }
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Overworld');
  expect((await tile(page))?.map, 'lost a battle on the way').toBe(map);
  await strongTeam(page);
}

/**
 * Walk on the current map to (x, y) — a floor tile, a door or an off-map edge tile — one tile per arrow press,
 * re-planning every step (NPCs move). Battles and dialogue on the way are played through. Resolves when the
 * player stands on `arrive` (default: the target tile on the same map).
 */
async function walkTo(
  page: Page,
  map: string,
  x: number,
  y: number,
  arrive: Partial<Tile> = { map, x, y },
): Promise<void> {
  const until = Date.now() + 120_000;
  for (;;) {
    expect(Date.now(), `walking to ${map} (${x}, ${y})`).toBeLessThan(until);
    const s = await scene(page);
    if (s === 'Battle') {
      await fightThrough(page, map);
      continue;
    }
    if (await dialogue(page)) {
      await press(page, 'z');
      continue;
    }
    const t = await tile(page);
    if (!t || t.moving || (await hook<boolean>(page, 'overworldLocked'))) {
      await page.waitForTimeout(50);
      continue;
    }
    if (Object.entries(arrive).every(([k, v]) => t[k as keyof Tile] === v)) return;
    expect(t.map, `left ${map} on the way to (${x}, ${y})`).toBe(map);
    const dir = firstStep(await grid(page, map), t, { x, y }, await hook<NpcView[]>(page, 'npcs'));
    if (!dir) {
      await page.waitForTimeout(300); // an NPC is in the way; it will move
      continue;
    }
    // One tile: hold until the step starts (a new direction turns first), then let go.
    await page.keyboard.down(KEYS[dir]);
    for (let i = 0; i < 40; i++) {
      const now = await tile(page);
      if (!now || now.moving || now.x !== t.x || now.y !== t.y || now.map !== t.map) break;
      await page.waitForTimeout(15);
    }
    await page.keyboard.up(KEYS[dir]);
  }
}

/** Step on a door of `map` at (x, y), check the interior, and walk back out to the tile under the door. */
async function visit(page: Page, map: string, door: [number, number], inside: string): Promise<void> {
  await walkTo(page, map, door[0], door[1], { map: inside });
  await standing(page, { map: inside, facing: 'up' });
  const t = (await tile(page))!;
  const room = await grid(page, inside);
  expect(t.y).toBe(room.height - 1); // on the doormat
  await walkTo(page, inside, t.x, t.y + 1, { map });
  await standing(page, { map, x: door[0], y: door[1] + 1, facing: 'down' });
}

/** Facing the car (standing below it): A, then Sí; resolves on arrival. */
async function drive(page: Page, to: Partial<Tile>): Promise<void> {
  await press(page, 'ArrowUp');
  await standing(page, { facing: 'up' });
  await press(page, 'z');
  await expect.poll(() => choice(page)).toEqual({ options: ['Sí', 'No'], cursor: 0 });
  await press(page, 'z');
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Car');
  await expect.poll(() => scene(page), { timeout: 15_000 }).toBe('Overworld');
  await standing(page, to);
}

test.describe('the real world', () => {
  test('boot validation passes with zero warnings and the intro plays in the office', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const errors = await realWorld(page);
    await page.goto('/');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Title');
    expect(await hook<string[]>(page, 'dataErrors')).toEqual([]);
    expect(await hook(page, 'dataSummary')).toMatchObject({
      flexymon: 12,
      attacks: 24,
      items: 8,
      npcs: 73,
      zones: 20,
    });
    expect(await hook<string[]>(page, 'failedAssets')).toEqual([]);

    // Nueva partida → name → intro: the player walks in from the door, the coworker comes and goes.
    await press(page, 'Enter');
    await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'title'))?.ui).toBe('menu');
    await press(page, 'z');
    await expect.poll(() => scene(page)).toBe('Name');
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
    for (const k of ['A', 'n', 'a']) await press(page, k);
    await press(page, 'Enter');
    await expect.poll(() => scene(page)).toBe('Intro');
    await expect
      .poll(
        async () => (await hook<{ dialogue: { full: string } | null } | null>(page, 'intro'))?.dialogue?.full,
      )
      .toBe('¡Hola, Ana! Bienvenido a ahora.');
    const mid = (await hook<{ player: object; coworker: object }>(page, 'intro'))!;
    expect(mid.player).toEqual({ x: 10, y: 10, facing: 'up' });
    expect(mid.coworker).toMatchObject({ x: 10, y: 9 });
    await page.screenshot({ path: testInfo.outputPath(`m14-intro-${testInfo.project.name}.png`) });
    const seen: string[] = [];
    while ((await scene(page)) === 'Intro') {
      const d = (await hook<{ dialogue: { full: string } | null } | null>(page, 'intro'))?.dialogue;
      if (d) {
        if (seen.at(-1) !== d.full) seen.push(d.full);
        await press(page, 'z');
      } else await page.waitForTimeout(50);
    }
    expect(seen).toContain('¡Recibes a Portátil!');
    await standing(page, { map: 'oficina', x: 10, y: 10 });
    expect(await hook(page, 'items')).toEqual({ cafe: 3, llaves_audi: 1 });
    expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/interior.ogg');
    await page.screenshot({ path: testInfo.outputPath(`m14-office-${testInfo.project.name}.png`) });
    expect(errors).toEqual([]);
  });

  test('the mystery door in the office leads to the story realm and back', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const errors = await realWorld(page);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() ===
        true,
    );
    await page.waitForFunction(() =>
      (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
    );
    await standing(page, { map: 'oficina', x: 10, y: 13 });
    await walkTo(page, 'oficina', 8, 2);
    await press(page, 'ArrowUp');
    await standing(page, { facing: 'up' });
    await page.screenshot({ path: testInfo.outputPath(`story-door-${testInfo.project.name}.png`) });
    await press(page, 'z');
    await expect
      .poll(async () => (await dialogue(page))?.full ?? '')
      .toContain('Una puerta que no estaba aquí');
    while (!(await choice(page))) await press(page, 'z');
    expect(await choice(page)).toEqual({ options: ['Sí', 'No'], cursor: 0 });
    expect((await dialogue(page))?.full).toBe('¿Cruzar la puerta?');
    await press(page, 'z');
    await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Story');
    expect(await hook<string[]>(page, 'savesWritten')).toContain('portal');
    const story = () => hook<{ ui: string; dialogue: { full: string } | null } | null>(page, 'story');
    await expect.poll(async () => (await story())?.dialogue?.full ?? '').toContain('Bienvenido al Modo');
    await page.screenshot({ path: testInfo.outputPath(`story-welcome-${testInfo.project.name}.png`) });
    expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/valencia.ogg');
    // Reloading the page in the realm comes back to the main game in front of the door.
    await page.reload();
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Title');
    await page.waitForFunction(() =>
      (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
    );
    await standing(page, { map: 'oficina', x: 8, y: 2, facing: 'up' });
    expect(errors).toEqual([]);
  });

  test('from the office through Alboraya, the metro to Valencia, the train to El Pueblo, then the Audi to Murcia', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'one long walk on desktop is enough (the touch profiles drive the same game)',
    );
    test.setTimeout(600_000);
    const errors = await realWorld(page);
    await quickStart(page);
    const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`m14-${name}.png`) });

    // Out of the office into Alboraya's industrial estate: Bar Pacos in front, Las Rusas at the other end.
    await walkTo(page, 'oficina', 10, 14, { map: 'alboraya' });
    await standing(page, { map: 'alboraya', x: 83, y: 8, facing: 'down' });
    expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/valencia.ogg');
    await shot('alboraya-office');
    await visit(page, 'alboraya', [81, 16], 'bar_centro');
    await visit(page, 'alboraya', [56, 6], 'bar_este');
    // The village: its shop; the tourist beach: M.P.'s house.
    await visit(page, 'alboraya', [14, 18], 'tienda_alboraya');
    await shot('alboraya-village');
    await visit(page, 'alboraya', [94, 13], 'casa_mp');
    await shot('alboraya-beach');
    // Back in after leaving: the office door.
    await visit(page, 'alboraya', [83, 7], 'oficina');

    // The beach runs on into Valencia (the Malvarrosa) and back.
    await walkTo(page, 'alboraya', 105, 44, { map: 'valencia', x: 105, y: 0 });
    await shot('valencia-beach');
    await walkTo(page, 'valencia', 105, -1, { map: 'alboraya', x: 105, y: 43 });

    // The metro from the village square to Xàtiva, next to the north station.
    await walkTo(page, 'alboraya', 20, 14, { map: 'metro_alboraya' });
    await walkTo(page, 'metro_alboraya', 5, 0, { map: 'metro_xativa', x: 6, y: 1 });
    await walkTo(page, 'metro_xativa', 5, 8, { map: 'valencia' });
    await standing(page, { map: 'valencia', x: 33, y: 53, facing: 'down' });
    await shot('valencia-xativa');
    await visit(page, 'valencia', [68, 39], 'tienda_valencia');
    await visit(page, 'valencia', [86, 56], 'agora');
    await shot('valencia-cac');

    // The Estació del Nord: the train to El Pueblo (the only way there).
    await walkTo(page, 'valencia', 44, 53, { map: 'estacion_norte' });
    await walkTo(page, 'estacion_norte', 8, 0, { map: 'estacion_pueblo', x: 4, y: 1 });
    await walkTo(page, 'estacion_pueblo', 4, 7, { map: 'pueblo' });
    await standing(page, { map: 'pueblo', x: 8, y: 4, facing: 'down' });
    await shot('pueblo');
    await visit(page, 'pueblo', [18, 19], 'empresa_sur');

    // The licence from El Pueblo's shop (Comprar → Carnet de conducir → 1 → Sí).
    await walkTo(page, 'pueblo', 22, 19, { map: 'tienda_pueblo' });
    await hook(page, 'setEuros', 700);
    await walkTo(page, 'tienda_pueblo', 5, 4);
    await press(page, 'ArrowUp');
    await standing(page, { facing: 'up' });
    await press(page, 'z');
    while (await dialogue(page)) await press(page, 'z');
    await expect.poll(async () => (await shop(page))?.ui).toBe('main');
    await press(page, 'z');
    await expect.poll(async () => (await shop(page))?.ui).toBe('list');
    while ((await shop(page))?.itemId !== 'carnet') await press(page, 'ArrowDown');
    await press(page, 'z');
    await expect.poll(async () => (await shop(page))?.ui).toBe('quantity');
    await press(page, 'z');
    await expect.poll(async () => (await shop(page))?.ui).toBe('confirm');
    await press(page, 'z');
    await expect.poll(async () => (await shop(page))?.message).toBe('¡Gracias por tu compra!');
    while ((await shop(page))?.message) await press(page, 'z');
    await press(page, 'x');
    await press(page, 'x');
    await expect.poll(() => shop(page)).toBeNull();
    expect(await hook(page, 'items')).toMatchObject({ llaves_audi: 1, carnet: 1 });
    expect(await hook(page, 'euros')).toBe(100);
    await walkTo(page, 'tienda_pueblo', 3, 7, { map: 'pueblo' });

    // Back by train, then north up the road out of Valencia to the office car, and off to Murcia.
    await walkTo(page, 'pueblo', 8, 3, { map: 'estacion_pueblo' });
    await walkTo(page, 'estacion_pueblo', 4, 0, { map: 'estacion_norte', x: 8, y: 1 });
    await walkTo(page, 'estacion_norte', 8, 9, { map: 'valencia' });
    await walkTo(page, 'valencia', 43, -1, { map: 'alboraya', x: 43, y: 43 });
    await walkTo(page, 'alboraya', 85, 9);
    await drive(page, { map: 'murcia', x: 16, y: 15 });
    expect(await hook(page, 'items')).toMatchObject({ llaves_audi: 1, carnet: 1 });
    expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/murcia.ogg');
    await shot('murcia');
    expect(errors).toEqual([]);
  });

  test('Murcia: El Ciruelo, the vineyards, the desert and the coastal town, and the car back', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one long walk on desktop is enough');
    test.setTimeout(300_000);
    const errors = await realWorld(page);
    // Arrive in Murcia the normal way: drive from the office car with the keys and a double coffee.
    await quickStart(page);
    await hook(page, 'setItems', { llaves_audi: 1, cafe_doble: 1 });
    await walkTo(page, 'oficina', 10, 14, { map: 'alboraya' });
    await walkTo(page, 'alboraya', 85, 9);
    await drive(page, { map: 'murcia', x: 16, y: 15 });

    await visit(page, 'murcia', [21, 12], 'empresa_poligono');
    await walkTo(page, 'murcia', 50, 19);
    await page.screenshot({ path: testInfo.outputPath('m14-vinedos.png') });
    await walkTo(page, 'murcia', 85, 19);
    await page.screenshot({ path: testInfo.outputPath('m14-desierto.png') });
    await visit(page, 'murcia', [117, 13], 'tienda_murcia');
    await page.screenshot({ path: testInfo.outputPath('m14-costa.png') });

    // The Murcia car needs nothing and lands right under the office car.
    await walkTo(page, 'murcia', 16, 15);
    await drive(page, { map: 'alboraya', x: 85, y: 9 });
    expect(await hook(page, 'items')).toEqual({ llaves_audi: 1, cafe_doble: 1 });
    expect(errors).toEqual([]);
  });
});
