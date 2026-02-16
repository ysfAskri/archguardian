import type { ParsedFile, SupportedLanguage } from '../core/types.js';
import { parseSource } from './tree-sitter-manager.js';

export function isJava(lang: SupportedLanguage): boolean {
  return lang === 'java';
}

export async function parseJava(source: string, filePath: string): Promise<ParsedFile> {
  const tree = await parseSource('java', source);
  return {
    path: filePath,
    language: 'java',
    tree,
    content: source,
  };
}
