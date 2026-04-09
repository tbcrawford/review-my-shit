# review-my-shit (rms)

## What This Is

A slash command-driven code review system for OpenCode and Cursor. Three fully isolated agents — a primary reviewer, a validator, and a writer — collaborate to produce structured, auditable review reports written to `.reviews/`. A separate fix command lets users selectively apply findings after personal review.

## Core Value

The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Slash command entry point works in both OpenCode and Cursor
- [ ] User can scope a review to git diff (local) or PR diff (remote), choosing per-review
- [ ] User can optionally specify a focus area when invoking the review command
- [ ] Primary reviewer analyzes code across 11 dimensions
- [ ] Validator independently challenges reviewer findings without access to reviewer's reasoning process
- [ ] Writer synthesizes reviewer + validator output into a severity-grouped final report
- [ ] All intermediate role outputs are persisted alongside the final report (full audit trail)
- [ ] Report structure: findings grouped by severity (critical → high → medium → low → info)
- [ ] Each finding includes: file, line reference, explanation, suggestion, finding ID
- [ ] Fix command applies specific findings by ID
- [ ] Fix command falls back to interactive selection if no finding ID is provided
- [ ] System is language agnostic (no language-specific assumptions baked in)
- [ ] No external service dependencies for the tool itself (uses whatever model the editor provides)

### Out of Scope

- Local LLM requirement — tool uses whatever model the editor has configured, could be cloud or local
- Automatic fix application without user review — fixes always require explicit user invocation
- CI/CD integration — this is an interactive developer tool, not a pipeline step (v1)
- GitHub PR comments / issue creation — report is file-based, not posted to remote services (v1)
- Real-time review as you type — triggered on demand, not continuous

## Context

- **Ecosystem**: Designed to integrate with OpenCode and Cursor as slash commands. Both support custom slash commands via AGENTS.md/rules files or similar conventions.
- **Repository name**: `review-my-shit` (github), known as `rms` in usage (commands, docs, references)
- **Three-role design**: Primary reviewer and validator must be fully isolated — the validator cannot see the reviewer's chain of thought, only its structured output. This is what gives the validation step its adversarial value.
- **11 review dimensions**: bugs/logic errors, security, performance, style/conventions, test coverage, architecture, error handling/resilience, data integrity, API & interface contracts, dependency & environment risk, code & documentation consistency (doc-code, doc-doc, code-code)
- **Output location**: `.reviews/` directory with one folder per review, containing role-specific output files and the final synthesized report
- **Auditability goal**: Every finding in the final report can be traced back to the role that generated it and whether the validator challenged it

## Constraints

- **Integration**: OpenCode and Cursor slash command conventions — must work within those invocation models
- **Language agnosticism**: Reviewer logic must not assume any specific language, framework, or toolchain
- **Isolation**: Validator must not receive the primary reviewer's reasoning — only its structured output — to preserve adversarial independence
- **No auto-fix**: The fix command is a separate, explicit user action — never automatic

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three fully isolated agents vs. single staged agent | Validator independence requires true isolation — shared context breaks the adversarial model | — Pending |
| File-based output to `.reviews/` | Supports both human reading and AI agent consumption; enables audit trail without external services | — Pending |
| Two-command design (review + fix) | User must personally review findings before fixes are applied — auto-fix undermines trust | — Pending |
| Severity-grouped report (not file-by-file or category-grouped) | Most actionable for prioritization — critical issues surface first regardless of file or category | — Pending |
| Finding IDs | Required for the fix command's by-ID mode and for cross-referencing audit trail | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after Phase 16 completion (GitHub Copilot added as valid provider; `github-copilot/model-id` format from `opencode models` accepted directly; interactive TUI settings picker added for `rms settings` invoked with no arguments)*
