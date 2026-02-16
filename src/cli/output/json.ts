import type { AnalysisSummary } from '../../core/types.js';

export interface JsonOutput {
  version: string;
  findings: JsonFinding[];
  summary: JsonSummary;
}

export interface JsonFinding {
  ruleId: string;
  analyzer: string;
  severity: string;
  message: string;
  file: string;
  line: number;
  suggestion?: string;
}

export interface JsonSummary {
  totalFiles: number;
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  duration: number;
}

export function formatJson(summary: AnalysisSummary): string {
  const findings: JsonFinding[] = [];

  for (const result of summary.analyzerResults) {
    for (const finding of result.findings) {
      const entry: JsonFinding = {
        ruleId: finding.ruleId,
        analyzer: finding.analyzer,
        severity: finding.severity,
        message: finding.message,
        file: finding.file,
        line: finding.line,
      };
      if (finding.suggestion) {
        entry.suggestion = finding.suggestion;
      }
      findings.push(entry);
    }
  }

  const output: JsonOutput = {
    version: '1.0.0',
    findings,
    summary: {
      totalFiles: summary.totalFiles,
      totalFindings: summary.totalFindings,
      errors: summary.errors,
      warnings: summary.warnings,
      infos: summary.infos,
      duration: summary.duration,
    },
  };

  return JSON.stringify(output, null, 2);
}
