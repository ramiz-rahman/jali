import * as core from "../layout";
import type { NodeId, TuckRefusal } from "../layout/types";
import { refuse, type Outcome, type Refusal, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import { forgetTuck, pushUndo, tuckOrder } from "../state/undo";

const unzoomed = core.tree.unzoom;

function tuckRefusal({ m }: Snapshot, id: NodeId, reason: TuckRefusal): Refusal {
  const title = m.title(id);
  if (reason === "missing") return refuse(msg.noFocus);
  if (reason === "tab") return refuse(msg.alreadyTab(title, m.title(m.shownWith(id))));
  if (reason === "hidden") return refuse(msg.notOnScreen(title));
  return refuse(m.panes.length <= 1 ? msg.onlyOpen(title) : msg.onlyOnScreen(title));
}

/** The pane a tuck acts on: the given or focused pane, else the most recently focused one still open. */
const tuckTarget = ({ s, m }: Snapshot, id = s.view.focused) => (id && m.pane(id) ? id : s.view.focusHistory.find((h) => m.pane(h)));

/** The pane a tuck would join, for labels such as "Tuck into orders". */
export function tuckHome({ s, ctx }: Snapshot, id: NodeId | undefined): NodeId | undefined {
  const r = id ? core.canTuck(s.layout, id, ctx) : undefined;
  return r?.ok ? r.home : undefined;
}

export function checkTuck(x: Snapshot, id?: NodeId): Refusal | undefined {
  if (x.s.page?.mode === "single") return refuse(msg.singleNoLayout);
  const target = tuckTarget(x, id);
  if (!target) return refuse(msg.noFocus);
  const r = core.canTuck(x.s.layout, target, x.ctx);
  return r.ok ? undefined : tuckRefusal(x, target, r.reason);
}

/**
 * Tuck: the pane becomes a tab of its home (see layout/ops/tuck.ts). The home keeps its shown tab and absorbs the space;
 * nothing else moves or unfolds. Focus moves into the home. Undo (⌘K ⌘Z) puts it back.
 */
export function tuck(x: Snapshot, id?: NodeId): Outcome {
  if (x.s.page?.mode === "single") return refuse(msg.singleNoLayout);
  const target = tuckTarget(x, id);
  if (!target) return refuse(msg.noFocus);
  const r = core.tuck(x.s.layout, unzoomed(x.s.view), target, x.ctx);
  if (!r.ok) return tuckRefusal(x, target, r.reason);
  return { op: "tuck", layout: r.layout, view: r.view, msg: msg.tucked(x.m.title(target), x.m.title(r.home)), undo: pushUndo(x.s.undoStack, r.undo), focusDom: r.home };
}

/** The pane a put back acts on: the given pane; else `preferred` (a tucked tab with DOM focus) or the focused pane if
 *  tucked; else the most recently tucked pane. */
function putBackTarget({ s, m }: Snapshot, id?: NodeId, preferred?: NodeId): NodeId | undefined {
  if (id) return id;
  if (preferred && m.tuckOf(preferred)) return preferred;
  if (m.tuckOf(s.view.focused)) return s.view.focused;
  return tuckOrder(s.undoStack, s.layout)[0];
}

export const checkPutBack = (x: Snapshot) => (putBackTarget(x) ? undefined : refuse(msg.nothingTucked));

/** Put back: restores the pane's slot and size; only folds if room ran out. Focus moves in. */
export function putBack(x: Snapshot, id?: NodeId, preferred?: NodeId): Outcome {
  const target = putBackTarget(x, id, preferred);
  if (!target) return refuse(msg.nothingTucked);
  const r = core.putBack(x.s.layout, unzoomed(x.s.view), target, x.ctx);
  if (!r.ok) return refuse(r.reason === "missing" ? msg.noFocus : msg.notTucked(x.m.title(target)));
  return { op: "putBack", layout: r.layout, view: r.view, msg: msg.putBack(x.m.title(target)), undo: forgetTuck(x.s.undoStack, target), focusDom: target };
}

/** Show a pane that is off screen (tucked, folded or a tab) by selecting its tab in its home. Nothing moves. */
export function reveal({ s, m, ctx }: Snapshot, id: NodeId): Outcome {
  if (!m.pane(id)) return null;
  const layout = core.reveal(s.layout, id, ctx);
  return { op: "reveal", layout, view: core.focus(s.view, id, ctx), msg: msg.revealed(m.title(id), m.title(m.shownWith(id))), focusDom: id };
}
