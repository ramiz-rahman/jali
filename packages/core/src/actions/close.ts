import { allows } from "./allow";
import { uses, type Step } from "./step";
import * as core from "../layout/engine";
import type { NodeId, ObjectRef, PaneNode } from "../layout/types";
import { closeMany } from "../layout/ops/close";
import { restoreClosed } from "../layout/ops/restore";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { messagesOf, say } from "../state/messages";
import { closedPanes, forgetObject, pushUndo } from "../state/undo";
import { objectKey } from "../state/pane-state";
import { sameRef } from "../layout/ops/ref";
import { own } from "../own";
import { putBack } from "./tuck";

const unzoomed = core.tree.unzoom;

/** A curated page's engine, while its page is open. */
const pageOf = (x: Snapshot) => (x.s.page ? x.env.page : undefined);

/** Close pane `id` (default: the focused one), with an undo toast. On a curated page a view is never closed for good:
 *  the page puts it back in its tabs (`hideRole`). The last pane stays. */
export const close: Step<[NodeId?]> = {
  check(x, id = x.s.view.focused) {
    const { m } = x;
    if (!id || !m.pane(id)) return refuse("not-found");
    const page = pageOf(x);
    if (page && m.pane(id)!.role) return page.hideRole.check?.(x, id);
    return m.panes.length <= 1 ? refuse("last-pane", say(x).lastPaneStays) : undefined;
  },
  control: uses("close"),
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const page = pageOf(x);
    if (page && m.pane(id)!.role) return page.hideRole.run(x, id);
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
  },
};

/**
 * The host closed this pane's object elsewhere (`jali.actions.remove`): the pane goes quietly, with no undo, toast or
 * announcement, and without asking (the host decided; neither `beforeClose` nor "Discard unsaved changes?" runs).
 * The address is replaced, so Back never returns to it. The last pane becomes the launcher, the instance's "choose
 * what to show"; without a launcher it stays (`"last-pane"`). A curated page's views are the page's, not the host's.
 * (A closed pane of its object is no longer in the undo stack: an object open again leaves it, state/undo.ts.)
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
 * `remove` of an object no pane shows: a closed pane of it that an undo could bring back (by its pane id, or the
 * object) leaves the undo stack, alone of its batch. `"not-found"` when there is none.
 */
export function removeClosed({ s, env: { kinds } }: Snapshot, target: NodeId | ObjectRef): Outcome {
  const match = (p: PaneNode) =>
    typeof target === "string"
      ? p.id === target
      : kinds.identityOf(target) === undefined
        ? sameRef(p.ref, target)
        : kinds.sameObject(p.ref, target);
  return closedPanes(s.undoStack).some(match)
    ? { op: "remove", undo: forgetObject(s.undoStack, match) }
    : refuse("not-found");
}

/**
 * Close every pane but `id` (default: the focused one), in one change and one undo entry. Panes the app keeps
 * (`allow: { close: false }`) stay: with none of the others closable, there is nothing to do. On a curated page it is
 * "Back to the page" (the page's `back`).
 */
export const closeOthers: Step<[NodeId?]> = {
  check(x, id = x.s.view.focused) {
    const page = pageOf(x);
    if (page) return page.back.check?.(x);
    if (!id) return refuse("unavailable");
    return x.m.panes.some((p) => p.id !== id && allows(x, p.id, "close"))
      ? undefined
      : refuse("nothing-to-do", say(x).noOtherPanes);
  },
  control: (x) => pageOf(x)?.back.control?.(x) ?? [],
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const page = pageOf(x);
    if (page) return page.back.run(x);
    const closable = (p: PaneNode) => p.id !== id && allows(x, p.id, "close");
    const kept = m.panes.some((p) => p.id !== id && !closable(p));
    const r = kept
      ? closeMany(
          s.layout,
          unzoomed(s.view),
          m.panes.filter(closable).map((p) => p.id),
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
  },
};

/**
 * Close several tabs of `id`'s group at once: the others, or those after it in reading order. One change, so the
 * host's `beforeClose` is asked once, listing them all, and one Undo brings them back. Pinned tabs stay.
 */
export const closeTabs: Step<[NodeId, "others" | "after"]> = {
  check: (x, id, which) =>
    tabsToClose(x, id, which).length ? undefined : refuse("nothing-to-do", say(x).noTabsToClose),
  run(x, id, which) {
    const { s, ctx } = x;
    const closing = tabsToClose(x, id, which);
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
  },
};

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

/**
 * Undo (⌘K ⌘Z, the Undo toast): the last close or tuck, reversed in the layout as it is now, so everything done since
 * stays. A tuck is undone by putting the pane back; a close by putting each pane it closed back in its slot
 * (layout/ops/restore.ts), with its pane state: a pane whose id another took meanwhile comes back under a new one, and
 * its state with it.
 */
export const undo: Step<[]> = {
  check: ({ s, env }) =>
    s.undoStack.length ? undefined : refuse("nothing-to-do", say(env).nothingToRestore),
  run: (x) => undoLast(x),
};

function undoLast(x: Snapshot): Outcome {
  const { s, ctx, env } = x;
  const e = s.undoStack.at(-1)!;
  if (e.kind === "tuck") return putBack.run(x, e.tucked);
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
