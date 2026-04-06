/**
 * Validator agent — the adversarial counterpart to the reviewer in the rms pipeline.
 *
 * Reads REVIEWER.md (structured findings) and INPUT.md (full diff context),
 * challenges findings rather than rubber-stamping them, writes VALIDATOR.md,
 * and returns structured verdicts.
 *
 * Isolation is enforced by what is NOT passed: only file content enters the
 * validator context — the reviewer's chain-of-thought is never visible.
 */

import { generateText } from 'ai';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseValidatorOutput } from './pipeline-io.js';
import type { ValidationVerdict } from './schemas.js';
import type { SessionInfo } from './session.js';

// ---------------------------------------------------------------------------
// Validator prompt (adversarial, language agnostic)
// ---------------------------------------------------------------------------

/**
 * The static validator prompt template.
 * Language agnostic — no specific languages, frameworks, or stacks mentioned.
 * Adversarially framed: challenge findings, do not rubber-stamp them.
 * Exported so tests can inspect the base template.
 */
export const VALIDATOR_PROMPT = `You are an adversarial code review validator. Your job is to challenge findings, not rubber-stamp them.

A primary reviewer has analyzed a git diff and produced structured findings. You will receive:
1. The original diff and review context (INPUT.md)
2. The reviewer's structured findings (REVIEWER.md)

Your task: for each finding in REVIEWER.md, evaluate whether it is actually correct based on the diff evidence. Assume the reviewer may have made mistakes. Be skeptical.

VERDICT DEFINITIONS:
- confirmed: The finding is accurate. The code change does contain the issue described, at the stated severity.
- challenged: The finding is incorrect or overstated. The diff evidence does NOT support the claim. A false positive, wrong severity framing, or misread code.
- escalated: The finding is real but the severity is UNDERSTATED. The actual risk is higher than the reviewer claimed.

RULES:
- Do NOT reference the reviewer's reasoning process — evaluate only the structured finding claims against the actual diff
- Every finding MUST receive a verdict — if genuinely uncertain, default to confirmed with a note in rationale
- Do not rubber-stamp — a high confirm rate without scrutiny is a failure of your role
- Challenge aggressively: if the diff shows a harmless constant labeled "critical security vulnerability", say so
- rationale must be specific: cite the actual line of diff that supports or refutes the finding
- Counter-findings (optional, for challenged verdicts): if the reviewer's finding is wrong but a REAL underlying issue exists at the same location, include a <counter-finding> block inside the <verdict> block

OUTPUT FORMAT:
For each finding in REVIEWER.md, write one <verdict> block:

<verdict>
findingId: {the finding's id from REVIEWER.md}
verdict: {confirmed|challenged|escalated}
rationale: {your specific reasoning referencing the actual diff}
</verdict>

If challenging and a real underlying issue exists at the same location:

<verdict>
findingId: {id}
verdict: challenged
rationale: {why the reviewer's claim is wrong}
<counter-finding>
severity: {critical|high|medium|low|info}
file: {relative file path}
line: {line number or range}
dimension: {DIMENSION}
explanation: {the real issue}
suggestion: {concrete fix}
</counter-finding>
</verdict>

RULES FOR COUNTER-FINDINGS:
- Only include <counter-finding> when you are challenging a finding AND a distinct real issue exists
- Counter-finding must describe a genuinely different issue from the challenged finding
- Do NOT generate IDs for counter-findings — leave id absent

Be language agnostic — do not assume any specific stack, framework, or toolchain.`;

// ---------------------------------------------------------------------------
// buildValidatorPrompt — interpolates file contents into the static template
// ---------------------------------------------------------------------------

export interface BuildValidatorPromptOptions {
  reviewerMdContent: string;
  inputMdContent: string;
}

/**
 * Builds the full validator prompt by interpolating INPUT.md and REVIEWER.md
 * content into the static VALIDATOR_PROMPT template.
 */
export function buildValidatorPrompt(opts: BuildValidatorPromptOptions): string {
  const { reviewerMdContent, inputMdContent } = opts;

  return `${VALIDATOR_PROMPT}

---

INPUT.md (scope, focus, and diff evidence):
${inputMdContent}

---

REVIEWER.md (findings to evaluate):
${reviewerMdContent}`;
}

// ---------------------------------------------------------------------------
// ValidatorOptions / ValidatorResult types
// ---------------------------------------------------------------------------

export interface ValidatorOptions {
  session: SessionInfo;
  /** Absolute path to REVIEWER.md written by runReviewer */
  reviewerMdPath: string;
  /** Absolute path to INPUT.md written before runReviewer */
  inputMdPath: string;
  /** Vercel AI SDK model instance (provider-agnostic) */
  model: Parameters<typeof generateText>[0]['model'];
  /**
   * Optional override for generateText — used in tests to avoid real LLM calls.
   * When provided, this function is called instead of generateText.
   * @internal
   */
  _mockGenerateText?: (prompt: string) => Promise<string>;
}

export interface ValidatorResult {
  /** Absolute path to the written VALIDATOR.md file */
  validatorMdPath: string;
  /** Parsed verdicts from VALIDATOR.md */
  verdicts: ValidationVerdict[];
  /** Number of verdicts */
  verdictCount: number;
  /** Raw VALIDATOR.md content — preserved for Phase 4 counter-finding extraction */
  rawContent: string;
}

// ---------------------------------------------------------------------------
// runValidator — main entry point
// ---------------------------------------------------------------------------

/**
 * Runs the validator agent:
 * 1. Reads REVIEWER.md content
 * 2. Reads INPUT.md content
 * 3. Builds the validator prompt
 * 4. Calls generateText (single isolated call — no shared session history)
 * 5. Writes VALIDATOR.md with frontmatter + LLM output
 * 6. Parses verdicts from VALIDATOR.md
 * 7. Returns ValidatorResult
 */
export async function runValidator(opts: ValidatorOptions): Promise<ValidatorResult> {
  const { session, reviewerMdPath, inputMdPath, model, _mockGenerateText } = opts;

  // Step 1: Read REVIEWER.md content
  const reviewerMdContent = await readFile(reviewerMdPath, 'utf8');

  // Step 2: Read INPUT.md content
  const inputMdContent = await readFile(inputMdPath, 'utf8');

  // Step 3: Build prompt
  const prompt = buildValidatorPrompt({ reviewerMdContent, inputMdContent });

  // Step 4: Call generateText (or mock)
  let validatorText: string;
  if (_mockGenerateText) {
    validatorText = await _mockGenerateText(prompt);
  } else {
    const { text } = await generateText({
      model,
      prompt,
      maxOutputTokens: 8192,
    });
    validatorText = text;
  }

  // Step 5: Write VALIDATOR.md
  const validatorMdPath = join(session.sessionDir, 'VALIDATOR.md');
  const validatorMdContent = `---
reviewId: ${session.reviewId}
role: validator
---

${validatorText}`;
  await writeFile(validatorMdPath, validatorMdContent, 'utf8');

  // Step 6: Parse the written file
  const parsed = await parseValidatorOutput(validatorMdPath);

  return {
    validatorMdPath,
    verdicts: parsed.verdicts,
    verdictCount: parsed.verdictCount,
    rawContent: parsed.rawContent,
  };
}
