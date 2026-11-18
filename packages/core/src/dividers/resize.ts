/** Divider math, pure: the two neighbours of a divider, snap and clamp, and the divider nearest a pane. */
import * as core from "../layout";
import type { DividerBox, LayoutNode, NodeId, Rect, ResolvedLayout } from "../layout/types";
import type { WorkspaceModel } from "../state/model";
import { GAP } from "../tokens";

/** Keyboard resize steps: arrows, and Shift+arrows. */
/** `parentId:index`, written as data-divider on the separator (the drag finds neighbours' dividers by it). */
export const dividerKey = (d: { parentId: NodeId; index: number }) => `${d.parentId}:${d.index}`;

export const STEP = 16;
export const STEP_BIG = 64;

export const SNAP_IN = core.SNAP_IN;
export const SNAP_OUT = core.SNAP_OUT;

/** Snap to the centre with hysteresis (the layout model owns the rule): in within 10px, out beyond 16px. */
export function snap(size: number, centre: number, wasSnapped: boolean): { size: number; snapped: boolean } {
  const value = core.snapToCentre(size, centre, wasSnapped);
  return { size: value, snapped: value === centre };
}

export const clampSize = (size: number, min: number, max: number) => Math.max(min, Math.min(max, size));

function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width)), y2 = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

export interface PairGeometry {
  divider: DividerBox;
  axis: "row" | "column";
  a: { ids: NodeId[]; size: number; min: number; label: string };
  b: { ids: NodeId[]; size: number; min: number; label: string };
  /** Usable length: a + b (gap excluded). */
  total: number;
}

/** The two neighbours of a divider, measured from resolved pane boxes. */
export function geometryFor(m: WorkspaceModel, d: DividerBox, r: ResolvedLayout = m.resolved): PairGeometry | null {
  const parent = core.tree.find(m.layout.root, d.parentId);
  const split = parent && core.tree.isSplit(parent) ? parent : undefined;
  const under = (n: LayoutNode | undefined) => (n ? core.tree.panes(n).map((p) => p.id) : []);
  // Prefer resolve's neighbours: the fit step can group several original siblings at one divider.
  const idsA = d.neighbours?.[0] ?? under(split?.children[d.index]);
  const idsB = d.neighbours?.[1] ?? under(split?.children[d.index + 1]);
  const byId = new Map(r.panes.filter((b) => !b.hidden).map((b) => [b.id, b.rect]));
  const rects = (ids: NodeId[]) => ids.flatMap((id) => byId.get(id) ?? []);
  if (!union(rects(idsA)) || !union(rects(idsB))) return null;
  const label = (ids: NodeId[]) => (ids.length <= 3 ? ids.map((i) => m.title(i)).join(", ") : `${ids.slice(0, 2).map((i) => m.title(i)).join(", ")}, +${ids.length - 2} more`);
  const sa = core.extentAlong(r.panes, idsA, d.axis), sb = core.extentAlong(r.panes, idsB, d.axis);
  return {
    divider: d,
    axis: d.axis,
    // DividerBox.min/max bound the first neighbour's extent (the layout model clamps with them too).
    a: { ids: idsA, size: sa, min: d.min, label: label(idsA) },
    b: { ids: idsB, size: sb, min: Math.max(0, sa + sb - d.max), label: label(idsB) },
    total: sa + sb,
  };
}

/** For resize mode: the divider beside a pane on its far side, else its near side, along one axis. */
export function nearestDivider(m: WorkspaceModel, paneId: NodeId, horizontal: boolean): DividerBox | null {
  const box = m.resolved.panes.find((b) => b.id === paneId && !b.hidden);
  if (!box) return null;
  const p = box.rect;
  const [start, end, crossStart, crossLen] = horizontal ? ["x", "width", "y", "height"] as const : ["y", "height", "x", "width"] as const;
  const overlaps = (d: DividerBox) => d.rect[crossStart] < p[crossStart] + p[crossLen] && d.rect[crossStart] + d.rect[crossLen] > p[crossStart];
  const cands = m.resolved.dividers.filter((d) => d.axis === (horizontal ? "row" : "column") && overlaps(d));
  return cands.find((d) => Math.abs(d.rect[start] - (p[start] + p[end])) <= GAP)
    ?? cands.find((d) => Math.abs(d.rect[start] + d.rect[end] - p[start]) <= GAP)
    ?? null;
}
