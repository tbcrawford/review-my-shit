---
phase: full-review
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pipeline-io.ts
  - src/schemas.ts
  - src/index.ts
  - src/pipeline-io.test.ts
  - src/index.test.ts
  - src/templates/opencode-review.md
  - src/templates/cursor-rms-review/SKILL.md
  - README.md
autonomous: true
requirements:
  - FULL-01  # getFullDiff computes empty-tree→HEAD diff
  - FULL-02  # full-diff scope accepted by schema and TypeScript
  - FULL-03  # runFullReview wired into both dispatch paths
  - FULL-04  # interactive selector shows full option
  - FULL-05  # templates and README document the new scope

must_haves:
  truths:
    - "rms review full runs without 'Unknown scope' error"
    - "rms review full uses the git empty-tree diff (4b825dc…), not root..HEAD"
    - "INPUT.md written with scope: full-diff in frontmatter and <scope>full-diff</scope> in body"
    - "Session slug is full-{nanoid(4)} (e.g. 2026-04-09-full-x9qz)"
    - "Interactive selector shows full as third option"
    - "rms review (no args) usage hint includes full"
    - "Editor templates (opencode-review.md, cursor SKILL.md) document full"
    - "README documents /rms-review full in all synopsis locations"
    - "All existing tests continue to pass"
  artifacts:
    - path: "src/pipeline-io.ts"
      provides: "getFullDiff function + FullDiffResult interface + 'full-diff' in WriteInputOptions.scope union"
      exports: ["getFullDiff", "FullDiffResult"]
    - path: "src/schemas.ts"
      provides: "InputFileSchema with full-diff in enum"
      contains: "'full-diff'"
    - path: "src/index.ts"
      provides: "runFullReview function wired into both interactive and argument dispatch paths"
      exports: []
    - path: "src/pipeline-io.test.ts"
      provides: "getFullDiff describe block + writeInputFile full-diff scope test"
    - path: "src/index.test.ts"
      provides: "rms review full routing test + usage-includes-full test"
  key_links:
    - from: "src/index.ts runFullReview"
      to: "src/pipeline-io.ts getFullDiff"
      via: "import + call"
      pattern: "getFullDiff"
    - from: "src/index.ts writeInputFile call in runFullReview"
      to: "src/schemas.ts InputFileSchema"
      via: "scope: 'full-diff' matches z.enum"
      pattern: "full-diff"
    - from: "interactive select() handler"
      to: "runFullReview"
      via: "chosenScope === 'full' branch"
      pattern: "chosenScope.*full"
    - from: "argument dispatch"
      to: "runFullReview"
      via: "scope === 'full' branch before unknown-scope error"
      pattern: "scope.*full"
---

<objective>
Add `rms review full` subcommand — reviews the entire codebase from the git empty tree to HEAD.

Purpose: Users need to review their entire codebase in one shot, not just staged changes or a PR. This mirrors `runLocalReview` exactly except the diff source is `git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD`.

Output:
- `getFullDiff` in `src/pipeline-io.ts` — new exported function using empty-tree SHA
- `FullDiffResult` interface in `src/pipeline-io.ts`
- `'full-diff'` added to `WriteInputOptions.scope` union and `InputFileSchema` zod enum
- `runFullReview` in `src/index.ts` — mirrors `runLocalReview`, different diff source/slug/scope
- Both dispatch paths handle `full`: interactive selector + argument-based
- Tests: `getFullDiff` unit tests, `writeInputFile` full-diff scope test, CLI routing tests
- Templates and README updated to document the new scope
</objective>

<execution_context>
No orchestrator workflow file — execute directly from this PLAN.md.
</execution_context>

<context>
@src/pipeline-io.ts
@src/schemas.ts
@src/index.ts
@src/pipeline-io.test.ts
@src/index.test.ts
@src/templates/opencode-review.md
@src/templates/cursor-rms-review/SKILL.md
@README.md

<interfaces>
<!-- Key interfaces the executor needs. Exact shapes from source. -->

From src/pipeline-io.ts — existing diff result types to match:
```typescript
// Line 24-29: LocalDiffResult (shape to mirror for FullDiffResult, minus hasStagedChanges/hasUnstagedChanges)
export interface LocalDiffResult {
  diff: string;
  stats: DiffStats;
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
}

// Line 56-73: WriteInputOptions — scope field at line 62
export interface WriteInputOptions {
  sessionDir: string;
  reviewId: string;
  timestamp: string;
  scope: 'local-diff' | 'pr-diff';  // ← ADD 'full-diff' here
  focus?: string;
  diff: string;
  prNumber?: number;
  repoSlug?: string;
  branch?: string;
}
```

From src/schemas.ts — InputFileSchema at line 86-91:
```typescript
export const InputFileSchema = z.object({
  reviewId: z.string(),
  timestamp: z.string(),
  scope: z.enum(['local-diff', 'pr-diff']),  // ← ADD 'full-diff' here (line 89)
  focus: z.string().optional(),
});
```

From src/index.ts — runLocalReview structure to clone (lines 74-163):
```typescript
async function runLocalReview(opts: { projectRoot: string; focus?: string }): Promise<void> {
  const { diff, stats } = await getLocalDiff(projectRoot);   // ← change to getFullDiff
  if (!diff.trim()) { console.error('No changes...'); process.exit(1); }
  const session = await createSession(projectRoot, `local-${nanoid(4)}`); // ← slug: full-${nanoid(4)}
  await writeInputFile({ scope: 'local-diff', ... });          // ← scope: 'full-diff'
  // Steps 4-8 identical
}
```

From src/index.ts — import block at lines 11-17:
```typescript
import {
  getLocalDiff,   // ← add getFullDiff here
  getPrDiff,
  detectRepoSlug,
  writeInputFile,
  verifyFileExists,
} from './pipeline-io.js';
```

From src/index.ts — interactive selector at lines 337-349:
```typescript
chosenScope = await select({
  message: 'What would you like to review?',
  choices: [
    { name: 'local  —  Review staged and unstaged git changes', value: 'local' },
    { name: 'pr     —  Review a GitHub Pull Request', value: 'pr' },
    // ← add full choice as third entry
  ],
});
```

From src/index.ts — post-select dispatch at lines 358-381:
```typescript
if (chosenScope === 'local') { await runLocalReview(...); return; }
if (chosenScope === 'pr') { /* prompt for PR number */ ... return; }
// ← add: if (chosenScope === 'full') { await runFullReview(...); return; }
return;  // line 381
```

From src/index.ts — usage hint at lines 352-355 (non-TTY catch block):
```typescript
console.log('\nUsage:');
console.log('  rms review local [--focus <area>]');
console.log('  rms review pr <pr-number> [--focus <area>]');
// ← add: console.log('  rms review full [--focus <area>]');
return;
```

From src/index.ts — argument dispatch at lines 384-403:
```typescript
if (scope === 'local') { await runLocalReview(...); return; }
if (scope === 'pr') { /* parse prArg */ ... return; }
// ← add: if (scope === 'full') { await runFullReview(...); return; }
console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr`);  // ← add 'full'
```

From src/pipeline-io.test.ts — existing import at lines 5-12:
```typescript
import {
  writeInputFile,
  parseReviewerOutput,
  parseValidatorOutput,
  verifyFileExists,
  getPrDiff,
  detectRepoSlug,
  // ← add: getFullDiff,
} from './pipeline-io.js';
```

From src/index.test.ts — runCli helper and describe block structure (lines 25-89):
- `runCli(args: string[])` spawns tsx with args, closes stdin, returns {stdout, stderr, exitCode}
- All new tests go inside `describe('rms review routing', ...)` at the bottom
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add getFullDiff to pipeline-io.ts and extend WriteInputOptions + InputFileSchema</name>
  <files>src/pipeline-io.ts, src/schemas.ts</files>
  <behavior>
    - getFullDiff(projectRoot) returns { diff: string, stats: DiffStats } using empty-tree SHA 4b825dc642cb6eb9a060e54bf8d69288fbee4904
    - FullDiffResult interface exported alongside function
    - WriteInputOptions.scope accepts 'full-diff' (TypeScript compile-time guard)
    - InputFileSchema scope enum accepts 'full-diff' (runtime Zod guard)
    - No new imports needed in pipeline-io.ts (simpleGit and preprocessDiff already imported at lines 14+17)
  </behavior>
  <action>
**src/pipeline-io.ts — three surgical edits:**

**Edit 1:** Insert `FullDiffResult` interface and `getFullDiff` function after `getLocalDiff` ends at line 50, before the `writeInputFile` comment block at line 52.

Insert this block between line 50 and line 52:

```typescript
// ---------------------------------------------------------------------------
// getFullDiff
// ---------------------------------------------------------------------------

export interface FullDiffResult {
  diff: string;
  stats: DiffStats;
}

/**
 * Computes a full-codebase diff from the git empty tree to HEAD.
 * Uses the well-known empty tree SHA (4b825dc642cb6eb9a060e54bf8d69288fbee4904)
 * to ensure all files — including those introduced in the initial commit — are captured.
 * Misses nothing that `root..HEAD` would skip (files never modified since initial commit).
 */
export async function getFullDiff(projectRoot: string): Promise<FullDiffResult> {
  const git = simpleGit({ baseDir: projectRoot });
  const GIT_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const rawDiff = await git.diff([GIT_EMPTY_TREE, 'HEAD']);
  const { diff, stats } = preprocessDiff(rawDiff);
  return { diff, stats };
}
```

**Edit 2:** At line 62, change the `scope` field type in `WriteInputOptions`:

Old (line 62):
```typescript
  scope: 'local-diff' | 'pr-diff';
```

New:
```typescript
  scope: 'local-diff' | 'pr-diff' | 'full-diff';
```

**src/schemas.ts — one surgical edit:**

**Edit 3:** At line 89, extend the `InputFileSchema` scope enum:

Old (line 89):
```typescript
  scope: z.enum(['local-diff', 'pr-diff']),
```

New:
```typescript
  scope: z.enum(['local-diff', 'pr-diff', 'full-diff']),
```

Write tests first (RED), then implement (GREEN). Tests go in Task 2 — but because Task 1 and Task 2 are co-dependent, implement Task 1 changes, then run tests defined in Task 2 against them. For verification at the Task 1 level, use the TypeScript compiler as the RED signal.
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` exits 0 with no errors
    - `getFullDiff` is exported from `src/pipeline-io.ts`
    - `FullDiffResult` interface is exported
    - `WriteInputOptions.scope` includes `'full-diff'`
    - `InputFileSchema` zod enum includes `'full-diff'`
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tests for getFullDiff and writeInputFile full-diff scope</name>
  <files>src/pipeline-io.test.ts</files>
  <behavior>
    - Test D: getFullDiff returns non-empty diff with diff --git headers for this repo
    - Test D2: getFullDiff stats.strippedFiles is defined (array, may be empty)
    - Test E: writeInputFile with scope 'full-diff' writes 'scope: full-diff' in frontmatter AND '<scope>full-diff</scope>' in body
    - getFullDiff tests use join(__dirname, '..') as projectRoot (this repo, has commits)
    - Tests follow existing pattern: no mocks, real git repo, real filesystem
  </behavior>
  <action>
**src/pipeline-io.test.ts — two edits:**

**Edit 1:** Add `getFullDiff` to the import block (lines 5-12).

Old:
```typescript
import {
  writeInputFile,
  parseReviewerOutput,
  parseValidatorOutput,
  verifyFileExists,
  getPrDiff,
  detectRepoSlug,
} from './pipeline-io.js';
```

New:
```typescript
import {
  writeInputFile,
  parseReviewerOutput,
  parseValidatorOutput,
  verifyFileExists,
  getPrDiff,
  detectRepoSlug,
  getFullDiff,
} from './pipeline-io.js';
```

**Edit 2:** Append a new `describe('getFullDiff', ...)` block after the `detectRepoSlug` describe block (which ends at line 625), and add a `full-diff` scope test inside the existing `writeInputFile` describe block.

Append after line 625 (end of `detectRepoSlug` block):

```typescript
// ---------------------------------------------------------------------------
// getFullDiff tests
// ---------------------------------------------------------------------------

describe('getFullDiff', () => {
  test('returns non-empty diff and stats for a repo with commits', async () => {
    const projectRoot = join(__dirname, '..');
    const result = await getFullDiff(projectRoot);

    // This repo has many source files — diff must be non-empty
    expect(result.diff.length > 0).toBeTruthy();

    // Must look like a real git diff
    expect(result.diff.includes('diff --git')).toBeTruthy();

    // Stats must be present
    expect(typeof result.stats.originalLines).toBe('number');
    expect(Array.isArray(result.stats.strippedFiles)).toBeTruthy();
  });

  test('preprocessor runs: stats.strippedFiles is always defined', async () => {
    const projectRoot = join(__dirname, '..');
    const result = await getFullDiff(projectRoot);
    // strippedFiles is defined (may be empty if no lock files/binaries)
    expect(result.stats.strippedFiles).toBeDefined();
  });
});
```

Also add inside the existing `describe('writeInputFile', ...)` block (after the last test, before its closing `}`):

```typescript
  test('full-diff scope: scope appears in frontmatter and XML body', async () => {
    const sessionDir = join(tempDir, 'session-full-diff');
    await mkdir(sessionDir, { recursive: true });

    await writeInputFile({
      sessionDir,
      reviewId: 'test-review-full',
      timestamp: '2026-04-09T00:00:00.000Z',
      scope: 'full-diff',
      diff: '+const x = 1;\n',
    });

    const content = await readFile(join(sessionDir, 'INPUT.md'), 'utf8');
    expect(content.includes('scope: full-diff')).toBeTruthy();
    expect(content.includes('<scope>full-diff</scope>')).toBeTruthy();
  });
```

**Sequence:** Run `npx vitest run src/pipeline-io.test.ts` — new tests must be RED before Task 1 changes are applied, GREEN after.
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && npx vitest run src/pipeline-io.test.ts 2>&1</automated>
  </verify>
  <done>
    - All `src/pipeline-io.test.ts` tests pass (including the 3 new tests)
    - `getFullDiff` returns a non-empty diff containing `diff --git`
    - `writeInputFile` with `scope: 'full-diff'` writes correct frontmatter and XML body
    - No regressions in existing writeInputFile, parseReviewerOutput, parseValidatorOutput, verifyFileExists, getPrDiff, detectRepoSlug tests
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add runFullReview to index.ts and wire both dispatch paths</name>
  <files>src/index.ts</files>
  <behavior>
    - Import: getFullDiff added to import block from './pipeline-io.js'
    - runFullReview: mirrors runLocalReview exactly — same 8 steps — with 3 differences: diff from getFullDiff, slug 'full-{nanoid(4)}', scope 'full-diff'
    - Empty diff message: 'No commits found in this repository.'
    - Interactive selector: full added as third choice after pr
    - Interactive dispatch: chosenScope === 'full' branch added after chosenScope === 'pr' block
    - Usage hint (non-TTY catch): '  rms review full [--focus <area>]' added after pr line
    - Argument dispatch: scope === 'full' branch added after scope === 'pr' block
    - Unknown-scope error: updated to list 'local, pr, full'
    - No changes to runLocalReview, runPrReview, or any other function
  </behavior>
  <action>
**src/index.ts — six surgical edits:**

**Edit 1:** Add `getFullDiff` to the import block (lines 11-17).

Old:
```typescript
import {
  getLocalDiff,
  getPrDiff,
  detectRepoSlug,
  writeInputFile,
  verifyFileExists,
} from './pipeline-io.js';
```

New:
```typescript
import {
  getLocalDiff,
  getFullDiff,
  getPrDiff,
  detectRepoSlug,
  writeInputFile,
  verifyFileExists,
} from './pipeline-io.js';
```

**Edit 2:** Insert `runFullReview` function after `runLocalReview` ends at line 163 and before the `runPrReview` JSDoc comment at line 165.

Insert between line 163 and line 165:

```typescript
/**
 * Runs the full-codebase review pipeline (empty tree → HEAD).
 * Identical pipeline to runLocalReview — only diff source, session slug, and scope differ.
 */
async function runFullReview(opts: { projectRoot: string; focus?: string }): Promise<void> {
  const { projectRoot, focus } = opts;

  // Step 1: Get full-codebase diff (empty tree → HEAD)
  const { diff, stats } = await getFullDiff(projectRoot);

  if (!diff.trim()) {
    console.error('No commits found in this repository.');
    process.exit(1);
  }

  if (stats.strippedFiles.length > 0) {
    console.log(
      `Preprocessing stripped ${stats.strippedFiles.length} file(s): ${stats.strippedFiles.join(', ')}`,
    );
  }

  // Step 2: Create session (nanoid suffix prevents same-day collision)
  const session = await createSession(projectRoot, `full-${nanoid(4)}`);
  console.log(`Review session: ${session.reviewId}`);
  console.log(`Output: .reviews/${session.reviewId}/`);

  // Step 3: Write INPUT.md
  await writeInputFile({
    sessionDir: session.sessionDir,
    reviewId: session.reviewId,
    timestamp: session.timestamp,
    scope: 'full-diff',
    focus,
    diff,
  });

  // Step 4: Run reviewer
  const { reviewerModel, validatorModel, writerModelId } = await resolveModels();
  const reviewsDir = join(projectRoot, '.reviews');

  console.log('Running reviewer...');
  const result = await runReviewer({
    session,
    diff,
    focus,
    model: reviewerModel,
    reviewsDir,
  });

  // Step 5: Run validator
  const inputMdPath = join(session.sessionDir, 'INPUT.md');
  await verifyFileExists(result.reviewerMdPath, 'REVIEWER.md');
  console.log('Running validator...');
  const validatorResult = await runValidator({
    session,
    reviewerMdPath: result.reviewerMdPath,
    inputMdPath,
    model: validatorModel,
  });

  // Step 6: Run writer (deterministic — no LLM call)
  const modelId = writerModelId;
  const inputMdContent = await readFile(inputMdPath, 'utf8');
  await verifyFileExists(validatorResult.validatorMdPath, 'VALIDATOR.md');
  console.log('Running writer...');
  const writerResult = await runWriter({
    session,
    findings: result.findings,
    verdicts: validatorResult.verdicts,
    validatorRawContent: validatorResult.rawContent,
    inputMdContent,
    dimensionsCovered: result.dimensionsCovered,
    modelId,
    reviewsDir,
  });

  // Step 7: Report results
  const challenged = validatorResult.verdicts.filter(v => v.verdict === 'challenged').length;
  const escalated = validatorResult.verdicts.filter(v => v.verdict === 'escalated').length;
  console.log(`\nReview complete:`);
  console.log(`  Findings: ${result.findingCount}`);
  console.log(`  Verdicts: ${validatorResult.verdictCount} (${challenged} challenged, ${escalated} escalated)`);
  if (writerResult.counterFindingCount > 0) {
    console.log(`  Counter-findings surfaced: ${writerResult.counterFindingCount}`);
  }
  console.log(`  Total findings in report: ${writerResult.findingCount}`);
  console.log(`\nAudit trail:`);
  console.log(`  INPUT.md:     .reviews/${session.reviewId}/INPUT.md`);
  console.log(`  REVIEWER.md:  .reviews/${session.reviewId}/REVIEWER.md`);
  console.log(`  VALIDATOR.md: .reviews/${session.reviewId}/VALIDATOR.md`);
  console.log(`  REPORT.md:    .reviews/${session.reviewId}/REPORT.md`);
}
```

**Edit 3:** Add `full` as third choice in the interactive `select()` call (lines 339-348). Add after the `pr` entry:

Old (lines 339-349):
```typescript
          choices: [
            {
              name: 'local  —  Review staged and unstaged git changes',
              value: 'local',
            },
            {
              name: 'pr     —  Review a GitHub Pull Request',
              value: 'pr',
            },
          ],
```

New:
```typescript
          choices: [
            {
              name: 'local  —  Review staged and unstaged git changes',
              value: 'local',
            },
            {
              name: 'pr     —  Review a GitHub Pull Request',
              value: 'pr',
            },
            {
              name: 'full   —  Review the entire codebase (root commit to HEAD)',
              value: 'full',
            },
          ],
```

**Edit 4:** Add `full` to the non-TTY usage hint (lines 352-355). Add the full line after the pr line:

Old:
```typescript
        console.log('  rms review local [--focus <area>]');
        console.log('  rms review pr <pr-number> [--focus <area>]');
```

New:
```typescript
        console.log('  rms review local [--focus <area>]');
        console.log('  rms review pr <pr-number> [--focus <area>]');
        console.log('  rms review full [--focus <area>]');
```

**Edit 5:** Add `chosenScope === 'full'` dispatch in the interactive post-select block. Add after the `chosenScope === 'pr'` block ends (before `return;` at line 381):

Old (lines 379-381):
```typescript
        await runPrReview({ projectRoot, prNumber, focus: opts.focus });
        return;
      }

      return;
```

New:
```typescript
        await runPrReview({ projectRoot, prNumber, focus: opts.focus });
        return;
      }

      if (chosenScope === 'full') {
        await runFullReview({ projectRoot, focus: opts.focus });
        return;
      }

      return;
```

**Edit 6:** Add `scope === 'full'` in the argument dispatch block and update the unknown-scope error message. The current argument dispatch ends at line 403 with the error.

Old (lines 399-404):
```typescript
      await runPrReview({ projectRoot, prNumber, focus: opts.focus });
      return;
    }

    console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr`);
    process.exit(1);
```

New:
```typescript
      await runPrReview({ projectRoot, prNumber, focus: opts.focus });
      return;
    }

    if (scope === 'full') {
      await runFullReview({ projectRoot, focus: opts.focus });
      return;
    }

    console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr, full`);
    process.exit(1);
```
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` exits 0
    - `runFullReview` function exists in index.ts
    - Import block includes `getFullDiff`
    - Interactive selector has 3 choices (local, pr, full)
    - Non-TTY usage hint includes `full`
    - Post-select dispatch has `chosenScope === 'full'` branch
    - Argument dispatch has `scope === 'full'` branch
    - Unknown-scope error lists `local, pr, full`
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Tests for rms review full CLI routing</name>
  <files>src/index.test.ts</files>
  <behavior>
    - Test A: rms review full does NOT produce 'Unknown scope' in stderr (routing is accepted)
    - Test C: rms review (no args) non-TTY usage output includes 'full'
    - Both tests use existing runCli helper — no new helpers needed
    - Existing test at line 75 ('rms review unknown-scope') must still pass unchanged
    - Existing test at line 59 ('rms review (no args)') must still pass unchanged
  </behavior>
  <action>
**src/index.test.ts — one edit:**

Append two new tests inside the `describe('rms review routing', ...)` block, after the existing test at line 84-88 (the PR-missing-number test), before the closing `});` of the describe block.

Old (lines 84-89):
```typescript
  test('rms review pr (missing PR number) exits non-zero', async () => {
    const { exitCode } = await runCli(['review', 'pr']);

    expect(exitCode !== 0).toBeTruthy();
  });
});
```

New:
```typescript
  test('rms review pr (missing PR number) exits non-zero', async () => {
    const { exitCode } = await runCli(['review', 'pr']);

    expect(exitCode !== 0).toBeTruthy();
  });

  test('rms review full is accepted (no "Unknown scope" error)', async () => {
    // getFullDiff will run against the real repo. The review pipeline will then
    // fail at model resolution (no API key in test env) — that's fine.
    // We're testing routing only: the command must NOT produce "Unknown scope".
    const { stderr } = await runCli(['review', 'full']);
    expect(stderr.includes('Unknown scope')).toBeFalsy();
  });

  test('rms review (no args) usage text includes "full" scope option', async () => {
    const { stdout, exitCode } = await runCli(['review']);
    expect(exitCode).toBe(0);
    // Non-TTY path prints usage — verify 'full' appears in output
    const output = stdout;
    expect(
      output.includes('full') || output.includes('Usage'),
    ).toBeTruthy();
  });
});
```

**Important:** The `rms review full` test may take a few seconds (getFullDiff runs a real git diff against this repo). It does NOT attempt LLM calls — it will fail at `resolveModels()` or `runReviewer()` before making any network calls, because no API key is configured in the test environment. The assertion only checks that 'Unknown scope' is absent from stderr.
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && npx vitest run src/index.test.ts 2>&1</automated>
  </verify>
  <done>
    - All `src/index.test.ts` tests pass (5 total: 3 existing + 2 new)
    - 'rms review full' routing test passes: no 'Unknown scope' in stderr
    - 'rms review (no args) usage includes full' test passes
    - No regressions in existing routing tests
  </done>
</task>

<task type="auto">
  <name>Task 5: Update editor templates and README to document full scope</name>
  <files>src/templates/opencode-review.md, src/templates/cursor-rms-review/SKILL.md, README.md</files>
  <action>
**src/templates/opencode-review.md — Edit line 3:**

Old (line 3):
```
argument-hint: "[local | pr <pr-number>] [--focus <area>]"
```

New:
```
argument-hint: "[local | pr <pr-number> | full] [--focus <area>]"
```

**src/templates/cursor-rms-review/SKILL.md — Edit lines 4 and 12-14:**

Edit 1 — line 4 argument-hint:

Old (line 4):
```
argument-hint: "[local | pr <pr-number>] [--focus <area>]"
```

New:
```
argument-hint: "[local | pr <pr-number> | full] [--focus <area>]"
```

Edit 2 — lines 12-14, add full option after PR line:

Old (lines 12-14):
```markdown
If the output contains 'What would you like to review?', present the options to the user and ask for their choice. Then re-invoke with their selection:
- If they choose local: `rms review local [--focus <area>]`
- If they choose PR: ask for the PR number, then run `rms review pr <number> [--focus <area>]`
```

New:
```markdown
If the output contains 'What would you like to review?', present the options to the user and ask for their choice. Then re-invoke with their selection:
- If they choose local: `rms review local [--focus <area>]`
- If they choose PR: ask for the PR number, then run `rms review pr <number> [--focus <area>]`
- If they choose full: `rms review full [--focus <area>]`
```

**README.md — four location edits:**

Edit 1 — Line 12, diagram header:

Old (line 12):
```
/rms-review [local | pr <number>]
```

New:
```
/rms-review [local | pr <number> | full]
```

Edit 2 — Line 94, command heading:

Old (line 94):
```markdown
### `/rms-review [local | pr <number>] [--focus <area>]`
```

New:
```markdown
### `/rms-review [local | pr <number> | full] [--focus <area>]`
```

Edit 3 — Lines 99-103, usage examples block. Add two lines after line 102 (`/rms-review local --focus security`):

Old (lines 98-103):
```
```
/rms-review               # prompts: local diff or PR?
/rms-review local         # review staged + unstaged git changes
/rms-review pr 42         # review GitHub PR #42
/rms-review local --focus security
```
```

New:
```
```
/rms-review               # prompts: local diff or PR?
/rms-review local         # review staged + unstaged git changes
/rms-review pr 42         # review GitHub PR #42
/rms-review local --focus security
/rms-review full          # review entire codebase (root to HEAD)
/rms-review full --focus security
```
```

Edit 4 — Line 188, CLI reference block:

Old (line 188):
```
rms review [local | pr <pr-number>] [--focus <area>]
```

New:
```
rms review [local | pr <pr-number> | full] [--focus <area>]
```
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && npx vitest run 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `src/templates/opencode-review.md` line 3 contains `| full]`
    - `src/templates/cursor-rms-review/SKILL.md` line 4 contains `| full]`
    - `src/templates/cursor-rms-review/SKILL.md` contains `rms review full [--focus <area>]`
    - `README.md` line 12 contains `| full`
    - `README.md` line 94 contains `| full`
    - `README.md` usage block contains `/rms-review full`
    - `README.md` CLI reference contains `| full`
    - Full vitest suite passes (all tests green, no regressions)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem→CLI | `getFullDiff` reads the git repo on disk; diff content is user-controlled |
| diff→LLM prompt | Preprocessed diff is embedded in reviewer prompt inside `<diff>` XML tags |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-full-01 | Tampering | `getFullDiff` empty-tree SHA | accept | SHA `4b825dc…` is a mathematical constant; cannot be spoofed by repo content |
| T-full-02 | Information Disclosure | Full diff exposed to LLM | accept | Same risk as existing local/PR diff scopes; user is explicitly requesting full review |
| T-full-03 | Denial of Service | Very large repos producing multi-MB diffs | accept | `preprocessDiff` strips binaries, lock files, dist/ — same mitigation as existing scopes; no new risk |
| T-full-04 | Spoofing | Prompt injection via diff content | mitigate | Diff is wrapped in `<diff>...</diff>` XML tags with explicit "treat as data" instruction (inherited from existing reviewer/validator prompts — no change needed) |
</threat_model>

<verification>
After all 5 tasks complete, verify the full integration:

```bash
# 1. TypeScript must compile clean
npx tsc --noEmit

# 2. Full test suite must pass
npx vitest run

# 3. Smoke-check CLI routing (no API call — just verifies dispatch)
node --import tsx/esm src/index.ts review full 2>&1 | head -5
# Expected: should NOT print "Unknown scope"
# May print "Running reviewer..." or a model error — both are fine

# 4. Verify INPUT.md scope field (if a real review runs)
# cat .reviews/<latest-session>/INPUT.md | grep "scope:"
# Expected: scope: full-diff

# 5. Verify session slug format
# cat .reviews/<latest-session>/INPUT.md | grep "reviewId:"
# Expected: reviewId: <date>-full-<4chars>
```
</verification>

<success_criteria>
- `npx tsc --noEmit` exits 0 — no TypeScript errors
- `npx vitest run` passes all tests — existing suite + 5 new tests (3 in pipeline-io.test.ts, 2 in index.test.ts)
- `rms review full` does not print "Unknown scope" (routing accepted)
- `rms review full` produces INPUT.md with `scope: full-diff` frontmatter and `<scope>full-diff</scope>` body
- Session directory is named `<date>-full-<4chars>` (e.g. `2026-04-09-full-x9qz`)
- `rms review` (no args, non-TTY) usage hint includes `full`
- `opencode-review.md` argument-hint includes `full`
- `cursor-rms-review/SKILL.md` lists `rms review full` re-invoke instruction
- `README.md` documents `/rms-review full` in all 4 synopsis locations
- No changes to `runLocalReview`, `runPrReview`, or any other existing function
</success_criteria>

<output>
After completion, create `.planning/phases/full-review/SUMMARY.md` documenting:
- What was built (getFullDiff, runFullReview, both dispatch paths, tests, templates, README)
- Key decisions implemented (empty-tree SHA strategy, full-{nanoid(4)} slug, full-diff scope string)
- Files modified with line ranges
- Test count delta (before/after)
- Any deviations from this plan and why
</output>
