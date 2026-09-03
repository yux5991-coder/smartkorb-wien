/**
 * Unit tests for the parts of the pipeline that turn messy retailer data into
 * app data. They matter because the live endpoints cannot be exercised in CI.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import seedProducts from '../../src/data/products.json';
import type { Product, Retailer } from '../../src/types';
import { validateCatalog } from '../../src/data/validateCatalog';
import { ProductCatalogue, parsePackSize, guessCategory, guessVegan } from '../src/normalize/products';
import { normalizeStores, districtFromPostcode } from '../src/normalize/stores';
import { matchRetailer, buildQuery } from '../src/sources/overpassStores';
import { parseCsv } from '../src/sources/csvOffers';
import { getPath } from '../src/sources/httpJsonOffers';
import { normalizeOffers } from '../src/normalize/offers';

const products = seedProducts as Product[];

test('parsePackSize understands the usual Austrian pack sizes', () => {
  assert.equal(parsePackSize('500 g').baseGrams, 500);
  assert.equal(parsePackSize('1,5 l').baseGrams, 1500);
  assert.equal(parsePackSize('2 kg').baseGrams, 2000);
  assert.equal(parsePackSize('6 x 1,5 l').baseGrams, 9000);
  assert.equal(parsePackSize('3 x 80 g').baseGrams, 240);
  assert.equal(parsePackSize('6 Stk').baseGrams, 600);
  // no size anywhere: fall back to something that keeps per-gram maths sane
  assert.ok(parsePackSize(undefined, 'Kürbis').baseGrams > 0);
});

test('product matching survives brand prefixes but rejects lookalikes', () => {
  const catalogue = new ProductCatalogue(products);

  assert.equal(catalogue.match('Rispentomaten')?.id, 'p-03');
  assert.equal(catalogue.match('SPAR Premium Hühnerbrustfilet')?.id, 'p-16');
  assert.equal(catalogue.match('Zurück zum Ursprung Bergkäse')?.id, 'p-28');
  assert.equal(catalogue.match('Ja! Natürlich Bio-Vollmilch 3,5 %')?.id, 'p-24');

  // "Hafer…" must not be pulled onto "Haferdrink"
  assert.equal(catalogue.match('Hafer-Vollkornkekse mit Haselnuss'), null);
  assert.equal(catalogue.match('Chorizo Picante'), null);
});

test('new products get a plausible category, allergens and vegan flag', () => {
  const catalogue = new ProductCatalogue(products);
  const chorizo = catalogue.resolve({
    name: 'Chorizo Picante',
    unit: '150 g',
    category: 'Fleisch & Fisch',
    shelfPrice: 2.99,
  });
  assert.equal(chorizo.category, 'Fleisch & Fisch');
  assert.equal(chorizo.vegan, false);

  const kekse = catalogue.resolve({
    name: 'Hafer-Vollkornkekse mit Haselnuss',
    unit: '250 g',
    shelfPrice: 2.49,
  });
  assert.deepEqual(kekse.allergens.sort(), ['gluten', 'nuesse']);

  assert.equal(guessCategory('Bio-Zucchini'), 'Obst & Gemüse');
  assert.equal(guessVegan('Bio-Haferdrink', 'Milchprodukte'), true);
  assert.equal(guessVegan('Bergkäse', 'Milchprodukte'), false);
});

test('OSM brands map to our retailers, most specific first', () => {
  assert.equal(matchRetailer('BILLA PLUS'), 'billaplus');
  assert.equal(matchRetailer('BILLA'), 'billa');
  assert.equal(matchRetailer('INTERSPAR'), 'spar');
  assert.equal(matchRetailer('EUROSPAR'), 'spar');
  assert.equal(matchRetailer(undefined, 'Hofer'), 'hofer');
  assert.equal(matchRetailer(undefined, undefined, 'Lidl Österreich'), 'lidl');
  assert.equal(matchRetailer('Denns BioMarkt'), null);
  assert.ok(buildQuery('Wien').includes('"admin_level"="4"'));
});

test('branches are deduplicated and get a district', () => {
  const retailerNames = new Map([
    ['billa', 'Billa'],
    ['spar', 'Spar'],
  ]);

  const stores = normalizeStores(
    [
      {
        externalId: 'osm-node-1',
        retailerId: 'billa',
        name: 'Billa Wien Mitte',
        street: 'Landstraßer Hauptstraße',
        houseNumber: '1',
        postcode: '1030',
        city: 'Wien',
        lat: 48.2059,
        lng: 16.3849,
        openingHours: 'Mo-Sa 07:00-21:00',
      },
      // same shop, mapped a second time as a building outline
      {
        externalId: 'osm-way-2',
        retailerId: 'billa',
        lat: 48.20591,
        lng: 16.38492,
      },
      // no address at all
      { externalId: 'osm-node-3', retailerId: 'spar', lat: 48.1866, lng: 16.2996 },
    ],
    retailerNames,
  );

  assert.equal(stores.length, 2);
  const billa = stores.find((store) => store.id === 'osm-node-1');
  assert.equal(billa?.district, 'Landstraße');
  assert.equal(billa?.address, 'Landstraßer Hauptstraße 1, 1030 Wien');

  const spar = stores.find((store) => store.retailerId === 'spar');
  assert.ok(spar?.name.startsWith('Spar'));
  assert.equal(spar?.openingHours, 'Öffnungszeiten laut Aushang');
  assert.equal(districtFromPostcode('1160'), 'Ottakring');
  assert.equal(districtFromPostcode('9020'), null);
});

test('CSV parsing handles quotes and picks the right delimiter', () => {
  const rows = parseCsv(
    'retailerId;productName;originalPrice\nbilla;"Vollmilch 3,5 %";1,79\nspar;Butter;2.79\n',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].productName, 'Vollmilch 3,5 %');
  assert.equal(rows[1].retailerId, 'spar');
});

test('dot paths reach into nested API payloads', () => {
  const payload = { data: { items: [{ price: { final: 199 } }] } };
  assert.equal(getPath(payload, 'data.items[0].price.final'), 199);
  assert.equal(getPath(payload, 'data.missing.deep'), undefined);
});

test('offer normalisation drops impossible prices and keeps the cheaper duplicate', () => {
  const catalogue = new ProductCatalogue(products);
  const retailerIds = new Set(['billa']);
  const { discounts, stats } = normalizeOffers(
    [
      { retailerId: 'billa', productName: 'Rispentomaten', originalPrice: 2.49, discountPrice: 1.49, validFrom: '2026-09-01', validTo: '2026-09-07' },
      { retailerId: 'billa', productName: 'Rispentomaten', originalPrice: 2.49, discountPrice: 1.29, validFrom: '2026-09-01', validTo: '2026-09-07' },
      { retailerId: 'billa', productName: 'Kaputt', originalPrice: 1, discountPrice: 2 },
      { retailerId: 'unbekannt', productName: 'Fremd', originalPrice: 2, discountPrice: 1 },
    ],
    { catalogue, retailerIds, stores: [], source: 'test' },
  );

  assert.equal(discounts.length, 1);
  assert.equal(discounts[0].discountPrice, 1.29);
  assert.equal(discounts[0].storeId, null);
  assert.equal(discounts[0].discountPercent, 48);
  assert.equal(stats.droppedPrice, 1);
  assert.equal(stats.droppedRetailer, 1);
});

test('validateCatalog refuses a broken feed instead of emptying the app', () => {
  const retailers: Retailer[] = [
    { id: 'billa', name: 'Billa', logoColor: '#E2001A', logoTextColor: '#fff', logoInitials: 'BI' },
  ];
  const base = {
    generatedAt: new Date().toISOString(),
    retailers,
    stores: [
      { id: 's1', retailerId: 'billa', name: 'Billa', address: 'Wien', district: 'Wieden', lat: 48.19, lng: 16.36, openingHours: '' },
    ],
    products: [products[0]],
    recipes: [],
    sources: ['test'],
  };

  const ok = validateCatalog({
    ...base,
    discounts: [
      { id: 'd1', retailerId: 'billa', storeId: null, productId: products[0].id, originalPrice: 3, discountPrice: 2, discountPercent: 99, validFrom: '2026-09-01', validTo: '2026-09-09' },
    ],
  });
  // the claimed percentage is recomputed from the prices
  assert.equal(ok.catalog.discounts[0].discountPercent, 33);

  assert.throws(() => validateCatalog({ ...base, discounts: [] }), /refusing this snapshot/);
  assert.throws(
    () =>
      validateCatalog({
        ...base,
        discounts: [
          { id: 'd1', retailerId: 'billa', storeId: 'ghost', productId: products[0].id, originalPrice: 3, discountPrice: 2, discountPercent: 33, validFrom: '2026-09-01', validTo: '2026-09-09' },
        ],
      }),
    /unusable|refusing/,
  );
});
