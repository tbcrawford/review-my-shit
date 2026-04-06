---
phase: 08-per-agent-model-selection-via-json-config-with-rms-settings-command
plan: 02
subsystem: pipeline-orchestration
tags: [per-agent-models, settings-command, installer, agents-md]
dependency_graph:
  requires: [08-01]
  provides: [rms-settings-command, per-agent-pipeline-wiring, settings-templates]
  affects: [src/index.ts, src/installer.ts, AGENTS.md]
tech_stack:
  added: []
  patterns: [per-agent-model-resolution, parseSpec-inline-helper, env-var-fallback]
key_files:
  created:
    - src/templates/opencode-settings.md
    - src/templates/cursor-settings.md
  modified:
    - src/index.ts
    - src/installer.ts
    - AGENTS.md
decisions:
  - "resolveModels() replaces resolveModel() — returns three typed model instances for reviewer/validator/writer"
  - "parseSpec helper is inline inside the settings action closure — no top-level function needed"
  - "writerModelId is a plain string (provider:model) passed through to writer's modelId param"
  - "settings --reset uses unlink() with try/catch — graceful if no config exists"
  - "Cursor commands table and OpenCode commands table both updated with /rms-settings row"
metrics:
  duration: ~5 min
  completed: "2026-04-06"
  tasks: 2
  files: 5
---

# Phase 8 Plan 02: rms settings command + pipeline wiring Summary

**One-liner:** Wired per-agent model config into the pipeline orchestrator and added the `rms settings` CLI sub-command with editor command templates and updated AGENTS.md docs.

---

## What Was Built

### Task 1: Wire per-agent config into src/index.ts + add rms settings command

Replaced the old single-model `resolveModel()` function with a new `resolveModels()` function that returns three separate model instances (`reviewerModel`, `validatorModel`, `writerModelId`). The function reads `~/.config/rms/config.json` via `loadRmsConfig()` when present, or falls back to the `AI_SDK_PROVIDER` + `AI_SDK_MODEL` env vars for backward compatibility.

Both `review-local` and `review-pr` actions now pass per-agent models to `runReviewer`, `runValidator`, and `runWriter` respectively.

Added the `settings` sub-command which:
- With no flags: shows config path + current config (or not-configured fallback state)
- With `--reviewer`, `--validator`, and/or `--writer` flags: parses `provider:model` specs and writes to `~/.config/rms/config.json` (merging with existing config)
- With `--reset`: deletes config file, reverts to env var fallback
- Inline `parseSpec()` helper validates provider enum and non-empty model ID

**Commit:** `07a85cd`

### Task 2: Add settings templates + update installer + update AGENTS.md

Created two new editor command templates:
- `src/templates/opencode-settings.md`: uses `subtask: true` with `!node dist/index.js settings $ARGUMENTS`
- `src/templates/cursor-settings.md`: terminal-run pattern with build hint and usage examples

Updated `src/installer.ts` INSTALLS array to include 2 new entries (8 total):
- `opencode-settings.md` → `.opencode/commands/rms-settings.md`
- `cursor-settings.md` → `.cursor/commands/rms-settings.md`

Updated `AGENTS.md`:
- Added `~/.config/rms/config.json` row to Environment Variables table (preferred over env vars)
- Changed `AI_SDK_PROVIDER` and `AI_SDK_MODEL` Required column to "Fallback only"
- Added "Per-Agent Model Configuration" section with JSON example and supported providers list
- Added `/rms-settings` row to both OpenCode and Cursor command tables

**Commit:** `ddfd62f`

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm test` | ✅ 149 tests pass (0 failures) |
| `npm run build` | ✅ Compiles + templates copied |
| `node dist/index.js settings` | ✅ Shows not-configured state |
| `node dist/index.js settings --reviewer openai:gpt-4o` | ✅ Writes config, exits 0 |
| `node dist/index.js settings --reset` | ✅ Deletes config, exits 0 |
| `dist/templates/opencode-settings.md` | ✅ Present |
| `dist/templates/cursor-settings.md` | ✅ Present |
| `installer.ts` INSTALLS entries | ✅ 8 entries |
| AGENTS.md `config.json` doc | ✅ Present |
| AGENTS.md `Per-Agent Model Configuration` | ✅ Present |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — the per-agent model selection is fully wired. The config layer from Plan 01 is now connected to the actual pipeline execution.

---

## Self-Check

- `src/templates/opencode-settings.md` → FOUND
- `src/templates/cursor-settings.md` → FOUND
- `src/installer.ts` with 8 INSTALLS entries → FOUND
- Commit `07a85cd` → FOUND
- Commit `ddfd62f` → FOUND

## Self-Check: PASSED
