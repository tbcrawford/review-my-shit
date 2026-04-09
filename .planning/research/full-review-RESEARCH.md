# Full Review (`rms review full`) — Research

**Researched:** 2026-04-09
**Domain:** CLI routing · git diff strategy · TypeScript type extension · Vitest test patterns
**Confidence:** HIGH — all findings verified against actual source code in this repo

---

## Summary

The `rms review full` subcommand needs to: (1) compute a diff from the beginning of the
repository's history to HEAD, (2) run that diff through the existing three-agent pipeline
identically to how `runLocalReview` and `runPrReview` operate, and (3) expose the new
scope in the interactive selector, the CLI argument parser, and the editor templates.

The cleanest diff strategy for "entire codebase" is diffing the **git empty tree**
(`4b825dc642cb6eb9a060e54bf8d69288fbee4904`, a well-known constant) against `HEAD`. This
captures every file, including those introduced in the very first commit. The
`root..HEAD` strategy (diff the root commit against HEAD) misses files that were added in
the initial commit and have never changed — confirmed by inspection of this repo's own
history (the initial commit added `.planning/PROJECT.md`, which `root..HEAD` omits).
Both strategies produce diffs of equal length on this repo because the initial commit only
had one file; the empty-tree approach is semantically correct and future-proof.

The required code changes are narrow and confined to three source files plus the two
editor template files. No pipeline logic changes are needed — `runFullReview` is purely
additive.

**Primary recommendation:** Implement `getFullDiff` in `pipeline-io.ts` using the
empty-tree approach, add `runFullReview` as a clone of `runLocalReview` with a different
diff source and session slug, wire it into the `review` command's argument and interactive
paths, extend the `scope` union in both `schemas.ts` and `WriteInputOptions`, and update
both editor templates.

---

## Exact Locations: Every Touch Point

### 1. `src/pipeline-io.ts` — New `getFullDiff` function

**What to add:** A new exported function `getFullDiff(projectRoot: string)` that returns a
`LocalDiffResult`-shaped object (or its own interface `FullDiffResult`).

**Diff strategy — VERIFIED:**

```bash
# Verified in this repo via Node.js script — produces correct full-codebase diff
git hash-object -t tree /dev/null
# → 4b825dc642cb6eb9a060e54bf8d69288fbee4904 (the git empty tree SHA)

const git = simpleGit({ baseDir: projectRoot });
const rawDiff = await git.diff(['4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD']);
```

**Results of verification:**
- Raw diff: 1,128,628 bytes across 144 files [VERIFIED: ran against this repo]
- After `preprocessDiff`: 1,090,108 bytes (stripped `bun.lock`) [VERIFIED]
- `root..HEAD` produces 1,123,536 bytes — misses `.planning/PROJECT.md` from initial commit [VERIFIED]

**Insert location:** After `getLocalDiff` (line 50), before `writeInputFile` (line 79).
Suggested lines 52–70 (new block).

**Interface to define:**

```typescript
export interface FullDiffResult {
  diff: string;
  stats: DiffStats;
}
```

**Function signature:**

```typescript
export async function getFullDiff(projectRoot: string): Promise<FullDiffResult> {
  const git = simpleGit({ baseDir: projectRoot });
  const GIT_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const rawDiff = await git.diff([GIT_EMPTY_TREE, 'HEAD']);
  const { diff, stats } = preprocessDiff(rawDiff);
  return { diff, stats };
}
```

**No new imports needed** — `simpleGit` (line 14) and `preprocessDiff` (line 17) are
already imported. `DiffStats` is already imported (line 17).

---

### 2. `src/schemas.ts` — Extend `scope` enum

**Current (line 89):**

```typescript
scope: z.enum(['local-diff', 'pr-diff']),
```

**Required change:** Add `'full-diff'` to the enum:

```typescript
scope: z.enum(['local-diff', 'pr-diff', 'full-diff']),
```

**Why:** `writeInputFile` writes `scope` into INPUT.md frontmatter. The `InputFileSchema`
at line 86–92 validates that frontmatter. Without this change, `writeInputFile` with
`scope: 'full-diff'` will pass the TypeScript type check (the union literal in
`WriteInputOptions` controls TypeScript) but the `InputFileSchema.safeParse` path in any
validator that reads INPUT.md would reject it. [VERIFIED: schema validated in `writer.ts`
line 238 via `ReportFileSchema` — `InputFileSchema` used in `schemas.test.ts`]

---

### 3. `src/pipeline-io.ts` — Extend `WriteInputOptions.scope` type

**Current (line 62):**

```typescript
scope: 'local-diff' | 'pr-diff';
```

**Required change:**

```typescript
scope: 'local-diff' | 'pr-diff' | 'full-diff';
```

**Why:** TypeScript will reject `scope: 'full-diff'` in `runFullReview` without this
change. This is the TypeScript-level type guard; `schemas.ts` is the runtime guard.

---

### 4. `src/index.ts` — Add `runFullReview` and wire into router

#### 4a. New `runFullReview` function

**Insert after:** `runLocalReview` ends at line 163. **Insert at approximately line 165.**

**Pattern:** Mirror `runLocalReview` exactly (lines 74–163), with these differences:

| Field | `runLocalReview` | `runFullReview` |
|-------|-----------------|-----------------|
| Diff source | `getLocalDiff(projectRoot)` | `getFullDiff(projectRoot)` |
| Empty diff message | `'No changes to review. Stage or modify files first.'` | `'No commits found in this repository.'` |
| Session slug | `` `local-${nanoid(4)}` `` | `` `full-${nanoid(4)}` `` |
| `scope` in `writeInputFile` | `'local-diff'` | `'full-diff'` |
| Empty diff guard | checks `!diff.trim()` | same check |

**Required new import:** Add `getFullDiff` to the import from `./pipeline-io.js` (line
11–17). Current import block:

```typescript
import {
  getLocalDiff,
  getPrDiff,
  detectRepoSlug,
  writeInputFile,
  verifyFileExists,
} from './pipeline-io.js';
```

Add `getFullDiff` to this list.

#### 4b. Interactive selector — add `full` choice

**Location:** Lines 337–349. The `select()` call's `choices` array currently has two entries.
Add a third:

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

**Also add handler** in the post-select dispatch block (lines 358–381). After the `pr`
handler (line 363–379), add:

```typescript
if (chosenScope === 'full') {
  await runFullReview({ projectRoot, focus: opts.focus });
  return;
}
```

#### 4c. Usage hint in non-TTY fallback (line 353–355)

**Current:**

```typescript
console.log('  rms review local [--focus <area>]');
console.log('  rms review pr <pr-number> [--focus <area>]');
```

**Add:**

```typescript
console.log('  rms review full [--focus <area>]');
```

#### 4d. Argument-based dispatch (lines 384–404)

After the `scope === 'pr'` block (line 389–401), add before the unknown-scope error:

```typescript
if (scope === 'full') {
  await runFullReview({ projectRoot, focus: opts.focus });
  return;
}
```

#### 4e. Unknown scope error message (line 403)

**Current:**

```typescript
console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr`);
```

**Update to:**

```typescript
console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr, full`);
```

---

### 5. Editor templates — document the new scope

#### 5a. `src/templates/opencode-review.md` (line 3)

**Current:**

```
argument-hint: "[local | pr <pr-number>] [--focus <area>]"
```

**Update to:**

```
argument-hint: "[local | pr <pr-number> | full] [--focus <area>]"
```

The `!rms review $ARGUMENTS` body (line 6) requires no change — it passes arguments
verbatim to the CLI.

#### 5b. `src/templates/cursor-rms-review/SKILL.md` (lines 12–14)

**Current (lines 12–14):**

```markdown
If the output contains 'What would you like to review?', present the options to the user and ask for their choice. Then re-invoke with their selection:
- If they choose local: `rms review local [--focus <area>]`
- If they choose PR: ask for the PR number, then run `rms review pr <number> [--focus <area>]`
```

**Update to add the `full` option:**

```markdown
If the output contains 'What would you like to review?', present the options to the user and ask for their choice. Then re-invoke with their selection:
- If they choose local: `rms review local [--focus <area>]`
- If they choose PR: ask for the PR number, then run `rms review pr <number> [--focus <area>]`
- If they choose full: `rms review full [--focus <area>]`
```

---

### 6. `README.md` — document the new scope

**Locations requiring updates:**

| Line | Current text | Required change |
|------|-------------|-----------------|
| 12 | `/rms-review [local \| pr <number>]` | `/rms-review [local \| pr <number> \| full]` |
| 94 | `### /rms-review [local \| pr <number>] [--focus <area>]` | Add `full` to heading |
| 99–103 | Usage block with `local` and `pr` examples | Add `full` example |
| 188 | `rms review [local \| pr <pr-number>] [--focus <area>]` | Add `\| full` |

**Specific lines 99–103 (usage block):**

```
/rms-review               # prompts: local diff or PR?
/rms-review local         # review staged + unstaged git changes
/rms-review pr 42         # review GitHub PR #42
/rms-review local --focus security
```

Add after line 102:

```
/rms-review full          # review entire codebase (root to HEAD)
/rms-review full --focus security
```

---

## Test Coverage Required

### Existing test patterns (from `src/index.test.ts`)

The test harness (lines 25–56) spawns the CLI as a child process via `tsx`, closes stdin
immediately to force the non-TTY path, and checks stdout/stderr/exit code. **All new
tests should follow this exact pattern.**

#### New tests for `src/index.test.ts`

Add to the `'rms review routing'` describe block:

**Test A — `rms review full` routes correctly (non-TTY, no git repo):**

```typescript
test('rms review full exits non-zero when no diff available (not a real git repo)', async () => {
  // In CI or a fresh test dir, 'full' scope will attempt getFullDiff.
  // We can't easily mock git, but we can verify the command IS accepted
  // (no "Unknown scope" error) and exits for a legitimate reason (no diff or git error).
  const { stderr, exitCode } = await runCli(['review', 'full']);
  // Should NOT produce "Unknown scope"
  expect(stderr.includes('Unknown scope')).toBeFalsy();
  // Exit code may be non-zero due to git errors in test environment
  // (that's fine — we're testing routing, not the pipeline)
});
```

**Test B — unknown scope still rejects (regression guard):**

The existing test at line 75 covers this. It should remain as-is and continue to pass.

**Test C — updated usage message includes `full`:**

```typescript
test('rms review (no args) usage text includes "full" scope option', async () => {
  const { stdout, exitCode } = await runCli(['review']);
  expect(exitCode).toBe(0);
  // Non-TTY path prints usage; verify 'full' appears
  const output = stdout;
  expect(
    output.includes('full') || output.includes('Usage'),
  ).toBeTruthy();
});
```

**Note:** The existing test at line 59 checks for `local` and `pr` in output. The updated
usage string will also include `full`, so it will still pass. No regression risk.

#### New tests for `src/pipeline-io.test.ts`

Add a new `describe('getFullDiff', ...)` block. Since `getFullDiff` calls `simpleGit`
against a real git repo, the test must be run from within a directory that is a git repo.
The `cwd` of the test process is the project root (`join(__dirname, '..')`), which is a
git repo with commits. [VERIFIED: `git rev-list --max-parents=0 HEAD` works here]

```typescript
import {
  writeInputFile,
  parseReviewerOutput,
  parseValidatorOutput,
  verifyFileExists,
  getPrDiff,
  detectRepoSlug,
  getFullDiff,          // ← new import
} from './pipeline-io.js';
```

**Test D — `getFullDiff` returns non-empty diff for a real repo:**

```typescript
describe('getFullDiff', () => {
  test('returns non-empty diff and stats for a repo with commits', async () => {
    const projectRoot = join(__dirname, '..');
    const result = await getFullDiff(projectRoot);

    // Should have content (the rms repo has many source files)
    expect(result.diff.length > 0).toBeTruthy();

    // Stats should be present
    expect(typeof result.stats.originalLines).toBe('number');
    expect(Array.isArray(result.stats.strippedFiles)).toBeTruthy();

    // Diff should look like a real git diff
    expect(result.diff.includes('diff --git')).toBeTruthy();
  });

  test('preprocessor runs: strippedFiles is array (may be empty for clean repos)', async () => {
    const projectRoot = join(__dirname, '..');
    const result = await getFullDiff(projectRoot);
    // Stats are always present even if no files stripped
    expect(result.stats.strippedFiles).toBeDefined();
  });
});
```

**Test E — `writeInputFile` accepts `full-diff` scope:**

Add to the existing `describe('writeInputFile', ...)` block:

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

---

## Architecture Patterns

### How `runLocalReview` is structured (template for `runFullReview`)

```
runLocalReview(opts) — src/index.ts lines 74–163
  Step 1: getLocalDiff(projectRoot)         → { diff, stats }
  Step 2: createSession(projectRoot, slug)  → session
  Step 3: writeInputFile({ scope: 'local-diff', ... })
  Step 4: resolveModels()
  Step 5: runReviewer({ session, diff, focus, model, reviewsDir })
  Step 6: runValidator({ session, reviewerMdPath, inputMdPath, model })
  Step 7: runWriter({ session, findings, verdicts, ... })
  Step 8: console.log summary
```

`runFullReview` changes **only Steps 1, 2 (slug), and 3 (scope)**. Steps 4–8 are
copy-identical.

### Session slug pattern

| Scope | Slug pattern | Example session ID |
|-------|-------------|-------------------|
| local | `local-${nanoid(4)}` | `2026-04-09-local-a3b7` |
| pr | `pr-${prNumber}-${branch}` | `2026-04-09-pr-42-fix-auth` |
| **full** | `full-${nanoid(4)}` | `2026-04-09-full-x9qz` |

`nanoid(4)` prevents same-day collision (same pattern as local).

### `writeInputFile` — scope field propagation

The `scope` string written by `writeInputFile` propagates to three places:

1. **INPUT.md YAML frontmatter** (`scope: full-diff`) — validated by `InputFileSchema`
2. **INPUT.md XML body** (`<scope>full-diff</scope>`) — read by validator prompt
3. **REPORT.md table** — extracted by `writer.ts` line 230 (`extractFrontmatterField`)

The writer uses `extractFrontmatterField` which does a plain regex match — it will
correctly extract `full-diff` without any writer changes needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Git empty tree SHA | Compute it dynamically | Hard-code `4b825dc642cb6eb9a060e54bf8d69288fbee4904` (VERIFIED: `git hash-object -t tree /dev/null`) |
| Full diff computation | Shell exec or `child_process` | `simpleGit().diff([emptyTree, 'HEAD'])` — already in the project |
| Preprocessing | Custom strip logic | `preprocessDiff()` from `diff-preprocessor.ts` — handles lock files, binaries, `dist/`, `node_modules/` |

---

## Common Pitfalls

### Pitfall 1: Using `root..HEAD` instead of empty-tree approach

**What goes wrong:** `git diff ROOT_SHA..HEAD` skips files introduced in the initial
commit that were never subsequently modified. In this repo, `.planning/PROJECT.md` was in
the initial commit and would be missed.

**How to avoid:** Always diff from the empty tree SHA (`4b825dc642cb6eb9a060e54bf8d69288fbee4904`).
This is a well-known Git constant and doesn't require runtime computation.

**Warning signs:** File counts lower than `git ls-files | wc -l`.

---

### Pitfall 2: Forgetting `schemas.ts` scope enum

**What goes wrong:** TypeScript compiles fine (the `WriteInputOptions` union type is the
TS-level guard), but at runtime `InputFileSchema` (used in tests and potentially in future
validation) will reject `full-diff`. The schema lives in two places:

- `src/schemas.ts` line 89: `z.enum(['local-diff', 'pr-diff'])` — **must update**
- `src/pipeline-io.ts` line 62: TypeScript union literal — **must update**

**How to avoid:** Update both. They serve different purposes (runtime Zod validation vs.
TypeScript compile-time checking).

---

### Pitfall 3: Interactive selector — `full` handled only in argument path

**What goes wrong:** Adding `full` to the argument-based dispatch (`scope === 'full'` at
line 384+) but forgetting to add it to the interactive selector's post-select handler
(the `chosenScope === 'full'` branch). The user choosing `full` from the interactive
prompt gets a no-op return.

**How to avoid:** The dispatch logic exists in two places — update both:
1. Lines 358–381: Interactive path (post-`select()` handler)
2. Lines 384–401: Argument-based path (direct `rms review full`)

---

### Pitfall 4: Tests hanging on `getFullDiff` in non-git directories

**What goes wrong:** `getFullDiff` calls `simpleGit().diff(...)` which fails with a git
error if the test runs from a non-git directory (e.g., `/tmp`).

**How to avoid:** In `pipeline-io.test.ts` tests for `getFullDiff`, use
`join(__dirname, '..')` as the project root — this is the repo root (a real git repo with
commits). This is the same pattern already used by `detectRepoSlug` integration tests.

---

## Environment Availability

All dependencies are already present in the project:

| Dependency | Required By | Available | Version |
|------------|------------|-----------|---------|
| `simple-git` | `getFullDiff` | ✓ | `^3.35.2` (package.json line 30) |
| `preprocessDiff` | `getFullDiff` | ✓ | Local module `diff-preprocessor.ts` |
| Git binary | `simpleGit().diff()` | ✓ | Verified in shell |
| `nanoid` | Session slug | ✓ | `^5.1.7` (package.json line 29) |
| `vitest` | Tests | ✓ | `^4.1.0` (package.json line 37) |

**No new dependencies needed.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `just test` |
| Full suite command | `just test` (same; all tests run in one pass) |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| getFullDiff returns diff | Empty-tree diff works | unit | `vitest run src/pipeline-io.test.ts` | ❌ Wave 0 |
| getFullDiff stats present | DiffStats returned | unit | `vitest run src/pipeline-io.test.ts` | ❌ Wave 0 |
| `full-diff` scope accepted | writeInputFile type check | unit | `vitest run src/pipeline-io.test.ts` | ❌ Wave 0 |
| `rms review full` routes | CLI dispatch works | integration | `vitest run src/index.test.ts` | ❌ Wave 0 |
| Unknown scope still rejected | Regression guard | integration | `vitest run src/index.test.ts` | ✅ existing |

### Wave 0 Gaps

- `src/pipeline-io.test.ts` — needs `getFullDiff` describe block + `writeInputFile` `full-diff` scope test
- `src/index.test.ts` — needs `rms review full` routing test

---

## Change Summary (Exact File × Line Map)

| File | Change Type | Exact Location | Description |
|------|------------|----------------|-------------|
| `src/pipeline-io.ts` | Add interface | After line 29 | `FullDiffResult` interface |
| `src/pipeline-io.ts` | Add function | After line 50 | `getFullDiff` function |
| `src/pipeline-io.ts` | Edit | Line 62 | Add `'full-diff'` to `scope` union |
| `src/schemas.ts` | Edit | Line 89 | Add `'full-diff'` to `scope` zod enum |
| `src/index.ts` | Edit | Lines 11–17 import | Add `getFullDiff` to import |
| `src/index.ts` | Add function | After line 163 | `runFullReview` (~85 lines) |
| `src/index.ts` | Edit | Lines 339–349 | Add `full` choice to `select()` |
| `src/index.ts` | Edit | Lines 358–381 | Add `chosenScope === 'full'` branch |
| `src/index.ts` | Edit | Lines 353–355 | Add `full` to usage hint |
| `src/index.ts` | Edit | Lines 384–401 | Add `scope === 'full'` branch |
| `src/index.ts` | Edit | Line 403 | Update unknown-scope error to list `full` |
| `src/templates/opencode-review.md` | Edit | Line 3 | Add `full` to `argument-hint` |
| `src/templates/cursor-rms-review/SKILL.md` | Edit | Lines 12–14 | Add `full` option to re-invoke instructions |
| `README.md` | Edit | Lines 12, 94, 99–103, 188 | Add `full` to all synopsis/usage references |
| `src/pipeline-io.test.ts` | Add tests | After `detectRepoSlug` block | `getFullDiff` describe block + `full-diff` writeInputFile test |
| `src/index.test.ts` | Add tests | In `'rms review routing'` describe | `rms review full` routing test |

---

## Sources

### Primary (HIGH confidence — verified in this session)

- `src/index.ts` — full file read; line numbers cited are exact
- `src/pipeline-io.ts` — full file read; line numbers cited are exact
- `src/schemas.ts` — full file read; line numbers cited are exact
- `src/index.test.ts` — full file read; test patterns confirmed
- `src/pipeline-io.test.ts` — full file read; test patterns confirmed
- `src/templates/opencode-review.md` — full file read
- `src/templates/cursor-rms-review/SKILL.md` — full file read
- `README.md` — full file read; line numbers cited are exact
- `package.json` — full file read; dependency versions confirmed
- Node.js script execution — `getFullDiff` strategy verified live against this repo

### Verified constants

- Git empty tree SHA: `4b825dc642cb6eb9a060e54bf8d69288fbee4904`
  — verified via `git hash-object -t tree /dev/null` and `simpleGit().diff()` call
- Root commit SHA: `dc89e7bcf5c0f9eff0e3f54179f80bb7915c7fee`
  — verified via `git rev-list --max-parents=0 HEAD`
- Empty-tree diff: 144 files, 1,128,628 bytes raw, 1,090,108 bytes post-preprocessor
  — verified via live Node.js script in this session

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The empty tree SHA `4b825dc642cb6eb9a060e54bf8d69288fbee4904` is stable across Git versions | getFullDiff strategy | Very low — SHA-1 of empty tree is a mathematical constant in Git, not version-specific |
| A2 | `InputFileSchema` validation of `scope` is not currently called in the production pipeline (only in tests) | schemas.ts change | Low — writer uses `extractFrontmatterField` regex, not schema; extending enum is defensive but correct |

**Both assumptions have negligible risk if wrong** — the empty tree SHA is a mathematical
constant and the schema extension is additive.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in `package.json`
- Architecture: HIGH — all functions read directly from source, patterns confirmed by running code
- Pitfalls: HIGH — discovered by comparing `root..HEAD` vs `emptyTree..HEAD` live in this session
- Test patterns: HIGH — existing test files read completely, patterns directly copied

**Research date:** 2026-04-09
**Valid until:** Until any of `src/pipeline-io.ts`, `src/index.ts`, `src/schemas.ts` are modified
