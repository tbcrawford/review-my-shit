---
description: "Set the validator agent model — interactive model picker"
argument-hint: "[<spec>]"
tools:
  bash: true
  question: true
---

## Set Validator Model

**If `$ARGUMENTS` is provided:** run `!rms settings --validator $ARGUMENTS` immediately and confirm the result to the user.

**If `$ARGUMENTS` is empty:** follow the interactive picker flow below.

### Interactive Picker

1. Run `!rms settings` to read the current config and show the user which model is currently set for the validator.

2. Present a model picker via the `question` API with these choices:

```
question([{
  header: "Validator model",
  question: "Select a tier or enter a custom model:",
  options: [
    { label: "max — github-copilot/claude-opus-4-5",    description: "Best capability, highest cost" },
    { label: "high — github-copilot/claude-sonnet-4-5",  description: "High capability" },
    { label: "medium — github-copilot/claude-haiku-3-5", description: "Balanced capability and cost" },
    { label: "low — github-copilot/claude-haiku-3-5",    description: "Fast and lightweight" },
    { label: "anthropic:claude-opus-4-5",               description: "Direct Anthropic (requires ANTHROPIC_API_KEY)" },
    { label: "openai:gpt-4o",                           description: "OpenAI GPT-4o (requires OPENAI_API_KEY)" },
    { label: "google:gemini-2.5-pro",                   description: "Google Gemini 2.5 Pro (requires GOOGLE_GENERATIVE_AI_API_KEY)" },
    { label: "Enter custom…",                           description: "Raw model spec: provider:model-id or github-copilot/model-id" }
  ]
}])
```

3. Map the selection to a spec string:
   - "max" → `copilot:claude-opus-4-5`
   - "high" → `copilot:claude-sonnet-4-5`
   - "medium" → `copilot:claude-haiku-3-5`
   - "low" → `copilot:claude-haiku-3-5`
   - "anthropic:claude-opus-4-5" → use as-is
   - "openai:gpt-4o" → use as-is
   - "google:gemini-2.5-pro" → use as-is
   - "Enter custom…" → ask the user to type the spec string

4. Run `!rms settings --validator <resolved-spec>` to save the selection.

5. Confirm: "✓ Validator set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."
