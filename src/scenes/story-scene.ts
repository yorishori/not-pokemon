/**
 * StoryScene — the story realm's map (*Modo historia*, docs/GAME-RULES.md › Story mode): a board of stops joined by
 * a fixed path, like a board game. Started by the OverworldScene's mystery door, in place of the overworld.
 *
 * - Draws `story.json › map` (a zone of `zones.json`, built from `tools/world/historia.txt`) with `drawZoneMap`,
 *   the player on the stop of the story state (`at`), and the bosses on their `stand` tiles: the beaten ones and
 *   the next one to fight (`bossStatus` `ready`); the bosses further on are not there yet. A small flag marks every
 *   beaten stop. The camera follows the player. A panel at the bottom (under any open dialogue box)
 *   names the stop and what A does there.
 * - Setup (`stage`, `src/logic/story.ts`): `welcome` shows `story.json › welcome`, then `team` opens the
 *   StoryTeamScene (required), then `shop` opens the story shop (ShopScene `{ story: true }`), then the `map`.
 * - Moving: only between neighbouring stops, by pressing the direction of the path's first step towards one
 *   (`walkTiles`); the player walks the whole way tile by tile and input waits until it arrives. Towards a stop that
 *   is still closed (`stepTarget` null) "Primero tienes que vencer a {name}." shows instead. Reaching a stop saves
 *   the story slot quietly.
 * - A on the office opens its menu: *Cambiar equipo* (StoryTeamScene), *Tienda* (story shop), *Volver al juego*
 *   (saves, fades out and restarts the OverworldScene where the main game's player stands, in front of the door),
 *   *Reiniciar historia* (asks Sí / No; `restartStory`, then the setup runs again from the team) and *Salir*.
 * - A on a boss's stop: the `ready` boss says its `dialogue`, then a battle starts (flash, BattleScene with
 *   `story: { at }` against `bossTeam`, this scene sleeps). The beaten ones say their `defeatDialogue` and offer
 *   "¿Revancha?" (Sí / No). After the battle: a first win shows the boss's `defeatDialogue` (and after the last boss,
 *   `story.json › victory`) and the next boss appears; a loss says the team recovered and stays on the stop.
 * - Overlays (team, shop) pause this scene until `overlay:closed`. Emits `story:entered` on start (main.ts plays
 *   `story.json › music`). Start and M do nothing here.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from '../config/game';
import { events } from '../core/events';
import { input, type Direction } from '../core/input';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { gameState } from '../core/session';
import { saveStory, setStoryState, storyState } from '../core/story-session';
import { uiSound } from '../core/ui-sound';
import { getGameData } from '../data/game-data';
import type { Facing } from '../data/schemas';
import { t } from '../i18n';
import { BATTLE_FLASHES, BATTLE_FLASH_MS, WARP_FADE_MS } from '../logic/constants';
import type { Point } from '../logic/npc-state';
import {
  bossAt,
  bossStatus,
  bossTeam,
  finishShop,
  finishWelcome,
  restartStory,
  stepTarget,
  storyFinished,
  storyStops,
  walkTiles,
  type StoryStop,
} from '../logic/story';
import { ChoiceBox, type ChoiceState } from '../ui/choice-box';
import { DialogBox, type DialogState } from '../ui/dialog-box';
import { framedBox } from '../ui/frame';
import { npcFrame, prepareSheet } from '../world/npc';
import { Player, playerFrame } from '../world/player';
import { drawZoneMap } from '../world/zone-map';
import { BATTLE_SCENE, type BattleSceneData } from './battle-scene';
import { OVERWORLD_SCENE, type OverworldData } from './overworld-scene';
import { SHOP_SCENE, type ShopSceneData } from './shop-scene';
import { STORY_TEAM_SCENE, type StoryTeamSceneData } from './story-team-scene';

/** Scene key of {@link StoryScene}. */
export const STORY_SCENE = 'Story';

/** What the story map is doing. */
export type StoryUi = 'idle' | 'walk' | 'talk' | 'menu' | 'overlay' | 'battle' | 'leaving';

/** The story map as plain data (for the E2E hooks). */
export interface StoryView {
  ui: StoryUi;
  stage: string;
  /** The stop the player stands on (or walks from) and the player's tile. */
  at: number;
  x: number;
  y: number;
  beaten: number;
  /** Boss ids standing on the map now. */
  bossesShown: string[];
  /** The two lines of the bottom panel. */
  panel: string[];
  dialogue: DialogState | null;
  choice: ChoiceState | null;
}

const PANEL_H = 44;
const DEPTH_PANEL = 50;
const FLAG_DEPTH = 1.5;
const MAX_FRAME_MS = 250;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};

/** Direction of the step from `a` to the neighbouring tile `b`. */
function directionTo(a: Point, b: Point): Facing {
  if (b.x > a.x) return 'right';
  if (b.x < a.x) return 'left';
  return b.y > a.y ? 'down' : 'up';
}

/** The story realm's map. */
export class StoryScene extends Phaser.Scene {
  private stops: StoryStop[] = [];
  private player: Player | null = null;
  private dialog!: DialogBox;
  private choice!: ChoiceBox;
  private ui: StoryUi = 'idle';
  /** Tiles still to walk, and the stop they lead to. */
  private walk: { tiles: Point[]; to: number } | null = null;
  private bosses: Phaser.GameObjects.Image[] = [];
  private flags: Phaser.GameObjects.Graphics | null = null;
  private panelTop!: Phaser.GameObjects.Text;
  private panelBottom!: Phaser.GameObjects.Text;
  private debugMenuOpen = false;
  /** Bosses beaten when the last battle started (to tell a first win). */
  private beatenBefore = 0;

  constructor() {
    super(STORY_SCENE);
  }

  create(): void {
    const data = getGameData();
    const zone = data.zones.get(data.story.map);
    if (!zone) throw new Error(`Story: unknown map "${data.story.map}"`);
    drawZoneMap(this, zone);
    this.stops = storyStops(data.story);
    this.ui = 'idle';
    this.walk = null;
    this.debugMenuOpen = false;
    const ss = storyState();
    const stop = this.stops[ss.at] ?? this.stops[0]!;
    this.player = new Player(this, stop.x, stop.y, 'down');
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1, -TILE_SIZE / 2, -TILE_SIZE / 2);
    this.flags = this.add.graphics().setDepth(FLAG_DEPTH);
    this.bosses = [];
    this.drawBosses();

    this.panelTop = this.add.text(12, 7, '', TEXT_STYLE);
    this.panelBottom = this.add.text(12, 24, '', { ...TEXT_STYLE, color: '#485068' });
    this.add
      .container(4, GAME_HEIGHT - PANEL_H - 4, [
        ...framedBox(this, 0, 0, GAME_WIDTH - 8, PANEL_H),
        this.panelTop,
        this.panelBottom,
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH_PANEL);
    this.dialog = new DialogBox(this);
    this.choice = new ChoiceBox(this);
    this.updatePanel();

    const offs = [
      events.on('battle:ended', ({ result }) => this.returnFromBattle(result)),
      events.on('debug:menu', ({ open }) => {
        this.debugMenuOpen = open;
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));

    log(`Story: entered at stop ${ss.at} (${ss.stage}, ${ss.beaten} beaten)`);
    events.emit('story:entered');
    const cam = this.cameras.main;
    cam.resetFX();
    this.ui = 'leaving';
    cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.ui = 'idle';
      this.continueSetup();
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, MAX_FRAME_MS);
    if (this.debugMenuOpen) return;
    // Taken before the boxes update, so the A that closes a box does not also act on the map.
    const busy = this.ui !== 'idle' || this.dialog.isOpen || this.choice.isOpen;
    if (this.dialog.isOpen) this.dialog.update(dt);
    if (this.choice.isOpen) this.choice.update();
    if (this.ui === 'walk') return this.updateWalk(dt);
    if (busy) return;
    const dir = input.direction();
    if (dir && input.justPressed(dir)) return this.tryMove(dir);
    if (input.justPressed('a')) this.act();
  }

  /** Run the next setup step for the story stage: welcome, team, shop; nothing on the map. */
  private continueSetup(): void {
    const ss = storyState();
    if (ss.stage === 'welcome') {
      this.ui = 'talk';
      this.dialog.open(getGameData().story.welcome, {
        onClose: () => {
          setStoryState(finishWelcome(storyState()));
          saveStory(true);
          this.ui = 'idle';
          this.continueSetup();
        },
      });
    } else if (ss.stage === 'team') {
      this.openOverlay(STORY_TEAM_SCENE, { required: true } satisfies StoryTeamSceneData, () =>
        this.continueSetup(),
      );
    } else if (ss.stage === 'shop') {
      this.openOverlay(SHOP_SCENE, { story: true } satisfies ShopSceneData, () => {
        setStoryState(finishShop(storyState()));
        saveStory(true);
        this.continueSetup();
      });
    } else this.updatePanel();
  }

  /** Launch an overlay scene over this one (paused until it closes), then run `after`. */
  private openOverlay(key: string, data: object, after: () => void = () => undefined): void {
    this.ui = 'overlay';
    const off = events.on('overlay:closed', ({ scene }) => {
      if (scene !== key) return;
      off();
      this.scene.resume();
      this.ui = 'idle';
      this.updatePanel();
      after();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.scene.launch(key, data);
    this.scene.pause();
  }

  /** A direction was pressed: walk to the neighbouring stop that way, or say why not. */
  private tryMove(dir: Direction): void {
    const ss = storyState();
    const here = this.stops[ss.at];
    if (!here) return;
    const story = getGameData().story;
    for (const step of [1, -1] as const) {
      const tiles = walkTiles(this.stops, ss.at, ss.at + step);
      const first = tiles[0];
      if (!first || directionTo(here, first) !== dir) continue;
      const to = stepTarget(ss, story, step);
      if (to === null) {
        const boss = bossAt(story, ss.at);
        if (!boss) return;
        uiSound('error');
        this.ui = 'talk';
        this.dialog.open([t('story.locked', { name: boss.name })], { onClose: () => (this.ui = 'idle') });
        return;
      }
      log(`Story: walking from stop ${ss.at} to ${to}`);
      this.walk = { tiles: [...tiles], to };
      this.ui = 'walk';
      this.player?.face(dir);
      return;
    }
    this.player?.face(dir);
  }

  /** Walk the queued tiles; on arrival the story state moves to the stop and is saved quietly. */
  private updateWalk(dt: number): void {
    const player = this.player;
    const walk = this.walk;
    if (!player || !walk) return;
    const s = player.state;
    const pos = s.step ? s.step.to : { x: s.x, y: s.y };
    while (walk.tiles[0] && walk.tiles[0].x === pos.x && walk.tiles[0].y === pos.y) walk.tiles.shift();
    const next = walk.tiles[0];
    player.update(next ? directionTo(pos, next) : null, dt, () => false);
    if (next || player.state.step) return;
    this.walk = null;
    this.ui = 'idle';
    setStoryState({ ...storyState(), at: walk.to });
    saveStory(true);
    this.updatePanel();
    log(`Story: arrived at stop ${walk.to}`);
  }

  /** A pressed on the stop: the office menu, a boss challenge, or a rematch offer. */
  private act(): void {
    const ss = storyState();
    const story = getGameData().story;
    if (ss.at === 0) return this.openOfficeMenu();
    const boss = bossAt(story, ss.at);
    if (!boss) return;
    const status = bossStatus(ss, ss.at - 1);
    this.ui = 'talk';
    if (status === 'ready') {
      this.dialog.open(boss.dialogue, { voice: boss.voice, onClose: () => this.startBattle() });
      return;
    }
    this.dialog.open(boss.defeatDialogue, {
      voice: boss.voice,
      onClose: () => {
        this.dialog.open([t('story.rematch')], { hold: true });
        this.choice.open([t('story.yes'), t('story.no')], {
          onChoose: (i) => {
            this.dialog.dismiss();
            if (i === 0) this.startBattle();
            else this.ui = 'idle';
          },
        });
      },
    });
  }

  /** Flash, then fight the boss at the current stop (this scene sleeps until `battle:ended`). */
  private startBattle(): void {
    const ss = storyState();
    const data = getGameData();
    const boss = bossAt(data.story, ss.at);
    if (!boss) return;
    this.ui = 'battle';
    this.beatenBefore = ss.beaten;
    const cam = this.cameras.main;
    const each = BATTLE_FLASH_MS / BATTLE_FLASHES;
    for (let i = 0; i < BATTLE_FLASHES; i++) {
      this.time.delayedCall(i * each, () => cam.flash(each, 255, 255, 255, true));
    }
    this.time.delayedCall(BATTLE_FLASH_MS, () => {
      log(`Story: battle against ${boss.id}`);
      this.scene.launch(BATTLE_SCENE, {
        kind: 'npc',
        opponent: bossTeam(boss, data.flexymon, rng),
        story: { at: ss.at },
      } satisfies BattleSceneData);
      this.scene.sleep();
    });
  }

  /** Back from a battle: fade in; a first win shows the defeat lines (and the victory after the last boss). */
  private returnFromBattle(result: 'win' | 'lose' | 'fled'): void {
    if (!this.sys.isSleeping()) return;
    this.scene.wake();
    const data = getGameData();
    const ss = storyState();
    const boss = bossAt(data.story, ss.at);
    this.drawBosses();
    this.updatePanel();
    const cam = this.cameras.main;
    cam.resetFX();
    cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      const done = () => (this.ui = 'idle');
      if (result !== 'win') {
        this.ui = 'talk';
        this.dialog.open([t('story.lost')], { onClose: done });
        return;
      }
      if (!boss || ss.beaten === this.beatenBefore) return done();
      this.ui = 'talk';
      const lines = [...boss.defeatDialogue];
      const after = storyFinished(ss, data.story) ? [...data.story.victory] : [];
      this.dialog.open(lines, {
        voice: boss.voice,
        onClose: () => (after.length ? this.dialog.open(after, { onClose: done }) : done()),
      });
    });
  }

  /** The office menu: Cambiar equipo, Tienda, Volver al juego, Reiniciar historia, Salir (B = Salir). */
  private openOfficeMenu(): void {
    this.ui = 'menu';
    this.dialog.open([t('story.office_prompt')], { hold: true });
    this.choice.open(
      [
        t('story.menu_team'),
        t('story.menu_shop'),
        t('story.menu_back'),
        t('story.menu_restart'),
        t('story.menu_exit'),
      ],
      {
        onChoose: (i) => {
          this.dialog.dismiss();
          this.ui = 'idle';
          if (i === 0) this.openOverlay(STORY_TEAM_SCENE, {} satisfies StoryTeamSceneData);
          else if (i === 1) this.openOverlay(SHOP_SCENE, { story: true } satisfies ShopSceneData);
          else if (i === 2) this.leave();
          else if (i === 3) this.askRestart();
        },
      },
    );
  }

  /** "¿Seguro…?" Sí / No; Sí starts the story again from the team choice. */
  private askRestart(): void {
    this.ui = 'menu';
    this.dialog.open([t('story.restart_ask')], { hold: true });
    this.choice.open([t('story.yes'), t('story.no')], {
      initial: 1,
      onChoose: (i) => {
        this.dialog.dismiss();
        this.ui = 'idle';
        if (i !== 0) return;
        log('Story: restarted');
        setStoryState(restartStory(getGameData().story));
        saveStory();
        this.drawBosses();
        this.continueSetup();
      },
    });
  }

  /** Volver al juego: save the story, fade out and restart the overworld where the main game's player stands. */
  private leave(): void {
    this.ui = 'leaving';
    saveStory();
    log('Story: back to the main game');
    const cam = this.cameras.main;
    cam.fadeOut(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const p = gameState().player;
      this.scene.start(OVERWORLD_SCENE, {
        map: p.map,
        x: p.x,
        y: p.y,
        facing: p.facing,
        fadeIn: true,
      } satisfies OverworldData);
    });
  }

  /** Draw the bosses that stand on the map now and a flag on every beaten stop. */
  private drawBosses(): void {
    this.bosses.forEach((b) => b.destroy());
    this.bosses = [];
    const ss = storyState();
    const story = getGameData().story;
    const flags = this.flags;
    flags?.clear();
    story.bosses.forEach((boss, i) => {
      const status = bossStatus(ss, i);
      if (status === 'hidden') return;
      const sheet = prepareSheet(this, boss.sprite);
      const img = this.add
        .image(boss.stand.x * TILE_SIZE, boss.stand.y * TILE_SIZE, boss.sprite)
        .setOrigin(0)
        .setDepth(2);
      if (sheet) img.setFrame(npcFrame(playerFrame(boss.stand.facing, 0)));
      img.setName(boss.id);
      this.bosses.push(img);
      if (status === 'beaten' && flags) {
        const stop = this.stops[i + 1]!;
        const x = stop.x * TILE_SIZE + TILE_SIZE - 9;
        const y = stop.y * TILE_SIZE + 2;
        flags.fillStyle(0x283048).fillRect(x, y, 2, 18);
        flags.fillStyle(0xf08828).fillTriangle(x + 2, y, x + 2, y + 9, x + 10, y + 4);
      }
    });
  }

  /** The bottom panel: the stop's place (and its number), then what A does there. */
  private updatePanel(): void {
    const ss = storyState();
    const story = getGameData().story;
    const stop = this.stops[ss.at];
    if (!stop || !this.panelTop) return;
    this.panelTop.setText(
      t('story.panel_stop', { n: ss.at, total: this.stops.length - 1, place: stop.place }),
    );
    const boss = bossAt(story, ss.at);
    let hint: string;
    if (!boss) hint = t('story.hint_office');
    else if (bossStatus(ss, ss.at - 1) === 'ready') hint = t('story.hint_boss', { name: boss.name });
    else hint = t('story.hint_beaten', { name: boss.name });
    this.panelBottom.setText(hint);
  }

  /** The story map as plain data (for the E2E hooks). */
  view(): StoryView {
    const ss = storyState();
    const s = this.player?.state;
    return {
      ui: this.ui,
      stage: ss.stage,
      at: ss.at,
      x: s?.x ?? -1,
      y: s?.y ?? -1,
      beaten: ss.beaten,
      bossesShown: this.bosses.map((b) => b.name),
      panel: [this.panelTop?.text ?? '', this.panelBottom?.text ?? ''],
      dialogue: this.dialog?.state() ?? null,
      choice: this.choice?.state() ?? null,
    };
  }
}
