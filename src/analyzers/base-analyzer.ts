import type { Analyzer, AnalysisContext, Finding, ParsedFile } from '../core/types.js';

export abstract class BaseAnalyzer implements Analyzer {
  abstract name: string;

  abstract analyze(context: AnalysisContext): Promise<Finding[]>;

  protected getChangedLines(context: AnalysisContext, filePath: string): Set<number> {
    const file = context.files.find(f => f.path === filePath);
    if (!file) return new Set();
    return new Set(file.addedLines.map(l => l.lineNumber));
  }

  protected getParsedFile(context: AnalysisContext, filePath: string): ParsedFile | undefined {
    return context.parsedFiles.find(f => f.path === filePath);
  }

  protected createFinding(
    ruleId: string,
    file: string,
    line: number,
    message: string,
    opts?: Partial<Finding>,
  ): Finding {
    return {
      ruleId,
      analyzer: this.name,
      severity: opts?.severity ?? this.defaultSeverity(),
      message,
      file,
      line,
      ...opts,
    };
  }

  protected abstract defaultSeverity(): Finding['severity'];
}
