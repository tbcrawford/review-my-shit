---
phase: arch-dimension
plan: "01"
subsystem: schema,reviewer,tests,docs
tags: [dimension, DSGN, schema, prompt]
dependency_graph:
  requires: []
  provides: [DSGN-dimension]
  affects: [schemas.ts, reviewer.ts, pipeline-io.ts, finding-id.ts]
tech_stack:
  added: []
  patterns: [zod-enum-auto-update]
key_files:
  created: []
  modified:
    - src/schemas.ts
    - src/reviewer.ts
    - src/schemas.test.ts
    - src/finding-id.test.ts
    - src/reviewer.test.ts
    - src/pipeline-io.test.ts
    - README.md
    - AGENTS.md
decisions:
  - "DSGN added as last entry in DIMENSIONS array (after DOC) to preserve backward compatibility of counter-based IDs"
  - "schemas.ts updated before reviewer.ts per plan ordering to prevent Zod silently dropping DSGN findings"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-09"
  tasks: 3
  files: 8
requirements:
  - DSGN-01
---

# Phase arch-dimension Plan 01: Add DSGN Dimension Summary

**One-liner:** Added DSGN as the 12th review dimension covering API design quality and SRP violations, wired from schema through reviewer prompt to all test fixtures.

## What Was Changed

### src/schemas.ts
- Updated JSDoc: `All 11` → `All 12 review dimension abbreviations`
- Added `'DSGN'` as the 12th entry in the `DIMENSIONS` array (after `'DOC'`)
- `DimensionSchema = z.enum(DIMENSIONS)` auto-updated — no other schema changes needed

### src/reviewer.ts
- Updated file-level JSDoc: `Builds an 11-dimension` → `Builds a 12-dimension review prompt`
- Updated section comment: `11-dimension` → `12-dimension`
- Added DSGN bullet to DIMENSION DEFINITIONS block after DOC:
  ```
  - DSGN: Poor API design (unintuitive library interfaces, CLI flag/subcommand inconsistencies, REST/GraphQL/gRPC anti-patterns), violation of Single Responsibility Principle (classes/functions/modules doing more than one thing)
  ```
- Updated RULES block: `All 11` → `All 12 dimension headers must be present`
- Updated RULES dimension enum to include `DSGN` at end: `...API, DEP, DOC, DSGN`

### src/schemas.test.ts
- Test name: `'has all 11 abbreviations'` → `'has all 12 abbreviations'`
- Added `'DSGN'` to expected DIMENSIONS array

### src/finding-id.test.ts
- Updated length assertion: `.toBe(11)` → `.toBe(12)`

### src/reviewer.test.ts
- Test name: `'contains all 11 dimension names'` → `'contains all 12 dimension names'`
- Added `'DSGN'` to dimensions array in test
- Added `## DSGN\nNo DSGN issues found.` section to `fixtureReviewerMdContent`

### src/pipeline-io.test.ts
- Added `## DSGN\nNo DSGN issues found.` to `fixtureReviewerWithFindings`
- Added `## DSGN\nNo DSGN issues found.` to `fixtureReviewerWithInvalidFinding`
- Updated comment: `All 11` → `All 12 dimension headers present in the fixture`
- Updated assertion: `dimensionsCovered.length).toBe(11)` → `.toBe(12)`

### README.md
- Updated: `The reviewer analyzes code across 11 dimensions:` → `12 dimensions:`
- Added item 12: `12. API & interface design quality`

### AGENTS.md
- Updated pipeline overview: `Analyzes the diff across 11 dimensions.` → `12 dimensions.`

## DSGN Definition Added to Reviewer Prompt

```
- DSGN: Poor API design (unintuitive library interfaces, CLI flag/subcommand inconsistencies, REST/GraphQL/gRPC anti-patterns), violation of Single Responsibility Principle (classes/functions/modules doing more than one thing)
```

**Boundary note:** DSGN covers *design quality* decisions — NOT structural violations (ARCH handles circular deps/tight coupling) and NOT contract correctness (API handles breaking changes/missing parameter validation).

## Test Baseline Before/After

- **Before:** 169 passing, 2 failing (pre-existing setup.test.ts banner string case mismatch)
- **After:** 169 passing, 2 failing (same 2 pre-existing failures, no new failures)

## Commits

| Hash | Message |
|------|---------|
| `60dc5d9` | feat(arch-dimension-01): add DSGN as 12th review dimension to schema and prompt |
| `e928c30` | test(arch-dimension-01): update 4 test files for 12th DSGN dimension |
| `7d9ce9f` | docs(arch-dimension-01): update README and AGENTS.md for 12 dimensions |

## Deviations from Plan

None — plan executed exactly as written. The critical ordering constraint (schemas.ts before reviewer.ts) was followed.

## Self-Check: PASSED

- `src/schemas.ts` — DSGN present: ✓
- `src/reviewer.ts` — `- DSGN:` in DIMENSION DEFINITIONS: ✓
- `src/reviewer.ts` — `DOC, DSGN` in RULES enum: ✓
- `src/schemas.test.ts` — 12 abbreviations: ✓
- `src/finding-id.test.ts` — `.toBe(12)`: ✓
- `src/reviewer.test.ts` — DSGN in array + fixture: ✓
- `src/pipeline-io.test.ts` — DSGN in both fixtures + length 12: ✓
- `README.md` — 12 dimensions + item 12: ✓
- `AGENTS.md` — 12 dimensions: ✓
- Build (`just assemble`): ✓
- Tests: 169 passing, 2 pre-existing failures only: ✓
- `node -e "import('./dist/schemas.js').then(m => console.log(m.DIMENSIONS.includes('DSGN')))"` → `true`: ✓
