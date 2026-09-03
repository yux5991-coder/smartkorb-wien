/**
 * Shapes used inside the data pipeline, before anything becomes app data.
 *
 * A source adapter only has to produce `RawOffer` / `RawStore`; matching them
 * onto the product catalogue, filling in the missing fields and validating the
 * result is the job of `normalize/` and `validateCatalog`.
 */
import type { ProductCategory, RetailerId } from '../../src/types';

export interface RawStore {
  /** Stable id from the source, e.g. the OSM element id. */
  externalId: string;
  retailerId: RetailerId;
  name?: string;
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  lat: number;
  lng: number;
  openingHours?: string;
}

export interface RawOffer {
  retailerId: RetailerId;
  /**
   * Branch the offer belongs to, as the source identifies it. `undefined` means
   * chain-wide, which is how Austrian weekly flyers usually work.
   */
  storeExternalId?: string;
  productName: string;
  /** Pack size as printed, e.g. "500 g", "1,5 l", "6 Stk". */
  unit?: string;
  category?: ProductCategory | string;
  originalPrice: number;
  discountPrice: number;
  /** ISO date; defaults to today when the source does not say. */
  validFrom?: string;
  /** ISO date; defaults to the end of the week when the source does not say. */
  validTo?: string;
  sourceUrl?: string;
}

export interface SourceContext {
  /** Where the pipeline may write intermediate files. */
  cacheDir: string;
  log: (message: string) => void;
  /** Only fetch this many items per source — used by `--limit` for dry runs. */
  limit?: number;
}

export interface OfferSource {
  id: string;
  label: string;
  fetchOffers: (ctx: SourceContext) => Promise<RawOffer[]>;
}

export interface StoreSource {
  id: string;
  label: string;
  fetchStores: (ctx: SourceContext) => Promise<RawStore[]>;
}
