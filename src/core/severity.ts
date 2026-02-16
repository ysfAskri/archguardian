import { ExitCode, Severity, type AnalysisSummary, type SeverityConfig } from './types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  [Severity.Info]: 0,
  [Severity.Warning]: 1,
  [Severity.Error]: 2,
};

export function severityAtLeast(a: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[threshold];
}

export function getExitCode(summary: AnalysisSummary, config: SeverityConfig): ExitCode {
  if (config.failOn === Severity.Error && summary.errors > 0) {
    return ExitCode.ErrorsFound;
  }
  if (config.failOn === Severity.Warning && (summary.errors > 0 || summary.warnings > 0)) {
    return ExitCode.ErrorsFound;
  }
  if (config.failOn === Severity.Info && summary.totalFindings > 0) {
    return ExitCode.ErrorsFound;
  }
  if (summary.warnings > config.maxWarnings) {
    return ExitCode.WarningsExceeded;
  }
  return ExitCode.Success;
}
