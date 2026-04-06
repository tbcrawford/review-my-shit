/**
 * Routing tests for `rms review` unified command.
 *
 * Tests only the routing/dispatch layer — full pipeline tests that call LLMs
 * are covered by existing test suites. These tests run the CLI as a child
 * process so that `process.exit()` calls inside Commander actions are
 * properly isolated.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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

    assert.strictEqual(exitCode, 0, 'should exit with code 0');
    assert.ok(
      stdout.includes('What would you like to review'),
      `stdout should contain "What would you like to review", got: ${stdout}`,
    );
    assert.ok(
      stdout.includes('local'),
      `stdout should contain "local", got: ${stdout}`,
    );
    assert.ok(
      stdout.includes('pr'),
      `stdout should contain "pr", got: ${stdout}`,
    );
  });

  test('rms review unknown-scope exits non-zero and stderr contains "Unknown scope"', async () => {
    const { stderr, exitCode } = await runCli(['review', 'unknown-scope']);

    assert.ok(exitCode !== 0, `should exit with non-zero code, got: ${exitCode}`);
    assert.ok(
      stderr.includes('Unknown scope'),
      `stderr should contain "Unknown scope", got: ${stderr}`,
    );
  });

  test('rms review pr (missing PR number) exits non-zero', async () => {
    const { exitCode } = await runCli(['review', 'pr']);

    assert.ok(exitCode !== 0, `should exit with non-zero code when PR number is missing, got: ${exitCode}`);
  });
});
