import type { AnalysisContext, Finding, ParsedFile } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { walk, findNodes } from '../parsers/ast-utils.js';
import type { SyntaxNode } from 'web-tree-sitter';

export class AiSmellDetector extends BaseAnalyzer {
  name = 'ai-smells';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = context.config.analyzers.aiSmells;

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);
      findings.push(...this.checkCommentRatio(file, changedLines, config.commentRatio));
      findings.push(...this.checkUnusedImports(file, changedLines));
      findings.push(...this.checkVerboseErrorHandling(file, changedLines));
      findings.push(...this.checkUnnecessaryTypeAssertions(file, changedLines));
      findings.push(...this.checkCopyPastePatterns(file, changedLines));
    }

    return findings;
  }

  private checkCommentRatio(file: ParsedFile, changedLines: Set<number>, threshold: number): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    // Count comments and code in changed lines
    let commentLines = 0;
    let codeLines = 0;

    for (const lineNum of changedLines) {
      const line = lines[lineNum - 1]?.trim();
      if (!line) continue;

      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('#')) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    const total = commentLines + codeLines;
    if (total < 5) return findings; // Skip small changes

    const ratio = commentLines / total;
    if (ratio > threshold) {
      // Find first comment line in changed lines for location
      let firstCommentLine = 1;
      for (const lineNum of changedLines) {
        const line = lines[lineNum - 1]?.trim();
        if (line?.startsWith('//') || line?.startsWith('/*') || line?.startsWith('#')) {
          firstCommentLine = lineNum;
          break;
        }
      }

      findings.push(this.createFinding(
        'ai-smell/excessive-comments',
        file.path,
        firstCommentLine,
        `Excessive comment-to-code ratio: ${(ratio * 100).toFixed(0)}% comments (threshold: ${(threshold * 100).toFixed(0)}%)`,
        {
          suggestion: 'AI-generated code often has too many obvious comments. Remove comments that restate the code.',
        },
      ));
    }

    return findings;
  }

  private checkUnusedImports(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];
    const root = file.tree.rootNode;

    // Collect all import specifiers
    const imports: Array<{ name: string; line: number; node: SyntaxNode }> = [];

    walk(root, (node) => {
      if (node.type === 'import_statement') {
        const lineNum = node.startPosition.row + 1;
        // Only check imports in changed lines
        if (!changedLines.has(lineNum)) return;

        walk(node, (child) => {
          if (
            child.type === 'identifier' &&
            (child.parent?.type === 'import_specifier' ||
             child.parent?.type === 'import_clause' ||
             child.parent?.type === 'namespace_import')
          ) {
            imports.push({ name: child.text, line: lineNum, node: child });
          }
        });
      }
    });

    if (imports.length === 0) return findings;

    // Collect all identifier references outside of imports
    const usedIdentifiers = new Set<string>();
    walk(root, (node) => {
      if (node.type === 'identifier' || node.type === 'type_identifier') {
        // Skip if it's part of an import
        let parent = node.parent;
        let isImport = false;
        while (parent) {
          if (parent.type === 'import_statement') {
            isImport = true;
            break;
          }
          parent = parent.parent;
        }
        if (!isImport) {
          usedIdentifiers.add(node.text);
        }
      }
    });

    for (const imp of imports) {
      if (!usedIdentifiers.has(imp.name)) {
        findings.push(this.createFinding(
          'ai-smell/unused-import',
          file.path,
          imp.line,
          `Unused import: '${imp.name}'`,
          {
            severity: Severity.Warning,
            suggestion: 'AI tools often add imports that are never used. Remove unused imports.',
          },
        ));
      }
    }

    return findings;
  }

  private checkVerboseErrorHandling(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    const tryCatches = findNodes(file.tree, ['try_statement']);

    for (const tryNode of tryCatches) {
      const lineNum = tryNode.startPosition.row + 1;
      if (!changedLines.has(lineNum)) continue;

      const tryBody = tryNode.childForFieldName('body');
      const handler = tryNode.childForFieldName('handler');

      if (!tryBody || !handler) continue;

      const catchBody = handler.childForFieldName('body');
      if (!catchBody) continue;

      const tryLines = tryBody.endPosition.row - tryBody.startPosition.row;
      const catchLines = catchBody.endPosition.row - catchBody.startPosition.row;

      if (catchLines > tryLines * 2 && catchLines > 5) {
        findings.push(this.createFinding(
          'ai-smell/verbose-error-handling',
          file.path,
          handler.startPosition.row + 1,
          `Catch block (${catchLines} lines) is ${(catchLines / tryLines).toFixed(1)}x larger than try block (${tryLines} lines)`,
          {
            suggestion: 'AI-generated error handling is often overly verbose. Consider simplifying or extracting error handling.',
          },
        ));
      }
    }

    return findings;
  }

  private checkUnnecessaryTypeAssertions(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.rootNode, (node) => {
      // `as any` or `as unknown`
      if (node.type === 'as_expression') {
        const lineNum = node.startPosition.row + 1;
        if (!changedLines.has(lineNum)) return;

        const typeNode = node.childForFieldName('type');
        if (typeNode?.text === 'any') {
          findings.push(this.createFinding(
            'ai-smell/unnecessary-type-assertion',
            file.path,
            lineNum,
            'Type assertion to "any" — may indicate AI-generated type workaround',
            {
              suggestion: 'Fix the underlying type issue instead of using "as any"',
            },
          ));
        }
      }

      // Non-null assertions (!)
      if (node.type === 'non_null_expression') {
        const lineNum = node.startPosition.row + 1;
        if (!changedLines.has(lineNum)) return;

        // Count non-null assertions in changed lines for this file
        // Only flag if there are many in close proximity
        const nearby = findNodes(file.tree, ['non_null_expression']).filter(n => {
          const l = n.startPosition.row + 1;
          return changedLines.has(l) && Math.abs(l - lineNum) < 10;
        });

        if (nearby.length >= 3 && nearby[0] === node) {
          findings.push(this.createFinding(
            'ai-smell/excessive-non-null-assertions',
            file.path,
            lineNum,
            `${nearby.length} non-null assertions (!) in close proximity`,
            {
              suggestion: 'AI tools often overuse non-null assertions. Add proper null checks instead.',
            },
          ));
        }
      }
    });

    return findings;
  }

  private checkCopyPastePatterns(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];
    const addedLines = [...changedLines]
      .sort((a, b) => a - b)
      .map(n => file.content.split('\n')[n - 1]?.trim())
      .filter((line): line is string => !!line && line.length > 20);

    if (addedLines.length < 6) return findings;

    // Look for repeated blocks of 3+ lines within the diff
    const blockSize = 3;
    const blocks = new Map<string, number[]>();

    for (let i = 0; i <= addedLines.length - blockSize; i++) {
      const block = addedLines.slice(i, i + blockSize).join('\n');
      const existing = blocks.get(block);
      if (existing) {
        existing.push(i);
      } else {
        blocks.set(block, [i]);
      }
    }

    for (const [block, positions] of blocks) {
      if (positions.length >= 2) {
        const sortedChanged = [...changedLines].sort((a, b) => a - b);
        const firstLine = sortedChanged[positions[0]] ?? sortedChanged[0];
        findings.push(this.createFinding(
          'ai-smell/copy-paste',
          file.path,
          firstLine,
          `Repeated code block found ${positions.length} times in the same diff`,
          {
            suggestion: 'AI tools often generate repetitive code. Consider extracting a shared function.',
          },
        ));
        break; // One finding per file is enough
      }
    }

    return findings;
  }
}
