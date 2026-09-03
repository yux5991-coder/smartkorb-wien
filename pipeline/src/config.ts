import { readFile } from 'node:fs/promises';

import type { HttpJsonOfferConfig } from './sources/httpJsonOffers';

export interface CsvOfferConfig {
  id: string;
  type: 'csv';
  enabled: boolean;
  label?: string;
  file: string;
}

export interface MockOfferConfig {
  id: string;
  type: 'mock';
  enabled: boolean;
  label?: string;
}

export type OfferSourceConfig = HttpJsonOfferConfig | CsvOfferConfig | MockOfferConfig;

export interface PipelineConfig {
  city: string;
  stores: {
    enabled: boolean;
    overpassUrl?: string;
  };
  offers: OfferSourceConfig[];
  /** A snapshot with fewer offers than this is rejected instead of published. */
  minDiscounts: number;
  output: {
    /** Snapshot the app downloads. */
    snapshot: string;
    /** Bundled fallback branch list, only rewritten with `--update-seed`. */
    seedStores: string;
  };
}

const DEFAULTS: PipelineConfig = {
  city: 'Wien',
  stores: { enabled: true },
  offers: [{ id: 'mock', type: 'mock', enabled: true }],
  minDiscounts: 20,
  output: {
    snapshot: 'data/snapshot.json',
    seedStores: 'src/data/stores.json',
  },
};

export const loadConfig = async (path: string): Promise<PipelineConfig> => {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<PipelineConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      stores: { ...DEFAULTS.stores, ...parsed.stores },
      output: { ...DEFAULTS.output, ...parsed.output },
      offers: parsed.offers ?? DEFAULTS.offers,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULTS;
    throw error;
  }
};
