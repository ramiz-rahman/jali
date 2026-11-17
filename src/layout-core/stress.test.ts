import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { freeze, view } from "./test-utils";
import type { FitOptions, KindRegistry, Layout, LayoutNode, ObjectRef, PaneNode, ViewState } from "./types";

// Copy the stress preset's shape and kind minimums; keep UI imports out of the core.
const kinds: KindRegistry = Object.fromEntries([
  ["table", 480], ["record", 480], ["related", 380], ["audit", 380], ["structure", 440], ["er", 480],
].map(([kind, minWidth]) => [kind, { kind, minWidth, minHeight: 240, title: () => String(kind) }])) as KindRegistry;
const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref, ...extra });
const col = (id: string, children: LayoutNode[]): LayoutNode => ({ id, type: "column", size: { weight: 1 }, children });
const tbl = (table: string): ObjectRef => ({ kind: "table", params: { table } });
const rec = (table: string, id: number): ObjectRef => ({ kind: "record", params: { table, id } });
const stress = (): Layout => ({
  version: 1,
  root: { id: "r", type: "row", size: { weight: 1 }, children: [
    pane("s1", tbl("orders")),
    pane("s2", rec("orders", 1), { linkedTo: "s1" }),
    pane("s3", rec("customers", 1), { linkedTo: "s2" }),
    col("c1", [
      pane("s4", { kind: "related", params: { table: "orders", column: "customer_id", value: 1, label: "Orders by this customer" } }, { linkedTo: "s3" }),
      pane("s5", rec("products", 1)),
    ]),
    pane("s6", rec("suppliers", 1), { linkedTo: "s5" }),
    col("c2", [
      pane("s7", { kind: "related", params: { table: "reviews", column: "product_id", value: 1, label: "Reviews of this product" } }),
      pane("s8", { kind: "audit", params: {} }),
    ]),
    pane("s9", { kind: "structure", params: { table: "orders" } }),
    pane("s10", { kind: "er", params: { table: "orders" } }),
  ] },
});
const fit = (width: number): FitOptions => ({ width, height: 900, gap: 6, kinds });

describe("stress preset fitting", () => {
  const core = createLayoutCore();
  // What the screen shows: folds are decided by refit (at a structural or size change), then resolved.
  const place = (tree: Layout, v: ViewState, f: FitOptions) => core.resolve(core.refit(tree, v, f), v, f);
  it.each([[1920, 3], [1600, 3], [1440, 2], [1280, 2], [1024, 2], [390, 1]])("keeps %i px at %i visible panes", (width, count) => {
    const tree = freeze(stress());
    const result = place(tree, view("s1"), fit(width));
    const visible = result.panes.filter(p => !p.hiddenInStack);
    expect(result.panes).toHaveLength(10);
    expect(visible).toHaveLength(count);
    expect(result.folded).toHaveLength(10 - count);
    expect(visible.some(p => p.id === "s1")).toBe(true);
    for (const p of visible) {
      expect(p.rect.width).toBeGreaterThanOrEqual(kinds[p.id === "s9" ? "structure" : "record"]!.minWidth);
      if (width >= 480) expect(p.rect.x + p.rect.width).toBeLessThanOrEqual(width + 1e-7);
    }
    if (width === 1600) expect(new Set(result.panes.flatMap(p => p.stackId ? [p.stackId] : [])).size).toBeLessThanOrEqual(2);
  });

  // Link chains in the stress preset: s1-s2-s3-s4 and s5-s6. s7-s10 are unlinked.
  const chains: Record<string, string> = { s1: "A", s2: "A", s3: "A", s4: "A", s5: "B", s6: "B" };
  it.each([1920, 1440, 1280, 1024, 390])("never groups unrelated link chains in one auto stack at %i px", width => {
    const result = place(freeze(stress()), view("s1", ["s1"]), fit(width));
    const layout = stress();
    const panes = (function walk(n: LayoutNode): PaneNode[] { return n.type === "pane" ? [n] : n.children.flatMap(walk); })(layout.root);
    for (const stack of result.stacks) {
      expect(stack.paneIds).toContain(stack.homeId);
      expect(stack.foldedCount).toBeGreaterThan(0);
    }
    // A folded pane that has a source shares that source's stack, whichever chain it belongs to.
    for (const p of panes) {
      const box = result.panes.find(b => b.id === p.id)!;
      if (!p.linkedTo || !result.folded.includes(p.id)) continue;
      expect(result.panes.find(b => b.id === p.linkedTo)!.stackId).toBe(box.stackId);
    }
    expect(Object.keys(chains).length).toBe(6);
  });

  it("does not mix chains below the point where every chain must share a stack", () => {
    const result = place(freeze(stress()), view("s1", ["s1"]), fit(1920));
    const homeOf = (id: string) => result.stacks.find(s => s.paneIds.includes(id))!;
    // s2's folded detail s3 stays in s2's group at 1440, never in a separate chain's group.
    const narrow = place(freeze(stress()), view("s1", ["s1"]), fit(1440));
    expect(narrow.panes.find(p => p.id === "s3")!.stackId).toBe(narrow.panes.find(p => p.id === "s2")!.stackId);
    expect(homeOf("s3").paneIds).toContain("s4");
  });

  it("folds the far end of a chain first and protects the focused pane's neighbours", () => {
    const result = place(freeze(stress()), view("s1", ["s1"]), fit(1440));
    expect(result.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["s1", "s2"]);
    const other = place(freeze(stress()), view("s5", ["s5"]), fit(1440));
    expect(other.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["s5", "s6"]);
  });

  it("reverses folds progressively and deterministically as room returns", () => {
    const tree = freeze(stress());
    const widths = [390, 966, 1452, 1938, 2324, 2424, 2910, 3356, 3742];
    const counts = [1, 2, 3, 4, 5, 6, 7, 8, 10];
    const shrinking = [...widths].reverse().map(width => place(tree, view("s1"), fit(width)));
    let folded = new Set<string>(Array.from({ length: 9 }, (_, i) => `s${i + 2}`));
    for (const [i, width] of widths.entries()) {
      const result = place(tree, view("s1"), fit(width));
      expect(result).toEqual(shrinking[widths.length - i - 1]);
      expect(result.panes.filter(p => !p.hiddenInStack)).toHaveLength(counts[i]!);
      expect(result.folded.every(id => folded.has(id))).toBe(true);
      folded = new Set(result.folded);
    }
    expect(folded.size).toBe(0);
  });

  it.each([1920, 1600, 1440, 1280, 1024])("keeps focused context and source visible at %i px", width => {
    const result = place(freeze(stress()), view("s3"), fit(width));
    expect(result.panes.find(p => p.id === "s3")!.hiddenInStack).not.toBe(true);
    expect(result.panes.find(p => p.id === "s2")!.hiddenInStack).not.toBe(true);
  });
});

describe("sticky folding on the stress preset", () => {
  const core = createLayoutCore();
  const shape = (r: ReturnType<typeof core.resolve>) => r.panes.map(p => ({ id: p.id, rect: p.rect, stackId: p.stackId }));
  const members = (r: ReturnType<typeof core.resolve>) => r.stacks.map(s => s.paneIds);
  const visible = (r: ReturnType<typeof core.resolve>) => r.panes.filter(p => !p.hiddenInStack).map(p => p.id);

  it.each([1920, 1440])("at %i px, activating every tab and focusing every pane moves nothing", width => {
    const f = fit(width);
    let layout = core.refit(freeze(stress()), view("s1"), f);
    const base = core.resolve(layout, view("s1"), f);
    expect(base.stacks.length).toBeGreaterThan(0);
    for (const stack of base.stacks) for (const id of stack.paneIds) {
      layout = core.setActiveTab(layout, stack.id, id);
      const v = view(id);
      // A tab click focuses its pane; neither the click nor the focus refits.
      const after = core.resolve(layout, v, f);
      expect(shape(after)).toEqual(shape(base));
      expect(members(after)).toEqual(members(base));
      expect(after.panes.find(p => p.id === id)!.hiddenInStack).toBe(false);
      expect(after.panes.filter(p => p.stackId === stack.id && !p.hiddenInStack).map(p => p.id)).toEqual([id]);
    }
    for (const id of base.panes.map(p => p.id)) {
      const after = core.resolve(layout, view(id, [id, "s1"]), f);
      expect(shape(after)).toEqual(shape(base));
      expect(members(after)).toEqual(members(base));
      // Even a refit at the same size, with focus elsewhere, keeps the arrangement.
      expect(core.refit(layout, view(id, [id, "s1"]), f)).toBe(layout);
    }
  });

  it("folds and unfolds deterministically as the window resizes, and the same width restores the same arrangement", () => {
    const widths = [1920, 1600, 1440, 1280, 1024, 390];
    let layout = core.refit(freeze(stress()), view("s1"), fit(1920));
    const seen = new Map<number, ReturnType<typeof core.resolve>>();
    for (const width of widths) {
      layout = core.refit(layout, view("s1"), fit(width));
      seen.set(width, core.resolve(layout, view("s1"), fit(width)));
    }
    expect(visible(seen.get(390)!)).toHaveLength(1);
    // Grow back with focus moved around: each width shows exactly what it showed on the way down.
    for (const [i, width] of [...widths].reverse().entries()) {
      const v = view(`s${(i % 10) + 1}`);
      layout = core.refit(layout, v, fit(width));
      expect(core.resolve(layout, v, fit(width))).toEqual(seen.get(width));
    }
    expect(core.refit(layout, view("s1"), fit(4000)).fold).toBeUndefined();
    // Jumping straight to a width gives the same arrangement as getting there step by step.
    expect(core.resolve(core.refit(freeze(stress()), view("s1"), fit(1024)), view("s1"), fit(1024))).toEqual(seen.get(1024));
  });

  it("minimising gives the space to split neighbours and never unfolds; expanding takes it back", () => {
    const f = fit(1440);
    const layout = core.refit(freeze(stress()), view("s1"), f);
    const base = core.resolve(layout, view("s1"), f);
    const [first, second] = visible(base);
    const minimised = core.setCollapsed(layout, first!, true);
    const after = core.resolve(minimised, view(second!), f);
    expect(members(after)).toEqual(members(base));
    expect(visible(after)).toEqual(visible(base));
    expect(after.panes.find(p => p.id === first)!.rect.width).toBe(56);
    expect(after.panes.find(p => p.id === second)!.rect.width).toBeGreaterThan(base.panes.find(p => p.id === second)!.rect.width);
    // Only the direct neighbour grows; panes further along the split keep their rects.
    const wide = core.refit(freeze(stress()), view("s1"), fit(1920));
    const w0 = core.resolve(wide, view("s1"), fit(1920)), w1 = core.resolve(core.setCollapsed(wide, "s2", true), view("s1"), fit(1920));
    expect(w1.panes.find(p => p.id === "s3")!.rect).toEqual(w0.panes.find(p => p.id === "s3")!.rect);
    expect(w1.panes.find(p => p.id === "s1")!.rect.width).toBe(w0.panes.find(p => p.id === "s1")!.rect.width + w0.panes.find(p => p.id === "s2")!.rect.width - 56);
    // Restoring only ever folds (never unfolds) and here needs nothing.
    const restored = core.refit(core.setCollapsed(minimised, first!, false), view(first!), f, "fold");
    expect(core.resolve(restored, view(first!), f)).toEqual(base);
  });

  it("a reloaded or linked layout never unfolds into space a minimise freed", () => {
    const f = fit(1440);
    const layout = core.refit(freeze(stress()), view("s1"), f);
    const minimised = core.setCollapsed(layout, "s1", true);
    const reloaded = core.decode(core.encode(minimised), kinds)!;
    expect(core.refit(reloaded, view("s2"), f, "load").fold).toEqual(minimised.fold);
    // A real size change may use it.
    expect(core.refit(reloaded, view("s2"), f, "full").fold!.order.length).toBeLessThan(minimised.fold!.order.length);
    // A bigger screen still unfolds on load.
    expect(core.refit(reloaded, view("s2"), fit(4000), "load").fold).toBeUndefined();
  });

  it("carries recorded folds and tab choices through the link codec", () => {
    const f = fit(1440);
    let layout = core.refit(freeze(stress()), view("s1"), f);
    const stack = core.resolve(layout, view("s1"), f).stacks[0]!;
    layout = core.setActiveTab(layout, stack.id, stack.paneIds.at(-1)!);
    const decoded = core.decode(core.encode(layout), kinds)!;
    expect(decoded.fold).toEqual(layout.fold);
    expect(core.resolve(decoded, view("s1"), f)).toEqual(core.resolve(layout, view("s1"), f));
  });
});
