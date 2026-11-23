import * as core from "../layout/engine";
import type { Layout, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { clampSize, geometryFor, nearestDivider } from "../dividers/resize";
import type { ControlUse, Step } from "./step";

/** A divider moves the panes on both sides of it, so each must allow `resize`. The sides are the divider's on screen
 *  (a fold can put another pane beside it than the split's next child), whatever moves it: a drag, a key, a reset. */
function divider(x: Snapshot, parentId: NodeId, index: number): readonly ControlUse[] {
  const shown = x.m.resolved.dividers.find((d) => d.parentId === parentId && d.index === index);
  const panes = shown?.neighbours
    ? shown.neighbours.flat()
    : (() => {
        const parent = core.tree.find(x.s.layout.root, parentId);
        if (!parent || parent.type === "pane" || parent.type === "stack") return [];
        return [parent.children[index], parent.children[index + 1]].flatMap((n) =>
          n ? core.tree.panes(n).map((p) => p.id) : [],
        );
      })();
  return panes.map((id) => ["resize", id] as const);
}

/** Sizes do not change minimums, so a divider never changes what fits: no refit. The URL follows 120ms later. */
export const resizeDivider: Step<[NodeId, number, number]> = {
  control: divider,
  run: ({ s, ctx }, parentId, index, deltaPx) =>
    deltaPx
      ? { op: "resize", layout: core.resizeDivider(s.layout, parentId, index, deltaPx, ctx) }
      : null,
};

/** Keyboard resize of one divider to an absolute first-neighbour size, from the committed model. */
export const setDividerSize: Step<[NodeId, number, number]> = {
  control: divider,
  run(x, parentId, index, target) {
    const d = x.m.resolved.dividers.find((v) => v.parentId === parentId && v.index === index);
    const g = d && geometryFor(x.m, d);
    if (!g) return null;
    const delta = Math.round(clampSize(target, g.a.min, g.divider.max) - g.a.size);
    return resizeDivider.run(x, parentId, index, delta);
  },
};

/** The divider resize mode's arrows move for pane `pane`, and the way they move it. */
function nearest(x: Snapshot, pane: NodeId, horizontal: boolean) {
  const rtl = horizontal && x.ctx.dir === "rtl";
  return { d: nearestDivider(x.m, pane, horizontal, rtl), rtl };
}

/** Resize mode: arrows move the divider nearest the pane, `deltaPx` towards the screen's right (or down). Right to
 *  left, a row's first neighbour is the one on the right, so moving the divider right shrinks it. */
export const nudgeDivider: Step<[NodeId, boolean, number]> = {
  control(x, pane, horizontal) {
    const { d } = nearest(x, pane, horizontal);
    return d ? divider(x, d.parentId, d.index) : [];
  },
  run(x, pane, horizontal, deltaPx) {
    const { d, rtl } = nearest(x, pane, horizontal);
    return d ? resizeDivider.run(x, d.parentId, d.index, rtl ? -deltaPx : deltaPx) : null;
  },
};

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
