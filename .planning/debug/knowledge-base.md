# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## no-interactive-picker-in-installer — isMain check fails under symlink-based runners (bunx/npx), main() never executes
- **Date:** 2026-04-08
- **Error patterns:** silent failure, no output, bunx, npx, interactive picker, install, setup, isMain, argv, symlink
- **Root cause:** The `isMain` guard compared `process.argv[1]` (unresolved symlink path, e.g. `node_modules/.bin/review-my-shit`) against `fileURLToPath(import.meta.url)` (the real resolved path). When invoked via `bunx` or any symlink-based runner, these strings never match — so `main()` never executes and the command silently exits 0.
- **Fix:** Added `import { realpathSync } from 'node:fs'` and a `resolveReal()` helper. Changed the isMain check to `resolveReal(process.argv[1] ?? '') === resolveReal(__filename)` so both sides resolve symlinks before comparison.
- **Files changed:** src/setup.ts
---

