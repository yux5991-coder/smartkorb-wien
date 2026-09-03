/**
 * Whether the snapshot cached on the device may still be used.
 *
 * The cache used to win unconditionally, which meant that once a device had
 * downloaded any snapshot, a new app build kept showing the old catalogue —
 * old dish names, old prices, old translations — no matter how often the app
 * was restarted. The cache is only newer *data*, never newer *code*, so it has
 * to be checked against what the build ships.
 *
 * Pure module: no data and no React Native imports, so it can be unit tested.
 */
export interface CacheStamp {
  /** Bumped when the shape of the catalogue changes. */
  schemaVersion: number;
  /** Fingerprint of the catalogue bundled with the build that wrote the cache. */
  bundledFingerprint: string;
  /** `generatedAt` of the cached catalogue. */
  generatedAt: string;
}

export interface CacheDecision {
  useCache: boolean;
  /** Why the cache was dropped — logged, and handy in tests. */
  reason: 'ok' | 'schema-changed' | 'build-has-newer-data' | 'older-than-bundled' | 'unreadable';
}

export const evaluateCache = (
  cached: Partial<CacheStamp> | null,
  current: CacheStamp,
): CacheDecision => {
  if (!cached || typeof cached.generatedAt !== 'string') {
    return { useCache: false, reason: 'unreadable' };
  }
  if (cached.schemaVersion !== current.schemaVersion) {
    return { useCache: false, reason: 'schema-changed' };
  }
  // The app bundle carries different catalogue content than when the cache was
  // written — the build is then the newer source of truth.
  if (cached.bundledFingerprint !== current.bundledFingerprint) {
    return { useCache: false, reason: 'build-has-newer-data' };
  }
  if (cached.generatedAt < current.generatedAt) {
    return { useCache: false, reason: 'older-than-bundled' };
  }
  return { useCache: true, reason: 'ok' };
};

/** Cheap, stable fingerprint over the parts of the catalogue users actually see. */
export const fingerprint = (parts: string[]): string => {
  let hash = 0x811c9dc5;
  const joined = parts.join('');
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};
