import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';
import chalk from 'chalk';
import { generateDefaultConfig } from '../../core/config-loader.js';
import { installHook } from '../../hooks/installer.js';
import { isGitRepo } from '../../utils/git.js';
import { ExitCode } from '../../core/types.js';

export async function initCommand(options: { force?: boolean }): Promise<number> {
  const cwd = process.cwd();

  console.log('');
  console.log(chalk.bold(' Architecture Guardian — Init'));
  console.log(chalk.gray('─'.repeat(40)));

  // Check if git repo
  if (!await isGitRepo(cwd)) {
    console.log(chalk.red('  Not a git repository. Please run this from a git project root.'));
    return ExitCode.ConfigError;
  }

  // Create config file
  const configPath = join(cwd, '.archguard.yml');
  let configCreated = false;

  try {
    await access(configPath, constants.F_OK);
    if (options.force) {
      await writeFile(configPath, generateDefaultConfig());
      configCreated = true;
      console.log(chalk.yellow('  Overwrote existing .archguard.yml'));
    } else {
      console.log(chalk.gray('  .archguard.yml already exists (use --force to overwrite)'));
    }
  } catch {
    await writeFile(configPath, generateDefaultConfig());
    configCreated = true;
    console.log(chalk.green('  Created .archguard.yml'));
  }

  // Install git hook
  try {
    const result = await installHook(cwd);
    if (result.created) {
      console.log(chalk.green(`  Installed pre-commit hook (${result.method})`));
    } else {
      console.log(chalk.gray(`  Pre-commit hook already installed (${result.method})`));
    }
  } catch (err) {
    console.log(chalk.yellow(`  Could not install pre-commit hook: ${(err as Error).message}`));
    console.log(chalk.gray('  You can manually add "npx archguard check" to your pre-commit hook'));
  }

  console.log('');
  console.log(chalk.green('  Done! Run ') + chalk.cyan('archguard scan') + chalk.green(' to check your project.'));
  console.log('');

  return ExitCode.Success;
}
