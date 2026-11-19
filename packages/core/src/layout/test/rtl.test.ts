import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { endSide, mirrorRect, treeSide } from "../geometry/direction";
import { find } from "../tree/tree";
import type { Layout, LayoutContext, ResolvedLayout } from "../types";
import { context, fit, freeze, layout, pane, view } from "./fixtures";

const ltr = (width = 1000): LayoutContext => context(fit(width, 600));
const rtl = (width = 1000): LayoutContext => ({ ...ltr(width), dir: "rtl" });
const rects = (r: ResolvedLayout) => Object.fromEntries(r.panes.map((b) => [b.id, b.rect]));
const ids = (l: Layout) => {
  const out: string[] = [];
  const walk = (n: Layout["root"]) =>
    n.type === "pane" ? out.push(n.id) : n.children.forEach(walk);
  walk(l.root);
  return out;
};
const nested = () =>
  freeze(
    layout(pane("a"), {
      id: "col",
      type: "column",
      size: { weight: 2 },
      children: [pane("b"), pane("c")],
    }),
  );

describe("right to left: resolve", () => {
  it("lays a row out from the right, the mirror of left to right", () => {
    const tree = freeze(layout(pane("a"), pane("b", "small", { size: { weight: 2 } }), pane("c")));
    const l = core.resolve(tree, view(), ltr());
    const r = core.resolve(tree, view(), rtl());
    for (const b of l.panes) expect(rects(r)[b.id]).toEqual(mirrorRect(b.rect, 1000));
    // The first child is at the right; reading order (the list's order) is the same.
    expect(r.panes.map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(rects(r).a!.x).toBeGreaterThan(rects(r).b!.x);
    expect(rects(r).a!.x + rects(r).a!.width).toBe(1000);
  });

  it("mirrors nested splits and every divider; sizes and limits are the same", () => {
    const l = core.resolve(nested(), view(), ltr());
    const r = core.resolve(nested(), view(), rtl());
    expect(rects(r).b).toEqual(mirrorRect(rects(l).b!, 1000));
    expect(rects(r).c!.y).toBe(rects(l).c!.y);
    r.dividers.forEach((d, i) => {
      const was = l.dividers[i]!;
      expect(d.rect).toEqual(mirrorRect(was.rect, 1000));
      expect([d.value, d.min, d.max, d.neighbours]).toEqual([
        was.value,
        was.min,
        was.max,
        was.neighbours,
      ]);
    });
    // The row's divider sits between a (right) and the column (left).
    const row = r.dividers.find((d) => d.axis === "row")!;
    expect(row.rect.x).toBe(rects(r).a!.x - 6);
  });

  it("is left to right without a direction, and the tree is the same in both", () => {
    expect(core.resolve(nested(), view(), ltr())).toEqual(
      core.resolve(nested(), view(), { ...ltr(), dir: "ltr" }),
    );
    expect(core.refit(nested(), view(), rtl())).toEqual(core.refit(nested(), view(), ltr()));
  });

  it("zoom fills the workspace in either direction", () => {
    const r = core.resolve(nested(), { ...view("b"), zoomed: "b" }, rtl());
    expect(rects(r).b).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
  });
});

describe("right to left: sides", () => {
  it("a screen side is the other tree side right to left; up, down and centre are the same", () => {
    expect(treeSide("left", "rtl")).toBe("right");
    expect(treeSide("right", "rtl")).toBe("left");
    expect(treeSide("top", "rtl")).toBe("top");
    expect(treeSide("centre", "rtl")).toBe("centre");
    expect(treeSide("left", "ltr")).toBe("left");
    expect(treeSide("left", undefined)).toBe("left");
    expect([endSide("ltr"), endSide("rtl")]).toEqual(["right", "left"]);
  });
});

describe("right to left: focus and move by direction", () => {
  const tree = freeze(layout(pane("a"), pane("b"), pane("c")));

  it("focus left goes to the pane on the screen's left: the next one in reading order", () => {
    const r = core.resolve(tree, view("b"), rtl());
    expect(core.focusDirection(view("b"), r, "left", rtl()).focused).toBe("c");
    expect(core.focusDirection(view("b"), r, "right", rtl()).focused).toBe("a");
    const l = core.resolve(tree, view("b"), ltr());
    expect(core.focusDirection(view("b"), l, "left", ltr()).focused).toBe("a");
  });

  it("focus cycles in reading order, from the right", () => {
    const r = core.resolve(tree, view("a"), rtl());
    expect(core.focusCycle(view("a"), r, 1, rtl()).focused).toBe("b");
  });

  it("move left puts the pane on the screen's left of its neighbour: after it in the tree", () => {
    const moved = core.moveDirection(tree, view("a"), "a", "left", rtl());
    expect(ids(moved.layout)).toEqual(["b", "a", "c"]);
    const r = core.resolve(moved.layout, moved.view, rtl());
    expect(rects(r).a!.x).toBeLessThan(rects(r).b!.x);
    // The same key left to right moves the other way in the tree, and the left edge stays put.
    expect(core.moveDirection(tree, view("a"), "a", "left", ltr()).layout).toBe(tree);
    // c is at the screen's left edge right to left: nothing is further left.
    expect(core.moveDirection(tree, view("c"), "c", "left", rtl()).layout).toBe(tree);
  });

  it("a drop takes tree sides: right is after the target in both directions", () => {
    const d = core.drop(tree, view("a"), "a", "c", "right", "swap", rtl());
    expect(ids(d.layout)).toEqual(["b", "c", "a"]);
  });
});

describe("right to left: dividers", () => {
  it("resizing grows the first neighbour (the one on the right) and writes the same tree as left to right", () => {
    const tree = freeze(layout(pane("a", "list"), pane("b", "record")));
    const l = core.resizeDivider(tree, "root", 0, 40, ltr(1206));
    const r = core.resizeDivider(tree, "root", 0, 40, rtl(1206));
    expect(r).toEqual(l);
    const after = core.resolve(r, view(), rtl(1206));
    expect(rects(after).a!.width).toBe(
      core.resolve(tree, view(), rtl(1206)).panes[0]!.rect.width + 40,
    );
    expect(rects(after).a!.x + rects(after).a!.width).toBe(1206);
    expect(find(r.root, "a")!.userSized).toBe(true);
  });
});
