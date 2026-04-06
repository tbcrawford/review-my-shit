# Research: Phase 8 — Per-Agent Model Selection via JSON Config + /rms-settings

**Researched:** 2026-04-06
**Phase:** 08
**Status:** Complete

---

## Problem Statement

The current `resolveModel()` in `src/index.ts` reads two env vars (`AI_SDK_PROVIDER`, `AI_SDK_MODEL`) and returns a **single** Vercel AI SDK model instance used for all three pipeline agents (reviewer, validator, writer). This gives the user no way to assign different models to different agents.

The goal: replace this with a **per-agent JSON config** so users can assign the best model for each role (e.g., a cheap fast model for validation, a powerful model for reviewing).

---

## Architecture Analysis

### Current Model Flow

```
AI_SDK_PROVIDER + AI_SDK_MODEL env vars
        ↓
  resolveModel() in index.ts
        ↓ (single LanguageModel instance)
  runReviewer({ model })
  runValidator({ model })
  runWriter({ modelId: string })  ← writer only needs the string, not the instance
```

### Target Model Flow

```
~/.config/opencode/rms.json  OR  ~/.cursor/rms.json
        ↓
  loadRmsConfig() in new src/config.ts
        ↓ (RmsConfig object with per-agent model specs)
  resolveAgentModel(config.reviewer)
  resolveAgentModel(config.validator)
  resolveAgentModel(config.writer)     ← writer gets modelId string for metadata
```

---

## Config File Design

### Location Strategy

Config should live in **editor-specific config directories**, not in the project. This mirrors how OpenCode stores its config at `~/.config/opencode/` and Cursor at `~/.cursor/`.

**Chosen location:** `~/.config/rms/config.json`

Rationale:
- Editor-agnostic (works for both OpenCode and Cursor users)
- Follows XDG Base Directory spec (`~/.config/<app>/`)
- Avoids per-editor fragmentation — one config, both editors
- `os.homedir()` + path join = cross-platform safe
- Does NOT require `APPDATA` on Windows (XDG `~/.config` is accepted there too)

Alternative considered: `~/.rmsrc.json` (simpler but less conventional for a named app)

### Config Schema

```typescript
// src/config.ts
export interface AgentModelSpec {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
}

export interface RmsConfig {
  reviewer: AgentModelSpec;
  validator: AgentModelSpec;
  writer: AgentModelSpec;
}
```

**Example config.json:**
```json
{
  "reviewer": { "provider": "anthropic", "model": "claude-opus-4-5" },
  "validator": { "provider": "anthropic", "model": "claude-sonnet-4-5" },
  "writer": { "provider": "openai", "model": "gpt-4o" }
}
```

### Fallback Strategy

If config file doesn't exist → fall back to env vars (`AI_SDK_PROVIDER` / `AI_SDK_MODEL`) for all agents. This preserves backward compatibility for existing users who haven't run `/rms-settings`.

If config is partially defined (missing an agent key) → throw a clear error message telling the user to run `/rms-settings`.

### Zod Validation

Add `RmsConfigSchema` to `src/schemas.ts` using Zod for validation. Parse with `safeParse` and surface clear error messages on invalid config.

---

## Config Module: `src/config.ts`

New file. Responsibilities:
1. `getConfigPath()` → `~/.config/rms/config.json`
2. `loadRmsConfig()` → reads + validates JSON, returns `RmsConfig | null` (null = not found)
3. `saveRmsConfig(config)` → writes validated config to path (used by `/rms-settings`)
4. `resolveAgentModel(spec)` → returns Vercel AI SDK `LanguageModel` from `AgentModelSpec`

---

## `/rms-settings` Command Design

### Purpose
Guide the user through setting per-agent models. Outputs a config.json they can verify and save.

### OpenCode approach
Since OpenCode command templates use `subtask: true` + `!node dist/index.js ...`, the `rms settings` CLI command should:
1. Print current config (if exists) or defaults
2. Print example config.json content
3. Print the config file path
4. Optionally accept `--reviewer`, `--validator`, `--writer` flags to set individual agents in a single invocation

**Template behavior (opencode-settings.md):**
The AI agent reads the output and presents it to the user with instructions on how to edit the config file manually OR uses the flags to set values.

### CLI sub-command: `rms settings`
```
rms settings                                  # show current config + path
rms settings --reviewer anthropic:claude-opus-4-5
rms settings --validator anthropic:claude-sonnet-4-5
rms settings --writer openai:gpt-4o
rms settings --reset                          # delete config, revert to env vars
```

Format for model spec in CLI: `{provider}:{model}` — colon-separated for easy shell passing.

### Cursor approach
`cursor-settings.md` template instructs the AI agent to:
1. Run `node dist/index.js settings` to show the current state
2. Use the flags to set models interactively based on user choices

---

## Impact on Existing Code

### `src/index.ts` changes
1. Remove `resolveModel()` function
2. Add `loadRmsConfig()` call before pipeline runs
3. Call `resolveAgentModel(config.reviewer)` for reviewer model
4. Call `resolveAgentModel(config.validator)` for validator model
5. Pass `config.writer.model` string to `runWriter({ modelId })`
6. Add `settings` CLI sub-command

### `src/reviewer.ts` — NO CHANGE
`ReviewerOptions.model` already accepts `Parameters<typeof generateText>[0]['model']` — just gets a different value.

### `src/validator.ts` — NO CHANGE
Same as reviewer — interface unchanged.

### `src/writer.ts` — NO CHANGE
Already only uses `modelId: string` for metadata. No model instance needed.

### `src/schemas.ts` — ADD `RmsConfigSchema`
Add Zod schema for config validation without breaking existing schemas.

### `src/installer.ts` — ADD settings template
Add `{ template: 'opencode-settings.md', dest: '.opencode/commands/rms-settings.md' }` and Cursor equivalent.

### `src/templates/` — ADD 2 new templates
- `opencode-settings.md`
- `cursor-settings.md`

### `AGENTS.md` — UPDATE env var docs
Document the new config file approach, deprecate env var docs (keep as fallback).

---

## Testing Strategy

### `src/config.test.ts` (new)
- `getConfigPath()` returns `~/.config/rms/config.json`
- `loadRmsConfig()` returns null when file missing
- `loadRmsConfig()` returns parsed config when valid file exists
- `loadRmsConfig()` throws on invalid JSON
- `loadRmsConfig()` throws on schema violation (missing field, wrong provider)
- `saveRmsConfig()` writes validated config to correct path
- `resolveAgentModel({ provider: 'openai', model: 'gpt-4o' })` returns object (structural check, no real LLM call)

### Existing tests — NO CHANGES EXPECTED
Reviewer, validator, writer tests all use `_mockGenerateText` — model instance is never exercised. Config changes in `index.ts` don't affect unit-testable modules.

### Integration check
`npm test` must still pass 139+ tests after changes.

---

## Validation Architecture

### What to validate in tests
1. Config schema: all required agent keys present, provider is valid enum, model is non-empty string
2. Config loading: file-not-found returns null (graceful), invalid JSON throws with clear message
3. Config saving: round-trip (save → load → compare) produces identical object
4. Fallback: when config is null, env var fallback produces a model instance (structural test)
5. CLI settings command: `rms settings` exits 0 with config path in stdout

### What NOT to test
- Real LLM API calls (no credentials in CI)
- Actual OpenCode/Cursor command discovery (editor-specific, manual verification)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users confused about config location | Medium | `/rms-settings` command shows exact path |
| Env var fallback breaks existing users | Low | Preserve env var logic as fallback when config absent |
| `~/.config/rms/` dir doesn't exist on fresh install | Low | `mkdir({ recursive: true })` before writing |
| Windows path issues | Low | `os.homedir()` + `path.join()` handles cross-platform |
| Template install adds 2 new commands — existing `rms install` users don't get them | Medium | Document in AGENTS.md: re-run `rms install` after upgrade |

---

## Implementation Order (Dependency-Driven)

1. **Plan 01:** `src/config.ts` + `src/schemas.ts` (RmsConfigSchema) + `src/config.test.ts` — the config layer with full tests
2. **Plan 02:** `src/index.ts` (wire config into pipeline) + `src/installer.ts` + 2 new templates + `AGENTS.md` update — the integration + settings command

This ordering ensures the config module is tested before it's wired into the orchestrator.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Config at `~/.config/rms/config.json` | XDG-compliant, editor-agnostic, cross-platform |
| CLI format `provider:model` | Shell-friendly, unambiguous, no quoting issues |
| `null` return for missing config (not throw) | Enables graceful env var fallback |
| Zod schema in `schemas.ts` | Single source of truth; consistent with existing pattern |
| Settings command prints path + current state | Users know exactly where to look without hunting |
| No auto-detection of editor | Users pick their models; rms doesn't guess |

---

## RESEARCH COMPLETE

Phase 8 is well-scoped. The codebase is clean and modular — changes are isolated to `src/config.ts` (new), `src/index.ts` (wire), `src/schemas.ts` (add schema), `src/installer.ts` (add template entries), and 2 new template files. No changes to reviewer, validator, or writer modules. Existing 139 tests should pass without modification.
