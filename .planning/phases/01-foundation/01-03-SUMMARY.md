---
phase: 01-foundation
plan: "03"
subsystem: cli
tags: [commander, fs-promises, installer, opencode, cursor, slash-commands]

# Dependency graph
requires:
  - phase: 01-01
    provides: session.ts, CLI scaffolding, package.json structure
  - phase: 01-02
    provides: schemas.ts (DIMENSIONS, FindingSchema), finding-id.ts
provides:
  - rms install command writes four slash command files into user projects
  - src/installer.ts — install(projectRoot) function for writing command files
  - src/templates/opencode-review-local.md — OpenCode local review command (subtask: true)
  - src/templates/opencode-review-pr.md — OpenCode PR review command (subtask: true, argument-hint)
  - src/templates/cursor-review-local.md — Cursor local review command
  - src/templates/cursor-review-pr.md — Cursor PR review command
affects: [02-reviewer-agent, 03-validator-agent, 04-writer-agent, 05-orchestration]

# Tech tracking
tech-stack:
  added: [node:fs/promises (readFile/writeFile/mkdir), node:url (fileURLToPath)]
  patterns:
    - Template-copy installer pattern (read from src/templates/, write to projectRoot)
    - __dirname via fileURLToPath(import.meta.url) for ESM-safe path resolution
    - Idempotent installation via mkdir recursive + writeFile overwrite

key-files:
  created:
    - src/installer.ts
    - src/templates/opencode-review-local.md
    - src/templates/opencode-review-pr.md
    - src/templates/cursor-review-local.md
    - src/templates/cursor-review-pr.md
  modified:
    - src/index.ts
    - package.json

key-decisions:
  - "Build script copies src/templates/ to dist/templates/ so npm binary resolves templates post-compilation"
  - "install() uses __dirname via fileURLToPath(import.meta.url) — ESM-safe, works with tsx (dev) and compiled dist/ (prod)"
  - "OpenCode templates include subtask: true for mechanical subagent isolation; Cursor templates use description only with prompt-enforced isolation note"
  - "Templates are Phase 1 stubs — they accurately describe the pipeline steps but agent prompts are implemented in Phases 2–4"

patterns-established:
  - "Installer pattern: loop INSTALLS array, mkdir recursive, readFile template, writeFile dest"
  - "OpenCode command frontmatter: description + subtask: true (required for subagent isolation)"
  - "Cursor command frontmatter: description + argument-hint (no subtask support)"

requirements-completed: [PIPE-01, PIPE-02]

# Metrics
duration: 85min
completed: 2026-04-04
---

# Phase 01 Plan 03: Slash Command Installer Summary

**`rms install` writes four slash command files into .opencode/commands/ and .cursor/commands/, making /review-local and /review-pr discoverable in both editors**

## Performance

- **Duration:** ~85 min (wall clock, including context load)
- **Started:** 2026-04-04T13:06:13Z
- **Completed:** 2026-04-04T14:31:15Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments

- Four command template files created in `src/templates/` — two per editor (local-diff and PR-diff variants)
- `src/installer.ts` implements `install(projectRoot)`: reads templates, creates destination directories, writes files (idempotent)
- `src/index.ts` install command wired to call `installer.install(process.cwd())`
- `package.json` build script updated to copy `src/templates/` to `dist/templates/` post-compilation
- Installation verified idempotent: running twice produces no errors or duplicate content
- TypeScript typecheck: zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Write OpenCode and Cursor command template files** - `5694e23` (feat)
2. **Task 2: Implement installer module and wire into CLI** - `cd22670` (feat)

## Files Created/Modified

- `src/templates/opencode-review-local.md` — OpenCode slash command for local diff review (subtask: true for isolation)
- `src/templates/opencode-review-pr.md` — OpenCode slash command for PR diff review (subtask: true, argument-hint)
- `src/templates/cursor-review-local.md` — Cursor slash command for local diff review (prompt-enforced isolation note)
- `src/templates/cursor-review-pr.md` — Cursor slash command for PR diff review
- `src/installer.ts` — install() function: template-copy installer, ESM-safe __dirname, idempotent mkdir+writeFile
- `src/index.ts` — install command action wired to installer.install(projectRoot)
- `package.json` — build script updated: `tsc && cp -r src/templates dist/templates`

## Decisions Made

- **Build script copies templates**: `tsc` does not copy `.md` files; added `cp -r src/templates dist/templates` to `npm run build` so the compiled npm binary resolves templates at runtime from `dist/templates/`
- **ESM-safe `__dirname`**: Used `dirname(fileURLToPath(import.meta.url))` — required for ESM modules; works correctly with `tsx` in dev and compiled output in prod
- **Template stubs are intentional**: Phase 1 templates describe the pipeline steps accurately but don't implement agent prompts. This enables slash command discovery testing (Pitfall 8) before Phases 2–4 add agent logic.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The four template files in `src/templates/` are intentional Phase 1 pipeline stubs. They contain:
- Correct editor frontmatter (discoverable in command palettes)
- Accurate pipeline step descriptions (reviewer → validator → writer flow)
- No LLM agent prompts (those are implemented in Phases 2–4)

These stubs are **by design** for Phase 1 — the plan explicitly calls them out as "placeholder implementations for Phase 1" to enable slash command discovery testing (Pitfall 8). They do not prevent the plan's goal (making `/review-local` and `/review-pr` discoverable) from being achieved.

**Resolved in:** Phase 02 (reviewer prompts), Phase 03 (validator prompts), Phase 04 (writer prompts)

## Issues Encountered

None.

## Next Phase Readiness

- `rms install` is fully functional and idempotent
- OpenCode command files include `subtask: true` — mechanical isolation for Phases 2–4's subagent calls
- Cursor command files include the prompt-discipline isolation note — foundation for Phase 7 hardening
- Templates are discoverable via both editors' command palettes
- Phase 2 (reviewer agent) can begin: templates will be updated with actual reviewer prompts

---
*Phase: 01-foundation*
*Completed: 2026-04-04*
