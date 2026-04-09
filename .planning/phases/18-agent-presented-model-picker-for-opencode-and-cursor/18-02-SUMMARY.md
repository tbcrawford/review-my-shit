---
phase: 18-agent-presented-model-picker-for-opencode-and-cursor
plan: "02"
subsystem: templates/cursor
tags: [templates, cursor, model-picker, skill-md]
dependency_graph:
  requires: []
  provides: [cursor-rms-reviewer/SKILL.md, cursor-rms-validator/SKILL.md, cursor-rms-writer/SKILL.md]
  affects: [dist/templates, ~/.cursor/skills/]
tech_stack:
  added: []
  patterns: [cursor-skill-agent-routing, agent-presented-picker]
key_files:
  created: []
  modified:
    - src/templates/cursor-rms-reviewer/SKILL.md
    - src/templates/cursor-rms-validator/SKILL.md
    - src/templates/cursor-rms-writer/SKILL.md
decisions:
  - "Agent presents tier table in conversation rather than running rms reviewer/validator/writer in terminal"
  - "Follows cursor-rms-review SKILL.md pattern: run + present + re-invoke pattern"
metrics:
  duration: 3min
  completed: "2026-04-09"
  tasks: 2
  files: 3
---

# Phase 18 Plan 02: Cursor Model Picker SKILL.md Templates Summary

**One-liner:** Replaced Cursor SKILL.md `rms reviewer/validator/writer` terminal commands with agent-side conversation flow that presents a tier table and applies via `rms settings --<agent> <spec>`.

## What Was Built

Rewrote all three Cursor SKILL.md model picker files (`cursor-rms-reviewer/SKILL.md`, `cursor-rms-validator/SKILL.md`, `cursor-rms-writer/SKILL.md`) to present model choices conversationally instead of launching a TTY-dependent terminal TUI.

**Problem solved:** Old SKILL.md files instructed the agent to run `rms reviewer` (etc.) in terminal, which opens an `@inquirer/prompts` TUI that may not work in Cursor's embedded terminal context.

**Solution:** Followed the `cursor-rms-review/SKILL.md` pattern. The agent now:
1. Runs `rms settings` in terminal to read current config
2. Presents a tier table (max/high/medium/low + other providers) in the conversation
3. Asks the user to choose
4. Maps the selection to a `provider:model-id` spec
5. Runs `rms settings --<agent> <spec>` to apply
6. Confirms the save

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rewrite cursor-rms-reviewer/SKILL.md | 5badef2 |
| 2 | Rewrite cursor-rms-validator/SKILL.md and cursor-rms-writer/SKILL.md | 5badef2 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/templates/cursor-rms-reviewer/SKILL.md` — exists ✓, contains `rms settings --reviewer` ✓, no bare `rms reviewer` ✓
- `src/templates/cursor-rms-validator/SKILL.md` — exists ✓, contains `rms settings --validator` ✓
- `src/templates/cursor-rms-writer/SKILL.md` — exists ✓, contains `rms settings --writer` ✓
- All have tier tables with github-copilot model names ✓
- Commit 5badef2 exists ✓
