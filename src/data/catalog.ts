/**
 * Read model over a `Catalog`.
 *
 * A catalog is plain JSON — bundled, cached or freshly downloaded. `indexCatalog`
 * turns it into lookup maps and the derived lists the screens need, so the UI
 * never scans the raw arrays. Every selector below is pure and takes the index,
 * which makes the data source (mock vs. real pipeline output) irrelevant to the
 * screens.
 */
import type {
  Catalog,
  CatalogOrigin,
  Discount,
  DiscountView,
  Product,
  ProductCategory,
  Recipe,
  Retailer,
  Store,
} from '../types';
import { todayIso } from './bundled';

export interface CatalogIndex {
  catalog: Catalog;
  origin: CatalogOrigin;
  retailers: Retailer[];
  stores: Store[];
  recipes: Recipe[];
  retailerById: Map<string, Retailer>;
  storeById: Map<string, Store>;
  productById: Map<string, Product>;
  recipeById: Map<string, Recipe>;
  /** Offers valid today, enriched for rendering. */
  activeViews: DiscountView[];
  /** Chain-wide offers (storeId === null) per retailer. */
  chainViewsByRetailer: Map<string, DiscountView[]>;
  /** Branch-specific offers per store. */
  branchViewsByStore: Map<string, DiscountView[]>;
  /** Cheapest offer per product, by unit price. */
  cheapestByProduct: Map<string, DiscountView>;
  categories: ProductCategory[];
  recipeTags: string[];
}

export const isDiscountActive = (discount: Discount, onDate = todayIso()): boolean =>
  discount.validFrom <= onDate && discount.validTo >= onDate;

export const indexCatalog = (catalog: Catalog, origin: CatalogOrigin): CatalogIndex => {
  const retailerById = new Map(catalog.retailers.map((retailer) => [retailer.id, retailer]));
  const storeById = new Map(catalog.stores.map((store) => [store.id, store]));
  const productById = new Map(catalog.products.map((product) => [product.id, product]));
  const recipeById = new Map(catalog.recipes.map((recipe) => [recipe.id, recipe]));

  const today = todayIso();
  const activeViews: DiscountView[] = [];
  const chainViewsByRetailer = new Map<string, DiscountView[]>();
  const branchViewsByStore = new Map<string, DiscountView[]>();
  const cheapestByProduct = new Map<string, DiscountView>();

  catalog.discounts.forEach((discount) => {
    if (!isDiscountActive(discount, today)) return;

    const product = productById.get(discount.productId);
    const retailer = retailerById.get(discount.retailerId);
    if (!product || !retailer) return;

    const store = discount.storeId ? (storeById.get(discount.storeId) ?? null) : null;
    // a branch offer whose store is unknown would be unattributable — drop it
    if (discount.storeId && !store) return;

    const view: DiscountView = { ...discount, product, retailer, store };
    activeViews.push(view);

    if (store) {
      const list = branchViewsByStore.get(store.id);
      if (list) list.push(view);
      else branchViewsByStore.set(store.id, [view]);
    } else {
      const list = chainViewsByRetailer.get(retailer.id);
      if (list) list.push(view);
      else chainViewsByRetailer.set(retailer.id, [view]);
    }

    const unitPrice = view.discountPrice / Math.max(1, product.baseGrams);
    const current = cheapestByProduct.get(product.id);
    if (!current || unitPrice < current.discountPrice / Math.max(1, current.product.baseGrams)) {
      cheapestByProduct.set(product.id, view);
    }
  });

  return {
    catalog,
    origin,
    retailers: catalog.retailers,
    stores: catalog.stores,
    recipes: catalog.recipes,
    retailerById,
    storeById,
    productById,
    recipeById,
    activeViews,
    chainViewsByRetailer,
    branchViewsByStore,
    cheapestByProduct,
    categories: Array.from(new Set(catalog.products.map((product) => product.category))).sort(
      (a, b) => a.localeCompare(b, 'de'),
    ) as ProductCategory[],
    recipeTags: Array.from(new Set(catalog.recipes.flatMap((recipe) => recipe.tags))).sort((a, b) =>
      a.localeCompare(b, 'de'),
    ),
  };
};

export const getRetailer = (index: CatalogIndex, id: string): Retailer | undefined =>
  index.retailerById.get(id);
export const getStore = (index: CatalogIndex, id: string): Store | undefined =>
  index.storeById.get(id);
export const getProduct = (index: CatalogIndex, id: string): Product | undefined =>
  index.productById.get(id);
export const getRecipe = (index: CatalogIndex, id: string): Recipe | undefined =>
  index.recipeById.get(id);

/** Everything that is on offer today. */
export const getActiveDiscountViews = (index: CatalogIndex): DiscountView[] => index.activeViews;

/**
 * What a customer standing in this branch can buy on sale: the chain-wide
 * offers of its retailer plus the offers exclusive to this branch.
 */
export const getDiscountsForStore = (index: CatalogIndex, storeId: string): DiscountView[] => {
  const store = index.storeById.get(storeId);
  if (!store) return [];
  return [
    ...(index.branchViewsByStore.get(storeId) ?? []),
    ...(index.chainViewsByRetailer.get(store.retailerId) ?? []),
  ].sort((a, b) => b.discountPercent - a.discountPercent);
};

/** How many offers a branch shows on the map badge. */
export const countOffersForStore = (index: CatalogIndex, store: Store): number =>
  (index.branchViewsByStore.get(store.id)?.length ?? 0) +
  (index.chainViewsByRetailer.get(store.retailerId)?.length ?? 0);

/** Cheapest current offer for a product, by price per gram / millilitre. */
export const getCheapestOfferForProduct = (
  index: CatalogIndex,
  productId: string,
): DiscountView | undefined => index.cheapestByProduct.get(productId);
