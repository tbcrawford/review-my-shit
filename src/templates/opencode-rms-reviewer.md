---
description: "Set the reviewer agent model — interactive model picker"
argument-hint: "[<spec>]"
tools:
  bash: true
  question: true
---

## Set Reviewer Model

**If `$ARGUMENTS` is provided:** run `!rms settings --reviewer $ARGUMENTS` immediately and confirm the result to the user.

**If `$ARGUMENTS` is empty:** follow the interactive picker flow below.

### Interactive Picker

1. Run `!rms settings` to read the current config and show the user which model is currently set for the reviewer.

2. Present a model picker via the `question` API with these choices:

```
question([{
  header: "Reviewer model",
  question: "Select a reviewer model:",
  options: [
    { label: "github-copilot/claude-opus-4.6 — high thinking (default)", description: "Highest capability for deep analysis" },
    { label: "github-copilot/claude-sonnet-4.6 — high thinking",          description: "Balanced capability and speed" },
    { label: "github-copilot/gpt-5.4 — high thinking",                    description: "OpenAI high-capability model" }
  ]
}])
```

3. Map the selection to a spec string:
   - "github-copilot/claude-opus-4.6 — high thinking (default)" → `github-copilot/claude-opus-4.6`
   - "github-copilot/claude-sonnet-4.6 — high thinking" → `github-copilot/claude-sonnet-4.6`
   - "github-copilot/gpt-5.4 — high thinking" → `github-copilot/gpt-5.4`
   - Any other typed value → use as-is

4. Run `!rms settings --reviewer <resolved-spec>` to save the selection.

5. Confirm: "✓ Reviewer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."
