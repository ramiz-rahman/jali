import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { freeze, view } from "./test-utils";
import type { FitOptions, KindRegistry, Layout, LayoutNode, ObjectRef, PaneNode } from "./types";

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
  it.each([[1920, 4], [1600, 3], [1440, 2], [1280, 2], [1024, 2], [390, 1]])("keeps %i px at %i visible panes", (width, count) => {
    const tree = freeze(stress());
    const result = core.resolve(tree, view("s1"), fit(width));
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

  it("reverses folds progressively and deterministically as room returns", () => {
    const tree = freeze(stress());
    const widths = [390, 966, 1452, 1898, 2284, 2770, 3256, 3742];
    const counts = [1, 2, 3, 4, 6, 7, 8, 10];
    const shrinking = [...widths].reverse().map(width => core.resolve(tree, view("s1"), fit(width)));
    let folded = new Set<string>(Array.from({ length: 9 }, (_, i) => `s${i + 2}`));
    for (const [i, width] of widths.entries()) {
      const result = core.resolve(tree, view("s1"), fit(width));
      expect(result).toEqual(shrinking[widths.length - i - 1]);
      expect(result.panes.filter(p => !p.hiddenInStack)).toHaveLength(counts[i]!);
      expect(result.folded.every(id => folded.has(id))).toBe(true);
      folded = new Set(result.folded);
    }
    expect(folded.size).toBe(0);
  });

  it.each([1920, 1600, 1440, 1280, 1024])("keeps focused context and source visible at %i px", width => {
    const result = core.resolve(freeze(stress()), view("s3"), fit(width));
    expect(result.panes.find(p => p.id === "s3")!.hiddenInStack).not.toBe(true);
    expect(result.panes.find(p => p.id === "s2")!.hiddenInStack).not.toBe(true);
  });
});
