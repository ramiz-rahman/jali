import * as core from "../layout/engine";
import type { Edge, NodeId, ViewState } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import type { Step } from "./step";
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
/** A focus key (⌘K "Focus pane to the left", Alt+arrows): from the focused pane, so there must be one. */
export const focusDirection: Step<[Edge]> = {
  check: ({ s }) => (s.view.focused ? undefined : refuse("unavailable")),
  run: (x, dir) => focusMoved(x, core.focusDirection(x.s.view, x.m.flat, dir, x.ctx)),
};
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

/**
 * Maximise pane `id` (default: the focused one), or restore it. Every surface that offers it (the header, the tab menu,
 * ⌘K) asks this step's check. Restoring is always possible; maximising needs another pane, a pane on screen, a layout
 * (not a page's Single view) and the app's `allow`.
 */
export const toggleZoom: Step<[NodeId?]> = {
  check({ s, m }, id = s.view.focused) {
    if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
    if (!id || !m.pane(id)) return refuse("nothing-to-do");
    if (s.view.zoomed === id) return undefined;
    if (m.panes.length <= 1 && !s.view.zoomed) return refuse("nothing-to-do");
    return offScreen(m, id) ? refuse("blocked", say(m).notOnScreen(m.title(id))) : undefined;
  },
  // Restoring is a way out: whatever `allow` says now.
  control: ({ s }, id = s.view.focused) => (s.view.zoomed === id ? [] : [["maximise", id]]),
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    // Maximised unless it is now: another pane maximised meanwhile makes this one the maximised pane, never restores
    // (focus alone would carry the zoom over to it first, and the toggle then undo it).
    const focused = core.focus(core.tree.unzoom(s.view), id, ctx);
    const view = s.view.zoomed === id ? focused : { ...focused, zoomed: id };
    return {
      op: "zoom",
      view,
      msg: view.zoomed ? say(m).maximised(m.title(id)) : say(m).restored(m.title(id)),
      // Leaving maximise leaves full screen too: full screen is a maximised pane on the whole screen.
      ...(s.fullScreen ? { patch: { fullScreen: undefined } } : {}),
    };
  },
};

/** What putting pane `id` on the whole screen needs: a layout (not a page's Single view) and the pane on screen. */
function canEnter({ s, m }: Snapshot, id: NodeId | undefined) {
  if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
  if (!id || !m.pane(id)) return refuse("not-found");
  return offScreen(m, id) ? refuse("blocked", say(m).notOnScreen(m.title(id))) : undefined;
}

/**
 * Full screen: the pane maximised, and the page on the whole screen (the adapter asks the browser), so the pane covers
 * the display. Again, or Escape, or leaving the browser's full screen, puts it back as it was. Leaving is always
 * possible; entering needs a pane on screen, a layout (not a page's Single view) and the app's `allow`.
 */
export const toggleFullScreen: Step<[NodeId?]> = {
  check: (x, id = x.s.view.focused) => (x.s.fullScreen ? undefined : canEnter(x, id)),
  control: ({ s }, id = s.view.focused) => (s.fullScreen ? [] : [["fullScreen", id]]),
  run(x, id = x.s.view.focused!) {
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
    const focused = core.focus(s.view, id, ctx);
    const view =
      m.panes.length > 1 && focused.zoomed !== id ? core.toggleZoom(focused, id, ctx) : focused;
    return { op: "zoom", view, patch: { fullScreen: id }, msg: say(m).fullScreen(m.title(id)) };
  },
};

/**
 * A menu's Maximise or Restore, Full screen or Exit full screen: pane `id` set to what the menu showed (`on`), whatever
 * another pane is now. Maximise A while B is maximised maximises A; Restore A once A isn't maximised does nothing.
 */
export const setZoom: Step<[NodeId, boolean]> = {
  check: (x, id, on) =>
    (x.s.view.zoomed === id) === on ? refuse("nothing-to-do") : toggleZoom.check!(x, id),
  control: (x, id, on) => (on ? [["maximise", id]] : []),
  run: (x, id) => toggleZoom.run(x, id),
};

/** See `setZoom`: another pane on the whole screen leaves it first. */
export const setFullScreen: Step<[NodeId, boolean]> = {
  check: (x, id, on) =>
    (x.s.fullScreen === id) === on ? refuse("nothing-to-do") : on ? canEnter(x, id) : undefined,
  control: (x, id, on) => (on ? [["fullScreen", id]] : []),
  run: (x, id, on) =>
    on && x.s.fullScreen
      ? [toggleFullScreen.run(x), (y: Snapshot) => toggleFullScreen.run(y, id)]
      : toggleFullScreen.run(x, id),
};
