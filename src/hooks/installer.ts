import { join } from 'node:path';
import { readFile, writeFile, mkdir, access, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';
import { getGitRoot } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { PRE_COMMIT_SCRIPT } from './pre-commit-script.js';

export interface InstallResult {
  method: 'direct' | 'husky';
  path: string;
  created: boolean;
}

export async function installHook(cwd: string): Promise<InstallResult> {
  const gitRoot = await getGitRoot(cwd);

  // Check for husky
  const huskyResult = await tryInstallHusky(gitRoot);
  if (huskyResult) return huskyResult;

  // Fall back to direct git hook
  return installDirectHook(gitRoot);
}

async function tryInstallHusky(gitRoot: string): Promise<InstallResult | null> {
  // Check for .husky directory
  const huskyDir = join(gitRoot, '.husky');
  try {
    await access(huskyDir, constants.F_OK);
  } catch {
    return null;
  }

  const hookPath = join(huskyDir, 'pre-commit');
  const archguardLine = 'npx archguard check';

  try {
    const existing = await readFile(hookPath, 'utf-8');
    if (existing.includes('archguard')) {
      logger.info('archguard already in husky pre-commit hook');
      return { method: 'husky', path: hookPath, created: false };
    }
    // Append to existing hook
    await writeFile(hookPath, existing.trimEnd() + '\n' + archguardLine + '\n');
    return { method: 'husky', path: hookPath, created: true };
  } catch {
    // Create new hook file
    await writeFile(hookPath, `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${archguardLine}\n`);
    await chmod(hookPath, 0o755);
    return { method: 'husky', path: hookPath, created: true };
  }
}

async function installDirectHook(gitRoot: string): Promise<InstallResult> {
  const hooksDir = join(gitRoot, '.git', 'hooks');
  const hookPath = join(hooksDir, 'pre-commit');

  await mkdir(hooksDir, { recursive: true });

  try {
    const existing = await readFile(hookPath, 'utf-8');
    if (existing.includes('archguard')) {
      logger.info('archguard already in pre-commit hook');
      return { method: 'direct', path: hookPath, created: false };
    }
    // Append to existing hook
    await writeFile(hookPath, existing.trimEnd() + '\n\n# Architecture Guardian\n' + PRE_COMMIT_SCRIPT + '\n');
    return { method: 'direct', path: hookPath, created: true };
  } catch {
    // Create new hook
    await writeFile(hookPath, `#!/usr/bin/env sh\n\n# Architecture Guardian\n${PRE_COMMIT_SCRIPT}\n`);
    await chmod(hookPath, 0o755);
    return { method: 'direct', path: hookPath, created: true };
  }
}

export async function isHookInstalled(cwd: string): Promise<boolean> {
  try {
    const gitRoot = await getGitRoot(cwd);

    // Check husky
    try {
      const huskyHook = await readFile(join(gitRoot, '.husky', 'pre-commit'), 'utf-8');
      if (huskyHook.includes('archguard')) return true;
    } catch { /* not husky */ }

    // Check direct hook
    try {
      const directHook = await readFile(join(gitRoot, '.git', 'hooks', 'pre-commit'), 'utf-8');
      if (directHook.includes('archguard')) return true;
    } catch { /* no hook */ }

    return false;
  } catch {
    return false;
  }
}
