import type { SgNode, SgRoot } from '@ast-grep/napi';

// ── Severity & Exit Codes ──────────────────────────────────────────

export enum Severity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export enum ExitCode {
  Success = 0,
  ErrorsFound = 1,
  WarningsExceeded = 2,
  ConfigError = 3,
  Timeout = 5,
}

// ── File & Diff Types ──────────────────────────────────────────────

export interface LineChange {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'context';
}

export interface HunkInfo {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: LineChange[];
}

export interface FileInfo {
  path: string;
  language: SupportedLanguage | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: HunkInfo[];
  addedLines: LineChange[];
  removedLines: LineChange[];
  content?: string;
}

export type SupportedLanguage = 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'python' | 'go' | 'rust' | 'java';

// ── AST Types ──────────────────────────────────────────────────────

export interface ParsedFile {
  path: string;
  language: SupportedLanguage;
  tree: SgRoot;
  content: string;
}

// ── Finding / Violation ────────────────────────────────────────────

export interface Finding {
  ruleId: string;
  analyzer: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  codeSnippet?: string;
  suggestion?: string;
}

// ── Analyzer Types ─────────────────────────────────────────────────

export interface AnalyzerResult {
  analyzer: string;
  findings: Finding[];
  duration: number;
  error?: string;
}

export interface AnalysisContext {
  files: FileInfo[];
  parsedFiles: ParsedFile[];
  config: ArchGuardConfig;
  projectRoot: string;
}

export interface AnalysisSummary {
  totalFiles: number;
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  analyzerResults: AnalyzerResult[];
  duration: number;
  suppressedCount?: number;
  baselineSuppressedCount?: number;
}

// ── Analyzer Interface ─────────────────────────────────────────────

export interface Analyzer {
  name: string;
  analyze(context: AnalysisContext): Promise<Finding[]>;
}

// ── Rule Types ─────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  analyzer: string;
  check(node: SgNode, file: ParsedFile): Finding[];
}

// ── Config Types ───────────────────────────────────────────────────

export type NamingConvention = 'camelCase' | 'PascalCase' | 'snake_case' | 'UPPER_SNAKE' | 'kebab-case';

export interface SecurityConfig {
  enabled: boolean;
  severity: Severity;
  customPatterns?: Array<{ name: string; pattern: string; severity: Severity }>;
}

export interface AiSmellsConfig {
  enabled: boolean;
  severity: Severity;
  commentRatio: number;
}

export interface ConventionsConfig {
  enabled: boolean;
  severity: Severity;
  naming: {
    functions: NamingConvention;
    classes: NamingConvention;
    constants: NamingConvention;
    files: NamingConvention;
  };
  autoLearn: boolean;
}

export interface DuplicatesConfig {
  enabled: boolean;
  severity: Severity;
  similarity: number;
}

export interface ArchitectureLayer {
  name: string;
  patterns: string[];
}

export interface ArchitectureRule {
  from: string;
  allow?: string[];
  deny?: string[];
}

export interface ArchitectureConfig {
  enabled: boolean;
  severity: Severity;
  layers: ArchitectureLayer[];
  rules: ArchitectureRule[];
}

export interface LlmConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'gemini';
  model?: string;
  apiKey?: string;
}

export interface SeverityConfig {
  failOn: Severity;
  maxWarnings: number;
}

export interface ArchGuardConfig {
  version: number;
  languages: SupportedLanguage[];
  include: string[];
  exclude: string[];
  plugins: string[];
  severity: SeverityConfig;
  analyzers: {
    security: SecurityConfig;
    aiSmells: AiSmellsConfig;
    conventions: ConventionsConfig;
    duplicates: DuplicatesConfig;
    architecture: ArchitectureConfig;
  };
  llm: LlmConfig;
}
