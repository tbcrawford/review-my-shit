---
phase: "11"
plan: "01"
subsystem: installer
tags: [installer, tdd, selective-install, opencode, cursor]
dependency_graph:
  requires: []
  provides: [install-editors-option]
  affects: [src/installer.ts, src/installer.test.ts]
tech_stack:
  added: []
  patterns: [options-object-pattern, conditional-editor-install]
key_files:
  modified:
    - src/installer.ts
    - src/installer.test.ts
decisions:
  - "Options object replaces positional args for install() — cleaner ergonomics for Plan 02 setup.ts"
  - "Default editors=['opencode','cursor'] preserves backward compatibility for existing rms install command"
metrics:
  duration: "4 min"
  completed: "2026-04-07"
  tasks: 1
  files: 2
---

# Phase 11 Plan 01: Refactor install() with Editor Selection Summary

**One-liner:** `install()` now accepts `options.editors` to selectively install OpenCode, Cursor, or both — backward compatible with existing `rms install` call sites.

## What Was Built

Refactored `src/installer.ts` to accept an `options` object with an `editors` array, enabling the upcoming npx entrypoint (Plan 02) to pass the user's editor selection without duplicating install logic. The two-editor conditional structure is preserved: both editors install by default when no option is provided.

### Key Changes

**`src/installer.ts`**
- Signature changed from `install(projectRoot, globalDir?, cursorSkillsDir?)` to `install(projectRoot, options?)`
- `options.editors` defaults to `['opencode', 'cursor']` when omitted
- OpenCode install block guarded by `editors.includes('opencode')`
- Cursor install block guarded by `editors.includes('cursor')`
- Summary log messages only print for selected editors
- `GLOBAL_INSTALLS` and `CURSOR_SKILL_INSTALLS` arrays unchanged

**`src/installer.test.ts`**
- All 6 existing tests updated from positional args to options object: `install(root, globalDir, cursorDir)` → `install(root, { globalDir, cursorSkillsDir })`
- Added `describe('selective install')` block with 3 new tests:
  - `editors: ['opencode']` — OpenCode files written, Cursor files absent
  - `editors: ['cursor']` — Cursor files written, OpenCode files absent
  - `editors: ['opencode', 'cursor']` — both editors installed

## Test Results

| Metric | Before | After |
|--------|--------|-------|
| Tests passing | 158 | 161 |
| Tests failing | 0 | 0 |
| Installer tests | 6 | 9 |

## Deviations from Plan

None — plan executed exactly as written. TDD RED → GREEN flow followed:
1. Added 3 failing tests (RED: 3 fail, 158 pass)
2. Refactored installer.ts + updated test call syntax (GREEN: 161 pass)
3. Build verified: `npm run build` exits 0

## Known Stubs

None — all installer logic is fully wired. The `editors` option flows through to conditional install blocks with no placeholders.

## Self-Check: PASSED

- [x] `src/installer.ts` modified with editors option — `e593337`
- [x] `src/installer.test.ts` modified with 9 tests — `e593337`
- [x] 161 tests passing, 0 failing
- [x] `npm run build` exits 0
- [x] `editors?: ('opencode' | 'cursor')[]` present in installer.ts
