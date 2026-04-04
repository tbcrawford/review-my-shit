import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Represents a review session's identifying metadata.
 */
export interface SessionInfo {
  /** Absolute path to the session directory inside .reviews/ */
  sessionDir: string;
  /** The folder name: YYYY-MM-DD-<slug> */
  reviewId: string;
  /** Sanitized slug derived from the input */
  slug: string;
  /** ISO 8601 timestamp when the session was created */
  timestamp: string;
}

/**
 * Sanitizes an arbitrary string into a valid slug.
 * Lowercases, replaces non-alphanumeric chars with hyphens, collapses runs, trims edges.
 */
function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensures the .reviews/ directory exists inside projectRoot.
 * Also ensures .reviews/ is listed in .gitignore (creates .gitignore if absent).
 * Safe to call multiple times — fully idempotent.
 */
export async function ensureReviewsDir(projectRoot: string): Promise<void> {
  const reviewsDir = join(projectRoot, '.reviews');

  // Create .reviews/ if it doesn't exist
  await mkdir(reviewsDir, { recursive: true });

  // Ensure .reviews/ is in .gitignore
  const gitignorePath = join(projectRoot, '.gitignore');
  let gitignoreContents = '';

  try {
    gitignoreContents = await readFile(gitignorePath, 'utf8');
  } catch {
    // File doesn't exist — will be created below
  }

  // Check if .reviews/ is already present (match .reviews/ or .reviews as a standalone entry)
  const alreadyIgnored = /^\.reviews\/?\s*$/m.test(gitignoreContents);

  if (!alreadyIgnored) {
    // Append with proper newline handling
    const separator = gitignoreContents.length > 0 && !gitignoreContents.endsWith('\n') ? '\n' : '';
    await writeFile(gitignorePath, `${gitignoreContents}${separator}.reviews/\n`);
  }
}

/**
 * Creates a new review session directory at .reviews/YYYY-MM-DD-<slug>/.
 * Calls ensureReviewsDir first, so .reviews/ setup is always guaranteed.
 */
export async function createSession(
  projectRoot: string,
  slug: string,
): Promise<SessionInfo> {
  await ensureReviewsDir(projectRoot);

  const sanitized = sanitizeSlug(slug);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  const reviewId = `${date}-${sanitized}`;
  const sessionDir = join(projectRoot, '.reviews', reviewId);

  await mkdir(sessionDir, { recursive: true });

  const timestamp = new Date().toISOString();

  return {
    sessionDir,
    reviewId,
    slug: sanitized,
    timestamp,
  };
}
