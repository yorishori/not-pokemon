import { describe, expect, it } from 'vitest';
import { collectAssets } from '../../src/data/assets';
import { validateGameData } from '../../src/data/loader';
import { validFiles } from './fixture';

describe('collectAssets', () => {
  it('lists every sprite and sound in the data once, with OGG then MP3 urls', () => {
    const result = validateGameData(validFiles());
    if (!result.ok) throw new Error('fixture invalid');
    const { images, sounds } = collectAssets(result.data);
    // 3 flexymon × 3 sprites + 6 items + 5 NPCs (the healer, storage and shopkeeper)
    // + the title image and intro coworker + the minimaps of the two outdoor zones (test, test_east; the
    // indoor test_house has none) + the Audi side view.
    expect(images).toHaveLength(25);
    expect(images).toContain('assets/sprites/car/audi.png');
    expect(images).toContain('assets/ui/minimap_test.png');
    expect(images).toContain('assets/ui/minimap_test_east.png');
    expect(images).not.toContain('assets/ui/minimap_test_house.png');
    expect(images).toContain('assets/ui/title.png');
    expect(images).toContain('assets/sprites/npcs/companera.png');
    expect(images).toContain('assets/sprites/flexymon/portatil_icon.png');
    expect(images).toContain('assets/sprites/items/lata.png');
    expect(images).toContain('assets/sprites/npcs/becario.png');
    // 3 cries + 6 attack sounds + 2 voices + 2 music (test, interior) + the jingle (the coworker reuses a voice)
    // + the engine + the 5 interface sounds + the battle music.
    expect(sounds).toHaveLength(21);
    expect(sounds.map((s) => s.key)).toContain('assets/audio/music/battle.ogg');
    expect(sounds.map((s) => s.key)).toContain('assets/audio/sfx/ui_money.ogg');
    expect(sounds.map((s) => s.key)).toContain('assets/audio/sfx/car_engine.ogg');
    expect(sounds.map((s) => s.key)).toContain('assets/audio/sfx/jingle_starter.ogg');
    expect(sounds).toContainEqual({
      key: 'assets/audio/music/test.ogg',
      urls: ['assets/audio/music/test.ogg', 'assets/audio/music/test.mp3'],
    });
  });
});
