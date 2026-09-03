#!/usr/bin/env tsx
/**
 * Checks a partner CSV before it is used in production.
 *
 *   npm run feed:check -- data/partner-feed.csv
 *
 * Reports how many rows parse, how many map onto known products, which rows are
 * rejected and why — so a delivery can be signed off (or sent back) without
 * touching the live snapshot.
 */
import { readFile } from 'node:fs/promises';

import type { Product, Retailer, Store } from '../../src/types';
import { log, fail } from './log';
import { normalizeOffers } from './normalize/offers';
import { ProductCatalogue } from './normalize/products';
import { parseCsv } from './sources/csvOffers';

const file = process.argv[2];

const run = async (): Promise<void> => {
  if (!file) throw new Error('usage: npm run feed:check -- <file.csv>');

  const [products, retailers, stores] = await Promise.all([
    readFile('src/data/products.json', 'utf8').then((raw) => JSON.parse(raw) as Product[]),
    readFile('src/data/retailers.json', 'utf8').then((raw) => JSON.parse(raw) as Retailer[]),
    readFile('src/data/stores.json', 'utf8').then((raw) => JSON.parse(raw) as Store[]),
  ]);

  const rows = parseCsv(await readFile(file, 'utf8'));
  log(`${file}: ${rows.length} rows`);

  const required = ['retailerId', 'productName', 'originalPrice', 'discountPrice'];
  const header = Object.keys(rows[0] ?? {});
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new Error(`missing columns: ${missing.join(', ')}`);

  const knownRetailers = new Set(retailers.map((retailer) => retailer.id));
  const unknownRetailers = new Set(
    rows.map((row) => row.retailerId).filter((id) => !knownRetailers.has(id)),
  );

  const catalogue = new ProductCatalogue(products);
  const seedIds = new Set(products.map((product) => product.id));

  const { discounts, stats } = normalizeOffers(
    rows.map((row) => ({
      retailerId: row.retailerId,
      storeExternalId: row.storeExternalId || undefined,
      productName: row.productName,
      unit: row.unit || undefined,
      category: row.category || undefined,
      originalPrice: Number((row.originalPrice ?? '').replace(',', '.')),
      discountPrice: Number((row.discountPrice ?? '').replace(',', '.')),
      validFrom: row.validFrom || undefined,
      validTo: row.validTo || undefined,
      sourceUrl: row.sourceUrl || undefined,
    })),
    { catalogue, retailerIds: knownRetailers, stores, source: 'feed-check' },
  );

  const matched = discounts.filter((discount) => seedIds.has(discount.productId));
  const chainWide = discounts.filter((discount) => discount.storeId === null);

  log(`accepted:        ${stats.accepted}`);
  log(`matched product: ${matched.length} (rest becomes new catalogue entries)`);
  log(`chain-wide:      ${chainWide.length}, branch-specific: ${discounts.length - chainWide.length}`);
  log(`rejected prices: ${stats.droppedPrice}, unknown retailer: ${stats.droppedRetailer}, duplicates: ${stats.droppedDuplicate}`);

  if (unknownRetailers.size > 0) {
    log(`unknown retailerId values: ${Array.from(unknownRetailers).join(', ')}`);
    log(`allowed: ${Array.from(knownRetailers).join(', ')}`);
  }
  if (stats.accepted === 0) throw new Error('no usable rows — do not publish this feed');
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
