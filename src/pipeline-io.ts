/**
 * Pipeline I/O — git diff reader, INPUT.md writer, REVIEWER.md parser, VALIDATOR.md parser.
 *
 * Provides the file-level I/O layer for the rms pipeline:
 *   1. getLocalDiff — reads both staged and unstaged git diff, runs preprocessor
 *   2. getPrDiff — fetches PR diff from GitHub REST API, runs preprocessor
 *   3. detectRepoSlug — auto-detects owner/repo from git remote origin
 *   4. writeInputFile — writes INPUT.md with XML-tagged blocks
 *   5. parseReviewerOutput — parses REVIEWER.md <finding> blocks into Finding objects
 *   6. parseValidatorOutput — parses VALIDATOR.md <verdict> blocks into ValidationVerdict objects
 *   7. verifyFileExists — asserts a file exists; throws descriptive error at pipeline handoffs
 */

import { simpleGit } from 'simple-git';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { preprocessDiff, type DiffStats } from './diff-preprocessor.js';
import { FindingSchema, ValidationVerdictSchema, DIMENSIONS, type Dimension, type Finding, type ValidationVerdict } from './schemas.js';

// ---------------------------------------------------------------------------
// getLocalDiff
// ---------------------------------------------------------------------------

export interface LocalDiffResult {
  diff: string;
  stats: DiffStats;
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
}

/**
 * Reads the local git diff (both staged and unstaged), preprocesses it,
 * and returns the combined diff along with stats about what was stripped.
 */
export async function getLocalDiff(projectRoot: string): Promise<LocalDiffResult> {
  const git = simpleGit({ baseDir: projectRoot });

  const stagedDiff = await git.diff(['--cached']);
  const unstagedDiff = await git.diff([]);

  const rawDiff = stagedDiff + unstagedDiff;
  const { diff, stats } = preprocessDiff(rawDiff);

  return {
    diff,
    stats,
    hasStagedChanges: stagedDiff.length > 0,
    hasUnstagedChanges: unstagedDiff.length > 0,
  };
}

// ---------------------------------------------------------------------------
// getFullDiff
// ---------------------------------------------------------------------------

export interface FullDiffResult {
  diff: string;
  stats: DiffStats;
}

/**
 * Computes a full-codebase diff from the git empty tree to HEAD.
 * Uses the well-known empty tree SHA (4b825dc642cb6eb9a060e54bf8d69288fbee4904)
 * to ensure all files — including those introduced in the initial commit — are captured.
 * Misses nothing that `root..HEAD` would skip (files never modified since initial commit).
 */
export async function getFullDiff(projectRoot: string): Promise<FullDiffResult> {
  const git = simpleGit({ baseDir: projectRoot });
  const GIT_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const rawDiff = await git.diff([GIT_EMPTY_TREE, 'HEAD']);
  const { diff, stats } = preprocessDiff(rawDiff);
  return { diff, stats };
}

// ---------------------------------------------------------------------------
// writeInputFile
// ---------------------------------------------------------------------------

export interface WriteInputOptions {
  /** Absolute path to the session directory, e.g. .reviews/2026-04-05-local/ */
  sessionDir: string;
  reviewId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  scope: 'local-diff' | 'pr-diff' | 'full-diff';
  /** Optional focus area — omitted from frontmatter if not set */
  focus?: string;
  /** Preprocessed diff content — written verbatim, no escaping */
  diff: string;
  /** Optional PR metadata (pr-diff scope only) */
  prNumber?: number;
  /** Optional "owner/repo" slug (pr-diff scope only) */
  repoSlug?: string;
  /** Optional head branch name (pr-diff scope only) */
  branch?: string;
}

/**
 * Writes INPUT.md to the session directory with XML-tagged blocks.
 * Returns the path to the written file.
 */
export async function writeInputFile(opts: WriteInputOptions): Promise<string> {
  const { sessionDir, reviewId, timestamp, scope, focus, diff, prNumber, repoSlug, branch } = opts;

  // Build frontmatter — include focus line only if defined and non-empty
  const focusFrontmatter = focus && focus.trim() ? `focus: ${focus}\n` : '';
  const prFrontmatter =
    prNumber !== undefined
      ? `prNumber: ${prNumber}\nrepoSlug: ${repoSlug ?? ''}\nbranch: ${branch ?? ''}\n`
      : '';

  // Build optional PR XML metadata block
  const prXml =
    prNumber !== undefined
      ? `<pr-number>${prNumber}</pr-number>\n<repo>${repoSlug ?? ''}</repo>\n<branch>${branch ?? ''}</branch>\n`
      : '';

  const content = `---
reviewId: ${reviewId}
timestamp: ${timestamp}
scope: ${scope}
${focusFrontmatter}${prFrontmatter}---

<scope>${scope}</scope>
<focus>${focus && focus.trim() ? focus : 'none'}</focus>
${prXml}<diff>
${diff}
</diff>
`;

  const outputPath = join(sessionDir, 'INPUT.md');
  await writeFile(outputPath, content, 'utf8');
  return outputPath;
}

// ---------------------------------------------------------------------------
// getPrDiff
// ---------------------------------------------------------------------------

export interface PrDiffResult {
  /** Preprocessed diff text (lock files and binaries stripped) */
  diff: string;
  /** Preprocessing stats */
  stats: DiffStats;
  /** PR number */
  prNumber: number;
  /** Head branch name (e.g. "fix-auth") — used in session slug */
  branch: string;
  /** "owner/repo" — for INPUT.md metadata */
  repoSlug: string;
}

/**
 * Fetches a GitHub PR diff via the REST API and preprocesses it.
 *
 * Requires a valid GitHub personal access token with repo read access.
 * Uses Node.js built-in fetch (Node ≥18 required).
 *
 * Error handling:
 *   - 401/403 → auth failure message
 *   - 404 → PR not found message
 *   - Empty diff → explicit error (no silent empty reviews)
 *   - Network errors → propagated with context
 */
export async function getPrDiff(
  prNumber: number,
  token: string,
  repoSlug: string,
): Promise<PrDiffResult> {
  const baseUrl = `https://api.github.com/repos/${repoSlug}/pulls/${prNumber}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'review-my-shit/rms',
  };

  // Step 1: Fetch PR metadata to get head branch name
  let branch: string;
  try {
    const metaRes = await fetch(baseUrl, {
      headers: { ...headers, Accept: 'application/vnd.github+json' },
    });

    if (metaRes.status === 401 || metaRes.status === 403) {
      throw new Error(
        `GitHub authentication failed. Set GITHUB_TOKEN with repo read access. (HTTP ${metaRes.status})`,
      );
    }
    if (metaRes.status === 404) {
      throw new Error(
        `PR #${prNumber} not found in ${repoSlug}. Check the PR number and GITHUB_TOKEN.`,
      );
    }
    if (!metaRes.ok) {
      throw new Error(`GitHub API error fetching PR #${prNumber}: HTTP ${metaRes.status}`);
    }

    const meta = (await metaRes.json()) as { head?: { ref?: string } };
    branch = meta?.head?.ref ?? `pr-${prNumber}`;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('GitHub')) throw err;
    throw new Error(
      `Network error fetching PR #${prNumber} metadata from ${repoSlug}: ${String(err)}`,
    );
  }

  // Step 2: Fetch raw diff
  let rawDiff: string;
  try {
    const diffRes = await fetch(baseUrl, {
      headers: { ...headers, Accept: 'application/vnd.github.v3.diff' },
    });

    if (diffRes.status === 401 || diffRes.status === 403) {
      throw new Error(
        `GitHub authentication failed. Set GITHUB_TOKEN with repo read access. (HTTP ${diffRes.status})`,
      );
    }
    if (diffRes.status === 404) {
      throw new Error(
        `PR #${prNumber} not found in ${repoSlug}. Check the PR number and GITHUB_TOKEN.`,
      );
    }
    if (!diffRes.ok) {
      throw new Error(`GitHub API error fetching PR #${prNumber} diff: HTTP ${diffRes.status}`);
    }

    rawDiff = await diffRes.text();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('GitHub')) throw err;
    throw new Error(
      `Network error fetching PR #${prNumber} diff from ${repoSlug}: ${String(err)}`,
    );
  }

  if (!rawDiff.trim()) {
    throw new Error(
      `PR #${prNumber} diff is empty. It may have no file changes or may already be merged.`,
    );
  }

  const { diff, stats } = preprocessDiff(rawDiff);

  return { diff, stats, prNumber, branch, repoSlug };
}

// ---------------------------------------------------------------------------
// detectRepoSlug
// ---------------------------------------------------------------------------

/**
 * Auto-detects the GitHub "owner/repo" slug from the git remote origin URL.
 *
 * Supports both HTTPS and SSH remote formats:
 *   https://github.com/owner/repo.git → owner/repo
 *   git@github.com:owner/repo.git     → owner/repo
 *
 * Throws a clear error if origin is absent or not a GitHub remote.
 */
export async function detectRepoSlug(projectRoot: string): Promise<string> {
  const git = simpleGit({ baseDir: projectRoot });

  let remoteUrl: string;
  try {
    const result = await git.remote(['get-url', 'origin']);
    remoteUrl = (result ?? '').trim();
  } catch {
    throw new Error(
      'Could not read git remote origin URL. Make sure you are inside a git repository with a remote named "origin".',
    );
  }

  if (!remoteUrl) {
    throw new Error(
      'No git remote "origin" configured. Add a GitHub remote with: git remote add origin https://github.com/owner/repo.git',
    );
  }

  // HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = remoteUrl.match(/https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1] as string;

  // SSH: git@github.com:owner/repo.git or git@github.com:owner/repo
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1] as string;

  throw new Error(
    `Remote origin "${remoteUrl}" is not a GitHub URL. PR reviews require a GitHub remote. ` +
      `Supported formats: https://github.com/owner/repo.git or git@github.com:owner/repo.git`,
  );
}



// ---------------------------------------------------------------------------
// parseReviewerOutput
// ---------------------------------------------------------------------------

export interface ParsedReviewerOutput {
  /** Parsed findings without IDs (IDs assigned later by orchestrator) */
  findings: Array<Omit<Finding, 'id'>>;
  /** All dimension section headers found in the file (## BUG, ## SEC, etc.) */
  dimensionsCovered: Dimension[];
  /** Dimensions that have at least one valid parsed finding */
  dimensionsWithFindings: Dimension[];
  /** Raw file content for downstream consumption */
  rawContent: string;
}

/**
 * Parses a REVIEWER.md file and extracts structured findings.
 *
 * The reviewer writes `<finding>...</finding>` blocks with YAML-like key:value
 * lines inside. Each finding is validated against FindingSchema (without id).
 * Invalid findings are skipped with a console warning.
 */
export async function parseReviewerOutput(reviewerMdPath: string): Promise<ParsedReviewerOutput> {
  const rawContent = await readFile(reviewerMdPath, 'utf8');

  // Extract dimension section headers: ## BUG, ## SEC, etc.
  const dimensionsCovered: Dimension[] = [];
  const dimensionHeaderRegex = /^## ([A-Z]+)$/gm;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = dimensionHeaderRegex.exec(rawContent)) !== null) {
    const dim = headerMatch[1] as string;
    if ((DIMENSIONS as readonly string[]).includes(dim) && !dimensionsCovered.includes(dim as Dimension)) {
      dimensionsCovered.push(dim as Dimension);
    }
  }

  // Extract all <finding>...</finding> blocks
  const findingBlockRegex = /<finding>([\s\S]*?)<\/finding>/g;
  const findings: Array<Omit<Finding, 'id'>> = [];
  const dimensionsWithFindingsSet = new Set<Dimension>();

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = findingBlockRegex.exec(rawContent)) !== null) {
    const blockContent = blockMatch[1] ?? '';
    const parsed = parseFindingBlock(blockContent);

    if (!parsed) continue;

    // Validate using FindingSchema without id
    const validationResult = FindingSchema.omit({ id: true }).safeParse(parsed);
    if (!validationResult.success) {
      console.warn(`[rms] Skipping invalid finding: ${validationResult.error.message}`);
      continue;
    }

    findings.push(validationResult.data);
    dimensionsWithFindingsSet.add(validationResult.data.dimension);
  }

  return {
    findings,
    dimensionsCovered,
    dimensionsWithFindings: Array.from(dimensionsWithFindingsSet),
    rawContent,
  };
}

// ---------------------------------------------------------------------------
// Internal: finding block parser
// ---------------------------------------------------------------------------

/**
 * Parses key:value pairs from a <finding> block body.
 * Handles multi-line explanation and suggestion fields.
 *
 * @internal — exported for reuse in parseCounterFindings; not public API
 */
export function parseFindingBlock(blockContent: string): Record<string, string> | null {
  const lines = blockContent.split('\n');
  const result: Record<string, string> = {};

  // Known single-line fields
  const singleLineFields = new Set(['severity', 'file', 'line', 'dimension']);
  // Multi-line accumulator fields
  const multiLineFields = new Set(['explanation', 'suggestion']);

  let currentField: string | null = null;
  let currentLines: string[] = [];

  const flushCurrent = () => {
    if (currentField) {
      result[currentField] = currentLines.join('\n').trim();
    }
    currentField = null;
    currentLines = [];
  };

  for (const line of lines) {
    // Check if this line starts a new key:value pair
    const keyMatch = line.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[1]?.toLowerCase() ?? '';
      const value = keyMatch[2] ?? '';

      if (singleLineFields.has(key) || multiLineFields.has(key)) {
        flushCurrent();
        currentField = key;
        currentLines = [value];
        continue;
      }
    }

    // Continuation line for multi-line field
    if (currentField && multiLineFields.has(currentField) && line.trim()) {
      currentLines.push(line);
    } else if (currentField && singleLineFields.has(currentField)) {
      // Single-line fields don't accumulate
      flushCurrent();
    }
  }

  flushCurrent();

  if (Object.keys(result).length === 0) return null;
  return result;
}

// ---------------------------------------------------------------------------
// parseValidatorOutput
// ---------------------------------------------------------------------------

export interface ParsedValidatorOutput {
  /** Parsed verdicts — one per finding */
  verdicts: ValidationVerdict[];
  /** Total number of valid parsed verdicts */
  verdictCount: number;
  /** Raw file content for downstream consumption */
  rawContent: string;
}

/**
 * Parses a VALIDATOR.md file and extracts structured verdicts.
 *
 * The validator writes `<verdict>...</verdict>` blocks with YAML-like key:value
 * lines inside. Each verdict is validated against ValidationVerdictSchema.
 * Invalid verdicts are skipped with a console warning.
 *
 * Counter-finding blocks inside <verdict> are intentionally NOT parsed here —
 * they are preserved in rawContent for Phase 4 Writer to extract.
 */
export async function parseValidatorOutput(validatorMdPath: string): Promise<ParsedValidatorOutput> {
  const rawContent = await readFile(validatorMdPath, 'utf8');

  const verdictBlockRegex = /<verdict>([\s\S]*?)<\/verdict>/g;
  const verdicts: ValidationVerdict[] = [];

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = verdictBlockRegex.exec(rawContent)) !== null) {
    const blockContent = blockMatch[1] ?? '';
    const parsed = parseVerdictBlock(blockContent);

    if (!parsed) continue;

    const validationResult = ValidationVerdictSchema.safeParse(parsed);
    if (!validationResult.success) {
      console.warn(`[rms] Skipping invalid verdict: ${validationResult.error.message}`);
      continue;
    }

    verdicts.push(validationResult.data);
  }

  return {
    verdicts,
    verdictCount: verdicts.length,
    rawContent,
  };
}

// ---------------------------------------------------------------------------
// Internal: verdict block parser
// ---------------------------------------------------------------------------

/**
 * Parses key:value pairs from a <verdict> block body.
 * Handles multi-line rationale field.
 * Strips any nested <counter-finding> blocks before parsing (they are not
 * part of the verdict schema and are preserved in rawContent for Phase 4).
 */
function parseVerdictBlock(blockContent: string): Record<string, string> | null {
  // Strip nested <counter-finding>...</counter-finding> blocks before parsing
  const stripped = blockContent.replace(/<counter-finding>[\s\S]*?<\/counter-finding>/g, '');

  const lines = stripped.split('\n');
  const result: Record<string, string> = {};

  const singleLineFields = new Set(['findingid', 'verdict']);
  const multiLineFields = new Set(['rationale']);

  let currentField: string | null = null;
  let currentLines: string[] = [];

  const flushCurrent = () => {
    if (currentField) {
      result[currentField] = currentLines.join('\n').trim();
    }
    currentField = null;
    currentLines = [];
  };

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[1]?.toLowerCase() ?? '';
      const value = keyMatch[2] ?? '';

      if (singleLineFields.has(key) || multiLineFields.has(key)) {
        flushCurrent();
        currentField = key;
        currentLines = [value];
        continue;
      }
    }

    if (currentField && multiLineFields.has(currentField) && line.trim()) {
      currentLines.push(line);
    } else if (currentField && singleLineFields.has(currentField)) {
      flushCurrent();
    }
  }

  flushCurrent();

  // Remap 'findingid' key back to 'findingId' for schema compatibility
  if ('findingid' in result) {
    result['findingId'] = result['findingid'] as string;
    delete result['findingid'];
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

// ---------------------------------------------------------------------------
// parseCounterFindings
// ---------------------------------------------------------------------------

/**
 * Extracts counter-findings from raw VALIDATOR.md content.
 *
 * The validator may include `<counter-finding>` blocks inside challenged
 * `<verdict>` blocks. This function scans the raw content for those nested
 * blocks, parses them using `parseFindingBlock`, and returns validated
 * counter-findings (without IDs — IDs are assigned by the orchestrator).
 *
 * Counter-findings that fail schema validation are skipped with a warning.
 */
export function parseCounterFindings(rawContent: string): Array<Omit<Finding, 'id'>> {
  const counterFindings: Array<Omit<Finding, 'id'>> = [];

  // Only extract counter-findings from challenged verdict blocks
  const verdictBlockRegex = /<verdict>([\s\S]*?)<\/verdict>/g;
  let verdictMatch: RegExpExecArray | null;

  while ((verdictMatch = verdictBlockRegex.exec(rawContent)) !== null) {
    const verdictContent = verdictMatch[1] ?? '';

    // Only challenged verdicts can have counter-findings
    if (!verdictContent.includes('challenged')) continue;

    // Extract nested <counter-finding> blocks
    const counterBlockRegex = /<counter-finding>([\s\S]*?)<\/counter-finding>/g;
    let counterMatch: RegExpExecArray | null;

    while ((counterMatch = counterBlockRegex.exec(verdictContent)) !== null) {
      const blockContent = counterMatch[1] ?? '';
      const parsed = parseFindingBlock(blockContent);

      if (!parsed) continue;

      const validationResult = FindingSchema.omit({ id: true }).safeParse(parsed);
      if (!validationResult.success) {
        console.warn(`[rms] Skipping invalid counter-finding: ${validationResult.error.message}`);
        continue;
      }

      counterFindings.push(validationResult.data);
    }
  }

  return counterFindings;
}

// ---------------------------------------------------------------------------
// verifyFileExists
// ---------------------------------------------------------------------------

/**
 * Asserts that a file exists at the given path.
 * Throws a descriptive error if it does not — used for pipeline handoff checks.
 *
 * @param filePath - Absolute path to the file to check
 * @param label - Human-readable label for the file (e.g., 'REVIEWER.md')
 */
export async function verifyFileExists(filePath: string, label: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    throw new Error(
      `[rms] Pipeline error: ${label} not found at ${filePath}. Previous step may have failed.`,
    );
  }
}
