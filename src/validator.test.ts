import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VALIDATOR_PROMPT, buildValidatorPrompt, runValidator } from './validator.js';

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tempDir: string;

before(async () => {
  tempDir = join(tmpdir(), `rms-validator-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// VALIDATOR_PROMPT static tests
// ---------------------------------------------------------------------------

describe('VALIDATOR_PROMPT', () => {
  test('contains adversarial "challenge" framing', () => {
    assert.ok(
      VALIDATOR_PROMPT.includes('challenge'),
      'Prompt must contain adversarial "challenge" framing',
    );
  });

  test('contains all three verdict types: confirmed, challenged, escalated', () => {
    assert.ok(VALIDATOR_PROMPT.includes('confirmed'), 'Prompt must define "confirmed" verdict');
    assert.ok(VALIDATOR_PROMPT.includes('challenged'), 'Prompt must define "challenged" verdict');
    assert.ok(VALIDATOR_PROMPT.includes('escalated'), 'Prompt must define "escalated" verdict');
  });

  test('is language agnostic — no specific framework or language names', () => {
    const forbidden = ['JavaScript', 'Python', 'TypeScript', 'React', 'Django'];
    for (const name of forbidden) {
      assert.ok(
        !VALIDATOR_PROMPT.includes(name),
        `Prompt must not mention "${name}" — must be language agnostic`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// buildValidatorPrompt tests
// ---------------------------------------------------------------------------

describe('buildValidatorPrompt', () => {
  test('interpolates reviewerMdContent and inputMdContent into the prompt', () => {
    const prompt = buildValidatorPrompt({
      reviewerMdContent: 'REVIEWER_CONTENT_SENTINEL',
      inputMdContent: 'INPUT_CONTENT_SENTINEL',
    });

    assert.ok(
      prompt.includes('REVIEWER_CONTENT_SENTINEL'),
      'Built prompt must contain reviewerMdContent',
    );
    assert.ok(
      prompt.includes('INPUT_CONTENT_SENTINEL'),
      'Built prompt must contain inputMdContent',
    );
  });
});

// ---------------------------------------------------------------------------
// runValidator integration tests (with _mockGenerateText)
// ---------------------------------------------------------------------------

describe('runValidator', () => {
  test('with 2 verdict mock: writes VALIDATOR.md with correct frontmatter and returns 2 verdicts', async () => {
    const sessionDir = join(tempDir, 'session-2verdicts');
    await mkdir(sessionDir, { recursive: true });

    const session = {
      reviewId: 'test-2verdicts',
      sessionDir,
      slug: 'test-2verdicts',
      timestamp: '2026-04-06T00:00:00.000Z',
    };

    // Write synthetic REVIEWER.md and INPUT.md
    await writeFile(
      join(sessionDir, 'REVIEWER.md'),
      `---\nreviewId: test-2verdicts\nrole: reviewer\n---\n\n<finding>\nseverity: high\nfile: src/auth.ts\nline: 42\ndimension: SEC\nexplanation: Token compared with ==\nsuggestion: Use timingSafeEqual\n</finding>\n\n<finding>\nseverity: medium\nfile: src/db.ts\nline: 15\ndimension: PERF\nexplanation: N+1 query\nsuggestion: Batch query\n</finding>\n`,
      'utf8',
    );
    await writeFile(
      join(sessionDir, 'INPUT.md'),
      `---\nreviewId: test-2verdicts\ntimestamp: 2026-04-06T00:00:00.000Z\nscope: local-diff\n---\n\n<diff>\n+const x = 1;\n</diff>\n`,
      'utf8',
    );

    const mockResponse = `<verdict>
findingId: SEC-00001
verdict: confirmed
rationale: Token comparison with == is not timing-safe.
</verdict>

<verdict>
findingId: PERF-00001
verdict: confirmed
rationale: N+1 query pattern confirmed in the loop.
</verdict>`;

    const result = await runValidator({
      session,
      reviewerMdPath: join(sessionDir, 'REVIEWER.md'),
      inputMdPath: join(sessionDir, 'INPUT.md'),
      model: null as never, // not used — mock overrides
      _mockGenerateText: async () => mockResponse,
    });

    assert.equal(result.verdictCount, 2);
    assert.equal(result.verdicts.length, 2);
    assert.ok(result.validatorMdPath.includes('VALIDATOR.md'));

    // Verify frontmatter in written file
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(result.validatorMdPath, 'utf8');
    assert.ok(written.includes('reviewId: test-2verdicts'), 'VALIDATOR.md must contain reviewId');
    assert.ok(written.includes('role: validator'), 'VALIDATOR.md must contain role: validator');
  });

  test('with 1 verdict mock: verdictCount === 1', async () => {
    const sessionDir = join(tempDir, 'session-1verdict');
    await mkdir(sessionDir, { recursive: true });

    const session = {
      reviewId: 'test-1verdict',
      sessionDir,
      slug: 'test-1verdict',
      timestamp: '2026-04-06T00:00:00.000Z',
    };

    await writeFile(
      join(sessionDir, 'REVIEWER.md'),
      `---\nreviewId: test-1verdict\nrole: reviewer\n---\n\n<finding>\nseverity: low\nfile: src/app.ts\nline: 5\ndimension: STYL\nexplanation: Magic number\nsuggestion: Use named constant\n</finding>\n`,
      'utf8',
    );
    await writeFile(
      join(sessionDir, 'INPUT.md'),
      `---\nreviewId: test-1verdict\ntimestamp: 2026-04-06T00:00:00.000Z\nscope: local-diff\n---\n\n<diff>\n+const x = 42;\n</diff>\n`,
      'utf8',
    );

    const mockResponse = `<verdict>
findingId: STYL-00001
verdict: confirmed
rationale: Magic number 42 should be a named constant.
</verdict>`;

    const result = await runValidator({
      session,
      reviewerMdPath: join(sessionDir, 'REVIEWER.md'),
      inputMdPath: join(sessionDir, 'INPUT.md'),
      model: null as never,
      _mockGenerateText: async () => mockResponse,
    });

    assert.equal(result.verdictCount, 1);
    assert.equal(result.verdicts[0]?.verdict, 'confirmed');
  });
});

// ---------------------------------------------------------------------------
// Empirical independence tests (D-10)
// ---------------------------------------------------------------------------

// Synthetic REVIEWER.md with an absurd false-positive: PI = 3.14159 flagged as
// a "hardcoded secret" at critical severity.
const absurdReviewerMd = `---
reviewId: test-empirical
role: reviewer
---

## SEC

<finding>
severity: critical
file: src/math.ts
line: 1
dimension: SEC
explanation: Hardcoded secret exposed: PI value is hardcoded in source code
suggestion: Move PI to environment variable to prevent exposure
</finding>
`;

// Benign INPUT.md showing only a mathematical constant being added.
const benignInputMd = `---
reviewId: test-empirical
timestamp: 2026-04-06T00:00:00Z
scope: local-diff
---

<diff>
diff --git a/src/math.ts b/src/math.ts
+const PI = 3.14159;
</diff>
`;

describe('empirical independence (D-10)', () => {
  test('pipeline accepts and returns challenged verdict for absurd false-positive', async () => {
    const sessionDir = join(tempDir, 'session-empirical-challenged');
    await mkdir(sessionDir, { recursive: true });

    const session = {
      reviewId: 'test-empirical',
      sessionDir,
      slug: 'test-empirical',
      timestamp: '2026-04-06T00:00:00.000Z',
    };

    await writeFile(join(sessionDir, 'REVIEWER.md'), absurdReviewerMd, 'utf8');
    await writeFile(join(sessionDir, 'INPUT.md'), benignInputMd, 'utf8');

    // Mock simulates a validator that correctly challenges the absurd finding
    const challengedMock = `<verdict>
findingId: SEC-00001
verdict: challenged
rationale: PI = 3.14159 is a mathematical constant, not a secret. This is a false positive.
</verdict>`;

    const result = await runValidator({
      session,
      reviewerMdPath: join(sessionDir, 'REVIEWER.md'),
      inputMdPath: join(sessionDir, 'INPUT.md'),
      model: null as never,
      _mockGenerateText: async () => challengedMock,
    });

    assert.equal(result.verdicts.length, 1);
    assert.equal(
      result.verdicts[0]?.verdict,
      'challenged',
      'Absurd false-positive must be challengeable through the pipeline',
    );
  });

  test('baseline contrast: naive confirmed mock returns confirmed verdict', async () => {
    const sessionDir = join(tempDir, 'session-empirical-confirmed');
    await mkdir(sessionDir, { recursive: true });

    const session = {
      reviewId: 'test-empirical-b',
      sessionDir,
      slug: 'test-empirical-b',
      timestamp: '2026-04-06T00:00:00.000Z',
    };

    await writeFile(join(sessionDir, 'REVIEWER.md'), absurdReviewerMd, 'utf8');
    await writeFile(join(sessionDir, 'INPUT.md'), benignInputMd, 'utf8');

    // Mock simulates a naive pass-through that rubber-stamps everything
    const confirmedMock = `<verdict>
findingId: SEC-00001
verdict: confirmed
rationale: Confirmed — PI is hardcoded, could be a secret.
</verdict>`;

    const result = await runValidator({
      session,
      reviewerMdPath: join(sessionDir, 'REVIEWER.md'),
      inputMdPath: join(sessionDir, 'INPUT.md'),
      model: null as never,
      _mockGenerateText: async () => confirmedMock,
    });

    assert.equal(result.verdicts[0]?.verdict, 'confirmed');
  });

  test('prompt framing: VALIDATOR_PROMPT contains "challenge" and "rubber-stamp"', () => {
    assert.ok(
      VALIDATOR_PROMPT.includes('challenge'),
      'Prompt must contain adversarial "challenge" instruction',
    );
    assert.ok(
      VALIDATOR_PROMPT.includes('rubber-stamp'),
      'Prompt must instruct against rubber-stamping',
    );
  });
});
