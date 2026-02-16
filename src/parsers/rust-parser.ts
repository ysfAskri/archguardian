import type { ParsedFile, SupportedLanguage } from '../core/types.js';
import { parseSource } from './tree-sitter-manager.js';

export function isRust(lang: SupportedLanguage): boolean {
  return lang === 'rust';
}

export async function parseRust(source: string, filePath: string): Promise<ParsedFile> {
  const tree = await parseSource('rust', source);
  return {
    path: filePath,
    language: 'rust',
    tree,
    content: source,
  };
}
