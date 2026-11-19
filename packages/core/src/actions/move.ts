import * as core from "../layout";
import type { Edge, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { putBack } from "./tuck";
import { treeSide } from "../layout/geometry/direction";

const unzoomed = core.tree.unzoom;

export function moveDirection({ s, m, ctx }: Snapshot, dir: Edge, id = s.view.focused): Outcome {
  if (!id) return null;
  const r = core.moveDirection(s.layout, unzoomed(s.view), id, dir, ctx);
  if (r.layout === s.layout) return refuse(say(m).cantMove(m.title(id), dir));
  return { op: "move", layout: r.layout, view: r.view, msg: say(m).moved(m.title(id), dir) };
}

/** A pointer drop on `zone`, a side of the screen. Dragging a tucked tab out of its home on the side it came from is a
 *  put back (exact slot and size). */
export function drop(x: Snapshot, dragged: NodeId, target: NodeId, zone: Edge | "centre"): Outcome {
  const { s, m, ctx } = x;
  const side = treeSide(zone, ctx.dir);
  const home = m.resolved.stacks.find((g) => g.paneIds.includes(dragged));
  if (
    m.tuckOf(dragged) &&
    side !== "centre" &&
    home?.paneIds.includes(target) &&
    side === core.putBackEdge(s.layout, dragged)
  )
    return putBack(x, dragged);
  const mode = s.settings.centreDrop;
  const r = core.drop(s.layout, s.view, dragged, target, side, mode, ctx);
  const a = m.title(dragged),
    b = m.title(target);
  const text =
    zone === "centre"
      ? mode === "swap"
        ? say(x).swapped(a, b)
        : say(x).addedToTabsOf(a, b)
      : say(x).placed(a, zone, b);
  return { op: "drop", layout: r.layout, view: core.focus(r.view, dragged, ctx), msg: text };
}

export function swapWithNext({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  const i = m.visible.indexOf(id ?? "");
  const other = m.visible[i + 1] ?? m.visible[i - 1];
  if (!id || !other) return null;
  return {
    op: "swap",
    layout: core.swap(s.layout, id, other, ctx),
    msg: say(m).swapped(m.title(id), m.title(other)),
  };
}
