---
phase: 08-per-agent-model-selection-via-json-config-with-rms-settings-command
plan: "01"
subsystem: config
tags: [schema, config, tdd, zod]
dependency_graph:
  requires: []
  provides: [RmsConfigSchema, AgentModelSpec, getConfigPath, loadRmsConfig, saveRmsConfig, resolveAgentModel]
  affects: [src/schemas.ts, src/config.ts]
tech_stack:
  added: []
  patterns: [zod-schema-validation, optional-path-arg-for-testability, tdd-red-green]
key_files:
  created:
    - src/config.ts
    - src/config.test.ts
  modified:
    - src/schemas.ts
decisions:
  - "Optional path arg in loadRmsConfig/saveRmsConfig enables testing without patching homedir"
metrics:
  duration: "~8 min"
  completed: "2026-04-06"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 01: Config Layer (Schema + Read/Write + Model Resolution) Summary

**One-liner:** Zod-validated per-agent model config with null-on-missing load, mkdir-on-save, and provider-agnostic Vercel AI SDK model resolution via `~/.config/rms/config.json`.

---

## What Was Built

Established the typed config contract and filesystem operations for per-agent model selection:

1. **`src/schemas.ts`** — Extended with `AgentModelSpecSchema` (provider enum + model string) and `RmsConfigSchema` (reviewer/validator/writer specs). Both types exported. All existing 139 tests unaffected.

2. **`src/config.ts`** — New module with four exports:
   - `getConfigPath()` — returns `~/.config/rms/config.json` (canonical path)
   - `loadRmsConfig(path?)` — returns `null` when file absent, validated `RmsConfig` when present, throws `"Invalid rms config ..."` on bad JSON or schema violation
   - `saveRmsConfig(config, path?)` — writes validated config as pretty-printed JSON, creates parent dirs via `mkdir({ recursive: true })`
   - `resolveAgentModel(spec)` — resolves Vercel AI SDK `LanguageModel` instance for `openai`, `anthropic`, or `google` providers

3. **`src/config.test.ts`** — 10 tests via TDD (RED → GREEN):
   - Path format validation
   - Null return on missing file
   - Valid config round-trip (save → load)
   - Malformed JSON throws "Invalid rms config"
   - Schema violation throws "Invalid rms config"
   - Dir creation on save
   - Truthy model instances for all three providers

**Test counts:** 139 → 149 (all passing). `npm run typecheck` exits 0.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Add RmsConfigSchema | `764a4a2` | `feat(08-01): add AgentModelSpecSchema and RmsConfigSchema to schemas.ts` |
| Task 2: Create config module | `be263fc` | `feat(08-01): create config module with loadRmsConfig, saveRmsConfig, resolveAgentModel` |

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Optional `path?` arg in `loadRmsConfig` and `saveRmsConfig` | Enables direct test-time path injection without patching `os.homedir()` or using a test-double for the filesystem. Cleaner than a mutable override variable. |
| `dirname(resolvedPath)` in `saveRmsConfig` | Correct way to create parent dirs for an arbitrary config path; more robust than hardcoding `~/.config/rms`. |
| Error message prefix `"Invalid rms config"` | Tests key on this exact string; consistent with how the plan specifies it and easy to grep for in logs. |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

The only structural deviation: `saveRmsConfig` uses `dirname(resolvedPath)` instead of the hardcoded `join(homedir(), '.config', 'rms')` from the plan example. This is strictly better — it handles arbitrary paths correctly (needed for test isolation via tmp dirs). Not a deviation from intent, just a correct generalization.

---

## Known Stubs

None — `config.ts` is pure library code. No UI, no placeholders. Data flows correctly through all public functions.

---

## Self-Check

- [x] `src/schemas.ts` contains `export const AgentModelSpecSchema` — ✅ confirmed (`grep -c` → 1)
- [x] `src/schemas.ts` contains `export const RmsConfigSchema` — ✅ confirmed (`grep -c` → 1)
- [x] `src/config.ts` contains `export function getConfigPath` — ✅ confirmed (`grep -c` → 1)
- [x] `src/config.ts` contains `export async function loadRmsConfig` — ✅ confirmed (`grep -c` → 1)
- [x] `src/config.ts` contains `export async function resolveAgentModel` — ✅ confirmed (`grep -c` → 1)
- [x] `npm test` exits 0 with 149 tests — ✅ confirmed
- [x] `npm run typecheck` exits 0 — ✅ confirmed
- [x] Commits 764a4a2 and be263fc exist — ✅ confirmed

## Self-Check: PASSED
