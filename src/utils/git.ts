import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function getStagedDiff(cwd: string): Promise<string> {
  const { stdout } = await exec('git', ['diff', '--cached', '--unified=3'], { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export async function getStagedFiles(cwd: string): Promise<string[]> {
  const { stdout } = await exec('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd });
  return stdout.trim().split('\n').filter(Boolean);
}

export async function getFileContent(cwd: string, filePath: string): Promise<string> {
  try {
    // Try to get the staged version first
    const { stdout } = await exec('git', ['show', `:${filePath}`], { cwd, maxBuffer: 5 * 1024 * 1024 });
    return stdout;
  } catch {
    // Fall back to reading from working tree
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    return readFile(join(cwd, filePath), 'utf-8');
  }
}

export async function getFullDiff(cwd: string): Promise<string> {
  const { stdout } = await exec('git', ['diff', 'HEAD', '--unified=3'], { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function getGitRoot(cwd: string): Promise<string> {
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel'], { cwd });
  return stdout.trim();
}

export async function getAllTrackedFiles(cwd: string): Promise<string[]> {
  const { stdout } = await exec('git', ['ls-files'], { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim().split('\n').filter(Boolean);
}
