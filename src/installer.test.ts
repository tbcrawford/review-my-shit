import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from './installer.js';

describe('install', () => {
  test('writes OpenCode commands to globalDir (not projectRoot)', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, globalDir);
      // rms-review.md should be in globalDir
      const s = await stat(join(globalDir, 'rms-review.md'));
      assert.ok(s.isFile(), 'rms-review.md should be in globalDir');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes Cursor commands to projectRoot/.cursor/commands/', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, globalDir);
      const s = await stat(join(projectRoot, '.cursor', 'commands', 'rms-review.md'));
      assert.ok(s.isFile(), '.cursor/commands/rms-review.md should be in projectRoot');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 3 OpenCode templates to globalDir', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, globalDir);
      for (const name of ['rms-review.md', 'rms-fix.md', 'rms-settings.md']) {
        const s = await stat(join(globalDir, name));
        assert.ok(s.isFile(), `${name} should exist in globalDir`);
      }
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 3 Cursor templates to projectRoot/.cursor/commands/', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, globalDir);
      for (const name of ['rms-review.md', 'rms-fix.md', 'rms-settings.md']) {
        const s = await stat(join(projectRoot, '.cursor', 'commands', name));
        assert.ok(s.isFile(), `${name} should exist in .cursor/commands/`);
      }
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('OpenCode files do NOT land in projectRoot', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, globalDir);
      // Should not exist under projectRoot/.opencode/
      let found = false;
      try {
        await stat(join(projectRoot, '.opencode', 'commands', 'rms-review.md'));
        found = true;
      } catch {
        // expected — file should not exist
      }
      assert.ok(!found, 'OpenCode files should NOT be in projectRoot/.opencode/commands/');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });
});
