# STATE: review-my-shit (rms)

**Last updated:** 2026-04-03
**Status:** Active — Phase 1 pending

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
| Status | Not started |
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
| Start with Option A (pure prompt files) | Zero install overhead; validate `subtask: true` isolation empirically before adding Node.js layer | Phase 1 TBD |
| Deterministic finding IDs | LLM-generated UUIDs collide; ID format must be locked in Phase 1 (e.g., `{date}-{counter}`) | Phase 1 TBD |

### Open Questions

- **Option A vs B:** Can `subtask: true` in OpenCode mechanically isolate validator context? Settled by Phase 1 live test.
- **Finding ID format:** Exact scheme (e.g., `{YYYYMMDD}-{NNN}`) to be locked in Phase 1.
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
- [ ] Lock Option A vs B architectural decision (Phase 1 live test)
- [ ] Lock finding ID format (Phase 1)

---

## Session Continuity

### Context for Next Session

Phase 1 (Foundation) is the current target. Key Phase 1 deliverables:
- File schemas defined: `INPUT.md`, `REVIEWER.md`, `VALIDATOR.md`, `REPORT.md`
- Slash command invocation confirmed in OpenCode AND Cursor
- `subtask: true` isolation empirically tested (not just assumed)
- Deterministic finding ID format documented
- `.reviews/` added to `.gitignore` on first run

**Critical path item:** Slash command discovery in OpenCode (chronic failure mode — must test before building anything else).

### How to Resume

```
1. Read .planning/STATE.md (this file)
2. Read .planning/ROADMAP.md → Phase 1 detail
3. Run /gsd-plan-phase 1
```

---

*State initialized: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
