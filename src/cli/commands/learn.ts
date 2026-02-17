import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import chalk from 'chalk';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { SgRoot } from '@ast-grep/napi';
import { ExitCode } from '../../core/types.js';
import type { NamingConvention, SupportedLanguage } from '../../core/types.js';
import { isGitRepo, getGitRoot, getAllTrackedFiles } from '../../utils/git.js';
import { parseSource } from '../../parsers/tree-sitter-manager.js';
import { walk } from '../../parsers/ast-utils.js';
import { detectLanguage } from '../../core/diff-parser.js';

// ── Convention Patterns ──────────────────────────────────────────────

const CONVENTION_PATTERNS: Record<NamingConvention, RegExp> = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  UPPER_SNAKE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
};

type Category = 'functions' | 'classes' | 'constants' | 'files';

interface CategoryResult {
  convention: NamingConvention;
  confidence: number;
  total: number;
  samples: string[];
  counts: Record<NamingConvention, number>;
}

// ── Convention Detection ─────────────────────────────────────────────

function classifyName(name: string): NamingConvention | null {
  for (const [convention, pattern] of Object.entries(CONVENTION_PATTERNS)) {
    if (pattern.test(name)) {
      return convention as NamingConvention;
    }
  }
  return null;
}

function inferConvention(names: string[]): CategoryResult | null {
  if (names.length === 0) return null;

  const counts: Record<NamingConvention, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    UPPER_SNAKE: 0,
    'kebab-case': 0,
  };

  const samplesByConvention: Record<string, string[]> = {};

  for (const name of names) {
    const convention = classifyName(name);
    if (convention) {
      counts[convention]++;
      if (!samplesByConvention[convention]) {
        samplesByConvention[convention] = [];
      }
      if (samplesByConvention[convention].length < 5) {
        samplesByConvention[convention].push(name);
      }
    }
  }

  // Find the dominant convention
  let best: NamingConvention = 'camelCase';
  let bestCount = 0;
  for (const [convention, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = convention as NamingConvention;
    }
  }

  if (bestCount === 0) return null;

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const confidence = totalClassified > 0 ? (bestCount / totalClassified) * 100 : 0;

  return {
    convention: best,
    confidence,
    total: totalClassified,
    samples: samplesByConvention[best] ?? [],
    counts,
  };
}

// ── AST Name Extraction ──────────────────────────────────────────────

const TS_JS_LANGUAGES: SupportedLanguage[] = ['typescript', 'tsx', 'javascript', 'jsx'];

function isAllUpperAndUnderscores(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

interface ExtractedNames {
  functions: string[];
  classes: string[];
  constants: string[];
}

function extractNames(tree: SgRoot): ExtractedNames {
  const functions: string[] = [];
  const classes: string[] = [];
  const constants: string[] = [];

  walk(tree.root(), (node) => {
    // Function declarations: function foo() {}
    if (node.kind() === 'function_declaration') {
      const nameNode = node.field('name');
      if (nameNode) {
        functions.push(nameNode.text());
      }
    }

    // Method definitions inside classes: method() {}
    if (node.kind() === 'method_definition') {
      const nameNode = node.field('name');
      if (nameNode && nameNode.text() !== 'constructor') {
        functions.push(nameNode.text());
      }
    }

    // Arrow functions assigned to variables: const foo = () => {}
    // Also handles: const foo = function() {}
    if (node.kind() === 'variable_declarator') {
      const nameNode = node.field('name');
      const valueNode = node.field('value');
      if (nameNode && valueNode) {
        const valType = valueNode.kind();
        if (valType === 'arrow_function' || valType === 'function' || valType === 'function_expression') {
          functions.push(nameNode.text());
          return; // Don't also classify as constant
        }
      }
    }

    // Class declarations: class Foo {}
    if (node.kind() === 'class_declaration') {
      const nameNode = node.field('name');
      if (nameNode) {
        classes.push(nameNode.text());
      }
    }

    // Constants: const FOO_BAR = ... (non-function values in const declarations)
    if (node.kind() === 'lexical_declaration') {
      const declarationKeyword = node.child(0);
      if (declarationKeyword && declarationKeyword.text() === 'const') {
        for (const child of node.children()) {
          if (child.kind() === 'variable_declarator') {
            const nameNode = child.field('name');
            const valueNode = child.field('value');
            if (nameNode && valueNode) {
              const valType = valueNode.kind();
              // Skip arrow functions and function expressions — those are in functions category
              if (valType === 'arrow_function' || valType === 'function' || valType === 'function_expression') {
                continue;
              }
              // Only include if it looks like a constant (UPPER_SNAKE) or if we want to collect all
              // We collect all const names so the statistics can determine the convention
              const name = nameNode.text();
              // Filter to only collect names that are truly "constant-like":
              // UPPER_SNAKE or single-word uppercase identifiers
              if (isAllUpperAndUnderscores(name)) {
                constants.push(name);
              }
            }
          }
        }
      }
    }

    // Export default class
    if (node.kind() === 'export_statement') {
      for (const child of node.children()) {
        if (child.kind() === 'class_declaration') {
          const nameNode = child.field('name');
          if (nameNode) {
            classes.push(nameNode.text());
          }
        }
      }
    }
  });

  return { functions, classes, constants };
}

// ── File Name Extraction ─────────────────────────────────────────────

function extractFileBaseName(filePath: string): string {
  let name = basename(filePath);
  // Remove all extensions (e.g., foo.test.ts -> foo)
  const firstDot = name.indexOf('.');
  if (firstDot > 0) {
    name = name.substring(0, firstDot);
  }
  return name;
}

// ── Table Formatting ─────────────────────────────────────────────────

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function formatTable(results: Record<Category, CategoryResult | null>): string {
  const lines: string[] = [];

  const catWidth = 12;
  const convWidth = 14;
  const confWidth = 12;
  const countWidth = 8;
  const sampleWidth = 50;

  const divider = chalk.gray('  ' + '-'.repeat(catWidth + convWidth + confWidth + countWidth + sampleWidth + 12));

  lines.push('');
  lines.push(chalk.bold('  Inferred Naming Conventions'));
  lines.push('');
  lines.push(
    chalk.gray('  ') +
    chalk.bold(padRight('Category', catWidth)) + '  ' +
    chalk.bold(padRight('Convention', convWidth)) + '  ' +
    chalk.bold(padRight('Confidence', confWidth)) + '  ' +
    chalk.bold(padRight('Count', countWidth)) + '  ' +
    chalk.bold('Samples')
  );
  lines.push(divider);

  const categories: Category[] = ['functions', 'classes', 'constants', 'files'];

  for (const cat of categories) {
    const result = results[cat];
    if (!result) {
      lines.push(
        chalk.gray('  ') +
        padRight(cat, catWidth) + '  ' +
        chalk.gray(padRight('(no data)', convWidth)) + '  ' +
        chalk.gray(padRight('-', confWidth)) + '  ' +
        chalk.gray(padRight('-', countWidth)) + '  ' +
        chalk.gray('-')
      );
      continue;
    }

    const confidenceStr = result.confidence.toFixed(1) + '%';
    const confidenceColor = result.confidence >= 80 ? chalk.green : result.confidence >= 60 ? chalk.yellow : chalk.red;
    const samplesStr = result.samples.slice(0, 3).join(', ');

    lines.push(
      chalk.gray('  ') +
      chalk.white(padRight(cat, catWidth)) + '  ' +
      chalk.cyan(padRight(result.convention, convWidth)) + '  ' +
      confidenceColor(padRight(confidenceStr, confWidth)) + '  ' +
      chalk.white(padRight(String(result.total), countWidth)) + '  ' +
      chalk.gray(samplesStr)
    );
  }

  lines.push(divider);
  lines.push('');

  return lines.join('\n');
}

// ── YAML Config Update ───────────────────────────────────────────────

async function updateConfigWithConventions(
  projectRoot: string,
  results: Record<Category, CategoryResult | null>,
): Promise<void> {
  const configPath = join(projectRoot, '.archguard.yml');

  let rawYaml: string;
  let config: Record<string, unknown>;
  try {
    rawYaml = await readFile(configPath, 'utf-8');
    config = parseYaml(rawYaml) as Record<string, unknown>;
  } catch {
    // If no config exists, create a minimal one
    config = {
      version: 1,
      analyzers: {
        conventions: {
          enabled: true,
          severity: 'warning',
          naming: {},
          autoLearn: false,
        },
      },
    };
  }

  // Ensure nested structure exists
  if (!config.analyzers || typeof config.analyzers !== 'object') {
    config.analyzers = {};
  }
  const analyzers = config.analyzers as Record<string, unknown>;

  if (!analyzers.conventions || typeof analyzers.conventions !== 'object') {
    analyzers.conventions = { enabled: true, severity: 'warning', autoLearn: false };
  }
  const conventions = analyzers.conventions as Record<string, unknown>;

  if (!conventions.naming || typeof conventions.naming !== 'object') {
    conventions.naming = {};
  }
  const naming = conventions.naming as Record<string, string>;

  // Update naming conventions from inferred results
  const categories: Category[] = ['functions', 'classes', 'constants', 'files'];
  for (const cat of categories) {
    const result = results[cat];
    if (result && result.confidence >= 50) {
      naming[cat] = result.convention;
    }
  }

  const updatedYaml = stringifyYaml(config, { lineWidth: 120 });
  await writeFile(configPath, updatedYaml, 'utf-8');
}

// ── Main Command ─────────────────────────────────────────────────────

export interface LearnOptions {
  apply?: boolean;
}

export async function learnCommand(options: LearnOptions = {}): Promise<number> {
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);

  console.log('');
  console.log(chalk.bold('  archguardian learn') + chalk.gray(' — scanning codebase to infer naming conventions...'));
  console.log('');

  // 1. Get all tracked files
  const allFiles = await getAllTrackedFiles(projectRoot);

  // Filter to TS/JS files
  const tsJsFiles = allFiles.filter((f) => {
    const lang = detectLanguage(f);
    return lang !== null && TS_JS_LANGUAGES.includes(lang);
  });

  if (tsJsFiles.length === 0) {
    console.log(chalk.gray('  No TypeScript/JavaScript files found in the repository.'));
    return ExitCode.Success;
  }

  console.log(chalk.gray(`  Found ${tsJsFiles.length} TypeScript/JavaScript files to analyze...`));

  // 2. Parse each file and extract names
  const allFunctions: string[] = [];
  const allClasses: string[] = [];
  const allConstants: string[] = [];
  const allFileNames: string[] = [];

  let parsed = 0;
  let errors = 0;

  for (const filePath of tsJsFiles) {
    const lang = detectLanguage(filePath) as SupportedLanguage;

    // Collect file name
    const fileBase = extractFileBaseName(filePath);
    if (fileBase.length > 0) {
      allFileNames.push(fileBase);
    }

    // Parse and extract AST names
    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      const tree = parseSource(lang, content);
      const names = extractNames(tree);

      allFunctions.push(...names.functions);
      allClasses.push(...names.classes);
      allConstants.push(...names.constants);
      parsed++;
    } catch {
      errors++;
      // Skip files that fail to parse
    }
  }

  console.log(chalk.gray(`  Parsed ${parsed} files (${errors} skipped due to errors)`));
  console.log(chalk.gray(`  Extracted: ${allFunctions.length} functions, ${allClasses.length} classes, ${allConstants.length} constants, ${allFileNames.length} file names`));

  // 4. Infer conventions for each category
  const results: Record<Category, CategoryResult | null> = {
    functions: inferConvention(allFunctions),
    classes: inferConvention(allClasses),
    constants: inferConvention(allConstants),
    files: inferConvention(allFileNames),
  };

  // 5. Show the table
  console.log(formatTable(results));

  // 6. If --apply, update config
  if (options.apply) {
    const hasAnyResult = Object.values(results).some((r) => r !== null && r.confidence >= 50);
    if (!hasAnyResult) {
      console.log(chalk.yellow('  No conventions inferred with sufficient confidence (>= 50%). Config not updated.'));
    } else {
      try {
        await updateConfigWithConventions(projectRoot, results);
        console.log(chalk.green('  Updated .archguard.yml with inferred naming conventions.'));
      } catch (err) {
        console.error(chalk.red(`  Failed to update config: ${(err as Error).message}`));
        return ExitCode.ConfigError;
      }
    }
  } else {
    console.log(chalk.gray('  Tip: Run with --apply to write inferred conventions to .archguard.yml'));
  }

  console.log('');
  return ExitCode.Success;
}
