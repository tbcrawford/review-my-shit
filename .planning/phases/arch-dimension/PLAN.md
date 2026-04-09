---
phase: arch-dimension
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/schemas.ts
  - src/reviewer.ts
  - src/schemas.test.ts
  - src/finding-id.test.ts
  - src/reviewer.test.ts
  - src/pipeline-io.test.ts
  - README.md
  - AGENTS.md
autonomous: true
requirements:
  - DSGN-01
must_haves:
  truths:
    - "DSGN is a valid dimension abbreviation — Zod accepts it in FindingSchema"
    - "The reviewer prompt instructs the LLM to use DSGN for API design and SRP findings"
    - "The reviewer prompt RULES block lists DSGN as a valid dimension"
    - "All 4 test files pass with updated dimension counts (11→12) and fixture headers"
    - "README and AGENTS.md reflect 12 dimensions"
  artifacts:
    - path: "src/schemas.ts"
      provides: "DIMENSIONS array with 12 entries including DSGN"
      contains: "'DSGN'"
    - path: "src/reviewer.ts"
      provides: "REVIEWER_PROMPT with DSGN in DIMENSION DEFINITIONS and RULES blocks"
      contains: "- DSGN:"
    - path: "src/schemas.test.ts"
      provides: "Updated dimension count test asserting 12 abbreviations"
    - path: "src/finding-id.test.ts"
      provides: "Updated length assertion: .toBe(12)"
    - path: "src/reviewer.test.ts"
      provides: "Updated dimension array with DSGN + DSGN fixture section"
    - path: "src/pipeline-io.test.ts"
      provides: "Updated fixtures with ## DSGN header + dimensionsCovered.length === 12"
  key_links:
    - from: "src/schemas.ts DIMENSIONS"
      to: "DimensionSchema (z.enum)"
      via: "as const → z.enum(DIMENSIONS)"
      pattern: "DSGN.*as const"
    - from: "src/reviewer.ts REVIEWER_PROMPT"
      to: "LLM categorization"
      via: "DIMENSION DEFINITIONS bullet list"
      pattern: "- DSGN:"
    - from: "src/reviewer.ts RULES block"
      to: "LLM dimension validation"
      via: "dimension must be one of:"
      pattern: "DOC, DSGN"
---

<objective>
Add `DSGN` as the 12th review dimension to the rms pipeline. DSGN covers API design quality
(library ergonomics, CLI flag/subcommand design, REST/GraphQL/gRPC interface idioms) and
Single Responsibility Principle violations — neither of which is covered by any existing dimension.

Purpose: Enable the reviewer agent to surface design-quality issues that currently fall through
the cracks between ARCH (structural coupling) and API (contract correctness).

Output: Updated schema, reviewer prompt, 4 test files, README, and AGENTS.md. The pipeline
immediately recognizes DSGN findings; no validator or writer changes needed.
</objective>

<execution_context>
Working directory: /Users/tylercrawford/dev/github/review-my-shit
Build command: just assemble
Test command: just test
Pre-existing failures: 2 tests in src/setup.test.ts (BANNER_STRING — unrelated to this work).
Baseline: 169 passing, 2 failing. Target after this plan: same 2 failing, all others passing.
</execution_context>

<context>
@src/schemas.ts
@src/reviewer.ts
@src/schemas.test.ts
@src/finding-id.test.ts
@src/reviewer.test.ts
@src/pipeline-io.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/schemas.ts (lines 11–23) — current DIMENSIONS array:
```typescript
export const DIMENSIONS = [
  'BUG',
  'SEC',
  'PERF',
  'STYL',
  'TEST',
  'ARCH',
  'ERR',
  'DATA',
  'API',
  'DEP',
  'DOC',
] as const;
```
After adding DSGN, `DimensionSchema = z.enum(DIMENSIONS)` auto-updates — no other schema changes needed.

From src/reviewer.ts (lines 36–47) — current DIMENSION DEFINITIONS block in REVIEWER_PROMPT:
```
DIMENSION DEFINITIONS:
- BUG: Logic errors, incorrect conditions, off-by-one errors, null dereferences, race conditions
- SEC: Injection vulnerabilities, hardcoded secrets, insecure defaults, authentication bypasses, data exposure
- PERF: Unnecessary loops, missing indexes, N+1 queries, memory leaks, synchronous blocking in async paths
- STYL: Naming inconsistencies, formatting violations, dead code, commented-out code, magic numbers
- TEST: Missing test coverage for changed code, untested edge cases, brittle assertions, no error path tests
- ARCH: Circular dependencies, wrong abstraction layers, tight coupling, violations of existing patterns
- ERR: Swallowed exceptions, missing error propagation, no retry logic, silent failures
- DATA: Missing validation, type coercion bugs, unsafe deserialization, schema violations
- API: Breaking changes to public interfaces, inconsistent signatures, missing parameter validation
- DEP: Outdated or vulnerable dependencies, pinned versions, implicit platform assumptions
- DOC: Misleading comments, missing docs for exported symbols, incorrect examples, stale docstrings
```

From src/reviewer.ts (lines 63–70) — current RULES block (end of REVIEWER_PROMPT):
```
RULES:
- Do NOT generate IDs — leave the id field absent from <finding> blocks
- Do NOT include analysis prose, reasoning steps, or chain-of-thought outside explanation/suggestion
- Every finding must have all 6 fields: severity, file, line, dimension, explanation, suggestion
- All 11 dimension headers must be present in the output, even if no issues found
- severity must be one of: critical, high, medium, low, info
- dimension must be one of: BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC
- Be language agnostic — do not assume any specific stack, framework, or toolchain
```

CRITICAL ordering: schemas.ts MUST be updated before reviewer.ts. If only the prompt is updated
and schemas.ts is not, every DSGN finding will be silently dropped by Zod validation.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add DSGN to DIMENSIONS array and update reviewer prompt</name>
  <files>src/schemas.ts, src/reviewer.ts</files>
  <behavior>
    - Test 1 (schemas.test.ts:14): DIMENSIONS array has exactly 12 entries including 'DSGN'
    - Test 2 (finding-id.test.ts:20): DIMENSION_ABBREV.length === 12
    - Test 3 (reviewer.test.ts:34): prompt includes `- DSGN:` in DIMENSION DEFINITIONS
    - Test 4 (reviewer.test.ts): prompt includes 'DSGN' in `dimension must be one of:` RULES line
  </behavior>
  <action>
**Step A — src/schemas.ts** (do this FIRST before touching reviewer.ts):

1. Update JSDoc comment at line 7–9:
   - Change: `All 11 review dimension abbreviations.`
   - To: `All 12 review dimension abbreviations.`

2. Add `'DSGN'` to the DIMENSIONS array after `'DOC'` (line 22):
   ```typescript
   export const DIMENSIONS = [
     'BUG',
     'SEC',
     'PERF',
     'STYL',
     'TEST',
     'ARCH',
     'ERR',
     'DATA',
     'API',
     'DEP',
     'DOC',
     'DSGN',
   ] as const;
   ```
   No other changes in schemas.ts — DimensionSchema auto-updates via z.enum(DIMENSIONS).

**Step B — src/reviewer.ts** (after schemas.ts is updated):

1. Update file-level JSDoc at line 4:
   - Change: `Builds an 11-dimension review prompt`
   - To: `Builds a 12-dimension review prompt`

2. Update comment at line 22:
   - Change: `Reviewer prompt (language agnostic, 11-dimension)`
   - To: `Reviewer prompt (language agnostic, 12-dimension)`

3. In REVIEWER_PROMPT (line 47), add DSGN bullet AFTER the `- DOC:` line:
   ```
   - DSGN: Poor API design (unintuitive library interfaces, CLI flag/subcommand inconsistencies, REST/GraphQL/gRPC anti-patterns), violation of Single Responsibility Principle (classes/functions/modules doing more than one thing)
   ```
   Boundary note: DSGN covers *design quality* decisions — NOT structural violations (use ARCH for
   circular deps/tight coupling) and NOT contract correctness (use API for breaking changes/missing
   parameter validation).

4. In REVIEWER_PROMPT RULES block (line 67), update the header count:
   - Change: `All 11 dimension headers must be present in the output, even if no issues found`
   - To: `All 12 dimension headers must be present in the output, even if no issues found`

5. In REVIEWER_PROMPT RULES block (line 69), update the dimension enum:
   - Change: `dimension must be one of: BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC`
   - To: `dimension must be one of: BUG, SEC, PERF, STYL, TEST, ARCH, ERR, DATA, API, DEP, DOC, DSGN`
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && just test -- --reporter=verbose 2>&1 | grep -E "(schemas\.test|finding-id\.test|PASS|FAIL|✓|✗|×)" | head -30</automated>
  </verify>
  <done>
    - `src/schemas.ts` DIMENSIONS array has 12 entries ending with 'DSGN'
    - `src/reviewer.ts` REVIEWER_PROMPT DIMENSION DEFINITIONS block includes `- DSGN:` after `- DOC:`
    - `src/reviewer.ts` REVIEWER_PROMPT RULES block says "All 12 dimension headers" and lists DSGN in the enum
    - Comments in both files say "12-dimension" / "12 review dimension abbreviations"
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update all 4 test files with DSGN (counts, arrays, fixtures)</name>
  <files>src/schemas.test.ts, src/finding-id.test.ts, src/reviewer.test.ts, src/pipeline-io.test.ts</files>
  <behavior>
    - Test (schemas.test.ts:14): `has all 12 abbreviations` — DIMENSIONS.toEqual([...all 12...])
    - Test (finding-id.test.ts:20): DIMENSION_ABBREV.length === 12
    - Test (reviewer.test.ts:34): dimensions array includes 'DSGN', prompt.includes('- DSGN:')
    - Test (pipeline-io.test.ts:256): dimensionsCovered.length === 12 (both fixtures have ## DSGN)
  </behavior>
  <action>
**src/schemas.test.ts — lines 14–19:**

Update the test name from "11 abbreviations" to "12 abbreviations" and add 'DSGN' to the expected array:
```typescript
test('has all 12 abbreviations', () => {
  expect(DIMENSIONS).toEqual([
    'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
    'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
    'DSGN',
  ]);
});
```

---

**src/finding-id.test.ts — line 20:**

Update the length assertion from 11 to 12:
```typescript
expect(DIMENSION_ABBREV.length).toBe(12);
```

---

**src/reviewer.test.ts — two locations:**

Location 1: Lines 34–41 — update test name and add 'DSGN' to the dimensions array:
```typescript
test('contains all 12 dimension names in DIMENSION DEFINITIONS', () => {
  const prompt = buildReviewerPrompt({ diff: 'sample diff', focus: undefined });
  const dimensions = ['BUG', 'SEC', 'PERF', 'STYL', 'TEST', 'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC', 'DSGN'];
  for (const dim of dimensions) {
    expect(
      prompt.includes(`- ${dim}:`),
    ).toBeTruthy();
  }
});
```

Location 2: `fixtureReviewerMdContent` (lines 108–159) — add `## DSGN` section after the `## DOC` section.
The fixture currently ends with:
```
## DOC
No DOC issues found.
`
```
Append immediately before the closing backtick:
```
## DSGN
No DSGN issues found.
```

---

**src/pipeline-io.test.ts — three locations:**

Location 1: `fixtureReviewerWithFindings` (lines 107–158) — add `## DSGN` section after `## DOC` section.
After line 157 (`No DOC issues found.`), insert:
```

## DSGN
No DSGN issues found.
```

Location 2: `fixtureReviewerWithInvalidFinding` (lines 160–210) — add `## DSGN` section after `## DOC` section.
After line 209 (`No DOC issues found.`), insert:
```

## DSGN
No DSGN issues found.
```

Location 3: Line 256 — update dimensionsCovered length assertion from 11 to 12:
```typescript
expect(result.dimensionsCovered.length).toBe(12);
```
Also update the comment on line 252 from "All 11 dimension headers present in the fixture" to
"All 12 dimension headers present in the fixture".
  </action>
  <verify>
    <automated>cd /Users/tylercrawford/dev/github/review-my-shit && just test 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `just test` produces 169+ passing (all previously passing tests still pass)
    - The 4 updated test files compile without TypeScript errors
    - The 2 pre-existing setup.test.ts failures remain but no new failures are introduced
    - `just test` output shows: schemas.test.ts ✓, finding-id.test.ts ✓, reviewer.test.ts ✓, pipeline-io.test.ts ✓
  </done>
</task>

<task type="auto">
  <name>Task 3: Update README.md and AGENTS.md dimension counts</name>
  <files>README.md, AGENTS.md</files>
  <action>
**README.md — lines 135–148:**

1. Line 135: Update dimension count:
   - Change: `The reviewer analyzes code across 11 dimensions:`
   - To: `The reviewer analyzes code across 12 dimensions:`

2. After item 11 (`11. Code & documentation consistency`), add item 12:
   `12. API & interface design quality`

The final list should be:
```markdown
1. Bugs & logic errors
2. Security
3. Performance
4. Style & conventions
5. Test coverage
6. Architecture
7. Error handling & resilience
8. Data integrity
9. API & interface contracts
10. Dependency & environment risk
11. Code & documentation consistency
12. API & interface design quality
```

---

**AGENTS.md — line 16:**

The line currently reads (inside the ASCII box):
```
│  Reviewer   │  Analyzes the diff across 11 dimensions.
```
Update to:
```
│  Reviewer   │  Analyzes the diff across 12 dimensions.
```
  </action>
  <verify>
    <automated>grep -n "12 dimensions\|12\." /Users/tylercrawford/dev/github/review-my-shit/README.md | head -10 && grep -n "12 dimensions" /Users/tylercrawford/dev/github/review-my-shit/AGENTS.md</automated>
  </verify>
  <done>
    - README.md line 135 says "12 dimensions" and has 12 numbered items in the list
    - AGENTS.md line 16 says "Analyzes the diff across 12 dimensions"
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM output → Zod parser | Reviewer LLM writes `dimension: DSGN`; Zod validates against DIMENSIONS enum |
| Prompt content → LLM instruction | REVIEWER_PROMPT defines valid dimensions; LLM may self-correct if RULES and DEFINITIONS are inconsistent |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-arch-01 | Tampering | schemas.ts DIMENSIONS | accept | Single source of truth; z.enum(DIMENSIONS) auto-rejects unknown values including typos |
| T-arch-02 | Denial of Service | Zod rejection of DSGN | mitigate | schemas.ts updated BEFORE reviewer.ts per task ordering; if schema lags prompt, findings are silently dropped — task ordering prevents this |
| T-arch-03 | Repudiation | RULES/DEFINITIONS mismatch | mitigate | Both blocks updated atomically in Task 1; tests in Task 2 verify both locations contain DSGN |
</threat_model>

<verification>
After all 3 tasks complete, verify end-to-end:

```bash
cd /Users/tylercrawford/dev/github/review-my-shit

# 1. Build succeeds
just assemble

# 2. Full test suite — expect 169+ passing, same 2 pre-existing failures
just test

# 3. DSGN is in the schema
node -e "import('./dist/schemas.js').then(m => console.log(m.DIMENSIONS.includes('DSGN')))"

# 4. Spot-check dimension counts in each touched file
grep -c "DSGN" src/schemas.ts src/reviewer.ts src/schemas.test.ts src/finding-id.test.ts src/reviewer.test.ts src/pipeline-io.test.ts README.md AGENTS.md
```

Expected: `true` from node check; grep shows DSGN present in all 8 files.
</verification>

<success_criteria>
- `src/schemas.ts` DIMENSIONS array has 12 entries; `'DSGN'` is the last entry
- `src/reviewer.ts` REVIEWER_PROMPT contains `- DSGN: Poor API design...Single Responsibility Principle...` in DIMENSION DEFINITIONS
- `src/reviewer.ts` REVIEWER_PROMPT RULES block says "All 12" and lists `DOC, DSGN` at end of the enum
- `just test` passes all previously-passing tests (169+); no new failures introduced
- `README.md` lists 12 dimensions with item 12 being API & interface design quality
- `AGENTS.md` says "12 dimensions" in the pipeline overview box
</success_criteria>

<output>
After completion, create `.planning/phases/arch-dimension/arch-dimension-01-SUMMARY.md` with:
- What was changed and in which files
- The exact DSGN definition added to the reviewer prompt
- Test baseline before/after (e.g. "169 passing → 173 passing, 2 pre-existing failures unchanged")
- Any deviations from this plan
</output>
