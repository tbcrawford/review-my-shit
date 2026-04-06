/**
 * Diff preprocessor — strips noise from raw git diff output before LLM review.
 *
 * Strips lock files, node_modules/, binary files, and generated/minified files.
 * Returns the cleaned diff and stats about what was removed.
 */

// ---------------------------------------------------------------------------
// Strip rules
// ---------------------------------------------------------------------------

/** Lock file patterns that should be excluded from review. */
const LOCK_FILE_PATTERNS: RegExp[] = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /\.lock$/,
  /^Gemfile\.lock$/,
  /^Cargo\.lock$/,
  /^poetry\.lock$/,
  /^composer\.lock$/,
];

/** Path prefixes/patterns for generated/minified/dist content to strip. */
const GENERATED_PATH_PATTERNS: RegExp[] = [
  /node_modules\//,
  /\.min\.js$/,
  /\.min\.css$/,
  /^dist\//,
  /^build\//,
];

/** Binary file markers in git diff output. */
const BINARY_MARKERS: RegExp[] = [
  /^Binary files .* differ$/m,
  /^GIT binary patch/m,
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DiffStats {
  originalLines: number;
  strippedFiles: string[];
  remainingLines: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the file path from a `diff --git a/{path} b/{path}` header line.
 * Returns null if the line doesn't match the expected format.
 */
function extractPath(diffHeader: string): string | null {
  // Format: diff --git a/path/to/file b/path/to/file
  const match = diffHeader.match(/^diff --git a\/(.+) b\/.+$/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Determines whether a file path should be stripped based on the strip rules.
 */
function shouldStrip(filePath: string, sectionContent: string): boolean {
  // Check lock file patterns (match against filename only for root-level files,
  // and against the full path for subdirectory files)
  const filename = filePath.split('/').pop() ?? filePath;
  for (const pattern of LOCK_FILE_PATTERNS) {
    if (pattern.test(filename) || pattern.test(filePath)) {
      return true;
    }
  }

  // Check generated/minified/node_modules patterns
  for (const pattern of GENERATED_PATH_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }

  // Check binary file markers in the section content
  for (const marker of BINARY_MARKERS) {
    if (marker.test(sectionContent)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preprocesses a raw git diff string by removing sections that add noise
 * without value to a code review (lock files, binary files, node_modules, etc.).
 *
 * @param rawDiff - The raw output from `git diff` or `git diff --cached`
 * @returns Cleaned diff string and stats about what was stripped
 */
export function preprocessDiff(rawDiff: string): { diff: string; stats: DiffStats } {
  const originalLines = rawDiff === '' ? 0 : rawDiff.split('\n').length;

  if (!rawDiff.trim()) {
    return {
      diff: '',
      stats: { originalLines: 0, strippedFiles: [], remainingLines: 0 },
    };
  }

  // Split into sections at "diff --git" boundaries.
  // Each element after split starts with the header line.
  const parts = rawDiff.split(/(?=^diff --git )/m);

  const keptSections: string[] = [];
  const strippedFiles: string[] = [];

  for (const section of parts) {
    if (!section.trim()) continue;

    const firstLine = section.split('\n')[0] ?? '';
    const filePath = extractPath(firstLine);

    if (!filePath) {
      // Not a recognized diff header — keep as-is (could be preamble text)
      keptSections.push(section);
      continue;
    }

    if (shouldStrip(filePath, section)) {
      strippedFiles.push(filePath);
    } else {
      keptSections.push(section);
    }
  }

  const diff = keptSections.join('');
  const remainingLines = diff === '' ? 0 : diff.split('\n').length;

  return {
    diff,
    stats: {
      originalLines,
      strippedFiles,
      remainingLines,
    },
  };
}
