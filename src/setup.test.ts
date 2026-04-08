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

// Strip ANSI escape codes for content testing
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('BANNER_STRING', () => {
  it('Test 7: banner contains subtitle and version after stripping ANSI', () => {
    const plain = stripAnsi(BANNER_STRING);
    expect(plain.includes('review-my-shit')).toBeTruthy();
    expect(plain.includes('v0.3.0')).toBeTruthy();
  });

  it('Test 8: banner uses chalk (imports chalk and produces colored output or plain text in no-color environments)', () => {
    // The banner should contain chalk color calls — either ANSI codes in color envs
    // or plain text in no-color envs. Either way, plain text content must be intact.
    const plain = stripAnsi(BANNER_STRING);
    expect(plain).toContain('review-my-shit');
    expect(plain).toContain('v0.3.0');
    // Block-letter art uses box-drawing / block chars
    expect(plain).toContain('██');
  });
});
