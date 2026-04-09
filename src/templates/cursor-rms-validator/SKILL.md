---
name: rms-validator
description: "Set the validator agent model — interactive picker"
---

## Set Validator Model

1. Run `rms settings` in the terminal and show the current config to the user.

2. Present the **current validator model** from the output.

3. Present these options for the user to choose from:

**Copilot provider (recommended):**

| Tier | Model | Notes |
|------|-------|-------|
| max | github-copilot/claude-opus-4-5 | Best capability, highest cost |
| high | github-copilot/claude-sonnet-4-5 | High capability |
| medium | github-copilot/claude-haiku-3-5 | Balanced capability and cost |
| low | github-copilot/claude-haiku-3-5 | Fast and lightweight |

**Other providers (requires API key):**

| Spec | Notes |
|------|-------|
| anthropic:claude-opus-4-5 | Requires ANTHROPIC_API_KEY |
| openai:gpt-4o | Requires OPENAI_API_KEY |
| google:gemini-2.5-pro | Requires GOOGLE_GENERATIVE_AI_API_KEY |
| custom | User provides raw spec in `provider:model-id` or `github-copilot/model-id` format |

4. After the user chooses, map their selection to a spec string:
   - max → `copilot:claude-opus-4-5`
   - high → `copilot:claude-sonnet-4-5`
   - medium or low → `copilot:claude-haiku-3-5`
   - Other provider specs (anthropic:..., openai:..., google:...) → use as-is
   - custom → ask the user to type their spec string

5. Run in the terminal:
   ```
   rms settings --validator <resolved-spec>
   ```

6. Confirm: "✓ Validator set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
