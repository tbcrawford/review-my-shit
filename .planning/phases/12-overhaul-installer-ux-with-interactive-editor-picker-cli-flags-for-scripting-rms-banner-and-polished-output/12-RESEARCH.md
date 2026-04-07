## RESEARCH COMPLETE

**Phase:** 12 — overhaul installer UX with interactive editor picker, CLI flags for scripting, RMS banner, and polished output
**Researched:** 2026-04-07

---

### Phase 12 Domain Summary

Phase 11 delivered a working npx entrypoint (`src/setup.ts`) with a basic `1/2/3` readline prompt and `src/installer.ts` with the `editors` option. Phase 12 is a **UX polish pass** across the entire installer surface:

1. **Interactive editor picker** — Replace the flat 1/2/3 menu with a proper checkbox-style multi-select UX (still using `node:readline`, no new deps)
2. **CLI flags for scripting** — Add `--opencode`, `--cursor`, `--yes/-y` flags to `npx review-my-shit` and `rms install` so CI/scripting can bypass the interactive prompt
3. **RMS banner** — ASCII art / stylized banner displayed when `npx review-my-shit` runs
4. **Polished output** — Consistent emoji/icon prefix, better install summary, improved error messages across setup.ts, installer.ts, and index.ts install command

---

### Recommended Approach

#### Pillar 1: Interactive Editor Picker

The current UX is a flat 1/2/3 numbered list. The phase name says "interactive editor picker" — this implies a checkboxes-style interaction. Best approach **without adding deps**:

Use a simple multi-select pattern with `node:readline`: show options with `[x]` / `[ ]` toggles, let user press numbers to toggle, confirm with Enter. This is achievable with ~40 lines of readline code.

**Simpler alternative** (recommended for this codebase): Keep numbered list but improve the presentation — allow comma-separated input (`1,2` = both), show `>` cursor indicator, better validation. This is much simpler and equally usable.

**Recommended:** Improved numbered list (not full checkbox UX). The phase says "picker" not "checkbox UI". Clean numbered list with better validation and default handling is sufficient and avoids complex readline cursor manipulation.

#### Pillar 2: CLI Flags for Scripting

Add to both `npx review-my-shit` (setup.ts) and `rms install` (index.ts):
- `--opencode` — install OpenCode only (skips prompt)
- `--cursor` — install Cursor only (skips prompt)  
- `--yes` / `-y` — install both (default, skips prompt)

For `setup.ts`, use `process.argv` directly (since it has no Commander). Keep it simple:
```typescript
const args = process.argv.slice(2);
const flagOpencode = args.includes('--opencode');
const flagCursor = args.includes('--cursor');
const flagYes = args.includes('--yes') || args.includes('-y');
```

For `rms install` (index.ts Commander command), add `.option('--opencode').option('--cursor').option('--yes', ...).alias('-y')`.

**Key behavior:** If any flag is provided, skip the interactive prompt entirely and install directly.

#### Pillar 3: RMS Banner

ASCII banner for setup.ts. No deps needed — just `console.log` with template literals.

Recommended banner (simple, professional):
```
╔═══════════════════════════════╗
║  rms — review-my-shit         ║
║  AI code review pipeline      ║
╚═══════════════════════════════╝
```

Or more compact:
```
  ┌─────────────────────────────┐
  │  rms  review-my-shit v0.2   │
  └─────────────────────────────┘
```

Show version dynamically from `package.json` or just hardcode `v0.2.0` (simpler, update when bumping).

**Only in setup.ts** (npx path). The `rms install` command in index.ts can keep the simple header or get a lighter variant.

#### Pillar 4: Polished Output

Current gaps:
- `installer.ts` uses bare `console.log` with `✓` — good start but inconsistent
- `setup.ts` has no progress indicators during install
- No separation between sections
- Error messages are inconsistent

**Target output for setup.ts after polish:**
```
  ┌────────────────────────────────┐
  │  rms — review-my-shit v0.2.0  │
  └────────────────────────────────┘

  Which editors would you like to install for?

  1. OpenCode — global commands in ~/.config/opencode/command/
  2. Cursor   — global skills in ~/.cursor/skills/
  3. Both     — install for all editors (default)

  Enter choice [3]: 

  Installing for OpenCode + Cursor...

  OpenCode  ~/.config/opencode/command/
    ✓ rms-review.md
    ✓ rms-fix.md
    ✓ rms-settings.md

  Cursor  ~/.cursor/skills/
    ✓ rms-review/SKILL.md
    ✓ rms-fix/SKILL.md
    ✓ rms-settings/SKILL.md

  ✓ Done. Restart your editor to pick up /rms-review, /rms-fix, /rms-settings.
```

This is achievable by:
1. Updating `installer.ts` to use consistent `  ✓ ` prefix and blank-line section headers
2. Updating `setup.ts` to show banner + better prompt + "Installing for..." status line
3. **No color/ANSI** — the project philosophy is no deps; colored output via ANSI codes works in most terminals but fails in some CI environments and looks bad if captured to logs. Stick with plain text + Unicode box chars + emoji. Unicode box-drawing chars work fine in node:readline output.

---

### Implementation Patterns

#### pattern: CLI flags in setup.ts (no Commander)

```typescript
// Parse flags before showing prompt
const argv = process.argv.slice(2);
const flagOpencode = argv.includes('--opencode');
const flagCursor = argv.includes('--cursor');
const flagYes = argv.includes('--yes') || argv.includes('-y');
const hasFlag = flagOpencode || flagCursor || flagYes;

let editors: ('opencode' | 'cursor')[];
if (hasFlag) {
  if (flagOpencode && !flagCursor) editors = ['opencode'];
  else if (flagCursor && !flagOpencode) editors = ['cursor'];
  else editors = ['opencode', 'cursor']; // --yes or both flags
} else {
  // Interactive prompt...
  editors = await promptEditorSelection();
}
```

#### pattern: Banner in setup.ts

```typescript
function printBanner(version: string): void {
  console.log('');
  console.log('  ┌─────────────────────────────────┐');
  console.log(`  │  rms — review-my-shit  v${version.padEnd(8)}│`);
  console.log('  │  AI code review pipeline        │');
  console.log('  └─────────────────────────────────┘');
  console.log('');
}
```

Read version from package.json via `createRequire` or just hardcode — hardcode is simpler and consistent with existing `program.version('0.2.0')` in index.ts.

#### pattern: Add options to rms install (index.ts Commander)

```typescript
program
  .command('install')
  .description('Install rms slash commands (OpenCode: global, Cursor: global skills)')
  .option('--opencode', 'Install for OpenCode only')
  .option('--cursor', 'Install for Cursor only')
  .option('-y, --yes', 'Install for all editors without prompting')
  .action(async (opts: { opencode?: boolean; cursor?: boolean; yes?: boolean }) => {
    let editors: ('opencode' | 'cursor')[] = ['opencode', 'cursor']; // default
    if (opts.opencode && !opts.cursor) editors = ['opencode'];
    else if (opts.cursor && !opts.opencode) editors = ['cursor'];
    const projectRoot = process.cwd();
    await install(projectRoot, { editors });
  });
```

Note: `rms install` without flags currently installs both silently. With this change, it still does. The flags just add scripting capability on top.

---

### Dependency Decision

**No new runtime dependencies.** 

- No chalk / picocolors / kleur — ANSI codes would work but add complexity; Unicode box chars + emoji achieve the same visual effect cleanly
- No inquirer / prompts — phase 11 established the readline-only pattern; keep it
- No `fs` sync reads for package.json version — hardcode `v0.2.0` or use `createRequire` to import package.json

**Rationale:** The project's no-dep-for-install-flow philosophy (from STATE.md decisions and node:test choice) is load-bearing. `npx review-my-shit` must work in any Node ≥18 environment with zero network calls beyond the npx download itself. Adding deps to the install flow creates version pinning and update complexity.

---

### Scope Boundaries

**Phase 12 SHOULD:**
- Polish `src/setup.ts` (banner, flags, better prompt, better output)
- Polish `src/installer.ts` (consistent output formatting)
- Add flags to `rms install` in `src/index.ts`
- Update tests for any new flag behavior
- Bump version to 0.3.0 (meaningful UX release)
- Update README with new flag docs

**Phase 12 SHOULD NOT:**
- Change any pipeline logic (reviewer/validator/writer are untouched)
- Change any template files (opencode-review.md, cursor-rms-*, etc.)
- Add color/ANSI library dependencies
- Add a full checkbox TUI (overkill for 2-option selection)
- Change finding ID generation, session management, or fix command behavior
- Add `--version` flag handling beyond what Commander already does
- Touch anything in src/schemas.ts, src/config.ts, src/session.ts, etc.

---

### Risk Areas

1. **setup.ts flags + `rms install` flags diverge** — both need the same flag logic. Risk: one gets updated, the other doesn't. Mitigation: extract a shared `resolveEditors(argv)` utility or inline consistently in both.

2. **Installer tests break on output format change** — the existing installer tests only check file writes, not console output. No risk there. But if new flag handling tests are added, ensure they use the temp-dir pattern established in installer.test.ts.

3. **`rms install` backward compat** — current callers of `rms install` with no args must continue to install both editors silently. The Commander `.option()` flags are all optional; default behavior is preserved when no flags are passed. No risk.

4. **Banner width on narrow terminals** — box-drawing chars have fixed width; if the user's terminal is 60 chars wide, a 80-char box truncates badly. Keep banner ≤60 chars wide.

5. **Version hardcoding drift** — if `package.json` version bumps to `0.3.0` as part of this phase, the banner needs to match. Sync them in the same plan step.

---

### Standard Stack

**Recommended implementation:**

| Area | Approach |
|------|----------|
| Banner | ASCII box with Unicode box-drawing chars, hardcoded version string |
| Editor picker | Improved numbered list (1/2/3), no checkbox TUI |
| CLI flags (setup.ts) | Raw `process.argv` parsing — `--opencode`, `--cursor`, `--yes/-y` |
| CLI flags (rms install) | Commander `.option()` additions to existing command |
| Output polish | Consistent `  ✓ ` prefix, blank-line section separators, "Installing..." progress line |
| Dependencies | Zero new deps |
| Tests | Node:test additions for flag parsing behavior (setup.ts flags, install command flags) |
| Version bump | 0.2.0 → 0.3.0 |

**Plan split:**
- **Plan 01:** `src/setup.ts` — banner, flag parsing, improved prompt, polished output (all setup.ts changes)
- **Plan 02:** `src/installer.ts` + `src/index.ts` install command — polish installer output + add CLI flags to `rms install`, version bump, README update (checkpoint)

Both plans are independent enough to draft in parallel, but Plan 02 should verify Plan 01's flag-parsing approach before finalizing the `rms install` flags (same user-facing semantics).
