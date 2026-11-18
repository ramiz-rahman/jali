import { context as ctx, stripBase, fit, freeze, layout, pane, view } from "./fixtures";
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { find } from "../tree/tree";
import type { PaneNode } from "../types";

describe("dividers", () => {
  it("remembers pre-drag preset proportions for double-click reset", () => {
    const tree = layout(
      pane("a", "small", { size: { weight: 2 } }),
      pane("b", "small", { size: { weight: 3 } }),
    );
    const resized = core.resizeDivider(tree, "root", 0, 50, ctx(fit(1006)));
    const reset = core.resetDivider(resized, "root", 0, ctx(fit(1006)));
    expect(stripBase(reset)).toEqual(tree);
  });
  it("resizes grouped neighbours after the context fold and resets their sizes", () => {
    const tree = layout(
      pane("a", "list"),
      pane("b", "record", { linkedTo: "a" }),
      pane("c", "inspector", { linkedTo: "b" }),
    );
    const initial = core.resolve(tree, view(), ctx(fit(1000)));
    expect(initial.dividers[0]!.neighbours).toEqual([["a"], ["b", "c"]]);
    const resized = core.resizeDivider(tree, "root", 0, 20, ctx(fit(1000)));
    const after = core.resolve(resized, view(), ctx(fit(1000)));
    expect(after.dividers[0]!.value).toBe(initial.dividers[0]!.value + 20);
    expect(find(resized.root, "a")!.userSized).toBe(true);
    expect(find(resized.root, "b")!.userSized).toBe(true);
    expect(find(resized.root, "c")!.userSized).toBe(true);
    expect(
      core.resolve(core.resetDivider(resized, "root", 0, ctx(fit(1000))), view(), ctx(fit(1000))),
    ).toEqual(initial);
    // Unfolding clamps the saved preferences at each pane's original minimum.
    const wide = core.resolve(resized, view(), ctx(fit(1920)));
    for (const box of wide.panes)
      expect(box.rect.width).toBeGreaterThanOrEqual(
        fit().kinds[(find(tree.root, box.id) as PaneNode).ref.kind]!.minWidth,
      );
  });
  it.each([
    [-10000, 320, 880],
    [10000, 720, 480],
    [100, 700, 500],
  ])("clamps delta %s at both neighbours' minima and marks userSized", (delta, left, right) => {
    const tree = freeze(layout(pane("a", "list"), pane("b", "record")));
    const resized = core.resizeDivider(tree, "root", 0, delta, ctx(fit(1206)));
    // Dragged sizes are proportions (weights in px units), so the split keeps filling its space.
    expect(find(resized.root, "a")).toMatchObject({ size: { weight: left }, userSized: true });
    expect(find(resized.root, "b")).toMatchObject({ size: { weight: right }, userSized: true });
    expect(core.resolve(resized, view(), ctx(fit(1206))).panes.map((p) => p.rect.width)).toEqual([
      left,
      right,
    ]);
  });
  it("resizes column splits; a drag on a row split may pass a soft maxWidth", () => {
    const tree = layout({
      id: "col",
      type: "column",
      size: { weight: 1 },
      children: [pane("a"), pane("b")],
    });
    const resized = core.resizeDivider(tree, "col", 0, 10000, ctx(fit(1000, 406)));
    expect(find(resized.root, "a")!.size).toEqual({ weight: 320 });
    expect(find(resized.root, "b")!.size).toEqual({ weight: 80 });
    const options = {
      ...fit(806),
      kinds: { ...fit().kinds, small: { ...fit().kinds.small!, maxWidth: 600 } },
    };
    // Was 600 (a hard max). The person's size wins over the kind's preference; only b's minimum (100) stops the drag.
    expect(
      find(
        core.resizeDivider(layout(pane("a"), pane("b")), "root", 0, 10000, ctx(options)).root,
        "a",
      )!.size,
    ).toEqual({ weight: 700 });
  });
  it("resets just the two neighbours to equal default weights", () => {
    const tree = layout(
      pane("a", "small", { size: { px: 200 }, userSized: true }),
      pane("b", "small", { size: { px: 400 }, userSized: true }),
      pane("c", "small", { size: { px: 500 }, userSized: true }),
    );
    const reset = core.resetDivider(tree, "root", 0, ctx());
    expect(find(reset.root, "a")!.size).toEqual({ weight: 1 });
    expect(find(reset.root, "b")!.userSized).toBeUndefined();
    expect(find(reset.root, "c")).toEqual(find(tree.root, "c"));
  });
  it("keeps filling the row after a drag when a sibling closes or the window widens", () => {
    const tree = freeze(layout(pane("a", "list"), pane("b", "record")));
    const resized = core.resizeDivider(tree, "root", 0, 100, ctx(fit(1206)));
    const wider = core.resolve(resized, view(), ctx(fit(1806))).panes.map((p) => p.rect.width);
    expect(wider[0]! + wider[1]! + 6).toBeCloseTo(1806, 0);
    expect(wider[0]! / wider[1]!).toBeCloseTo(700 / 500, 1);
  });
  it("never tucks the last pane on screen", () => {
    const tree = layout(pane("a"), pane("b"));
    const one = core.tuck(tree, view(), "a", ctx(fit()));
    if (!one.ok) throw new Error("expected a tuck");
    expect(core.canTuck(one.layout, "b", ctx(fit()))).toEqual({ ok: false, reason: "tab" });
    expect(core.canTuck(layout(pane("a")), "a", ctx(fit()))).toEqual({ ok: false, reason: "last" });
  });
  it("ignores missing dividers and nonfinite deltas", () => {
    const tree = layout(pane("a"), pane("b"));
    expect(core.resizeDivider(tree, "missing", 0, 16, ctx(fit()))).toEqual(tree);
    expect(core.resizeDivider(tree, "root", 99, 16, ctx(fit()))).toEqual(tree);
    expect(core.resizeDivider(tree, "root", 0, NaN, ctx(fit()))).toEqual(tree);
    expect(core.resetDivider(tree, "missing", 0, ctx())).toEqual(tree);
  });
});
