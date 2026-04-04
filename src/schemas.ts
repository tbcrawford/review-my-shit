import { z } from 'zod';

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

/**
 * All 11 review dimension abbreviations.
 * Used as the dimension prefix in Finding IDs (e.g. "SEC-00001").
 */
export const DIMENSIONS = [
  'BUG',
  'SEC',
  'PERF',
  'STYL',
  'TEST',
  'ARCH',
  'ERR',
  'DATA',
  'API',
  'DEP',
  'DOC',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const DimensionSchema = z.enum(DIMENSIONS);

export const SeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);
export type Severity = z.infer<typeof SeveritySchema>;

export const VerdictSchema = z.enum(['confirmed', 'challenged', 'escalated']);
export type Verdict = z.infer<typeof VerdictSchema>;

// ---------------------------------------------------------------------------
// Finding & ValidationVerdict
// ---------------------------------------------------------------------------

/**
 * A single finding produced by the reviewer agent.
 * IDs are assigned by the orchestrator (deterministic), not the LLM.
 */
export const FindingSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  file: z.string(),
  line: z.string(),
  dimension: DimensionSchema,
  explanation: z.string(),
  suggestion: z.string(),
});
export type Finding = z.infer<typeof FindingSchema>;

/**
 * A validator's verdict on a single reviewer finding.
 */
export const ValidationVerdictSchema = z.object({
  findingId: z.string(),
  verdict: VerdictSchema,
  rationale: z.string(),
});
export type ValidationVerdict = z.infer<typeof ValidationVerdictSchema>;

// ---------------------------------------------------------------------------
// Pipeline file frontmatter schemas
//
// These validate the **parsed frontmatter objects** extracted from pipeline
// markdown files — NOT the raw markdown or XML. The orchestrator reads and
// parses the files; these schemas validate the resulting in-memory objects.
// ---------------------------------------------------------------------------

/**
 * Frontmatter for INPUT.md — the initial review request file.
 */
export const InputFileSchema = z.object({
  reviewId: z.string(),
  timestamp: z.string(),
  scope: z.enum(['local-diff', 'pr-diff']),
  focus: z.string().optional(),
});
export type InputFile = z.infer<typeof InputFileSchema>;

/**
 * Frontmatter for REVIEWER.md — the primary reviewer's structured output.
 */
export const ReviewerFileSchema = z.object({
  reviewId: z.string(),
  role: z.literal('reviewer'),
});
export type ReviewerFile = z.infer<typeof ReviewerFileSchema>;

/**
 * Frontmatter for VALIDATOR.md — the validator's structured output.
 */
export const ValidatorFileSchema = z.object({
  reviewId: z.string(),
  role: z.literal('validator'),
});
export type ValidatorFile = z.infer<typeof ValidatorFileSchema>;

/**
 * Frontmatter for REPORT.md — the writer's synthesized final report.
 */
export const ReportFileSchema = z.object({
  reviewId: z.string(),
  generated: z.string(),
  findingCount: z.number(),
});
export type ReportFile = z.infer<typeof ReportFileSchema>;
