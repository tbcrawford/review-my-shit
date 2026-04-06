---
description: Run rms code review on local git diff (staged + unstaged changes)
argument-hint: [--focus <area>]
---
Run the following command in the terminal and report the output to the user:

```
node dist/index.js review-local $ARGUMENTS
```

Then open the `REPORT.md` file it creates inside `.reviews/` and present the findings.
