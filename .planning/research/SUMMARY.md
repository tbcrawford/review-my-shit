# Research Summary: review-my-shit (rms)

**Domain:** Local AI-powered code review tool — slash command-driven, three-agent pipeline
**Researched:** 2026-04-03
**Overall confidence:** HIGH — all major claims verified against official documentation, npm registry, and current practitioner sources (2026)

---

## Executive Summary

`rms` is a slash command tool for OpenCode and Cursor that routes code review through three fully isolated agents: a primary reviewer, an adversarial validator, and a synthesis writer. All intermediate outputs are persisted as Markdown files in `.reviews/`. A separate `/fix` command lets users selectively apply findings by ID after personal review.

The research confirmed that this design is genuinely differentiated. No existing tool (CodeRabbit, GitHub Copilot, Qodo, DeepSource, SonarQube, Greptile) uses a second agent that adversarially challenges the first's findings in isolation. Every current multi-agent system runs agents in parallel on dimensions — not sequentially in an adversarial check. The audit trail (role-specific intermediate files persisted to disk) is also unique: all existing tools are black boxes with no intermediate reasoning exposed.

The critical architectural decision — **Option A (pure prompt files) vs. Option B (hybrid Node.js orchestrator)** — remains open and must be resolved in Phase 1. Option A (pure prompts with OpenCode's `subtask: true`) has zero install overhead but weaker isolation guarantees. Option B (Node.js + Vercel AI SDK) has stronger guarantees but requires Node.js in PATH. The recommendation is to start with Option A and validate isolation before adding the Node.js layer.

The research surfaced 14 concrete pitfalls, five of which are critical rewrite risks. The most severe is **validator contamination via shared context** — if the validator receives the reviewer's reasoning (not just structured output), the entire adversarial value collapses silently. The second most severe is **prompt injection via code under review** — a confirmed real-world attack vector (RoguePilot, Cursor CVE patched Aug 2025). Both must be addressed in Phase 1 before any other work.

---

## Key Findings

**Stack:** Pure prompt files (`.opencode/commands/`, `.cursor/commands/`, `.agents/skills/`) with optional Node.js orchestration layer (Vercel AI SDK v6 + Zod + nanoid + simple-git + Commander.js) if prompt-only isolation proves insufficient.

**Architecture:** Linear pipeline — Entry Adapter → Reviewer → Validator → Writer — with file system as the only inter-agent communication channel. Fresh context window per agent is the isolation mechanism. Context is strictly additive: each downstream agent sees more files than its predecessor, never the predecessor's reasoning.

**Critical pitfall:** Validator contamination. If the validator sees the reviewer's chain-of-thought (even across session isolation), it anchors and confirms rather than challenges. This must be tested with deliberate false-positive injection before declaring the validation step functional.

---

## Implications for Roadmap

Based on research, the natural phase structure is:

### 1. Foundation — Schemas, Isolation, Entry Point

**What:** Define file schemas (INPUT.md, REVIEWER.md, VALIDATOR.md, REPORT.md). Implement `.reviews/<session>/` directory creation. Confirm slash command invocation works in both OpenCode and Cursor. Verify `subtask: true` isolation with a deliberate test.

**Why first:** Every downstream component depends on these schemas being locked. Agent isolation must be confirmed before building agents that depend on it. Slash command discovery failures (Pitfall 8 — chronic across OpenCode versions) must be caught before pipeline work begins.

**Addresses:** All schemas, PR diff fetch, local diff fetch, session naming, `.gitignore` for `.reviews/`

**Avoids:** ID instability (Pitfall 3), format fragility (Pitfall 10), slash command discovery failure (Pitfall 8)

---

### 2. Reviewer Agent

**What:** Define the `rms-reviewer` agent system prompt. Wire it to read `INPUT.md`, write structured `REVIEWER.md`. Implement diff preprocessing (strip binaries, lock files, annotate hunk headers). Test on known-bad code.

**Why second:** Reviewer is upstream of everything. Its output schema stability is a hard dependency for Validator and Writer. Diff preprocessing must happen here — it affects all downstream agents.

**Addresses:** 11-dimension coverage, severity calibration, prompt injection prevention (delimiters), chain-of-thought suppression, diff preprocessing

**Avoids:** Nitpick avalanche (Pitfall 4), line number hallucination (Pitfall 5), binary file contamination (Pitfall 7), scope creep into context lines (Pitfall 11), 11-dimension prompt overload (Pitfall 13)

---

### 3. Validator Agent

**What:** Define the `rms-validator` agent. Wire it to receive `INPUT.md` + `REVIEWER.md` (structured findings only — no reasoning). Write `VALIDATOR.md` with per-finding verdicts. Validate adversarial independence with injection test.

**Why third:** Depends on Reviewer output schema stability. Isolation must be confirmed empirically (not assumed) before Writer synthesis depends on meaningful validation.

**Addresses:** Adversarial challenge, per-finding verdict (confirmed/challenged/escalated), challenge rate measurement

**Avoids:** Context bleed (Pitfall 1 — the critical rewrite risk)

---

### 4. Writer Agent

**What:** Define the `rms-writer` agent. Wire it to synthesize all three inputs into a severity-grouped `REPORT.md`. Implement finding ID assignment and audit trail metadata. Verify no findings are dropped.

**Why fourth:** All upstream outputs must be schema-stable before synthesis is reliable. Writer is the noise gate — its synthesis quality determines what users actually see.

**Addresses:** Severity grouping, finding ID stability, audit trail, cross-finding relationships, writer completeness constraint

**Avoids:** Finding loss/downgrade (Pitfall 9), writer running before validator completes (Pitfall 5 in ARCHITECTURE.md), ID instability (Pitfall 3)

---

### 5. Review Orchestration (`/review` command)

**What:** Implement the full `/review` entry adapter. Parse scope (local diff vs PR diff), optional focus area. Create session folder. Write INPUT.md. Invoke Reviewer → Validator → Writer in sequence with file-existence verification between steps.

**Why fifth:** Requires all three agents to exist. Orchestration is wiring the pipeline together and handling error cases (empty diff, PR fetch failure, truncation warnings).

**Addresses:** Slash command invocation, scope selection, focus area routing, PR diff via GitHub CLI, large diff warnings, "Files Reviewed" metadata

**Avoids:** PR diff fetch failure with empty diff (Pitfall 11 in PITFALLS.md), stale diff (Pitfall 12), context exhaustion (Pitfall 6)

---

### 6. Fix Command (`/fix` command)

**What:** Implement the `/fix` command. Parse finding ID from args or fall back to interactive selection from REPORT.md. Show finding + suggestion before applying. Check for stale diff (file changed since review). Apply change with explicit confirmation.

**Why sixth:** Depends on REPORT.md schema (from Phase 4) and stable finding IDs (from Phase 4). Fully decoupled from the review pipeline at runtime.

**Addresses:** Fix-by-ID, interactive selection fallback, stale diff detection, confirmation before apply

**Avoids:** Auto-fix without confirmation (Pitfall 8 in FEATURES.md), stale diff race condition (Pitfall 12), line number errors requiring fuzzy matching (Pitfall 5)

---

### 7. Cross-Editor Validation + Hardening

**What:** Validate the pipeline end-to-end in both OpenCode and Cursor. Write AGENTS.md. Confirm isolation guarantees differ between editors and document this clearly. Add edge case handling (session reload after `/new`, version-specific command discovery issues).

**Addresses:** Cross-editor compatibility, AGENTS.md global context, edge case hardening, documentation

**Avoids:** AGENTS.md reload failure (Pitfall 14), Cursor's weaker isolation being mistaken for equivalent to OpenCode's

---

**Phase ordering rationale:**

The ordering is strictly dependency-driven:
- Schemas must exist before agents that read/write them
- Reviewer must be schema-stable before Validator depends on its output format
- Validator must produce meaningful verdicts before Writer synthesis is worth implementing
- All agents must exist before orchestration wires them together
- Orchestration must work before the fix command has a REPORT.md to read

**Research flags for phases:**

- **Phase 1 (Foundation):** Likely needs live testing of OpenCode `subtask: true` isolation — documentation says it should work, but only empirical testing with a deliberate validator-contamination test will confirm it. This is Phase 1's critical path item.
- **Phase 2 (Reviewer):** Prompt injection prevention (delimiter wrapping) should be validated with a live injection test. Diff preprocessing for lock files and binaries is mechanical but must be confirmed.
- **Phase 3 (Validator):** The adversarial independence test (inject a known-false finding, verify validator challenges it) is the entire success criterion for this phase. Don't declare it done until this passes.
- **Phases 4–6:** Standard patterns once schemas are stable. Unlikely to need deeper research.
- **Phase 7 (Cross-editor):** Cursor's isolation model differs from OpenCode's. The documentation is clear on this. Test both before declaring compatibility.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | OpenCode docs verified Apr 2, 2026; Cursor docs verified Apr 3, 2026; AI SDK v6 verified via Context7 + official docs |
| Features | HIGH | Market landscape sourced from 8 current articles (Feb–Mar 2026); competitive analysis cross-verified |
| Architecture | HIGH | Pipeline pattern verified against ASDLC.io + arXiv 2603.16107; OpenCode subagent isolation from official docs |
| Pitfalls | HIGH | All 14 pitfalls sourced from real GitHub issues, CVEs, peer-reviewed research, or official documentation |
| Cursor isolation model | MEDIUM | Documented clearly as prompt-discipline-based (not mechanically enforced like OpenCode's `subtask: true`); needs empirical testing |
| Option A vs B decision | MEDIUM | Recommendation to start with Option A is well-reasoned but the live isolation test will settle this definitively |

---

## Gaps to Address

1. **Option A vs B architectural decision** — Cannot be resolved until Phase 1 live testing confirms whether `subtask: true` in OpenCode actually isolates validator context. This is the single biggest open question.

2. **Cursor isolation strength** — The research is clear that Cursor's isolation is prompt-enforced (write file, read file in next phase), not mechanically enforced. Phase 7 must quantify how much weaker this is in practice and decide whether to document it as a limitation or mitigate it.

3. **Finding ID strategy under Option A** — If the pure-prompt path is taken (Option A), finding IDs are generated by the LLM following a schema. The PITFALLS.md research confirms LLM-generated UUIDs collide and are non-deterministic. A deterministic ID scheme must be designed that works without a Node.js process. One approach: the Writer generates IDs as `{review-date}-{sequential-counter}` — deterministic within a session, human-readable, and collision-free.

4. **Focus dimension routing depth** — The research confirms this is a valuable differentiator but the exact prompt engineering to make "focus: security" genuinely suppress style findings (not just de-emphasize them) needs testing. This is a Phase 2 concern, not a Phase 1 blocker.

5. **Cross-finding narrative (Writer stretch goal)** — Deferred from v1 per FEATURES.md. Phase 4 should design the writer prompt to make this addable later without a rewrite.
