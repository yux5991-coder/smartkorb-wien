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
  limit?: number;
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

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
  let stores = seedStores;
  if (config.stores.enabled && !options.skipStores) {
    try {
      const source = createOverpassStoreSource(config.stores.overpassUrl, config.city);
      const raw = await source.fetchStores(ctx);
      const normalized = normalizeStores(
        raw,
        new Map(retailers.map((retailer) => [retailer.id, retailer.name])),
      );
      if (normalized.length >= seedStores.length / 2) {
        stores = normalized;
        usedSources.push(source.label);
        log(`branches: ${stores.length} (was ${seedStores.length} in the seed)`);
        if (options.updateSeed && !options.dryRun) {
          await writeJson(config.output.seedStores, stores);
          log(`updated bundled fallback ${config.output.seedStores}`);
        }
      } else {
        warn(
          `only ${normalized.length} branches came back — keeping the previous ${seedStores.length}`,
        );
      }
    } catch (error) {
      warn(`branch refresh failed, keeping the previous list: ${String(error)}`);
    }
  } else {
    log(`branches: using the existing ${stores.length} (store refresh skipped)`);
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
