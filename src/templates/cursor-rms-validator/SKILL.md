---
name: rms-validator
description: "Set the validator agent model — interactive picker"
---

## Set Validator Model

1. Run `rms settings` in the terminal and show the current config to the user.

2. Present the **current validator model** from the output.

3. Present these options for the user to choose from:

| Model | Notes |
|-------|-------|
| gpt-5.4-high (default) | OpenAI high-capability model |
| claude-4.6-opus-high-thinking | Highest capability for deep analysis |
| claude-4.6-sonnet-medium-thinking | Balanced capability and speed |

4. After the user chooses, map their selection to a spec string:
   - gpt-5.4-high → `copilot:gpt-5.4-high`
   - claude-4.6-opus-high-thinking → `copilot:claude-4.6-opus-high-thinking`
   - claude-4.6-sonnet-medium-thinking → `copilot:claude-4.6-sonnet-medium-thinking`
   - Any other typed value → use as-is

5. Run in the terminal:
   ```
   rms settings --validator <resolved-spec>
   ```

6. Confirm: "✓ Validator set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
