import type { Finding, LlmConfig } from '../core/types.js';
import { buildPrompt } from './prompts.js';
import { logger } from '../utils/logger.js';

const REQUEST_TIMEOUT_MS = 10_000;

export interface LlmClient {
  suggest(finding: Finding, codeSnippet: string): Promise<string | null>;
}

/**
 * Create an LLM client based on the provider in config.
 * Supports OpenAI and Anthropic APIs.
 */
export function createLlmClient(config: LlmConfig): LlmClient {
  const provider = config.provider;

  if (provider === 'anthropic') {
    return createAnthropicClient(config);
  }

  if (provider === 'gemini') {
    return createGeminiClient(config);
  }

  // Default to OpenAI
  return createOpenAiClient(config);
}

function resolveApiKey(config: LlmConfig): string | null {
  if (config.apiKey) return config.apiKey;

  if (config.provider === 'anthropic') {
    return process.env['ANTHROPIC_API_KEY'] ?? null;
  }

  if (config.provider === 'gemini') {
    return process.env['GEMINI_API_KEY'] ?? null;
  }

  return process.env['OPENAI_API_KEY'] ?? null;
}

function createOpenAiClient(config: LlmConfig): LlmClient {
  const model = config.model ?? 'gpt-4o-mini';

  return {
    async suggest(finding: Finding, codeSnippet: string): Promise<string | null> {
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        logger.warn('LLM: No OpenAI API key found (set apiKey in config or OPENAI_API_KEY env var)');
        return null;
      }

      const prompt = buildPrompt(finding, codeSnippet);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 256,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          logger.warn(`LLM: OpenAI API returned ${response.status}`);
          return null;
        }

        const data = await response.json() as OpenAiResponse;
        const content = data.choices?.[0]?.message?.content?.trim() ?? null;
        return content || null;
      } catch (err) {
        logger.warn(`LLM: OpenAI request failed — ${(err as Error).message}`);
        return null;
      }
    },
  };
}

function createAnthropicClient(config: LlmConfig): LlmClient {
  const model = config.model ?? 'claude-sonnet-4-20250514';

  return {
    async suggest(finding: Finding, codeSnippet: string): Promise<string | null> {
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        logger.warn('LLM: No Anthropic API key found (set apiKey in config or ANTHROPIC_API_KEY env var)');
        return null;
      }

      const prompt = buildPrompt(finding, codeSnippet);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          logger.warn(`LLM: Anthropic API returned ${response.status}`);
          return null;
        }

        const data = await response.json() as AnthropicResponse;
        const textBlock = data.content?.find(block => block.type === 'text');
        const content = textBlock?.text?.trim() ?? null;
        return content || null;
      } catch (err) {
        logger.warn(`LLM: Anthropic request failed — ${(err as Error).message}`);
        return null;
      }
    },
  };
}

function createGeminiClient(config: LlmConfig): LlmClient {
  const model = config.model ?? 'gemini-2.5-flash';

  return {
    async suggest(finding: Finding, codeSnippet: string): Promise<string | null> {
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        logger.warn('LLM: No Gemini API key found (set apiKey in config or GEMINI_API_KEY env var)');
        return null;
      }

      const prompt = buildPrompt(finding, codeSnippet);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          logger.warn(`LLM: Gemini API returned ${response.status}`);
          return null;
        }

        const data = await response.json() as GeminiResponse;
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
        return content || null;
      } catch (err) {
        logger.warn(`LLM: Gemini request failed — ${(err as Error).message}`);
        return null;
      }
    },
  };
}

// ── Response type shapes (minimal, for safe parsing) ──────────────────

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface AnthropicResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}
