/**
 * Writer agent — the final synthesis step in the rms pipeline.
 *
 * Deterministic: no LLM call. Reads structured findings (from runReviewer)
 * and verdicts (from runValidator), applies escalation/challenge annotations,
 * surfaces counter-findings, and assembles REPORT.md as a severity-grouped
 * Markdown document.
 *
 * Completeness guarantee: after writing, reads REPORT.md back and asserts
 * every reviewer finding ID appears — throws if any are missing.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCounterFindings } from './pipeline-io.js';
import { nextFindingId } from './finding-id.js';
import { ReportFileSchema, type Dimension, type Finding, type Severity, type ValidationVerdict } from './schemas.js';
import type { SessionInfo } from './session.js';

// ---------------------------------------------------------------------------
// Severity ordering + bump table
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_BUMP: Record<Severity, Severity> = {
  info: 'low',
  low: 'medium',
  medium: 'high',
  high: 'critical',
  critical: 'critical',
};

// ---------------------------------------------------------------------------
// Internal: annotated finding (reviewer finding + verdict metadata)
// ---------------------------------------------------------------------------

interface AnnotatedFinding extends Finding {
  /** undefined for confirmed; 'challenged' or 'escalated' for others */
  verdictType?: 'challenged' | 'escalated';
  /** Validator rationale for challenged / escalated verdicts */
  verdictRationale?: string;
  /** 'reviewer' or 'validator' (counter-findings) */
  source: 'reviewer' | 'validator';
}

// ---------------------------------------------------------------------------
// WriterOptions / WriterResult
// ---------------------------------------------------------------------------

export interface WriterOptions {
  session: SessionInfo;
  /** Reviewer findings with IDs already assigned */
  findings: Finding[];
  /** Validator verdicts — one per reviewer finding */
  verdicts: ValidationVerdict[];
  /** Raw VALIDATOR.md content — used to extract counter-findings */
  validatorRawContent: string;
  /** Raw INPUT.md content — used to extract scope/focus/timestamp */
  inputMdContent: string;
  /** Dimension section headers present in REVIEWER.md */
  dimensionsCovered: Dimension[];
  /** Model ID string (e.g. 'gpt-4o') passed from index.ts */
  modelId: string;
  /** Path to .reviews/ for counter-finding ID assignment */
  reviewsDir: string;
}

export interface WriterResult {
  /** Absolute path to the written REPORT.md file */
  reportMdPath: string;
  /** Total findings in report (reviewer findings + counter-findings) */
  findingCount: number;
  /** Number of counter-findings surfaced from validator */
  counterFindingCount: number;
}

// ---------------------------------------------------------------------------
// Internal: extract frontmatter field from markdown
// ---------------------------------------------------------------------------

function extractFrontmatterField(content: string, field: string): string | undefined {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = content.match(regex);
  return match?.[1]?.trim();
}

// ---------------------------------------------------------------------------
// Internal: build annotated finding list
// ---------------------------------------------------------------------------

async function buildAnnotatedFindings(
  findings: Finding[],
  verdicts: ValidationVerdict[],
  validatorRawContent: string,
  reviewsDir: string,
): Promise<AnnotatedFinding[]> {
  const verdictMap = new Map<string, ValidationVerdict>();
  for (const verdict of verdicts) {
    verdictMap.set(verdict.findingId, verdict);
  }

  const annotated: AnnotatedFinding[] = [];

  for (const finding of findings) {
    const verdict = verdictMap.get(finding.id);
    const entry: AnnotatedFinding = { ...finding, source: 'reviewer' };

    if (verdict?.verdict === 'escalated') {
      entry.verdictType = 'escalated';
      entry.verdictRationale = verdict.rationale;
      entry.severity = SEVERITY_BUMP[finding.severity];
    } else if (verdict?.verdict === 'challenged') {
      entry.verdictType = 'challenged';
      entry.verdictRationale = verdict.rationale;
    }

    annotated.push(entry);
  }

  // Extract and assign IDs to counter-findings
  const counterFindings = parseCounterFindings(validatorRawContent);
  for (const cf of counterFindings) {
    const id = await nextFindingId(cf.dimension, reviewsDir);
    annotated.push({ ...cf, id, source: 'validator' });
  }

  return annotated;
}

// ---------------------------------------------------------------------------
// Internal: sort by severity then dimension then file
// ---------------------------------------------------------------------------

function sortFindings(findings: AnnotatedFinding[]): AnnotatedFinding[] {
  return [...findings].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const dimDiff = a.dimension.localeCompare(b.dimension);
    if (dimDiff !== 0) return dimDiff;
    return a.file.localeCompare(b.file);
  });
}

// ---------------------------------------------------------------------------
// Internal: render a single finding entry
// ---------------------------------------------------------------------------

function renderFinding(f: AnnotatedFinding): string {
  const sourceLabel = f.source === 'validator' ? ' _(validator counter-finding)_' : '';
  let block = `### \`${f.id}\`${sourceLabel}\n\n`;
  block += `**File:** \`${f.file}\` · **Line:** ${f.line} · **Dimension:** ${f.dimension}\n\n`;
  block += `**Explanation:** ${f.explanation}\n\n`;
  block += `**Suggestion:** ${f.suggestion}\n`;

  if (f.verdictType === 'challenged') {
    block += `\n> **Challenged by validator:** ${f.verdictRationale}`;
  } else if (f.verdictType === 'escalated') {
    block += `\n> **Severity elevated by validator:** ${f.verdictRationale}`;
  }

  return block;
}

// ---------------------------------------------------------------------------
// Internal: render all findings grouped by severity
// ---------------------------------------------------------------------------

function renderFindingSections(sorted: AnnotatedFinding[]): string {
  const sections: string[] = [];

  for (const severity of SEVERITY_ORDER) {
    const group = sorted.filter(f => f.severity === severity);
    if (group.length === 0) continue;

    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    sections.push(`## ${label}\n\n${group.map(renderFinding).join('\n\n---\n\n')}`);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Internal: build summary line
// ---------------------------------------------------------------------------

function buildSummaryLine(sorted: AnnotatedFinding[]): string {
  const counts = SEVERITY_ORDER.map(sev => {
    const n = sorted.filter(f => f.severity === sev).length;
    return n > 0 ? `${n} ${sev}` : null;
  }).filter(Boolean);

  return counts.length > 0 ? counts.join(', ') : 'no findings';
}

// ---------------------------------------------------------------------------
// runWriter — main entry point
// ---------------------------------------------------------------------------

/**
 * Runs the writer step:
 * 1. Builds annotated finding list (applies escalation, surfaces counter-findings)
 * 2. Sorts by severity → dimension → file
 * 3. Renders REPORT.md with metadata header + severity-grouped findings
 * 4. Validates frontmatter against ReportFileSchema
 * 5. Writes REPORT.md to session directory
 * 6. Completeness check: asserts every reviewer finding ID appears in output
 * 7. Returns WriterResult
 */
export async function runWriter(opts: WriterOptions): Promise<WriterResult> {
  const {
    session,
    findings,
    verdicts,
    validatorRawContent,
    inputMdContent,
    dimensionsCovered,
    modelId,
    reviewsDir,
  } = opts;

  // Step 1: Build annotated finding list
  const annotated = await buildAnnotatedFindings(findings, verdicts, validatorRawContent, reviewsDir);
  const counterFindingCount = annotated.filter(f => f.source === 'validator').length;

  // Step 2: Sort
  const sorted = sortFindings(annotated);

  // Step 3: Extract metadata from INPUT.md frontmatter
  const scope = extractFrontmatterField(inputMdContent, 'scope') ?? 'unknown';
  const focus = extractFrontmatterField(inputMdContent, 'focus') ?? 'none';
  const timestamp = extractFrontmatterField(inputMdContent, 'timestamp') ?? session.timestamp;
  const generated = new Date().toISOString();
  const findingCount = sorted.length;

  // Step 4: Validate frontmatter object
  const frontmatterObj = { reviewId: session.reviewId, generated, findingCount };
  const frontmatterValidation = ReportFileSchema.safeParse(frontmatterObj);
  if (!frontmatterValidation.success) {
    throw new Error(`[rms] REPORT.md frontmatter validation failed: ${frontmatterValidation.error.message}`);
  }

  // Step 5: Render REPORT.md
  const dimensionList = dimensionsCovered.join(', ') || 'none';
  const summaryLine = buildSummaryLine(sorted);

  const reportContent = `---
reviewId: ${session.reviewId}
generated: ${generated}
findingCount: ${findingCount}
---

# Review Report

| Field | Value |
|-------|-------|
| Review ID | \`${session.reviewId}\` |
| Scope | ${scope} |
| Focus | ${focus} |
| Model | ${modelId} |
| Timestamp | ${timestamp} |
| Dimensions covered | ${dimensionList} |
| Total findings | ${findingCount} (${summaryLine}) |

---

${sorted.length === 0 ? '_No findings. Clean review._' : renderFindingSections(sorted)}
`;

  // Step 6: Write REPORT.md
  const reportMdPath = join(session.sessionDir, 'REPORT.md');
  await writeFile(reportMdPath, reportContent, 'utf8');

  // Step 7: Completeness check — every reviewer finding ID must appear in output
  const written = await readFile(reportMdPath, 'utf8');
  const missingIds = findings
    .map(f => f.id)
    .filter(id => !written.includes(id));

  if (missingIds.length > 0) {
    throw new Error(
      `[rms] REPORT.md completeness check failed: ${missingIds.length} finding(s) missing from output: ${missingIds.join(', ')}`,
    );
  }

  return { reportMdPath, findingCount, counterFindingCount };
}
