/**
 * The catalog that ships inside the app bundle.
 *
 * It is the offline fallback: the app always starts from this data and then
 * replaces it with the newest snapshot from the data pipeline (see
 * `src/data/remote.ts` and the `pipeline/` folder). Keeping a full dataset in
 * the bundle means the prototype also works with no connectivity at all.
 */
import type { Catalog, Discount, Product, Recipe, Retailer, Store } from '../types';

import discountsJson from './discounts.json';
import productsJson from './products.json';
import recipesJson from './recipes.json';
import retailersJson from './retailers.json';
import storesJson from './stores.json';

/**
 * DEMO MODE
 * ---------
 * The bundled offers were authored for the week of `REFERENCE_DATE`. So the
 * seed data never looks expired, the bundled dates are shifted to the current
 * week. Snapshots coming from the pipeline carry real dates and are never
 * shifted — see `shiftDemoDates` below.
 */
const REFERENCE_DATE = '2026-09-03';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

const shiftIsoDate = (isoDate: string, days: number): string => {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const demoOffset = Math.round(
  (toUtcDate(todayIso()).getTime() - toUtcDate(REFERENCE_DATE).getTime()) / MS_PER_DAY,
);

const bundledDiscounts: Discount[] = (discountsJson as Discount[]).map((discount) => ({
  ...discount,
  validFrom: shiftIsoDate(discount.validFrom, demoOffset),
  validTo: shiftIsoDate(discount.validTo, demoOffset),
}));

export const bundledRecipes = recipesJson as Recipe[];

export const bundledCatalog: Catalog = {
  generatedAt: `${REFERENCE_DATE}T04:00:00.000Z`,
  retailers: retailersJson as Retailer[],
  stores: storesJson as Store[],
  products: productsJson as Product[],
  discounts: bundledDiscounts,
  recipes: bundledRecipes,
  sources: ['bundled-seed'],
};
