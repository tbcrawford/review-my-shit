---
name: rms-validator
description: "Set the validator agent model — interactive picker"
---

## Set Validator Model (Cursor)

> **Note:** This configures the Cursor section only. Run `rms settings` to see both sections.

1. Run `rms settings` in the terminal and show the current config to the user — specifically the `cursor:` section's validator model.

2. Present these options for the user to choose from:

| Model | Notes |
|-------|-------|
| gpt-5.4-high (default) | OpenAI high-capability model |
| claude-4.6-opus-high-thinking | Highest capability for deep analysis |
| claude-4.6-sonnet-medium-thinking | Balanced capability and speed |

3. After the user chooses, map their selection to a spec string:
   - gpt-5.4-high → `gpt-5.4-high`
   - claude-4.6-opus-high-thinking → `claude-4.6-opus-high-thinking`
   - claude-4.6-sonnet-medium-thinking → `claude-4.6-sonnet-medium-thinking`
   - Any other typed value → use as-is

4. Run in the terminal (scoped to cursor section):
   ```
   rms settings --validator <resolved-spec> --cursor
   ```

5. Confirm: "✓ Cursor validator set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
