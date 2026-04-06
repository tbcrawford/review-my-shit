/**
 * Pipeline I/O — git diff reader, INPUT.md writer, REVIEWER.md parser, VALIDATOR.md parser.
 *
 * Provides the file-level I/O layer for the rms pipeline:
 *   1. getLocalDiff — reads both staged and unstaged git diff, runs preprocessor
 *   2. writeInputFile — writes INPUT.md with XML-tagged blocks
 *   3. parseReviewerOutput — parses REVIEWER.md <finding> blocks into Finding objects
 *   4. parseValidatorOutput — parses VALIDATOR.md <verdict> blocks into ValidationVerdict objects
 */

import { simpleGit } from 'simple-git';
import { readFile, writeFile } from 'node:fs/promises';
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
// writeInputFile
// ---------------------------------------------------------------------------

export interface WriteInputOptions {
  /** Absolute path to the session directory, e.g. .reviews/2026-04-05-local/ */
  sessionDir: string;
  reviewId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  scope: 'local-diff' | 'pr-diff';
  /** Optional focus area — omitted from frontmatter if not set */
  focus?: string;
  /** Preprocessed diff content — written verbatim, no escaping */
  diff: string;
}

/**
 * Writes INPUT.md to the session directory with XML-tagged blocks.
 * Returns the path to the written file.
 */
export async function writeInputFile(opts: WriteInputOptions): Promise<string> {
  const { sessionDir, reviewId, timestamp, scope, focus, diff } = opts;

  // Build frontmatter — include focus line only if defined and non-empty
  const focusFrontmatter = focus && focus.trim() ? `focus: ${focus}\n` : '';

  const content = `---
reviewId: ${reviewId}
timestamp: ${timestamp}
scope: ${scope}
${focusFrontmatter}---

<scope>${scope}</scope>
<focus>${focus && focus.trim() ? focus : 'none'}</focus>
<diff>
${diff}
</diff>
`;

  const outputPath = join(sessionDir, 'INPUT.md');
  await writeFile(outputPath, content, 'utf8');
  return outputPath;
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
 */
function parseFindingBlock(blockContent: string): Record<string, string> | null {
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
