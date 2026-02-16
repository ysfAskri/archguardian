import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import { Severity } from '../../src/core/types.js';

describe('config-loader', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has correct default values', () => {
      expect(DEFAULT_CONFIG.version).toBe(1);
      expect(DEFAULT_CONFIG.languages).toContain('typescript');
      expect(DEFAULT_CONFIG.languages).toContain('javascript');
    });

    it('enables security analyzer by default', () => {
      expect(DEFAULT_CONFIG.analyzers.security.enabled).toBe(true);
      expect(DEFAULT_CONFIG.analyzers.security.severity).toBe(Severity.Error);
    });

    it('enables AI smell analyzer by default', () => {
      expect(DEFAULT_CONFIG.analyzers.aiSmells.enabled).toBe(true);
      expect(DEFAULT_CONFIG.analyzers.aiSmells.severity).toBe(Severity.Warning);
      expect(DEFAULT_CONFIG.analyzers.aiSmells.commentRatio).toBe(0.4);
    });

    it('enables conventions analyzer by default', () => {
      expect(DEFAULT_CONFIG.analyzers.conventions.enabled).toBe(true);
      expect(DEFAULT_CONFIG.analyzers.conventions.naming.functions).toBe('camelCase');
      expect(DEFAULT_CONFIG.analyzers.conventions.naming.classes).toBe('PascalCase');
    });

    it('disables duplicates and architecture by default', () => {
      expect(DEFAULT_CONFIG.analyzers.duplicates.enabled).toBe(false);
      expect(DEFAULT_CONFIG.analyzers.architecture.enabled).toBe(false);
    });

    it('disables LLM by default', () => {
      expect(DEFAULT_CONFIG.llm.enabled).toBe(false);
    });

    it('has severity failOn error by default', () => {
      expect(DEFAULT_CONFIG.severity.failOn).toBe(Severity.Error);
      expect(DEFAULT_CONFIG.severity.maxWarnings).toBe(20);
    });
  });
});
