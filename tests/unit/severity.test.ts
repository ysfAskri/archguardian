import { describe, it, expect } from 'vitest';
import { severityAtLeast, getExitCode } from '../../src/core/severity.js';
import { Severity, ExitCode, type AnalysisSummary } from '../../src/core/types.js';

describe('severityAtLeast', () => {
  it('error >= error', () => {
    expect(severityAtLeast(Severity.Error, Severity.Error)).toBe(true);
  });

  it('error >= warning', () => {
    expect(severityAtLeast(Severity.Error, Severity.Warning)).toBe(true);
  });

  it('warning < error', () => {
    expect(severityAtLeast(Severity.Warning, Severity.Error)).toBe(false);
  });

  it('info < warning', () => {
    expect(severityAtLeast(Severity.Info, Severity.Warning)).toBe(false);
  });
});

describe('getExitCode', () => {
  function makeSummary(overrides: Partial<AnalysisSummary> = {}): AnalysisSummary {
    return {
      totalFiles: 1,
      totalFindings: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      analyzerResults: [],
      duration: 100,
      ...overrides,
    };
  }

  it('returns Success when no findings', () => {
    const code = getExitCode(makeSummary(), { failOn: Severity.Error, maxWarnings: 20 });
    expect(code).toBe(ExitCode.Success);
  });

  it('returns ErrorsFound when errors and failOn error', () => {
    const code = getExitCode(makeSummary({ errors: 1, totalFindings: 1 }), { failOn: Severity.Error, maxWarnings: 20 });
    expect(code).toBe(ExitCode.ErrorsFound);
  });

  it('returns Success when only warnings and failOn error', () => {
    const code = getExitCode(makeSummary({ warnings: 5, totalFindings: 5 }), { failOn: Severity.Error, maxWarnings: 20 });
    expect(code).toBe(ExitCode.Success);
  });

  it('returns ErrorsFound when warnings and failOn warning', () => {
    const code = getExitCode(makeSummary({ warnings: 1, totalFindings: 1 }), { failOn: Severity.Warning, maxWarnings: 20 });
    expect(code).toBe(ExitCode.ErrorsFound);
  });

  it('returns WarningsExceeded when warnings exceed max', () => {
    const code = getExitCode(makeSummary({ warnings: 25, totalFindings: 25 }), { failOn: Severity.Error, maxWarnings: 20 });
    expect(code).toBe(ExitCode.WarningsExceeded);
  });
});
