---
phase: "10"
plan: "03"
subsystem: "docs, package-config"
tags: ["readme", "version-bump", "global-install", "npm-publish"]
dependency_graph:
  requires: ["10-01 (templates)", "10-02 (installer redesign)"]
  provides: ["user-facing global install documentation", "v0.2.0 release version"]
  affects: ["npm publish readiness", "user onboarding"]
tech_stack:
  added: []
  patterns: ["global npm install documentation pattern"]
key_files:
  created: []
  modified:
    - "README.md"
    - "package.json"
    - "src/index.ts"
decisions:
  - "Version bumped to 0.2.0 to mark the global-install release"
  - "Development section explicitly documents node dist/index.js for local dev — makes the dual-mode usage clear"
metrics:
  duration: "5 min"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 3
---

# Phase 10 Plan 03: README Update and Version Bump Summary

Updated README to document the global install flow (`npm install -g review-my-shit && rms install`) and bumped version to 0.2.0 to mark the Phase 10 global-install release.

## What Was Built

### Task 1: README updates
- **Getting Started / Install section**: Replaced clone-and-build workflow with `npm install -g review-my-shit && rms install`
  - Documents OpenCode global install (`~/.config/opencode/command/`)
  - Documents Cursor per-project install (`.cursor/commands/`)
- **CLI reference section**: All `node dist/index.js <subcommand>` → `rms <subcommand>`
- **Development section**: Added note: "For development, use `node dist/index.js <command>` instead of the globally-installed `rms`"

### Task 2: Version bump
- `package.json`: `"version": "0.1.0"` → `"0.2.0"`
- `src/index.ts`: `.version('0.1.0')` → `.version('0.2.0')`

### Install Verification
`node dist/index.js install` writes to:
- `~/.config/opencode/command/` (3 files: rms-review.md, rms-fix.md, rms-settings.md)
- `.cursor/commands/` (3 files)

Global `~/.config/opencode/command/rms-review.md` contains `!rms review $ARGUMENTS` ✓

## Decisions Made

1. **Keep `node dist/index.js` in Development section**: The plan explicitly asked to add this note to distinguish global vs development usage. The CLI ref and Install sections no longer mention it.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Verification

```
PASS: global install shown (npm install -g review-my-shit)
PASS: rms install shown
PASS: old install removed (node dist/index.js install gone)
PASS: CLI ref uses rms
PASS: global opencode path documented (~/.config/opencode/command/)
PASS: cursor per-project path documented (.cursor/commands/)
version: 0.2.0 | name: review-my-shit
157 tests passing
BUILD PASS
```

## Self-Check: PASSED

- README.md contains `npm install -g review-my-shit` ✓
- README.md CLI reference uses `rms` binary ✓
- `package.json` version is `0.2.0` ✓
- `src/index.ts` `.version('0.2.0')` ✓
- Commit b0d3f97 exists ✓
- 157 tests pass ✓
- `~/.config/opencode/command/rms-review.md` contains `!rms review $ARGUMENTS` ✓

## Awaiting

Task 3 is a `checkpoint:human-verify` — requires user to verify the end-to-end global install in their editors.
