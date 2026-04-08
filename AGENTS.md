# rms — Agent & Editor Integration Guide

**review-my-shit (rms)** is a three-agent code review pipeline that runs inside OpenCode and Cursor. This document describes the pipeline architecture, isolation model, editor-specific behaviors, and known gotchas for AI agents working in this repository.

---

## Pipeline Overview

Every review runs three agents in strict sequence:

```
User invokes /rms-review
         │
         ▼
  ┌─────────────┐
  │  Reviewer   │  Analyzes the diff across 11 dimensions.
  │  (isolated) │  Writes REVIEWER.md. Assigns no IDs.
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Validator  │  Challenges the reviewer's findings adversarially.
  │  (isolated) │  Reads REVIEWER.md + INPUT.md. Writes VALIDATOR.md.
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   Writer    │  Merges findings + verdicts into REPORT.md.
  │             │  Assigns sequential finding IDs (e.g. SEC-00001).
  └──────┬──────┘
         │
         ▼
  .reviews/<session-id>/
    INPUT.md       ← scope, focus, and diff
    REVIEWER.md    ← primary reviewer output
    VALIDATOR.md   ← validator verdicts
    REPORT.md      ← final merged report
```

All three agents run as isolated `generateText` calls via the Vercel AI SDK. No shared session history. The pipeline is orchestrated by the Node.js CLI (`dist/index.js`), not by the editor.

---

## Isolation Model

**Reviewer isolation:** The reviewer receives only the diff and its prompt. It has no access to any prior conversation, editor session state, or reviewer history.

**Validator isolation:** The validator receives REVIEWER.md (structured findings) and INPUT.md (diff context). It does NOT receive the reviewer's chain-of-thought, intermediate reasoning, or any system prompt from the reviewer call. This adversarial separation is enforced at the code level in `src/validator.ts` — the validator's `generateText` call is completely independent.

**Prompt injection hardening:** Both reviewer and validator prompts wrap user-controlled content (the diff, REVIEWER.md, INPUT.md) in XML tags (`<diff>`, `<reviewer-md>`, `<input-md>`) with explicit instructions to treat that content as data, not as executable instructions.

**Finding IDs:** IDs are assigned by the orchestrator (`src/finding-id.ts`), never by the LLM. IDs are globally sequential and dimension-prefixed: `SEC-00001`, `BUG-00002`, etc. The counter persists in `.reviews/.counter`.

---

## Commands

### OpenCode

Commands are installed globally to `~/.config/opencode/command/` via `rms install`.

| Command | Description | Isolation |
|---------|-------------|-----------|
| `/rms-review [local\|pr <number>] [--focus <dim>]` | Unified review — prompts for scope if none given | `subtask: true` (mechanical) |
| `/rms-fix [<finding-id>] [--session <id>]` | Show or apply a finding | `subtask: true` (mechanical) |
| `/rms-settings [--reviewer p:m] [--validator p:m] [--writer p:m] [--reset]` | View or set per-agent model config | `subtask: true` (mechanical) |

OpenCode commands use `subtask: true` in frontmatter, which forces execution in a fresh subagent context. The `!rms ...` pattern injects the shell output (the globally-installed `rms` binary's stdout) directly into the agent's response.

### Cursor

Skills are installed globally to `~/.cursor/skills/` via `node dist/index.js install`. Each command becomes a skill directory (`rms-review/SKILL.md`, `rms-fix/SKILL.md`, `rms-settings/SKILL.md`) — available in all projects automatically.

| Command | Description | Isolation |
|---------|-------------|-----------|
| `/rms-review [local\|pr <number>] [--focus <dim>]` | Unified review — prompts for scope if none given | Prompt-enforced |
| `/rms-fix [<finding-id>] [--session <id>]` | Show or apply a finding | Prompt-enforced |
| `/rms-settings [--reviewer p:m] [--validator p:m] [--writer p:m] [--reset]` | View or set per-agent model config | Prompt-enforced |

Cursor commands use the terminal to run `node dist/index.js ...` and then present the output. Isolation is prompt-enforced rather than mechanically enforced — the agent is instructed to run the command and present results, but no `subtask: true` equivalent exists in Cursor.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `~/.config/rms/config.json` | No | — | Per-agent model config (preferred over env vars) |
| `AI_SDK_PROVIDER` | Fallback only | `openai` | AI provider when no config file exists |
| `AI_SDK_MODEL` | Fallback only | `gpt-4o` | Model ID when no config file exists |
| `GITHUB_TOKEN` | For PR reviews | — | GitHub Personal Access Token for PR diff fetching |
| `OPENAI_API_KEY` | If provider=openai | — | Standard provider key |
| `ANTHROPIC_API_KEY` | If provider=anthropic | — | Standard provider key |

---

## Per-Agent Model Configuration

Per-agent model selection is configured via `~/.config/rms/config.json`. Use the `/rms-settings` command to view or set models:

```json
{
  "reviewer": { "provider": "anthropic", "model": "claude-opus-4-5" },
  "validator": { "provider": "anthropic", "model": "claude-sonnet-4-5" },
  "writer": { "provider": "openai", "model": "gpt-4o" }
}
```

**Supported providers:** `openai`, `anthropic`, `google`

If the config file is absent, rms falls back to `AI_SDK_PROVIDER` + `AI_SDK_MODEL` env vars (all three agents use the same model).

Re-run `rms install` after upgrading to pick up the new `/rms-settings` command.

---

## Known Editor-Specific Behaviors

### OpenCode

- **Session reload after `/new`:** OpenCode does not reload custom commands or AGENTS.md after `/new` within the same session. This is a known upstream issue (#11532). **Impact on rms:** None — the Node.js CLI process owns all filesystem state. Reviews written to `.reviews/` before `/new` are not lost. The user may lose track of their session ID in the conversation context, but the files on disk are safe.

- **`subtask: true` behavior:** The command runs in a fully isolated subagent. The subagent has no access to conversation history. The shell command runs synchronously; the output is injected into the subagent's final response.

- **`!command` injection:** The `!node dist/index.js ...` syntax runs the command at prompt-evaluation time and injects stdout. If the CLI exits with a non-zero code, the error output is injected instead.

### Cursor

- **No mechanical isolation:** Cursor does not have a `subtask: true` equivalent. Isolation is achieved by instructing the agent to run the terminal command and present output — the agent controls this, not the framework.

- **Terminal execution:** Cursor skills run `rms <subcommand> $ARGUMENTS` via the terminal tool. The agent then reads the REPORT.md output and presents it to the user.

- **Build requirement:** `dist/` must exist before any command runs. If not present, run `bun run build` first. The commands do not auto-build.

---

## Build & Test

```bash
# Build (required before running any command)
bun run build

# Run all tests
bun run test

# Install commands into ~/.config/opencode/command/ and ~/.cursor/skills/
node dist/index.js install
```

**Test framework:** Node.js built-in `node:test` with `tsx` for TypeScript execution. No external test runner required.

**Tests must pass before committing.** The test suite covers: diff preprocessing, reviewer prompt structure, validator isolation, writer output, finding ID generation, pipeline I/O parsing, and session management.

---

## Output Structure

Every review creates a session directory:

```
.reviews/
├── .counter                        ← global finding ID counter
└── <timestamp>-<slug>/
    ├── INPUT.md                    ← scope, focus, diff
    ├── REVIEWER.md                 ← primary reviewer findings
    ├── VALIDATOR.md                ← validator verdicts
    └── REPORT.md                  ← final merged report
```

`.reviews/` is gitignored. Review artifacts are local only.

---

## Conventions

- **Language agnostic:** All reviewer and validator prompts must remain language and framework agnostic. Do not add language-specific instructions to `REVIEWER_PROMPT` or `VALIDATOR_PROMPT`.
- **No auto-fix:** The fix command presents findings for user review. It does not apply changes automatically. The user reads the finding and decides what to do.
- **Structured output:** Findings use `<finding>` blocks; verdicts use `<verdict>` blocks. These are parsed by `src/pipeline-io.ts`. Do not change the tag names without updating the parser.
- **ID assignment:** Finding IDs are assigned by `src/finding-id.ts` after the LLM responds. The LLM must never generate IDs.
