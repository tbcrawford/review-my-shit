#!/usr/bin/env node
import { Command } from 'commander';
import { install } from './installer.js';

const program = new Command();

program
  .name('rms')
  .description('review-my-shit — AI code review pipeline')
  .version('0.1.0');

program
  .command('install')
  .description('Install rms slash commands into the current project')
  .action(async () => {
    const projectRoot = process.cwd();
    console.log(`Installing rms commands into ${projectRoot}...`);
    await install(projectRoot);
  });

program
  .command('review-local')
  .description('Run a code review on local git diff')
  .option('--focus <area>', 'Focus area (e.g., security, performance)')
  .action((opts: { focus?: string }) => {
    console.log('review-local — not yet implemented', opts);
  });

program
  .command('review-pr')
  .description('Run a code review on a GitHub PR diff')
  .argument('<pr-number>', 'GitHub PR number')
  .option('--focus <area>', 'Focus area')
  .action((pr: string, opts: { focus?: string }) => {
    console.log(`review-pr ${pr} — not yet implemented`, opts);
  });

program
  .command('fix')
  .description('Apply a finding by ID, or select interactively')
  .argument('[finding-id]', 'Finding ID (e.g., SEC-00001)')
  .action((id: string | undefined) => {
    console.log(`fix ${id ?? '(interactive)'} — not yet implemented`);
  });

program.parse();
