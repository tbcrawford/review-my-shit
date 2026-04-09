---
phase: 17-command-ux-overhaul-flag-free-intelligent-routing-interactiv
plan: "01"
subsystem: model-picker
tags: [model-picker, config, defaults, inquirer, tui]
dependency_graph:
  requires: []
  provides: [runModelPicker, ensureDefaultConfig, DEFAULT_RMS_CONFIG]
  affects: [src/config.ts, src/model-picker.ts]
tech_stack:
  added: []
  patterns: [variant-tier-picker, safe-default-config]
key_files:
  created:
    - src/model-picker.ts
  modified:
    - src/config.ts
    - src/config.test.ts
decisions:
  - "Copilot is the default provider for all tier mappings in the picker (mirrors default config)"
  - "ExitPromptError from inquirer is rethrown — callers decide how to handle non-TTY"
  - "ensureDefaultConfig uses existsSync check (synchronous) before async write to avoid race on fast calls"
  - "DEFAULT_RMS_CONFIG uses different model families for reviewer vs validator to reduce correlated errors"
metrics:
  duration: "~5 min"
  completed: "2026-04-09"
  tasks: 2
  files: 3
---

# Phase 17 Plan 01: Model Picker and Default Config Summary

**One-liner:** Variant tier model picker with copilot-provider mapping and safe ensureDefaultConfig() that creates default config only on first install.

---

## What Was Built

### Task 1 — `src/model-picker.ts` (new)

Created a reusable interactive model picker module consumed by the three new `/rms-reviewer`, `/rms-validator`, `/rms-writer` commands (Plan 03).

**Key design:**
- `runModelPicker(agent, current?)` → `AgentModelSpec`
- Shows 4 variant tiers: `max / high / medium / low` mapped to copilot models
- Annotates the currently-configured model with `(current)` label
- Includes a separator and `Enter custom model…` option
- Custom input handles three formats: `github-copilot/model-id` → copilot provider, `provider:model` → split on colon, bare string → copilot provider
- Rethrows `ExitPromptError` so callers can clean up on Ctrl+C

**Tier-to-model mapping (copilot):**

| Tier   | Model             |
|--------|-------------------|
| max    | claude-opus-4-5   |
| high   | claude-sonnet-4-5 |
| medium | claude-haiku-3-5  |
| low    | claude-haiku-3-5  |

### Task 2 — `src/config.ts` (updated) + `src/config.test.ts` (updated)

Added two new exports to `config.ts`:

- **`DEFAULT_RMS_CONFIG`** — the confirmed Phase 17 defaults:
  - `reviewer: { provider: 'copilot', model: 'claude-opus-4-5' }`
  - `validator: { provider: 'copilot', model: 'github-copilot/gpt-5.4' }`
  - `writer: { provider: 'copilot', model: 'github-copilot/claude-haiku-4.5' }`

- **`ensureDefaultConfig(configPath?)`** — idempotent install helper:
  - Returns `'created'` if config file was written
  - Returns `'exists'` if config already present (no overwrite)
  - Safe to call on every `rms install` invocation

Added 3 new tests to `config.test.ts`:
1. Creates config with exact defaults when file absent
2. Returns `'exists'` and preserves existing config when file present
3. Validates `DEFAULT_RMS_CONFIG` exact shape matches CONTEXT.md

---

## Verification Results

- `npx tsc --noEmit` — clean (no errors for model-picker.ts or config.ts)
- `npx vitest run src/config.test.ts` — PASS (17/17 tests)
- Full test suite: 188 pass, 2 fail (pre-existing banner test failures in setup.test.ts, unrelated to this plan)

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `809774e` | feat(17-01): create src/model-picker.ts — variant tier picker |
| Task 2 | `4fdc280` | feat(17-01): add ensureDefaultConfig() and DEFAULT_RMS_CONFIG to config.ts |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all exports are fully implemented and wired correctly.

---

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. Custom model input is stored as-is in config.json and only used to construct a model ID string (no shell execution, no path traversal). This matches the plan's accepted threat disposition for T-17-01.

---

## Self-Check: PASSED

- `src/model-picker.ts` — FOUND ✓
- `src/config.ts` (ensureDefaultConfig + DEFAULT_RMS_CONFIG) — FOUND ✓
- `src/config.test.ts` (new ensureDefaultConfig tests) — FOUND ✓
- Commit `809774e` — FOUND ✓
- Commit `4fdc280` — FOUND ✓
