import * as core from "../layout";
import type { Edge, NodeId, ViewState } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";

export function focus({ s, ctx }: Snapshot, id: NodeId): Outcome {
  if (s.view.focused === id && s.view.focusHistory[0] === id) return null;
  return { op: "focus", view: core.focus(s.view, id, ctx) };
}

/** A focus key moved focus. While zoomed, focus keys switch which pane is zoomed (herdr). */
export function focusMoved({ s, m }: Snapshot, view: ViewState): Outcome {
  if (s.view.zoomed && view.focused && view.focused !== s.view.zoomed) {
    return { op: "zoom", view: { ...view, zoomed: view.focused }, msg: msg.maximised(m.title(view.focused)) };
  }
  return { op: "focus", view };
}

export const focusCycle = (x: Snapshot, delta: 1 | -1) => focusMoved(x, core.focusCycle(x.s.view, x.m.flat, delta, x.ctx));
export const focusDirection = (x: Snapshot, dir: Edge) => focusMoved(x, core.focusDirection(x.s.view, x.m.flat, dir, x.ctx));
/** "Focus pane 1–9" (palette): the nth pane on screen, reading order. */
export function focusIndex(x: Snapshot, n: number): Outcome {
  const id = x.m.flatVisible[n - 1];
  return id ? focusMoved(x, core.focus(x.s.view, id, x.ctx)) : null;
}
/** F6 out of the shelf: the first (or last) pane on screen. */
export const focusEnd = (x: Snapshot, last: boolean) => {
  const id = last ? x.m.visible.at(-1) : x.m.visible[0];
  return id ? focusMoved(x, core.focus(x.s.view, id, x.ctx)) : null;
};

export function checkZoom({ s, m }: Snapshot) {
  if (s.page?.mode === "single") return refuse(msg.singleNoLayout);
  return s.view.focused && (m.panes.length > 1 || s.view.zoomed) ? undefined : refuse();
}

export function toggleZoom({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  if (s.page?.mode === "single") return refuse(msg.singleNoLayout);
  if (!id) return null;
  if (m.panes.length <= 1 && !s.view.zoomed) return null; // one pane alone: zoom does nothing
  const view = core.toggleZoom(core.focus(s.view, id, ctx), id, ctx);
  return { op: "zoom", view, msg: view.zoomed ? msg.maximised(m.title(id)) : msg.restored(m.title(id)) };
}
