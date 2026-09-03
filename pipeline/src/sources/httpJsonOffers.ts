/**
 * Generic adapter for a JSON endpoint that lists offers.
 *
 * Endpoints are declared in `sources.config.json`, not in code, so a new
 * retailer (or a changed response shape) is a config edit rather than a patch.
 * See the README section "Anbindung echter Aktionsdaten" for what is required
 * before switching one of these on: check the retailer's terms of use and, where
 * needed, get written permission — an official partner feed is the goal, this
 * adapter is what consumes it.
 */
import type { OfferSource, RawOffer, SourceContext } from '../types';
import { fetchJson } from '../http';
import { warn } from '../log';

export interface HttpJsonOfferConfig {
  id: string;
  type: 'http-json';
  enabled: boolean;
  label?: string;
  retailerId: string;
  /** May contain `{page}` and `{pageSize}` placeholders. */
  url: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** Dot path to the array of offers inside the response, e.g. "data.tiles". */
  itemsPath: string;
  /** Dot paths inside one item. */
  map: {
    productName: string;
    unit?: string;
    category?: string;
    originalPrice: string;
    discountPrice: string;
    validFrom?: string;
    validTo?: string;
    storeExternalId?: string;
    sourceUrl?: string;
  };
  /** Set to 100 when the endpoint returns cents. */
  priceDivisor?: number;
  pagination?: {
    pageParam?: string;
    startPage?: number;
    maxPages: number;
    pageSize?: number;
  };
  /** Used when the feed has no end date. */
  defaultValidDays?: number;
  /** Politeness delay between pages. */
  requestDelayMs?: number;
}

/** `a.b[0].c` → value, or undefined. */
export const getPath = (input: unknown, path: string): unknown =>
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((value, key) => {
      if (value === null || value === undefined) return undefined;
      return (value as Record<string, unknown>)[key];
    }, input);

const asNumber = (value: unknown, divisor: number): number | null => {
  if (typeof value === 'number') return value / divisor;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed / divisor : null;
  }
  return null;
};

const asIsoDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};

export const createHttpJsonOfferSource = (config: HttpJsonOfferConfig): OfferSource => ({
  id: config.id,
  label: config.label ?? `${config.retailerId} (${new URL(config.url).host})`,

  fetchOffers: async (ctx: SourceContext): Promise<RawOffer[]> => {
    const divisor = config.priceDivisor ?? 1;
    const pages = config.pagination?.maxPages ?? 1;
    const startPage = config.pagination?.startPage ?? 0;
    const offers: RawOffer[] = [];

    for (let page = startPage; page < startPage + pages; page++) {
      const url = config.url
        .replace('{page}', String(page))
        .replace('{pageSize}', String(config.pagination?.pageSize ?? 100));

      ctx.log(`${config.id}: fetching ${url}`);
      const payload = await fetchJson<unknown>(url, {
        method: config.method ?? 'GET',
        body: config.body,
        headers: { accept: 'application/json', ...config.headers },
      });

      const items = getPath(payload, config.itemsPath);
      if (!Array.isArray(items)) {
        warn(`${config.id}: "${config.itemsPath}" is not a list — stopping this source`);
        break;
      }
      if (items.length === 0) break;

      items.forEach((item) => {
        const productName = getPath(item, config.map.productName);
        const originalPrice = asNumber(getPath(item, config.map.originalPrice), divisor);
        const discountPrice = asNumber(getPath(item, config.map.discountPrice), divisor);
        if (typeof productName !== 'string' || originalPrice === null || discountPrice === null) {
          return;
        }

        offers.push({
          retailerId: config.retailerId,
          productName,
          unit: config.map.unit ? String(getPath(item, config.map.unit) ?? '') : undefined,
          category: config.map.category
            ? String(getPath(item, config.map.category) ?? '')
            : undefined,
          originalPrice,
          discountPrice,
          validFrom: config.map.validFrom ? asIsoDate(getPath(item, config.map.validFrom)) : undefined,
          validTo: config.map.validTo ? asIsoDate(getPath(item, config.map.validTo)) : undefined,
          storeExternalId: config.map.storeExternalId
            ? String(getPath(item, config.map.storeExternalId) ?? '') || undefined
            : undefined,
          sourceUrl: config.map.sourceUrl
            ? String(getPath(item, config.map.sourceUrl) ?? '') || undefined
            : undefined,
        });
      });

      if (ctx.limit && offers.length >= ctx.limit) break;
      if (config.requestDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, config.requestDelayMs));
      }
    }

    return ctx.limit ? offers.slice(0, ctx.limit) : offers;
  },
});
