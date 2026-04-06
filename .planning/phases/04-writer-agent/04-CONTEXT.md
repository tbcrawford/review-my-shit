# Phase 4: Writer Agent - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a deterministic `runWriter` function that reads the structured outputs of `runReviewer` and `runValidator`, synthesizes them into a complete `REPORT.md` grouped by severity, and writes it to the session directory.

Requirements: PIPE-05, REPT-01, REPT-02, REPT-03, REPT-04
Success criteria: 5 items (severity order, required fields per finding, metadata header, full audit trail, completeness check)

This phase makes the pipeline user-visible for the first time: REPORT.md is the artifact users actually read.

</domain>

<decisions>
## Implementation Decisions

### Writer Architecture

- **D-01:** The Writer is a deterministic code function — NOT an LLM call. It reads the already-structured Finding objects and ValidationVerdict objects from the parsers (Phase 2 and Phase 3), assembles REPORT.md using a TypeScript template, and writes the file. No `generateText` call. This eliminates format drift, hallucination risk, and non-determinism. The data is already fully structured from prior pipeline steps.

### Challenged Finding Handling

- **D-02:** Challenged findings ARE included in REPORT.md, labeled with `> ⚠ Challenged by validator: <rationale>` (or equivalent text annotation). The user makes the final call — the report doesn't suppress reviewer findings, it surfaces the validator's dissent. This satisfies Pitfall 9 (no silent drops) and REPT-04 (full audit trail).

- **D-03:** Counter-findings inside challenged `<verdict>` blocks ARE surfaced as new separate findings in REPORT.md, attributed to the validator. The Writer parses `<counter-finding>` blocks from `parseValidatorOutput`'s `rawContent` (Phase 3 D-04 specified this). Counter-findings receive new IDs assigned by the orchestrator (same deterministic ID scheme). They appear under the correct severity section with a "Source: Validator (counter-finding)" attribution line.

### Escalated Severity Handling

- **D-04:** When the validator marks a finding as `escalated`, the Writer bumps the severity up one level automatically: `low→medium`, `medium→high`, `high→critical`. (There is no level above `critical` — an escalated `critical` stays `critical`.) The finding is annotated with `> ↑ Severity elevated by validator: <rationale>`. This is deterministic, requires no LLM judgment, and makes the escalation explicit to the user.

### Completeness Check

- **D-05:** After writing REPORT.md, the Writer reads it back and asserts that every finding ID from REVIEWER.md appears in the rendered output. If any ID is missing, the pipeline throws with a descriptive error (finding IDs listed). This is a hard failure — not a warning. The check runs before `runWriter` returns. Implementation follows the same safeParse validation pattern already established in pipeline-io.ts.

### Model Info in Metadata Header

- **D-06:** The `modelId` string (e.g., `gpt-4o`) is passed as a parameter to `runWriter` from `src/index.ts`. The `resolveModel()` function in `index.ts` already knows the model ID — it is passed through as a string alongside the model instance. This keeps `runWriter` free of environment variable coupling.

### Report Metadata Header (REPT-01)

- **D-07:** REPORT.md opens with a metadata header block containing:
  - `reviewId` — session ID
  - `timestamp` — review timestamp (from INPUT.md frontmatter)
  - `scope` — `local-diff` or `pr-diff`
  - `focus` — focus area if set, otherwise `none`
  - `model` — model ID string (from D-06)
  - `dimensionsCovered` — list of dimension abbreviations found in REVIEWER.md
  - `findingCount` — total findings in the report (reviewer findings + counter-findings, after challenge/escalation processing)

  The header is rendered as a Markdown YAML frontmatter block so it matches the `ReportFileSchema` already defined in `schemas.ts`, plus a human-readable summary section below it.

### Finding Sort Order (REPT-02)

- **D-08:** Findings are grouped and rendered in descending severity: `critical → high → medium → low → info`. Within each severity group, findings are sorted by dimension (alphabetical) then by file path. This is fully deterministic.

### Finding Fields (REPT-03)

- **D-09:** Each finding entry in REPORT.md contains exactly:
  - `[{ID}]` — the stable finding ID (preserved verbatim from reviewer, or newly assigned for counter-findings)
  - File path + line reference
  - Dimension label
  - Explanation
  - Suggestion
  - Validator annotation (if challenged or escalated — see D-02, D-03, D-04)
  - Source attribution (`Reviewer` or `Validator (counter-finding)`)

### Audit Trail (REPT-04)

- **D-10:** The `.reviews/<reviewId>/` directory already contains `REVIEWER.md` and `VALIDATOR.md` written by prior pipeline steps. `runWriter` adds `REPORT.md` to complete the trio. No additional files are written. The audit trail is complete by the end of `runWriter`.

### parseCounterFindings — New Parser Function

- **D-11:** A new `parseCounterFindings(rawContent: string): Array<Omit<Finding, 'id'>>` function is added to `pipeline-io.ts`. It extracts `<counter-finding>` blocks from the raw VALIDATOR.md content (already available as `rawContent` from `parseValidatorOutput`). This mirrors `parseFindingBlock` — same key:value field extraction, same `FindingSchema.omit({ id: true }).safeParse()` validation. Counter-findings that fail validation are skipped with a console warning.

### WriterOptions / WriterResult types

- **D-12:** `WriterOptions` includes: `session`, `findings` (Finding[] with IDs, from reviewer), `verdicts` (ValidationVerdict[], from validator), `validatorRawContent` (string, for counter-finding extraction), `inputMdContent` (string, for scope/focus/timestamp), `dimensionsCovered` (Dimension[], from reviewer), `modelId` (string). `WriterResult` includes: `reportMdPath`, `findingCount`, `counterFindingCount`.

### Agent's Discretion

- Exact Markdown heading levels and formatting within finding entries
- Whether to include a brief summary line ("N findings: X critical, Y high, ...") at top of REPORT.md body
- Exact wording of validator annotation labels (challenged / escalated annotations)
- Whether counter-findings are interleaved in the severity group or listed in a separate section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase planning files
- `.planning/REQUIREMENTS.md` — Phase 4 covers PIPE-05, REPT-01, REPT-02, REPT-03, REPT-04
- `.planning/ROADMAP.md` — Phase 4 success criteria (5 items)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Finding ID scheme (D-09 there), XML-tagged files
- `.planning/phases/02-reviewer-agent/02-CONTEXT.md` — REVIEWER.md format, dimension sections
- `.planning/phases/03-validator-agent/03-CONTEXT.md` — D-03 (counter-finding format), D-04 (writer surfaces them), D-07 (every finding gets a verdict)

### Source files (read before planning)
- `src/schemas.ts` — `ReportFileSchema`, `FindingSchema`, `ValidationVerdictSchema`, `SeveritySchema`, `DIMENSIONS` — all already defined
- `src/pipeline-io.ts` — `parseReviewerOutput`, `parseValidatorOutput`, `parseFindingBlock` (template for `parseCounterFindings`) — read before implementing
- `src/validator.ts` — structural template for `runWriter` shape (options interface, result interface)
- `src/index.ts` — current pipeline; `runWriter` is inserted at Step 6 after `runValidator`
- `src/finding-id.ts` — deterministic ID assignment; counter-findings need IDs assigned via same scheme

### Research files
- `.planning/research/PITFALLS.md` — Pitfall 9 (writer finding loss — critical), Pitfall 10 (format fragility)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline-io.ts` `parseFindingBlock` — direct template for `parseCounterFindings`; same field set (severity, file, line, dimension, explanation, suggestion)
- `src/pipeline-io.ts` `parseValidatorOutput` returns `rawContent` — already preserved specifically for Phase 4 counter-finding extraction
- `src/schemas.ts` `ReportFileSchema` — frontmatter already defined (reviewId, generated, findingCount); `generated` field = ISO timestamp
- `src/finding-id.ts` — ID assignment module; counter-findings must go through same ID assignment to maintain audit trail consistency
- `src/reviewer.ts` `runReviewer` / `src/validator.ts` `runValidator` — structural templates for `WriterOptions`, `WriterResult` interfaces

### Established Patterns
- No LLM call — `runWriter` is the first pipeline step that uses pure TypeScript template assembly
- Mock injection pattern (`_mock*`) not needed in `runWriter` since there's no LLM call to mock
- XML-tagged pipeline files already written; `runWriter` reads structured data from in-memory objects, not by re-reading files
- Schema validation before writing: validate `ReportFileSchema` on the frontmatter object before `writeFile`
- Finding IDs are already assigned by the time `runWriter` runs — reviewer findings have IDs; counter-findings need IDs assigned here

### Integration Points
- Input: `findings: Finding[]` (with IDs, from `runReviewer` result), `verdicts: ValidationVerdict[]` (from `runValidator` result), `validatorRawContent` (from `parseValidatorOutput`)
- Output: `session.sessionDir/REPORT.md`
- Orchestrator hook: in `src/index.ts` `review-local` action, after `runValidator()` returns
- `resolveModel()` already returns model — caller in `index.ts` passes modelId string alongside the model instance

</code_context>

<specifics>
## Specific Ideas

- The severity bump for escalated findings is a lookup table: `{ low: 'medium', medium: 'high', high: 'critical', critical: 'critical', info: 'low' }` — a single object, no conditionals
- Severity group order array: `['critical', 'high', 'medium', 'low', 'info'] as const` — used to sort findings before rendering
- Completeness check: after writing, read the file back, regex for all `[{DIM}-{NNNNN}]` patterns, assert all reviewer finding IDs appear — throw if any missing

</specifics>

<deferred>
## Deferred Ideas

- Executive summary paragraph (LLM-generated) — deferred to v2 or Phase 7; deterministic format is correct for Phase 4
- Severity threshold flag (`--min-severity`) — deferred to Phase 5 (Review Orchestration)
- Machine-readable sidecar (`report.json`) — deferred to v2; REPORT.md frontmatter covers tool-consumption needs

</deferred>

---

*Phase: 04-writer-agent*
*Context gathered: 2026-04-06*
