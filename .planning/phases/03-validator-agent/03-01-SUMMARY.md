---
phase: 03-validator-agent
plan: "01"
subsystem: pipeline
tags: [validator, adversarial, verdict, pipeline-io, zod, generateText]

requires:
  - phase: 02-reviewer-agent
    provides: runReviewer pattern — validator mirrors this structure exactly

provides:
  - parseValidatorOutput: parses <verdict> blocks from VALIDATOR.md into ValidationVerdict[]
  - ParsedValidatorOutput interface
  - runValidator: adversarial validator agent (mirrors runReviewer)
  - VALIDATOR_PROMPT: adversarial prompt with challenge framing and all three verdict types
  - buildValidatorPrompt: interpolates REVIEWER.md + INPUT.md content into VALIDATOR_PROMPT
  - ValidatorOptions / ValidatorResult interfaces
  - validator.test.ts with 6 tests (3 prompt + 1 buildPrompt + 2 runValidator)
  - 5 new parseValidatorOutput tests in pipeline-io.test.ts

affects:
  - 03-02 (Wave 2): wires runValidator into index.ts pipeline
  - 04-writer-agent: consumes VALIDATOR.md (counter-finding blocks in rawContent)

tech-stack:
  added: []
  patterns:
    - Validator mirrors reviewer structure exactly (same 6-step runValidator flow as runReviewer)
    - Counter-finding blocks stripped from verdict parsing but preserved in rawContent
    - _mockGenerateText override for LLM-free tests
    - parseVerdictBlock: strips <counter-finding> blocks before key:value parsing
    - findingid key remapped to findingId for ValidationVerdictSchema compatibility

key-files:
  created:
    - src/validator.ts
    - src/validator.test.ts
  modified:
    - src/pipeline-io.ts
    - src/pipeline-io.test.ts

key-decisions:
  - "Counter-finding blocks stripped from parseVerdictBlock but rawContent always includes them"
  - "findingid key parsed as lowercase then remapped to findingId before schema validation"
  - "VALIDATOR_PROMPT explicitly contains both 'challenge' and 'rubber-stamp' strings (Test 9 requirement met inline)"

patterns-established:
  - "Mirror reviewer pattern: parseValidatorOutput mirrors parseReviewerOutput; runValidator mirrors runReviewer"
  - "Block parser strips nested tags before key:value parsing — applied to both verdict and future blocks"

requirements-completed: [PIPE-04, PIPE-06]

duration: 20min
completed: 2026-04-06
---

# Phase 3, Plan 01: Validator Agent Core Summary

**Adversarial validator agent with `<verdict>` block parser — mirrors reviewer patterns exactly, counter-findings preserved in rawContent for Phase 4**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 2 (TDD)
- **Files modified:** 4

## Accomplishments
- `parseValidatorOutput` added to `pipeline-io.ts`: extracts `<verdict>` blocks via regex, validates via `ValidationVerdictSchema`, skips invalid with warning
- Counter-finding blocks stripped before key:value parsing but preserved in `rawContent` for Phase 4 Writer
- `runValidator` in `src/validator.ts`: reads REVIEWER.md + INPUT.md, calls generateText, writes VALIDATOR.md, parses verdicts, returns `ValidatorResult`
- `VALIDATOR_PROMPT` adversarially framed: "challenge not rubber-stamp", escalated = severity understated (D-02), counter-finding format embedded (D-03)
- All 11 tests pass (6 validator + 5 new pipeline-io); TypeScript compiles clean

## Task Commits

1. **Task 1+2: parseValidatorOutput + runValidator** - `4c142f4` (feat)

## Files Created/Modified
- `src/validator.ts` — VALIDATOR_PROMPT, buildValidatorPrompt, runValidator, ValidatorOptions, ValidatorResult
- `src/validator.test.ts` — 6 tests covering prompt framing, interpolation, mock integration
- `src/pipeline-io.ts` — parseValidatorOutput + ParsedValidatorOutput interface added
- `src/pipeline-io.test.ts` — 5 new parseValidatorOutput tests

## Decisions Made
- `findingid` (lowercase from key parser) remapped to `findingId` before `ValidationVerdictSchema.safeParse()` — avoids schema mismatch without changing parser internals
- Counter-finding stripping done via regex inside `parseVerdictBlock` before field extraction — simplest approach that preserves rawContent

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
- `SessionInfo` in tests was missing `slug` field (TypeScript compile error) — added `slug` to both test session fixtures.

## Next Phase Readiness
- `runValidator` ready to be wired into `src/index.ts` pipeline (Wave 2)
- `VALIDATOR.md` format established; Phase 4 Writer can consume it via `parseValidatorOutput`
- Counter-finding blocks preserved in `rawContent` — Phase 4 will extract them

---
*Phase: 03-validator-agent*
*Completed: 2026-04-06*
