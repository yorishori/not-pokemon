import { describe, expect, it } from 'vitest';
import {
  blockedWithWarps,
  insideWarp,
  warpAt,
  warpDestination,
  warpTargetTiles,
  type Warp,
} from '../../src/logic/warp';

const door: Warp = {
  name: 'door',
  x: 6,
  y: 6,
  width: 1,
  height: 1,
  toMap: 'house',
  toX: 4,
  toY: 7,
  toFacing: 'up',
  trigger: 'step',
  car: null,
  portal: false,
};
const edge: Warp = {
  ...door,
  name: 'edge',
  x: 30,
  y: 0,
  width: 1,
  height: 20,
  toMap: 'east',
  toX: 0,
  toY: null,
  toFacing: null,
};
const car: Warp = { ...door, name: 'car', x: 10, y: 2, width: 2, height: 1, trigger: 'action' };

describe('warps', () => {
  it('finds the warp covering a tile, by trigger', () => {
    expect(insideWarp(edge, 30, 19)).toBe(true);
    expect(insideWarp(edge, 30, 20)).toBe(false);
    expect(warpAt([door, edge, car], 6, 6, 'step')).toBe(door);
    expect(warpAt([door, edge, car], 11, 2, 'action')).toBe(car);
    expect(warpAt([door, edge, car], 11, 2, 'step')).toBeNull();
  });

  it('a fixed target uses toX/toY/toFacing', () => {
    expect(warpDestination(door, { x: 6, y: 6, facing: 'left' })).toEqual({
      map: 'house',
      x: 4,
      y: 7,
      facing: 'up',
    });
  });

  it('an edge warp keeps the row and the facing', () => {
    expect(warpDestination(edge, { x: 30, y: 12, facing: 'right' })).toEqual({
      map: 'east',
      x: 0,
      y: 12,
      facing: 'right',
    });
  });

  it('lists every target tile (one per row for an edge warp)', () => {
    expect(warpTargetTiles(door)).toEqual([{ x: 4, y: 7 }]);
    // A car warp lands on the car.json endpoints, not on tiles of its own.
    expect(warpTargetTiles({ ...car, car: 'murcia' })).toEqual([]);
    // The mystery door opens the story realm: no tiles either.
    expect(warpTargetTiles({ ...car, portal: true })).toEqual([]);
    const tiles = warpTargetTiles(edge);
    expect(tiles).toHaveLength(20);
    expect(tiles[12]).toEqual({ x: 0, y: 12 });
    expect(warpTargetTiles({ ...edge, toX: null, toY: 3, width: 2, height: 2 })).toEqual([
      { x: 30, y: 3 },
      { x: 31, y: 3 },
    ]);
  });

  it('off-map tiles are walkable only under a step warp', () => {
    const blocked = blockedWithWarps(
      { width: 30, height: 20 },
      [edge, { ...car, x: -1, y: 5 }],
      (x) => x === 3,
    );
    expect(blocked(30, 5)).toBe(false); // edge warp
    expect(blocked(31, 5)).toBe(true);
    expect(blocked(-1, 5)).toBe(true); // action warps do not open off-map tiles
    expect(blocked(3, 0)).toBe(true); // solid
    expect(blocked(4, 0)).toBe(false);
  });
});
