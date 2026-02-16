import chalk from 'chalk';

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  Silent = 4,
}

let currentLevel = LogLevel.Info;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.Debug) {
      console.error(chalk.gray(`[debug] ${msg}`), ...args);
    }
  },
  info(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.Info) {
      console.error(chalk.blue(`[info] ${msg}`), ...args);
    }
  },
  warn(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.Warn) {
      console.error(chalk.yellow(`[warn] ${msg}`), ...args);
    }
  },
  error(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.Error) {
      console.error(chalk.red(`[error] ${msg}`), ...args);
    }
  },
};
