import * as core from "../layout/engine";
import type { NodeId, TuckRefusal } from "../layout/types";
import { refuse, type Outcome, type RefusalStep, type Snapshot } from "../state/apply";
import type { Step } from "./step";
import { say } from "../state/messages";
import { forgetTuck, pushUndo, tuckOrder } from "../state/undo";

const unzoomed = core.tree.unzoom;

function tuckRefusal({ m }: Snapshot, id: NodeId, reason: TuckRefusal): RefusalStep {
  const title = m.title(id);
  if (reason === "missing") return refuse("not-found", say(m).noFocus);
  if (reason === "tab")
    return refuse("blocked", say(m).alreadyTab(title, m.title(m.shownWith(id))));
  if (reason === "hidden") return refuse("blocked", say(m).notOnScreen(title));
  return refuse(
    "blocked",
    m.panes.length <= 1 ? say(m).onlyOpen(title) : say(m).onlyOnScreen(title),
  );
}

/** The pane a tuck acts on: the given or focused pane, else the most recently focused one still open. */
const tuckTarget = ({ s, m }: Snapshot, id = s.view.focused) =>
  id && m.pane(id) ? id : s.view.focusHistory.find((h) => m.pane(h));

/** The pane a tuck would join, for labels such as "Tuck into orders". */
export function tuckHome({ s, ctx }: Snapshot, id: NodeId | undefined): NodeId | undefined {
  const r = id ? core.canTuck(s.layout, id, ctx) : undefined;
  return r?.ok ? r.home : undefined;
}

/**
 * Tuck: the pane becomes a tab of its home (see layout/ops/tuck.ts). The home keeps its shown tab and absorbs the space;
 * nothing else moves or unfolds. Focus moves into the home. Undo (⌘K ⌘Z) puts it back. Its check's message is what a
 * header's disabled Tuck says.
 */
export const tuck: Step<[NodeId?]> = {
  check(x, id) {
    if (x.s.page?.mode === "single") return refuse("single-view", say(x).singleNoLayout);
    const target = tuckTarget(x, id);
    if (!target) return refuse("not-found", say(x).noFocus);
    const r = core.canTuck(x.s.layout, target, x.ctx);
    return r.ok ? undefined : tuckRefusal(x, target, r.reason);
  },
  control: (x, id) => [["tuck", tuckTarget(x, id)]],
  run(x, id) {
    const target = tuckTarget(x, id)!;
    const r = core.tuck(x.s.layout, unzoomed(x.s.view), target, x.ctx);
    if (!r.ok) return tuckRefusal(x, target, r.reason);
    return {
      op: "tuck",
      layout: r.layout,
      view: r.view,
      msg: say(x).tucked(x.m.title(target), x.m.title(r.home)),
      undo: pushUndo(x.s.undoStack, r.undo),
      focusDom: r.home,
    };
  },
};

/** The pane a put back acts on: the given pane; else `preferred` (a tucked tab with DOM focus) or the focused pane if
 *  tucked; else the most recently tucked pane. */
function putBackTarget({ s, m }: Snapshot, id?: NodeId, preferred?: NodeId): NodeId | undefined {
  if (id) return id;
  if (preferred && m.tuckOf(preferred)) return preferred;
  if (m.tuckOf(s.view.focused)) return s.view.focused;
  return tuckOrder(s.undoStack, s.layout)[0];
}

/** Put back: restores the pane's slot and size; only folds if room ran out. Focus moves in. */
export const putBack: Step<[NodeId?, NodeId?]> = {
  check: (x, id, preferred) =>
    putBackTarget(x, id, preferred) ? undefined : refuse("nothing-to-do", say(x).nothingTucked),
  run(x, id, preferred) {
    const target = putBackTarget(x, id, preferred)!;
    const r = core.putBack(x.s.layout, unzoomed(x.s.view), target, x.ctx);
    if (!r.ok)
      return r.reason === "missing"
        ? refuse("not-found", say(x).noFocus)
        : refuse("nothing-to-do", say(x).notTucked(x.m.title(target)));
    return {
      op: "putBack",
      layout: r.layout,
      view: r.view,
      msg: say(x).putBack(x.m.title(target)),
      undo: forgetTuck(x.s.undoStack, target),
      focusDom: target,
    };
  },
};

/** Show a pane that is off screen (tucked, folded or a tab) by selecting its tab in its home. Nothing moves. */
export function reveal({ s, m, ctx }: Snapshot, id: NodeId): Outcome {
  if (!m.pane(id)) return null;
  const layout = core.reveal(s.layout, id, ctx);
  return {
    op: "reveal",
    layout,
    view: core.focus(s.view, id, ctx),
    msg: say(m).revealed(m.title(id), m.title(m.shownWith(id))),
    focusDom: id,
  };
}

/** ⌘K "Show a pane from the shelf": one pane off screen is shown (a tucked one first). The adapter moves focus to the
 *  shelf instead when there are several to choose from. */
export const revealShelf: Step<[]> = {
  check: ({ m }) => (m.resolved.shelf.length ? undefined : refuse("unavailable")),
  run(x) {
    const items = x.m.resolved.shelf;
    return reveal(x, (items.find((i) => x.m.tuckOf(i.paneId)) ?? items[0]!).paneId);
  },
};
