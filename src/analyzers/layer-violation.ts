import type {
  AnalysisContext,
  ArchitectureLayer,
  ArchitectureRule,
  Finding,
} from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { collectImports } from '../parsers/ast-utils.js';
import { minimatch } from 'minimatch';
import { posix } from 'node:path';

export class LayerViolationDetector extends BaseAnalyzer {
  name = 'architecture';

  protected defaultSeverity(): Severity {
    return Severity.Error;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const archConfig = context.config.analyzers.architecture;

    if (archConfig.layers.length === 0 || archConfig.rules.length === 0) {
      return findings;
    }

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);
      if (changedLines.size === 0) continue;

      const sourceLayer = this.resolveLayer(file.path, archConfig.layers);
      if (!sourceLayer) continue;

      const rule = this.findRule(sourceLayer.name, archConfig.rules);
      if (!rule) continue;

      const imports = collectImports(file.tree);

      for (const imp of imports) {
        const importLine = imp.node.range().start.line + 1;
        if (!changedLines.has(importLine)) continue;

        const resolvedPath = this.resolveImportPath(file.path, imp.source);
        const targetLayer = this.resolveLayer(resolvedPath, archConfig.layers);
        if (!targetLayer) continue;

        // No violation when importing from the same layer
        if (targetLayer.name === sourceLayer.name) continue;

        if (this.isViolation(targetLayer.name, rule)) {
          findings.push(
            this.createFinding(
              'architecture/layer-violation',
              file.path,
              importLine,
              `Layer violation: '${sourceLayer.name}' cannot import from '${targetLayer.name}'`,
              {
                severity: archConfig.severity ?? this.defaultSeverity(),
                suggestion: `Refactor to avoid importing from the '${targetLayer.name}' layer. Allowed layers: ${(rule.allow ?? []).join(', ') || 'none'}`,
                codeSnippet: imp.node.text(),
              },
            ),
          );
        }
      }
    }

    return findings;
  }

  /**
   * Match a file path against the layer patterns to determine which
   * architectural layer it belongs to.
   */
  private resolveLayer(
    filePath: string,
    layers: ArchitectureLayer[],
  ): ArchitectureLayer | undefined {
    // Normalize to forward slashes for cross-platform matching
    const normalized = filePath.replace(/\\/g, '/');

    for (const layer of layers) {
      for (const pattern of layer.patterns) {
        if (minimatch(normalized, pattern)) {
          return layer;
        }
      }
    }

    return undefined;
  }

  /**
   * Find the architectural rule governing imports *from* a given layer.
   */
  private findRule(
    layerName: string,
    rules: ArchitectureRule[],
  ): ArchitectureRule | undefined {
    return rules.find((r) => r.from === layerName);
  }

  /**
   * Resolve a potentially relative import specifier to a project-relative
   * path so it can be matched against layer patterns.
   */
  private resolveImportPath(currentFile: string, importSource: string): string {
    // Non-relative imports (packages) are returned as-is
    if (!importSource.startsWith('.')) {
      return importSource;
    }

    const dir = posix.dirname(currentFile.replace(/\\/g, '/'));
    return posix.normalize(posix.join(dir, importSource));
  }

  /**
   * Determine whether importing from `targetLayerName` violates the given
   * rule. A violation occurs when:
   *   - The target layer is explicitly listed in `deny`, OR
   *   - An `allow` list exists and the target layer is NOT in it.
   */
  private isViolation(targetLayerName: string, rule: ArchitectureRule): boolean {
    // Explicit deny takes priority
    if (rule.deny && rule.deny.includes(targetLayerName)) {
      return true;
    }

    // If an allow-list is specified, anything not on the list is denied
    if (rule.allow && rule.allow.length > 0) {
      return !rule.allow.includes(targetLayerName);
    }

    return false;
  }
}
