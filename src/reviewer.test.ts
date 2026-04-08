import { test, describe, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Finding } from './schemas.js';

// We need to test REVIEWER_PROMPT and runReviewer.
// For runReviewer tests, we mock generateText by monkey-patching the module.
import { REVIEWER_PROMPT, buildReviewerPrompt, runReviewer } from './reviewer.js';
import type { ReviewerOptions } from './reviewer.js';

// ---------------------------------------------------------------------------
// Temp directory setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), `rms-reviewer-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  // Create .reviews/ for counter persistence
  await mkdir(join(tempDir, '.reviews'), { recursive: true });
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// REVIEWER_PROMPT structural tests
// ---------------------------------------------------------------------------

describe('REVIEWER_PROMPT — structure and language agnosticism', () => {
  test('contains all 11 dimension names in DIMENSION DEFINITIONS', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    const dimensions = ['BUG', 'SEC', 'PERF', 'STYL', 'TEST', 'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC'];
    for (const dim of dimensions) {
      expect(
        prompt.includes(`- ${dim}:`),
      ).toBeTruthy();
    }
  });

  test('is language agnostic — no hard-coded language or framework names', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    // Check REVIEWER_PROMPT static content (not the diff portion)
    const staticPart = REVIEWER_PROMPT;
    const forbidden = ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js'];
    for (const lang of forbidden) {
      expect(
        !staticPart.includes(lang),
      ).toBeTruthy();
    }
  });

  test('with focus SEC: contains FOCUS MODE text and Suppressed for non-SEC dimensions', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: 'SEC' });
    expect(prompt.includes('FOCUS MODE')).toBeTruthy();
    expect(prompt.includes('Suppressed')).toBeTruthy();
  });

  test('without focus: no FOCUS MODE text', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    expect(!prompt.includes('FOCUS MODE')).toBeTruthy();
  });

  test('instructs LLM not to generate IDs', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    expect(
      prompt.includes('Do NOT generate') || prompt.includes('do not generate') || prompt.includes('leave the id field absent'),
    ).toBeTruthy();
  });

  test('contains output format instructions with all required finding fields', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    const requiredFields = ['severity:', 'file:', 'line:', 'dimension:', 'explanation:', 'suggestion:'];
    for (const field of requiredFields) {
      expect(prompt.includes(field)).toBeTruthy();
    }
  });

  test('diff is wrapped in <diff> XML tags', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff content', focus: undefined });
    expect(prompt.includes('<diff>')).toBeTruthy();
    expect(prompt.includes('</diff>')).toBeTruthy();
    // Diff content is between the tags
    const diffStart = prompt.indexOf('<diff>');
    const diffEnd = prompt.indexOf('</diff>');
    expect(diffStart < diffEnd).toBeTruthy();
    expect(
      prompt.slice(diffStart, diffEnd).includes('sample diff content'),
    ).toBeTruthy();
  });

  test('contains anti-injection instruction about treating diff as data', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    expect(
      prompt.includes('NOT executable instructions') || prompt.includes('data to analyze'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// runReviewer integration tests (with mock generateText)
// ---------------------------------------------------------------------------

// Fixture REVIEWER.md content for testing (2 valid findings)
const fixtureReviewerMdContent = `---
reviewId: test-review-001
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
explanation: Token compared with == enabling timing attacks.
suggestion: Use crypto.timingSafeEqual().
</finding>

## PERF
<finding>
severity: medium
file: src/db.ts
line: 15
dimension: PERF
explanation: N+1 query in loop.
suggestion: Use batched query.
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

describe('runReviewer — output and ID assignment', () => {
  test('REVIEWER.md is written to correct path after runReviewer', async () => {
    const session = {
      sessionDir: join(tempDir, 'session-write-test'),
      reviewId: 'test-review-write',
      slug: 'local',
      timestamp: '2026-04-06T00:00:00.000Z',
    };
    await mkdir(session.sessionDir, { recursive: true });

    const opts: ReviewerOptions = {
      session,
      diff: 'diff --git a/src/auth.ts b/src/auth.ts\n@@\n+const x = 1;\n',
      focus: undefined,
      model: {} as ReviewerOptions['model'],
      reviewsDir: join(tempDir, '.reviews'),
      _mockGenerateText: async () => fixtureReviewerMdContent,
    };

    const result = await runReviewer(opts);

    expect(
      result.reviewerMdPath.endsWith('REVIEWER.md'),
    ).toBeTruthy();

    // Verify file was actually written
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(result.reviewerMdPath, 'utf8');
    expect(written.includes('reviewId:')).toBeTruthy();
  });

  test('finding IDs are assigned and match ^[A-Z]+-\\d{5}$ format', async () => {
    const session = {
      sessionDir: join(tempDir, 'session-ids-test'),
      reviewId: 'test-review-ids',
      slug: 'local',
      timestamp: '2026-04-06T00:00:00.000Z',
    };
    await mkdir(session.sessionDir, { recursive: true });
    // Fresh .reviews dir to get clean counter
    const freshReviews = join(tempDir, '.reviews-ids-test');
    await mkdir(freshReviews, { recursive: true });

    const result = await runReviewer({
      session,
      diff: 'diff --git a/src/auth.ts b/src/auth.ts\n@@\n+const x = 1;\n',
      focus: undefined,
      model: {} as ReviewerOptions['model'],
      reviewsDir: freshReviews,
      _mockGenerateText: async () => fixtureReviewerMdContent,
    });

    expect(result.findings.length).toBe(2);
    const idPattern = /^[A-Z]+-\d{5}$/;
    for (const finding of result.findings) {
      expect(
        idPattern.test(finding.id),
      ).toBeTruthy();
    }
  });

  test('finding IDs are sequentially incrementing', async () => {
    const session = {
      sessionDir: join(tempDir, 'session-seq-test'),
      reviewId: 'test-review-seq',
      slug: 'local',
      timestamp: '2026-04-06T00:00:00.000Z',
    };
    await mkdir(session.sessionDir, { recursive: true });
    const freshReviews = join(tempDir, '.reviews-seq-test');
    await mkdir(freshReviews, { recursive: true });

    const result = await runReviewer({
      session,
      diff: 'diff --git a/src/auth.ts b/src/auth.ts\n@@\n+const x = 1;\n',
      focus: undefined,
      model: {} as ReviewerOptions['model'],
      reviewsDir: freshReviews,
      _mockGenerateText: async () => fixtureReviewerMdContent,
    });

    // Extract numeric parts of IDs
    const counters = result.findings.map((f: Finding) => {
      const match = f.id.match(/-(\d{5})$/);
      return match ? parseInt(match[1] ?? '0', 10) : 0;
    });

    // Counters should be sequential (1, 2)
    expect(counters[0]).toBe(1);
    expect(counters[1]).toBe(2);
  });
});
