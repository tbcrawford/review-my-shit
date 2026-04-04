---
description: Run rms code review on local git diff (staged + unstaged changes)
---
Run the rms review pipeline on the current local git diff.

Focus area (optional): $ARGUMENTS

Note: Cursor does not support native subagent isolation. Follow the pipeline steps exactly in sequence,
writing each intermediate file to disk before proceeding to the next phase. The file system is the
isolation boundary.

Steps:
1. Collect the local git diff (staged and unstaged changes) — exclude lock files (*.lock, *-lock.json),
   binary files, and generated files (dist/, build/, *.min.js)
2. Create a review session folder in .reviews/ with format YYYY-MM-DD-local
3. Write INPUT.md with the diff content wrapped in <diff> tags, scope, and focus area if provided
4. Act as the REVIEWER: analyze the diff across all 11 dimensions, write REVIEWER.md with structured findings
5. STOP. Re-read REVIEWER.md from disk as the VALIDATOR role. Challenge each finding adversarially. Write VALIDATOR.md.
6. STOP. Re-read REVIEWER.md and VALIDATOR.md from disk as the WRITER role. Synthesize into REPORT.md grouped by severity.
7. Report the session folder path and finding count to the user
