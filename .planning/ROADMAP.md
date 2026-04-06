# Roadmap: review-my-shit (rms)

**Created:** 2026-04-03
**Granularity:** Standard (5–8 phases)
**Coverage:** 23/23 v1 requirements mapped ✓

---

## Phases

- [ ] **Phase 1: Foundation** — Lock schemas, validate slash command invocation, confirm isolation, establish finding ID strategy
- [x] **Phase 2: Reviewer Agent** — Implement the primary reviewer agent across all 11 dimensions with diff preprocessing (completed 2026-04-06)
- [x] **Phase 3: Validator Agent** — Implement the adversarial validator and confirm empirical isolation independence (completed 2026-04-06)
- [x] **Phase 4: Writer Agent** — Synthesize reviewer + validator outputs into a severity-grouped report with full audit trail (completed 2026-04-06)
- [x] **Phase 5: Review Orchestration** — Wire the `/review` entry command: scope selection, session creation, pipeline sequencing (completed 2026-04-06)
- [x] **Phase 6: Fix Command** — Implement `/fix` with by-ID and interactive selection modes (completed 2026-04-06)
- [x] **Phase 7: Cross-Editor Hardening** — Validate end-to-end in both OpenCode and Cursor; harden edge cases (completed 2026-04-06)

---

## Phase Details

### Phase 1: Foundation
**Goal**: Lock all file schemas, confirm slash command invocation works in both editors, validate agent isolation mechanism, and establish deterministic finding ID strategy — before any agent work begins.
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-06, REPT-05, REPT-06, QUAL-03
**Success Criteria** (what must be TRUE):
  1. `/review` can be discovered and invoked from the OpenCode command palette without error
  2. `/review` can be discovered and invoked from the Cursor command palette without error
  3. `subtask: true` isolation is empirically confirmed: a validator seeded with a known-false finding challenges it (not confirms it)
  4. Finding ID format is documented and deterministic — two runs on the same diff produce the same IDs
  5. `.reviews/` appears in `.gitignore` on first run with no manual step required
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold: npm package, TypeScript, CLI entrypoint, session module
- [x] 01-02-PLAN.md — Zod schemas for all pipeline files + finding ID generation module
- [x] 01-03-PLAN.md — Installer (`rms install`) + OpenCode/Cursor command template files
- [ ] 01-04-PLAN.md — Install into repo, verify command discovery in both editors (checkpoint)

**UI hint**: no

### Phase 2: Reviewer Agent
**Goal**: Implement the `rms-reviewer` agent that reads `INPUT.md`, analyzes code across all 11 dimensions in an isolated context window, and writes a structured `REVIEWER.md`.
**Depends on**: Phase 1
**Requirements**: PIPE-03, PIPE-06, DIFF-02, QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Reviewer reads `INPUT.md` and writes `REVIEWER.md` with all 11 dimensions covered
  2. Reviewer catches a deliberate bug, security issue, and style violation injected into a test diff
  3. Known lock file and binary file content is stripped before the reviewer sees the diff
  4. Reviewer output contains no chain-of-thought reasoning — only structured findings
  5. Focus area hint (e.g., "security") demonstrably suppresses style/nitpick findings in output
**Plans**: TBD
**UI hint**: no

### Phase 3: Validator Agent
**Goal**: Implement the `rms-validator` agent that receives only `REVIEWER.md` structured findings (not reasoning) and writes per-finding adversarial verdicts to `VALIDATOR.md`.
**Depends on**: Phase 2
**Requirements**: PIPE-04, PIPE-06
**Success Criteria** (what must be TRUE):
  1. Validator receives `INPUT.md` + `REVIEWER.md` and produces `VALIDATOR.md` with a verdict per finding
  2. Validator challenges at least one injected false-positive finding (empirical independence test passes)
  3. Validator output never references the reviewer's chain-of-thought or session — only its structured findings
  4. Each verdict is one of: confirmed / challenged / escalated — no ambiguous or missing verdicts
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Validator agent module: parseValidatorOutput + runValidator (mirrors reviewer pattern)
- [x] 03-02-PLAN.md — Wire validator into review-local pipeline + empirical independence test (D-10)

**UI hint**: no

### Phase 4: Writer Agent
**Goal**: Implement the `rms-writer` agent that synthesizes `INPUT.md`, `REVIEWER.md`, and `VALIDATOR.md` into a complete `REPORT.md` grouped by severity with all required finding fields and audit trail metadata.
**Depends on**: Phase 3
**Requirements**: PIPE-05, REPT-01, REPT-02, REPT-03, REPT-04, REPT-05
**Success Criteria** (what must be TRUE):
  1. Writer produces `REPORT.md` with findings in severity order: critical → high → medium → low → info
  2. Every finding in `REPORT.md` contains: file path, line reference, explanation, suggestion, and finding ID
  3. Report metadata header includes: scope (local/PR), focus area, model, timestamp, dimensions covered
  4. `.reviews/<session>/` contains `REVIEWER.md`, `VALIDATOR.md`, and `REPORT.md` — full audit trail intact
  5. No finding present in `REVIEWER.md` is silently dropped from `REPORT.md` (completeness check passes)
- [x] 04-01-PLAN.md — Writer core: parseCounterFindings + runWriter (deterministic assembly)
- [x] 04-02-PLAN.md — Wire writer into review-local pipeline + all tests passing

**UI hint**: no

### Phase 5: Review Orchestration
**Goal**: Implement the `/review` entry adapter that parses user scope selection and optional focus area, creates the session folder, writes `INPUT.md`, and sequences Reviewer → Validator → Writer with file-existence verification at each handoff.
**Depends on**: Phase 4
**Requirements**: DIFF-01, DIFF-03, DIFF-04, PIPE-01, PIPE-02
**Success Criteria** (what must be TRUE):
  1. User can invoke `/review local` and receive a `REPORT.md` generated from staged/uncommitted git changes
  2. User can invoke `/review pr <number>` and receive a `REPORT.md` generated from a GitHub PR diff
  3. User can append a focus area (e.g., `/review local --focus security`) and see the reviewer emphasis reflected in the report
  4. If the PR fetch fails or the diff is empty, the command exits with a clear error message rather than producing an empty report
  5. Pipeline fails loudly if a previous step's output file is missing — no silent partial runs
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Wire review-local: session slug collision fix, verifyFileExists at handoffs, command template updates
- [x] 05-02-PLAN.md — Wire review-pr: getPrDiff, detectRepoSlug, PR metadata in INPUT.md

**UI hint**: no

### Phase 6: Fix Command
**Goal**: Implement the `/fix` command that applies a specific finding's suggestion by ID, or falls back to interactive finding selection from the latest report, always showing the finding before applying any change.
**Depends on**: Phase 5
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. `/fix <finding-id>` displays the finding and suggestion, then applies the change only after explicit user confirmation
  2. `/fix` with no arguments presents an interactive list of findings from the latest `REPORT.md` for selection
  3. Fix command detects when the target file has changed since the review and warns the user before proceeding
  4. No fix is ever applied automatically without explicit user action — confirmation prompt always appears
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — fixer.ts: parseReportFindings, findFindingById, checkStaleness, formatFixOutput, formatFindingList
- [x] 06-02-PLAN.md — Wire fix command in index.ts + templates (opencode-fix.md, cursor-fix.md) + installer

**UI hint**: no

### Phase 7: Cross-Editor Hardening
**Goal**: Validate the full pipeline end-to-end in both OpenCode and Cursor, document isolation model differences, write `AGENTS.md`, and harden edge cases discovered during cross-editor testing.
**Depends on**: Phase 6
**Requirements**: PIPE-01, PIPE-02, DIFF-01, QUAL-01
**Success Criteria** (what must be TRUE):
  1. Full review pipeline runs end-to-end in OpenCode: local diff → `REPORT.md` in `.reviews/<session>/`
  2. Full review pipeline runs end-to-end in Cursor: local diff → `REPORT.md` in `.reviews/<session>/`
  3. `AGENTS.md` is present and accurately describes the pipeline, isolation model, and known editor-specific behaviors
  4. Edge case: session reload after `/new` does not corrupt or lose an in-progress review
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — Prompt injection hardening: XML wrapping + anti-injection instructions in reviewer + validator; AGENTS.md
- [x] 07-02-PLAN.md — Cursor command template improvements: build hint, severity presentation, session ID guidance; package.json build fix

**UI hint**: no

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/4 | In Progress|  |
| 2. Reviewer Agent | 2/2 | Complete   | 2026-04-06 |
| 3. Validator Agent | 2/2 | Complete   | 2026-04-06 |
| 4. Writer Agent | 2/2 | Complete   | 2026-04-06 |
| 5. Review Orchestration | 2/2 | Complete   | 2026-04-06 |
| 6. Fix Command | 2/2 | Complete   | 2026-04-06 |
| 7. Cross-Editor Hardening | 2/2 | Complete   | 2026-04-06 |
| 8. Per-agent model selection | 2/2 | Complete    | 2026-04-06 |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| PIPE-01 | Phase 1, Phase 5 (primary: Phase 1) |
| PIPE-02 | Phase 1, Phase 5 (primary: Phase 1) |
| PIPE-03 | Phase 2 |
| PIPE-04 | Phase 3 |
| PIPE-05 | Phase 4 |
| PIPE-06 | Phase 1, Phase 2, Phase 3 (primary: Phase 1) |
| DIFF-01 | Phase 5 |
| DIFF-02 | Phase 2 |
| DIFF-03 | Phase 5 |
| DIFF-04 | Phase 5 |
| REPT-01 | Phase 4 |
| REPT-02 | Phase 4 |
| REPT-03 | Phase 4 |
| REPT-04 | Phase 4 |
| REPT-05 | Phase 1 |
| REPT-06 | Phase 1 |
| FIX-01 | Phase 6 |
| FIX-02 | Phase 6 |
| FIX-03 | Phase 6 |
| FIX-04 | Phase 6 |
| QUAL-01 | Phase 2 |
| QUAL-02 | Phase 2 |
| QUAL-03 | Phase 1 |

**Mapped:** 23/23 ✓

### Phase 8: Per-agent model selection via JSON config with /rms-settings command

**Goal:** Replace the single global `resolveModel()` (env vars only) with per-agent model selection driven by `~/.config/rms/config.json`, with env var fallback for backward compatibility and an `/rms-settings` editor command for configuration.
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 2/2 plans complete

Plans:
- [x] 08-01-PLAN.md — Config layer: RmsConfigSchema in schemas.ts, src/config.ts (loadRmsConfig, saveRmsConfig, resolveAgentModel) with TDD
- [x] 08-02-PLAN.md — Integration: wire per-agent models into index.ts, add rms settings CLI sub-command, add editor templates, update AGENTS.md

### Phase 9: Unified /rms-review command that prompts user for review scope when no context is provided

**Goal:** Add a unified `rms review` CLI sub-command that outputs an interactive scope-selection prompt when invoked with no arguments, and routes to the existing local or PR review pipeline when called with `local` or `pr <number>`. Wire both editors with `/rms-review` templates and update the installer.
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md — `review` sub-command in src/index.ts: extract runLocalReview + runPrReview helpers, scope routing, interactive prompt output, tests
- [ ] 09-02-PLAN.md — Editor templates (opencode-review.md, cursor-review.md) + installer update (2 new entries → 10 total)

---

*Roadmap created: 2026-04-03*
*Last updated: 2026-04-06 after Phase 6 complete (fix command — parseReportFindings, checkStaleness, formatFixOutput, by-ID + interactive modes, 134 tests passing)*
