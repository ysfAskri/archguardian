import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/core/pipeline.js';
import { Severity, type AnalysisContext, type Analyzer, type Finding } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    files: [],
    parsedFiles: [],
    config: DEFAULT_CONFIG,
    projectRoot: '/tmp/test',
    ...overrides,
  };
}

function makeAnalyzer(name: string, findings: Finding[], delay = 0): Analyzer {
  return {
    name,
    async analyze() {
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      return findings;
    },
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test/rule',
    analyzer: 'test',
    severity: Severity.Warning,
    message: 'Test finding',
    file: 'test.ts',
    line: 1,
    ...overrides,
  };
}

describe('runPipeline', () => {
  it('returns empty summary for no analyzers', async () => {
    const summary = await runPipeline(makeContext(), []);
    expect(summary.totalFindings).toBe(0);
    expect(summary.analyzerResults).toHaveLength(0);
  });

  it('collects findings from multiple analyzers', async () => {
    const a1 = makeAnalyzer('security', [makeFinding({ analyzer: 'security', ruleId: 'a' })]);
    const a2 = makeAnalyzer('ai-smells', [makeFinding({ analyzer: 'ai-smells', ruleId: 'b' })]);

    const summary = await runPipeline(makeContext(), [a1, a2]);
    expect(summary.totalFindings).toBe(2);
    expect(summary.analyzerResults).toHaveLength(2);
  });

  it('deduplicates findings with same rule+file+line', async () => {
    const finding = makeFinding({ ruleId: 'dup', file: 'x.ts', line: 5 });
    const a1 = makeAnalyzer('security', [finding]);
    const a2 = makeAnalyzer('ai-smells', [{ ...finding, analyzer: 'ai-smells' }]);

    const summary = await runPipeline(makeContext(), [a1, a2]);
    expect(summary.totalFindings).toBe(1);
  });

  it('counts severity correctly', async () => {
    const findings = [
      makeFinding({ severity: Severity.Error }),
      makeFinding({ severity: Severity.Error, ruleId: 'e2', line: 2 }),
      makeFinding({ severity: Severity.Warning, ruleId: 'w1', line: 3 }),
      makeFinding({ severity: Severity.Info, ruleId: 'i1', line: 4 }),
    ];
    const a = makeAnalyzer('security', findings);

    const summary = await runPipeline(makeContext(), [a]);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.infos).toBe(1);
  });

  it('handles analyzer errors gracefully', async () => {
    const failing: Analyzer = {
      name: 'security',
      async analyze() { throw new Error('boom'); },
    };

    const summary = await runPipeline(makeContext(), [failing]);
    expect(summary.analyzerResults).toHaveLength(1);
    expect(summary.analyzerResults[0].error).toBeDefined();
    expect(summary.totalFindings).toBe(0);
  });
});
