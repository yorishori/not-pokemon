/**
 * DebugScene — developer overlay, available only in dev builds (`npm run dev`) or with `?debug=1` in
 * the URL. Preload launches it once (it is last in the scene list, so it draws on top of every scene).
 *
 * F2 (`debug` action) cycles: hidden → info → teleport menu → hidden.
 * - Info: map id, player tile x/y (same numbers as Tiled's status bar), FPS; euros.
 * - Teleport menu: every zone in `zones.json` (the story board too, as a plain map to look at); up/down choose, A teleports to that zone's `default`
 *   spawn (event `debug:teleport`), B closes the menu. While the menu is open it emits
 *   `debug:menu { open: true }` and the overworld ignores movement.
 * - Battle entries: below the zones, one "Combate: {name}" line per flexymon in `flexymon.json`;
 *   A starts a wild battle against a fresh one (event `debug:battle`).
 * - Options: "Encuentros: sí/no" toggles wild encounters (`debugFlags.encounters`); A flips it and
 *   the menu stays open so the new value shows.
 * - Euros: the info lines also show the player's euros ("Euros: {n}").
 * - Options: "NPC: todos listos" sets every enemy NPC to `ready` (`resetAllNpcs`); the menu stays open.
 * - Options: "Borrar partida" (first under "Opciones") emits `debug:delete_save`: `main.ts` stops auto-saving, deletes
 *   `flexymon.save.v1` and the story realm's `flexymon.story.v1`, and reloads the page, which then starts a new game.
 * - Give (group "Dar", between the battles and "Datos"): "Dar {n} €" adds `DEBUG_GIVE_EUROS` euros, then one
 *   "Dar: {item}" line per item in `items.json` adds one of it (key items too); the menu stays open. Rules in
 *   `src/logic/debug-tools.ts`.
 * - Data (group "Datos"): "Recargar datos" fetches and validates every content JSON and map again, without a
 *   page reload ({@link reloadContent}). On success the new data replaces the old, the game state is checked
 *   against it like a loaded save (unknown ids dropped, `parseSave`), new sprites and sounds are loaded, and
 *   `debug:reloaded` makes the overworld rebuild the current map where the player stands. On any error the old
 *   data stays and the overlay shows "Error al recargar ({n})" plus the first error lines (all are logged).
 *   Images and sounds already loaded under the same path are not fetched again (only JSON reloads).
 */
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/game';
import { debugFlags } from '../core/debug-flags';
import { events } from '../core/events';
import { input } from '../core/input';
import { gameState, setGameState } from '../core/session';
import { getGameData, hasGameData } from '../data/game-data';
import { resetAllNpcs } from '../logic/npc-state';
import { scrollTop } from '../logic/storage-box';
import { DEBUG_GIVE_EUROS } from '../logic/constants';
import { giveEuros, giveItem } from '../logic/debug-tools';
import { parseSave, serializeSave } from '../logic/save';
import { collectAssets } from '../data/assets';
import { formatDataError } from '../data/errors';
import { loadGameData } from '../data/loader';
import { dataDir } from '../data/world';
import { setGameData } from '../data/game-data';
import { error, log, warn } from '../core/log';
import { t } from '../i18n';

/** How many menu lines the overlay draws at once; the window follows the cursor. */
const DEBUG_MENU_ROWS = 14;

/** How many error lines the overlay shows after a failed reload (all of them are logged). */
const RELOAD_ERROR_LINES = 4;

/** State of the last "Recargar datos" (read by the overlay and the E2E hook `debugReload()`). */
export interface ReloadStatus {
  state: 'idle' | 'loading' | 'ok' | 'error';
  /** The formatted `file › path › message` errors of a failed reload. */
  errors: string[];
}

/** Scene key of {@link DebugScene}. */
export const DEBUG_SCENE = 'Debug';

/** What the overlay shows. */
export type DebugMode = 'hidden' | 'info' | 'menu';

/** True in dev builds or when the page URL has `?debug=1`. */
export function debugEnabled(search: string = globalThis.location?.search ?? ''): boolean {
  return import.meta.env.DEV || new URLSearchParams(search).get('debug') === '1';
}

/** The F2 overlay. */
export class DebugScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Rectangle;
  private where = { map: '-', x: 0, y: 0 };
  private cursor = 0;
  /** Current mode (read by the E2E hooks). */
  mode: DebugMode = 'hidden';
  /** First menu line drawn (the menu scrolls). */
  private menuTop = 0;
  /** The last data reload. */
  reload: ReloadStatus = { state: 'idle', errors: [] };

  constructor() {
    super(DEBUG_SCENE);
  }

  /** Whether the overlay is showing anything. */
  get shown(): boolean {
    return this.mode !== 'hidden';
  }

  create(): void {
    this.panel = this.add.rectangle(2, 2, 150, 40, 0x000000, 0.7).setOrigin(0);
    this.text = this.add.text(6, 5, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#00ff66',
      wordWrap: { width: GAME_WIDTH - 12 },
    });
    const off = events.on('player:moved', (p) => {
      this.where = { map: p.map, x: p.x, y: p.y };
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.setMode('hidden');
  }

  override update(): void {
    if (input.justPressed('debug')) {
      this.setMode(this.mode === 'hidden' ? 'info' : this.mode === 'info' ? 'menu' : 'hidden');
    } else if (this.mode === 'menu') {
      const entries = this.entries();
      if (input.justPressed('up')) this.cursor = (this.cursor + entries.length - 1) % entries.length;
      if (input.justPressed('down')) this.cursor = (this.cursor + 1) % entries.length;
      if (input.justPressed('b')) this.setMode('info');
      else if (input.justPressed('a')) {
        const entry = entries[this.cursor];
        if (entry?.group === 'teleport' || entry?.group === 'battle') this.setMode('info');
        entry?.run();
      }
    }
    if (!this.shown) return;
    this.text.setText(this.drawnLines());
    // Scale the panel (Shape.setSize did not resize the drawn rectangle).
    this.panel.setDisplaySize(Math.max(120, this.text.width + 8), this.text.height + 6);
  }

  /** The menu entries in order: one teleport per zone, one battle per flexymon, then the options. */
  private entries(): {
    label: string;
    group: 'teleport' | 'battle' | 'give' | 'data' | 'option';
    run: () => void;
  }[] {
    const data = getGameData();
    return [
      ...[...data.zones.keys()].map((map) => ({
        label: map,
        group: 'teleport' as const,
        run: () => events.emit('debug:teleport', { map }),
      })),
      ...[...data.flexymon.values()].map((sp) => ({
        label: t('debug.battle_entry', { name: sp.name }),
        group: 'battle' as const,
        run: () => events.emit('debug:battle', { speciesId: sp.id }),
      })),
      {
        label: t('debug.give_euros', { n: DEBUG_GIVE_EUROS }),
        group: 'give' as const,
        run: () => setGameState(giveEuros(gameState())),
      },
      ...[...data.items.values()].map((item) => ({
        label: t('debug.give_item', { name: item.name }),
        group: 'give' as const,
        run: () => setGameState(giveItem(gameState(), item.id).state),
      })),
      {
        label: t('debug.reload'),
        group: 'data' as const,
        run: () => void this.reloadContent(),
      },
      {
        label: t('debug.delete_save'),
        group: 'option' as const,
        run: () => events.emit('debug:delete_save'),
      },
      {
        label: t(debugFlags.encounters ? 'debug.encounters_on' : 'debug.encounters_off'),
        group: 'option' as const,
        run: () => {
          debugFlags.encounters = !debugFlags.encounters;
        },
      },
      {
        label: t('debug.npcs_ready'),
        group: 'option' as const,
        run: () => {
          const gs = gameState();
          setGameState({ ...gs, npcs: resetAllNpcs(gs.npcs) });
        },
      },
    ];
  }

  /**
   * The overlay's text lines, all of them (info, plus every menu group and entry with a `>` cursor in menu mode).
   * The E2E hook `debugLines()` returns these; the screen draws {@link drawnLines} (the menu part scrolls).
   */
  lines(): string[] {
    return this.mode === 'menu' ? [...this.infoLines(), ...this.menuLines()] : this.infoLines();
  }

  /**
   * What the overlay draws: {@link lines}, but only `DEBUG_MENU_ROWS` menu lines, a window that follows the
   * cursor (the real world's menu is taller than the screen).
   */
  drawnLines(): string[] {
    if (this.mode !== 'menu') return this.infoLines();
    const menu = this.menuLines();
    const cursorLine = Math.max(
      0,
      menu.findIndex((l) => l.startsWith('>')),
    );
    this.menuTop = scrollTop(cursorLine, this.menuTop, DEBUG_MENU_ROWS, menu.length);
    return [...this.infoLines(), ...menu.slice(this.menuTop, this.menuTop + DEBUG_MENU_ROWS)];
  }

  /** The info lines: map, tile, FPS, euros, and the last reload's result. */
  private infoLines(): string[] {
    const info = [
      t('debug.map', { map: this.where.map }),
      t('debug.tile', { x: this.where.x, y: this.where.y }),
      t('debug.fps', { fps: Math.round(this.game.loop.actualFps) }),
      ...(hasGameData() ? [t('debug.euros', { n: gameState().euros })] : []),
    ];
    if (this.reload.state === 'loading') info.push(t('debug.reload_loading'));
    else if (this.reload.state === 'ok') info.push(t('debug.reload_ok'));
    else if (this.reload.state === 'error') {
      info.push(t('debug.reload_failed', { n: this.reload.errors.length }));
      info.push(...this.reload.errors.slice(0, RELOAD_ERROR_LINES));
    }
    return info;
  }

  /** The menu's lines: group titles and entries, the cursor's entry marked with `>`. */
  private menuLines(): string[] {
    const out: string[] = [];
    const list = this.entries();
    list.forEach((e, i) => {
      if (i === 0) out.push(t('debug.teleport_title'));
      else if (e.group === 'battle' && list[i - 1]?.group !== 'battle') out.push(t('debug.battle_title'));
      else if (e.group === 'give' && list[i - 1]?.group !== 'give') out.push(t('debug.give_title'));
      else if (e.group === 'data' && list[i - 1]?.group !== 'data') out.push(t('debug.data_title'));
      else if (e.group === 'option' && list[i - 1]?.group !== 'option') out.push(t('debug.options_title'));
      out.push(`${i === this.cursor ? '>' : ' '} ${e.label}`);
    });
    return out;
  }

  /**
   * "Recargar datos": load and validate every content file and map again. On success: replace the game
   * data, check the game state against it (`parseSave` rules), load sprites / sounds that are new, then emit
   * `debug:reloaded`. On failure: keep the old data and show the errors.
   */
  async reloadContent(): Promise<void> {
    if (this.reload.state === 'loading') return;
    this.reload = { state: 'loading', errors: [] };
    const base = import.meta.env.BASE_URL;
    const result = await loadGameData(`${base}${dataDir()}`, undefined, { mapsBaseUrl: base });
    if (!result.ok) {
      const lines = result.errors.map(formatDataError);
      for (const line of lines) error(`Reload: ${line}`);
      this.reload = { state: 'error', errors: lines };
      return;
    }
    for (const w of result.warnings ?? []) warn(formatDataError(w));
    setGameData(result.data);
    const checked = parseSave(serializeSave(gameState(), new Date()), result.data);
    if (checked.ok) {
      for (const w of checked.warnings) warn(`Reload: ${w}`);
      setGameState(checked.state);
    } else warn(`Reload: game state kept as it was (${checked.reason})`);
    await this.loadNewAssets();
    log('Reload: content reloaded');
    this.reload = { state: 'ok', errors: [] };
    events.emit('debug:reloaded');
  }

  /** Load the sprites, sounds and tilesets of the current data that are not in Phaser's caches yet. */
  private loadNewAssets(): Promise<void> {
    const data = getGameData();
    const assets = collectAssets(data);
    let queued = 0;
    for (const path of assets.images) {
      if (this.textures.exists(path)) continue;
      this.load.image(path, path);
      queued++;
    }
    for (const m of data.maps.values()) {
      for (const ts of m.info.tilesetImages) {
        if (this.textures.exists(ts.path)) continue;
        this.load.image(ts.path, ts.path);
        queued++;
      }
    }
    for (const sound of assets.sounds) {
      if (this.cache.audio.exists(sound.key)) continue;
      this.load.audio(sound.key, sound.urls);
      queued++;
    }
    if (queued === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  /** Switch mode; opening/closing the menu is announced with `debug:menu`. */
  setMode(mode: DebugMode): void {
    const wasMenu = this.mode === 'menu';
    this.mode = mode;
    this.text.setVisible(mode !== 'hidden');
    this.panel.setVisible(mode !== 'hidden');
    if (wasMenu !== (mode === 'menu')) events.emit('debug:menu', { open: mode === 'menu' });
  }
}
