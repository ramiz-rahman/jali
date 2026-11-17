/**
 * Single view (phone): one pane at a time; the layout is untouched. Widening out restores the arrangement seen just
 * before it began: each stack's active tab and the visible set, provided the layout kept its shape meanwhile. Pure.
 */
import * as core from "../../layout-core";
import type { LayoutNode, NodeId, ViewState } from "../../layout-core/types";
import type { Outcome, Snapshot } from "../state/apply";
import type { WorkspaceModel } from "../state/model";

export interface WideSnapshot {
  /** Tree shape only (ids, types, order): sizes and active tabs may change without invalidating a restore. */
  shape: string;
  /** Each deliberate stack's active tab. */
  active: Record<NodeId, NodeId>;
  view: ViewState;
}

export function snapshotWide(m: WorkspaceModel, view: ViewState): WideSnapshot {
  const active: Record<NodeId, NodeId> = {};
  (function walk(n: LayoutNode) {
    if (n.type === "pane") return;
    if (n.type === "stack") active[n.id] = n.active;
    n.children.forEach((c) => walk(c));
  })(m.layout.root);
  return { shape: core.tree.shape(m.layout.root), active, view };
}

/**
 * Focus was moved by the switcher meanwhile; the earlier view is used only if it reproduces the earlier visible set
 * (an automatic fold shows its focused tab), otherwise the current view stays. Folds were refitted for the width.
 */
export function restoreWide({ s, ctx }: Snapshot, snap: WideSnapshot): Outcome {
  if (snap.shape !== core.tree.shape(s.layout.root)) return null;
  let layout = s.layout;
  for (const [stackId, tab] of Object.entries(snap.active)) {
    const st = core.tree.find(layout.root, stackId);
    if (st?.type === "stack" && st.active !== tab && st.children.some((c) => c.id === tab)) layout = core.setActiveTab(layout, stackId, tab, ctx);
  }
  const shown = new Set(core.resolve(layout, s.view, ctx).panes.filter((b) => !b.hidden).map((b) => b.id));
  const cur = s.view;
  const earlier: ViewState = { ...snap.view, ...(cur.peek ? { peek: cur.peek } : {}) };
  if (!cur.peek) delete earlier.peek;
  delete earlier.zoomed;
  const view = !cur.focused || shown.has(cur.focused) || !earlier.focused || !shown.has(earlier.focused) ? cur : earlier;
  if (layout === s.layout && view === s.view) return null;
  return { op: "wide", layout, view };
}
