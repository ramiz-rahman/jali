import * as core from "../layout";
import type { Edge, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import { putBack } from "./tuck";

const unzoomed = core.tree.unzoom;

export function moveDirection({ s, m, ctx }: Snapshot, dir: Edge, id = s.view.focused): Outcome {
  if (!id) return null;
  const r = core.moveDirection(s.layout, unzoomed(s.view), id, dir, ctx);
  if (r.layout === s.layout) return refuse(msg.cantMove(m.title(id), dir));
  return { op: "move", layout: r.layout, view: r.view, msg: msg.moved(m.title(id), dir) };
}

/** A pointer drop. Dragging a tucked tab out of its home on the side it came from is a put back (exact slot and size). */
export function drop(x: Snapshot, dragged: NodeId, target: NodeId, zone: Edge | "centre"): Outcome {
  const { s, m, ctx } = x;
  const home = m.resolved.stacks.find((g) => g.paneIds.includes(dragged));
  if (m.tuckOf(dragged) && zone !== "centre" && home?.paneIds.includes(target) && zone === core.putBackEdge(s.layout, dragged)) return putBack(x, dragged);
  const mode = s.settings.centreDrop;
  const r = core.drop(s.layout, s.view, dragged, target, zone, mode, ctx);
  const a = m.title(dragged), b = m.title(target);
  const text = zone === "centre" ? (mode === "swap" ? msg.swapped(a, b) : msg.addedToTabsOf(a, b)) : msg.placed(a, zone, b);
  return { op: "drop", layout: r.layout, view: core.focus(r.view, dragged, ctx), msg: text };
}

export function swapWithNext({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  const i = m.visible.indexOf(id ?? "");
  const other = m.visible[i + 1] ?? m.visible[i - 1];
  if (!id || !other) return null;
  return { op: "swap", layout: core.swap(s.layout, id, other, ctx), msg: msg.swapped(m.title(id), m.title(other)) };
}
