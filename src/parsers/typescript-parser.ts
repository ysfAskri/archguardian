import type { ParsedFile, SupportedLanguage } from '../core/types.js';
import { parseSource } from './tree-sitter-manager.js';

const TS_LANGUAGES: SupportedLanguage[] = ['typescript', 'tsx', 'javascript', 'jsx'];

export function isTypeScriptFamily(lang: SupportedLanguage): boolean {
  return TS_LANGUAGES.includes(lang);
}

export async function parseTypeScript(source: string, filePath: string, language: SupportedLanguage): Promise<ParsedFile> {
  const tree = await parseSource(language, source);
  return {
    path: filePath,
    language,
    tree,
    content: source,
  };
}
