import { test, describe, expect } from 'vitest';
import { preprocessDiff } from './diff-preprocessor.js';

// Helper to build a realistic git diff file section
function makeDiffSection(filename: string, content = '@@\n-old\n+new\n'): string {
  return `diff --git a/${filename} b/${filename}\nindex abc..def 100644\n--- a/${filename}\n+++ b/${filename}\n${content}`;
}

describe('preprocessDiff', () => {
  test('strips package-lock.json section entirely', () => {
    const raw =
      makeDiffSection('package-lock.json', '@@\n-"version": "1"\n+"version": "2"\n') +
      makeDiffSection('src/app.ts');

    const { diff, stats } = preprocessDiff(raw);

    expect(!diff.includes('package-lock.json')).toBeTruthy();
    expect(diff.includes('src/app.ts')).toBeTruthy();
    expect(stats.strippedFiles).toEqual(['package-lock.json']);
  });

  test('strips yarn.lock section', () => {
    const raw = makeDiffSection('yarn.lock') + makeDiffSection('src/util.ts');

    const { diff, stats } = preprocessDiff(raw);

    expect(!diff.includes('yarn.lock')).toBeTruthy();
    expect(diff.includes('src/util.ts')).toBeTruthy();
    expect(stats.strippedFiles).toEqual(['yarn.lock']);
  });

  test('strips node_modules/ diff section', () => {
    const raw =
      makeDiffSection('node_modules/some-package/index.js') + makeDiffSection('src/main.ts');

    const { diff, stats } = preprocessDiff(raw);

    expect(!diff.includes('node_modules/some-package/index.js')).toBeTruthy();
    expect(diff.includes('src/main.ts')).toBeTruthy();
    expect(stats.strippedFiles.some((f: string) => f.includes('node_modules'))).toBeTruthy();
  });

  test('passes regular .ts file diff through unchanged', () => {
    const section = makeDiffSection('src/service.ts', '@@\n-old\n+new\n');
    const { diff, stats } = preprocessDiff(section);

    expect(diff.includes('src/service.ts')).toBeTruthy();
    expect(stats.strippedFiles.length).toBe(0);
  });

  test('strips binary file sections (Binary files differ marker)', () => {
    const binaryContent = 'Binary files a/assets/image.png b/assets/image.png differ\n';
    const raw =
      `diff --git a/assets/image.png b/assets/image.png\n${binaryContent}` +
      makeDiffSection('src/code.ts');

    const { diff, stats } = preprocessDiff(raw);

    expect(!diff.includes('assets/image.png')).toBeTruthy();
    expect(diff.includes('src/code.ts')).toBeTruthy();
    expect(stats.strippedFiles.some((f: string) => f.includes('image.png'))).toBeTruthy();
  });

  test('stats.strippedFiles contains all stripped file names', () => {
    const raw =
      makeDiffSection('package-lock.json') +
      makeDiffSection('yarn.lock') +
      makeDiffSection('src/index.ts');

    const { stats } = preprocessDiff(raw);

    expect(stats.strippedFiles.includes('package-lock.json')).toBeTruthy();
    expect(stats.strippedFiles.includes('yarn.lock')).toBeTruthy();
    expect(stats.strippedFiles.length).toBe(2);
  });

  test('mixed diff: 2 lock files + 1 real file — result contains only real file diff', () => {
    const tsSection = makeDiffSection('src/auth.ts', '@@\n+export function auth() {}\n');
    const raw =
      makeDiffSection('package-lock.json') + makeDiffSection('pnpm-lock.yaml') + tsSection;

    const { diff, stats } = preprocessDiff(raw);

    expect(diff.includes('src/auth.ts')).toBeTruthy();
    expect(!diff.includes('package-lock.json')).toBeTruthy();
    expect(!diff.includes('pnpm-lock.yaml')).toBeTruthy();
    expect(stats.strippedFiles.length).toBe(2);
  });

  test('empty string input returns empty string with zero stats', () => {
    const { diff, stats } = preprocessDiff('');

    expect(diff).toBe('');
    expect(stats.strippedFiles.length).toBe(0);
    expect(stats.originalLines).toBe(0);
    expect(stats.remainingLines).toBe(0);
  });

  test('strips pnpm-lock.yaml section', () => {
    const raw = makeDiffSection('pnpm-lock.yaml') + makeDiffSection('src/lib.ts');
    const { diff, stats } = preprocessDiff(raw);
    expect(!diff.includes('pnpm-lock.yaml')).toBeTruthy();
    expect(diff.includes('src/lib.ts')).toBeTruthy();
    expect(stats.strippedFiles).toEqual(['pnpm-lock.yaml']);
  });

  test('strips *.min.js files', () => {
    const raw = makeDiffSection('public/bundle.min.js') + makeDiffSection('src/component.ts');
    const { diff, stats } = preprocessDiff(raw);
    expect(!diff.includes('bundle.min.js')).toBeTruthy();
    expect(diff.includes('src/component.ts')).toBeTruthy();
  });

  test('strips dist/ path files', () => {
    const raw = makeDiffSection('dist/index.js') + makeDiffSection('src/input.ts');
    const { diff, stats } = preprocessDiff(raw);
    expect(!diff.includes('dist/index.js')).toBeTruthy();
    expect(diff.includes('src/input.ts')).toBeTruthy();
  });

  test('remainingLines reflects actual kept content', () => {
    const tsSection = makeDiffSection('src/utils.ts', '@@\n-old\n+new\n+extra\n');
    const raw = makeDiffSection('yarn.lock') + tsSection;

    const { stats } = preprocessDiff(raw);
    expect(stats.remainingLines > 0).toBeTruthy();
    expect(stats.originalLines > stats.remainingLines).toBeTruthy();
  });
});
