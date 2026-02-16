import chalk from 'chalk';
import { ExitCode } from '../../core/types.js';

export async function learnCommand(): Promise<number> {
  console.log('');
  console.log(chalk.yellow('  archguardian learn is coming in v0.2.0'));
  console.log(chalk.gray('  This command will scan your codebase and infer naming conventions,'));
  console.log(chalk.gray('  import patterns, and architecture boundaries statistically.'));
  console.log('');
  return ExitCode.Success;
}
