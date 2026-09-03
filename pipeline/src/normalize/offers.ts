/** Raw offer rows → validated `Discount` rows for the snapshot. */
import type { Discount, Product, Store } from '../../../src/types';
import type { RawOffer } from '../types';
import { ProductCatalogue } from './products';

const isoToday = (): string => new Date().toISOString().slice(0, 10);

const isoInDays = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Short, stable id so the same offer keeps its id between runs. */
const offerId = (parts: (string | null | undefined)[]): string => {
  const key = parts.filter(Boolean).join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `d-${Math.abs(hash).toString(36)}`;
};

export interface NormalizeResult {
  discounts: Discount[];
  products: Product[];
  stats: {
    input: number;
    accepted: number;
    droppedPrice: number;
    droppedRetailer: number;
    droppedDuplicate: number;
    newProducts: number;
  };
}

export const normalizeOffers = (
  raw: RawOffer[],
  options: {
    catalogue: ProductCatalogue;
    retailerIds: Set<string>;
    stores: Store[];
    defaultValidDays?: number;
    source?: string;
  },
): NormalizeResult => {
  const { catalogue, retailerIds, stores, defaultValidDays = 7 } = options;
  const storeIds = new Set(stores.map((store) => store.id));

  const stats = {
    input: raw.length,
    accepted: 0,
    droppedPrice: 0,
    droppedRetailer: 0,
    droppedDuplicate: 0,
    newProducts: 0,
  };

  const before = catalogue.createdCount();
  const byKey = new Map<string, Discount>();

  raw.forEach((offer) => {
    if (!retailerIds.has(offer.retailerId)) {
      stats.droppedRetailer += 1;
      return;
    }
    const originalPrice = Number(offer.originalPrice.toFixed(2));
    const discountPrice = Number(offer.discountPrice.toFixed(2));
    if (
      !Number.isFinite(originalPrice) ||
      !Number.isFinite(discountPrice) ||
      originalPrice <= 0 ||
      discountPrice <= 0 ||
      discountPrice >= originalPrice
    ) {
      stats.droppedPrice += 1;
      return;
    }

    const product = catalogue.resolve({
      name: offer.productName,
      unit: offer.unit,
      category: offer.category,
      shelfPrice: originalPrice,
    });

    const storeId =
      offer.storeExternalId && storeIds.has(offer.storeExternalId) ? offer.storeExternalId : null;

    const validFrom = offer.validFrom ?? isoToday();
    const validTo = offer.validTo ?? isoInDays(defaultValidDays);

    const discount: Discount = {
      id: offerId([offer.retailerId, storeId, product.id, validFrom, validTo]),
      retailerId: offer.retailerId,
      storeId,
      productId: product.id,
      originalPrice,
      discountPrice,
      discountPercent: Math.round((1 - discountPrice / originalPrice) * 100),
      validFrom,
      validTo: validTo < validFrom ? validFrom : validTo,
      source: options.source,
      ...(offer.condition ? { condition: offer.condition } : {}),
      ...(offer.sourceUrl ? { sourceUrl: offer.sourceUrl } : {}),
    };

    // the same product can appear twice in a feed — keep the better price
    const key = `${discount.retailerId}|${discount.storeId ?? '*'}|${discount.productId}|${discount.validFrom}|${discount.condition ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      stats.droppedDuplicate += 1;
      if (discount.discountPrice < existing.discountPrice) byKey.set(key, discount);
      return;
    }
    byKey.set(key, discount);
    stats.accepted += 1;
  });

  stats.newProducts = catalogue.createdCount() - before;

  return { discounts: Array.from(byKey.values()), products: catalogue.all(), stats };
};
