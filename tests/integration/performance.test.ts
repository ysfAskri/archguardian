import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/core/pipeline.js';
import { SecurityScanner } from '../../src/analyzers/security-scanner.js';
import { AiSmellDetector } from '../../src/analyzers/ai-smell-detector.js';
import { ConventionEnforcer } from '../../src/analyzers/convention-enforcer.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import type { AnalysisContext, FileInfo, ParsedFile } from '../../src/core/types.js';

function generateFile(index: number): { fileInfo: FileInfo; content: string } {
  const lines: string[] = [];
  lines.push(`import { something${index} } from './module${index}';`);
  lines.push('');
  for (let i = 0; i < 50; i++) {
    lines.push(`export function handler${i}(req: Request) {`);
    lines.push(`  const value = req.params.id;`);
    lines.push(`  return { status: 200, data: value };`);
    lines.push(`}`);
    lines.push('');
  }
  const content = lines.join('\n');
  const addedLines = lines.map((l, i) => ({
    lineNumber: i + 1,
    content: l,
    type: 'added' as const,
  }));

  return {
    content,
    fileInfo: {
      path: `src/handlers/handler-${index}.ts`,
      language: 'typescript',
      status: 'added',
      hunks: [],
      addedLines,
      removedLines: [],
      content,
    },
  };
}

// Mock tree (SgRoot) for perf test (no actual ast-grep needed)
function mockTree(content: string): any {
  const rootNode: any = {
    kind: () => 'program',
    text: () => content,
    range: () => ({
      start: { line: 0, column: 0, index: 0 },
      end: { line: content.split('\n').length, column: 0, index: 0 },
    }),
    children: () => [],
    child: () => null,
    field: () => null,
    parent: () => null,
    isNamed: () => true,
    isLeaf: () => true,
  };
  return { root: () => rootNode };
}

describe('Performance', () => {
  it('processes 10 files in under 5 seconds', async () => {
    const files: FileInfo[] = [];
    const parsedFiles: ParsedFile[] = [];

    for (let i = 0; i < 10; i++) {
      const { fileInfo, content } = generateFile(i);
      files.push(fileInfo);
      parsedFiles.push({
        path: fileInfo.path,
        language: 'typescript',
        tree: mockTree(content),
        content,
      });
    }

    const context: AnalysisContext = {
      files,
      parsedFiles,
      config: DEFAULT_CONFIG,
      projectRoot: '/tmp/perf-test',
    };

    const analyzers = [
      new SecurityScanner(),
      new AiSmellDetector(),
      new ConventionEnforcer(),
    ];

    const start = performance.now();
    const summary = await runPipeline(context, analyzers);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000);
    expect(summary.totalFiles).toBe(10);
  }, 10000);
});
