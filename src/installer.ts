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
 * Cursor skills install globally — available in all projects.
 * Path: ~/.cursor/skills/<name>/SKILL.md (confirmed global Cursor skill directory).
 * Each entry is a skill directory containing a SKILL.md with name: frontmatter.
 */
const CURSOR_SKILL_INSTALLS = [
  { templateDir: 'cursor-rms-review',   skillName: 'rms-review' },
  { templateDir: 'cursor-rms-fix',      skillName: 'rms-fix' },
  { templateDir: 'cursor-rms-settings', skillName: 'rms-settings' },
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
    console.log(`\nOpenCode (global): ${resolvedGlobalDir}`);
    for (const { template, dest } of GLOBAL_INSTALLS) {
      const templatePath = join(TEMPLATES_DIR, template);
      const destPath = join(resolvedGlobalDir, dest);
      await mkdir(dirname(destPath), { recursive: true });
      const content = await readFile(templatePath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
      console.log(`  ✓ ${dest}`);
    }
  }

  if (editors.includes('cursor')) {
    console.log(`\nCursor (global): ${resolvedCursorSkillsDir}`);
    for (const { templateDir, skillName } of CURSOR_SKILL_INSTALLS) {
      const templatePath = join(TEMPLATES_DIR, templateDir, 'SKILL.md');
      const destPath = join(resolvedCursorSkillsDir, skillName, 'SKILL.md');
      await mkdir(dirname(destPath), { recursive: true });
      const content = await readFile(templatePath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
      console.log(`  ✓ ${skillName}/SKILL.md`);
    }
  }

  console.log('\nrms installed.');
  if (editors.includes('opencode')) console.log('  OpenCode: commands available globally in all projects.');
  if (editors.includes('cursor')) console.log('  Cursor: skills available globally in all projects.');
  console.log('\nRestart your editor to pick up new commands.');
}
