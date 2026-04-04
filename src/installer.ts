import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

const INSTALLS = [
  { template: 'opencode-review-local.md', dest: '.opencode/commands/review-local.md' },
  { template: 'opencode-review-pr.md',    dest: '.opencode/commands/review-pr.md' },
  { template: 'cursor-review-local.md',   dest: '.cursor/commands/review-local.md' },
  { template: 'cursor-review-pr.md',      dest: '.cursor/commands/review-pr.md' },
];

export async function install(projectRoot: string): Promise<void> {
  for (const { template, dest } of INSTALLS) {
    const templatePath = join(TEMPLATES_DIR, template);
    const destPath = join(projectRoot, dest);

    // Ensure destination directory exists
    await mkdir(dirname(destPath), { recursive: true });

    // Read template and write to destination (idempotent — overwrites)
    const content = await readFile(templatePath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
    console.log(`  ✓ ${dest}`);
  }
  console.log('\nrms installed. Restart your editor to pick up new commands.');
}
