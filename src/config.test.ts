import { test, describe, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import {
  getConfigPath,
  loadRmsConfig,
  saveRmsConfig,
  resolveAgentModel,
} from './config.js';
import type { RmsConfig } from './schemas.js';

// ---------------------------------------------------------------------------
// Helper: create a temp dir for test file isolation
// ---------------------------------------------------------------------------
async function makeTmpDir(): Promise<string> {
  const dir = join(tmpdir(), `rms-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

const VALID_CONFIG: RmsConfig = {
  reviewer: { provider: 'openai', model: 'gpt-4o' },
  validator: { provider: 'anthropic', model: 'claude-opus-4-5' },
  writer: { provider: 'google', model: 'gemini-pro' },
};

// ---------------------------------------------------------------------------
// Test 1: getConfigPath() returns correct path
// ---------------------------------------------------------------------------
describe('getConfigPath', () => {
  test('returns path ending in .config/rms/config.json', () => {
    const p = getConfigPath();
    // Cross-platform: Unix uses /, Windows uses \
    expect(
      p.endsWith('.config/rms/config.json') || p.endsWith('.config\\rms\\config.json'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Test 2: loadRmsConfig returns null when file does not exist
// ---------------------------------------------------------------------------
describe('loadRmsConfig', () => {
  test('returns null when config file does not exist', async () => {
    const tmpDir = await makeTmpDir();
    const fakePath = join(tmpDir, 'nonexistent', 'config.json');
    const result = await loadRmsConfig(fakePath);
    expect(result).toBe(null);
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Test 3: loadRmsConfig returns RmsConfig when valid config.json exists
  // ---------------------------------------------------------------------------
  test('returns typed RmsConfig when valid config.json exists', async () => {
    const tmpDir = await makeTmpDir();
    const configPath = join(tmpDir, 'config.json');
    await writeFile(configPath, JSON.stringify(VALID_CONFIG), 'utf8');

    const result = await loadRmsConfig(configPath);
    expect(result !== null).toBeTruthy();
    expect(result!.reviewer.provider).toBe('openai');
    expect(result!.reviewer.model).toBe('gpt-4o');
    expect(result!.validator.provider).toBe('anthropic');
    expect(result!.writer.provider).toBe('google');
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Test 4: loadRmsConfig throws on malformed JSON
  // ---------------------------------------------------------------------------
  test('throws Error containing "Invalid rms config" on malformed JSON', async () => {
    const tmpDir = await makeTmpDir();
    const configPath = join(tmpDir, 'config.json');
    await writeFile(configPath, '{this is not valid JSON', 'utf8');

    await expect(
      async () => {
        const err = await loadRmsConfig(configPath).catch((e: unknown) => { throw e; });
        return err;
      },
    ).rejects.toThrow('Invalid rms config');
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Test 5: loadRmsConfig throws on schema violation (invalid provider)
  // ---------------------------------------------------------------------------
  test('throws Error containing "Invalid rms config" when provider is not in enum', async () => {
    const tmpDir = await makeTmpDir();
    const configPath = join(tmpDir, 'config.json');
    const badConfig = {
      reviewer: { provider: 'bedrock', model: 'claude' }, // invalid provider
      validator: { provider: 'anthropic', model: 'claude-opus-4-5' },
      writer: { provider: 'google', model: 'gemini-pro' },
    };
    await writeFile(configPath, JSON.stringify(badConfig), 'utf8');

    await expect(
      async () => {
        const err = await loadRmsConfig(configPath).catch((e: unknown) => { throw e; });
        return err;
      },
    ).rejects.toThrow('Invalid rms config');
    await rm(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Test 6: saveRmsConfig writes valid JSON (round-trip)
// Test 7: saveRmsConfig creates parent directories
// ---------------------------------------------------------------------------
describe('saveRmsConfig', () => {
  test('writes valid JSON round-trippable through loadRmsConfig', async () => {
    const tmpDir = await makeTmpDir();
    const configPath = join(tmpDir, 'config.json');

    await saveRmsConfig(VALID_CONFIG, configPath);

    // File should exist
    expect(existsSync(configPath)).toBeTruthy();

    // Round-trip via loadRmsConfig
    const loaded = await loadRmsConfig(configPath);
    expect(loaded !== null).toBeTruthy();
    expect(loaded).toEqual(VALID_CONFIG);
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('creates parent directories if they do not exist', async () => {
    const tmpDir = await makeTmpDir();
    // Path with nested dirs that don't exist yet
    const configPath = join(tmpDir, 'nested', 'deep', 'config.json');

    await saveRmsConfig(VALID_CONFIG, configPath);

    expect(existsSync(configPath)).toBeTruthy();
    await rm(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Tests 8-10: resolveAgentModel returns a truthy model instance
// ---------------------------------------------------------------------------
describe('resolveAgentModel', () => {
  test('resolves openai provider to a truthy model object', async () => {
    const model = await resolveAgentModel({ provider: 'openai', model: 'gpt-4o' });
    expect(model).toBeTruthy();
  });

  test('resolves anthropic provider to a truthy model object', async () => {
    const model = await resolveAgentModel({ provider: 'anthropic', model: 'claude-opus-4-5' });
    expect(model).toBeTruthy();
  });

  test('resolves google provider to a truthy model object', async () => {
    const model = await resolveAgentModel({ provider: 'google', model: 'gemini-pro' });
    expect(model).toBeTruthy();
  });
});
