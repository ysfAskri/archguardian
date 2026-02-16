import type { SyntaxNode, Tree } from 'web-tree-sitter';

export function walk(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    walk(node.child(i)!, callback);
  }
}

export function findNodes(tree: Tree, types: string[]): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  const typeSet = new Set(types);
  walk(tree.rootNode, (node) => {
    if (typeSet.has(node.type)) {
      results.push(node);
    }
  });
  return results;
}

export function findAncestor(node: SyntaxNode, type: string): SyntaxNode | null {
  let current = node.parent;
  while (current) {
    if (current.type === type) return current;
    current = current.parent;
  }
  return null;
}

export function getNodeText(node: SyntaxNode): string {
  return node.text;
}

export function getLineContent(source: string, line: number): string {
  const lines = source.split('\n');
  return lines[line] ?? '';
}

export function nodeRange(node: SyntaxNode): { startLine: number; startCol: number; endLine: number; endCol: number } {
  return {
    startLine: node.startPosition.row + 1,
    startCol: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endCol: node.endPosition.column,
  };
}

export function collectIdentifiers(node: SyntaxNode): string[] {
  const identifiers: string[] = [];
  walk(node, (n) => {
    if (n.type === 'identifier' || n.type === 'property_identifier') {
      identifiers.push(n.text);
    }
  });
  return identifiers;
}

export function collectImports(tree: Tree): Array<{ source: string; specifiers: string[]; node: SyntaxNode }> {
  const imports: Array<{ source: string; specifiers: string[]; node: SyntaxNode }> = [];

  walk(tree.rootNode, (node) => {
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      const source = sourceNode?.text.replace(/['"]/g, '') ?? '';
      const specifiers: string[] = [];

      walk(node, (child) => {
        if (child.type === 'import_specifier' || child.type === 'identifier') {
          if (child.parent?.type === 'import_clause' || child.parent?.type === 'import_specifier' || child.parent?.type === 'named_imports') {
            specifiers.push(child.text);
          }
        }
      });

      imports.push({ source, specifiers, node });
    }
  });

  return imports;
}
