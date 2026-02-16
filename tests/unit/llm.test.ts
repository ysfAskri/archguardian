import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPrompt } from '../../src/llm/prompts.js';
import { LlmCache, buildCacheKey } from '../../src/llm/cache.js';
import { enhanceWithLlmSuggestions } from '../../src/llm/index.js';
import { Severity, type Finding, type AnalysisContext, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test/rule',
    analyzer: 'security',
    severity: Severity.Warning,
    message: 'Test finding',
    file: 'test.ts',
    line: 1,
    codeSnippet: 'const x = eval("code");',
    ...overrides,
  };
}

function makeContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    files: [],
    parsedFiles: [],
    config: DEFAULT_CONFIG,
    projectRoot: '/tmp/test-project',
    ...overrides,
  };
}

function makeConfig(llmOverrides: Partial<ArchGuardConfig['llm']> = {}): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    llm: {
      ...DEFAULT_CONFIG.llm,
      ...llmOverrides,
    },
  };
}

// ── buildPrompt tests ──────────────────────────────────────────────

describe('buildPrompt', () => {
  const snippet = 'const password = "hardcoded";';

  it('generates a security-specific prompt for security analyzer', () => {
    const finding = makeFinding({ analyzer: 'security', ruleId: 'sec/hardcoded-secret' });
    const prompt = buildPrompt(finding, snippet);

    expect(prompt).toContain('security expert');
    expect(prompt).toContain('sec/hardcoded-secret');
    expect(prompt).toContain(snippet);
    expect(prompt).toContain('1-3 lines');
  });

  it('generates an AI-smell-specific prompt for ai-smells analyzer', () => {
    const finding = makeFinding({ analyzer: 'ai-smells', ruleId: 'ai/excessive-comments' });
    const prompt = buildPrompt(finding, snippet);

    expect(prompt).toContain('AI-generated code smell');
    expect(prompt).toContain('ai/excessive-comments');
    expect(prompt).toContain(snippet);
  });

  it('generates a conventions-specific prompt for conventions analyzer', () => {
    const finding = makeFinding({ analyzer: 'conventions', ruleId: 'conv/naming' });
    const prompt = buildPrompt(finding, snippet);

    expect(prompt).toContain('convention');
    expect(prompt).toContain('conv/naming');
  });

  it('generates an architecture-specific prompt for architecture analyzer', () => {
    const finding = makeFinding({ analyzer: 'architecture', ruleId: 'arch/layer-violation' });
    const prompt = buildPrompt(finding, snippet);

    expect(prompt).toContain('architect');
    expect(prompt).toContain('arch/layer-violation');
  });

  it('falls back to a generic prompt for unknown analyzers', () => {
    const finding = makeFinding({ analyzer: 'custom-plugin', ruleId: 'custom/rule' });
    const prompt = buildPrompt(finding, snippet);

    expect(prompt).toContain('code review expert');
    expect(prompt).toContain('custom/rule');
    expect(prompt).toContain('custom-plugin');
  });

  it('produces different prompts for different analyzer types', () => {
    const secPrompt = buildPrompt(makeFinding({ analyzer: 'security' }), snippet);
    const aiPrompt = buildPrompt(makeFinding({ analyzer: 'ai-smells' }), snippet);
    const convPrompt = buildPrompt(makeFinding({ analyzer: 'conventions' }), snippet);
    const archPrompt = buildPrompt(makeFinding({ analyzer: 'architecture' }), snippet);

    const prompts = [secPrompt, aiPrompt, convPrompt, archPrompt];
    const unique = new Set(prompts);
    expect(unique.size).toBe(4);
  });
});

// ── LlmCache tests ─────────────────────────────────────────────────

describe('LlmCache', () => {
  let cache: LlmCache;

  beforeEach(() => {
    cache = new LlmCache();
  });

  it('returns null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('overwrites existing keys', () => {
    cache.set('key1', 'value1');
    cache.set('key1', 'value2');
    expect(cache.get('key1')).toBe('value2');
    expect(cache.size).toBe(1);
  });

  it('evicts least-recently-used entry when at capacity', () => {
    // Fill cache to 200 entries
    for (let i = 0; i < 200; i++) {
      cache.set(`key-${i}`, `value-${i}`);
    }
    expect(cache.size).toBe(200);

    // Access key-0 to make it recently used
    cache.get('key-0');

    // Add one more — should evict key-1 (oldest untouched)
    cache.set('key-200', 'value-200');
    expect(cache.size).toBe(200);

    // key-0 should still exist (it was accessed)
    expect(cache.get('key-0')).toBe('value-0');
    // key-200 should exist
    expect(cache.get('key-200')).toBe('value-200');
    // key-1 should have been evicted (oldest not accessed after initial set)
    expect(cache.get('key-1')).toBeNull();
  });

  it('buildCacheKey produces consistent hashes', () => {
    const a = buildCacheKey('rule1', 'file.ts', 10, 'code');
    const b = buildCacheKey('rule1', 'file.ts', 10, 'code');
    expect(a).toBe(b);
  });

  it('buildCacheKey produces different hashes for different inputs', () => {
    const a = buildCacheKey('rule1', 'file.ts', 10, 'code');
    const b = buildCacheKey('rule2', 'file.ts', 10, 'code');
    const c = buildCacheKey('rule1', 'other.ts', 10, 'code');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

// ── enhanceWithLlmSuggestions tests ─────────────────────────────────

describe('enhanceWithLlmSuggestions', () => {
  let testProjectRoot: string;
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
    testProjectRoot = join(tmpdir(), `archguard-llm-test-${Date.now()}-${testCounter}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      rmSync(testProjectRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures
    }
  });

  it('skips enhancement when LLM is disabled', async () => {
    const findings = [makeFinding()];
    const context = makeContext({
      config: makeConfig({ enabled: false }),
      projectRoot: testProjectRoot,
    });

    const result = await enhanceWithLlmSuggestions(findings, context);

    expect(result).toHaveLength(1);
    expect(result[0].suggestion).toBeUndefined();
  });

  it('preserves existing suggestions', async () => {
    const findings = [makeFinding({ suggestion: 'existing fix' })];
    const context = makeContext({
      config: makeConfig({ enabled: true, provider: 'openai', apiKey: 'test-key' }),
      projectRoot: testProjectRoot,
    });

    // Mock fetch to ensure it's not called for findings with existing suggestions
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'new suggestion' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await enhanceWithLlmSuggestions(findings, context);

    expect(result[0].suggestion).toBe('existing fix');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('adds suggestion from LLM when enabled and no existing suggestion', async () => {
    const findings = [makeFinding({ suggestion: undefined })];
    const context = makeContext({
      config: makeConfig({ enabled: true, provider: 'openai', apiKey: 'test-key' }),
      projectRoot: testProjectRoot,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Use environment variable instead' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await enhanceWithLlmSuggestions(findings, context);

    expect(result[0].suggestion).toBe('Use environment variable instead');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles LLM API failure gracefully', async () => {
    const findings = [makeFinding()];
    const context = makeContext({
      config: makeConfig({ enabled: true, provider: 'openai', apiKey: 'test-key' }),
      projectRoot: testProjectRoot,
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await enhanceWithLlmSuggestions(findings, context);

    // Should not throw, finding should have no suggestion
    expect(result).toHaveLength(1);
    expect(result[0].suggestion).toBeUndefined();
  });

  it('handles LLM returning non-OK status gracefully', async () => {
    const findings = [makeFinding()];
    const context = makeContext({
      config: makeConfig({ enabled: true, provider: 'openai', apiKey: 'test-key' }),
      projectRoot: testProjectRoot,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', { status: 429 }),
    );

    const result = await enhanceWithLlmSuggestions(findings, context);

    expect(result).toHaveLength(1);
    expect(result[0].suggestion).toBeUndefined();
  });

  it('uses Anthropic provider when configured', async () => {
    const findings = [makeFinding()];
    const context = makeContext({
      config: makeConfig({ enabled: true, provider: 'anthropic', apiKey: 'test-key' }),
      projectRoot: testProjectRoot,
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'Fix suggestion from Claude' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await enhanceWithLlmSuggestions(findings, context);

    expect(result[0].suggestion).toBe('Fix suggestion from Claude');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify the request went to Anthropic endpoint
    const callUrl = (fetchSpy.mock.calls[0][0] as string);
    expect(callUrl).toContain('anthropic.com');
  });
});
