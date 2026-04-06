---
description: Run rms code review on a GitHub PR diff
argument-hint: <pr-number> [--focus <area>]
subtask: true
---
!node dist/index.js review-pr $ARGUMENTS
