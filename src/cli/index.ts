import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { checkCommand } from './commands/check.js';
import { scanCommand } from './commands/scan.js';
import { learnCommand } from './commands/learn.js';
import { setLogLevel, LogLevel } from '../utils/logger.js';

const program = new Command();

program
  .name('archguard')
  .description('Stop AI from slowly destroying your codebase.')
  .version('0.1.0')
  .option('--verbose', 'Enable debug logging')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      setLogLevel(LogLevel.Debug);
    }
  });

program
  .command('init')
  .description('Initialize archguard: create config + install git hook')
  .option('--force', 'Overwrite existing config')
  .action(async (options) => {
    const code = await initCommand(options);
    process.exitCode = code;
  });

program
  .command('check')
  .description('Analyze staged changes (pre-commit mode)')
  .action(async () => {
    const code = await checkCommand();
    process.exitCode = code;
  });

program
  .command('scan')
  .description('Analyze the full project')
  .action(async () => {
    const code = await scanCommand();
    process.exitCode = code;
  });

program
  .command('learn')
  .description('Scan codebase and infer conventions (v0.2.0)')
  .action(async () => {
    const code = await learnCommand();
    process.exitCode = code;
  });

program.parse();
