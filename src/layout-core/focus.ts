import type { Edge, PaneBox, ResolvedLayout, ViewState } from "./types";

export function focus(view: ViewState, pane: string): ViewState {
  return { ...view, focused: pane, ...(view.zoomed ? { zoomed: pane } : {}), focusHistory: [pane, ...view.focusHistory.filter(id => id !== pane)] };
}
const visible = (resolved: ResolvedLayout) => resolved.panes.filter(p => !p.hiddenInStack);

export function directionalCandidates(view: ViewState, resolved: ResolvedLayout, dir: Edge): PaneBox[] {
  const source = resolved.panes.find(p => p.id === view.focused);
  if (!source) return [];
  const s = source.rect;
  const horizontal = dir === "left" || dir === "right";
  const positive = dir === "right" || dir === "bottom";
  const start = horizontal ? s.x : s.y;
  const length = horizontal ? s.width : s.height;
  const cross = horizontal ? s.y : s.x;
  const crossLength = horizontal ? s.height : s.width;
  const candidates = visible(resolved).flatMap((pane, order) => {
    if (pane.id === source.id) return [];
    const r = pane.rect;
    const p = horizontal ? r.x : r.y;
    const len = horizontal ? r.width : r.height;
    const c = horizontal ? r.y : r.x;
    const cl = horizontal ? r.height : r.width;
    const distance = positive ? p - (start + length) : start - (p + len);
    const overlap = Math.min(cross + crossLength, c + cl) - Math.max(cross, c);
    if (distance < -1e-7 || overlap <= 0) return [];
    const rank = view.focusHistory.indexOf(pane.id);
    return [{ pane, order, distance, overlap, centre: Math.hypot(p + len / 2 - start - length / 2, c + cl / 2 - cross - crossLength / 2), rank: rank < 0 ? Infinity : rank }];
  });
  // MRU breaks ties along the nearest edge, never jumps past a closer column/row.
  candidates.sort((a, b) => Math.abs(a.distance - b.distance) > 1e-7 ? a.distance - b.distance : a.rank - b.rank || b.overlap - a.overlap || a.centre - b.centre || a.order - b.order);
  return candidates.map(c => c.pane);
}
export function focusDirection(view: ViewState, resolved: ResolvedLayout, dir: Edge): ViewState {
  const next = directionalCandidates(view, resolved, dir)[0];
  return next ? focus(view, next.id) : { ...view, focusHistory: [...view.focusHistory] };
}
export function focusCycle(view: ViewState, resolved: ResolvedLayout, delta: 1 | -1): ViewState {
  const list = visible(resolved);
  if (!list.length) return { ...view, focusHistory: [...view.focusHistory] };
  const index = list.findIndex(p => p.id === view.focused);
  return focus(view, list[index < 0 ? (delta === 1 ? 0 : list.length - 1) : (index + delta + list.length) % list.length]!.id);
}
/** Return the snapped value. The caller tracks whether the returned value equals centre. */
export function snapToCentre(value: number, centre: number, wasSnapped: boolean): number {
  return Math.abs(value - centre) <= (wasSnapped ? 16 : 10) ? centre : value;
}
