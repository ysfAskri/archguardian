import type { FileInfo, HunkInfo, LineChange, SupportedLanguage } from './types.js';

const FILE_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const STATUS_RE = /^(new file|deleted file|rename from|rename to|similarity index)/;
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
};

export function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return LANGUAGE_MAP[ext] ?? null;
}

export function parseDiff(diffText: string): FileInfo[] {
  if (!diffText.trim()) return [];

  const files: FileInfo[] = [];
  const lines = diffText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const headerMatch = lines[i].match(FILE_HEADER_RE);
    if (!headerMatch) {
      i++;
      continue;
    }

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];
    i++;

    // Determine file status
    let status: FileInfo['status'] = 'modified';
    while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
      if (lines[i].startsWith('new file')) status = 'added';
      else if (lines[i].startsWith('deleted file')) status = 'deleted';
      else if (lines[i].startsWith('rename from')) status = 'renamed';
      i++;
    }

    const hunks: HunkInfo[] = [];
    const addedLines: LineChange[] = [];
    const removedLines: LineChange[] = [];

    // Parse hunks
    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      const hunkMatch = lines[i].match(HUNK_RE);
      if (!hunkMatch) {
        i++;
        continue;
      }

      const oldStart = parseInt(hunkMatch[1], 10);
      const oldLineCount = parseInt(hunkMatch[2] ?? '1', 10);
      const newStart = parseInt(hunkMatch[3], 10);
      const newLineCount = parseInt(hunkMatch[4] ?? '1', 10);
      i++;

      const changes: LineChange[] = [];
      let newLine = newStart;
      let oldLine = oldStart;

      while (i < lines.length && !lines[i].startsWith('diff --git') && !lines[i].startsWith('@@')) {
        const line = lines[i];

        if (line.startsWith('+')) {
          const change: LineChange = { lineNumber: newLine, content: line.slice(1), type: 'added' };
          changes.push(change);
          addedLines.push(change);
          newLine++;
        } else if (line.startsWith('-')) {
          const change: LineChange = { lineNumber: oldLine, content: line.slice(1), type: 'removed' };
          changes.push(change);
          removedLines.push(change);
          oldLine++;
        } else if (line.startsWith(' ')) {
          changes.push({ lineNumber: newLine, content: line.slice(1), type: 'context' });
          newLine++;
          oldLine++;
        } else if (line.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        }
        i++;
      }

      hunks.push({ oldStart, oldLines: oldLineCount, newStart, newLines: newLineCount, changes });
    }

    files.push({
      path: status === 'deleted' ? oldPath : newPath,
      language: detectLanguage(newPath),
      status,
      hunks,
      addedLines,
      removedLines,
    });
  }

  return files;
}
