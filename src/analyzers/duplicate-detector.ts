import type { AnalysisContext, Finding, ParsedFile } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { walk, findNodes } from '../parsers/ast-utils.js';
import type { SgNode } from '@ast-grep/napi';

/**
 * Minimum number of lines a block must span to be considered for duplicate detection.
 * Blocks shorter than this threshold are ignored to avoid trivial matches.
 */
const MIN_BLOCK_LINES = 5;

/**
 * AST node types that represent meaningful code blocks worth comparing
 * for structural duplication.
 */
const BLOCK_NODE_TYPES = [
  'function_declaration',
  'method_definition',
  'arrow_function',
  'if_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'switch_statement',
  'try_statement',
  'class_declaration',
];

/**
 * AST node types whose text should be normalized (replaced with a placeholder)
 * when computing structural hashes. This ensures two blocks that differ only
 * in variable names or literal values still match.
 */
const IDENTIFIER_NODE_TYPES = new Set([
  'identifier',
  'property_identifier',
  'shorthand_property_identifier',
  'shorthand_property_identifier_pattern',
  'type_identifier',
]);

const LITERAL_NODE_TYPES = new Set([
  'string',
  'string_fragment',
  'template_string',
  'number',
  'true',
  'false',
  'null',
  'undefined',
  'regex',
]);

/**
 * Represents a meaningful code block extracted from a parsed file, together
 * with the metadata needed for duplicate comparison and finding generation.
 */
interface CodeBlock {
  /** Structural hash (identifiers/literals normalized). */
  hash: string;
  /** Ordered token sequence for Jaccard similarity. */
  tokens: string[];
  /** Source file path. */
  filePath: string;
  /** 1-based start line. */
  startLine: number;
  /** 1-based end line. */
  endLine: number;
  /** Original (non-normalized) code snippet. */
  snippet: string;
  /** The AST node type (e.g. "function_declaration"). */
  nodeType: string;
}

export class DuplicateDetector extends BaseAnalyzer {
  name = 'duplicates';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const similarity = context.config.analyzers.duplicates.similarity ?? 0.85;

    // 1. Extract all meaningful blocks from every parsed file, limited to
    //    blocks that overlap with changed lines.
    const allBlocks: CodeBlock[] = [];

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);
      const blocks = this.extractBlocks(file, changedLines);
      allBlocks.push(...blocks);
    }

    // 2. Group blocks by structural hash to find exact structural clones.
    const hashMap = new Map<string, CodeBlock[]>();
    for (const block of allBlocks) {
      const existing = hashMap.get(block.hash);
      if (existing) {
        existing.push(block);
      } else {
        hashMap.set(block.hash, [block]);
      }
    }

    // Report structural clones — each pair is reported once.
    const reportedStructural = new Set<string>();
    for (const [, blocks] of hashMap) {
      if (blocks.length < 2) continue;
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          const pairKey = this.pairKey(a, b);
          if (reportedStructural.has(pairKey)) continue;
          reportedStructural.add(pairKey);

          findings.push(this.createFinding(
            'duplicate/structural-clone',
            a.filePath,
            a.startLine,
            `Structural duplicate detected: this ${a.nodeType} (lines ${a.startLine}-${a.endLine}) is structurally identical to ${b.filePath}:${b.startLine}-${b.endLine}`,
            {
              severity: Severity.Warning,
              endLine: a.endLine,
              codeSnippet: a.snippet.slice(0, 200),
              suggestion: 'Extract the duplicated logic into a shared function or module',
            },
          ));
        }
      }
    }

    // 3. For blocks that were NOT flagged as structural clones, check
    //    token-level similarity via Jaccard.
    const reportedSimilar = new Set<string>();
    for (let i = 0; i < allBlocks.length; i++) {
      for (let j = i + 1; j < allBlocks.length; j++) {
        const a = allBlocks[i];
        const b = allBlocks[j];

        // Skip if already reported as structural clone.
        const pairKey = this.pairKey(a, b);
        if (reportedStructural.has(pairKey)) continue;
        if (reportedSimilar.has(pairKey)) continue;

        // Skip self-comparison within the same range of the same file.
        if (a.filePath === b.filePath && a.startLine === b.startLine) continue;

        const jaccardSim = this.jaccardSimilarity(a.tokens, b.tokens);
        if (jaccardSim >= similarity) {
          reportedSimilar.add(pairKey);

          findings.push(this.createFinding(
            'duplicate/similar-block',
            a.filePath,
            a.startLine,
            `Similar code block detected (${(jaccardSim * 100).toFixed(0)}% similarity): this ${a.nodeType} (lines ${a.startLine}-${a.endLine}) is similar to ${b.filePath}:${b.startLine}-${b.endLine}`,
            {
              severity: Severity.Warning,
              endLine: a.endLine,
              codeSnippet: a.snippet.slice(0, 200),
              suggestion: 'Consider refactoring to reduce duplication',
            },
          ));
        }
      }
    }

    return findings;
  }

  // ── Block extraction ──────────────────────────────────────────────

  /**
   * Walk the AST and collect meaningful code blocks that overlap with
   * at least one changed line.
   */
  private extractBlocks(file: ParsedFile, changedLines: Set<number>): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const nodes = findNodes(file.tree, BLOCK_NODE_TYPES);

    for (const node of nodes) {
      const startLine = node.range().start.line + 1;
      const endLine = node.range().end.line + 1;
      const lineCount = endLine - startLine + 1;

      // Filter out trivially small blocks.
      if (lineCount < MIN_BLOCK_LINES) continue;

      // Only consider blocks that contain at least one changed line.
      if (!this.overlapsChangedLines(startLine, endLine, changedLines)) continue;

      const hash = this.hashNode(node);
      const tokens = this.tokenizeNode(node);
      const snippet = node.text();

      blocks.push({
        hash,
        tokens,
        filePath: file.path,
        startLine,
        endLine,
        snippet,
        nodeType: node.kind() as string,
      });
    }

    return blocks;
  }

  /**
   * Returns true when at least one line in [startLine, endLine] belongs
   * to the set of changed lines.
   */
  private overlapsChangedLines(startLine: number, endLine: number, changedLines: Set<number>): boolean {
    for (let line = startLine; line <= endLine; line++) {
      if (changedLines.has(line)) return true;
    }
    return false;
  }

  // ── Structural hashing ────────────────────────────────────────────

  /**
   * Build a normalized string representation of an AST subtree by
   * replacing all identifiers with `$ID` and all literals with `$LIT`,
   * then return a simple hash of the result.
   */
  private hashNode(node: SgNode): string {
    const normalized = this.normalizeNode(node);
    return this.simpleHash(normalized);
  }

  /**
   * Recursively normalize a subtree into a canonical string form:
   *   - Identifiers -> `$ID`
   *   - Literals    -> `$LIT`
   *   - Everything else keeps its node type and structure.
   */
  private normalizeNode(node: SgNode): string {
    const kind = node.kind() as string;
    if (IDENTIFIER_NODE_TYPES.has(kind)) {
      return '$ID';
    }
    if (LITERAL_NODE_TYPES.has(kind)) {
      return '$LIT';
    }

    const children = node.children();
    if (children.length === 0) {
      // Leaf node that is not an identifier or literal — keep its text
      // (e.g. operators, keywords, punctuation).
      return node.text();
    }

    const childParts: string[] = [];
    for (const child of children) {
      childParts.push(this.normalizeNode(child));
    }
    return `(${kind} ${childParts.join(' ')})`;
  }

  /**
   * Simple string hashing (djb2). Not cryptographic — only needs to
   * be deterministic and fast for grouping.
   */
  private simpleHash(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  // ── Token sequence & Jaccard similarity ───────────────────────────

  /**
   * Extract an ordered sequence of "tokens" from an AST node. Each token
   * is the node type for structural nodes, or a normalised placeholder
   * for identifiers and literals. This sequence is used for Jaccard
   * similarity comparison.
   */
  private tokenizeNode(node: SgNode): string[] {
    const tokens: string[] = [];

    walk(node, (n) => {
      const kind = n.kind() as string;
      if (IDENTIFIER_NODE_TYPES.has(kind)) {
        tokens.push('$ID');
      } else if (LITERAL_NODE_TYPES.has(kind)) {
        tokens.push('$LIT');
      } else if (n.children().length === 0) {
        // Leaf: operator, keyword, punctuation
        tokens.push(n.text());
      } else {
        tokens.push(kind);
      }
    });

    return tokens;
  }

  /**
   * Compute Jaccard similarity between two token sequences.
   *
   * We use token *multisets* (bags) rather than sets so that the number
   * of occurrences matters — duplicate tokens are tracked with a suffix
   * counter.
   */
  jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const bagA = this.toBag(a);
    const bagB = this.toBag(b);

    let intersection = 0;
    let union = 0;

    const allKeys = new Set([...bagA.keys(), ...bagB.keys()]);
    for (const key of allKeys) {
      const countA = bagA.get(key) ?? 0;
      const countB = bagB.get(key) ?? 0;
      intersection += Math.min(countA, countB);
      union += Math.max(countA, countB);
    }

    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Convert an array of tokens into a frequency map (bag / multiset).
   */
  private toBag(tokens: string[]): Map<string, number> {
    const bag = new Map<string, number>();
    for (const t of tokens) {
      bag.set(t, (bag.get(t) ?? 0) + 1);
    }
    return bag;
  }

  // ── Utilities ─────────────────────────────────────────────────────

  /**
   * Deterministic key for a pair of blocks, order-independent.
   */
  private pairKey(a: CodeBlock, b: CodeBlock): string {
    const ka = `${a.filePath}:${a.startLine}`;
    const kb = `${b.filePath}:${b.startLine}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  }
}
