---
phase: full-review
plan: "01"
subsystem: pipeline
tags: [full-diff, getFullDiff, runFullReview, routing, tests, templates, docs]
dependency_graph:
  requires: []
  provides: [full-diff-scope, getFullDiff, runFullReview]
  affects: [pipeline-io, index, schemas, templates, readme]
tech_stack:
  added: []
  patterns: [empty-tree-sha, nanoid-slug, scope-enum]
key_files:
  created: []
  modified:
    - src/pipeline-io.ts
    - src/schemas.ts
    - src/index.ts
    - src/pipeline-io.test.ts
    - src/index.test.ts
    - src/templates/opencode-review.md
    - src/templates/cursor-rms-review/SKILL.md
    - README.md
decisions:
  - Empty-tree SHA 4b825dc642cb6eb9a060e54bf8d69288fbee4904 used (mathematical constant — tamper-proof)
  - Slug format full-{nanoid(4)} mirrors local-{nanoid(4)} convention
  - 'full-diff' scope string mirrors 'local-diff' and 'pr-diff' naming convention
  - runFullReview mirrors runLocalReview exactly — only diff source, slug, and scope differ
metrics:
  duration: ~15 minutes
  completed: "2026-04-09T14:42:00Z"
  tasks_completed: 5
  files_modified: 8
---

# Phase full-review Plan 01: Add rms review full subcommand Summary

**One-liner:** Full-codebase review via `git diff 4b825dc…HEAD` with `full-{nanoid(4)}` session slug and `full-diff` scope string wired into both interactive and argument dispatch paths.

---

## What Was Built

### getFullDiff (src/pipeline-io.ts)

- New exported `FullDiffResult` interface: `{ diff: string; stats: DiffStats }`
- New exported `getFullDiff(projectRoot)` function using empty-tree SHA `4b825dc642cb6eb9a060e54bf8d69288fbee4904`
- Uses `simpleGit` (already imported) — no new dependencies
- Runs `preprocessDiff` on the raw diff (strips lock files, binaries — same as existing scopes)

### Schema extensions (src/pipeline-io.ts, src/schemas.ts)

- `WriteInputOptions.scope` extended: `'local-diff' | 'pr-diff' | 'full-diff'`
- `InputFileSchema` zod enum extended: `z.enum(['local-diff', 'pr-diff', 'full-diff'])`

### runFullReview (src/index.ts)

- New `runFullReview` function inserted between `runLocalReview` and `runPrReview`
- Identical 7-step pipeline to `runLocalReview` with 3 differences:
  1. Diff source: `getFullDiff(projectRoot)` (empty tree → HEAD)
  2. Session slug: `full-${nanoid(4)}` (e.g. `2026-04-09-full-kauc`)
  3. Scope: `'full-diff'`
- Empty diff message: `'No commits found in this repository.'`

### Dispatch wiring (src/index.ts)

- `getFullDiff` added to import block from `./pipeline-io.js`
- Interactive selector: `full` added as third choice after `pr`
- Non-TTY usage hint: `rms review full [--focus <area>]` added
- Interactive post-select: `chosenScope === 'full'` branch added
- Argument dispatch: `scope === 'full'` branch added
- Unknown-scope error updated: `Valid scopes are: local, pr, full`

### Tests (src/pipeline-io.test.ts, src/index.test.ts)

**pipeline-io.test.ts — 3 new tests:**
- `getFullDiff` describe block (2 tests):
  - Returns non-empty diff containing `diff --git` headers
  - `stats.strippedFiles` is always defined
- `writeInputFile` describe block (1 test):
  - `full-diff` scope writes correct `scope: full-diff` frontmatter and `<scope>full-diff</scope>` body

**index.test.ts — 2 new tests:**
- `rms review full is accepted`: no `Unknown scope` in stderr
- `rms review (no args) usage includes full`: `full` in non-TTY output

**Test delta:** 171 passing → 174 passing (5 new tests added, 5 pass)

### Templates and README (src/templates/, README.md)

- `opencode-review.md`: `argument-hint` updated to include `| full`
- `cursor-rms-review/SKILL.md`: `argument-hint` updated; `rms review full [--focus <area>]` re-invoke instruction added
- `README.md`: 4 locations updated:
  1. Diagram header: `/rms-review [local | pr <number> | full]`
  2. Command heading: `### /rms-review [local | pr <number> | full] [--focus <area>]`
  3. Usage examples block: `/rms-review full` and `/rms-review full --focus security` added
  4. CLI reference: `rms review [local | pr <pr-number> | full] [--focus <area>]`

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8467277 | feat | Add getFullDiff, FullDiffResult, and full-diff scope to pipeline-io.ts and schemas.ts |
| 20d6e24 | test | Add getFullDiff unit tests and writeInputFile full-diff scope test |
| ab06e2d | feat | Add runFullReview and wire both dispatch paths in index.ts |
| f9e0bac | test | Add CLI routing tests for rms review full |
| 240e61c | docs | Document full scope in templates and README |

---

## Decisions Made

1. **Empty-tree SHA strategy:** Used `4b825dc642cb6eb9a060e54bf8d69288fbee4904` (the canonical git empty tree SHA). This is a mathematical constant — it cannot be spoofed by repo content. Ensures all files, including those introduced in the initial commit and never modified since, are captured.

2. **Slug format `full-{nanoid(4)}`:** Mirrors the existing `local-{nanoid(4)}` convention. Session directories are named `<date>-full-<4chars>` (e.g. `2026-04-09-full-kauc`).

3. **Scope string `full-diff`:** Consistent with `local-diff` and `pr-diff`. Used in both the TypeScript union type and the zod enum.

4. **No changes to existing functions:** `runLocalReview`, `runPrReview`, `getLocalDiff`, `getPrDiff` are unchanged.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Smoke Test Results

- `npx tsc --noEmit` → exits 0 ✅
- `just test` → 174 passed, 2 failed (pre-existing `setup.test.ts` banner failures, not regressions) ✅
- `node dist/index.js review full` → no `Unknown scope`; session `2026-04-09-full-kauc` created; INPUT.md has `scope: full-diff` ✅
- `node dist/index.js review` (no args, non-TTY) → exits 0, usage text includes `full` ✅

---

## Self-Check: PASSED

- [x] `src/pipeline-io.ts` — `getFullDiff` and `FullDiffResult` exported, `WriteInputOptions.scope` includes `'full-diff'`
- [x] `src/schemas.ts` — `InputFileSchema` enum includes `'full-diff'`
- [x] `src/index.ts` — `runFullReview` exists, import block includes `getFullDiff`, both dispatch paths wired
- [x] `src/pipeline-io.test.ts` — `getFullDiff` describe block + `writeInputFile` full-diff scope test
- [x] `src/index.test.ts` — routing tests for `rms review full` and `rms review` usage
- [x] `src/templates/opencode-review.md` — argument-hint includes `| full`
- [x] `src/templates/cursor-rms-review/SKILL.md` — argument-hint + re-invoke instruction for full
- [x] `README.md` — all 4 synopsis locations updated
- [x] Commits: 8467277, 20d6e24, ab06e2d, f9e0bac, 240e61c all exist in git log
