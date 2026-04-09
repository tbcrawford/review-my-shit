---
phase: 18-agent-presented-model-picker-for-opencode-and-cursor
plan: "01"
subsystem: templates/opencode
tags: [templates, opencode, model-picker, question-api]
dependency_graph:
  requires: []
  provides: [opencode-rms-reviewer.md, opencode-rms-validator.md, opencode-rms-writer.md]
  affects: [dist/templates, ~/.config/opencode/command/]
tech_stack:
  added: []
  patterns: [opencode-question-api, agent-presented-picker]
key_files:
  created: []
  modified:
    - src/templates/opencode-rms-reviewer.md
    - src/templates/opencode-rms-validator.md
    - src/templates/opencode-rms-writer.md
decisions:
  - "question: true + bash: true replaces subtask: true for agent-presented flow"
  - "Tier labels (max/high/medium/low) mapped to copilot:model-id specs inline in template"
metrics:
  duration: 3min
  completed: "2026-04-09"
  tasks: 2
  files: 3
---

# Phase 18 Plan 01: OpenCode Model Picker Templates Summary

**One-liner:** Replaced TTY-dependent `!rms reviewer/validator/writer` commands with agent-presented `question: true` pickers that apply via `rms settings --<agent> <spec>`.

## What Was Built

Rewrote all three OpenCode model picker command templates (`opencode-rms-reviewer.md`, `opencode-rms-validator.md`, `opencode-rms-writer.md`) to use OpenCode's agent-presented question API instead of launching a TTY-dependent `@inquirer/prompts` TUI.

**Problem solved:** The old templates used `subtask: true` + `!rms reviewer` which ran the interactive TUI in a non-TTY subprocess, immediately producing "Cancelled." because stdin was not interactive.

**Solution:** Removed `subtask: true`. Added `tools: question: true` and `tools: bash: true`. The agent now:
1. Reads current config via `!rms settings`
2. Presents a tier menu via the `question` API
3. Maps the selection to a `provider:model-id` spec
4. Applies it via `!rms settings --<agent> <spec>`
5. Confirms the save

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rewrite opencode-rms-reviewer.md | 4da38b4 |
| 2 | Rewrite opencode-rms-validator.md and opencode-rms-writer.md | 4da38b4 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/templates/opencode-rms-reviewer.md` — exists ✓, contains `question: true` ✓, contains `rms settings --reviewer` ✓
- `src/templates/opencode-rms-validator.md` — exists ✓, contains `question: true` ✓, contains `rms settings --validator` ✓
- `src/templates/opencode-rms-writer.md` — exists ✓, contains `question: true` ✓, contains `rms settings --writer` ✓
- None contain `subtask: true` ✓
- None contain `!rms reviewer`, `!rms validator`, `!rms writer` ✓
- Commit 4da38b4 exists ✓
