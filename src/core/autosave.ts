/**
 * Auto-save (docs/GAME-RULES.md › Saving): writes the game state to the save store at every save point,
 * announced on the event bus as `save:request`:
 * - `map` — the overworld entered a map (warp, respawn, the first map after the title);
 * - `battle` — a battle ended (after the Losing rule or the reward was applied);
 * - `shop` — a shop closed; `healer` — the office healer healed the team; `menu` — the Start menu closed;
 * - `portal` — the player goes through the mystery door to the story realm (which keeps its own save).
 * Each written save emits `save:done` (the HUD shows "Guardando…" for `SAVE_ICON_MS`).
 *
 * Other rules:
 * - Nothing is saved until the overworld has been entered once (`zone:entered`), so the title screen never
 *   overwrites a save with a game that has not started.
 * - The player's position in the game state follows every `player:moved`, so a save always holds where
 *   the player stands.
 * - When the page is hidden or closed (`visibilitychange` hidden, `pagehide`) the game is also saved,
 *   quietly (no `save:done`), so a reload "at any time" comes back to the same place.
 *   The quiet save is skipped when the slot no longer holds what this page last wrote (changed in devtools or
 *   by another tab): then the next load reads that text, and a broken one starts fresh.
 * - {@link Autosave.disable} stops all saving until the page reloads (the debug "delete save" command).
 */
import type { GameState } from '../logic/save';
import { events, type GameEvents } from './events';
import { log, warn } from './log';
import type { SaveStore } from './save-store';

/** Why a save happened (the `save:request` reasons). */
export type SaveReason = GameEvents['save:request']['reason'];

/** What the auto-saver needs: where to write and how to read / update the live game state. */
export interface AutosaveDeps {
  store: SaveStore;
  getState: () => GameState;
  setState: (state: GameState) => void;
  now?: () => Date;
}

/** Listens to the save points and writes the save. Create one in `main.ts` and call {@link Autosave.start}. */
export class Autosave {
  private active = false;
  private enabled = true;
  /** The save text this page wrote last (`null` before the first save). */
  private lastText: string | null = null;
  /** Reasons of every save written since the page loaded (quiet saves are `quiet`). For the E2E hooks. */
  readonly written: (SaveReason | 'quiet')[] = [];

  constructor(private readonly deps: AutosaveDeps) {}

  /** Subscribe to the bus (and, when given, to the page's hide / close events). Returns an unsubscribe. */
  start(
    page?: Pick<Window, 'addEventListener' | 'removeEventListener'> & { document?: Document },
  ): () => void {
    const offs = [
      events.on('zone:entered', () => {
        this.active = true;
      }),
      events.on('player:moved', ({ map, x, y, facing }) => {
        if (!this.active) return;
        const gs = this.deps.getState();
        const p = gs.player;
        if (p.map === map && p.x === x && p.y === y && p.facing === facing) return;
        this.deps.setState({ ...gs, player: { ...p, map, x, y, facing } });
      }),
      events.on('save:request', ({ reason }) => {
        this.save(reason);
      }),
    ];
    if (page) {
      const quiet = () => this.saveQuietly();
      const onVisibility = () => {
        if (page.document?.visibilityState === 'hidden') quiet();
      };
      page.addEventListener('pagehide', quiet);
      page.document?.addEventListener('visibilitychange', onVisibility);
      offs.push(() => {
        page.removeEventListener('pagehide', quiet);
        page.document?.removeEventListener('visibilitychange', onVisibility);
      });
    }
    return () => offs.forEach((off) => off());
  }

  /** Save now for `reason` and emit `save:done`. False (nothing written) before the game started or when disabled. */
  save(reason: SaveReason): boolean {
    if (!this.write()) return false;
    this.written.push(reason);
    log(`Save: written (${reason})`);
    events.emit('save:done', { reason });
    return true;
  }

  /** Save without announcing it (page hidden / closing); skipped if the slot was changed outside this page. */
  saveQuietly(): boolean {
    if (!this.saving) return false;
    if (this.lastText !== null && this.deps.store.raw() !== this.lastText) {
      warn('Save: the save slot was changed outside the game; not overwriting it');
      return false;
    }
    if (!this.write()) return false;
    this.written.push('quiet');
    return true;
  }

  /** Stop saving until the page reloads. */
  disable(): void {
    this.enabled = false;
  }

  /** True once the game started and saving is not disabled. */
  get saving(): boolean {
    return this.active && this.enabled;
  }

  private write(): boolean {
    if (!this.saving) return false;
    if (!this.deps.store.write(this.deps.getState(), this.deps.now?.() ?? new Date())) return false;
    this.lastText = this.deps.store.raw();
    return true;
  }
}
