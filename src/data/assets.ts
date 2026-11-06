/**
 * Lists every asset referenced by the content, for the Preload scene.
 * Each asset is loaded with its JSON path as the Phaser key (e.g. `assets/sprites/items/cafe.png`).
 */
import type { GameData } from './game-data';
import { minimapPath } from '../logic/minimap';

/** A sound to load: the key (path as written in the JSON) and the OGG/MP3 URLs to try, in order. */
export interface SoundAsset {
  key: string;
  urls: string[];
}

/** Every image path and sound referenced by the data, de-duplicated and sorted. */
export interface AssetList {
  images: string[];
  sounds: SoundAsset[];
}

/**
 * Collect sprites (flexymon, items, NPCs, title + coworker, the minimap of every outdoor zone, the Audi)
 * and sounds (cries, attacks, voices, zone music, jingle, engine, interface sounds), plus the story bosses' sprites and
 * voices and the story music.
 */
export function collectAssets(data: GameData): AssetList {
  const images = new Set<string>();
  const sounds = new Set<string>();
  for (const sp of data.flexymon.values()) {
    images.add(sp.sprite.front).add(sp.sprite.back).add(sp.sprite.icon);
    sounds.add(sp.cry);
  }
  for (const it of data.items.values()) images.add(it.sprite);
  for (const npc of data.npcs.values()) {
    images.add(npc.sprite);
    sounds.add(npc.voice);
  }
  for (const a of data.attacks.values()) sounds.add(a.sound);
  for (const z of data.zones.values()) {
    sounds.add(z.music);
    // Outdoor zones have a pre-drawn minimap (`npm run placeholders` draws it from the map).
    if (!z.indoor) images.add(minimapPath(z.id));
  }
  // The title image, the intro coworker and the handover jingle.
  images.add(data.intro.titleImage).add(data.intro.coworker.sprite);
  sounds.add(data.intro.coworker.voice).add(data.intro.jingle);
  // The car trip scene.
  images.add(data.car.sprite);
  sounds.add(data.car.sound);
  // The story realm: its music and every boss's sprite and voice.
  sounds.add(data.story.music);
  for (const boss of data.story.bosses) {
    images.add(boss.sprite);
    sounds.add(boss.voice);
  }
  // The interface sounds (cursor, confirm, cancel, error, money).
  for (const path of Object.values(data.sounds)) sounds.add(path);

  return {
    images: [...images].sort(),
    sounds: [...sounds].sort().map((key) => {
      const stem = key.replace(/\.(ogg|mp3)$/, '');
      return { key, urls: [`${stem}.ogg`, `${stem}.mp3`] };
    }),
  };
}
