/** Raw branch records → the `Store` shape the app renders. */
import type { Store } from '../../../src/types';
import type { RawStore } from '../types';

/** Vienna postcode → district name. 1xx0 where xx is the district number. */
export const districtFromPostcode = (postcode?: string): string | null => {
  if (!postcode || !/^1\d{3}$/.test(postcode)) return null;
  const districtNumber = Number(postcode.slice(1, 3));
  return VIENNA_DISTRICTS[districtNumber] ?? null;
};

const VIENNA_DISTRICTS: Record<number, string> = {
  1: 'Innere Stadt',
  2: 'Leopoldstadt',
  3: 'Landstraße',
  4: 'Wieden',
  5: 'Margareten',
  6: 'Mariahilf',
  7: 'Neubau',
  8: 'Josefstadt',
  9: 'Alsergrund',
  10: 'Favoriten',
  11: 'Simmering',
  12: 'Meidling',
  13: 'Hietzing',
  14: 'Penzing',
  15: 'Rudolfsheim-Fünfhaus',
  16: 'Ottakring',
  17: 'Hernals',
  18: 'Währing',
  19: 'Döbling',
  20: 'Brigittenau',
  21: 'Floridsdorf',
  22: 'Donaustadt',
  23: 'Liesing',
};

/** Nearest district by postcode, else by the district centroid closest to the branch. */
const districtFromCoordinates = (lat: number, lng: number): string => {
  let best = 'Wien';
  let bestDistance = Number.POSITIVE_INFINITY;
  DISTRICT_CENTROIDS.forEach(([name, dLat, dLng]) => {
    const distance = Math.hypot(lat - dLat, lng - dLng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  });
  return best;
};

/** Rough centroids, only used when a branch has no postcode in OSM. */
const DISTRICT_CENTROIDS: [string, number, number][] = [
  ['Innere Stadt', 48.2082, 16.3738],
  ['Leopoldstadt', 48.2176, 16.4008],
  ['Landstraße', 48.1975, 16.3944],
  ['Wieden', 48.1926, 16.3684],
  ['Margareten', 48.1868, 16.3579],
  ['Mariahilf', 48.1955, 16.3477],
  ['Neubau', 48.2027, 16.3455],
  ['Josefstadt', 48.2112, 16.3459],
  ['Alsergrund', 48.2251, 16.3583],
  ['Favoriten', 48.1633, 16.3819],
  ['Simmering', 48.1665, 16.4368],
  ['Meidling', 48.1739, 16.3313],
  ['Hietzing', 48.1707, 16.2523],
  ['Penzing', 48.2117, 16.2570],
  ['Rudolfsheim-Fünfhaus', 48.1929, 16.3292],
  ['Ottakring', 48.2166, 16.3068],
  ['Hernals', 48.2333, 16.2926],
  ['Währing', 48.2333, 16.3268],
  ['Döbling', 48.2510, 16.3357],
  ['Brigittenau', 48.2418, 16.3782],
  ['Floridsdorf', 48.2711, 16.3960],
  ['Donaustadt', 48.2333, 16.4700],
  ['Liesing', 48.1400, 16.2900],
];

export const normalizeStores = (
  raw: RawStore[],
  retailerNames: Map<string, string>,
): Store[] => {
  const seen = new Set<string>();
  const stores: Store[] = [];

  raw.forEach((entry) => {
    const retailerName = retailerNames.get(entry.retailerId);
    if (!retailerName) return;

    // OSM often carries the same shop as a node and as a building outline
    const dedupeKey = `${entry.retailerId}|${entry.lat.toFixed(4)}|${entry.lng.toFixed(4)}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const district =
      districtFromPostcode(entry.postcode) ?? districtFromCoordinates(entry.lat, entry.lng);

    const streetLine = [entry.street, entry.houseNumber].filter(Boolean).join(' ');
    const address =
      [streetLine, [entry.postcode, entry.city ?? 'Wien'].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ') || `${district}, Wien`;

    stores.push({
      id: entry.externalId,
      retailerId: entry.retailerId,
      name: entry.name?.trim() || `${retailerName} ${streetLine || district}`.trim(),
      address,
      district,
      lat: entry.lat,
      lng: entry.lng,
      openingHours: entry.openingHours?.trim() || 'Öffnungszeiten laut Aushang',
    });
  });

  return stores.sort((a, b) => a.district.localeCompare(b.district, 'de'));
};
