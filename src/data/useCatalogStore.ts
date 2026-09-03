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
import { fetchRemoteCatalog, readCachedCatalog } from './remote';

export type SyncStatus = 'idle' | 'loading' | 'error';

interface CatalogState {
  index: CatalogIndex;
  status: SyncStatus;
  /** When the data currently on screen was downloaded (null for bundled data). */
  fetchedAt: string | null;
  error: string | null;
  /** True while the very first bootstrap is running. */
  booting: boolean;
  bootstrap: () => Promise<void>;
  refresh: (options?: { force?: boolean }) => Promise<void>;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/** Technical failures are logged; the user gets a sentence they can act on. */
const friendlyError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/no snapshot URL configured/i.test(message)) {
    return 'Keine Datenquelle konfiguriert — es werden die mitgelieferten Demodaten angezeigt.';
  }
  if (/HTTP 4\d\d/.test(message)) {
    return 'Die Aktionsdaten sind derzeit nicht abrufbar. Angezeigt werden die zuletzt geladenen Daten.';
  }
  if (/abort/i.test(message)) {
    return 'Zeitüberschreitung beim Laden der Aktionen — bitte später erneut versuchen.';
  }
  return 'Keine Verbindung zu den Aktionsdaten. Angezeigt werden die zuletzt geladenen Daten.';
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

  refresh: async ({ force = false } = {}) => {
    if (!SNAPSHOT_URL) {
      set({
        status: 'error',
        error: 'Keine Datenquelle konfiguriert — die App zeigt die mitgelieferten Demodaten.',
      });
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
      set({ status: 'error', error: friendlyError(error) });
    }
  },
}));

/** Convenience hook for the screens. */
export const useCatalog = (): CatalogIndex => useCatalogStore((state) => state.index);
