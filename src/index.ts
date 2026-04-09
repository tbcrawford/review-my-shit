#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { install } from './installer.js';
import { loadRmsConfig, resolveAgentModel, getConfigPath, saveRmsConfig, ensureDefaultConfig, DEFAULT_RMS_CONFIG } from './config.js';
import { runModelPicker } from './model-picker.js';
import type { AgentModelSpec, RmsConfig } from './schemas.js';
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
// Model resolution (copilot-only, reads config.opencode)
// ---------------------------------------------------------------------------

/**
 * Resolves per-agent model instances from config.opencode section.
 *
 * Priority: ~/.config/rms/config.json (opencode section) > DEFAULT_RMS_CONFIG.opencode
 * Throws if config exists but is invalid. Returns three model instances.
 */
async function resolveModels(): Promise<{
  reviewerModel: Parameters<typeof runReviewer>[0]['model'];
  validatorModel: Parameters<typeof runValidator>[0]['model'];
  writerModelId: string;
}> {
  const config = await loadRmsConfig();
  const opencode = config?.opencode ?? DEFAULT_RMS_CONFIG.opencode;

  const reviewerModel = await resolveAgentModel(opencode.reviewer);
  const validatorModel = await resolveAgentModel(opencode.validator);
  const writerModelId = opencode.writer.model;

  return { reviewerModel, validatorModel, writerModelId };
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
// parseSpec helper — parses "model" or "model:variant" spec strings
// ---------------------------------------------------------------------------

/**
 * Parses a model spec string into an AgentModelSpec.
 *
 * Format: "model" or "model:variant"
 * The string is split on the LAST colon only if the right-hand side is exactly
 * "high_thinking" or "no_thinking". Otherwise the entire string is the model ID.
 *
 * Examples:
 *   "github-copilot/claude-opus-4.6:high_thinking" → { model: "github-copilot/claude-opus-4.6", variant: "high_thinking" }
 *   "github-copilot/claude-opus-4.6"               → { model: "github-copilot/claude-opus-4.6" }
 *   "claude-4.6-opus-high-thinking"                → { model: "claude-4.6-opus-high-thinking" }
 */
function parseSpec(raw: string, label: string): AgentModelSpec {
  const VALID_VARIANTS = ['high_thinking', 'no_thinking'] as const;
  const lastColon = raw.lastIndexOf(':');

  if (lastColon !== -1) {
    const suffix = raw.slice(lastColon + 1);
    if ((VALID_VARIANTS as readonly string[]).includes(suffix)) {
      const model = raw.slice(0, lastColon);
      if (!model) {
        console.error(`Invalid ${label} spec "${raw}": model ID cannot be empty`);
        process.exit(1);
      }
      return { model, variant: suffix as 'high_thinking' | 'no_thinking' };
    }
  }

  // No valid variant suffix — treat entire string as model ID
  if (!raw.trim()) {
    console.error(`Invalid ${label} spec: model ID cannot be empty`);
    process.exit(1);
  }
  return { model: raw };
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
    const configResult = await ensureDefaultConfig();
    if (configResult === 'created') {
      console.log(`\n  ${chalk.green('✓')} Default config created at ${chalk.gray(getConfigPath())}`);
    }

    // Completion summary
    console.log(`\n  ${chalk.bold.white('Commands')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-review')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-fix')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-models')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-reviewer')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-validator')}`);
    console.log(`  ${chalk.green('›')} ${chalk.yellow('/rms-writer')}`);
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
  .option('--reviewer <spec>', 'Set reviewer model (format: model or model:variant)')
  .option('--validator <spec>', 'Set validator model (format: model or model:variant)')
  .option('--writer <spec>', 'Set writer model (format: model or model:variant)')
  .option('--opencode', 'Scope to opencode section only')
  .option('--cursor', 'Scope to cursor section only')
  .option('--reset', 'Delete config file and revert to defaults')
  .action(async (opts: { reviewer?: string; validator?: string; writer?: string; opencode?: boolean; cursor?: boolean; reset?: boolean }) => {
    const { unlink } = await import('node:fs/promises');
    const configPath = getConfigPath();

    if (opts.reset) {
      try {
        await unlink(configPath);
        console.log(`Config deleted: ${configPath}`);
        console.log('Reverted to DEFAULT_RMS_CONFIG on next run.');
      } catch {
        console.log('No config file found — already using defaults.');
      }
      return;
    }

    // If any model flags provided, update config
    if (opts.reviewer || opts.validator || opts.writer) {
      const existing = await loadRmsConfig();
      const base: RmsConfig = existing ?? DEFAULT_RMS_CONFIG;

      // Determine which sections to update
      // Default: update both sections if no scope flag given
      const updateOpencode = !opts.cursor || opts.opencode;
      const updateCursor = !opts.opencode || opts.cursor;

      const reviewerSpec = opts.reviewer ? parseSpec(opts.reviewer, 'reviewer') : null;
      const validatorSpec = opts.validator ? parseSpec(opts.validator, 'validator') : null;
      const writerSpec = opts.writer ? parseSpec(opts.writer, 'writer') : null;

      const updated: RmsConfig = {
        opencode: updateOpencode ? {
          reviewer:  reviewerSpec  ?? base.opencode.reviewer,
          validator: validatorSpec ?? base.opencode.validator,
          writer:    writerSpec    ?? base.opencode.writer,
        } : base.opencode,
        cursor: updateCursor ? {
          reviewer:  reviewerSpec  ?? base.cursor.reviewer,
          validator: validatorSpec ?? base.cursor.validator,
          writer:    writerSpec    ?? base.cursor.writer,
        } : base.cursor,
      };

      await saveRmsConfig(updated);
      console.log(`Config saved to: ${configPath}`);
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    // No flags: display current config overview (both sections)
    const config = await loadRmsConfig();
    const effective = config ?? DEFAULT_RMS_CONFIG;
    const source = config ? configPath : '(defaults — no config file)';

    console.log(`Config: ${source}`);
    console.log('');
    console.log('  opencode:');
    for (const [agent, spec] of Object.entries(effective.opencode) as [string, AgentModelSpec][]) {
      const variantTag = spec.variant ? chalk.gray(` [${spec.variant}]`) : '';
      console.log(`    ${agent.padEnd(9)}  ${chalk.yellow(spec.model)}${variantTag}`);
    }
    console.log('');
    console.log('  cursor:');
    for (const [agent, spec] of Object.entries(effective.cursor) as [string, AgentModelSpec][]) {
      console.log(`    ${agent.padEnd(9)}  ${chalk.yellow(spec.model)}`);
    }
    console.log('');
    console.log('Change a model: /rms-reviewer  /rms-validator  /rms-writer');
    console.log('Reset config:   rms settings --reset');
    return;
  });

program
  .command('reviewer')
  .description('Set the reviewer agent model — interactive picker or direct spec')
  .argument('[spec]', 'Model spec (format: model or model:variant) — omit for interactive picker')
  .action(async (spec: string | undefined) => {
    const config = await loadRmsConfig();
    const base: RmsConfig = config ?? DEFAULT_RMS_CONFIG;

    if (spec) {
      const parsed = parseSpec(spec, 'reviewer');
      const updated: RmsConfig = {
        opencode: { ...base.opencode, reviewer: parsed },
        cursor:   { ...base.cursor,   reviewer: parsed },
      };
      await saveRmsConfig(updated);
      const variantTag = parsed.variant ? ` [${parsed.variant}]` : '';
      console.log(`${chalk.green('✓')} Reviewer set to ${chalk.yellow(`${parsed.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
      return;
    }

    try {
      const current = base.opencode.reviewer;
      const pickedSpec = await runModelPicker('reviewer', current);
      const updated: RmsConfig = {
        opencode: { ...base.opencode, reviewer: pickedSpec },
        cursor:   { ...base.cursor,   reviewer: pickedSpec },
      };
      await saveRmsConfig(updated);
      const variantTag = pickedSpec.variant ? ` [${pickedSpec.variant}]` : '';
      console.log(`${chalk.green('✓')} Reviewer set to ${chalk.yellow(`${pickedSpec.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
    } catch {
      console.log('Cancelled.');
    }
  });

program
  .command('validator')
  .description('Set the validator agent model — interactive picker or direct spec')
  .argument('[spec]', 'Model spec (format: model or model:variant) — omit for interactive picker')
  .action(async (spec: string | undefined) => {
    const config = await loadRmsConfig();
    const base: RmsConfig = config ?? DEFAULT_RMS_CONFIG;

    if (spec) {
      const parsed = parseSpec(spec, 'validator');
      const updated: RmsConfig = {
        opencode: { ...base.opencode, validator: parsed },
        cursor:   { ...base.cursor,   validator: parsed },
      };
      await saveRmsConfig(updated);
      const variantTag = parsed.variant ? ` [${parsed.variant}]` : '';
      console.log(`${chalk.green('✓')} Validator set to ${chalk.yellow(`${parsed.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
      return;
    }

    try {
      const current = base.opencode.validator;
      const pickedSpec = await runModelPicker('validator', current);
      const updated: RmsConfig = {
        opencode: { ...base.opencode, validator: pickedSpec },
        cursor:   { ...base.cursor,   validator: pickedSpec },
      };
      await saveRmsConfig(updated);
      const variantTag = pickedSpec.variant ? ` [${pickedSpec.variant}]` : '';
      console.log(`${chalk.green('✓')} Validator set to ${chalk.yellow(`${pickedSpec.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
    } catch {
      console.log('Cancelled.');
    }
  });

program
  .command('writer')
  .description('Set the writer agent model — interactive picker or direct spec')
  .argument('[spec]', 'Model spec (format: model or model:variant) — omit for interactive picker')
  .action(async (spec: string | undefined) => {
    const config = await loadRmsConfig();
    const base: RmsConfig = config ?? DEFAULT_RMS_CONFIG;

    if (spec) {
      const parsed = parseSpec(spec, 'writer');
      const updated: RmsConfig = {
        opencode: { ...base.opencode, writer: parsed },
        cursor:   { ...base.cursor,   writer: parsed },
      };
      await saveRmsConfig(updated);
      const variantTag = parsed.variant ? ` [${parsed.variant}]` : '';
      console.log(`${chalk.green('✓')} Writer set to ${chalk.yellow(`${parsed.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
      return;
    }

    try {
      const current = base.opencode.writer;
      const pickedSpec = await runModelPicker('writer', current);
      const updated: RmsConfig = {
        opencode: { ...base.opencode, writer: pickedSpec },
        cursor:   { ...base.cursor,   writer: pickedSpec },
      };
      await saveRmsConfig(updated);
      const variantTag = pickedSpec.variant ? ` [${pickedSpec.variant}]` : '';
      console.log(`${chalk.green('✓')} Writer set to ${chalk.yellow(`${pickedSpec.model}${variantTag}`)}`);
      console.log(`  Config: ${getConfigPath()}`);
    } catch {
      console.log('Cancelled.');
    }
  });

program.parse();
