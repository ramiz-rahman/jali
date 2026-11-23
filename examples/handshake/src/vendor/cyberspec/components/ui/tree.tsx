"use client"

import * as React from "react"
import { Tree as SdkTree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel, type TreeProps } from "@ui-sdk/react/tree"
import { ChevronRight } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/tree.css"

type TreeNode = {
  value: string
  label: string
  meta?: string
  disabled?: boolean
  children?: TreeNode[]
}

const count = (nodes: TreeNode[]): number => nodes.reduce((total, node) => total + 1 + count(node.children ?? []), 0)

// A hierarchy wired together: each branch drops a rail to its children, a
// chevron turns as it opens, and a leaf carries a tick that fills when it's
// the chosen one. One tab stop; the arrow keys walk it, and Right and Left
// open and close branches.
//
// - `items`: each a `value` (unique in the tree) and a `label`, an optional
//   `meta` printed at the end of its row (a size, a count), and `children`
//   for a branch.
// - Everything else goes to the SDK's Tree: `value`, `defaultValue`,
//   `onValueChange`, `defaultExpanded`, `onExpandedChange`, `onAction`,
//   `activation`, `disabled`, `controller`.
function Tree({
  label,
  items,
  ...props
}: Omit<TreeProps<"single">, "children" | "items" | "paths" | "mode" | "aria-label" | "aria-labelledby"> & {
  label: string
  items: TreeNode[]
}) {
  const id = React.useId()

  // An item takes real focus, and its row shows it (a ring inside the row),
  // so the item asks for no ring of its own around the whole branch.
  const rows = (nodes: TreeNode[]) =>
    nodes.map((node) => (
      <TreeItem key={node.value} value={node.value} disabled={node.disabled} data-kit="tree-item" data-focus-quiet="">
        <TreeItemLabel data-kit="tree-row">
          {node.children ? (
            <TreeItemIndicator data-kit="tree-indicator">
              <ChevronRight aria-hidden />
            </TreeItemIndicator>
          ) : (
            <span data-kit="tree-tick" aria-hidden />
          )}
          <span data-kit="tree-name">{node.label}</span>
          {node.meta && <span data-kit="tree-meta">{node.meta}</span>}
        </TreeItemLabel>
        {node.children && <TreeGroup data-kit="tree-group">{rows(node.children)}</TreeGroup>}
      </TreeItem>
    ))

  return (
    <div data-kit="tree" data-disabled={props.disabled ? "" : undefined}>
      <div data-kit="tree-head">
        <span data-kit="label" id={id}>
          {label}
        </span>
        <span data-kit="value" aria-hidden>
          {String(count(items)).padStart(2, "0")}
        </span>
      </div>
      {/* The same nodes as data on the root, so the keys, typeahead and an
          agent know the whole shape, closed branches included. */}
      <SdkTree data-kit="tree-rows" aria-labelledby={id} items={items} {...props}>
        {rows(items)}
      </SdkTree>
    </div>
  )
}

export { Tree }
export type { TreeNode }
