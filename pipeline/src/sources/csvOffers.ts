/**
 * Offers from a CSV file.
 *
 * This is the path for data we are allowed to use without scraping: a partner
 * feed exported by a chain, a spreadsheet maintained by hand, or a one-off
 * export from an aggregator we have an agreement with. It is also the fastest
 * way to test the pipeline with real numbers.
 *
 * Expected header (order does not matter):
 *   retailerId,productName,unit,category,originalPrice,discountPrice,validFrom,validTo,storeExternalId,condition,sourceUrl
 */
import { readFile } from 'node:fs/promises';

import type { OfferSource, RawOffer, SourceContext } from '../types';
import { warn } from '../log';

/**
 * Minimal RFC4180-ish parser: quoted fields, doubled quotes, and a delimiter
 * detected from the header line (Austrian exports often use ";" because commas
 * appear inside product names and prices).
 */
export const parseCsv = (input: string): Record<string, string>[] => {
  const headerLine = input.split('\n', 1)[0] ?? '';
  const delimiter =
    (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((entry) => entry.some((value) => value.trim() !== ''));
  if (!header) return [];

  const keys = header.map((key) => key.trim());
  return body.map((values) =>
    Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])),
  );
};

const toNumber = (value: string): number => Number(value.replace(',', '.'));

export const createCsvOfferSource = (id: string, file: string): OfferSource => ({
  id,
  label: `CSV-Feed (${file})`,

  fetchOffers: async (ctx: SourceContext): Promise<RawOffer[]> => {
    ctx.log(`reading offers from ${file}`);

    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // the feed is configured but the partner has not delivered yet —
        // that is a normal state, not a broken run
        ctx.log(`${file} not present yet — skipping this source`);
        return [];
      }
      throw error;
    }

    const rows = parseCsv(content);

    const offers: RawOffer[] = [];
    rows.forEach((row, lineIndex) => {
      const originalPrice = toNumber(row.originalPrice ?? '');
      const discountPrice = toNumber(row.discountPrice ?? '');
      if (!row.retailerId || !row.productName || !Number.isFinite(originalPrice) || !Number.isFinite(discountPrice)) {
        warn(`${file}: skipping unusable row ${lineIndex + 2}`);
        return;
      }
      offers.push({
        retailerId: row.retailerId,
        storeExternalId: row.storeExternalId || undefined,
        productName: row.productName,
        unit: row.unit || undefined,
        category: row.category || undefined,
        originalPrice,
        discountPrice,
        validFrom: row.validFrom || undefined,
        validTo: row.validTo || undefined,
        condition: row.condition || undefined,
        sourceUrl: row.sourceUrl || undefined,
      });
    });

    return ctx.limit ? offers.slice(0, ctx.limit) : offers;
  },
});
