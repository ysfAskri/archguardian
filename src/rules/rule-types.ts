import type { Finding, ParsedFile, Severity } from '../core/types.js';
import type { SyntaxNode } from 'web-tree-sitter';

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  analyzer: string;
}

export interface NodeRule extends RuleDefinition {
  nodeTypes: string[];
  check(node: SyntaxNode, file: ParsedFile): Finding[];
}

export interface FileRule extends RuleDefinition {
  check(file: ParsedFile): Finding[];
}

export type AnyRule = NodeRule | FileRule;

export function isNodeRule(rule: AnyRule): rule is NodeRule {
  return 'nodeTypes' in rule;
}

export function isFileRule(rule: AnyRule): rule is FileRule {
  return !('nodeTypes' in rule);
}
