#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { install } from './installer.js';
import { getLocalDiff, writeInputFile } from './pipeline-io.js';
import { createSession } from './session.js';
import { runReviewer } from './reviewer.js';
import { runValidator } from './validator.js';
import { runWriter } from './writer.js';

// ---------------------------------------------------------------------------
// Model resolution (provider-agnostic)
// ---------------------------------------------------------------------------

/**
 * Resolves an AI SDK model instance from environment variables.
 *
 * Checks AI_SDK_PROVIDER (openai|anthropic|google) and AI_SDK_MODEL.
 * Falls back to OpenAI gpt-4o if unset.
 *
 * This is a Phase 2 implementation — Phase 5 will handle full model resolution
 * including reading model config from the editor's settings.
 */
async function resolveModel(): Promise<Parameters<typeof runReviewer>[0]['model']> {
  const provider = process.env['AI_SDK_PROVIDER'] ?? 'openai';
  const modelId = process.env['AI_SDK_MODEL'] ?? 'gpt-4o';

  if (provider === 'anthropic') {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(modelId);
  } else if (provider === 'google') {
    const { google } = await import('@ai-sdk/google');
    return google(modelId);
  } else {
    const { openai } = await import('@ai-sdk/openai');
    return openai(modelId);
  }
}

// ---------------------------------------------------------------------------
// CLI program
// ---------------------------------------------------------------------------

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
  .action(async (opts: { focus?: string }) => {
    const projectRoot = process.cwd();

    // Step 1: Get and preprocess the local diff
    const { diff, stats } = await getLocalDiff(projectRoot);

    if (!diff.trim()) {
      console.error('No changes to review. Stage or modify files first.');
      process.exit(1);
    }

    if (stats.strippedFiles.length > 0) {
      console.log(
        `Preprocessing stripped ${stats.strippedFiles.length} file(s): ${stats.strippedFiles.join(', ')}`,
      );
    }

    // Step 2: Create session
    const session = await createSession(projectRoot, 'local');
    console.log(`Review session: ${session.reviewId}`);
    console.log(`Output: .reviews/${session.reviewId}/`);

    // Step 3: Write INPUT.md
    await writeInputFile({
      sessionDir: session.sessionDir,
      reviewId: session.reviewId,
      timestamp: session.timestamp,
      scope: 'local-diff',
      focus: opts.focus,
      diff,
    });

    // Step 4: Run reviewer
    // Model is resolved from environment variables — provider agnostic (QUAL-03).
    // AI_SDK_PROVIDER: openai (default) | anthropic | google
    // AI_SDK_MODEL: model ID (default: gpt-4o)
    const model = await resolveModel();
    const reviewsDir = join(projectRoot, '.reviews');

    console.log('Running reviewer...');
    const result = await runReviewer({
      session,
      diff,
      focus: opts.focus,
      model,
      reviewsDir,
    });

    // Step 5: Run validator
    const inputMdPath = join(session.sessionDir, 'INPUT.md');
    console.log('Running validator...');
    const validatorResult = await runValidator({
      session,
      reviewerMdPath: result.reviewerMdPath,
      inputMdPath,
      model,
    });

    // Step 6: Run writer (deterministic — no LLM call)
    const modelId = process.env['AI_SDK_MODEL'] ?? 'gpt-4o';
    const inputMdContent = await readFile(inputMdPath, 'utf8');
    console.log('Running writer...');
    const writerResult = await runWriter({
      session,
      findings: result.findings,
      verdicts: validatorResult.verdicts,
      validatorRawContent: validatorResult.rawContent,
      inputMdContent,
      dimensionsCovered: result.dimensionsCovered,
      modelId,
      reviewsDir,
    });

    // Step 7: Report results
    const challenged = validatorResult.verdicts.filter(v => v.verdict === 'challenged').length;
    const escalated = validatorResult.verdicts.filter(v => v.verdict === 'escalated').length;
    console.log(`\nReview complete:`);
    console.log(`  Findings: ${result.findingCount}`);
    console.log(`  Verdicts: ${validatorResult.verdictCount} (${challenged} challenged, ${escalated} escalated)`);
    if (writerResult.counterFindingCount > 0) {
      console.log(`  Counter-findings surfaced: ${writerResult.counterFindingCount}`);
    }
    console.log(`  Total findings in report: ${writerResult.findingCount}`);
    console.log(`\nAudit trail:`);
    console.log(`  INPUT.md:     .reviews/${session.reviewId}/INPUT.md`);
    console.log(`  REVIEWER.md:  .reviews/${session.reviewId}/REVIEWER.md`);
    console.log(`  VALIDATOR.md: .reviews/${session.reviewId}/VALIDATOR.md`);
    console.log(`  REPORT.md:    .reviews/${session.reviewId}/REPORT.md`);
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
