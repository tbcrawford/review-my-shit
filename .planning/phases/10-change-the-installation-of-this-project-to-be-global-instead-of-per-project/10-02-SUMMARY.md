---
phase: "10"
plan: "02"
subsystem: "installer, cli"
tags: ["global-install", "opencode", "cursor", "tdd"]
dependency_graph:
  requires: ["10-01 (templates using rms binary)"]
  provides: ["global OpenCode install to ~/.config/opencode/command/", "per-project Cursor install"]
  affects: ["rms install UX", "editor command discovery"]
tech_stack:
  added: ["node:os homedir()"]
  patterns: ["optional param for test injection", "TDD red-green"]
key_files:
  created:
    - "src/installer.test.ts"
  modified:
    - "src/installer.ts"
    - "src/index.ts"
decisions:
  - "install() accepts optional globalDir param — enables TDD without writing to real homedir; defaults to join(homedir(), '.config', 'opencode', 'command')"
  - "GLOBAL_INSTALLS and PROJECT_INSTALLS replace single INSTALLS array — clearly expresses the split intent"
metrics:
  duration: "8 min"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 3
---

# Phase 10 Plan 02: Global OpenCode + Per-Project Cursor Installer Summary

Redesigned the `rms install` command so OpenCode slash commands install globally into `~/.config/opencode/command/` (all projects) while Cursor commands install per-project into `.cursor/commands/` (per-project).

## What Was Built

### Task 1: installer.ts redesign (TDD)
- **RED:** `src/installer.test.ts` with 5 tests covering global/per-project split — all failing against old implementation
- **GREEN:** Rewrote `src/installer.ts`:
  - Added `homedir` import from `node:os`
  - `GLOBAL_INSTALLS` array: 3 OpenCode templates → `~/.config/opencode/command/rms-*.md`
  - `PROJECT_INSTALLS` array: 3 Cursor templates → `.cursor/commands/rms-*.md`
  - `install(projectRoot, globalDir?)` — optional `globalDir` enables testing without touching real homedir
  - Logging: `"OpenCode (global): ..."` and `"Cursor (this project): ..."` sections

### Task 2: index.ts install action update
- `.description()`: "Install rms slash commands (OpenCode: global, Cursor: this project)"
- Removed misleading `console.log('Installing rms commands into ${projectRoot}...')`
- `await install(projectRoot)` call unchanged

### Smoke Test Output
```
OpenCode (global): /Users/tylercrawford/.config/opencode/command
  ✓ rms-review.md
  ✓ rms-fix.md
  ✓ rms-settings.md

Cursor (this project): /Users/tylercrawford/dev/github/review-my-shit
  ✓ .cursor/commands/rms-review.md
  ✓ .cursor/commands/rms-fix.md
  ✓ .cursor/commands/rms-settings.md

rms installed.
  OpenCode: commands available globally in all projects.
  Cursor: commands installed in this project...
```

## Decisions Made

1. **Optional `globalDir` param**: Rather than hardcoding `homedir()` inside a private scope, the function accepts an override. This keeps tests clean and avoids writing to the real `~/.config/opencode/command/` during test runs.

## Deviations from Plan

**[Rule 2 - Auto-deviation] Test design: optional globalDir param**
- **Found during:** Task 1 TDD setup
- **Issue:** Plan showed `install(projectRoot)` signature but tests need to verify files land in a temp globalDir, not the real homedir
- **Fix:** Added `globalDir?: string` as optional second parameter; plan's production behavior unchanged (defaults to `homedir()`)
- **Files modified:** `src/installer.ts`, `src/installer.test.ts`

## Verification

```
PASS: homedir imported
PASS: global opencode path present
PASS: GLOBAL_INSTALLS array present
PASS: PROJECT_INSTALLS array present
PASS: Cursor per-project path present
157 tests passing (5 new installer tests)
BUILD PASS
```

## Self-Check: PASSED

- `src/installer.ts` exists with GLOBAL_INSTALLS and PROJECT_INSTALLS ✓
- `src/installer.test.ts` exists with 5 passing tests ✓
- `src/index.ts` updated description, old log removed ✓
- Commit ae6d028 exists ✓
- 157 tests pass ✓
