import type { Retailer, Store } from '../types';

export interface MappedStore {
  store: Store;
  retailer: Retailer;
  offerCount: number;
}

export interface StoreMapProps {
  items: MappedStore[];
  selectedStoreId?: string | null;
  onSelectStore: (storeId: string) => void;
}

/** Vienna, roughly centred on Stephansplatz. */
export const VIENNA_REGION = {
  latitude: 48.2082,
  longitude: 16.3738,
  latitudeDelta: 0.11,
  longitudeDelta: 0.13,
};
