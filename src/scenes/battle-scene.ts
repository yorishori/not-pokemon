/**
 * BattleScene — the battle screen, driven entirely by the logic (`src/logic/battle.ts`).
 *
 * - Start it with {@link BattleSceneData}: the battle kind, the opponent's team and optionally an RNG
 *   seed (applied before the first roll, so tests replay a battle exactly). The player's team and bag
 *   come from the game state (`src/core/session.ts`).
 * - Layout (512 × 288): opponent sprite top right, its name and HP bar top left; the player's flexymon
 *   (back sprite) bottom left, its name, HP bar and "PS 31/40" bottom right; messages and menus in the
 *   bottom 80 px (the DialogBox for messages). Emits `battle:started` when it
 *   starts (`main.ts` switches to the battle music).
 * - Each player choice goes through `chooseAction()`; the returned `events[]` become view steps
 *   (`src/logic/battle-view.ts`) played in order: message (A to go on), attack sound, shake/flash on a
 *   hit, HP bar animating over `HP_ANIM_MS`, faint / switch. The scene never computes a rule: menus ask
 *   the logic what is allowed (greyed out otherwise) and HP numbers come from the events.
 * - Menus: main 2 × 2 (Atacar, Objeto, Cambiar, Huir — Huir greyed against NPCs); attack list with the
 *   accuracy beside it; team list with icons, names and HP (fainted greyed). B goes back to the main
 *   menu from every sub-menu; in the main menu B does nothing. The forced switch after a faint cannot
 *   be cancelled (the player must pick someone; there is always someone alive in that phase).
 * - Objeto: the battle items in the bag with "x{n}" (`itemMenu`; greyed when no target would accept
 *   it); a heal / revive item then asks for a team member (`itemTargetMenu`, greyed when it would do
 *   nothing), a buff goes on the active flexymon. Using it plays the round (`chooseAction` `item`: the
 *   item is consumed and the opponent acts). No battle items → "No tienes objetos…". B goes back a step.
 * - Catching: after a won wild battle (and `canCatch()`), "¿Te llevas a {name}?" shows in the
 *   prompt panel with a ChoiceBox *Llevármelo* / *Dejarlo* (B = Dejarlo). Taking it runs
 *   `takeFlexymon` (`src/logic/merge.ts`: added to the team, to storage when the team is full, or merged)
 *   and shows the matching message (`catchMessages`) before the battle ends.
 * - End: the team (HP) and bag are written back to the game state, the screen fades out, the scene
 *   asks for an auto-save (`save:request` `battle`), emits `battle:ended` and stops; the overworld
 *   wakes up on the same tile. Attack sounds play at the effects volume option.
 * - Enemy NPCs: started with `npcId`, a win runs `winAgainstNpc` (euros `+= rng.int(min, max)`,
 *   the NPC goes to `cooldown`) and shows "¡Has ganado {n} €!" (`battle.reward`, `money` sound) before leaving.
 * - Losing (wild or NPC): `loseBattle` applies the Losing rule to the game state (euros halved, team
 *   and storage fully healed, every NPC `ready`, player at `start.json › respawn`); the overworld then
 *   restarts at the respawn point.
 * - While the debug menu (`debug:menu`) is open, the battle ignores input.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { sfxVolume } from '../core/options';
import { uiSound } from '../core/ui-sound';
import { HIT_DIM_MS, HIT_SHAKES, HIT_SHAKE_MS } from '../logic/constants';
import { gameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import {
  activeFlexymon,
  chooseAction,
  createBattle,
  introEvents,
  type BattleAction,
  type BattleKind,
  type BattleResult,
  type BattleState,
  type Side,
} from '../logic/battle';
import {
  attackMenu,
  catchMessages,
  itemMenu,
  itemNeedsTarget,
  itemTargetMenu,
  mainMenu,
  teamMenu,
  viewSteps,
  type ViewStep,
} from '../logic/battle-view';
import { canCatch, takeFlexymon } from '../logic/merge';
import { isEnemy, loseBattle, winAgainstNpc } from '../logic/enemy-npc';
import { ChoiceBox } from '../ui/choice-box';
import { maxHp, type FlexymonInstance } from '../logic/instance';
import { DIALOG_HEIGHT, DialogBox } from '../ui/dialog-box';
import { GridMenu, type GridMenuState } from '../ui/grid-menu';
import { HpBar } from '../ui/hp-bar';
import { framedBox } from '../ui/frame';

/** Scene key of {@link BattleScene}. */
export const BATTLE_SCENE = 'Battle';

/** How to start a battle. */
export interface BattleSceneData {
  kind: BattleKind;
  /** The opponent's team in order (one flexymon for a wild battle). */
  opponent: FlexymonInstance[];
  /** Re-seed the shared RNG before the battle starts (tests, debug). */
  seed?: number;
  /** The enemy NPC fought: a win pays its reward and puts it in `cooldown`. */
  npcId?: string;
}

/**
 * What the battle screen is doing. `catch`: the Llevármelo / Dejarlo choice after a wild win;
 * `item` / `item_target`: the Objeto list and its target list.
 */
export type BattleUi = 'anim' | 'main' | 'attack' | 'team' | 'item' | 'item_target' | 'catch' | 'end';

/** One side as shown (for the E2E hooks). `hp`/`maxHp` are the logic numbers, `shownHp` the bar's. */
export interface BattleSideView {
  uid: string;
  speciesId: string;
  name: string;
  hp: number;
  maxHp: number;
  shownHp: number;
  hpText: string | null;
}

/** The whole screen as plain data (for the E2E hooks). */
export interface BattleView {
  kind: BattleKind;
  phase: BattleState['phase'];
  result: BattleResult | null;
  round: number;
  ui: BattleUi;
  menu: GridMenuState | null;
  /** Full text of the open message box, or `null`. */
  message: string | null;
  player: BattleSideView;
  opponent: BattleSideView;
}

/** Sprite scale (64 × 64 art drawn at 128 × 128). */
const SPRITE_SCALE = 2;
const HOME: Record<Side, { x: number; y: number }> = {
  opponent: { x: 384, y: 74 },
  player: { x: 120, y: 144 },
};
const MENU_TOP = GAME_HEIGHT - DIALOG_HEIGHT;
/** Backdrop bands from the top: `[y, colour]`, each drawn to the bottom of the screen. */
const BACKDROP_BANDS: readonly (readonly [number, number])[] = [
  [0, 0xd8f0f8],
  [40, 0xe4f4f0],
  [80, 0xeef8e4],
  [150, 0xd8f0c8],
  [190, 0xc8e8b4],
];
const COLOR_PLATFORM = 0x90d088;
const COLOR_PLATFORM_RIM = 0x58a060;
const COLOR_PLATFORM_LIGHT = 0xb8e8a8;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};
const SHOW_MS = 250;
const FAINT_MS = 300;
const END_FADE_MS = 300;

/** One side's display objects. */
interface SideDisplay {
  sprite: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  bar: HpBar;
}

/** The battle screen. */
export class BattleScene extends Phaser.Scene {
  private battle!: BattleState;
  private kind: BattleKind = 'wild';
  private npcId: string | undefined;
  private sides!: Record<Side, SideDisplay>;
  private dialog!: DialogBox;
  private menu!: GridMenu;
  private choice!: ChoiceBox;
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private ui: BattleUi = 'anim';
  private debugMenuOpen = false;
  /** False once the scene shuts down, so pending animations stop. */
  private alive = false;

  constructor() {
    super(BATTLE_SCENE);
  }

  create(data: BattleSceneData): void {
    this.alive = true;
    this.debugMenuOpen = false;
    this.kind = data.kind;
    this.npcId = data.npcId;
    if (data.seed !== undefined) rng.seed(data.seed);
    const gs = gameState();
    this.battle = createBattle(gs.team, data.opponent, data.kind, gs.items);
    events.emit('battle:started');

    this.cameras.main.resetFX();
    this.drawBackdrop();
    this.sides = {
      opponent: this.makeSide('opponent', 12, 12, 220, 46),
      player: this.makeSide('player', 272, 142, 228, 62),
    };

    this.promptText = this.add.text(12, 10, '', { ...TEXT_STYLE, wordWrap: { width: 244 } });
    this.prompt = this.panel(0, MENU_TOP, 272, DIALOG_HEIGHT, [this.promptText]).setVisible(false);
    this.infoText = this.add.text(12, 10, '', TEXT_STYLE);
    this.info = this.panel(334, MENU_TOP, GAME_WIDTH - 334, DIALOG_HEIGHT, [this.infoText]).setVisible(false);
    this.dialog = new DialogBox(this);
    this.menu = new GridMenu(this);
    this.choice = new ChoiceBox(this);

    const offs = [
      events.on('debug:menu', ({ open }) => {
        this.debugMenuOpen = open;
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      offs.forEach((off) => off());
    });

    log(`Battle: ${data.kind} vs ${data.opponent.map((o) => o.speciesId).join(', ')}`);
    void this.play(introEvents(this.battle), this.battle);
  }

  override update(_time: number, delta: number): void {
    if (this.debugMenuOpen) return;
    if (this.dialog.isOpen) this.dialog.update(delta);
    else if (this.menu.isOpen) this.menu.update();
    else if (this.choice.isOpen) this.choice.update();
  }

  /**
   * The battle backdrop: a pale sky fading into a grass band, and a grassy platform with a dark
   * rim and a light top under each side's flexymon.
   */
  private drawBackdrop(): void {
    BACKDROP_BANDS.forEach(([y, colour]) =>
      this.add.rectangle(0, y, GAME_WIDTH, GAME_HEIGHT - y, colour).setOrigin(0),
    );
    const platform = (x: number, y: number, w: number, h: number) => {
      this.add.ellipse(x, y + 3, w, h, COLOR_PLATFORM_RIM);
      this.add.ellipse(x, y, w, h, COLOR_PLATFORM);
      this.add.ellipse(x - w / 8, y - h / 6, w / 2, h / 3, COLOR_PLATFORM_LIGHT);
    };
    platform(HOME.opponent.x, HOME.opponent.y + 56, 176, 36);
    platform(HOME.player.x, HOME.player.y + 54, 196, 32);
  }

  /** A framed panel at (`x`, `y`) holding `children`. */
  private panel(x: number, y: number, w: number, h: number, children: Phaser.GameObjects.GameObject[]) {
    return this.add.container(x, y, [...framedBox(this, 0, 0, w, h), ...children]).setDepth(90);
  }

  /** Sprite, name and HP bar of one side; the info panel is at (`x`, `y`). */
  private makeSide(who: Side, x: number, y: number, w: number, h: number): SideDisplay {
    const sprite = this.add
      .image(HOME[who].x, HOME[who].y, '__DEFAULT')
      .setScale(SPRITE_SCALE)
      .setVisible(false);
    const name = this.add.text(8, 6, '', TEXT_STYLE);
    const bar = new HpBar(this, 8, 28, w - 16, who === 'player');
    this.panel(x, y, w, h, [name, ...bar.parts]).setDepth(10);
    return { sprite, name, bar };
  }

  /** Turn `evs` (produced from `before`) into view steps and play them, then show what comes next. */
  private async play(evs: Parameters<typeof viewSteps>[0], before: BattleState): Promise<void> {
    this.ui = 'anim';
    this.prompt.setVisible(false);
    this.info.setVisible(false);
    const steps = viewSteps(evs, { data: getGameData(), kind: this.kind, state: before, t });
    for (const step of steps) {
      if (!this.alive) return;
      await this.runStep(step);
    }
    if (!this.alive) return;
    if (this.battle.phase === 'ended') this.finish(this.battle.result ?? 'fled');
    else if (this.battle.phase === 'must_switch') this.openTeam(true);
    else this.openMain();
  }

  /** Play the player's `action` (one round, or the free switch after a faint). */
  private act(action: BattleAction): void {
    const before = this.battle;
    const step = chooseAction(before, action, { data: getGameData(), rng });
    this.battle = step.state;
    void this.play(step.events, before);
  }

  private runStep(step: ViewStep): Promise<void> {
    switch (step.type) {
      case 'message':
        return new Promise((resolve) => this.dialog.open([step.text], { onClose: resolve }));
      case 'sound':
        if (this.cache.audio.exists(step.key)) this.sound.play(step.key, { volume: sfxVolume() });
        return Promise.resolve();
      case 'show': {
        const side = this.sides[step.who];
        const species = getGameData().flexymon.get(step.speciesId);
        const key = species
          ? step.who === 'player'
            ? species.sprite.back
            : species.sprite.front
          : '__MISSING';
        side.name.setText(step.name);
        side.bar.set(step.hp, step.maxHp);
        const home = HOME[step.who];
        const from = step.who === 'player' ? -80 : GAME_WIDTH + 80;
        side.sprite.setTexture(key).setPosition(from, home.y).setAlpha(1).setVisible(true);
        return this.tweenTo(side.sprite, { x: home.x }, SHOW_MS);
      }
      case 'hit': {
        const sprite = this.sides[step.who].sprite;
        const x = HOME[step.who].x;
        // The sprite shakes HIT_SHAKES times but dims only once (flashes stay under 3 per second).
        return Promise.all([
          this.tweenTo(sprite, { x: x + 6 }, HIT_SHAKE_MS / 2, HIT_SHAKES - 1, true),
          this.tweenTo(sprite, { alpha: 0.3 }, HIT_DIM_MS / 2, 0, true),
        ]).then(() => {
          sprite.setPosition(x, HOME[step.who].y).setAlpha(1);
        });
      }
      case 'hp':
        return this.sides[step.who].bar.animateTo(step.hp, step.maxHp);
      case 'faint': {
        const sprite = this.sides[step.who].sprite;
        return this.tweenTo(sprite, { y: HOME[step.who].y + 60, alpha: 0 }, FAINT_MS).then(() => {
          sprite.setVisible(false);
        });
      }
      case 'withdraw': {
        const sprite = this.sides[step.who].sprite;
        return this.tweenTo(sprite, { alpha: 0 }, SHOW_MS).then(() => {
          sprite.setVisible(false);
        });
      }
      case 'need_switch':
      case 'end':
        return Promise.resolve();
    }
  }

  private tweenTo(
    target: Phaser.GameObjects.Image,
    props: Record<string, number>,
    duration: number,
    repeat = 0,
    yoyo = false,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: target, ...props, duration, repeat, yoyo, onComplete: () => resolve() });
    });
  }

  /** The 2 × 2 main menu with "¿Qué hará {name}?" beside it. */
  private openMain(initial = 0): void {
    this.ui = 'main';
    const data = getGameData();
    const active = activeFlexymon(this.battle, 'player');
    const name = data.flexymon.get(active.speciesId)?.name ?? active.speciesId;
    this.promptText.setText(t('battle.prompt', { name }));
    this.prompt.setVisible(true);
    this.info.setVisible(false);
    const options = mainMenu(this.battle, data, t);
    this.menu.open(
      options,
      { x: 272, y: MENU_TOP, width: GAME_WIDTH - 272, height: DIALOG_HEIGHT, cols: 2, rowH: 30 },
      {
        initial,
        cancelable: false,
        onChoose: (i) => {
          switch (options[i ?? -1]?.id) {
            case 'attack':
              return this.openAttacks();
            case 'item':
              return this.openItems();
            case 'switch':
              return this.openTeam(false);
            case 'flee':
              return this.act({ type: 'flee' });
          }
        },
      },
    );
  }

  /** The attack list (up to 3) with the accuracy of the one under the cursor. B goes back. */
  private openAttacks(): void {
    this.ui = 'attack';
    this.prompt.setVisible(false);
    const options = attackMenu(this.battle, getGameData(), t);
    this.info.setVisible(true);
    this.menu.open(
      options,
      { x: 0, y: MENU_TOP, width: 334, height: DIALOG_HEIGHT, cols: 1 },
      {
        onMove: (i) => this.infoText.setText(options[i]?.accuracy ?? ''),
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openMain(0);
          this.act({ type: 'attack', attackId: opt.id });
        },
      },
    );
  }

  /** The team list. `forced` after a faint: B does nothing and a replacement must be picked. */
  private openTeam(forced: boolean): void {
    this.ui = 'team';
    this.prompt.setVisible(false);
    this.info.setVisible(false);
    const options = teamMenu(this.battle, getGameData(), t);
    const rows = options.map((o) => ({
      // A fainted member says so even while it is still the active one (the forced switch).
      label: o.fainted
        ? `${o.label} (${t('battle.tag_fainted')})`
        : o.active
          ? `${o.label} (${t('battle.tag_active')})`
          : o.label,
      enabled: o.enabled,
      icon: o.icon,
      right: o.hpText,
    }));
    const initial = Math.max(
      0,
      options.findIndex((o) => o.enabled),
    );
    this.menu.open(
      rows,
      {
        // Full screen, so the info panels underneath do not show around it.
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        rowH: 26,
        title: t(forced ? 'battle.team_must' : 'battle.team_title'),
      },
      {
        initial,
        cancelable: !forced,
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openMain(2);
          this.act({ type: 'switch', uid: opt.id });
        },
      },
    );
  }

  /** Objeto: the battle items in the bag. B goes back to the main menu. */
  private openItems(initial = 0): void {
    const data = getGameData();
    const options = itemMenu(this.battle, data, t);
    this.prompt.setVisible(false);
    this.info.setVisible(false);
    if (options.length === 0) {
      this.ui = 'anim';
      this.dialog.open([t('battle.no_items')], { onClose: () => this.openMain(1) });
      return;
    }
    this.ui = 'item';
    this.menu.open(
      options.map((o) => ({
        label: o.label,
        enabled: o.enabled,
        icon: data.items.get(o.id)?.sprite,
        right: o.countText,
      })),
      {
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        rowH: 26,
        title: t('battle.item_title'),
      },
      {
        initial,
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openMain(1);
          const item = data.items.get(opt.id);
          if (item && itemNeedsTarget(item)) return this.openItemTarget(opt.id, i ?? 0);
          this.act({ type: 'item', itemId: opt.id, targetUid: activeFlexymon(this.battle, 'player').uid });
        },
      },
    );
  }

  /** Pick the team member a heal / revive item goes on. B goes back to the item list. */
  private openItemTarget(itemId: string, itemIndex: number): void {
    const data = getGameData();
    const options = itemTargetMenu(this.battle, itemId, data, t);
    this.ui = 'item_target';
    this.menu.open(
      options.map((o) => ({ label: o.label, enabled: o.enabled, icon: o.icon, right: o.hpText })),
      {
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        rowH: 26,
        title: t('battle.item_target', { item: data.items.get(itemId)?.name ?? itemId }),
      },
      {
        initial: Math.max(
          0,
          options.findIndex((o) => o.enabled),
        ),
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openItems(itemIndex);
          this.act({ type: 'item', itemId, targetUid: opt.id });
        },
      },
    );
  }

  /**
   * Write the team and bag back; a loss applies the Losing rule; a win against an enemy NPC pays its
   * reward; after a wild win offer the catch; then leave.
   */
  private finish(result: BattleResult): void {
    this.ui = 'end';
    const data = getGameData();
    let gs = { ...gameState(), team: this.battle.player.team, items: { ...this.battle.items } };
    if (result === 'lose') gs = loseBattle(gs, data);
    setGameState(gs);
    log(`Battle: ended (${result})`);
    const npc = this.npcId === undefined ? undefined : data.npcs.get(this.npcId);
    if (result === 'win' && npc && isEnemy(npc)) {
      const won = winAgainstNpc(gs, npc, rng);
      setGameState(won.state);
      log(`Battle: beat ${npc.id}, reward ${won.reward}`);
      this.ui = 'anim';
      uiSound('money');
      this.dialog.open([t('battle.reward', { n: won.reward })], { onClose: () => this.leave(result) });
    } else if (result === 'win' && this.kind === 'wild' && canCatch()) this.offerCatch();
    else this.leave(result);
  }

  /** "¿Te llevas a {name}?" with Llevármelo / Dejarlo (B = Dejarlo) beside it. */
  private offerCatch(): void {
    const speciesId = this.battle.opponent.team[0]?.speciesId ?? '';
    const species = getGameData().flexymon.get(speciesId);
    if (!species) return this.leave('win');
    this.ui = 'catch';
    this.info.setVisible(false);
    this.promptText.setText(t('catch.question', { name: species.name }));
    this.prompt.setVisible(true);
    this.choice.open([t('catch.take'), t('catch.leave')], {
      x: 290,
      y: MENU_TOP + 8,
      onChoose: (i) => {
        this.prompt.setVisible(false);
        if (i !== 0) {
          log(`Battle: left ${species.id}`);
          return this.leave('win');
        }
        const gs = gameState();
        const taken = takeFlexymon(
          { team: gs.team, storage: gs.storage, teamSlots: gs.teamSlots },
          species,
          rng,
        );
        setGameState({ ...gs, team: taken.party.team, storage: taken.party.storage });
        log(`Battle: took ${species.id} (${taken.outcome.type})`);
        this.ui = 'anim';
        this.dialog.open(catchMessages(taken.outcome, species.name, t), { onClose: () => this.leave('win') });
      },
    });
  }

  /** Fade out, announce the end and stop. */
  private leave(result: BattleResult): void {
    this.ui = 'end';
    const cam = this.cameras.main;
    cam.fadeOut(END_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      events.emit('save:request', { reason: 'battle' });
      events.emit('battle:ended', { result });
      this.scene.stop();
    });
  }

  /** The open catch choice in the menu format of the hooks, or `null`. */
  private choiceMenu(): GridMenuState | null {
    const c = this.choice.state();
    return c ? { options: c.options.map((label) => ({ label, enabled: true })), cursor: c.cursor } : null;
  }

  /** The screen as plain data (for the E2E hooks). */
  view(): BattleView {
    const data = getGameData();
    const side = (who: Side): BattleSideView => {
      const inst = activeFlexymon(this.battle, who);
      const species = data.flexymon.get(inst.speciesId);
      const display = this.sides[who];
      return {
        uid: inst.uid,
        speciesId: inst.speciesId,
        name: display.name.text,
        hp: inst.currentHp,
        maxHp: species ? maxHp(species, inst) : 0,
        shownHp: display.bar.shown.hp,
        hpText: display.bar.text,
      };
    };
    return {
      kind: this.battle.kind,
      phase: this.battle.phase,
      result: this.battle.result,
      round: this.battle.round,
      ui: this.ui,
      menu: this.menu.state() ?? this.choiceMenu(),
      message: this.dialog.state()?.full ?? null,
      player: side('player'),
      opponent: side('opponent'),
    };
  }
}
