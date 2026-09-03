/**
 * The basket must be charged in whole packs — you cannot buy 10 g of garlic —
 * while the price per portion only counts what the recipe actually uses.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { packsFor, packTotalFor, usedCostFor } from '../../src/services/packMath';

test('the basket pays for whole packs', () => {
  // 10 g of garlic out of a 200 g pack is still one pack
  assert.equal(packsFor(10, 200), 1);
  assert.equal(packTotalFor(10, 200, 1.49), 1.49);

  // 700 g of potatoes out of a 2 kg bag: one bag
  assert.equal(packsFor(700, 2000), 1);
  // 800 g of minced meat in 500 g trays: two trays
  assert.equal(packsFor(800, 500), 2);
  // exactly two packs stay two packs
  assert.equal(packsFor(1000, 500), 2);
  // never zero packs
  assert.equal(packsFor(0, 500), 1);
});

test('the portion price counts only what is used', () => {
  // 10 g of a 200 g pack at 1.49 -> about 7 cents, not the whole pack
  assert.ok(Math.abs(usedCostFor(10, 200, 1.49) - 0.0745) < 0.0001);
  // using a whole pack costs a whole pack
  assert.equal(usedCostFor(500, 500, 2.49), 2.49);
});

test('basket and usage differ exactly by the leftovers', () => {
  const needed = 150;
  const pack = 500;
  const price = 2.0;
  const basket = packTotalFor(needed, pack, price);
  const used = usedCostFor(needed, pack, price);
  assert.equal(basket, 2.0);
  assert.equal(used, 0.6);
  assert.ok(basket > used, 'the leftover stays in the fridge, not in the portion price');
});
