---
phase: 15-color-the-rms-ascii-art-banner-and-switch-the-multi-selector-to-ink-or-inquirer
plan: 02
subsystem: setup/index/cli-ux
tags: [inquirer, interactive-prompt, cli-ux, arrow-key-selector]
dependency_graph:
  requires: [colored-banner]
  provides: [arrow-key-selector-setup, arrow-key-selector-review]
  affects: [src/setup.ts, src/index.ts, src/index.test.ts, package.json]
tech_stack:
  added: ["@inquirer/prompts@8.4.1"]
  patterns: [inquirer-select-api, non-tty-fallback, try-catch-graceful-degradation]
key_files:
  created: []
  modified:
    - src/setup.ts
    - src/index.ts
    - src/index.test.ts
    - package.json
    - bun.lock
decisions:
  - "@inquirer/prompts v8 used (ESM-native, zero peer deps, ships own types, no React required)"
  - "Non-TTY fallback via try/catch — select() throws in non-interactive environments; catch returns sensible default"
  - "index.ts imports both select and input at top level (not dynamic) for cleaner module loading"
  - "index.test.ts updated to close stdin immediately so inquirer falls back to non-TTY path in CI"
metrics:
  duration: 311s
  completed: "2026-04-08"
  tasks: 2
  files: 5
---

# Phase 15 Plan 02: Switch Multi-Selector to @inquirer/prompts Summary

**One-liner:** @inquirer/prompts v8 replaces readline number-entry in setup.ts and console.log menu in index.ts with arrow-key interactive selectors, with non-TTY try/catch fallbacks.

---

## What Was Built

Added `@inquirer/prompts@8.4.1` as a runtime dependency and replaced two legacy prompt implementations:

1. **`src/setup.ts`** — Removed `createInterface`/readline and the `promptLine` helper. The `promptEditorSelection()` function now calls `select()` from `@inquirer/prompts` with three choices (Both / OpenCode / Cursor), defaulting to "Both". Wrapped in `try/catch` so non-TTY environments fall back to `['opencode', 'cursor']` silently.

2. **`src/index.ts`** — Replaced the plain `console.log` numbered scope menu (which just printed and exited) with an interactive `select()` prompt. When the user picks "local" it immediately runs the local review pipeline. When the user picks "pr" it follows up with an `input()` prompt for the PR number before running `runPrReview`. Non-TTY catch block prints usage text and returns cleanly.

3. **`src/index.test.ts`** — Updated the `rms review (no args)` test to: (a) explicitly close stdin so inquirer doesn't hang, and (b) check for `local`/`pr` keywords or `Usage:` text in the output rather than the old static menu strings.

---

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @inquirer/prompts and replace promptEditorSelection in setup.ts | `2ccad6e` | package.json, bun.lock, src/setup.ts |
| 2 | Replace scope-selection prompt in index.ts with @inquirer/prompts select | `103bbd1` | src/index.ts, src/index.test.ts |

---

## Verification

- `bun run build` exits 0 — TypeScript compiles cleanly with @inquirer/prompts import
- `bun run test` exits 0 — 169 tests pass (all 169 pass)
- `grep "from '@inquirer/prompts'" src/setup.ts` → match at line 16
- `grep "from '@inquirer/prompts'" src/index.ts` → match at line 6
- `grep "createInterface\|readline" src/setup.ts` → NO match (readline fully removed)
- `grep "Re-invoke with your choice" src/index.ts` → NO match (old plain prompt removed)
- `grep "chalk" package.json` → `"chalk": "^5.6.2"` in dependencies (from Plan 01)
- `grep "@inquirer/prompts" package.json` → `"@inquirer/prompts": "^8.4.1"` in dependencies
- `node dist/setup.js --yes` → banner + no prompt + installs for both editors
- `node dist/setup.js` → arrow-key selector appears (AWAITING HUMAN VERIFY)
- `node dist/index.js review` → arrow-key selector appears (AWAITING HUMAN VERIFY)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated index.test.ts to match new non-TTY behavior**
- **Found during:** Task 2 build+test
- **Issue:** The existing `rms review (no args)` test expected the old static text output (`What would you like to review?`, `Re-invoke with your choice`). With `@inquirer/prompts`, the subprocess stdin is a pipe (not a TTY), so `select()` throws and the catch block prints `Usage: ...` instead. Test timed out at 5000ms waiting for process to exit.
- **Fix:** (a) Added `stdio: ['pipe', 'pipe', 'pipe']` + `proc.stdin.end()` to `runCli()` so stdin closes immediately, triggering the non-TTY fallback. (b) Updated assertion to check for `local`/`pr` OR `Usage` keywords — both the interactive path and the fallback path produce valid output.
- **Files modified:** `src/index.test.ts`
- **Commit:** `103bbd1`

---

## Known Stubs

None — both interactive selectors are fully wired to their respective logic paths.

---

## Self-Check: PASSED

- [x] `src/setup.ts` exists and contains `import { select } from '@inquirer/prompts'`
- [x] `src/index.ts` exists and contains `import { select, input } from '@inquirer/prompts'`
- [x] `src/setup.ts` has NO `createInterface` or `readline` references
- [x] `src/index.ts` has NO `Re-invoke with your choice` text
- [x] `package.json` has `"@inquirer/prompts": "^8.4.1"` in dependencies
- [x] Commit `2ccad6e` exists in git log
- [x] Commit `103bbd1` exists in git log
- [x] All 169 tests pass
- [x] Build exits 0
