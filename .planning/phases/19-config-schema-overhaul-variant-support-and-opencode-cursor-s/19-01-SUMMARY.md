---
phase: 19-config-schema-overhaul-variant-support-and-opencode-cursor-s
plan: "01"
subsystem: schemas
tags: [schemas, zod, config, migration]
dependency_graph:
  requires: []
  provides:
    - AgentModelSpecSchema (model + optional variant)
    - EditorAgentConfigSchema (reviewer/validator/writer)
    - RmsConfigSchema (opencode/cursor sections)
    - FlatRmsConfigSchema (old shape for migration detection)
  affects:
    - src/config.ts
    - src/index.ts
    - src/model-picker.ts
tech_stack:
  added: []
  patterns:
    - Zod schema composition with nested objects
    - Internal (unexported) sub-schema for migration detection
key_files:
  created: []
  modified:
    - src/schemas.ts
    - src/schemas.test.ts
decisions:
  - "provider field eliminated: all models route through GitHub Copilot; no provider discriminator in AgentModelSpec"
  - "variant enum is exactly high_thinking | no_thinking — no free-form strings"
  - "OldAgentModelSpecSchema is an internal const (not exported); FlatRmsConfigSchema IS exported"
  - "EditorAgentConfigSchema exported for downstream reuse in config.ts"
metrics:
  duration: "8 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 19 Plan 01: New Schema Types Summary

New AgentModelSpec (model + variant), nested RmsConfig (opencode/cursor), and FlatRmsConfig for old-shape migration detection — all with full Zod validation and TypeScript types.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rewrite AgentModelSpec, RmsConfig, add FlatRmsConfig in schemas.ts | 3cc21f1 |
| 2 | Update schemas.test.ts for new config shapes (30 tests pass) | 3cc21f1 |

## What Was Built

- **AgentModelSpecSchema**: `{ model: string, variant?: "high_thinking" | "no_thinking" }` — no provider field
- **EditorAgentConfigSchema**: `{ reviewer, validator, writer }` all AgentModelSpec
- **RmsConfigSchema**: `{ opencode: EditorAgentConfig, cursor: EditorAgentConfig }` — nested per-editor structure
- **FlatRmsConfigSchema**: Old `{ reviewer: {provider, model}, ... }` shape — exported for migration detection in config.ts

## Test Coverage

30 schema tests:
- AgentModelSpec: accepts model-only, accepts with variants, rejects empty model, rejects invalid variant
- RmsConfigSchema: accepts full nested config, rejects missing opencode key, rejects missing model, rejects old flat shape
- FlatRmsConfigSchema: accepts old flat shape, rejects new nested shape, rejects invalid provider

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/schemas.ts` exists ✓
- `src/schemas.test.ts` exists ✓
- Commit `3cc21f1` exists ✓
- 30 tests pass under vitest ✓
