---
phase: 19-config-schema-overhaul-variant-support-and-opencode-cursor-s
plan: "02"
subsystem: config
tags: [config, migration, variant, thinking]
dependency_graph:
  requires:
    - 19-01-SUMMARY.md (AgentModelSpec, RmsConfig, FlatRmsConfig schemas)
  provides:
    - loadRmsConfig with flat→nested migration
    - resolveAgentModel with variant thinking support
    - DEFAULT_RMS_CONFIG with opencode/cursor sections
  affects:
    - src/index.ts (reads config.opencode.*)
key_files:
  created: []
  modified:
    - src/config.ts
    - src/config.test.ts
decisions:
  - "wrapLanguageModel+defaultSettingsMiddleware used for variant thinking (chatModel only accepts modelId, not options)"
  - "Migration is one-way and in-memory: original flat config file is NOT overwritten until user saves explicitly"
  - "Both opencode and cursor sections get same models during migration (best-effort)"
  - "Provider field discarded during migration; no variant set (undefined)"
metrics:
  duration: "6 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 19 Plan 02: Config Migration and Variant Support Summary

config.ts migrates old flat configs on load, returns new nested RmsConfig shape, and resolves variants as thinking params via wrapLanguageModel middleware — all with 17 passing tests.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rewrite config.ts — migration, new defaults, variant resolveAgentModel | 7ba0088 |
| 2 | Update config.test.ts for new schema shape and migration (17 tests pass) | 7ba0088 |

## What Was Built

- **loadRmsConfig migration**: Tries RmsConfigSchema first; if that fails, tries FlatRmsConfigSchema and silently migrates. If neither matches, throws "Invalid rms config".
- **DEFAULT_RMS_CONFIG**: New nested shape with opencode (high_thinking for reviewer/validator, no_thinking for writer) and cursor (plain model IDs).
- **resolveAgentModel**: Single copilot provider path; variant applied via `wrapLanguageModel` + `defaultSettingsMiddleware` with `providerOptions.thinking`.
- **Removed**: Old anthropic/google/openai provider switch branches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] chatModel() only accepts one argument**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `copilot.chatModel(spec.model, opts)` but the SDK signature is `chatModel(modelId: string): LanguageModelV3`
- **Fix:** Used `wrapLanguageModel` + `defaultSettingsMiddleware` to attach thinking settings to the model instance — callers are unaffected
- **Files modified:** src/config.ts
- **Commit:** 7ba0088

## Self-Check: PASSED

- `src/config.ts` exists ✓
- `src/config.test.ts` exists ✓
- Commit `7ba0088` exists ✓
- 17 tests pass under vitest ✓
