// Checks: a debug battle Portátil vs Ratón can be won, lost and fled; HP bars match the numbers
// (the scene only plays logic events); B never gets the player stuck in a menu. Plus: the debug menu
// starts a battle, Huir is greyed out against NPCs, switching (voluntary and forced), Objeto (item list) and B,
// and the player returns to the same tile with the team's HP kept (after a loss: the Losing rule). Battles play
// the battle music and the zone's music comes back afterwards.
// Battles start through `__E2E__.startBattle(seed, species, kind)`; the team is set with `setTeam`.
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface SideView {
  uid: string;
  speciesId: string;
  name: string;
  hp: number;
  maxHp: number;
  shownHp: number;
  hpText: string | null;
}
interface BattleView {
  kind: string;
  phase: string;
  result: string | null;
  round: number;
  ui: string;
  menu: { options: { label: string; enabled: boolean }[]; cursor: number } | null;
  message: string | null;
  player: SideView;
  opponent: SideView;
}
interface Member {
  uid: string;
  speciesId: string;
  currentHp: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const battle = (page: Page) => hook<BattleView | null>(page, 'battle');
const team = (page: Page) => hook<Member[]>(page, 'team');

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

async function enterOverworld(page: Page, url = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url);
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  // The title replaced "Pulsa START"; quickStart() continues a save or starts at the spawn (no intro).
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, { map: 'test', x: 15, y: 10 });
  return errors;
}

/**
 * Press a key and give the game a few frames to see it. First wait two animation frames, so at least one
 * game update ran since the last state read: a menu ignores input on the frame it opens, and a press
 * landing in that frame would be lost (this made the tests flaky under load).
 */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

/**
 * Press A through messages until the battle shows one of `uis` (or ends and the overworld is back when
 * `uis` contains `'over'`). Returns the messages seen and the last battle view.
 */
async function advance(page: Page, uis: string[]): Promise<{ messages: string[]; last: BattleView | null }> {
  const messages: string[] = [];
  let last: BattleView | null = null;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const v = await battle(page);
    if (v) last = v;
    if (!v) {
      // Back in the overworld: free to move, or (after a loss) showing the "woke up" message.
      const back =
        !(await hook<boolean>(page, 'overworldLocked')) || (await hook<unknown>(page, 'dialogue')) !== null;
      if (uis.includes('over') && (await tile(page)) && back) return { messages, last };
    } else if (uis.includes(v.ui) && v.menu) {
      return { messages, last };
    } else if (v.ui === 'catch' && v.menu) {
      // After a wild win the catch choice appears; B = Dejarlo keeps the team as it was.
      await press(page, 'x');
      continue;
    } else if (v.message) {
      if (messages.at(-1) !== v.message) messages.push(v.message);
      await press(page, 'z');
      continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`advance: never reached ${uis.join('/')} (last ${JSON.stringify(last)})`);
}

/** Both HP bars show exactly the logic numbers. */
function expectBarsMatch(v: BattleView): void {
  for (const s of [v.player, v.opponent]) expect(s.shownHp).toBe(s.hp);
  expect(v.player.hpText).toBe(`PS ${v.player.hp}/${v.player.maxHp}`);
}

/** Choose Atacar → the first attack, then play the round. */
async function attackOnce(page: Page): Promise<{ messages: string[]; last: BattleView | null }> {
  await expect.poll(async () => (await battle(page))?.menu?.cursor).toBe(0);
  await press(page, 'z');
  await expect.poll(async () => (await battle(page))?.ui).toBe('attack');
  await press(page, 'z');
  return advance(page, ['main', 'team', 'over']);
}

test('a debug battle Portátil vs Ratón can be won; HP bars match; same tile and HP afterwards', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors = await enterOverworld(page);
  expect(await hook<boolean>(page, 'startBattle', 6)).toBe(true);
  const intro = await advance(page, ['main']);
  expect(intro.messages).toEqual(['¡Un Ratón salvaje aparece!', '¡Adelante, Portátil!']);
  const start = (await battle(page))!;
  expect(start).toMatchObject({ kind: 'wild', phase: 'choose', ui: 'main' });
  expect(start.opponent).toMatchObject({ speciesId: 'raton', name: 'Ratón salvaje', hp: 30, maxHp: 30 });
  expect(start.player).toMatchObject({ speciesId: 'portatil', name: 'Portátil', hp: 40, hpText: 'PS 40/40' });
  expect(start.menu!.options).toEqual([
    { label: 'Atacar', enabled: true },
    { label: 'Objeto', enabled: true },
    { label: 'Cambiar', enabled: true },
    { label: 'Huir', enabled: true },
  ]);
  expectBarsMatch(start);
  await page.screenshot({ path: testInfo.outputPath(`battle-menu-${testInfo.project.name}.png`) });

  // The attack menu lists Portátil's three attacks; the accuracy shows beside it.
  await press(page, 'z');
  await expect
    .poll(async () => (await battle(page))?.menu?.options.map((o) => o.label))
    .toEqual(['Compilar', 'Pantallazo azul', 'Actualización']);
  await page.screenshot({ path: testInfo.outputPath(`battle-attacks-${testInfo.project.name}.png`) });
  await press(page, 'x');
  await expect.poll(async () => (await battle(page))?.ui).toBe('main');

  let result: string | null = null;
  let finalHp = 0;
  for (let round = 0; round < 10 && !result; round++) {
    const { messages, last } = await attackOnce(page);
    expect(messages).toContain('¡Portátil usa Compilar!');
    const v = await battle(page);
    if (v) {
      expectBarsMatch(v);
      if (round === 0) {
        await page.screenshot({ path: testInfo.outputPath(`battle-round-${testInfo.project.name}.png`) });
      }
    } else {
      result = last!.result;
      finalHp = last!.player.hp;
      expect(messages).toContain('¡Ratón salvaje se ha debilitado!');
      expect(messages).toContain('¡Has ganado el combate!');
    }
  }
  expect(result).toBe('win');
  await standing(page, { map: 'test', x: 15, y: 10 });
  expect(await hook<string>(page, 'currentScene')).toBe('Overworld');
  expect((await team(page))[0]!.currentHp).toBe(finalHp);
  expect(errors).toEqual([]);
});

test('a battle can be lost: the Losing rule wakes the player at the office', async ({ page }) => {
  // Plays up to 10 whole battles (messages type out at 30 characters per second).
  test.setTimeout(120_000);
  const errors = await enterOverworld(page);
  let lost = false;
  for (let seed = 1; seed <= 10 && !lost; seed++) {
    await hook(page, 'setTeam', [{ speciesId: 'portatil', currentHp: 1 }]);
    expect(await hook<boolean>(page, 'startBattle', seed)).toBe(true);
    await advance(page, ['main']);
    expect((await battle(page))!.player).toMatchObject({ hp: 1, shownHp: 1, hpText: 'PS 1/40' });
    for (let round = 0; round < 10; round++) {
      const { messages, last } = await attackOnce(page);
      if (await battle(page)) continue;
      if (last!.result === 'lose') {
        lost = true;
        expect(messages).toContain('¡Portátil se ha debilitado!');
        expect(messages).toContain('No te quedan flexymon en pie...');
        expect(last!.player.shownHp).toBe(0);
      }
      break;
    }
    if (!lost) await standing(page, { map: 'test', x: 15, y: 10 });
  }
  expect(lost).toBe(true);
  // the Losing rule: respawn point (start.json › respawn), the message, euros halved, team healed.
  await expect
    .poll(async () => (await hook<{ full: string } | null>(page, 'dialogue'))?.full)
    .toBe('Te has despertado en la oficina...');
  expect(await tile(page)).toMatchObject({ map: 'test', x: 15, y: 11, facing: 'down' });
  // A reveals the rest of the typing text, then closes the box.
  while (await hook<unknown>(page, 'dialogue')) await press(page, 'z');
  await standing(page, { map: 'test', x: 15, y: 11 });
  expect(await hook<number>(page, 'euros')).toBe(100);
  expect((await team(page))[0]!.currentHp).toBe(40);
  expect(errors).toEqual([]);
});

test('fleeing a wild battle; Huir is greyed out against an NPC', async ({ page }, testInfo) => {
  const errors = await enterOverworld(page);
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');
  await hook(page, 'startBattle', 3);
  await advance(page, ['main']);
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/battle.ogg');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await expect.poll(async () => (await battle(page))?.menu?.cursor).toBe(3);
  await press(page, 'z');
  const fled = await advance(page, ['over']);
  expect(fled.messages).toEqual(['¡Escapas sin problemas!']);
  expect(fled.last!.result).toBe('fled');
  await standing(page, { map: 'test', x: 15, y: 10 });
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');

  await hook(page, 'startBattle', 3, 'raton', 'npc');
  const intro = await advance(page, ['main']);
  expect(intro.messages[0]).toBe('¡El rival saca a Ratón!');
  const v = (await battle(page))!;
  expect(v.opponent.name).toBe('Ratón rival');
  expect(v.menu!.options[3]).toEqual({ label: 'Huir', enabled: false });
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await page.waitForTimeout(200);
  expect(await battle(page)).toMatchObject({ ui: 'main', phase: 'choose', menu: { cursor: 3 } });
  await page.screenshot({ path: testInfo.outputPath(`battle-npc-${testInfo.project.name}.png`) });
  expect(errors).toEqual([]);
});

test('B always goes back (also from Objeto); switching works', async ({ page }, testInfo) => {
  const errors = await enterOverworld(page);
  await hook(page, 'setTeam', [{ speciesId: 'portatil' }, { speciesId: 'teclado', currentHp: 20 }]);
  await hook(page, 'startBattle', 4);
  await advance(page, ['main']);
  const ui = async () => (await battle(page))?.ui;

  // B in the main menu does nothing.
  await press(page, 'x');
  expect(await ui()).toBe('main');
  // Atacar → B.
  await press(page, 'z');
  await expect.poll(ui).toBe('attack');
  await press(page, 'x');
  await expect.poll(ui).toBe('main');
  // Cambiar → B (team list: the active one and fainted ones are greyed out).
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(ui).toBe('team');
  const rows = (await battle(page))!.menu!.options;
  expect(rows).toEqual([
    { label: 'Portátil (en combate)', enabled: false },
    { label: 'Teclado', enabled: true },
  ]);
  await page.screenshot({ path: testInfo.outputPath(`battle-team-${testInfo.project.name}.png`) });
  await press(page, 'x');
  await expect.poll(ui).toBe('main');
  expect((await battle(page))!.menu!.cursor).toBe(2);
  // Objeto → the item list → B → back, no turn used.
  await press(page, 'ArrowUp');
  await press(page, 'ArrowRight');
  await press(page, 'z');
  await expect.poll(ui).toBe('item');
  await press(page, 'x');
  await expect.poll(ui).toBe('main');
  expect((await battle(page))!.menu!.cursor).toBe(1);
  expect((await battle(page))!.round).toBe(0);

  // Cambiar → Teclado: called back, sent out, then the opponent acts.
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(ui).toBe('team');
  await press(page, 'z');
  const sw = await advance(page, ['main', 'team', 'over']);
  expect(sw.messages.slice(0, 2)).toEqual(['¡Vuelve, Portátil!', '¡Adelante, Teclado!']);
  expect(sw.messages[2]).toMatch(/^¡Ratón salvaje usa /);
  const v = (await battle(page))!;
  expect(v.player).toMatchObject({ speciesId: 'teclado', name: 'Teclado' });
  expectBarsMatch(v);
  expect(errors).toEqual([]);
});

test('a fainted active must be replaced: the forced team menu ignores B', async ({ page }) => {
  // Plays up to 10 whole battles (messages type out at 30 characters per second).
  test.setTimeout(120_000);
  const errors = await enterOverworld(page);
  let forced = false;
  for (let seed = 1; seed <= 10 && !forced; seed++) {
    await hook(page, 'setTeam', [{ speciesId: 'portatil', currentHp: 1 }, { speciesId: 'teclado' }]);
    expect(await hook<boolean>(page, 'startBattle', seed)).toBe(true);
    await advance(page, ['main']);
    for (let round = 0; round < 10; round++) {
      await attackOnce(page);
      const v = await battle(page);
      if (!v) break;
      if (v.ui === 'team') {
        forced = true;
        expect(v.phase).toBe('must_switch');
        await press(page, 'x');
        await page.waitForTimeout(200);
        expect((await battle(page))!.ui).toBe('team');
        expect((await battle(page))!.menu!.options[0]).toEqual({
          label: 'Portátil (debilitado)',
          enabled: false,
        });
        await expect.poll(async () => (await battle(page))?.menu?.cursor).toBe(1);
        await press(page, 'z');
        const next = await advance(page, ['main', 'over']);
        expect(next.messages).toEqual(['¡Adelante, Teclado!']);
        expect((await battle(page))!.player.speciesId).toBe('teclado');
        // Leave the battle.
        await press(page, 'ArrowRight');
        await press(page, 'ArrowDown');
        await press(page, 'z');
        await advance(page, ['over']);
        break;
      }
    }
    await standing(page);
  }
  expect(forced).toBe(true);
  expect(errors).toEqual([]);
});

test('the debug menu starts a battle against any flexymon', async ({ page }) => {
  const errors = await enterOverworld(page, '/?debug=1');
  await press(page, 'F2');
  await press(page, 'F2');
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('menu');
  const lines = (await hook<string[]>(page, 'debugLines'))!;
  expect(lines).toContain('Combate de prueba');
  expect(lines).toContain('  Combate: Teclado');
  const target = lines.filter((l) => /^[ >] /.test(l)).findIndex((l) => l.endsWith('Combate: Teclado'));
  for (let i = 0; i < target; i++) await press(page, 'ArrowDown');
  await expect
    .poll(async () => (await hook<string[]>(page, 'debugLines'))!.includes('> Combate: Teclado'))
    .toBe(true);
  await press(page, 'z');
  const intro = await advance(page, ['main']);
  expect(intro.messages[0]).toBe('¡Un Teclado salvaje aparece!');
  expect((await battle(page))!.opponent.speciesId).toBe('teclado');
  expect(errors).toEqual([]);
});
