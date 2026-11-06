/**
 * Shop rules for the ShopScene (docs/GAME-RULES.md › Euros and shops). The money rules themselves live in
 * `economy.ts` (`buy`, `sell`, `maxBuyQuantity`, `sellPrice`); this module turns them into the rows and
 * limits the shop screen shows, so the scene never computes a price or a limit.
 *
 * - Buy list: the shop's stock from `shops.json`, in file order, each with its price and how many the
 *   player can buy now (limited by money, by bag room and by `ITEM_COUNT_MAX`).
 * - Sell list: every item in the bag (count > 0), in bag order. Key items and `price: null` items are
 *   listed but cannot be sold (`sellPrice` is `null`).
 * - Quantity picker: 1 … limit. Up/Down change it by 1, Right/Left by `QTY_BIG_STEP`; it never leaves
 *   the range (no wrapping).
 */
import type { Item } from '../data/schemas';
import { ITEM_COUNT_MAX } from './constants';
import { maxBuyQuantity, sellPrice, type ShopError } from './economy';
import { itemCount, type Inventory } from './inventory';

/** The content the shop reads. `GameData` satisfies it. */
export interface ShopData {
  readonly items: ReadonlyMap<string, Item>;
  readonly shops: ReadonlyMap<string, readonly string[]>;
}

/** Buying or selling. */
export type ShopMode = 'buy' | 'sell';

/** One row of a shop list. */
export interface ShopRow {
  id: string;
  name: string;
  description: string;
  /** Unit price for this mode (buy price, or sell price), `null` if it cannot be bought / sold. */
  price: number | null;
  /** How many the bag holds now. */
  owned: number;
  /** Most the player can buy / sell now (0 = not possible). */
  limit: number;
}

/** The items a shop sells, in `shops.json` order. Throws on an unknown shop (content is checked at boot). */
export function shopStock(shopId: string, data: ShopData): Item[] {
  const ids = data.shops.get(shopId);
  if (!ids) throw new Error(`shop: unknown shop "${shopId}"`);
  return ids.flatMap((id) => {
    const item = data.items.get(id);
    return item ? [item] : [];
  });
}

/** The buy list of `shopId` for a player with `euros` and bag `items`. */
export function buyRows(
  shopId: string,
  data: ShopData,
  euros: number,
  items: Readonly<Inventory>,
): ShopRow[] {
  return stockRows(shopStock(shopId, data), euros, items);
}

/** The buy list of any `stock` (a shop's, or the story realm's `story.json › shop`), in order. */
export function stockRows(stock: readonly Item[], euros: number, items: Readonly<Inventory>): ShopRow[] {
  return stock.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    owned: itemCount(items, item.id),
    limit: Math.min(ITEM_COUNT_MAX, maxBuyQuantity(euros, items, item)),
  }));
}

/**
 * The sell list: every item in the bag, in bag order; unsellable ones have `price: null` and limit 0. Prices come
 * from `priceOf` (half the price by default; the story shop passes `refundPrice`).
 */
export function sellRows(
  data: Pick<ShopData, 'items'>,
  items: Readonly<Inventory>,
  priceOf: (item: Item) => number | null = sellPrice,
): ShopRow[] {
  return Object.keys(items).flatMap((id) => {
    const item = data.items.get(id);
    const owned = itemCount(items, id);
    if (!item || owned <= 0) return [];
    const price = priceOf(item);
    return [
      {
        id,
        name: item.name,
        description: item.description,
        price,
        owned,
        limit: price === null ? 0 : owned,
      },
    ];
  });
}

/**
 * Why the player cannot pick a quantity for `row` at all (limit 0), or `null`. Buying: not enough money
 * for one, or the bag is full. Selling: the item cannot be sold.
 */
export function rowError(
  mode: ShopMode,
  row: ShopRow,
  euros: number,
): Extract<ShopError, 'not_for_sale' | 'not_enough_money' | 'bag_full'> | null {
  if (row.limit > 0) return null;
  if (row.price === null) return 'not_for_sale';
  if (mode === 'sell') return 'not_for_sale';
  return row.price > euros ? 'not_enough_money' : 'bag_full';
}

/** Move the quantity by `delta`, kept within 1 … `limit` (0 if `limit` < 1). */
export function stepQuantity(qty: number, delta: number, limit: number): number {
  if (limit < 1) return 0;
  return Math.min(limit, Math.max(1, qty + delta));
}

/** Total price of `qty` items at `price` each. */
export function totalPrice(price: number, qty: number): number {
  return price * qty;
}
