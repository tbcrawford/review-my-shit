---
phase: "01"
plan: "02"
subsystem: schemas
tags: [zod, schemas, finding-id, types, tdd]
dependency_graph:
  requires: ["01-01"]
  provides: ["src/schemas.ts", "src/finding-id.ts"]
  affects: ["02-*", "03-*", "04-*", "05-*", "06-*"]
tech_stack:
  added: []
  patterns:
    - "Zod schemas for in-memory validation of parsed pipeline file frontmatter"
    - "Global counter in .reviews/.counter for deterministic finding ID generation"
    - "TDD with node:test — RED commit before GREEN"
key_files:
  created:
    - src/schemas.ts
    - src/schemas.test.ts
    - src/finding-id.ts
    - src/finding-id.test.ts
  modified: []
decisions:
  - "DIMENSION_ABBREV re-exported from schemas.ts (not duplicated) to ensure single source of truth"
  - "Finding ID counter is not concurrent-safe by design (documented) — single-threaded orchestrator only"
metrics:
  duration: "2 minutes"
  completed: "2026-04-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 01 Plan 02: Zod Schemas & Finding ID Generation Summary

**One-liner:** Zod schemas for all four pipeline file types plus deterministic `{DIM}-{NNNNN}` finding ID generation with a persistent `.reviews/.counter` file.

---

## What Was Built

### `src/schemas.ts`
Defines all data contracts for the rms pipeline:
- **`DIMENSIONS`** — `['BUG', 'SEC', 'PERF', 'STYL', 'TEST', 'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC'] as const`
- **`DimensionSchema`**, **`SeveritySchema`**, **`VerdictSchema`** — enum schemas for constrained string fields
- **`FindingSchema`** — reviewer finding with id, severity, file, line, dimension, explanation, suggestion
- **`ValidationVerdictSchema`** — validator verdict with findingId, verdict, rationale
- **`InputFileSchema`**, **`ReviewerFileSchema`**, **`ValidatorFileSchema`**, **`ReportFileSchema`** — frontmatter schemas for each pipeline file type
- All schemas export derived TypeScript types via `z.infer<>`

### `src/finding-id.ts`
Implements orchestrator-side finding ID generation:
- **`nextFindingId(dimension, reviewsDir)`** — reads `.reviews/.counter`, increments by 1, writes back, returns `{DIM}-{NNNNN}` (e.g. `SEC-00001`)
- **`DIMENSION_ABBREV`** — re-export of `DIMENSIONS` from schemas (single source of truth)
- Counter file format: plain integer string (e.g. `"2"`)
- Handles missing counter file gracefully (starts from 0)
- Documented as intentionally not concurrent-safe (single-threaded orchestrator)

### Tests (25 total)
- `src/schemas.test.ts` — 17 tests covering valid parses, invalid severity/dimension/verdict/scope, and missing required fields
- `src/finding-id.test.ts` — 8 tests covering ID format, counter increment, persistence, padStart behavior, graceful missing-file handling, monotonic increment, and multi-dimension global counter

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `DIMENSION_ABBREV` re-exports `DIMENSIONS` from schemas | Single source of truth — prevents drift between schemas.ts and finding-id.ts |
| Counter not concurrent-safe (by design) | Orchestrator is single-threaded Node.js; no concurrent calls possible; documenting it prevents future confusion |
| Schemas validate parsed frontmatter objects, not raw markdown | Consistent with D-10/D-12: XML-tagged blocks carry structured data; schemas validate in-memory representation after parse |
| `focus` field is `z.string().optional()` on InputFileSchema | User may omit focus area — optional field correctly models the CLI UX |

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsx --test src/schemas.test.ts` | ✅ 17/17 pass |
| `npx tsx --test src/finding-id.test.ts` | ✅ 8/8 pass |
| `npm run typecheck` | ✅ zero errors |
| All 11 dimensions in DIMENSIONS | ✅ BUG SEC PERF STYL TEST ARCH ERR DATA API DEP DOC |
| Finding ID format `{DIM}-{NNNNN}` | ✅ e.g. `SEC-00001` |
| Counter persists in `.reviews/.counter` | ✅ verified in test |

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| [schemas RED] | `test` | Add failing tests for Zod schemas |
| `3c7b49c` | `feat` | Implement Zod schemas for all pipeline file types |
| [finding-id RED] | `test` | Add failing tests for finding ID generation |
| `dcf5e17` | `feat` | Implement finding ID generation with persistent counter |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — both modules are fully implemented with no placeholder values.

---

## Self-Check: PASSED

- `src/schemas.ts` — ✅ exists
- `src/schemas.test.ts` — ✅ exists
- `src/finding-id.ts` — ✅ exists
- `src/finding-id.test.ts` — ✅ exists
- Commit `3c7b49c` — ✅ exists (feat: schemas implementation)
- Commit `dcf5e17` — ✅ exists (feat: finding-id implementation)
