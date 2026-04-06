---
description: Run rms code review on local git diff (staged + unstaged changes)
argument-hint: [--focus <area>]
subtask: true
---
!node dist/index.js review-local $ARGUMENTS
