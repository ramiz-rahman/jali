import {
  context as ctx,
  chain,
  chainFit as fit,
  pane as genericPane,
  view,
  folded,
  freeze,
} from "./fixtures";
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import type { FitOptions, Layout, ObjectRef, PaneNode, ViewState } from "../types";

const refPane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}) =>
  genericPane(id, ref.kind, { ref, ...extra });
// What the screen shows: folds are decided by refit (at a structural or size change), then resolved.
const place = (tree: Layout, v: ViewState, f: FitOptions) =>
  core.resolve(core.refit(tree, v, ctx(f)), v, ctx(f));
const visible = (layout: Layout, v: ViewState, width: number) =>
  place(freeze(layout), v, fit(width))
    .panes.filter((p) => !p.hidden)
    .map((p) => p.id);

describe("collapse priority on the order chain", () => {
  it.each([
    [1920, ["orders", "order", "customer"]],
    [1440, ["orders", "order"]],
    [1280, ["orders", "order"]],
    [1024, ["orders", "order"]],
    [390, ["orders"]],
  ])("focus on orders at %i px shows %j", (width, ids) => {
    expect(visible(chain(), view("orders"), width)).toEqual(ids);
  });
  it("folds customer behind its source (order), not order behind orders", () => {
    for (const width of [1440, 1280, 1024]) {
      const result = place(freeze(chain()), view("orders"), fit(width));
      expect(folded(result)).toEqual(["customer"]);
      expect(result.panes.find((p) => p.id === "customer")!.stackId).toBe(
        result.panes.find((p) => p.id === "order")!.stackId,
      );
      expect(result.panes.find((p) => p.id === "orders")!.stackId).toBeUndefined();
      expect(result.stacks).toHaveLength(1);
      expect(result.stacks[0]).toMatchObject({
        kind: "fold",
        homeId: "order",
        paneIds: ["order", "customer"],
      });
    }
  });
  it("at 390 px everything joins the stack of its source", () => {
    const result = place(freeze(chain()), view("orders"), fit(390));
    expect(result.stacks).toHaveLength(1);
    expect(result.stacks[0]).toMatchObject({ homeId: "orders" });
    expect(folded(result)).toEqual(["order", "customer"]);
  });
  it("changes what is protected when focus moves", () => {
    // Focus on order: orders (source) and customer (detail) are both protected, so the whole chain stays.
    expect(visible(chain(), view("order"), 1440)).toHaveLength(2);
    const onOrder = place(freeze(chain()), view("order"), fit(1440));
    expect(onOrder.panes.find((p) => p.id === "order")!.hidden).toBeUndefined();
    // Focus on customer: order (source) is protected; orders folds into order's stack.
    expect(visible(chain(), view("customer"), 1440)).toEqual(["order", "customer"]);
    const onCustomer = place(freeze(chain()), view("customer"), fit(1440));
    expect(onCustomer.stacks[0]).toMatchObject({ homeId: "order", paneIds: ["orders", "order"] });
  });
  it("breaks far-end ties by least recently focused", () => {
    // Focus on a: b and c are direct details (protected); d and e are two deep, then folded by recency.
    const tree: Layout = {
      version: 1,
      root: {
        id: "r",
        type: "row",
        size: { weight: 1 },
        children: [
          refPane("a", { kind: "table", params: {} }),
          refPane("d", { kind: "record", params: { n: "d" } }, { linkedTo: "b" }),
          refPane("b", { kind: "record", params: { n: "b" } }, { linkedTo: "a" }),
          refPane("e", { kind: "record", params: { n: "e" } }, { linkedTo: "c" }),
          refPane("c", { kind: "record", params: { n: "c" } }, { linkedTo: "a" }),
        ],
      },
    };
    const recentD = place(freeze(tree), view("a", ["a", "d", "e"]), fit(1938));
    expect(folded(recentD)).toEqual(["e"]);
    expect(recentD.panes.find((p) => p.id === "e")!.stackId).toBe(
      recentD.panes.find((p) => p.id === "c")!.stackId,
    );
    const recentE = place(freeze(tree), view("a", ["a", "e", "d"]), fit(1938));
    expect(folded(recentE)).toEqual(["d"]);
    expect(recentE.panes.find((p) => p.id === "d")!.stackId).toBe(
      recentE.panes.find((p) => p.id === "b")!.stackId,
    );
  });
  it("folds unlinked panes before linked ones and pinned panes last", () => {
    const tree: Layout = {
      version: 1,
      root: {
        id: "r",
        type: "row",
        size: { weight: 1 },
        children: [
          refPane("a", { kind: "table", params: {} }),
          refPane("b", { kind: "record", params: { n: 1 } }, { linkedTo: "a" }),
          refPane("x", { kind: "record", params: { n: 2 } }),
          refPane("y", { kind: "record", params: { n: 3 } }, { pinned: true }),
        ],
      },
    };
    const result = place(freeze(tree), view("a"), fit(1452));
    expect(result.panes.filter((p) => !p.hidden).map((p) => p.id)).toEqual(["a", "b", "y"]);
    expect(folded(result)).toEqual(["x"]);
    expect(result.stacks[0]!.paneIds).toEqual(["b", "x"]);
    expect(result.panes.find((p) => p.id === "y")!.stackId).toBeUndefined();
  });
});
