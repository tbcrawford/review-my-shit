import { test, describe, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  FindingSchema,
  ValidationVerdictSchema,
  InputFileSchema,
  ReviewerFileSchema,
  ValidatorFileSchema,
  ReportFileSchema,
  DIMENSIONS,
  AgentModelSpecSchema,
} from './schemas.js';

describe('DIMENSIONS constant', () => {
  test('has all 12 abbreviations', () => {
    expect(DIMENSIONS).toEqual([
      'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
      'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
      'DSGN',
    ]);
  });
});

describe('FindingSchema', () => {
  const validFinding = {
    id: 'SEC-00001',
    severity: 'high',
    file: 'src/auth.ts',
    line: '42',
    dimension: 'SEC',
    explanation: 'SQL injection risk via unsanitized input.',
    suggestion: 'Use parameterized queries.',
  };

  test('parses a valid Finding object', () => {
    const result = FindingSchema.parse(validFinding);
    expect(result.id).toBe('SEC-00001');
    expect(result.severity).toBe('high');
    expect(result.dimension).toBe('SEC');
  });

  test('throws ZodError for invalid severity', () => {
    expect(() => FindingSchema.parse({ ...validFinding, severity: 'urgent' })).toThrow(ZodError);
  });

  test('throws ZodError for unknown dimension', () => {
    expect(() => FindingSchema.parse({ ...validFinding, dimension: 'UNKNOWN' })).toThrow(ZodError);
  });

  test('throws ZodError for missing required field', () => {
    const { explanation: _omit, ...withoutExplanation } = validFinding;
    expect(() => FindingSchema.parse(withoutExplanation)).toThrow(ZodError);
  });
});

describe('ValidationVerdictSchema', () => {
  const validVerdict = {
    findingId: 'SEC-00001',
    verdict: 'confirmed',
    rationale: 'Confirmed — unsanitized input reaches the query directly.',
  };

  test('parses a valid ValidationVerdict', () => {
    const result = ValidationVerdictSchema.parse(validVerdict);
    expect(result.findingId).toBe('SEC-00001');
    expect(result.verdict).toBe('confirmed');
  });

  test('throws ZodError for unknown verdict value', () => {
    expect(
      () => ValidationVerdictSchema.parse({ ...validVerdict, verdict: 'approved' }),
    ).toThrow(ZodError);
  });

  test('accepts all three verdict values', () => {
    for (const verdict of ['confirmed', 'challenged', 'escalated'] as const) {
      const result = ValidationVerdictSchema.parse({ ...validVerdict, verdict });
      expect(result.verdict).toBe(verdict);
    }
  });
});

describe('InputFileSchema', () => {
  test('parses a valid InputFile frontmatter (no focus)', () => {
    const result = InputFileSchema.parse({
      reviewId: '2026-04-04-my-review',
      timestamp: '2026-04-04T13:00:00.000Z',
      scope: 'local-diff',
    });
    expect(result.scope).toBe('local-diff');
    expect(result.focus).toBe(undefined);
  });

  test('parses a valid InputFile with optional focus', () => {
    const result = InputFileSchema.parse({
      reviewId: '2026-04-04-my-review',
      timestamp: '2026-04-04T13:00:00.000Z',
      scope: 'pr-diff',
      focus: 'security',
    });
    expect(result.focus).toBe('security');
  });

  test('throws ZodError for invalid scope', () => {
    expect(
      () => InputFileSchema.parse({
        reviewId: '2026-04-04-r',
        timestamp: '2026-04-04T00:00:00.000Z',
        scope: 'remote-diff',
      }),
    ).toThrow(ZodError);
  });
});

describe('ReviewerFileSchema', () => {
  test('parses valid ReviewerFile frontmatter', () => {
    const result = ReviewerFileSchema.parse({
      reviewId: '2026-04-04-r',
      role: 'reviewer',
    });
    expect(result.role).toBe('reviewer');
  });

  test('throws ZodError if role is not "reviewer"', () => {
    expect(
      () => ReviewerFileSchema.parse({ reviewId: '2026-04-04-r', role: 'validator' }),
    ).toThrow(ZodError);
  });
});

describe('ValidatorFileSchema', () => {
  test('parses valid ValidatorFile frontmatter', () => {
    const result = ValidatorFileSchema.parse({
      reviewId: '2026-04-04-r',
      role: 'validator',
    });
    expect(result.role).toBe('validator');
  });

  test('throws ZodError if role is not "validator"', () => {
    expect(
      () => ValidatorFileSchema.parse({ reviewId: '2026-04-04-r', role: 'reviewer' }),
    ).toThrow(ZodError);
  });
});

describe('ReportFileSchema', () => {
  test('parses valid ReportFile frontmatter', () => {
    const result = ReportFileSchema.parse({
      reviewId: '2026-04-04-r',
      generated: '2026-04-04T13:05:00.000Z',
      findingCount: 7,
    });
    expect(result.findingCount).toBe(7);
  });

  test('throws ZodError if findingCount is not a number', () => {
    expect(
      () => ReportFileSchema.parse({
        reviewId: '2026-04-04-r',
        generated: '2026-04-04T13:05:00.000Z',
        findingCount: 'seven',
      }),
    ).toThrow(ZodError);
  });
});

describe('AgentModelSpecSchema', () => {
  test('accepts copilot as a valid provider', () => {
    const result = AgentModelSpecSchema.parse({ provider: 'copilot', model: 'claude-opus-4.6' });
    expect(result.provider).toBe('copilot');
    expect(result.model).toBe('claude-opus-4.6');
  });

  test('accepts existing openai provider (no regression)', () => {
    const result = AgentModelSpecSchema.parse({ provider: 'openai', model: 'gpt-4o' });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
  });

  test('throws ZodError for unknown provider "bedrock"', () => {
    expect(() => AgentModelSpecSchema.parse({ provider: 'bedrock', model: 'x' })).toThrow(ZodError);
  });

  test('throws ZodError for "github-copilot" (raw prefix is not a valid provider value)', () => {
    expect(() => AgentModelSpecSchema.parse({ provider: 'github-copilot', model: 'x' })).toThrow(ZodError);
  });
});
