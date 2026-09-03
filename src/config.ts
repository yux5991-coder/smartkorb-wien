import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * `snapshotUrl` points at the JSON the data pipeline publishes once a day (see
 * `pipeline/` and `.github/workflows/daily-data-refresh.yml`). Set it in
 * `app.json` under `expo.extra.snapshotUrl` — while it still contains the
 * placeholder below the app runs purely on the bundled seed data.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const configuredUrl = typeof extra.snapshotUrl === 'string' ? extra.snapshotUrl.trim() : '';

export const SNAPSHOT_URL: string | null =
  configuredUrl && !configuredUrl.includes('<') ? configuredUrl : null;

/** How old the cached snapshot may get before the app refreshes it. */
export const REFRESH_AFTER_HOURS =
  typeof extra.refreshAfterHours === 'number' ? extra.refreshAfterHours : 6;

/** Network timeout for the snapshot download. */
export const SNAPSHOT_TIMEOUT_MS = 15000;

/** AsyncStorage key of the cached snapshot. */
export const SNAPSHOT_CACHE_KEY = 'smartkorb.catalog.v1';

/**
 * Bump when the catalogue's shape changes. A cache written under a different
 * version is discarded rather than rendered with missing fields.
 */
export const CATALOG_SCHEMA_VERSION = 2;

/** Version from app.json — shown in the profile so it is obvious which build is running. */
export const APP_VERSION =
  typeof Constants.expoConfig?.version === 'string' ? Constants.expoConfig.version : '0.0.0';

/**
 * Vienna has several hundred branches of the six chains. A catalog with fewer
 * is an incomplete branch list, not a small city — the profile says so instead
 * of quietly showing a stub.
 */
export const MIN_VIENNA_STORES = 300;
