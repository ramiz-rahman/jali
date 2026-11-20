import { notAllowed } from "./allow";
import * as core from "../layout";
import type { Edge, NodeId, ViewState } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { reveal } from "./tuck";

export function focus({ s, ctx }: Snapshot, id: NodeId): Outcome {
  if (s.view.focused === id && s.view.focusHistory[0] === id) return null;
  return { op: "focus", view: core.focus(s.view, id, ctx) };
}

/**
 * `jali.actions.focus`: focus a pane and show it. A pane behind a tab (folded, tucked or a tab of a group) has its tab
 * chosen, a swap: nothing else moves (reveal). While another pane is maximised, this one is maximised instead, as the
 * focus keys do.
 */
export function focusShown(x: Snapshot, id: NodeId): Outcome {
  const box = x.m.resolved.panes.find((b) => b.id === id);
  if (box?.hidden && box.stackId) return reveal(x, id);
  if (x.s.view.focused === id && x.s.view.focusHistory[0] === id) return null;
  return focusMoved(x, core.focus(x.s.view, id, x.ctx));
}

/** A pane that is in the layout but has no place on screen (hidden: no slot, no tab). */
const offScreen = (m: Snapshot["m"], id: NodeId) =>
  m.resolved.panes.some((b) => b.id === id && b.hidden === "off");

/** A focus key moved focus. While zoomed, focus keys switch which pane is zoomed (herdr), to a pane on screen. */
export function focusMoved({ s, m }: Snapshot, view: ViewState): Outcome {
  if (
    s.view.zoomed &&
    view.focused &&
    view.focused !== s.view.zoomed &&
    !offScreen(m, view.focused)
  ) {
    return {
      op: "zoom",
      view: { ...view, zoomed: view.focused },
      msg: say(m).maximised(m.title(view.focused)),
    };
  }
  return { op: "focus", view };
}

export const focusCycle = (x: Snapshot, delta: 1 | -1) =>
  focusMoved(x, core.focusCycle(x.s.view, x.m.flat, delta, x.ctx));
export const focusDirection = (x: Snapshot, dir: Edge) =>
  focusMoved(x, core.focusDirection(x.s.view, x.m.flat, dir, x.ctx));
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
  if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
  return s.view.focused && (m.panes.length > 1 || s.view.zoomed)
    ? undefined
    : refuse("nothing-to-do");
}

export function toggleZoom(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
  if (!id) return null;
  // Restoring is always allowed: only maximising can be turned off, and only a pane on screen can be maximised.
  if (s.view.zoomed !== id) {
    if (offScreen(m, id)) return refuse("blocked", say(m).notOnScreen(m.title(id)));
    const denied = notAllowed(x, id, "maximise");
    if (denied) return denied;
  }
  if (m.panes.length <= 1 && !s.view.zoomed) return null; // one pane alone: zoom does nothing
  const view = core.toggleZoom(core.focus(s.view, id, ctx), id, ctx);
  return {
    op: "zoom",
    view,
    msg: view.zoomed ? say(m).maximised(m.title(id)) : say(m).restored(m.title(id)),
    // Leaving maximise leaves full screen too: full screen is a maximised pane on the whole screen.
    ...(s.fullScreen ? { patch: { fullScreen: undefined } } : {}),
  };
}

/**
 * Full screen: the pane maximised, and the workspace's page on the whole screen (the adapter asks the browser), so
 * the pane covers the display. Again, or Escape, or leaving the browser's full screen, puts it back as it was.
 */
export function toggleFullScreen(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  if (s.fullScreen) {
    const was = s.fullScreen;
    const view = s.view.zoomed === was ? core.tree.unzoom(s.view) : s.view;
    return {
      op: "zoom",
      view,
      patch: { fullScreen: undefined },
      msg: say(m).fullScreenOff(m.title(was)),
    };
  }
  if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
  if (!id || !m.pane(id)) return refuse("not-found");
  if (offScreen(m, id)) return refuse("blocked", say(m).notOnScreen(m.title(id)));
  const denied = notAllowed(x, id, "fullScreen");
  if (denied) return denied;
  const focused = core.focus(s.view, id, ctx);
  const view =
    m.panes.length > 1 && focused.zoomed !== id ? core.toggleZoom(focused, id, ctx) : focused;
  return { op: "zoom", view, patch: { fullScreen: id }, msg: say(m).fullScreen(m.title(id)) };
}
