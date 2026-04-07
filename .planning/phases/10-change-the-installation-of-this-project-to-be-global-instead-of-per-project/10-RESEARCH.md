# Research: Phase 10 — Global Installation

**Phase:** 10 — change the installation of this project to be global instead of per project
**Researched:** 2026-04-07
**Status:** Complete

---

## Problem Statement

Currently `rms install` is a **per-project** operation:
- User must clone the repo, `npm install`, `npm run build`, then run `node dist/index.js install` inside each project
- Templates use `node dist/index.js` (assumes local `dist/` directory in the project)
- This is tedious and doesn't scale across multiple projects

The goal: make rms installable once globally so `/rms-review`, `/rms-fix`, and `/rms-settings` are available in ALL projects automatically.

---

## Key Findings

### 1. Editor Global Command Directories

**OpenCode:** Confirmed global command directory at `~/.config/opencode/command/`
- Already used by GSD and other global tools
- Commands installed here are available in every project opened in OpenCode
- OpenCode reads both `~/.config/opencode/command/` (global) and `.opencode/commands/` (per-project)

**Cursor:** No confirmed global command directory on this system
- Cursor uses `.cursor/commands/` per-project only
- No `~/.cursor/commands/` equivalent was found
- Cursor may not support global slash commands in the same way
- **Decision:** For Cursor, the per-project pattern must remain — but the global install flow should still install per-project Cursor templates alongside OpenCode global templates

### 2. npm Package Name Conflict

The name `rms` is already taken on npm (it's a Richard Stallman quotes package).

**Available alternatives:**
- `review-my-shit` — available on npm ✓
- `@username/rms` — scoped package ✓

**Resolution:** Rename package from `rms` → `review-my-shit` in `package.json` name field. Keep the `bin` entry as `"rms": "dist/index.js"` so the CLI command stays `rms`. This is a common pattern (e.g., `create-react-app` bin is `create-react-app`, package name is also that; `typescript` bin is `tsc`).

### 3. Global Install Flow (After Fix)

```bash
npm install -g review-my-shit   # installs rms CLI globally
rms install                      # installs editor commands globally
```

- The `rms install` command (via `process.cwd()`) currently writes to the current directory — this needs to change to write to global locations
- OpenCode global: `~/.config/opencode/command/`
- Cursor: best approach is to install to `.cursor/commands/` in current project (keep per-project for Cursor) OR document that Cursor requires per-project install

### 4. Template Changes Required

**Current templates use:** `node dist/index.js review $ARGUMENTS`
**Global templates should use:** `rms review $ARGUMENTS`

This is the critical change — once rms is globally installed via npm, the `rms` binary is in PATH and templates can call it directly.

For OpenCode global templates (`!rms review $ARGUMENTS`):
- OpenCode's `!command` syntax runs the command synchronously
- `rms` will be in PATH after global install

For Cursor templates:
- Keep `node dist/index.js` pattern for per-project installs (or switch to `rms` if globally installed)
- Cursor templates need to detect or document the install method

### 5. Installer Redesign

Two installation modes needed:

**Global mode (new default):**
- OpenCode: writes to `~/.config/opencode/command/rms-*.md`
- Cursor: writes to `.cursor/commands/rms-*.md` (still per-project — Cursor limitation)
- Templates call `rms <subcommand>` (not `node dist/index.js`)

**Local mode (backward compat, `--local` flag):**
- Both: write to `.opencode/commands/` and `.cursor/commands/` in `process.cwd()`
- Templates call `node dist/index.js <subcommand>` (existing behavior)

**Simpler alternative:** Single mode — always install globally for OpenCode, always install per-project for Cursor. The `rms install` command:
1. Writes `rms-*.md` to `~/.config/opencode/command/` (global OpenCode)
2. Writes `rms-*.md` to `${process.cwd()}/.cursor/commands/` (per-project Cursor)
3. Removes per-project OpenCode templates if they exist (cleanup)

### 6. New Template Files Needed

Need separate global templates that call `rms` instead of `node dist/index.js`:

| Template | Current | Global version |
|----------|---------|----------------|
| `opencode-review.md` | `!node dist/index.js review $ARGUMENTS` | `!rms review $ARGUMENTS` |
| `opencode-rms-fix.md` | `!node dist/index.js fix $ARGUMENTS` | `!rms fix $ARGUMENTS` |
| `opencode-settings.md` | `!node dist/index.js settings $ARGUMENTS` | `!rms settings $ARGUMENTS` |
| `cursor-review.md` | `node dist/index.js review $ARGUMENTS` | `rms review $ARGUMENTS` |
| `cursor-rms-fix.md` | `node dist/index.js fix $ARGUMENTS` | `rms fix $ARGUMENTS` |
| `cursor-settings.md` | `node dist/index.js settings $ARGUMENTS` | `rms settings $ARGUMENTS` |

### 7. README Update

README currently instructs users to:
1. Clone the repo
2. `npm install && npm run build`
3. `node dist/index.js install`

New README should show:
1. `npm install -g review-my-shit`
2. `rms install`

The per-project / dev workflow (`git clone`, `npm run build`) can stay as a "contributing" section.

### 8. session.ts / findLatestReportPath — Working Directory

The pipeline uses `process.cwd()` for `projectRoot` (where `.reviews/` is written). This already works correctly for global install: when user runs `/rms-review` from OpenCode inside project X, `process.cwd()` will be project X's root. No change needed here.

---

## Recommended Approach

**Simplest viable change (minimal surface area):**

1. **Rename package:** `rms` → `review-my-shit` in package.json `name` field only
2. **Add global OpenCode templates:** New template variants that call `rms` instead of `node dist/index.js`
3. **Update installer:** Write OpenCode templates to `~/.config/opencode/command/` (global), keep Cursor per-project
4. **Update README:** Show `npm install -g review-my-shit && rms install` as primary flow
5. **Cursor templates:** Update to call `rms` (user needs npm global install first)

**Files to change:**
- `package.json` — rename `name` field to `review-my-shit`
- `src/installer.ts` — change OpenCode dest from `.opencode/commands/` to `~/.config/opencode/command/`; update `console.log` messages
- `src/templates/opencode-*.md` — change `node dist/index.js` → `rms` (3 files)
- `src/templates/cursor-*.md` — change `node dist/index.js` → `rms` (3 files)  
- `README.md` — update Getting Started section
- `src/index.ts` — update install action logging to reflect global vs per-project
- Tests: `src/installer.test.ts` (if it exists) — update expected paths

**Not needed:**
- No new CLI flags
- No per-project cleanup logic (additive change)
- No backward compat mode (global is strictly better)

---

## Architecture Decision

**Install modes:** Single mode — `rms install` always writes:
- OpenCode commands → `~/.config/opencode/command/` (global)
- Cursor commands → `.cursor/commands/` in `process.cwd()` (per-project, Cursor limitation)

**Rationale:** Cursor does not have a confirmed global command directory. Writing Cursor templates per-project is the only reliable method. Users who want Cursor in multiple projects run `rms install` from each project (same as before, but now OpenCode is handled globally).

---

## Validation Architecture

**Automated tests:**
- `installer.ts` unit test: mock `homedir()`, verify OpenCode dest resolves to `~/.config/opencode/command/`
- Template content tests: verify templates contain `rms ` (not `node dist/index.js`)
- Smoke test: `npm pack`, extract, verify `bin/rms` works

**Manual verification:**
- `npm install -g review-my-shit` (or local: `npm install -g .`)
- `rms install` — verify `~/.config/opencode/command/rms-review.md` written
- Open any project in OpenCode, invoke `/rms-review` — should work

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `rms` npm name conflict | High (already confirmed) | Rename package to `review-my-shit` |
| Cursor no global commands dir | High (confirmed) | Accept per-project for Cursor |
| PATH issues with global install | Low | Standard npm global install behavior |
| Breaking existing per-project installs | Medium | Old `.opencode/commands/rms-*.md` remain; new global takes precedence in OpenCode |
| Tests hardcode old paths | Medium | Update installer test expected paths |
