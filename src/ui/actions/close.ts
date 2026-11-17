import * as core from "../../layout-core";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg, toasts } from "../state/messages";
import { pushUndo } from "../state/undo";
import { putBack } from "./tuck";

const unzoomed = core.tree.unzoom;

export function close({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  if (!id || !m.pane(id)) return null;
  if (m.panes.length <= 1) return refuse(msg.lastPaneStays);
  const title = m.title(id);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "close", layout: r.layout, view: r.view, msg: msg.closed(title), toast: toasts.closed(title),
    undo: pushUndo(s.undoStack, r.undo), patch: s.peekSource === id ? { peekSource: undefined } : undefined,
  };
}

export function closeOthers({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  if (!id) return null;
  if (m.panes.length <= 1) return refuse(msg.noOtherPanes);
  const r = core.closeOthers(s.layout, unzoomed(s.view), id, ctx);
  return { op: "closeOthers", layout: r.layout, view: r.view, msg: msg.othersClosed, toast: toasts.othersClosed(), undo: pushUndo(s.undoStack, r.undo) };
}

export const checkUndo = ({ s }: Snapshot) => (s.undoStack.length ? undefined : refuse(msg.nothingToRestore));

/** ⌘Z: undo the last close or tuck. A tuck is undone by putting the pane back, so later changes survive. */
export function undo(x: Snapshot): Outcome {
  const e = x.s.undoStack.at(-1);
  if (!e) return checkUndo(x);
  if (e.tucked) return putBack(x, e.tucked);
  const view = e.before.view;
  return { op: "undo", layout: core.refit(e.before.layout, view, x.ctx), view, msg: msg.undone(e.kind === "close" ? "close" : "closeOthers"), undo: x.s.undoStack.slice(0, -1) };
}

