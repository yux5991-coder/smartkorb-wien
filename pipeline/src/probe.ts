#!/usr/bin/env tsx
/**
 * Inspects a candidate offer endpoint and proposes an adapter configuration.
 *
 *   npm run data:probe -- --url "https://…/offers?page=0"
 *   npm run data:probe                 # uses probe.targets.json
 *
 * It fetches the URL, finds the array of offers inside the response, guesses
 * which fields hold the product name, the prices and the validity dates, and
 * prints a `sources.config.json` snippet. The raw response and the suggestion
 * are written to `.probe/` so they can be inspected (or attached to a ticket).
 *
 * This only performs plain GET requests, the same a browser would. Whether the
 * data may then be used is a question of the retailer's terms of use — see
 * README, "Real offer data".
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { fetchText } from './http';
import { fail, log, warn } from './log';

interface ProbeTarget {
  id: string;
  retailerId: string;
  url: string;
  note?: string;
}

const PRICE_KEY = /(price|preis|amount|value|betrag)/i;
const OLD_PRICE_KEY = /(old|regular|strike|streich|uvp|statt|before|reference|normal)/i;
const NEW_PRICE_KEY = /(final|sale|action|aktion|discount|promo|current|now)/i;
const NAME_KEY = /(name|title|titel|bezeichnung|produkt|description)/i;
const UNIT_KEY = /(grammage|unit|menge|inhalt|weight|gewicht|size|packung)/i;
const FROM_KEY = /(from|von|start|beginn)/i;
const TO_KEY = /(to|bis|end|ende|until)/i;
const URL_KEY = /(url|link|slug|permalink)/i;

type Path = { path: string; value: unknown };

/** Flattens an object into dot paths, arrays indexed as `[0]`. */
const flatten = (input: unknown, prefix = '', depth = 0): Path[] => {
  if (depth > 6 || input === null || typeof input !== 'object') return [{ path: prefix, value: input }];
  if (Array.isArray(input)) {
    return input.length > 0 ? flatten(input[0], `${prefix}[0]`, depth + 1) : [];
  }
  return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key, depth + 1),
  );
};

/** Finds the most offer-like array in the payload. */
export const findItemsPath = (input: unknown): { path: string; items: unknown[] } | null => {
  interface Candidate {
    path: string;
    items: unknown[];
    score: number;
  }
  let best: Candidate | null = null;

  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > 6 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      const objects = value.filter((item) => item && typeof item === 'object');
      if (objects.length > 0) {
        const keyCount = Object.keys(objects[0] as object).length;
        const score = objects.length * Math.min(keyCount, 20);
        if (!best || score > best.score) best = { path, items: objects, score };
      }
      value.slice(0, 3).forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      walk(child, path ? `${path}.${key}` : key, depth + 1),
    );
  };

  walk(input, '', 0);
  // `best` is only ever assigned inside `walk`, so the narrowing has to be restated
  const result = best as Candidate | null;
  return result ? { path: result.path, items: result.items } : null;
};

const isDateLike = (value: unknown): boolean =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /\d{4}-\d{2}|\d{2}\.\d{2}/.test(value);

export const suggestMapping = (items: unknown[]) => {
  const sample = items[0];
  const paths = flatten(sample);

  const strings = paths.filter((entry) => typeof entry.value === 'string');
  const numbers = paths.filter(
    (entry) => typeof entry.value === 'number' || (typeof entry.value === 'string' && /^\d+([.,]\d+)?$/.test(entry.value)),
  );

  const pricePaths = numbers.filter((entry) => PRICE_KEY.test(entry.path));
  const numericValue = (entry: Path): number =>
    typeof entry.value === 'number' ? entry.value : Number(String(entry.value).replace(',', '.'));

  const oldPrice =
    pricePaths.find((entry) => OLD_PRICE_KEY.test(entry.path)) ??
    pricePaths.slice().sort((a, b) => numericValue(b) - numericValue(a))[0];
  const newPrice =
    pricePaths.find((entry) => NEW_PRICE_KEY.test(entry.path)) ??
    pricePaths.filter((entry) => entry.path !== oldPrice?.path).slice().sort((a, b) => numericValue(a) - numericValue(b))[0];

  const looksLikeCents =
    oldPrice && Number.isInteger(numericValue(oldPrice)) && numericValue(oldPrice) >= 100;

  const name =
    strings.find((entry) => NAME_KEY.test(entry.path) && String(entry.value).length > 2) ?? strings[0];

  return {
    map: {
      productName: name?.path,
      unit: strings.find((entry) => UNIT_KEY.test(entry.path))?.path,
      originalPrice: oldPrice?.path,
      discountPrice: newPrice?.path,
      validFrom: paths.find((entry) => FROM_KEY.test(entry.path) && isDateLike(entry.value))?.path,
      validTo: paths.find((entry) => TO_KEY.test(entry.path) && isDateLike(entry.value))?.path,
      sourceUrl: strings.find((entry) => URL_KEY.test(entry.path))?.path,
    },
    priceDivisor: looksLikeCents ? 100 : 1,
    sampleKeys: paths.slice(0, 40).map((entry) => `${entry.path} = ${JSON.stringify(entry.value)?.slice(0, 60)}`),
  };
};

const probe = async (target: ProbeTarget): Promise<void> => {
  log(`--- ${target.id}: ${target.url}`);
  if (target.note) log(`    note: ${target.note}`);

  let body: string;
  try {
    body = await fetchText(target.url, { timeoutMs: 30_000, retries: 1 });
  } catch (error) {
    warn(`${target.id}: request failed — ${String(error)}`);
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    warn(`${target.id}: response is not JSON (${body.length} bytes) — saved for inspection`);
    await writeFile(`.probe/${target.id}.txt`, body.slice(0, 400_000), 'utf8');
    return;
  }

  await writeFile(`.probe/${target.id}.json`, JSON.stringify(payload, null, 2).slice(0, 2_000_000), 'utf8');

  const found = findItemsPath(payload);
  if (!found) {
    warn(`${target.id}: no array of objects found in the response`);
    return;
  }

  log(`    items: ${found.items.length} at "${found.path || '(root)'}"`);
  const suggestion = suggestMapping(found.items);
  suggestion.sampleKeys.slice(0, 12).forEach((line) => log(`      ${line}`));

  const config = {
    id: target.id,
    type: 'http-json',
    enabled: false,
    retailerId: target.retailerId,
    url: target.url,
    itemsPath: found.path,
    priceDivisor: suggestion.priceDivisor,
    requestDelayMs: 1500,
    map: suggestion.map,
  };

  await writeFile(`.probe/${target.id}.suggestion.json`, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  log(`    suggested config written to .probe/${target.id}.suggestion.json`);
  log(`    review it, then paste it into sources.config.json and set "enabled": true`);
};

const run = async (): Promise<void> => {
  await mkdir('.probe', { recursive: true });

  const args = process.argv.slice(2);
  const urls = args.reduce<string[]>((list, arg, index) => {
    if (arg === '--url' && args[index + 1]) list.push(args[index + 1]);
    return list;
  }, []);

  let targets: ProbeTarget[];
  if (urls.length > 0) {
    targets = urls.map((url, index) => ({
      id: `probe-${index + 1}`,
      retailerId: args[args.indexOf('--retailer') + 1] ?? 'unknown',
      url,
    }));
  } else {
    targets = JSON.parse(await readFile('probe.targets.json', 'utf8')) as ProbeTarget[];
  }

  if (targets.length === 0) throw new Error('nothing to probe');
  for (const target of targets) {
    await probe(target);
  }
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
