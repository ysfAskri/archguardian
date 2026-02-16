import { writeFile, access, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { constants } from 'node:fs';
import chalk from 'chalk';
import { installHook } from '../../hooks/installer.js';
import { isGitRepo } from '../../utils/git.js';
import { ExitCode } from '../../core/types.js';

// ── Language detection ────────────────────────────────────────────

const EXT_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx',
  '.js': 'javascript', '.jsx': 'jsx',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

const LANG_LABELS: Record<string, string> = {
  typescript: 'TypeScript', tsx: 'TSX',
  javascript: 'JavaScript', jsx: 'JSX',
  python: 'Python', go: 'Go', rust: 'Rust', java: 'Java',
};

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next',
  'target', 'vendor', '__pycache__', '.venv', 'venv',
  'coverage', '.archguard',
]);

async function detectLanguages(root: string): Promise<string[]> {
  const found = new Set<string>();

  async function walk(dir: string, depth: number) {
    if (depth > 6) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(join(dir, entry.name), depth + 1);
        }
      } else {
        const lang = EXT_MAP[extname(entry.name)];
        if (lang) found.add(lang);
      }
      if (found.size >= 8) return;
    }
  }

  await walk(root, 0);
  return Array.from(found);
}

// ── Source directory detection ────────────────────────────────────

const COMMON_SRC_DIRS = ['src', 'lib', 'app', 'packages', 'cmd', 'internal', 'pkg'];

async function detectSourceDir(root: string): Promise<string> {
  for (const dir of COMMON_SRC_DIRS) {
    try {
      const s = await stat(join(root, dir));
      if (s.isDirectory()) return `${dir}/**`;
    } catch { /* not found */ }
  }
  return '**/*';
}

// ── Config generation ────────────────────────────────────────────

function generateConfig(languages: string[], includePattern: string): string {
  const langList = languages.length > 0
    ? languages.join(', ')
    : 'typescript, javascript';

  return `# Architecture Guardian — project config
# Docs: https://github.com/ysfAskri/archguardian
version: 1
languages: [${langList}]
include: ["${includePattern}"]
exclude: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "**/dist/**"]

severity:
  failOn: error
  maxWarnings: 20

analyzers:
  security:
    enabled: true
    severity: error
  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4
  conventions:
    enabled: true
    severity: warning
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
`;
}

// ── Init command ─────────────────────────────────────────────────

export async function initCommand(options: { force?: boolean }): Promise<number> {
  const cwd = process.cwd();

  console.log('');
  console.log(chalk.bold('  archguardian init'));
  console.log('');

  // Step 1: Git check
  if (!await isGitRepo(cwd)) {
    console.log(chalk.red('  This is not a git repository.'));
    console.log(chalk.gray('  Run this from your project root (where .git/ lives).'));
    console.log('');
    return ExitCode.ConfigError;
  }

  // Step 2: Auto-detect languages
  const languages = await detectLanguages(cwd);
  const srcDir = await detectSourceDir(cwd);

  if (languages.length > 0) {
    const names = languages.map(l => LANG_LABELS[l] || l).join(', ');
    console.log(chalk.green('  Detected ') + chalk.bold(names));
  } else {
    console.log(chalk.gray('  No source files detected — defaulting to TypeScript/JavaScript'));
  }

  // Step 3: Create config
  const configPath = join(cwd, '.archguard.yml');
  let configCreated = false;

  try {
    await access(configPath, constants.F_OK);
    if (options.force) {
      await writeFile(configPath, generateConfig(languages, srcDir));
      configCreated = true;
      console.log(chalk.yellow('  Overwrote .archguard.yml'));
    } else {
      console.log(chalk.gray('  .archguard.yml already exists (use --force to overwrite)'));
    }
  } catch {
    await writeFile(configPath, generateConfig(languages, srcDir));
    configCreated = true;
    console.log(chalk.green('  Created .archguard.yml'));
  }

  // Step 4: Install git hook
  try {
    const result = await installHook(cwd);
    if (result.created) {
      console.log(chalk.green('  Installed pre-commit hook') + chalk.gray(` (${result.method})`));
    } else {
      console.log(chalk.gray('  Pre-commit hook already installed'));
    }
  } catch (err) {
    console.log(chalk.yellow('  Could not install hook: ') + chalk.gray((err as Error).message));
  }

  // Step 5: Next steps
  console.log('');
  console.log(chalk.gray('  ─────────────────────────────'));
  console.log('');
  console.log('  ' + chalk.green('Ready!') + ' Next steps:');
  console.log('');
  console.log('    ' + chalk.cyan('archguardian scan') + '   — scan your project now');
  console.log('    ' + chalk.cyan('git commit') + '          — hook runs automatically');
  console.log('');

  return ExitCode.Success;
}
