---
name: rms-models
description: "Set reviewer, validator, and writer models — single picker for all three"
---

## Set Agent Models (Cursor)

> **Note:** This configures the Cursor section. For OpenCode, use `/rms-reviewer`, `/rms-validator`, or `/rms-writer`.

1. Run `rms settings` in the terminal and show the current config to the user — both opencode and cursor sections.

2. Present all three model choices conversationally for the **Cursor** section:

**Reviewer** — analyzes the diff across 12 dimensions:

| Model | Notes |
|-------|-------|
| claude-4.6-opus-high-thinking (default) | Highest capability for deep analysis |
| claude-4.6-sonnet-medium-thinking | Balanced capability and speed |
| gpt-5.4-high | OpenAI high-capability model |

**Validator** — adversarially challenges reviewer findings:

| Model | Notes |
|-------|-------|
| gpt-5.4-high (default) | OpenAI high-capability model |
| claude-4.6-opus-high-thinking | Highest capability for deep analysis |
| claude-4.6-sonnet-medium-thinking | Balanced capability and speed |

**Writer** — merges findings into REPORT.md:

| Model | Notes |
|-------|-------|
| gpt-5.4-mini-none (default) | Fast, lightweight synthesis |
| gpt-5.4-nano-low | Minimal cost option |
| gemini-3-flash | Google fast model |

Ask the user to pick one for each, then confirm their three choices before applying.

3. Map each selection to a spec string (Cursor models use plain IDs — no :variant suffix):

   **Reviewer:**
   - claude-4.6-opus-high-thinking → `claude-4.6-opus-high-thinking`
   - claude-4.6-sonnet-medium-thinking → `claude-4.6-sonnet-medium-thinking`
   - gpt-5.4-high → `gpt-5.4-high`
   - Any other typed value → use as-is

   **Validator:**
   - gpt-5.4-high → `gpt-5.4-high`
   - claude-4.6-opus-high-thinking → `claude-4.6-opus-high-thinking`
   - claude-4.6-sonnet-medium-thinking → `claude-4.6-sonnet-medium-thinking`
   - Any other typed value → use as-is

   **Writer:**
   - gpt-5.4-mini-none → `gpt-5.4-mini-none`
   - gpt-5.4-nano-low → `gpt-5.4-nano-low`
   - gemini-3-flash → `gemini-3-flash`
   - Any other typed value → use as-is

4. Apply all three in a single terminal command scoped to the cursor section:

   ```
   rms settings --reviewer <reviewer-spec> --validator <validator-spec> --writer <writer-spec> --cursor
   ```

5. Confirm with a summary:

   ```
   ✓ Cursor models updated:
     reviewer   <reviewer-spec>
     validator  <validator-spec>
     writer     <writer-spec>

   Config saved to ~/.config/rms/config.json.
   ```

If `rms settings` fails, instruct the user to check that `rms` is installed (`npx review-my-shit`) and the config is valid.
