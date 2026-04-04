# Architecture Patterns: Multi-Agent Code Review Pipeline

**Domain:** Local AI-powered code review tool with isolated reviewer → validator → writer roles
**Researched:** 2026-04-03
**Overall confidence:** HIGH (OpenCode patterns from Context7/official docs; adversarial review pattern verified against published academic work and ASDLC.io practitioner documentation)

---

## Recommended Architecture

### The Core Pattern: Linear Pipeline with Strict Context Separation

This system uses a **Pipeline pattern** — not a Supervisor pattern — because the reviewer → validator → writer sequence is strictly ordered with no branching. Each agent receives only what it needs to do its job; prior reasoning is withheld by design.

```
User invokes /review
        │
        ▼
┌──────────────────┐
│  Entry Adapter   │   Parses args, resolves diff scope (local vs PR),
│  (slash command) │   creates review session folder, writes INPUT.md
└────────┬─────────┘
         │  INPUT.md (diff + focus area + metadata)
         ▼
┌──────────────────┐
│  Reviewer Agent  │   Reads INPUT.md only. Analyzes across 11 dimensions.
│  (subagent)      │   Writes REVIEWER.md (structured findings + IDs).
│                  │   No access to prior session context.
└────────┬─────────┘
         │  REVIEWER.md (structured findings, NO chain of thought)
         ▼
┌──────────────────┐
│ Validator Agent  │   Reads INPUT.md + REVIEWER.md only.
│  (subagent)      │   Challenges each finding adversarially.
│                  │   Writes VALIDATOR.md (challenges, confirmations).
│                  │   Cannot see Reviewer's reasoning process.
└────────┬─────────┘
         │  REVIEWER.md + VALIDATOR.md
         ▼
┌──────────────────┐
│  Writer Agent    │   Reads INPUT.md + REVIEWER.md + VALIDATOR.md.
│  (subagent)      │   Synthesizes into severity-grouped final report.
│                  │   Writes REPORT.md (the human-facing output).
└────────┬─────────┘
         │
         ▼
   .reviews/<slug>/
     INPUT.md
     REVIEWER.md
     VALIDATOR.md
     REPORT.md
```

---

## Component Boundaries

| Component | Responsibility | Inputs | Outputs | Talks To |
|-----------|---------------|--------|---------|----------|
| **Entry Adapter** | Parse invocation args, resolve diff, create session folder | Slash command + user args | `INPUT.md` | File system only |
| **Reviewer Agent** | Analyze diff across 11 dimensions, emit structured findings | `INPUT.md` | `REVIEWER.md` | File system only |
| **Validator Agent** | Challenge each finding adversarially | `INPUT.md` + `REVIEWER.md` | `VALIDATOR.md` | File system only |
| **Writer Agent** | Synthesize all role outputs into final report | `INPUT.md` + `REVIEWER.md` + `VALIDATOR.md` | `REPORT.md` | File system only |
| **Fix Adapter** | Parse fix invocation, resolve finding by ID, apply changes | `REPORT.md` + finding ID or interactive selection | Code edits | File system + editor |

**Communication medium:** The file system is the only inter-agent communication channel. No agent calls another directly. Context isolation is enforced by what each agent is given to read.

---

## Data Flow: What Moves Through the Pipeline

### Review flow (left to right = more context, strictly additive)

```
User intent
  └─► INPUT.md
        • raw diff (git or PR)
        • optional focus area
        • repo context summary
        • review ID + timestamp

INPUT.md ──────────────────────────────────────────────────────►
                                                                  Writer
Reviewer reads INPUT.md → REVIEWER.md ───────────────────────►
  (findings with IDs, severity, file/line, explanation,          Writer
   suggestion — NO internal reasoning)                           (also passed to Validator)

Validator reads INPUT.md + REVIEWER.md → VALIDATOR.md ───────►
  (per-finding verdict: confirmed / challenged / escalated,       Writer
   with rationale — NO access to Reviewer's reasoning)

Writer reads all three → REPORT.md
  (severity-grouped, each finding retains audit trail back
   to REVIEWER.md or VALIDATOR.md)
```

### Fix flow (separate command, separate invocation)

```
User invokes /fix [finding-id] (or interactive selection)
  └─► Fix Adapter reads REPORT.md from most recent review
        • Resolves finding by ID
        • Shows user the finding + suggestion
        • Applies change with explicit user confirmation
```

---

## Agent Isolation Mechanisms

### The Core Problem

If the Validator receives the Reviewer's chain of thought (e.g., "I considered X but ruled it out because..."), the Validator anchors on the Reviewer's framing and loses its adversarial value. This is the **self-validation problem**: a model validating output it can see the reasoning for tends to confirm rather than challenge.

**Source:** ASDLC.io Adversarial Code Review pattern (January 2026) and "The agent that wrote the code is compromised. It knows what it built. It'll rationalize." — Jan (OC2SF), February 2026.

### Three isolation layers in rms

**1. Fresh context window per agent (primary mechanism)**

Each agent runs as an OpenCode subagent invoked via a separate command. OpenCode's `subtask: true` configuration forces a command to execute in a new subagent context, preventing any prior conversation history from leaking. Verified in OpenCode docs (Context7):

```json
{
  "command": {
    "rms-review": {
      "subtask": true,
      "agent": "rms-reviewer"
    }
  }
}
```

**2. Controlled file handoff (what the agent is shown)**

The handoff contract:
- Reviewer receives: `INPUT.md` only
- Validator receives: `INPUT.md` + `REVIEWER.md` (structured output, no reasoning)
- Writer receives: `INPUT.md` + `REVIEWER.md` + `VALIDATOR.md`

`REVIEWER.md` must be structured findings (JSON-like or structured Markdown), not a prose reasoning log. The Reviewer's prompt explicitly instructs it to emit only the structured output — not its analytical process.

**3. Role-specific system prompts (agent constitution)**

Each agent has a distinct system prompt that frames its role adversarially:

- **Reviewer prompt:** "You are a thorough code reviewer. Analyze the diff across 11 dimensions. Emit structured findings with IDs. Do not explain your reasoning process."
- **Validator prompt:** "You are a skeptical validator. Your job is to challenge. Read the findings and find what the reviewer got wrong, missed, or overstated. You do not have access to the reviewer's reasoning — judge only the findings against the diff."
- **Writer prompt:** "You are a synthesis writer. Merge reviewer and validator outputs into a single severity-grouped report. Preserve finding IDs. Note when the validator challenged or confirmed each finding."

---

## File System Layout: `.reviews/` Audit Trail

### Naming convention

Each review session gets a folder named `<date>-<slug>` where slug is derived from the review scope (branch name, PR number, or "local"):

```
.reviews/
  2026-04-03-feat-auth/           ← one folder per review invocation
    INPUT.md                      ← diff + metadata fed to all agents
    REVIEWER.md                   ← raw reviewer findings (structured)
    VALIDATOR.md                  ← validator challenges per finding
    REPORT.md                     ← final severity-grouped report (human-facing)
  2026-04-01-pr-142/
    INPUT.md
    REVIEWER.md
    VALIDATOR.md
    REPORT.md
```

### File schemas

**INPUT.md**
```markdown
---
review_id: 2026-04-03-feat-auth
timestamp: 2026-04-03T14:22:00Z
scope: local-diff
focus: security
---
# Diff
[raw git diff content]
```

**REVIEWER.md**
```markdown
---
review_id: 2026-04-03-feat-auth
role: reviewer
---
# Findings

## RMS-001
- severity: critical
- file: src/auth.ts
- line: 45
- dimension: security
- explanation: SQL query is built by string concatenation with user input.
- suggestion: Use parameterized queries via the ORM's `where()` method.

## RMS-002
...
```

**VALIDATOR.md**
```markdown
---
review_id: 2026-04-03-feat-auth
role: validator
---
# Validation

## RMS-001
- verdict: confirmed
- rationale: Line 45 is clearly interpolating req.body.userId directly into the query string.

## RMS-002
- verdict: challenged
- rationale: The finding assumes the function is called from untrusted input, but this is an internal admin-only route.
```

**REPORT.md**
```markdown
---
review_id: 2026-04-03-feat-auth
generated: 2026-04-03T14:25:00Z
finding_count: 12
---
# Code Review: feat/auth (2026-04-03)

## Critical

### RMS-001 · src/auth.ts:45 · Security
SQL injection via string interpolation.
**Suggestion:** Use parameterized queries.
**Validation:** Confirmed ✓

## High
...
```

### Why file-based (not in-memory)?

1. **Auditability without external services** — every intermediate output is a plain file a human can open
2. **Fix command can reference any past review** — `REPORT.md` is stable, addressable by ID
3. **Context-safe handoff** — a file given to an agent is a clear, inspectable boundary (no hidden session state)
4. **Compatible with AI agent consumption** — agents in the same session can read files via the `Read` tool

---

## Slash Command Invocation Model

### OpenCode

OpenCode supports custom commands via `.opencode/commands/<name>.md` files or `opencode.json`. Each command maps to a named agent and can be forced to run as a subagent (fresh context).

**Configuration:**

```json
// opencode.json
{
  "command": {
    "review": {
      "template": "Run a full code review. Scope: $1. Focus: $2.",
      "description": "Run rms code review pipeline",
      "agent": "rms-orchestrator",
      "subtask": true
    },
    "fix": {
      "template": "Apply fix for finding $ARGUMENTS",
      "description": "Apply a specific rms finding",
      "agent": "rms-fixer",
      "subtask": true
    }
  }
}
```

**Or via markdown files:**

```markdown
<!-- .opencode/commands/review.md -->
---
description: Run rms code review pipeline
agent: rms-orchestrator
subtask: true
---
Run a full code review. Scope: $1. Focus: $2.
```

Each internal agent (reviewer, validator, writer) is a subagent invoked by the orchestrator — they are not directly user-invocable slash commands.

**Key OpenCode fact (HIGH confidence, from Context7 docs):**
- `subtask: true` forces a **separate context window** — this is the isolation mechanism
- `agent:` assigns a specific named agent with its own system prompt and tool permissions
- `$ARGUMENTS`, `$1`, `$2` inject user-provided text at call time

### Cursor

Cursor uses `.cursor/rules/` directory with `.mdc` files (Markdown with front matter) for persistent agent instructions. Custom slash commands in Cursor are defined in `.cursorrules` (YAML format for older versions) or via the Rules system.

**Key Cursor fact (MEDIUM confidence, from Markaicode article February 2026):**
- Cursor's slash commands are defined in `.cursorrules` as YAML blocks
- Each command has `description` and `prompt` fields
- Commands do not natively support agent switching the way OpenCode does — the prompt must instruct the model to follow the pipeline

**Cursor approach (prompt-driven, same session):**

```yaml
# .cursorrules
/review:
  description: "Run rms code review pipeline"
  prompt: |
    Execute the rms review pipeline as defined in AGENTS.md.
    Follow the reviewer → validator → writer sequence exactly.
    Write all intermediate outputs to .reviews/<slug>/ before proceeding.
    Do not proceed to the next role until the current role's file is written.

/fix:
  description: "Apply a specific rms finding by ID"
  prompt: |
    Read .reviews/<most-recent>/REPORT.md and apply the finding with ID: $ARGUMENTS
    Show the user the finding and suggestion before making any changes.
```

**Important difference:** In Cursor, isolation is prompt-enforced (write to file, then read the file in the next "phase") rather than native session switching. In OpenCode, isolation is mechanically enforced via `subtask: true`. This means the OpenCode implementation has stronger adversarial guarantees than the Cursor one.

### Compatibility strategy

Ship with OpenCode as the primary target (true session isolation). Cursor support is file-discipline-based: the orchestrator writes each intermediate file before proceeding to the next phase. This is weaker but functional.

---

## Suggested Build Order

Components have hard dependencies. Build in this order:

### Phase 1 — File scaffold and contracts

**What:** Define `INPUT.md`, `REVIEWER.md`, `VALIDATOR.md`, and `REPORT.md` schemas. Create `.reviews/` directory structure. Implement the session folder naming and creation logic.

**Why first:** Every downstream component depends on reading/writing these files. Getting the schemas wrong late is expensive.

**No dependencies on:** anything else.

### Phase 2 — Reviewer agent

**What:** Define the `rms-reviewer` agent (system prompt, tool permissions). Wire it to read `INPUT.md` and write `REVIEWER.md`. Test in isolation with a known diff.

**Why second:** Reviewer is upstream of everything. Its output schema is what Validator and Writer depend on.

**Depends on:** Phase 1 (file schemas).

### Phase 3 — Validator agent

**What:** Define the `rms-validator` agent. Wire it to read `INPUT.md` + `REVIEWER.md`, write `VALIDATOR.md`. Test adversarial independence — verify it can challenge a deliberately bad Reviewer finding.

**Why third:** Depends on Reviewer output schema being stable.

**Depends on:** Phase 1 (file schemas), Phase 2 (REVIEWER.md format).

### Phase 4 — Writer agent

**What:** Define the `rms-writer` agent. Wire it to read all three inputs, write `REPORT.md`. Implement severity grouping and finding ID preservation.

**Why fourth:** All upstream outputs must be stable before synthesis is reliable.

**Depends on:** Phases 1–3 (all intermediate schemas).

### Phase 5 — Entry adapter (/review command)

**What:** Implement the `/review` slash command. Parse scope arg (local diff vs PR), optional focus area. Create session folder. Write `INPUT.md`. Invoke reviewer → validator → writer in sequence, passing correct files at each handoff.

**Why fifth:** Needs all agents to exist before orchestrating them.

**Depends on:** Phases 1–4.

### Phase 6 — Fix adapter (/fix command)

**What:** Implement the `/fix` slash command. Parse finding ID arg, or fall back to interactive selection from `REPORT.md`. Show user the finding and suggestion before applying. Apply the change.

**Why sixth:** Depends on `REPORT.md` schema (from Phase 4) and the review pipeline existing. Fully decoupled from the review pipeline at runtime.

**Depends on:** Phase 1 (REPORT.md schema), Phase 4 (Writer produces valid REPORT.md).

### Phase 7 — Cross-editor compatibility

**What:** Validate the pipeline works in both OpenCode (`subtask: true`) and Cursor (prompt-discipline mode). Write AGENTS.md to describe the pipeline for any editor.

**Depends on:** Phases 5–6 being stable.

---

## Scalability Considerations

| Concern | Now (single dev) | At team scale |
|---------|-----------------|---------------|
| `.reviews/` growth | One folder per review, manual cleanup | Add `--keep N` flag, prune old reviews |
| Context window on large diffs | Diff may exceed limits | Chunk diff by file, reviewer handles per-file |
| Parallel reviews | Sequential, single session | Each review creates an isolated session; parallel is fine |
| Fix conflicts | N/A (one user) | Finding IDs are review-scoped, no cross-review conflicts |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reviewer and Validator in the same session

**What:** Running both agents in the same conversation thread, showing the Validator the Reviewer's thinking.

**Why bad:** Validator will anchor on Reviewer's framing. "Echo chamber" effect eliminates adversarial value. The Validator will confirm rather than challenge.

**Instead:** Fresh subagent context per role, file-only handoff.

**Source:** ASDLC.io Adversarial Code Review pattern; "The agent that wrote the code is compromised." (OC2SF, 2026)

---

### Anti-Pattern 2: Monolithic review prompt (single-agent)

**What:** One big prompt that tries to review, validate, and write in a single pass.

**Why bad:** Same model validates its own output. Context window bloat degrades quality on large diffs. Impossible to audit intermediate reasoning.

**Instead:** Three discrete agents, three discrete files.

**Source:** RepoReviewer paper (arXiv 2603.16107, March 2026) — single-agent baseline measurably worse than staged pipeline.

---

### Anti-Pattern 3: Writer synthesizes during review

**What:** Writer agent is invoked inline during the review phase, before Validator has run.

**Why bad:** Writer needs the Validator's perspective to correctly weight contested vs. confirmed findings. Early synthesis locks in a perspective before adversarial challenge.

**Instead:** Writer runs only after both REVIEWER.md and VALIDATOR.md are complete.

---

### Anti-Pattern 4: Fix command modifies without confirmation

**What:** `/fix` applies changes immediately on invocation.

**Why bad:** User must personally review findings before fixes are applied. Auto-fix without review undermines the trust model of the tool.

**Instead:** Always show the finding and suggestion, require explicit confirmation, then apply.

---

### Anti-Pattern 5: In-memory handoff between agents

**What:** Passing Reviewer output directly to Validator as a variable/string in the same orchestration call, without writing to disk.

**Why bad:** Loses audit trail. Can't reconstruct what the Validator saw. Harder to debug disagreements. Conflates the file-based output contract.

**Instead:** Write REVIEWER.md to disk; Validator reads from disk. Even if the orchestrator knows both are running in sequence, the file is the source of truth.

---

## Sources

| Source | Type | Confidence | URL |
|--------|------|------------|-----|
| OpenCode commands docs | Official docs (Context7) | HIGH | https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/commands.mdx |
| OpenCode agents docs | Official docs (Context7) | HIGH | https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/agents.mdx |
| ASDLC.io Adversarial Code Review | Practitioner pattern library | HIGH | https://asdlc.io/patterns/adversarial-code-review/ |
| RepoReviewer paper (arXiv) | Academic systems paper | HIGH | https://arxiv.org/html/2603.16107v1 |
| Multi-Agent Architecture Patterns (BeyondScale) | Practitioner blog | MEDIUM | https://beyondscale.tech/blog/multi-agent-systems-architecture-patterns |
| Cursor custom slash commands (Markaicode) | Community article | MEDIUM | https://markaicode.com/cursor-custom-slash-commands/ |
| OC2SF "Calm Coding" | Practitioner insight | MEDIUM | Referenced via ASDLC.io |
