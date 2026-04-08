#!/usr/bin/env node
/**
 * setup.ts — npx entrypoint for review-my-shit
 *
 * Registered as the "review-my-shit" bin entry in package.json.
 * When the user runs `npx review-my-shit`, this file runs — NOT src/index.ts.
 *
 * Supports:
 *   --opencode     Install for OpenCode only (skips prompt)
 *   --cursor       Install for Cursor only (skips prompt)
 *   --yes / -y     Install for all editors (skips prompt)
 *   (no flag)      Interactive numbered prompt
 */
import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { install } from './installer.js';

const VERSION = '0.3.0';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export const BANNER_STRING = [
  '',
  '  ┌─────────────────────────────────────┐',
  `  │  rms — review-my-shit  v${VERSION}       │`,
  '  │  AI code review pipeline            │',
  '  └─────────────────────────────────────┘',
  '',
].join('\n');

function printBanner(): void {
  console.log(BANNER_STRING);
}

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

/**
 * Parse editor selection from CLI flags.
 * Returns editors array if flags found, null if interactive prompt needed.
 *
 * Flags: --opencode, --cursor, --yes / -y
 * Precedence: --opencode + --cursor = both; --opencode alone = opencode only; etc.
 */
export function resolveEditorsFromArgs(argv: string[]): ('opencode' | 'cursor')[] | null {
  const flagOpencode = argv.includes('--opencode');
  const flagCursor = argv.includes('--cursor');
  const flagYes = argv.includes('--yes') || argv.includes('-y');

  const hasFlag = flagOpencode || flagCursor || flagYes;
  if (!hasFlag) return null;

  if (flagOpencode && !flagCursor && !flagYes) return ['opencode'];
  if (flagCursor && !flagOpencode && !flagYes) return ['cursor'];
  return ['opencode', 'cursor'];
}

// ---------------------------------------------------------------------------
// Interactive prompt
// ---------------------------------------------------------------------------

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptEditorSelection(): Promise<('opencode' | 'cursor')[]> {
  console.log('  Which editors would you like to install rms for?\n');
  console.log('  1. OpenCode  —  ~/.config/opencode/command/  (global, all projects)');
  console.log('  2. Cursor    —  ~/.cursor/skills/            (global, all projects)');
  console.log('  3. Both      —  install for all editors (default)');
  console.log('');

  const answer = await promptLine('  Enter choice [3]: ');

  if (answer === '1') return ['opencode'];
  if (answer === '2') return ['cursor'];
  // Default: both (covers empty input, '3', or anything else)
  return ['opencode', 'cursor'];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  printBanner();

  const argv = process.argv.slice(2);
  const flagEditors = resolveEditorsFromArgs(argv);

  let editors: ('opencode' | 'cursor')[];
  if (flagEditors !== null) {
    // Scripting path: skip prompt
    const label = flagEditors.length === 2 ? 'OpenCode + Cursor' : flagEditors[0] === 'opencode' ? 'OpenCode' : 'Cursor';
    console.log(`  Installing for ${label}...\n`);
    editors = flagEditors;
  } else {
    // Interactive path
    editors = await promptEditorSelection();
    const label = editors.length === 2 ? 'OpenCode + Cursor' : editors[0] === 'opencode' ? 'OpenCode' : 'Cursor';
    console.log(`\n  Installing for ${label}...\n`);
  }

  const projectRoot = process.cwd();
  await install(projectRoot, { editors });

  // Completion message
  console.log('');
  console.log('  ✓ Done. Restart your editor to pick up the new commands.\n');
  console.log('  Available commands:');
  if (editors.includes('opencode')) {
    console.log('    OpenCode:  /rms-review   /rms-fix   /rms-settings');
  }
  if (editors.includes('cursor')) {
    console.log('    Cursor:    /rms-review   /rms-fix   /rms-settings');
  }
  console.log('');
}

// Only execute when run directly (not when imported by tests or other modules).
//
// Use realpathSync on both sides so the check survives symlink-based runners
// (bunx, npx, bun link) where process.argv[1] is the unresolved symlink path
// (e.g. node_modules/.bin/review-my-shit) while import.meta.url reflects the
// real file path — a plain string comparison would always be false.
const __filename = fileURLToPath(import.meta.url);
function resolveReal(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const isMain = resolveReal(process.argv[1] ?? '') === resolveReal(__filename);
if (isMain) {
  main().catch((err) => {
    console.error('\n  [rms] Setup failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
