#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { install } from './installer.js';
import { loadRmsConfig, resolveAgentModel, getConfigPath, saveRmsConfig } from './config.js';
import type { AgentModelSpec } from './schemas.js';
import {
  getLocalDiff,
  getFullDiff,
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
// Model resolution (provider-agnostic, per-agent)
// ---------------------------------------------------------------------------

/**
 * Resolves per-agent model instances from config or env var fallback.
 *
 * Priority: ~/.config/rms/config.json > AI_SDK_PROVIDER + AI_SDK_MODEL env vars
 * Throws if config exists but is invalid. Returns three model instances.
 */
async function resolveModels(): Promise<{
  reviewerModel: Parameters<typeof runReviewer>[0]['model'];
  validatorModel: Parameters<typeof runValidator>[0]['model'];
  writerModelId: string;
}> {
  const config = await loadRmsConfig();

  if (config) {
    const reviewerModel = await resolveAgentModel(config.reviewer);
    const validatorModel = await resolveAgentModel(config.validator);
    const writerModelId = `${config.writer.provider}:${config.writer.model}`;
    return { reviewerModel, validatorModel, writerModelId };
  }

  // Fallback: env vars (backward compat for users without config file)
  const provider = process.env['AI_SDK_PROVIDER'] ?? 'openai';
  const modelId = process.env['AI_SDK_MODEL'] ?? 'gpt-4o';
  const fallbackSpec: AgentModelSpec = {
    provider: provider as 'openai' | 'anthropic' | 'google',
    model: modelId,
  };
  const model = await resolveAgentModel(fallbackSpec);
  return { reviewerModel: model, validatorModel: model, writerModelId: modelId };
}

// ---------------------------------------------------------------------------
// Shared pipeline helpers
// ---------------------------------------------------------------------------

/**
 * Runs the full local-diff review pipeline.
 * Extracted from the `review-local` action body — no pipeline logic changed.
 */
async function runLocalReview(opts: { projectRoot: string; focus?: string }): Promise<void> {
  const { projectRoot, focus } = opts;

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
    focus,
    diff,
  });

  // Step 4: Run reviewer
  // Model is resolved from config file or environment variables — provider agnostic (QUAL-03).
  // Priority: ~/.config/rms/config.json > AI_SDK_PROVIDER + AI_SDK_MODEL env vars
  const { reviewerModel, validatorModel, writerModelId } = await resolveModels();
  const reviewsDir = join(projectRoot, '.reviews');

  console.log('Running reviewer...');
  const result = await runReviewer({
    session,
    diff,
    focus,
    model: reviewerModel,
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
    model: validatorModel,
  });

  // Step 6: Run writer (deterministic — no LLM call)
  const modelId = writerModelId;
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
}

/**
 * Runs the full-codebase review pipeline (empty tree → HEAD).
 * Identical pipeline to runLocalReview — only diff source, session slug, and scope differ.
 */
async function runFullReview(opts: { projectRoot: string; focus?: string }): Promise<void> {
  const { projectRoot, focus } = opts;

  // Step 1: Get full-codebase diff (empty tree → HEAD)
  const { diff, stats } = await getFullDiff(projectRoot);

  if (!diff.trim()) {
    console.error('No commits found in this repository.');
    process.exit(1);
  }

  if (stats.strippedFiles.length > 0) {
    console.log(
      `Preprocessing stripped ${stats.strippedFiles.length} file(s): ${stats.strippedFiles.join(', ')}`,
    );
  }

  // Step 2: Create session (nanoid suffix prevents same-day collision)
  const session = await createSession(projectRoot, `full-${nanoid(4)}`);
  console.log(`Review session: ${session.reviewId}`);
  console.log(`Output: .reviews/${session.reviewId}/`);

  // Step 3: Write INPUT.md
  await writeInputFile({
    sessionDir: session.sessionDir,
    reviewId: session.reviewId,
    timestamp: session.timestamp,
    scope: 'full-diff',
    focus,
    diff,
  });

  // Step 4: Run reviewer
  const { reviewerModel, validatorModel, writerModelId } = await resolveModels();
  const reviewsDir = join(projectRoot, '.reviews');

  console.log('Running reviewer...');
  const result = await runReviewer({
    session,
    diff,
    focus,
    model: reviewerModel,
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
    model: validatorModel,
  });

  // Step 6: Run writer (deterministic — no LLM call)
  const modelId = writerModelId;
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
}

/**
 * Runs the full PR-diff review pipeline.
 * Extracted from the `review-pr` action body — no pipeline logic changed.
 */
async function runPrReview(opts: { projectRoot: string; prNumber: number; focus?: string }): Promise<void> {
  const { projectRoot, prNumber, focus } = opts;

  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    console.error(
      'GITHUB_TOKEN environment variable is not set. Required for PR diff fetching.',
    );
    process.exit(1);
  }

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
    focus,
    diff,
    prNumber,
    repoSlug,
    branch,
  });

  // Resolve model
  const { reviewerModel, validatorModel, writerModelId } = await resolveModels();
  const reviewsDir = join(projectRoot, '.reviews');

  // Run pipeline — identical to review-local from here
  console.log('Running reviewer...');
  const result = await runReviewer({
    session,
    diff,
    focus,
    model: reviewerModel,
    reviewsDir,
  });

  const inputMdPath = join(session.sessionDir, 'INPUT.md');
  await verifyFileExists(result.reviewerMdPath, 'REVIEWER.md');
  console.log('Running validator...');
  const validatorResult = await runValidator({
    session,
    reviewerMdPath: result.reviewerMdPath,
    inputMdPath,
    model: validatorModel,
  });

  const modelId = writerModelId;
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
}

// ---------------------------------------------------------------------------
// CLI program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('rms')
  .description('review-my-shit — AI code review pipeline')
  .version('0.3.0');

program
  .command('install')
  .description('Install rms slash commands (OpenCode: global, Cursor: global skills)')
  .option('--opencode', 'Install for OpenCode only')
  .option('--cursor', 'Install for Cursor only')
  .option('-y, --yes', 'Install for all editors without prompting')
  .action(async (opts: { opencode?: boolean; cursor?: boolean; yes?: boolean }) => {
    const projectRoot = process.cwd();

    let editors: ('opencode' | 'cursor')[] = ['opencode', 'cursor']; // default: both
    if (opts.opencode && !opts.cursor && !opts.yes) {
      editors = ['opencode'];
    } else if (opts.cursor && !opts.opencode && !opts.yes) {
      editors = ['cursor'];
    }
    // --yes, both flags, or no flags all result in both editors (default)

    await install(projectRoot, { editors });

    // Completion summary (installer no longer prints this)
    const label = editors.length === 2 ? 'OpenCode + Cursor' : editors[0] === 'opencode' ? 'OpenCode' : 'Cursor';
    console.log(`\n  ${chalk.bold.white('Commands')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-review')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-fix')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-settings')}`);
    console.log(`\n  ${chalk.gray('Restart your editor to pick up the new commands.')}`);
  });

program.command('review')
  .description('Run a code review (unified entry point — routes to local or pr scope)')
  .argument('[scope]', 'Scope: "local" or "pr"')
  .argument('[pr-number]', 'GitHub PR number (required when scope is "pr")')
  .option('--focus <area>', 'Focus area (e.g., security, performance)')
  .action(async (scope: string | undefined, prArg: string | undefined, opts: { focus?: string }) => {
    const projectRoot = process.cwd();

    // No scope provided — interactive selector
    if (!scope) {
      let chosenScope: string;
      try {
        chosenScope = await select({
          message: 'What would you like to review?',
          choices: [
            {
              name: 'local  —  Review staged and unstaged git changes',
              value: 'local',
            },
            {
              name: 'pr     —  Review a GitHub Pull Request',
              value: 'pr',
            },
            {
              name: 'full   —  Review the entire codebase (root commit to HEAD)',
              value: 'full',
            },
          ],
        });
      } catch {
        // Non-TTY or user cancelled (Ctrl+C) — print usage and exit cleanly
        console.log('\nUsage:');
        console.log('  rms review local [--focus <area>]');
        console.log('  rms review pr <pr-number> [--focus <area>]');
        console.log('  rms review full [--focus <area>]');
        return;
      }

      if (chosenScope === 'local') {
        await runLocalReview({ projectRoot, focus: opts.focus });
        return;
      }

      if (chosenScope === 'pr') {
        // For PR scope, we still need the PR number — prompt for it
        let prInput: string;
        try {
          prInput = await input({ message: 'Enter PR number:' });
        } catch {
          console.error('[rms] PR number required. Usage: rms review pr <pr-number>');
          process.exit(1);
        }
        const prNumber = parseInt(prInput, 10);
        if (isNaN(prNumber) || prNumber <= 0) {
          console.error(`Invalid PR number: "${prInput}". Must be a positive integer.`);
          process.exit(1);
        }
        await runPrReview({ projectRoot, prNumber, focus: opts.focus });
        return;
      }

      if (chosenScope === 'full') {
        await runFullReview({ projectRoot, focus: opts.focus });
        return;
      }

      return;
    }

    if (scope === 'local') {
      await runLocalReview({ projectRoot, focus: opts.focus });
      return;
    }

    if (scope === 'pr') {
      if (!prArg) {
        console.error('[rms] PR number required. Usage: rms review pr <pr-number> [--focus <area>]');
        process.exit(1);
      }
      const prNumber = parseInt(prArg, 10);
      if (isNaN(prNumber) || prNumber <= 0) {
        console.error(`Invalid PR number: "${prArg}". Must be a positive integer.`);
        process.exit(1);
      }
      await runPrReview({ projectRoot, prNumber, focus: opts.focus });
      return;
    }

    if (scope === 'full') {
      await runFullReview({ projectRoot, focus: opts.focus });
      return;
    }

    console.error(`[rms] Unknown scope: "${scope}". Valid scopes are: local, pr, full`);
    process.exit(1);
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

program
  .command('settings')
  .description('View or set per-agent model configuration')
  .option('--reviewer <spec>', 'Set reviewer model (format: provider:model or github-copilot/model-id)')
  .option('--validator <spec>', 'Set validator model (format: provider:model or github-copilot/model-id)')
  .option('--writer <spec>', 'Set writer model (format: provider:model or github-copilot/model-id)')
  .option('--reset', 'Delete config file and revert to env var fallback')
  .action(async (opts: { reviewer?: string; validator?: string; writer?: string; reset?: boolean }) => {
    const { unlink } = await import('node:fs/promises');
    const configPath = getConfigPath();

    if (opts.reset) {
      try {
        await unlink(configPath);
        console.log(`Config deleted: ${configPath}`);
        console.log('Reverted to AI_SDK_PROVIDER / AI_SDK_MODEL env vars.');
      } catch {
        console.log('No config file found — already using env var defaults.');
      }
      return;
    }

    // Parse a provider:model spec string (also accepts github-copilot/model-id format)
    function parseSpec(raw: string, label: string): AgentModelSpec {
      // Accept raw "github-copilot/model-id" from `opencode models` output
      if (raw.startsWith('github-copilot/')) {
        const model = raw.slice('github-copilot/'.length);
        if (!model) {
          console.error(`Invalid ${label} spec "${raw}": model ID cannot be empty`);
          process.exit(1);
        }
        return { provider: 'copilot', model };
      }

      // Standard "provider:model-id" format
      const colonIdx = raw.indexOf(':');
      if (colonIdx === -1) {
        console.error(
          `Invalid ${label} spec "${raw}". Expected format: provider:model (e.g. anthropic:claude-opus-4-5) or github-copilot/model-id`,
        );
        process.exit(1);
      }
      const provider = raw.slice(0, colonIdx) as AgentModelSpec['provider'];
      const model = raw.slice(colonIdx + 1);
      if (!['openai', 'anthropic', 'google', 'copilot'].includes(provider)) {
        console.error(
          `Invalid provider "${provider}". Must be one of: openai, anthropic, google, copilot`,
        );
        process.exit(1);
      }
      if (!model) {
        console.error(`Invalid ${label} spec "${raw}": model ID cannot be empty`);
        process.exit(1);
      }
      return { provider, model };
    }

    // If any flags provided, update config
    if (opts.reviewer || opts.validator || opts.writer) {
      const existing = await loadRmsConfig();
      const defaults = {
        reviewer: { provider: 'openai' as const, model: 'gpt-4o' },
        validator: { provider: 'openai' as const, model: 'gpt-4o' },
        writer: { provider: 'openai' as const, model: 'gpt-4o' },
      };
      const base = existing ?? defaults;
      const updated = {
        reviewer: opts.reviewer ? parseSpec(opts.reviewer, 'reviewer') : base.reviewer,
        validator: opts.validator ? parseSpec(opts.validator, 'validator') : base.validator,
        writer: opts.writer ? parseSpec(opts.writer, 'writer') : base.writer,
      };
      await saveRmsConfig(updated);
      console.log(`Config saved to: ${configPath}`);
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    // No flags: show current state
    const config = await loadRmsConfig();
    console.log(`Config path: ${configPath}`);
    console.log('');
    if (config) {
      console.log('Current configuration:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('Not configured — using env var fallback:');
      console.log(`  AI_SDK_PROVIDER = ${process.env['AI_SDK_PROVIDER'] ?? 'openai (default)'}`);
      console.log(`  AI_SDK_MODEL    = ${process.env['AI_SDK_MODEL'] ?? 'gpt-4o (default)'}`);
      console.log('');
      console.log('To configure per-agent models:');
      console.log('  rms settings --reviewer copilot:claude-opus-4.6');
      console.log('  rms settings --reviewer github-copilot/claude-opus-4.6  (copy-paste from opencode models)');
      console.log('  rms settings --reviewer anthropic:claude-opus-4-5');
      console.log('  rms settings --validator anthropic:claude-sonnet-4-5');
      console.log('  rms settings --writer openai:gpt-4o');
    }
  });

program.parse();
