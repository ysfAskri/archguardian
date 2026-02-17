import type { AnalysisContext, Finding, ParsedFile } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { walk } from '../parsers/ast-utils.js';
import type { SgNode } from '@ast-grep/napi';

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: Severity;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'AWS Access Key', pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g, severity: Severity.Error },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}/gi, severity: Severity.Error },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi, severity: Severity.Error },
  { name: 'Generic Secret', pattern: /(?:secret|token|password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi, severity: Severity.Error },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, severity: Severity.Error },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: Severity.Error },
  { name: 'Slack Token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, severity: Severity.Error },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: Severity.Warning },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g, severity: Severity.Error },
  { name: 'Stripe Key', pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g, severity: Severity.Error },
  { name: 'Database URL', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, severity: Severity.Error },
];

const SQL_KEYWORDS = /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i;
const XSS_PROPERTIES = new Set(['innerHTML', 'outerHTML']);
const XSS_FUNCTIONS = new Set(['document.write', 'document.writeln']);
const DANGEROUS_REACT_PROP = 'dangerouslySetInnerHTML';

export class SecurityScanner extends BaseAnalyzer {
  name = 'security';

  protected defaultSeverity(): Severity {
    return Severity.Error;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = context.config.analyzers.security;

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);
      findings.push(...this.checkSecrets(file, changedLines));
      findings.push(...this.checkSqlInjection(file, changedLines));
      findings.push(...this.checkXss(file, changedLines));
      findings.push(...this.checkEval(file, changedLines));
      findings.push(...this.checkUnsafeRegex(file, changedLines));
    }

    // Custom patterns from config
    if (config.customPatterns) {
      for (const custom of config.customPatterns) {
        const regex = new RegExp(custom.pattern, 'g');
        for (const file of context.parsedFiles) {
          const lines = file.content.split('\n');
          const changedLines = this.getChangedLines(context, file.path);
          for (let i = 0; i < lines.length; i++) {
            if (!changedLines.has(i + 1)) continue;
            if (regex.test(lines[i])) {
              findings.push(this.createFinding(
                `security/custom-${custom.name}`,
                file.path,
                i + 1,
                `Custom security pattern matched: ${custom.name}`,
                { severity: custom.severity },
              ));
            }
            regex.lastIndex = 0;
          }
        }
      }
    }

    return findings;
  }

  private checkSecrets(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!changedLines.has(lineNum)) continue;

      const line = lines[i];
      // Skip comments and test files
      if (line.trimStart().startsWith('//') && line.includes('example')) continue;

      for (const sp of SECRET_PATTERNS) {
        sp.pattern.lastIndex = 0;
        if (sp.pattern.test(line)) {
          findings.push(this.createFinding(
            `security/hardcoded-secret`,
            file.path,
            lineNum,
            `Possible hardcoded ${sp.name} detected`,
            {
              severity: sp.severity,
              suggestion: 'Move secrets to environment variables or a secrets manager',
              codeSnippet: line.trim(),
            },
          ));
        }
      }
    }

    return findings;
  }

  private checkSqlInjection(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.root(), (node) => {
      if (node.kind() !== 'template_string') return;
      const lineNum = node.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const text = node.text();
      if (!this.looksLikeSql(text)) return;
      const namedChildren = node.children().filter(c => c.isNamed());
      if (namedChildren.length > 0) {
        // Has interpolation expressions — potential SQL injection
        findings.push(this.createFinding(
          'security/sql-injection',
          file.path,
          lineNum,
          'Potential SQL injection: SQL keywords in template literal with interpolation',
          {
            severity: Severity.Error,
            suggestion: 'Use parameterized queries instead of string interpolation',
            codeSnippet: text.slice(0, 100),
          },
        ));
      }
    });

    // Check string concatenation with SQL keywords
    walk(file.tree.root(), (node) => {
      if (node.kind() !== 'binary_expression') return;
      const op = node.field('operator');
      if (op?.text() !== '+') return;

      const lineNum = node.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const text = node.text();
      if (this.looksLikeSql(text)) {
        const identifiers: SgNode[] = [];
        walk(node, (n) => { if (n.kind() === 'identifier') identifiers.push(n); });
        if (identifiers.length > 0) {
          findings.push(this.createFinding(
            'security/sql-injection',
            file.path,
            lineNum,
            'Potential SQL injection: SQL keywords in string concatenation',
            {
              severity: Severity.Error,
              suggestion: 'Use parameterized queries instead of string concatenation',
            },
          ));
        }
      }
    });

    return findings;
  }

  private checkXss(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.root(), (node) => {
      const lineNum = node.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      // Check assignment to innerHTML/outerHTML
      if (node.kind() === 'assignment_expression') {
        const left = node.field('left');
        if (left?.kind() === 'member_expression') {
          const prop = left.field('property');
          if (prop && XSS_PROPERTIES.has(prop.text())) {
            findings.push(this.createFinding(
              'security/xss',
              file.path,
              lineNum,
              `XSS risk: direct assignment to ${prop.text()}`,
              {
                severity: Severity.Error,
                suggestion: 'Use textContent or a sanitization library instead',
              },
            ));
          }
        }
      }

      // Check document.write
      if (node.kind() === 'call_expression') {
        const fn = node.field('function');
        if (fn && XSS_FUNCTIONS.has(fn.text())) {
          findings.push(this.createFinding(
            'security/xss',
            file.path,
            lineNum,
            `XSS risk: ${fn.text()}() usage`,
            {
              severity: Severity.Error,
              suggestion: 'Avoid document.write; use DOM manipulation instead',
            },
          ));
        }
      }

      // Check dangerouslySetInnerHTML in JSX
      if (node.kind() === 'jsx_attribute') {
        const name = node.field('name');
        if (name?.text() === DANGEROUS_REACT_PROP) {
          findings.push(this.createFinding(
            'security/xss',
            file.path,
            lineNum,
            'XSS risk: dangerouslySetInnerHTML usage',
            {
              severity: Severity.Warning,
              suggestion: 'Sanitize HTML content before using dangerouslySetInnerHTML',
            },
          ));
        }
      }
    });

    return findings;
  }

  private checkEval(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.root(), (node) => {
      if (node.kind() !== 'call_expression') return;
      const lineNum = node.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const fn = node.field('function');
      if (fn?.text() === 'eval' || fn?.text() === 'Function') {
        findings.push(this.createFinding(
          'security/eval',
          file.path,
          lineNum,
          `Dangerous ${fn.text()}() usage detected`,
          {
            severity: Severity.Error,
            suggestion: `Avoid ${fn.text()}(); use safer alternatives`,
          },
        ));
      }
    });

    return findings;
  }

  /**
   * Check if text actually looks like a SQL query, not just an error message
   * that happens to contain a SQL keyword like "update".
   * Requires a SQL statement keyword followed by a table-like context.
   */
  private looksLikeSql(text: string): boolean {
    // Must contain a SQL statement keyword
    if (!SQL_KEYWORDS.test(text)) return false;
    // Require SQL-specific patterns: keyword + FROM/INTO/TABLE/SET/WHERE/VALUES
    const sqlContext = /\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE)\b/i;
    return sqlContext.test(text);
  }

  private checkUnsafeRegex(file: ParsedFile, changedLines: Set<number>): Finding[] {
    const findings: Finding[] = [];

    walk(file.tree.root(), (node) => {
      if (node.kind() !== 'regex') return;
      const lineNum = node.range().start.line + 1;
      if (!changedLines.has(lineNum)) return;

      const pattern = node.text();
      if (this.hasReDoSRisk(pattern)) {
        findings.push(this.createFinding(
          'security/unsafe-regex',
          file.path,
          lineNum,
          'Potential ReDoS: regex with nested quantifiers',
          {
            severity: Severity.Warning,
            suggestion: 'Simplify regex or use a regex safety library',
            codeSnippet: pattern,
          },
        ));
      }
    });

    return findings;
  }

  /**
   * Detect regex patterns at risk of catastrophic backtracking (ReDoS).
   *
   * Only flags patterns with *star height > 1* — a quantified group that
   * contains another quantifier — **and** where group boundaries are
   * ambiguous.  Groups with a required literal separator (e.g. the `_` in
   * `(_[a-z0-9]+)*`) are safe because the engine can always determine
   * where one iteration ends and the next begins.
   */
  private hasReDoSRisk(pattern: string): boolean {
    // Replace character classes with a placeholder to preserve structure.
    // Stripping them entirely merges adjacent tokens and creates false positives.
    const simplified = pattern.replace(/\[(?:[^\]\\]|\\.)*\]/g, '#');

    // Find quantified groups that contain an inner quantifier.
    const groupRegex = /\(([^)]+)\)(?:[+*]|\{[^}]*,)/g;
    let m: RegExpExecArray | null;
    while ((m = groupRegex.exec(simplified)) !== null) {
      const content = m[1];
      // Skip groups without an inner quantifier — no nesting, no risk.
      if (!/[+*]/.test(content)) continue;

      // The group is safe if it contains a *required literal anchor* — a
      // literal character not followed by a quantifier.  For example, in
      // `(_#+)*` the `_` is a literal anchor: each group iteration must
      // start with `_`, so the engine never faces ambiguous boundaries.
      //
      // Dangerous elements (char-class placeholder #, wildcard ., escapes \)
      // are excluded from the literal-anchor check.
      const hasLiteralAnchor = /[^#.\\+*?{}()|](?![+*?{])/.test(content);
      if (!hasLiteralAnchor) {
        return true;
      }
    }

    return false;
  }
}
