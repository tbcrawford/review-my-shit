<!-- GSD:project-start source:PROJECT.md -->
## Project

**review-my-shit (rms)**

A slash command-driven code review system for OpenCode and Cursor. Three fully isolated agents — a primary reviewer, a validator, and a writer — collaborate to produce structured, auditable review reports written to `.reviews/`. A separate fix command lets users selectively apply findings after personal review.

**Core Value:** The reviewer catches problems a developer would miss; the validator catches problems the reviewer would miss — and both are fully auditable.

### Constraints

- **Integration**: OpenCode and Cursor slash command conventions — must work within those invocation models
- **Language agnosticism**: Reviewer logic must not assume any specific language, framework, or toolchain
- **Isolation**: Validator must not receive the primary reviewer's reasoning — only its structured output — to preserve adversarial independence
- **No auto-fix**: The fix command is a separate, explicit user action — never automatic
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Key Architectural Insight: This Is Not a Traditional CLI Tool
## Editor Integration Layer
### OpenCode — Commands
- `$ARGUMENTS` — positional args from user input (`$1`, `$2`, etc.)
- `!`command`` — injects shell output into the prompt at runtime
- `@file.ts` — includes file contents in the prompt
- `subtask: true` — forces the command to run as a subagent, isolating it from the primary context (critical for the validator isolation requirement)
- `agent:` — pins the command to a specific agent configuration
- `model:` — overrides the model per command
- Scopes: global (`~/.config/opencode/commands/`) or per-project (`.opencode/commands/`)
### OpenCode — Custom Agents
- `mode: subagent` — agent is invokable via `@name` or by primary agent via Task tool
- `permission.edit: deny` — read-only access (validator should not write files)
- `permission.task` — controls which subagents this agent can spawn
- `hidden: true` — hides from `@` autocomplete, only invokable programmatically
### Cursor — Commands
# Review My Code
- Skills live in `.cursor/skills/<name>/SKILL.md`
- Invoked via `/skill-name` or `@skill-name`
- Support `scripts/`, `references/`, `assets/` subdirectories
- Compatible standard: `agentskills.io`
### Cross-Editor Compatibility Strategy
## AI Agent Orchestration
### Vercel AI SDK v6 (latest stable)
- **Provider-agnostic** — `rms` must use whatever model the editor has configured. The AI SDK's provider abstraction is the right fit: swap providers without rewriting orchestration code.
- **Orchestrator-worker pattern built-in** — the SDK's `generateText` + `Promise.all` pattern is precisely what the three-agent pipeline needs (reviewer → parallel validator → sequential writer)
- **Structured output with Zod** — `generateText` + `Output.object({ schema: z.object({...}) })` produces typed, validated JSON from any model. Required for finding ID generation and structured report output.
- **No lock-in** — not tied to Vercel infrastructure; runs in any Node.js environment
# Provider packages — install only the ones needed
- **Mastra** — higher abstraction, brings persistence/memory/workflow state that rms doesn't need; adds significant setup complexity for a tool that runs in-editor
- **LangChain.js** — verbose, abstraction-heavy, poor DX for simple sequential agent pipelines; overkill
- **OpenAI Agents SDK** — OpenAI-specific; breaks provider-agnosticism requirement
## Structured Output & Schema Validation
### Zod v3 (stable)
- Defining the `Finding` schema (id, file, line, severity, explanation, suggestion, dimension)
- Defining `ReviewerOutput`, `ValidatorOutput`, `FinalReport` schemas
- Runtime validation of LLM output before writing to disk
## Finding ID Generation
### nanoid v5
- 157M weekly downloads (npm, verified Apr 2026) — extremely well-established
- 118 bytes, no dependencies
- Cryptographically secure, URL-safe (important for file paths and cross-references)
- Shorter than UUID v4 (21 chars default vs 36 chars UUID) — better for human-readable audit trails
- ESM-native with CJS shim available
- `crypto.randomUUID()` — 36-char UUIDs are unnecessarily long for this use case
- `short-unique-id` — far lower adoption; nanoid is the standard
## Git Integration
### simple-git v3
- 3.33.0 as of Apr 2026 (actively maintained)
- Node.js native git wrapper — handles `git diff`, `git log`, branch detection
- Typed API, Promise-based, no spawning raw shell required
- Only library at this adoption level for Node.js git operations
## File System Output
### Node.js `fs/promises` (built-in)
- Creating the review directory (`mkdir -p .reviews/<review-id>/`)
- Writing role output files (`reviewer.md`, `validator.md`, `report.md`)
## CLI Argument Parsing (Fix Command only)
### Commander.js v12+
- ~50M weekly downloads (npm, 2026) — by far the most used Node CLI parser
- Zero dependencies
- Excellent TypeScript types
- Minimal API — perfect for a two-subcommand tool (`review`, `fix`)
- Used by Vue CLI, Create React App, and many major tools
- **yargs** — more config, better for complex CLIs with many options; overkill here
- **oclif** — plugin-based framework designed for large CLI products (Heroku, Salesforce); massive overhead for a 2-command tool
- **citty** — UnJS ecosystem, newer, less battle-tested than Commander for this use case
## TypeScript Configuration
### TypeScript 5.x + tsx (for development)
- The project will have Zod schemas, AI SDK types, and complex data structures — TypeScript prevents entire classes of runtime errors
- Both the AI SDK and Commander have excellent first-party types
- Ship TypeScript source + require tsx/ts-node at runtime (fine for a developer tool)
- Or compile to JS with `tsc` for the fix command
## Output Format
### Markdown files (`.md`)
- Directly readable by humans in any editor
- Directly readable by AI agents in future editor invocations (feeding fix command context)
- No serialization library needed — `fs/promises.writeFile` with a template literal
- Durable: no database, no binary format, just text files in `.reviews/`
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI orchestration | Vercel AI SDK v6 | Mastra | Mastra adds persistence, workflows, and memory — none needed here; more setup for no benefit |
| AI orchestration | Vercel AI SDK v6 | LangChain.js | Verbose abstraction, poor DX for simple sequential pipelines, heavy bundle |
| AI orchestration | Vercel AI SDK v6 | Raw `fetch` | Loses provider abstraction; breaks when editor model changes |
| CLI framework | Commander.js | yargs | yargs better for complex CLIs with many subcommands; overkill for 2 commands |
| CLI framework | Commander.js | oclif | Plugin framework for large multi-team CLIs; wrong scale |
| Finding ID | nanoid | crypto.randomUUID | UUID is 36 chars; nanoid is 21 chars, more readable in audit trails |
| Schema | Zod | Joi / yup | AI SDK requires Zod; no reason to add a second validator |
| Git ops | simple-git | raw `child_process` | simple-git handles edge cases (Windows, error handling); well-typed |
| File output | fs/promises | SQLite / JSON DB | Overkill; files are the right primitive for audit trail + human readability |
| Language | TypeScript | Python | Python would require separate install; TS matches editor ecosystems; AI SDK is TS-native |
| Language | TypeScript | Go | Go binary distribution is better for public CLIs; not needed for a dev-tool shipped as files |
## Complete Dependency List
# Core runtime
# Dev
# Optional: specific AI providers (if adding Node.js orchestration script)
## Confidence Assessment
| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| OpenCode slash command format | HIGH | Official opencode.ai/docs/commands (Apr 2, 2026) | Frontmatter, $ARGUMENTS, !`shell`, subtask all verified |
| OpenCode agent config | HIGH | Official opencode.ai/docs/agents (Apr 2, 2026) | Subagent isolation, permissions verified |
| Cursor command format | HIGH | Official cursor.com changelog 1.6 (Sep 2025) + docs | `.cursor/commands/<name>.md` confirmed |
| Cursor skills format | HIGH | Official cursor.com/docs/context/skills (Apr 2026) | SKILL.md frontmatter, .agents/skills/ paths verified |
| Vercel AI SDK v6 | HIGH | ai-sdk.dev official docs (Apr 2026) + Context7 HIGH | v6 is current stable; v4/v5 maintenance/legacy |
| AI SDK orchestrator-worker pattern | HIGH | Context7 (verified against official repo docs) | `generateText` + `Promise.all` pattern shown with code |
| Zod structured output | HIGH | Context7 + official AI SDK docs | `Output.object({ schema: z.object() })` is canonical API |
| Commander.js | HIGH | pkgpulse.com 2026 + npm registry | 50M weekly downloads; clear leader for simple CLIs |
| nanoid | HIGH | npm registry (157M downloads, v5.1.7 Mar 2026) | Dominant ID generation library |
| simple-git | MEDIUM-HIGH | npm registry (v3.33.0) | Well-established, but verify v3 API before implementation |
| AGENTS.md cross-editor compat | HIGH | Both official doc sets verified | Standard supported in OpenCode, Cursor, Claude Code |
## Critical Design Decision: Pure Prompt vs. Hybrid Architecture
- The entire workflow is prompt instructions in `.md` files
- The host AI agent (OpenCode/Cursor) orchestrates the three roles using its built-in subagent/Task tool
- Pros: zero install, works immediately in any editor, no runtime dependency
- Cons: less control over isolation guarantees; harder to enforce structured output format; validator isolation depends on editor's subagent implementation
- Slash command file calls `!`node .rms/orchestrate.js --scope staged``
- Node.js script uses AI SDK to make three isolated `generateText` calls with Zod schemas
- Writes output to `.reviews/` directly
- Pros: total control over isolation, structured output guaranteed, finding IDs deterministic
- Cons: requires Node.js in PATH; slightly more setup
## Sources
- OpenCode official docs (opencode.ai/docs/): commands, agents, config — verified Apr 2, 2026
- Cursor official changelog 1.6 (Sep 2025): custom slash commands launched
- Cursor official docs (cursor.com/docs/): rules, skills, commands — verified Apr 3, 2026
- Vercel AI SDK official docs (ai-sdk.dev): v6 stable — verified Apr 2026
- Context7 /vercel/ai (HIGH reputation, 4369 snippets): orchestration patterns, structured output
- npm registry: nanoid v5.1.7 (157M/wk), simple-git v3.33.0, Commander.js (50M/wk) — verified Apr 2026
- pkgpulse.com "Best CLI Frameworks for Node.js in 2026" (Mar 8, 2026)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
