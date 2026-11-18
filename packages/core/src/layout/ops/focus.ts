import type { Edge, LayoutContext, PaneBox, ResolvedLayout, ViewState } from "../types";

export function focus(view: ViewState, pane: string, _ctx: LayoutContext): ViewState {
  if (view.focused === pane && (!view.zoomed || view.zoomed === pane) && view.focusHistory[0] === pane && view.focusHistory.lastIndexOf(pane) === 0) return view;
  return { ...view, focused: pane, ...(view.zoomed ? { zoomed: pane } : {}), focusHistory: [pane, ...view.focusHistory.filter(id => id !== pane)] };
}
const visible = (resolved: ResolvedLayout) => resolved.panes.filter(p => !p.hidden);

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
export function focusDirection(view: ViewState, resolved: ResolvedLayout, dir: Edge, ctx: LayoutContext): ViewState {
  const next = directionalCandidates(view, resolved, dir)[0];
  return next ? focus(view, next.id, ctx) : view;
}
export function focusCycle(view: ViewState, resolved: ResolvedLayout, delta: 1 | -1, ctx: LayoutContext): ViewState {
  const list = visible(resolved);
  if (!list.length) return view;
  const index = list.findIndex(p => p.id === view.focused);
  return focus(view, list[index < 0 ? (delta === 1 ? 0 : list.length - 1) : (index + delta + list.length) % list.length]!.id, ctx);
}

export function toggleZoom(view: ViewState, pane: string, _ctx: LayoutContext): ViewState {
  const next = { ...view }; if (next.zoomed === pane) delete next.zoomed; else next.zoomed = pane; return next;
}
