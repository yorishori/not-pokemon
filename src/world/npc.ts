/**
 * NPCs in the overworld: a sprite per `npcs.json` entry whose `map` is the current zone, driven by
 * the pure wander rules in `src/logic/npc-wander.ts`. This class only draws and holds state; the
 * OverworldScene decides what is blocked.
 *
 * Sprites: the image at the NPC's `sprite` path. If it is a 64 × 128 sheet (2 columns stand/stride ×
 * 4 rows down/left/right/up, the player's layout) the NPC shows its facing and walk frames; any other
 * size (e.g. the 32 × 32 placeholders) is drawn as a single still image.
 *
 * Enemy NPCs: {@link NpcActor.showAlert} draws the "!" bubble (text `npc.alert`) above the NPC
 * (lowered over its head when that would be above the camera view);
 * {@link NpcActor.engage}, {@link NpcActor.stepTo} and {@link NpcActor.face} walk it up to the player.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import type { Rng } from '../core/rng';
import type { Npc } from '../data/schemas';
import { renderPosition, walkFrame, type BlockedFn, type MoveEvent } from '../logic/movement';
import {
  arrivalTile,
  createNpcMove,
  endTalk,
  engage,
  faceTo,
  forceStep,
  occupiedTiles,
  startTalk,
  updateNpcMove,
  type NpcMove,
} from '../logic/npc-wander';
import type { Point } from '../logic/npc-state';
import { playerFrame } from './player';

/** "!" bubble: size and offset above the NPC's tile (base pixels). */
const ALERT_W = 14;
const ALERT_H = 18;
const ALERT_DEPTH = 4;

/** Frame names added to a sheet texture (`npc0` … `npc7`, same order as the player sheet). */
const frameName = (i: number): string => `npc${i}`;

/** Name of frame `i` (the player sheet's order, see `playerFrame`) of a sheet prepared by {@link prepareSheet}. */
export function npcFrame(i: number): string {
  return frameName(i);
}

/** If `key` is a 2 × 4 sheet of tiles, add its frames once and return true. */
export function prepareSheet(scene: Phaser.Scene, key: string): boolean {
  if (!scene.textures.exists(key)) return false;
  const tex = scene.textures.get(key);
  if (tex.has(frameName(0))) return true;
  const src = tex.getSourceImage();
  if (src.width !== TILE_SIZE * 2 || src.height !== TILE_SIZE * 4) return false;
  for (let i = 0; i < 8; i += 1) {
    tex.add(frameName(i), 0, (i % 2) * TILE_SIZE, Math.floor(i / 2) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
  return true;
}

/** The NPCs that live on `mapId`, in `npcs.json` order. */
export function npcsOnMap(all: Iterable<Readonly<Npc>>, mapId: string): Readonly<Npc>[] {
  return [...all].filter((n) => n.map === mapId);
}

/** One NPC on the current map. */
export class NpcActor {
  readonly npc: Readonly<Npc>;
  readonly sprite: Phaser.GameObjects.Image;
  private move: NpcMove;
  private readonly sheet: boolean;
  private readonly alert: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;

  /** `alertText` is the bubble's text (`t('npc.alert')`). */
  constructor(scene: Phaser.Scene, npc: Readonly<Npc>, rng: Rng, alertText = '!') {
    this.npc = npc;
    this.scene = scene;
    const bubble = scene.add
      .rectangle(0, 0, ALERT_W, ALERT_H, 0xffffff)
      .setOrigin(0)
      .setStrokeStyle(2, 0x202028);
    const mark = scene.add
      .text(ALERT_W / 2, ALERT_H / 2, alertText, {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#d02020',
      })
      .setOrigin(0.5);
    this.alert = scene.add.container(0, 0, [bubble, mark]).setDepth(ALERT_DEPTH).setVisible(false);
    this.move = createNpcMove(npc.spawn.x, npc.spawn.y, npc.facing, npc.wander, rng);
    this.sheet = prepareSheet(scene, npc.sprite);
    this.sprite = scene.add.image(0, 0, npc.sprite).setOrigin(0).setDepth(2);
    this.sprite.setName(`npc:${npc.id}`);
    this.draw();
  }

  /** Current movement state. */
  get state(): Readonly<NpcMove> {
    return this.move;
  }

  /** Advance by `dtMs`; `blocked` must include the player and the other NPCs. */
  update(dtMs: number, blocked: BlockedFn, rng: Rng): MoveEvent[] {
    const r = updateNpcMove(this.move, this.npc.wander, dtMs, blocked, rng);
    this.move = r.state;
    this.draw();
    return r.events;
  }

  /** True if the NPC stands on, or is stepping into or out of, tile (x, y). */
  occupies(x: number, y: number): boolean {
    return occupiedTiles(this.move).some((p) => p.x === x && p.y === y);
  }

  /** The tile it stands on once its current step ends. */
  arrival(): Point {
    return arrivalTile(this.move);
  }

  /** Stop wandering and face the player (who faces `playerFacing`). */
  beginTalk(playerFacing: Npc['facing']): void {
    this.move = startTalk(this.move, playerFacing);
    this.draw();
  }

  /** Enemy approach: stop wandering without turning. Ended by {@link finishTalk}. */
  engage(): void {
    this.move = engage(this.move);
  }

  /** Walk one tile onto the adjacent tile `to` (the caller checks it is free). */
  stepTo(to: Point): void {
    this.move = forceStep(this.move, to);
    this.draw();
  }

  /** Face `facing` (after the current step, if any). */
  face(facing: Npc['facing']): void {
    this.move = faceTo(this.move, facing);
    this.draw();
  }

  /** Show or hide the "!" bubble above the NPC. */
  showAlert(on: boolean): void {
    this.alert.setVisible(on);
    this.draw();
  }

  /** True while the "!" bubble shows. */
  get alerting(): boolean {
    return this.alert.visible;
  }

  /** Conversation over: wander again after a fresh wait. */
  finishTalk(rng: Rng): void {
    this.move = endTalk(this.move, this.npc.wander, rng);
  }

  private draw(): void {
    const pos = renderPosition(this.move);
    this.sprite.setPosition(Math.round(pos.x * TILE_SIZE), Math.round(pos.y * TILE_SIZE));
    // Above the head; never above the top of the view (an enemy 4 tiles up sits on the top screen row).
    const top = this.scene.cameras.main.worldView.y + 2;
    this.alert.setPosition(
      this.sprite.x + (TILE_SIZE - ALERT_W) / 2,
      Math.max(this.sprite.y - ALERT_H - 2, top),
    );
    if (this.sheet) this.sprite.setFrame(frameName(playerFrame(this.move.facing, walkFrame(this.move))));
  }
}
