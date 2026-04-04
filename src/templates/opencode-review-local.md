---
description: Run rms code review on local git diff (staged + unstaged changes)
subtask: true
---
Run the rms review pipeline on the current local git diff.

Focus area (optional): $ARGUMENTS

Steps:
1. Collect the local git diff (staged and unstaged changes) — exclude lock files, binary files, and generated files
2. Create a review session folder in .reviews/
3. Write INPUT.md with the diff, scope (local-diff), and focus area if provided
4. Run the reviewer agent (reads INPUT.md, writes REVIEWER.md with structured findings)
5. Run the validator agent (reads INPUT.md + REVIEWER.md, writes VALIDATOR.md with per-finding verdicts)
6. Run the writer agent (reads all three files, writes REPORT.md severity-grouped report)
7. Report the session folder path to the user
