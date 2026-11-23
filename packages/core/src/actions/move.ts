import * as core from "../layout/engine";
import type { Edge, NodeId } from "../layout/types";
import { refuse, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { putBack } from "./tuck";
import { treeSide } from "../layout/geometry/direction";
import { uses, type ControlUse, type Step } from "./step";

const unzoomed = core.tree.unzoom;

/** Move pane `id` (default: the focused one) one place towards `dir`. Past the edge it is refused, saying so. */
export const moveDirection: Step<[Edge, NodeId?]> = {
  check({ s, m }, dir, id = s.view.focused) {
    if (!id) return refuse("unavailable");
    return m.panes.length < 2 ? refuse("blocked", say(m).cantMove(m.title(id), dir)) : undefined;
  },
  control: (x, _dir, id) => uses("move")(x, id),
  run(x, dir, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const r = core.moveDirection(s.layout, unzoomed(s.view), id, dir, ctx);
    if (r.layout === s.layout) return refuse("blocked", say(m).cantMove(m.title(id), dir));
    return { op: "move", layout: r.layout, view: r.view, msg: say(m).moved(m.title(id), dir) };
  },
};

/** The row that scrolls sideways holding pane `id`, if one does. */
const stripOf = ({ m }: Snapshot, id: NodeId | undefined) =>
  id ? m.resolved.scrollers.find((r) => r.paneIds.includes(id)) : undefined;

/**
 * Take a pane out of the row that scrolls holding it, beside the strip on the side it is nearer on screen: a pane in
 * the strip's left half goes before the strip, one in its right half after. A pane in no strip has no row to leave.
 */
export const moveOutOfRow: Step<[NodeId?]> = {
  check: (x, id = x.s.view.focused) => (stripOf(x, id) ? undefined : refuse("unavailable")),
  control: uses("move"),
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const strip = stripOf(x, id)!;
    const box = m.resolved.panes.find((b) => b.id === id);
    if (!box) return null;
    const clip = box.clip ?? strip.rect;
    // The part of the pane in view, so a pane half scrolled out counts by what shows of it.
    const from = Math.max(box.rect.x, clip.x),
      to = Math.min(box.rect.x + box.rect.width, clip.x + clip.width);
    const screen: Edge = (from + to) / 2 < clip.x + clip.width / 2 ? "left" : "right";
    const side = treeSide(screen, ctx.dir) as "left" | "right";
    const r = core.moveOutOfStrip(s.layout, unzoomed(s.view), id, side, ctx);
    if (r.layout === s.layout) return null;
    return { op: "move", layout: r.layout, view: r.view, msg: say(m).movedOutOfRow(m.title(id)) };
  },
};

/** A drag starts on pane `id`: the pane must allow `move`. What the drop does is `drop`'s to check. */
export const startDrag: Step<[NodeId]> = { control: uses("move"), run: () => null };

/** A pointer drop on `zone`, a side of the screen. Dragging a tucked tab out of its home on the side it came from is a
 *  put back (exact slot and size). A swap at the centre moves the pane dropped on too. */
export const drop: Step<[NodeId, NodeId, Edge | "centre"]> = {
  control: ({ s }, dragged, target, zone): readonly ControlUse[] =>
    zone === "centre" && s.settings.centreDrop === "swap"
      ? [
          ["move", dragged],
          ["move", target],
        ]
      : [["move", dragged]],
  run(x, dragged, target, zone) {
    const { s, m, ctx } = x;
    const side = treeSide(zone, ctx.dir);
    const home = m.resolved.stacks.find((g) => g.paneIds.includes(dragged));
    if (
      m.tuckOf(dragged) &&
      side !== "centre" &&
      home?.paneIds.includes(target) &&
      side === core.putBackEdge(s.layout, dragged)
    )
      return putBack.run(x, dragged);
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
  },
};

/** The pane a swap trades places with: the next on screen, else the one before. */
const swapPartner = ({ m }: Snapshot, id: NodeId | undefined) => {
  const i = m.visible.indexOf(id ?? "");
  return m.visible[i + 1] ?? m.visible[i - 1];
};

/** Swap pane `id` (default: the focused one) with the next on screen. Both panes move, so both must allow it. */
export const swapWithNext: Step<[NodeId?]> = {
  check: (x, id = x.s.view.focused) =>
    !id ? refuse("unavailable") : swapPartner(x, id) ? undefined : refuse("nothing-to-do"),
  control: (x, id = x.s.view.focused) => [
    ["move", id],
    ["move", swapPartner(x, id)],
  ],
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const other = swapPartner(x, id)!;
    return {
      op: "swap",
      layout: core.swap(s.layout, id, other, ctx),
      msg: say(m).swapped(m.title(id), m.title(other)),
    };
  },
};
