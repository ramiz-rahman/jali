import { allows, notAllowed } from "./allow";
import * as core from "../layout/engine";
import type { NodeId } from "../layout/types";
import { closeMany } from "../layout/ops/close";
import { restoreClosed } from "../layout/ops/restore";
import { refuse, type Outcome, type RefusalStep, type Snapshot } from "../state/apply";
import { messagesOf, say } from "../state/messages";
import { pushUndo } from "../state/undo";
import { objectKey } from "../state/pane-state";
import { own } from "../own";
import { putBack } from "./tuck";

const unzoomed = core.tree.unzoom;

export function close(x: Snapshot, id = x.s.view.focused): Outcome {
  const denied = notAllowed(x, id, "close");
  if (denied) return denied;
  const { s, m, ctx } = x;
  if (!id || !m.pane(id)) return null;
  // In a curated page a view is never closed for good: the page puts it back in its tabs.
  const page = s.page ? x.env.page : undefined;
  if (page && m.pane(id)!.role) return page.hideRole(x, id);
  if (m.panes.length <= 1) return refuse("last-pane", say(x).lastPaneStays);
  const title = m.title(id);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "close",
    layout: r.layout,
    view: r.view,
    msg: say(x).closed(title),
    toast: messagesOf(x).toasts.closed(title),
    undo: r.undo ? pushUndo(s.undoStack, r.undo) : s.undoStack,
    patch: s.peekSource === id ? { peekSource: undefined } : undefined,
  };
}

/**
 * The host closed this pane's object elsewhere (`jali.actions.remove`): the pane goes quietly, with no undo, toast or
 * announcement, and without asking (the host decided; neither `beforeClose` nor "Discard unsaved changes?" runs).
 * The address is replaced, so Back never returns to it. The last pane becomes the launcher, the instance's "choose
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

/**
 * Why Close others can't run for `id` now, or undefined when it can: the action and the ⌘K command ask this one
 * check, so the palette never offers what the action then refuses. On a curated page it goes back (the page decides).
 */
export function checkCloseOthers(x: Snapshot, id = x.s.view.focused): RefusalStep | undefined {
  if (x.s.page && x.env.page) return undefined;
  if (!id) return refuse("unavailable");
  // Panes the app keeps (`allow: { close: false }`) stay: with none of the others closable, there is nothing to do.
  return x.m.panes.some((p) => p.id !== id && allows(x, p.id, "close"))
    ? undefined
    : refuse("nothing-to-do", say(x).noOtherPanes);
}

export function closeOthers(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const page = s.page ? x.env.page : undefined;
  if (page) return page.back(x);
  if (!id) return null;
  const cannot = checkCloseOthers(x, id);
  if (cannot) return cannot;
  // Panes the app keeps (`allow: { close: false }`) stay; the rest close in one change, one undo entry.
  const kept = m.panes.some((p) => p.id !== id && !allows(x, p.id, "close"));
  const r = kept
    ? closeMany(
        s.layout,
        unzoomed(s.view),
        m.panes.filter((p) => p.id !== id && allows(x, p.id, "close")).map((p) => p.id),
        ctx,
      )
    : core.closeOthers(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "closeOthers",
    layout: r.layout,
    view: kept ? core.focus(r.view, id, ctx) : r.view,
    msg: say(x).othersClosed,
    toast: messagesOf(x).toasts.othersClosed(),
    undo: r.undo ? pushUndo(s.undoStack, r.undo) : s.undoStack,
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
  const r = closeMany(s.layout, unzoomed(s.view), closing, ctx);
  return {
    op: "closeOthers",
    layout: r.layout,
    view: core.focus(r.view, id, ctx),
    msg: say(x).tabsClosed(closing.length),
    toast: messagesOf(x).toasts.tabsClosed(closing.length),
    undo: r.undo ? pushUndo(s.undoStack, r.undo) : s.undoStack,
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

/**
 * Undo (⌘K ⌘Z, the Undo toast): the last close or tuck, reversed in the layout as it is now, so everything done since
 * stays. A tuck is undone by putting the pane back; a close by putting each pane it closed back in its slot
 * (layout/ops/restore.ts), with its pane state: a pane whose id another took meanwhile comes back under a new one, and
 * its state with it.
 */
export function undo(x: Snapshot): Outcome {
  const { s, ctx, env } = x;
  const e = s.undoStack.at(-1);
  if (!e) return checkUndo(x);
  if (e.kind === "tuck") return putBack(x, e.tucked);
  const r = restoreClosed(s.layout, unzoomed(s.view), e, ctx, e.kind === "close");
  // State kept for a pane under its old id is held for it under its new one: it is its state again as it lands
  // (state/pane-state.ts), and what stays under the old id goes with no pane to show it.
  let held = s.paneStateHeld;
  for (const c of e.closed) {
    const from = c.pane.id,
      to = r.ids[from]!,
      of = objectKey(env.kinds, c.pane.ref);
    const values =
      own(s.paneStateOf, from) === of ? own(s.paneState, from) : own(own(held, from), of);
    if (to !== from && values) held = { ...held, [to]: { ...own(held, to), [of]: values } };
  }
  return {
    op: "undo",
    layout: r.layout,
    view: r.view,
    msg: say(x).undone(e.kind),
    undo: s.undoStack.slice(0, -1),
    patch: held === s.paneStateHeld ? undefined : { paneStateHeld: held },
  };
}
