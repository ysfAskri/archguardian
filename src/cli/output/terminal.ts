import chalk from 'chalk';
import type { AnalysisSummary, AnalyzerResult, Finding } from '../../core/types.js';
import { Severity, ExitCode } from '../../core/types.js';

const SEVERITY_ICON: Record<Severity, string> = {
  [Severity.Error]: chalk.red('x'),
  [Severity.Warning]: chalk.yellow('!'),
  [Severity.Info]: chalk.blue('i'),
};

const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
  [Severity.Error]: chalk.red,
  [Severity.Warning]: chalk.yellow,
  [Severity.Info]: chalk.blue,
};

export function formatFinding(finding: Finding): string {
  const icon = SEVERITY_ICON[finding.severity];
  const color = SEVERITY_COLOR[finding.severity];
  const location = chalk.gray(`${finding.file}:${finding.line}`);
  const rule = chalk.gray(`[${finding.ruleId}]`);

  let output = `  ${icon} ${color(finding.message)}\n    ${location} ${rule}`;

  if (finding.codeSnippet) {
    output += `\n    ${chalk.gray('>')} ${chalk.dim(finding.codeSnippet)}`;
  }
  if (finding.suggestion) {
    output += `\n    ${chalk.cyan('suggestion:')} ${finding.suggestion}`;
  }

  return output;
}

export function formatSummary(summary: AnalysisSummary, exitCode: ExitCode): string {
  const lines: string[] = [];
  const divider = chalk.gray('─'.repeat(60));

  lines.push('');
  lines.push(chalk.bold(' Architecture Guardian'));
  lines.push(divider);

  // Group findings by file
  const findingsByFile = new Map<string, Finding[]>();
  for (const result of summary.analyzerResults) {
    for (const finding of result.findings) {
      const existing = findingsByFile.get(finding.file) ?? [];
      existing.push(finding);
      findingsByFile.set(finding.file, existing);
    }
  }

  if (findingsByFile.size === 0) {
    lines.push(chalk.green('  No issues found!'));
  } else {
    for (const [file, findings] of findingsByFile) {
      lines.push('');
      lines.push(chalk.white.bold(`  ${file}`));
      const sorted = findings.sort((a, b) => a.line - b.line);
      for (const finding of sorted) {
        lines.push(formatFinding(finding));
      }
    }
  }

  lines.push('');
  lines.push(divider);

  // Summary line
  const parts: string[] = [];
  if (summary.errors > 0) parts.push(chalk.red(`${summary.errors} error${summary.errors > 1 ? 's' : ''}`));
  if (summary.warnings > 0) parts.push(chalk.yellow(`${summary.warnings} warning${summary.warnings > 1 ? 's' : ''}`));
  if (summary.infos > 0) parts.push(chalk.blue(`${summary.infos} info`));
  if (parts.length === 0) parts.push(chalk.green('0 issues'));

  lines.push(`  ${parts.join(', ')} in ${summary.totalFiles} file${summary.totalFiles !== 1 ? 's' : ''} (${summary.duration.toFixed(0)}ms)`);

  if (exitCode !== ExitCode.Success) {
    lines.push('');
    lines.push(chalk.red.bold('  Commit blocked. Fix the issues above and try again.'));
  } else {
    lines.push(chalk.green('  All checks passed.'));
  }

  lines.push('');
  return lines.join('\n');
}

export function formatAnalyzerError(result: AnalyzerResult): string {
  if (!result.error) return '';
  return chalk.red(`  Analyzer '${result.analyzer}' failed: ${result.error}`);
}
