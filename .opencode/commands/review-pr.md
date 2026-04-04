---
description: Run rms code review on a GitHub PR diff
argument-hint: <pr-number> [focus-area]
subtask: true
---
Run the rms review pipeline on GitHub PR #$1.

Focus area (optional): $2

Steps:
1. Fetch the PR diff from GitHub using the PR number $1
2. Create a review session folder in .reviews/
3. Write INPUT.md with the diff, scope (pr-diff), PR number, and focus area if provided
4. Run the reviewer agent (reads INPUT.md, writes REVIEWER.md with structured findings)
5. Run the validator agent (reads INPUT.md + REVIEWER.md, writes VALIDATOR.md with per-finding verdicts)
6. Run the writer agent (reads all three files, writes REPORT.md severity-grouped report)
7. Report the session folder path to the user
