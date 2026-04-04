---
phase: "01"
plan: "01"
subsystem: foundation
tags: [npm-package, typescript, cli, session-management, tdd]
dependency_graph:
  requires: []
  provides: [npm-package-scaffold, session-module, cli-entrypoint]
  affects: [all-downstream-plans]
tech_stack:
  added: [commander@12, nanoid@5, simple-git@3, zod@3, typescript@5, tsx@4]
  patterns: [NodeNext-ESM, strict-typescript, node-test-builtin, TDD-red-green]
key_files:
  created:
    - package.json
    - tsconfig.json
    - .gitignore
    - .npmignore
    - src/index.ts
    - src/session.ts
    - src/session.test.ts
  modified: []
decisions:
  - "Used node:test built-in for session tests — zero extra test runner deps"
  - "Strict NodeNext ESM module resolution — explicit .js imports required throughout"
  - "package name: rms (not review-my-shit) — mirrors usage convention"
metrics:
  duration_minutes: 2
  tasks_completed: 3
  files_created: 7
  completed_date: "2026-04-04"
requirements_covered: [REPT-06, QUAL-03]
---

# Phase 01 Plan 01: npm Package Bootstrap Summary

**One-liner:** TypeScript ESM project scaffolded with Commander.js CLI stub, session module (createSession/ensureReviewsDir) with 8 passing node:test tests, and .reviews/ gitignore automation.

---

## What Was Built

Bootstrapped the `rms` npm package from scratch — a greenfield TypeScript ESM project with a working CLI entrypoint and the session abstraction that every downstream plan depends on.

### Package Structure

- **`package.json`**: `rms` binary pointing at `dist/index.js`, all 4 runtime deps declared, `"type": "module"`, build/dev/typecheck scripts
- **`tsconfig.json`**: `ES2022` target, `NodeNext` module + resolution, `strict: true`, declaration maps
- **`.gitignore`**: `node_modules/`, `dist/`, `.reviews/` — `.reviews/` is in the initial gitignore per REPT-06
- **`.npmignore`**: ships only `dist/`; excludes `.planning/`, `src/`, docs

### Session Module (`src/session.ts`)

- **`ensureReviewsDir(projectRoot)`**: Creates `.reviews/` if absent; appends `.reviews/` to `.gitignore` (creates it if missing); fully idempotent — safe to call on every run
- **`createSession(projectRoot, slug)`**: Calls `ensureReviewsDir`, generates `YYYY-MM-DD-<slug>` reviewId, creates the folder, returns `SessionInfo`
- **`SessionInfo`**: `{ sessionDir, reviewId, slug, timestamp }` — the handle every agent phase will use

### CLI Entrypoint (`src/index.ts`)

Commander.js wired with four subcommand stubs:
- `install` — will write editor command files (Phase 1 Plan 2)
- `review-local` — local git diff review with `--focus` option (Phase 2+)
- `review-pr <pr-number>` — GitHub PR diff review with `--focus` option (Phase 2+)
- `fix [finding-id]` — apply finding by ID or interactively (Phase 6)

---

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 | Initialize npm package and TypeScript project | `281eecf` | package.json, tsconfig.json, .gitignore, .npmignore, src/index.ts |
| T2 (RED) | Add failing tests for session module | `fca0855` | src/session.test.ts |
| T2 (GREEN) | Implement session module | `f0e5de5` | src/session.ts |
| T3 | Wire CLI entrypoint with Commander.js | `7c38b39` | src/index.ts |

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Zero errors |
| `tsx src/index.ts --help` | ✅ All 4 subcommands shown |
| `tsx --test src/session.test.ts` | ✅ 8/8 tests pass |
| `.gitignore` contains `.reviews/` | ✅ Line 3 |
| All 4 runtime deps in package.json | ✅ zod, nanoid, commander, simple-git |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Used `node:test` built-in for tests | Zero extra deps; node:test is built into Node ≥18; keeps test runner out of devDependencies |
| NodeNext ESM module resolution | Required for proper ESM `import ... from './session.js'` — `.js` extension in imports is mandatory |
| package name: `rms` | Matches the usage convention documented throughout planning; shorter than `review-my-shit` |
| Strict TypeScript from day 1 | Prevents type errors from propagating into Phases 2–7; safe to start strict when codebase is empty |

---

## Known Stubs

| File | Line | Stub | Resolving Plan |
|------|------|------|----------------|
| src/index.ts | 14 | `install` action logs "not yet implemented" | Plan 02 (slash command installer) |
| src/index.ts | 20 | `review-local` action logs "not yet implemented" | Phase 2+ (reviewer agent) |
| src/index.ts | 27 | `review-pr` action logs "not yet implemented" | Phase 2+ (reviewer agent) |
| src/index.ts | 33 | `fix` action logs "not yet implemented" | Phase 6 (fix command) |

These stubs are intentional scaffolding — they demonstrate the CLI is correctly wired while deferring implementations to their planned phases.

---

## Self-Check: PASSED

- [x] `package.json` exists with correct content
- [x] `tsconfig.json` exists
- [x] `src/session.ts` exports `createSession` and `ensureReviewsDir`
- [x] `src/session.test.ts` has 8 tests, all pass
- [x] `src/index.ts` wired with all 4 Commander subcommands
- [x] Commits `281eecf`, `fca0855`, `f0e5de5`, `7c38b39` all present in git log
