---
name: rms-fix
description: Apply a finding from the latest rms review report (by ID, or list all)
argument-hint: [<finding-id>] [--session <id>]
---
Run the following command in the terminal and capture the output:

```
rms fix $ARGUMENTS
```

If no finding ID was provided, present the list of findings to the user and ask them to choose one by ID, then re-run with that ID.

If a specific finding was shown:
1. Present the **Problem** and **Suggestion** sections to the user clearly.
2. If a stale file warning is shown, surface it prominently before asking for confirmation.
3. Ask the user: "Would you like me to apply this suggestion to `<file>`?" — do NOT make any edits without explicit confirmation.
4. Only after the user confirms: edit the file at the indicated line to implement the suggestion.
