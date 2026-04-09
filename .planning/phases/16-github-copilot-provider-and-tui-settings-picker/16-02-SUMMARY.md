---
phase: 16-github-copilot-provider-and-tui-settings-picker
plan: "02"
subsystem: settings-tui
tags: [tui, settings, copilot, inquirer, templates]
dependency_graph:
  requires:
    - "copilot provider in AgentModelSpecSchema (16-01)"
    - "saveRmsConfig/loadRmsConfig/getConfigPath from config.ts (16-01)"
  provides:
    - "runSettingsTui() exported from src/settings-tui.ts"
    - "Interactive agent→provider→model picker with static curated model lists"
    - "Non-TTY fallback with actionable help text including github-copilot/ format"
    - "Updated opencode-settings.md with copilot argument-hint"
    - "Updated cursor-rms-settings/SKILL.md with copilot provider table + Cursor model ID warning"
  affects:
    - "src/settings-tui.ts"
    - "src/index.ts"
    - "src/templates/opencode-settings.md"
    - "src/templates/cursor-rms-settings/SKILL.md"
tech_stack:
  added: []
  patterns:
    - "@inquirer/prompts select() for three-step TUI flow (already in package.json from Phase 15)"
    - "Dynamic import of settings-tui.js in index.ts (avoids loading TUI on every CLI invocation)"
    - "try/catch around entire TUI flow for non-TTY / ExitPromptError fallback"
key_files:
  created:
    - "src/settings-tui.ts"
  modified:
    - "src/index.ts"
    - "src/templates/opencode-settings.md"
    - "src/templates/cursor-rms-settings/SKILL.md"
decisions:
  - "Dynamic import of settings-tui.js mirrors existing non-TTY pattern in index.ts review command"
  - "Copilot listed FIRST in provider choices — most novel provider, primary reason for this feature"
  - "MODELS lookup is static in code — T-16-05 accept disposition; no runtime injection risk"
  - "Single catch {} block covers both ExitPromptError and any other non-TTY error — simpler and correct"
  - "No changes to test suite — settings-tui.ts behavior verified via subprocess (non-TTY exit) and build"
metrics:
  duration: "105s"
  completed: "2026-04-09T16:15:28Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 16 Plan 02: TUI Settings Picker + Template Updates Summary

**One-liner:** Interactive three-step @inquirer/prompts TUI for `rms settings` (agent→provider→model), with non-TTY fallback and copilot provider docs added to both editor templates.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create src/settings-tui.ts with interactive picker | `a048a97` | `src/settings-tui.ts` |
| 2 | Wire TUI into index.ts + update templates + build | `cd2605f` | `src/index.ts`, `src/templates/opencode-settings.md`, `src/templates/cursor-rms-settings/SKILL.md` |

---

## What Was Built

### `src/settings-tui.ts` (NEW)
- **`runSettingsTui()`** (exported async function): three-step `@inquirer/prompts` `select()` flow
  - Step 1: Which agent? (Reviewer / Validator / Writer)
  - Step 2: Which provider? (copilot → anthropic → openai → google, copilot listed first)
  - Step 3: Which model? (static `MODELS` lookup filtered by selected provider)
- **Static `MODELS` lookup** covering all four providers:
  - `openai`: gpt-4o, gpt-4o-mini, o3, o4-mini
  - `anthropic`: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5
  - `google`: gemini-2.5-pro, gemini-2.5-flash
  - `copilot`: claude-opus-4.6, claude-sonnet-4.6, gpt-4o, o4-mini, gemini-2.5-pro
- After selection: loads existing config (or defaults), applies update, calls `saveRmsConfig()`, prints confirmation with path
- **Non-TTY / Ctrl+C fallback**: entire flow wrapped in try/catch; any error falls through to help text mentioning `github-copilot/` format

### `src/index.ts`
- `// No flags: show current state` block replaced with dynamic `import('./settings-tui.js')` + `await runSettingsTui()`
- Dynamic import avoids loading TUI dependencies on every CLI invocation (mirrors existing pattern)
- Flag path (`--reviewer`, `--validator`, `--writer`) unchanged — TUI only activates when no flags given

### `src/templates/opencode-settings.md`
- `description` updated: adds "Run with no arguments for interactive picker."
- `argument-hint` updated: now includes `github-copilot/model-id` format alternative

### `src/templates/cursor-rms-settings/SKILL.md`
- Full rewrite with:
  - "Setting models with flags" section (both copilot: and github-copilot/ formats)
  - Provider table (copilot, anthropic, openai, google) with required credentials
  - **"Cursor model IDs cannot be used directly"** warning explaining Cursor-internal routing IDs
  - "Interactive picker" section describing TTY requirement and fallback behavior

---

## End-to-End Verification

| Check | Result |
|-------|--------|
| `bun run build` exits 0 | ✅ |
| `bun run test` — 185 tests pass | ✅ |
| `dist/settings-tui.js` exists | ✅ |
| `dist/templates/opencode-settings.md` contains "copilot" | ✅ |
| `dist/templates/cursor-rms-settings/SKILL.md` contains "Cursor model IDs" warning | ✅ |
| `echo "" | node dist/index.js settings` prints help text with `github-copilot/` format, exits 0 | ✅ |
| `node dist/index.js settings --reviewer copilot:claude-sonnet-4.6` saves config correctly | ✅ |
| `node dist/index.js settings --reset` deletes config | ✅ |

---

## Test Delta

No new tests added in this plan. The TUI is an interactive terminal function; non-TTY behavior is verified by subprocess (piped stdin) rather than unit tests. This matches the existing pattern in `src/index.test.ts` for the review scope prompt (also `@inquirer/prompts` based).

| File | Before | After | Delta |
|------|--------|-------|-------|
| All test files | 185 passing | 185 passing | 0 |
| setup.test.ts pre-existing failures | 2 | 2 | 0 (out of scope) |

---

## Deviations from Plan

### None — plan executed exactly as written.

The only note: the `cursor-rms-settings/SKILL.md` content in the plan had a stray trailing ` ``` ` that would have broken the markdown document. The SKILL.md was written without the errant fence to produce valid markdown. This is a formatting fix, not a functional deviation.

---

## Known Stubs

None — all TUI paths are fully wired. The MODELS lookup is complete for all four providers with the exact model lists specified in the plan.

---

## Threat Flags

No new network endpoints or trust boundaries introduced. All threat dispositions from the plan's threat model are satisfied:

| ID | Disposition | Status |
|----|-------------|--------|
| T-16-05 | accept | MODELS list is static in code — no runtime injection via TUI |
| T-16-06 | mitigate | ✅ ExitPromptError caught — falls through to help text, no unhandled rejection |
| T-16-07 | accept | Help text reveals only public provider names and example model IDs |

---

## Self-Check

- [x] `src/settings-tui.ts` exists and exports `runSettingsTui()`: ✅
- [x] `dist/settings-tui.js` exists after build: ✅
- [x] Commits `a048a97`, `cd2605f` exist in git log: ✅
- [x] `dist/templates/opencode-settings.md` contains "copilot": ✅
- [x] `dist/templates/cursor-rms-settings/SKILL.md` contains "Cursor model IDs cannot be used directly": ✅
- [x] Non-TTY behavior exits 0 with help text: ✅
- [x] Flag path unchanged (copilot saves correctly): ✅
- [x] 185 tests pass (same as Wave 1 baseline): ✅

## Self-Check: PASSED
