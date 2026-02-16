import type { Analyzer, ArchGuardConfig } from '../core/types.js';
import { SecurityScanner } from '../analyzers/security-scanner.js';
import { AiSmellDetector } from '../analyzers/ai-smell-detector.js';
import { ConventionEnforcer } from '../analyzers/convention-enforcer.js';

export function createAnalyzers(config: ArchGuardConfig): Analyzer[] {
  const analyzers: Analyzer[] = [];

  if (config.analyzers.security.enabled) {
    analyzers.push(new SecurityScanner());
  }
  if (config.analyzers.aiSmells.enabled) {
    analyzers.push(new AiSmellDetector());
  }
  if (config.analyzers.conventions.enabled) {
    analyzers.push(new ConventionEnforcer());
  }

  return analyzers;
}
