import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  collectAssetPaths,
  MINIMAP_COLOURS,
  makeMinimapPng,
  makePng,
  readMinimapTargets,
  isCarSprite,
  makeCarPng,
  makeTitlePng,
  pngSize,
  TITLE_IMAGE,
  wrapLabel,
} from '../../tools/make-placeholders';

describe('make-placeholders', () => {
  it('collects asset paths from nested JSON', () => {
    const json = [
      {
        id: 'portatil',
        sprite: { front: 'assets/sprites/flexymon/portatil_front.png' },
        cry: 'assets/audio/sfx/cry_portatil.ogg',
        name: 'Portátil',
        file: 'maps/test/test.tmj',
      },
      { voice: 'assets/audio/sfx/voice_low.mp3', n: 3, x: null },
    ];
    expect([...collectAssetPaths(json)].sort()).toEqual([
      'assets/audio/sfx/cry_portatil.ogg',
      'assets/audio/sfx/voice_low.mp3',
      'assets/sprites/flexymon/portatil_front.png',
    ]);
  });

  it('chooses sizes by asset kind', () => {
    expect(pngSize('assets/sprites/flexymon/portatil_front.png')).toBe(64);
    expect(pngSize('assets/sprites/flexymon/portatil_back.png')).toBe(64);
    expect(pngSize('assets/sprites/flexymon/portatil_icon.png')).toBe(16);
    expect(pngSize('assets/sprites/items/cafe.png')).toBe(16);
    expect(pngSize('assets/sprites/npcs/camarero.png')).toBe(32);
  });

  it('wraps labels on underscores', () => {
    expect(wrapLabel('TIENDA_SUR', 6)).toEqual(['TIENDA', 'SUR']);
    expect(wrapLabel('PORTATIL', 5)).toEqual(['PORTA', 'TIL']);
  });

  it('writes an opaque PNG of the requested size', () => {
    const png = PNG.sync.read(makePng('raton_front', 64));
    expect(png.width).toBe(64);
    expect(png.height).toBe(64);
    expect(png.data[3]).toBe(255);
  });

  it('the title placeholder fills the 512 × 288 screen, opaque', () => {
    expect(TITLE_IMAGE).toBe('assets/ui/title.png');
    const png = PNG.sync.read(makeTitlePng());
    expect([png.width, png.height]).toEqual([512, 288]);
    for (let i = 3; i < png.data.length; i += 4 * 997) expect(png.data[i]).toBe(255);
  });

  it('draws the car as a 96 × 40 side view with a transparent background', () => {
    expect(isCarSprite('assets/sprites/car/audi.png')).toBe(true);
    expect(isCarSprite('assets/sprites/npcs/becario.png')).toBe(false);
    const png = PNG.sync.read(makeCarPng());
    expect([png.width, png.height]).toEqual([96, 40]);
    expect(png.data[3]).toBe(0); // top-left corner is transparent
    const at = (x: number, y: number) => [...png.data.subarray((y * 96 + x) * 4, (y * 96 + x) * 4 + 4)];
    expect(at(40, 24)).toEqual([244, 244, 240, 255]); // white body
  });

  it('draws a minimap from the collision data, one square per tile', () => {
    const map = {
      width: 3,
      height: 2,
      solid: [true, false, false, false, false, true],
      encounter: [false, true, false, false, false, false],
    };
    const png = PNG.sync.read(makeMinimapPng(map, 2));
    expect([png.width, png.height]).toEqual([6, 4]);
    const at = (x: number, y: number) => [...png.data.subarray((y * 6 + x) * 4, (y * 6 + x) * 4 + 3)];
    expect(at(0, 0)).toEqual(MINIMAP_COLOURS.solid);
    expect(at(1, 1)).toEqual(MINIMAP_COLOURS.solid);
    expect(at(2, 0)).toEqual(MINIMAP_COLOURS.encounter);
    expect(at(4, 0)).toEqual(MINIMAP_COLOURS.open);
    expect(at(5, 3)).toEqual(MINIMAP_COLOURS.solid);
  });

  it('makes a minimap for every outdoor zone only, of the real world and the test world', () => {
    expect(readMinimapTargets()).toEqual([
      ...['alboraya', 'valencia', 'pueblo', 'murcia', 'historia'].map((id) => ({
        assetPath: `assets/ui/minimap_${id}.png`,
        mapFile: `maps/${id}.tmj`,
      })),
      { assetPath: 'assets/ui/minimap_test.png', mapFile: 'maps/test/test.tmj' },
      { assetPath: 'assets/ui/minimap_test_east.png', mapFile: 'maps/test/test_east.tmj' },
    ]);
  });
});
