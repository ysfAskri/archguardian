import { describe, it, expect } from 'vitest';
import { SecurityScanner } from '../../src/analyzers/security-scanner.js';
import { Severity, type AnalysisContext, type FileInfo, type ParsedFile, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

// Helper to build a minimal context for testing
function makeContext(source: string, filePath = 'test.ts'): AnalysisContext {
  const lines = source.split('\n');
  const addedLines = lines.map((content, i) => ({
    lineNumber: i + 1,
    content,
    type: 'added' as const,
  }));

  const fileInfo: FileInfo = {
    path: filePath,
    language: 'typescript',
    status: 'added',
    hunks: [],
    addedLines,
    removedLines: [],
    content: source,
  };

  // We create a mock ParsedFile - for tests that rely on AST,
  // we'd need actual tree-sitter. These tests focus on regex-based checks.
  const parsedFile: ParsedFile = {
    path: filePath,
    language: 'typescript',
    tree: createMockTree(source),
    content: source,
  };

  return {
    files: [fileInfo],
    parsedFiles: [parsedFile],
    config: DEFAULT_CONFIG,
    projectRoot: '/tmp/test',
  };
}

// Minimal mock tree for regex-based tests
function createMockTree(source: string): any {
  return {
    rootNode: {
      type: 'program',
      text: source,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: source.split('\n').length, column: 0 },
      childCount: 0,
      namedChildCount: 0,
      child: () => null,
      namedChild: () => null,
      childForFieldName: () => null,
      descendantsOfType: () => [],
      parent: null,
    },
  };
}

describe('SecurityScanner', () => {
  const scanner = new SecurityScanner();

  describe('hardcoded secrets', () => {
    it('detects AWS access key', async () => {
      const ctx = makeContext('const key = "AKIAEXAMPLEKEYONLY1234";');
      const findings = await scanner.analyze(ctx);
      expect(findings.some(f => f.ruleId === 'security/hardcoded-secret')).toBe(true);
    });

    it('detects generic API key', async () => {
      const ctx = makeContext('const api_key = "sk_test_FAKE_KEY_FOR_TESTING_00000";');
      const findings = await scanner.analyze(ctx);
      expect(findings.some(f => f.ruleId === 'security/hardcoded-secret')).toBe(true);
    });

    it('detects GitHub token', async () => {
      const ctx = makeContext('const token = "ghp_FAKE000000000000000000000000000000TEST";');
      const findings = await scanner.analyze(ctx);
      expect(findings.some(f => f.ruleId === 'security/hardcoded-secret')).toBe(true);
    });

    it('detects database URL with credentials', async () => {
      const ctx = makeContext('const db = "postgres://admin:pass@localhost:5432/mydb";');
      const findings = await scanner.analyze(ctx);
      expect(findings.some(f => f.ruleId === 'security/hardcoded-secret')).toBe(true);
    });

    it('does not flag non-secret code', async () => {
      const ctx = makeContext('const greeting = "hello world";');
      const findings = await scanner.analyze(ctx);
      expect(findings.filter(f => f.ruleId === 'security/hardcoded-secret')).toHaveLength(0);
    });
  });
});
