---
plan: 11-02
phase: 11
status: complete
completed: 2026-04-07
subsystem: cli
tags: [npx, entrypoint, setup, readline, installer]
dependency-graph:
  requires: [11-01]
  provides: [npx-entrypoint]
  affects: [package.json, installer.ts]
tech-stack:
  added: [node:readline, node:url/fileURLToPath]
  patterns: [ESM isMain guard, interactive CLI prompt, bin entry]
key-files:
  created:
    - src/setup.ts
    - src/setup.test.ts
  modified:
    - package.json
    - README.md
decisions:
  - Use fileURLToPath(import.meta.url) === process.argv[1] as isMain guard for ESM compatibility
  - readline over third-party prompting library to avoid new runtime dependency
  - BANNER_STRING and resolveEditorsFromArgs exported as pure functions for testability
key-decisions:
  - ESM isMain guard via fileURLToPath prevents test runner hang on import
  - readline(no-deps) chosen over prompts/inquirer for zero additional runtime deps
requirements: []
---

# Phase 11 Plan 02: npx Entrypoint (setup.ts) Summary

## One-liner

Interactive npx entrypoint `src/setup.ts` wired as `"review-my-shit"` bin in package.json, guarded by ESM `isMain` check so tests run without hanging.

## What Was Built

- **`src/setup.ts`**: npx entrypoint registered as `"review-my-shit"` bin. Supports `--opencode`, `--cursor`, `--yes`/`-y` flags (non-interactive scripting path) and an interactive numbered prompt (`node:readline`) when no flags are passed. Calls `install(projectRoot, { editors })` with the selected editors. Guarded by `fileURLToPath(import.meta.url) === process.argv[1]` so importing the module in tests does not trigger `main()`.
- **`src/setup.test.ts`**: 7 unit tests covering `resolveEditorsFromArgs` (all flag combinations + no-flag null return) and `BANNER_STRING` content. Tests are isolated — no subprocess spawning, no stdin simulation.
- **`package.json`**: Added `"review-my-shit": "dist/setup.js"` bin entry alongside existing `"rms": "dist/index.js"`.
- **`README.md`**: `npx review-my-shit` promoted to primary install method; legacy global install documented as alternative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `main()` called unconditionally — hung test runner**
- **Found during:** Final verification (SUMMARY creation)
- **Issue:** `main()` was called at module scope (`main().catch(...)`). When `setup.test.ts` imported `./setup.js`, `main()` ran immediately, opened a readline prompt on stdin, and the test process hung for 180s before the timeout killed it.
- **Fix:** Added `fileURLToPath` import and an `isMain` guard (`process.argv[1] === __filename`). `main()` only runs when the file is executed directly as a Node.js script.
- **Files modified:** `src/setup.ts`
- **Commit:** `293b009`

## Test Results

- 168 tests total, 0 failures
- All 7 new `setup.test.ts` tests pass
- Pre-existing 161 tests unaffected

## Commits

| Hash | Message |
|------|---------|
| `31a4863` | feat(11-02): create src/setup.ts — npx entrypoint with readline editor |
| `f7cc449` | feat(11-02): wire package.json bin entry + update README install section |
| `293b009` | fix(11-02): guard main() with isMain check so tests can import setup.ts |

## Self-Check: PASSED

- `npm run build` exits 0
- `npm test` → 168 pass, 0 fail
- `node dist/setup.js --yes` triggers install (verified at human checkpoint)
- `"review-my-shit": "dist/setup.js"` bin entry confirmed in package.json
- Human checkpoint approved — end-to-end prompt flow verified
