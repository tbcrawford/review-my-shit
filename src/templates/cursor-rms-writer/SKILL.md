---
name: rms-writer
description: "Set the writer agent model — interactive picker"
---

## Set Writer Model

1. Run `rms settings` in the terminal and show the current config to the user.

2. Present the **current writer model** from the output.

3. Present these options for the user to choose from:

| Model | Notes |
|-------|-------|
| gpt-5.4-mini-none (default) | Fast, lightweight synthesis |
| gpt-5.4-nano-low | Minimal cost option |
| gemini-3-flash | Google fast model |

4. After the user chooses, map their selection to a spec string:
   - gpt-5.4-mini-none → `copilot:gpt-5.4-mini-none`
   - gpt-5.4-nano-low → `copilot:gpt-5.4-nano-low`
   - gemini-3-flash → `copilot:gemini-3-flash`
   - Any other typed value → use as-is

5. Run in the terminal:
   ```
   rms settings --writer <resolved-spec>
   ```

6. Confirm: "✓ Writer set to `<resolved-spec>`. Config saved to ~/.config/rms/config.json."

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
