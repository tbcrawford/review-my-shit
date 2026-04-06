---
phase: 02-reviewer-agent
plan: "01"
subsystem: pipeline-io
tags: [simple-git, git-diff, preprocessing, node-test, zod]

requires:
  - phase: 01-foundation
    provides: "FindingSchema, DIMENSIONS, Finding types, SessionInfo interface, nextFindingId"
provides:
  - "preprocessDiff strips lock files, binary files, node_modules/, dist/, build/, minified files from raw git diff"
  - "getLocalDiff reads both staged and unstaged git diffs via simple-git, runs preprocessor"
  - "writeInputFile writes INPUT.md with YAML frontmatter and XML-tagged blocks (<scope>, <focus>, <diff>)"
  - "parseReviewerOutput extracts <finding> blocks from REVIEWER.md, validates with FindingSchema, tracks dimensionsCovered/dimensionsWithFindings"
affects: [02-02, 03-validator, 05-orchestration]

tech-stack:
  added: [simple-git (getLocalDiff), node:test (tests)]
  patterns:
    - "Git diff preprocessing before LLM: split at diff --git boundaries, test each section, strip by pattern"
    - "TDD with node:test built-in test runner — no external test framework"
    - "Zod schema validation for parsed LLM output (FindingSchema.omit({ id: true }).safeParse)"

key-files:
  created:
    - src/diff-preprocessor.ts
    - src/diff-preprocessor.test.ts
    - src/pipeline-io.ts
    - src/pipeline-io.test.ts
  modified: []

key-decisions:
  - "simpleGit({ baseDir }) named export used instead of default export — matches simple-git v3 ESM API"
  - "Pipeline I/O separator for 'focus' in frontmatter: omit line entirely when undefined (not write 'focus: undefined')"
  - "parseFindingBlock uses key:value line detection with multi-line accumulation for explanation/suggestion"

patterns-established:
  - "DiffStats interface: originalLines, strippedFiles[], remainingLines"
  - "LocalDiffResult interface: diff, stats, hasStagedChanges, hasUnstagedChanges"
  - "ParsedReviewerOutput interface: findings (without id), dimensionsCovered, dimensionsWithFindings, rawContent"
  - "INPUT.md format: YAML frontmatter + XML blocks (<scope>, <focus>, <diff>)"

requirements-completed: [DIFF-02, PIPE-06]

duration: 8min
completed: 2026-04-06
---

# Phase 2 Plan 01: Diff Preprocessor & Pipeline I/O Summary

**Diff preprocessing pipeline strips lock files, binary content, and node_modules before LLM sees the diff; pipeline I/O reads git diff, writes XML-tagged INPUT.md, and parses REVIEWER.md findings with Zod validation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T01:19:54Z
- **Completed:** 2026-04-06T01:27:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `preprocessDiff` splits raw git diff at `diff --git` boundaries, strips 8 lock file patterns, node_modules/, dist/, build/, *.min.js, *.min.css, and binary file markers — 12 tests cover all patterns
- `getLocalDiff` reads both staged and unstaged diffs via simple-git and runs preprocessor before returning
- `writeInputFile` writes INPUT.md with YAML frontmatter (focus line conditionally included) and XML-tagged `<scope>`, `<focus>`, `<diff>` blocks for clean LLM parsing
- `parseReviewerOutput` parses `<finding>` blocks with multi-line explanation/suggestion support, validates each against `FindingSchema.omit({ id: true })`, skips invalid findings with warning, tracks `dimensionsCovered` (section headers) and `dimensionsWithFindings` (findings present)

## Task Commits

1. **Task 1: Diff preprocessor** — `a96e1b3` (feat)
2. **Task 2: Pipeline I/O** — `dd495f3` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/diff-preprocessor.ts` — preprocessDiff function, DiffStats interface, strip pattern logic
- `src/diff-preprocessor.test.ts` — 12 tests covering all strip patterns, binary markers, stats
- `src/pipeline-io.ts` — getLocalDiff, writeInputFile, parseReviewerOutput
- `src/pipeline-io.test.ts` — 7 tests covering INPUT.md format and REVIEWER.md parsing

## Decisions Made

- `simpleGit({ baseDir })` named export used instead of default export — simple-git v3 ESM API has no default callable
- Focus line omitted from frontmatter entirely when undefined (not written as `focus: undefined`)
- `parseFindingBlock` accumulates multi-line explanation/suggestion fields until next key: line or end of block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed simpleGit import for ESM named export**
- **Found during:** Task 2 (pipeline-io.ts implementation)
- **Issue:** `import simpleGit from 'simple-git'` with `simpleGit(projectRoot)` produces TypeScript error "This expression is not callable" — simple-git v3 exports named `simpleGit`, not a default callable
- **Fix:** Changed to `import { simpleGit } from 'simple-git'` and used `simpleGit({ baseDir: projectRoot })`
- **Files modified:** src/pipeline-io.ts
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** dd495f3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was required for TypeScript compilation. No scope creep.

## Issues Encountered

- LSP reports "Cannot find module './diff-preprocessor.js'" and './pipeline-io.js'" in test files — false positive. The `.js` extension resolves to `.ts` via tsx/NodeNext module resolution at runtime. `tsc --noEmit` confirms zero actual errors.

## Next Phase Readiness

- Plan 02-02 (Reviewer Agent) depends on pipeline-io.ts — all three functions are exported and ready
- `parseReviewerOutput` returns `findings` without IDs as expected by Plan 02-02 orchestrator pattern
- INPUT.md format matches the spec in 02-CONTEXT.md (D-10, D-11)

---
*Phase: 02-reviewer-agent*
*Completed: 2026-04-06*
