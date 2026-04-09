---
description: "Set reviewer, validator, and writer models — single picker for all three"
tools:
  bash: true
  question: true
---

## Set Agent Models (OpenCode)

> **Note:** This configures the OpenCode section. Use `/rms-settings` to view both OpenCode and Cursor sections, or to configure Cursor models.

1. Run `!rms settings` to read the current config and show the user the currently configured models for both opencode and cursor sections.

2. **Call the `question` tool** with the following three questions — do not print this as text, invoke the tool:

   - Header: `Reviewer model (OpenCode)` | Question: `Select the reviewer model (analyzes the diff):` | Options:
     - `github-copilot/claude-opus-4.6 — high thinking` (default) — Highest capability for deep analysis
     - `github-copilot/claude-sonnet-4.6 — high thinking` — Balanced capability and speed
     - `github-copilot/gpt-5.4 — high thinking` — OpenAI high-capability model

   - Header: `Validator model (OpenCode)` | Question: `Select the validator model (challenges reviewer findings):` | Options:
     - `github-copilot/gpt-5.4 — high thinking` (default) — OpenAI high-capability model
     - `github-copilot/claude-opus-4.6 — high thinking` — Highest capability for deep analysis
     - `github-copilot/claude-sonnet-4.6 — high thinking` — Balanced capability and speed

   - Header: `Writer model (OpenCode)` | Question: `Select the writer model (merges findings into REPORT.md):` | Options:
     - `github-copilot/claude-haiku-4.5 — no thinking` (default) — Fast, lightweight synthesis
     - `github-copilot/gpt-5-mini — no thinking` — OpenAI lightweight model
     - `github-copilot/gemini-3-flash-preview — no thinking` — Google fast model

3. Map each answer to a spec string (model:variant format):

   | Answer | Spec |
   |--------|------|
   | github-copilot/claude-opus-4.6 — high thinking | `github-copilot/claude-opus-4.6:high_thinking` |
   | github-copilot/claude-sonnet-4.6 — high thinking | `github-copilot/claude-sonnet-4.6:high_thinking` |
   | github-copilot/gpt-5.4 — high thinking | `github-copilot/gpt-5.4:high_thinking` |
   | github-copilot/claude-haiku-4.5 — no thinking | `github-copilot/claude-haiku-4.5:no_thinking` |
   | github-copilot/gpt-5-mini — no thinking | `github-copilot/gpt-5-mini:no_thinking` |
   | github-copilot/gemini-3-flash-preview — no thinking | `github-copilot/gemini-3-flash-preview:no_thinking` |
   | Any other typed value | use as-is |

4. Apply all three with a single bash command scoped to the opencode section:

   `!rms settings --reviewer <reviewer-spec> --validator <validator-spec> --writer <writer-spec> --opencode`

5. Confirm with a summary:

   ```
   ✓ OpenCode models updated:
     reviewer   <reviewer-spec>
     validator  <validator-spec>
     writer     <writer-spec>

   Config saved to ~/.config/rms/config.json.
   ```
