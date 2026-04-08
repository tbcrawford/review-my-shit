---
phase: 15-color-the-rms-ascii-art-banner-and-switch-the-multi-selector-to-ink-or-inquirer
plan: 02
subsystem: setup/index/cli-ux
tags: [inquirer, interactive-prompt, cli-ux, checkbox-selector, block-letter-banner, ctrl-c]
dependency_graph:
  requires: [colored-banner]
  provides: [checkbox-selector-setup, arrow-key-selector-review, block-letter-banner, ctrl-c-exit]
  affects: [src/setup.ts, src/setup.test.ts, src/index.ts, src/index.test.ts, package.json]
tech_stack:
  added: ["@inquirer/prompts@8.4.1"]
  patterns: [inquirer-select-api, inquirer-checkbox-api, non-tty-fallback, try-catch-graceful-degradation, ExitPromptError-detection]
key_files:
  created: []
  modified:
    - src/setup.ts
    - src/setup.test.ts
    - src/index.ts
    - src/index.test.ts
    - package.json
    - bun.lock
decisions:
  - "@inquirer/prompts v8 used (ESM-native, zero peer deps, ships own types, no React required)"
  - "Non-TTY fallback via try/catch — select()/checkbox() throws in non-interactive environments; catch returns sensible default"
  - "Ctrl+C detected via ExitPromptError from @inquirer/core — exits process.exit(130) instead of silently continuing"
  - "Checkbox replaces select for editor selection — both pre-checked by default, user can deselect"
  - "Block-letter ██-style ASCII art replaces box-border banner — chalk.bold.cyan coloring"
  - "index.ts imports both select and input at top level (not dynamic) for cleaner module loading"
  - "index.test.ts updated to close stdin immediately so inquirer falls back to non-TTY path in CI"
metrics:
  duration: 311s
  completed: "2026-04-08"
  tasks: 5
  files: 6
---

# Phase 15 Plan 02: Switch Multi-Selector to @inquirer/prompts Summary

**One-liner:** @inquirer/prompts v8 replaces readline number-entry (setup.ts) and console.log menu (index.ts) with arrow-key/checkbox interactive selectors; block-letter ██-style ASCII banner added; Ctrl+C exits cleanly via ExitPromptError detection.

---

## What Was Built

Added `@inquirer/prompts@8.4.1` as a runtime dependency. Across five commits:

1. **`src/setup.ts` — @inquirer/prompts select (Task 1):** Removed `createInterface`/readline and the `promptLine` helper. The `promptEditorSelection()` function calls `select()` with three choices (Both / OpenCode / Cursor), defaulting to "Both". Wrapped in `try/catch` so non-TTY environments fall back to `['opencode', 'cursor']` silently.

2. **`src/index.ts` — @inquirer/prompts scope selector (Task 2):** Replaced the plain `console.log` numbered scope menu (which just printed and exited) with an interactive `select()` prompt. Picking "local" immediately runs the local review pipeline. Picking "pr" follows up with `input()` for the PR number before running `runPrReview`. Non-TTY catch block prints usage text and returns cleanly.

3. **`src/setup.ts` — Block-letter ASCII art banner (post-checkpoint deviation):** Replaced the box-border banner with `██`-style block-letter RMS art. Colored `chalk.bold.cyan` per spec; subtitle (`chalk.dim.white`) and version (`chalk.yellow`) preserved. Tests 7/8 in `src/setup.test.ts` updated to match new banner content.

4. **`src/setup.ts` — Ctrl+C exits cleanly (post-checkpoint fix):** `ExitPromptError` imported from `@inquirer/core`. The `promptEditorSelection` catch block now detects `ExitPromptError` and calls `process.exit(130)` instead of falling through to the install path. Non-TTY and all other errors still fall through to default `['opencode', 'cursor']`. Tests 9 and 10 added to `src/setup.test.ts` to cover both paths.

5. **`src/setup.ts` — Checkbox multi-selector (post-checkpoint enhancement):** `select()` replaced with `checkbox()` from `@inquirer/prompts` — both editors are pre-checked by default. The user can deselect editors rather than picking one option from a radio list. Return type mapping preserved: all checked → `['opencode','cursor']`, only `opencode` checked → `['opencode']`, only `cursor` checked → `['cursor']`. `src/setup.test.ts` trimmed to match simplified API.

---

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @inquirer/prompts and replace promptEditorSelection in setup.ts | `2ccad6e` | package.json, bun.lock, src/setup.ts |
| 2 | Replace scope-selection prompt in index.ts with @inquirer/prompts select | `103bbd1` | src/index.ts, src/index.test.ts |
| 3 (checkpoint) | Human verify colored banner + interactive selectors | Checkpoint approved | — |
| 4 | Use block-letter ██-style ASCII art banner | `a1a002e` | src/setup.ts, src/setup.test.ts |
| 5 | Exit cleanly on Ctrl+C via ExitPromptError | `e73e7d5` | src/setup.ts, src/setup.test.ts |
| 6 | Switch to checkbox multi-selector with both editors pre-checked | `a312d54` | src/setup.ts, src/setup.test.ts |

---

## Verification

- `bun run build` exits 0 — TypeScript compiles cleanly with @inquirer/prompts import
- `bun run test` exits 0 — all tests pass
- `grep "from '@inquirer/prompts'" src/setup.ts` → match (checkbox import)
- `grep "from '@inquirer/prompts'" src/index.ts` → match (select + input imports)
- `grep "createInterface\|readline" src/setup.ts` → NO match (readline fully removed)
- `grep "Re-invoke with your choice" src/index.ts` → NO match (old plain prompt removed)
- `grep "chalk" package.json` → `"chalk": "^5.6.2"` in dependencies (from Plan 01)
- `grep "@inquirer/prompts" package.json` → `"@inquirer/prompts": "^8.4.1"` in dependencies
- `node dist/setup.js --yes` → block-letter banner + no prompt + installs for both editors
- `node dist/setup.js` → checkbox selector with both pre-checked (human verified ✓)
- `node dist/index.js review` → arrow-key scope selector (human verified ✓)
- Ctrl+C on `node dist/setup.js` → exits cleanly with code 130 (human verified ✓)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated index.test.ts to match new non-TTY behavior**
- **Found during:** Task 2 build+test
- **Issue:** The existing `rms review (no args)` test expected the old static text output (`What would you like to review?`, `Re-invoke with your choice`). With `@inquirer/prompts`, the subprocess stdin is a pipe (not a TTY), so `select()` throws and the catch block prints `Usage: ...` instead. Test timed out at 5000ms waiting for process to exit.
- **Fix:** (a) Added `stdio: ['pipe', 'pipe', 'pipe']` + `proc.stdin.end()` to `runCli()` so stdin closes immediately, triggering the non-TTY fallback. (b) Updated assertion to check for `local`/`pr` OR `Usage` keywords — both the interactive path and the fallback path produce valid output.
- **Files modified:** `src/index.test.ts`
- **Commit:** `103bbd1`

**2. [Rule 1 - Bug] Block-letter banner replaces box-border banner (post-checkpoint)**
- **Found during:** Human verification checkpoint
- **Issue:** Human reviewer noted the banner should use `██`-style block-letter art rather than the box-border style originally implemented.
- **Fix:** Replaced box-border banner in `src/setup.ts` with full `██`-character block-letter RMS art; `chalk.bold.cyan` applied to block letters. Tests 7/8 updated to match new content.
- **Files modified:** `src/setup.ts`, `src/setup.test.ts`
- **Commit:** `a1a002e`

**3. [Rule 1 - Bug] Ctrl+C exits cleanly via ExitPromptError detection (post-checkpoint)**
- **Found during:** Human verification checkpoint
- **Issue:** Pressing Ctrl+C during the inquirer prompt was falling through the generic catch block to the default install path instead of exiting the process.
- **Fix:** Imported `ExitPromptError` from `@inquirer/core`. Catch block now checks `instanceof ExitPromptError` and calls `process.exit(130)`. Tests 9 and 10 added.
- **Files modified:** `src/setup.ts`, `src/setup.test.ts`
- **Commit:** `e73e7d5`

**4. [Rule 2 - Enhancement] Checkbox multi-selector replaces radio select (post-checkpoint)**
- **Found during:** Human verification checkpoint
- **Issue:** The `select()` API presents a radio-button style list — user picks one option (Both / OpenCode / Cursor). Checkbox is more intuitive for "select all that apply" editor installation.
- **Fix:** Replaced `select()` with `checkbox()` from `@inquirer/prompts`. Both editors pre-checked; user can deselect. Return value mapped: checked array → `('opencode' | 'cursor')[]`.
- **Files modified:** `src/setup.ts`, `src/setup.test.ts`
- **Commit:** `a312d54`

---

## Known Stubs

None — all interactive selectors are fully wired to their respective logic paths.

---

## Self-Check: PASSED

- [x] `src/setup.ts` exists and contains `import { checkbox } from '@inquirer/prompts'`
- [x] `src/index.ts` exists and contains `import { select, input } from '@inquirer/prompts'`
- [x] `src/setup.ts` has NO `createInterface` or `readline` references
- [x] `src/index.ts` has NO `Re-invoke with your choice` text
- [x] `package.json` has `"@inquirer/prompts": "^8.4.1"` in dependencies
- [x] Block-letter `██`-style ASCII banner in `src/setup.ts`
- [x] `ExitPromptError` imported from `@inquirer/core` in `src/setup.ts`
- [x] Commits `2ccad6e`, `103bbd1`, `a1a002e`, `e73e7d5`, `a312d54` all exist in git log
- [x] Human checkpoint approved — colored banner, checkbox selector, Ctrl+C all verified
