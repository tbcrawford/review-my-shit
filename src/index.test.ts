/**
 * Routing tests for `rms review` unified command.
 *
 * Tests only the routing/dispatch layer — full pipeline tests that call LLMs
 * are covered by existing test suites. These tests run the CLI as a child
 * process so that `process.exit()` calls inside Commander actions are
 * properly isolated.
 */

import { test, describe, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INDEX_TS = join(__dirname, 'index.ts');
const TSX = join(__dirname, '..', 'node_modules', '.bin', 'tsx');

/**
 * Runs `rms <args>` via tsx and returns stdout, stderr, and exit code.
 */
function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      ['--import', 'tsx/esm', INDEX_TS, ...args],
      {
        env: {
          ...process.env,
          // Unset any GITHUB_TOKEN so PR commands reliably fail at auth check
          GITHUB_TOKEN: undefined,
        },
        cwd: join(__dirname, '..'),
      },
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('error', reject);
    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

describe('rms review routing', () => {
  test('rms review (no args) exits 0 and prints scope prompt', async () => {
    const { stdout, exitCode } = await runCli(['review']);

    expect(exitCode).toBe(0);
    expect(
      stdout.includes('What would you like to review'),
    ).toBeTruthy();
    expect(
      stdout.includes('local'),
    ).toBeTruthy();
    expect(
      stdout.includes('pr'),
    ).toBeTruthy();
  });

  test('rms review unknown-scope exits non-zero and stderr contains "Unknown scope"', async () => {
    const { stderr, exitCode } = await runCli(['review', 'unknown-scope']);

    expect(exitCode !== 0).toBeTruthy();
    expect(
      stderr.includes('Unknown scope'),
    ).toBeTruthy();
  });

  test('rms review pr (missing PR number) exits non-zero', async () => {
    const { exitCode } = await runCli(['review', 'pr']);

    expect(exitCode !== 0).toBeTruthy();
  });
});
