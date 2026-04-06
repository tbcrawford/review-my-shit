---
description: Run rms code review on a GitHub PR diff
argument-hint: <pr-number> [--focus <area>]
---
Run the following command in the terminal and present the output to the user:

```
node dist/index.js review-pr $ARGUMENTS
```

If the command fails with "Cannot find module" or similar, run `npm run build` first and retry.

Note: `GITHUB_TOKEN` must be set in your environment for PR diff fetching. If the command fails with an auth error, remind the user to export their GitHub token.

Once the command completes, read the `REPORT.md` file it created inside `.reviews/<session-id>/` and present the findings clearly, grouped by severity (critical → high → medium → low → info). Include the session ID so the user can reference findings with `/fix`.
