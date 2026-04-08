/**
 * Tests for src/fixer.ts — Phase 6 Fix Command
 *
 * Tests cover:
 * - parseReportFindings: parse findings from REPORT.md content
 * - findFindingById: look up a finding by ID from a file
 * - listSessionDirs: list and sort session directories
 * - checkStaleness: detect when target file is newer than report
 * - formatFixOutput: render fix context as structured text
 * - formatFindingList: render findings list for interactive mode
 */

import { test, describe, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseReportFindings,
  findFindingById,
  listSessionDirs,
  findLatestReportPath,
  checkStaleness,
  formatFixOutput,
  formatFindingList,
  buildFixContext,
  getAllFindings,
  type ParsedFinding,
  type FixContext,
} from './fixer.js';

// ---------------------------------------------------------------------------
// Fixture: realistic REPORT.md content
// ---------------------------------------------------------------------------

const SAMPLE_REPORT = `---
reviewId: 2026-04-06-local-a3b7
generated: 2026-04-06T12:00:00.000Z
findingCount: 4
---

# Review Report

| Field | Value |
|-------|-------|
| Review ID | \`2026-04-06-local-a3b7\` |
| Scope | local-diff |
| Focus | security |
| Model | gpt-4o |
| Timestamp | 2026-04-06T11:00:00.000Z |
| Dimensions covered | BUG, SEC, PERF |
| Total findings | 4 (1 critical, 2 high, 1 medium) |

---

## Critical

### \`SEC-00001\`

**File:** \`src/auth.ts\` · **Line:** 42 · **Dimension:** SEC

**Explanation:** JWT secret read directly from process.env without validation. An empty string or missing key silently accepts any token.

**Suggestion:** Use a required config schema (e.g., zod) to validate and throw on missing or weak JWT secrets at startup.

> **Severity elevated by validator:** The original severity was high; this is critical because it enables token forgery with an empty secret.

## High

### \`BUG-00002\`

**File:** \`src/handler.ts\` · **Line:** 18 · **Dimension:** BUG

**Explanation:** Unhandled promise rejection in the request handler. Async errors are swallowed silently.

**Suggestion:** Wrap the async handler body in try/catch and pass errors to next() for centralized error handling.

---

### \`ERR-00003\` _(validator counter-finding)_

**File:** \`src/middleware.ts\` · **Line:** 7 · **Dimension:** ERR

**Explanation:** Error middleware registered before routes — errors from routes will never reach this handler.

**Suggestion:** Move error middleware registration to after all route registrations.

## Medium

### \`PERF-00004\`

**File:** \`src/db.ts\` · **Line:** 99 · **Dimension:** PERF

**Explanation:** N+1 query in the user listing endpoint. Each user record triggers a separate DB call.

**Suggestion:** Use a batch query or JOIN to fetch all required data in a single database round-trip.

> **Challenged by validator:** The endpoint is paginated to 20 records; the performance impact is bounded. Consider fixing but not urgent.
`;

// ---------------------------------------------------------------------------
// Tests: parseReportFindings
// ---------------------------------------------------------------------------

describe('parseReportFindings', () => {
  test('parses all 4 findings from sample report', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    expect(findings.length).toBe(4);
  });

  test('assigns correct severities', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const ids = findings.map(f => ({ id: f.id, severity: f.severity }));
    expect(ids).toEqual([
      { id: 'SEC-00001', severity: 'critical' },
      { id: 'BUG-00002', severity: 'high' },
      { id: 'ERR-00003', severity: 'high' },
      { id: 'PERF-00004', severity: 'medium' },
    ]);
  });

  test('parses file, line, dimension correctly', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const sec = findings.find(f => f.id === 'SEC-00001');
    expect(sec).toBeTruthy();
    expect(sec!.file).toBe('src/auth.ts');
    expect(sec!.line).toBe('42');
    expect(sec!.dimension).toBe('SEC');
  });

  test('parses explanation and suggestion', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const bug = findings.find(f => f.id === 'BUG-00002');
    expect(bug).toBeTruthy();
    expect(bug!.explanation.includes('Unhandled promise rejection')).toBeTruthy();
    expect(bug!.suggestion.includes('try/catch')).toBeTruthy();
  });

  test('marks counter-finding correctly', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const err = findings.find(f => f.id === 'ERR-00003');
    expect(err).toBeTruthy();
    expect(err!.isCounterFinding).toBe(true);
    expect(err!.dimension).toBe('ERR');
  });

  test('regular findings are not marked as counter-findings', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const sec = findings.find(f => f.id === 'SEC-00001');
    expect(sec).toBeTruthy();
    expect(sec!.isCounterFinding).toBe(false);
  });

  test('parses escalated verdict note', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const sec = findings.find(f => f.id === 'SEC-00001');
    expect(sec).toBeTruthy();
    expect(sec!.verdictNote?.includes('Severity elevated by validator')).toBeTruthy();
  });

  test('parses challenged verdict note', () => {
    const findings = parseReportFindings(SAMPLE_REPORT);
    const perf = findings.find(f => f.id === 'PERF-00004');
    expect(perf).toBeTruthy();
    expect(perf!.verdictNote?.includes('Challenged by validator')).toBeTruthy();
  });

  test('returns empty array for report with no findings', () => {
    const noFindings = `---
reviewId: 2026-04-06-local-x1y2
generated: 2026-04-06T12:00:00.000Z
findingCount: 0
---

# Review Report

_No findings. Clean review._
`;
    const findings = parseReportFindings(noFindings);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: findFindingById (file-based)
// ---------------------------------------------------------------------------

describe('findFindingById', () => {
  let tmpDir: string;
  let reportPath: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rms-fixer-test-'));
    reportPath = join(tmpDir, 'REPORT.md');
    await writeFile(reportPath, SAMPLE_REPORT, 'utf8');
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('finds an existing finding by ID', async () => {
    const finding = await findFindingById(reportPath, 'SEC-00001');
    expect(finding).toBeTruthy();
    expect(finding!.id).toBe('SEC-00001');
    expect(finding!.file).toBe('src/auth.ts');
  });

  test('returns null for unknown finding ID', async () => {
    const finding = await findFindingById(reportPath, 'SEC-99999');
    expect(finding).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Tests: listSessionDirs
// ---------------------------------------------------------------------------

describe('listSessionDirs', () => {
  let reviewsDir: string;

  beforeAll(async () => {
    reviewsDir = await mkdtemp(join(tmpdir(), 'rms-sessions-test-'));
  });

  afterAll(async () => {
    await rm(reviewsDir, { recursive: true, force: true });
  });

  test('returns empty array when .reviews/ is empty', async () => {
    const dirs = await listSessionDirs(reviewsDir);
    expect(dirs).toEqual([]);
  });

  test('returns empty array when .reviews/ does not exist', async () => {
    const dirs = await listSessionDirs('/nonexistent/path/to/reviews');
    expect(dirs).toEqual([]);
  });

  test('returns session directories sorted newest-first', async () => {
    // Create sessions with different mtimes
    const s1 = join(reviewsDir, '2026-04-06-local-aaaa');
    const s2 = join(reviewsDir, '2026-04-06-local-bbbb');
    await mkdir(s1, { recursive: true });
    await mkdir(s2, { recursive: true });

    // Touch s1 to be older, s2 to be newer
    const old = new Date(Date.now() - 10000);
    const newer = new Date();
    await utimes(s1, old, old);
    await utimes(s2, newer, newer);

    const dirs = await listSessionDirs(reviewsDir);
    expect(dirs.indexOf('2026-04-06-local-bbbb') < dirs.indexOf('2026-04-06-local-aaaa')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: findLatestReportPath
// ---------------------------------------------------------------------------

describe('findLatestReportPath', () => {
  let reviewsDir: string;

  beforeAll(async () => {
    reviewsDir = await mkdtemp(join(tmpdir(), 'rms-latest-test-'));
  });

  afterAll(async () => {
    await rm(reviewsDir, { recursive: true, force: true });
  });

  test('returns null when no sessions exist', async () => {
    const result = await findLatestReportPath(reviewsDir);
    expect(result).toBe(null);
  });

  test('returns the latest REPORT.md', async () => {
    const sessionDir = join(reviewsDir, '2026-04-06-local-cccc');
    await mkdir(sessionDir, { recursive: true });
    const reportPath = join(sessionDir, 'REPORT.md');
    await writeFile(reportPath, SAMPLE_REPORT, 'utf8');

    const result = await findLatestReportPath(reviewsDir);
    expect(result).toBeTruthy();
    expect(result!.sessionId).toBe('2026-04-06-local-cccc');
    expect(result!.reportPath).toBe(reportPath);
  });

  test('returns null for specified session that has no REPORT.md', async () => {
    const result = await findLatestReportPath(reviewsDir, 'nonexistent-session');
    expect(result).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Tests: checkStaleness
// ---------------------------------------------------------------------------

describe('checkStaleness', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rms-stale-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('isStale=false when file is older than report', async () => {
    const filePath = join(tmpDir, 'target-old.ts');
    await writeFile(filePath, 'const x = 1;', 'utf8');

    // Set file mtime to 1 hour ago
    const old = new Date(Date.now() - 3600_000);
    await utimes(filePath, old, old);

    // Report mtime is "now"
    const reportMtime = new Date();
    const result = await checkStaleness(filePath, reportMtime);
    expect(result.isStale).toBe(false);
  });

  test('isStale=true when file is newer than report', async () => {
    const filePath = join(tmpDir, 'target-new.ts');
    await writeFile(filePath, 'const x = 2;', 'utf8');

    // Report mtime is 1 hour ago
    const reportMtime = new Date(Date.now() - 3600_000);
    const result = await checkStaleness(filePath, reportMtime);
    expect(result.isStale).toBe(true);
    expect(result.fileMtime instanceof Date).toBeTruthy();
  });

  test('isStale=false when file does not exist', async () => {
    const reportMtime = new Date();
    const result = await checkStaleness('/nonexistent/file.ts', reportMtime);
    expect(result.isStale).toBe(false);
    expect(result.fileMtime).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatFixOutput
// ---------------------------------------------------------------------------

describe('formatFixOutput', () => {
  const finding: ParsedFinding = {
    id: 'SEC-00001',
    file: 'src/auth.ts',
    line: '42',
    dimension: 'SEC',
    severity: 'critical',
    explanation: 'JWT secret not validated.',
    suggestion: 'Use zod to validate at startup.',
    isCounterFinding: false,
  };

  const baseCtx: FixContext = {
    finding,
    sessionId: '2026-04-06-local-a3b7',
    reportPath: '.reviews/2026-04-06-local-a3b7/REPORT.md',
    reportMtime: new Date('2026-04-06T12:00:00Z'),
    isStale: false,
  };

  test('includes finding ID in output', () => {
    const output = formatFixOutput(baseCtx);
    expect(output.includes('SEC-00001')).toBeTruthy();
  });

  test('includes file and line', () => {
    const output = formatFixOutput(baseCtx);
    expect(output.includes('src/auth.ts')).toBeTruthy();
    expect(output.includes('42')).toBeTruthy();
  });

  test('includes explanation and suggestion', () => {
    const output = formatFixOutput(baseCtx);
    expect(output.includes('JWT secret not validated')).toBeTruthy();
    expect(output.includes('Use zod to validate at startup')).toBeTruthy();
  });

  test('includes no stale warning when isStale=false', () => {
    const output = formatFixOutput(baseCtx);
    expect(!output.includes('Warning')).toBeTruthy();
  });

  test('includes stale warning when isStale=true', () => {
    const staleCtx: FixContext = {
      ...baseCtx,
      isStale: true,
      fileMtime: new Date('2026-04-06T13:00:00Z'),
    };
    const output = formatFixOutput(staleCtx);
    expect(output.includes('Warning')).toBeTruthy();
    expect(output.includes('changed since this review')).toBeTruthy();
  });

  test('includes counter-finding label', () => {
    const counterCtx: FixContext = {
      ...baseCtx,
      finding: { ...finding, isCounterFinding: true },
    };
    const output = formatFixOutput(counterCtx);
    expect(output.includes('counter-finding')).toBeTruthy();
  });

  test('includes verdict note when present', () => {
    const withVerdict: FixContext = {
      ...baseCtx,
      finding: { ...finding, verdictNote: 'Challenged by validator: reason' },
    };
    const output = formatFixOutput(withVerdict);
    expect(output.includes('Challenged by validator')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: formatFindingList
// ---------------------------------------------------------------------------

describe('formatFindingList', () => {
  const findings = parseReportFindings(SAMPLE_REPORT);

  test('includes session ID', () => {
    const output = formatFindingList(findings, '2026-04-06-local-a3b7');
    expect(output.includes('2026-04-06-local-a3b7')).toBeTruthy();
  });

  test('includes all finding IDs', () => {
    const output = formatFindingList(findings, '2026-04-06-local-a3b7');
    expect(output.includes('SEC-00001')).toBeTruthy();
    expect(output.includes('BUG-00002')).toBeTruthy();
    expect(output.includes('ERR-00003')).toBeTruthy();
    expect(output.includes('PERF-00004')).toBeTruthy();
  });

  test('groups by severity (critical before high before medium)', () => {
    const output = formatFindingList(findings, '2026-04-06-local-a3b7');
    const critPos = output.indexOf('## Critical');
    const highPos = output.indexOf('## High');
    const medPos = output.indexOf('## Medium');
    expect(critPos < highPos).toBeTruthy();
    expect(highPos < medPos).toBeTruthy();
  });

  test('includes finding count', () => {
    const output = formatFindingList(findings, '2026-04-06-local-a3b7');
    expect(output.includes('4 finding')).toBeTruthy();
  });

  test('returns empty message when no findings', () => {
    const output = formatFindingList([], 'some-session');
    expect(output.includes('No findings')).toBeTruthy();
  });

  test('marks counter-findings in list', () => {
    const output = formatFindingList(findings, '2026-04-06-local-a3b7');
    expect(output.includes('counter-finding')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: getAllFindings (integration)
// ---------------------------------------------------------------------------

describe('getAllFindings', () => {
  let reviewsDir: string;

  beforeAll(async () => {
    reviewsDir = await mkdtemp(join(tmpdir(), 'rms-all-findings-test-'));
    const sessionDir = join(reviewsDir, '2026-04-06-local-dddd');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'REPORT.md'), SAMPLE_REPORT, 'utf8');
  });

  afterAll(async () => {
    await rm(reviewsDir, { recursive: true, force: true });
  });

  test('returns all findings from latest session', async () => {
    const result = await getAllFindings(reviewsDir);
    expect(result).toBeTruthy();
    expect(result!.findings.length).toBe(4);
    expect(result!.sessionId).toBe('2026-04-06-local-dddd');
  });

  test('returns null when no sessions exist', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'rms-empty-'));
    const result = await getAllFindings(emptyDir);
    expect(result).toBe(null);
    await rm(emptyDir, { recursive: true, force: true });
  });
});
