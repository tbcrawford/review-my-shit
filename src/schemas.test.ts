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
  RmsConfigSchema,
  FlatRmsConfigSchema,
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
  test('accepts model only (no variant)', () => {
    const result = AgentModelSpecSchema.parse({ model: 'github-copilot/claude-opus-4.6' });
    expect(result.model).toBe('github-copilot/claude-opus-4.6');
    expect(result.variant).toBeUndefined();
  });

  test('accepts model with high_thinking variant', () => {
    const result = AgentModelSpecSchema.parse({ model: 'github-copilot/claude-opus-4.6', variant: 'high_thinking' });
    expect(result.model).toBe('github-copilot/claude-opus-4.6');
    expect(result.variant).toBe('high_thinking');
  });

  test('accepts model with no_thinking variant', () => {
    const result = AgentModelSpecSchema.parse({ model: 'github-copilot/claude-haiku-4.5', variant: 'no_thinking' });
    expect(result.variant).toBe('no_thinking');
  });

  test('rejects empty model string', () => {
    expect(() => AgentModelSpecSchema.parse({ model: '' })).toThrow(ZodError);
  });

  test('rejects invalid variant value', () => {
    expect(() => AgentModelSpecSchema.parse({ model: 'x', variant: 'thinking' })).toThrow(ZodError);
  });

  test('old {provider, model} shape does not satisfy new AgentModelSpecSchema (no provider field)', () => {
    // The new schema has no provider field — old shapes still parse (provider is stripped as unknown key)
    // but the schema does NOT require provider, so the old shape is accepted with provider ignored.
    // What matters: AgentModelSpecSchema does NOT include provider in output.
    const result = AgentModelSpecSchema.parse({ provider: 'copilot', model: 'x' });
    expect((result as unknown as Record<string, unknown>)['provider']).toBeUndefined();
    expect(result.model).toBe('x');
  });
});

describe('RmsConfigSchema', () => {
  const validNestedConfig = {
    opencode: {
      reviewer:  { model: 'github-copilot/claude-opus-4.6',  variant: 'high_thinking' },
      validator: { model: 'github-copilot/gpt-5.4',          variant: 'high_thinking' },
      writer:    { model: 'github-copilot/claude-haiku-4.5', variant: 'no_thinking'   },
    },
    cursor: {
      reviewer:  { model: 'claude-4.6-opus-high-thinking' },
      validator: { model: 'gpt-5.4-high' },
      writer:    { model: 'gpt-5.4-mini-none' },
    },
  };

  test('accepts full nested config with opencode + cursor sections', () => {
    const result = RmsConfigSchema.parse(validNestedConfig);
    expect(result.opencode.reviewer.model).toBe('github-copilot/claude-opus-4.6');
    expect(result.opencode.reviewer.variant).toBe('high_thinking');
    expect(result.cursor.writer.model).toBe('gpt-5.4-mini-none');
  });

  test('rejects config missing opencode key', () => {
    const { opencode: _omit, ...withoutOpencode } = validNestedConfig;
    expect(() => RmsConfigSchema.parse(withoutOpencode)).toThrow(ZodError);
  });

  test('rejects config where cursor.reviewer is missing model', () => {
    const bad = {
      opencode: validNestedConfig.opencode,
      cursor: {
        reviewer:  { variant: 'high_thinking' },  // missing model
        validator: { model: 'gpt-5.4-high' },
        writer:    { model: 'gpt-5.4-mini-none' },
      },
    };
    expect(() => RmsConfigSchema.parse(bad)).toThrow(ZodError);
  });

  test('rejects old flat shape (reviewer/validator/writer at root)', () => {
    const flatShape = {
      reviewer:  { provider: 'copilot', model: 'claude-opus-4-5' },
      validator: { provider: 'copilot', model: 'gpt-5.4' },
      writer:    { provider: 'copilot', model: 'claude-haiku-4.5' },
    };
    expect(() => RmsConfigSchema.parse(flatShape)).toThrow(ZodError);
  });
});

describe('FlatRmsConfigSchema', () => {
  const oldFlatConfig = {
    reviewer:  { provider: 'copilot', model: 'claude-opus-4-5' },
    validator: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
    writer:    { provider: 'openai', model: 'gpt-4o' },
  };

  test('accepts the old flat {provider, model} shape', () => {
    const result = FlatRmsConfigSchema.parse(oldFlatConfig);
    expect(result.reviewer.provider).toBe('copilot');
    expect(result.reviewer.model).toBe('claude-opus-4-5');
  });

  test('rejects the new nested shape (opencode/cursor keys fail)', () => {
    const newShape = {
      opencode: { reviewer: { model: 'x' }, validator: { model: 'x' }, writer: { model: 'x' } },
      cursor:   { reviewer: { model: 'x' }, validator: { model: 'x' }, writer: { model: 'x' } },
    };
    expect(() => FlatRmsConfigSchema.parse(newShape)).toThrow(ZodError);
  });

  test('rejects invalid provider in flat shape', () => {
    const bad = { ...oldFlatConfig, reviewer: { provider: 'bedrock', model: 'x' } };
    expect(() => FlatRmsConfigSchema.parse(bad)).toThrow(ZodError);
  });
});
