# Phase 3: Validator Agent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-validator-agent
**Areas discussed:** Validator input, Escalated verdict semantics, Challenge depth and redirect behavior, Empirical isolation test design

---

## Validator Input

| Option | Description | Selected |
|--------|-------------|----------|
| Full diff — validator sees everything | Full INPUT.md including scope, focus, and complete diff. Can verify file/line references. | ✓ |
| Metadata only — scope + focus, no code | Only reads scope and focus, not the actual diff. Pure reasoning challenge. | |
| Targeted diff — only files referenced in findings | Trimmed diff per-finding. More complex to implement. | |

**User's choice:** Full diff — validator sees everything
**Notes:** Aligns with ROADMAP SC#1 ("receives INPUT.md + REVIEWER.md"). Enables the validator to verify evidence, not just challenge reasoning.

---

## Escalated Verdict Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Severity underrated — confirm + upgrade | Finding is real, but reviewer's severity is too low. | ✓ |
| Additional concern found — confirm + extend | Finding is real AND validator found more. | |
| Ambiguous — needs human judgment | Cannot determine without more context. | |
| Both: higher severity + possible addendum | Combines severity upgrade and extension. | |

**User's choice:** Severity underrated — confirm + upgrade
**Notes:** "Escalated" = "I agree this is a real issue, but it's more serious than the reviewer rated." Specific upgraded severity is left to Phase 4 Writer / user judgment — validator explains why in rationale but does not prescribe a new severity value.

---

## Challenge Depth and Redirect Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Binary — challenged means invalid, no redirect | Challenge = gone from report. Simple. | |
| Redirect allowed — challenge with counter-finding | Validator can redirect to the real issue. (Recommended) | ✓ |
| Reclassify — challenge means wrong category | Challenge reclassifies dimension/severity. | |

**User's choice:** Redirect allowed — challenge with counter-finding
**Notes:** Counter-finding format follow-up:

| Option | Description | Selected |
|--------|-------------|----------|
| Prose redirect — Writer handles the rest | Counter-finding as prose rationale only. | |
| Structured counter-finding block | Nested `<counter-finding>` inside `<verdict>` block, same schema as `<finding>`. | ✓ |
| Agent's discretion | | |

Counter-findings are structured blocks inside `<verdict>`, mirroring `<finding>` format (no id field). Phase 4 Writer surfaces them as validator-attributed findings.

---

## Empirical Isolation Test Design

| Option | Description | Selected |
|--------|-------------|----------|
| Automated test — inject false positive, assert challenged | Test in validator.test.ts. Injects bad finding, asserts challenged verdict. (Recommended) | ✓ |
| Manual test procedure — fixture + instructions | Fixture file + manual check. | |
| Design guarantee — enforced by prompt, not runtime test | No runtime test — AGENTS.md documents the guarantee. | |

**User's choice:** Automated test — inject false positive, assert challenged
**Notes:** Follow-up on test mechanics:

| Option | Description | Selected |
|--------|-------------|----------|
| Mock LLM confirms — test asserts real validator challenges | Baseline mock would confirm; real validator prompt challenges. | ✓ |
| Real LLM integration test — skipped by default | Real LLM call, slow, skipped by default. | |
| Mock validator challenges — test asserts parsing works | Tests pipeline plumbing only. | |

Test design: inject absurd false positive into synthetic REVIEWER.md, provide a "dumb" baseline mock that confirms everything, run validator with real prompt against mock LLM, assert `challenged` verdict for the injected finding.

---

## the Agent's Discretion

- Exact `<verdict>` block field order within XML
- Whether VALIDATOR.md includes a summary header (N confirmed, M challenged, K escalated)
- Validator system prompt wording (adversarial framing style)
- `parseValidatorOutput` function placement (likely `pipeline-io.ts`)

## Deferred Ideas

None — discussion stayed within phase scope.
