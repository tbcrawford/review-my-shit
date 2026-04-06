---
description: Run rms code review on local git diff (staged + unstaged changes)
argument-hint: [--focus <area>]
---
Run the following command in the terminal and present the output to the user:

```
node dist/index.js review-local $ARGUMENTS
```

If the command fails with "Cannot find module" or similar, run `npm run build` first and retry.

Once the command completes, read the `REPORT.md` file it created inside `.reviews/<session-id>/` and present the findings clearly, grouped by severity (critical → high → medium → low → info). Include the session ID so the user can reference findings with `/fix`.
