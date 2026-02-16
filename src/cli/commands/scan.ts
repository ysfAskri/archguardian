import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { buildContext } from '../../core/context.js';
import { runPipeline } from '../../core/pipeline.js';
import { getExitCode } from '../../core/severity.js';
import { isGitRepo, getGitRoot, getAllTrackedFiles } from '../../utils/git.js';
import { formatSummary } from '../output/terminal.js';
import { createAnalyzers } from '../analyzer-factory.js';
import { ExitCode, type FileInfo } from '../../core/types.js';
import { detectLanguage } from '../../core/diff-parser.js';

export async function scanCommand(): Promise<number> {
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

  console.log(chalk.gray('  Scanning project...'));

  // Get all tracked files
  const allFiles = await getAllTrackedFiles(projectRoot);

  // Build FileInfo for each file (treating all lines as "added" for full scan)
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

  console.log(chalk.gray(`  Found ${files.length} files to analyze...`));

  // Build context
  const context = await buildContext(files, config, projectRoot);

  // Run pipeline
  const analyzers = createAnalyzers(config);
  const summary = await runPipeline(context, analyzers);

  // Determine exit code
  const exitCode = getExitCode(summary, config.severity);

  // Print results
  console.log(formatSummary(summary, exitCode));

  return exitCode;
}
