#!/usr/bin/env tsx
/**
 * Guards the chain logos in `assets/logos/`.
 *
 *   npm run logos:check    verify the files
 *   npm run logos:lock     record the current files as the ones to keep
 *
 * The logo files are **user assets**: once real artwork has been dropped in and
 * locked, nothing in this repository may replace it — least of all the
 * placeholders that ship with the project. `logos:lock` writes the checksums of
 * the current files to `assets/logos/expected.sha256.json`; from then on
 * `logos:check` fails if any of them changed, and says so explicitly when a file
 * has been reverted to a shipped placeholder.
 *
 * Before the lock exists the check only reports (so a fresh clone with the
 * placeholders is not a failure) — but a missing file, or a file the app no
 * longer references, always fails.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { fail, log, warn } from './log';

const LOGO_DIR = 'assets/logos';
const PLACEHOLDER_FILE = `${LOGO_DIR}/placeholders.sha256.json`;
const LOCK_FILE = `${LOGO_DIR}/expected.sha256.json`;
const LOGO_MODULE = 'src/assets/retailerLogos.ts';

/** Fixed by invariant: these names are what the app requires. */
export const LOGO_FILES = [
  'spar.png',
  'billa.png',
  'billaplus.png',
  'hofer.png',
  'lidl.png',
  'penny.png',
] as const;

interface PngInfo {
  width: number;
  height: number;
  /** PNG colour type: 6 = RGBA, 4 = grey+alpha. */
  colorType: number;
}

const readPngInfo = (buffer: Buffer): PngInfo | null => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(signature)) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
};

const sha256 = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
};

const run = async (): Promise<void> => {
  const lockMode = process.argv.includes('--lock');

  const placeholders = (await readJson<Record<string, string>>(PLACEHOLDER_FILE)) ?? {};
  const lock = await readJson<Record<string, string>>(LOCK_FILE);
  const logoModule = (await readFile(LOGO_MODULE, 'utf8').catch(() => '')) as string;

  const hashes: Record<string, string> = {};
  const failures: string[] = [];
  let placeholderCount = 0;

  for (const file of LOGO_FILES) {
    let buffer: Buffer;
    try {
      buffer = await readFile(`${LOGO_DIR}/${file}`);
    } catch {
      failures.push(`${file} is missing — the app needs exactly these six files`);
      continue;
    }

    const hash = sha256(buffer);
    hashes[file] = hash;

    const isPlaceholder = placeholders[file] === hash;
    if (isPlaceholder) placeholderCount += 1;

    // the app must still load this exact file
    if (!logoModule.includes(`logos/${file}`)) {
      failures.push(`${file} is no longer referenced in ${LOGO_MODULE}`);
    }

    const info = readPngInfo(buffer);
    const notes: string[] = [];
    if (!info) notes.push('not a PNG file');
    else {
      notes.push(`${info.width}x${info.height}`);
      if (info.width < 120 || info.height < 120) notes.push('smaller than the recommended 240 px');
      if (Math.abs(info.width - info.height) > info.width * 0.15) notes.push('not square');
      if (info.colorType !== 6 && info.colorType !== 4) notes.push('no transparency');
    }

    if (lock && !lockMode) {
      const expected = lock[file];
      if (expected && expected !== hash) {
        failures.push(
          isPlaceholder
            ? `${file} was REPLACED BY THE SHIPPED PLACEHOLDER — restore your own artwork ` +
              `(it is a user asset and must never be overwritten)`
            : `${file} changed since it was locked — run "npm run logos:lock" if that was intended`,
        );
        continue;
      }
      if (!expected) {
        failures.push(`${file} is not in ${LOCK_FILE} — run "npm run logos:lock"`);
        continue;
      }
      log(`${file.padEnd(16)} locked, unchanged   ${notes.join(', ')}`);
      continue;
    }

    log(`${file.padEnd(16)} ${(isPlaceholder ? 'PLACEHOLDER' : 'custom').padEnd(12)} ${notes.join(', ')}`);
  }

  if (lockMode) {
    if (failures.length > 0) {
      failures.forEach(fail);
      throw new Error('refusing to lock while the files are not in order');
    }
    await writeFile(LOCK_FILE, `${JSON.stringify(hashes, null, 2)}\n`, 'utf8');
    log(`locked ${Object.keys(hashes).length} logo files in ${LOCK_FILE}`);
    if (placeholderCount > 0) {
      warn(
        `${placeholderCount} of the locked files are still the shipped placeholders — ` +
          `lock again after dropping in the real artwork`,
      );
    }
    return;
  }

  if (failures.length > 0) {
    failures.forEach(fail);
    throw new Error(`${failures.length} logo problem(s) — see above`);
  }

  if (!lock) {
    log('');
    log(
      `No lock file yet. After putting the real artwork into ${LOGO_DIR}/, run ` +
        `"npm run logos:lock" — from then on this check fails if anything replaces it.`,
    );
    if (placeholderCount > 0) {
      log(`${placeholderCount} of ${LOGO_FILES.length} files are still the shipped placeholders.`);
    }
  } else {
    log('');
    log('All logo files match the lock — your artwork is untouched.');
  }
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
