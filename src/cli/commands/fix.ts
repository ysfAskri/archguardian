import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { buildContext } from '../../core/context.js';
import { runPipeline } from '../../core/pipeline.js';
import { isGitRepo, getGitRoot, getAllTrackedFiles } from '../../utils/git.js';
import { createAnalyzers } from '../analyzer-factory.js';
import { ExitCode, type FileInfo, type Finding } from '../../core/types.js';
import { detectLanguage } from '../../core/diff-parser.js';
import { applyFixes, getAvailableFixes } from '../../fixes/index.js';

export interface FixOptions {
  dryRun?: boolean;
  format?: 'terminal' | 'json';
}

/**
 * Collect all findings from the pipeline into a flat list.
 */
function collectFindings(summary: { analyzerResults: Array<{ findings: Finding[] }> }): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const result of summary.analyzerResults) {
    for (const finding of result.findings) {
      const key = `${finding.ruleId}:${finding.file}:${finding.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push(finding);
      }
    }
  }
  return findings;
}

export async function fixCommand(options: FixOptions = {}): Promise<number> {
  const dryRun = options.dryRun ?? false;
  const format = options.format ?? 'terminal';
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);

  // Load config
  let config;
  try {
    config = await loadConfig(projectRoot);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    return ExitCode.ConfigError;
  }

  console.log(chalk.gray('  Scanning project for fixable issues...'));

  // Get all tracked files
  const allFiles = await getAllTrackedFiles(projectRoot);

  // Build FileInfo for each file
  const files: FileInfo[] = [];
  for (const filePath of allFiles) {
    const language = detectLanguage(filePath);
    if (!language) continue;

    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      const lines = content.split('\n');
      const addedLines = lines.map((line, i) => ({
        lineNumber: i + 1,
        content: line,
        type: 'added' as const,
      }));

      files.push({
        path: filePath,
        language,
        status: 'added',
        hunks: [],
        addedLines,
        removedLines: [],
        content,
      });
    } catch {
      // Skip unreadable files
    }
  }

  if (files.length === 0) {
    console.log(chalk.gray('  No analyzable files found.'));
    return ExitCode.Success;
  }

  // Build context and run pipeline
  const context = await buildContext(files, config, projectRoot);
  const analyzers = await createAnalyzers(config);
  const pipelineSummary = await runPipeline(context, analyzers);

  // Collect all findings
  const allFindings = collectFindings(pipelineSummary);

  if (allFindings.length === 0) {
    console.log(chalk.green('  No issues found. Nothing to fix.'));
    return ExitCode.Success;
  }

  // Filter to findings that have available fixes
  const availableFixes = getAvailableFixes();
  const fixableRuleIds = new Set<string>();
  for (const fix of availableFixes) {
    fixableRuleIds.add(fix.ruleId);
  }

  // Also match convention/* rules via prefix
  const fixableFindings = allFindings.filter(f => {
    if (fixableRuleIds.has(f.ruleId)) return true;
    // Convention naming rules are handled by the rename-convention fix
    if (f.ruleId.startsWith('convention/') && f.ruleId.endsWith('-naming')) return true;
    return false;
  });

  if (fixableFindings.length === 0) {
    console.log(chalk.gray(`  Found ${allFindings.length} issues, but none have auto-fixes available.`));
    return ExitCode.Success;
  }

  console.log(chalk.gray(`  Found ${fixableFindings.length} fixable issue${fixableFindings.length > 1 ? 's' : ''} out of ${allFindings.length} total.`));

  // Apply (or preview) fixes
  const fixSummary = await applyFixes(fixableFindings, projectRoot, dryRun);

  // Output results
  if (format === 'json') {
    console.log(JSON.stringify(fixSummary, null, 2));
  } else {
    printTerminalResults(fixSummary, dryRun);
  }

  return ExitCode.Success;
}

function printTerminalResults(
  summary: { fixed: number; skipped: number; results: Array<{ ruleId: string; file: string; line: number; description: string; applied: boolean }> },
  dryRun: boolean,
): void {
  const divider = chalk.gray('─'.repeat(60));

  console.log('');
  if (dryRun) {
    console.log(chalk.bold(' Fix Preview (dry-run)'));
  } else {
    console.log(chalk.bold(' Fix Results'));
  }
  console.log(divider);

  for (const result of summary.results) {
    const location = chalk.gray(`${result.file}:${result.line}`);
    const rule = chalk.gray(`[${result.ruleId}]`);

    if (dryRun) {
      console.log(`  ${chalk.cyan('~')} ${location} ${rule}`);
      // Show diff preview indented
      for (const line of result.description.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          console.log(`    ${chalk.green(line)}`);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          console.log(`    ${chalk.red(line)}`);
        } else {
          console.log(`    ${chalk.gray(line)}`);
        }
      }
    } else if (result.applied) {
      console.log(`  ${chalk.green('v')} ${chalk.green(result.description)}`);
      console.log(`    ${location} ${rule}`);
    } else {
      console.log(`  ${chalk.yellow('~')} ${chalk.yellow(result.description)}`);
      console.log(`    ${location} ${rule}`);
    }
  }

  console.log('');
  console.log(divider);

  if (dryRun) {
    console.log(`  ${chalk.cyan(`${summary.results.length} change${summary.results.length !== 1 ? 's' : ''} would be applied. Run without --dry-run to apply.`)}`);
  } else {
    const parts: string[] = [];
    if (summary.fixed > 0) parts.push(chalk.green(`${summary.fixed} fixed`));
    if (summary.skipped > 0) parts.push(chalk.yellow(`${summary.skipped} skipped`));
    console.log(`  ${parts.join(', ')}`);
  }
  console.log('');
}
