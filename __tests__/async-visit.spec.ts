import { remark } from 'remark'
import { visit } from '../src/async-visit'

const markdownAST = remark().parse(`
# 1

1-p1.

[h1](https://example.com/1/01)

## 1-1

1-1-p1.

[1-1](https://example.com/1-1/01)

## 1-2

1-2-p1.

### 1-2-1

1-2-1-p1.

[1-2-1](https://example.com/1-2-1/01)
`)

interface ChildParentPair {
  child: string
  parent?: string | undefined
}

const flattenNodeTypes: ChildParentPair[] = [
  { child: 'root', parent: undefined },
  { child: 'heading', parent: 'root' }, // 1
  { child: 'text', parent: 'heading' },
  { child: 'paragraph', parent: 'root' },
  { child: 'text', parent: 'paragraph' },
  { child: 'paragraph', parent: 'root' },
  { child: 'link', parent: 'paragraph' },
  { child: 'text', parent: 'link' },
  { child: 'heading', parent: 'root' }, // 1-1
  { child: 'text', parent: 'heading' },
  { child: 'paragraph', parent: 'root' },
  { child: 'text', parent: 'paragraph' },
  { child: 'paragraph', parent: 'root' },
  { child: 'link', parent: 'paragraph' },
  { child: 'text', parent: 'link' },
  { child: 'heading', parent: 'root' }, // 1-2
  { child: 'text', parent: 'heading' },
  { child: 'paragraph', parent: 'root' },
  { child: 'text', parent: 'paragraph' },
  { child: 'heading', parent: 'root' }, // 1-2-1
  { child: 'text', parent: 'heading' },
  { child: 'paragraph', parent: 'root' },
  { child: 'text', parent: 'paragraph' },
  { child: 'paragraph', parent: 'root' },
  { child: 'link', parent: 'paragraph' },
  { child: 'text', parent: 'link' },
]

describe('async-visit', () => {
  it('should visit all nodes', async () => {
    const visitedNodeTypes: ChildParentPair[] = []

    await visit(markdownAST, (node, parentNode) => {
      visitedNodeTypes.push({ child: node.type, parent: parentNode?.type })
      return Promise.resolve(true)
    })

    expect(visitedNodeTypes).toStrictEqual(flattenNodeTypes)
  })

  it('should skip link and text nodes according the returned value by a visitor', async () => {
    const visitedNodeTypes: ChildParentPair[] = []

    const typesToSkipChildren = ['heading', 'paragraph']
    await visit(markdownAST, (node, parentNode) => {
      visitedNodeTypes.push({ child: node.type, parent: parentNode?.type })

      if (typesToSkipChildren.includes(node.type)) {
        return Promise.resolve(false)
      }
      return Promise.resolve(true)
    })

    const typesToBeSkipped = ['link', 'text']
    expect(visitedNodeTypes).toStrictEqual(
      flattenNodeTypes.filter(p => !typesToBeSkipped.includes(p.child))
    )
  })
})
