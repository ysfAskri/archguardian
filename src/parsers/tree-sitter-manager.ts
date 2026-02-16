import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Parser from 'web-tree-sitter';
import type { SupportedLanguage } from '../core/types.js';
import { logger } from '../utils/logger.js';

let TreeSitter: typeof Parser | null = null;
let initialized = false;
const languageCache = new Map<string, Parser.Language>();
const parserPool = new Map<string, Parser>();

const GRAMMAR_FILES: Record<string, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  jsx: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',
};

async function ensureInit(): Promise<typeof Parser> {
  if (TreeSitter && initialized) return TreeSitter;

  const mod = await import('web-tree-sitter');
  TreeSitter = mod.default;
  await TreeSitter.init();
  initialized = true;
  return TreeSitter;
}

function getWasmDir(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    return join(dirname(thisFile), '..', '..', 'wasm');
  } catch {
    return join(process.cwd(), 'wasm');
  }
}

async function loadLanguage(lang: string): Promise<Parser.Language> {
  const cached = languageCache.get(lang);
  if (cached) return cached;

  const TS = await ensureInit();
  const grammarFile = GRAMMAR_FILES[lang];
  if (!grammarFile) {
    throw new Error(`No grammar available for language: ${lang}`);
  }

  const wasmPath = join(getWasmDir(), grammarFile);
  logger.debug(`Loading grammar: ${wasmPath}`);

  const language = await TS.Language.load(wasmPath);
  languageCache.set(lang, language);
  return language;
}

export async function getParser(lang: SupportedLanguage): Promise<Parser> {
  const key = lang === 'jsx' ? 'javascript' : lang;
  const cached = parserPool.get(key);
  if (cached) return cached;

  const TS = await ensureInit();
  const parser = new TS();
  const language = await loadLanguage(key);
  parser.setLanguage(language);
  parserPool.set(key, parser);
  return parser;
}

export async function parseSource(lang: SupportedLanguage, source: string) {
  const parser = await getParser(lang);
  return parser.parse(source);
}

export function isTreeSitterAvailable(lang: SupportedLanguage): boolean {
  return lang in GRAMMAR_FILES;
}

export function clearCache(): void {
  parserPool.clear();
  languageCache.clear();
}
