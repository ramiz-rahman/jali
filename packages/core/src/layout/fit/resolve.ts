import type { Axis, Layout, LayoutContext, Rect, ResolvedLayout } from "../types";
import type { ViewState } from "../types";
import { shares } from "../geometry/shares";
import { extentAlong } from "../geometry/extent";
import { noFocus, panes } from "../tree/tree";
import { allPanes, choose, foldSlot, overlayOf, replay, type Projected } from "./overlay";
import { chooseFold } from "./priority";
import { checkContext, misfit } from "./context";
function build(layout: Layout, ctx: LayoutContext): Projected {
  const { fit, paneCap } = ctx;
  let { root, order } = replay(layout, layout.overlay?.folds ?? [], fit);
  while (misfit(root, fit, paneCap)) {
    const choice = chooseFold(root, noFocus(), order);
    if (!choice) break;
    root = foldSlot(root, choice, fit, order);
  }
  choose(root, layout.overlay?.shown);
  return root;
}
export function resolve(layout: Layout, view: ViewState, ctx: LayoutContext): ResolvedLayout {
  checkContext(ctx);
  const { fit } = ctx;
  const root = build(layout, ctx);
  if (layout.overlay?.tucks.length) {
    // Allocate against the same folds with every pane in its canonical slot. A tuck consumes its old gap too.
    const reference = resolve(
      { ...layout, overlay: { ...overlayOf(layout), tucks: [] } },
      noFocus(),
      ctx,
    );
    function allocate(n: Projected): void {
      if (n.type !== "row" && n.type !== "column") return;
      for (const child of n.children) {
        const extent = extentAlong(
          reference.panes,
          allPanes(child).map((p) => p.id),
          n.type,
        );
        // Exact extents: the split keeps them as weights rather than re-sharing by the share rule.
        if (extent > 0) {
          child.size = { weight: extent };
          child.userSized = true;
        }
        allocate(child);
      }
    }
    allocate(root);
  }
  const result: ResolvedLayout = { panes: [], dividers: [], stacks: [], shelf: [] };
  const folded = new Set<string>();
  function draw(
    n: Projected,
    input: Rect,
    stackId?: string,
    hidden = false,
    isFolded = false,
  ): void {
    // maxWidth is soft: a slot fills what it is given, so no void opens beside it.
    const rect = {
      ...input,
      width: Math.max(n.bounds.width, input.width),
      height: Math.max(input.height, n.bounds.height),
    };
    if (n.pane) {
      if (isFolded) folded.add(n.id);
      result.panes.push({
        id: n.id,
        rect,
        ...(stackId ? { stackId, hidden: hidden ? "tab" : undefined } : {}),
      });
      return;
    }
    if (n.type === "stack" || n.type === "auto") {
      const selected = n.children.find((c) => c.id === n.active) ?? n.children[0]!;
      if (n.type === "auto" && !stackId) {
        const homeId = n.home ?? allPanes(n)[0]!.id;
        result.stacks.push({
          id: n.id,
          kind: n.kind ?? "fold",
          homeId,
          paneIds: allPanes(n).map((p) => p.id),
        });
      }
      n.children.forEach((c) =>
        draw(
          c,
          rect,
          stackId ?? n.id,
          hidden || c !== selected,
          isFolded || (n.kind === "fold" && c !== selected),
        ),
      );
      return;
    }
    const axis: Axis = n.type === "row" ? "row" : "column";
    const horizontal = axis === "row";
    const length = horizontal ? rect.width : rect.height;
    const mins = n.children.map((c) => (horizontal ? c.bounds.width : c.bounds.height));
    const available = length - fit.gap * (n.children.length - 1);
    // The share rule for splits nobody has sized; exact proportions once the person sized one of its children.
    const mode = n.children.some((c) => c.userSized) ? "weights" : "flex";
    const lengths = shares(
      n.children.map((c, i) =>
        horizontal
          ? {
              size: c.size,
              min: mins[i]!,
              comfortable: c.bounds.comfortable,
              max: c.bounds.maxWidth,
            }
          : { size: c.size, min: mins[i]! },
      ),
      available,
      mode,
    );
    let offset = horizontal ? rect.x : rect.y;
    n.children.forEach((child, index) => {
      const extent = lengths[index]!;
      const childRect = horizontal
        ? { x: offset, y: rect.y, width: extent, height: rect.height }
        : { x: rect.x, y: offset, width: rect.width, height: extent };
      draw(child, childRect, stackId, hidden, isFolded);
      offset += extent;
      if (index < n.children.length - 1) {
        // A drag may take a pane past its max: the person's size wins over the kind's preference.
        const total = extent + lengths[index + 1]!;
        const min = mins[index]!;
        const max = total - mins[index + 1]!;
        result.dividers.push({
          parentId: n.id,
          index,
          axis,
          min,
          max,
          value: extent,
          neighbours: [
            allPanes(child).map((p) => p.id),
            allPanes(n.children[index + 1]!).map((p) => p.id),
          ],
          rect: horizontal
            ? { x: offset, y: rect.y, width: fit.gap, height: rect.height }
            : { x: rect.x, y: offset, width: rect.width, height: fit.gap },
        });
        offset += fit.gap;
      }
    });
  }
  draw(root, {
    x: 0,
    y: 0,
    width: Math.max(fit.width, root.bounds.width),
    height: Math.max(fit.height, root.bounds.height),
  });
  // Hidden panes keep a box (so their content can stay mounted and paused) with no size and no group.
  const drawn = new Set(result.panes.map((b) => b.id)),
    inTree = new Set(panes(layout.root).map((p) => p.id));
  for (const id of layout.overlay?.hidden ?? [])
    if (!drawn.has(id) && inTree.has(id))
      result.panes.push({ id, rect: { x: 0, y: 0, width: 0, height: 0 }, hidden: "off" });
  const tucked = new Set(layout.overlay?.tucks.map((t) => t.pane));
  for (const box of result.panes) {
    if (!box.hidden || !box.stackId) continue;
    const shown = result.panes.find((b) => b.stackId === box.stackId && !b.hidden);
    result.shelf.push({
      paneId: box.id,
      homeId: shown?.id ?? box.stackId,
      stackId: box.stackId,
      reason: tucked.has(box.id) ? "tucked" : folded.has(box.id) ? "folded" : "tab",
    });
  }
  // Zoom overlays geometry; the canonical tree and all split sizes remain intact.
  const zoom = result.panes.find((p) => p.id === view.zoomed);
  if (zoom) {
    const selected = allPanes(root).find((p) => p.id === zoom.id)!;
    for (const p of result.panes)
      p.hidden = p === zoom ? undefined : p.hidden === "off" ? "off" : "zoom";
    zoom.rect = {
      x: 0,
      y: 0,
      width: Math.max(fit.width, selected.bounds.width),
      height: Math.max(fit.height, selected.bounds.height),
    };
    result.dividers = [];
  }
  return result;
}
