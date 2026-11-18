import { context as ctx, context, stripBase, fit, freeze, layout, pane, view } from "./fixtures";
import { describe, expect, it } from "vitest";
import * as core from "..";
import { find, panes } from "../tree/tree";
import type { Edge } from "../types";

describe("move and view operations", () => {
  it.each(["left", "right", "top", "bottom"] as Edge[])("places an edge drop %s beside target and clears zoom", edge => {
    const tree = freeze(layout(pane("a"), pane("b"), pane("c")));
    const result = core.drop(tree, { ...view("a"), zoomed: "a" }, "a", "c", edge, "tab", ctx());
    expect(result.view).toEqual(view("a"));
    expect(panes(result.layout.root).map(p => p.id)).toEqual(edge === "left" || edge === "top" ? ["b", "a", "c"] : ["b", "c", "a"]);
    expect(core.validate(result.layout, fit().kinds)).toEqual({ ok: true });
  });
  it("swaps pane identity/content while keeping slot sizing", () => {
    const tree = freeze(layout(pane("a", "list", { size: { px: 400 }, userSized: true }), pane("b", "record")));
    const result = core.drop(tree, { ...view(), zoomed: "a" }, "a", "b", "centre", "swap", ctx());
    expect(panes(result.layout.root).map(p => p.id)).toEqual(["b", "a"]);
    expect(find(result.layout.root, "b")).toMatchObject({ size: { px: 400 }, userSized: true });
    expect(result.view.zoomed).toBeUndefined();
    expect(core.swap(result.layout, "a", "b", ctx())).toEqual(tree);
  });
  it("centre tab groups deliberately and allows dragging a tab back out", () => {
    const tree = layout(pane("a"), pane("b"));
    const grouped = core.drop(tree, view(), "a", "b", "centre", "tab", ctx());
    expect(grouped.layout.root).toMatchObject({ type: "stack", origin: "user", active: "a" });
    const split = core.drop(grouped.layout, grouped.view, "a", "b", "bottom", "tab", ctx());
    expect(split.layout.root.type).toBe("column");
    expect(panes(split.layout.root).map(p => p.id)).toEqual(["b", "a"]);
  });
  it("adds a deliberate tab into an existing stack and can swap its active pane", () => {
    const tree = layout({ id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a"), pane("b")] }, pane("c"));
    const grouped = core.drop(tree, view("c"), "c", "b", "centre", "tab", ctx());
    expect(grouped.layout.root).toMatchObject({ type: "stack", active: "c", origin: "user" });
    expect(core.swap(grouped.layout, "a", "c", ctx()).root).toMatchObject({ active: "a" });
  });
  it("moves directionally and does not wrap at the boundary", () => {
    const tree = layout(pane("a"), pane("b"), pane("c"));
    const moved = core.moveDirection(tree, { ...view(), zoomed: "a" }, "a", "right", ctx(fit()));
    expect(panes(moved.layout.root).map(p => p.id)).toEqual(["b", "a", "c"]);
    expect(moved.view.zoomed).toBeUndefined();
    const boundary = core.moveDirection(tree, view(), "a", "left", ctx(fit()));
    expect(boundary.layout).toEqual(tree);
  });
  it("handles self/missing drops and swaps without mutation", () => {
    const tree = freeze(layout(pane("a"), pane("b")));
    expect(core.drop(tree, view(), "a", "a", "centre", "tab", ctx()).layout).toEqual(tree);
    expect(core.drop(tree, view(), "missing", "b", "left", "swap", ctx()).layout).toEqual(tree);
    expect(core.swap(tree, "a", "missing", ctx())).toEqual(tree);
  });
  it("tucks and puts back immutably; a missing pane is refused", () => {
    const tree = freeze(layout(pane("a"), pane("b")));
    const tucked = core.tuck(tree, view(), "a", ctx(fit()));
    expect(tucked.ok && tucked.layout.overlay?.tucks).toEqual([{ pane: "a", home: "b", seq: 1 }]);
    expect(core.tuck(tree, view(), "missing", ctx(fit()))).toEqual({ ok: false, reason: "missing" });
    expect(core.putBack(tree, view(), "a", ctx(fit()))).toEqual({ ok: false, reason: "not-tucked" });
  });
  it("toggles zoom, keeps it following focus, and resets presets by deep clone", () => {
    const state = freeze(view());
    const zoomed = core.toggleZoom(state, "a", context());
    expect(zoomed.zoomed).toBe("a"); expect(core.toggleZoom(zoomed, "a", context()).zoomed).toBeUndefined();
    expect(core.focus(zoomed, "b", context())).toMatchObject({ focused: "b", zoomed: "b", focusHistory: ["b", "a"] });
    const preset = freeze(layout(pane("a"))), reset = core.resetLayout(preset, view(), ctx());
    expect(stripBase(reset)).toEqual(preset); expect(reset.root).not.toBe(preset.root);
  });
  it("selects only a real tab in its stack", () => {
    const tree = layout({ id: "tabs", type: "stack", origin: "user", active: "a", size: { weight: 1 }, children: [pane("a"), pane("b")] });
    expect(core.setActiveTab(tree, "tabs", "b", ctx()).root).toMatchObject({ active: "b" });
    expect(core.setActiveTab(tree, "tabs", "missing", ctx())).toEqual(tree);
    expect(core.setActiveTab(tree, "a", "b", ctx())).toEqual(tree);
  });
});
