import { test, describe, expect } from 'vitest';
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
      expect(s.isFile()).toBeTruthy();
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
      expect(s.isFile()).toBeTruthy();
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 6 OpenCode templates to globalDir', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      for (const name of [
        'rms-review.md', 'rms-fix.md', 'rms-settings.md',
        'rms-reviewer.md', 'rms-validator.md', 'rms-writer.md',
      ]) {
        const s = await stat(join(globalDir, name));
        expect(s.isFile()).toBeTruthy();
      }
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('writes all 6 Cursor skill directories to cursorSkillsDir', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const projectRoot = join(tmpRoot, 'project');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    try {
      await install(projectRoot, { globalDir, cursorSkillsDir });
      for (const name of [
        'rms-review', 'rms-fix', 'rms-settings',
        'rms-reviewer', 'rms-validator', 'rms-writer',
      ]) {
        const s = await stat(join(cursorSkillsDir, name, 'SKILL.md'));
        expect(s.isFile()).toBeTruthy();
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
      expect(!found).toBeTruthy();
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
      expect(!found).toBeTruthy();
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });
});

describe('selective install', () => {
  test('editors: opencode only — writes 6 OpenCode files, skips Cursor', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['opencode'], globalDir, cursorSkillsDir });
      // All 6 OpenCode files must exist
      for (const name of [
        'rms-review.md', 'rms-fix.md', 'rms-settings.md',
        'rms-reviewer.md', 'rms-validator.md', 'rms-writer.md',
      ]) {
        const s = await stat(join(globalDir, name));
        expect(s.isFile()).toBeTruthy();
      }
      // Cursor skill must NOT exist
      let cursorFound = false;
      try { await stat(join(cursorSkillsDir, 'rms-review', 'SKILL.md')); cursorFound = true; } catch { /* expected */ }
      expect(!cursorFound).toBeTruthy();
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('editors: cursor only — writes 6 Cursor files, skips OpenCode', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['cursor'], globalDir, cursorSkillsDir });
      // All 6 Cursor skills must exist
      for (const name of [
        'rms-review', 'rms-fix', 'rms-settings',
        'rms-reviewer', 'rms-validator', 'rms-writer',
      ]) {
        const s = await stat(join(cursorSkillsDir, name, 'SKILL.md'));
        expect(s.isFile()).toBeTruthy();
      }
      // OpenCode file must NOT exist
      let ocFound = false;
      try { await stat(join(globalDir, 'rms-review.md')); ocFound = true; } catch { /* expected */ }
      expect(!ocFound).toBeTruthy();
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });

  test('editors: both — writes all 6 OpenCode and 6 Cursor files', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'rms-test-'));
    const globalDir = join(tmpRoot, 'global');
    const cursorSkillsDir = join(tmpRoot, 'cursor-skills');
    const projectRoot = join(tmpRoot, 'project');
    try {
      await install(projectRoot, { editors: ['opencode', 'cursor'], globalDir, cursorSkillsDir });
      const oc = await stat(join(globalDir, 'rms-reviewer.md'));
      expect(oc.isFile()).toBeTruthy();
      const cu = await stat(join(cursorSkillsDir, 'rms-reviewer', 'SKILL.md'));
      expect(cu.isFile()).toBeTruthy();
    } finally {
      await rm(tmpRoot, { recursive: true });
    }
  });
});
