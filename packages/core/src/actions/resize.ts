import * as core from "../layout";
import type { Layout, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import { clampSize, geometryFor, nearestDivider } from "../dividers/resize";

/** Sizes do not change minimums, so a divider never changes what fits: no refit. The URL follows 120ms later. */
export function resizeDivider(
  { s, ctx }: Snapshot,
  parentId: NodeId,
  index: number,
  deltaPx: number,
): Outcome {
  if (!deltaPx) return null;
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

/** Resize mode: arrows move the divider nearest the pane on that side. */
export function nudgeDivider(
  x: Snapshot,
  pane: NodeId,
  horizontal: boolean,
  deltaPx: number,
): Outcome {
  const d = nearestDivider(x.m, pane, horizontal);
  return d ? resizeDivider(x, d.parentId, d.index, deltaPx) : null;
}

/** End of a pointer drag: the layout the drag previewed, committed once. */
export const commitDividerDrag = (_x: Snapshot, layout: Layout): Outcome => ({
  op: "resize",
  layout,
});

export const resetDivider = ({ s, ctx }: Snapshot, parentId: NodeId, index: number): Outcome => ({
  op: "resetSizes",
  layout: core.resetDivider(s.layout, parentId, index, ctx),
  msg: msg.sizesReset,
});

export function enterResizeMode({ s, m }: Snapshot): Outcome {
  const id = s.view.focused;
  if (!id) return null;
  if (!nearestDivider(m, id, true) && !nearestDivider(m, id, false))
    return refuse(msg.nothingToResize);
  return { op: "patch", patch: { resizeMode: id }, msg: msg.resizeModeOn };
}

export const leaveResizeMode = (): Outcome => ({
  op: "patch",
  patch: { resizeMode: null },
  msg: msg.resizeModeOff,
});
