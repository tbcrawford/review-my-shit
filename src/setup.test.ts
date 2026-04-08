/**
 * setup.test.ts — unit tests for resolveEditorsFromArgs and printBanner
 *
 * Tests are isolated: we import the exported pure function directly.
 * No subprocess spawning, no stdin simulation.
 */
import { describe, it, expect } from 'vitest';
import { resolveEditorsFromArgs, BANNER_STRING } from './setup.js';

describe('resolveEditorsFromArgs', () => {
  it('Test 1: --opencode returns ["opencode"]', () => {
    const result = resolveEditorsFromArgs(['--opencode']);
    expect(result).toEqual(['opencode']);
  });

  it('Test 2: --cursor returns ["cursor"]', () => {
    const result = resolveEditorsFromArgs(['--cursor']);
    expect(result).toEqual(['cursor']);
  });

  it('Test 3: --yes returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['--yes']);
    expect(result).toEqual(['opencode', 'cursor']);
  });

  it('Test 4: -y returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['-y']);
    expect(result).toEqual(['opencode', 'cursor']);
  });

  it('Test 5: --opencode --cursor returns ["opencode", "cursor"]', () => {
    const result = resolveEditorsFromArgs(['--opencode', '--cursor']);
    expect(result).toEqual(['opencode', 'cursor']);
  });

  it('Test 6: no flags returns null (interactive prompt needed)', () => {
    const result = resolveEditorsFromArgs([]);
    expect(result).toBe(null);
  });
});

describe('BANNER_STRING', () => {
  it('Test 7: banner contains "rms" and "v0.3.0"', () => {
    expect(BANNER_STRING.includes('rms')).toBeTruthy();
    expect(BANNER_STRING.includes('v0.3.0')).toBeTruthy();
  });
});
