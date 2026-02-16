// Public API for programmatic usage
export { loadConfig, generateDefaultConfig } from './core/config-loader.js';
export { parseDiff, detectLanguage } from './core/diff-parser.js';
export { buildContext } from './core/context.js';
export { runPipeline } from './core/pipeline.js';
export { getExitCode, severityAtLeast } from './core/severity.js';

export { SecurityScanner } from './analyzers/security-scanner.js';
export { AiSmellDetector } from './analyzers/ai-smell-detector.js';
export { ConventionEnforcer } from './analyzers/convention-enforcer.js';

export type {
  Finding,
  FileInfo,
  AnalysisContext,
  AnalysisSummary,
  AnalyzerResult,
  Analyzer,
  ArchGuardConfig,
  ParsedFile,
  Severity,
  SupportedLanguage,
} from './core/types.js';
