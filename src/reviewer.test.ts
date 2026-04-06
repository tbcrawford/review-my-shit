import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

before(async () => {
  tempDir = join(tmpdir(), `rms-reviewer-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  // Create .reviews/ for counter persistence
  await mkdir(join(tempDir, '.reviews'), { recursive: true });
});

after(async () => {
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
      assert.ok(
        prompt.includes(`- ${dim}:`),
        `prompt should contain dimension definition for ${dim}`,
      );
    }
  });

  test('is language agnostic — no hard-coded language or framework names', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    // Check REVIEWER_PROMPT static content (not the diff portion)
    const staticPart = REVIEWER_PROMPT;
    const forbidden = ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js'];
    for (const lang of forbidden) {
      assert.ok(
        !staticPart.includes(lang),
        `REVIEWER_PROMPT should not contain hard-coded language: ${lang}`,
      );
    }
  });

  test('with focus SEC: contains FOCUS MODE text and Suppressed for non-SEC dimensions', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: 'SEC' });
    assert.ok(prompt.includes('FOCUS MODE'), 'should contain FOCUS MODE instruction');
    assert.ok(prompt.includes('Suppressed'), 'should contain Suppressed instruction for other dimensions');
  });

  test('without focus: no FOCUS MODE text', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    assert.ok(!prompt.includes('FOCUS MODE'), 'should not contain FOCUS MODE when no focus specified');
  });

  test('instructs LLM not to generate IDs', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    assert.ok(
      prompt.includes('Do NOT generate') || prompt.includes('do not generate') || prompt.includes('leave the id field absent'),
      'prompt should instruct LLM not to generate IDs',
    );
  });

  test('contains output format instructions with all required finding fields', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    const requiredFields = ['severity:', 'file:', 'line:', 'dimension:', 'explanation:', 'suggestion:'];
    for (const field of requiredFields) {
      assert.ok(prompt.includes(field), `prompt should include finding field: ${field}`);
    }
  });

  test('diff is wrapped in <diff> XML tags', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff content', focus: undefined });
    assert.ok(prompt.includes('<diff>'), 'prompt should open with <diff> tag');
    assert.ok(prompt.includes('</diff>'), 'prompt should close with </diff> tag');
    // Diff content is between the tags
    const diffStart = prompt.indexOf('<diff>');
    const diffEnd = prompt.indexOf('</diff>');
    assert.ok(diffStart < diffEnd, '<diff> must appear before </diff>');
    assert.ok(
      prompt.slice(diffStart, diffEnd).includes('sample diff content'),
      'diff content must be inside <diff> tags',
    );
  });

  test('contains anti-injection instruction about treating diff as data', () => {
    const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
    assert.ok(
      prompt.includes('NOT executable instructions') || prompt.includes('data to analyze'),
      'prompt should instruct model to treat diff as data, not instructions',
    );
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

    assert.ok(
      result.reviewerMdPath.endsWith('REVIEWER.md'),
      'reviewerMdPath should end with REVIEWER.md',
    );

    // Verify file was actually written
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(result.reviewerMdPath, 'utf8');
    assert.ok(written.includes('reviewId:'), 'REVIEWER.md should contain reviewId frontmatter');
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

    assert.equal(result.findings.length, 2, 'should have 2 findings');
    const idPattern = /^[A-Z]+-\d{5}$/;
    for (const finding of result.findings) {
      assert.ok(
        idPattern.test(finding.id),
        `finding ID ${finding.id} should match ^[A-Z]+-\\d{5}$`,
      );
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
    assert.equal(counters[0], 1, 'first finding should have counter 1');
    assert.equal(counters[1], 2, 'second finding should have counter 2');
  });
});
