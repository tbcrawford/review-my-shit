import { test, describe, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nextFindingId, DIMENSION_ABBREV } from './finding-id.js';

/**
 * Creates a fresh temp directory for each test, isolated from others.
 */
async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'rms-finding-id-'));
}

describe('DIMENSION_ABBREV', () => {
  test('exports the full list of dimension abbreviations', () => {
    expect(Array.isArray(DIMENSION_ABBREV)).toBeTruthy();
    expect(DIMENSION_ABBREV.includes('SEC')).toBeTruthy();
    expect(DIMENSION_ABBREV.includes('BUG')).toBeTruthy();
    expect(DIMENSION_ABBREV.includes('DOC')).toBeTruthy();
    expect(DIMENSION_ABBREV.length).toBe(12);
  });
});

describe('nextFindingId', () => {
  test('first call returns counter 1 with padded 5-digit format', async () => {
    const dir = await makeTmpDir();
    const id = await nextFindingId('SEC', dir);
    expect(id).toBe('SEC-00001');
  });

  test('second call returns counter 2 regardless of dimension', async () => {
    const dir = await makeTmpDir();
    await nextFindingId('SEC', dir); // counter → 1
    const id = await nextFindingId('BUG', dir); // counter → 2
    expect(id).toBe('BUG-00002');
  });

  test('counter persists — counter file contains the last counter value', async () => {
    const dir = await makeTmpDir();
    await nextFindingId('SEC', dir);
    await nextFindingId('BUG', dir);
    const raw = await readFile(join(dir, '.counter'), 'utf-8');
    expect(raw.trim()).toBe('2');
  });

  test('padStart produces 5-digit zero-padded output', async () => {
    const dir = await makeTmpDir();
    const id = await nextFindingId('PERF', dir);
    // Format must be DIM-NNNNN where NNNNN is 5 digits
    const match = id.match(/^PERF-(\d{5})$/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('00001');
  });

  test('handles missing .counter file gracefully (starts at 0)', async () => {
    const dir = await makeTmpDir();
    // No .counter file in dir — should start from 0 and return 1
    const id = await nextFindingId('ARCH', dir);
    expect(id).toBe('ARCH-00001');
  });

  test('sequential calls increment monotonically', async () => {
    const dir = await makeTmpDir();
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await nextFindingId('BUG', dir));
    }
    expect(results).toEqual([
      'BUG-00001',
      'BUG-00002',
      'BUG-00003',
      'BUG-00004',
      'BUG-00005',
    ]);
  });

  test('different dimensions use the same global counter', async () => {
    const dir = await makeTmpDir();
    const id1 = await nextFindingId('SEC', dir);
    const id2 = await nextFindingId('BUG', dir);
    const id3 = await nextFindingId('PERF', dir);
    expect(id1).toBe('SEC-00001');
    expect(id2).toBe('BUG-00002');
    expect(id3).toBe('PERF-00003');
  });
});
