---
name: rms-reviewer
description: "Set the reviewer agent model — opens an interactive picker with variant tiers (max/high/medium/low)"
---
Run the following command in the terminal:

```
rms reviewer
```

The command opens an interactive model picker. Guide the user through the selection:
- **max** — Best available model (highest capability, highest cost)
- **high** — High capability model
- **medium** — Balanced capability and cost
- **low** — Fast and lightweight
- **Enter custom model…** — Enter a raw model ID (e.g., `github-copilot/my-model`)

After the selection, confirm the saved model to the user.
Config is saved to ~/.config/rms/config.json.

If the command fails with a TTY error, instruct the user to run `rms settings --reviewer <spec>` in a real terminal instead.
