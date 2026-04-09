---
description: "Set reviewer, validator, and writer models — single picker for all three"
tools:
  bash: true
  question: true
---

## Set Agent Models

1. Run `!rms settings` to read the current config and show the user the currently configured models.

2. Ask all three questions in a single call:

```
question([
  {
    header: "Reviewer model",
    question: "Select the reviewer model (analyzes the diff):",
    options: [
      { label: "github-copilot/claude-opus-4.6 — high thinking (default)", description: "Highest capability for deep analysis" },
      { label: "github-copilot/claude-sonnet-4.6 — high thinking",          description: "Balanced capability and speed" },
      { label: "github-copilot/gpt-5.4 — high thinking",                    description: "OpenAI high-capability model" }
    ]
  },
  {
    header: "Validator model",
    question: "Select the validator model (challenges reviewer findings):",
    options: [
      { label: "github-copilot/gpt-5.4 — high thinking (default)",          description: "OpenAI high-capability model" },
      { label: "github-copilot/claude-opus-4.6 — high thinking",            description: "Highest capability for deep analysis" },
      { label: "github-copilot/claude-sonnet-4.6 — high thinking",          description: "Balanced capability and speed" }
    ]
  },
  {
    header: "Writer model",
    question: "Select the writer model (merges findings into REPORT.md):",
    options: [
      { label: "github-copilot/claude-haiku-4.5 — no thinking (default)", description: "Fast, lightweight synthesis" },
      { label: "github-copilot/gpt-5-mini — no thinking",                  description: "OpenAI lightweight model" },
      { label: "github-copilot/gemini-3-flash-preview — no thinking",      description: "Google fast model" }
    ]
  }
])
```

3. Map each selection to a spec string:

   **Reviewer:**
   - "github-copilot/claude-opus-4.6 — high thinking (default)" → `github-copilot/claude-opus-4.6`
   - "github-copilot/claude-sonnet-4.6 — high thinking" → `github-copilot/claude-sonnet-4.6`
   - "github-copilot/gpt-5.4 — high thinking" → `github-copilot/gpt-5.4`
   - Any other typed value → use as-is

   **Validator:**
   - "github-copilot/gpt-5.4 — high thinking (default)" → `github-copilot/gpt-5.4`
   - "github-copilot/claude-opus-4.6 — high thinking" → `github-copilot/claude-opus-4.6`
   - "github-copilot/claude-sonnet-4.6 — high thinking" → `github-copilot/claude-sonnet-4.6`
   - Any other typed value → use as-is

   **Writer:**
   - "github-copilot/claude-haiku-4.5 — no thinking (default)" → `github-copilot/claude-haiku-4.5`
   - "github-copilot/gpt-5-mini — no thinking" → `github-copilot/gpt-5-mini`
   - "github-copilot/gemini-3-flash-preview — no thinking" → `github-copilot/gemini-3-flash-preview`
   - Any other typed value → use as-is

4. Apply all three in a single command:

   ```
   !rms settings --reviewer <reviewer-spec> --validator <validator-spec> --writer <writer-spec>
   ```

5. Confirm with a summary:

   ```
   ✓ Models updated:
     reviewer   github-copilot/claude-opus-4.6
     validator  github-copilot/gpt-5.4
     writer     github-copilot/claude-haiku-4.5

   Config saved to ~/.config/rms/config.json.
   ```
