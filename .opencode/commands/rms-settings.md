---
description: View or set rms per-agent model configuration (~/.config/rms/config.json)
argument-hint: "[--reviewer provider:model] [--validator provider:model] [--writer provider:model] [--reset]"
subtask: true
---
!node dist/index.js settings $ARGUMENTS
