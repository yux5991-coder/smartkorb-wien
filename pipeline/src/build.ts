/**
 * One pipeline run: fetch → normalize → validate → snapshot.
 *
 * Nothing here talks to the app. The result is a single JSON file that the app
 * downloads (`expo.extra.snapshotUrl`) and validates again on its side.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { validateCatalog } from '../../src/data/validateCatalog';
import type { Catalog, Product, Recipe, Retailer, Store } from '../../src/types';
import { loadConfig, type OfferSourceConfig, type PipelineConfig } from './config';
import { log, warn } from './log';
import { normalizeOffers } from './normalize/offers';
import { ProductCatalogue } from './normalize/products';
import { normalizeStores } from './normalize/stores';
import { createCsvOfferSource } from './sources/csvOffers';
import { createHttpJsonOfferSource } from './sources/httpJsonOffers';
import { createMockOfferSource } from './sources/mockOffers';
import { createOverpassStoreSource } from './sources/overpassStores';
import type { OfferSource, RawOffer, SourceContext } from './types';

export interface BuildOptions {
  configPath: string;
  dryRun: boolean;
  skipStores: boolean;
  updateSeed: boolean;
  /** Publish a much shorter branch list anyway (branches really did close). */
  allowStoreDrop?: boolean;
  limit?: number;
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

const readJsonIfExists = async <T>(path: string): Promise<T | null> => {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export interface StoreDecision {
  stores: Store[];
  source: 'fetched' | 'previous' | 'seed';
  reason: string;
}

/**
 * Which branch list the snapshot is built from.
 *
 * The branch list is expensive to obtain (one Overpass query per week) and easy
 * to lose: a run that skips the refresh must not fall back to the small bundled
 * seed and publish a snapshot with a fraction of the branches. So the previous
 * snapshot's list is carried over, and a fetch that returns far fewer branches
 * than last time is treated as a broken source, not as a city that shrank.
 */
export const chooseStores = ({
  fetched,
  previous,
  seed,
  allowDrop = false,
}: {
  fetched: Store[] | null;
  previous: Store[];
  seed: Store[];
  allowDrop?: boolean;
}): StoreDecision => {
  if (fetched && fetched.length > 0) {
    if (!allowDrop && previous.length > 0 && fetched.length < previous.length * 0.5) {
      return {
        stores: previous,
        source: 'previous',
        reason: `refresh returned ${fetched.length} branches but the last snapshot had ${previous.length} — keeping the previous list (pass --allow-store-drop to override)`,
      };
    }
    return {
      stores: fetched,
      source: 'fetched',
      reason: `${fetched.length} branches from the refresh`,
    };
  }

  if (previous.length > seed.length) {
    return {
      stores: previous,
      source: 'previous',
      reason: `reusing the ${previous.length} branches from the last snapshot`,
    };
  }

  return { stores: seed, source: 'seed', reason: `${seed.length} branches from the bundled seed` };
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const buildOfferSource = (
  config: OfferSourceConfig,
  seed: { products: Product[]; retailers: Retailer[]; stores: Store[] },
): OfferSource | null => {
  switch (config.type) {
    case 'mock':
      return createMockOfferSource(seed.products, seed.retailers, seed.stores);
    case 'csv':
      return createCsvOfferSource(config.id, config.file);
    case 'http-json':
      return createHttpJsonOfferSource(config);
    default:
      warn(`unknown source type in config: ${JSON.stringify(config)}`);
      return null;
  }
};

export const build = async (options: BuildOptions): Promise<Catalog> => {
  const config: PipelineConfig = await loadConfig(options.configPath);

  const retailers = await readJson<Retailer[]>('src/data/retailers.json');
  const seedProducts = await readJson<Product[]>('src/data/products.json');
  const recipes = await readJson<Recipe[]>('src/data/recipes.json');
  const seedStores = await readJson<Store[]>(config.output.seedStores);

  const ctx: SourceContext = { cacheDir: '.cache', log, limit: options.limit };
  const usedSources: string[] = [];

  // --- branches ------------------------------------------------------------
  const previousSnapshot = await readJsonIfExists<Catalog>(config.output.snapshot);
  const previousStores = previousSnapshot?.stores ?? [];

  let fetchedStores: Store[] | null = null;
  let storeSourceLabel: string | null = null;
  if (config.stores.enabled && !options.skipStores) {
    try {
      const source = createOverpassStoreSource(config.stores.overpassUrl, config.city);
      const raw = await source.fetchStores(ctx);
      fetchedStores = normalizeStores(
        raw,
        new Map(retailers.map((retailer) => [retailer.id, retailer.name])),
      );
      storeSourceLabel = source.label;
    } catch (error) {
      warn(`branch refresh failed: ${String(error)}`);
    }
  }

  const decision = chooseStores({
    fetched: fetchedStores,
    previous: previousStores,
    seed: seedStores,
    allowDrop: options.allowStoreDrop,
  });
  const stores = decision.stores;
  log(`branches: ${decision.reason}`);

  if (decision.source === 'fetched' && storeSourceLabel) usedSources.push(storeSourceLabel);
  if (decision.source !== 'fetched' && fetchedStores) {
    warn(decision.reason);
  }
  if (decision.source === 'fetched' && options.updateSeed && !options.dryRun) {
    await writeJson(config.output.seedStores, stores);
    log(`updated bundled fallback ${config.output.seedStores}`);
  }

  // --- offers --------------------------------------------------------------
  const catalogue = new ProductCatalogue(seedProducts);
  const allDiscounts: Catalog['discounts'] = [];

  for (const sourceConfig of config.offers) {
    if (!sourceConfig.enabled) continue;
    const source = buildOfferSource(sourceConfig, { products: seedProducts, retailers, stores });
    if (!source) continue;

    try {
      const raw: RawOffer[] = await source.fetchOffers(ctx);
      const { discounts, stats } = normalizeOffers(raw, {
        catalogue,
        retailerIds: new Set(retailers.map((retailer) => retailer.id)),
        stores,
        source: source.id,
      });
      allDiscounts.push(...discounts);
      if (discounts.length > 0) usedSources.push(source.label);
      log(
        `${source.id}: ${stats.accepted}/${stats.input} offers accepted ` +
          `(+${stats.newProducts} new products, ${stats.droppedPrice} bad prices, ` +
          `${stats.droppedDuplicate} duplicates)`,
      );
    } catch (error) {
      // one broken retailer must not take the whole run down
      warn(`${sourceConfig.id} failed: ${String(error)}`);
    }
  }

  // --- assemble & validate -------------------------------------------------
  const snapshot: Catalog = {
    generatedAt: new Date().toISOString(),
    retailers,
    stores,
    products: catalogue.all(),
    discounts: allDiscounts,
    recipes,
    sources: usedSources.length > 0 ? usedSources : ['none'],
  };

  const { catalog, warnings } = validateCatalog(snapshot, {
    fallbackRecipes: recipes,
    minDiscounts: config.minDiscounts,
  });
  warnings.forEach(warn);

  log(
    `snapshot: ${catalog.stores.length} branches · ${catalog.products.length} products · ` +
      `${catalog.discounts.length} offers · sources: ${catalog.sources.join(', ')}`,
  );

  if (options.dryRun) {
    log('dry run — nothing written');
  } else {
    await writeJson(config.output.snapshot, catalog);
    log(`wrote ${config.output.snapshot}`);
  }

  return catalog;
};
