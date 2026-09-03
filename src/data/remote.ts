/**
 * Downloading and caching the daily snapshot.
 *
 * Flow: bundled seed → cached snapshot (AsyncStorage) → freshly downloaded
 * snapshot. Every step is validated, and a step that fails leaves the previous
 * data in place instead of emptying the app.
 *
 * The snapshot is produced by `pipeline/` and published by CI; the app only
 * ever reads it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SNAPSHOT_CACHE_KEY, SNAPSHOT_TIMEOUT_MS, SNAPSHOT_URL } from '../config';
import type { Catalog } from '../types';
import { bundledRecipes } from './bundled';
import { validateCatalog } from './validateCatalog';

interface CachedSnapshot {
  fetchedAt: string;
  catalog: Catalog;
}

const validate = (raw: unknown): Catalog =>
  validateCatalog(raw, { fallbackRecipes: bundledRecipes, minDiscounts: 1 }).catalog;

/** Reads the last downloaded snapshot; returns null when there is none or it is unusable. */
export const readCachedCatalog = async (): Promise<{ catalog: Catalog; fetchedAt: string } | null> => {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CachedSnapshot;
    return { catalog: validate(parsed.catalog), fetchedAt: parsed.fetchedAt };
  } catch (error) {
    console.warn('[SmartKorb] cached snapshot unusable, falling back to the bundle:', error);
    await AsyncStorage.removeItem(SNAPSHOT_CACHE_KEY).catch(() => undefined);
    return null;
  }
};

const writeCache = async (catalog: Catalog): Promise<string> => {
  const fetchedAt = new Date().toISOString();
  const payload: CachedSnapshot = { fetchedAt, catalog };
  await AsyncStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(payload));
  return fetchedAt;
};

export class SnapshotUnavailableError extends Error {}

/**
 * Downloads the current snapshot, validates it and stores it in the cache.
 * Throws when there is no configured URL, the request fails or the payload does
 * not pass validation — the caller keeps showing what it already has.
 */
export const fetchRemoteCatalog = async (): Promise<{ catalog: Catalog; fetchedAt: string }> => {
  if (!SNAPSHOT_URL) {
    throw new SnapshotUnavailableError('no snapshot URL configured (expo.extra.snapshotUrl)');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);

  try {
    const response = await fetch(SNAPSHOT_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new SnapshotUnavailableError(`snapshot request failed: HTTP ${response.status}`);
    }
    const catalog = validate(await response.json());
    const fetchedAt = await writeCache(catalog);
    return { catalog, fetchedAt };
  } finally {
    clearTimeout(timeout);
  }
};

export const clearCachedCatalog = (): Promise<void> => AsyncStorage.removeItem(SNAPSHOT_CACHE_KEY);
