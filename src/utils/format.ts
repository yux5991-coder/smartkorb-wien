import type { Language } from '../i18n/translations';
import type { Product } from '../types';

/**
 * Number and date formatting follows the UI language. The language is set once
 * from the profile store (`setFormatLanguage`) instead of being threaded
 * through every call site — formatting is presentation, not state.
 */
let language: Language = 'de';

export const setFormatLanguage = (next: Language): void => {
  language = next;
};

export const getFormatLanguage = (): Language => language;

/** "2,49 €" in German, "€2.49" in English. */
export const formatPrice = (value: number): string =>
  language === 'en' ? `€${value.toFixed(2)}` : `${value.toFixed(2).replace('.', ',')} €`;

const decimal = (value: number, digits: number): string =>
  language === 'en' ? value.toFixed(digits) : value.toFixed(digits).replace('.', ',');

export const formatGrams = (grams: number): string =>
  grams >= 1000
    ? `${decimal(grams / 1000, grams % 1000 === 0 ? 0 : 1)} kg`
    : `${Math.round(grams)} g`;

/** "1 kg", "250 g", "2 Stk (400 g)" — human readable ingredient amount. */
export const formatAmount = (grams: number, product: Product): string => {
  if (product.pieceGrams && product.pieceGrams >= 50) {
    const pieces = Math.max(1, Math.round(grams / product.pieceGrams));
    const unit = language === 'en' ? 'pcs' : 'Stk';
    return `${pieces} ${unit} (${formatGrams(grams)})`;
  }
  return formatGrams(grams);
};

/** "bis 12.09." / "until 12/09" — end of an offer. */
export const formatValidTo = (isoDate: string): string => {
  const [, month, day] = isoDate.split('-');
  return language === 'en' ? `until ${day}/${month}` : `bis ${day}.${month}.`;
};

/** "noch 3 Tage" / "3 days left" */
export const formatRemainingDays = (isoDate: string): string => {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const end = new Date(`${isoDate}T00:00:00Z`).getTime();
  const days = Math.round((end - today) / (24 * 60 * 60 * 1000));

  if (language === 'en') {
    if (days <= 0) return 'today only';
    return days === 1 ? '1 day left' : `${days} days left`;
  }
  if (days <= 0) return 'nur noch heute';
  return days === 1 ? 'noch 1 Tag' : `noch ${days} Tage`;
};

/** "03.09., 19:07" / "03/09, 19:07" */
export const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${pad(date.getDate())}`;
  const month = `${pad(date.getMonth() + 1)}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return language === 'en' ? `${day}/${month}, ${time}` : `${day}.${month}., ${time}`;
};

/** Price of `grams` of a product at the given pack price. */
export const priceForAmount = (packPrice: number, packGrams: number, grams: number): number =>
  (packPrice / packGrams) * grams;
