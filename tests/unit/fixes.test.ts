import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Severity, type Finding } from '../../src/core/types.js';
import { RemoveUnusedImportFix } from '../../src/fixes/remove-unused-import.js';
import { RenameConventionFix, convertName } from '../../src/fixes/rename-convention.js';
import { applyFixes } from '../../src/fixes/index.js';

// ── Test helpers ─────────────────────────────────────────────────

let testDir: string;

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test/rule',
    analyzer: 'test',
    severity: Severity.Warning,
    message: 'Test finding',
    file: 'test.ts',
    line: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = join(tmpdir(), `archguard-fix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ── RemoveUnusedImportFix ────────────────────────────────────────

describe('RemoveUnusedImportFix', () => {
  const fix = new RemoveUnusedImportFix();

  it('removes a single named import line', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import { unused } from 'some-module';",
      "import { used } from 'other-module';",
      '',
      'console.log(used);',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'ai-smell/unused-import',
      message: "Unused import: 'unused'",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);
    expect(result.description).toContain('unused');

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).not.toContain("import { unused }");
    expect(updated).toContain("import { used }");
  });

  it('removes a default import line', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import React from 'react';",
      "import { useState } from 'react';",
      '',
      'useState();',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'ai-smell/unused-import',
      message: "Unused import: 'React'",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).not.toContain("import React from 'react'");
    expect(updated).toContain("import { useState }");
  });

  it('removes one specifier from a multi-specifier import', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import { foo, bar, baz } from 'utils';",
      '',
      'console.log(foo, baz);',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'ai-smell/unused-import',
      message: "Unused import: 'bar'",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).toContain('foo');
    expect(updated).toContain('baz');
    expect(updated).not.toMatch(/\bbar\b/);
  });

  it('preview returns a diff string without modifying the file', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import { unused } from 'some-module';",
      '',
      'const x = 1;',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'ai-smell/unused-import',
      message: "Unused import: 'unused'",
      file: 'test.ts',
      line: 1,
    });

    const diff = await fix.preview(filePath, finding);
    expect(diff).toContain('---');
    expect(diff).toContain('+++');
    expect(diff).toContain('-');

    // File should NOT have been modified
    const afterPreview = await readFile(filePath, 'utf-8');
    expect(afterPreview).toBe(content);
  });

  it('returns applied=false when import name cannot be parsed', async () => {
    const filePath = join(testDir, 'test.ts');
    await writeFile(filePath, "import { x } from 'y';", 'utf-8');

    const finding = makeFinding({
      ruleId: 'ai-smell/unused-import',
      message: 'Some unrecognized message format',
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(false);
  });
});

// ── RenameConventionFix ──────────────────────────────────────────

describe('RenameConventionFix', () => {
  const fix = new RenameConventionFix();

  it('renames a function from PascalCase to camelCase', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      'function MyFunction() {',
      '  return 42;',
      '}',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'convention/function-naming',
      message: "Function 'MyFunction' should use camelCase naming",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).toContain('myFunction');
    expect(updated).not.toContain('MyFunction');
  });

  it('renames a constant from camelCase to UPPER_SNAKE', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "const myMaxRetries = 3;",
      '',
      'console.log(myMaxRetries);',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'convention/constant-naming',
      message: "Constant 'myMaxRetries' should use UPPER_SNAKE naming",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).toContain('MY_MAX_RETRIES');
  });

  it('renames a class from snake_case to PascalCase', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      'class my_service {',
      '  run() {}',
      '}',
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'convention/class-naming',
      message: "Type 'my_service' should use PascalCase naming",
      file: 'test.ts',
      line: 1,
    });

    const result = await fix.apply(filePath, finding);
    expect(result.applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).toContain('MyService');
  });

  it('preview returns a diff without modifying the file', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = 'function MyFunc() {}';

    await writeFile(filePath, content, 'utf-8');

    const finding = makeFinding({
      ruleId: 'convention/function-naming',
      message: "Function 'MyFunc' should use camelCase naming",
      file: 'test.ts',
      line: 1,
    });

    const diff = await fix.preview(filePath, finding);
    expect(diff).toContain('---');
    expect(diff).toContain('+++');
    expect(diff).toContain('-function MyFunc()');
    expect(diff).toContain('+function myFunc()');

    // File should NOT have been modified
    const afterPreview = await readFile(filePath, 'utf-8');
    expect(afterPreview).toBe(content);
  });
});

// ── convertName utility ──────────────────────────────────────────

describe('convertName', () => {
  it('converts PascalCase to camelCase', () => {
    expect(convertName('MyFunction', 'camelCase')).toBe('myFunction');
  });

  it('converts camelCase to PascalCase', () => {
    expect(convertName('myFunction', 'PascalCase')).toBe('MyFunction');
  });

  it('converts camelCase to snake_case', () => {
    expect(convertName('myFunction', 'snake_case')).toBe('my_function');
  });

  it('converts camelCase to UPPER_SNAKE', () => {
    expect(convertName('myMaxRetries', 'UPPER_SNAKE')).toBe('MY_MAX_RETRIES');
  });

  it('converts PascalCase to kebab-case', () => {
    expect(convertName('MyComponent', 'kebab-case')).toBe('my-component');
  });

  it('converts snake_case to PascalCase', () => {
    expect(convertName('my_service', 'PascalCase')).toBe('MyService');
  });

  it('converts UPPER_SNAKE to camelCase', () => {
    expect(convertName('MAX_RETRIES', 'camelCase')).toBe('maxRetries');
  });

  it('converts kebab-case to PascalCase', () => {
    expect(convertName('my-component', 'PascalCase')).toBe('MyComponent');
  });
});

// ── applyFixes integration ───────────────────────────────────────

describe('applyFixes', () => {
  it('skips findings without available fixes', async () => {
    const findings: Finding[] = [
      makeFinding({
        ruleId: 'security/hardcoded-secret',
        message: 'Hardcoded secret detected',
        file: 'test.ts',
        line: 1,
      }),
      makeFinding({
        ruleId: 'ai-smell/excessive-comments',
        message: 'Too many comments',
        file: 'test.ts',
        line: 5,
      }),
    ];

    const summary = await applyFixes(findings, testDir, false);
    expect(summary.skipped).toBe(2);
    expect(summary.fixed).toBe(0);
    expect(summary.results).toHaveLength(2);
    for (const result of summary.results) {
      expect(result.applied).toBe(false);
      expect(result.description).toBe('No auto-fix available');
    }
  });

  it('applies available fixes and reports results', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import { unused } from 'some-module';",
      '',
      'const x = 1;',
    ].join('\n');
    await writeFile(filePath, content, 'utf-8');

    const findings: Finding[] = [
      makeFinding({
        ruleId: 'ai-smell/unused-import',
        message: "Unused import: 'unused'",
        file: 'test.ts',
        line: 1,
      }),
    ];

    const summary = await applyFixes(findings, testDir, false);
    expect(summary.fixed).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.results[0].applied).toBe(true);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).not.toContain('unused');
  });

  it('does not modify files in dry-run mode', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = [
      "import { unused } from 'some-module';",
      '',
      'const x = 1;',
    ].join('\n');
    await writeFile(filePath, content, 'utf-8');

    const findings: Finding[] = [
      makeFinding({
        ruleId: 'ai-smell/unused-import',
        message: "Unused import: 'unused'",
        file: 'test.ts',
        line: 1,
      }),
    ];

    const summary = await applyFixes(findings, testDir, true);
    // In dry-run mode, nothing is applied
    expect(summary.fixed).toBe(0);
    expect(summary.results[0].applied).toBe(false);
    // The description should contain diff content
    expect(summary.results[0].description).toContain('---');

    // File should not have been modified
    const afterDryRun = await readFile(filePath, 'utf-8');
    expect(afterDryRun).toBe(content);
  });

  it('handles convention fixes through applyFixes', async () => {
    const filePath = join(testDir, 'test.ts');
    const content = 'function MyFunc() { return 1; }';
    await writeFile(filePath, content, 'utf-8');

    const findings: Finding[] = [
      makeFinding({
        ruleId: 'convention/function-naming',
        message: "Function 'MyFunc' should use camelCase naming",
        file: 'test.ts',
        line: 1,
      }),
    ];

    const summary = await applyFixes(findings, testDir, false);
    expect(summary.fixed).toBe(1);

    const updated = await readFile(filePath, 'utf-8');
    expect(updated).toContain('myFunc');
  });
});
