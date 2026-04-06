---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
last_updated: "2026-04-06T21:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 14
  completed_plans: 14
---

# STATE: review-my-shit (rms)

**Last updated:** 2026-04-06
**Status:** Phase 5 complete — ready for Phase 6 (Fix Command)

---

## Project Reference

| Field | Value |
|-------|-------|
| Project file | `.planning/PROJECT.md` |
| Requirements file | `.planning/REQUIREMENTS.md` |
| Roadmap file | `.planning/ROADMAP.md` |
| Core value | The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable. |
| Current focus | Phase 6: Fix Command — /fix by ID and interactive selection |

---

## Current Position

Phase: 05 (Review Orchestration) — COMPLETE
Next: Phase 06 (Fix Command)

| Field | Value |
|-------|-------|
| Current phase | Phase 5: Review Orchestration — COMPLETE |
| Status | Verified 5/5 success criteria; 99 tests passing |
| Blocking issues | None |

```
Progress: [████████░░░░░░░░] Phases 1-5 complete (4 fully, 1 at checkpoint), Phase 6 next
```

---

## Phase Status

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Foundation | In Progress (checkpoint pending) | - |
| 2 | Reviewer Agent | Complete | 2026-04-06 |
| 3 | Validator Agent | Complete | 2026-04-06 |
| 4 | Writer Agent | Complete | 2026-04-06 |
| 5 | Review Orchestration | Complete | 2026-04-06 |
| 6 | Fix Command | Not started | - |
| 7 | Cross-Editor Hardening | Not started | - |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 5 / 7 (Phase 1 at checkpoint) |
| Plans complete | 14 / 14 planned so far |
| Requirements covered | 18 / 23 |
| Requirements validated | 18 / 23 |

### Execution History

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 2 min | 3 tasks | 7 files |
| Phase 01 P02 | 2 min | 2 tasks | 4 files |
| Phase 01 P03 | 85 min | 2 tasks | 7 files |
| Phase 01 P04 | 2 min | 1 task (checkpoint) | 4 files |
| Phase 02 P01 | 8 min | 2 tasks | 4 files |
| Phase 02 P02 | 3 min | 2 tasks | 4 files |
| Phase 03 P01 | 20 min | 2 tasks | 4 files |
| Phase 03 P02 | 10 min | 2 tasks | 2 files |
| Phase 04 P01 | ~15 min | 2 tasks | 4 files |
| Phase 04 P02 | ~10 min | 2 tasks | 3 files |
| Phase 05 P01 | ~20 min | 3 tasks | 8 files |
| Phase 05 P02 | ~20 min | 3 tasks | 6 files |

### Accumulated Context

### Key Decisions Made

| Decision | Rationale | Phase |
|----------|-----------|-------|
| 7-phase structure derived from dependency ordering | Schemas → Reviewer → Validator → Writer → Orchestration → Fix → Hardening is the only safe build order | Roadmap |
| Hybrid Node.js architecture | Command files are thin entry points; Node.js orchestrator uses Vercel AI SDK for three isolated generateText calls | Phase 1 |
| npm package distribution | `npx rms@latest` for global install; `rms install` writes editor command files; mirrors GSD install pattern | Phase 1 |
| Both editors from day 1 | `.opencode/commands/` AND `.cursor/commands/` written in parallel; no AGENTS.md at repo root | Phase 1 |
| Finding ID format: `{DIM}-{NNNNN}` | Dimension prefix + 5-digit zero-padded global counter (e.g., `SEC-00001`); assigned by orchestrator, not LLM | Phase 1 |
| XML-tagged pipeline files | All pipeline files use XML blocks (INPUT, REVIEWER, VALIDATOR, REPORT); enables direct parsing by `/fix` | Phase 1 |
| node:test built-in for session tests | Zero extra deps; built into Node ≥18; keeps test runner out of devDependencies | 01-01 |
| package name: rms | Mirrors usage convention across all planning docs; shorter than review-my-shit for CLI ergonomics | 01-01 |
| NodeNext ESM module resolution | Required for proper ESM .js imports throughout codebase; chosen from day 1 to avoid later migration | 01-01 |
| DIMENSION_ABBREV re-exports DIMENSIONS from schemas | Single source of truth — prevents drift between schemas.ts and finding-id.ts | 01-02 |
| Finding ID counter not concurrent-safe by design | Single-threaded orchestrator; documented constraint prevents future confusion | 01-02 |
| Build script copies src/templates/ to dist/templates/ | tsc does not copy .md files; cp ensures npm binary resolves templates post-compilation | 01-03 |
| OpenCode uses subtask: true for mechanical isolation | Cursor uses prompt-enforced isolation only; OpenCode's is stronger and mechanical | 01-03 |
| Phase 1 template files are intentional stubs | Correct frontmatter enables slash command discovery (Pitfall 8); agent prompts added in Phases 2–4 | 01-03 |
| Validator receives full INPUT.md + REVIEWER.md | D-01: full diff evidence needed to challenge findings; INPUT.md is already written before reviewer runs | 03-01 |
| escalated = severity understated | D-02: not ambiguity signal; real finding at wrong severity level | 03-01 |
| Counter-findings inside <verdict> blocks | D-03: challenged verdicts may include <counter-finding> block; Phase 4 Writer extracts them from rawContent | 03-01 |
| Counter-finding blocks stripped from verdict parser | parseVerdictBlock strips <counter-finding> before key:value parsing; rawContent always preserves them | 03-01 |
| findingid remapped to findingId post-parse | Lowercase key parser produces 'findingid'; remapped before ValidationVerdictSchema.safeParse() | 03-01 |
| Every finding gets a verdict (D-07) | If uncertain, default to confirmed with uncertainty noted in rationale | 03-01 |
| Local session slug uses nanoid(4) suffix | Prevents same-day collision: `2026-04-06-local-a3b7` vs old hardcoded `local` | 05-01 |
| verifyFileExists at each pipeline handoff | Throws `[rms] Pipeline error: {label} not found at {path}`; prevents silent partial runs | 05-01 |
| PR session slug format: `pr-{number}-{branch}` | e.g. `2026-04-06-pr-123-fix-auth`; sanitizeSlug handles slashes automatically | 05-02 |
| getPrDiff uses two sequential GitHub API calls | First GET /pulls/{n} (JSON) for branch name, then same URL with diff Accept header for raw diff | 05-02 |
| detectRepoSlug parses both HTTPS and SSH remotes | Regex handles both formats; throws clear error for non-GitHub remotes | 05-02 |

### Open Questions

- **Focus area suppression depth:** Does "focus: security" genuinely suppress style findings or merely de-emphasize? Tested in Phase 2.
- **Cursor isolation strength:** Prompt-enforced only — how much weaker than OpenCode's mechanical isolation? Quantified in Phase 7.

### Pitfalls to Watch

1. **Writer finding loss (Pitfall 9):** Writer must not silently drop findings. Verified in Phase 4 — completeness check passes.
2. **Counter-finding attribution:** Phase 4 Writer attributes counter-findings to validator, not reviewer. Verified in Phase 4.
3. **Prompt injection via code under review (confirmed CVE):** Delimiter wrapping required. Address in Phase 7 if not done in Phase 6.

### Todos

None — Phase 5 complete. Next: `/gsd-discuss-phase 6` or `/gsd-plan-phase 6`.

---

## Session Continuity

### Context for Next Session

Phase 5 complete. Phases 1 (at checkpoint) and 2–5 fully done. Full pipeline now operational: `review-local` and `review-pr` both wired end-to-end. 99 tests pass.

Key Phase 5 artifacts:
- `src/index.ts`: review-local with nanoid suffix slug; review-pr fully wired; verifyFileExists at both handoffs
- `src/pipeline-io.ts`: getPrDiff, detectRepoSlug, PrDiffResult, verifyFileExists, extended WriteInputOptions
- `src/pipeline-io.test.ts`: 11 new tests (verifyFileExists ×3, getPrDiff ×6, detectRepoSlug ×2)
- Command files (.opencode/commands/, .cursor/commands/): all 4 synced to CLI invocations
- Templates (src/templates/): all 4 updated to match installed commands

Phase 6 goal: Fix command — `/fix <finding-id>` and `/fix` (interactive), with confirmation prompt and stale-file detection.

Phase 6 requirements: FIX-01, FIX-02, FIX-03, FIX-04

### How to Resume

```
1. Read .planning/STATE.md (this file)
2. Read .planning/phases/05-review-orchestration/05-CONTEXT.md for Phase 5 decisions
3. Discuss or plan Phase 6: /gsd-discuss-phase 6 or /gsd-plan-phase 6
```

---

*State initialized: 2026-04-03*
*Last updated: 2026-04-06 after Phase 5 complete (review orchestration — review-local + review-pr wired, 99 tests passing)*
