import type { AnalysisContext, ArchGuardConfig, FileInfo, ParsedFile } from './types.js';
import { getFileContent } from '../utils/git.js';
import { parseTypeScript, isTypeScriptFamily } from '../parsers/typescript-parser.js';
import { parsePython, isPython } from '../parsers/python-parser.js';
import { parseGo, isGo } from '../parsers/go-parser.js';
import { parseRust, isRust } from '../parsers/rust-parser.js';
import { parseJava, isJava } from '../parsers/java-parser.js';
import { isTreeSitterAvailable } from '../parsers/tree-sitter-manager.js';
import { logger } from '../utils/logger.js';
import { minimatch } from 'minimatch';

function shouldInclude(filePath: string, config: ArchGuardConfig): boolean {
  const included = config.include.some(pattern => minimatch(filePath, pattern));
  const excluded = config.exclude.some(pattern => minimatch(filePath, pattern));
  return included && !excluded;
}

function filterFiles(files: FileInfo[], config: ArchGuardConfig): FileInfo[] {
  return files.filter(file => {
    if (file.status === 'deleted') return false;
    if (!file.language) return false;
    if (!config.languages.includes(file.language)) return false;
    if (!shouldInclude(file.path, config)) return false;
    return true;
  });
}

export async function buildContext(
  files: FileInfo[],
  config: ArchGuardConfig,
  projectRoot: string,
): Promise<AnalysisContext> {
  const filtered = filterFiles(files, config);
  logger.debug(`Filtered ${files.length} files to ${filtered.length} analyzable files`);

  const parsedFiles: ParsedFile[] = [];

  for (const file of filtered) {
    if (!file.language || !isTreeSitterAvailable(file.language)) continue;

    try {
      const content = file.content ?? await getFileContent(projectRoot, file.path);
      file.content = content;

      if (isTypeScriptFamily(file.language)) {
        const parsed = await parseTypeScript(content, file.path, file.language);
        parsedFiles.push(parsed);
      } else if (isPython(file.language)) {
        const parsed = await parsePython(content, file.path);
        parsedFiles.push(parsed);
      } else if (isGo(file.language)) {
        const parsed = await parseGo(content, file.path);
        parsedFiles.push(parsed);
      } else if (isRust(file.language)) {
        const parsed = await parseRust(content, file.path);
        parsedFiles.push(parsed);
      } else if (isJava(file.language)) {
        const parsed = await parseJava(content, file.path);
        parsedFiles.push(parsed);
      }
    } catch (err) {
      logger.warn(`Failed to parse ${file.path}: ${(err as Error).message}`);
    }
  }

  return { files: filtered, parsedFiles, config, projectRoot };
}
