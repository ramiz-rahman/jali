import * as core from "../layout";
import type { NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg, toasts } from "../state/messages";
import { pushUndo } from "../state/undo";
import { putBack } from "./tuck";
import { backToPage, hideRole } from "./page";

const unzoomed = core.tree.unzoom;

export function close(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  if (!id || !m.pane(id)) return null;
  // In a curated page a view is never closed for good: it goes back to the tabs.
  if (s.page && m.pane(id)!.role)
    return s.page.mode === "single" ? refuse("single-view", msg.singleNoLayout) : hideRole(x, id);
  if (m.panes.length <= 1) return refuse("last-pane", msg.lastPaneStays);
  const title = m.title(id);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "close",
    layout: r.layout,
    view: r.view,
    msg: msg.closed(title),
    toast: toasts.closed(title),
    undo: pushUndo(s.undoStack, r.undo),
    patch: s.peekSource === id ? { peekSource: undefined } : undefined,
  };
}

/**
 * The host closed this pane's object elsewhere (`jali.actions.remove`): the pane goes quietly, with no undo, toast or
 * announcement, and without asking (the host decided; neither `beforeClose` nor "Discard unsaved changes?" runs).
 * The address is replaced, so Back never returns to it. The last pane becomes the launcher, the workspace's "choose
 * what to show"; without a launcher it stays (`"last-pane"`). A curated page's views are the page's, not the host's.
 */
export function remove(x: Snapshot, id: NodeId): Outcome {
  const { s, m, ctx, env } = x;
  const p = m.pane(id);
  if (!p) return refuse("not-found");
  if (s.page && p.role) return refuse("unavailable");
  const patch = s.peekSource === id ? { peekSource: undefined } : undefined;
  if (m.panes.length <= 1) {
    if (!env.launcher) return refuse("last-pane");
    const ref = { kind: env.launcher, params: {} };
    return {
      op: "remove",
      layout: core.setRef(s.layout, s.view, id, ref, ctx, { hold: false }),
      view: core.focus(unzoomed(s.view), id, ctx),
      allowed: true,
      patch,
      result: id,
    };
  }
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return { op: "remove", layout: r.layout, view: r.view, allowed: true, patch };
}

export function closeOthers(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  if (s.page) return backToPage(x);
  if (!id) return null;
  if (m.panes.length <= 1) return refuse("nothing-to-do", msg.noOtherPanes);
  const r = core.closeOthers(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "closeOthers",
    layout: r.layout,
    view: r.view,
    msg: msg.othersClosed,
    toast: toasts.othersClosed(),
    undo: pushUndo(s.undoStack, r.undo),
  };
}

export const checkUndo = ({ s }: Snapshot) =>
  s.undoStack.length ? undefined : refuse("nothing-to-do", msg.nothingToRestore);

/** Undo (⌘K ⌘Z, the Undo toast): the last close or tuck. A tuck is undone by putting the pane back, so later changes survive. */
export function undo(x: Snapshot): Outcome {
  const e = x.s.undoStack.at(-1);
  if (!e) return checkUndo(x);
  if (e.tucked) return putBack(x, e.tucked);
  const view = e.before.view;
  return {
    op: "undo",
    layout: core.refit(e.before.layout, view, x.ctx),
    view,
    msg: msg.undone(e.kind === "close" ? "close" : "closeOthers"),
    undo: x.s.undoStack.slice(0, -1),
  };
}
