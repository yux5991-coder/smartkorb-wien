/**
 * Guard between the app and whatever the data pipeline produced.
 *
 * The same module runs in two places: in the pipeline (before a snapshot is
 * published) and in the app (before a downloaded snapshot replaces the data on
 * screen). A broken or half-empty feed must never wipe out good data, so rows
 * that do not check out are dropped and a feed that loses too many rows is
 * rejected as a whole.
 */
import type { Catalog, Discount, Product, Recipe, Retailer, Store } from '../types';

export class CatalogValidationError extends Error {}

export interface ValidationResult {
  catalog: Catalog;
  warnings: string[];
  dropped: { stores: number; products: number; discounts: number };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const asArray = (value: unknown, field: string): unknown[] => {
  if (!Array.isArray(value)) throw new CatalogValidationError(`"${field}" is missing or not a list`);
  return value;
};

/** Minimum share of offer rows that must survive validation. */
const MIN_SURVIVING_SHARE = 0.5;

export interface ValidateOptions {
  /** Recipes are app content, not retailer data — pass the bundled ones as fallback. */
  fallbackRecipes?: Recipe[];
  /** Reject snapshots with fewer offers than this (0 disables the check). */
  minDiscounts?: number;
}

export const validateCatalog = (input: unknown, options: ValidateOptions = {}): ValidationResult => {
  const { fallbackRecipes = [], minDiscounts = 1 } = options;

  if (typeof input !== 'object' || input === null) {
    throw new CatalogValidationError('snapshot is not an object');
  }
  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];

  const generatedAt = isNonEmptyString(raw.generatedAt)
    ? raw.generatedAt
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new CatalogValidationError(`"generatedAt" is not a date: ${generatedAt}`);
  }

  const retailers = asArray(raw.retailers, 'retailers').filter((item): item is Retailer => {
    const r = item as Retailer;
    return (
      isNonEmptyString(r?.id) &&
      isNonEmptyString(r?.name) &&
      isNonEmptyString(r?.logoColor) &&
      isNonEmptyString(r?.logoInitials)
    );
  });
  if (retailers.length === 0) throw new CatalogValidationError('no valid retailers');

  const retailerIds = new Set(retailers.map((retailer) => retailer.id));

  const rawStores = asArray(raw.stores, 'stores');
  const stores = rawStores.filter((item): item is Store => {
    const s = item as Store;
    return (
      isNonEmptyString(s?.id) &&
      retailerIds.has(s?.retailerId) &&
      isNonEmptyString(s?.name) &&
      isFiniteNumber(s?.lat) &&
      isFiniteNumber(s?.lng) &&
      // Vienna and its immediate surroundings
      s.lat > 47.9 &&
      s.lat < 48.5 &&
      s.lng > 16.0 &&
      s.lng < 16.7
    );
  });
  if (stores.length === 0) throw new CatalogValidationError('no valid stores');
  const storeIds = new Set(stores.map((store) => store.id));

  const rawProducts = asArray(raw.products, 'products');
  const products = rawProducts.filter((item): item is Product => {
    const p = item as Product;
    return (
      isNonEmptyString(p?.id) &&
      isNonEmptyString(p?.name) &&
      isNonEmptyString(p?.category) &&
      isFiniteNumber(p?.baseGrams) &&
      p.baseGrams > 0 &&
      isFiniteNumber(p?.basePrice) &&
      p.basePrice > 0
    );
  });
  if (products.length === 0) throw new CatalogValidationError('no valid products');
  const productIds = new Set(products.map((product) => product.id));

  const rawDiscounts = asArray(raw.discounts, 'discounts');
  const discounts: Discount[] = [];
  rawDiscounts.forEach((item) => {
    const d = item as Discount;
    if (!isNonEmptyString(d?.id) || !retailerIds.has(d?.retailerId)) return;
    if (!productIds.has(d?.productId)) return;
    if (d.storeId !== null && d.storeId !== undefined && !storeIds.has(d.storeId)) return;
    if (!isFiniteNumber(d?.originalPrice) || !isFiniteNumber(d?.discountPrice)) return;
    if (d.originalPrice <= 0 || d.discountPrice <= 0) return;
    if (d.discountPrice >= d.originalPrice) return;
    if (!ISO_DATE.test(d?.validFrom ?? '') || !ISO_DATE.test(d?.validTo ?? '')) return;
    if (d.validFrom > d.validTo) return;

    // trust the prices, not the percentage the source claims
    const percent = Math.round((1 - d.discountPrice / d.originalPrice) * 100);
    if (percent < 1 || percent > 95) return;

    discounts.push({
      ...d,
      storeId: d.storeId ?? null,
      discountPercent: percent,
    });
  });

  if (discounts.length < minDiscounts) {
    throw new CatalogValidationError(
      `only ${discounts.length} usable offers (minimum ${minDiscounts}) — refusing this snapshot`,
    );
  }
  if (rawDiscounts.length > 0 && discounts.length / rawDiscounts.length < MIN_SURVIVING_SHARE) {
    throw new CatalogValidationError(
      `${rawDiscounts.length - discounts.length} of ${rawDiscounts.length} offers were unusable — feed looks broken`,
    );
  }

  const rawRecipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const recipes = (rawRecipes.length > 0 ? rawRecipes : fallbackRecipes).filter(
    (item): item is Recipe => {
      const r = item as Recipe;
      return (
        isNonEmptyString(r?.id) &&
        isNonEmptyString(r?.title) &&
        Array.isArray(r?.ingredients) &&
        r.ingredients.every((ingredient) => productIds.has(ingredient?.productId))
      );
    },
  );
  if (recipes.length === 0) {
    warnings.push('no recipes survived validation — the Kulinarik tab will be empty');
  }

  const dropped = {
    stores: rawStores.length - stores.length,
    products: rawProducts.length - products.length,
    discounts: rawDiscounts.length - discounts.length,
  };
  (Object.keys(dropped) as (keyof typeof dropped)[]).forEach((key) => {
    if (dropped[key] > 0) warnings.push(`dropped ${dropped[key]} invalid ${key}`);
  });

  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter(isNonEmptyString)
    : ['unknown'];

  return {
    catalog: { generatedAt, retailers, stores, products, discounts, recipes, sources },
    warnings,
    dropped,
  };
};
