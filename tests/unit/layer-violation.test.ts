import { describe, it, expect } from 'vitest';
import { LayerViolationDetector } from '../../src/analyzers/layer-violation.js';
import {
  Severity,
  type AnalysisContext,
  type ArchGuardConfig,
  type FileInfo,
  type ParsedFile,
} from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an ArchGuardConfig with architecture analyzer settings. */
function makeArchConfig(overrides: Partial<ArchGuardConfig['analyzers']['architecture']> = {}): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      architecture: {
        ...DEFAULT_CONFIG.analyzers.architecture,
        enabled: true,
        severity: Severity.Error,
        ...overrides,
      },
    },
  };
}

/**
 * Create a minimal mock SgNode that supports the `walk` function.
 * `walk` iterates `node.children()` and recurses, so we must
 * make sure every node properly returns its children.
 */
function mockNode(props: {
  type: string;
  text: string;
  row: number;
  children?: any[];
  fieldMap?: Record<string, any>;
}) {
  const children = props.children ?? [];
  const node: any = {
    kind: () => props.type,
    text: () => props.text,
    range: () => ({
      start: { line: props.row, column: 0, index: 0 },
      end: { line: props.row, column: 0, index: 0 },
    }),
    children: () => children,
    child: (i: number) => children[i] ?? null,
    field: (name: string) => props.fieldMap?.[name] ?? null,
    parent: () => null as any,
    isNamed: () => true,
    isLeaf: () => children.length === 0,
  };
  // Set parent reference on children
  for (const c of children) {
    c.parent = () => node;
  }
  return node;
}

/** Build a mock import_statement node that `collectImports` can traverse. */
function createMockImportNode(importSource: string, line: number) {
  const sourceNode = mockNode({
    type: 'string',
    text: `'${importSource}'`,
    row: line - 1,
  });

  const importNode = mockNode({
    type: 'import_statement',
    text: `import something from '${importSource}'`,
    row: line - 1,
    children: [sourceNode],
    fieldMap: { source: sourceNode },
  });

  return importNode;
}

/** Build a mock tree (SgRoot) whose root() has the given import nodes as children. */
function createMockTree(importNodes: any[]) {
  const rootNode = mockNode({
    type: 'program',
    text: '',
    row: 0,
    children: importNodes,
  });
  return { root: () => rootNode };
}

/** Build a full AnalysisContext with a single file that has mock imports. */
function makeContext(
  filePath: string,
  imports: Array<{ source: string; line: number }>,
  config: ArchGuardConfig,
): AnalysisContext {
  const importNodes = imports.map((imp) => createMockImportNode(imp.source, imp.line));
  const mockTree = createMockTree(importNodes);

  // Every import line is treated as an added line (changed).
  const addedLines = imports.map((imp) => ({
    lineNumber: imp.line,
    content: `import something from '${imp.source}'`,
    type: 'added' as const,
  }));

  const fileInfo: FileInfo = {
    path: filePath,
    language: 'typescript',
    status: 'added',
    hunks: [],
    addedLines,
    removedLines: [],
    content: addedLines.map((l) => l.content).join('\n'),
  };

  const parsedFile: ParsedFile = {
    path: filePath,
    language: 'typescript',
    tree: mockTree as any,
    content: fileInfo.content!,
  };

  return {
    files: [fileInfo],
    parsedFiles: [parsedFile],
    config,
    projectRoot: '/project',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LayerViolationDetector', () => {
  const detector = new LayerViolationDetector();

  it('has the correct name', () => {
    expect(detector.name).toBe('architecture');
  });

  // --- No findings expected -------------------------------------------------

  it('returns no findings when layers are empty', async () => {
    const config = makeArchConfig({ layers: [], rules: [] });
    const ctx = makeContext('src/controllers/user.ts', [{ source: '../services/user.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when rules are empty', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
      ],
      rules: [],
    });
    const ctx = makeContext('src/controllers/user.ts', [{ source: '../services/user.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings for allowed imports', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
      ],
      rules: [{ from: 'controllers', allow: ['services'] }],
    });
    const ctx = makeContext('src/controllers/user.ts', [{ source: '../services/user.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when source file does not belong to any layer', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['services'] }],
    });
    const ctx = makeContext('src/utils/helper.ts', [{ source: '../services/user.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when target import does not belong to any layer', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['services'] }],
    });
    const ctx = makeContext('src/controllers/user.ts', [{ source: '../utils/helper.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings for same-layer imports', async () => {
    const config = makeArchConfig({
      layers: [{ name: 'services', patterns: ['src/services/**'] }],
      rules: [{ from: 'services', allow: [] }],
    });
    const ctx = makeContext('src/services/user.ts', [{ source: './auth.js', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings for package (non-relative) imports', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['services'] }],
    });
    // 'express' doesn't match any layer pattern, so no violation
    const ctx = makeContext('src/controllers/user.ts', [{ source: 'express', line: 1 }], config);
    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // --- Violations expected --------------------------------------------------

  it('detects violation when importing from a denied layer', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['repositories'] }],
    });
    const ctx = makeContext(
      'src/controllers/user.ts',
      [{ source: '../repositories/user-repo.js', line: 2 }],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('architecture/layer-violation');
    expect(findings[0].severity).toBe(Severity.Error);
    expect(findings[0].message).toContain('controllers');
    expect(findings[0].message).toContain('repositories');
    expect(findings[0].line).toBe(2);
  });

  it('detects violation when importing from a layer not in the allow list', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', allow: ['services'] }],
    });
    const ctx = makeContext(
      'src/controllers/user.ts',
      [{ source: '../repositories/user-repo.js', line: 3 }],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('architecture/layer-violation');
    expect(findings[0].message).toContain('controllers');
    expect(findings[0].message).toContain('repositories');
  });

  it('detects multiple violations in the same file', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'services', deny: ['controllers', 'repositories'] }],
    });
    const ctx = makeContext(
      'src/services/user.ts',
      [
        { source: '../controllers/handler.js', line: 1 },
        { source: '../repositories/user-repo.js', line: 2 },
      ],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(2);
    expect(findings[0].message).toContain('controllers');
    expect(findings[1].message).toContain('repositories');
  });

  it('includes a suggestion in findings', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'services', patterns: ['src/services/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', allow: ['services'] }],
    });
    const ctx = makeContext(
      'src/controllers/user.ts',
      [{ source: '../repositories/user-repo.js', line: 1 }],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].suggestion).toBeDefined();
    expect(findings[0].suggestion).toContain('repositories');
    expect(findings[0].suggestion).toContain('services');
  });

  it('uses severity from architecture config', async () => {
    const config = makeArchConfig({
      severity: Severity.Warning,
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['repositories'] }],
    });
    const ctx = makeContext(
      'src/controllers/user.ts',
      [{ source: '../repositories/user-repo.js', line: 1 }],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Warning);
  });

  // --- Changed lines filtering ----------------------------------------------

  it('only reports violations on changed lines', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', deny: ['repositories'] }],
    });

    // Build context where line 1 is an import to a denied layer, but only
    // line 5 is marked as changed.
    const importNodes = [createMockImportNode('../repositories/user-repo.js', 1)];
    const mockTree = createMockTree(importNodes);

    const fileInfo: FileInfo = {
      path: 'src/controllers/user.ts',
      language: 'typescript',
      status: 'modified',
      hunks: [],
      addedLines: [{ lineNumber: 5, content: 'const x = 1;', type: 'added' }],
      removedLines: [],
      content: "import repo from '../repositories/user-repo.js';\n\n\n\nconst x = 1;\n",
    };

    const parsedFile: ParsedFile = {
      path: 'src/controllers/user.ts',
      language: 'typescript',
      tree: mockTree as any,
      content: fileInfo.content!,
    };

    const ctx: AnalysisContext = {
      files: [fileInfo],
      parsedFiles: [parsedFile],
      config,
      projectRoot: '/project',
    };

    const findings = await detector.analyze(ctx);
    // Import is on line 1, but only line 5 was changed -- no finding
    expect(findings).toHaveLength(0);
  });

  // --- deny takes priority over allow ---------------------------------------

  it('deny takes priority over allow for the same layer', async () => {
    const config = makeArchConfig({
      layers: [
        { name: 'controllers', patterns: ['src/controllers/**'] },
        { name: 'repositories', patterns: ['src/repositories/**'] },
      ],
      rules: [{ from: 'controllers', allow: ['repositories'], deny: ['repositories'] }],
    });
    const ctx = makeContext(
      'src/controllers/user.ts',
      [{ source: '../repositories/user-repo.js', line: 1 }],
      config,
    );

    const findings = await detector.analyze(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('architecture/layer-violation');
  });
});
