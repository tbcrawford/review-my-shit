---
description: Run rms code review on a GitHub PR diff
argument-hint: <pr-number> [--focus <area>]
---
Run the following command in the terminal and report the output to the user:

```
node dist/index.js review-pr $ARGUMENTS
```

Then open the `REPORT.md` file it creates inside `.reviews/` and present the findings.

Note: `GITHUB_TOKEN` must be set in your environment for PR diff fetching.
