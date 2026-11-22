import { allows, notAllowed } from "./allow";
import * as core from "../layout/engine";
import type { NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { messagesOf, say } from "../state/messages";
import { pushUndo } from "../state/undo";
import { putBack } from "./tuck";

const unzoomed = core.tree.unzoom;

export function close(x: Snapshot, id = x.s.view.focused): Outcome {
  const denied = notAllowed(x, id, "close");
  if (denied) return denied;
  const { s, m, ctx } = x;
  if (!id || !m.pane(id)) return null;
  // In a curated page a view is never closed for good: it goes back to the tabs.
  if (s.page && m.pane(id)!.role)
    return s.page.mode === "single"
      ? refuse("single-view", say(x).singleNoLayout)
      : x.env.page!.hideRole(x, id);
  if (m.panes.length <= 1) return refuse("last-pane", say(x).lastPaneStays);
  const title = m.title(id);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "close",
    layout: r.layout,
    view: r.view,
    msg: say(x).closed(title),
    toast: messagesOf(x).toasts.closed(title),
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
  if (s.page) return x.env.page!.back(x);
  if (!id) return null;
  if (m.panes.length <= 1) return refuse("nothing-to-do", say(x).noOtherPanes);
  // Panes the app keeps (`allow: { close: false }`) stay; the rest close in one change.
  const kept = m.panes.filter((p) => p.id !== id && !allows(x, p.id, "close"));
  if (kept.length) {
    const closing = m.panes.filter((p) => p.id !== id && allows(x, p.id, "close")).map((p) => p.id);
    if (!closing.length) return refuse("nothing-to-do", say(x).noOtherPanes);
    let layout = s.layout,
      view = unzoomed(s.view);
    for (const p of closing) ({ layout, view } = core.close(layout, view, p, ctx));
    return {
      op: "closeOthers",
      layout,
      view: core.focus(view, id, ctx),
      msg: say(x).othersClosed,
      toast: messagesOf(x).toasts.othersClosed(),
      undo: pushUndo(s.undoStack, {
        kind: "closeOthers",
        before: { layout: core.tree.clone(s.layout), view: core.tree.clone(s.view) },
      }),
    };
  }
  const r = core.closeOthers(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "closeOthers",
    layout: r.layout,
    view: r.view,
    msg: say(x).othersClosed,
    toast: messagesOf(x).toasts.othersClosed(),
    undo: pushUndo(s.undoStack, r.undo),
  };
}

/**
 * Close several tabs of `id`'s group at once: the others, or those after it in reading order. One change, so the
 * host's `beforeClose` is asked once, listing them all, and one Undo brings them back. Pinned tabs stay.
 */
export function closeTabs(x: Snapshot, id: NodeId, which: "others" | "after"): Outcome {
  const { s, ctx } = x;
  const closing = tabsToClose(x, id, which);
  if (!closing.length) return refuse("nothing-to-do", say(x).noTabsToClose);
  const before = { layout: s.layout, view: s.view };
  let layout = s.layout,
    view = unzoomed(s.view);
  for (const tab of closing) ({ layout, view } = core.close(layout, view, tab, ctx));
  return {
    op: "closeOthers",
    layout,
    view: core.focus(view, id, ctx),
    msg: say(x).tabsClosed(closing.length),
    toast: messagesOf(x).toasts.tabsClosed(closing.length),
    undo: pushUndo(s.undoStack, {
      kind: "closeOthers",
      before: { layout: core.tree.clone(before.layout), view: core.tree.clone(before.view) },
    }),
    patch: s.peekSource && closing.includes(s.peekSource) ? { peekSource: undefined } : undefined,
    result: id,
  };
}

/** The tabs `closeTabs` would close: of `id`'s group, the others or those after it, but never a pinned tab. */
export function tabsToClose(x: Snapshot, id: NodeId, which: "others" | "after"): NodeId[] {
  const st = x.m.stackOf(id);
  if (!st) return [];
  const at = st.children.findIndex((c) => c.id === id);
  return st.children
    .filter((c, i) => !c.pinned && (which === "others" ? i !== at : i > at))
    .filter((c) => allows(x, c.id, "close"))
    .map((c) => c.id);
}

export const checkUndo = ({ s, env }: Snapshot) =>
  s.undoStack.length ? undefined : refuse("nothing-to-do", say(env).nothingToRestore);

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
    msg: say(x).undone(e.kind === "close" ? "close" : "closeOthers"),
    undo: x.s.undoStack.slice(0, -1),
  };
}
