import * as core from "../layout/engine";
import type { Layout, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { clampSize, geometryFor, nearestDivider } from "../dividers/resize";
import { through, type ControlUse, type Step } from "./step";

/** A divider moves the panes on both sides of it, so each must allow `resize`. The sides are the divider's on screen
 *  (a fold can put another pane beside it than the split's next child), whatever moves it: a drag, a key, a reset. */
function divider(x: Snapshot, parentId: NodeId, index: number): readonly ControlUse[] {
  const shown = x.m.resolved.dividers.find((d) => d.parentId === parentId && d.index === index);
  const parent = core.tree.find(x.s.layout.root, parentId);
  const sides =
    parent?.type === "row" || parent?.type === "column"
      ? [parent.children[index], parent.children[index + 1]]
      : [];
  return (
    shown?.neighbours?.flat() ??
    sides.flatMap((n) => (n ? core.tree.panes(n).map((p) => p.id) : []))
  ).map((id) => ["resize", id] as const);
}

/** Sizes do not change minimums, so a divider never changes what fits: no refit. The URL follows 120ms later. */
export const resizeDivider: Step<[NodeId, number, number]> = {
  control: divider,
  run: ({ s, ctx }, parentId, index, deltaPx) =>
    deltaPx
      ? { op: "resize", layout: core.resizeDivider(s.layout, parentId, index, deltaPx, ctx) }
      : null,
};

/** Keyboard resize of one divider to an absolute first-neighbour size, from the committed model: `resizeDivider`, gated
 *  as itself. */
export function setDividerSize(
  x: Snapshot,
  parentId: NodeId,
  index: number,
  target: number,
): Outcome {
  const d = x.m.resolved.dividers.find((v) => v.parentId === parentId && v.index === index);
  const g = d && geometryFor(x.m, d);
  if (!g) return null;
  const delta = Math.round(clampSize(target, g.a.min, g.divider.max) - g.a.size);
  return through(x, resizeDivider, parentId, index, delta);
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
  return d ? through(x, resizeDivider, d.parentId, d.index, rtl ? -deltaPx : deltaPx) : null;
}

/** End of a pointer drag: the layout the drag previewed, committed once. Checked again as it lands, when the drag
 *  says which divider it moved: its panes must still allow `resize` (the app's `allow` may have changed meanwhile). */
export const commitDividerDrag: Step<[Layout, NodeId?, number?]> = {
  control: (x, _layout, parentId, index = 0) =>
    parentId === undefined ? [] : divider(x, parentId, index),
  run: (_x, layout) => ({ op: "resize", layout }),
};

export const resetDivider: Step<[NodeId, number]> = {
  control: divider,
  run: (x, parentId, index) => ({
    op: "resetSizes",
    layout: core.resetDivider(x.s.layout, parentId, index, x.ctx),
    msg: say(x.env).sizesReset,
  }),
};

/** Resize mode, on the focused pane: arrows move the dividers nearest it. */
export const enterResizeMode: Step<[]> = {
  check({ s, m }) {
    const id = s.view.focused;
    if (!id) return refuse("unavailable");
    return !nearestDivider(m, id, true) && !nearestDivider(m, id, false)
      ? refuse("nothing-to-do", say(m).nothingToResize)
      : undefined;
  },
  run: ({ s, m }) => ({
    op: "patch",
    patch: { resizeMode: s.view.focused! },
    msg: say(m).resizeModeOn,
  }),
};

export const leaveResizeMode = (x: Snapshot): Outcome => ({
  op: "patch",
  patch: { resizeMode: null },
  msg: say(x).resizeModeOff,
});
