import { Node, Parent } from 'unist'

function isParentType(node: Node | Parent): node is Parent {
  return 'children' in node
}

/**
 * Process a node and returns true if the children of the node also should be visited.
 *
 * @param node - The node is going to be processed.
 * @param parentNode - The parent node of the node if exists, null otherwise.
 * @returns The children of `node` are visited if this value is true and the children exist,
 *          and are skipped otherwise.
 */
export type Visitor = (
  node: Node,
  parentNode: Parent | null
) => Promise<boolean>

export async function visit(node: Node | Parent, visitor: Visitor) {
  await visitRecursively(node, visitor, null)
}

async function visitRecursively(
  node: Node | Parent,
  visitor: Visitor,
  parent: Parent | null
) {
  const shouldVisitChildren = await visitor(node, parent)
  if (!shouldVisitChildren || !isParentType(node)) {
    return
  }

  for (const child of node.children) {
    await visitRecursively(child, visitor, node)
  }
}
