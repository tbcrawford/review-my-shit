---
phase: 19-config-schema-overhaul-variant-support-and-opencode-cursor-s
plan: "04"
subsystem: templates
tags: [templates, opencode, cursor, model-picker]
dependency_graph:
  requires:
    - 19-02-SUMMARY.md (DEFAULT_RMS_CONFIG shape, settings command interface)
  provides:
    - 8 updated picker templates with model:variant spec format
  affects: []
key_files:
  created: []
  modified:
    - src/templates/opencode-rms-models.md
    - src/templates/opencode-rms-reviewer.md
    - src/templates/opencode-rms-validator.md
    - src/templates/opencode-rms-writer.md
    - src/templates/cursor-rms-models/SKILL.md
    - src/templates/cursor-rms-reviewer/SKILL.md
    - src/templates/cursor-rms-validator/SKILL.md
    - src/templates/cursor-rms-writer/SKILL.md
decisions:
  - "OpenCode templates use model:variant format (e.g. github-copilot/claude-opus-4.6:high_thinking)"
  - "Cursor templates use plain model IDs (no :variant suffix — intent encoded in the name)"
  - "All templates add Note about editor-section scope (This configures X section only)"
  - "OpenCode templates pass --opencode flag; Cursor templates pass --cursor flag"
metrics:
  duration: "5 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 8
---

# Phase 19 Plan 04: Picker Templates Update Summary

All 8 picker templates updated with new model:variant spec format, editor-scoped save commands (--opencode/--cursor), and cross-section notes.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Update 4 OpenCode templates with model:variant spec and --opencode flag | bda4357 |
| 2 | Update 4 Cursor SKILL.md templates with plain model IDs and --cursor flag | bda4357 |

## What Was Built

**OpenCode templates (4):**
- Spec format: `model:variant` (e.g. `github-copilot/claude-opus-4.6:high_thinking`)
- Save commands include `--opencode` scope flag
- Note: "This configures the OpenCode section only."

**Cursor templates (4):**
- Spec format: plain model ID (e.g. `claude-4.6-opus-high-thinking`) — no `:variant` suffix
- Save commands include `--cursor` scope flag
- Note: "This configures the Cursor section only."

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- 4 OpenCode templates contain `high_thinking`/`no_thinking` ✓
- 4 OpenCode templates contain `--opencode` ✓
- 4 Cursor templates contain `--cursor` ✓
- Commit `bda4357` exists ✓
