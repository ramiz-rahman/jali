import type { Axis, FitOptions, Layout, LayoutNode, PaneNode, Rect, ResolvedLayout, Size, ViewState } from "./types";
import { clone, combined, unfold } from "./model";

interface Bounds { width: number; height: number; maxWidth: number }
interface Projected {
  id: string;
  type: LayoutNode["type"] | "auto";
  size: Size;
  children: Projected[];
  pane?: PaneNode;
  collapsedAxis?: Axis;
  active?: string;
  /** Pane the automatic stack formed around (the folded panes' related home). */
  home?: string;
  bounds: Bounds;
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export interface Share { size: Size; min: number; max?: number }

/** Fixed pixels first; weighted children freeze at their bounds and re-share the remainder. */
export function shares(items: Share[], available: number): number[] {
  const values = items.map(() => 0);
  const minimum = items.reduce((sum, item) => sum + item.min, 0);
  const budget = Math.max(available, minimum);
  const fixed = items.flatMap((item, i) => "px" in item.size ? [i] : []);
  const weighted = items.flatMap((item, i) => "weight" in item.size ? [i] : []);
  for (const i of fixed) values[i] = clamp((items[i]!.size as { px: number }).px, items[i]!.min, items[i]!.max ?? Infinity);
  const fixedTotal = fixed.reduce((sum, i) => sum + values[i]!, 0);
  const weightedMin = weighted.reduce((sum, i) => sum + items[i]!.min, 0);
  // A saved px preference cannot crowd out another child's hard minimum after a viewport shrink.
  const excess = Math.max(0, fixedTotal + weightedMin - budget);
  const slack = fixed.reduce((sum, i) => sum + values[i]! - items[i]!.min, 0);
  if (excess && slack) for (const i of fixed) values[i] = values[i]! - excess * (values[i]! - items[i]!.min) / slack;
  let remaining = budget - fixed.reduce((sum, i) => sum + values[i]!, 0);
  let pending = weighted;
  while (pending.length) {
    const weight = pending.reduce((sum, i) => sum + (items[i]!.size as { weight: number }).weight, 0);
    const raw = new Map(pending.map(i => [i, remaining * (items[i]!.size as { weight: number }).weight / weight]));
    const boundedTotal = pending.reduce((sum, i) => sum + clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity), 0);
    const freezeMin = boundedTotal > remaining + 1e-7;
    const freeze = pending.filter(i => freezeMin ? raw.get(i)! < items[i]!.min : raw.get(i)! > (items[i]!.max ?? Infinity));
    if (!freeze.length) {
      for (const i of pending) values[i] = clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity);
      break;
    }
    for (const i of freeze) {
      values[i] = freezeMin ? items[i]!.min : (items[i]!.max ?? Infinity);
      remaining -= values[i]!;
    }
    pending = pending.filter(i => !freeze.includes(i));
  }
  // Never leave a void: hand leftover space to children that can grow (fixed-px preferences included), in proportion, up to their max.
  let leftover = budget - values.reduce((sum, v) => sum + v, 0);
  let growable = items.map((_, i) => i).filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
  while (leftover > 1e-6 && growable.length) {
    const base = growable.reduce((sum, i) => sum + Math.max(values[i]!, 1), 0);
    let given = 0;
    for (const i of growable) {
      const add = Math.min(leftover * Math.max(values[i]!, 1) / base, (items[i]!.max ?? Infinity) - values[i]!);
      values[i] = values[i]! + add; given += add;
    }
    leftover -= given;
    growable = growable.filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
    if (given < 1e-9) break;
  }
  return values;
}

function refresh(node: Projected, fit: FitOptions): void {
  if (node.pane) return;
  const children = node.children;
  const widths = children.map(c => c.bounds.width);
  const heights = children.map(c => c.bounds.height);
  const maxima = children.map(c => c.bounds.maxWidth);
  const gaps = Math.max(0, children.length - 1) * fit.gap;
  if (node.type === "row") node.bounds = { width: widths.reduce((a, b) => a + b, 0) + gaps, height: Math.max(...heights), maxWidth: maxima.reduce((a, b) => a + b, 0) + gaps };
  else if (node.type === "column") node.bounds = { width: Math.max(...widths), height: heights.reduce((a, b) => a + b, 0) + gaps, maxWidth: Math.max(Math.max(...widths), Math.min(...maxima)) };
  else node.bounds = { width: Math.max(...widths), height: Math.max(...heights), maxWidth: Math.max(Math.max(...widths), Math.min(...maxima)) };
}
function project(node: LayoutNode, fit: FitOptions, axis: Axis = "row", edge = true): Projected {
  if (node.type === "pane") {
    const kind = fit.kinds[node.ref.kind];
    if (!kind) throw new Error(`Unknown pane kind: ${node.ref.kind}`);
    const bounds = { width: kind.minWidth, height: kind.minHeight, maxWidth: kind.maxWidth ?? Infinity };
    // Founder review, 17 Nov: in a row every minimised pane becomes a 56px rail (edge or middle); in a column it becomes its 40px header strip.
    const collapsedAxis = node.collapsed ? axis : undefined;
    if (collapsedAxis === "row") { bounds.width = 56; bounds.maxWidth = 56; }
    if (collapsedAxis === "column") bounds.height = 40;
    return { id: node.id, type: "pane", size: node.size, children: [], pane: node, collapsedAxis, bounds };
  }
  const nextAxis = node.type === "stack" ? axis : node.type;
  const result: Projected = {
    id: node.id, type: node.type === "stack" && node.origin === "auto" ? "auto" : node.type, size: node.size,
    active: node.type === "stack" ? node.active : undefined,
    children: node.children.map((c, i) => project(c, fit, nextAxis, node.type === "stack" ? edge : i === 0 || i === node.children.length - 1)),
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
const allPanes = (n: Projected): Projected[] => n.pane ? [n] : n.children.flatMap(allPanes);
const contains = (n: Projected, id?: string): boolean => !!id && allPanes(n).some(p => p.id === id);
const homeOf = (n: Projected): string => n.type === "auto" ? n.home ?? allPanes(n)[0]!.id : n.pane ? n.id : n.type === "stack" ? n.active ?? allPanes(n)[0]!.id : allPanes(n)[0]!.id;
const orderOf = (n: Projected, order: Map<string, number>) => Math.min(...allPanes(n).map(p => order.get(p.id) ?? Infinity));
function auto(children: Projected[], view: ViewState, fit: FitOptions, order: Map<string, number>, home: Projected, fallback?: string): Projected {
  const size = children.map(c => c.size).reduce(combined);
  const homeId = homeOf(home);
  const preferred = children.find(c => c.id === fallback);
  if (preferred?.type === "auto") fallback = preferred.active;
  // Keep one tab group when a later fold grows an automatic stack; tabs stay in reading order.
  children = children.flatMap(c => c.type === "auto" ? c.children : [c]).sort((a, b) => orderOf(a, order) - orderOf(b, order));
  const result: Projected = {
    id: `@auto:${children.map(c => `${c.id.length}:${c.id}`).join("")}`,
    type: "auto", children, size, home: homeId,
    active: children.find(c => contains(c, view.focused))?.id ?? fallback ?? children[0]!.id,
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
function slots(root: Projected): Projected[] {
  return root.type === "row" || root.type === "column" ? root.children.flatMap(slots) : [root];
}
/** Remove one displayed slot, retaining the outer size of pruned singleton splits. */
function removeSlot(node: Projected, id: string): Projected | undefined {
  if (node.id === id) return undefined;
  if (node.type !== "row" && node.type !== "column") return node;
  node.children = node.children.flatMap(c => { const next = removeSlot(c, id); return next ? [next] : []; });
  if (!node.children.length) return undefined;
  return node.children.length === 1 ? { ...node.children[0]!, size: node.size } : node;
}

const cmp = (a: number, b: number) => a === b ? 0 : a < b ? -1 : 1;
/**
 * Fold one displayed slot into its related home. Protected: the focused pane, its source and its direct details.
 * Order: unprotected unpinned, unprotected pinned, protected unpinned, protected pinned, the focused slot.
 * Within a tier: unlinked panes, then the far end of link chains (deepest from focus), then least recently
 * focused, then narrowest. The folded slot joins its source's slot, else a direct detail's, else its nearest neighbour.
 */
function foldOne(root: Projected, view: ViewState, fit: FitOptions, order: Map<string, number>): Projected | undefined {
  const displayed = slots(root);
  if (displayed.length < 2) return undefined;
  const panes = allPanes(root);
  const ids = new Set(panes.map(p => p.id));
  const linkOf = (p: Projected) => p.pane!.linkedTo && ids.has(p.pane!.linkedTo) ? p.pane!.linkedTo : undefined;
  const focused = view.focused && ids.has(view.focused) ? view.focused : undefined;
  const protectedIds = new Set<string>();
  if (focused) {
    protectedIds.add(focused);
    const source = linkOf(panes.find(p => p.id === focused)!);
    if (source) protectedIds.add(source);
    for (const p of panes) if (linkOf(p) === focused) protectedIds.add(p.id);
  }
  // Undirected link distance from the focused pane; unreachable chains are infinitely far.
  const distance = new Map<string, number>();
  if (focused) {
    distance.set(focused, 0);
    for (let queue = [focused]; queue.length;) {
      const id = queue.shift()!;
      for (const p of panes) {
        const near = linkOf(p) === id ? p.id : p.id === id ? linkOf(p) : undefined;
        if (near && !distance.has(near)) { distance.set(near, distance.get(id)! + 1); queue.push(near); }
      }
    }
  }
  const linkedIds = new Set(panes.flatMap(p => linkOf(p) ? [p.id, linkOf(p)!] : []));
  const rank = (id: string) => { const i = view.focusHistory.indexOf(id); return i < 0 ? Infinity : i; };
  const score = (slot: Projected) => {
    const members = allPanes(slot);
    const pinned = members.some(p => p.pane!.pinned || p.pane!.collapsed);
    const tier = members.some(p => p.id === focused) ? 4 : members.some(p => protectedIds.has(p.id)) ? 2 + Number(pinned) : Number(pinned);
    return {
      slot, tier, linked: Number(members.some(p => linkedIds.has(p.id))),
      depth: Math.max(...members.map(p => distance.get(p.id) ?? Infinity)),
      recent: Math.min(...members.map(p => rank(p.id))), width: slot.bounds.width, order: orderOf(slot, order),
    };
  };
  const ranked = displayed.map(score).sort((a, b) => cmp(a.tier, b.tier) || cmp(a.linked, b.linked) || cmp(b.depth, a.depth) || cmp(b.recent, a.recent) || cmp(a.width, b.width) || cmp(a.order, b.order));
  const choice = ranked[0]!.slot;
  function owner(n: Projected): Projected | undefined {
    if (n.type !== "row" && n.type !== "column") return undefined;
    return n.children.includes(choice) ? n : n.children.map(owner).find(Boolean);
  }
  const parent = owner(root)!;
  const members = new Set(allPanes(choice).map(p => p.id));
  const outside = (id: string | undefined) => id && !members.has(id) ? displayed.find(s => s !== choice && contains(s, id)) : undefined;
  const sources = allPanes(choice).map(p => outside(linkOf(p))).filter((s): s is Projected => !!s);
  const details = panes.filter(p => !members.has(p.id) && members.has(linkOf(p) ?? "")).map(p => displayed.find(s => contains(s, p.id))!);
  let home = sources[0] ?? details[0];
  if (!home) {
    // Unlinked (or only linked within itself): nearest neighbour, preferring an existing automatic stack.
    const at = displayed.indexOf(choice);
    const near = [displayed[at - 1], displayed[at + 1]].filter((n): n is Projected => !!n);
    near.sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto"));
    home = near[0]!;
  }
  const pair = displayed.indexOf(choice) < displayed.indexOf(home) ? [choice, home] : [home, choice];
  const group = auto(pair, view, fit, order, home, home.type === "auto" ? home.active : home.id);
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

function foldForCap(root: Projected, view: ViewState, fit: FitOptions, order: Map<string, number>): boolean {
  if (root.type !== "row" && root.type !== "column") return false;
  // Structural order is the deterministic age fallback for imported/shared layouts.
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child.pane && !child.pane.pinned && child.id !== view.focused && root.children.length > 1) {
      const neighbour = i > 0 ? i - 1 : i + 1;
      const first = Math.min(i, neighbour);
      const pair = root.children.slice(first, first + 2);
      const selected = root.children[neighbour]!.id;
      root.children.splice(first, 2, auto(pair, view, fit, order, root.children[neighbour]!, selected));
      refresh(root, fit);
      return true;
    }
    if (foldForCap(child, view, fit, order)) { refresh(root, fit); return true; }
  }
  return false;
}

function build(layout: Layout, view: ViewState, fit: FitOptions, paneCap: number): Projected {
  let root = project(unfold(clone(layout.root)), fit);
  const tooSmall = () => root.bounds.width > fit.width + 1e-7 || root.bounds.height > fit.height + 1e-7;
  const order = new Map(allPanes(root).map((p, i) => [p.id, i]));
  while (slots(root).length > paneCap && foldForCap(root, view, fit, order)) { /* enforce live-slot budget */ }
  while (tooSmall() || slots(root).length > paneCap) {
    const next = foldOne(root, view, fit, order);
    if (!next) break;
    root = next;
  }
  return root;
}
export function minimum(node: LayoutNode, fit: FitOptions, axis: Axis, edge = true): number {
  const bounds = project(node, fit, axis, edge).bounds;
  return axis === "row" ? bounds.width : bounds.height;
}
export function canFit(layout: Layout, fit: FitOptions, unfoldAuto = true): boolean {
  const root = project(unfoldAuto ? unfold(clone(layout.root)) : layout.root, fit);
  return root.bounds.width <= fit.width && root.bounds.height <= fit.height;
}
export function resolve(layout: Layout, view: ViewState, fit: FitOptions, paneCap = Infinity): ResolvedLayout {
  if (![fit.width, fit.height, fit.gap].every(Number.isFinite) || fit.width < 0 || fit.height < 0 || fit.gap < 0) throw new RangeError("Fit dimensions and gap must be finite and non-negative");
  const root = build(layout, view, fit, paneCap);
  const result: ResolvedLayout = { panes: [], dividers: [], folded: [], stacks: [] };
  function draw(n: Projected, input: Rect, stackId?: string, hidden = false, folded = false): void {
    const rect = { ...input, width: Math.max(n.bounds.width, Math.min(input.width, n.bounds.maxWidth)), height: n.collapsedAxis === "column" ? n.bounds.height : Math.max(input.height, n.bounds.height) };
    if (n.pane) {
      result.panes.push({ id: n.id, rect, ...(stackId ? { stackId, hiddenInStack: hidden } : {}) });
      if (folded) result.folded.push(n.id);
      return;
    }
    if (n.type === "stack" || n.type === "auto") {
      const selected = n.children.find(c => c.id === n.active) ?? n.children[0]!;
      if (n.type === "auto" && !stackId) {
        const homeId = n.home ?? allPanes(n)[0]!.id;
        result.stacks.push({ id: n.id, origin: "auto", homeId, foldedCount: n.children.filter(c => !contains(c, homeId)).reduce((sum, c) => sum + allPanes(c).length, 0), paneIds: allPanes(n).map(p => p.id) });
      }
      n.children.forEach(c => draw(c, rect, stackId ?? n.id, hidden || c !== selected, folded || (n.type === "auto" && c !== selected)));
      return;
    }
    const axis: Axis = n.type === "row" ? "row" : "column";
    const horizontal = axis === "row";
    const length = horizontal ? rect.width : rect.height;
    const mins = n.children.map(c => horizontal ? c.bounds.width : c.bounds.height);
    const maxs = n.children.map((c, i) => c.collapsedAxis === axis ? mins[i]! : horizontal ? c.bounds.maxWidth : Infinity);
    const lengths = shares(n.children.map((c, i) => ({ size: c.collapsedAxis === axis ? { px: mins[i]! } : c.size, min: mins[i]!, max: maxs[i] })), length - fit.gap * (n.children.length - 1));
    let offset = horizontal ? rect.x : rect.y;
    n.children.forEach((child, index) => {
      const extent = lengths[index]!;
      const childRect = horizontal ? { x: offset, y: rect.y, width: extent, height: rect.height } : { x: rect.x, y: offset, width: rect.width, height: extent };
      draw(child, childRect, stackId, hidden, folded);
      offset += extent;
      if (index < n.children.length - 1) {
        const total = extent + lengths[index + 1]!;
        const min = Math.max(mins[index]!, total - maxs[index + 1]!);
        const max = Math.min(maxs[index]!, total - mins[index + 1]!);
        result.dividers.push({ parentId: n.id, index, axis, min, max, value: extent, neighbours: [allPanes(child).map(p => p.id), allPanes(n.children[index + 1]!).map(p => p.id)], rect: horizontal ? { x: offset, y: rect.y, width: fit.gap, height: rect.height } : { x: rect.x, y: offset, width: rect.width, height: fit.gap } });
        offset += fit.gap;
      }
    });
  }
  draw(root, { x: 0, y: 0, width: Math.max(fit.width, root.bounds.width), height: Math.max(fit.height, root.bounds.height) });
  // Zoom overlays geometry; the canonical tree and all split sizes remain intact.
  const zoom = result.panes.find(p => p.id === view.zoomed);
  if (zoom) {
    const selected = allPanes(root).find(p => p.id === zoom.id)!;
    for (const p of result.panes) p.hiddenInStack = p !== zoom;
    zoom.rect = { x: 0, y: 0, width: Math.max(fit.width, selected.bounds.width), height: Math.max(fit.height, selected.bounds.height) };
    result.dividers = [];
  }
  return result;
}
