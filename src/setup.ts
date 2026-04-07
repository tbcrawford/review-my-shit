#!/usr/bin/env node
/**
 * setup.ts — npx entrypoint for review-my-shit
 *
 * Registered as the "review-my-shit" bin entry in package.json.
 * When the user runs `npx review-my-shit`, this file runs — NOT src/index.ts.
 *
 * Prompts for editor selection using Node.js built-in readline (no new deps).
 * Calls install() with the selected editors.
 */
import { createInterface } from 'node:readline';
import { install } from './installer.js';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  console.log('');
  console.log('rms — review-my-shit installer');
  console.log('');
  console.log('Which editors would you like to install rms for?');
  console.log('  1. OpenCode only');
  console.log('  2. Cursor only');
  console.log('  3. Both (default)');
  console.log('');

  const answer = await prompt('Enter choice [3]: ');

  let editors: ('opencode' | 'cursor')[];
  if (answer === '1') {
    editors = ['opencode'];
  } else if (answer === '2') {
    editors = ['cursor'];
  } else {
    // Default: both (covers empty input, '3', or anything else)
    editors = ['opencode', 'cursor'];
  }

  const projectRoot = process.cwd();
  await install(projectRoot, { editors });

  console.log('');
  console.log('Done! Restart your editor to pick up the new commands.');
  console.log('');
  console.log('Available commands:');
  if (editors.includes('opencode')) {
    console.log('  OpenCode: /rms-review, /rms-fix, /rms-settings');
  }
  if (editors.includes('cursor')) {
    console.log('  Cursor:   /rms-review, /rms-fix, /rms-settings');
  }
}

main().catch((err) => {
  console.error('[rms] Setup failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
