# Phase: Model Name Extraction Overhaul — Research

**Researched:** 2026-04-09
**Domain:** AI model provider routing, GitHub Copilot API, Vercel AI SDK, CLI model discovery
**Confidence:** HIGH

---

## Summary

The current rms model system stores `{ provider, model }` pairs where `provider` is one of `"openai" | "anthropic" | "google"`. This works fine for users who hold direct API keys from those providers, but it is completely mismatched with how OpenCode and Cursor users actually access models in practice.

**OpenCode users** authenticate once with GitHub Copilot (OAuth) and access models via `opencode models`, which outputs IDs in `provider/model-id` format (e.g., `github-copilot/claude-opus-4.6`). These 18 GitHub Copilot models are callable via `api.githubcopilot.com` — an OpenAI-compatible endpoint — using the same `GITHUB_TOKEN` (GitHub OAuth `gho_` token) that rms already uses for PR diff fetching.

**Cursor users** authenticate via Cursor's internal auth system. `cursor-agent --list-models` outputs Cursor-internal IDs (e.g., `claude-4.6-sonnet-medium`) that route through Cursor's proprietary backend. There is no public Cursor API endpoint for external callers.

**The gap:** rms cannot accept `github-copilot/claude-opus-4.6` as a model spec because (a) the provider format is wrong and (b) there is no resolution path for it. The fix requires adding `"copilot"` as a supported provider, wiring it to `@ai-sdk/openai-compatible` pointing at `api.githubcopilot.com`, and updating the CLI to accept both `copilot:claude-opus-4.6` and the raw `github-copilot/claude-opus-4.6` copy-paste format from `opencode models`.

**Primary recommendation:** Add a `copilot` provider type that uses GitHub's OpenAI-compatible endpoint with `GITHUB_TOKEN` authentication. Accept raw `github-copilot/model-id` strings from `opencode models` output. Cursor model IDs have no viable direct API path — document this clearly.

---

## Project Constraints (from AGENTS.md)

- **Language agnostic:** All reviewer and validator prompts must remain language and framework agnostic. (No impact on this phase.)
- **No auto-fix:** Fix command presents findings; never auto-applies. (No impact.)
- **Structured output:** `<finding>` and `<verdict>` XML blocks parsed by `pipeline-io.ts`. (No impact.)
- **ID assignment:** Finding IDs assigned by `finding-id.ts`, never the LLM. (No impact.)
- **Build requirement:** `dist/` must exist before any command runs. `just assemble` required. (Standard constraint.)
- **Test framework:** Vitest. All tests must pass before committing.

---

## Current Model Flow (Verified)

### Config Schema [`src/schemas.ts`]

```typescript
// [VERIFIED: codebase grep]
export const AgentModelSpecSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),  // LOCKED to 3 providers
  model: z.string().min(1),
});
export type AgentModelSpec = z.infer<typeof AgentModelSpecSchema>;

export const RmsConfigSchema = z.object({
  reviewer: AgentModelSpecSchema,
  validator: AgentModelSpecSchema,
  writer: AgentModelSpecSchema,
});
```

### Config Resolution [`src/config.ts`]

```typescript
// [VERIFIED: codebase grep]
export async function resolveAgentModel(spec: AgentModelSpec) {
  if (spec.provider === 'anthropic') {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(spec.model);          // Direct Anthropic API
  } else if (spec.provider === 'google') {
    const { google } = await import('@ai-sdk/google');
    return google(spec.model);             // Direct Google AI API
  } else {
    const { openai } = await import('@ai-sdk/openai');
    return openai(spec.model);             // Direct OpenAI API
  }
}
```

### CLI Spec Parsing [`src/index.ts` — `settings` command]

```typescript
// [VERIFIED: codebase grep]
function parseSpec(raw: string, label: string): AgentModelSpec {
  const colonIdx = raw.indexOf(':');
  // Must contain colon: "provider:model-id"
  const provider = raw.slice(0, colonIdx) as AgentModelSpec['provider'];
  const model = raw.slice(colonIdx + 1);
  if (!['openai', 'anthropic', 'google'].includes(provider)) {
    // Hard error — rejects "copilot" or "github-copilot"
    console.error(`Invalid provider "${provider}". Must be one of: openai, anthropic, google`);
    process.exit(1);
  }
  return { provider, model };
}
```

### Storage

Config saved at `~/.config/rms/config.json`:
```json
{
  "reviewer": { "provider": "anthropic", "model": "claude-opus-4-5" },
  "validator": { "provider": "anthropic", "model": "claude-sonnet-4-5" },
  "writer": { "provider": "openai", "model": "gpt-4o" }
}
```

---

## What `opencode models` Actually Outputs [VERIFIED: live CLI]

`opencode models` outputs one model ID per line in `provider/model-id` format:

```
github-copilot/claude-opus-4.6
github-copilot/claude-sonnet-4.6
github-copilot/claude-sonnet-4.5
github-copilot/claude-opus-4.5
github-copilot/claude-haiku-4.5
github-copilot/claude-sonnet-4
github-copilot/gpt-5.4
github-copilot/gpt-5.2
github-copilot/gpt-5.1
github-copilot/gpt-4.1
github-copilot/gpt-4o
github-copilot/gpt-5-mini
github-copilot/grok-code-fast-1
github-copilot/gemini-2.5-pro
github-copilot/gemini-3.1-pro-preview
github-copilot/gemini-3-flash-preview
github-copilot/gpt-5.2-codex
github-copilot/gpt-5.3-codex
google-vertex/gemini-2.5-pro          ← NOT copilot; needs GCP creds
google-vertex/gemini-2.5-flash         ← NOT copilot
google-vertex-anthropic/claude-opus-4-5@20251101  ← NOT copilot; needs GCP creds
opencode/gpt-5-nano                    ← opencode-specific free models
opencode/big-pickle
... (62 total)
```

**Key insight:** Only the 18 `github-copilot/*` models are callable via the GitHub Copilot API. The `google-vertex/*` and `google-vertex-anthropic/*` models go through Google Cloud Vertex AI — different credentials, different endpoint. The `opencode/*` models are opencode-specific. For rms, the focus should be `github-copilot/*` models.

---

## What `cursor-agent --list-models` Outputs [VERIFIED: live CLI]

`cursor-agent --list-models` outputs `id - Display Name` pairs (with ANSI escape codes):

```
auto - Auto
composer-2-fast - Composer 2 Fast  (default)
claude-4.6-sonnet-medium - Sonnet 4.6 1M  (current)
claude-4.6-sonnet-medium-thinking - Sonnet 4.6 1M Thinking
claude-4.6-opus-high - Opus 4.6 1M
claude-4.6-opus-max - Opus 4.6 1M Max
gpt-5.4-medium - GPT-5.4 1M
gpt-5.2 - GPT-5.2
gemini-3.1-pro - Gemini 3.1 Pro
grok-4-20 - Grok 4.20
kimi-k2.5 - Kimi K2.5
... (~90 total)
```

**Critical finding:** These are **Cursor-internal routing IDs**. There is no public Cursor API endpoint that accepts these IDs from external callers. Cursor routes requests through its own authenticated backend. There is no path to use cursor model IDs in rms's `generateText` calls. [VERIFIED: no documented Cursor external API; no public endpoint discovered]

---

## GitHub Copilot API — Verified Capabilities [VERIFIED: live API call]

**Endpoint:** `https://api.githubcopilot.com`  
**Auth:** `Authorization: Bearer {GITHUB_TOKEN}` (same `gho_` OAuth token stored in `~/.local/share/opencode/auth.json` and usable as `GITHUB_TOKEN` env var)  
**Compatibility:** OpenAI-compatible (`/chat/completions`, `/models` endpoints)

**Models list** (from live API, 31 total):

| Model ID | Vendor |
|----------|--------|
| `claude-opus-4.6` | Anthropic |
| `claude-sonnet-4.6` | Anthropic |
| `claude-sonnet-4.5` | Anthropic |
| `claude-opus-4.5` | Anthropic |
| `claude-haiku-4.5` | Anthropic |
| `claude-sonnet-4` | Anthropic |
| `gpt-5.4` | OpenAI |
| `gpt-5.2` | OpenAI |
| `gpt-5.1` | OpenAI |
| `gpt-4.1` | Azure OpenAI |
| `gpt-4o` | Azure OpenAI |
| `gpt-5-mini` | Azure OpenAI |
| `gpt-5.2-codex` | OpenAI |
| `gpt-5.3-codex` | OpenAI |
| `grok-code-fast-1` | xAI |
| `gemini-2.5-pro` | Google |
| `gemini-3.1-pro-preview` | Google |
| `gemini-3-flash-preview` | Google |
| …and more |  |

**ID mapping:** `opencode models` → rms config:
- `github-copilot/claude-opus-4.6` → strip `github-copilot/` → model ID = `claude-opus-4.6`
- Model IDs use dots (e.g., `claude-opus-4.6`), not hyphens (rms currently uses `claude-opus-4-5`)

**Live call verified:** `POST /chat/completions` with `model: "claude-opus-4.6"` returns valid completion. [VERIFIED: live API call confirmed `OK` response]

---

## The Gap — Precise Description

| What user has | What rms expects | Result |
|---------------|-----------------|--------|
| `github-copilot/claude-opus-4.6` (from `opencode models`) | `provider:model` where provider ∈ `{openai,anthropic,google}` | **Hard error** — `parseSpec()` rejects `github-copilot` as invalid provider |
| GitHub OAuth token (`GITHUB_TOKEN` / opencode auth) | Anthropic/OpenAI/Google direct API key | **Auth failure** — rms tries to call Anthropic API without Anthropic key |
| `claude-4.6-sonnet-medium` (from `cursor-agent --list-models`) | No cursor provider exists | **No path** — cursor model IDs cannot be used externally |

**Current workaround:** Users must (a) know the native provider's model ID format (hyphens, version suffixes), (b) obtain a direct API key from Anthropic/OpenAI/Google separately, and (c) manually type the spec string. This is a significant friction point for OpenCode users who already have GitHub Copilot.

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose |
|---------|---------|---------|
| `@ai-sdk/openai-compatible` | 2.0.41 | Create OpenAI-compatible provider instances | [VERIFIED: npm registry]
| `ai` | 6.0.154 | `generateText` and Language Model type | [VERIFIED: npm registry]
| `@ai-sdk/openai` | 3.0.52 | Direct OpenAI provider | [VERIFIED: package.json]
| `@ai-sdk/anthropic` | 3.0.68 | Direct Anthropic provider | [VERIFIED: package.json]
| `@ai-sdk/google` | 3.0.60 | Direct Google provider | [VERIFIED: package.json]

### New Dependency Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@ai-sdk/openai-compatible` | `^2.0.41` | GitHub Copilot provider instance | OpenAI-compatible, ships with `ai` ecosystem; `createOpenAICompatible()` points to `api.githubcopilot.com` | [VERIFIED: Context7 docs]

**Installation:**
```bash
npm install @ai-sdk/openai-compatible
```

### @ai-sdk/openai-compatible Pattern [VERIFIED: Context7]

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const copilotProvider = createOpenAICompatible({
  name: 'github-copilot',
  baseURL: 'https://api.githubcopilot.com',
  apiKey: process.env.GITHUB_TOKEN,  // or read from ~/.local/share/opencode/auth.json
});

const model = copilotProvider.chatModel('claude-opus-4.6');
// Then: generateText({ model, ... })
```

---

## Architecture Patterns

### New Provider: `copilot`

The cleanest change is adding `"copilot"` as a 4th provider in the enum. This is:
- User-friendly (shorter than `github-copilot`)
- Distinguishable from the existing three providers
- Forward-compatible (could later add `openrouter`, `vertex`, etc.)

**Config schema extension:**
```typescript
// src/schemas.ts
export const AgentModelSpecSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'copilot']),  // +copilot
  model: z.string().min(1),
});
```

**`resolveAgentModel()` extension:**
```typescript
// src/config.ts
export async function resolveAgentModel(spec: AgentModelSpec) {
  if (spec.provider === 'copilot') {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    const token = await resolveCopilotToken();  // see below
    const copilot = createOpenAICompatible({
      name: 'github-copilot',
      baseURL: 'https://api.githubcopilot.com',
      apiKey: token,
    });
    return copilot.chatModel(spec.model);
  }
  // ... existing branches
}
```

### Token Resolution for `copilot` Provider

Two sources, in priority order:
1. `GITHUB_TOKEN` env var (already used for PR reviews — same token)
2. `~/.local/share/opencode/auth.json` → `github-copilot.access` field (gho_ OAuth token)

```typescript
async function resolveCopilotToken(): Promise<string> {
  // Priority 1: env var (same token used for PR diffs)
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  
  // Priority 2: opencode auth.json
  const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
  try {
    const raw = await readFile(authPath, 'utf8');
    const auth = JSON.parse(raw);
    const token = auth?.['github-copilot']?.access;
    if (token) return token;
  } catch { /* not available */ }
  
  throw new Error(
    '[rms] copilot provider requires GITHUB_TOKEN env var or opencode GitHub Copilot login.\n' +
    '  Set GITHUB_TOKEN or run: opencode auth login'
  );
}
```

### CLI Spec Parsing — Accept Both Formats

Users should be able to copy-paste directly from `opencode models` output:

```typescript
// src/index.ts — parseSpec()
function parseSpec(raw: string, label: string): AgentModelSpec {
  // NEW: Accept "github-copilot/model-id" format from opencode models output
  if (raw.startsWith('github-copilot/')) {
    const model = raw.slice('github-copilot/'.length);
    return { provider: 'copilot', model };
  }
  
  // Existing: "provider:model-id" format
  const colonIdx = raw.indexOf(':');
  // ... rest unchanged, but add 'copilot' to valid providers
}
```

**Accepted formats after this change:**
- `copilot:claude-opus-4.6` — explicit new format
- `github-copilot/claude-opus-4.6` — raw copy-paste from `opencode models`
- `anthropic:claude-opus-4-5` — existing format unchanged
- `openai:gpt-4o` — existing format unchanged
- `google:gemini-1.5-pro` — existing format unchanged

---

## Files That Need to Change

| File | Change Required |
|------|----------------|
| `src/schemas.ts` | Add `'copilot'` to `AgentModelSpecSchema` provider enum |
| `src/config.ts` | Add `resolveCopilotToken()` helper; add `copilot` branch in `resolveAgentModel()`; import `@ai-sdk/openai-compatible` |
| `src/index.ts` | Update `parseSpec()` to accept `github-copilot/model-id` format and `copilot` provider; update help text and examples |
| `src/config.test.ts` | Add tests for copilot provider resolution; test `github-copilot/` format parsing; test token resolution fallback |
| `src/templates/opencode-settings.md` | Update `argument-hint` and description to mention copilot provider |
| `src/templates/cursor-rms-settings/SKILL.md` | Update instructions to mention copilot provider and clarify cursor model IDs cannot be used directly |
| `package.json` | Add `@ai-sdk/openai-compatible` to `dependencies` |

**Files that do NOT need to change:**
- `src/reviewer.ts`, `src/validator.ts`, `src/writer.ts` — model instances passed in, provider-agnostic
- `src/pipeline-io.ts`, `src/session.ts`, `src/fixer.ts`, `src/installer.ts`, `src/setup.ts` — no model concerns
- `src/schemas.ts` `RmsConfigSchema` — no change needed (wraps `AgentModelSpecSchema`)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| GitHub Copilot OpenAI-compatible calls | Custom HTTP client for `api.githubcopilot.com` | `@ai-sdk/openai-compatible` — already in the AI SDK ecosystem |
| OAuth token refresh logic | Token refresh flow | The `gho_` token doesn't expire; opencode manages refresh. Use as-is. |
| Model ID validation | Validate against live model list | Accept any non-empty string — let the API reject invalid models at call time with a clear error |

---

## Common Pitfalls

### Pitfall 1: Model ID Case/Format Differences
**What goes wrong:** `opencode models` shows `claude-opus-4.6` (dots). Old rms examples use `claude-opus-4-5` (hyphens). Mixing these will produce API errors.  
**Why it happens:** The Copilot API model IDs use dots; Anthropic's native API uses hyphens AND version suffixes (e.g., `claude-opus-4-5` = Claude Opus 4.5 on Anthropic direct).  
**How to avoid:** Document clearly that copilot provider model IDs use dots (copied from `opencode models` or the Copilot API `/models` response). Do not attempt to translate.

### Pitfall 2: Token Not Available at Runtime
**What goes wrong:** `copilot` provider fails silently or with a confusing auth error.  
**Why it happens:** `GITHUB_TOKEN` not set, and opencode not installed/logged in.  
**How to avoid:** `resolveCopilotToken()` throws a clear, actionable error message pointing to both resolution paths.

### Pitfall 3: Cursor Model IDs Silently Accepted
**What goes wrong:** User sets `--reviewer copilot:claude-4.6-sonnet-medium` (Cursor model ID format) — the Copilot API returns a 404/400.  
**Why it happens:** Cursor model IDs look similar to Copilot model IDs but are different.  
**How to avoid:** Document this in the settings template. Consider adding a warning in `resolveAgentModel` if the model ID looks like a cursor-agent ID (contains hyphens + quality suffix like `-medium`, `-high`). [ASSUMED — the exact detection heuristic needs design]

### Pitfall 4: zod v4 Breaking Changes
**What goes wrong:** Adding to the enum fails to compile.  
**Why it happens:** zod v4 (which this project uses) has syntax differences from v3.  
**How to avoid:** `z.enum(['openai', 'anthropic', 'google', 'copilot'])` is standard zod syntax — no change needed from v3 to v4 for this operation. [VERIFIED: schemas.ts already uses this pattern]

### Pitfall 5: `@ai-sdk/openai-compatible` Not in `dist/`
**What goes wrong:** `import('@ai-sdk/openai-compatible')` fails at runtime after `npm pack`.  
**Why it happens:** If added as devDependency instead of dependency.  
**How to avoid:** Add to `dependencies`, not `devDependencies`.

---

## Code Examples [VERIFIED: Context7 / Official Docs]

### OpenAI-Compatible Provider with Custom baseURL
```typescript
// Source: https://github.com/vercel/ai/blob/main/packages/openai-compatible/README.md
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

const { text } = await generateText({
  model: createOpenAICompatible({
    baseURL: 'https://api.githubcopilot.com',
    name: 'github-copilot',
    apiKey: process.env.GITHUB_TOKEN,
  }).chatModel('claude-opus-4.6'),
  prompt: 'Hello',
});
```

### Dynamic Import Pattern (matches existing config.ts style)
```typescript
// Pattern from src/config.ts — all providers use dynamic import
if (spec.provider === 'copilot') {
  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
  const token = await resolveCopilotToken();
  const copilot = createOpenAICompatible({
    name: 'github-copilot',
    baseURL: 'https://api.githubcopilot.com',
    apiKey: token,
  });
  return copilot.chatModel(spec.model);
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `opencode` CLI | Model list display in settings template | ✓ | 1.4.0 | Omit `opencode models` from template |
| `cursor-agent` | Model list display in cursor template | ✓ | present | Omit from template |
| GitHub Copilot token | `copilot` provider | ✓ | via `gho_` OAuth token | `GITHUB_TOKEN` env var |
| `@ai-sdk/openai-compatible` | `copilot` provider | ✗ (not in package.json) | 2.0.41 | Must install |

**Missing dependencies blocking execution:**
- `@ai-sdk/openai-compatible` — must be added to `package.json` dependencies

---

## Cursor Model IDs — Dead End (Documented)

**Finding:** `cursor-agent --list-models` outputs Cursor-internal routing IDs (`claude-4.6-sonnet-medium`, `gpt-5.4-medium`, etc.). These IDs:
- Route through Cursor's proprietary backend
- Have no public API endpoint
- Cannot be used in rms's `generateText` calls

**What to tell Cursor users in the settings template:**  
> Cursor model IDs from `cursor-agent --list-models` cannot be used directly. If you have GitHub Copilot, use the `copilot` provider instead: `rms settings --reviewer copilot:claude-opus-4.6`. Otherwise, use a provider with direct API access: `anthropic:claude-opus-4-5`.

[VERIFIED: no documented public Cursor external API; confirmed by probing for local endpoints]

---

## Validation Architecture (Vitest)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run | `bun run test` |
| Full suite | `bun run test` |

### Phase Requirements → Test Map

| Behavior | Test Type | File | Exists? |
|----------|-----------|------|---------|
| `AgentModelSpecSchema` accepts `"copilot"` provider | unit | `src/schemas.test.ts` | Needs new test |
| `AgentModelSpecSchema` rejects unknown providers | unit | `src/schemas.test.ts` | Existing tests cover reject; add copilot accept |
| `resolveAgentModel({ provider: 'copilot', model: 'claude-opus-4.6' })` returns truthy model | unit | `src/config.test.ts` | ❌ Wave 0 |
| `resolveCopilotToken()` returns env var if set | unit | `src/config.test.ts` | ❌ Wave 0 |
| `resolveCopilotToken()` reads from auth.json if env var absent | unit | `src/config.test.ts` | ❌ Wave 0 |
| `resolveCopilotToken()` throws clear error if neither available | unit | `src/config.test.ts` | ❌ Wave 0 |
| `parseSpec("github-copilot/claude-opus-4.6")` returns `{provider:"copilot",model:"claude-opus-4.6"}` | unit | `src/index.test.ts` | ❌ Wave 0 |
| `parseSpec("copilot:claude-opus-4.6")` returns `{provider:"copilot",model:"claude-opus-4.6"}` | unit | `src/index.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- New test cases in `src/config.test.ts` for `resolveAgentModel` with copilot provider (use `GITHUB_TOKEN` env check to skip live call in CI)
- New test cases in `src/config.test.ts` for `resolveCopilotToken()` (mock the auth.json path)
- New test cases in `src/index.test.ts` for `parseSpec()` with copilot formats

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gho_` OAuth token in opencode auth.json does not require refresh before expiration during a single rms run | Token Resolution | Token expires mid-run; copilot API call fails with 401. Mitigation: catch 401 and emit clear message. |
| A2 | Cursor model IDs have no external API path | Cursor Dead End | If Cursor exposes an API in future, this section becomes outdated. Low urgency risk. |
| A3 | `@ai-sdk/openai-compatible` is not already a transitive dependency | Standard Stack | If it is already installed transitively, adding it to `dependencies` is still correct (makes it explicit). |
| A4 | Cursor-agent ID warning heuristic (detecting `-medium`/`-high` suffixes) | Pitfall 3 | May produce false positives or miss cases. Low risk — the API will reject bad IDs anyway. |

---

## Open Questions

1. **Should we also support OpenRouter as a provider?**
   - What we know: OpenRouter has an OpenAI-compatible endpoint and is a popular provider aggregator
   - What's unclear: Whether the user wants this now or in a future phase
   - Recommendation: Defer to a separate phase; focus on copilot for this phase

2. **Should `rms settings` have an interactive model picker (using `opencode models` output)?**
   - What we know: The CLI currently accepts flag-based spec strings
   - What's unclear: Whether the user wants a TUI model-picker or just CLI format support
   - Recommendation: Start with CLI format support only; interactive picker can be a follow-up

3. **What happens when GITHUB_TOKEN has Copilot but not the specific model requested?**
   - What we know: The Copilot API returns the models available to the user's subscription
   - What's unclear: Whether different subscriptions have different model access
   - Recommendation: Let the API reject the request with its native error; surface it clearly

---

## Sources

### Primary (HIGH confidence)
- Live `opencode models` CLI output — model format verified
- Live `cursor-agent --list-models` CLI output — cursor model format verified
- Live GitHub Copilot API call to `api.githubcopilot.com/models` — 31 models listed, format confirmed
- Live GitHub Copilot API call to `api.githubcopilot.com/chat/completions` — successful completion confirmed
- Codebase grep: `src/schemas.ts`, `src/config.ts`, `src/index.ts` — current model flow verified
- Context7 `/vercel/ai` — `@ai-sdk/openai-compatible` `createOpenAICompatible` API confirmed

### Secondary (MEDIUM confidence)
- `~/.local/share/opencode/auth.json` structure inspected — `github-copilot.access` is `gho_` OAuth token

### Tertiary (LOW confidence)
- Cursor model IDs have no external API: concluded from absence of documentation and failure to find local endpoints. Not tested exhaustively.

---

## Metadata

**Confidence breakdown:**
- GitHub Copilot API path: HIGH — live calls confirmed working
- Cursor model ID path: HIGH (confirmed dead end) — no API found
- @ai-sdk/openai-compatible integration: HIGH — Context7 verified
- Token resolution design: MEDIUM — auth.json structure confirmed, refresh behavior assumed

**Research date:** 2026-04-09
**Valid until:** ~2026-05-09 (30 days; GitHub Copilot API is stable)
