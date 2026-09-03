#!/usr/bin/env tsx
/**
 * Entry point of the data pipeline.
 *
 *   npm run data:refresh              # branches + offers, writes data/snapshot.json
 *   npm run data:refresh -- --dry-run # run everything, write nothing
 *   npm run data:refresh -- --skip-stores
 *   npm run data:refresh -- --update-seed   # also refresh the bundled fallback
 *   npm run data:refresh -- --allow-store-drop  # accept a much smaller branch list
 *
 * Exits non-zero when no usable snapshot could be produced, which is what stops
 * the daily workflow from publishing a broken file.
 */
import { build } from './build';
import { fail } from './log';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

build({
  configPath: value('--config') ?? 'sources.config.json',
  dryRun: has('--dry-run'),
  skipStores: has('--skip-stores'),
  updateSeed: has('--update-seed'),
  allowStoreDrop: has('--allow-store-drop'),
  limit: value('--limit') ? Number(value('--limit')) : undefined,
})
  .then(() => process.exit(0))
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
