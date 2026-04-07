---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
last_updated: "2026-04-07T15:56:11.725Z"
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 19
  completed_plans: 15
  percent: 100
---

# STATE: review-my-shit (rms)

**Last updated:** 2026-04-06
**Status:** COMPLETE — All 9 phases done. v1.0 milestone shipped.

---

## Project Reference

| Field | Value |
|-------|-------|
| Project file | `.planning/PROJECT.md` |
| Requirements file | `.planning/REQUIREMENTS.md` |
| Roadmap file | `.planning/ROADMAP.md` |
| Core value | The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable. |
| Current focus | Phase 7: Cross-Editor Hardening — validate end-to-end in both editors |

---

## Current Position

Phase: 9 — COMPLETE
All 9 phases done. v1.0 milestone fully shipped.

| Field | Value |
|-------|-------|
| Current phase | Phase 9: Unified /rms-review Command — COMPLETE |
| Status | All success criteria met; 152 tests passing |
| Blocking issues | None |

```
Progress: [██████████] 100% (18/18 plans)
```

---

## Phase Status

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Foundation | Complete | 2026-04-06 |
| 2 | Reviewer Agent | Complete | 2026-04-06 |
| 3 | Validator Agent | Complete | 2026-04-06 |
| 4 | Writer Agent | Complete | 2026-04-06 |
| 5 | Review Orchestration | Complete | 2026-04-06 |
| 6 | Fix Command | Complete | 2026-04-06 |
| 7 | Cross-Editor Hardening | Complete | 2026-04-06 |
| 8 | Per-Agent Model Selection | Complete | 2026-04-06 |
| 9 | Unified /rms-review Command | Complete | 2026-04-06 |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 9 / 9 (all phases complete) |
| Plans complete | 18 / 18 |
| Requirements covered | 23 / 23 |
| Requirements validated | 23 / 23 |
| Phase 10 P03 | 4 min | 5 tasks | 11 files |

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
| Phase 06 P01 | ~15 min | 2 tasks | 2 files |
| Phase 06 P02 | ~10 min | 2 tasks | 6 files |
| Phase 09 P01 | ~10 min | 4 tasks | 2 files |
| Phase 09 P02 | ~3 min | 3 tasks | 3 files |

### Accumulated Context

### Roadmap Evolution

- Phase 8 added: Per-agent model selection via JSON config with /rms-settings command
- Phase 9 added: Unified /rms-review command that prompts user for review scope when no context is provided
- Phase 10 added: change the installation of this project to be global instead of per project

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
| Fix command outputs structured context, never edits directly | Host AI agent reads output and asks user for confirmation — never auto-applies | 06-01 |
| parseReportFindings splits on severity section headers | Regex split on `## Critical/High/Medium/Low/Info`; finds blocks by `---` separator | 06-01 |
| checkStaleness compares file mtime to REPORT.md mtime | isStale=true when target file mtime > reportMtime; isStale=false if file missing | 06-01 |
| formatFindingList truncates long explanations at 80 chars | Keeps interactive list readable without truncating the actual fix context | 06-01 |
| Prompt injection hardening via XML wrapping | Diff wrapped in `<diff>`, input-md in `<input-md>`, reviewer-md in `<reviewer-md>`; all with anti-injection instructions | 07-01 |
| AGENTS.md at repo root | Describes pipeline architecture, isolation model, commands, env vars, editor behaviors — required by OpenCode AGENTS.md convention | 07-01 |
| Session data survives `/new` in OpenCode | CLI owns all filesystem state; `.reviews/` files are safe across session reloads — documented in AGENTS.md | 07-01 |
| Cursor command templates hardened | Build hint, severity-grouped presentation, session ID guidance, GITHUB_TOKEN error guidance added to cursor templates | 07-02 |
| `cp -r src/templates dist/` (not `dist/templates`) | macOS `cp -r` creates `dist/templates/templates/` double-nesting when destination dir exists; fixed in package.json build script | 07-02 |
| `rms review` scope routing | D-01: no-args outputs structured scope-prompt; `local`/`pr` route to shared helpers; unknown scope exits 1 | 09-01 |
| `runLocalReview`/`runPrReview` helpers | Extracted from existing command action bodies — no pipeline logic changed; DRY refactor only | 09-01 |
| Destination name `rms-review.md` (with prefix) | Mirrors `rms-settings.md` convention; avoids collision with `review-local.md` / `review-pr.md` | 09-02 |

### Open Questions

None — all questions resolved.

### Pitfalls to Watch

1. **Writer finding loss (Pitfall 9):** Writer must not silently drop findings. Verified in Phase 4 — completeness check passes.
2. **Counter-finding attribution:** Phase 4 Writer attributes counter-findings to validator, not reviewer. Verified in Phase 4.
3. **Prompt injection via code under review:** Resolved in Phase 7 — XML wrapping + anti-injection instructions added to reviewer and validator prompts.

### Todos

None — all 9 phases complete. v1.0 milestone done.

---

## Session Continuity

### Context for Next Session

All 9 phases complete. v1.0 milestone fully shipped. 152 tests pass.

Key Phase 9 artifacts:

- `src/index.ts`: `runLocalReview()` + `runPrReview()` helpers extracted; `review` sub-command added
- `src/index.test.ts`: 3 new routing unit tests (152 total passing)
- `src/templates/opencode-review.md`: OpenCode `/rms-review` command template
- `src/templates/cursor-review.md`: Cursor `/rms-review` command template with scope-prompt handling
- `src/installer.ts`: 10 INSTALLS entries (was 8); adds rms-review for both editors
- `.opencode/commands/rms-review.md` + `.cursor/commands/rms-review.md`: installed and ready

### How to Resume

No resumption needed — all phases complete. v1.0 shipped.

---

*State initialized: 2026-04-03*
*Last updated: 2026-04-06 after Phase 9 complete (unified /rms-review command — runLocalReview/runPrReview helpers, review sub-command, 2 new editor templates, 10-entry installer — 152 tests passing)*
