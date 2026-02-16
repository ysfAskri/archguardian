import type { Finding } from '../core/types.js';
import { RemoveUnusedImportFix } from './remove-unused-import.js';
import { RenameConventionFix } from './rename-convention.js';

// ── Fix interfaces ───────────────────────────────────────────────

export interface FixResult {
  applied: boolean;
  description: string;
}

export interface Fix {
  ruleId: string;
  apply(filePath: string, finding: Finding): Promise<FixResult>;
  preview(filePath: string, finding: Finding): Promise<string>;
}

export interface FixSummary {
  fixed: number;
  skipped: number;
  results: Array<{
    ruleId: string;
    file: string;
    line: number;
    description: string;
    applied: boolean;
  }>;
}

// ── Fix registry ─────────────────────────────────────────────────

const registeredFixes: Fix[] = [
  new RemoveUnusedImportFix(),
  new RenameConventionFix(),
];

export function getAvailableFixes(): Fix[] {
  return registeredFixes;
}

// ── Fix executor ─────────────────────────────────────────────────

/**
 * Find the appropriate fix for a given finding.
 * Supports exact match and prefix-based matching for convention/* rules.
 */
function findFixForRule(ruleId: string, fixes: Fix[]): Fix | undefined {
  // Exact match first
  const exact = fixes.find(f => f.ruleId === ruleId);
  if (exact) return exact;

  // Convention naming rules are all handled by the rename-convention fix
  if (ruleId.startsWith('convention/') && ruleId.endsWith('-naming')) {
    return fixes.find(f => f.ruleId.startsWith('convention/') && f.ruleId.endsWith('-naming'));
  }

  return undefined;
}

export async function applyFixes(
  findings: Finding[],
  projectRoot: string,
  dryRun: boolean,
): Promise<FixSummary> {
  const fixes = getAvailableFixes();

  const summary: FixSummary = { fixed: 0, skipped: 0, results: [] };

  for (const finding of findings) {
    const fix = findFixForRule(finding.ruleId, fixes);
    if (!fix) {
      summary.skipped++;
      summary.results.push({
        ruleId: finding.ruleId,
        file: finding.file,
        line: finding.line,
        description: 'No auto-fix available',
        applied: false,
      });
      continue;
    }

    const { join } = await import('node:path');
    const fullPath = join(projectRoot, finding.file);

    if (dryRun) {
      const diff = await fix.preview(fullPath, finding);
      summary.results.push({
        ruleId: finding.ruleId,
        file: finding.file,
        line: finding.line,
        description: diff,
        applied: false,
      });
      summary.skipped++;
    } else {
      const result = await fix.apply(fullPath, finding);
      summary.results.push({
        ruleId: finding.ruleId,
        file: finding.file,
        line: finding.line,
        description: result.description,
        applied: result.applied,
      });
      if (result.applied) {
        summary.fixed++;
      } else {
        summary.skipped++;
      }
    }
  }

  return summary;
}
