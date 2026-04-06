---
description: "Run rms code review — prompts for scope (local diff or PR) if not specified"
argument-hint: "[local | pr <pr-number>] [--focus <area>]"
subtask: true
---
!node dist/index.js review $ARGUMENTS
