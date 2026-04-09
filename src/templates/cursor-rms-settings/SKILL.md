---
name: rms-settings
description: "View current rms model config (~/.config/rms/config.json) and reset to defaults."
---
Run the following command in the terminal and present the output to the user:

```
rms settings $ARGUMENTS
```

## Viewing current config

Run `rms settings` with no arguments to see which models are currently configured for each agent.

## Resetting to defaults

```
rms settings --reset
```

Deletes the config file and reverts to environment variable fallback (AI_SDK_PROVIDER + AI_SDK_MODEL).

## Changing individual agent models

Use the dedicated commands:
- `/rms-reviewer` — Set reviewer model
- `/rms-validator` — Set validator model
- `/rms-writer` — Set writer model

Or use the CLI flags for scripting:
```
rms settings --reviewer copilot:claude-opus-4-5
rms settings --validator copilot:github-copilot/gpt-5.4
rms settings --writer openai:gpt-4o
```

## Supported providers

| Provider | Requires |
|----------|---------|
| `copilot` | `GITHUB_TOKEN` or opencode auth |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
