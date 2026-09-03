/**
 * The probe cannot be exercised against a live retailer endpoint in CI, so its
 * analysis is tested against payloads shaped the way those APIs usually look.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findItemsPath, suggestMapping } from '../src/probe';

test('finds the offer array inside a nested response', () => {
  const payload = {
    meta: { page: 0, tags: ['a', 'b'] },
    data: {
      tiles: [
        { id: 1, name: 'Rispentomaten', price: { regular: 249, final: 149 } },
        { id: 2, name: 'Bergkäse', price: { regular: 399, final: 279 } },
      ],
    },
  };

  const found = findItemsPath(payload);
  assert.equal(found?.path, 'data.tiles');
  assert.equal(found?.items.length, 2);
});

test('guesses name, both prices, unit, dates and cent scaling', () => {
  const items = [
    {
      productName: 'SPAR Premium Hühnerbrustfilet',
      grammage: '500 g',
      price: { regularPrice: 799, finalPrice: 499 },
      validity: { validFrom: '2026-09-03T00:00:00Z', validTo: '2026-09-09T00:00:00Z' },
      url: 'https://example.invalid/offer/1',
    },
  ];

  const { map, priceDivisor } = suggestMapping(items);

  assert.equal(map.productName, 'productName');
  assert.equal(map.unit, 'grammage');
  assert.equal(map.originalPrice, 'price.regularPrice');
  assert.equal(map.discountPrice, 'price.finalPrice');
  assert.equal(map.validFrom, 'validity.validFrom');
  assert.equal(map.validTo, 'validity.validTo');
  assert.equal(map.sourceUrl, 'url');
  // integer prices >= 100 are read as cents
  assert.equal(priceDivisor, 100);
});

test('handles euro-denominated payloads without cent scaling', () => {
  const { map, priceDivisor } = suggestMapping([
    { title: 'Gnocchi', oldPrice: 1.69, actionPrice: 0.99 },
  ]);

  assert.equal(map.productName, 'title');
  assert.equal(map.originalPrice, 'oldPrice');
  assert.equal(map.discountPrice, 'actionPrice');
  assert.equal(priceDivisor, 1);
});
