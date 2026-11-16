import type { Axis, FitOptions, Layout, LayoutNode, PaneNode, Rect, ResolvedLayout, Size, ViewState } from "./types";
import { clone, combined, unfold } from "./model";

interface Bounds { width: number; height: number; maxWidth: number }
interface Projected {
  id: string;
  type: LayoutNode["type"] | "auto";
  size: Size;
  children: Projected[];
  pane?: PaneNode;
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
    if (node.collapsed) {
      if (axis === "row") { bounds.width = edge ? 56 : 40; bounds.maxWidth = bounds.width; }
      else bounds.height = edge ? 56 : 40;
    }
    return { id: node.id, type: "pane", size: node.size, children: [], pane: node, bounds };
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
  const result: Projected = {
    id: `@auto:${children.map(c => `${c.id.length}:${c.id}`).join("")}`,
    type: "auto", children, size: children.map(c => c.size).reduce(combined),
    active: children.find(c => contains(c, view.focused))?.id ?? fallback ?? children[0]!.id,
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
function slots(root: Projected): Projected[] {
  return root.type === "row" || root.type === "column" ? root.children.flatMap(slots) : [root];
}
function foldContext(root: Projected, view: ViewState, fit: FitOptions): boolean {
  const candidates: { pane: Projected; parent: Projected; index: number }[] = [];
  function visit(n: Projected) {
    if (n.type !== "row" && n.type !== "column") return;
    n.children.forEach((c, index) => {
      if (c.pane?.linkedTo && !c.pane.pinned && !c.pane.collapsed && n.children.length > 1) candidates.push({ pane: c, parent: n, index });
      visit(c);
    });
  }
  visit(root);
  candidates.sort((a, b) => a.pane.bounds.width - b.pane.bounds.width);
  const choice = candidates[0];
  if (!choice) return false;
  const { pane, parent, index } = choice;
  const source = parent.children.findIndex(c => c.id === pane.pane!.linkedTo);
  const neighbour = source >= 0 && Math.abs(source - index) === 1 ? source : index > 0 ? index - 1 : index + 1;
  const first = Math.min(index, neighbour);
  const pair = parent.children.slice(first, first + 2);
  parent.children.splice(first, 2, auto(pair, view, fit, parent.children[neighbour]!.id));
  const update = (n: Projected) => { n.children.forEach(update); refresh(n, fit); };
  update(root);
  return true;
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
  while (tooSmall() && foldContext(root, view, fit)) { /* each fold removes a slot */ }
  if ((tooSmall() || slots(root).length > paneCap) && slots(root).length > 1) root = auto(slots(root), view, fit);
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
    const rect = { ...input, width: Math.max(n.bounds.width, Math.min(input.width, n.bounds.maxWidth)), height: Math.max(input.height, n.bounds.height) };
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
    const maxs = n.children.map(c => c.pane?.collapsed ? mins[n.children.indexOf(c)]! : horizontal ? c.bounds.maxWidth : Infinity);
    const lengths = shares(n.children.map((c, i) => ({ size: c.pane?.collapsed ? { px: mins[i]! } : c.size, min: mins[i]!, max: maxs[i] })), length - fit.gap * (n.children.length - 1));
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
