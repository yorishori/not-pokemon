# src/world — overworld objects (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `music.ts` | `MusicPlayer`: zone music; same file keeps playing, a different one crossfades over `MUSIC_FADE_MS`. Driven by the game loop in `main.ts` (`zone:entered` → `play`; `battle:started` → the battle music, `battle:ended` → back to the zone's). `setGain` (the music volume option, 0–1) scales every track at once. |
| `camera.ts` | `cameraBounds`: map bounds, or a screen-sized range centred on maps smaller than the screen. |
| `zone-map.ts` | `drawZoneMap(scene, zone)` (moved out of the Overworld): builds a zone's tilemap (layers `ground` 0, `deco` 1, `above` 3; `collision` hidden), sets the camera's black background and bounds, returns the map's `MapInfo`. Used by the Overworld and the Intro. |
| `player.ts` | `Player`: the player sprite, driven by `src/logic/movement.ts` (grid steps, tap-to-turn); `halt`, `face` (turn to an enemy that walked up). Sheet `assets/sprites/player.png`: 32 × 32 frames, columns stand/stride, rows down/left/right/up. |

| `npc.ts` | `NpcActor`: one NPC from `npcs.json` on the current map, driven by `src/logic/npc-wander.ts`; `npcsOnMap`. A 64 × 128 sprite is used as a sheet (player layout: columns stand/stride, rows down/left/right/up); any other size is drawn as one still image. The "!" bubble (`showAlert`, text `npc.alert`), `engage` / `stepTo` / `face` for an enemy walking up to the player. The Intro draws its coworker with it (`engage` + `stepTo`). |

Encounter rules live in `src/logic/encounter.ts` and warp rules in `src/logic/warp.ts` (both pure). Map reading (solid cells, spawn points) is
pure and lives in `src/data/tiled.ts`.
