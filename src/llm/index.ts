import type { AnalysisContext, Finding } from '../core/types.js';
import { createLlmClient } from './client.js';
import { LlmCache, buildCacheKey } from './cache.js';
import { logger } from '../utils/logger.js';

/**
 * Enhance findings with LLM-generated fix suggestions.
 * Only runs when `context.config.llm.enabled` is true.
 * Never throws — failures are logged and skipped.
 */
export async function enhanceWithLlmSuggestions(
  findings: Finding[],
  context: AnalysisContext,
): Promise<Finding[]> {
  if (!context.config.llm.enabled) {
    return findings;
  }

  const llmConfig = context.config.llm;
  const client = createLlmClient(llmConfig);
  const cache = new LlmCache();

  cache.loadFromDisk(context.projectRoot);

  logger.debug(`LLM: Enhancing ${findings.length} findings with suggestions`);

  for (const finding of findings) {
    // Skip if a suggestion already exists
    if (finding.suggestion) continue;

    const codeSnippet = finding.codeSnippet ?? '';
    const cacheKey = buildCacheKey(finding.ruleId, finding.file, finding.line, codeSnippet);

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      finding.suggestion = cached;
      continue;
    }

    // Call LLM
    try {
      const suggestion = await client.suggest(finding, codeSnippet);
      if (suggestion) {
        finding.suggestion = suggestion;
        cache.set(cacheKey, suggestion);
      }
    } catch (err) {
      logger.warn(`LLM: Failed to get suggestion for ${finding.ruleId} at ${finding.file}:${finding.line} — ${(err as Error).message}`);
    }
  }

  cache.saveToDisk(context.projectRoot);

  return findings;
}
