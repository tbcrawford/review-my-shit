import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.ok(Array.isArray(DIMENSION_ABBREV), 'DIMENSION_ABBREV should be an array');
    assert.ok(DIMENSION_ABBREV.includes('SEC'), 'should include SEC');
    assert.ok(DIMENSION_ABBREV.includes('BUG'), 'should include BUG');
    assert.ok(DIMENSION_ABBREV.includes('DOC'), 'should include DOC');
    assert.strictEqual(DIMENSION_ABBREV.length, 11, 'should have 11 dimensions');
  });
});

describe('nextFindingId', () => {
  test('first call returns counter 1 with padded 5-digit format', async () => {
    const dir = await makeTmpDir();
    const id = await nextFindingId('SEC', dir);
    assert.strictEqual(id, 'SEC-00001');
  });

  test('second call returns counter 2 regardless of dimension', async () => {
    const dir = await makeTmpDir();
    await nextFindingId('SEC', dir); // counter → 1
    const id = await nextFindingId('BUG', dir); // counter → 2
    assert.strictEqual(id, 'BUG-00002');
  });

  test('counter persists — counter file contains the last counter value', async () => {
    const dir = await makeTmpDir();
    await nextFindingId('SEC', dir);
    await nextFindingId('BUG', dir);
    const raw = await readFile(join(dir, '.counter'), 'utf-8');
    assert.strictEqual(raw.trim(), '2');
  });

  test('padStart produces 5-digit zero-padded output', async () => {
    const dir = await makeTmpDir();
    const id = await nextFindingId('PERF', dir);
    // Format must be DIM-NNNNN where NNNNN is 5 digits
    const match = id.match(/^PERF-(\d{5})$/);
    assert.ok(match, `ID "${id}" should match PERF-NNNNN`);
    assert.strictEqual(match![1], '00001');
  });

  test('handles missing .counter file gracefully (starts at 0)', async () => {
    const dir = await makeTmpDir();
    // No .counter file in dir — should start from 0 and return 1
    const id = await nextFindingId('ARCH', dir);
    assert.strictEqual(id, 'ARCH-00001');
  });

  test('sequential calls increment monotonically', async () => {
    const dir = await makeTmpDir();
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await nextFindingId('BUG', dir));
    }
    assert.deepStrictEqual(results, [
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
    assert.strictEqual(id1, 'SEC-00001');
    assert.strictEqual(id2, 'BUG-00002');
    assert.strictEqual(id3, 'PERF-00003');
  });
});
