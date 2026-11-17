import { context as ctx, stress, stressFit, chain, chainFit as cfit, context, folded, fit, freeze, kinds, pane, view } from "./fixtures";
import { describe, expect, it } from "vitest";
import * as core from "../index";
import { find, panes } from "../tree/tree";
import type { Layout, LayoutNode, ResolvedLayout, StackNode } from "../types";

const rects = (r: ResolvedLayout) => Object.fromEntries(r.panes.filter(p => !p.hidden).map(p => [p.id, p.rect]));
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(`refused: ${JSON.stringify(r)}`); return r as Extract<T, { ok: true }>; };
/** Rects of every pane outside `group` (ids) are unchanged, to the float. */
function othersUnchanged(before: ResolvedLayout, after: ResolvedLayout, group: string[], gone: string) {
  const a = rects(before), b = rects(after);
  for (const id of Object.keys(a)) if (id !== gone && !group.includes(id)) for (const k of ["x", "y", "width", "height"] as const) expect(b[id]![k], `${id}.${k}`).toBeCloseTo(a[id]![k], 6);
}
const split = (type: "row" | "column", ...children: LayoutNode[]): Layout => ({ version: 1, root: { id: "root", type, size: { weight: 1 }, children } });

describe("tuck", () => {
  it("joins the source beside it; the home keeps its tab; only the home grows; focus goes to the home", () => {
    const f = cfit(1920), tree = freeze(core.refit(chain(), view("orders"), ctx(f)));
    const before = core.resolve(tree, view("orders"), ctx(f));
    const t = ok(core.tuck(tree, view("customer"), "customer", ctx(f)));
    expect(t.home).toBe("order");
    expect(t.view.focused).toBe("order");
    const stack = core.resolve(t.layout, t.view, ctx(f)).stacks.find(s => s.paneIds.includes("customer"))!;
    expect(stack).toMatchObject({ kind: "tuck", homeId: "order" });
    expect(t.layout.root).toBe(tree.root);
    expect(stack.paneIds).toEqual(["order", "customer"]);
    expect(t.layout.overlay?.tucks).toEqual([{ pane: "customer", home: "order", seq: 1 }]);
    const after = core.resolve(t.layout, t.view, ctx(f));
    othersUnchanged(before, after, ["order"], "customer");
    expect(rects(after).order!.width).toBeCloseTo(before.panes[1]!.rect.width + before.panes[2]!.rect.width + 6, 6);
    expect(after.shelf).toEqual([{ paneId: "customer", homeId: "order", stackId: stack.id, reason: "tucked" }]);
    expect(t.undo).toMatchObject({ kind: "tuck", tucked: "customer", before: { layout: tree } });
  });

  it.each([
    ["row", "a", "b"], ["row", "b", "a"], ["row", "c", "b"],
    ["column", "a", "b"], ["column", "b", "a"], ["column", "c", "b"],
  ] as const)("in a %s, tucking %s joins %s; other rects stay; put back is exact", (type, id, home) => {
    const f = fit(1600, 1000);
    const tree = freeze(split(type, pane("a", "list"), pane("b", "list", { size: { weight: 2 } }), pane("c", "list")));
    const before = core.resolve(tree, view(id), ctx(f));
    const t = ok(core.tuck(tree, view(id), id, ctx(f)));
    expect(t.home).toBe(home);
    othersUnchanged(before, core.resolve(t.layout, t.view, ctx(f)), [home], id);
    const back = ok(core.putBack(t.layout, t.view, id, ctx(f)));
    expect(back.layout.root).toBe(tree.root);
    expect(back.view.focused).toBe(id);
    expect(back.layout).toEqual(tree);
    expect(core.resolve(back.layout, back.view, ctx(f))).toEqual(before);
  });

  it("round-trips exactly with dragged (px-proportional) and fixed px sizes", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list", { size: { px: 300 } }), pane("b", "list", { size: { weight: 700 }, userSized: true }), pane("c", "list", { size: { weight: 1 } })));
    for (const id of ["a", "b", "c"]) {
      const before = core.resolve(tree, view(id), ctx(f));
      const t = ok(core.tuck(tree, view(id), id, ctx(f)));
      othersUnchanged(before, core.resolve(t.layout, t.view, ctx(f)), [t.home], id);
      expect(ok(core.putBack(t.layout, t.view, id, ctx(f))).layout).toEqual(tree);
    }
  });

  it("joins an existing stack, keeps its shown tab and origin, and never dissolves it", () => {
    const f = fit(1600);
    const st: StackNode = { id: "st", type: "stack", origin: "user", size: { weight: 1 }, active: "c", children: [pane("b", "list"), pane("c", "list")] };
    const tree = freeze(split("row", pane("a", "list"), st, pane("d", "list")));
    const before = core.resolve(tree, view("d"), ctx(f));
    const t = ok(core.tuck(tree, view("d"), "d", ctx(f)));
    expect(t.home).toBe("c");
    const joined = find(t.layout.root, "st") as StackNode;
    expect(joined).toMatchObject({ origin: "user", active: "c" });
    expect(core.resolve(t.layout, t.view, ctx(f)).stacks.find(s => s.id === "st")!.paneIds).toEqual(["b", "c", "d"]);
    expect(joined.children.map(c => c.id)).toEqual(["b", "c"]);
    othersUnchanged(before, core.resolve(t.layout, t.view, ctx(f)), ["b", "c"], "d");
    const back = ok(core.putBack(t.layout, t.view, "d", ctx(f)));
    expect(back.layout).toEqual(tree);
  });

  describe.each(["row", "column"] as const)("two tucks into one home in a %s", (type) => {
    const f = fit(1900, 1900);
    const tree = freeze(split(type, pane("a", "list"), pane("b", "list"), pane("c", "list")));
    const order = (l: Layout) => (l.root as { children: LayoutNode[] }).children.flatMap(c => panes(c).map(x => x.id));
    const two = () => {
      const one = ok(core.tuck(tree, view("b"), "b", ctx(f)));
      return ok(core.tuck(one.layout, view("c"), "c", ctx(f)));
    };
    it("the stack stays until the last one is put back; newest first restores the layout exactly", () => {
      const t = two();
      expect(t.home).toBe("a");
      expect(core.resolve(t.layout, t.view, ctx(f)).stacks[0]!.paneIds).toEqual(["a", "b", "c"]);
      const mid = ok(core.putBack(t.layout, t.view, "c", ctx(f)));
      expect(core.resolve(mid.layout, mid.view, ctx(f)).stacks[0]!.paneIds).toEqual(["a", "b"]);
      expect(ok(core.putBack(mid.layout, view(), "b", ctx(f))).layout).toEqual(tree);
    });
    it("oldest first keeps the original order", () => {
      const t = two();
      const mid = ok(core.putBack(t.layout, t.view, "b", ctx(f)));
      const end = ok(core.putBack(mid.layout, view(), "c", ctx(f)));
      expect(order(end.layout)).toEqual(["a", "b", "c"]);
      expect(end.layout.overlay?.tucks ?? []).toEqual([]);
      expect(end.layout).toEqual(tree);
    });
    it("survives the link codec between put backs", () => {
      const t = two();
      const mid = ok(core.putBack(core.decode(core.encode(t.layout), kinds)!, t.view, "b", ctx(f)));
      expect(order(ok(core.putBack(mid.layout, view(), "c", ctx(f))).layout)).toEqual(["a", "b", "c"]);
    });
  });

  it("three tucks into a home come back in order whatever the sequence", () => {
    const f = fit(1900, 1900);
    const tree = freeze(split("row", pane("a", "list"), pane("b", "list"), pane("c", "list"), pane("d", "list")));
    let t = ok(core.tuck(tree, view("b"), "b", ctx(f)));
    t = ok(core.tuck(t.layout, view("c"), "c", ctx(f)));
    t = ok(core.tuck(t.layout, view("d"), "d", ctx(f)));
    for (const seq of [["b", "c", "d"], ["d", "c", "b"], ["c", "d", "b"], ["d", "b", "c"], ["c", "b", "d"]]) {
      let l = t.layout;
      for (const id of seq) l = ok(core.putBack(l, view(), id, ctx(f))).layout;
      expect((l.root as { children: LayoutNode[] }).children.map(c => c.id), seq.join()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("keeps a split it empties to one child, so the origin survives", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list"), { id: "col", type: "column", size: { weight: 1 }, children: [pane("b", "list"), pane("c", "list")] }));
    const t = ok(core.tuck(tree, view("c"), "c", ctx(f)));
    expect(t.home).toBe("b");
    expect((find(t.layout.root, "col") as { children: LayoutNode[] }).children).toHaveLength(2);
    expect(t.layout.root).toBe(tree.root);
    expect(ok(core.putBack(t.layout, t.view, "c", ctx(f))).layout).toEqual(tree);
  });

  it("puts back beside its home on the side it came from when the origin is gone", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list"), { id: "col", type: "column", size: { weight: 1 }, children: [pane("b", "list"), pane("c", "list")] }));
    const t = ok(core.tuck(tree, view("c"), "c", ctx(f)));
    // Something else removed the column: its only child (the home stack) took its place.
    const gone = structuredClone(t.layout) as Layout;
    const root = gone.root as { children: LayoutNode[] };
    const children = (root.children[1] as { children: LayoutNode[] }).children;
    root.children[1] = { id: "replacement", type: "column", size: { weight: 1 }, children };
    const back = ok(core.putBack(gone, view("c"), "c", ctx(f)));
    expect(back.layout.overlay?.tucks ?? []).toEqual([]);
    const r = rects(core.resolve(back.layout, back.view, ctx(f)));
    expect(r.c!.x).toBe(r.b!.x);
    expect(r.c!.y).toBeGreaterThan(r.b!.y);
    expect(find(back.layout.root, "c")).not.toHaveProperty("tuckedFrom");
    expect(panes(back.layout.root).map(x => x.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("never unfolds or refolds anything: a tuck at 1440 keeps the fold record and the folded pane", () => {
    const f = cfit(1440), tree = freeze(core.refit(chain(), view("orders"), ctx(f)));
    const before = core.resolve(tree, view("orders"), ctx(f));
    expect(folded(before)).toEqual(["customer"]);
    const t = ok(core.tuck(tree, view("orders"), "orders", ctx(f)));
    expect(t.layout.overlay?.folds).toEqual(tree.overlay?.folds);
    const after = core.resolve(t.layout, t.view, ctx(f));
    expect(folded(after)).toEqual(["customer"]);
    expect(core.refit(t.layout, t.view, ctx(f))).toBe(t.layout);
    expect(ok(core.putBack(t.layout, t.view, "orders", ctx(f))).layout).toEqual(tree);
  });

  it("refuses tabs, panes off screen and the last pane on screen", () => {
    const f = cfit(1440), tree = core.refit(chain(), view("orders"), ctx(f));
    expect(core.canTuck(tree, "customer", ctx(f))).toEqual({ ok: false, reason: "hidden" });
    expect(core.canTuck(core.refit(chain(), view("orders"), ctx(cfit(390))), "orders", ctx(cfit(390)))).toEqual({ ok: false, reason: "last" });
    expect(core.canTuck(tree, "orders", ctx(f))).toEqual({ ok: true, home: "order" });
  });
});

describe("shelf", () => {
  it("lists folded panes, inactive tabs and tucked panes with the pane shown in their place", () => {
    const f = cfit(1440), tree = core.refit(chain(), view("orders"), ctx(f));
    expect(core.resolve(tree, view("orders"), ctx(f)).shelf).toEqual([{ paneId: "customer", homeId: "order", stackId: "@auto:order", reason: "folded" }]);
    const st: StackNode = { id: "st", type: "stack", origin: "user", size: { weight: 1 }, active: "c", children: [pane("b", "list"), pane("c", "list")] };
    const shelf = core.resolve(split("row", pane("a", "list"), st), view("a"), ctx(fit())).shelf;
    expect(shelf).toEqual([{ paneId: "b", homeId: "c", stackId: "st", reason: "tab" }]);
  });
  it("a revealed tucked pane leaves the shelf and its home joins it as a tab, with no layout change", () => {
    const f = fit(1600), tree = freeze(split("row", pane("a", "list"), pane("b", "list")));
    const t = ok(core.tuck(tree, view("b"), "b", ctx(f)));
    const stack = core.resolve(t.layout, t.view, ctx(f)).panes.find(p => p.id === "b")!.stackId!;
    const shown = core.setActiveTab(t.layout, stack, "b", ctx(f));
    const r0 = core.resolve(t.layout, t.view, ctx(f)), r1 = core.resolve(shown, t.view, ctx(f));
    expect(r1.panes.map(x => x.rect)).toEqual(r0.panes.map(x => x.rect));
    expect(r1.shelf).toEqual([{ paneId: "a", homeId: "b", stackId: stack, reason: "tab" }]);
    // Put back from the revealed state still restores the original layout.
    expect(ok(core.putBack(shown, view("b"), "b", ctx(f))).layout).toEqual(tree);
  });
  it("zoom does not put panes on the shelf", () => {
    expect(core.resolve(split("row", pane("a"), pane("b")), { ...view("a"), zoomed: "a" }, ctx(fit())).shelf).toEqual([]);
  });
});

describe("tuck codec", () => {
  it("round-trips tucked panes and tuck stacks", () => {
    const f = fit(1600), tree = freeze(split("row", pane("a", "list"), pane("b", "list", { size: { px: 500 } }), pane("c", "list")));
    const t = ok(core.tuck(tree, view("b"), "b", ctx(f)));
    const decoded = core.decode(core.encode(t.layout), f.kinds)!;
    expect(decoded).toEqual(t.layout);
    expect(ok(core.putBack(decoded, view("b"), "b", ctx(f))).layout).toEqual(tree);
  });

  it("rejects a malformed tuck origin", () => {
    const bad = { ...split("row", pane("a"), pane("b")), overlay: { tucks: [{ pane: "b", home: "a", seq: -1 }], folds: [], shown: {} } };
    expect(core.validate(bad, fit().kinds).ok).toBe(false);
  });
});

describe("tuck geometry on stress layouts", () => {
  it.each([1920, 1440, 1024])("only changes the home group at %i px", width => {
    const ctx = context(stressFit(width));
    const tree = freeze(core.refit(stress(), view("s1"), ctx));
    const before = core.resolve(tree, view("s1"), ctx);
    for (const box of before.panes.filter(b => !b.hidden)) {
      const t = ok(core.tuck(tree, view(box.id), box.id, ctx));
      expect(t.layout.root).toBe(tree.root);
      const group = before.stacks.find(s => s.paneIds.includes(t.home))?.paneIds ?? [t.home];
      const after = core.resolve(t.layout, t.view, ctx);
      othersUnchanged(before, after, group, box.id);
      expect(folded(after)).toEqual(folded(before));
      const restored = ok(core.putBack(t.layout, t.view, box.id, ctx));
      expect(restored.layout).toEqual(tree);
      expect(core.resolve(restored.layout, restored.view, ctx)).toEqual(before);
    }
  });
});

it("tucks into a revealed folded tab without losing the sticky fold or its shown tab", () => {
  const ctx = context(cfit(1440));
  const tree = freeze(core.reveal(core.refit(chain(), view("orders"), ctx), "customer", ctx));
  const before = core.resolve(tree, view("customer"), ctx);
  const t = ok(core.tuck(tree, view("orders"), "orders", ctx));
  expect(t.home).toBe("customer");
  expect(t.layout.overlay?.folds).toEqual(tree.overlay?.folds);
  const after = core.resolve(t.layout, t.view, ctx);
  expect(after.panes.filter(b => !b.hidden).map(b => b.id)).toEqual(["customer"]);
  expect(core.refit(t.layout, t.view, ctx)).toBe(t.layout);
  const back = ok(core.putBack(t.layout, t.view, "orders", ctx));
  expect(back.layout).toEqual(tree);
  expect(core.resolve(back.layout, back.view, ctx)).toEqual(before);
});
