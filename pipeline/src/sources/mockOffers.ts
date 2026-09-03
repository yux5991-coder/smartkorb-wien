/**
 * Demo offers that behave like a real Austrian flyer week.
 *
 * This is what keeps the pipeline (and CI) working before a retailer feed is
 * connected — but "demo" should not mean "implausible", because the offer feed
 * is what the whole app is judged on. The generator therefore models how the
 * chains actually promote:
 *
 * - Billa / Billa Plus / Spar run a Thursday-to-Wednesday flyer with many
 *   items, a large share of them tied to the loyalty programme;
 * - Hofer / Lidl / Penny run Monday-to-Saturday with fewer but deeper cuts and
 *   the occasional single-day special;
 * - prices land on the endings the shelves actually show (…,99 / …,49 / …,29);
 * - ready meals and chilled convenience are promoted as heavily as raw produce.
 *
 * Rows are tagged `source: "mock"`, and the app labels them as demo data.
 */
import type { Product, ProductCategory, Retailer, Store } from '../../../src/types';
import type { OfferSource, RawOffer, SourceContext } from '../types';

interface RetailerProfile {
  retailerId: string;
  /** Products on offer in one flyer week. */
  offerCount: number;
  /** Discount ladder, listed with the frequency it should appear. */
  percents: number[];
  cycle: 'thu-wed' | 'mon-sat';
  /** Loyalty-card condition and the share of offers carrying it. */
  loyalty?: { label: string; share: number };
  /** Multi-buy condition, e.g. "ab 2 Stück". */
  multiBuy?: { label: string; share: number };
  /** Single-day special (0 = Sunday … 6 = Saturday). */
  oneDay?: { label: string; weekday: number; share: number };
  /** Share of offers limited to a single branch (rare in reality). */
  branchShare: number;
  /** Relative weight per category when picking what goes on offer. */
  weights: Partial<Record<ProductCategory, number>>;
}

const BASE_WEIGHTS: Record<ProductCategory, number> = {
  'Obst & Gemüse': 5,
  'Fleisch & Fisch': 4,
  Milchprodukte: 4,
  'Brot & Gebäck': 2,
  'Fertig & Convenience': 4,
  Vorratskammer: 3,
  Getränke: 3,
  Tiefkühl: 3,
  'Süßes & Snacks': 2,
};

const PROFILES: RetailerProfile[] = [
  {
    retailerId: 'billa',
    offerCount: 58,
    percents: [20, 25, 25, 25, 30, 33, 33, 40, 50],
    cycle: 'thu-wed',
    loyalty: { label: 'nur mit Jö Bonus Club', share: 0.35 },
    multiBuy: { label: 'ab 2 Stück', share: 0.12 },
    branchShare: 0.02,
    weights: { 'Fertig & Convenience': 5, Milchprodukte: 5 },
  },
  {
    retailerId: 'billaplus',
    offerCount: 66,
    percents: [20, 25, 25, 30, 33, 33, 40, 50],
    cycle: 'thu-wed',
    loyalty: { label: 'nur mit Jö Bonus Club', share: 0.3 },
    multiBuy: { label: 'ab 3 Stück', share: 0.15 },
    branchShare: 0.03,
    weights: { Getränke: 5, 'Fertig & Convenience': 5, Tiefkühl: 4 },
  },
  {
    retailerId: 'spar',
    offerCount: 54,
    percents: [20, 25, 25, 30, 33, 33, 50],
    cycle: 'thu-wed',
    loyalty: { label: 'nur mit SPAR Clubkarte', share: 0.3 },
    multiBuy: { label: 'ab 2 Stück', share: 0.1 },
    branchShare: 0.02,
    weights: { 'Obst & Gemüse': 6, 'Fertig & Convenience': 4 },
  },
  {
    retailerId: 'hofer',
    offerCount: 26,
    percents: [25, 30, 33, 33, 40, 50],
    cycle: 'mon-sat',
    oneDay: { label: 'nur am Samstag', weekday: 6, share: 0.12 },
    branchShare: 0,
    weights: { 'Obst & Gemüse': 6, 'Fleisch & Fisch': 5, Tiefkühl: 4 },
  },
  {
    retailerId: 'lidl',
    offerCount: 30,
    percents: [25, 30, 33, 40, 50],
    cycle: 'mon-sat',
    oneDay: { label: 'Super Samstag', weekday: 6, share: 0.15 },
    branchShare: 0,
    weights: { 'Obst & Gemüse': 6, 'Fertig & Convenience': 4, 'Brot & Gebäck': 3 },
  },
  {
    retailerId: 'penny',
    offerCount: 34,
    percents: [20, 25, 30, 33, 33, 50],
    cycle: 'mon-sat',
    loyalty: { label: 'nur mit PENNY Karte', share: 0.25 },
    branchShare: 0.02,
    weights: { 'Fertig & Convenience': 5, 'Süßes & Snacks': 3, Getränke: 4 },
  },
];

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/** The flyer window that is running today, per chain rhythm. */
const currentWindow = (cycle: RetailerProfile['cycle'], today: Date) => {
  const weekday = today.getUTCDay(); // 0 = Sunday
  if (cycle === 'thu-wed') {
    const sinceThursday = (weekday + 3) % 7; // Thursday = 4
    const from = addDays(today, -sinceThursday);
    return { from, to: addDays(from, 6) };
  }
  const sinceMonday = (weekday + 6) % 7; // Monday = 1
  const from = addDays(today, -sinceMonday);
  return { from, to: addDays(from, 5) }; // Monday-Saturday
};

/** Cent endings Austrian shelf labels actually use. */
const PRICE_ENDINGS = [99, 89, 79, 69, 59, 49, 39, 29, 19, 9];

/** All prices in a range whose cent ending a price tag would actually show. */
const shelfCandidates = (minCents: number, maxCents: number): number[] => {
  const candidates: number[] = [];
  for (let euro = Math.max(0, Math.floor(minCents / 100)); euro <= Math.floor(maxCents / 100); euro++) {
    PRICE_ENDINGS.forEach((ending) => {
      const value = euro * 100 + ending;
      if (value >= minCents && value <= maxCents && value > 0) candidates.push(value);
    });
  }
  return candidates;
};

/**
 * A shelf price and a promo price that both look like real price tags *and*
 * produce exactly the advertised percentage.
 *
 * Flyers never show "2,31 statt 2,89": both numbers end in 9 (or 5), and the
 * badge is derived from them. So the generator searches the nearby shelf prices
 * for a pair that satisfies both constraints, and only falls back to plain
 * arithmetic when no such pair exists.
 */
const buildPricePair = (
  basePrice: number,
  percent: number,
): { original: number; discounted: number } => {
  const baseCents = Math.round(basePrice * 100);
  const originals = shelfCandidates(Math.round(baseCents * 0.85), Math.round(baseCents * 1.18)).sort(
    (a, b) => Math.abs(a - baseCents) - Math.abs(b - baseCents),
  );

  for (const original of originals) {
    const target = original * (1 - percent / 100);
    const promos = shelfCandidates(Math.round(target * 0.85), Math.round(target * 1.15)).sort(
      (a, b) => Math.abs(a - target) - Math.abs(b - target),
    );
    for (const promo of promos) {
      if (promo >= original) continue;
      if (Math.round((1 - promo / original) * 100) === percent) {
        return { original: original / 100, discounted: promo / 100 };
      }
    }
  }

  const original = originals[0] ?? baseCents;
  return {
    original: original / 100,
    discounted: Math.max(0.09, Math.round(original * (1 - percent / 100)) / 100),
  };
};

export const createMockOfferSource = (
  products: Product[],
  retailers: Retailer[],
  stores: Store[],
): OfferSource => ({
  id: 'mock',
  label: 'Demo-Flugblatt (simuliert, bis echte Quellen angebunden sind)',

  fetchOffers: async (ctx: SourceContext): Promise<RawOffer[]> => {
    ctx.log('generating a demo flyer week from the product catalogue');

    // deterministic: the same day produces the same flyer
    let seed = Number(isoDate(new Date()).replace(/-/g, ''));
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];

    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const knownRetailers = new Set(retailers.map((retailer) => retailer.id));
    const offers: RawOffer[] = [];

    PROFILES.filter((profile) => knownRetailers.has(profile.retailerId)).forEach((profile) => {
      const window = currentWindow(profile.cycle, today);
      const branches = stores.filter((store) => store.retailerId === profile.retailerId);

      // weighted, duplicate-free draw of the products this chain promotes
      const pool = products.map((product) => ({
        product,
        weight:
          (profile.weights[product.category] ?? BASE_WEIGHTS[product.category] ?? 1) *
          (0.5 + rnd()),
      }));
      const selected = pool
        .sort((a, b) => b.weight - a.weight)
        .slice(0, Math.min(profile.offerCount, pool.length))
        .map((entry) => entry.product);

      selected.forEach((product) => {
        const percent = pick(profile.percents);
        const { original, discounted } = buildPricePair(product.basePrice * (0.96 + rnd() * 0.1), percent);
        if (discounted >= original) return;

        let validFrom = window.from;
        let validTo = window.to;
        let condition: string | undefined;

        const roll = rnd();
        if (profile.oneDay && roll < profile.oneDay.share) {
          // a single-day special inside the running week
          const offset = (profile.oneDay.weekday - window.from.getUTCDay() + 7) % 7;
          validFrom = addDays(window.from, offset);
          validTo = validFrom;
          condition = profile.oneDay.label;
        } else if (profile.loyalty && roll < (profile.oneDay?.share ?? 0) + profile.loyalty.share) {
          condition = profile.loyalty.label;
        } else if (
          profile.multiBuy &&
          roll < (profile.oneDay?.share ?? 0) + (profile.loyalty?.share ?? 0) + profile.multiBuy.share
        ) {
          condition = profile.multiBuy.label;
        }

        const branchOnly = branches.length > 0 && rnd() < profile.branchShare;

        offers.push({
          retailerId: profile.retailerId,
          storeExternalId: branchOnly ? pick(branches).id : undefined,
          productName: product.name,
          unit: product.unit,
          category: product.category,
          originalPrice: original,
          discountPrice: discounted,
          validFrom: isoDate(validFrom),
          validTo: isoDate(validTo),
          condition,
        });
      });
    });

    return ctx.limit ? offers.slice(0, ctx.limit) : offers;
  },
});
