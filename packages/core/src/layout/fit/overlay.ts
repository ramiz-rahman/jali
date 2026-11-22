import type { FitOptions, Layout, LayoutNode, PaneNode, Size } from "../types";
import { combined } from "../tree/size";
import { bounds, combineBounds, NO_BOUNDS, type Bounds } from "../geometry/bounds";
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
  /** A row that scrolls sideways: one slot to the fit, its children never folded. */
  scroll?: boolean;
  /** Sized by the person (or allocated exactly, as under a tuck): its split shares by exact weights, not the share rule. */
  userSized?: boolean;
  bounds: Bounds;
}
export function refresh(node: Projected, fit: FitOptions): void {
  if (node.pane) return;
  const home =
    node.type === "auto"
      ? node.children.findIndex((c) => contains(c, node.home))
      : node.type === "stack"
        ? -1
        : 0;
  node.bounds = combineBounds(
    node.type,
    node.children.map((c) => c.bounds),
    fit.gap,
    node.type === "stack" ? -1 : Math.max(0, home),
    !!node.scroll,
  );
}
export function project(node: LayoutNode, fit: FitOptions): Projected {
  if (node.type === "pane") {
    return {
      id: node.id,
      type: "pane",
      size: node.size,
      userSized: node.userSized,
      children: [],
      pane: node,
      bounds: bounds(node, fit.kinds, fit.gap),
    };
  }
  const result: Projected = {
    id: node.id,
    type: node.type,
    size: node.size,
    userSized: node.userSized,
    active: node.type === "stack" ? node.active : undefined,
    scroll: node.type === "row" && node.scroll === "x" ? true : undefined,
    children: node.children.map((c) => project(c, fit)),
    bounds: { ...NO_BOUNDS },
  };
  refresh(result, fit);
  return result;
}
/** The panes under `n`, in reading order. */
export function allPanes(n: Projected): Projected[] {
  if (n.pane) return [n];
  const out: Projected[] = [];
  const walk = (m: Projected) => {
    if (m.pane) out.push(m);
    else for (const c of m.children) walk(c);
  };
  walk(n);
  return out;
}
export const contains = (n: Projected, id?: string): boolean =>
  !!id && allPanes(n).some((p) => p.id === id);
/**
 * Stable home of a slot: a pane is its own home, a deliberate stack's is its first tab (never its active tab, which a
 * click changes), and an automatic group keeps the home it formed around. Fold records and tab choices key on it.
 */
export const homeOf = (n: Projected): string =>
  n.type === "auto" ? (n.home ?? allPanes(n)[0]!.id) : n.pane ? n.id : allPanes(n)[0]!.id;
export const orderOf = (n: Projected, order: Map<string, number>) =>
  Math.min(...allPanes(n).map((p) => order.get(p.id) ?? Infinity));
/** Automatic stacks are named after their home pane, so the id survives the group growing or a tab being chosen. */
export const AUTO_PREFIX = "@auto:";
export function auto(
  children: Projected[],
  fit: FitOptions,
  order: Map<string, number>,
  home: Projected,
  fallback?: string,
): Projected {
  const size = children.map((c) => c.size).reduce(combined);
  const homeId = homeOf(home);
  const preferred = children.find((c) => c.id === fallback);
  if (preferred?.type === "auto") fallback = preferred.active;
  // Keep one tab group when a later fold grows an automatic stack; tabs stay in reading order.
  children = children.flatMap((c) => (c.type === "auto" ? c.children : [c]));
  const at = new Map(children.map((c) => [c, orderOf(c, order)]));
  children.sort((a, b) => at.get(a)! - at.get(b)!);
  const result: Projected = {
    id: `${AUTO_PREFIX}${homeId}`,
    type: "auto",
    children,
    size,
    home: homeId,
    kind: "fold",
    userSized: children.some((c) => c.userSized) || undefined,
    // The home stays the shown tab: a fold never changes what the receiving slot displays.
    active: children.find((c) => c.id === fallback)?.id ?? children[0]!.id,
    bounds: { ...NO_BOUNDS },
  };
  refresh(result, fit);
  return result;
}
/** The slots the fit folds among. A row that scrolls is one: its children are never folded to make room. */
export function slots(root: Projected): Projected[] {
  const out: Projected[] = [];
  const walk = (n: Projected) => {
    if ((n.type === "row" && !n.scroll) || n.type === "column") for (const c of n.children) walk(c);
    else out.push(n);
  };
  walk(root);
  return out;
}
/** The displayed slot each pane is in (the slots split the panes between them). */
function slotOf(displayed: readonly Projected[]): Map<string, Projected> {
  const of = new Map<string, Projected>();
  for (const s of displayed) for (const p of allPanes(s)) of.set(p.id, s);
  return of;
}
export function autos(root: Projected): Projected[] {
  return root.type === "auto" ? [root] : root.pane ? [] : root.children.flatMap(autos);
}
/** Remove one displayed slot, retaining the outer size of pruned singleton splits. */
export function removeSlot(node: Projected, id: string): Projected | undefined {
  if (node.id === id) return undefined;
  if (node.type !== "row" && node.type !== "column") return node;
  node.children = node.children.flatMap((c) => {
    const next = removeSlot(c, id);
    return next ? [next] : [];
  });
  if (!node.children.length) return undefined;
  return node.children.length === 1
    ? { ...node.children[0]!, size: node.size, userSized: node.userSized }
    : node;
}

export function links(root: Projected): (pane: Projected) => string | undefined {
  const ids = new Set(allPanes(root).map((p) => p.id));
  return (p) => (p.pane!.linkedTo && ids.has(p.pane!.linkedTo) ? p.pane!.linkedTo : undefined);
}
/**
 * Where a folded slot may go, best first. First the rule's home: the slot it was opened from, else a slot opened from
 * it, else (unlinked) its nearest neighbour, preferring an automatic group. After it, the other places it could
 * reasonably join: its other links, then its neighbours in reading order. Fitting tries those only when the first
 * would fold more (`fit/replay.ts`).
 */
export function foldHomes(root: Projected, choice: Projected): Projected[] {
  const displayed = slots(root);
  const panes = allPanes(root);
  const linkOf = links(root);
  const slotFor = slotOf(displayed);
  const own = allPanes(choice);
  const members = new Set(own.map((p) => p.id));
  const outside = (id: string | undefined) => {
    const s = id && !members.has(id) ? slotFor.get(id) : undefined;
    return s !== choice ? s : undefined;
  };
  const sources = own.map((p) => outside(linkOf(p))).filter((s): s is Projected => !!s);
  const details = panes
    .filter((p) => !members.has(p.id) && members.has(linkOf(p) ?? ""))
    .map((p) => slotFor.get(p.id)!);
  // Unlinked (or only linked within itself): nearest neighbour, preferring an existing automatic stack.
  const at = displayed.indexOf(choice);
  const near = [displayed[at - 1], displayed[at + 1]].filter((n): n is Projected => !!n);
  const nearest = [...near].sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto"));
  return [...new Set([...sources, ...details, ...nearest, ...near])];
}
export function foldSlot(
  root: Projected,
  choice: Projected,
  fit: FitOptions,
  order: Map<string, number>,
  explicitHome?: string,
  /** The slot to join, one of `foldHomes`; default the first. */
  to?: Projected,
): Projected {
  const displayed = slots(root);
  function owner(n: Projected): Projected | undefined {
    if (n.type !== "row" && n.type !== "column") return undefined;
    return n.children.includes(choice) ? n : n.children.map(owner).find(Boolean);
  }
  const parent = owner(root)!;
  const members = new Set(allPanes(choice).map((p) => p.id));
  const outside = (id: string | undefined) =>
    id && !members.has(id) ? displayed.find((s) => s !== choice && contains(s, id)) : undefined;
  let home = explicitHome ? outside(explicitHome) : (to ?? foldHomes(root, choice)[0]);
  if (!home) {
    // A tuck whose home is gone: the nearest neighbour, preferring an existing automatic stack.
    const at = displayed.indexOf(choice);
    const near = [displayed[at - 1], displayed[at + 1]].filter((n): n is Projected => !!n);
    near.sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto"));
    home = near[0]!;
  }
  const pair =
    displayed.indexOf(choice) < displayed.indexOf(home) ? [choice, home] : [home, choice];
  const group = auto(pair, fit, order, home, home.type === "auto" ? home.active : home.id);
  if (explicitHome && home.type === "stack") group.id = home.id;
  group.kind = explicitHome && home.kind !== "fold" && choice.kind !== "fold" ? "tuck" : "fold";
  // Across nested splits, the receiving slot keeps its allocation in its own axis.
  const sameParent = parent.children.includes(home);
  root = removeSlot(root, choice.id)!;
  function replace(n: Projected): Projected {
    if (n.id === home!.id) {
      if (!sameParent) {
        group.size = n.size;
        group.userSized = n.userSized;
      }
      return group;
    }
    if (n.type === "row" || n.type === "column") n.children = n.children.map(replace);
    refresh(n, fit);
    return n;
  }
  return replace(root);
}

export function choose(root: Projected, active: Record<string, string> | undefined): void {
  if (!active) return;
  for (const group of autos(root)) {
    const want = active[group.home!];
    const child = want ? group.children.find((c) => contains(c, want)) : undefined;
    if (child) group.active = child.id;
  }
}
/**
 * A tab group the person made has a new first tab (a tab moved or pinned to the front): its fold records and its shown
 * tab are keyed by its first tab (`homeOf`), so they move to the new one. Without it, the records go stale, the folds
 * replay differently, and panes move on a change that never moves anything. The same layout when nothing names `from`.
 */
export function rekey(layout: Layout, from: string, to: string): Layout {
  const o = layout.overlay;
  if (!o || from === to) return layout;
  const auto = `${AUTO_PREFIX}${from}`;
  const named = o.folds.includes(auto) || Object.hasOwn(o.shown, from);
  if (!named) return layout;
  const shown = Object.fromEntries(
    Object.entries(o.shown).map(([home, pane]) => [home === from ? to : home, pane]),
  );
  return withOverlay(layout, {
    ...o,
    folds: o.folds.map((id) => (id === auto ? `${AUTO_PREFIX}${to}` : id)),
    shown,
  });
}
export function withOverlay(layout: Layout, overlay: import("../types").Overlay): Layout {
  const next = { ...layout };
  delete next.overlay;
  const o = { ...overlay };
  if (!o.hidden?.length) delete o.hidden;
  if (o.tucks.length || o.folds.length || Object.keys(o.shown).length || o.hidden) next.overlay = o;
  return next;
}
export const overlayOf = (layout: Layout): import("../types").Overlay =>
  layout.overlay ?? { tucks: [], folds: [], shown: {} };
/** Panes the overlay has taken off screen. */
export const hiddenOf = (layout: Layout): readonly string[] => layout.overlay?.hidden ?? [];
/** Deliberately moved or closed panes no longer belong to their former overlay. Owned draft only. */
export function forget(layout: Layout, ids: readonly string[]): void {
  if (!layout.overlay) return;
  const gone = new Set(ids.flatMap((id) => [id, `${AUTO_PREFIX}${id}`]));
  const o = layout.overlay;
  const next = withOverlay(layout, {
    tucks: o.tucks.filter((t) => !gone.has(t.pane) && !gone.has(t.home)),
    folds: o.folds.filter((id) => !gone.has(id)),
    shown: Object.fromEntries(
      Object.entries(o.shown).filter(([home, pane]) => !gone.has(home) && !gone.has(pane)),
    ),
    hidden: o.hidden?.filter((id) => !gone.has(id)),
  });
  delete layout.overlay;
  if (next.overlay) layout.overlay = next.overlay;
}
