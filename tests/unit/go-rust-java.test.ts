import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/core/diff-parser.js';
import { isGo } from '../../src/parsers/go-parser.js';
import { isRust } from '../../src/parsers/rust-parser.js';
import { isJava } from '../../src/parsers/java-parser.js';
import type { SupportedLanguage } from '../../src/core/types.js';

describe('detectLanguage — Go, Rust, Java', () => {
  it('detects Go files', () => {
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('pkg/server/handler.go')).toBe('go');
  });

  it('detects Rust files', () => {
    expect(detectLanguage('src/main.rs')).toBe('rust');
    expect(detectLanguage('lib.rs')).toBe('rust');
  });

  it('detects Java files', () => {
    expect(detectLanguage('src/Main.java')).toBe('java');
    expect(detectLanguage('com/example/App.java')).toBe('java');
  });
});

describe('isGo', () => {
  it('returns true for go', () => {
    expect(isGo('go')).toBe(true);
  });

  it('returns false for other languages', () => {
    expect(isGo('rust')).toBe(false);
    expect(isGo('java')).toBe(false);
    expect(isGo('typescript')).toBe(false);
    expect(isGo('python')).toBe(false);
  });
});

describe('isRust', () => {
  it('returns true for rust', () => {
    expect(isRust('rust')).toBe(true);
  });

  it('returns false for other languages', () => {
    expect(isRust('go')).toBe(false);
    expect(isRust('java')).toBe(false);
    expect(isRust('typescript')).toBe(false);
    expect(isRust('python')).toBe(false);
  });
});

describe('isJava', () => {
  it('returns true for java', () => {
    expect(isJava('java')).toBe(true);
  });

  it('returns false for other languages', () => {
    expect(isJava('go')).toBe(false);
    expect(isJava('rust')).toBe(false);
    expect(isJava('typescript')).toBe(false);
    expect(isJava('python')).toBe(false);
  });
});

describe('SupportedLanguage type accepts new languages', () => {
  it('accepts go, rust, and java as valid SupportedLanguage values', () => {
    const go: SupportedLanguage = 'go';
    const rust: SupportedLanguage = 'rust';
    const java: SupportedLanguage = 'java';

    expect(go).toBe('go');
    expect(rust).toBe('rust');
    expect(java).toBe('java');
  });
});
