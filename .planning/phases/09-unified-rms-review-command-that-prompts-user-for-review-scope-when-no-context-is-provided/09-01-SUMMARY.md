---
plan: "01"
phase: "09"
status: complete
subsystem: cli-routing
tags: [refactor, cli, routing, testing]
dependency_graph:
  requires: []
  provides: [runLocalReview, runPrReview, review-command]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [commander-chaining, helper-extraction, child-process-testing]
key_files:
  created: [src/index.test.ts]
  modified: [src/index.ts]
decisions:
  - Helper functions placed before program declaration, after resolveModels
  - No pipeline logic changed — pure refactor + new routing layer
  - Scope prompt exits 0 (not an error); unknown scope exits 1
  - Routing tests use child_process spawn to isolate process.exit() calls
metrics:
  duration: ~10 minutes
  completed: 2026-04-06
  tasks: 4
  files: 2
---

# Phase 09 Plan 01: Unified rms review Command Summary

Extracted shared pipeline helpers and added unified `review` command with scope routing for the rms CLI.

## What was done
- Extracted `runLocalReview()` and `runPrReview()` shared helpers from `review-local` / `review-pr` action bodies
- Updated `review-local` and `review-pr` commands to delegate to helpers (zero pipeline logic changed)
- Added unified `review` sub-command with scope routing (`local`, `pr <N>`) and scope-prompt output (no args)
- Added routing unit tests in `src/index.test.ts` using `child_process.spawn` to isolate `process.exit()` calls
- All 152 tests pass (149 existing + 3 new routing tests)

## Key decisions
- Helper functions placed before `program` declaration, after `resolveModels`
- No pipeline logic changed — pure refactor + new routing layer
- Scope prompt exits 0 (not an error); unknown scope exits 1
- Routing tests spawn child process via `node --import tsx/esm` to properly isolate Commander's `process.exit()` behavior

## Deviations from Plan

None — plan executed exactly as written.

## Verification Checks

All verification checks passed:
- `grep -c "async function runLocalReview" src/index.ts` → 1 ✓
- `grep -c "async function runPrReview" src/index.ts` → 1 ✓
- `program.command('review')` present in src/index.ts at line 326 ✓
- `"What would you like to review"` present in src/index.ts ✓
- `"Unknown scope"` present in src/index.ts ✓
- `npm test` → 152 tests pass, 0 failures ✓
- `npm run typecheck` → no type errors ✓

## Self-Check: PASSED

- `src/index.ts` modified: FOUND ✓
- `src/index.test.ts` created: FOUND ✓
- Commit b7b3720 exists ✓
