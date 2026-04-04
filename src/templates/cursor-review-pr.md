---
description: Run rms code review on a GitHub PR diff
argument-hint: <pr-number> [focus-area]
---
Run the rms review pipeline on GitHub PR number provided in $ARGUMENTS.

Follow the same pipeline as review-local but fetch the diff from GitHub instead of git.

Steps:
1. Extract PR number from: $ARGUMENTS
2. Fetch the PR diff — if GitHub token is not available, ask the user for it
3. Create a review session folder in .reviews/ with format YYYY-MM-DD-pr-<number>
4. Write INPUT.md with the diff, scope (pr-diff), PR number, and focus area
5. Act as the REVIEWER: analyze across all 11 dimensions, write REVIEWER.md
6. STOP. Re-read REVIEWER.md as VALIDATOR. Write VALIDATOR.md.
7. STOP. Re-read all files as WRITER. Write REPORT.md.
8. Report session path and finding count
