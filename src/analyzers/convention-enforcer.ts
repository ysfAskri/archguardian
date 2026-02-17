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

    walk(file.tree.root(), (node) => {
      let nameNode = null;

      if (node.kind() === 'function_declaration' || node.kind() === 'method_definition') {
        nameNode = node.field('name');
      } else if (node.kind() === 'variable_declarator') {
        // Arrow functions: const foo = () => {}
        const init = node.field('value');
        if (init?.kind() === 'arrow_function' || init?.kind() === 'function') {
          nameNode = node.field('name');
        }
      }

      if (!nameNode) return;
      const lineNum = nameNode.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const name = nameNode.text();
      if (IGNORED_NAMES.has(name)) return;
      if (name.startsWith('_')) return; // Private convention

      // In TSX/JSX files, PascalCase functions are React components — skip them
      if (/\.[jt]sx$/.test(file.path) && /^[A-Z]/.test(name)) return;

      // Skip constructors, getters, setters
      if (name === 'constructor' || node.kind() === 'method_definition') {
        const kindNode = node.children().find(c => c.kind() === 'get' || c.kind() === 'set');
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

    walk(file.tree.root(), (node) => {
      if (node.kind() !== 'class_declaration' && node.kind() !== 'interface_declaration' && node.kind() !== 'type_alias_declaration') return;

      const nameNode = node.field('name');
      if (!nameNode) return;
      const lineNum = nameNode.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const name = nameNode.text();
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

    walk(file.tree.root(), (node) => {
      // Only top-level const declarations
      if (node.kind() !== 'lexical_declaration') return;
      const kind = node.children().find(c => c.text() === 'const');
      if (!kind) return;

      // Must be at module level (program or export)
      const parent = node.parent();
      if (parent?.kind() !== 'program' && parent?.kind() !== 'export_statement') return;

      const namedChildren = node.children().filter(c => c.isNamed());
      for (const declarator of namedChildren) {
        if (declarator?.kind() !== 'variable_declarator') continue;

        const nameNode = declarator.field('name');
        if (!nameNode || nameNode.kind() !== 'identifier') continue;

        const lineNum = nameNode.range().start.line + 1;
        if (!changedLines.has(lineNum)) continue;

        const name = nameNode.text();
        if (IGNORED_NAMES.has(name)) continue;

        // Only enforce UPPER_SNAKE on primitive constants (string, number, boolean literals)
        const value = declarator.field('value');
        const isPrimitive = value && (
          value.kind() === 'string' ||
          value.kind() === 'number' ||
          value.kind() === 'true' ||
          value.kind() === 'false'
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

    // Skip index files, dotfiles, and framework config files (next.config.ts, postcss.config.mjs, etc.)
    if (fileName === 'index' || fileName.startsWith('.') || fileName.startsWith('__')) return findings;
    if (/\.config$/.test(fileName) || /\.config\.\w+$/.test(basename(filePath))) return findings;

    // Python files use snake_case by PEP 8 — don't enforce kebab-case on them
    if (convention === 'kebab-case' && /\.py$/.test(filePath)) return findings;

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
