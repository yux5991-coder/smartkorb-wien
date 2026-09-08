/**
 * Bridges the app's catalog index into what the planner needs.
 *
 * The planner shops in branches, but a week plan does not need all several
 * hundred of them: chain-wide offers are identical everywhere, so one candidate
 * branch per chain is enough — the one carrying the most branch-exclusive
 * offers, since that is where a plan could gain something extra.
 */
import type { CatalogIndex } from '../data';
import type { DiscountView, Store } from '../types';
import type { PlannerCatalog } from './planner';

const candidateStores = (index: CatalogIndex): Store[] => {
  const byRetailer = new Map<string, { store: Store; exclusives: number }>();

  index.stores.forEach((store) => {
    const exclusives = index.branchViewsByStore.get(store.id)?.length ?? 0;
    const current = byRetailer.get(store.retailerId);
    if (!current || exclusives > current.exclusives) {
      byRetailer.set(store.retailerId, { store, exclusives });
    }
  });

  return Array.from(byRetailer.values()).map((entry) => entry.store);
};

export const buildPlannerCatalog = (index: CatalogIndex): PlannerCatalog => {
  const stores = candidateStores(index);

  // product -> best offer, per branch and per chain
  const branchOffers = new Map<string, Map<string, DiscountView>>();
  const chainOffers = new Map<string, Map<string, DiscountView>>();

  const remember = (target: Map<string, Map<string, DiscountView>>, key: string, view: DiscountView) => {
    let inner = target.get(key);
    if (!inner) {
      inner = new Map();
      target.set(key, inner);
    }
    const current = inner.get(view.productId);
    if (!current || view.discountPrice < current.discountPrice) inner.set(view.productId, view);
  };

  index.branchViewsByStore.forEach((views, storeId) =>
    views.forEach((view) => remember(branchOffers, storeId, view)),
  );
  index.chainViewsByRetailer.forEach((views, retailerId) =>
    views.forEach((view) => remember(chainOffers, retailerId, view)),
  );

  const storeById = new Map(stores.map((store) => [store.id, store]));

  return {
    recipes: index.recipes,
    productById: index.productById,
    stores,
    priceAt: (storeId, productId) => {
      const product = index.productById.get(productId);
      if (!product) return { price: 0 };

      const store = storeById.get(storeId);
      const branch = branchOffers.get(storeId)?.get(productId);
      const chain = store ? chainOffers.get(store.retailerId)?.get(productId) : undefined;

      const best = [branch, chain]
        .filter((view): view is DiscountView => Boolean(view))
        .sort((a, b) => a.discountPrice - b.discountPrice)[0];

      return best
        ? { price: best.discountPrice, discountPercent: best.discountPercent }
        : { price: product.basePrice };
    },
  };
};

/** Monday of the current week as a stable per-week seed. */
export const currentWeekSeed = (date = new Date()): number => {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Number(
    `${monday.getFullYear()}${String(monday.getMonth() + 1).padStart(2, '0')}${String(
      monday.getDate(),
    ).padStart(2, '0')}`,
  );
};
