/**
 * The arithmetic behind "what you pay" vs "what a portion costs".
 *
 * Kept free of any data or React Native import so it can be unit tested in
 * plain Node — see `pipeline/test/pricing.test.ts`.
 */

/** Whole packs needed for an amount: nobody sells 10 g of garlic. */
export const packsFor = (neededGrams: number, packGrams: number): number =>
  Math.max(1, Math.ceil(neededGrams / Math.max(1, packGrams)));

/** What the basket is charged for one ingredient. */
export const packTotalFor = (
  neededGrams: number,
  packGrams: number,
  packPrice: number,
): number => packsFor(neededGrams, packGrams) * packPrice;

/** Cost of just the amount a recipe uses — the leftover belongs to the next meal. */
export const usedCostFor = (
  neededGrams: number,
  packGrams: number,
  packPrice: number,
): number => (packPrice / Math.max(1, packGrams)) * neededGrams;
