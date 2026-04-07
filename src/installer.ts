import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * OpenCode commands install globally — available in all projects.
 * Path: ~/.config/opencode/command/ (confirmed global OpenCode command dir).
 */
const GLOBAL_INSTALLS = [
  { template: 'opencode-review.md',   dest: 'rms-review.md' },
  { template: 'opencode-rms-fix.md',  dest: 'rms-fix.md' },
  { template: 'opencode-settings.md', dest: 'rms-settings.md' },
];

/**
 * Cursor commands install per-project — Cursor has no confirmed global command directory.
 * Run `rms install` from each project where you want Cursor integration.
 */
const PROJECT_INSTALLS = [
  { template: 'cursor-review.md',   dest: '.cursor/commands/rms-review.md' },
  { template: 'cursor-rms-fix.md',  dest: '.cursor/commands/rms-fix.md' },
  { template: 'cursor-settings.md', dest: '.cursor/commands/rms-settings.md' },
];

export async function install(projectRoot: string, globalDir?: string): Promise<void> {
  const resolvedGlobalDir = globalDir ?? join(homedir(), '.config', 'opencode', 'command');

  // Install OpenCode commands globally
  console.log(`\nOpenCode (global): ${resolvedGlobalDir}`);
  for (const { template, dest } of GLOBAL_INSTALLS) {
    const templatePath = join(TEMPLATES_DIR, template);
    const destPath = join(resolvedGlobalDir, dest);
    await mkdir(dirname(destPath), { recursive: true });
    const content = await readFile(templatePath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
    console.log(`  ✓ ${dest}`);
  }

  // Install Cursor commands per-project
  console.log(`\nCursor (this project): ${projectRoot}`);
  for (const { template, dest } of PROJECT_INSTALLS) {
    const templatePath = join(TEMPLATES_DIR, template);
    const destPath = join(projectRoot, dest);
    await mkdir(dirname(destPath), { recursive: true });
    const content = await readFile(templatePath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
    console.log(`  ✓ ${dest}`);
  }

  console.log('\nrms installed.');
  console.log('  OpenCode: commands available globally in all projects.');
  console.log('  Cursor: commands installed in this project. Run `rms install` from other projects for Cursor integration.');
  console.log('\nRestart your editor to pick up new commands.');
}
