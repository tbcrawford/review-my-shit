---
status: resolved
trigger: "no-interactive-picker-in-installer"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T15:35:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED — isMain check now uses realpathSync on both sides
test: bunx review-my-shit --yes, bunx review-my-shit (interactive), node dist/setup.js (direct)
expecting: All paths produce banner + correct behavior
next_action: Archive session

## Symptoms

expected: An interactive picker appears asking the user which editors to install for (OpenCode, Cursor, or both)
actual: No interactive picker appears. Command runs but no prompt is shown.
errors: None reported — silent failure
reproduction: `bun run build && bun link && bunx review-my-shit` OR `node dist/index.js install`
started: After Phase 13 dependency updates (bun adoption, Commander v14, Zod v4, TypeScript v6 upgrade)

## Eliminated

- hypothesis: dist/setup.js does not exist
  evidence: dist/setup.js exists at 5.1K, confirmed via ls
  timestamp: 2026-04-08T15:10:00Z

- hypothesis: isMain check fails due to relative vs absolute path (when running `node dist/setup.js`)
  evidence: When running directly via node, argv[1] is absolute and matches __filename (isMain=true). This path works fine.
  timestamp: 2026-04-08T15:15:00Z

- hypothesis: TTY detection causes readline to skip silently
  evidence: No TTY check in code; readline.question is called unconditionally. Banner always shows when invoked directly.
  timestamp: 2026-04-08T15:18:00Z

- hypothesis: bunx fails to find the local linked package
  evidence: bunx DOES invoke dist/setup.js (confirmed by SyntaxError debug). It uses node_modules/.bin/review-my-shit symlink.
  timestamp: 2026-04-08T15:20:00Z

## Evidence

- timestamp: 2026-04-08T15:10:00Z
  checked: package.json bin field
  found: "review-my-shit" maps to "dist/setup.js"; dist/setup.js exists
  implication: The bin mapping is correct and the file exists

- timestamp: 2026-04-08T15:12:00Z
  checked: src/setup.ts isMain logic
  found: Uses `process.argv[1] === fileURLToPath(import.meta.url)` — no realpath resolution
  implication: Symlink paths will not match the resolved real path

- timestamp: 2026-04-08T15:15:00Z
  checked: node dist/setup.js direct invocation
  found: Works correctly — banner shows, prompt appears, install runs
  implication: The logic itself is correct; the entry point check is the problem

- timestamp: 2026-04-08T15:18:00Z
  checked: bunx review-my-shit (no args)
  found: Zero output, exit code 0
  implication: setup.js is invoked but main() never executes

- timestamp: 2026-04-08T15:20:00Z
  checked: bunx review-my-shit --yes
  found: Zero output, exit code 0
  implication: Even the scripted (non-TTY) code path is unreachable

- timestamp: 2026-04-08T15:22:00Z
  checked: bun link creates ~/.cache/.bun/install/global/node_modules/review-my-shit -> /project
  found: bunx uses node_modules/.bin/review-my-shit (local project's bin symlink) as argv[1]
  implication: argv[1] = /project/node_modules/.bin/review-my-shit, __filename = /project/dist/setup.js — MISMATCH

- timestamp: 2026-04-08T15:25:00Z
  checked: realpathSync debug instrumentation on dist/setup.js
  found: argv[1]=/project/node_modules/.bin/review-my-shit, __filename=/project/dist/setup.js, isMain=false
         BUT realpath(argv[1]) = realpath(__filename) = /project/dist/setup.js
  implication: ROOT CAUSE CONFIRMED — need to resolve both paths with realpathSync before comparing

- timestamp: 2026-04-08T15:30:00Z
  checked: bunx review-my-shit after fix (--yes, --opencode, interactive)
  found: All three paths work correctly — banner appears, prompt shown, install runs
  implication: Fix verified

- timestamp: 2026-04-08T15:32:00Z
  checked: bun run test (168 tests)
  found: All 168 pass, 0 fail
  implication: No regressions introduced

## Resolution

root_cause: The `isMain` guard in src/setup.ts compared `process.argv[1]` (unresolved symlink path, e.g. `node_modules/.bin/review-my-shit`) against `fileURLToPath(import.meta.url)` (the real resolved path). When invoked via `bunx` or any symlink-based runner, these two strings are never equal — so `main()` never executes and the command silently exits with code 0.
fix: Added `import { realpathSync } from 'node:fs'` and a `resolveReal()` helper that calls `realpathSync()` with a try/catch fallback. Changed `const isMain = process.argv[1] === __filename` to `const isMain = resolveReal(process.argv[1] ?? '') === resolveReal(__filename)`. Both sides now resolve symlinks before comparison.
verification: bunx review-my-shit --yes, bunx review-my-shit --opencode, bunx review-my-shit (interactive with piped "1"), and node dist/setup.js all produce the banner and correct behavior. All 168 tests pass.
files_changed: [src/setup.ts]
