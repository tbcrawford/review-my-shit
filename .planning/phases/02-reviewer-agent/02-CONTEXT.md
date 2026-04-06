# Phase 2: Reviewer Agent - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the `rms-reviewer` agent that reads `INPUT.md`, analyzes code across all 11 dimensions in an isolated context window, and writes a structured `REVIEWER.md`.

Requirements: PIPE-03, PIPE-06, DIFF-02, QUAL-01, QUAL-02
Success criteria: 5 items (all 11 dimensions covered, catches injected bugs, strips lock files/binary content, no chain-of-thought in output, focus area demonstrably works)

</domain>

<decisions>
## Implementation Decisions

### Analysis Exhaustiveness

- **D-01:** Findings + no-issue confirmations. For each of the 11 dimensions, the reviewer confirms whether issues were found. If issues exist, structured Finding entries are included. If no issues, a brief confirmation statement is written (e.g., "TEST: No test gaps found"). Every dimension gets a line — nothing is silently skipped.

### Focus Suppression

- **D-02:** Focus-only mode. When `focus:` is specified in INPUT.md (e.g., `focus: security`), the reviewer analyzes ONLY the specified dimension(s). Other dimensions receive a "suppressed" notice rather than a full review. This is faster and more targeted than de-emphasizing everything.
- **D-03:** Focus areas map to dimension abbreviations. The `focus` field is a dimension abbreviation or name that the reviewer maps to the corresponding dimension. Unrecognized focus values produce a warning but do not block the review.

### Output Format

- **D-04:** Dimension sections with findings. REVIEWER.md is organized as one section per dimension (BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC). Each section contains either confirmations or structured Finding entries. This makes it easy to locate findings by type and confirm dimension coverage.
- **D-05:** Findings use the FindingSchema (id, severity, file, line, dimension, explanation, suggestion). Finding IDs are assigned by the orchestrator after parsing, not by the reviewer LLM.
- **D-06:** Dimension sections are always present. Even when a dimension has no findings, the section header and confirmation line appear. This makes coverage auditable.

### No-Findings Behavior

- **D-07:** All-dimensions confirmed. When the diff has no issues at all, REVIEWER.md contains a "Clean Review" header and all 11 dimensions listed with "No issues found" confirmation. This proves the reviewer genuinely considered each dimension.

### Reviewer Prompt Location

- **D-08:** Reviewer prompt lives in the Node.js orchestrator script. Inline in the orchestrator, not in a separate AGENTS.md file. Consistent with Phase 1 decision (D-03 from 01-CONTEXT.md).

### Diff Preprocessing

- **D-09:** Binary files and lock files are stripped by the orchestrator before the diff is written to INPUT.md. The reviewer never sees lock files (*.lock, package-lock.json, yarn.lock), binary files (images, compiled assets), or node_modules diffs. Consistent with DIFF-02 requirement.

### the agent's Discretion

- Exact dimension order in REVIEWER.md sections (alphabetical, or as listed in the schema)
- Confirmation statement wording per dimension (e.g., "No [dimension] issues found" vs "✓ [dimension] clean")
- How to handle a focus area that matches zero dimensions (warning wording)
- Exact formatting of the dimension section headers (markdown level 2 vs level 3)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning Files
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 2 covers PIPE-03, PIPE-06, DIFF-02, QUAL-01, QUAL-02
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 items that must be TRUE)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions (hybrid architecture, inline prompts, XML-tagged files, finding ID scheme)
- `.planning/phases/01-foundation/01-PLAN.md` — Phase 1 implementation details (schemas.ts, session.ts)

### Source Files
- `src/schemas.ts` — FindingSchema (id, severity, file, line, dimension, explanation, suggestion), SeveritySchema, all dimension abbreviations
- `src/session.ts` — Session creation, review ID generation
- `src/finding-id.ts` — Finding ID generation (orchestrator assigns IDs, not LLM)

### Research Files
- `.planning/research/STACK.md` — Technology stack (Vercel AI SDK v6, Zod)
- `.planning/research/PITFALLS.md` — Pitfalls (especially Pitfall 1: validator contamination, Pitfall 3: finding ID instability)

</canonical_refs>

<codebase>
## Existing Code Insights

### Reusable Assets
- `src/schemas.ts` FindingSchema: already defined and used by all phases. Planner should reuse this directly.
- `src/schemas.ts` DIMENSIONS array: 11 dimension abbreviations already defined (BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC)

### Established Patterns
- XML-tagged file format: all pipeline files use `<finding>` tags within XML blocks. Reviewer should follow this pattern.
- Finding ID assignment by orchestrator: the orchestrator parses REVIEWER.md and assigns IDs, not the reviewer LLM. Planner should implement this in the orchestrator, not in the reviewer prompt.

### Integration Points
- INPUT.md: reviewer reads this first. Orchestrator writes it before spawning the reviewer.
- REVIEWER.md: reviewer writes this. Orchestrator reads it after reviewer completes and before validator starts.
- Orchestrator: sequences Reviewer → Validator → Writer. The reviewer is a single generateText call within the orchestrator.

</codebase>

<specifics>
## Specific Ideas

- "I want the reviewer to actually think about each dimension, not just skim"
- Dimension sections should make it obvious which dimensions were reviewed and which were suppressed (focus-only mode)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-reviewer-agent*
*Context gathered: 2026-04-05*
