import { describe, it, expect } from 'vitest';
import { parseDiff, detectLanguage } from '../../src/core/diff-parser.js';

describe('detectLanguage', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('src/index.ts')).toBe('typescript');
    expect(detectLanguage('src/index.mts')).toBe('typescript');
  });

  it('detects TSX files', () => {
    expect(detectLanguage('src/App.tsx')).toBe('tsx');
  });

  it('detects JavaScript files', () => {
    expect(detectLanguage('lib/util.js')).toBe('javascript');
    expect(detectLanguage('lib/util.mjs')).toBe('javascript');
    expect(detectLanguage('lib/util.cjs')).toBe('javascript');
  });

  it('detects JSX files', () => {
    expect(detectLanguage('src/App.jsx')).toBe('jsx');
  });

  it('detects Python files', () => {
    expect(detectLanguage('main.py')).toBe('python');
  });

  it('returns null for unsupported', () => {
    expect(detectLanguage('README.md')).toBeNull();
    expect(detectLanguage('image.png')).toBeNull();
    expect(detectLanguage('Makefile')).toBeNull();
  });
});

describe('parseDiff', () => {
  it('returns empty for empty input', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('  ')).toEqual([]);
  });

  it('parses a new file diff', () => {
    const diff = `diff --git a/src/hello.ts b/src/hello.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/hello.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}`;

    const files = parseDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/hello.ts');
    expect(files[0].status).toBe('added');
    expect(files[0].language).toBe('typescript');
    expect(files[0].addedLines).toHaveLength(3);
  });

  it('parses a modified file diff', () => {
    const diff = `diff --git a/src/util.ts b/src/util.ts
index abc1234..def5678 100644
--- a/src/util.ts
+++ b/src/util.ts
@@ -1,3 +1,4 @@
 export function add(a: number, b: number) {
-  return a + b;
+  const result = a + b;
+  return result;
 }`;

    const files = parseDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('modified');
    expect(files[0].addedLines).toHaveLength(2);
    expect(files[0].removedLines).toHaveLength(1);
  });

  it('parses a deleted file diff', () => {
    const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const x = 1;
-export const y = 2;`;

    const files = parseDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe('deleted');
    expect(files[0].removedLines).toHaveLength(2);
  });

  it('parses multiple files in one diff', () => {
    const diff = `diff --git a/a.ts b/a.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/a.ts
@@ -0,0 +1,1 @@
+const a = 1;
diff --git a/b.ts b/b.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/b.ts
@@ -0,0 +1,1 @@
+const b = 2;`;

    const files = parseDiff(diff);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('a.ts');
    expect(files[1].path).toBe('b.ts');
  });

  it('correctly tracks line numbers', () => {
    const diff = `diff --git a/src/math.ts b/src/math.ts
index abc..def 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -5,3 +5,4 @@
 // existing line
-const old = 1;
+const updated = 1;
+const added = 2;
 // trailing`;

    const files = parseDiff(diff);
    const added = files[0].addedLines;
    expect(added[0].lineNumber).toBe(6);
    expect(added[1].lineNumber).toBe(7);
  });
});
