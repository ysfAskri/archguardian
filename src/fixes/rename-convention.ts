import { readFile, writeFile } from 'node:fs/promises';
import type { Finding, NamingConvention } from '../core/types.js';
import type { Fix, FixResult } from './index.js';

// ── Naming convention converters ────────────────────────────────

/**
 * Split an identifier into its constituent words.
 * Handles camelCase, PascalCase, snake_case, UPPER_SNAKE, kebab-case.
 */
function splitWords(name: string): string[] {
  // First handle kebab-case and snake_case separators
  let normalized = name.replace(/[-_]/g, ' ');

  // Then split on camelCase / PascalCase boundaries
  // Insert space before uppercase letters preceded by lowercase
  normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Insert space between consecutive uppercase letters followed by lowercase
  normalized = normalized.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  return normalized.split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
}

function toCamelCase(words: string[]): string {
  if (words.length === 0) return '';
  return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function toPascalCase(words: string[]): string {
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function toSnakeCase(words: string[]): string {
  return words.join('_');
}

function toUpperSnake(words: string[]): string {
  return words.map(w => w.toUpperCase()).join('_');
}

function toKebabCase(words: string[]): string {
  return words.join('-');
}

export function convertName(name: string, convention: NamingConvention): string {
  const words = splitWords(name);
  if (words.length === 0) return name;

  switch (convention) {
    case 'camelCase':
      return toCamelCase(words);
    case 'PascalCase':
      return toPascalCase(words);
    case 'snake_case':
      return toSnakeCase(words);
    case 'UPPER_SNAKE':
      return toUpperSnake(words);
    case 'kebab-case':
      return toKebabCase(words);
    default:
      return name;
  }
}

// ── Diff helper ──────────────────────────────────────────────────

function createUnifiedDiff(filePath: string, original: string, modified: string): string {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');

  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }

  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld > start && endNew > start && oldLines[endOld] === newLines[endNew]) {
    endOld--;
    endNew--;
  }

  const contextBefore = Math.max(0, start - 3);
  const contextAfterOld = Math.min(oldLines.length - 1, endOld + 3);
  const contextAfterNew = Math.min(newLines.length - 1, endNew + 3);

  const hunkOldStart = contextBefore + 1;
  const hunkOldCount = contextAfterOld - contextBefore + 1;
  const hunkNewStart = contextBefore + 1;
  const hunkNewCount = contextAfterNew - contextBefore + 1;

  lines.push(`@@ -${hunkOldStart},${hunkOldCount} +${hunkNewStart},${hunkNewCount} @@`);

  for (let i = contextBefore; i < start; i++) {
    lines.push(` ${oldLines[i]}`);
  }
  for (let i = start; i <= endOld; i++) {
    lines.push(`-${oldLines[i]}`);
  }
  for (let i = start; i <= endNew; i++) {
    lines.push(`+${newLines[i]}`);
  }
  for (let i = endOld + 1; i <= contextAfterOld; i++) {
    lines.push(` ${oldLines[i]}`);
  }

  return lines.join('\n');
}

// ── Parsing helpers ──────────────────────────────────────────────

/**
 * Extract the identifier name and target convention from a convention finding.
 *
 * Convention findings have messages like:
 *   "Function 'MyFunc' should use camelCase naming"
 *   "Type 'my_class' should use PascalCase naming"
 *   "Constant 'myConst' should use UPPER_SNAKE naming"
 */
function extractConventionInfo(finding: Finding): { name: string; convention: NamingConvention } | null {
  const match = finding.message.match(/'([^']+)'.*should use (\S+) naming/);
  if (!match) return null;

  const name = match[1];
  const convention = match[2] as NamingConvention;

  const validConventions: NamingConvention[] = ['camelCase', 'PascalCase', 'snake_case', 'UPPER_SNAKE', 'kebab-case'];
  if (!validConventions.includes(convention)) return null;

  return { name, convention };
}

/**
 * Rename an identifier in the content at the specific line.
 * Only renames the first occurrence on the target line to avoid
 * accidental renames of other identifiers.
 */
function renameIdentifier(content: string, oldName: string, newName: string, targetLine: number): string {
  const lines = content.split('\n');
  const lineIdx = targetLine - 1;

  if (lineIdx < 0 || lineIdx >= lines.length) {
    return content;
  }

  // Build a word-boundary regex for the old name
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`);
  const line = lines[lineIdx];

  if (!re.test(line)) {
    return content;
  }

  lines[lineIdx] = line.replace(re, newName);
  return lines.join('\n');
}

// ── Fix implementation ───────────────────────────────────────────

export class RenameConventionFix implements Fix {
  /**
   * This fix handles all convention/* rules:
   *   convention/function-naming
   *   convention/class-naming
   *   convention/constant-naming
   *
   * We use a startsWith match so a single fix covers all convention rules.
   */
  ruleId = 'convention/function-naming';

  /**
   * Override to match any convention/* ruleId.
   */
  private matchesRule(ruleId: string): boolean {
    return ruleId.startsWith('convention/') && ruleId.endsWith('-naming');
  }

  async apply(filePath: string, finding: Finding): Promise<FixResult> {
    if (!this.matchesRule(finding.ruleId)) {
      return { applied: false, description: `Rule ${finding.ruleId} is not a convention naming rule` };
    }

    const info = extractConventionInfo(finding);
    if (!info) {
      return { applied: false, description: 'Could not parse convention details from finding' };
    }

    const newName = convertName(info.name, info.convention);
    if (newName === info.name) {
      return { applied: false, description: `Name '${info.name}' already matches ${info.convention}` };
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return { applied: false, description: `Could not read file: ${filePath}` };
    }

    const updated = renameIdentifier(content, info.name, newName, finding.line);

    if (updated === content) {
      return { applied: false, description: `Identifier '${info.name}' not found at line ${finding.line}` };
    }

    await writeFile(filePath, updated, 'utf-8');
    return { applied: true, description: `Renamed '${info.name}' to '${newName}' (${info.convention})` };
  }

  async preview(filePath: string, finding: Finding): Promise<string> {
    if (!this.matchesRule(finding.ruleId)) {
      return `Rule ${finding.ruleId} is not a convention naming rule`;
    }

    const info = extractConventionInfo(finding);
    if (!info) {
      return 'Could not parse convention details from finding';
    }

    const newName = convertName(info.name, info.convention);
    if (newName === info.name) {
      return `No changes: name '${info.name}' already matches ${info.convention}`;
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return `Could not read file: ${filePath}`;
    }

    const updated = renameIdentifier(content, info.name, newName, finding.line);

    if (updated === content) {
      return `No changes: identifier '${info.name}' not found at line ${finding.line}`;
    }

    return createUnifiedDiff(finding.file, content, updated);
  }
}
