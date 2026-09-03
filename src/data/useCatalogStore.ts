/**
 * The catalog the UI renders, plus its refresh lifecycle.
 *
 * `bootstrap()` runs once at app start: it swaps in the cached snapshot if there
 * is one and then refreshes in the background when the data is older than
 * `REFRESH_AFTER_HOURS`. `refresh()` is also wired to pull-to-refresh in the
 * Rabatte tab and to the button in the profile.
 */
import { create } from 'zustand';

import { REFRESH_AFTER_HOURS, SNAPSHOT_URL } from '../config';
import { bundledCatalog } from './bundled';
import { indexCatalog, type CatalogIndex } from './catalog';
import { clearCachedCatalog, fetchRemoteCatalog, readCachedCatalog } from './remote';

export type SyncStatus = 'idle' | 'loading' | 'error';

/** Translation keys the status bar renders. */
export type ErrorKey = 'error.noSource' | 'error.http' | 'error.timeout' | 'error.offline';

interface CatalogState {
  index: CatalogIndex;
  status: SyncStatus;
  /** When the data currently on screen was downloaded (null for bundled data). */
  fetchedAt: string | null;
  error: ErrorKey | null;
  /** True while the very first bootstrap is running. */
  booting: boolean;
  bootstrap: () => Promise<void>;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  /** Throw away the cached snapshot and go back to what the build ships. */
  resetData: () => Promise<void>;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Technical failures are logged; the UI gets a translation key so the message
 * follows the selected language.
 */
const errorKey = (error: unknown): ErrorKey => {
  const message = error instanceof Error ? error.message : String(error);
  if (/no snapshot URL configured/i.test(message)) return 'error.noSource';
  if (/HTTP 4\d\d/.test(message)) return 'error.http';
  if (/abort/i.test(message)) return 'error.timeout';
  return 'error.offline';
};

const isStale = (fetchedAt: string | null): boolean => {
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > REFRESH_AFTER_HOURS * MS_PER_HOUR;
};

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  index: indexCatalog(bundledCatalog, 'bundled'),
  status: 'idle',
  fetchedAt: null,
  error: null,
  booting: true,

  bootstrap: async () => {
    const cached = await readCachedCatalog();
    if (cached) {
      set({
        index: indexCatalog(cached.catalog, 'cache'),
        fetchedAt: cached.fetchedAt,
        booting: false,
      });
    } else {
      set({ booting: false });
    }

    if (SNAPSHOT_URL && isStale(get().fetchedAt)) {
      await get().refresh();
    }
  },

  resetData: async () => {
    await clearCachedCatalog();
    set({
      index: indexCatalog(bundledCatalog, 'bundled'),
      fetchedAt: null,
      status: 'idle',
      error: null,
    });
    await get().refresh({ force: true });
  },

  refresh: async ({ force = false } = {}) => {
    if (!SNAPSHOT_URL) {
      set({ status: 'error', error: 'error.noSource' });
      return;
    }
    if (get().status === 'loading') return;
    if (!force && !isStale(get().fetchedAt)) return;

    set({ status: 'loading', error: null });
    try {
      const { catalog, fetchedAt } = await fetchRemoteCatalog();
      set({
        index: indexCatalog(catalog, 'remote'),
        fetchedAt,
        status: 'idle',
        error: null,
      });
    } catch (error) {
      // keep whatever is on screen — stale data beats an empty app
      console.warn('[SmartKorb] snapshot refresh failed:', error);
      set({ status: 'error', error: errorKey(error) });
    }
  },
}));

/** Convenience hook for the screens. */
export const useCatalog = (): CatalogIndex => useCatalogStore((state) => state.index);
