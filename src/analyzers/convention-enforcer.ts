import type { AnalysisContext, Finding, NamingConvention, ParsedFile } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { walk } from '../parsers/ast-utils.js';
import { basename } from 'node:path';

const CONVENTION_PATTERNS: Record<NamingConvention, RegExp> = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  UPPER_SNAKE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
};

function matchesConvention(name: string, convention: NamingConvention): boolean {
  return CONVENTION_PATTERNS[convention].test(name);
}

function formatConventionName(convention: NamingConvention): string {
  return convention;
}

// Names to skip — common valid exceptions
const IGNORED_NAMES = new Set([
  '_', '__', '___',
  'React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo',
  'i', 'j', 'k', 'x', 'y', 'z', 'e', 'n', 'T', 'K', 'V', 'P',
]);

export class ConventionEnforcer extends BaseAnalyzer {
  name = 'conventions';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = context.config.analyzers.conventions;

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);
      findings.push(...this.checkFunctionNaming(file, changedLines, config.naming.functions));
      findings.push(...this.checkClassNaming(file, changedLines, config.naming.classes));
      findings.push(...this.checkConstantNaming(file, changedLines, config.naming.constants));
    }

    // Check file naming for all changed files
    for (const file of context.files) {
      if (file.status === 'added') {
        findings.push(...this.checkFileNaming(file.path, config.naming.files));
      }
    }

    return findings;
  }

  private checkFunctionNaming(file: ParsedFile, changedLines: Set<number>, convention: NamingConvention): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.rootNode, (node) => {
      let nameNode = null;

      if (node.type === 'function_declaration' || node.type === 'method_definition') {
        nameNode = node.childForFieldName('name');
      } else if (node.type === 'variable_declarator') {
        // Arrow functions: const foo = () => {}
        const init = node.childForFieldName('value');
        if (init?.type === 'arrow_function' || init?.type === 'function') {
          nameNode = node.childForFieldName('name');
        }
      }

      if (!nameNode) return;
      const lineNum = nameNode.startPosition.row + 1;
      if (!changedLines.has(lineNum)) return;

      const name = nameNode.text;
      if (IGNORED_NAMES.has(name)) return;
      if (name.startsWith('_')) return; // Private convention

      // Skip constructors, getters, setters
      if (name === 'constructor' || node.type === 'method_definition') {
        const kindNode = node.children.find(c => c.type === 'get' || c.type === 'set');
        if (kindNode) return;
        if (name === 'constructor') return;
      }

      if (!matchesConvention(name, convention)) {
        findings.push(this.createFinding(
          'convention/function-naming',
          file.path,
          lineNum,
          `Function '${name}' should use ${formatConventionName(convention)} naming`,
          { suggestion: `Rename to match ${convention} convention` },
        ));
      }
    });

    return findings;
  }

  private checkClassNaming(file: ParsedFile, changedLines: Set<number>, convention: NamingConvention): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.rootNode, (node) => {
      if (node.type !== 'class_declaration' && node.type !== 'interface_declaration' && node.type !== 'type_alias_declaration') return;

      const nameNode = node.childForFieldName('name');
      if (!nameNode) return;
      const lineNum = nameNode.startPosition.row + 1;
      if (!changedLines.has(lineNum)) return;

      const name = nameNode.text;
      if (IGNORED_NAMES.has(name)) return;

      if (!matchesConvention(name, convention)) {
        findings.push(this.createFinding(
          'convention/class-naming',
          file.path,
          lineNum,
          `Type '${name}' should use ${formatConventionName(convention)} naming`,
          { suggestion: `Rename to match ${convention} convention` },
        ));
      }
    });

    return findings;
  }

  private checkConstantNaming(file: ParsedFile, changedLines: Set<number>, convention: NamingConvention): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.rootNode, (node) => {
      // Only top-level const declarations
      if (node.type !== 'lexical_declaration') return;
      const kind = node.children.find(c => c.text === 'const');
      if (!kind) return;

      // Must be at module level (program or export)
      const parent = node.parent;
      if (parent?.type !== 'program' && parent?.type !== 'export_statement') return;

      for (let i = 0; i < node.namedChildCount; i++) {
        const declarator = node.namedChild(i);
        if (declarator?.type !== 'variable_declarator') continue;

        const nameNode = declarator.childForFieldName('name');
        if (!nameNode || nameNode.type !== 'identifier') continue;

        const lineNum = nameNode.startPosition.row + 1;
        if (!changedLines.has(lineNum)) continue;

        const name = nameNode.text;
        if (IGNORED_NAMES.has(name)) continue;

        // Only enforce UPPER_SNAKE on primitive constants (string, number, boolean literals)
        const value = declarator.childForFieldName('value');
        const isPrimitive = value && (
          value.type === 'string' ||
          value.type === 'number' ||
          value.type === 'true' ||
          value.type === 'false'
        );

        if (!isPrimitive) continue;

        if (!matchesConvention(name, convention)) {
          findings.push(this.createFinding(
            'convention/constant-naming',
            file.path,
            lineNum,
            `Constant '${name}' should use ${formatConventionName(convention)} naming`,
            { suggestion: `Rename to match ${convention} convention` },
          ));
        }
      }
    });

    return findings;
  }

  private checkFileNaming(filePath: string, convention: NamingConvention): Finding[] {
    const findings: Finding[] = [];
    const fileName = basename(filePath).replace(/\.[^.]+$/, '');

    // Skip index files and config files
    if (fileName === 'index' || fileName.startsWith('.')) return findings;

    if (!matchesConvention(fileName, convention)) {
      findings.push(this.createFinding(
        'convention/file-naming',
        filePath,
        1,
        `File '${basename(filePath)}' should use ${formatConventionName(convention)} naming`,
        { suggestion: `Rename file to match ${convention} convention` },
      ));
    }

    return findings;
  }
}
