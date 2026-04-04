import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DIMENSIONS, type Dimension } from './schemas.js';

// ---------------------------------------------------------------------------
// Re-export dimension abbreviations so consumers don't need schemas directly
// ---------------------------------------------------------------------------

/** All 11 review dimension abbreviations (re-exported from schemas). */
export const DIMENSION_ABBREV = DIMENSIONS;

// ---------------------------------------------------------------------------
// Counter persistence (.reviews/.counter)
// ---------------------------------------------------------------------------

/**
 * Reads the current counter value from reviewsDir/.counter.
 * Returns 0 if the file doesn't exist (first run).
 */
async function readCounter(reviewsDir: string): Promise<number> {
  const counterPath = join(reviewsDir, '.counter');
  try {
    const raw = await readFile(counterPath, 'utf-8');
    return parseInt(raw.trim(), 10) || 0;
  } catch {
    // File doesn't exist yet — start from 0
    return 0;
  }
}

/**
 * Writes the counter value to reviewsDir/.counter.
 * Creates the directory if it doesn't exist (handles the case where
 * .reviews/ exists but .counter has never been written).
 */
async function writeCounter(reviewsDir: string, value: number): Promise<void> {
  await mkdir(reviewsDir, { recursive: true });
  await writeFile(join(reviewsDir, '.counter'), String(value), 'utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates the next finding ID in the format `{DIM}-{NNNNN}`.
 *
 * The global counter persists in `reviewsDir/.counter` across calls.
 * Each invocation increments the counter by 1 and writes it back.
 *
 * Examples:
 *   nextFindingId('SEC', '/path/to/.reviews') → 'SEC-00001'
 *   nextFindingId('BUG', '/path/to/.reviews') → 'BUG-00002'
 *
 * NOTE: This function is intentionally NOT concurrent-safe.
 * The rms orchestrator runs in a single-threaded Node.js process and
 * assigns finding IDs sequentially — no concurrent access is expected.
 */
export async function nextFindingId(
  dimension: Dimension,
  reviewsDir: string,
): Promise<string> {
  const current = await readCounter(reviewsDir);
  const next = current + 1;
  await writeCounter(reviewsDir, next);
  return `${dimension}-${String(next).padStart(5, '0')}`;
}
