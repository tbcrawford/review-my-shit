# Phase 13: Research — Dependency Updates

**Phase:** 13 — Update all dependencies to latest stable versions, Node LTS
**Date:** 2026-04-08

---

## Current vs Target State

### Node.js
- **Running:** v24.14.0 (latest LTS "Krypton" — v24 entered LTS in Oct 2025)
- **Engines field:** `>=18.0.0` — needs update to `>=20.0.0` (commander v14 minimum)
- **Action:** Update `engines.node` in package.json; add `.nvmrc` pinning v24

### Dependencies

| Package | Current | Latest | Major Bump? |
|---------|---------|--------|-------------|
| `@ai-sdk/anthropic` | `^3.0.66` | `3.0.68` | No (patch) |
| `@ai-sdk/google` | `^3.0.58` | `3.0.60` | No (patch) |
| `@ai-sdk/openai` | `^3.0.50` | `3.0.52` | No (patch) |
| `ai` | `^6.0.146` | `6.0.153` | No (patch) |
| `commander` | `^12.0.0` | `14.0.3` | Yes — Node ≥20 required |
| `nanoid` | `^5.0.0` | `5.1.7` | No (minor) |
| `simple-git` | `^3.0.0` | `3.35.2` | No (minor) |
| `zod` | `^3.0.0` | `4.3.6` | Yes — breaking changes (see below) |
| `@types/node` | `^22.0.0` | `25.5.2` | Yes — must add `types: ["node"]` to tsconfig |
| `tsx` | `^4.0.0` | `4.21.0` | No (minor) |
| `typescript` | `^5.0.0` | `6.0.2` | Yes — breaking defaults (see below) |

---

## Breaking Change Analysis

### Zod v4 (z → z still works)
Current schemas.ts uses only: `z.object`, `z.string`, `z.enum`, `z.literal`, `z.number`, `z.optional`.
**Impact: MINIMAL.** All core APIs remain identical. ZodError import still works.

Specific non-issues for this codebase:
- No `z.record()` single-arg usage (would break — now needs 2 args)
- No `z.nativeEnum()` (deprecated but not removed)
- No `.passthrough()` or `.strict()` on objects (deprecated but not removed)
- No `invalid_type_error`/`required_error` params (dropped)
- No `.format()` or `.flatten()` on ZodError (deprecated but not removed in v4)
- `ZodError` still importable from `'zod'` ✓

**Action: `npm install zod@^4.0.0` — no code changes needed.**

### Commander v14
Breaking change: **Node.js ≥20 required** (v24 already satisfies this).
No API changes that affect this codebase — `.command()`, `.option()`, `.action()`, `.parse()` all unchanged.

**Action: `npm install commander@^14.0.0` — update engines field to `>=20.0.0`.**

### TypeScript v6
Key breaking changes relevant to this project:

1. **`types` no longer auto-discovered** — Must add `"types": ["node"]` to tsconfig.json
   - Without this: `Cannot find name 'process'`, `Cannot find module 'fs'` etc.

2. **`rootDir` now defaults to `.`** — BUT tsconfig.json already has `"rootDir": "src"` explicitly ✓

3. **`strict` now defaults to `true`** — tsconfig already has `"strict": true` ✓

4. **`target` defaults to `ES2025`** — tsconfig has `"target": "ES2022"` explicitly ✓

5. **`moduleResolution: NodeNext`** — tsconfig already has `"moduleResolution": "NodeNext"` ✓

**Action: Add `"types": ["node"]` to tsconfig.json compilerOptions. Everything else already correct.**

### @types/node v25
Major version bump but types are backward-compatible for Node ≥20 APIs used in this codebase.

**Action: `npm install @types/node@^25.0.0` — no code changes needed.**

---

## Migration Plan

### Plan 01 — Update package.json + tsconfig + install dependencies
1. Update all version ranges in `package.json` to target latest
2. Update `"engines": { "node": ">=20.0.0" }` (commander v14 minimum)
3. Add `"types": ["node"]` to `tsconfig.json`
4. Run `npm install` to update lock file
5. Run `npm run build` and fix any compile errors
6. Run `npm test` and fix any test failures

### Plan 02 — End-to-end verification checkpoint
1. Human verifies `rms install` works end-to-end
2. Verify test suite passes (automated)
3. Verify build output correct (automated)

---

## Risk Areas
- TypeScript v6 may surface new strict-mode errors in code that was previously valid under v5
- `@types/node` v25 type signatures may differ from v22 for some Node APIs used
- Vercel AI SDK patch bumps are safe — same major version
