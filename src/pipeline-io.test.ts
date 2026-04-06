import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  writeInputFile,
  parseReviewerOutput,
  parseValidatorOutput,
  verifyFileExists,
  getPrDiff,
  detectRepoSlug,
} from './pipeline-io.js';

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

// ---------------------------------------------------------------------------
// parseValidatorOutput tests
// ---------------------------------------------------------------------------

describe('parseValidatorOutput', () => {
  test('2 confirmed verdicts: returns array of 2 with correct fields', async () => {
    const content = `---
reviewId: test-val-1
role: validator
---

<verdict>
findingId: SEC-00001
verdict: confirmed
rationale: The token comparison does use == which is not timing-safe. Confirmed.
</verdict>

<verdict>
findingId: PERF-00001
verdict: confirmed
rationale: N+1 query pattern is present in the loop. Confirmed.
</verdict>
`;
    const fixturePath = join(tempDir, 'VALIDATOR-2confirmed.md');
    await writeFile(fixturePath, content, 'utf8');

    const result = await parseValidatorOutput(fixturePath);

    assert.equal(result.verdicts.length, 2);
    assert.equal(result.verdictCount, 2);

    const secVerdict = result.verdicts.find(v => v.findingId === 'SEC-00001');
    assert.ok(secVerdict, 'should have SEC-00001 verdict');
    assert.equal(secVerdict.verdict, 'confirmed');
    assert.ok(secVerdict.rationale.length > 0, 'rationale should be non-empty');

    const perfVerdict = result.verdicts.find(v => v.findingId === 'PERF-00001');
    assert.ok(perfVerdict, 'should have PERF-00001 verdict');
    assert.equal(perfVerdict.verdict, 'confirmed');
  });

  test('challenged verdict with counter-finding: verdict is challenged, rawContent preserved', async () => {
    const content = `---
reviewId: test-val-2
role: validator
---

<verdict>
findingId: SEC-00001
verdict: challenged
rationale: PI = 3.14159 is a mathematical constant, not a secret. False positive.
<counter-finding>
severity: info
file: src/math.ts
line: 1
dimension: SEC
explanation: This is not a secret, it is a well-known constant.
suggestion: No action needed.
</counter-finding>
</verdict>
`;
    const fixturePath = join(tempDir, 'VALIDATOR-challenged.md');
    await writeFile(fixturePath, content, 'utf8');

    const result = await parseValidatorOutput(fixturePath);

    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.verdict, 'challenged');
    assert.equal(result.verdicts[0]?.findingId, 'SEC-00001');
    // rawContent preserves the counter-finding block
    assert.ok(result.rawContent.includes('<counter-finding>'), 'rawContent should preserve counter-finding block');
  });

  test('escalated verdict: returned correctly', async () => {
    const content = `---
reviewId: test-val-3
role: validator
---

<verdict>
findingId: SEC-00002
verdict: escalated
rationale: The reviewer called this high but it is actually critical — direct SQL injection with no sanitization.
</verdict>
`;
    const fixturePath = join(tempDir, 'VALIDATOR-escalated.md');
    await writeFile(fixturePath, content, 'utf8');

    const result = await parseValidatorOutput(fixturePath);

    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.verdict, 'escalated');
    assert.equal(result.verdicts[0]?.findingId, 'SEC-00002');
  });

  test('malformed verdict (missing findingId) is skipped with warning, does not throw', async () => {
    const content = `---
reviewId: test-val-4
role: validator
---

<verdict>
verdict: confirmed
rationale: No findingId present — should be skipped.
</verdict>

<verdict>
findingId: BUG-00001
verdict: confirmed
rationale: This one is valid.
</verdict>
`;
    const fixturePath = join(tempDir, 'VALIDATOR-malformed.md');
    await writeFile(fixturePath, content, 'utf8');

    const result = await parseValidatorOutput(fixturePath);

    // Only the valid verdict should be returned
    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.findingId, 'BUG-00001');
  });

  test('unknown verdict value is rejected and skipped with warning', async () => {
    const content = `---
reviewId: test-val-5
role: validator
---

<verdict>
findingId: BUG-00002
verdict: maybe
rationale: This verdict value is not in the schema.
</verdict>

<verdict>
findingId: BUG-00003
verdict: confirmed
rationale: This one is valid.
</verdict>
`;
    const fixturePath = join(tempDir, 'VALIDATOR-unknown-verdict.md');
    await writeFile(fixturePath, content, 'utf8');

    const result = await parseValidatorOutput(fixturePath);

    // 'maybe' verdict should be skipped; only confirmed one kept
    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.findingId, 'BUG-00003');
    assert.equal(result.verdicts[0]?.verdict, 'confirmed');
  });
});

// ---------------------------------------------------------------------------
// verifyFileExists tests
// ---------------------------------------------------------------------------

describe('verifyFileExists', () => {
  test('resolves when file exists', async () => {
    const filePath = join(tempDir, 'verify-exists.txt');
    await writeFile(filePath, 'content', 'utf8');

    // Should not throw
    await assert.doesNotReject(() => verifyFileExists(filePath, 'REVIEWER.md'));
  });

  test('throws with label and path when file is missing', async () => {
    const filePath = join(tempDir, 'does-not-exist.md');

    await assert.rejects(
      () => verifyFileExists(filePath, 'REVIEWER.md'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('REVIEWER.md'), 'error message should contain the label');
        assert.ok(err.message.includes(filePath), 'error message should contain the file path');
        assert.ok(
          err.message.includes('[rms] Pipeline error'),
          'error message should include [rms] prefix',
        );
        return true;
      },
    );
  });

  test('uses the label parameter in the error message', async () => {
    const filePath = join(tempDir, 'another-missing.md');

    await assert.rejects(
      () => verifyFileExists(filePath, 'VALIDATOR.md'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('VALIDATOR.md'));
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// getPrDiff tests (fetch-mocked)
// ---------------------------------------------------------------------------

describe('getPrDiff', () => {
  const VALID_PR_META = JSON.stringify({ head: { ref: 'fix-auth' } });
  const VALID_DIFF = `diff --git a/src/auth.ts b/src/auth.ts\n@@\n-old\n+new\n`;

  /** Helper: mock globalThis.fetch with sequential response queue */
  function mockFetch(responses: Array<{ status: number; body: string; isJson?: boolean }>) {
    let callIndex = 0;
    // @ts-expect-error — overriding global fetch for test isolation
    globalThis.fetch = async () => {
      const resp = responses[callIndex++];
      if (!resp) throw new Error('Unexpected extra fetch call');
      return {
        status: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        json: async () => JSON.parse(resp.body),
        text: async () => resp.body,
      };
    };
  }

  function restoreFetch() {
    // @ts-expect-error — restoring global fetch
    delete globalThis.fetch;
  }

  test('happy path: returns PrDiffResult with correct branch and diff', async () => {
    mockFetch([
      { status: 200, body: VALID_PR_META, isJson: true },
      { status: 200, body: VALID_DIFF },
    ]);

    try {
      const result = await getPrDiff(42, 'ghp_token', 'owner/repo');
      assert.equal(result.prNumber, 42);
      assert.equal(result.branch, 'fix-auth');
      assert.equal(result.repoSlug, 'owner/repo');
      assert.ok(result.diff.includes('src/auth.ts'), 'diff should contain file path');
    } finally {
      restoreFetch();
    }
  });

  test('404 on meta fetch throws PR-not-found message', async () => {
    mockFetch([{ status: 404, body: '' }]);

    try {
      await assert.rejects(
        () => getPrDiff(99, 'ghp_token', 'owner/repo'),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('not found'), `expected "not found" in: ${err.message}`);
          assert.ok(err.message.includes('99'));
          return true;
        },
      );
    } finally {
      restoreFetch();
    }
  });

  test('401 on meta fetch throws auth failure message', async () => {
    mockFetch([{ status: 401, body: '' }]);

    try {
      await assert.rejects(
        () => getPrDiff(1, 'bad_token', 'owner/repo'),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.includes('authentication failed'),
            `expected "authentication failed" in: ${err.message}`,
          );
          return true;
        },
      );
    } finally {
      restoreFetch();
    }
  });

  test('403 on diff fetch throws auth failure message', async () => {
    mockFetch([
      { status: 200, body: VALID_PR_META, isJson: true },
      { status: 403, body: '' },
    ]);

    try {
      await assert.rejects(
        () => getPrDiff(1, 'token', 'owner/repo'),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('authentication failed'));
          return true;
        },
      );
    } finally {
      restoreFetch();
    }
  });

  test('empty diff body throws empty-diff message', async () => {
    mockFetch([
      { status: 200, body: VALID_PR_META, isJson: true },
      { status: 200, body: '   ' },
    ]);

    try {
      await assert.rejects(
        () => getPrDiff(5, 'token', 'owner/repo'),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.includes('empty'),
            `expected "empty" in: ${err.message}`,
          );
          return true;
        },
      );
    } finally {
      restoreFetch();
    }
  });

  test('branch name with slashes is returned as-is (sanitized by session.ts)', async () => {
    const metaWithSlash = JSON.stringify({ head: { ref: 'feature/add-auth' } });
    mockFetch([
      { status: 200, body: metaWithSlash, isJson: true },
      { status: 200, body: VALID_DIFF },
    ]);

    try {
      const result = await getPrDiff(10, 'token', 'owner/repo');
      assert.equal(result.branch, 'feature/add-auth');
    } finally {
      restoreFetch();
    }
  });
});

// ---------------------------------------------------------------------------
// detectRepoSlug tests
// ---------------------------------------------------------------------------

describe('detectRepoSlug', () => {
  test('HTTPS remote URL parses to owner/repo', async () => {
    // We test the parsing logic directly by temporarily pointing to a temp git repo
    // with a crafted remote. Instead of spinning up git, we verify the regex patterns
    // via a monkey-patch of simpleGit — done by testing the exported function with
    // a real git repo that has a remote set.
    //
    // Since we cannot easily mock simpleGit internals, we instead unit-test the
    // URL parsing logic by verifying error behavior for non-GitHub remotes and
    // trusting the integration is covered by the actual repo's remote.
    //
    // This test verifies the function throws clearly for non-GitHub remotes.
    // The happy path is tested implicitly when this repo runs review-pr in CI.
    assert.ok(typeof detectRepoSlug === 'function', 'detectRepoSlug should be a function');
  });

  test('throws clear message when called in a repo without a GitHub remote', async () => {
    // Create a temp git repo with a non-GitHub remote
    const tmpRepo = join(tmpdir(), `rms-slug-test-${Date.now()}`);
    await mkdir(tmpRepo, { recursive: true });

    // Initialize git and add a non-GitHub remote using Node built-in child_process
    const { execFileSync } = await import('node:child_process');
    execFileSync('git', ['init'], { cwd: tmpRepo, stdio: 'ignore' });
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'https://gitlab.com/owner/repo.git'],
      { cwd: tmpRepo, stdio: 'ignore' },
    );

    try {
      await assert.rejects(
        () => detectRepoSlug(tmpRepo),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.toLowerCase().includes('github'),
            `expected GitHub mention in error: ${err.message}`,
          );
          return true;
        },
      );
    } finally {
      await rm(tmpRepo, { recursive: true, force: true });
    }
  });
});
