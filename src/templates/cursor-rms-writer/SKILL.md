---
name: rms-writer
description: "Set the writer agent model — interactive picker"
---

## Set Writer Model (Cursor)

> **Note:** This configures the Cursor section only. Run `rms settings` to see both sections.

1. Run `rms settings` in the terminal and show the current config to the user — specifically the `cursor:` section's writer model.

2. Present these options for the user to choose from:

| Model | Notes |
|-------|-------|
| gpt-5.4-mini-none (default) | Fast, lightweight synthesis |
| gpt-5.4-nano-low | Minimal cost option |
| gemini-3-flash | Google fast model |

3. After the user chooses, map their selection to a spec string (Cursor models use plain IDs — no :variant suffix):
   - gpt-5.4-mini-none → `gpt-5.4-mini-none`
   - gpt-5.4-nano-low → `gpt-5.4-nano-low`
   - gemini-3-flash → `gemini-3-flash`
   - Any other typed value → use as-is

4. Run in the terminal (scoped to cursor section):
   ```
   rms settings --writer <resolved-spec> --cursor
   ```

5. Confirm: "✓ Cursor writer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
