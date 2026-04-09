---
phase: 17-command-ux-overhaul-flag-free-intelligent-routing-interactiv
plan: "04"
subsystem: tests-and-build
tags: [tests, vitest, build, installer, index, setup, human-checkpoint]
dependency_graph:
  requires: [rms-reviewer-cmd, rms-validator-cmd, rms-writer-cmd, 6-command-installer, opencode-rms-reviewer, cursor-rms-reviewer]
  provides: [passing-test-suite, clean-build, globally-installed-6-commands]
  affects: [src/installer.test.ts, src/index.test.ts, src/setup.test.ts, dist/]
tech_stack:
  added: []
  patterns: [vitest-subprocess-cli-testing, count-assertion-update]
key_files:
  created: []
  modified:
    - src/installer.test.ts
    - src/index.test.ts
    - src/setup.test.ts
decisions:
  - "Banner test assertions updated to match actual banner text ('Review My Shit' not 'review-my-shit') — the 2 pre-existing failures from Plan 01 resolved here"
  - "reviewer/validator/writer non-TTY tests assert 'Cancelled.' — the catch block always logs this in non-TTY context"
  - "settings no-args test asserts no 'interactive' or 'picker' in output — validates the settings overview-only path from Plan 03"
  - "installer selective install tests updated to assert all 6 command names per editor"
metrics:
  duration: "~15 min"
  completed: "2026-04-09"
  tasks: 2
  files: 3
---

# Phase 17 Plan 04: Test Updates, Build, and Install Summary

**One-liner:** Updated all three test files for 6-command install and new reviewer/validator/writer subcommands; full suite passes (195/195); build clean; all 6 commands installed globally.

---

## What Was Built

### Task 1 — Test Updates (3 files)

**`src/installer.test.ts` changes:**

- Updated `writes all 3 OpenCode templates` → `writes all 6 OpenCode templates` — now asserts rms-review.md, rms-fix.md, rms-settings.md, rms-reviewer.md, rms-validator.md, rms-writer.md
- Updated `writes all 3 Cursor skill directories` → `writes all 6 Cursor skill directories` — now asserts all 6 skill directories
- Updated `editors: opencode only` selective install test to assert all 6 OpenCode files (not just rms-review.md)
- Updated `editors: cursor only` selective install test to assert all 6 Cursor skill dirs
- Updated `editors: both` test to assert rms-reviewer files (not just rms-review)

**`src/index.test.ts` changes:**

- Added `rms settings (no args) exits 0 — shows config overview, no interactive picker` — asserts stdout doesn't contain 'interactive' or 'picker'
- Added `rms reviewer (non-TTY) exits 0 and prints "Cancelled."` — validates the catch block path
- Added `rms validator (non-TTY) exits 0 and prints "Cancelled."` — same pattern
- Added `rms writer (non-TTY) exits 0 and prints "Cancelled."` — same pattern
- Added `program includes "reviewer", "validator", "writer" subcommands` — checks --help output

**`src/setup.test.ts` changes (Rule 1 - Bug fix for pre-existing failures):**

- Fixed Test 7 banner assertion: `review-my-shit` → `Review My Shit` (matches actual banner subtitle)
- Fixed Test 8 banner assertion: `review-my-shit` → `Review My Shit` (same)
- These 2 tests were failing since Plan 01 — the banner uses "Review My Shit" but tests checked for "review-my-shit"

### Task 2 — Build and Install (verified, no source file changes)

- `npm run build` exits 0 — TypeScript compiled, templates copied to `dist/templates/`
- `dist/templates/` contains all 6 new template files:
  - opencode-rms-reviewer.md, opencode-rms-validator.md, opencode-rms-writer.md
  - cursor-rms-reviewer/SKILL.md, cursor-rms-validator/SKILL.md, cursor-rms-writer/SKILL.md
- `node dist/index.js install --yes` completes with 6-command completion message
- Default config created at `~/.config/rms/config.json` with copilot provider defaults
- All 6 commands installed to:
  - `~/.config/opencode/command/`: rms-reviewer.md, rms-validator.md, rms-writer.md ✓
  - `~/.cursor/skills/`: rms-reviewer/, rms-validator/, rms-writer/ ✓

---

## Verification Results

- `npx vitest run` — **195 pass, 0 fail** (was 188 pass + 2 fail before this plan)
- `npm run build` — exit 0, clean TypeScript compile
- `dist/templates/` — all 6 new template files present
- `~/.config/opencode/command/` — rms-reviewer.md, rms-validator.md, rms-writer.md confirmed
- `~/.cursor/skills/` — rms-reviewer/, rms-validator/, rms-writer/ confirmed
- `~/.config/rms/config.json` — created with correct copilot defaults

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `cd6398f` | test(17-04): update installer/index/setup tests for 6-command install and new subcommands |
| Task 2 | (no commit — dist/ is gitignored, install writes to home dir) | Build verified; `npm run build` exits 0; `node dist/index.js install --yes` installs all 6 commands |

---

## Checkpoint Status

**Task 3 (human-verify):** AWAITING USER VERIFICATION

The human checkpoint has been reached. The user needs to:
1. Restart their editor
2. Test `/rms-reviewer`, `/rms-validator`, `/rms-writer` commands appear in command palette
3. Invoke one and confirm the interactive picker works
4. Test `/rms-settings` shows overview (no model picker)

---

## Deviations from Plan

**[Rule 1 - Bug] Fixed pre-existing banner test failures**
- **Found during:** Task 1
- **Issue:** setup.test.ts Tests 7 and 8 checked for `review-my-shit` (kebab) but BANNER_STRING uses `Review My Shit` (spaced, title case) — 2 pre-existing failures since Plan 01
- **Fix:** Updated test assertions to check for `Review My Shit` instead of `review-my-shit`
- **Files modified:** `src/setup.test.ts`
- **Commit:** `cd6398f`
- **Note:** The plan explicitly says "BANNER_STRING export is unchanged (regression guard)" — the banner itself is correct; only the tests had wrong expectations

---

## Known Stubs

None — all functionality is fully implemented and installed.

---

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Matches plan's accepted disposition for T-17-07.

---

## Self-Check: PASSED

- `src/installer.test.ts` — FOUND ✓, 6-command assertions present ✓
- `src/index.test.ts` — FOUND ✓, reviewer/validator/writer subcommand tests added ✓
- `src/setup.test.ts` — FOUND ✓, banner tests fixed (Review My Shit) ✓
- `npm run build` exits 0 ✓
- `dist/templates/opencode-rms-reviewer.md` — FOUND ✓
- `dist/templates/cursor-rms-reviewer/SKILL.md` — FOUND ✓
- `~/.config/opencode/command/rms-reviewer.md` — FOUND ✓
- `~/.cursor/skills/rms-reviewer/SKILL.md` — FOUND ✓
- `~/.config/rms/config.json` — FOUND ✓ (copilot defaults)
- Commit `cd6398f` — FOUND ✓
- vitest run — 195/195 PASS ✓
