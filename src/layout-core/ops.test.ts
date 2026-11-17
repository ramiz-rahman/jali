import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { find, panes } from "./model";
import { fit, freeze, layout, pane, ref, view } from "./test-utils";
import type { Edge, PaneNode, SplitNode, StackNode } from "./types";

describe("open", () => {
  it("opens linked on the right, balances undragged siblings and keeps focus on source", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a", "list", { size: { weight: 7 } }), pane("b", "inspector", { size: { px: 300 }, userSized: true })));
    const result = core.openBeside(tree, freeze({ ...view(), zoomed: "a" }), "a", ref(), fit(1920));
    expect(result.mode).toBe("beside");
    expect(result.view.focused).toBe("a"); expect(result.view.zoomed).toBeUndefined();
    expect(panes(result.layout.root).map(p => p.id)).toEqual(["a", result.opened, "b"]);
    expect(find(result.layout.root, result.opened)).toMatchObject({ linkedTo: "a", ref: ref() });
    expect(find(result.layout.root, "a")!.size).toEqual({ weight: 1 });
    expect(find(result.layout.root, "b")).toMatchObject({ size: { px: 300 }, userSized: true });
  });
  it("replaces a linked same-kind pane and retains its ID and sizes", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a", "list"), pane("b", "record", { linkedTo: "a", size: { px: 600 }, userSized: true })));
    const result = core.openBeside(tree, view(), "a", ref("record", 99), fit());
    expect(result).toMatchObject({ mode: "replaced", opened: "b", view: { focused: "a" } });
    expect(panes(result.layout.root)).toHaveLength(2);
    expect(find(result.layout.root, "b")).toMatchObject({ size: { px: 600 }, userSized: true, ref: ref("record", 99) });
  });
  it("does not replace a pinned linked pane or unrelated same-kind pane", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b", "record", { linkedTo: "a", pinned: true }), pane("c", "record"));
    const result = core.openBeside(tree, view(), "a", ref(), fit(1920));
    expect(result.mode).toBe("beside");
    expect(panes(result.layout.root)).toHaveLength(4);
  });
  it("falls back to an auto tab and unfolds after widening", () => {
    const core = createLayoutCore();
    const result = core.openBeside(layout(pane("a", "list")), view(), "a", ref(), fit(600));
    expect(result.mode).toBe("tab");
    // The tree stays canonical; the fold is recorded and sticky.
    expect(result.layout.root).toMatchObject({ type: "row" });
    expect(result.layout.fold).toEqual({ order: [result.opened] });
    const narrow = core.resolve(result.layout, result.view, fit(600));
    expect(narrow.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["a"]);
    expect(narrow.stacks[0]).toMatchObject({ id: "@auto:a", homeId: "a" });
    // resolve() alone never unfolds; a size change refits.
    expect(core.resolve(result.layout, result.view, fit(1440)).panes.filter(p => !p.hiddenInStack)).toHaveLength(1);
    const wide = core.refit(result.layout, result.view, fit(1440));
    expect(wide.fold).toBeUndefined();
    expect(core.resolve(wide, result.view, fit(1440)).panes.filter(p => !p.hiddenInStack)).toHaveLength(2);
  });
  it.each(["left", "top"] as const)("restores the requested %s position after a fallback tab unfolds", edge => {
    const core = createLayoutCore();
    const result = core.split(layout(pane("a", "record")), view(), "a", edge, ref("record"), fit(600, 350));
    expect(result.mode).toBe("tab");
    const boxes = core.resolve(core.refit(result.layout, result.view, fit(1440, 900)), result.view, fit(1440, 900)).panes;
    expect(boxes[0]!.id).toBe(result.opened);
    expect(boxes[0]!.rect[edge === "left" ? "x" : "y"]).toBeLessThan(boxes[1]!.rect[edge === "left" ? "x" : "y"]);
  });
  it("tabs a no-room open with its source, leaves deliberate stacks alone and keeps the source focused", () => {
    // Superseded rule: the new pane used to join the nearest deliberate stack. A fold now joins its source (DECISIONS).
    const core = createLayoutCore(), tree = layout(pane("a", "list"), { id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("b", "record"), pane("c", "record")] });
    const result = core.openBeside(tree, view(), "a", ref("inspector"), fit(900));
    expect(result.mode).toBe("tab");
    expect((find(result.layout.root, "tabs") as StackNode).children.map(p => p.id)).toEqual(["b", "c"]);
    const resolved = core.resolve(result.layout, result.view, fit(900));
    expect(resolved.stacks[0]).toMatchObject({ homeId: "a", paneIds: ["a", result.opened] });
    expect(resolved.panes.find(p => p.id === "a")!.hiddenInStack).toBe(false);
    expect(result.view.focused).toBe("a");
    expect(core.validate(result.layout, fit().kinds)).toEqual({ ok: true });
  });
  it.each(["left", "right", "top", "bottom"] as Edge[])("splits %s, focuses new pane and clears zoom", edge => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a")));
    const result = core.split(tree, { ...view(), zoomed: "a" }, "a", edge, ref("small"), fit());
    expect(result.view.focused).toBe(result.opened); expect(result.view.zoomed).toBeUndefined();
    expect(result.layout.root.type).toBe(edge === "left" || edge === "right" ? "row" : "column");
    expect(panes(result.layout.root).map(p => p.id)).toEqual(edge === "left" || edge === "top" ? [result.opened, "a"] : ["a", result.opened]);
  });
  it("splits a tab group as a unit and retains its deliberate tabs", () => {
    const core = createLayoutCore(), tree = layout({ id: "tabs", type: "stack", origin: "user", active: "a", size: { weight: 1 }, children: [pane("a"), pane("b")] });
    const result = core.split(tree, view(), "a", "right", ref("small"), fit());
    expect(find(result.layout.root, "tabs")).toMatchObject({ type: "stack", origin: "user", children: [pane("a"), pane("b")] });
    expect(result.layout.root.type).toBe("row");
  });
  it("uses the source's existing deliberate stack when space runs out", () => {
    const core = createLayoutCore(), tree = layout({ id: "tabs", type: "stack", origin: "user", active: "a", size: { weight: 1 }, children: [pane("a", "list"), pane("b", "record")] });
    const result = core.openBeside(tree, view(), "a", ref("wide"), fit(700));
    expect(result.mode).toBe("tab");
    expect(find(result.layout.root, "tabs")).toMatchObject({ type: "stack", origin: "user", active: "a" });
    expect(panes(result.layout.root)).toHaveLength(3);
    const resolved = core.resolve(result.layout, result.view, fit(700));
    expect(resolved.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["a"]);
    expect(new Set(resolved.panes.map(p => p.stackId)).size).toBe(1);
  });
  it("caps visible slots by tabbing the oldest eligible pane", () => {
    const core = createLayoutCore({ paneCap: 3 }), tree = layout(pane("a"), pane("b"), pane("c"));
    const result = core.openBeside(tree, view("c"), "c", ref("small"), fit(1920));
    expect(result.mode).toBe("beside");
    expect(result.layout.fold?.order).toEqual(["a"]);
    expect(panes(result.layout.root)).toHaveLength(4);
    const resolved = core.resolve(result.layout, result.view, fit(1920));
    expect(resolved.stacks[0]!.paneIds).toContain("a");
    expect(resolved.stacks[0]!.paneIds).not.toContain("c");
    expect(resolved.panes.filter(p => !p.hiddenInStack)).toHaveLength(3);
    expect(resolved.panes.find(p => p.id === "a")!.hiddenInStack).toBe(true);
  });
  it("defaults the cap to ten and retains all pane objects", () => {
    const core = createLayoutCore(), tree = layout(...Array.from({ length: 10 }, (_, i) => pane(`p${i}`)));
    const result = core.openBeside(tree, view("p9"), "p9", ref("small"), fit(1920));
    expect(result.mode).toBe("beside"); expect(panes(result.layout.root)).toHaveLength(11);
  });
  it("uses a new tab if all cap victims are pinned or focused", () => {
    const core = createLayoutCore({ paneCap: 2 });
    const result = core.openBeside(layout(pane("a", "small", { pinned: true }), pane("b")), view("b"), "b", ref("small"), fit());
    expect(result.mode).toBe("tab");
    expect((find(result.layout.root, "a") as PaneNode).pinned).toBe(true);
    expect(core.resolve(result.layout, result.view, fit()).panes.filter(p => !p.hiddenInStack).length).toBeLessThanOrEqual(2);
  });
  it.each([0, -1, 1.5, Infinity])("rejects invalid pane cap %s", paneCap => { expect(() => createLayoutCore({ paneCap })).toThrow(RangeError); });
  it("rolls back invalid source and kind by leaving input unchanged", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a")));
    expect(() => core.openBeside(tree, view(), "missing", ref(), fit())).toThrow();
    expect(() => core.split(tree, view(), "a", "right", ref("missing"), fit())).toThrow();
    expect(tree).toEqual(layout(pane("a")));
  });
});

describe("close", () => {
  it("returns a snapshot undo entry and space to the sibling opener", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a"), pane("b", "small", { linkedTo: "a" }), pane("c", "small", { userSized: true, size: { px: 150 } })));
    const state = freeze({ ...view("b", ["b", "a", "c"]), zoomed: "b" });
    const result = core.close(tree, state, "b");
    expect(find(result.layout.root, "a")!.size).toEqual({ weight: 2 });
    expect(find(result.layout.root, "c")).toMatchObject({ size: { px: 150 }, userSized: true });
    expect(result.view).toEqual(view("a", ["a", "c"]));
    expect(result.undo).toEqual({ label: "Pane closed", before: { layout: tree, view: state } });
    expect(result.undo.before.layout).not.toBe(tree);
  });
  it("returns fixed pixels and the removed gap to the opener using resolved geometry", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b", "small", { linkedTo: "a", size: { px: 200 } }), pane("c", "small", { size: { px: 150 }, userSized: true }));
    const before = core.resolve(tree, view("b"), fit(1000));
    const result = core.close(tree, view("b"), "b");
    const after = core.resolve(result.layout, result.view, fit(1000));
    expect(after.panes.find(p => p.id === "a")!.rect.width).toBe(before.panes.find(p => p.id === "a")!.rect.width + 206);
    expect(after.panes.find(p => p.id === "c")!.rect.width).toBe(150);
  });
  it("gives space to the next sibling when the opener is elsewhere", () => {
    const core = createLayoutCore();
    const result = core.close(layout(pane("a"), pane("b", "small", { linkedTo: "absent" }), pane("c")), view("b", ["b"]), "b");
    expect(find(result.layout.root, "c")!.size).toEqual({ weight: 2 });
    expect(result.view.focused).toBe("c");
  });
  it("uses previous in order when closing the last pane without history", () => {
    const result = createLayoutCore().close(layout(pane("a"), pane("b"), pane("c")), view("c", ["c"]), "c");
    expect(result.view.focused).toBe("b");
  });
  it("preserves focus when closing a background pane and cleans dangling links", () => {
    const result = createLayoutCore().close(layout(pane("a"), pane("b"), pane("c", "small", { linkedTo: "b" })), view("a", ["a", "b"]), "b");
    expect(result.view.focused).toBe("a");
    expect((find(result.layout.root, "c") as PaneNode).linkedTo).toBeUndefined();
  });
  it("prunes singleton split containers and inherits their outer size", () => {
    const tree = layout({ id: "col", type: "column", size: { px: 600 }, userSized: true, children: [pane("a"), pane("b")] }, pane("c"));
    const result = createLayoutCore().close(tree, view("b"), "b");
    expect(find(result.layout.root, "col")).toBeUndefined();
    expect(find(result.layout.root, "a")).toMatchObject({ size: { px: 600 }, userSized: true });
  });
  it("closes active tabs, prunes singleton stacks and activates focus-history tabs", () => {
    const tree = layout({ id: "tabs", type: "stack", size: { weight: 1 }, origin: "user", active: "b", children: [pane("a"), pane("b"), pane("c")] });
    const result = createLayoutCore().close(tree, view("b", ["b", "c", "a"]), "b");
    expect(result.layout.root).toMatchObject({ type: "stack", active: "c" });
    expect(createLayoutCore().close(result.layout, result.view, "c").layout.root).toMatchObject({ type: "pane", id: "a" });
  });
  it("never closes the final pane and handles missing IDs", () => {
    const core = createLayoutCore(), tree = layout(pane("a"));
    expect(core.close(tree, view(), "a").layout).toEqual(tree);
    expect(core.close(tree, view(), "missing").undo.before.layout).toEqual(tree);
  });
  it("closeOthers retains the chosen pane, resets view and records undo", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a"), pane("b", "small", { linkedTo: "a" }), pane("c")));
    const result = core.closeOthers(tree, { ...view("a"), zoomed: "a" }, "b");
    expect(result.layout).toEqual(layout(pane("b")));
    expect(result.view).toEqual(view("b"));
    expect(result.undo.before.layout).toEqual(tree);
    expect(core.closeOthers(tree, view(), "missing").layout).toEqual(tree);
  });
});

describe("move and view operations", () => {
  it.each(["left", "right", "top", "bottom"] as Edge[])("places an edge drop %s beside target and clears zoom", edge => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a"), pane("b"), pane("c")));
    const result = core.drop(tree, { ...view("a"), zoomed: "a" }, "a", "c", edge, "tab");
    expect(result.view).toEqual(view("a"));
    expect(panes(result.layout.root).map(p => p.id)).toEqual(edge === "left" || edge === "top" ? ["b", "a", "c"] : ["b", "c", "a"]);
    expect(core.validate(result.layout, fit().kinds)).toEqual({ ok: true });
  });
  it("swaps pane identity/content while keeping slot sizing", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a", "list", { size: { px: 400 }, userSized: true }), pane("b", "record")));
    const result = core.drop(tree, { ...view(), zoomed: "a" }, "a", "b", "centre", "swap");
    expect(panes(result.layout.root).map(p => p.id)).toEqual(["b", "a"]);
    expect(find(result.layout.root, "b")).toMatchObject({ size: { px: 400 }, userSized: true });
    expect(result.view.zoomed).toBeUndefined();
    expect(core.swap(result.layout, "a", "b")).toEqual(tree);
  });
  it("centre tab groups deliberately and allows dragging a tab back out", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b"));
    const grouped = core.drop(tree, view(), "a", "b", "centre", "tab");
    expect(grouped.layout.root).toMatchObject({ type: "stack", origin: "user", active: "a" });
    const split = core.drop(grouped.layout, grouped.view, "a", "b", "bottom", "tab");
    expect(split.layout.root.type).toBe("column");
    expect(panes(split.layout.root).map(p => p.id)).toEqual(["b", "a"]);
  });
  it("adds a deliberate tab into an existing stack and can swap its active pane", () => {
    const core = createLayoutCore(), tree = layout({ id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a"), pane("b")] }, pane("c"));
    const grouped = core.drop(tree, view("c"), "c", "b", "centre", "tab");
    expect(grouped.layout.root).toMatchObject({ type: "stack", active: "c", origin: "user" });
    expect(core.swap(grouped.layout, "a", "c").root).toMatchObject({ active: "a" });
  });
  it("moves directionally and does not wrap at the boundary", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b"), pane("c"));
    const moved = core.moveDirection(tree, { ...view(), zoomed: "a" }, "a", "right", fit());
    expect(panes(moved.layout.root).map(p => p.id)).toEqual(["b", "a", "c"]);
    expect(moved.view.zoomed).toBeUndefined();
    const boundary = core.moveDirection(tree, view(), "a", "left", fit());
    expect(boundary.layout).toEqual(tree);
  });
  it("handles self/missing drops and swaps without mutation", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a"), pane("b")));
    expect(core.drop(tree, view(), "a", "a", "centre", "tab").layout).toEqual(tree);
    expect(core.drop(tree, view(), "missing", "b", "left", "swap").layout).toEqual(tree);
    expect(core.swap(tree, "a", "missing")).toEqual(tree);
  });
  it("tucks and puts back immutably; a missing pane is refused", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a"), pane("b")));
    const tucked = core.tuck(tree, view(), "a", fit());
    expect(tucked.ok && find(tucked.layout.root, "a")).toMatchObject({ tuckedFrom: { parent: "root", home: "b" } });
    expect(core.tuck(tree, view(), "missing", fit())).toEqual({ ok: false, reason: "missing" });
    expect(core.putBack(tree, view(), "a", fit())).toEqual({ ok: false, reason: "not-tucked" });
  });
  it("toggles zoom, keeps it following focus, and resets presets by deep clone", () => {
    const core = createLayoutCore(), state = freeze(view());
    const zoomed = core.toggleZoom(state, "a");
    expect(zoomed.zoomed).toBe("a"); expect(core.toggleZoom(zoomed, "a").zoomed).toBeUndefined();
    expect(core.focus(zoomed, "b")).toMatchObject({ focused: "b", zoomed: "b", focusHistory: ["b", "a"] });
    const preset = freeze(layout(pane("a"))), reset = core.resetLayout(preset);
    expect(reset).toEqual(preset); expect(reset.root).not.toBe(preset.root);
  });
  it("selects only a real tab in its stack", () => {
    const core = createLayoutCore(), tree = layout({ id: "tabs", type: "stack", origin: "user", active: "a", size: { weight: 1 }, children: [pane("a"), pane("b")] });
    expect(core.setActiveTab(tree, "tabs", "b").root).toMatchObject({ active: "b" });
    expect(core.setActiveTab(tree, "tabs", "missing")).toEqual(tree);
    expect(core.setActiveTab(tree, "a", "b")).toEqual(tree);
  });
});

describe("dividers", () => {
  it("remembers pre-drag preset proportions for double-click reset", () => {
    const core = createLayoutCore(), tree = layout(pane("a", "small", { size: { weight: 2 } }), pane("b", "small", { size: { weight: 3 } }));
    const resized = core.resizeDivider(tree, "root", 0, 50, fit(1006));
    const reset = core.resetDivider(resized, "root", 0);
    expect(reset).toEqual(tree);
  });
  it("resizes grouped neighbours after the context fold and resets their sizes", () => {
    const core = createLayoutCore();
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }), pane("c", "inspector", { linkedTo: "b" }));
    const initial = core.resolve(tree, view(), fit(1000));
    expect(initial.dividers[0]!.neighbours).toEqual([["a"], ["b", "c"]]);
    const resized = core.resizeDivider(tree, "root", 0, 20, fit(1000));
    const after = core.resolve(resized, view(), fit(1000));
    expect(after.dividers[0]!.value).toBe(initial.dividers[0]!.value + 20);
    expect(find(resized.root, "a")!.userSized).toBe(true);
    expect(find(resized.root, "b")!.userSized).toBe(true);
    expect(find(resized.root, "c")!.userSized).toBe(true);
    expect(core.resolve(core.resetDivider(resized, "root", 0), view(), fit(1000))).toEqual(initial);
    // Unfolding clamps the saved preferences at each pane's original minimum.
    const wide = core.resolve(resized, view(), fit(1920));
    for (const box of wide.panes) expect(box.rect.width).toBeGreaterThanOrEqual(fit().kinds[(find(tree.root, box.id) as PaneNode).ref.kind]!.minWidth);
  });
  it.each([[-10000, 320, 880], [10000, 720, 480], [100, 700, 500]])("clamps delta %s at both neighbours' minima and marks userSized", (delta, left, right) => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a", "list"), pane("b", "record")));
    const resized = core.resizeDivider(tree, "root", 0, delta, fit(1206));
    // Dragged sizes are proportions (weights in px units), so the split keeps filling its space.
    expect(find(resized.root, "a")).toMatchObject({ size: { weight: left }, userSized: true });
    expect(find(resized.root, "b")).toMatchObject({ size: { weight: right }, userSized: true });
    expect(core.resolve(resized, view(), fit(1206)).panes.map(p => p.rect.width)).toEqual([left, right]);
  });
  it("resizes column splits and honours maxWidth on row splits", () => {
    const core = createLayoutCore(), tree = layout({ id: "col", type: "column", size: { weight: 1 }, children: [pane("a"), pane("b")] });
    const resized = core.resizeDivider(tree, "col", 0, 10000, fit(1000, 406));
    expect(find(resized.root, "a")!.size).toEqual({ weight: 320 });
    expect(find(resized.root, "b")!.size).toEqual({ weight: 80 });
    const options = { ...fit(806), kinds: { ...fit().kinds, small: { ...fit().kinds.small!, maxWidth: 600 } } };
    expect(find(core.resizeDivider(layout(pane("a"), pane("b")), "root", 0, 10000, options).root, "a")!.size).toEqual({ weight: 600 });
  });
  it("resets just the two neighbours to equal default weights", () => {
    const core = createLayoutCore(), tree = layout(pane("a", "small", { size: { px: 200 }, userSized: true }), pane("b", "small", { size: { px: 400 }, userSized: true }), pane("c", "small", { size: { px: 500 }, userSized: true }));
    const reset = core.resetDivider(tree, "root", 0);
    expect(find(reset.root, "a")!.size).toEqual({ weight: 1 });
    expect(find(reset.root, "b")!.userSized).toBeUndefined();
    expect(find(reset.root, "c")).toEqual(find(tree.root, "c"));
  });
  it("keeps filling the row after a drag when a sibling closes or the window widens", () => {
    const core = createLayoutCore(), tree = freeze(layout(pane("a", "list"), pane("b", "record")));
    const resized = core.resizeDivider(tree, "root", 0, 100, fit(1206));
    const wider = core.resolve(resized, view(), fit(1806)).panes.map(p => p.rect.width);
    expect(wider[0]! + wider[1]! + 6).toBeCloseTo(1806, 0);
    expect(wider[0]! / wider[1]!).toBeCloseTo(700 / 500, 1);
  });
  it("never tucks the last pane on screen", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b"));
    const one = core.tuck(tree, view(), "a", fit());
    if (!one.ok) throw new Error("expected a tuck");
    expect(core.canTuck(one.layout, "b", fit())).toEqual({ ok: false, reason: "tab" });
    expect(core.canTuck(layout(pane("a")), "a", fit())).toEqual({ ok: false, reason: "last" });
  });
  it("ignores missing dividers and nonfinite deltas", () => {
    const core = createLayoutCore(), tree = layout(pane("a"), pane("b"));
    expect(core.resizeDivider(tree, "missing", 0, 16, fit())).toEqual(tree);
    expect(core.resizeDivider(tree, "root", 99, 16, fit())).toEqual(tree);
    expect(core.resizeDivider(tree, "root", 0, NaN, fit())).toEqual(tree);
    expect(core.resetDivider(tree, "missing", 0)).toEqual(tree);
  });
});
