import { context as ctx, context, fit, freeze, layout, pane, ref, view } from "./fixtures";
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import type { FitOptions as TestFit, Edge, PaneNode, StackNode } from "../types";
import { find, panes } from "../tree/tree";

describe("open", () => {
  it("opens linked on the right, balances undragged siblings and keeps focus on source", () => {
    const tree = freeze(
      layout(
        pane("a", "list", { size: { weight: 7 } }),
        pane("b", "inspector", { size: { px: 300 }, userSized: true }),
      ),
    );
    const result = core.openBeside(
      tree,
      freeze({ ...view(), zoomed: "a" }),
      "a",
      ref(),
      ctx(fit(1920)),
    );
    expect(result.mode).toBe("beside");
    expect(result.view.focused).toBe("a");
    expect(result.view.zoomed).toBeUndefined();
    expect(panes(result.layout.root).map((p) => p.id)).toEqual(["a", result.opened, "b"]);
    expect(find(result.layout.root, result.opened)).toMatchObject({ linkedTo: "a", ref: ref() });
    expect(find(result.layout.root, "a")!.size).toEqual({ weight: 1 });
    expect(find(result.layout.root, "b")).toMatchObject({ size: { px: 300 }, userSized: true });
  });
  it("replaces a linked same-kind pane and retains its ID and sizes", () => {
    const tree = freeze(
      layout(
        pane("a", "list"),
        pane("b", "record", { linkedTo: "a", size: { px: 600 }, userSized: true }),
      ),
    );
    const result = core.openBeside(tree, view(), "a", ref("record", 99), ctx(fit()));
    expect(result).toMatchObject({ mode: "replaced", opened: "b", view: { focused: "a" } });
    expect(panes(result.layout.root)).toHaveLength(2);
    expect(find(result.layout.root, "b")).toMatchObject({
      size: { px: 600 },
      userSized: true,
      ref: ref("record", 99),
    });
  });
  it("does not replace a kept linked pane or unrelated same-kind pane", () => {
    const tree = layout(
      pane("a"),
      pane("b", "record", { linkedTo: "a", kept: true }),
      pane("c", "record"),
    );
    const result = core.openBeside(tree, view(), "a", ref(), ctx(fit(1920)));
    expect(result.mode).toBe("beside");
    expect(panes(result.layout.root)).toHaveLength(4);
  });
  it("falls back to an auto tab and unfolds after widening", () => {
    const result = core.openBeside(layout(pane("a", "list")), view(), "a", ref(), ctx(fit(600)));
    expect(result.mode).toBe("tab");
    // The tree stays canonical; the fold is recorded and sticky.
    expect(result.layout.root).toMatchObject({ type: "row" });
    expect(result.layout.overlay).toEqual({ tucks: [], folds: [result.opened], shown: {} });
    const narrow = core.resolve(result.layout, result.view, ctx(fit(600)));
    expect(narrow.panes.filter((p) => !p.hidden).map((p) => p.id)).toEqual(["a"]);
    expect(narrow.stacks[0]).toMatchObject({ id: "@auto:a", homeId: "a" });
    // resolve() alone never unfolds; a size change refits.
    expect(
      core.resolve(result.layout, result.view, ctx(fit(1440))).panes.filter((p) => !p.hidden),
    ).toHaveLength(1);
    const wide = core.refit(result.layout, result.view, ctx(fit(1440)));
    expect(wide.overlay).toBeUndefined();
    expect(
      core.resolve(wide, result.view, ctx(fit(1440))).panes.filter((p) => !p.hidden),
    ).toHaveLength(2);
  });
  it.each(["left", "top"] as const)(
    "restores the requested %s position after a fallback tab unfolds",
    (edge) => {
      const result = core.split(
        layout(pane("a", "record")),
        view(),
        "a",
        edge,
        ref("record"),
        ctx(fit(600, 350)),
      );
      expect(result.mode).toBe("tab");
      const boxes = core.resolve(
        core.refit(result.layout, result.view, ctx(fit(1440, 900))),
        result.view,
        ctx(fit(1440, 900)),
      ).panes;
      expect(boxes[0]!.id).toBe(result.opened);
      expect(boxes[0]!.rect[edge === "left" ? "x" : "y"]).toBeLessThan(
        boxes[1]!.rect[edge === "left" ? "x" : "y"],
      );
    },
  );
  it("tabs a no-room open with its source, leaves deliberate stacks alone and keeps the source focused", () => {
    // Superseded rule: the new pane used to join the nearest deliberate stack. A fold now joins its source (DECISIONS).
    const tree = layout(pane("a", "list"), {
      id: "tabs",
      type: "stack",
      origin: "user",
      active: "b",
      size: { weight: 1 },
      children: [pane("b", "record"), pane("c", "record")],
    });
    const result = core.openBeside(tree, view(), "a", ref("inspector"), ctx(fit(900)));
    expect(result.mode).toBe("tab");
    expect((find(result.layout.root, "tabs") as StackNode).children.map((p) => p.id)).toEqual([
      "b",
      "c",
    ]);
    const resolved = core.resolve(result.layout, result.view, ctx(fit(900)));
    expect(resolved.stacks[0]).toMatchObject({ homeId: "a", paneIds: ["a", result.opened] });
    expect(resolved.panes.find((p) => p.id === "a")!.hidden).toBeUndefined();
    expect(result.view.focused).toBe("a");
    expect(core.validate(result.layout, fit().kinds)).toEqual({ ok: true });
  });
  it.each(["left", "right", "top", "bottom"] as Edge[])(
    "splits %s, focuses new pane and clears zoom",
    (edge) => {
      const tree = freeze(layout(pane("a")));
      const result = core.split(
        tree,
        { ...view(), zoomed: "a" },
        "a",
        edge,
        ref("small"),
        ctx(fit()),
      );
      expect(result.view.focused).toBe(result.opened);
      expect(result.view.zoomed).toBeUndefined();
      expect(result.layout.root.type).toBe(edge === "left" || edge === "right" ? "row" : "column");
      expect(panes(result.layout.root).map((p) => p.id)).toEqual(
        edge === "left" || edge === "top" ? [result.opened, "a"] : ["a", result.opened],
      );
    },
  );
  it("splits a tab group as a unit and retains its deliberate tabs", () => {
    const tree = layout({
      id: "tabs",
      type: "stack",
      origin: "user",
      active: "a",
      size: { weight: 1 },
      children: [pane("a"), pane("b")],
    });
    const result = core.split(tree, view(), "a", "right", ref("small"), ctx(fit()));
    expect(find(result.layout.root, "tabs")).toMatchObject({
      type: "stack",
      origin: "user",
      children: [pane("a"), pane("b")],
    });
    expect(result.layout.root.type).toBe("row");
  });
  it("uses the source's existing deliberate stack when space runs out", () => {
    const tree = layout({
      id: "tabs",
      type: "stack",
      origin: "user",
      active: "a",
      size: { weight: 1 },
      children: [pane("a", "list"), pane("b", "record")],
    });
    const result = core.openBeside(tree, view(), "a", ref("wide"), ctx(fit(700)));
    expect(result.mode).toBe("tab");
    expect(find(result.layout.root, "tabs")).toMatchObject({
      type: "stack",
      origin: "user",
      active: "a",
    });
    expect(panes(result.layout.root)).toHaveLength(3);
    const resolved = core.resolve(result.layout, result.view, ctx(fit(700)));
    expect(resolved.panes.filter((p) => !p.hidden).map((p) => p.id)).toEqual(["a"]);
    expect(new Set(resolved.panes.map((p) => p.stackId)).size).toBe(1);
  });
  it("caps visible slots by tabbing the oldest eligible pane", () => {
    const ctx = (f: TestFit = context().fit) => context(f, 3),
      tree = layout(pane("a"), pane("b"), pane("c"));
    const result = core.openBeside(tree, view("c"), "c", ref("small"), ctx(fit(1920)));
    expect(result.mode).toBe("beside");
    expect(result.layout.overlay?.folds).toEqual(["a"]);
    expect(panes(result.layout.root)).toHaveLength(4);
    const resolved = core.resolve(result.layout, result.view, ctx(fit(1920)));
    expect(resolved.stacks[0]!.paneIds).toContain("a");
    expect(resolved.stacks[0]!.paneIds).not.toContain("c");
    expect(resolved.panes.filter((p) => !p.hidden)).toHaveLength(3);
    expect(resolved.panes.find((p) => p.id === "a")!.hidden).toBe("tab");
  });
  it("defaults the cap to ten and retains all pane objects", () => {
    const tree = layout(...Array.from({ length: 10 }, (_, i) => pane(`p${i}`)));
    const result = core.openBeside(tree, view("p9"), "p9", ref("small"), ctx(fit(1920)));
    expect(result.mode).toBe("beside");
    expect(panes(result.layout.root)).toHaveLength(11);
  });
  it("uses a new tab if all cap victims are kept or focused", () => {
    const ctx = (f: TestFit = context().fit) => context(f, 2);
    const result = core.openBeside(
      layout(pane("a", "small", { kept: true }), pane("b")),
      view("b"),
      "b",
      ref("small"),
      ctx(fit()),
    );
    expect(result.mode).toBe("tab");
    expect((find(result.layout.root, "a") as PaneNode).kept).toBe(true);
    expect(
      core.resolve(result.layout, result.view, ctx(fit())).panes.filter((p) => !p.hidden).length,
    ).toBeLessThanOrEqual(2);
  });
  it.each([0, -1, 1.5, Infinity])("rejects invalid pane cap %s", (paneCap) => {
    expect(() => core.resolve(layout(pane("a")), view(), context(fit(), paneCap))).toThrow(
      RangeError,
    );
  });
  it("rolls back invalid source and kind by leaving input unchanged", () => {
    const tree = freeze(layout(pane("a")));
    expect(() => core.openBeside(tree, view(), "missing", ref(), ctx(fit()))).toThrow();
    expect(() => core.split(tree, view(), "a", "right", ref("missing"), ctx(fit()))).toThrow();
    expect(tree).toEqual(layout(pane("a")));
  });
});
