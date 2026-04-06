# Requirements: review-my-shit (rms)

**Defined:** 2026-04-03
**Core Value:** The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Review Pipeline

- [x] **PIPE-01**: User can invoke `/review` as a slash command in OpenCode
- [x] **PIPE-02**: User can invoke `/review` as a slash command in Cursor
- [x] **PIPE-03**: Primary reviewer agent analyzes code across all 11 dimensions in a fully isolated context window
- [ ] **PIPE-04**: Validator agent receives only the reviewer's structured output (not reasoning or chain-of-thought) and independently challenges each finding
- [ ] **PIPE-05**: Writer agent synthesizes reviewer and validator output into a final severity-grouped report
- [x] **PIPE-06**: All three agents run with fully isolated context — no shared conversation history between roles

### Diff Input

- [ ] **DIFF-01**: User can choose local git diff or PR diff as the review input, selected per invocation
- [x] **DIFF-02**: Local diff captures staged and/or uncommitted changes from the working tree
- [ ] **DIFF-03**: PR diff is fetched via GitHub REST API using a user-configured token
- [ ] **DIFF-04**: User can specify an optional focus area when invoking review (e.g., "focus on security", "focus on architecture")

### Report

- [ ] **REPT-01**: Each report includes a metadata header: what was reviewed, scope (local/PR), focus area, model, timestamp, dimensions covered
- [ ] **REPT-02**: Findings are grouped by severity in descending order: critical → high → medium → low → info
- [ ] **REPT-03**: Each finding includes: file path, line reference, explanation of the problem and its consequence, actionable suggestion, and a stable finding ID
- [ ] **REPT-04**: Full audit trail: `.reviews/<session>/` contains role-specific intermediate files (reviewer output, validator verdicts) alongside the final report
- [x] **REPT-05**: Finding IDs are deterministic and stable within a review session (not randomly LLM-generated)
- [x] **REPT-06**: `.reviews/` is added to `.gitignore` automatically on first run

### Fix Command

- [ ] **FIX-01**: User can invoke `/fix <finding-id>` to apply a specific finding's suggestion
- [ ] **FIX-02**: User can invoke `/fix` with no arguments to enter interactive selection mode (presents findings from the latest report)
- [ ] **FIX-03**: Fix command displays the finding and its suggestion before applying any change
- [ ] **FIX-04**: Fix command never applies changes automatically — always requires explicit user action

### Quality & Compatibility

- [x] **QUAL-01**: System is language agnostic — no language-specific assumptions baked into agent prompts or tooling
- [x] **QUAL-02**: Reviewer covers all 11 dimensions: bugs & logic errors, security, performance, style & conventions, test coverage, architecture, error handling & resilience, data integrity, API & interface contracts, dependency & environment risk, code & documentation consistency
- [x] **QUAL-03**: Tool has no external service dependencies beyond the GitHub API for PR diffs — uses whatever model the editor has configured

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Report Enhancements

- **REPT-V2-01**: Writer identifies and surfaces cross-finding patterns (e.g., "4 of 5 critical findings stem from missing error propagation in the service layer")

### Platform Expansion

- **PLAT-V2-01**: PR diff input supports GitLab (via `glab` CLI or API)
- **PLAT-V2-02**: PR diff input supports Bitbucket

### Workflow

- **WKFL-V2-01**: CI/CD integration via machine-readable report format (JSON or SARIF) with exit codes
- **WKFL-V2-02**: Post findings as inline PR comments on GitHub (requires OAuth integration)

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-fix without explicit invocation | Removes human from the loop; trains rubber-stamp behavior — anti-pattern to design against |
| CI/CD pipeline integration (v1) | Different design requirements (exit codes, thresholds, parallel scanning); conflicting trade-offs with interactive tool |
| GitHub PR comment posting (v1) | Requires OAuth flows, API credentials, webhook complexity — violates "no external service dependencies" constraint |
| Built-in linters / static analysis | Language-specific toolchain installation and rule maintenance — duplicates what developers already have in CI |
| Real-time / continuous review | Requires background processes, IDE extension infrastructure, event handling — different product category |
| Learnable preferences / feedback loop | Persistent review history, feedback signals, RAG pipelines — significant infrastructure for a local tool |
| PR summaries / change descriptions | Generation task, not review task — conflates authoring assistance with quality review |
| Multi-platform git host support (v1) | GitHub-only via API token is sufficient; multi-platform is a platform play requiring separate integration work |
| Local LLM requirement | Tool uses whatever model the editor is configured with — model choice is the user's, not rms's |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-03 | Phase 2 | Complete |
| PIPE-04 | Phase 3 | Pending |
| PIPE-05 | Phase 4 | Pending |
| PIPE-06 | Phase 1 | Complete |
| DIFF-01 | Phase 5 | Pending |
| DIFF-02 | Phase 2 | Complete |
| DIFF-03 | Phase 5 | Pending |
| DIFF-04 | Phase 5 | Pending |
| REPT-01 | Phase 4 | Pending |
| REPT-02 | Phase 4 | Pending |
| REPT-03 | Phase 4 | Pending |
| REPT-04 | Phase 4 | Pending |
| REPT-05 | Phase 1 | Complete |
| REPT-06 | Phase 1 | Complete |
| FIX-01 | Phase 6 | Pending |
| FIX-02 | Phase 6 | Pending |
| FIX-03 | Phase 6 | Pending |
| FIX-04 | Phase 6 | Pending |
| QUAL-01 | Phase 2 | Complete |
| QUAL-02 | Phase 2 | Complete |
| QUAL-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after initial definition*
