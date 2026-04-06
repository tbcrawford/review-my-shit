---
plan: "02"
phase: "09"
status: complete
---

## What was done
- Created `src/templates/opencode-review.md` — OpenCode `/rms-review` command template with `subtask: true` and `!node dist/index.js review $ARGUMENTS`
- Created `src/templates/cursor-review.md` — Cursor `/rms-review` command template with scope-prompt handling instructions
- Updated `src/installer.ts` INSTALLS array from 8 to 10 entries, adding `opencode-review.md → .opencode/commands/rms-review.md` and `cursor-review.md → .cursor/commands/rms-review.md`

## Key decisions
- Used `rms-review.md` destination name (with `rms-` prefix) to mirror `rms-settings.md` convention and avoid collision
- Cursor template includes re-invoke guidance for both local and PR scope choices
- OpenCode template kept minimal (no prose) matching existing pattern
