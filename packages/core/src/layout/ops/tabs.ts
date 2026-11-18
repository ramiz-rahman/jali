import type { Layout, LayoutContext, ObjectRef, OpenResult, PaneNode, ViewState } from "../types";
import { clone, find, map, nodes, stackOf, newId, noFocus, panes, unzoom } from "../tree/tree";
import { sameSize } from "../tree/size";
import { tab } from "../tree/insert";
import { overlayOf, withOverlay } from "../fit/overlay";
import { resolve } from "../fit/resolve";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";
import { split } from "./open";

export function setActiveTab(layout: Layout, stack: string, pane: string, ctx: LayoutContext): Layout {
  const resolved = resolve(layout, noFocus(), ctx);
  const projected = resolved.stacks.find(s => s.id === stack && s.paneIds.includes(pane));
  if (!projected) {
    const group = find(layout.root, stack);
    if (group?.type !== "stack" || !group.children.some(c => c.id === pane) || group.active === pane) return layout;
    return { ...layout, root: map(layout.root, n => n === group ? { ...group, active: pane } : n) };
  }
  if (resolved.panes.some(b => b.id === pane && b.stackId === stack && !b.hidden)) return layout;
  const o = overlayOf(layout), home = projected.homeId;
  const shown = { ...o.shown, [home]: pane };
  if (pane === home) delete shown[home];
  const next = withOverlay(layout, { ...o, shown });
  const root = map(next.root, n => n.type === "stack" && n.children.some(c => c.id === pane) && n.active !== pane ? { ...n, active: pane } : n);
  return root === next.root ? next : { ...next, root };
}
export function reveal(layout: Layout, pane: string, ctx: LayoutContext): Layout {
  const box = resolve(layout, noFocus(), ctx).panes.find(b => b.id === pane);
  return box?.hidden && box.stackId ? setActiveTab(layout, box.stackId, pane, ctx) : layout;
}
export function addTab(layout: Layout, view: ViewState, target: string, ref: ObjectRef, ctx: LayoutContext): OpenResult {
  if (find(layout.root, target)?.type !== "pane") throw new Error(`Unknown source pane: ${target}`);
  if (!ctx.fit.kinds[ref.kind]) throw new Error(`Unknown pane kind: ${ref.kind}`);
  const group = resolve(layout, noFocus(), ctx).stacks.find(s => s.paneIds.includes(target));
  if (group) {
    const r = split(layout, unzoom(view), target, "right", ref, ctx);
    return { ...r, layout: reveal(r.layout, r.opened, ctx) };
  }
  const next = clone(layout);
  const pane: PaneNode = { id: newId(layout.root, ref.kind === "launcher" ? "launcher" : "pane"), type: "pane", ref: clone(ref), size: { weight: 1 }, born: 1 + Math.max(panes(layout.root).length, ...panes(layout.root).map(p => p.born ?? 0)) };
  const targetNode = find(next.root, target)!;
  const ownStack = stackOf(next.root, target);
  tab(next, target, pane);
  if (!ownStack) { targetNode.size = { weight: 1 }; delete targetNode.userSized; }
  const nextView = focus(unzoom(view), pane.id, ctx);
  return { layout: fitLayout(next, nextView, ctx), view: nextView, opened: pane.id, mode: "tab" };
}
export function resetLayout(preset: Layout, view: ViewState, ctx: LayoutContext): Layout {
  if (nodes(preset.root).every(n => n.base && sameSize(n.base, n.size))) return fitLayout(preset, view, ctx);
  const next = clone(preset);
  function seed(n: typeof next.root): void { n.base = clone(n.size); if (n.type !== "pane") n.children.forEach(seed); }
  seed(next.root);
  return fitLayout(next, view, ctx);
}
