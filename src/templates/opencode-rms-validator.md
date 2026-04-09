---
description: "Set the validator agent model — interactive model picker"
argument-hint: "[<spec>]"
tools:
  bash: true
  question: true
---

## Set Validator Model (OpenCode)

**If `$ARGUMENTS` is provided:** run `!rms settings --validator $ARGUMENTS --opencode` immediately and confirm the result to the user.

**If `$ARGUMENTS` is empty:** follow the interactive picker flow below.

> **Note:** This configures the OpenCode section only. Use `/rms-settings` to view or configure Cursor models.

### Interactive Picker

1. Run `!rms settings` to read the current config and show the user which model is currently set for the validator in the `opencode:` section.

2. Present a model picker via the `question` API with these choices:

```
question([{
  header: "Validator model (OpenCode)",
  question: "Select a validator model:",
  options: [
    { label: "github-copilot/gpt-5.4 — high thinking (default)",          description: "OpenAI high-capability model" },
    { label: "github-copilot/claude-opus-4.6 — high thinking",            description: "Highest capability for deep analysis" },
    { label: "github-copilot/claude-sonnet-4.6 — high thinking",          description: "Balanced capability and speed" }
  ]
}])
```

3. Map the selection to a spec string (model:variant format):
   - "github-copilot/gpt-5.4 — high thinking (default)" → `github-copilot/gpt-5.4:high_thinking`
   - "github-copilot/claude-opus-4.6 — high thinking" → `github-copilot/claude-opus-4.6:high_thinking`
   - "github-copilot/claude-sonnet-4.6 — high thinking" → `github-copilot/claude-sonnet-4.6:high_thinking`
   - Any other typed value → use as-is

4. Run `!rms settings --validator <resolved-spec> --opencode` to save the selection to the opencode section.

5. Confirm: "✓ OpenCode validator set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."
