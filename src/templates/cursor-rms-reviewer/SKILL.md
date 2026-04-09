---
name: rms-reviewer
description: "Set the reviewer agent model — interactive picker"
---

## Set Reviewer Model (Cursor)

> **Note:** This configures the Cursor section only. Run `rms settings` to see both sections.

1. Run `rms settings` in the terminal and show the current config to the user — specifically the `cursor:` section's reviewer model.

2. Present these options for the user to choose from:

| Model | Notes |
|-------|-------|
| claude-4.6-opus-high-thinking (default) | Highest capability for deep analysis |
| claude-4.6-sonnet-medium-thinking | Balanced capability and speed |
| gpt-5.4-high | OpenAI high-capability model |

3. After the user chooses, map their selection to a spec string:
   - claude-4.6-opus-high-thinking → `claude-4.6-opus-high-thinking`
   - claude-4.6-sonnet-medium-thinking → `claude-4.6-sonnet-medium-thinking`
   - gpt-5.4-high → `gpt-5.4-high`
   - Any other typed value → use as-is

4. Run in the terminal (scoped to cursor section):
   ```
   rms settings --reviewer <resolved-spec> --cursor
   ```

5. Confirm: "✓ Cursor reviewer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
