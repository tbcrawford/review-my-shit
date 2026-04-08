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
import { fileURLToPath } from 'node:url';
import { checkbox } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import chalk from 'chalk';
import { install } from './installer.js';

const VERSION = '0.3.0';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const c = chalk.bold.cyan;
export const BANNER_STRING = [
  '',
  c('  ██████╗ ███╗   ███╗███████╗'),
  c('  ██╔══██╗████╗ ████║██╔════╝'),
  c('  ██████╔╝██╔████╔██║███████╗'),
  c('  ██╔══██╗██║╚██╔╝██║╚════██║'),
  c('  ██║  ██║██║ ╚═╝ ██║███████║'),
  c('  ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝'),
  `  ${chalk.gray('Review My Shit')}  ${chalk.yellow(`v${VERSION}`)}`,
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

async function promptEditorSelection(): Promise<('opencode' | 'cursor')[]> {
  try {
    const answer = await checkbox<'opencode' | 'cursor'>({
      message: 'Install globally for:',
      prefix: '',
      choices: [
        {
          name: 'OpenCode',
          value: 'opencode' as const,
          checked: true,
        },
        {
          name: 'Cursor',
          value: 'cursor' as const,
          checked: true,
        },
      ],
      theme: {
        icon: {
          cursor: '›',
          checked: chalk.green(' ◉'),
          unchecked: ' ◯',
        },
      },
    }, { clearPromptOnDone: true });

    if (answer.length === 0) {
      console.log('No editors selected — nothing to install.');
      process.exit(0);
    }

    return answer;
  } catch (err) {
    // Ctrl+C: ExitPromptError — exit cleanly, no install
    if (err instanceof ExitPromptError) {
      process.exit(130);
    }
    // Non-TTY or other error — default to both
    return ['opencode', 'cursor'];
  }
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
    console.log(`  Installing for ${label}...`);
    editors = flagEditors;
  } else {
    // Interactive path
    editors = await promptEditorSelection();
    const label = editors.length === 2 ? 'OpenCode + Cursor' : editors[0] === 'opencode' ? 'OpenCode' : 'Cursor';
    console.log(`  Installing for ${label}...`);
  }

  const projectRoot = process.cwd();
  await install(projectRoot, { editors });

  // Completion message
  console.log('');
  console.log(`  ${chalk.bold.white('Commands')}`);
  console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-review')}`);
  console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-fix')}`);
  console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-settings')}`);
  console.log('');
  console.log(`  ${chalk.gray('Restart your editor to pick up the new commands.')}`);
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
