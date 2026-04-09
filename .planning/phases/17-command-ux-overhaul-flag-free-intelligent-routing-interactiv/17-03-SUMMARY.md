---
phase: 17-command-ux-overhaul-flag-free-intelligent-routing-interactiv
plan: "03"
subsystem: cli-integration
tags: [cli, model-picker, installer, settings, commander, subcommands]
dependency_graph:
  requires: [runModelPicker, ensureDefaultConfig, opencode-rms-reviewer, opencode-rms-validator, opencode-rms-writer, cursor-rms-reviewer, cursor-rms-validator, cursor-rms-writer]
  provides: [rms-reviewer-cmd, rms-validator-cmd, rms-writer-cmd, settings-overview, 6-command-installer]
  affects: [src/index.ts, src/installer.ts, src/setup.ts, src/settings-tui.ts]
tech_stack:
  added: []
  patterns: [commander-subcommand, idempotent-config-init, dead-code-deprecation]
key_files:
  created: []
  modified:
    - src/index.ts
    - src/installer.ts
    - src/setup.ts
    - src/settings-tui.ts
decisions:
  - "ensureDefaultConfig() called from both installer.ts (install fn) and index.ts (install action) — idempotent, safe to call twice; installer runs first so index.ts call is always a no-op after"
  - "settings-tui.ts kept as dead code with @deprecated comment rather than deleted — plan explicitly forbids deletion to avoid breaking any test references"
  - "label variable removed from index.ts install action (was unused after completion message rewrite)"
metrics:
  duration: "~138s"
  completed: "2026-04-09"
  tasks: 2
  files: 4
---

# Phase 17 Plan 03: CLI Integration — New Subcommands + Expanded Installer Summary

**One-liner:** Wired `rms reviewer`, `rms validator`, `rms writer` subcommands into Commander CLI and expanded installer to 6 commands for both editors, with default config creation on every install path.

---

## What Was Built

### Task 1 — `src/index.ts` + `src/settings-tui.ts`

**`src/index.ts` changes:**

1. **New import:** `runModelPicker` from `./model-picker.js`
2. **Updated import:** Added `ensureDefaultConfig` to the config imports line
3. **Three new Commander subcommands** — `reviewer`, `validator`, `writer`:
   - Each loads current config, calls `runModelPicker(agent, current)`
   - Saves the returned `AgentModelSpec` to config (merging with existing)
   - Logs success or "Cancelled." on Ctrl+C
4. **`settings` subcommand updated** — no-args path now shows config overview:
   - Prints per-agent model table (`reviewer / validator / writer`)
   - Points users to `/rms-reviewer`, `/rms-validator`, `/rms-writer` for changes
   - No longer dynamically imports `settings-tui.js` — that import is gone
5. **`install` command updated**:
   - Calls `ensureDefaultConfig()` after `await install()` returns
   - Completion message updated to show all 6 `/rms-*` commands
   - Removed now-unused `label` variable

**`src/settings-tui.ts` changes:**

- Added `@deprecated` JSDoc comment at top of file
- File kept in place (not deleted) — tests may import it; it's dead code but harmless

### Task 2 — `src/installer.ts` + `src/setup.ts`

**`src/installer.ts` changes:**

- Added import: `ensureDefaultConfig, getConfigPath` from `./config.js`
- `GLOBAL_INSTALLS` expanded from 3 → 6 entries:
  - Added: `opencode-rms-reviewer.md → rms-reviewer.md`
  - Added: `opencode-rms-validator.md → rms-validator.md`
  - Added: `opencode-rms-writer.md → rms-writer.md`
- `CURSOR_SKILL_INSTALLS` expanded from 3 → 6 entries:
  - Added: `cursor-rms-reviewer → rms-reviewer`
  - Added: `cursor-rms-validator → rms-validator`
  - Added: `cursor-rms-writer → rms-writer`
- `install()` function now calls `ensureDefaultConfig()` at its end (after all file writes)

**`src/setup.ts` changes:**

- Added import: `ensureDefaultConfig, getConfigPath` from `./config.js`
- `main()` now calls `ensureDefaultConfig()` after `await install()` returns
- Completion message updated to show all 6 `/rms-*` commands (was 3)

---

## Verification Results

- `npx tsc --noEmit` — clean (no errors)
- `vitest run` — 188 pass, 2 fail (pre-existing banner test failures in `setup.test.ts`, unchanged from Plan 01)
- `installer.ts GLOBAL_INSTALLS` has 6 entries ✓
- `installer.ts CURSOR_SKILL_INSTALLS` has 6 entries ✓
- `settings` subcommand action no longer references `settings-tui.js` ✓
- `rms reviewer/validator/writer` subcommands registered in Commander ✓

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `316f543` | feat(17-03): add rms reviewer/validator/writer subcommands + settings overview |
| Task 2 | `1e3a93a` | feat(17-03): expand installer to 6 commands + call ensureDefaultConfig from setup.ts |

---

## Deviations from Plan

**[Rule 1 - Cleanup] Removed unused `label` variable from install action**
- **Found during:** Task 1
- **Issue:** After rewriting the completion message, the `label` variable (computed from `editors` array) was no longer used but still declared
- **Fix:** Removed the variable declaration to keep code clean; TypeScript would flag it as an unused variable anyway
- **Files modified:** `src/index.ts`
- **Commit:** `316f543`

---

## Known Stubs

None — all functionality is fully wired.

---

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced. The three new subcommands write to `~/.config/rms/config.json` via the existing `saveRmsConfig()` path — same trust boundary as the pre-existing `rms settings --reviewer` flag path. This matches the plan's accepted threat disposition for T-17-04 and T-17-05.

---

## Self-Check: PASSED

- `src/index.ts` — `runModelPicker` imported ✓, `ensureDefaultConfig` imported ✓, reviewer/validator/writer commands present ✓, settings overview present ✓
- `src/installer.ts` — 6 entries in GLOBAL_INSTALLS ✓, 6 entries in CURSOR_SKILL_INSTALLS ✓, `ensureDefaultConfig()` called at end of install() ✓
- `src/setup.ts` — `ensureDefaultConfig` imported ✓, called after install() ✓, 6-command completion message ✓
- `src/settings-tui.ts` — `@deprecated` comment added ✓, file not deleted ✓
- Commit `316f543` — FOUND ✓
- Commit `1e3a93a` — FOUND ✓
