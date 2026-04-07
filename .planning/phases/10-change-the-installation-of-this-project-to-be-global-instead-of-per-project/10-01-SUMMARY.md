---
phase: "10"
plan: "01"
subsystem: "package-config, templates"
tags: ["npm-publish", "global-install", "templates", "cli"]
dependency_graph:
  requires: []
  provides: ["review-my-shit npm package name", "global rms binary templates"]
  affects: ["installer", "npm publish pipeline"]
tech_stack:
  added: []
  patterns: ["global npm install convention"]
key_files:
  created: []
  modified:
    - "package.json"
    - "src/templates/opencode-review.md"
    - "src/templates/opencode-rms-fix.md"
    - "src/templates/opencode-settings.md"
    - "src/templates/cursor-review.md"
    - "src/templates/cursor-rms-fix.md"
    - "src/templates/cursor-settings.md"
decisions:
  - "Package renamed to review-my-shit because 'rms' is already taken on npm; bin stays 'rms' for CLI ergonomics"
  - "Removed 'Cannot find module / npm run build' notes from Cursor templates — not applicable for global installs"
metrics:
  duration: "5 min"
  completed: "2026-04-07"
  tasks_completed: 1
  files_changed: 7
---

# Phase 10 Plan 01: Package Rename and Template Updates Summary

Renamed npm package from `rms` to `review-my-shit` and updated all 6 editor command templates to call the globally-installed `rms` binary instead of `node dist/index.js`.

## What Was Built

- **package.json**: `"name"` changed from `"rms"` to `"review-my-shit"`. The `"bin": {"rms": "dist/index.js"}` entry is unchanged — the CLI command remains `rms`.
- **3 OpenCode templates**: `!node dist/index.js <subcommand>` → `!rms <subcommand>` in `opencode-review.md`, `opencode-rms-fix.md`, `opencode-settings.md`
- **3 Cursor templates**: `node dist/index.js <subcommand>` → `rms <subcommand>` in `cursor-review.md`, `cursor-rms-fix.md`, `cursor-settings.md`
- Removed "Cannot find module — run npm run build first" notes from Cursor templates (irrelevant after global install)

## Decisions Made

1. **`review-my-shit` as package name**: The `rms` name was already taken on npm by an unrelated package. `review-my-shit` is the repo/project name and unambiguously identifies the package.
2. **bin stays `rms`**: Users type `rms review`, `rms fix`, etc. The longer package name is invisible after install.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
PASS: package name correct
PASS: bin entry correct
PASS: opencode review uses rms
PASS: opencode fix uses rms
PASS: opencode settings uses rms
PASS: no node dist in opencode-review
PASS: cursor-review clean
PASS: cursor-fix clean
PASS: cursor-settings clean
PASS: build note removed from cursor-review
PASS: build note removed from cursor-settings
152 tests passing
```

## Self-Check: PASSED

- package.json name: `review-my-shit` ✓
- All 6 templates: no `node dist/index.js` references ✓
- Commit 82b42de exists ✓
- 152 tests pass ✓
