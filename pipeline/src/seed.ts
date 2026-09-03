#!/usr/bin/env tsx
/**
 * Regenerates the offers bundled with the app (`src/data/discounts.json`).
 *
 * The bundled catalog is the offline fallback, so it uses the very same flyer
 * generator as the pipeline — one generator, no second set of made-up numbers.
 * `seed-meta.json` records the day it was generated; the app shifts the bundled
 * dates by the distance to that day so the fallback never looks expired.
 *
 *   npm run data:seed
 */
import { readFile, writeFile } from 'node:fs/promises';

import type { Product, Retailer, Store } from '../../src/types';
import { log } from './log';
import { normalizeOffers } from './normalize/offers';
import { ProductCatalogue } from './normalize/products';
import { createMockOfferSource } from './sources/mockOffers';

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

const run = async (): Promise<void> => {
  const [products, retailers, stores] = await Promise.all([
    readJson<Product[]>('src/data/products.json'),
    readJson<Retailer[]>('src/data/retailers.json'),
    readJson<Store[]>('src/data/stores.json'),
  ]);

  const source = createMockOfferSource(products, retailers, stores);
  const raw = await source.fetchOffers({ cacheDir: '.cache', log });

  const { discounts, stats } = normalizeOffers(raw, {
    catalogue: new ProductCatalogue(products),
    retailerIds: new Set(retailers.map((retailer) => retailer.id)),
    stores,
    source: 'mock',
  });

  const referenceDate = new Date().toISOString().slice(0, 10);

  await writeFile('src/data/discounts.json', `${JSON.stringify(discounts, null, 2)}\n`, 'utf8');
  await writeFile(
    'src/data/seed-meta.json',
    `${JSON.stringify({ referenceDate, generatedAt: new Date().toISOString(), offers: discounts.length }, null, 2)}\n`,
    'utf8',
  );

  const perRetailer = new Map<string, number>();
  discounts.forEach((discount) =>
    perRetailer.set(discount.retailerId, (perRetailer.get(discount.retailerId) ?? 0) + 1),
  );

  log(`seed offers: ${discounts.length} (from ${stats.input} generated rows)`);
  perRetailer.forEach((count, retailerId) => log(`  ${retailerId}: ${count}`));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
