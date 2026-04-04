# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-foundation
**Areas discussed:** Architecture, Slash command structure, Finding ID scheme, Schema file structure, Installation & distribution

---

## Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: Pure prompt files | Commands are pure .md files; host agent orchestrates everything. Zero install. Isolation depends on editor's subtask implementation. | |
| Option B: Hybrid Node.js | Command files call into a Node.js script using the AI SDK for three isolated generateText calls. Total control over isolation. | ✓ |
| Option C: A-first with B escape hatch | Start with Option A, add Node.js if isolation proves inadequate in Phase 3. | |

**User's choice:** Option B — Hybrid Node.js

**Notes:** User selected the more controlled architecture from the start, skipping the "validate Option A first" approach. Node.js layer is the target architecture, not a fallback.

---

## Slash Command Structure

**Question 1: How should the command file call into the Node.js script?**

| Option | Description | Selected |
|--------|-------------|----------|
| Thin command files calling Node directly | !`node .rms/orchestrate.js --scope local` | |
| Single command, script routes args | !`node .rms/orchestrate.js $ARGUMENTS` | |
| Separate command per scope | /review-local and /review-pr as separate command files | ✓ |

**User's choice:** Separate command per scope

---

**Question 2: Where should command files live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel directories per editor | .opencode/commands/ + .cursor/commands/ | ✓ |
| OpenCode-first, Cursor later | Only .opencode/commands/ in Phase 1 | |
| Shared AGENTS.md only | One file at repo root, both editors read it | |

**User's choice:** Parallel directories per editor (both from day one)

---

**Question 3: What should the command files be named?**

| Option | Description | Selected |
|--------|-------------|----------|
| review-local.md + review-pr.md | Clear, namespaced names | ✓ |
| local.md + pr.md | Shorter, less clear | |
| Single review.md with arg routing | Combined file | |

**User's choice:** review-local.md + review-pr.md

---

**Question 4: AGENTS.md at repo root?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, AGENTS.md at repo root | Cross-editor agent descriptions in shared file | |
| No AGENTS.md yet | Add in Phase 7 | |
| Agent prompts inline in Node.js only | No markdown agent files at all | ✓ |

**User's choice:** Agent prompts inline in Node.js — no separate AGENTS.md

---

## Finding ID Scheme

**Question 1: What format should finding IDs use?**

| Option | Description | Selected |
|--------|-------------|----------|
| Date + sequential counter | RMS-YYYYMMDD-NNN — human readable, sortable | |
| Hash-based (opaque) | Hash of session-id + finding-index | |
| Dimension-prefixed counter | SEC-001, BUG-003, PERF-002 — tells you the category | ✓ |

**User's choice:** Dimension-prefixed counter (SEC-, BUG-, PERF-, etc.)

---

**Question 2: How does the counter increment?**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-session counter (reset each run) | Resets to 001 each review | |
| Global counter (never resets) | Stored persistently, never resets across sessions | ✓ |
| Per-session with session disambiguator | Resets but session ID added to disambiguate | |

**User's choice:** Global counter — every finding ever generated gets a unique ID

---

## Schema File Structure

**Question 1: How should findings be structured in REVIEWER.md and VALIDATOR.md?**

| Option | Description | Selected |
|--------|-------------|----------|
| XML-tagged blocks | `<finding id="SEC-001"><severity>...</severity>` — unambiguous, injection-resistant | ✓ |
| YAML frontmatter + markdown body | Frontmatter metadata + readable prose body | |
| Pure markdown with heading conventions | `### Finding: SEC-001` — most readable, most fragile | |

**User's choice:** XML-tagged blocks throughout

---

**Question 2: How is INPUT.md structured?**

| Option | Description | Selected |
|--------|-------------|----------|
| XML tags in INPUT.md too | `<diff>`, `<scope>`, `<focus>` — consistent parse pattern | ✓ |
| Plain markdown for INPUT.md only | INPUT.md uses sections; only agent-to-agent files need XML | |
| INPUT.md doesn't exist — diff passed inline | Diff injected into prompt by Node.js, never written to disk | |

**User's choice:** XML tags in INPUT.md too — consistent parse pattern throughout pipeline

---

**Question 3: What format does REPORT.md use?**

| Option | Description | Selected |
|--------|-------------|----------|
| REPORT.md is plain readable markdown | Human-readable; /fix command reads REVIEWER.md instead | |
| REPORT.md uses XML tags too | /fix can parse REPORT.md directly | ✓ |
| REPORT.md is JSON | Machine-readable but not human-readable in editor | |

**User's choice:** REPORT.md uses XML tags — /fix command can parse it directly

---

## Installation & Distribution

*(This area emerged from user input during the "Ready to create context?" check.)*

**Question 1: How should npx installability factor into Phase 1 architecture?**

| Option | Description | Selected |
|--------|-------------|----------|
| Design for npx from Phase 1 | Target architecture is npx-installable from the start | ✓ |
| Local-first now, npx packaging later | Use local paths during development | |
| npx invocation now, local dev via npm link | Target invocation locked, npm link for dev | |

**User's choice:** Design for npx from Phase 1

---

**Question 2: Install + setup flow?**

User specified: "This should work like get-shit-done (`https://github.com/gsd-build/get-shit-done`). The npx command to install rms should install rms globally. Running the command on latest should get someone's installation updated."

**Resolved design:**
- `npx rms@latest` — global install/update (idempotent)
- `rms install` in a project — writes command files for both OpenCode and Cursor
- Mirrors the GSD pattern exactly

---

## Agent's Discretion

- Exact dimension abbreviation list for all 11 dimensions
- Counter file location within `.reviews/`
- npm package name (`rms` vs `review-my-shit`)
- Command file frontmatter wording

## Deferred Ideas

None

