import { notAllowed } from "./allow";
import * as core from "../layout";
import type { Edge, NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { putBack } from "./tuck";
import { treeSide } from "../layout/geometry/direction";

const unzoomed = core.tree.unzoom;

export function moveDirection(x: Snapshot, dir: Edge, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const denied = notAllowed(x, id, "move");
  if (denied) return denied;
  if (!id) return null;
  const r = core.moveDirection(s.layout, unzoomed(s.view), id, dir, ctx);
  if (r.layout === s.layout) return refuse("blocked", say(m).cantMove(m.title(id), dir));
  return { op: "move", layout: r.layout, view: r.view, msg: say(m).moved(m.title(id), dir) };
}

/**
 * Take a pane out of the row that scrolls holding it, beside the strip on the side it is nearer on screen: a pane in
 * the strip's left half goes before the strip, one in its right half after. Silent for a pane in no strip.
 */
export function moveOutOfRow(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const denied = notAllowed(x, id, "move");
  if (denied) return denied;
  const strip = id ? m.resolved.scrollers.find((r) => r.paneIds.includes(id)) : undefined;
  const box = id ? m.resolved.panes.find((b) => b.id === id) : undefined;
  if (!id || !strip || !box) return null;
  const clip = box.clip ?? strip.rect;
  // The part of the pane in view, so a pane half scrolled out counts by what shows of it.
  const from = Math.max(box.rect.x, clip.x),
    to = Math.min(box.rect.x + box.rect.width, clip.x + clip.width);
  const screen: Edge = (from + to) / 2 < clip.x + clip.width / 2 ? "left" : "right";
  const side = treeSide(screen, ctx.dir) as "left" | "right";
  const r = core.moveOutOfStrip(s.layout, unzoomed(s.view), id, side, ctx);
  if (r.layout === s.layout) return null;
  return { op: "move", layout: r.layout, view: r.view, msg: say(m).movedOutOfRow(m.title(id)) };
}

/** A pointer drop on `zone`, a side of the screen. Dragging a tucked tab out of its home on the side it came from is a
 *  put back (exact slot and size). */
export function drop(x: Snapshot, dragged: NodeId, target: NodeId, zone: Edge | "centre"): Outcome {
  const denied = notAllowed(x, dragged, "move");
  if (denied) return denied;
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
  if (zone === "centre" && mode === "swap") {
    const targetDenied = notAllowed(x, target, "move");
    if (targetDenied) return targetDenied;
  }
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

export function swapWithNext(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const denied = notAllowed(x, id, "move");
  if (denied) return denied;
  const i = m.visible.indexOf(id ?? "");
  const other = m.visible[i + 1] ?? m.visible[i - 1];
  if (!id || !other) return null;
  // A swap moves the other pane too.
  const otherDenied = notAllowed(x, other, "move");
  if (otherDenied) return otherDenied;
  return {
    op: "swap",
    layout: core.swap(s.layout, id, other, ctx),
    msg: say(m).swapped(m.title(id), m.title(other)),
  };
}
