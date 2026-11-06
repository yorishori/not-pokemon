/**
 * Euros, rewards, shops and the loss penalty (docs/GAME-RULES.md › Euros and shops, Enemy NPCs, Losing).
 * Euros are whole numbers 0–`EUROS_MAX`. Buying checks money first; selling gives `floor(price / 2)` (the story
 * realm's shop gives back the full price, {@link refundPrice}).
 * Key items and `price: null` items cannot be bought or sold.
 */
import type { Rng } from '../core/rng';
import type { Item } from '../data/schemas';
import { EUROS_MAX } from './constants';
import { addItem, itemCount, removeItem, roomFor, type Inventory } from './inventory';

/** Why a purchase or sale was refused. */
export type ShopError =
  'not_for_sale' | 'not_enough_money' | 'bag_full' | 'not_enough_items' | 'bad_quantity';

/** Shop result: the new money and bag, or the reason. */
export type ShopResult = { ok: true; euros: number; items: Inventory } | { ok: false; reason: ShopError };

/** Clamp to a valid euro amount (whole, 0–`EUROS_MAX`). */
export function clampEuros(euros: number): number {
  return Math.min(EUROS_MAX, Math.max(0, Math.floor(euros)));
}

/** Add (or subtract, if negative) euros, clamped. */
export function addEuros(euros: number, amount: number): number {
  return clampEuros(euros + amount);
}

/** Reward for beating an NPC: `rng.int(min, max)`. */
export function rollReward(reward: { min: number; max: number }, rng: Rng): number {
  return rng.int(reward.min, reward.max);
}

/** Euros left after losing: `floor(euros / 2)`. */
export function lossPenalty(euros: number): number {
  return Math.floor(euros / 2);
}

/** Buy price, or `null` if the item cannot be bought (`price: null`). */
export function buyPrice(item: Item): number | null {
  return item.price;
}

/** Sell price `floor(price / 2)`, or `null` for key items and `price: null` items. */
export function sellPrice(item: Item): number | null {
  if (item.effect.type === 'key' || item.price === null) return null;
  return Math.floor(item.price / 2);
}

/**
 * The story realm's sell price: the full buy price, so the budget never shrinks; `null` for key items and
 * `price: null` items.
 */
export function refundPrice(item: Item): number | null {
  if (item.effect.type === 'key' || item.price === null) return null;
  return item.price;
}

/** Most of `item` the player can buy now: limited by money and bag room (0 if not for sale). */
export function maxBuyQuantity(euros: number, items: Readonly<Inventory>, item: Item): number {
  const price = buyPrice(item);
  if (price === null) return 0;
  const byMoney = price === 0 ? Infinity : Math.floor(euros / price);
  return Math.min(byMoney, roomFor(items, item.id));
}

/** Buy `qty` of `item`. Money is checked first, then bag room. */
export function buy(euros: number, items: Readonly<Inventory>, item: Item, qty: number): ShopResult {
  const price = buyPrice(item);
  if (price === null) return { ok: false, reason: 'not_for_sale' };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'bad_quantity' };
  const cost = price * qty;
  if (cost > euros) return { ok: false, reason: 'not_enough_money' };
  if (qty > roomFor(items, item.id)) return { ok: false, reason: 'bag_full' };
  return { ok: true, euros: euros - cost, items: addItem(items, item.id, qty).items };
}

/**
 * Sell `qty` of `item` for `priceOf(item)` each: `floor(price / 2)` by default ({@link sellPrice}); the story
 * realm's shop passes {@link refundPrice} instead.
 */
export function sell(
  euros: number,
  items: Readonly<Inventory>,
  item: Item,
  qty: number,
  priceOf: (item: Item) => number | null = sellPrice,
): ShopResult {
  const price = priceOf(item);
  if (price === null) return { ok: false, reason: 'not_for_sale' };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'bad_quantity' };
  if (itemCount(items, item.id) < qty) return { ok: false, reason: 'not_enough_items' };
  return {
    ok: true,
    euros: addEuros(euros, price * qty),
    items: removeItem(items, item.id, qty) as Inventory,
  };
}
