import ts from "typescript";

// Match JSX structurally so props, whitespace and comments cannot change the result.
export function hasJsxComponent(source, component) {
  const tree = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(tree) === component) return true;
    return Boolean(ts.forEachChild(node, visit));
  }
  return visit(tree);
}
