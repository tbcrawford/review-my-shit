import { test, expect } from 'vitest';
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
    expect(stats.isDirectory()).toBeTruthy();
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
    expect(contents.includes('.reviews/')).toBeTruthy();
    expect(contents.includes('node_modules/')).toBeTruthy();
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('ensureReviewsDir creates .gitignore if it does not exist', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    await ensureReviewsDir(tmpDir);
    const contents = await readFile(join(tmpDir, '.gitignore'), 'utf8');
    expect(contents.includes('.reviews/')).toBeTruthy();
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
    expect(matches.length).toBe(1);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession returns correct SessionInfo shape', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'feat-auth');
    expect(info.sessionDir).toBeTruthy();
    expect(info.reviewId).toBeTruthy();
    expect(info.slug).toBe('feat-auth');
    expect(info.timestamp).toBeTruthy();
    // reviewId format: YYYY-MM-DD-slug
    expect(info.reviewId).toMatch(/^\d{4}-\d{2}-\d{2}-feat-auth$/);
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
    expect(stats.isDirectory()).toBeTruthy();
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession sanitizes slug correctly', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'Feature/Auth Refactor!!');
    // Expected sanitized slug: feature-auth-refactor
    expect(info.slug.match(/^[a-z0-9-]+$/)).toBeTruthy();
    expect(!info.slug.startsWith('-')).toBeTruthy();
    expect(!info.slug.endsWith('-')).toBeTruthy();
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test('createSession sessionDir is inside .reviews/', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'rms-test-'));
  try {
    const info = await createSession(tmpDir, 'test-scope');
    const reviewsDir = join(tmpDir, '.reviews');
    expect(info.sessionDir.startsWith(reviewsDir)).toBeTruthy();
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});
