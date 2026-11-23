import { context as ctx, fit, freeze, layout, pane, view } from "./fixtures";
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { find } from "../tree/tree";
import type { PaneNode } from "../types";

describe("close", () => {
  it("records the closed pane and its slot, and gives its space to the sibling opener", () => {
    const tree = freeze(
      layout(
        pane("a"),
        pane("b", "small", { linkedTo: "a" }),
        pane("c", "small", { userSized: true, size: { px: 150 } }),
      ),
    );
    const state = freeze({ ...view("b", ["b", "a", "c"]), zoomed: "b" });
    const result = core.close(tree, state, "b", ctx());
    expect(find(result.layout.root, "a")!.size).toEqual({ weight: 2 });
    expect(find(result.layout.root, "c")).toMatchObject({ size: { px: 150 }, userSized: true });
    expect(result.view).toEqual(view("a", ["a", "c"]));
    // The undo entry is the operation, not the layout before: the pane, where it was, the link it had to it, and the
    // sizes the close changed.
    expect(result.undo).toEqual({
      kind: "close",
      closed: [
        {
          pane: find(tree.root, "b"),
          slot: [
            {
              parent: tree.root.id,
              type: "row",
              index: 1,
              size: { weight: 1 },
              before: [{ id: "a", pane: "a" }],
              after: [{ id: "c", pane: "c" }],
              active: false,
            },
          ],
          // Linked to A then: the link comes back only to a pane still showing A's object.
          source: (find(tree.root, "a") as PaneNode).ref,
          followers: [],
        },
      ],
      sizes: [{ id: "a", size: { weight: 1 }, after: { weight: 2 } }],
    });
    expect(result.undo!.kind === "tuck" || result.undo!.closed[0]!.pane).not.toBe(
      find(tree.root, "b"),
    );
  });
  it("returns fixed pixels and the removed gap to the opener using resolved geometry", () => {
    const tree = layout(
      pane("a"),
      pane("b", "small", { linkedTo: "a", size: { px: 200 } }),
      pane("c", "small", { size: { px: 150 }, userSized: true }),
    );
    const before = core.resolve(tree, view("b"), ctx(fit(1000)));
    const result = core.close(tree, view("b"), "b", ctx(fit(1000)));
    const after = core.resolve(result.layout, result.view, ctx(fit(1000)));
    expect(after.panes.find((p) => p.id === "a")!.rect.width).toBe(
      before.panes.find((p) => p.id === "a")!.rect.width + 206,
    );
    expect(after.panes.find((p) => p.id === "c")!.rect.width).toBe(150);
  });
  it("gives space to the next sibling when the opener is elsewhere", () => {
    const result = core.close(
      layout(pane("a"), pane("b", "small", { linkedTo: "absent" }), pane("c")),
      view("b", ["b"]),
      "b",
      ctx(),
    );
    expect(find(result.layout.root, "c")!.size).toEqual({ weight: 2 });
    expect(result.view.focused).toBe("c");
  });
  it("uses previous in order when closing the last pane without history", () => {
    const result = core.close(
      layout(pane("a"), pane("b"), pane("c")),
      view("c", ["c"]),
      "c",
      ctx(),
    );
    expect(result.view.focused).toBe("b");
  });
  it("preserves focus when closing a background pane and cleans dangling links", () => {
    const result = core.close(
      layout(pane("a"), pane("b"), pane("c", "small", { linkedTo: "b" })),
      view("a", ["a", "b"]),
      "b",
      ctx(),
    );
    expect(result.view.focused).toBe("a");
    expect((find(result.layout.root, "c") as PaneNode).linkedTo).toBeUndefined();
  });
  it("prunes singleton split containers and inherits their outer size", () => {
    const tree = layout(
      {
        id: "col",
        type: "column",
        size: { px: 600 },
        userSized: true,
        children: [pane("a"), pane("b")],
      },
      pane("c"),
    );
    const result = core.close(tree, view("b"), "b", ctx(fit(1000)));
    expect(find(result.layout.root, "col")).toBeUndefined();
    expect(find(result.layout.root, "a")).toMatchObject({ size: { px: 600 }, userSized: true });
  });
  it("closes active tabs, prunes singleton stacks and activates focus-history tabs", () => {
    const tree = layout({
      id: "tabs",
      type: "stack",
      size: { weight: 1 },
      origin: "user",
      active: "b",
      children: [pane("a"), pane("b"), pane("c")],
    });
    const result = core.close(tree, view("b", ["b", "c", "a"]), "b", ctx());
    expect(result.layout.root).toMatchObject({ type: "stack", active: "c" });
    expect(core.close(result.layout, result.view, "c", ctx()).layout.root).toMatchObject({
      type: "pane",
      id: "a",
    });
  });
  it("never closes the final pane and handles missing IDs", () => {
    const tree = layout(pane("a"));
    expect(core.close(tree, view(), "a", ctx()).layout).toEqual(tree);
    // Nothing closed, nothing to undo.
    expect(core.close(tree, view(), "missing", ctx()).undo).toBeUndefined();
    expect(core.close(tree, view(), "a", ctx()).undo).toBeUndefined();
  });
  it("closeOthers retains the chosen pane, resets view and records undo", () => {
    const tree = freeze(layout(pane("a"), pane("b", "small", { linkedTo: "a" }), pane("c")));
    const result = core.closeOthers(tree, { ...view("a"), zoomed: "a" }, "b", ctx());
    expect(result.layout).toEqual(layout(pane("b")));
    expect(result.view).toEqual(view("b"));
    // One entry, every closed pane in it, in reading order.
    expect(
      result.undo?.kind === "closeOthers" &&
        result.undo.closed.map((c) => [c.pane.id, c.slot[0]!.index]),
    ).toEqual([
      ["a", 0],
      ["c", 2],
    ]);
    expect(core.closeOthers(tree, view(), "missing", ctx()).layout).toEqual(tree);
  });
});
