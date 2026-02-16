import type { AnalysisContext, AnalysisSummary, Analyzer, AnalyzerResult, Finding } from './types.js';
import { withTimeout, timed } from '../utils/performance.js';
import { logger } from '../utils/logger.js';

const ANALYZER_TIMEOUT_MS = 5000;

export async function runPipeline(
  context: AnalysisContext,
  analyzers: Analyzer[],
): Promise<AnalysisSummary> {
  const startTime = performance.now();

  const enabledAnalyzers = analyzers.filter(a => isAnalyzerEnabled(a.name, context));
  logger.debug(`Running ${enabledAnalyzers.length} analyzers on ${context.files.length} files`);

  // Run all analyzers in parallel with individual timeouts
  const results = await Promise.allSettled(
    enabledAnalyzers.map(analyzer =>
      runAnalyzer(analyzer, context)
    )
  );

  const analyzerResults: AnalyzerResult[] = results.map((result, idx) => {
    const analyzer = enabledAnalyzers[idx];
    if (result.status === 'fulfilled') {
      return result.value;
    }
    logger.error(`Analyzer ${analyzer.name} failed: ${result.reason}`);
    return {
      analyzer: analyzer.name,
      findings: [],
      duration: 0,
      error: String(result.reason),
    };
  });

  const allFindings = deduplicateFindings(analyzerResults.flatMap(r => r.findings));
  const duration = performance.now() - startTime;

  return {
    totalFiles: context.files.length,
    totalFindings: allFindings.length,
    errors: allFindings.filter(f => f.severity === 'error').length,
    warnings: allFindings.filter(f => f.severity === 'warning').length,
    infos: allFindings.filter(f => f.severity === 'info').length,
    analyzerResults,
    duration,
  };
}

async function runAnalyzer(analyzer: Analyzer, context: AnalysisContext): Promise<AnalyzerResult> {
  const { result: findings, duration } = await timed(analyzer.name, async () => {
    return withTimeout(
      analyzer.analyze(context),
      ANALYZER_TIMEOUT_MS,
      analyzer.name,
    );
  });

  logger.debug(`${analyzer.name}: ${findings.length} findings in ${duration.toFixed(0)}ms`);
  return { analyzer: analyzer.name, findings, duration };
}

function isAnalyzerEnabled(name: string, context: AnalysisContext): boolean {
  const config = context.config.analyzers;
  switch (name) {
    case 'security': return config.security.enabled;
    case 'ai-smells': return config.aiSmells.enabled;
    case 'conventions': return config.conventions.enabled;
    case 'duplicates': return config.duplicates.enabled;
    case 'architecture': return config.architecture.enabled;
    default: return true;
  }
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.ruleId}:${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
