# Phase 4: Writer Agent - Discussion Log

**Phase:** 04-writer-agent
**Discussion date:** 2026-04-06
**Mode:** discuss

---

## Gray Area 1: Challenged Finding Handling

**Question:** How should the Writer handle a 'challenged' finding?

**User decision:** Include + surface counter-findings

**Rationale recorded:** Maximum transparency. Challenged findings appear in REPORT.md labeled as challenged, and any counter-findings from the validator are surfaced as new separate findings attributed to the validator. Satisfies Pitfall 9 (no silent drops) and REPT-04 (full audit trail). Matches Phase 3 D-04 which specified Phase 4 is responsible for counter-finding surfacing.

**Decision recorded as:** D-02, D-03 in 04-CONTEXT.md

---

## Gray Area 2: Escalated Severity

**Question:** When the validator escalates a finding, which severity goes in the report?

**User decision:** Bump up one level + note

**Rationale recorded:** Deterministic: `low→medium`, `medium→high`, `high→critical`. Annotated with validator rationale. No LLM judgment step. Consistent with Phase 3 D-02 (validator does not prescribe a new severity value — the Writer applies the deterministic bump).

**Decision recorded as:** D-04 in 04-CONTEXT.md

---

## Gray Area 3: Completeness Check Strictness

**Question:** How strict should the completeness check be?

**User decision:** Assertion in code + fail pipeline

**Rationale recorded:** Hard assertion: after writing REPORT.md, parse it and assert every reviewer finding ID appears. If any is missing, throw with the missing IDs listed. Non-negotiable for audit trail integrity.

**Decision recorded as:** D-05 in 04-CONTEXT.md

---

## Gray Area 4: Model Info Source

**Question:** Where does model info come from for the metadata header?

**User decision:** Pass model ID string to runWriter

**Rationale recorded:** `resolveModel()` in index.ts already knows the model ID; pass it as a string parameter to `runWriter`. Keeps writer decoupled from environment variable details.

**Decision recorded as:** D-06 in 04-CONTEXT.md

---

## Gray Area 5: Writer Implementation Style

**Question:** LLM agent call vs. deterministic code?

**User decision:** Deterministic code only

**Rationale recorded:** Data is already fully structured from Phase 2/3 parsers. No LLM call needed. Eliminates format drift, hallucination, and non-determinism. Faster, fully testable without mocks.

**Decision recorded as:** D-01 in 04-CONTEXT.md

---

*Discussion log created: 2026-04-06*
