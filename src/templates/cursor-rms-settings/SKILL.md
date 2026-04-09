---
name: rms-settings
description: View or set rms per-agent model configuration (~/.config/rms/config.json). Run with no arguments for interactive picker.
argument-hint: "[--reviewer provider:model | github-copilot/model-id] [--validator provider:model] [--writer provider:model] [--reset]"
---
Run the following command in the terminal and present the output to the user:

rms settings $ARGUMENTS

## Setting models with flags

```
rms settings --reviewer copilot:claude-opus-4.6
rms settings --reviewer github-copilot/claude-opus-4.6   (copy-paste from opencode models)
rms settings --reviewer anthropic:claude-opus-4-5
rms settings --validator anthropic:claude-sonnet-4-5
rms settings --writer openai:gpt-4o
```

## Supported providers

| Provider | Description | Requires |
|----------|-------------|---------|
| `copilot` | GitHub Copilot (OpenAI-compatible) | `GITHUB_TOKEN` or opencode auth |
| `anthropic` | Direct Anthropic API | `ANTHROPIC_API_KEY` |
| `openai` | Direct OpenAI API | `OPENAI_API_KEY` |
| `google` | Direct Google AI API | `GOOGLE_GENERATIVE_AI_API_KEY` |

## Cursor model IDs cannot be used directly

`cursor-agent --list-models` outputs Cursor-internal routing IDs (e.g. `claude-4.6-sonnet-medium`)
that only work inside Cursor's proprietary backend. There is no public API endpoint for these IDs.

If you have GitHub Copilot, use the `copilot` provider instead:
```
rms settings --reviewer copilot:claude-opus-4.6
```

Otherwise, use a provider with a direct API key (anthropic, openai, or google).

## Interactive picker

Run `rms settings` with no arguments in a terminal for a guided interactive picker.
The picker requires a TTY — it falls back to help text in non-TTY environments.

The config is saved to ~/.config/rms/config.json. If no config exists, rms falls back
to AI_SDK_PROVIDER + AI_SDK_MODEL env vars.
