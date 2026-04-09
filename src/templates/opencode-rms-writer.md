---
description: "Set the writer agent model — interactive model picker"
argument-hint: "[<spec>]"
tools:
  bash: true
  question: true
---

## Set Writer Model

**If `$ARGUMENTS` is provided:** run `!rms settings --writer $ARGUMENTS` immediately and confirm the result to the user.

**If `$ARGUMENTS` is empty:** follow the interactive picker flow below.

### Interactive Picker

1. Run `!rms settings` to read the current config and show the user which model is currently set for the writer.

2. Present a model picker via the `question` API with these choices:

```
question([{
  header: "Writer model",
  question: "Select a writer model:",
  options: [
    { label: "github-copilot/claude-haiku-4.5 — no thinking (default)", description: "Fast, lightweight synthesis" },
    { label: "github-copilot/gpt-5-mini — no thinking",                  description: "OpenAI lightweight model" },
    { label: "github-copilot/gemini-3-flash-preview — no thinking",      description: "Google fast model" }
  ]
}])
```

3. Map the selection to a spec string:
   - "github-copilot/claude-haiku-4.5 — no thinking (default)" → `github-copilot/claude-haiku-4.5`
   - "github-copilot/gpt-5-mini — no thinking" → `github-copilot/gpt-5-mini`
   - "github-copilot/gemini-3-flash-preview — no thinking" → `github-copilot/gemini-3-flash-preview`
   - Any other typed value → use as-is

4. Run `!rms settings --writer <resolved-spec>` to save the selection.

5. Confirm: "✓ Writer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."
