import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { ensureDefaultConfig, getConfigPath } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * OpenCode commands install globally — available in all projects.
 * Path: ~/.config/opencode/command/ (confirmed global OpenCode command dir).
 */
const GLOBAL_INSTALLS = [
  { template: 'opencode-review.md',          dest: 'rms-review.md' },
  { template: 'opencode-rms-fix.md',         dest: 'rms-fix.md' },
  { template: 'opencode-settings.md',        dest: 'rms-settings.md' },
  { template: 'opencode-rms-reviewer.md',    dest: 'rms-reviewer.md' },
  { template: 'opencode-rms-validator.md',   dest: 'rms-validator.md' },
  { template: 'opencode-rms-writer.md',      dest: 'rms-writer.md' },
];

/**
 * Cursor skills install globally — available in all projects.
 * Path: ~/.cursor/skills/<name>/SKILL.md (confirmed global Cursor skill directory).
 * Each entry is a skill directory containing a SKILL.md with name: frontmatter.
 */
const CURSOR_SKILL_INSTALLS = [
  { templateDir: 'cursor-rms-review',    skillName: 'rms-review' },
  { templateDir: 'cursor-rms-fix',       skillName: 'rms-fix' },
  { templateDir: 'cursor-rms-settings',  skillName: 'rms-settings' },
  { templateDir: 'cursor-rms-reviewer',  skillName: 'rms-reviewer' },
  { templateDir: 'cursor-rms-validator', skillName: 'rms-validator' },
  { templateDir: 'cursor-rms-writer',    skillName: 'rms-writer' },
];

export async function install(
  projectRoot: string,
  options?: {
    editors?: ('opencode' | 'cursor')[];
    globalDir?: string;
    cursorSkillsDir?: string;
  }
): Promise<void> {
  const editors = options?.editors ?? ['opencode', 'cursor'];
  const resolvedGlobalDir = options?.globalDir ?? join(homedir(), '.config', 'opencode', 'command');
  const resolvedCursorSkillsDir = options?.cursorSkillsDir ?? join(homedir(), '.cursor', 'skills');

  if (editors.includes('opencode')) {
    console.log(`\n  ${chalk.bold('OpenCode')} ${chalk.gray(resolvedGlobalDir)}`);
    for (const { template, dest } of GLOBAL_INSTALLS) {
      const templatePath = join(TEMPLATES_DIR, template);
      const destPath = join(resolvedGlobalDir, dest);
      await mkdir(dirname(destPath), { recursive: true });
      const content = await readFile(templatePath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
      console.log(`  ${chalk.green('›')} ${dest}`);
    }
  }

  if (editors.includes('cursor')) {
    console.log(`\n  ${chalk.bold('Cursor')} ${chalk.gray(resolvedCursorSkillsDir)}`);
    for (const { templateDir, skillName } of CURSOR_SKILL_INSTALLS) {
      const templatePath = join(TEMPLATES_DIR, templateDir, 'SKILL.md');
      const destPath = join(resolvedCursorSkillsDir, skillName, 'SKILL.md');
      await mkdir(dirname(destPath), { recursive: true });
      const content = await readFile(templatePath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
      console.log(`  ${chalk.green('›')} ${skillName}/SKILL.md`);
    }
  }

  // Create default config if it doesn't already exist
  const configResult = await ensureDefaultConfig();
  if (configResult === 'created') {
    console.log(`\n  ${chalk.green('✓')} Default config created at ${chalk.gray(getConfigPath())}`);
  }

}
