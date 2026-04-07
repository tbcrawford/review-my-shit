---
description: "Run rms code review — prompts for scope (local diff or PR) if not specified"
argument-hint: "[local | pr <pr-number>] [--focus <area>]"
---
Run the following command in the terminal and present the output to the user:

```
rms review $ARGUMENTS
```

If the output contains 'What would you like to review?', present the options to the user and ask for their choice. Then re-invoke with their selection:
- If they choose local: `rms review local [--focus <area>]`
- If they choose PR: ask for the PR number, then run `rms review pr <number> [--focus <area>]`

After a successful review, read REPORT.md inside `.reviews/<session-id>/` and present findings grouped by severity (critical → high → medium → low → info). Include the session ID so the user can reference findings with `/rms-fix`.

PR reviews require `GITHUB_TOKEN` to be set. If the command fails with an auth error, remind the user to export their GitHub token.
