import type { FitOptions, Layout, LayoutNode, PaneNode, Size } from "../types";
import { combined } from "../tree/size";
import { bounds, combineBounds, type Bounds } from "../geometry/bounds";
export interface Projected {
  id: string;
  type: LayoutNode["type"] | "auto";
  size: Size;
  children: Projected[];
  pane?: PaneNode;
  active?: string;
  /** Pane the automatic stack formed around (the folded panes' related home). */
  home?: string;
  kind?: "fold" | "tuck";
  bounds: Bounds;
}
export function refresh(node: Projected, fit: FitOptions): void {
  if (node.pane) return;
  node.bounds = combineBounds(node.type, node.children.map(c => c.bounds), fit.gap);
}
export function project(node: LayoutNode, fit: FitOptions): Projected {
  if (node.type === "pane") {
    return { id: node.id, type: "pane", size: node.size, children: [], pane: node, bounds: bounds(node, fit.kinds, fit.gap) };
  }
  const result: Projected = {
    id: node.id, type: node.type, size: node.size,
    active: node.type === "stack" ? node.active : undefined,
    children: node.children.map(c => project(c, fit)),
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
export const allPanes = (n: Projected): Projected[] => n.pane ? [n] : n.children.flatMap(allPanes);
export const contains = (n: Projected, id?: string): boolean => !!id && allPanes(n).some(p => p.id === id);
/**
 * Stable home of a slot: a pane is its own home, a deliberate stack's is its first tab (never its active tab, which a
 * click changes), and an automatic group keeps the home it formed around. Fold records and tab choices key on it.
 */
export const homeOf = (n: Projected): string => n.type === "auto" ? n.home ?? allPanes(n)[0]!.id : n.pane ? n.id : allPanes(n)[0]!.id;
export const orderOf = (n: Projected, order: Map<string, number>) => Math.min(...allPanes(n).map(p => order.get(p.id) ?? Infinity));
/** Automatic stacks are named after their home pane, so the id survives the group growing or a tab being chosen. */
export const AUTO_PREFIX = "@auto:";
export function auto(children: Projected[], fit: FitOptions, order: Map<string, number>, home: Projected, fallback?: string): Projected {
  const size = children.map(c => c.size).reduce(combined);
  const homeId = homeOf(home);
  const preferred = children.find(c => c.id === fallback);
  if (preferred?.type === "auto") fallback = preferred.active;
  // Keep one tab group when a later fold grows an automatic stack; tabs stay in reading order.
  children = children.flatMap(c => c.type === "auto" ? c.children : [c]).sort((a, b) => orderOf(a, order) - orderOf(b, order));
  const result: Projected = {
    id: `${AUTO_PREFIX}${homeId}`, type: "auto", children, size, home: homeId, kind: "fold",
    // The home stays the shown tab: a fold never changes what the receiving slot displays.
    active: children.find(c => c.id === fallback)?.id ?? children[0]!.id,
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
export function slots(root: Projected): Projected[] {
  return root.type === "row" || root.type === "column" ? root.children.flatMap(slots) : [root];
}
export function autos(root: Projected): Projected[] {
  return root.type === "auto" ? [root] : root.pane ? [] : root.children.flatMap(autos);
}
/** Remove one displayed slot, retaining the outer size of pruned singleton splits. */
export function removeSlot(node: Projected, id: string): Projected | undefined {
  if (node.id === id) return undefined;
  if (node.type !== "row" && node.type !== "column") return node;
  node.children = node.children.flatMap(c => { const next = removeSlot(c, id); return next ? [next] : []; });
  if (!node.children.length) return undefined;
  return node.children.length === 1 ? { ...node.children[0]!, size: node.size } : node;
}


export function links(root: Projected): (pane: Projected) => string | undefined {
  const ids = new Set(allPanes(root).map(p => p.id));
  return p => p.pane!.linkedTo && ids.has(p.pane!.linkedTo) ? p.pane!.linkedTo : undefined;
}
export function foldSlot(root: Projected, choice: Projected, fit: FitOptions, order: Map<string, number>, explicitHome?: string): Projected {
  const displayed = slots(root);
  const panes = allPanes(root);
  const linkOf = links(root);
  function owner(n: Projected): Projected | undefined {
    if (n.type !== "row" && n.type !== "column") return undefined;
    return n.children.includes(choice) ? n : n.children.map(owner).find(Boolean);
  }
  const parent = owner(root)!;
  const members = new Set(allPanes(choice).map(p => p.id));
  const outside = (id: string | undefined) => id && !members.has(id) ? displayed.find(s => s !== choice && contains(s, id)) : undefined;
  const sources = allPanes(choice).map(p => outside(linkOf(p))).filter((s): s is Projected => !!s);
  const details = panes.filter(p => !members.has(p.id) && members.has(linkOf(p) ?? "")).map(p => displayed.find(s => contains(s, p.id))!);
  let home = explicitHome ? outside(explicitHome) : sources[0] ?? details[0];
  if (!home) {
    // Unlinked (or only linked within itself): nearest neighbour, preferring an existing automatic stack.
    const at = displayed.indexOf(choice);
    const near = [displayed[at - 1], displayed[at + 1]].filter((n): n is Projected => !!n);
    near.sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto"));
    home = near[0]!;
  }
  const pair = displayed.indexOf(choice) < displayed.indexOf(home) ? [choice, home] : [home, choice];
  const group = auto(pair, fit, order, home, home.type === "auto" ? home.active : home.id);
  if (explicitHome && home.type === "stack") group.id = home.id;
  group.kind = explicitHome && home.kind !== "fold" && choice.kind !== "fold" ? "tuck" : "fold";
  // Across nested splits, the receiving slot keeps its allocation in its own axis.
  const sameParent = parent.children.includes(home);
  root = removeSlot(root, choice.id)!;
  function replace(n: Projected): Projected {
    if (n.id === home!.id) { if (!sameParent) group.size = n.size; return group; }
    if (n.type === "row" || n.type === "column") n.children = n.children.map(replace);
    refresh(n, fit);
    return n;
  }
  return replace(root);
}

interface Replayed { root: Projected; order: Map<string, number>; applied: string[] }
/** Replay tucks first, then sticky folds, without changing the canonical tree. */
export function replay(layout: Layout, folds: readonly string[], fit: FitOptions): Replayed {
  let root = project(layout.root, fit);
  const order = new Map(allPanes(root).map((p, i) => [p.id, i]));
  const applied: string[] = [];
  const tucks = layout.overlay?.tucks ?? [];
  // A revealed tab names the same stable home as its fold. Resolve this against the canonical fold projection,
  // then replay the tuck before those folds, so no fold record disappears when its shown tab receives a tuck.
  const homes = tucks.length ? slots(replay({ ...layout, overlay: { ...overlayOf(layout), tucks: [] } }, folds, fit).root) : [];
  for (const tuck of [...tucks].sort((a, b) => a.seq - b.seq)) {
    const displayed = slots(root);
    const choice = displayed.find(s => s.id === tuck.pane);
    const reference = homes.find(s => contains(s, tuck.home));
    const home = reference ? homeOf(reference) : tuck.home;
    if (!choice || !displayed.some(s => s !== choice && contains(s, home))) continue;
    root = foldSlot(root, choice, fit, order, home);
  }
  for (const id of folds) {
    const displayed = slots(root);
    if (displayed.length < 2) break;
    const choice = displayed.find(s => s.id === id);
    if (!choice) continue; // stale record (closed or moved pane): skip it
    root = foldSlot(root, choice, fit, order);
    applied.push(id);
  }
  return { root, order, applied };
}

export function choose(root: Projected, active: Record<string, string> | undefined): void {
  if (!active) return;
  for (const group of autos(root)) {
    const want = active[group.home!];
    const child = want ? group.children.find(c => contains(c, want)) : undefined;
    if (child) group.active = child.id;
  }
}
export function withOverlay(layout: Layout, overlay: import("../types").Overlay): Layout {
  const next = { ...layout };
  delete next.overlay;
  if (overlay.tucks.length || overlay.folds.length || Object.keys(overlay.shown).length) next.overlay = overlay;
  return next;
}
export const overlayOf = (layout: Layout): import("../types").Overlay => layout.overlay ?? { tucks: [], folds: [], shown: {} };
/** Deliberately moved or closed panes no longer belong to their former overlay. Owned draft only. */
export function forget(layout: Layout, ids: readonly string[]): void {
  if (!layout.overlay) return;
  const gone = new Set(ids.flatMap(id => [id, `${AUTO_PREFIX}${id}`]));
  const o = layout.overlay;
  const next = withOverlay(layout, {
    tucks: o.tucks.filter(t => !gone.has(t.pane) && !gone.has(t.home)),
    folds: o.folds.filter(id => !gone.has(id)),
    shown: Object.fromEntries(Object.entries(o.shown).filter(([home, pane]) => !gone.has(home) && !gone.has(pane))),
  });
  delete layout.overlay;
  if (next.overlay) layout.overlay = next.overlay;
}
