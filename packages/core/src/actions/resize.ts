import * as core from "../layout";
import type { Layout, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { dividerAllowed } from "./allow";
import { clampSize, geometryFor, nearestDivider } from "../dividers/resize";

/** Sizes do not change minimums, so a divider never changes what fits: no refit. The URL follows 120ms later. */
export function resizeDivider(
  x: Snapshot,
  parentId: NodeId,
  index: number,
  deltaPx: number,
): Outcome {
  const { s, ctx } = x;
  if (!deltaPx) return null;
  if (!dividerAllowed(x, parentId, index)) return refuse("not-allowed");
  return { op: "resize", layout: core.resizeDivider(s.layout, parentId, index, deltaPx, ctx) };
}

/** Keyboard resize of one divider to an absolute first-neighbour size, from the committed model. */
export function setDividerSize(
  x: Snapshot,
  parentId: NodeId,
  index: number,
  target: number,
): Outcome {
  const d = x.m.resolved.dividers.find((v) => v.parentId === parentId && v.index === index);
  const g = d && geometryFor(x.m, d);
  if (!g) return null;
  return resizeDivider(
    x,
    parentId,
    index,
    Math.round(clampSize(target, g.a.min, g.divider.max) - g.a.size),
  );
}

/** Resize mode: arrows move the divider nearest the pane, `deltaPx` towards the screen's right (or down). Right to
 *  left, a row's first neighbour is the one on the right, so moving the divider right shrinks it. */
export function nudgeDivider(
  x: Snapshot,
  pane: NodeId,
  horizontal: boolean,
  deltaPx: number,
): Outcome {
  const rtl = horizontal && x.ctx.dir === "rtl";
  const d = nearestDivider(x.m, pane, horizontal, rtl);
  return d ? resizeDivider(x, d.parentId, d.index, rtl ? -deltaPx : deltaPx) : null;
}

/** End of a pointer drag: the layout the drag previewed, committed once. */
export const commitDividerDrag = (_x: Snapshot, layout: Layout): Outcome => ({
  op: "resize",
  layout,
});

export const resetDivider = (
  { s, ctx, env }: Snapshot,
  parentId: NodeId,
  index: number,
): Outcome => ({
  op: "resetSizes",
  layout: core.resetDivider(s.layout, parentId, index, ctx),
  msg: say(env).sizesReset,
});

export function enterResizeMode({ s, m }: Snapshot): Outcome {
  const id = s.view.focused;
  if (!id) return null;
  if (!nearestDivider(m, id, true) && !nearestDivider(m, id, false))
    return refuse("nothing-to-do", say(m).nothingToResize);
  return { op: "patch", patch: { resizeMode: id }, msg: say(m).resizeModeOn };
}

export const leaveResizeMode = (x: Snapshot): Outcome => ({
  op: "patch",
  patch: { resizeMode: null },
  msg: say(x).resizeModeOff,
});
