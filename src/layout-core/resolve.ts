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
    const collapsedAxis = node.collapsed ? axis === "row" && edge ? "row" : "column" : undefined;
    if (collapsedAxis === "row") { bounds.width = 56; bounds.maxWidth = 56; }
    if (collapsedAxis === "column") bounds.height = edge ? 56 : 40;
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
function auto(children: Projected[], view: ViewState, fit: FitOptions, fallback?: string): Projected {
  const size = children.map(c => c.size).reduce(combined);
  const preferred = children.find(c => c.id === fallback);
  if (preferred?.type === "auto") fallback = preferred.active;
  // Keep one tab group when a later fold grows an automatic stack.
  children = children.flatMap(c => c.type === "auto" ? c.children : [c]);
  const result: Projected = {
    id: `@auto:${children.map(c => `${c.id.length}:${c.id}`).join("")}`,
    type: "auto", children, size,
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

function foldOne(root: Projected, view: ViewState, fit: FitOptions): Projected | undefined {
  const displayed = slots(root);
  if (displayed.length < 2) return undefined;
  const source = allPanes(root).find(p => p.id === view.focused)?.pane?.linkedTo;
  const unfocused = displayed.filter(n => !contains(n, view.focused));
  const unprotected = unfocused.filter(n => !contains(n, source));
  const unpinned = (n: Projected) => allPanes(n).every(p => !p.pane!.pinned && !p.pane!.collapsed);
  const contexts = unprotected.filter(n => n.pane?.linkedTo && unpinned(n));
  // Exhaust contexts first, then fold remaining slots individually. Keep the focused
  // pane and its source separate until every other displayed slot has been folded.
  const candidates = [contexts, unprotected.filter(unpinned), unprotected, unfocused.filter(unpinned), unfocused].find(group => group.length)!;
  candidates.sort((a, b) => a.bounds.width - b.bounds.width);
  const choice = candidates[0]!;
  function owner(n: Projected): Projected | undefined {
    if (n.type !== "row" && n.type !== "column") return undefined;
    return n.children.includes(choice) ? n : n.children.map(owner).find(Boolean);
  }
  const parent = owner(root)!;
  const index = parent.children.indexOf(choice);
  const before = parent.children[index - 1], after = parent.children[index + 1];
  const neighbours = [before && slots(before).at(-1), after && slots(after)[0]].filter((n): n is Projected => !!n);
  neighbours.sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto") || Number(contains(b, choice.pane?.linkedTo)) - Number(contains(a, choice.pane?.linkedTo)));
  const neighbour = neighbours[0]!;
  const pair = displayed.indexOf(choice) < displayed.indexOf(neighbour) ? [choice, neighbour] : [neighbour, choice];
  const group = auto(pair, view, fit, neighbour.type === "auto" ? neighbour.active : neighbour.id);
  // Across nested splits, the receiving slot keeps its allocation in its own axis.
  const sameParent = parent.children.includes(neighbour);
  root = removeSlot(root, choice.id)!;
  function replace(n: Projected): Projected {
    if (n.id === neighbour.id) { if (!sameParent) group.size = n.size; return group; }
    if (n.type === "row" || n.type === "column") n.children = n.children.map(replace);
    refresh(n, fit);
    return n;
  }
  return replace(root);
}

function foldForCap(root: Projected, view: ViewState, fit: FitOptions): boolean {
  if (root.type !== "row" && root.type !== "column") return false;
  // Structural order is the deterministic age fallback for imported/shared layouts.
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child.pane && !child.pane.pinned && child.id !== view.focused && root.children.length > 1) {
      const neighbour = i > 0 ? i - 1 : i + 1;
      const first = Math.min(i, neighbour);
      const pair = root.children.slice(first, first + 2);
      const selected = root.children[neighbour]!.id;
      root.children.splice(first, 2, auto(pair, view, fit, selected));
      refresh(root, fit);
      return true;
    }
    if (foldForCap(child, view, fit)) { refresh(root, fit); return true; }
  }
  return false;
}

function build(layout: Layout, view: ViewState, fit: FitOptions, paneCap: number): Projected {
  let root = project(unfold(clone(layout.root)), fit);
  const tooSmall = () => root.bounds.width > fit.width + 1e-7 || root.bounds.height > fit.height + 1e-7;
  while (slots(root).length > paneCap && foldForCap(root, view, fit)) { /* enforce live-slot budget */ }
  while (tooSmall() || slots(root).length > paneCap) {
    const next = foldOne(root, view, fit);
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
  const result: ResolvedLayout = { panes: [], dividers: [], folded: [] };
  function draw(n: Projected, input: Rect, stackId?: string, hidden = false, folded = false): void {
    const rect = { ...input, width: Math.max(n.bounds.width, Math.min(input.width, n.bounds.maxWidth)), height: n.collapsedAxis === "column" ? n.bounds.height : Math.max(input.height, n.bounds.height) };
    if (n.pane) {
      result.panes.push({ id: n.id, rect, ...(stackId ? { stackId, hiddenInStack: hidden } : {}) });
      if (folded) result.folded.push(n.id);
      return;
    }
    if (n.type === "stack" || n.type === "auto") {
      const selected = n.children.find(c => c.id === n.active) ?? n.children[0]!;
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
