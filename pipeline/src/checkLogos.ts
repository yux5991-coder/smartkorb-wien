#!/usr/bin/env tsx
/**
 * Tells you which chain logos are still the shipped placeholders.
 *
 *   npm run logos:check
 *
 * The app renders whatever PNG sits in `assets/logos/<retailerId>.png`. This
 * script compares each file against the checksum of the placeholder that ships
 * with the repository, so after dropping in the official artwork you can see at
 * a glance that it really was picked up — and it checks the format while it is
 * at it (PNG, square-ish, transparent background, large enough).
 */
import { readFile } from 'node:fs/promises';

import type { Retailer } from '../../src/types';
import { fail, log, warn } from './log';

const LOGO_DIR = 'assets/logos';

interface PngInfo {
  width: number;
  height: number;
  /** PNG colour type: 6 = RGBA, 4 = grey+alpha, 3 = palette, 2 = RGB, 0 = grey. */
  colorType: number;
}

const readPngInfo = (buffer: Buffer): PngInfo | null => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(signature)) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
};

const sha256 = async (buffer: Buffer): Promise<string> => {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buffer).digest('hex');
};

const run = async (): Promise<void> => {
  const retailers = JSON.parse(await readFile('src/data/retailers.json', 'utf8')) as Retailer[];
  const placeholders = JSON.parse(
    await readFile(`${LOGO_DIR}/placeholders.sha256.json`, 'utf8'),
  ) as Record<string, string>;

  let placeholderCount = 0;
  let problems = 0;

  for (const retailer of retailers) {
    const file = `${retailer.id}.png`;
    let buffer: Buffer;
    try {
      buffer = await readFile(`${LOGO_DIR}/${file}`);
    } catch {
      warn(`${file.padEnd(18)} MISSING — the app falls back to the initials badge`);
      problems += 1;
      continue;
    }

    const info = readPngInfo(buffer);
    const isPlaceholder = (await sha256(buffer)) === placeholders[file];
    if (isPlaceholder) placeholderCount += 1;

    const notes: string[] = [];
    if (!info) notes.push('not a PNG file');
    else {
      notes.push(`${info.width}x${info.height}`);
      if (info.width < 120 || info.height < 120) notes.push('too small (want ~240 px)');
      if (Math.abs(info.width - info.height) > info.width * 0.15) notes.push('not square');
      if (info.colorType !== 6 && info.colorType !== 4) notes.push('no transparency');
    }

    const status = isPlaceholder ? 'PLACEHOLDER' : 'custom';
    log(`${file.padEnd(18)} ${status.padEnd(12)} ${notes.join(', ')}`);
    if (!info || notes.length > 1) problems += 1;
  }

  log('');
  if (placeholderCount === 0) {
    log('All chain logos have been replaced with your own artwork.');
  } else {
    log(
      `${placeholderCount} of ${retailers.length} logos are still the shipped placeholder. ` +
        `Drop the official PNG into ${LOGO_DIR}/<retailerId>.png (same file name) and run this again.`,
    );
    log('After replacing files restart Metro with a clean cache: npx expo start -c');
  }
  if (problems > 0) {
    warn(`${problems} file(s) need attention (see above)`);
    process.exitCode = 1;
  }
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
