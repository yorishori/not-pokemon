/**
 * Typed event bus. Scenes talk through it instead of reaching into each other.
 *
 * Add new events to {@link GameEvents}: the key is the event name, the value its payload type
 * (`void` for no payload).
 */
import type { Options } from '../logic/options';

/** Every game-wide event and its payload. New events are added here, each with a doc comment. */
export interface GameEvents {
  /** Content JSON loaded and validated; `getGameData()` is available. */
  'data:loaded': void;
  /** Content failed validation; payload = formatted `file › path › message` lines. */
  'data:error': string[];
  /** Preload finished; all assets are in the cache. */
  'game:ready': void;
  /** The overworld finished building a zone's map. */
  'zone:entered': { zone: string };
  /** The player finished a step, was placed on a map or turned on the spot. Tile coordinates match Tiled. */
  'player:moved': { map: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' };
  /** Debug menu: opened/closed. While open the overworld ignores movement. */
  'debug:menu': { open: boolean };
  /** Debug command: teleport the player to a zone's `default` spawn. */
  'debug:teleport': { map: string };
  /** Debug command: start a wild battle against one fresh flexymon of this species. */
  'debug:battle': { speciesId: string };
  /** The BattleScene started (wild, NPC or debug battle); `main.ts` switches to the battle music. */
  'battle:started': void;
  /** The BattleScene finished; the game state already holds the team after the battle. */
  'battle:ended': { result: 'win' | 'lose' | 'fled' };
  /**
   * A point where the game auto-saves (`healer`, `shop`, `map` (overworld entered a
   * map), `battle` (battle ended) and `menu` (Start menu closed); `src/core/autosave.ts` writes the save).
   */
  'save:request': { reason: 'healer' | 'shop' | 'map' | 'battle' | 'menu' };
  /** An overlay scene opened from the overworld (Shop, Storage; Menu) closed; the overworld resumes. */
  'overlay:closed': { scene: string };
  /** A save was written for this reason (the HUD shows "Guardando…"). Quiet saves on page hide are not announced. */
  'save:done': { reason: 'healer' | 'shop' | 'map' | 'battle' | 'menu' };
  /** The player changed an option; payload = the new options. */
  'options:changed': Options;
  /** Debug command: delete the save and reload the page. */
  'debug:delete_save': void;
  /**
   * Debug command: the content was reloaded ("Recargar datos") and the game state checked against it; the
   * overworld rebuilds the current map where the player stands.
   */
  'debug:reloaded': void;
  /** The CarScene finished the trip (played out or skipped); the overworld moves to the arrival point. */
  'car:ended': { to: 'murcia' | 'valencia' };
}

type Handler<P> = P extends void ? () => void : (payload: P) => void;

/** A small typed emitter over an event map `E`. */
export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<(payload: unknown) => void>>();

  /** Subscribe; returns a function that unsubscribes. */
  on<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => this.off(name, handler);
  }

  /** Subscribe for a single emission only. */
  once<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    const wrapper = ((payload: unknown) => {
      off();
      (handler as (payload: unknown) => void)(payload);
    }) as Handler<E[K]>;
    const off = this.on(name, wrapper);
    return off;
  }

  /** Unsubscribe a handler previously passed to {@link on}. */
  off<K extends keyof E>(name: K, handler: Handler<E[K]>): void {
    this.handlers.get(name)?.delete(handler as (payload: unknown) => void);
  }

  /** Call every handler of `name`, in subscription order. */
  emit<K extends keyof E>(name: K, ...payload: E[K] extends void ? [] : [E[K]]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const h of [...set]) h(payload[0]);
  }

  /** Remove every handler (all events, or only `name`). */
  clear(name?: keyof E): void {
    if (name === undefined) this.handlers.clear();
    else this.handlers.delete(name);
  }
}

/** The shared game event bus. */
export const events = new EventBus<GameEvents>();
