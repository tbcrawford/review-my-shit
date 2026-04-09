---
phase: 17-command-ux-overhaul-flag-free-intelligent-routing-interactiv
plan: "02"
subsystem: templates
tags: [templates, ux, opencode, cursor, flag-free, model-picker]
dependency_graph:
  requires: []
  provides: [opencode-rms-reviewer, opencode-rms-validator, opencode-rms-writer, cursor-rms-reviewer, cursor-rms-validator, cursor-rms-writer]
  affects: [opencode-review, opencode-settings, cursor-rms-review, cursor-rms-settings]
tech_stack:
  added: []
  patterns: [subtask-true-wrapper, cursor-skill-tty-fallback]
key_files:
  created:
    - src/templates/opencode-rms-reviewer.md
    - src/templates/opencode-rms-validator.md
    - src/templates/opencode-rms-writer.md
    - src/templates/cursor-rms-reviewer/SKILL.md
    - src/templates/cursor-rms-validator/SKILL.md
    - src/templates/cursor-rms-writer/SKILL.md
  modified:
    - src/templates/opencode-review.md
    - src/templates/opencode-settings.md
    - src/templates/cursor-rms-review/SKILL.md
    - src/templates/cursor-rms-settings/SKILL.md
decisions:
  - "OpenCode reviewer/validator/writer templates use subtask: true with no argument-hint — fully interactive via !rms <agent>"
  - "Cursor SKILL.md files include TTY fallback guidance pointing to rms settings --<agent> <spec>"
  - "cursor-rms-settings keeps CLI flag scripting reference but removes interactive picker section and argument-hint"
  - "cursor-rms-review removes all --focus references; scope routing kept for interactive prompting"
metrics:
  duration: ~5 min
  completed: "2026-04-09"
  tasks: 2
  files: 10
---

# Phase 17 Plan 02: New Agent Command Templates Summary

**One-liner:** Six new/updated editor command templates for flag-free `/rms-reviewer`, `/rms-validator`, `/rms-writer` picker commands in both OpenCode and Cursor.

## What Was Built

Created 6 new template files (3 OpenCode + 3 Cursor) and updated 4 existing templates to implement the flag-free command UX surface for Phase 17.

### New Files

| File | Purpose |
|------|---------|
| `src/templates/opencode-rms-reviewer.md` | OpenCode `/rms-reviewer` — `subtask: true` + `!rms reviewer` |
| `src/templates/opencode-rms-validator.md` | OpenCode `/rms-validator` — `subtask: true` + `!rms validator` |
| `src/templates/opencode-rms-writer.md` | OpenCode `/rms-writer` — `subtask: true` + `!rms writer` |
| `src/templates/cursor-rms-reviewer/SKILL.md` | Cursor `/rms-reviewer` skill with picker guidance + TTY fallback |
| `src/templates/cursor-rms-validator/SKILL.md` | Cursor `/rms-validator` skill with picker guidance + TTY fallback |
| `src/templates/cursor-rms-writer/SKILL.md` | Cursor `/rms-writer` skill with picker guidance + TTY fallback |

### Updated Files

| File | Change |
|------|--------|
| `src/templates/opencode-review.md` | Removed `argument-hint` with `--focus` flag; updated description |
| `src/templates/opencode-settings.md` | Updated description to overview+reset only; points to /rms-reviewer etc. |
| `src/templates/cursor-rms-review/SKILL.md` | Removed `--focus` flag from scope routing options |
| `src/templates/cursor-rms-settings/SKILL.md` | Removed interactive picker section; added dedicated command pointers; kept CLI flags for scripting |

## Decisions Made

1. **No argument-hint on reviewer/validator/writer OpenCode templates** — These commands are fully interactive; no hint needed since users pass no arguments.
2. **Cursor SKILL.md TTY fallback** — Each Cursor picker skill includes fallback guidance (`rms settings --<agent> <spec>`) in case the TTY context doesn't support interactive prompts.
3. **cursor-rms-settings retains CLI flag scripting reference** — The plan explicitly keeps `--reviewer/--validator/--writer` flags as scripting examples while removing the "interactive picker" section and model selection flow; the editor UX now points to the dedicated commands.
4. **cursor-rms-review scope routing preserved** — The intelligent `rms review local/pr/full` routing logic is kept; only the `--focus` flag references were removed.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 3 new OpenCode templates | `3234ccd` | opencode-rms-reviewer.md, opencode-rms-validator.md, opencode-rms-writer.md |
| 2 | Create 3 Cursor skills + update 4 existing templates | `a34d09e` | cursor-rms-reviewer/SKILL.md, cursor-rms-validator/SKILL.md, cursor-rms-writer/SKILL.md, opencode-review.md, opencode-settings.md, cursor-rms-review/SKILL.md, cursor-rms-settings/SKILL.md |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Templates are static markdown files with no dynamic content. Threat model unchanged.

## Self-Check: PASSED

- [x] `src/templates/opencode-rms-reviewer.md` — exists (153B)
- [x] `src/templates/opencode-rms-validator.md` — exists (155B)
- [x] `src/templates/opencode-rms-writer.md` — exists (149B)
- [x] `src/templates/cursor-rms-reviewer/SKILL.md` — exists (801B)
- [x] `src/templates/cursor-rms-validator/SKILL.md` — exists (805B)
- [x] `src/templates/cursor-rms-writer/SKILL.md` — exists (793B)
- [x] `src/templates/opencode-review.md` — argument-hint removed ✓
- [x] `src/templates/opencode-settings.md` — description updated to overview+reset ✓
- [x] `src/templates/cursor-rms-review/SKILL.md` — --focus removed from routing ✓
- [x] `src/templates/cursor-rms-settings/SKILL.md` — interactive picker section removed ✓
- [x] Commit `3234ccd` — Task 1 ✓
- [x] Commit `a34d09e` — Task 2 ✓
- [x] All Cursor SKILL.md name: frontmatter matches directory name ✓
