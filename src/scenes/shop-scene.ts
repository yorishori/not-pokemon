/**
 * ShopScene — the shop opened by a `shopkeeper` NPC, drawn over the paused overworld.
 *
 * - Start it with {@link ShopSceneData} (`shopId`, a key of `shops.json`). Money and bag come from the
 *   game state (`src/core/session.ts`) and every purchase / sale is written back at once.
 * - Layout: the money box top left ("Dinero: 200 €"), a prompt panel at the bottom, the ChoiceBox
 *   *Comprar / Vender / Salir* above it on the right.
 * - Comprar: the shop's stock (`buyRows`, `src/logic/shop.ts`) with item icons and prices; the prompt shows
 *   the description and how many the player has. A on an item opens the quantity picker (1 … the most the
 *   money and bag allow: Up/Down ±1, Right/Left ±`QTY_BIG_STEP`, with the total price), A asks
 *   "¿Compras {n} × {item} por {total} €?" (Sí / No), Sí runs `buy()` (`src/logic/economy.ts`) and thanks
 *   the player. An item the player cannot afford (or has no room for) gives the reason instead.
 * - Vender: every item in the bag (`sellRows`) with its sell price (half, rounded down); key items and
 *   `price: null` items are greyed and cannot be sold. Same picker (1 … count) and confirmation; `sell()`.
 * - B goes back one step everywhere (picker → list → main menu); B or *Salir* in the main menu closes the
 *   shop: it asks for an auto-save (`save:request` `shop`), emits `overlay:closed` and stops; the
 *   overworld resumes.
 * - The scene computes no price or limit: rows, limits and totals come from `src/logic/shop.ts`.
 * - Story realm shop (started with `{ story: true }` from the StoryScene's office menu): it sells
 *   `story.json › shop`, spends the story budget into the story loadout (`src/core/story-session.ts`), buys back at
 *   the full price (`refundPrice`), shows "Presupuesto: {n} €", and on closing saves the story slot instead of
 *   asking for a main-game save.
 * - Sounds: menus and the Sí / No box play their own; the picker plays `cursor` / `confirm` / `cancel`; a
 *   refusal ("No tienes suficiente dinero.") plays `error`; a done purchase or sale plays `money`.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
import { log } from '../core/log';
import { gameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { QTY_BIG_STEP } from '../logic/constants';
import { buy, refundPrice, sell, type ShopResult } from '../logic/economy';
import type { Inventory } from '../logic/inventory';
import { storyBuy, storySell } from '../logic/story';
import { saveStory, setStoryState, storyState } from '../core/story-session';
import {
  buyRows,
  rowError,
  sellRows,
  stepQuantity,
  stockRows,
  totalPrice,
  type ShopMode,
  type ShopRow,
} from '../logic/shop';
import { ChoiceBox } from '../ui/choice-box';
import { DIALOG_HEIGHT, DialogBox } from '../ui/dialog-box';
import { GridMenu, type GridMenuState } from '../ui/grid-menu';
import { framedBox } from '../ui/frame';

/** Scene key of {@link ShopScene}. */
export const SHOP_SCENE = 'Shop';

/** How to open a shop: a shop of `shops.json`, or the story realm's shop. */
export type ShopSceneData = { shopId: string; story?: false } | { story: true };

/** The `shopId` reported for the story realm's shop. */
export const STORY_SHOP_ID = 'story';

/** What the shop screen is doing. */
export type ShopUi = 'main' | 'list' | 'quantity' | 'confirm' | 'message' | 'closed';

/** The shop screen as plain data (for the E2E hooks). */
export interface ShopView {
  shopId: string;
  ui: ShopUi;
  /** `buy` / `sell` while a list, picker or confirmation is open, else `null`. */
  mode: ShopMode | null;
  euros: number;
  /** The open list or choice (options + cursor), or `null`. */
  menu: GridMenuState | null;
  /** Item under the cursor / being bought or sold, and the picked quantity and total. */
  itemId: string | null;
  quantity: number;
  total: number;
  /** Text of the prompt panel (question, description) and of the open message box. */
  prompt: string;
  message: string | null;
}

const MENU_TOP = GAME_HEIGHT - DIALOG_HEIGHT;
const MONEY_W = 180;
const MONEY_H = 28;
const LIST_Y = MONEY_H + 8;
const QTY_W = 150;
const QTY_H = 52;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};

/** The shop. */
export class ShopScene extends Phaser.Scene {
  private shopId = '';
  /** True for the story realm's shop (story budget and loadout, full-price buy-back). */
  private story = false;
  private ui: ShopUi = 'main';
  private mode: ShopMode | null = null;
  private rows: ShopRow[] = [];
  private row: ShopRow | null = null;
  private quantity = 0;
  private listCursor = 0;
  private dialog!: DialogBox;
  private menu!: GridMenu;
  private choice!: ChoiceBox;
  private moneyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Container;
  private qtyText!: Phaser.GameObjects.Text;
  private qtyTotal!: Phaser.GameObjects.Text;
  private qtyBox!: Phaser.GameObjects.Container;

  constructor() {
    super(SHOP_SCENE);
  }

  create(data: ShopSceneData): void {
    this.story = data.story === true;
    this.shopId = data.story ? STORY_SHOP_ID : data.shopId;
    this.mode = null;
    this.row = null;
    this.quantity = 0;
    this.listCursor = 0;
    this.moneyText = this.add.text(10, 7, '', TEXT_STYLE);
    this.panel(4, 4, MONEY_W, MONEY_H, [this.moneyText]);
    this.promptText = this.add.text(12, 10, '', { ...TEXT_STYLE, wordWrap: { width: GAME_WIDTH - 24 } });
    this.prompt = this.panel(0, MENU_TOP, GAME_WIDTH, DIALOG_HEIGHT, [this.promptText]);
    this.qtyText = this.add.text(12, 8, '', TEXT_STYLE);
    this.qtyTotal = this.add.text(QTY_W - 12, 28, '', TEXT_STYLE).setOrigin(1, 0);
    this.qtyBox = this.panel(GAME_WIDTH - QTY_W - 4, MENU_TOP - QTY_H - 2, QTY_W, QTY_H, [
      this.qtyText,
      this.qtyTotal,
    ]).setVisible(false);
    this.dialog = new DialogBox(this);
    this.menu = new GridMenu(this);
    this.choice = new ChoiceBox(this);
    log(`Shop: open ${this.shopId}`);
    this.openMain(0);
  }

  override update(_time: number, delta: number): void {
    this.moneyText.setText(t(this.story ? 'story.budget' : 'shop.money', { n: this.money() }));
    if (this.dialog.isOpen) this.dialog.update(delta);
    else if (this.menu.isOpen) this.menu.update();
    else if (this.choice.isOpen) this.choice.update();
    else if (this.ui === 'quantity') this.updateQuantity();
  }

  /** Euros to spend: the player's, or the story budget left. */
  private money(): number {
    return this.story ? storyState().euros : gameState().euros;
  }

  /** The bag sold from: the player's, or the story loadout. */
  private bag(): Inventory {
    return this.story ? storyState().loadout : gameState().items;
  }

  /** A framed panel at (`x`, `y`) holding `children`. */
  private panel(x: number, y: number, w: number, h: number, children: Phaser.GameObjects.GameObject[]) {
    return this.add.container(x, y, [...framedBox(this, 0, 0, w, h), ...children]).setDepth(90);
  }

  private setPrompt(text: string): void {
    this.promptText.setText(text);
    this.prompt.setVisible(true);
  }

  /** "¿Qué quieres hacer?" with Comprar / Vender / Salir. */
  private openMain(initial: number): void {
    this.ui = 'main';
    this.mode = null;
    this.row = null;
    this.qtyBox.setVisible(false);
    this.setPrompt(t('shop.prompt'));
    this.choice.open([t('shop.buy'), t('shop.sell'), t('shop.exit')], {
      initial,
      onChoose: (i) => {
        if (i === 0) this.openList('buy', 0);
        else if (i === 1) this.openList('sell', 0);
        else this.close();
      },
    });
  }

  /** Show a message in the dialog box, then run `next`. */
  private say(text: string, next: () => void): void {
    this.ui = 'message';
    this.prompt.setVisible(false);
    this.qtyBox.setVisible(false);
    this.dialog.open([text], { onClose: next });
  }

  /** The buy or sell list; B goes back to the main menu. */
  private openList(mode: ShopMode, initial: number): void {
    const data = getGameData();
    const euros = this.money();
    const bag = this.bag();
    this.mode = mode;
    this.row = null;
    this.qtyBox.setVisible(false);
    if (mode === 'buy')
      this.rows = this.story
        ? stockRows(
            data.story.shop.flatMap((id) => {
              const item = data.items.get(id);
              return item ? [item] : [];
            }),
            euros,
            bag,
          )
        : buyRows(this.shopId, data, euros, bag);
    else this.rows = sellRows(data, bag, this.story ? refundPrice : undefined);
    if (this.rows.length === 0) {
      return this.say(t('shop.nothing_to_sell'), () => this.openMain(1));
    }
    this.ui = 'list';
    const options = this.rows.map((r) => ({
      label: r.name,
      enabled: mode === 'buy' || r.price !== null,
      icon: data.items.get(r.id)?.sprite,
      right:
        r.price === null
          ? t('shop.no_price')
          : `${mode === 'sell' ? `${t('bag.count', { n: r.owned })}  ` : ''}${t('shop.price', { n: r.price })}`,
    }));
    this.menu.open(
      options,
      {
        x: 0,
        y: LIST_Y,
        width: GAME_WIDTH,
        height: MENU_TOP - LIST_Y - 2,
        cols: 1,
        title: t(mode === 'buy' ? 'shop.buy_title' : 'shop.sell_title'),
      },
      {
        initial,
        onMove: (i) => {
          this.listCursor = i;
          const r = this.rows[i];
          if (r) this.setPrompt(`${r.description}\n${t('shop.owned', { n: r.owned })}`);
        },
        onChoose: (i) => {
          const r = i === null ? undefined : this.rows[i];
          if (!r) return this.openMain(mode === 'buy' ? 0 : 1);
          this.pick(r);
        },
      },
    );
  }

  /** An item was chosen: open the picker, or say why it cannot be bought / sold. */
  private pick(row: ShopRow): void {
    const mode = this.mode ?? 'buy';
    const err = rowError(mode, row, this.money());
    if (err) {
      uiSound('error');
      return this.say(t(`shop.${err}`), () => this.openList(mode, this.listCursor));
    }
    this.row = row;
    this.quantity = 1;
    this.ui = 'quantity';
    this.setPrompt(t('shop.how_many'));
    this.qtyBox.setVisible(true);
    this.drawQuantity();
  }

  private drawQuantity(): void {
    const price = this.row?.price ?? 0;
    this.qtyText.setText(t('shop.quantity', { n: this.quantity }));
    this.qtyTotal.setText(t('shop.total', { n: totalPrice(price, this.quantity) }));
  }

  /** Up/Down ±1, Right/Left ±`QTY_BIG_STEP`, A confirms, B goes back to the list. */
  private updateQuantity(): void {
    const row = this.row;
    if (!row) return;
    let delta = 0;
    if (input.justPressed('up')) delta = 1;
    else if (input.justPressed('down')) delta = -1;
    else if (input.justPressed('right')) delta = QTY_BIG_STEP;
    else if (input.justPressed('left')) delta = -QTY_BIG_STEP;
    else if (input.justPressed('a')) {
      uiSound('confirm');
      return this.confirm(row);
    } else if (input.justPressed('b')) {
      uiSound('cancel');
      return this.openList(this.mode ?? 'buy', this.listCursor);
    }
    if (delta !== 0) {
      const next = stepQuantity(this.quantity, delta, row.limit);
      if (next !== this.quantity) uiSound('cursor');
      this.quantity = next;
      this.drawQuantity();
    }
  }

  /** "¿Compras / Vendes {n} × {item} por {total} €?" with Sí / No (B = No). */
  private confirm(row: ShopRow): void {
    const mode = this.mode ?? 'buy';
    const total = totalPrice(row.price ?? 0, this.quantity);
    this.ui = 'confirm';
    this.setPrompt(
      t(mode === 'buy' ? 'shop.confirm_buy' : 'shop.confirm_sell', {
        n: this.quantity,
        item: row.name,
        total,
      }),
    );
    this.choice.open([t('shop.yes'), t('shop.no')], {
      onChoose: (i) => {
        if (i !== 0) return this.openList(mode, this.listCursor);
        this.trade(mode, row, total);
      },
    });
  }

  /** Run the purchase or sale through the economy rules and write the result to the game state. */
  private trade(mode: ShopMode, row: ShopRow, total: number): void {
    const item = getGameData().items.get(row.id);
    if (!item) return this.openList(mode, this.listCursor);
    let result: ShopResult;
    if (this.story) {
      const ss = storyState();
      result = mode === 'buy' ? storyBuy(ss, item, this.quantity) : storySell(ss, item, this.quantity);
    } else {
      const gs = gameState();
      result =
        mode === 'buy'
          ? buy(gs.euros, gs.items, item, this.quantity)
          : sell(gs.euros, gs.items, item, this.quantity);
    }
    if (!result.ok) {
      const key =
        result.reason === 'not_enough_items' || result.reason === 'bad_quantity'
          ? 'not_for_sale'
          : result.reason;
      uiSound('error');
      return this.say(t(`shop.${key}`), () => this.openList(mode, this.listCursor));
    }
    if (this.story) setStoryState({ ...storyState(), euros: result.euros, loadout: result.items });
    else setGameState({ ...gameState(), euros: result.euros, items: result.items });
    uiSound('money');
    log(`Shop: ${mode} ${this.quantity} ${row.id} for ${total}`);
    const text =
      mode === 'buy' ? t('shop.bought') : t('shop.sold', { n: this.quantity, item: row.name, total });
    this.say(text, () => this.openList(mode, this.listCursor));
  }

  /** Leave: auto-save request, tell the overworld, stop. */
  private close(): void {
    this.ui = 'closed';
    log(`Shop: close ${this.shopId}`);
    if (this.story) saveStory();
    else events.emit('save:request', { reason: 'shop' });
    events.emit('overlay:closed', { scene: SHOP_SCENE });
    this.scene.stop();
  }

  /** The screen as plain data (for the E2E hooks). */
  view(): ShopView {
    const c = this.choice.state();
    const row = this.ui === 'list' ? (this.rows[this.listCursor] ?? null) : this.row;
    return {
      shopId: this.shopId,
      ui: this.ui,
      mode: this.mode,
      euros: this.money(),
      menu:
        this.menu.state() ??
        (c ? { options: c.options.map((label) => ({ label, enabled: true })), cursor: c.cursor } : null),
      itemId: row?.id ?? null,
      quantity: this.quantity,
      total: totalPrice(this.row?.price ?? 0, this.quantity),
      prompt: this.prompt.visible ? this.promptText.text : '',
      message: this.dialog.state()?.full ?? null,
    };
  }
}
