import type {
  Axis,
  DividerBox,
  Layout,
  LayoutContext,
  Rect,
  ResolvedLayout,
  ScrollerBox,
} from "../types";
import type { ViewState } from "../types";
import { shares } from "../geometry/shares";
import { extentIn } from "../geometry/extent";
import { mirrorRect } from "../geometry/direction";
import { noFocus, panes } from "../tree/tree";
import { allPanes, choose, overlayOf, type Projected } from "./overlay";
import { fold, replay } from "./replay";
import { chooseFold } from "./priority";
import { checkContext, misfit } from "./context";
function build(layout: Layout, ctx: LayoutContext): Projected {
  const { fit, paneCap } = ctx;
  let { root, order } = replay(layout, layout.overlay?.folds ?? [], fit);
  while (misfit(root, fit, paneCap)) {
    const choice = chooseFold(root, noFocus(), order);
    if (!choice) break;
    root = fold(root, choice, fit, order);
  }
  choose(root, layout.overlay?.shown);
  return root;
}
export function resolve(layout: Layout, view: ViewState, ctx: LayoutContext): ResolvedLayout {
  ctx = checkContext(ctx);
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
        const extent = extentIn(
          reference,
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
  const result: ResolvedLayout = { panes: [], dividers: [], stacks: [], shelf: [], scrollers: [] };
  const folded = new Set<string>();
  // What each row that scrolls holds, so right to left can mirror it within its own content.
  const inScroller = new Map<object, ScrollerBox>();
  function draw(
    n: Projected,
    input: Rect,
    stackId?: string,
    hidden = false,
    isFolded = false,
    scroller?: ScrollerBox,
  ): void {
    // maxWidth and maxHeight are soft: a slot fills what it is given, so no void opens beside it.
    const rect = {
      ...input,
      width: Math.max(n.bounds.width, input.width),
      height: Math.max(input.height, n.bounds.height),
    };
    if (n.pane) {
      if (isFolded) folded.add(n.id);
      const box = {
        id: n.id,
        rect,
        ...(stackId ? { stackId, hidden: hidden ? ("tab" as const) : undefined } : {}),
      };
      result.panes.push(box);
      if (scroller) {
        inScroller.set(box, scroller);
        scroller.paneIds.push(n.id);
      }
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
          scroller,
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
    // A row that scrolls (not one inside another: that is a plain row) lays each child at its own width: a person's
    // px size, else its comfortable width, within its min and max. Only when they don't fill the row do they share
    // it out as any row does, so no void opens at its end.
    const scrolls = horizontal && !!n.scroll && !scroller;
    const own = scrolls
      ? n.children.map((c, i) =>
          "px" in c.size
            ? Math.max(c.size.px, mins[i]!)
            : Math.min(Math.max(c.bounds.comfortable, mins[i]!), c.bounds.maxWidth),
        )
      : [];
    const overflows = scrolls && own.reduce((a, b) => a + b, 0) > available;
    const lengths = overflows
      ? own
      : shares(
          n.children.map((c, i) =>
            horizontal
              ? {
                  size: c.size,
                  min: mins[i]!,
                  comfortable: c.bounds.comfortable,
                  max: c.bounds.maxWidth,
                }
              : {
                  size: c.size,
                  min: mins[i]!,
                  comfortable: c.bounds.comfortableHeight,
                  max: c.bounds.maxHeight,
                },
          ),
          available,
          mode,
        );
    let strip = scroller;
    if (scrolls) {
      strip = {
        id: n.id,
        rect: { ...input },
        contentWidth: lengths.reduce((a, b) => a + b, 0) + fit.gap * (n.children.length - 1),
        paneIds: [],
      };
      result.scrollers.push(strip);
    }
    let offset = horizontal ? rect.x : rect.y;
    n.children.forEach((child, index) => {
      const extent = lengths[index]!;
      const childRect = horizontal
        ? { x: offset, y: rect.y, width: extent, height: rect.height }
        : { x: rect.x, y: offset, width: rect.width, height: extent };
      draw(child, childRect, stackId, hidden, isFolded, strip);
      offset += extent;
      if (index < n.children.length - 1) {
        // A drag may take a pane past its max: the person's size wins over the kind's preference.
        // In a row that scrolls, a divider widens only the child before it: the content grows, so no max.
        const total = extent + lengths[index + 1]!;
        const min = mins[index]!;
        const max = scrolls ? Infinity : total - mins[index + 1]!;
        const divider: DividerBox = {
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
        };
        result.dividers.push(divider);
        if (strip) inScroller.set(divider, strip);
        offset += fit.gap;
      }
    });
  }
  const width = Math.max(fit.width, root.bounds.width);
  draw(root, { x: 0, y: 0, width, height: Math.max(fit.height, root.bounds.height) });
  // Right to left, a row starts at the right: the same layout, mirrored. Rects are screen coordinates either way.
  // A row that scrolls is mirrored as a window, and its content within itself, so it starts at its right edge.
  if (ctx.dir === "rtl") {
    const before = new Map(result.scrollers.map((s) => [s, s.rect]));
    for (const s of result.scrollers) s.rect = mirrorRect(s.rect, width);
    const place = (item: { rect: Rect }) => {
      const s = inScroller.get(item);
      if (!s) return mirrorRect(item.rect, width);
      const along = item.rect.x - before.get(s)!.x;
      return { ...item.rect, x: s.rect.x + s.contentWidth - along - item.rect.width };
    };
    for (const b of result.panes) b.rect = place(b);
    for (const d of result.dividers) d.rect = place(d);
  }
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
