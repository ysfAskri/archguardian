import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { checkCommand } from './commands/check.js';
import { scanCommand } from './commands/scan.js';
import { learnCommand } from './commands/learn.js';
import { rulesCommand } from './commands/rules.js';
import { metricsCommand } from './commands/metrics.js';
import { dashboardCommand } from './commands/dashboard.js';
import { fixCommand } from './commands/fix.js';
import { setLogLevel, LogLevel } from '../utils/logger.js';

const program = new Command();

program
  .name('archguardian')
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
  .description('Initialize archguardian: create config + install git hook')
  .option('--force', 'Overwrite existing config')
  .action(async (options) => {
    const code = await initCommand(options);
    process.exitCode = code;
  });

program
  .command('check')
  .description('Analyze staged changes (pre-commit mode)')
  .option('--format <format>', 'Output format (terminal, json, or sarif)', 'terminal')
  .action(async (options) => {
    const code = await checkCommand({ format: options.format });
    process.exitCode = code;
  });

program
  .command('scan')
  .description('Analyze the full project')
  .option('--format <format>', 'Output format (terminal, json, or sarif)', 'terminal')
  .action(async (options) => {
    const code = await scanCommand({ format: options.format });
    process.exitCode = code;
  });

program
  .command('learn')
  .description('Scan codebase and infer naming conventions statistically')
  .option('--apply', 'Write inferred conventions to .archguard.yml')
  .action(async (options) => {
    const code = await learnCommand(options);
    process.exitCode = code;
  });

program
  .command('rules')
  .description('List all available rules and their status')
  .option('--json', 'Output rules as JSON')
  .action(async (options) => {
    const code = await rulesCommand({ json: options.json });
    process.exitCode = code;
  });

program
  .command('metrics')
  .description('Show metrics from recent scan/check runs')
  .option('--json', 'Output metrics as JSON')
  .action(async (options) => {
    const code = await metricsCommand({ json: options.json });
    process.exitCode = code;
  });

program
  .command('dashboard')
  .description('Open web dashboard for metrics')
  .option('--port <port>', 'Port number', '3000')
  .action(async (options) => {
    const code = await dashboardCommand({ port: Number(options.port) });
    process.exitCode = code;
  });

program
  .command('fix')
  .description('Auto-fix simple findings')
  .option('--dry-run', 'Preview changes without applying')
  .option('--format <format>', 'Output format', 'terminal')
  .action(async (options) => {
    const code = await fixCommand({ dryRun: options.dryRun, format: options.format });
    process.exitCode = code;
  });

program.parse();
