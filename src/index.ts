#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { install } from './installer.js';
import {
  getLocalDiff,
  getPrDiff,
  detectRepoSlug,
  writeInputFile,
  verifyFileExists,
} from './pipeline-io.js';
import { createSession } from './session.js';
import { runReviewer } from './reviewer.js';
import { runValidator } from './validator.js';
import { runWriter } from './writer.js';
import {
  findLatestReportPath,
  findFindingById,
  getAllFindings,
  buildFixContext,
  formatFixOutput,
  formatFindingList,
} from './fixer.js';

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

    // Step 2: Create session (nanoid suffix prevents same-day collision)
    const session = await createSession(projectRoot, `local-${nanoid(4)}`);
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
    await verifyFileExists(result.reviewerMdPath, 'REVIEWER.md');
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
    await verifyFileExists(validatorResult.validatorMdPath, 'VALIDATOR.md');
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
  .option('--focus <area>', 'Focus area (e.g., security, performance)')
  .action(async (prArg: string, opts: { focus?: string }) => {
    const prNumber = parseInt(prArg, 10);
    if (isNaN(prNumber) || prNumber <= 0) {
      console.error(`Invalid PR number: "${prArg}". Must be a positive integer.`);
      process.exit(1);
    }

    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(
        'GITHUB_TOKEN environment variable is not set. Required for PR diff fetching.',
      );
      process.exit(1);
    }

    const projectRoot = process.cwd();

    // Auto-detect owner/repo from git remote origin
    let repoSlug: string;
    try {
      repoSlug = await detectRepoSlug(projectRoot);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Fetch PR diff from GitHub
    let prDiff: Awaited<ReturnType<typeof getPrDiff>>;
    try {
      prDiff = await getPrDiff(prNumber, token, repoSlug);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const { diff, stats, branch } = prDiff;

    if (!diff.trim()) {
      console.error(`PR #${prNumber} has no reviewable changes after preprocessing.`);
      process.exit(1);
    }

    if (stats.strippedFiles.length > 0) {
      console.log(
        `Preprocessing stripped ${stats.strippedFiles.length} file(s): ${stats.strippedFiles.join(', ')}`,
      );
    }

    // Session slug: pr-{number}-{branch} — branch sanitized by createSession
    const session = await createSession(projectRoot, `pr-${prNumber}-${branch}`);
    console.log(`Review session: ${session.reviewId}`);
    console.log(`Output: .reviews/${session.reviewId}/`);

    // Write INPUT.md with PR metadata
    await writeInputFile({
      sessionDir: session.sessionDir,
      reviewId: session.reviewId,
      timestamp: session.timestamp,
      scope: 'pr-diff',
      focus: opts.focus,
      diff,
      prNumber,
      repoSlug,
      branch,
    });

    // Resolve model
    const model = await resolveModel();
    const reviewsDir = join(projectRoot, '.reviews');

    // Run pipeline — identical to review-local from here
    console.log('Running reviewer...');
    const result = await runReviewer({
      session,
      diff,
      focus: opts.focus,
      model,
      reviewsDir,
    });

    const inputMdPath = join(session.sessionDir, 'INPUT.md');
    await verifyFileExists(result.reviewerMdPath, 'REVIEWER.md');
    console.log('Running validator...');
    const validatorResult = await runValidator({
      session,
      reviewerMdPath: result.reviewerMdPath,
      inputMdPath,
      model,
    });

    const modelId = process.env['AI_SDK_MODEL'] ?? 'gpt-4o';
    const inputMdContent = await readFile(inputMdPath, 'utf8');
    await verifyFileExists(validatorResult.validatorMdPath, 'VALIDATOR.md');
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

    // Report results
    const challenged = validatorResult.verdicts.filter(v => v.verdict === 'challenged').length;
    const escalated = validatorResult.verdicts.filter(v => v.verdict === 'escalated').length;
    console.log(`\nReview complete:`);
    console.log(`  PR: #${prNumber} (${repoSlug})`);
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
  .command('fix')
  .description('Display a finding and its suggestion for the host AI agent to apply')
  .argument('[finding-id]', 'Finding ID (e.g., SEC-00001) — omit for interactive list')
  .option('--session <id>', 'Specific review session ID (default: latest)')
  .action(async (findingId: string | undefined, opts: { session?: string }) => {
    const projectRoot = process.cwd();
    const reviewsDir = join(projectRoot, '.reviews');

    if (!findingId) {
      // Interactive mode: list all findings from the latest (or specified) session
      const result = await getAllFindings(reviewsDir, opts.session);
      if (!result) {
        const sessionHint = opts.session ? `session '${opts.session}'` : 'any session in .reviews/';
        console.error(`[rms] No REPORT.md found in ${sessionHint}.`);
        console.error('Run /review first to generate a report.');
        process.exit(1);
      }

      console.log(formatFindingList(result.findings, result.sessionId));
      return;
    }

    // By-ID mode: find the specific finding, build context, emit for AI agent
    const reportResult = await findLatestReportPath(reviewsDir, opts.session);
    if (!reportResult) {
      const sessionHint = opts.session ? `session '${opts.session}'` : 'any session in .reviews/';
      console.error(`[rms] No REPORT.md found in ${sessionHint}.`);
      console.error('Run /review first to generate a report.');
      process.exit(1);
    }

    const finding = await findFindingById(reportResult.reportPath, findingId);
    if (!finding) {
      console.error(`[rms] Finding '${findingId}' not found in ${reportResult.reportPath}.`);
      console.error('Use /fix (no ID) to list available findings.');
      process.exit(1);
    }

    const ctx = await buildFixContext(projectRoot, reportResult.reportPath, reportResult.sessionId, finding);
    console.log(formatFixOutput(ctx));
  });

program.parse();
