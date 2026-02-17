import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from '../../src/analyzers/duplicate-detector.js';
import { Severity, type AnalysisContext, type FileInfo, type ParsedFile, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Build an ArchGuardConfig with duplicates enabled and a custom similarity. */
function dupConfig(similarity = 0.85): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      duplicates: {
        enabled: true,
        severity: Severity.Warning,
        similarity,
      },
    },
  };
}

/**
 * Minimal mock SgNode for the duplicate detector. The detector relies on
 * `findNodes` which calls `walk`, so we build just enough structure.
 */
function createMockNode(
  type: string,
  text: string,
  startRow: number,
  endRow: number,
  children: any[] = [],
): any {
  const node: any = {
    kind: () => type,
    text: () => text,
    range: () => ({
      start: { line: startRow, column: 0, index: 0 },
      end: { line: endRow, column: 0, index: 0 },
    }),
    children: () => children,
    child: (i: number) => children[i] ?? null,
    field: () => null,
    parent: () => null,
    isNamed: () => true,
    isLeaf: () => children.length === 0,
  };
  // Set parent on children
  for (const c of children) {
    c.parent = () => node;
  }
  return node;
}

function createMockTree(nodes: any[]): any {
  const rootChildren = nodes;
  const rootNode: any = {
    kind: () => 'program',
    text: () => '',
    range: () => ({
      start: { line: 0, column: 0, index: 0 },
      end: { line: 100, column: 0, index: 0 },
    }),
    children: () => rootChildren,
    child: (i: number) => rootChildren[i] ?? null,
    field: () => null,
    parent: () => null,
    isNamed: () => true,
    isLeaf: () => rootChildren.length === 0,
  };
  // Set parent on children
  for (const c of rootChildren) {
    c.parent = () => rootNode;
  }
  return { root: () => rootNode };
}

/** Build a leaf node (keyword, operator, punctuation). */
function leaf(text: string, type = text): any {
  return createMockNode(type, text, 0, 0);
}

/** Build an identifier leaf. */
function ident(name: string): any {
  return createMockNode('identifier', name, 0, 0);
}

/** Build a number literal leaf. */
function numLit(value: string): any {
  return createMockNode('number', value, 0, 0);
}

/** Build a string literal leaf. */
function strLit(value: string): any {
  return createMockNode('string', value, 0, 0);
}

/**
 * Build a function_declaration node spanning [startRow..endRow]
 * with the given child structure.
 */
function funcNode(
  text: string,
  startRow: number,
  endRow: number,
  children: any[],
): any {
  return createMockNode('function_declaration', text, startRow, endRow, children);
}

/**
 * Construct a context with one or two files, where every line is marked
 * as changed (added).
 */
function makeContext(
  files: Array<{ path: string; nodes: any[] }>,
  totalLines = 20,
  similarity = 0.85,
): AnalysisContext {
  const fileInfos: FileInfo[] = [];
  const parsedFiles: ParsedFile[] = [];

  for (const f of files) {
    const content = Array.from({ length: totalLines }, (_, i) => `line ${i + 1}`).join('\n');
    const addedLines = Array.from({ length: totalLines }, (_, i) => ({
      lineNumber: i + 1,
      content: `line ${i + 1}`,
      type: 'added' as const,
    }));

    fileInfos.push({
      path: f.path,
      language: 'typescript',
      status: 'added',
      hunks: [],
      addedLines,
      removedLines: [],
      content,
    });

    parsedFiles.push({
      path: f.path,
      language: 'typescript',
      tree: createMockTree(f.nodes),
      content,
    });
  }

  return {
    files: fileInfos,
    parsedFiles,
    config: dupConfig(similarity),
    projectRoot: '/tmp/test',
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('DuplicateDetector', () => {
  const detector = new DuplicateDetector();

  describe('basic properties', () => {
    it('has the name "duplicates"', () => {
      expect(detector.name).toBe('duplicates');
    });
  });

  describe('structural clone detection', () => {
    it('detects two structurally identical functions in different files', async () => {
      // Two functions with the same structure but different identifier names.
      // Structure: function_declaration -> [keyword "function", ident, "(", ")", block -> [return, ident + numLit]]
      const bodyA = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{ return x + 1; }', 1, 5, [
          leaf('return'),
          ident('x'),
          leaf('+'),
          numLit('1'),
        ]),
      ];

      const bodyB = [
        leaf('function'),
        ident('bar'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{ return y + 2; }', 1, 5, [
          leaf('return'),
          ident('y'),
          leaf('+'),
          numLit('2'),
        ]),
      ];

      const nodeA = funcNode('function foo() { return x + 1; }', 0, 5, bodyA);
      const nodeB = funcNode('function bar() { return y + 2; }', 0, 5, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA] },
        { path: 'fileB.ts', nodes: [nodeB] },
      ]);

      const findings = await detector.analyze(ctx);
      const structural = findings.filter(f => f.ruleId === 'duplicate/structural-clone');
      expect(structural.length).toBe(1);
      expect(structural[0].file).toBe('fileA.ts');
      expect(structural[0].message).toContain('fileB.ts');
    });

    it('does not flag structurally different functions', async () => {
      const bodyA = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{ return x + 1; }', 1, 5, [
          leaf('return'),
          ident('x'),
          leaf('+'),
          numLit('1'),
        ]),
      ];

      // Different structure: extra statement
      const bodyB = [
        leaf('function'),
        ident('bar'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{ console.log(y); return y * 2; }', 1, 5, [
          createMockNode('call_expression', 'console.log(y)', 1, 1, [
            ident('console'),
            leaf('.'),
            ident('log'),
            leaf('('),
            ident('y'),
            leaf(')'),
          ]),
          leaf('return'),
          ident('y'),
          leaf('*'),
          numLit('2'),
        ]),
      ];

      const nodeA = funcNode('function foo() { return x + 1; }', 0, 5, bodyA);
      const nodeB = funcNode('function bar() { console.log(y); return y * 2; }', 0, 5, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA] },
        { path: 'fileB.ts', nodes: [nodeB] },
      ], 20, 1.0); // set similarity to 1.0 so similar-block won't fire either

      const findings = await detector.analyze(ctx);
      const structural = findings.filter(f => f.ruleId === 'duplicate/structural-clone');
      expect(structural.length).toBe(0);
    });
  });

  describe('similar block detection (Jaccard)', () => {
    it('detects similar but not identical blocks when above threshold', async () => {
      // Two functions with mostly overlapping tokens but slightly different structure.
      const bodyA = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('x'),
          leaf('+'),
          numLit('1'),
          leaf(';'),
        ]),
      ];

      // Same tokens except one extra leaf changes the hash.
      const bodyB = [
        leaf('function'),
        ident('bar'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('y'),
          leaf('+'),
          numLit('2'),
          leaf(';'),
          leaf('// extra comment', 'comment'),
        ]),
      ];

      const nodeA = funcNode('function foo() {}', 0, 5, bodyA);
      const nodeB = funcNode('function bar() {}', 0, 5, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA] },
        { path: 'fileB.ts', nodes: [nodeB] },
      ], 20, 0.5); // low threshold to ensure it fires

      const findings = await detector.analyze(ctx);
      // Could be structural clone or similar block depending on hash
      const duplicate = findings.filter(
        f => f.ruleId === 'duplicate/structural-clone' || f.ruleId === 'duplicate/similar-block',
      );
      expect(duplicate.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag blocks below the similarity threshold', async () => {
      // Very different token sets.
      const bodyA = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('x'),
        ]),
      ];

      const bodyB = [
        leaf('function'),
        ident('bar'),
        leaf('('),
        ident('a'),
        leaf(','),
        ident('b'),
        leaf(','),
        ident('c'),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('if'),
          leaf('('),
          ident('a'),
          leaf('>'),
          ident('b'),
          leaf(')'),
          leaf('{'),
          leaf('throw'),
          strLit('"error"'),
          leaf('}'),
        ]),
      ];

      const nodeA = funcNode('function foo() { return x; }', 0, 5, bodyA);
      const nodeB = funcNode('function bar(a,b,c) { if (a>b) { throw "error" } }', 0, 5, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA] },
        { path: 'fileB.ts', nodes: [nodeB] },
      ], 20, 0.95);

      const findings = await detector.analyze(ctx);
      const similar = findings.filter(f => f.ruleId === 'duplicate/similar-block');
      expect(similar.length).toBe(0);
    });
  });

  describe('minimum block size', () => {
    it('ignores blocks shorter than 5 lines', async () => {
      const bodyA = [leaf('return'), ident('x')];
      const bodyB = [leaf('return'), ident('y')];

      // Both span only 3 lines (rows 0-2).
      const nodeA = funcNode('function foo() { return x; }', 0, 2, bodyA);
      const nodeB = funcNode('function bar() { return y; }', 0, 2, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA] },
        { path: 'fileB.ts', nodes: [nodeB] },
      ]);

      const findings = await detector.analyze(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('changed lines filtering', () => {
    it('skips blocks that have no changed lines', async () => {
      const body = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('x'),
        ]),
      ];

      const nodeA = funcNode('function foo() {}', 0, 5, body);
      const nodeB = funcNode('function bar() {}', 0, 5, [...body]);

      // Build context manually with NO changed lines.
      const content = 'line1\nline2\nline3\nline4\nline5\nline6';
      const fileInfos: FileInfo[] = [
        {
          path: 'fileA.ts',
          language: 'typescript',
          status: 'modified',
          hunks: [],
          addedLines: [], // no changed lines
          removedLines: [],
          content,
        },
        {
          path: 'fileB.ts',
          language: 'typescript',
          status: 'modified',
          hunks: [],
          addedLines: [], // no changed lines
          removedLines: [],
          content,
        },
      ];

      const parsedFiles: ParsedFile[] = [
        { path: 'fileA.ts', language: 'typescript', tree: createMockTree([nodeA]), content },
        { path: 'fileB.ts', language: 'typescript', tree: createMockTree([nodeB]), content },
      ];

      const ctx: AnalysisContext = {
        files: fileInfos,
        parsedFiles,
        config: dupConfig(),
        projectRoot: '/tmp/test',
      };

      const findings = await detector.analyze(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe('Jaccard similarity calculation', () => {
    it('returns 1.0 for identical token sequences', () => {
      const tokens = ['function', '$ID', '(', ')', '{', 'return', '$ID', '}'];
      expect(detector.jaccardSimilarity(tokens, tokens)).toBe(1);
    });

    it('returns 0 for completely different token sequences', () => {
      const a = ['a', 'b', 'c'];
      const b = ['x', 'y', 'z'];
      expect(detector.jaccardSimilarity(a, b)).toBe(0);
    });

    it('returns a value between 0 and 1 for partially overlapping sequences', () => {
      const a = ['a', 'b', 'c', 'd'];
      const b = ['a', 'b', 'x', 'y'];
      const sim = detector.jaccardSimilarity(a, b);
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
      // intersection {a, b} = 2, union {a, b, c, d, x, y} = 6 => 2/6 ~ 0.333
      expect(sim).toBeCloseTo(2 / 6, 2);
    });

    it('handles empty arrays', () => {
      expect(detector.jaccardSimilarity([], [])).toBe(1);
      expect(detector.jaccardSimilarity(['a'], [])).toBe(0);
      expect(detector.jaccardSimilarity([], ['b'])).toBe(0);
    });

    it('accounts for token frequency (multiset)', () => {
      const a = ['a', 'a', 'b'];
      const b = ['a', 'b', 'b'];
      // bagA: a=2, b=1  bagB: a=1, b=2
      // intersection: min(2,1) + min(1,2) = 1 + 1 = 2
      // union: max(2,1) + max(1,2) = 2 + 2 = 4
      expect(detector.jaccardSimilarity(a, b)).toBeCloseTo(0.5, 2);
    });
  });

  describe('same-file duplicates', () => {
    it('detects duplicates within the same file', async () => {
      const bodyA = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('x'),
          leaf('+'),
          numLit('1'),
        ]),
      ];

      const bodyB = [
        leaf('function'),
        ident('bar'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 8, 12, [
          leaf('return'),
          ident('y'),
          leaf('+'),
          numLit('2'),
        ]),
      ];

      const nodeA = funcNode('function foo() {}', 0, 5, bodyA);
      const nodeB = funcNode('function bar() {}', 7, 12, bodyB);

      const ctx = makeContext([
        { path: 'fileA.ts', nodes: [nodeA, nodeB] },
      ]);

      const findings = await detector.analyze(ctx);
      const structural = findings.filter(f => f.ruleId === 'duplicate/structural-clone');
      expect(structural.length).toBe(1);
      expect(structural[0].file).toBe('fileA.ts');
      expect(structural[0].message).toContain('fileA.ts');
    });
  });

  describe('finding properties', () => {
    it('includes correct severity and suggestion', async () => {
      const body = [
        leaf('function'),
        ident('foo'),
        leaf('('),
        leaf(')'),
        createMockNode('statement_block', '{}', 1, 5, [
          leaf('return'),
          ident('x'),
        ]),
      ];

      const nodeA = funcNode('function foo() {}', 0, 5, [...body]);
      const nodeB = funcNode('function bar() {}', 0, 5, [...body]);

      const ctx = makeContext([
        { path: 'a.ts', nodes: [nodeA] },
        { path: 'b.ts', nodes: [nodeB] },
      ]);

      const findings = await detector.analyze(ctx);
      expect(findings.length).toBeGreaterThanOrEqual(1);

      const f = findings[0];
      expect(f.analyzer).toBe('duplicates');
      expect(f.severity).toBe(Severity.Warning);
      expect(f.suggestion).toBeDefined();
      expect(f.endLine).toBeDefined();
    });
  });
});
