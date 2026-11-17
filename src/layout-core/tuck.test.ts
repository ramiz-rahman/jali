import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { find, panes, parent } from "./model";
import { fit, freeze, kinds, layout, pane, view } from "./test-utils";
import type { FitOptions, Layout, LayoutNode, ObjectRef, PaneNode, ResolvedLayout, StackNode } from "./types";

const core = createLayoutCore();
const rects = (r: ResolvedLayout) => Object.fromEntries(r.panes.filter(p => !p.hiddenInStack).map(p => [p.id, p.rect]));
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(`refused: ${JSON.stringify(r)}`); return r as Extract<T, { ok: true }>; };
/** Rects of every pane outside `group` (ids) are unchanged, to the float. */
function othersUnchanged(before: ResolvedLayout, after: ResolvedLayout, group: string[], gone: string) {
  const a = rects(before), b = rects(after);
  for (const id of Object.keys(a)) if (id !== gone && !group.includes(id)) for (const k of ["x", "y", "width", "height"] as const) expect(b[id]![k], `${id}.${k}`).toBeCloseTo(a[id]![k], 6);
}
const chainKinds = { table: { kind: "table", minWidth: 480, minHeight: 240, title: () => "table" }, record: { kind: "record", minWidth: 480, minHeight: 240, title: () => "record" } };
const cfit = (width: number): FitOptions => ({ width, height: 900, gap: 6, kinds: chainKinds });
const p = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref, ...extra });
const chain = (): Layout => ({ version: 1, root: { id: "r", type: "row", size: { weight: 1 }, children: [
  p("orders", { kind: "table", params: { table: "orders" } }, { size: { weight: 1.4 } }),
  p("order", { kind: "record", params: { table: "orders", id: 1 } }, { linkedTo: "orders" }),
  p("customer", { kind: "record", params: { table: "customers", id: 1 } }, { linkedTo: "order" }),
] } });
const split = (type: "row" | "column", ...children: LayoutNode[]): Layout => ({ version: 1, root: { id: "root", type, size: { weight: 1 }, children } });

describe("tuck", () => {
  it("joins the source beside it; the home keeps its tab; only the home grows; focus goes to the home", () => {
    const f = cfit(1920), tree = freeze(core.refit(chain(), view("orders"), f));
    const before = core.resolve(tree, view("orders"), f);
    const t = ok(core.tuck(tree, view("customer"), "customer", f));
    expect(t.home).toBe("order");
    expect(t.view.focused).toBe("order");
    const stack = parent(t.layout.root, "customer") as StackNode;
    expect(stack).toMatchObject({ type: "stack", origin: "tuck", active: "order" });
    expect(stack.children.map(c => c.id)).toEqual(["order", "customer"]);
    expect(find(t.layout.root, "customer")).toMatchObject({ tuckedFrom: { parent: "r", axis: "row", index: 2, beside: "order", side: "after", home: "order", size: { weight: 1 } } });
    const after = core.resolve(t.layout, t.view, f);
    othersUnchanged(before, after, ["order"], "customer");
    expect(rects(after).order!.width).toBeCloseTo(before.panes[1]!.rect.width + before.panes[2]!.rect.width + 6, 6);
    expect(after.shelf).toEqual([{ paneId: "customer", homeId: "order", stackId: stack.id, reason: "tucked" }]);
    expect(t.undo).toMatchObject({ label: "Pane tucked", tucked: "customer", before: { layout: tree } });
  });

  it.each([
    ["row", "a", "b"], ["row", "b", "a"], ["row", "c", "b"],
    ["column", "a", "b"], ["column", "b", "a"], ["column", "c", "b"],
  ] as const)("in a %s, tucking %s joins %s; other rects stay; put back is exact", (type, id, home) => {
    const f = fit(1600, 1000);
    const tree = freeze(split(type, pane("a", "list"), pane("b", "list", { size: { weight: 2 } }), pane("c", "list")));
    const before = core.resolve(tree, view(id), f);
    const t = ok(core.tuck(tree, view(id), id, f));
    expect(t.home).toBe(home);
    othersUnchanged(before, core.resolve(t.layout, t.view, f), [home], id);
    const back = ok(core.putBack(t.layout, t.view, id, f));
    expect(back.restored).toBe("origin");
    expect(back.view.focused).toBe(id);
    expect(back.layout).toEqual(tree);
    expect(core.resolve(back.layout, back.view, f)).toEqual(before);
  });

  it("round-trips exactly with dragged (px-proportional) and fixed px sizes", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list", { size: { px: 300 } }), pane("b", "list", { size: { weight: 700 }, userSized: true }), pane("c", "list", { size: { weight: 1 } })));
    for (const id of ["a", "b", "c"]) {
      const before = core.resolve(tree, view(id), f);
      const t = ok(core.tuck(tree, view(id), id, f));
      othersUnchanged(before, core.resolve(t.layout, t.view, f), [t.home], id);
      expect(ok(core.putBack(t.layout, t.view, id, f)).layout).toEqual(tree);
    }
  });

  it("joins an existing stack, keeps its shown tab and origin, and never dissolves it", () => {
    const f = fit(1600);
    const st: StackNode = { id: "st", type: "stack", origin: "user", size: { weight: 1 }, active: "c", children: [pane("b", "list"), pane("c", "list")] };
    const tree = freeze(split("row", pane("a", "list"), st, pane("d", "list")));
    const before = core.resolve(tree, view("d"), f);
    const t = ok(core.tuck(tree, view("d"), "d", f));
    expect(t.home).toBe("c");
    const joined = find(t.layout.root, "st") as StackNode;
    expect(joined).toMatchObject({ origin: "user", active: "c" });
    expect(joined.children.map(c => c.id)).toEqual(["b", "c", "d"]);
    othersUnchanged(before, core.resolve(t.layout, t.view, f), ["b", "c"], "d");
    const back = ok(core.putBack(t.layout, t.view, "d", f));
    expect(back.layout).toEqual(tree);
  });

  describe.each(["row", "column"] as const)("two tucks into one home in a %s", (type) => {
    const f = fit(1900, 1900);
    const tree = freeze(split(type, pane("a", "list"), pane("b", "list"), pane("c", "list")));
    const order = (l: Layout) => (l.root as { children: LayoutNode[] }).children.flatMap(c => panes(c).map(x => x.id));
    const two = () => {
      const one = ok(core.tuck(tree, view("b"), "b", f));
      return ok(core.tuck(one.layout, view("c"), "c", f));
    };
    it("the stack stays until the last one is put back; newest first restores the layout exactly", () => {
      const t = two();
      expect(t.home).toBe("a");
      expect((parent(t.layout.root, "c") as StackNode).children.map(c => c.id)).toEqual(["a", "b", "c"]);
      const mid = ok(core.putBack(t.layout, t.view, "c", f));
      expect(parent(mid.layout.root, "b")).toMatchObject({ type: "stack" });
      expect(ok(core.putBack(mid.layout, view(), "b", f)).layout).toEqual(tree);
    });
    it("oldest first keeps the original order", () => {
      const t = two();
      const mid = ok(core.putBack(t.layout, t.view, "b", f));
      const end = ok(core.putBack(mid.layout, view(), "c", f));
      expect(order(end.layout)).toEqual(["a", "b", "c"]);
      expect(panes(end.layout.root).some(x => x.tuckedFrom)).toBe(false);
    });
    it("survives the link codec between put backs", () => {
      const t = two();
      const mid = ok(core.putBack(core.decode(core.encode(t.layout), kinds)!, t.view, "b", f));
      expect(order(ok(core.putBack(mid.layout, view(), "c", f)).layout)).toEqual(["a", "b", "c"]);
    });
  });

  it("three tucks into a home come back in order whatever the sequence", () => {
    const f = fit(1900, 1900);
    const tree = freeze(split("row", pane("a", "list"), pane("b", "list"), pane("c", "list"), pane("d", "list")));
    let t = ok(core.tuck(tree, view("b"), "b", f));
    t = ok(core.tuck(t.layout, view("c"), "c", f));
    t = ok(core.tuck(t.layout, view("d"), "d", f));
    for (const seq of [["b", "c", "d"], ["d", "c", "b"], ["c", "d", "b"], ["d", "b", "c"], ["c", "b", "d"]]) {
      let l = t.layout;
      for (const id of seq) l = ok(core.putBack(l, view(), id, f)).layout;
      expect((l.root as { children: LayoutNode[] }).children.map(c => c.id), seq.join()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("keeps a split it empties to one child, so the origin survives", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list"), { id: "col", type: "column", size: { weight: 1 }, children: [pane("b", "list"), pane("c", "list")] }));
    const t = ok(core.tuck(tree, view("c"), "c", f));
    expect(t.home).toBe("b");
    expect((find(t.layout.root, "col") as { children: LayoutNode[] }).children).toHaveLength(1);
    expect(ok(core.putBack(t.layout, t.view, "c", f)).layout).toEqual(tree);
  });

  it("puts back beside its home on the side it came from when the origin is gone", () => {
    const f = fit(1600);
    const tree = freeze(split("row", pane("a", "list"), { id: "col", type: "column", size: { weight: 1 }, children: [pane("b", "list"), pane("c", "list")] }));
    const t = ok(core.tuck(tree, view("c"), "c", f));
    // Something else removed the column: its only child (the home stack) took its place.
    const gone = structuredClone(t.layout) as Layout;
    const root = gone.root as { children: LayoutNode[] };
    root.children[1] = { ...(root.children[1] as { children: LayoutNode[] }).children[0]!, size: { weight: 1 } };
    const back = ok(core.putBack(gone, view("c"), "c", f));
    expect(back.restored).toBe("beside");
    const r = rects(core.resolve(back.layout, back.view, f));
    expect(r.c!.x).toBe(r.b!.x);
    expect(r.c!.y).toBeGreaterThan(r.b!.y);
    expect(find(back.layout.root, "c")).not.toHaveProperty("tuckedFrom");
    expect(panes(back.layout.root).map(x => x.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("never unfolds or refolds anything: a tuck at 1440 keeps the fold record and the folded pane", () => {
    const f = cfit(1440), tree = freeze(core.refit(chain(), view("orders"), f));
    const before = core.resolve(tree, view("orders"), f);
    expect(before.folded).toEqual(["customer"]);
    const t = ok(core.tuck(tree, view("orders"), "orders", f));
    expect(t.layout.fold).toEqual(tree.fold);
    const after = core.resolve(t.layout, t.view, f);
    expect(after.folded).toEqual(["customer"]);
    expect(core.refit(t.layout, t.view, f)).toBe(t.layout);
    expect(ok(core.putBack(t.layout, t.view, "orders", f)).layout).toEqual(tree);
  });

  it("refuses tabs, panes off screen and the last pane on screen", () => {
    const f = cfit(1440), tree = core.refit(chain(), view("orders"), f);
    expect(core.canTuck(tree, "customer", f)).toEqual({ ok: false, reason: "hidden" });
    expect(core.canTuck(core.refit(chain(), view("orders"), cfit(390)), "orders", cfit(390))).toEqual({ ok: false, reason: "last" });
    expect(core.canTuck(tree, "orders", f)).toEqual({ ok: true, home: "order" });
  });
});

describe("shelf", () => {
  it("lists folded panes, inactive tabs and tucked panes with the pane shown in their place", () => {
    const f = cfit(1440), tree = core.refit(chain(), view("orders"), f);
    expect(core.resolve(tree, view("orders"), f).shelf).toEqual([{ paneId: "customer", homeId: "order", stackId: "@auto:order", reason: "folded" }]);
    const st: StackNode = { id: "st", type: "stack", origin: "user", size: { weight: 1 }, active: "c", children: [pane("b", "list"), pane("c", "list")] };
    const shelf = core.resolve(split("row", pane("a", "list"), st), view("a"), fit()).shelf;
    expect(shelf).toEqual([{ paneId: "b", homeId: "c", stackId: "st", reason: "tab" }]);
  });
  it("a revealed tucked pane leaves the shelf and its home joins it as a tab, with no layout change", () => {
    const f = fit(1600), tree = freeze(split("row", pane("a", "list"), pane("b", "list")));
    const t = ok(core.tuck(tree, view("b"), "b", f));
    const stack = parent(t.layout.root, "b")!.id;
    const shown = core.setActiveTab(t.layout, stack, "b");
    const r0 = core.resolve(t.layout, t.view, f), r1 = core.resolve(shown, t.view, f);
    expect(r1.panes.map(x => x.rect)).toEqual(r0.panes.map(x => x.rect));
    expect(r1.shelf).toEqual([{ paneId: "a", homeId: "b", stackId: stack, reason: "tab" }]);
    // Put back from the revealed state still restores the original layout.
    expect(ok(core.putBack(shown, view("b"), "b", f)).layout).toEqual(tree);
  });
  it("zoom does not put panes on the shelf", () => {
    expect(core.resolve(split("row", pane("a"), pane("b")), { ...view("a"), zoomed: "a" }, fit()).shelf).toEqual([]);
  });
});

describe("tuck codec", () => {
  it("round-trips tucked panes and tuck stacks", () => {
    const f = fit(1600), tree = freeze(split("row", pane("a", "list"), pane("b", "list", { size: { px: 500 } }), pane("c", "list")));
    const t = ok(core.tuck(tree, view("b"), "b", f));
    const decoded = core.decode(core.encode(t.layout), f.kinds)!;
    expect(decoded).toEqual(t.layout);
    expect(ok(core.putBack(decoded, view("b"), "b", f)).layout).toEqual(tree);
  });
  it("decodes a rail-era `collapsed: true` link as tucked, and drops `collapsed: false`", () => {
    const legacy = (packed: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify([1, packed]));
      return `1.${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    };
    const node = (i: string, extra: Record<string, unknown> = {}) => ({ i, t: "p", s: [1, 1], r: ["list", { id: i }], ...extra });
    const decoded = core.decode(legacy({ i: "root", t: "r", s: [1, 1], n: [node("a", { c: false }), node("b", { c: true, l: "a" }), node("c")] }), fit().kinds)!;
    expect(decoded).not.toBeNull();
    expect(find(decoded.root, "a")).not.toHaveProperty("collapsed");
    expect(find(decoded.root, "b")).toMatchObject({ tuckedFrom: { parent: "root", home: "a", side: "after" } });
    expect(parent(decoded.root, "b")).toMatchObject({ type: "stack", origin: "tuck", active: "a" });
    expect(panes(decoded.root).some(x => "collapsed" in x)).toBe(false);
  });
  it("rejects a malformed tuck origin", () => {
    const bad = { ...pane("b"), tuckedFrom: { parent: "root", axis: "diagonal" } } as unknown as PaneNode;
    expect(core.validate(split("row", pane("a"), bad), fit().kinds).ok).toBe(false);
  });
});
