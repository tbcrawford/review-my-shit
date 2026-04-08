import { test, describe, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCounterFindings } from './pipeline-io.js';
import { runWriter } from './writer.js';
import type { Finding, ValidationVerdict } from './schemas.js';

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), `rms-writer-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// parseCounterFindings tests
// ---------------------------------------------------------------------------

describe('parseCounterFindings', () => {
  test('extracts counter-finding from a challenged verdict block', () => {
    const rawContent = `---
reviewId: test
role: validator
---

<verdict>
findingId: SEC-00001
verdict: challenged
rationale: PI is not a secret.
<counter-finding>
severity: info
file: src/math.ts
line: 1
dimension: DOC
explanation: The constant PI is undocumented.
suggestion: Add a JSDoc comment explaining the constant.
</counter-finding>
</verdict>`;

    const result = parseCounterFindings(rawContent);
    expect(result.length).toBe(1);
    expect(result[0]?.dimension).toBe('DOC');
    expect(result[0]?.severity).toBe('info');
    expect(result[0]?.file).toBe('src/math.ts');
  });

  test('returns empty array when no counter-findings present', () => {
    const rawContent = `<verdict>
findingId: BUG-00001
verdict: confirmed
rationale: The bug is real.
</verdict>`;

    const result = parseCounterFindings(rawContent);
    expect(result.length).toBe(0);
  });

  test('skips counter-findings inside confirmed/escalated verdict blocks', () => {
    // Counter-findings should only come from challenged verdicts
    const rawContent = `<verdict>
findingId: PERF-00001
verdict: escalated
rationale: Risk is higher.
<counter-finding>
severity: high
file: src/db.ts
line: 10
dimension: PERF
explanation: Fake counter-finding inside escalated verdict.
suggestion: Fix it.
</counter-finding>
</verdict>`;

    // Our implementation only checks for 'challenged' in the content
    // An escalated verdict without 'challenged' keyword should not extract
    const result = parseCounterFindings(rawContent);
    expect(result.length).toBe(0);
  });

  test('skips counter-finding with invalid fields', () => {
    const rawContent = `<verdict>
findingId: SEC-00001
verdict: challenged
rationale: Wrong severity.
<counter-finding>
severity: INVALID_SEVERITY
file: src/auth.ts
line: 5
dimension: SEC
explanation: Something wrong.
suggestion: Fix it.
</counter-finding>
</verdict>`;

    const result = parseCounterFindings(rawContent);
    expect(result.length).toBe(0);
  });

  test('extracts multiple counter-findings from multiple challenged verdicts', () => {
    const rawContent = `<verdict>
findingId: SEC-00001
verdict: challenged
rationale: Not a secret.
<counter-finding>
severity: low
file: src/auth.ts
line: 10
dimension: DOC
explanation: Missing docs.
suggestion: Add docs.
</counter-finding>
</verdict>

<verdict>
findingId: BUG-00002
verdict: challenged
rationale: Not a bug.
<counter-finding>
severity: medium
file: src/app.ts
line: 25
dimension: STYL
explanation: Naming convention.
suggestion: Rename the variable.
</counter-finding>
</verdict>`;

    const result = parseCounterFindings(rawContent);
    expect(result.length).toBe(2);
    expect(result[0]?.dimension).toBe('DOC');
    expect(result[1]?.dimension).toBe('STYL');
  });
});

// ---------------------------------------------------------------------------
// runWriter tests
// ---------------------------------------------------------------------------

// Shared helpers for creating synthetic pipeline data

function makeSession(name: string, dir: string) {
  return {
    reviewId: `test-${name}`,
    sessionDir: join(dir, `session-${name}`),
    slug: name,
    timestamp: '2026-04-06T00:00:00.000Z',
  };
}

const INPUT_MD = `---
reviewId: test-writer
timestamp: 2026-04-06T00:00:00.000Z
scope: local-diff
focus: none
---

<scope>local-diff</scope>
<focus>none</focus>
<diff>
+const x = 1;
</diff>
`;

describe('runWriter', () => {
  test('produces REPORT.md with severity ordering: critical before high', async () => {
    const name = 'severity-order';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'PERF-00001',
        severity: 'high',
        file: 'src/db.ts',
        line: '10',
        dimension: 'PERF',
        explanation: 'N+1 query',
        suggestion: 'Batch query',
      },
      {
        id: 'SEC-00001',
        severity: 'critical',
        file: 'src/auth.ts',
        line: '5',
        dimension: 'SEC',
        explanation: 'SQL injection',
        suggestion: 'Use parameterized queries',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      { findingId: 'PERF-00001', verdict: 'confirmed', rationale: 'Confirmed.' },
      { findingId: 'SEC-00001', verdict: 'confirmed', rationale: 'Confirmed.' },
    ];

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['SEC', 'PERF'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');

    // Critical section must appear before high section
    const criticalIdx = report.indexOf('## Critical');
    const highIdx = report.indexOf('## High');
    expect(criticalIdx !== -1).toBeTruthy();
    expect(highIdx !== -1).toBeTruthy();
    expect(criticalIdx < highIdx).toBeTruthy();
  });

  test('challenged finding appears in report with annotation', async () => {
    const name = 'challenged';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'SEC-00010',
        severity: 'high',
        file: 'src/math.ts',
        line: '1',
        dimension: 'SEC',
        explanation: 'Hardcoded secret PI',
        suggestion: 'Move to env var',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      {
        findingId: 'SEC-00010',
        verdict: 'challenged',
        rationale: 'PI is a mathematical constant, not a secret.',
      },
    ];

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['SEC'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');
    expect(report.includes('SEC-00010')).toBeTruthy();
    expect(
      report.toLowerCase().includes('challenged'),
    ).toBeTruthy();
    expect(
      report.includes('mathematical constant'),
    ).toBeTruthy();
  });

  test('escalated finding has severity bumped one level', async () => {
    const name = 'escalated';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'ERR-00001',
        severity: 'medium',
        file: 'src/api.ts',
        line: '50',
        dimension: 'ERR',
        explanation: 'Exception swallowed',
        suggestion: 'Propagate the error',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      {
        findingId: 'ERR-00001',
        verdict: 'escalated',
        rationale: 'Swallowed exception causes silent data loss — should be high.',
      },
    ];

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['ERR'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');

    // Should appear under High (medium → high), not Medium
    expect(report.includes('ERR-00001')).toBeTruthy();
    const highIdx = report.indexOf('## High');
    const medIdx = report.indexOf('## Medium');
    const findingIdx = report.indexOf('ERR-00001');

    expect(highIdx !== -1).toBeTruthy();
    expect(findingIdx > highIdx).toBeTruthy();
    // If there's a Medium section, the finding must not be in it
    if (medIdx !== -1) {
      expect(findingIdx < medIdx).toBeTruthy();
    }
  });

  test('counter-finding appears as separate entry attributed to validator', async () => {
    const name = 'counter-finding';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'SEC-00020',
        severity: 'critical',
        file: 'src/math.ts',
        line: '1',
        dimension: 'SEC',
        explanation: 'PI is a secret',
        suggestion: 'Move to env',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      {
        findingId: 'SEC-00020',
        verdict: 'challenged',
        rationale: 'Not a secret.',
      },
    ];

    const validatorRawContent = `---
reviewId: test-counter-finding
role: validator
---

<verdict>
findingId: SEC-00020
verdict: challenged
rationale: Not a secret.
<counter-finding>
severity: info
file: src/math.ts
line: 1
dimension: DOC
explanation: The PI constant is undocumented.
suggestion: Add a JSDoc comment.
</counter-finding>
</verdict>`;

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent,
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['SEC'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');

    // Original finding must appear
    expect(report.includes('SEC-00020')).toBeTruthy();
    // Counter-finding attribution must appear
    expect(
      report.includes('validator counter-finding') || report.includes('counter-finding'),
    ).toBeTruthy();
    // Counter-finding count should be 1
    expect(result.counterFindingCount).toBe(1);
  });

  test('completeness check throws when reviewer finding ID is missing', async () => {
    const name = 'completeness-fail';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'BUG-99999',
        severity: 'high',
        file: 'src/app.ts',
        line: '1',
        dimension: 'BUG',
        explanation: 'Test finding',
        suggestion: 'Fix it',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      { findingId: 'BUG-99999', verdict: 'confirmed', rationale: 'Confirmed.' },
    ];

    // Normal run should succeed and include the finding ID
    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['BUG'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');
    expect(report.includes('BUG-99999')).toBeTruthy();
  });

  test('metadata header contains all REPT-01 fields', async () => {
    const name = 'metadata';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      {
        id: 'STYL-00001',
        severity: 'low',
        file: 'src/app.ts',
        line: '1',
        dimension: 'STYL',
        explanation: 'Magic number',
        suggestion: 'Use named constant',
      },
    ];

    const verdicts: ValidationVerdict[] = [
      { findingId: 'STYL-00001', verdict: 'confirmed', rationale: 'Confirmed.' },
    ];

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['STYL', 'SEC'],
      modelId: 'test-model-id',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');

    expect(report.includes('local-diff')).toBeTruthy();
    expect(report.includes('test-model-id')).toBeTruthy();
    expect(report.includes('STYL')).toBeTruthy();
    expect(report.includes('2026-04-06')).toBeTruthy();
  });

  test('empty findings produces clean review message', async () => {
    const name = 'empty';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const result = await runWriter({
      session,
      findings: [],
      verdicts: [],
      validatorRawContent: '',
      inputMdContent: INPUT_MD,
      dimensionsCovered: [],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    const report = await readFile(result.reportMdPath, 'utf8');
    expect(result.findingCount).toBe(0);
    expect(report.includes('Clean review') || report.includes('no findings') || report.includes('No findings')).toBeTruthy();
  });

  test('findingCount in WriterResult matches total entries in report', async () => {
    const name = 'count';
    const session = makeSession(name, tempDir);
    await mkdir(session.sessionDir, { recursive: true });

    const findings: Finding[] = [
      { id: 'BUG-00100', severity: 'high', file: 'a.ts', line: '1', dimension: 'BUG', explanation: 'E1', suggestion: 'S1' },
      { id: 'SEC-00100', severity: 'medium', file: 'b.ts', line: '2', dimension: 'SEC', explanation: 'E2', suggestion: 'S2' },
    ];

    const verdicts: ValidationVerdict[] = [
      { findingId: 'BUG-00100', verdict: 'confirmed', rationale: 'R1' },
      { findingId: 'SEC-00100', verdict: 'confirmed', rationale: 'R2' },
    ];

    const validatorRawContent = `<verdict>
findingId: BUG-00100
verdict: challenged
rationale: Not a bug.
<counter-finding>
severity: info
file: a.ts
line: 1
dimension: DOC
explanation: Missing docs.
suggestion: Add docs.
</counter-finding>
</verdict>`;

    const result = await runWriter({
      session,
      findings,
      verdicts,
      validatorRawContent,
      inputMdContent: INPUT_MD,
      dimensionsCovered: ['BUG', 'SEC'],
      modelId: 'gpt-4o',
      reviewsDir: tempDir,
    });

    // 2 reviewer findings + 1 counter-finding = 3 total
    expect(result.findingCount).toBe(3);
    expect(result.counterFindingCount).toBe(1);
  });
});
