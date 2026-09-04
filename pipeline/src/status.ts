#!/usr/bin/env tsx
/**
 * One-line project state, for the report that has to accompany every change:
 * app version, and how many stores / products / recipes the build carries.
 *
 *   npm run project:status
 */
import { readFile } from 'node:fs/promises';

import type { Product, Recipe, Store } from '../../src/types';
import { fail, log } from './log';

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

const run = async (): Promise<void> => {
  const appConfig = await readJson<{ expo: { version?: string; name?: string } }>('app.json');
  const [stores, products, recipes] = await Promise.all([
    readJson<Store[]>('src/data/stores.json'),
    readJson<Product[]>('src/data/products.json'),
    readJson<Recipe[]>('src/data/recipes.json'),
  ]);

  let snapshotStores: number | null = null;
  try {
    const snapshot = await readJson<{ stores: Store[] }>('data/snapshot.json');
    snapshotStores = snapshot.stores.length;
  } catch {
    snapshotStores = null;
  }

  log(`app version : ${appConfig.expo.version ?? '(unset)'}`);
  log(`stores      : ${stores.length} bundled${snapshotStores === null ? '' : `, ${snapshotStores} in the published snapshot`}`);
  log(`products    : ${products.length}`);
  log(`recipes     : ${recipes.length}`);
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
