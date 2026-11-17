import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { shares } from "./resolve";
import { fit, freeze, kinds, layout, pane, view } from "./test-utils";
import type { LayoutNode } from "./types";

describe("flex shares", () => {
  it("allocates fixed pixels then proportional weights", () => {
    expect(shares([{ size: { px: 200 }, min: 100 }, { size: { weight: 1 }, min: 100 }, { size: { weight: 2 }, min: 100 }], 1100)).toEqual([200, 300, 600]);
  });
  it("freezes a minimum then re-shares", () => {
    expect(shares([{ size: { weight: 1 }, min: 400 }, { size: { weight: 3 }, min: 100 }], 800)).toEqual([400, 400]);
  });
  it("freezes maxima and re-shares through multiple rounds", () => {
    expect(shares([{ size: { weight: 1 }, min: 100, max: 150 }, { size: { weight: 1 }, min: 100, max: 250 }, { size: { weight: 1 }, min: 100 }], 1000)).toEqual([150, 250, 600]);
  });
  it("handles opposing min and max violations without over-freezing", () => {
    expect(shares([{ size: { weight: 1 }, min: 400 }, { size: { weight: 1 }, min: 100, max: 280 }], 600)).toEqual([400, 200]);
  });
  it("bounds fixed sizes and preserves weighted minimums on viewport shrink", () => {
    expect(shares([{ size: { px: 900 }, min: 100 }, { size: { weight: 1 }, min: 300 }], 600)).toEqual([300, 300]);
    expect(shares([{ size: { px: 50 }, min: 100, max: 200 }, { size: { px: 500 }, min: 100, max: 200 }], 500)).toEqual([200, 200]);
    // Leftover space goes to whatever can still grow, so a row never shows a void.
    expect(shares([{ size: { px: 56 }, min: 56, max: 56 }, { size: { px: 300 }, min: 240 }], 1000)).toEqual([56, 944]);
  });
  it("never scales down infeasible minimums", () => {
    expect(shares([{ size: { weight: 1 }, min: 320 }, { size: { weight: 1 }, min: 480 }], 390)).toEqual([320, 480]);
  });
});

describe("resolve and fold", () => {
  const core = createLayoutCore();
  for (const width of [1920, 1440, 1280, 1024, 390]) for (const count of [2, 3, 6, 10]) {
    it(`resolves ${count} panes at ${width}px without squeezing, overlap or mutation`, () => {
      const tree = freeze(layout(...Array.from({ length: count }, (_, i) => pane(`p${i}`, i % 2 ? "inspector" : "list", i ? { linkedTo: `p${i - 1}` } : {}))));
      const resolved = core.resolve(tree, view("p0"), fit(width));
      expect(resolved.panes).toHaveLength(count);
      const visible = resolved.panes.filter(p => !p.hiddenInStack);
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
    const result = core.resolve(tree, view("a"), fit(1000));
    expect(result.folded).toEqual(["c"]);
    expect(result.panes.find(p => p.id === "c")!.stackId).toBe(result.panes.find(p => p.id === "b")!.stackId);
    expect(result.panes.filter(p => !p.hiddenInStack)).toHaveLength(2);
  });
  it("preserves a focused context as the active automatic tab", () => {
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }));
    const result = core.resolve(tree, view("b"), fit(600));
    expect(result.panes.find(p => p.id === "b")!.hiddenInStack).toBe(false);
    expect(result.folded).toEqual(["a"]);
  });
  it("skips pinned contexts and falls back to a single switcher when necessary", () => {
    const result = core.resolve(layout(pane("a", "list"), pane("b", "record", { linkedTo: "a", pinned: true }), pane("c", "inspector", { linkedTo: "a" })), view(), fit(500));
    expect(result.panes.filter(p => !p.hiddenInStack)).toHaveLength(1);
    expect(result.dividers).toHaveLength(0);
    expect(result.folded).toEqual(["b", "c"]);
  });
  it("unfolds automatically when room returns and gives deterministic stack IDs", () => {
    const tree = layout(pane("a", "list"), pane("b", "record", { linkedTo: "a" }), pane("c", "inspector", { linkedTo: "b" }));
    const narrow = core.resolve(tree, view(), fit(600));
    expect(core.resolve(tree, view(), fit(600))).toEqual(narrow);
    const wide = core.resolve(tree, view(), fit(1920));
    expect(wide.folded).toEqual([]);
    expect(wide.panes.every(p => !p.hiddenInStack && !p.stackId)).toBe(true);
  });
  it("keeps deliberate stacks grouped and their selected child", () => {
    const user: LayoutNode = { id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a", "list"), pane("b", "record")] };
    const tree = freeze(layout(user, pane("c", "inspector")));
    for (const width of [390, 1920]) {
      const result = core.resolve(tree, view("b"), fit(width));
      expect(result.panes.find(p => p.id === "a")!.hiddenInStack).toBe(true);
      expect(result.panes.find(p => p.id === "b")!.hiddenInStack).toBe(false);
    }
    expect(core.resolve(tree, view("b"), fit(1920)).panes.find(p => p.id === "b")!.stackId).toBe("tabs");
  });
  it("unfolds persisted auto stacks on their stored axis", () => {
    const tree = layout({ id: "auto", type: "stack", origin: "auto", axis: "column", active: "a", size: { weight: 1 }, children: [pane("a"), pane("b")] });
    const result = core.resolve(tree, view(), fit(1000, 800));
    expect(result.panes[1]!.rect.y).toBe(403);
    expect(result.dividers[0]!.axis).toBe("column");
  });
  it("derives nested split minima on both axes", () => {
    const tree = layout({ id: "column", type: "column", size: { weight: 1 }, children: [pane("a", "list"), pane("b", "record")] }, pane("c", "inspector"));
    const result = core.resolve(tree, view(), fit(1000, 700));
    expect(result.panes[0]!.rect.width).toBeGreaterThanOrEqual(480);
    expect(result.panes[1]!.rect.y).toBeGreaterThanOrEqual(126);
    expect(result.dividers.map(d => d.axis).sort()).toEqual(["column", "row"]);
  });
  it("folds vertically when height minimums do not fit", () => {
    const tree = layout({ id: "column", type: "column", size: { weight: 1 }, children: [pane("a"), pane("b", "record", { linkedTo: "a" })] });
    expect(core.resolve(tree, view(), fit(1000, 250)).panes.filter(p => !p.hiddenInStack)).toHaveLength(1);
  });
  it("uses 56px rails in a row and 40px header strips in a column, for edge and middle panes alike", () => {
    const tree = layout(pane("a", "record", { collapsed: true }), pane("b", "record", { collapsed: true }), pane("c", "record"));
    const row = core.resolve(tree, view(), fit(1000));
    expect(row.panes.map(p => p.rect.width)).toEqual([56, 56, 876]);
    expect(row.panes.map(p => p.rect.height)).toEqual([900, 900, 900]);
    tree.root.type = "column";
    expect(core.resolve(tree, view(), fit(1000)).panes.map(p => p.rect.height).slice(0, 2)).toEqual([40, 40]);
  });
  it("minimises a middle row pane to a rail, lets its siblings fill the space, and restores it", () => {
    const tree = freeze(layout(pane("a", "record"), pane("b", "record"), pane("c", "record")));
    const collapsed = core.setCollapsed(tree, "b", true);
    const result = core.resolve(collapsed, view("b"), fit(1600));
    expect(result.folded).toEqual([]);
    expect(result.panes.map(p => p.rect.height)).toEqual([900, 900, 900]);
    expect(result.panes[1]!.rect.width).toBe(56);
    expect(result.panes[0]!.rect.width + result.panes[2]!.rect.width + 56 + 12).toBeCloseTo(1600, 0);
    expect(core.resolve(core.setCollapsed(collapsed, "b", false), view("b"), fit(1600))).toEqual(core.resolve(tree, view("b"), fit(1600)));
  });
  it("unfolds one pane at each successive minimum-plus-gap threshold", () => {
    const tree = freeze(layout(...Array.from({ length: 10 }, (_, i) => pane(`p${i}`, "record", i ? { linkedTo: `p${i - 1}` } : {}))));
    let previous = core.resolve(tree, view("p0"), fit(480));
    for (let count = 2; count <= 10; count++) {
      const width = count * 480 + (count - 1) * 6;
      expect(core.resolve(tree, view("p0"), fit(width - 1)).panes.filter(p => !p.hiddenInStack)).toHaveLength(count - 1);
      const next = core.resolve(tree, view("p0"), fit(width));
      expect(next.panes.filter(p => !p.hiddenInStack)).toHaveLength(count);
      expect(previous.folded.filter(id => !next.folded.includes(id))).toHaveLength(1);
      expect(next.folded.every(id => previous.folded.includes(id))).toBe(true);
      previous = next;
    }
    expect(previous.folded).toEqual([]);
  });
  it("joins a folded pane to the stack of its source, never to an unrelated neighbour", () => {
    // Old rule: c grew b's adjacent stack. New rule: c is linked from d, so c and d form their own group.
    const tree = freeze(layout(pane("a", "record"), pane("b", "record", { linkedTo: "a" }), pane("c", "record", { linkedTo: "d" }), pane("d", "record")));
    const result = core.resolve(tree, view("a"), fit(1024));
    expect(result.folded).toEqual(["c", "d"]);
    expect(result.panes.find(p => p.id === "c")!.stackId).toBe(result.panes.find(p => p.id === "d")!.stackId);
    // The c-d chain has no related home elsewhere, so the pair travels together to the nearest neighbour (b).
    expect(result.stacks).toHaveLength(1);
    expect(result.stacks[0]!.paneIds).toEqual(["b", "c", "d"]);
    expect(result.panes.find(p => p.id === "a")!.stackId).toBeUndefined();
  });
  it("keeps the receiving deliberate stack's active tab when a neighbour folds into it", () => {
    const tree = freeze(layout(pane("c", "inspector", { linkedTo: "b" }), { id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a", "record"), pane("b", "record")] }));
    const result = core.resolve(tree, { focusHistory: [] }, fit(600));
    expect(result.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["b"]);
    expect(result.folded).toEqual(["c"]);
    expect(core.resolve(tree, { focusHistory: [] }, fit(1000)).panes.find(p => p.id === "b")!.stackId).toBe("tabs");
  });
  it("returns local neighbour lengths for APG separators including max constraints", () => {
    const tree = layout(pane("a"), pane("b"));
    const result = core.resolve(tree, view(), { ...fit(806), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 600 } } });
    expect(result.dividers[0]).toMatchObject({ parentId: "root", index: 0, axis: "row", min: 200, max: 600, value: 400, rect: { x: 400, width: 6 } });
  });
  it("honours maxWidth during flex allocation", () => {
    const result = core.resolve(layout(pane("a"), pane("b", "record")), view(), { ...fit(1206), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 200 } } });
    expect(result.panes.map(p => p.rect.width)).toEqual([200, 1000]);
  });
  it("keeps a lone pane's impossible minimum explicit", () => {
    const result = core.resolve(layout(pane("a", "record")), view(), fit(390));
    expect(result.panes[0]!.rect.width).toBe(480);
  });
  it("honours a lone pane's maximum instead of stretching past it", () => {
    const result = core.resolve(layout(pane("a")), view(), { ...fit(1000), kinds: { ...kinds, small: { ...kinds.small!, maxWidth: 200 } } });
    expect(result.panes[0]!.rect.width).toBe(200);
  });
  it("partially unfolds large auto stacks up to the live pane cap", () => {
    const limited = createLayoutCore({ paneCap: 3 });
    const tree = layout({ id: "auto", type: "stack", origin: "auto", active: "d", size: { weight: 1 }, children: [pane("a"), pane("b"), pane("c"), pane("d")] });
    const result = limited.resolve(tree, view("d"), fit(1920));
    expect(result.panes.filter(p => !p.hiddenInStack)).toHaveLength(3);
    expect(result.panes.find(p => p.id === "d")!.hiddenInStack).not.toBe(true);
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
      const boxes = core.resolve(source, { focusHistory: [] }, fit([1920, 1440, 1280, 1024][sample % 4]!, 900)).panes;
      const visible = boxes.filter(b => !b.hiddenInStack);
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
    const result = core.resolve(tree, { ...view("b"), zoomed: "b" }, fit(1000));
    expect(result.dividers).toEqual([]);
    expect(result.panes[1]).toMatchObject({ rect: { x: 0, y: 0, width: 1000, height: 900 }, hiddenInStack: false });
    expect(result.panes[0]!.hiddenInStack).toBe(true);
  });
  it.each([NaN, Infinity, -1])("rejects invalid fit width %s", width => {
    expect(() => core.resolve(layout(pane("a")), view(), fit(width))).toThrow(RangeError);
  });
});
