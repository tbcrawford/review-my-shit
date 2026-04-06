import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeInputFile, parseReviewerOutput } from './pipeline-io.js';

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tempDir: string;

before(async () => {
  tempDir = join(tmpdir(), `rms-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// writeInputFile tests
// ---------------------------------------------------------------------------

describe('writeInputFile', () => {
  test('with focus defined: contains focus in frontmatter and XML body', async () => {
    const sessionDir = join(tempDir, 'session-with-focus');
    await mkdir(sessionDir, { recursive: true });

    await writeInputFile({
      sessionDir,
      reviewId: 'test-review-1',
      timestamp: '2026-04-06T00:00:00.000Z',
      scope: 'local-diff',
      focus: 'security',
      diff: '+const x = 1;\n',
    });

    const content = await readFile(join(sessionDir, 'INPUT.md'), 'utf8');

    // Frontmatter must contain focus line
    assert.ok(content.includes('focus: security'), 'frontmatter should contain focus: security');
    // XML body must contain <focus>security</focus>
    assert.ok(content.includes('<focus>security</focus>'), 'body should contain <focus>security</focus>');
  });

  test('without focus: no focus line in frontmatter, <focus>none</focus> in body', async () => {
    const sessionDir = join(tempDir, 'session-no-focus');
    await mkdir(sessionDir, { recursive: true });

    await writeInputFile({
      sessionDir,
      reviewId: 'test-review-2',
      timestamp: '2026-04-06T00:00:00.000Z',
      scope: 'local-diff',
      diff: '+const y = 2;\n',
    });

    const content = await readFile(join(sessionDir, 'INPUT.md'), 'utf8');

    // Frontmatter must NOT have a focus: line
    // The frontmatter section is between the first --- and second ---
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatterMatch, 'file should have frontmatter');
    const frontmatter = frontmatterMatch[1] ?? '';
    assert.ok(!frontmatter.includes('focus:'), 'frontmatter should not have focus: line when undefined');

    // Body should have <focus>none</focus>
    assert.ok(content.includes('<focus>none</focus>'), 'body should have <focus>none</focus>');
  });

  test('diff content appears verbatim inside <diff>...</diff> tags', async () => {
    const sessionDir = join(tempDir, 'session-diff-verbatim');
    await mkdir(sessionDir, { recursive: true });

    const diffContent = `diff --git a/src/app.ts b/src/app.ts\n@@\n-old\n+new line with special chars: <>&"'\n`;

    await writeInputFile({
      sessionDir,
      reviewId: 'test-review-3',
      timestamp: '2026-04-06T00:00:00.000Z',
      scope: 'local-diff',
      diff: diffContent,
    });

    const content = await readFile(join(sessionDir, 'INPUT.md'), 'utf8');

    // Diff must appear verbatim (no escaping)
    assert.ok(content.includes('<diff>'), 'should have opening <diff> tag');
    assert.ok(content.includes('</diff>'), 'should have closing </diff> tag');
    assert.ok(content.includes(diffContent), 'diff content should appear verbatim');
  });
});

// ---------------------------------------------------------------------------
// parseReviewerOutput tests
// ---------------------------------------------------------------------------

const fixtureReviewerWithFindings = `---
reviewId: test-parse-1
role: reviewer
---

## BUG
No BUG issues found.

## SEC
<finding>
severity: high
file: src/auth.ts
line: 42
dimension: SEC
explanation: Token compared with == instead of timing-safe comparison.
suggestion: Use crypto.timingSafeEqual() for token comparison.
</finding>

## PERF
<finding>
severity: medium
file: src/db.ts
line: 15-20
dimension: PERF
explanation: N+1 query pattern inside loop causes excessive database calls.
suggestion: Use a batched query with WHERE id IN (...) instead.
</finding>

## STYL
No STYL issues found.

## TEST
No TEST issues found.

## ARCH
No ARCH issues found.

## ERR
No ERR issues found.

## DATA
No DATA issues found.

## API
No API issues found.

## DEP
No DEP issues found.

## DOC
No DOC issues found.
`;

const fixtureReviewerWithInvalidFinding = `---
reviewId: test-parse-2
role: reviewer
---

## BUG
<finding>
severity: critical
file: src/index.ts
line: 10
dimension: BUG
explanation: Null dereference on user object.
suggestion: Add null check before accessing user.id.
</finding>

## SEC
<finding>
severity: high
file: src/auth.ts
dimension: SEC
explanation: Missing file field — this finding is invalid.
suggestion: Fix it.
</finding>

## PERF
No PERF issues found.

## STYL
No STYL issues found.

## TEST
No TEST issues found.

## ARCH
No ARCH issues found.

## ERR
No ERR issues found.

## DATA
No DATA issues found.

## API
No API issues found.

## DEP
No DEP issues found.

## DOC
No DOC issues found.
`;

describe('parseReviewerOutput', () => {
  test('2-finding fixture: returns array with 2 items, correct fields', async () => {
    const fixturePath = join(tempDir, 'REVIEWER-2findings.md');
    await writeFile(fixturePath, fixtureReviewerWithFindings, 'utf8');

    const result = await parseReviewerOutput(fixturePath);

    assert.equal(result.findings.length, 2);

    const secFinding = result.findings.find((f: { dimension: string }) => f.dimension === 'SEC');
    assert.ok(secFinding, 'should have SEC finding');
    assert.equal(secFinding.severity, 'high');
    assert.equal(secFinding.file, 'src/auth.ts');
    assert.equal(secFinding.line, '42');

    const perfFinding = result.findings.find((f: { dimension: string }) => f.dimension === 'PERF');
    assert.ok(perfFinding, 'should have PERF finding');
    assert.equal(perfFinding.severity, 'medium');
    assert.equal(perfFinding.file, 'src/db.ts');
    assert.equal(perfFinding.line, '15-20');
  });

  test('invalid finding (missing file field) is skipped, valid ones kept', async () => {
    const fixturePath = join(tempDir, 'REVIEWER-invalid.md');
    await writeFile(fixturePath, fixtureReviewerWithInvalidFinding, 'utf8');

    const result = await parseReviewerOutput(fixturePath);

    // SEC finding missing 'line' field is invalid → skipped
    // BUG finding is valid → kept
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.dimension, 'BUG');
  });

  test('dimensionsCovered reflects ## DIMENSION section headers present', async () => {
    const fixturePath = join(tempDir, 'REVIEWER-dims.md');
    await writeFile(fixturePath, fixtureReviewerWithFindings, 'utf8');

    const result = await parseReviewerOutput(fixturePath);

    // All 11 dimension headers present in the fixture
    assert.ok(result.dimensionsCovered.includes('BUG'), 'should cover BUG');
    assert.ok(result.dimensionsCovered.includes('SEC'), 'should cover SEC');
    assert.ok(result.dimensionsCovered.includes('PERF'), 'should cover PERF');
    assert.equal(result.dimensionsCovered.length, 11);
  });

  test('dimensionsWithFindings tracks only dimensions that have parsed findings', async () => {
    const fixturePath = join(tempDir, 'REVIEWER-with-findings.md');
    await writeFile(fixturePath, fixtureReviewerWithFindings, 'utf8');

    const result = await parseReviewerOutput(fixturePath);

    assert.ok(result.dimensionsWithFindings.includes('SEC'));
    assert.ok(result.dimensionsWithFindings.includes('PERF'));
    assert.ok(!result.dimensionsWithFindings.includes('BUG'), 'BUG had no findings');
    assert.equal(result.dimensionsWithFindings.length, 2);
  });
});
