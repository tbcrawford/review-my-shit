---
plan: 12-01
phase: 12
status: complete
completed: 2026-04-07
key-files:
  created: []
  modified:
    - src/setup.ts
---

## Summary

Overhauled `src/setup.ts` with four improvements:
1. ASCII banner on startup displaying `rms — review-my-shit v0.2.0`
2. CLI flags `--opencode`, `--cursor`, `--yes`/`-y` to bypass interactive prompt for scripting
3. Interactive prompt now shows destination paths for each editor choice
4. Polished completion output: `✓ Done.` + available commands list

## What Was Built

- `printBanner()`: uses `BANNER_STRING` constant (also exported for testability) with box-drawing ASCII art and version string
- `resolveEditorsFromArgs()`: exported pure function parsing CLI flags, returns null for interactive mode
- Interactive prompt: shows `~/.config/opencode/command/` and `~/.cursor/skills/` paths
- Completion block: lists installed commands per editor

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retained `BANNER_STRING` export required by existing tests**
- **Found during:** Step 2 (writing setup.ts)
- **Issue:** The plan's template used direct `console.log` calls in `printBanner()` without exporting `BANNER_STRING`. The existing `src/setup.test.ts` imports `{ BANNER_STRING }` from `setup.js` — removing the export would break test compilation and all BANNER_STRING tests.
- **Fix:** Kept `BANNER_STRING` as an exported const; `printBanner()` uses it via `console.log(BANNER_STRING)`. All functional requirements met while keeping tests green.
- **Files modified:** `src/setup.ts`
- **Commit:** 5990f67

## Self-Check: PASSED

- `npm run build` exits 0
- `npm test` (non-blocking subset): 94 tests pass, 0 fail
- `dist/setup.js` exists
- `BANNER_STRING` exported and contains "rms" and "v0.2.0"
- `resolveEditorsFromArgs` exported and handles all flag combinations
- Interactive prompt shows editor destination paths
- Completion block shows available commands per editor
