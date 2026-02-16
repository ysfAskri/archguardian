import { readFile, writeFile } from 'node:fs/promises';
import type { Finding } from '../core/types.js';
import type { Fix, FixResult } from './index.js';

/**
 * Creates a unified diff string between two text contents.
 */
function createUnifiedDiff(filePath: string, original: string, modified: string): string {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');

  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Find the changed region
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

  // Context before
  for (let i = contextBefore; i < start; i++) {
    lines.push(` ${oldLines[i]}`);
  }

  // Removed lines
  for (let i = start; i <= endOld; i++) {
    lines.push(`-${oldLines[i]}`);
  }

  // Added lines
  for (let i = start; i <= endNew; i++) {
    lines.push(`+${newLines[i]}`);
  }

  // Context after
  for (let i = endOld + 1; i <= contextAfterOld; i++) {
    lines.push(` ${oldLines[i]}`);
  }

  return lines.join('\n');
}

/**
 * Extract the import name from a finding message like: "Unused import: 'SomeModule'"
 */
function extractImportName(finding: Finding): string | null {
  const match = finding.message.match(/Unused import:\s*'([^']+)'/);
  return match ? match[1] : null;
}

/**
 * Remove an import line or a specific specifier from an import statement.
 *
 * Handles:
 *  - import { x } from 'y'      (named import, single specifier)
 *  - import { x, y } from 'z'   (named import, removes just the specifier)
 *  - import x from 'y'          (default import)
 *  - import * as x from 'y'     (namespace import)
 */
function removeImportFromContent(content: string, importName: string, targetLine: number): string {
  const lines = content.split('\n');
  const lineIdx = targetLine - 1;

  if (lineIdx < 0 || lineIdx >= lines.length) {
    return content;
  }

  const line = lines[lineIdx];

  // Check for default import: import x from 'y'
  const defaultImportRe = new RegExp(`^\\s*import\\s+${escapeRegExp(importName)}\\s+from\\s+`);
  if (defaultImportRe.test(line)) {
    lines.splice(lineIdx, 1);
    return lines.join('\n');
  }

  // Check for namespace import: import * as x from 'y'
  const namespaceRe = new RegExp(`^\\s*import\\s+\\*\\s+as\\s+${escapeRegExp(importName)}\\s+from\\s+`);
  if (namespaceRe.test(line)) {
    lines.splice(lineIdx, 1);
    return lines.join('\n');
  }

  // Check for named import: import { ... } from 'y'
  const namedImportRe = /\{([^}]+)\}/;
  const namedMatch = line.match(namedImportRe);
  if (namedMatch) {
    const specifiers = namedMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Check if any specifier matches (with or without 'as' alias)
    const remaining = specifiers.filter(s => {
      const parts = s.split(/\s+as\s+/);
      const localName = parts.length > 1 ? parts[1].trim() : parts[0].trim();
      return localName !== importName;
    });

    if (remaining.length === 0) {
      // All specifiers removed — check if there's also a default import on this line
      // e.g. import React, { useState } from 'react'
      const defaultWithNamedRe = /^(\s*import\s+)(\w+)\s*,\s*\{[^}]*\}(\s+from\s+.+)$/;
      const defaultWithNamedMatch = line.match(defaultWithNamedRe);
      if (defaultWithNamedMatch) {
        // Keep just the default import
        lines[lineIdx] = `${defaultWithNamedMatch[1]}${defaultWithNamedMatch[2]}${defaultWithNamedMatch[3]}`;
      } else {
        // Remove the entire import line
        lines.splice(lineIdx, 1);
      }
    } else {
      // Rebuild the import with remaining specifiers
      const newSpecifiers = remaining.join(', ');
      lines[lineIdx] = line.replace(namedImportRe, `{ ${newSpecifiers} }`);
    }

    return lines.join('\n');
  }

  // Check for type-only imports: import type { x } from 'y' or import type x from 'y'
  const typeDefaultRe = new RegExp(`^\\s*import\\s+type\\s+${escapeRegExp(importName)}\\s+from\\s+`);
  if (typeDefaultRe.test(line)) {
    lines.splice(lineIdx, 1);
    return lines.join('\n');
  }

  // Fallback: if the line contains the import name and looks like an import, remove the line
  if (/^\s*import\s/.test(line) && line.includes(importName)) {
    lines.splice(lineIdx, 1);
    return lines.join('\n');
  }

  return content;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class RemoveUnusedImportFix implements Fix {
  ruleId = 'ai-smell/unused-import';

  async apply(filePath: string, finding: Finding): Promise<FixResult> {
    const importName = extractImportName(finding);
    if (!importName) {
      return { applied: false, description: 'Could not determine import name from finding' };
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return { applied: false, description: `Could not read file: ${filePath}` };
    }

    const updated = removeImportFromContent(content, importName, finding.line);

    if (updated === content) {
      return { applied: false, description: `Import '${importName}' not found at line ${finding.line}` };
    }

    await writeFile(filePath, updated, 'utf-8');
    return { applied: true, description: `Removed unused import '${importName}'` };
  }

  async preview(filePath: string, finding: Finding): Promise<string> {
    const importName = extractImportName(finding);
    if (!importName) {
      return 'Could not determine import name from finding';
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return `Could not read file: ${filePath}`;
    }

    const updated = removeImportFromContent(content, importName, finding.line);

    if (updated === content) {
      return `No changes: import '${importName}' not found at line ${finding.line}`;
    }

    return createUnifiedDiff(finding.file, content, updated);
  }
}
