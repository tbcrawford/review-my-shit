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
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      // rms-review.md should be in globalDir
      const s = await stat(join(globalDir, 'rms-review.md'));
      assert.ok(s.isFile(), 'rms-review.md should be in globalDir');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes Cursor skills to cursorSkillsDir (not projectRoot)', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      const s = await stat(join(cursorSkillsDir, 'rms-review', 'SKILL.md'));
      assert.ok(s.isFile(), 'rms-review/SKILL.md should be in cursorSkillsDir');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 3 OpenCode templates to globalDir', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      for (const name of ['rms-review.md', 'rms-fix.md', 'rms-settings.md']) {
        const s = await stat(join(globalDir, name));
        assert.ok(s.isFile(), `${name} should exist in globalDir`);
      }
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 3 Cursor skill directories to cursorSkillsDir', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      for (const name of ['rms-review', 'rms-fix', 'rms-settings']) {
        const s = await stat(join(cursorSkillsDir, name, 'SKILL.md'));
        assert.ok(s.isFile(), `${name}/SKILL.md should exist in cursorSkillsDir`);
      }
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('OpenCode files do NOT land in projectRoot', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
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

  test('Cursor skill files do NOT land in projectRoot', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      // Should not exist under projectRoot/.cursor/
      let found = false;
      try {
        await stat(join(projectRoot, '.cursor', 'commands', 'rms-review.md'));
        found = true;
      } catch {
        // expected — file should not exist
      }
      assert.ok(!found, 'Cursor files should NOT be in projectRoot/.cursor/commands/');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });
});

describe('selective install', () => {
  test('editors: opencode only — writes OpenCode files, skips Cursor', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['opencode'], globalDir, cursorSkillsDir });
      // OpenCode file must exist
      const s = await stat(join(globalDir, 'rms-review.md'));
      assert.ok(s.isFile(), 'rms-review.md should be in globalDir');
      // Cursor skill must NOT exist
      let cursorFound = false;
      try { await stat(join(cursorSkillsDir, 'rms-review', 'SKILL.md')); cursorFound = true; } catch { /* expected */ }
      assert.ok(!cursorFound, 'Cursor SKILL.md should not be written when editors=[opencode]');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('editors: cursor only — writes Cursor files, skips OpenCode', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['cursor'], globalDir, cursorSkillsDir });
      // Cursor skill must exist
      const s = await stat(join(cursorSkillsDir, 'rms-review', 'SKILL.md'));
      assert.ok(s.isFile(), 'rms-review/SKILL.md should be in cursorSkillsDir');
      // OpenCode file must NOT exist
      let ocFound = false;
      try { await stat(join(globalDir, 'rms-review.md')); ocFound = true; } catch { /* expected */ }
      assert.ok(!ocFound, 'OpenCode rms-review.md should not be written when editors=[cursor]');
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('editors: both — writes all OpenCode and Cursor files', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['opencode', 'cursor'], globalDir, cursorSkillsDir });
      const oc = await stat(join(globalDir, 'rms-review.md'));
      assert.ok(oc.isFile());
      const cu = await stat(join(cursorSkillsDir, 'rms-review', 'SKILL.md'));
      assert.ok(cu.isFile());
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });
});
