import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import {
  FindingSchema,
  ValidationVerdictSchema,
  InputFileSchema,
  ReviewerFileSchema,
  ValidatorFileSchema,
  ReportFileSchema,
  DIMENSIONS,
} from './schemas.js';

describe('DIMENSIONS constant', () => {
  test('has all 11 abbreviations', () => {
    assert.deepStrictEqual(DIMENSIONS, [
      'BUG', 'SEC', 'PERF', 'STYL', 'TEST',
      'ARCH', 'ERR', 'DATA', 'API', 'DEP', 'DOC',
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
    assert.strictEqual(result.id, 'SEC-00001');
    assert.strictEqual(result.severity, 'high');
    assert.strictEqual(result.dimension, 'SEC');
  });

  test('throws ZodError for invalid severity', () => {
    assert.throws(
      () => FindingSchema.parse({ ...validFinding, severity: 'urgent' }),
      ZodError,
    );
  });

  test('throws ZodError for unknown dimension', () => {
    assert.throws(
      () => FindingSchema.parse({ ...validFinding, dimension: 'UNKNOWN' }),
      ZodError,
    );
  });

  test('throws ZodError for missing required field', () => {
    const { explanation: _omit, ...withoutExplanation } = validFinding;
    assert.throws(() => FindingSchema.parse(withoutExplanation), ZodError);
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
    assert.strictEqual(result.findingId, 'SEC-00001');
    assert.strictEqual(result.verdict, 'confirmed');
  });

  test('throws ZodError for unknown verdict value', () => {
    assert.throws(
      () => ValidationVerdictSchema.parse({ ...validVerdict, verdict: 'approved' }),
      ZodError,
    );
  });

  test('accepts all three verdict values', () => {
    for (const verdict of ['confirmed', 'challenged', 'escalated'] as const) {
      const result = ValidationVerdictSchema.parse({ ...validVerdict, verdict });
      assert.strictEqual(result.verdict, verdict);
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
    assert.strictEqual(result.scope, 'local-diff');
    assert.strictEqual(result.focus, undefined);
  });

  test('parses a valid InputFile with optional focus', () => {
    const result = InputFileSchema.parse({
      reviewId: '2026-04-04-my-review',
      timestamp: '2026-04-04T13:00:00.000Z',
      scope: 'pr-diff',
      focus: 'security',
    });
    assert.strictEqual(result.focus, 'security');
  });

  test('throws ZodError for invalid scope', () => {
    assert.throws(
      () => InputFileSchema.parse({
        reviewId: '2026-04-04-r',
        timestamp: '2026-04-04T00:00:00.000Z',
        scope: 'remote-diff',
      }),
      ZodError,
    );
  });
});

describe('ReviewerFileSchema', () => {
  test('parses valid ReviewerFile frontmatter', () => {
    const result = ReviewerFileSchema.parse({
      reviewId: '2026-04-04-r',
      role: 'reviewer',
    });
    assert.strictEqual(result.role, 'reviewer');
  });

  test('throws ZodError if role is not "reviewer"', () => {
    assert.throws(
      () => ReviewerFileSchema.parse({ reviewId: '2026-04-04-r', role: 'validator' }),
      ZodError,
    );
  });
});

describe('ValidatorFileSchema', () => {
  test('parses valid ValidatorFile frontmatter', () => {
    const result = ValidatorFileSchema.parse({
      reviewId: '2026-04-04-r',
      role: 'validator',
    });
    assert.strictEqual(result.role, 'validator');
  });

  test('throws ZodError if role is not "validator"', () => {
    assert.throws(
      () => ValidatorFileSchema.parse({ reviewId: '2026-04-04-r', role: 'reviewer' }),
      ZodError,
    );
  });
});

describe('ReportFileSchema', () => {
  test('parses valid ReportFile frontmatter', () => {
    const result = ReportFileSchema.parse({
      reviewId: '2026-04-04-r',
      generated: '2026-04-04T13:05:00.000Z',
      findingCount: 7,
    });
    assert.strictEqual(result.findingCount, 7);
  });

  test('throws ZodError if findingCount is not a number', () => {
    assert.throws(
      () => ReportFileSchema.parse({
        reviewId: '2026-04-04-r',
        generated: '2026-04-04T13:05:00.000Z',
        findingCount: 'seven',
      }),
      ZodError,
    );
  });
});
