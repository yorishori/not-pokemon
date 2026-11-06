/**
 * StoryTeamScene — picks the story realm's team (`story.json › teamSize` different flexymon), drawn over the
 * paused StoryScene.
 *
 * - Start it with {@link StoryTeamSceneData}: `required` on the first run (B does nothing until a team is chosen);
 *   from the office menu B leaves without changing anything.
 * - Left: every species (icon, name; the picked ones say their place, "1º", "2º"…). Right: the species under the
 *   cursor: its four stats and its attacks. The title counts the picks ("Elige 4 flexymon (2/4)").
 * - A on a species picks it (or takes it out again, `togglePick`); while the team is full the others are greyed.
 *   When the last place is filled, "¿Vas con este equipo?" asks Sí / No: Sí makes the team (`pickTeam`: fresh
 *   instances in pick order, the first one leads), saves the story slot, emits `overlay:closed` and stops; No goes
 *   back to the list. Changing the team from the office starts with the current team already picked.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { saveStory, setStoryState, storyState } from '../core/story-session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { pickTeam, togglePick } from '../logic/story';
import { ChoiceBox } from '../ui/choice-box';
import { framedBox } from '../ui/frame';
import { GridMenu, type GridMenuState } from '../ui/grid-menu';

/** Scene key of {@link StoryTeamScene}. */
export const STORY_TEAM_SCENE = 'StoryTeam';

/** How to open the team picker. */
export interface StoryTeamSceneData {
  /** The first run: B does nothing; a team must be chosen. */
  required?: boolean;
}

/** The picker as plain data (for the E2E hooks). */
export interface StoryTeamView {
  required: boolean;
  /** Species ids picked, in order. */
  picks: string[];
  size: number;
  /** The species list (or the Sí / No box) and its cursor. */
  menu: GridMenuState | null;
  /** The species under the cursor. */
  speciesId: string | null;
  confirming: boolean;
}

const LIST_W = 248;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};

/** The story team picker. */
export class StoryTeamScene extends Phaser.Scene {
  private required = false;
  private picks: string[] = [];
  private ids: string[] = [];
  private cursor = 0;
  private confirming = false;
  private menu!: GridMenu;
  private choice!: ChoiceBox;
  private detail!: Phaser.GameObjects.Text;
  private sprite!: Phaser.GameObjects.Image;
  /** The chosen team shown on the left while "¿Vas con este equipo?" asks. */
  private summary!: Phaser.GameObjects.Container;

  constructor() {
    super(STORY_TEAM_SCENE);
  }

  create(data: StoryTeamSceneData): void {
    const game = getGameData();
    this.required = data.required === true;
    this.ids = [...game.flexymon.keys()];
    this.picks = storyState().team.map((m) => m.speciesId);
    this.cursor = 0;
    this.confirming = false;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0);
    const right = GAME_WIDTH - LIST_W;
    this.add.container(LIST_W, 0, framedBox(this, 0, 0, right, GAME_HEIGHT));
    this.sprite = this.add.image(LIST_W + right / 2, 52, '__DEFAULT').setVisible(false);
    this.detail = this.add.text(LIST_W + 14, 92, '', { ...TEXT_STYLE, wordWrap: { width: right - 28 } });
    this.summary = this.add.container(0, 0).setVisible(false);
    this.menu = new GridMenu(this);
    this.choice = new ChoiceBox(this);
    log(`StoryTeam: open (${this.required ? 'required' : 'change'})`);
    this.openList();
  }

  override update(): void {
    if (this.menu.isOpen) this.menu.update();
    else if (this.choice.isOpen) this.choice.update();
  }

  /** The species list; A toggles a pick, B leaves (unless required). */
  private openList(): void {
    const game = getGameData();
    const size = game.story.teamSize;
    const full = this.picks.length >= size;
    this.confirming = false;
    this.summary.setVisible(false);
    const options = this.ids.map((id) => {
      const sp = game.flexymon.get(id);
      const place = this.picks.indexOf(id);
      return {
        label: sp?.name ?? id,
        icon: sp?.sprite.icon,
        enabled: place >= 0 || !full,
        right: place >= 0 ? t('story.team_place', { n: place + 1 }) : '',
      };
    });
    this.menu.open(
      options,
      {
        x: 0,
        y: 0,
        width: LIST_W,
        height: GAME_HEIGHT,
        cols: 1,
        rowH: 22,
        title: t('story.team_title', { n: this.picks.length, size }),
      },
      {
        initial: this.cursor,
        cancelable: true,
        onMove: (i) => {
          this.cursor = i;
          this.showDetail(this.ids[i] ?? '');
        },
        onChoose: (i) => {
          if (i === null) {
            if (this.required) return this.openList();
            return this.close();
          }
          this.cursor = i;
          this.picks = togglePick(this.picks, this.ids[i] ?? '', size);
          if (this.picks.length >= size) return this.confirm();
          this.openList();
        },
      },
    );
  }

  /** "¿Vas con este equipo?" Sí / No. */
  private confirm(): void {
    this.confirming = true;
    this.detail.setText(t('story.team_confirm'));
    this.sprite.setVisible(false);
    this.drawSummary();
    this.choice.open([t('story.yes'), t('story.no')], {
      x: LIST_W + 14,
      y: GAME_HEIGHT - 80,
      onChoose: (i) => {
        if (i !== 0) {
          this.picks = this.picks.slice(0, -1);
          return this.openList();
        }
        const game = getGameData();
        const made = pickTeam(storyState(), this.picks, game.story, game.flexymon, rng);
        if (!made.ok) return this.openList();
        setStoryState(made.state);
        saveStory();
        log(`StoryTeam: team ${this.picks.join(', ')}`);
        this.close();
      },
    });
  }

  /** The picked team on the left, in order, with front sprites. */
  private drawSummary(): void {
    const game = getGameData();
    this.summary.removeAll(true);
    this.summary.add(framedBox(this, 0, 0, LIST_W, GAME_HEIGHT));
    this.summary.add(this.add.text(12, 8, t('story.team_summary'), TEXT_STYLE));
    this.picks.forEach((id, i) => {
      const sp = game.flexymon.get(id);
      const y = 34 + i * 40;
      if (sp) this.summary.add(this.add.image(30, y + 16, sp.sprite.front).setScale(0.5));
      this.summary.add(this.add.text(58, y + 8, `${i + 1}º ${sp?.name ?? id}`, TEXT_STYLE));
    });
    this.summary.setVisible(true);
  }

  /** The species under the cursor: front sprite, stats and attacks. */
  private showDetail(id: string): void {
    const game = getGameData();
    const sp = game.flexymon.get(id);
    if (!sp) return;
    this.sprite.setTexture(sp.sprite.front).setVisible(true);
    const attacks = sp.attacks.map((a) => `· ${game.attacks.get(a)?.name ?? a}`).join('\n');
    this.detail.setText(
      [
        sp.name,
        t('story.team_stats', {
          hp: sp.stats.hp,
          attack: sp.stats.attack,
          defense: sp.stats.defense,
          speed: sp.stats.speed,
        }),
        attacks,
      ].join('\n'),
    );
  }

  /** Tell the StoryScene and stop. */
  private close(): void {
    events.emit('overlay:closed', { scene: STORY_TEAM_SCENE });
    this.scene.stop();
  }

  /** The picker as plain data (for the E2E hooks). */
  view(): StoryTeamView {
    const c = this.choice.state();
    return {
      required: this.required,
      picks: [...this.picks],
      size: getGameData().story.teamSize,
      menu:
        this.menu.state() ??
        (c ? { options: c.options.map((label) => ({ label, enabled: true })), cursor: c.cursor } : null),
      speciesId: this.ids[this.cursor] ?? null,
      confirming: this.confirming,
    };
  }
}
