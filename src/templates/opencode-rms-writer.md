---
description: "Set the writer agent model — interactive model picker"
argument-hint: "[<spec>]"
tools:
  bash: true
  question: true
---

## Set Writer Model (OpenCode)

**If `$ARGUMENTS` is provided:** run `!rms settings --writer $ARGUMENTS --opencode` immediately and confirm the result to the user.

**If `$ARGUMENTS` is empty:** follow the interactive picker flow below.

> **Note:** This configures the OpenCode section only. Use `/rms-settings` to view or configure Cursor models.

### Interactive Picker

1. Run `!rms settings` to read the current config and show the user which model is currently set for the writer in the `opencode:` section.

2. Present a model picker via the `question` API with these choices:

```
question([{
  header: "Writer model (OpenCode)",
  question: "Select a writer model:",
  options: [
    { label: "github-copilot/claude-haiku-4.5 — no thinking (default)", description: "Fast, lightweight synthesis" },
    { label: "github-copilot/gpt-5-mini — no thinking",                  description: "OpenAI lightweight model" },
    { label: "github-copilot/gemini-3-flash-preview — no thinking",      description: "Google fast model" }
  ]
}])
```

3. Map the selection to a spec string (model:variant format):
   - "github-copilot/claude-haiku-4.5 — no thinking (default)" → `github-copilot/claude-haiku-4.5:no_thinking`
   - "github-copilot/gpt-5-mini — no thinking" → `github-copilot/gpt-5-mini:no_thinking`
   - "github-copilot/gemini-3-flash-preview — no thinking" → `github-copilot/gemini-3-flash-preview:no_thinking`
   - Any other typed value → use as-is

4. Run `!rms settings --writer <resolved-spec> --opencode` to save the selection to the opencode section.

5. Confirm: "✓ OpenCode writer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."
