# arch-dimension — Research

**Researched:** 2026-04-09
**Domain:** rms pipeline dimension system — adding ARCH2 (architectural design / API design / SRP)
**Confidence:** HIGH — all findings from direct codebase inspection; no external tools required

---

## Summary

The rms pipeline currently reviews code across **11 dimensions** defined in a single source-of-truth constant (`DIMENSIONS` in `src/schemas.ts`). The existing `ARCH` dimension covers circular dependencies, wrong abstraction layers, tight coupling, and violations of existing patterns — **SRP is not explicitly listed** in its definition, though it could loosely fall under "tight coupling." The existing `API` dimension covers breaking changes to public interfaces, inconsistent signatures, and missing parameter validation — but it does NOT cover architectural API *design* concerns (library API ergonomics, CLI command/subcommand/flag design, REST/GraphQL/gRPC design patterns).

The request asks for a new dimension that covers: (1) architectural API design for all interface types (library, CLI, REST, GraphQL, gRPC), and (2) SRP. Neither concern is explicitly addressed by any current dimension. The `ARCH` definition is scoped to structural concerns (dependencies, abstraction layers, coupling), and `API` is scoped to interface contract correctness — neither covers *design quality* of APIs.

The cleanest solution is to add a **12th dimension** with a new abbreviation (e.g., `DSGN`) rather than mutating the definitions of `ARCH` or `API`. Every place that references dimensions must be updated in a coordinated way.

**Primary recommendation:** Add `DSGN` (Design) as the 12th dimension. Update `DIMENSIONS` in `schemas.ts`, the reviewer prompt in `reviewer.ts`, and update tests that hardcode dimension counts or lists. The validator and writer require no prompt changes since they are dimension-agnostic.

---

## Dimension System: Complete Technical Map

### Where DIMENSIONS Is Defined

**Single source of truth:** `src/schemas.ts`, lines 11–23.

```typescript
// src/schemas.ts
export const DIMENSIONS = [
  'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
  'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export const DimensionSchema = z.enum(DIMENSIONS);
```

`DimensionSchema` is used to validate `dimension` fields in `FindingSchema`. Any abbreviation not in `DIMENSIONS` will be **rejected by Zod** and the finding will be skipped with a console warning (`[rms] Skipping invalid finding`).

### Re-exports

`src/finding-id.ts` re-exports `DIMENSIONS` as `DIMENSION_ABBREV` for consumers that don't need the full schemas module:

```typescript
export const DIMENSION_ABBREV = DIMENSIONS;
```

---

## The 11 Existing Dimensions (Verbatim from `reviewer.ts`)

From `REVIEWER_PROMPT` in `src/reviewer.ts`, lines 37–47:

| Abbrev | Definition |
|--------|------------|
| BUG    | Logic errors, incorrect conditions, off-by-one errors, null dereferences, race conditions |
| SEC    | Injection vulnerabilities, hardcoded secrets, insecure defaults, authentication bypasses, data exposure |
| PERF   | Unnecessary loops, missing indexes, N+1 queries, memory leaks, synchronous blocking in async paths |
| STYL   | Naming inconsistencies, formatting violations, dead code, commented-out code, magic numbers |
| TEST   | Missing test coverage for changed code, untested edge cases, brittle assertions, no error path tests |
| ARCH   | Circular dependencies, wrong abstraction layers, tight coupling, violations of existing patterns |
| ERR    | Swallowed exceptions, missing error propagation, no retry logic, silent failures |
| DATA   | Missing validation, type coercion bugs, unsafe deserialization, schema violations |
| API    | Breaking changes to public interfaces, inconsistent signatures, missing parameter validation |
| DEP    | Outdated or vulnerable dependencies, pinned versions, implicit platform assumptions |
| DOC    | Misleading comments, missing docs for exported symbols, incorrect examples, stale docstrings |

**SRP coverage analysis:**
- `ARCH` mentions "tight coupling" — SRP violations often manifest as high coupling, so there is a tangential relationship. However, SRP is not named, and a reviewer following only the listed items would not be prompted to look for it.
- No existing dimension explicitly asks for SRP checks.
- **Conclusion:** SRP is NOT covered by any current dimension definition.

**API design coverage analysis:**
- `API` covers *interface contract correctness* (breaking changes, parameter validation) — not design quality.
- No existing dimension asks: "Is this CLI flag named well? Is this REST route structured idiomatically? Is this library API ergonomic?"
- **Conclusion:** Architectural API design is NOT covered by any current dimension definition.

---

## Where Dimensions Must Be Updated

### 1. `src/schemas.ts` — The DIMENSIONS Array (REQUIRED)

**File:** `src/schemas.ts`, lines 11–23  
**Change:** Add new abbreviation to the `DIMENSIONS` const array.  
**Impact:** `DimensionSchema` (used by `FindingSchema`) auto-updates via `z.enum(DIMENSIONS)`. No other schema changes needed.

```typescript
// After change:
export const DIMENSIONS = [
  'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
  'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
  'DSGN',  // ← new
] as const;
```

### 2. `src/reviewer.ts` — REVIEWER_PROMPT (REQUIRED)

**File:** `src/reviewer.ts`, lines 37–70  
**Two locations require changes:**

**Location A — DIMENSION DEFINITIONS block (lines 37–47):** Add a new bullet for the new dimension.

```
- DSGN: Poor API design (library API ergonomics, CLI flag/subcommand design, REST/GraphQL/gRPC interface design), violation of Single Responsibility Principle
```

**Location B — RULES block, dimension enum (line 69):**
```
- dimension must be one of: BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC, DSGN
```

**Location C — "All 11 dimension headers must be present" (line 67):** Update count from 11 to 12.

**The RULES block also controls focus mode** (line 89 in `buildReviewerPrompt`): the focus suppression text is generated dynamically from the `focus` option string, not from a hardcoded list — no change needed there.

### 3. `src/reviewer.ts` — Jsdoc/comments (OPTIONAL but consistent)

**File:** `src/reviewer.ts`, line 6: `Builds an 11-dimension review prompt` — update to 12.  
**File:** `src/reviewer.ts`, line 22: `Reviewer prompt (language agnostic, 11-dimension)` — update to 12.

### 4. `src/schemas.ts` — Jsdoc comment (OPTIONAL but consistent)

**File:** `src/schemas.ts`, line 8–9: `All 11 review dimension abbreviations` — update to 12.

### 5. `README.md` — Documentation (REQUIRED for user-facing accuracy)

**File:** `README.md`, lines 135–148:
- Line 135: "The reviewer analyzes code across 11 dimensions" → 12
- Add item 12 to the numbered list

### 6. `AGENTS.md` — Pipeline overview (REQUIRED for agent accuracy)

**File:** `AGENTS.md`, line 17: "Analyzes the diff across 11 dimensions" → 12.

---

## Where Dimensions Are NOT Mentioned (No Changes Needed)

### Validator (`src/validator.ts`)
The validator prompt (`VALIDATOR_PROMPT`) is **dimension-agnostic**. It evaluates findings by ID and diff evidence — it never enumerates dimensions. It also uses `dimension: {DIMENSION}` in the counter-finding block template but accepts any dimension string (no hardcoded list). **No changes needed.** [VERIFIED: full file read]

### Writer (`src/writer.ts`)
The writer is **fully deterministic** — it reads findings with their dimension field already validated by Zod at parse time. Sorting is by severity → dimension → file. Rendering uses `f.dimension` directly. **No changes needed.** [VERIFIED: full file read]

### Pipeline I/O (`src/pipeline-io.ts`)
`parseReviewerOutput` uses `DIMENSIONS` (imported from `schemas.ts`) to validate dimension section headers. Since it imports the constant, adding to `DIMENSIONS` automatically enables parsing the new dimension header. **No direct changes needed** — the import gives it automatically. [VERIFIED: lines 296–305]

### Fixer (`src/fixer.ts`)
The fixer parses findings from REPORT.md using text patterns, not the `DIMENSIONS` constant. It does not enumerate dimensions. **No changes needed.** [VERIFIED: source read]

### Index/CLI (`src/index.ts`)
The CLI orchestrator passes dimensions through but never enumerates them itself. **No changes needed.** [VERIFIED: full file read]

### Templates (`src/templates/`)
The OpenCode and Cursor command templates (`opencode-review.md`, `cursor-rms-review/SKILL.md`, etc.) do not reference dimension names. **No changes needed.** [VERIFIED: all templates read]

---

## Tests That Must Be Updated

### `src/schemas.test.ts`

**Line 14–19:** `has all 11 abbreviations` test hardcodes the exact array:
```typescript
test('has all 11 abbreviations', () => {
  expect(DIMENSIONS).toEqual([
    'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
    'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
  ]);
});
```
**Required change:** Add `'DSGN'` to the expected array, update test name to "12 abbreviations".

### `src/finding-id.test.ts`

**Line 20:** `expect(DIMENSION_ABBREV.length).toBe(11)` — must change to 12.

### `src/reviewer.test.ts`

**Lines 34–42:** `contains all 11 dimension names in DIMENSION DEFINITIONS` — the test iterates a hardcoded array:
```typescript
const dimensions = ['BUG', 'SEC', 'PERF', 'STYL', 'TEST', 'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC'];
```
**Required change:** Add `'DSGN'` to the array, update test name to "12 dimension names".

**Line 69 (in RULES):** The validator prompt check looks for `dimension must be one of:` — this test checks the reviewer prompt contains all dimensions in its rules section. The test at line 69 checks for "Do NOT generate" / "leave the id field absent" — this is fine. However, the REVIEWER_PROMPT `RULES` block explicitly lists all valid dimension abbreviations (line 69 of reviewer.ts); this is part of the static prompt that the test at line 34 exercises. Adding `DSGN` to the `DIMENSION DEFINITIONS` block and the `RULES` enum is sufficient.

### `src/pipeline-io.test.ts`

**Line 256:** `expect(result.dimensionsCovered.length).toBe(11)` — the fixture REVIEWER.md has exactly 11 `## DIMENSION` headers. **Required change:** Either add a `## DSGN` header to the fixture (making it 12) or update the count assertion. The fixture must also include `No DSGN issues found.` if 12 headers are expected.

**Fixtures (in-file string constants):** The test fixtures `fixtureReviewerWithFindings` and `fixtureReviewerWithInvalidFinding` both explicitly list all 11 dimension section headers (`## BUG`, `## SEC`, etc.) — a 12th `## DSGN` section must be added to each fixture for tests that assert `dimensionsCovered.length === 11` (now 12).

### `src/reviewer.test.ts` — fixture

**Lines 108–159:** `fixtureReviewerMdContent` lists all 11 dimension section headers. The test at line 162 tests that runReviewer works end-to-end. This fixture must gain a `## DSGN\nNo DSGN issues found.\n` section for consistency, though the runReviewer tests don't assert on `dimensionsCovered.length` directly.

---

## Proposed New Dimension: DSGN

### Abbreviation Choice

**Recommended: `DSGN`** (4 chars, unambiguous, readable)

Alternatives considered:
- `ADES` — API Design, too narrow (excludes SRP for non-API code)
- `ARCH2` — confusing alongside existing `ARCH`
- `IFCE` — Interface, less intuitive
- `DSGN` — Design, broad enough to cover API design AND SRP, distinguishable from `DOC`, `DATA`, `DEP`

### Proposed Definition (for REVIEWER_PROMPT)

```
- DSGN: Poor API design (unintuitive library interfaces, CLI flag/subcommand inconsistencies, REST/GraphQL/gRPC anti-patterns), violation of Single Responsibility Principle (classes/functions/modules doing more than one thing)
```

**What it covers:**
- Library API ergonomics (naming, parameter order, return types, composability)
- CLI design (unclear flag names, inconsistent subcommand structure, missing help text in code)
- REST API design (wrong HTTP methods, non-RESTful resource naming, over/under-nested routes)
- GraphQL design (N+1-prone schema shape, inappropriate query/mutation split)
- gRPC design (service boundary violations, streaming vs unary misuse)
- SRP: a class, function, or module with multiple distinct responsibilities
- God objects / monolithic modules
- Leaky abstractions

**What it does NOT cover (boundaries with existing dimensions):**
- Breaking changes to existing interfaces → `API`
- Circular dependencies → `ARCH`
- Missing parameter validation at runtime → `DATA`
- Missing docs on the API → `DOC`

---

## Change Surface: Full Impact List

| File | Change Type | Detail |
|------|-------------|--------|
| `src/schemas.ts` | **Add** `'DSGN'` to `DIMENSIONS` array | Line 23 |
| `src/schemas.ts` | Update JSDoc count 11→12 | Line 8 |
| `src/reviewer.ts` | **Add** `- DSGN: ...` to `DIMENSION DEFINITIONS` block | After `DOC` line |
| `src/reviewer.ts` | **Update** `RULES` dimension enum to include `DSGN` | Line 69 |
| `src/reviewer.ts` | Update count in comment "11-dimension" → "12-dimension" | Lines 6, 22 |
| `src/reviewer.ts` | Update "All 11 dimension headers" → "All 12" | Line 67 |
| `src/schemas.test.ts` | Update `DIMENSIONS` array assertion + test name | Lines 14–19 |
| `src/finding-id.test.ts` | Update `.length` assertion 11→12 | Line 20 |
| `src/reviewer.test.ts` | Add `'DSGN'` to hardcoded dimensions array in test | Line 36 |
| `src/reviewer.test.ts` | Add `## DSGN` section to `fixtureReviewerMdContent` | After `## DOC` |
| `src/pipeline-io.test.ts` | Add `## DSGN` to both REVIEWER fixtures + update `dimensionsCovered.length` 11→12 | Lines 156–158, 208–210, 256 |
| `README.md` | Update "11 dimensions" → "12", add item 12 to list | Lines 135–148 |
| `AGENTS.md` | Update "11 dimensions" → "12" in pipeline overview | Line 17 |

**No changes needed in:** `validator.ts`, `writer.ts`, `pipeline-io.ts` (runtime), `fixer.ts`, `index.ts`, `session.ts`, `config.ts`, `diff-preprocessor.ts`, any template files.

---

## Architecture Patterns

### How a Dimension Entry Works End-to-End

```
schemas.ts DIMENSIONS array
    │
    ├─→ DimensionSchema (z.enum) — validates finding.dimension at parse time
    │       Used in: FindingSchema, parseReviewerOutput, parseCounterFindings
    │
    ├─→ DIMENSION_ABBREV (re-export in finding-id.ts)
    │       Used in: finding-id tests (length assertion)
    │
    └─→ Imported by pipeline-io.ts for dimension header detection
            Regex: /^## ([A-Z]+)$/gm → validated against DIMENSIONS

reviewer.ts REVIEWER_PROMPT
    ├─→ DIMENSION DEFINITIONS block — LLM uses these to categorize findings
    └─→ RULES block — LLM is told which abbreviations are valid
```

### Dimension Header Detection in REVIEWER.md

`parseReviewerOutput` (pipeline-io.ts:298–305) scans for `## {UPPERCASE}` headers and cross-checks against `DIMENSIONS`:

```typescript
const dimensionHeaderRegex = /^## ([A-Z]+)$/gm;
// ...
if ((DIMENSIONS as readonly string[]).includes(dim) && !dimensionsCovered.includes(dim as Dimension)) {
  dimensionsCovered.push(dim as Dimension);
}
```

**Implication:** Adding `DSGN` to `DIMENSIONS` automatically allows the parser to recognize `## DSGN` in REVIEWER.md output. The LLM will only write it if instructed via the prompt.

### Finding Validation Path

```
LLM writes <finding>...</finding>
    │
parseFindingBlock() — extracts key:value pairs
    │
FindingSchema.omit({ id: true }).safeParse(parsed)
    │   └─ dimension: DimensionSchema = z.enum(DIMENSIONS)
    │        ← DSGN will be REJECTED until schemas.ts is updated
    │
If invalid → console.warn + skip
If valid → finding added to results
```

**Critical:** `schemas.ts` MUST be updated before the reviewer can emit valid DSGN findings. If only the prompt is updated and schemas.ts is not, every DSGN finding will be silently dropped.

---

## Common Pitfalls

### Pitfall 1: Updating Prompt But Not Schema
**What goes wrong:** The reviewer prompt lists DSGN as a valid dimension, the LLM writes `<finding>dimension: DSGN</finding>`, but `DimensionSchema` rejects it because `DSGN` is not in the `z.enum`. The finding is silently dropped with `[rms] Skipping invalid finding`.
**Prevention:** Always update `schemas.ts` FIRST, before changing the reviewer prompt.

### Pitfall 2: Missing Fixture Headers in Tests
**What goes wrong:** `parseReviewerOutput` tests assert `dimensionsCovered.length === 11`. After adding DSGN to DIMENSIONS, a fixture that only has 11 headers will correctly parse as 11 covered — but any test asserting 11 will still pass. The dimension count test in `schemas.test.ts` WILL fail, surfacing the mismatch.
**Prevention:** Add `## DSGN\nNo DSGN issues found.\n` to every in-file fixture that enumerates all headers.

### Pitfall 3: DSGN Overlapping with ARCH or API
**What goes wrong:** The definition is too broad and reviewers flag things that already belong to ARCH (circular dependencies) or API (breaking changes).
**Prevention:** The definition explicitly scopes DSGN to *design quality* decisions, not structural violations (ARCH) or contract correctness (API). Include explicit boundary notes in the prompt definition.

### Pitfall 4: Forgetting to Update the RULES Enum in REVIEWER_PROMPT
**What goes wrong:** The reviewer writes DSGN findings but the RULES block says `dimension must be one of: BUG, ..., DOC` — the LLM may self-correct to one of the listed dimensions or produce malformed output.
**Prevention:** The RULES block `dimension must be one of:` line must be updated simultaneously with the DIMENSION DEFINITIONS block.

---

## Pre-existing Failing Tests (Not Related to This Work)

The test suite currently has **2 failing tests** in `src/setup.test.ts` — both in the `BANNER_STRING` describe block. They fail because the banner renders `Review My Shit` (mixed case) but the tests check for `review-my-shit` (lowercase). This is a pre-existing issue unrelated to dimension additions. The implementation plan should note these 2 failures as pre-existing and not regressions.

**Baseline:** 169 passing, 2 failing (setup.test.ts banner tests).  
**After implementation:** All 169 passing should still pass; updated tests should pass; the 2 setup.test.ts failures are pre-existing and unchanged.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.3 |
| Config file | `vitest.config.ts` |
| Quick run | `just test` |
| Full suite | `just test` |

### Dimension-Related Tests: Before/After Map

| Test File | Test | Current State | After Adding DSGN |
|-----------|------|---------------|-------------------|
| `schemas.test.ts:14` | `has all 11 abbreviations` | PASSES | MUST UPDATE: add `'DSGN'`, rename "12 abbreviations" |
| `finding-id.test.ts:20` | `DIMENSION_ABBREV.length === 11` | PASSES | MUST UPDATE: `=== 12` |
| `reviewer.test.ts:34` | `contains all 11 dimension names` | PASSES | MUST UPDATE: add `'DSGN'` to array, rename "12 dimension names" |
| `pipeline-io.test.ts:256` | `dimensionsCovered.length === 11` | PASSES | MUST UPDATE: fixtures + assertion → 12 |

### Wave 0 Gaps (New Tests to Write)

No new test files needed — the changes are updates to existing tests. However, the implementation should verify:
- [ ] A DSGN finding in a reviewer fixture is parsed and not rejected
- [ ] A counter-finding with `dimension: DSGN` is accepted by the validator parser

---

## Environment Availability

Step 2.6: No external dependencies — this is a pure code/schema/prompt change. No tools, services, or runtimes beyond the project's own build chain are needed.

---

## Sources

### Primary (HIGH confidence — all verified by direct codebase read)
- `src/schemas.ts` — DIMENSIONS array, DimensionSchema, FindingSchema [VERIFIED]
- `src/reviewer.ts` — REVIEWER_PROMPT full text, buildReviewerPrompt [VERIFIED]
- `src/validator.ts` — VALIDATOR_PROMPT full text — confirmed dimension-agnostic [VERIFIED]
- `src/writer.ts` — full writer logic — confirmed no dimension enumeration [VERIFIED]
- `src/pipeline-io.ts` — parseReviewerOutput dimension detection regex [VERIFIED]
- `src/finding-id.ts` — DIMENSION_ABBREV re-export [VERIFIED]
- `src/schemas.test.ts` — dimension count assertions [VERIFIED]
- `src/finding-id.test.ts` — length assertion [VERIFIED]
- `src/reviewer.test.ts` — dimension list in test + fixtures [VERIFIED]
- `src/pipeline-io.test.ts` — dimensionsCovered assertions + fixtures [VERIFIED]
- `README.md` — dimension count and list [VERIFIED]
- `AGENTS.md` — dimension count in pipeline overview [VERIFIED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DSGN` is the best abbreviation choice | Proposed New Dimension | Low — any 3-5 char uppercase abbreviation works; planner can choose differently |
| A2 | SRP and API design should be in the same new dimension rather than two separate dimensions | Summary | Medium — the user may want them split; the plan should offer this as a decision point |

**Note:** A2 is worth flagging to the planner. An alternative design is `DSGN` for API/interface design only and adding SRP to `ARCH` (since SRP relates to structural concerns). The user's request groups them together; this research follows that grouping.

---

## Open Questions

1. **One dimension or two?**
   - What we know: The user asked for "architectural design including API design... and SRP if not already covered."
   - What's unclear: Whether a single `DSGN` dimension is preferred vs. adding SRP to `ARCH` and creating `DSGN` only for API design.
   - Recommendation: Default to single `DSGN` as requested; confirm with user if planner wants explicit approval.

2. **Abbreviation: DSGN vs alternatives**
   - What we know: Any abbreviation not in the current DIMENSIONS array works.
   - What's unclear: User preference for abbreviation style.
   - Recommendation: Use `DSGN` — four letters like most existing abbreviations, unambiguous.

3. **Finding ID format**
   - Confirmed non-issue: `nextFindingId` produces `DSGN-00001` format automatically — no code changes needed in `finding-id.ts`.

---

## Metadata

**Confidence breakdown:**
- Change surface (what to edit): HIGH — all file locations confirmed by read
- Test locations: HIGH — all test assertions located precisely
- Dimension definition quality: MEDIUM — the exact wording is a recommendation; the planner/user may refine
- Abbreviation choice: MEDIUM — DSGN is well-reasoned but not the only valid choice

**Research date:** 2026-04-09
**Valid until:** This research reflects the current codebase state; valid until any of the source files change.
