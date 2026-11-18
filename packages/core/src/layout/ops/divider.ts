import type { Layout, LayoutContext, LayoutNode } from "../types";
import { clone, find, isSplit, panes, noFocus } from "../tree/tree";
import { sameSize } from "../tree/size";
import { resolve } from "../fit/resolve";
import { extentAlong } from "../geometry/extent";
export function resizeDivider(
  layout: Layout,
  parentId: string,
  index: number,
  deltaPx: number,
  ctx: LayoutContext,
) {
  if (!deltaPx || !Number.isFinite(deltaPx)) return layout;
  const next = clone(layout);
  const owner = find(next.root, parentId);
  if (!owner || !isSplit(owner) || !Number.isFinite(deltaPx)) return layout;
  const resolved = resolve(layout, noFocus(), ctx);
  const divider = resolved.dividers.find((d) => d.parentId === parentId && d.index === index);
  if (!divider) return layout;
  const [leftIds, rightIds] = divider.neighbours!;
  const first = owner.children.filter((c) => panes(c).some((p) => leftIds.includes(p.id)));
  const second = owner.children.filter((c) => panes(c).some((p) => rightIds.includes(p.id)));
  if (!first.length || !second.length) return layout;
  const secondExtent = extentAlong(resolved.panes, rightIds, owner.type);
  const total = divider.value + secondExtent;
  const value = Math.max(divider.min, Math.min(divider.max, divider.value + deltaPx));
  if (Math.abs(value - divider.value) < 1e-9) return layout;
  // Dragged sizes are stored as proportions (weights in px units), never fixed px,
  // so the split still fills its space after a close, a minimise or a window resize. Every sibling is
  // re-expressed in the same units from its current extent, so untouched siblings keep their share.
  const extentOf = (child: LayoutNode) =>
    extentAlong(
      resolved.panes,
      panes(child).map((p) => p.id),
      owner.type,
    );
  for (const child of owner.children) {
    if (first.includes(child) || second.includes(child)) continue;
    child.base ??= clone(child.size);
    const extent = extentOf(child);
    if (extent > 0) child.size = { weight: extent };
  }
  const assign = (group: LayoutNode[], pixels: number) => {
    const preferences = group.map((c) => Math.max(extentOf(c), 1));
    const sum = preferences.reduce((a, b) => a + b, 0);
    group.forEach((node, i) => {
      node.base ??= node.userSized ? { weight: 1 } : clone(node.size);
      node.size = { weight: (pixels * preferences[i]!) / sum };
      node.userSized = true;
    });
  };
  assign(first, value);
  assign(second, total - value);
  return next;
}
export function resetDivider(layout: Layout, parentId: string, index: number, ctx: LayoutContext) {
  const next = clone(layout),
    owner = find(next.root, parentId);
  const divider = resolve(layout, noFocus(), ctx).dividers.find(
    (d) => d.parentId === parentId && d.index === index,
  );
  const ids = divider?.neighbours?.flat();
  let changed = false;
  if (owner && isSplit(owner)) {
    const children = ids
      ? owner.children.filter((c) => panes(c).some((p) => ids.includes(p.id)))
      : index >= 0
        ? owner.children.slice(index, index + 2)
        : [];
    for (const child of children) {
      changed ||= !!child.userSized || !sameSize(child.size, child.base ?? { weight: 1 });
      child.size = clone(child.base ?? { weight: 1 });
      delete child.userSized;
    }
    // Siblings that a drag only re-expressed as proportions (never sized by the person) return to their defaults too,
    // so the reset pair and its siblings share space in the same units again.
    for (const child of owner.children)
      if (!children.includes(child) && !child.userSized && child.base) {
        changed ||= !sameSize(child.size, child.base!);
        child.size = clone(child.base!);
      }
  }
  return changed ? next : layout;
}
