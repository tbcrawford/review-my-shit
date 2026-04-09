# Phase 17 Context: Command UX Overhaul

## Goal

Replace all flag-based command invocations with flag-free, interactive UX. Add three dedicated model-picker commands (`/rms-reviewer`, `/rms-validator`, `/rms-writer`). Make `/rms-review` route intelligently like `/gsd-do`. Create default config on install so users can start without manual setup.

---

## Design Decisions (captured pre-planning)

### 1. No flag usage in any rms command

All `/rms-*` commands must work with zero flags. If a command needs input (scope, model, etc.) it must prompt interactively using `@inquirer/prompts` or the OpenCode `question` selector. This is the core constraint of the phase.

### 2. `/rms-review` — intelligent routing

Behaves like `/gsd-do`: when invoked with no arguments, it prompts the user interactively for scope (local diff vs PR number). When invoked with a clear argument (e.g., `/rms-review local` or `/rms-review pr 42`), it routes directly without prompting.

The command template should be smart: detect if the argument is blank and route accordingly — no flag needed.

### 3. Three new commands: `/rms-reviewer`, `/rms-validator`, `/rms-writer`

Each command opens an interactive model picker for the corresponding agent. The picker shows:
- Variant tiers as top options: **max / high / medium / low** (with the specific model name shown beside each tier)
- Option to enter a custom model string (e.g., `github-copilot/my-model`)

Variants map to well-known models per provider tier — the picker resolves variants based on the currently configured provider.

### 4. Variant tiers in the picker

Variants are shown as picker options (not CLI flags). When a user selects "high", it maps to the best-available high-tier model for their provider. Suggested cross-provider tier mapping:

| Tier | Anthropic | OpenAI | Google | Copilot (Anthropic) | Copilot (OpenAI) |
|------|-----------|--------|--------|----------------------|------------------|
| max  | claude-opus-4-5 | o3 | gemini-2.5-pro | github-copilot/claude-opus-4-5 | github-copilot/o3 |
| high | claude-sonnet-4-5 | gpt-4o | gemini-2.0-pro | github-copilot/claude-sonnet-4-5 | github-copilot/gpt-4o |
| medium | claude-haiku-3-5 | gpt-4o-mini | gemini-2.0-flash | github-copilot/claude-haiku-3-5 | github-copilot/gpt-4o-mini |
| low  | claude-haiku-3-5 | gpt-4o-mini | gemini-flash-1.5 | github-copilot/claude-haiku-3-5 | github-copilot/gpt-4o-mini |

The picker for each command shows the top 3-4 recommended options first, then an "Enter custom" option.

### 5. Default config created on install

`rms install` (and `npx review-my-shit`) must create `~/.config/rms/config.json` with defaults if it doesn't already exist. Users should not need to run any model configuration command to get started.

**Default models (confirmed by user):**
```json
{
  "reviewer": { "provider": "copilot", "model": "claude-opus-4-5" },
  "validator": { "provider": "copilot", "model": "github-copilot/gpt-5.4" },
  "writer":   { "provider": "copilot", "model": "github-copilot/claude-haiku-4.5" }
}
```

> Note: reviewer and validator intentionally use different underlying model families (Anthropic vs OpenAI) to reduce correlated errors, even though both are accessed via Copilot.

### 6. `/rms-settings` — kept as overview + reset only

`/rms-settings` shows the current config (which models are set for each agent) and offers a reset option. It does NOT open a model picker — that's the job of `/rms-reviewer`, `/rms-validator`, `/rms-writer`.

The existing `rms settings` CLI subcommand (with `--reviewer`/`--validator`/`--writer`/`--reset` flags) can remain for scripting use; the editor command is the flag-free face.

### 7. Inspiration: gsd command design

Take direct inspiration from https://github.com/gsd-build/get-shit-done for command structure. Commands must be easy and obvious. No hidden features behind flags in the editor commands.

---

## New Commands Summary

| Command | Description | Behavior |
|---------|-------------|----------|
| `/rms-review` | Run a review | Prompts for scope if no arg; routes to local or PR if arg provided |
| `/rms-fix` | Apply a finding | Prompts interactively for finding ID if no arg |
| `/rms-reviewer` | Set reviewer model | Opens interactive model picker with variant tiers |
| `/rms-validator` | Set validator model | Opens interactive model picker with variant tiers |
| `/rms-writer` | Set writer model | Opens interactive model picker with variant tiers |
| `/rms-settings` | View config + reset | Shows current config; offers reset option; no model picker |

---

## Codebase Context

- Language: TypeScript + Node.js, ESM, NodeNext resolution
- CLI: Commander.js v14
- TUI: `@inquirer/prompts` (arrow-key selectors, checkbox multi-select)
- Colors: chalk v5
- Config: `~/.config/rms/config.json` — schema defined in `src/schemas.ts`
- Settings TUI: `src/settings-tui.ts` (exists from Phase 16, has interactive picker)
- Installer: `src/installer.ts` + `src/setup.ts`
- Templates: `src/templates/` — copied to `dist/templates/` on build
- Test runner: vitest

---

## Constraints

- All new editor commands must work in both OpenCode and Cursor
- OpenCode commands use `subtask: true` + `!rms <subcommand>` injection
- Cursor commands are skills in `~/.cursor/skills/`
- `rms install` must write all new command templates
- Default config must not overwrite an existing `~/.config/rms/config.json`
- Build and all tests must pass at end of phase
