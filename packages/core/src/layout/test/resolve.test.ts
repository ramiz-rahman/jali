import { context as ctx, folded, fit, freeze, kinds, layout, pane, view } from "./fixtures";
import { describe, expect, it } from "vitest";
import * as core from "..";

import type { FitOptions, Layout, LayoutNode, ViewState } from "../types";

describe("resolve and fold", () => {
  // What the screen shows: folds are decided by refit (at a structural or size change), then resolved.
  const place = (tree: Layout, v: ViewState, f: FitOptions) => core.resolve(core.refit(tree, v, ctx(f)), v, ctx(f));
  for (const width of [1920, 1440, 1280, 1024, 390]) for (const count of [2, 3, 6, 10]) {
    it(`resolves ${count} panes at ${width}px without squeezing, overlap or mutation`, () => {
      const tree = freeze(layout(...Array.from({ length: count }, (_, i) => pane(`p${i}`, i % 2 ? "inspector" : "list", i ? { linkedTo: `p${i - 1}` } : {}))));
      const resolved = place(tree, view("p0"), fit(width));
      expect(resolved.panes).toHaveLength(count);
      const visible = resolved.panes.filter(p => !p.hidden);
      for (const box of resolved.panes) {
        expect(box.rect.width).toBeGreaterThanOrEqual(kinds[count && Number(box.id.slice(1)) % 2 ? "inspector" : "list"]!.minWidth - 1e-7);
        expect(box.rect.x).toBeGreaterThanOrEqual(0);
        expect(box.rect.x + box.rect.width).toBeLessThanOrEqual(width + 1e-7);
      }
      expect(visible.some(p => p.id === "p0")).toBe(true);
      for (let i = 1; i < visible.length; i++) expect(visible[i]!.rect.x).toBeGreaterThanOrEqual(visible[i - 1]!.rect.x + visible[i - 1]!.rect.width + 6 - 1e-7);
      expect(tree.root.type).toBe("row");
    });
  }
  it("folds the narrowest unpinned context first", () => {
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }), pane("c", "inspector", { linkedTo: "b" }));
    const result = place(tree, view("a"), fit(1000));
    expect(folded(result)).toEqual(["c"]);
    expect(result.panes.find(p => p.id === "c")!.stackId).toBe(result.panes.find(p => p.id === "b")!.stackId);
    expect(result.panes.filter(p => !p.hidden)).toHaveLength(2);
  });
  it("preserves a focused context as the active automatic tab", () => {
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }));
    const result = place(tree, view("b"), fit(600));
    expect(result.panes.find(p => p.id === "b")!.hidden).toBeUndefined();
    expect(folded(result)).toEqual(["a"]);
  });
  it("skips pinned contexts and falls back to a single switcher when necessary", () => {
    const result = place(layout(pane("a", "list"), pane("b", "record", { linkedTo: "a", pinned: true }), pane("c", "inspector", { linkedTo: "a" })), view(), fit(500));
    expect(result.panes.filter(p => !p.hidden)).toHaveLength(1);
    expect(result.dividers).toHaveLength(0);
    expect(folded(result)).toEqual(["b", "c"]);
  });
  it("unfolds automatically when room returns and gives deterministic stack IDs", () => {
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }), pane("c", "inspector", { linkedTo: "b" }));
    const narrow = place(tree, view(), fit(600));
    expect(place(tree, view(), fit(600))).toEqual(narrow);
    const wide = place(tree, view(), fit(1920));
    expect(folded(wide)).toEqual([]);
    expect(wide.panes.every(p => !p.hidden && !p.stackId)).toBe(true);
  });
  it("keeps deliberate stacks grouped and their selected child", () => {
    const user: LayoutNode = { id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a", "list"), pane("b", "record")] };
    const tree = freeze(layout(user, pane("c", "inspector")));
    for (const width of [390, 1920]) {
      const result = place(tree, view("b"), fit(width));
      expect(result.panes.find(p => p.id === "a")!.hidden).toBe("tab");
      expect(result.panes.find(p => p.id === "b")!.hidden).toBeUndefined();
    }
    expect(place(tree, view("b"), fit(1920)).panes.find(p => p.id === "b")!.stackId).toBe("tabs");
  });

  it("derives nested split minima on both axes", () => {
    const tree = layout({ id: "column", type: "column", size: { weight: 1 }, children: [pane("a", "list"), pane("b", "record")] }, pane("c", "inspector"));
    const result = place(tree, view(), fit(1000, 700));
    expect(result.panes[0]!.rect.width).toBeGreaterThanOrEqual(480);
    expect(result.panes[1]!.rect.y).toBeGreaterThanOrEqual(126);
    expect(result.dividers.map(d => d.axis).sort()).toEqual(["column", "row"]);
  });
  it("folds vertically when height minimums do not fit", () => {
    const tree = layout({ id: "column", type: "column", size: { weight: 1 }, children: [pane("a"), pane("b", "record", { linkedTo: "a" })] });
    expect(place(tree, view(), fit(1000, 250)).panes.filter(p => !p.hidden)).toHaveLength(1);
  });
  it("tucks a middle row pane: its home takes the space, the far pane keeps its rect, and put back is exact", () => {
    const tree = freeze(layout(pane("a", "record"), pane("b", "record"), pane("c", "record")));
    const before = place(tree, view("b"), fit(1600));
    const t = core.tuck(tree, view("b"), "b", ctx(fit(1600)));
    if (!t.ok) throw new Error("expected a tuck");
    const after = core.resolve(t.layout, view("a"), ctx(fit(1600)));
    expect(folded(after)).toEqual([]);
    for (const k of ["x", "y", "width", "height"] as const) expect(after.panes.find(p => p.id === "c")!.rect[k]).toBeCloseTo(before.panes.find(p => p.id === "c")!.rect[k], 6);
    expect(after.panes.find(p => p.id === "a")!.rect.width).toBeCloseTo(before.panes[0]!.rect.width + before.panes[1]!.rect.width + 6, 6);
    const back = core.putBack(t.layout, t.view, "b", ctx(fit(1600)));
    expect(back.ok && back.layout).toEqual(tree);
  });
  it("unfolds one pane at each successive minimum-plus-gap threshold", () => {
    const tree = freeze(layout(...Array.from({ length: 10 }, (_, i) => pane(`p${i}`, "record", i ? { linkedTo: `p${i - 1}` } : {}))));
    let previous = place(tree, view("p0"), fit(480));
    for (let count = 2; count <= 10; count++) {
      const width = count * 480 + (count - 1) * 6;
      expect(place(tree, view("p0"), fit(width - 1)).panes.filter(p => !p.hidden)).toHaveLength(count - 1);
      const next = place(tree, view("p0"), fit(width));
      expect(next.panes.filter(p => !p.hidden)).toHaveLength(count);
      expect(folded(previous).filter(id => !folded(next).includes(id))).toHaveLength(1);
      expect(folded(next).every(id => folded(previous).includes(id))).toBe(true);
      previous = next;
    }
    expect(folded(previous)).toEqual([]);
  });
  it("joins a folded pane to the stack of its source, never to an unrelated neighbour", () => {
    // Old rule: c grew b's adjacent stack. New rule: c is linked from d, so c and d form their own group.
    const tree = freeze(layout(pane("a", "record"), pane("b", "record", { linkedTo: "a" }), pane("c", "record", { linkedTo: "d" }), pane("d", "record")));
    const result = place(tree, view("a"), fit(1024));
    expect(folded(result)).toEqual(["c", "d"]);
    expect(result.panes.find(p => p.id === "c")!.stackId).toBe(result.panes.find(p => p.id === "d")!.stackId);
    // The c-d chain has no related home elsewhere, so the pair travels together to the nearest neighbour (b).
    expect(result.stacks).toHaveLength(1);
    expect(result.stacks[0]!.paneIds).toEqual(["b", "c", "d"]);
    expect(result.panes.find(p => p.id === "a")!.stackId).toBeUndefined();
  });
  it("keeps the receiving deliberate stack's active tab when a neighbour folds into it", () => {
    const tree = freeze(layout(pane("c", "inspector", { linkedTo: "b" }), { id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a", "record"), pane("b", "record")] }));
    // Focus on b (with no focus, the first pane, c, would stand in and be protected instead).
    const result = place(tree, view("b"), fit(600));
    expect(result.panes.filter(p => !p.hidden).map(p => p.id)).toEqual(["b"]);
    expect(folded(result)).toEqual(["c"]);
    expect(place(tree, { focusHistory: [] }, fit(1000)).panes.find(p => p.id === "b")!.stackId).toBe("tabs");
  });
  it("returns local neighbour lengths for APG separators; a soft max never limits a drag", () => {
    // maxWidth is the kind's preference, not a wall: the person may drag past it, so only minimums bound the separator.
    const tree = layout(pane("a"), pane("b"));
    const result = place(tree, view(), { ...fit(806), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 600 } } });
    expect(result.dividers[0]).toMatchObject({ parentId: "root", index: 0, axis: "row", min: 100, max: 700, value: 400, rect: { x: 400, width: 6 } });
  });
  it("honours maxWidth during flex allocation", () => {
    const result = place(layout(pane("a"), pane("b", "record")), view(), { ...fit(1206), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 200 } } });
    expect(result.panes.map(p => p.rect.width)).toEqual([200, 1000]);
  });
  it("keeps a lone pane's impossible minimum explicit", () => {
    const result = place(layout(pane("a", "record")), view(), fit(390));
    expect(result.panes[0]!.rect.width).toBe(480);
  });
  it("fills the room with a lone pane past its maximum: maxWidth is soft and the content holds its measure", () => {
    // Was 200 (a hard cap leaving an 800px void). Founder review, 17 Nov: a layout never shows a void.
    const result = place(layout(pane("a")), view(), { ...fit(1000), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 200 } } });
    expect(result.panes[0]!.rect.width).toBe(1000);
  });

  it("preserves minimums and disjoint visible geometry across varied nested trees", () => {
    let seed = 719;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let sample = 0; sample < 120; sample++) {
      let nextId = 0;
      function tree(depth: number): LayoutNode {
        const id = `n${nextId++}`;
        if (depth === 0 || random() < 0.3) return pane(id, ["small", "list", "record", "inspector"][Math.floor(random() * 4)]!, { size: random() < 0.25 ? { px: 200 + random() * 800 } : { weight: 0.5 + random() * 4 }, ...(random() < 0.5 ? { linkedTo: "n1" } : {}) });
        return { id, type: random() < 0.5 ? "row" : "column", size: { weight: 1 }, children: [tree(depth - 1), tree(depth - 1)] };
      }
      const source = layout(tree(3));
      const boxes = place(source, { focusHistory: [] }, fit([1920, 1440, 1280, 1024][sample % 4]!, 900)).panes;
      const visible = boxes.filter(b => !b.hidden);
      for (const b of boxes) {
        expect(b.rect.width).toBeGreaterThanOrEqual(100 - 1e-6);
        expect(b.rect.x + b.rect.width).toBeLessThanOrEqual([1920, 1440, 1280, 1024][sample % 4]! + 1e-6);
        expect(b.rect.y + b.rect.height).toBeLessThanOrEqual(900 + 1e-6);
      }
      for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]!.rect, b = visible[j]!.rect;
        expect(a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6 || a.y + a.height <= b.y + 1e-6 || b.y + b.height <= a.y + 1e-6).toBe(true);
      }
    }
  });
  it("zooms as an overlay with no dividers or structural changes", () => {
    const tree = freeze(layout(pane("a"), pane("b")));
    const result = place(tree, { ...view("b"), zoomed: "b" }, fit(1000));
    expect(result.dividers).toEqual([]);
    expect(result.panes[1]).toMatchObject({ rect: { x: 0, y: 0, width: 1000, height: 900 }, hidden: undefined });
    expect(result.panes[0]!.hidden).toBe("zoom");
  });
  it.each([NaN, Infinity, -1])("rejects invalid fit width %s", width => {
    expect(() => place(layout(pane("a")), view(), fit(width))).toThrow(RangeError);
  });
});
