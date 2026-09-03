/**
 * Data access layer of the prototype.
 *
 * Everything the UI knows about retailers, stores, products, discounts and
 * recipes goes through this module. Today it reads the local JSON fixtures in
 * this folder; the function signatures are already async-friendly so that the
 * mock source can be swapped for a real API without touching the screens.
 *
 * TODO(backend): replace the JSON imports below with an HTTP client
 * (e.g. `GET /v1/discounts?city=vienna`) once retailer partnerships / official
 * feeds (Spar, Billa, Hofer, Lidl, Penny) are available. Keep the exported
 * function names — the screens depend only on those.
 */

import type {
  Discount,
  DiscountView,
  Product,
  ProductCategory,
  Recipe,
  Retailer,
  Store,
} from '../types';

import discountsJson from './discounts.json';
import productsJson from './products.json';
import recipesJson from './recipes.json';
import retailersJson from './retailers.json';
import storesJson from './stores.json';

export const retailers = retailersJson as Retailer[];
export const stores = storesJson as Store[];
export const products = productsJson as Product[];
export const recipes = recipesJson as Recipe[];

const rawDiscounts = discountsJson as Discount[];

/**
 * DEMO MODE
 * ---------
 * The mock offers were authored for the week of `REFERENCE_DATE`. So that the
 * prototype always shows a plausible, currently running set of offers, the
 * whole dataset is shifted by the number of days between that reference date
 * and today. Remove this shift as soon as real data arrives — see
 * TODO(backend) above.
 */
const REFERENCE_DATE = '2026-09-03';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const demoOffsetDays = (): number =>
  Math.round((toUtcDate(todayIso()).getTime() - toUtcDate(REFERENCE_DATE).getTime()) / MS_PER_DAY);

const shiftIsoDate = (isoDate: string, days: number): string => {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const offset = demoOffsetDays();

export const discounts: Discount[] = rawDiscounts.map((discount) => ({
  ...discount,
  validFrom: shiftIsoDate(discount.validFrom, offset),
  validTo: shiftIsoDate(discount.validTo, offset),
}));

const retailerById = new Map(retailers.map((retailer) => [retailer.id, retailer]));
const storeById = new Map(stores.map((store) => [store.id, store]));
const productById = new Map(products.map((product) => [product.id, product]));
const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

export const getRetailer = (id: string): Retailer | undefined => retailerById.get(id);
export const getStore = (id: string): Store | undefined => storeById.get(id);
export const getProduct = (id: string): Product | undefined => productById.get(id);
export const getRecipe = (id: string): Recipe | undefined => recipeById.get(id);

export const isDiscountActive = (discount: Discount, onDate = todayIso()): boolean =>
  discount.validFrom <= onDate && discount.validTo >= onDate;

const toView = (discount: Discount): DiscountView | null => {
  const product = productById.get(discount.productId);
  const store = storeById.get(discount.storeId);
  const retailer = store ? retailerById.get(store.retailerId) : undefined;
  if (!product || !store || !retailer) return null;
  return { ...discount, product, store, retailer };
};

/** All offers that are valid today, enriched with product / store / retailer. */
export const getActiveDiscountViews = (): DiscountView[] =>
  discounts
    .filter((discount) => isDiscountActive(discount))
    .map(toView)
    .filter((view): view is DiscountView => view !== null);

/** Offers of a single branch, best percentage first. */
export const getDiscountsForStore = (storeId: string): DiscountView[] =>
  getActiveDiscountViews()
    .filter((view) => view.storeId === storeId)
    .sort((a, b) => b.discountPercent - a.discountPercent);

/** Cheapest current offer for a product across all Vienna stores. */
export const getCheapestOfferForProduct = (productId: string): DiscountView | undefined =>
  getActiveDiscountViews()
    .filter((view) => view.productId === productId)
    .sort((a, b) => a.discountPrice / a.product.baseGrams - b.discountPrice / b.product.baseGrams)[0];

export const productCategories: ProductCategory[] = Array.from(
  new Set(products.map((product) => product.category)),
) as ProductCategory[];

/** Cuisine / usage tags used by the Kulinarik filters. */
export const recipeTags: string[] = Array.from(
  new Set(recipes.flatMap((recipe) => recipe.tags)),
).sort((a, b) => a.localeCompare(b, 'de'));
