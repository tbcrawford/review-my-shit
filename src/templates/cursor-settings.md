---
description: View or set rms per-agent model configuration (~/.config/rms/config.json)
argument-hint: "[--reviewer provider:model] [--validator provider:model] [--writer provider:model] [--reset]"
---
Run the following command in the terminal and present the output to the user:

rms settings $ARGUMENTS

To set per-agent models, run with flags:
rms settings --reviewer anthropic:claude-opus-4-5 --validator anthropic:claude-sonnet-4-5 --writer openai:gpt-4o

Supported providers: openai, anthropic, google
Model spec format: provider:model-id (e.g. anthropic:claude-opus-4-5)

The config is saved to ~/.config/rms/config.json. If no config exists, rms falls back to AI_SDK_PROVIDER + AI_SDK_MODEL env vars.
