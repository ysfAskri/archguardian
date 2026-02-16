import type { ParsedFile, SupportedLanguage } from '../core/types.js';
import { parseSource } from './tree-sitter-manager.js';

export function isGo(lang: SupportedLanguage): boolean {
  return lang === 'go';
}

export async function parseGo(source: string, filePath: string): Promise<ParsedFile> {
  const tree = await parseSource('go', source);
  return {
    path: filePath,
    language: 'go',
    tree,
    content: source,
  };
}
