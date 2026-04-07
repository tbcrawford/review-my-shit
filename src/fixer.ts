/**
 * Fixer module — Phase 6 Fix Command.
 *
 * Responsibilities:
 * 1. Locate the latest REPORT.md in .reviews/ (or a specific session)
 * 2. Parse findings from REPORT.md
 * 3. Look up a specific finding by ID
 * 4. Detect whether the target file has changed since the review (staleness)
 * 5. Format a structured "fix context" block for the host AI agent to act on
 *
 * The fix command never applies changes directly — it outputs context that the
 * host AI agent (OpenCode/Cursor) presents to the user for confirmation before
 * editing any file.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedFinding {
  id: string;
  /** Absolute or relative file path extracted from the finding */
  file: string;
  line: string;
  dimension: string;
  severity: string;
  explanation: string;
  suggestion: string;
  /** true if this is a validator counter-finding */
  isCounterFinding: boolean;
  /** Verdict annotation from the validator, if any */
  verdictNote?: string;
}

export interface FixContext {
  finding: ParsedFinding;
  /** Review session ID (directory name under .reviews/) */
  sessionId: string;
  /** Full path to the REPORT.md that was read */
  reportPath: string;
  /** mtime of REPORT.md — used to detect stale target files */
  reportMtime: Date;
  /** Whether the target file has changed since REPORT.md was written */
  isStale: boolean;
  /** mtime of the target file, if it exists */
  fileMtime?: Date;
}

// ---------------------------------------------------------------------------
// Internal: list .reviews/ sessions sorted newest-first
// ---------------------------------------------------------------------------

/**
 * Returns session directory names under .reviews/ sorted by mtime, newest first.
 * Skips non-directory entries (e.g. .gitignore).
 */
export async function listSessionDirs(reviewsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(reviewsDir);
  } catch {
    return [];
  }

  const withStats = await Promise.all(
    entries.map(async name => {
      const fullPath = join(reviewsDir, name);
      try {
        const s = await stat(fullPath);
        return s.isDirectory() ? { name, mtime: s.mtime } : null;
      } catch {
        return null;
      }
    }),
  );

  return withStats
    .filter((x): x is { name: string; mtime: Date } => x !== null)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .map(x => x.name);
}

// ---------------------------------------------------------------------------
// Internal: find the REPORT.md path for the latest (or specified) session
// ---------------------------------------------------------------------------

export async function findLatestReportPath(
  reviewsDir: string,
  sessionId?: string,
): Promise<{ reportPath: string; sessionId: string } | null> {
  if (sessionId) {
    const reportPath = join(reviewsDir, sessionId, 'REPORT.md');
    try {
      await stat(reportPath);
      return { reportPath, sessionId };
    } catch {
      return null;
    }
  }

  const sessions = await listSessionDirs(reviewsDir);
  for (const name of sessions) {
    const reportPath = join(reviewsDir, name, 'REPORT.md');
    try {
      await stat(reportPath);
      return { reportPath, sessionId: name };
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal: parse a single finding block from REPORT.md
//
// Expected format (from writer.ts renderFinding):
//
//   ### `SEC-00001` _(validator counter-finding)_
//
//   **File:** `src/foo.ts` · **Line:** 42 · **Dimension:** SEC
//
//   **Explanation:** Some explanation text
//
//   **Suggestion:** Some suggestion text
//
//   > **Challenged by validator:** rationale text
// ---------------------------------------------------------------------------

function parseFindingBlock(block: string): ParsedFinding | null {
  // Extract ID from heading: ### `SEC-00001` or ### `SEC-00001` _(validator counter-finding)_
  const headingMatch = block.match(/^###\s+`([^`]+)`(.*)$/m);
  if (!headingMatch) return null;

  const id = headingMatch[1].trim();
  const headingRest = headingMatch[2] ?? '';
  const isCounterFinding = headingRest.includes('validator counter-finding');

  // Extract severity from the section header that wraps this block.
  // The severity is carried by the caller (block-based parsing knows which section).
  // We return empty string here; the caller sets it.
  const severity = '';

  // Extract file, line, dimension from: **File:** `src/foo.ts` · **Line:** 42 · **Dimension:** SEC
  const metaMatch = block.match(
    /\*\*File:\*\*\s+`([^`]+)`\s+·\s+\*\*Line:\*\*\s+([^\s·]+)\s+·\s+\*\*Dimension:\*\*\s+(\S+)/,
  );
  if (!metaMatch) return null;

  const file = metaMatch[1].trim();
  const line = metaMatch[2].trim();
  const dimension = metaMatch[3].trim();

  // Extract explanation: **Explanation:** text (until next **field:** or end)
  const explanationMatch = block.match(/\*\*Explanation:\*\*\s+([\s\S]+?)(?=\n\n\*\*Suggestion:|$)/);
  const explanation = explanationMatch?.[1]?.trim() ?? '';

  // Extract suggestion: **Suggestion:** text (until end or verdict note)
  const suggestionMatch = block.match(/\*\*Suggestion:\*\*\s+([\s\S]+?)(?=\n\n>|\n---|\s*$)/);
  const suggestion = suggestionMatch?.[1]?.trim() ?? '';

  // Extract verdict note (challenged / escalated annotation)
  const verdictMatch = block.match(/^>\s+\*\*(Challenged by validator|Severity elevated by validator):\*\*\s+(.+)$/m);
  const verdictNote = verdictMatch ? `${verdictMatch[1]}: ${verdictMatch[2].trim()}` : undefined;

  return { id, file, line, dimension, severity, explanation, suggestion, isCounterFinding, verdictNote };
}

// ---------------------------------------------------------------------------
// parseReportFindings — parse all findings from REPORT.md content
// ---------------------------------------------------------------------------

/**
 * Parses all findings from a REPORT.md content string.
 * Returns findings in document order (severity-grouped, as written by writer.ts).
 */
export function parseReportFindings(content: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];

  // Split on severity section headers: ## Critical, ## High, etc.
  // Each section contains one or more finding blocks separated by ---
  const severityPattern = /^## (Critical|High|Medium|Low|Info)\s*$/im;
  const sections = content.split(severityPattern);

  // sections is: [before, "Critical", criticalContent, "High", highContent, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const severityLabel = sections[i].toLowerCase() as string;
    const sectionContent = sections[i + 1] ?? '';

    // Split section into individual finding blocks on --- separators
    const blocks = sectionContent.split(/\n---\n/);

    for (const block of blocks) {
      const finding = parseFindingBlock(block.trim());
      if (finding) {
        finding.severity = severityLabel;
        findings.push(finding);
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// findFindingById — look up a specific finding from REPORT.md
// ---------------------------------------------------------------------------

export async function findFindingById(
  reportPath: string,
  findingId: string,
): Promise<ParsedFinding | null> {
  const content = await readFile(reportPath, 'utf8');
  const findings = parseReportFindings(content);
  return findings.find(f => f.id === findingId) ?? null;
}

// ---------------------------------------------------------------------------
// getAllFindings — return all findings from the latest (or specified) REPORT.md
// ---------------------------------------------------------------------------

export async function getAllFindings(
  reviewsDir: string,
  sessionId?: string,
): Promise<{ findings: ParsedFinding[]; reportPath: string; sessionId: string } | null> {
  const result = await findLatestReportPath(reviewsDir, sessionId);
  if (!result) return null;

  const content = await readFile(result.reportPath, 'utf8');
  const findings = parseReportFindings(content);
  return { findings, reportPath: result.reportPath, sessionId: result.sessionId };
}

// ---------------------------------------------------------------------------
// checkStaleness — detect whether the target file changed since the review
// ---------------------------------------------------------------------------

/**
 * Returns true if the target file's mtime is newer than the REPORT.md mtime.
 * Returns false if the file doesn't exist (can't be stale if missing).
 */
export async function checkStaleness(
  filePath: string,
  reportMtime: Date,
): Promise<{ isStale: boolean; fileMtime?: Date }> {
  try {
    const s = await stat(filePath);
    const fileMtime = s.mtime;
    const isStale = fileMtime > reportMtime;
    return { isStale, fileMtime };
  } catch {
    // File doesn't exist — not stale (new file scenario)
    return { isStale: false };
  }
}

// ---------------------------------------------------------------------------
// buildFixContext — assemble full FixContext for a given finding
// ---------------------------------------------------------------------------

export async function buildFixContext(
  projectRoot: string,
  reportPath: string,
  sessionId: string,
  finding: ParsedFinding,
): Promise<FixContext> {
  const reportStat = await stat(reportPath);
  const reportMtime = reportStat.mtime;

  // Resolve the file path relative to projectRoot
  const absoluteFilePath = resolve(projectRoot, finding.file);
  const { isStale, fileMtime } = await checkStaleness(absoluteFilePath, reportMtime);

  return {
    finding,
    sessionId,
    reportPath,
    reportMtime,
    isStale,
    fileMtime,
  };
}

// ---------------------------------------------------------------------------
// formatFixOutput — render the fix context as structured text for the AI agent
// ---------------------------------------------------------------------------

/**
 * Formats a FixContext into a structured Markdown block that the host AI agent
 * reads and presents to the user before making any edits.
 *
 * The output is designed for human readability and AI agent parsing.
 * The confirmation step is enforced by the slash command template.
 */
export function formatFixOutput(ctx: FixContext): string {
  const { finding, sessionId, isStale, fileMtime, reportMtime } = ctx;

  let output = `# Fix: \`${finding.id}\`\n\n`;
  output += `**Session:** \`${sessionId}\`\n`;
  output += `**Severity:** ${finding.severity}\n`;
  output += `**Dimension:** ${finding.dimension}\n`;
  output += `**File:** \`${finding.file}\`\n`;
  output += `**Line:** ${finding.line}\n`;
  if (finding.isCounterFinding) {
    output += `**Source:** validator counter-finding\n`;
  }
  if (finding.verdictNote) {
    output += `**Verdict note:** ${finding.verdictNote}\n`;
  }

  output += `\n---\n\n`;
  output += `## Problem\n\n${finding.explanation}\n\n`;
  output += `## Suggestion\n\n${finding.suggestion}\n`;

  if (isStale) {
    const reportTime = reportMtime.toISOString();
    const fileTime = fileMtime?.toISOString() ?? 'unknown';
    output += `\n---\n\n`;
    output += `> **Warning: Target file has changed since this review.**\n`;
    output += `> Review generated: ${reportTime}\n`;
    output += `> File last modified: ${fileTime}\n`;
    output += `> The suggestion may no longer apply cleanly. Review carefully before applying.\n`;
  }

  return output;
}

// ---------------------------------------------------------------------------
// formatFindingList — render all findings as a numbered list for interactive mode
// ---------------------------------------------------------------------------

export function formatFindingList(
  findings: ParsedFinding[],
  sessionId: string,
): string {
  if (findings.length === 0) {
    return `No findings found in session \`${sessionId}\`.`;
  }

  let output = `# Findings from \`${sessionId}\`\n\n`;
  output += `${findings.length} finding(s) available. Use \`/rms-fix <finding-id>\` to apply one.\n\n`;

  const bySeverity: Record<string, ParsedFinding[]> = {};
  for (const f of findings) {
    (bySeverity[f.severity] ??= []).push(f);
  }

  const order = ['critical', 'high', 'medium', 'low', 'info'];
  for (const severity of order) {
    const group = bySeverity[severity];
    if (!group?.length) continue;

    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    output += `## ${label}\n\n`;
    for (const f of group) {
      const counterTag = f.isCounterFinding ? ' _(counter-finding)_' : '';
      output += `- \`${f.id}\`${counterTag} — \`${f.file}\`:${f.line} — ${f.explanation.slice(0, 80)}${f.explanation.length > 80 ? '…' : ''}\n`;
    }
    output += '\n';
  }

  return output.trimEnd();
}
