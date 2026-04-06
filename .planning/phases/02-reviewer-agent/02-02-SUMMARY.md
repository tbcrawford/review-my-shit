---
phase: 02-reviewer-agent
plan: "02"
subsystem: reviewer-agent
tags: [vercel-ai-sdk, generateText, openai, anthropic, google, node-test, zod, commander]

requires:
  - phase: 01-foundation
    provides: "FindingSchema, DIMENSIONS, nextFindingId, SessionInfo, createSession"
  - phase: 02-01
    provides: "getLocalDiff, writeInputFile, parseReviewerOutput, LocalDiffResult"
provides:
  - "REVIEWER_PROMPT: language-agnostic 11-dimension static prompt template"
  - "buildReviewerPrompt: interpolates diff + focus into REVIEWER_PROMPT at runtime"
  - "runReviewer: single isolated generateText call, writes REVIEWER.md, assigns IDs"
  - "review-local CLI command: end-to-end git diff → preprocess → INPUT.md → reviewer → REVIEWER.md"
  - "resolveModel: env-var-based AI provider resolution (AI_SDK_PROVIDER, AI_SDK_MODEL)"
affects: [03-validator, 05-orchestration, 06-fix-command]

tech-stack:
  added: [ai (Vercel AI SDK v6), @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google]
  patterns:
    - "Single isolated generateText call — no shared session history (PIPE-06)"
    - "_mockGenerateText escape hatch in ReviewerOptions for testing without LLM calls"
    - "FOCUS MODE prompt injection: suppresses non-focus dimensions with 'Suppressed (focus: X)' text"
    - "Dynamic ESM import for AI providers: await import('@ai-sdk/openai')"
    - "maxOutputTokens (not maxTokens) — AI SDK v6 breaking change from v5"

key-files:
  created:
    - src/reviewer.ts
    - src/reviewer.test.ts
  modified:
    - src/index.ts
    - package.json

key-decisions:
  - "AI SDK v6 uses maxOutputTokens not maxTokens — discovered via TypeScript error, fixed inline"
  - "_mockGenerateText escape hatch pattern for testing reviewer without real LLM calls"
  - "Google provider installed even though not in original plan — keeps resolveModel complete and type-safe"
  - "resolveModel is async (dynamic import) — review-local action uses await resolveModel()"

patterns-established:
  - "Reviewer prompt: static REVIEWER_PROMPT template + buildReviewerPrompt interpolation function"
  - "FOCUS MODE injection: 'FOCUS MODE: Analyze ONLY {dim}... For all others: {DIM}: Suppressed'"
  - "ReviewerOptions._mockGenerateText: optional async (prompt: string) => Promise<string> for test isolation"

requirements-completed: [PIPE-03, PIPE-06, QUAL-01, QUAL-02]

duration: 3min
completed: 2026-04-06
---

# Phase 2 Plan 02: Reviewer Agent Summary

**Language-agnostic 11-dimension reviewer prompt wired to Vercel AI SDK generateText with orchestrator-assigned finding IDs and end-to-end review-local CLI command**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T01:24:29Z
- **Completed:** 2026-04-06T01:28:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `REVIEWER_PROMPT` and `buildReviewerPrompt`: language-agnostic static template covering all 11 dimensions; FOCUS MODE injects focus suppression instructions when focus is set — 6 structural tests verify language agnosticism, dimension coverage, and focus mode
- `runReviewer`: single isolated `generateText` call → writes REVIEWER.md with YAML frontmatter → parses findings via `parseReviewerOutput` → assigns IDs via `nextFindingId` — finding ID tests confirm `^[A-Z]+-\d{5}$` format and sequential counter
- `review-local` CLI command fully wired: `getLocalDiff` → strip preprocessing log → `createSession` → `writeInputFile` → `resolveModel` → `runReviewer` → summary output
- `resolveModel`: env-var-based AI provider resolution supporting OpenAI (default), Anthropic, and Google via dynamic ESM imports

## Task Commits

1. **Task 1: Reviewer agent — prompt, generateText, ID assignment** — `e693f3d` (feat)
2. **Task 2: Wire review-local CLI command** — `a095e09` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/reviewer.ts` — REVIEWER_PROMPT, buildReviewerPrompt, runReviewer, ReviewerOptions, ReviewerResult
- `src/reviewer.test.ts` — 9 tests: prompt structure, language agnosticism, focus mode, ID format, sequential counter
- `src/index.ts` — review-local action wired, resolveModel() added
- `package.json` — added ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google

## Decisions Made

- `maxOutputTokens` not `maxTokens` — AI SDK v6 changed parameter name; caught via TypeScript error
- `_mockGenerateText` escape hatch in `ReviewerOptions` to avoid real LLM calls in tests without complex module mocking
- `@ai-sdk/google` added (not in original plan) to keep `resolveModel` complete and type-safe with no TS errors
- `resolveModel` made `async` since provider packages use dynamic ESM imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AI SDK v6 parameter name: maxOutputTokens not maxTokens**
- **Found during:** Task 1 (reviewer.ts implementation)
- **Issue:** `maxTokens: 8192` in generateText options — AI SDK v6 renamed this to `maxOutputTokens`; TypeScript error: "Object literal may only specify known properties, and 'maxTokens' does not exist in type..."
- **Fix:** Changed `maxTokens` to `maxOutputTokens`
- **Files modified:** src/reviewer.ts
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** e693f3d (Task 1 commit)

**2. [Rule 2 - Missing Critical] Installed @ai-sdk/google for complete resolveModel coverage**
- **Found during:** Task 2 (index.ts implementation)
- **Issue:** Plan specified installing `ai @ai-sdk/openai @ai-sdk/anthropic` but resolveModel() includes Google branch; `@ai-sdk/google` import would cause TypeScript error at runtime
- **Fix:** `npm install @ai-sdk/google` — keeps provider selection type-safe and complete
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** a095e09 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes essential for correct TypeScript compilation. No scope creep.

## Issues Encountered

- LSP reports false-positive "Cannot find module './reviewer.js'" in reviewer.test.ts — tsx resolves `.js` → `.ts` correctly; `tsc --noEmit` confirms zero actual errors. This is a known NodeNext resolution limitation in test files.

## Known Stubs

None — all wired functionality is real. `review-pr`, `fix`, and `install` commands remain stubs intentionally (other phases).

## Next Phase Readiness

- Phase 3 (Validator Agent) depends on `runReviewer` output: `ReviewerResult` with `findings[]` (IDs assigned) and `reviewerMdPath`
- Phase 5 (Orchestration) depends on `review-local` action and `resolveModel` pattern — provider resolution stub ready for enhancement
- `REVIEWER.md` format is fully established and parseable by downstream agents

---
*Phase: 02-reviewer-agent*
*Completed: 2026-04-06*
