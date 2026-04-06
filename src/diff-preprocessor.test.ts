import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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

    assert.ok(!diff.includes('package-lock.json'), 'diff should not contain package-lock.json');
    assert.ok(diff.includes('src/app.ts'), 'diff should still contain app.ts');
    assert.deepEqual(stats.strippedFiles, ['package-lock.json']);
  });

  test('strips yarn.lock section', () => {
    const raw = makeDiffSection('yarn.lock') + makeDiffSection('src/util.ts');

    const { diff, stats } = preprocessDiff(raw);

    assert.ok(!diff.includes('yarn.lock'));
    assert.ok(diff.includes('src/util.ts'));
    assert.deepEqual(stats.strippedFiles, ['yarn.lock']);
  });

  test('strips node_modules/ diff section', () => {
    const raw =
      makeDiffSection('node_modules/some-package/index.js') + makeDiffSection('src/main.ts');

    const { diff, stats } = preprocessDiff(raw);

    assert.ok(!diff.includes('node_modules/some-package/index.js'));
    assert.ok(diff.includes('src/main.ts'));
    assert.ok(stats.strippedFiles.some((f: string) => f.includes('node_modules')));
  });

  test('passes regular .ts file diff through unchanged', () => {
    const section = makeDiffSection('src/service.ts', '@@\n-old\n+new\n');
    const { diff, stats } = preprocessDiff(section);

    assert.ok(diff.includes('src/service.ts'));
    assert.equal(stats.strippedFiles.length, 0);
  });

  test('strips binary file sections (Binary files differ marker)', () => {
    const binaryContent = 'Binary files a/assets/image.png b/assets/image.png differ\n';
    const raw =
      `diff --git a/assets/image.png b/assets/image.png\n${binaryContent}` +
      makeDiffSection('src/code.ts');

    const { diff, stats } = preprocessDiff(raw);

    assert.ok(!diff.includes('assets/image.png'), 'binary file should be stripped');
    assert.ok(diff.includes('src/code.ts'));
    assert.ok(stats.strippedFiles.some((f: string) => f.includes('image.png')));
  });

  test('stats.strippedFiles contains all stripped file names', () => {
    const raw =
      makeDiffSection('package-lock.json') +
      makeDiffSection('yarn.lock') +
      makeDiffSection('src/index.ts');

    const { stats } = preprocessDiff(raw);

    assert.ok(stats.strippedFiles.includes('package-lock.json'));
    assert.ok(stats.strippedFiles.includes('yarn.lock'));
    assert.equal(stats.strippedFiles.length, 2);
  });

  test('mixed diff: 2 lock files + 1 real file — result contains only real file diff', () => {
    const tsSection = makeDiffSection('src/auth.ts', '@@\n+export function auth() {}\n');
    const raw =
      makeDiffSection('package-lock.json') + makeDiffSection('pnpm-lock.yaml') + tsSection;

    const { diff, stats } = preprocessDiff(raw);

    assert.ok(diff.includes('src/auth.ts'));
    assert.ok(!diff.includes('package-lock.json'));
    assert.ok(!diff.includes('pnpm-lock.yaml'));
    assert.equal(stats.strippedFiles.length, 2);
  });

  test('empty string input returns empty string with zero stats', () => {
    const { diff, stats } = preprocessDiff('');

    assert.equal(diff, '');
    assert.equal(stats.strippedFiles.length, 0);
    assert.equal(stats.originalLines, 0);
    assert.equal(stats.remainingLines, 0);
  });

  test('strips pnpm-lock.yaml section', () => {
    const raw = makeDiffSection('pnpm-lock.yaml') + makeDiffSection('src/lib.ts');
    const { diff, stats } = preprocessDiff(raw);
    assert.ok(!diff.includes('pnpm-lock.yaml'));
    assert.ok(diff.includes('src/lib.ts'));
    assert.deepEqual(stats.strippedFiles, ['pnpm-lock.yaml']);
  });

  test('strips *.min.js files', () => {
    const raw = makeDiffSection('public/bundle.min.js') + makeDiffSection('src/component.ts');
    const { diff, stats } = preprocessDiff(raw);
    assert.ok(!diff.includes('bundle.min.js'));
    assert.ok(diff.includes('src/component.ts'));
  });

  test('strips dist/ path files', () => {
    const raw = makeDiffSection('dist/index.js') + makeDiffSection('src/input.ts');
    const { diff, stats } = preprocessDiff(raw);
    assert.ok(!diff.includes('dist/index.js'));
    assert.ok(diff.includes('src/input.ts'));
  });

  test('remainingLines reflects actual kept content', () => {
    const tsSection = makeDiffSection('src/utils.ts', '@@\n-old\n+new\n+extra\n');
    const raw = makeDiffSection('yarn.lock') + tsSection;

    const { stats } = preprocessDiff(raw);
    assert.ok(stats.remainingLines > 0);
    assert.ok(stats.originalLines > stats.remainingLines);
  });
});
