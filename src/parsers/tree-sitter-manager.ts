import { parse, registerDynamicLanguage, type SgRoot } from '@ast-grep/napi';
import python from '@ast-grep/lang-python';
import go from '@ast-grep/lang-go';
import rust from '@ast-grep/lang-rust';
import java from '@ast-grep/lang-java';
import type { SupportedLanguage } from '../core/types.js';
import { logger } from '../utils/logger.js';

registerDynamicLanguage({ python, go, rust, java });

const LANG_MAP: Record<string, string> = {
  typescript: 'TypeScript',
  tsx: 'Tsx',
  javascript: 'JavaScript',
  jsx: 'JavaScript',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
};

export function parseSource(lang: SupportedLanguage, source: string): SgRoot {
  const langId = LANG_MAP[lang];
  if (!langId) {
    throw new Error(`No grammar available for language: ${lang}`);
  }
  logger.debug(`Parsing with ast-grep: ${langId}`);
  return parse(langId as any, source);
}

export function isTreeSitterAvailable(lang: SupportedLanguage): boolean {
  return lang in LANG_MAP;
}

export function clearCache(): void {
  // No cache needed — ast-grep NAPI uses native bindings
}
