# Phase 3: Validator Agent - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the `rms-validator` agent that receives `INPUT.md` + `REVIEWER.md` and writes a per-finding adversarial verdict to `VALIDATOR.md`.

Requirements: PIPE-04, PIPE-06
Success criteria: 4 items (verdict per finding, empirical false-positive challenge, no reviewer chain-of-thought leakage, all verdicts from confirmed/challenged/escalated)

This phase produces no new user-visible output — the validator's VALIDATOR.md is an intermediate audit artifact consumed by Phase 4 (Writer).

</domain>

<decisions>
## Implementation Decisions

### Validator Input

- **D-01:** The validator receives the full `INPUT.md` content — scope, focus, and the complete preprocessed diff — plus the full `REVIEWER.md` structured findings. It is not restricted to metadata-only. This enables the validator to verify that reviewer file/line references are real, catch hallucinated paths, and ground its adversarial challenge in actual evidence from the diff.

### Verdict Semantics

- **D-02:** Three verdicts — `confirmed`, `challenged`, `escalated` — each with defined meaning:
  - `confirmed`: Finding is valid and severity is accurate.
  - `challenged`: Finding is a false positive or the claim is incorrect. Validator provides rationale. If the real underlying concern exists but is different, a structured `<counter-finding>` block is included inside the `<verdict>`.
  - `escalated`: Finding is valid, but the reviewer's severity is understated. The validator's rationale explains why the severity should be higher. The specific upgraded severity is left to the Phase 4 Writer / user judgment — the validator does not prescribe a new severity value.

### Challenge Behavior

- **D-03:** When challenging a finding, the validator may include a structured `<counter-finding>` block inside the `<verdict>` block. This block redirects to the real issue if one exists. Format mirrors the reviewer's `<finding>` block (severity, file, line, dimension, explanation, suggestion) but does NOT include an id field — the orchestrator assigns IDs. Counter-findings are optional: simple false positives that have no underlying concern need only a rationale.

- **D-04:** Counter-findings from challenged verdicts are surfaced by Phase 4 Writer as new attributed findings (attributed to validator, not reviewer). Phase 4 is responsible for the surfacing logic — this phase only ensures the structured block is parseable.

### Output Format

- **D-05:** VALIDATOR.md uses `<verdict>` blocks, one per finding. Each block contains: `findingId`, `verdict`, `rationale`, and optionally a nested `<counter-finding>` block. XML-tagged structure mirrors the reviewer's `<finding>` blocks — consistent with the established pipeline file format (Phase 1 D-10).

- **D-06:** VALIDATOR.md frontmatter: `reviewId` and `role: validator` — matches `ValidatorFileSchema` already in `src/schemas.ts`.

- **D-07:** Every finding in REVIEWER.md must have a corresponding `<verdict>` in VALIDATOR.md. No finding is silently skipped. If the validator cannot determine a verdict (ambiguous evidence), it defaults to `confirmed` with a rationale noting the uncertainty — it does not drop the verdict.

### Prompt Location

- **D-08:** Validator prompt lives inline in the Node.js orchestrator (same pattern as Phase 1 D-03 and Phase 2 D-08). No separate AGENTS.md or markdown agent file.

### Isolation Mechanism

- **D-09:** Isolation is enforced by what is NOT passed to the validator. The validator receives the structured `REVIEWER.md` output file (findings only), not any reviewer session context, chain-of-thought, or intermediate reasoning. This is mechanically enforced because the validator is a fresh `generateText` call with a prompt assembled from file content — the reviewer's in-memory reasoning never enters the validator's context.

### Empirical Independence Test

- **D-10:** Automated integration test in `validator.test.ts` (or equivalent). The test:
  1. Constructs a synthetic REVIEWER.md containing at least one deliberately absurd false-positive finding (e.g., flags a valid constant as a bug with no legitimate basis)
  2. Provides a "dumb" baseline mock that would confirm everything (to show what a non-adversarial pass-through would produce)
  3. Runs the validator with the real validator prompt against a mock LLM and asserts the output contains a `challenged` verdict for the injected finding
  The test demonstrates that the validator's prompt and pipeline — not just the LLM's general intelligence — are wired to challenge rather than rubber-stamp.

### the Agent's Discretion

- Exact `<verdict>` block field order within the XML
- Whether the validator includes a brief summary header ("Validator found N confirmed, M challenged, K escalated") at the top of VALIDATOR.md
- Wording of the validator system prompt (adversarial framing, how to instruct it to challenge aggressively)
- `parseValidatorOutput` function location (likely `pipeline-io.ts` alongside `parseReviewerOutput`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase planning files
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 3 covers PIPE-04 and PIPE-06
- `.planning/ROADMAP.md` — Phase 3 success criteria (4 items that must be TRUE)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Foundation decisions: hybrid architecture, XML-tagged files, inline prompts, finding ID scheme
- `.planning/phases/02-reviewer-agent/02-CONTEXT.md` — Reviewer decisions: REVIEWER.md format, dimension sections, focus suppression behavior

### Source files (read before planning)
- `src/schemas.ts` — `ValidationVerdictSchema` (findingId, verdict, rationale), `VerdictSchema` (confirmed/challenged/escalated), `ValidatorFileSchema`, `FindingSchema` — all already defined
- `src/reviewer.ts` — `runReviewer()` is the structural template for `runValidator()`: build prompt → generateText → write file → parse output → return result
- `src/pipeline-io.ts` — `parseReviewerOutput()` is the structural template for `parseValidatorOutput()`: regex-based extraction from XML-tagged blocks
- `src/index.ts` — Current pipeline entry point; validator is inserted between `runReviewer` (step 4) and the future `runWriter` (Phase 4)

### Research files
- `.planning/research/PITFALLS.md` — Pitfall 1 (validator contamination — critical), Pitfall 9 (writer finding loss — relevant to counter-finding surfacing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/schemas.ts` `ValidationVerdictSchema`: already defined with the correct shape — `runValidator()` should use this for output validation
- `src/schemas.ts` `VerdictSchema`: enum `confirmed | challenged | escalated` — validator prompt must use these exact strings
- `src/schemas.ts` `FindingSchema`: counter-findings inside `<verdict>` blocks follow the same shape (minus the id field) as reviewer findings
- `src/reviewer.ts` `runReviewer()`: direct structural template for `runValidator()` — same pattern, different prompt and output type
- `src/pipeline-io.ts` `parseReviewerOutput()`: structural template for `parseValidatorOutput()` — adapt regex for `<verdict>` blocks instead of `<finding>` blocks

### Established Patterns
- Single `generateText` call per agent — no streaming, no tool calls, maxOutputTokens: 8192
- Mock injection via `_mockGenerateText` optional parameter — same pattern in `runReviewer` should be replicated in `runValidator` for testability
- XML-tagged blocks with YAML-like key:value fields — established in INPUT.md, REVIEWER.md; continue in VALIDATOR.md
- Frontmatter with `reviewId` and `role` fields — validated by schema before writing

### Integration Points
- Input: `session.sessionDir/REVIEWER.md` (written by Phase 2 runReviewer) + `session.sessionDir/INPUT.md`
- Output: `session.sessionDir/VALIDATOR.md`
- Orchestrator hook: in `src/index.ts` `review-local` action, after `runReviewer()` returns, before future `runWriter()` call
- Findings with IDs: `runReviewer()` returns `findings: Finding[]` with IDs already assigned — validator uses these IDs as `findingId` in `<verdict>` blocks

</code_context>

<specifics>
## Specific Ideas

- The validator's adversarial framing should be explicit in the prompt: "Your job is to challenge, not rubber-stamp. Assume the reviewer may have made mistakes."
- Counter-findings inside challenged verdicts mirror `<finding>` block format exactly — planner should reuse the same parsing logic, not write a new one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-validator-agent*
*Context gathered: 2026-04-06*
