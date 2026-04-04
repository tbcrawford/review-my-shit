# STATE: review-my-shit (rms)

**Last updated:** 2026-04-04
**Status:** Active — Phase 1 ready to plan

---

## Project Reference

| Field | Value |
|-------|-------|
| Project file | `.planning/PROJECT.md` |
| Requirements file | `.planning/REQUIREMENTS.md` |
| Roadmap file | `.planning/ROADMAP.md` |
| Core value | The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable. |
| Current focus | Phase 1: Foundation — schemas, slash command invocation, isolation validation, finding ID strategy |

---

## Current Position

| Field | Value |
|-------|-------|
| Current phase | Phase 1: Foundation |
| Current plan | None (phase not yet planned) |
| Status | Context gathered — ready to plan |
| Blocking issues | None |

```
Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% — Phase 1 of 7 not started
```

---

## Phase Status

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Foundation | Not started | - |
| 2 | Reviewer Agent | Not started | - |
| 3 | Validator Agent | Not started | - |
| 4 | Writer Agent | Not started | - |
| 5 | Review Orchestration | Not started | - |
| 6 | Fix Command | Not started | - |
| 7 | Cross-Editor Hardening | Not started | - |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 7 |
| Plans complete | 0 / ? |
| Requirements covered | 0 / 23 |
| Requirements validated | 0 / 23 |

---

## Accumulated Context

### Key Decisions Made

| Decision | Rationale | Phase |
|----------|-----------|-------|
| 7-phase structure derived from dependency ordering | Schemas → Reviewer → Validator → Writer → Orchestration → Fix → Hardening is the only safe build order | Roadmap |
| Hybrid Node.js architecture | Command files are thin entry points; Node.js orchestrator uses Vercel AI SDK for three isolated generateText calls | Phase 1 |
| npm package distribution | `npx rms@latest` for global install; `rms install` writes editor command files; mirrors GSD install pattern | Phase 1 |
| Both editors from day 1 | `.opencode/commands/` AND `.cursor/commands/` written in parallel; no AGENTS.md at repo root | Phase 1 |
| Finding ID format: `{DIM}-{NNNNN}` | Dimension prefix + 5-digit zero-padded global counter (e.g., `SEC-00001`); assigned by orchestrator, not LLM | Phase 1 |
| XML-tagged pipeline files | All pipeline files use XML blocks (INPUT, REVIEWER, VALIDATOR, REPORT); enables direct parsing by `/fix` | Phase 1 |

### Open Questions

- **Focus area suppression depth:** Does "focus: security" genuinely suppress style findings or merely de-emphasize? Tested in Phase 2.
- **Cursor isolation strength:** Prompt-enforced only — how much weaker than OpenCode's mechanical isolation? Quantified in Phase 7.

### Pitfalls to Watch

1. **Validator contamination (Pitfall 1 — critical):** Validator must not see reviewer chain-of-thought. Test with deliberate false-positive injection in Phase 3.
2. **Prompt injection via code under review (confirmed CVE):** Delimiter wrapping required. Address in Phase 2.
3. **Slash command discovery failure (Pitfall 8):** Test in Phase 1 before any pipeline work — known failure mode in OpenCode.
4. **Finding ID instability (Pitfall 3):** LLM-generated IDs collide. Lock deterministic scheme in Phase 1.
5. **Writer finding loss (Pitfall 9):** Writer must not silently drop findings. Verify completeness in Phase 4.

### Todos

- [ ] Plan Phase 1 (`/gsd-plan-phase 1`)

---

## Session Continuity

### Context for Next Session

Phase 1 discuss-phase is complete. All architectural decisions are locked in `.planning/phases/01-foundation/01-CONTEXT.md`. Key decisions:

- **Architecture:** Hybrid Node.js — thin command files call `!node` into a Vercel AI SDK orchestrator
- **Distribution:** npm package; `npx rms@latest` + `rms install`
- **Editors:** Both `.opencode/commands/` and `.cursor/commands/` from day 1
- **Finding IDs:** `{DIM}-{NNNNN}` format, assigned by orchestrator, global counter in `.reviews/`
- **File format:** XML-tagged blocks throughout pipeline (INPUT, REVIEWER, VALIDATOR, REPORT)

### How to Resume

```
1. Read .planning/STATE.md (this file)
2. Read .planning/phases/01-foundation/01-CONTEXT.md for locked decisions
3. Run /gsd-plan-phase 1
```

---

*State initialized: 2026-04-03*
*Last updated: 2026-04-04 after discuss-phase 1 completed*
