/**
 * Deterministic demo offers built from the seed product catalogue.
 *
 * This is what keeps the pipeline (and CI) working before any retailer source is
 * wired up: it always produces a valid, current snapshot. Rows are tagged
 * `source: "mock"` so they are recognisable everywhere.
 */
import type { Product, Retailer, Store } from '../../../src/types';
import type { OfferSource, RawOffer, SourceContext } from '../types';

const PERCENTS = [10, 15, 20, 20, 25, 25, 30, 30, 33, 35, 40, 45, 50];

const isoDate = (offsetDays: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

export const createMockOfferSource = (
  products: Product[],
  retailers: Retailer[],
  stores: Store[],
): OfferSource => ({
  id: 'mock',
  label: 'Demodaten (deterministisch erzeugt)',

  fetchOffers: async (ctx: SourceContext): Promise<RawOffer[]> => {
    ctx.log('generating demo offers from the seed catalogue');

    let seed = 20260903;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];

    const offers: RawOffer[] = [];
    products.forEach((product, i) => {
      if (i % 7 === 3) return; // not everything is on sale at once
      const runs = i % 5 === 0 ? 2 : 1;
      const usedRetailers = new Set<string>();

      for (let k = 0; k < runs; k++) {
        let retailer = pick(retailers);
        let guard = 0;
        while (usedRetailers.has(retailer.id) && guard++ < 20) retailer = pick(retailers);
        usedRetailers.add(retailer.id);

        const branches = stores.filter((store) => store.retailerId === retailer.id);
        const branchOnly = offers.length % 4 === 0 && branches.length > 0;

        const percent = pick(PERCENTS);
        const original = Number((product.basePrice * (1 + (rnd() * 0.12 - 0.05))).toFixed(2));

        offers.push({
          retailerId: retailer.id,
          storeExternalId: branchOnly ? pick(branches).id : undefined,
          productName: product.name,
          unit: product.unit,
          category: product.category,
          originalPrice: original,
          discountPrice: Number((original * (1 - percent / 100)).toFixed(2)),
          validFrom: isoDate(-Math.floor(rnd() * 3)),
          validTo: isoDate(1 + Math.floor(rnd() * 9)),
        });
      }
    });

    return ctx.limit ? offers.slice(0, ctx.limit) : offers;
  },
});
