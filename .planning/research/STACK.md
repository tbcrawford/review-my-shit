# Technology Stack

**Project:** review-my-shit (rms)
**Researched:** 2026-04-03
**Overall confidence:** HIGH (all major claims verified against official docs)

---

## Key Architectural Insight: This Is Not a Traditional CLI Tool

Before diving into stack choices, a critical framing:

`rms` is **not** a standalone CLI binary invoked from the shell. It is a **slash command-driven AI agent workflow** that lives inside OpenCode and Cursor as `.md` files. The "orchestration logic" is instructions to the host AI agent — not imperative code running in a separate process. Understanding this shapes every stack decision.

There are **two distinct surfaces**:
1. **Slash commands** — Markdown files that define the `/review` and `/fix` commands inside OpenCode and Cursor
2. **Agent skill/SKILL.md files** — The structured instructions the host agent follows to perform the multi-role review workflow

There is no separate Node.js/Python/Go process to install. The tool ships as files.

---

## Editor Integration Layer

### OpenCode — Commands

**Source:** [opencode.ai/docs/commands](https://opencode.ai/docs/commands/) (official, verified Apr 2, 2026)

Commands live in `.opencode/commands/<name>.md`. They surface in the TUI when you type `/`.

**File format:**
```markdown
---
description: Review code across 11 dimensions with adversarial validation
agent: build
subtask: true
model: anthropic/claude-sonnet-4-20250514
---

$ARGUMENTS prompt content here...
!`git diff --staged`
```

**Key capabilities:**
- `$ARGUMENTS` — positional args from user input (`$1`, `$2`, etc.)
- `!`command`` — injects shell output into the prompt at runtime
- `@file.ts` — includes file contents in the prompt
- `subtask: true` — forces the command to run as a subagent, isolating it from the primary context (critical for the validator isolation requirement)
- `agent:` — pins the command to a specific agent configuration
- `model:` — overrides the model per command
- Scopes: global (`~/.config/opencode/commands/`) or per-project (`.opencode/commands/`)

**Confidence:** HIGH — read directly from official opencode.ai docs (updated Apr 2, 2026)

---

### OpenCode — Custom Agents

**Source:** [opencode.ai/docs/agents](https://opencode.ai/docs/agents/) (official, verified Apr 2, 2026)

For the three-role design (reviewer, validator, writer), define custom subagents. Each role gets its own `.opencode/agents/<name>.md`:

```markdown
---
description: Adversarial validator — challenges reviewer findings without seeing reviewer reasoning
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": deny
---

System prompt for the validator role...
```

**Key options:**
- `mode: subagent` — agent is invokable via `@name` or by primary agent via Task tool
- `permission.edit: deny` — read-only access (validator should not write files)
- `permission.task` — controls which subagents this agent can spawn
- `hidden: true` — hides from `@` autocomplete, only invokable programmatically

**Confidence:** HIGH — official docs

---

### Cursor — Commands

**Source:** [cursor.com changelog 1.6](https://cursor.com/changelog/1-6) (official, Sep 12, 2025) + [cursor.com/docs/context/rules](https://www.cursor.com/docs/context/rules) (official, verified Apr 3, 2026)

Commands live in `.cursor/commands/<name>.md`. They surface when you type `/` in Agent chat.

```markdown
# Review My Code

Review the following diff for bugs, security issues, and design problems.

!`git diff --staged`
```

**Scope:** Per-project (`.cursor/commands/`) — committed to the repo so the team shares commands.

**Cursor also supports Skills** (as of Cursor 2.4+, early 2026) as a superset of commands:
- Skills live in `.cursor/skills/<name>/SKILL.md`
- Invoked via `/skill-name` or `@skill-name`
- Support `scripts/`, `references/`, `assets/` subdirectories
- Compatible standard: `agentskills.io`

**Recommendation:** Ship both a `.cursor/commands/review.md` (simple prompt) and a `.agents/skills/code-review/SKILL.md` (full workflow instructions). The skill file is the authoritative workflow definition; the command file is the entry point that loads it.

**Confidence:** HIGH — official Cursor changelog and docs

---

### Cross-Editor Compatibility Strategy

Both editors support `AGENTS.md` at the project root and in subdirectories. This is the lowest-common-denominator format — plain markdown, no frontmatter. Use it for global context (what this tool does, how agents should behave).

**File layout for cross-editor support:**
```
.opencode/
  commands/
    review.md          # /review entry point for OpenCode
    fix.md             # /fix entry point for OpenCode
  agents/
    rms-reviewer.md    # primary reviewer agent config
    rms-validator.md   # validator agent config (read-only perms)
    rms-writer.md      # writer/synthesizer agent config

.cursor/
  commands/
    review.md          # /review entry point for Cursor
    fix.md             # /fix entry point for Cursor

.agents/
  skills/
    code-review/
      SKILL.md         # canonical workflow (works in both editors + Claude Code)
      references/
        REVIEW_DIMENSIONS.md
        OUTPUT_FORMAT.md

AGENTS.md              # global project context for all editors
```

**Confidence:** HIGH — verified against both official doc sets

---

## AI Agent Orchestration

### Vercel AI SDK v6 (latest stable)

**Source:** [ai-sdk.dev](https://ai-sdk.dev) (official, v6 is current as of Apr 2026) + Context7 (HIGH reputation)

**Why AI SDK v6:**
- **Provider-agnostic** — `rms` must use whatever model the editor has configured. The AI SDK's provider abstraction is the right fit: swap providers without rewriting orchestration code.
- **Orchestrator-worker pattern built-in** — the SDK's `generateText` + `Promise.all` pattern is precisely what the three-agent pipeline needs (reviewer → parallel validator → sequential writer)
- **Structured output with Zod** — `generateText` + `Output.object({ schema: z.object({...}) })` produces typed, validated JSON from any model. Required for finding ID generation and structured report output.
- **No lock-in** — not tied to Vercel infrastructure; runs in any Node.js environment

**However:** If the tool is pure prompt files (no separate process), the AI SDK is only relevant if we add a thin Node.js orchestration layer (e.g., a `scripts/orchestrate.js` called via `!`node scripts/orchestrate.js`` from a command file). This is a valid architectural choice if prompt-only coordination proves too unreliable.

**Install:**
```bash
npm install ai zod
# Provider packages — install only the ones needed
npm install @ai-sdk/anthropic @ai-sdk/openai
```

**Key patterns for rms:**
```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

// Three isolated agent calls — reviewer has no access to validator reasoning
const [reviewerOutput, validatorOutput] = await Promise.all([
  generateText({
    model: reviewerModel,
    system: reviewerSystemPrompt,
    prompt: diff,
    output: Output.object({ schema: FindingsSchema }),
  }),
  generateText({
    model: validatorModel,
    system: validatorSystemPrompt,
    prompt: diff, // same diff — no reviewer reasoning
    output: Output.object({ schema: ValidatorSchema }),
  }),
]);

// Writer runs sequentially after both complete
const writerOutput = await generateText({
  model: writerModel,
  system: writerSystemPrompt,
  prompt: synthesizeInputs(reviewerOutput, validatorOutput),
  output: Output.object({ schema: FinalReportSchema }),
});
```

**Version:** `ai@6.x` (stable as of Apr 2026; v4/v5 are maintenance/legacy)

**Confidence:** HIGH — official docs, Context7 HIGH reputation source

**What NOT to use:**
- **Mastra** — higher abstraction, brings persistence/memory/workflow state that rms doesn't need; adds significant setup complexity for a tool that runs in-editor
- **LangChain.js** — verbose, abstraction-heavy, poor DX for simple sequential agent pipelines; overkill
- **OpenAI Agents SDK** — OpenAI-specific; breaks provider-agnosticism requirement

---

## Structured Output & Schema Validation

### Zod v3 (stable)

**Why:** The AI SDK's `Output.object()` API requires Zod schemas. Zod is the de-facto TypeScript schema library (used in Create React App, tRPC, many others). No realistic alternative for this use case.

**Use for:**
- Defining the `Finding` schema (id, file, line, severity, explanation, suggestion, dimension)
- Defining `ReviewerOutput`, `ValidatorOutput`, `FinalReport` schemas
- Runtime validation of LLM output before writing to disk

```typescript
const FindingSchema = z.object({
  id: z.string(),         // nanoid-generated, e.g. "rms_4k2xPq"
  file: z.string(),
  line: z.union([z.number(), z.null()]),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  dimension: z.string(),  // one of the 11 review dimensions
  explanation: z.string(),
  suggestion: z.string(),
});
```

**Install:** `npm install zod`

**Confidence:** HIGH — verified via Context7 (Vercel AI SDK docs show Zod as required peer)

---

## Finding ID Generation

### nanoid v5

**Why:**
- 157M weekly downloads (npm, verified Apr 2026) — extremely well-established
- 118 bytes, no dependencies
- Cryptographically secure, URL-safe (important for file paths and cross-references)
- Shorter than UUID v4 (21 chars default vs 36 chars UUID) — better for human-readable audit trails
- ESM-native with CJS shim available

**Pattern:**
```typescript
import { nanoid } from 'nanoid';
const findingId = `rms_${nanoid(8)}`; // e.g. "rms_4k2xPq7R"
```

The `rms_` prefix makes IDs recognizable in the fix command (`rms fix rms_4k2xPq7R`).

**DO NOT use:**
- `crypto.randomUUID()` — 36-char UUIDs are unnecessarily long for this use case
- `short-unique-id` — far lower adoption; nanoid is the standard

**Install:** `npm install nanoid`

**Confidence:** HIGH — npm registry verified, 157M weekly downloads

---

## Git Integration

### simple-git v3

**Why:**
- 3.33.0 as of Apr 2026 (actively maintained)
- Node.js native git wrapper — handles `git diff`, `git log`, branch detection
- Typed API, Promise-based, no spawning raw shell required
- Only library at this adoption level for Node.js git operations

**Key operations rms needs:**
```typescript
import simpleGit from 'simple-git';
const git = simpleGit();

// Local diff (staged or unstaged)
const localDiff = await git.diff(['--staged']);

// PR diff (by commit range or branch comparison)
const prDiff = await git.diff([`origin/main...HEAD`]);
```

**For parsing the diff output:** Use raw string parsing or `gitdiff-parser` (224K weekly downloads, npm verified). simple-git returns diff as a string; parse it if you need structured file/line information for the prompt.

**Install:** `npm install simple-git`

**Confidence:** MEDIUM-HIGH — npm registry verified (v3.33.0), well-established library. gitdiff-parser is a secondary option — confidence MEDIUM (smaller adoption).

---

## File System Output

### Node.js `fs/promises` (built-in)

**Why:** No external dependency needed. The output format is Markdown files in `.reviews/`. Use native `fs/promises` with `path` for:
- Creating the review directory (`mkdir -p .reviews/<review-id>/`)
- Writing role output files (`reviewer.md`, `validator.md`, `report.md`)

**Pattern:**
```typescript
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const reviewDir = join('.reviews', `${timestamp}-${shortId}`);
await mkdir(reviewDir, { recursive: true });
await writeFile(join(reviewDir, 'reviewer.md'), reviewerMarkdown, 'utf8');
await writeFile(join(reviewDir, 'validator.md'), validatorMarkdown, 'utf8');
await writeFile(join(reviewDir, 'report.md'), finalReport, 'utf8');
```

**DO NOT add:** `fs-extra` or similar — unnecessary for this use case.

**Confidence:** HIGH — built-in Node.js API

---

## CLI Argument Parsing (Fix Command only)

### Commander.js v12+

**Why:** The `/fix` command needs a small CLI to parse finding IDs (e.g., `rms fix rms_4k2xPq7R`). Commander.js is the right choice:
- ~50M weekly downloads (npm, 2026) — by far the most used Node CLI parser
- Zero dependencies
- Excellent TypeScript types
- Minimal API — perfect for a two-subcommand tool (`review`, `fix`)
- Used by Vue CLI, Create React App, and many major tools

**Pattern:**
```typescript
import { Command } from 'commander';
const program = new Command();

program
  .name('rms')
  .version('0.1.0');

program
  .command('fix [findingId]')
  .description('Apply a specific finding by ID, or interactively select')
  .action((findingId) => {
    if (findingId) {
      applyFinding(findingId);
    } else {
      interactiveSelect();
    }
  });

program.parse();
```

**For interactive selection (no-ID mode):** Add `@inquirer/prompts` (the modular successor to inquirer.js, ESM-native):
```bash
npm install @inquirer/prompts
```

**What NOT to use:**
- **yargs** — more config, better for complex CLIs with many options; overkill here
- **oclif** — plugin-based framework designed for large CLI products (Heroku, Salesforce); massive overhead for a 2-command tool
- **citty** — UnJS ecosystem, newer, less battle-tested than Commander for this use case

**Install:** `npm install commander @inquirer/prompts`

**Confidence:** HIGH for Commander (verified 50M weekly downloads, pkgpulse.com article Mar 2026). MEDIUM for @inquirer/prompts (recommended successor to inquirer but confirm exact API vs inquirer v9+).

---

## TypeScript Configuration

### TypeScript 5.x + tsx (for development)

**Why TypeScript:**
- The project will have Zod schemas, AI SDK types, and complex data structures — TypeScript prevents entire classes of runtime errors
- Both the AI SDK and Commander have excellent first-party types

**Runtime:** Use `tsx` for development execution (no compile step). For distribution, either:
- Ship TypeScript source + require tsx/ts-node at runtime (fine for a developer tool)
- Or compile to JS with `tsc` for the fix command

```bash
npm install -D typescript tsx @types/node
```

**tsconfig.json key settings:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist"
  }
}
```

**Confidence:** HIGH

---

## Output Format

### Markdown files (`.md`)

**Why:**
- Directly readable by humans in any editor
- Directly readable by AI agents in future editor invocations (feeding fix command context)
- No serialization library needed — `fs/promises.writeFile` with a template literal
- Durable: no database, no binary format, just text files in `.reviews/`

**Directory structure per review:**
```
.reviews/
  2026-04-03T14:32:00-rms_8xKp3Y/
    reviewer.md       # raw reviewer findings (Markdown)
    validator.md      # validator challenges (Markdown)
    report.md         # final synthesized report (Markdown, severity-grouped)
    meta.json         # machine-readable metadata: findingIds, timestamps, model used
```

**`meta.json` format** (machine-readable, for the fix command to parse):
```json
{
  "reviewId": "rms_8xKp3Y",
  "createdAt": "2026-04-03T14:32:00Z",
  "scope": "staged",
  "model": "anthropic/claude-sonnet-4-20250514",
  "findings": [
    { "id": "rms_4k2xPq", "severity": "critical", "file": "src/auth.ts", "line": 42 }
  ]
}
```

**Confidence:** HIGH — matches PROJECT.md requirements exactly; no external dependency

---

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

---

## Complete Dependency List

```bash
# Core runtime
npm install ai zod nanoid simple-git commander @inquirer/prompts

# Dev
npm install -D typescript tsx @types/node

# Optional: specific AI providers (if adding Node.js orchestration script)
npm install @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

**Expected `package.json` shape:**
```json
{
  "name": "review-my-shit",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "fix": "tsx src/fix.ts"
  },
  "dependencies": {
    "ai": "^6.0.0",
    "zod": "^3.23.0",
    "nanoid": "^5.1.7",
    "simple-git": "^3.33.0",
    "commander": "^12.0.0",
    "@inquirer/prompts": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

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

---

## Critical Design Decision: Pure Prompt vs. Hybrid Architecture

**Decision required before Phase 1:**

**Option A — Pure Prompt Files (no Node.js process)**
- The entire workflow is prompt instructions in `.md` files
- The host AI agent (OpenCode/Cursor) orchestrates the three roles using its built-in subagent/Task tool
- Pros: zero install, works immediately in any editor, no runtime dependency
- Cons: less control over isolation guarantees; harder to enforce structured output format; validator isolation depends on editor's subagent implementation

**Option B — Hybrid (prompt entry point + Node.js orchestrator)**
- Slash command file calls `!`node .rms/orchestrate.js --scope staged``
- Node.js script uses AI SDK to make three isolated `generateText` calls with Zod schemas
- Writes output to `.reviews/` directly
- Pros: total control over isolation, structured output guaranteed, finding IDs deterministic
- Cons: requires Node.js in PATH; slightly more setup

**Recommendation:** Start with **Option A** (pure prompts), validate that OpenCode's `subtask: true` and agent permission system genuinely isolates the validator. If isolation is insufficient, add Option B's Node.js layer. The stack research shows both are viable — Option A is zero-risk to try first.

---

## Sources

- OpenCode official docs (opencode.ai/docs/): commands, agents, config — verified Apr 2, 2026
- Cursor official changelog 1.6 (Sep 2025): custom slash commands launched
- Cursor official docs (cursor.com/docs/): rules, skills, commands — verified Apr 3, 2026
- Vercel AI SDK official docs (ai-sdk.dev): v6 stable — verified Apr 2026
- Context7 /vercel/ai (HIGH reputation, 4369 snippets): orchestration patterns, structured output
- npm registry: nanoid v5.1.7 (157M/wk), simple-git v3.33.0, Commander.js (50M/wk) — verified Apr 2026
- pkgpulse.com "Best CLI Frameworks for Node.js in 2026" (Mar 8, 2026)
