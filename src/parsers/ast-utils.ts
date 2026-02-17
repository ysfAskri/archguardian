import type { SgNode, SgRoot } from '@ast-grep/napi';

export function walk(node: SgNode, callback: (node: SgNode) => void): void {
  callback(node);
  for (const child of node.children()) {
    walk(child, callback);
  }
}

export function findNodes(tree: SgRoot, types: string[]): SgNode[] {
  const results: SgNode[] = [];
  const typeSet = new Set(types);
  walk(tree.root(), (node) => {
    if (typeSet.has(node.kind() as string)) {
      results.push(node);
    }
  });
  return results;
}

export function findAncestor(node: SgNode, type: string): SgNode | null {
  let current = node.parent();
  while (current) {
    if (current.kind() === type) return current;
    current = current.parent();
  }
  return null;
}

export function getNodeText(node: SgNode): string {
  return node.text();
}

export function getLineContent(source: string, line: number): string {
  const lines = source.split('\n');
  return lines[line] ?? '';
}

export function nodeRange(node: SgNode): { startLine: number; startCol: number; endLine: number; endCol: number } {
  const range = node.range();
  return {
    startLine: range.start.line + 1,
    startCol: range.start.column,
    endLine: range.end.line + 1,
    endCol: range.end.column,
  };
}

export function collectIdentifiers(node: SgNode): string[] {
  const identifiers: string[] = [];
  walk(node, (n) => {
    if (n.kind() === 'identifier' || n.kind() === 'property_identifier') {
      identifiers.push(n.text());
    }
  });
  return identifiers;
}

export function collectImports(tree: SgRoot): Array<{ source: string; specifiers: string[]; node: SgNode }> {
  const imports: Array<{ source: string; specifiers: string[]; node: SgNode }> = [];

  walk(tree.root(), (node) => {
    if (node.kind() === 'import_statement') {
      const sourceNode = node.field('source');
      const source = sourceNode?.text().replace(/['"]/g, '') ?? '';
      const specifiers: string[] = [];

      walk(node, (child) => {
        if (child.kind() === 'import_specifier' || child.kind() === 'identifier') {
          if (child.parent()?.kind() === 'import_clause' || child.parent()?.kind() === 'import_specifier' || child.parent()?.kind() === 'named_imports') {
            specifiers.push(child.text());
          }
        }
      });

      imports.push({ source, specifiers, node });
    }
  });

  return imports;
}
