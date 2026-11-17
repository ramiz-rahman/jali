import { describe, expect, it } from "vitest";
import { createLayoutCore } from "./index";
import { freeze } from "./test-utils";
import type { FitOptions, KindRegistry, Layout, ObjectRef, PaneNode, ViewState } from "./types";

// The "Order → customer chain" preset, with the registered kind minimums.
const kinds: KindRegistry = Object.fromEntries([["table", 480], ["record", 480]].map(([kind, minWidth]) => [kind, { kind, minWidth, minHeight: 240, title: () => String(kind) }])) as KindRegistry;
const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref, ...extra });
const chain = (): Layout => ({ version: 1, root: { id: "r", type: "row", size: { weight: 1 }, children: [
  pane("orders", { kind: "table", params: { table: "orders" } }, { size: { weight: 1.4 } }),
  pane("order", { kind: "record", params: { table: "orders", id: 1 } }, { linkedTo: "orders" }),
  pane("customer", { kind: "record", params: { table: "customers", id: 1 } }, { linkedTo: "order" }),
] } });
const fit = (width: number): FitOptions => ({ width, height: 900, gap: 6, kinds });
const view = (focused: string, history = [focused]): ViewState => ({ focused, focusHistory: history });
const core = createLayoutCore();
// What the screen shows: folds are decided by refit (at a structural or size change), then resolved.
const place = (tree: Layout, v: ViewState, f: FitOptions) => core.resolve(core.refit(tree, v, f), v, f);
const visible = (layout: Layout, v: ViewState, width: number) => place(freeze(layout), v, fit(width)).panes.filter(p => !p.hiddenInStack).map(p => p.id);

describe("collapse priority on the order chain", () => {
  it.each([[1920, ["orders", "order", "customer"]], [1440, ["orders", "order"]], [1280, ["orders", "order"]], [1024, ["orders", "order"]], [390, ["orders"]]])("focus on orders at %i px shows %j", (width, ids) => {
    expect(visible(chain(), view("orders"), width)).toEqual(ids);
  });
  it("folds customer behind its source (order), not order behind orders", () => {
    for (const width of [1440, 1280, 1024]) {
      const result = place(freeze(chain()), view("orders"), fit(width));
      expect(result.folded).toEqual(["customer"]);
      expect(result.panes.find(p => p.id === "customer")!.stackId).toBe(result.panes.find(p => p.id === "order")!.stackId);
      expect(result.panes.find(p => p.id === "orders")!.stackId).toBeUndefined();
      expect(result.stacks).toHaveLength(1);
      expect(result.stacks[0]).toMatchObject({ origin: "auto", homeId: "order", foldedCount: 1, paneIds: ["order", "customer"] });
    }
  });
  it("at 390 px everything joins the stack of its source", () => {
    const result = place(freeze(chain()), view("orders"), fit(390));
    expect(result.stacks).toHaveLength(1);
    expect(result.stacks[0]).toMatchObject({ homeId: "orders", foldedCount: 2 });
    expect(result.folded).toEqual(["order", "customer"]);
  });
  it("changes what is protected when focus moves", () => {
    // Focus on order: orders (source) and customer (detail) are both protected, so the whole chain stays.
    expect(visible(chain(), view("order"), 1440)).toHaveLength(2);
    const onOrder = place(freeze(chain()), view("order"), fit(1440));
    expect(onOrder.panes.find(p => p.id === "order")!.hiddenInStack).toBe(false);
    // Focus on customer: order (source) is protected; orders folds into order's stack.
    expect(visible(chain(), view("customer"), 1440)).toEqual(["order", "customer"]);
    const onCustomer = place(freeze(chain()), view("customer"), fit(1440));
    expect(onCustomer.stacks[0]).toMatchObject({ homeId: "order", paneIds: ["orders", "order"] });
  });
  it("breaks far-end ties by least recently focused", () => {
    // Focus on a: b and c are direct details (protected); d and e are two deep, then folded by recency.
    const tree: Layout = { version: 1, root: { id: "r", type: "row", size: { weight: 1 }, children: [
      pane("a", { kind: "table", params: {} }), pane("d", { kind: "record", params: { n: "d" } }, { linkedTo: "b" }),
      pane("b", { kind: "record", params: { n: "b" } }, { linkedTo: "a" }), pane("e", { kind: "record", params: { n: "e" } }, { linkedTo: "c" }),
      pane("c", { kind: "record", params: { n: "c" } }, { linkedTo: "a" }),
    ] } };
    const recentD = place(freeze(tree), view("a", ["a", "d", "e"]), fit(1938));
    expect(recentD.folded).toEqual(["e"]);
    expect(recentD.panes.find(p => p.id === "e")!.stackId).toBe(recentD.panes.find(p => p.id === "c")!.stackId);
    const recentE = place(freeze(tree), view("a", ["a", "e", "d"]), fit(1938));
    expect(recentE.folded).toEqual(["d"]);
    expect(recentE.panes.find(p => p.id === "d")!.stackId).toBe(recentE.panes.find(p => p.id === "b")!.stackId);
  });
  it("folds unlinked panes before linked ones and pinned panes last", () => {
    const tree: Layout = { version: 1, root: { id: "r", type: "row", size: { weight: 1 }, children: [
      pane("a", { kind: "table", params: {} }), pane("b", { kind: "record", params: { n: 1 } }, { linkedTo: "a" }),
      pane("x", { kind: "record", params: { n: 2 } }), pane("y", { kind: "record", params: { n: 3 } }, { pinned: true }),
    ] } };
    const result = place(freeze(tree), view("a"), fit(1452));
    expect(result.panes.filter(p => !p.hiddenInStack).map(p => p.id)).toEqual(["a", "b", "y"]);
    expect(result.folded).toEqual(["x"]);
    expect(result.stacks[0]!.paneIds).toEqual(["b", "x"]);
    expect(result.panes.find(p => p.id === "y")!.stackId).toBeUndefined();
  });
});
