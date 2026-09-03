import type { Product } from '../types';

/** Formats a EUR amount the Austrian way, e.g. "2,49 €". */
export const formatPrice = (value: number): string =>
  `${value.toFixed(2).replace('.', ',')} €`;

/** "1 kg", "250 g", "2 Stk (400 g)" — human readable ingredient amount. */
export const formatAmount = (grams: number, product: Product): string => {
  if (product.pieceGrams && product.pieceGrams >= 50) {
    const pieces = Math.max(1, Math.round(grams / product.pieceGrams));
    return `${pieces} Stk (${formatGrams(grams)})`;
  }
  return formatGrams(grams);
};

export const formatGrams = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1).replace('.', ',')} kg` : `${Math.round(grams)} g`;

/** "bis 12.09." — end of an offer, short German style. */
export const formatValidTo = (isoDate: string): string => {
  const [, month, day] = isoDate.split('-');
  return `bis ${day}.${month}.`;
};

/** "noch 3 Tage" / "nur noch heute" */
export const formatRemainingDays = (isoDate: string): string => {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const end = new Date(`${isoDate}T00:00:00Z`).getTime();
  const days = Math.round((end - today) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'nur noch heute';
  if (days === 1) return 'noch 1 Tag';
  return `noch ${days} Tage`;
};

/** Price of `grams` of a product at the given pack price. */
export const priceForAmount = (packPrice: number, packGrams: number, grams: number): number =>
  (packPrice / packGrams) * grams;
