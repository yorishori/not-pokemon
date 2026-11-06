import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/schemas';
import {
  addEuros,
  buy,
  buyPrice,
  clampEuros,
  lossPenalty,
  maxBuyQuantity,
  refundPrice,
  rollReward,
  sell,
  sellPrice,
} from '../../src/logic/economy';
import { gameData, scriptedRng } from './helpers';

const item = (id: string): Item => gameData().items.get(id) as Item;
const cafe = item('cafe'); // 50 €

describe('economy', () => {
  it('euros stay whole and within 0–999 999', () => {
    expect(clampEuros(-5)).toBe(0);
    expect(clampEuros(1_500_000)).toBe(999_999);
    expect(clampEuros(12.7)).toBe(12);
    expect(addEuros(999_990, 100)).toBe(999_999);
    expect(addEuros(10, -50)).toBe(0);
  });

  it('reward is rng.int(min, max)', () => {
    expect(rollReward({ min: 80, max: 140 }, scriptedRng({ int: [97] }))).toBe(97);
  });

  it('losing halves the euros, rounded down', () => {
    expect(lossPenalty(341)).toBe(170);
    expect(lossPenalty(0)).toBe(0);
  });

  it('buying 3 Cafés with 200 € leaves 50 € and 3 more Cafés; selling one gives 25 €', () => {
    const bought = buy(200, { cafe: 3 }, cafe, 3);
    expect(bought).toEqual({ ok: true, euros: 50, items: { cafe: 6 } });
    expect(sell(50, { cafe: 6 }, cafe, 1)).toEqual({ ok: true, euros: 75, items: { cafe: 5 } });
    expect(sellPrice(cafe)).toBe(25);
  });

  it('money is checked first, then bag room and quantity', () => {
    expect(buy(149, {}, cafe, 3)).toEqual({ ok: false, reason: 'not_enough_money' });
    expect(buy(10_000, { cafe: 98 }, cafe, 2)).toEqual({ ok: false, reason: 'bag_full' });
    expect(buy(10_000, {}, cafe, 0)).toEqual({ ok: false, reason: 'bad_quantity' });
    expect(maxBuyQuantity(200, {}, cafe)).toBe(4);
    expect(maxBuyQuantity(10_000, { cafe: 97 }, cafe)).toBe(2);
  });

  it('price: null and key items cannot be sold; price: null cannot be bought', () => {
    const keys = item('llaves_audi');
    expect(buyPrice(keys)).toBeNull();
    expect(buy(1000, {}, keys, 1)).toEqual({ ok: false, reason: 'not_for_sale' });
    expect(sell(0, { llaves_audi: 1 }, keys, 1)).toEqual({ ok: false, reason: 'not_for_sale' });
    expect(maxBuyQuantity(1000, {}, keys)).toBe(0);
    const pricedKey: Item = { ...keys, price: 100 };
    expect(sellPrice(pricedKey)).toBeNull();
    expect(sell(0, { cafe: 1 }, cafe, 2)).toEqual({ ok: false, reason: 'not_enough_items' });
    expect(sell(0, { cafe: 1 }, cafe, 0)).toEqual({ ok: false, reason: 'bad_quantity' });
    expect(maxBuyQuantity(0, {}, { ...cafe, price: 0 })).toBe(99);
  });

  it('the story shop buys back at the full price (refundPrice); key items still cannot be sold', () => {
    expect(refundPrice(cafe)).toBe(50);
    expect(sell(0, { cafe: 2 }, cafe, 2, refundPrice)).toEqual({ ok: true, euros: 100, items: {} });
    expect(refundPrice({ ...cafe, effect: { type: 'key' } })).toBeNull();
  });

  it('selling never goes above the euro cap', () => {
    expect(sell(999_990, { cafe: 1 }, cafe, 1)).toMatchObject({ ok: true, euros: 999_999 });
  });
});
