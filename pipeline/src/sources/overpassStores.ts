/**
 * Every supermarket branch in Vienna, from OpenStreetMap via the Overpass API.
 *
 * OSM data is licensed under the ODbL: the app has to credit
 * "© OpenStreetMap contributors" (it does, in the profile tab) and derived data
 * that is published must stay under the same licence.
 *
 * Overpass is a shared free service — one query per run is fine, hammering it is
 * not. The daily workflow runs this once.
 */
import type { RawStore, SourceContext, StoreSource } from '../types';
import { fetchText } from '../http';
import { warn } from '../log';

export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Brand → our retailer id. Order matters: the more specific name wins, so
 * "BILLA PLUS" must be tested before "BILLA".
 */
const BRAND_RULES: { match: RegExp; retailerId: string }[] = [
  { match: /billa\s*plus|merkur/i, retailerId: 'billaplus' },
  { match: /billa/i, retailerId: 'billa' },
  { match: /interspar|eurospar|spar\s*gourmet|maximarkt|\bspar\b/i, retailerId: 'spar' },
  { match: /hofer|\baldi\b/i, retailerId: 'hofer' },
  { match: /\blidl\b/i, retailerId: 'lidl' },
  { match: /\bpenny\b/i, retailerId: 'penny' },
];

export const matchRetailer = (...candidates: (string | undefined)[]): string | null => {
  for (const rule of BRAND_RULES) {
    if (candidates.some((value) => value && rule.match.test(value))) return rule.retailerId;
  }
  return null;
};

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * All shops of the relevant kinds inside the Vienna city boundary
 * (admin_level 4 = Bundesland, which for Vienna is the city itself).
 */
export const buildQuery = (city = 'Wien'): string => `
[out:json][timeout:180];
area["boundary"="administrative"]["admin_level"="4"]["name"="${city}"]->.city;
(
  nwr["shop"="supermarket"](area.city);
  nwr["shop"="convenience"]["brand"](area.city);
);
out center tags;
`;

export const createOverpassStoreSource = (
  overpassUrl = DEFAULT_OVERPASS_URL,
  city = 'Wien',
): StoreSource => ({
  id: 'overpass',
  label: `OpenStreetMap (Overpass, ${city})`,

  fetchStores: async (ctx: SourceContext): Promise<RawStore[]> => {
    const query = buildQuery(city);
    ctx.log(`querying Overpass for supermarkets in ${city} …`);

    const body = await fetchText(overpassUrl, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    const response = JSON.parse(body) as OverpassResponse;
    ctx.log(`Overpass returned ${response.elements.length} elements`);

    const stores: RawStore[] = [];
    response.elements.forEach((element) => {
      const tags = element.tags ?? {};
      const retailerId = matchRetailer(tags.brand, tags.name, tags.operator);
      if (!retailerId) return;

      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      stores.push({
        externalId: `osm-${element.type}-${element.id}`,
        retailerId,
        name: tags.name,
        street: tags['addr:street'],
        houseNumber: tags['addr:housenumber'],
        postcode: tags['addr:postcode'],
        city: tags['addr:city'] ?? city,
        lat,
        lng,
        openingHours: tags.opening_hours,
      });
    });

    if (stores.length === 0) {
      warn('Overpass returned no matching branches — keeping the previous store list');
    }
    return ctx.limit ? stores.slice(0, ctx.limit) : stores;
  },
});
