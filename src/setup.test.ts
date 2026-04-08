/**
 * setup.test.ts — unit tests for resolveEditorsFromArgs and printBanner
 *
 * Tests are isolated: we import the exported pure function directly.
 * No subprocess spawning, no stdin simulation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEditorsFromArgs, BANNER_STRING } from './setup.js';

describe('resolveEditorsFromArgs', () => {
  it('Test 1: --opencode returns ["opencode"]', () => {
    const result = resolveEditorsFromArgs(['--opencode']);
    assert.deepStrictEqual(result, ['opencode']);
  });

  it('Test 2: --cursor returns ["cursor"]', () => {
    const result = resolveEditorsFromArgs(['--cursor']);
    assert.deepStrictEqual(result, ['cursor']);
  });

  it('Test 3: --yes returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['--yes']);
    assert.deepStrictEqual(result, ['opencode', 'cursor']);
  });

  it('Test 4: -y returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['-y']);
    assert.deepStrictEqual(result, ['opencode', 'cursor']);
  });

  it('Test 5: --opencode --cursor returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['--opencode', '--cursor']);
    assert.deepStrictEqual(result, ['opencode', 'cursor']);
  });

  it('Test 6: no flags returns null (interactive prompt needed)', () => {
    const result = resolveEditorsFromArgs([]);
    assert.strictEqual(result, null);
  });
});

describe('BANNER_STRING', () => {
  it('Test 7: banner contains "rms" and "v0.3.0"', () => {
    assert.ok(BANNER_STRING.includes('rms'), 'Banner should contain "rms"');
    assert.ok(BANNER_STRING.includes('v0.3.0'), 'Banner should contain "v0.3.0"');
  });
});
