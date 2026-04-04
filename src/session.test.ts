import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureReviewsDir, createSession } from './session.js';

test('ensureReviewsDir creates .reviews/ directory', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    await ensureReviewsDir(tmpDir);
    const { stat } = await import('node:fs/promises');
    const stats = await stat(join(tmpDir, '.reviews'));
    assert.ok(stats.isDirectory(), '.reviews should be a directory');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('ensureReviewsDir appends .reviews/ to .gitignore when absent', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    // Create a .gitignore without .reviews/
    await writeFile(join(tmpDir, '.gitignore'), 'node_modules/\ndist/\n');
    await ensureReviewsDir(tmpDir);
    const contents = await readFile(join(tmpDir, '.gitignore'), 'utf8');
    assert.ok(contents.includes('.reviews/'), '.gitignore should contain .reviews/');
    assert.ok(contents.includes('node_modules/'), '.gitignore should retain original entries');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('ensureReviewsDir creates .gitignore if it does not exist', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    await ensureReviewsDir(tmpDir);
    const contents = await readFile(join(tmpDir, '.gitignore'), 'utf8');
    assert.ok(contents.includes('.reviews/'), 'created .gitignore should contain .reviews/');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('ensureReviewsDir is idempotent (does not duplicate .reviews/ in .gitignore)', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    await ensureReviewsDir(tmpDir);
    await ensureReviewsDir(tmpDir); // call twice
    const contents = await readFile(join(tmpDir, '.gitignore'), 'utf8');
    // Count occurrences of .reviews/
    const matches = contents.match(/\.reviews\//g) ?? [];
    assert.equal(matches.length, 1, '.reviews/ should appear exactly once in .gitignore');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession returns correct SessionInfo shape', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'feat-auth');
    assert.ok(info.sessionDir, 'sessionDir should be set');
    assert.ok(info.reviewId, 'reviewId should be set');
    assert.equal(info.slug, 'feat-auth', 'slug should match input');
    assert.ok(info.timestamp, 'timestamp should be set');
    // reviewId format: YYYY-MM-DD-slug
    assert.match(info.reviewId, /^\d{4}-\d{2}-\d{2}-feat-auth$/, 'reviewId should match YYYY-MM-DD-slug format');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession creates the session folder on disk', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'my review');
    const { stat } = await import('node:fs/promises');
    const stats = await stat(info.sessionDir);
    assert.ok(stats.isDirectory(), 'session directory should exist on disk');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession sanitizes slug correctly', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'Feature/Auth Refactor!!');
    // Expected sanitized slug: feature-auth-refactor
    assert.ok(info.slug.match(/^[a-z0-9-]+$/), 'slug should only contain lowercase alphanumerics and hyphens');
    assert.ok(!info.slug.startsWith('-'), 'slug should not start with hyphen');
    assert.ok(!info.slug.endsWith('-'), 'slug should not end with hyphen');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession sessionDir is inside .reviews/', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'test-scope');
    const reviewsDir = join(tmpDir, '.reviews');
    assert.ok(info.sessionDir.startsWith(reviewsDir), 'sessionDir should be inside .reviews/');
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});
