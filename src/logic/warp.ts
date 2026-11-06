/**
 * Warps between maps. A warp is a rectangle in a map's `warps` object layer with the
 * properties `toMap`, `toX`, `toY`, `toFacing` and `trigger`:
 * - `trigger = step` (doors, map edges): fires when the player FINISHES a step onto a tile inside it.
 * - `trigger = action` (the car): fires when the player stands still facing a tile inside it and
 *   presses A.
 * - `toX` / `toY` left out = keep the player's column / row (map edges: "same row"). `toFacing` left
 *   out = keep the facing.
 * - A step warp may lie outside the map (one tile past an edge): those off-map tiles become walkable,
 *   so walking off the edge enters the warp. Every other off-map tile blocks.
 * - Car warps: an `action` warp with the property `car` (`murcia` or `valencia`) is the Audi. Its
 *   destination comes from `car.json` (`toMurcia` / `toValencia`), so `toMap` / `toX` / `toY` / `toFacing`
 *   are not used; the OverworldScene checks the unlock pairs and runs the CarScene instead of warping
 *   (`src/logic/car.ts`).
 * - Portal warps: an `action` warp with the bool property `portal = true` is the mystery door to the story realm.
 *   It has no target of its own either: the OverworldScene asks and then starts the StoryScene.
 */
import type { Facing } from '../data/schemas';
import type { CarDestination } from './car';
import type { Point } from './npc-state';

/** One warp rectangle, in tiles. */
export interface Warp {
  /** The Tiled object name (used in error messages). */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  toMap: string;
  toX: number | null;
  toY: number | null;
  toFacing: Facing | null;
  trigger: 'step' | 'action';
  /** Set on the Audi's `action` warp; the trip's destination (`toMap` is then empty and unused). */
  car: CarDestination | null;
  /** True on the mystery door to the story realm (`toMap` is then empty and unused). */
  portal: boolean;
}

/** Where a warp sends the player. */
export interface WarpTarget {
  map: string;
  x: number;
  y: number;
  facing: Facing;
}

/** True if tile (x, y) lies inside the warp rectangle. */
export function insideWarp(w: Warp, x: number, y: number): boolean {
  return x >= w.x && y >= w.y && x < w.x + w.width && y < w.y + w.height;
}

/** The first warp with this trigger covering (x, y), or `null`. */
export function warpAt(warps: readonly Warp[], x: number, y: number, trigger: Warp['trigger']): Warp | null {
  return warps.find((w) => w.trigger === trigger && insideWarp(w, x, y)) ?? null;
}

/** Destination of `warp` for a player at `from` (its tile inside the warp) facing `from.facing`. */
export function warpDestination(warp: Warp, from: Point & { facing: Facing }): WarpTarget {
  return {
    map: warp.toMap,
    x: warp.toX ?? from.x,
    y: warp.toY ?? from.y,
    facing: warp.toFacing ?? from.facing,
  };
}

/** Every distinct target tile of a warp (one per tile of its rectangle when an axis is kept); none for a car or portal warp. */
export function warpTargetTiles(warp: Warp): Point[] {
  if (warp.car || warp.portal) return [];
  const seen = new Set<string>();
  const out: Point[] = [];
  for (let y = warp.y; y < warp.y + warp.height; y += 1) {
    for (let x = warp.x; x < warp.x + warp.width; x += 1) {
      const t = { x: warp.toX ?? x, y: warp.toY ?? y };
      const key = `${t.x},${t.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    }
  }
  return out;
}

/**
 * Blocking test for the player on a map with warps: inside the map use `solidAt`; outside it only
 * tiles covered by a step warp can be entered.
 */
export function blockedWithWarps(
  size: { width: number; height: number },
  warps: readonly Warp[],
  solidAt: (x: number, y: number) => boolean,
): (x: number, y: number) => boolean {
  return (x, y) => {
    const inside = x >= 0 && y >= 0 && x < size.width && y < size.height;
    return inside ? solidAt(x, y) : warpAt(warps, x, y, 'step') === null;
  };
}
