import type {
  FitOptions,
  KindRegistry,
  Layout,
  LayoutNode,
  PaneNode,
  ViewState,
  ObjectRef,
} from "../types";

export const kinds: KindRegistry = Object.fromEntries(
  [
    ["list", 320, 120],
    ["record", 480, 200],
    ["inspector", 280, 100],
    ["small", 100, 80],
    ["wide", 640, 240],
  ].map(([kind, minWidth, minHeight]) => [
    kind,
    { kind, minWidth, minHeight, title: () => String(kind) },
  ]),
) as KindRegistry;
export const pane = (id: string, kind = "small", overrides: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  ref: { kind, params: { id } },
  size: { weight: 1 },
  ...overrides,
});
export const layout = (...children: LayoutNode[]): Layout => ({
  version: 1,
  root:
    children.length === 1
      ? children[0]!
      : { id: "root", type: "row", size: { weight: 1 }, children },
});
export const view = (focused = "a", history = [focused]): ViewState => ({
  focused,
  focusHistory: history,
});
export const fit = (width = 1440, height = 900): FitOptions => ({ width, height, gap: 6, kinds });
export const ref = (kind = "record", id: string | number = 1) => ({ kind, params: { id } });
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
export const context = (
  options: FitOptions = fit(),
  paneCap = 10,
): import("../types").LayoutContext => ({ fit: options, paneCap });
export const folded = (r: import("../types").ResolvedLayout) =>
  r.shelf.filter((e) => e.reason === "folded").map((e) => e.paneId);
export function stripBase(layout: Layout): Layout {
  const next = structuredClone(layout);
  const walk = (n: LayoutNode) => {
    delete n.base;
    if (n.type !== "pane") n.children.forEach(walk);
  };
  walk(next.root);
  return next;
}

export const chainKinds = {
  table: { kind: "table", minWidth: 480, minHeight: 240, title: () => "table" },
  record: { kind: "record", minWidth: 480, minHeight: 240, title: () => "record" },
};
export const chainFit = (width: number): FitOptions => ({
  width,
  height: 900,
  gap: 6,
  kinds: chainKinds,
});
const refPane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref,
  ...extra,
});
export const chain = (): Layout => ({
  version: 1,
  root: {
    id: "r",
    type: "row",
    size: { weight: 1 },
    children: [
      refPane("orders", { kind: "table", params: { table: "orders" } }, { size: { weight: 1.4 } }),
      refPane(
        "order",
        { kind: "record", params: { table: "orders", id: 1 } },
        { linkedTo: "orders" },
      ),
      refPane(
        "customer",
        { kind: "record", params: { table: "customers", id: 1 } },
        { linkedTo: "order" },
      ),
    ],
  },
});

// Copy the stress preset's shape and kind minimums; keep UI imports out of the core.
export const stressKinds: KindRegistry = Object.fromEntries(
  [
    ["table", 480],
    ["record", 480],
    ["related", 380],
    ["audit", 380],
    ["structure", 440],
    ["er", 480],
  ].map(([kind, minWidth]) => [
    kind,
    { kind, minWidth, minHeight: 240, title: () => String(kind) },
  ]),
) as KindRegistry;
const stressPane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref,
  ...extra,
});
const col = (id: string, children: LayoutNode[]): LayoutNode => ({
  id,
  type: "column",
  size: { weight: 1 },
  children,
});
const tbl = (table: string): ObjectRef => ({ kind: "table", params: { table } });
const rec = (table: string, id: number): ObjectRef => ({ kind: "record", params: { table, id } });
export const stress = (): Layout => ({
  version: 1,
  root: {
    id: "r",
    type: "row",
    size: { weight: 1 },
    children: [
      stressPane("s1", tbl("orders")),
      stressPane("s2", rec("orders", 1), { linkedTo: "s1" }),
      stressPane("s3", rec("customers", 1), { linkedTo: "s2" }),
      col("c1", [
        stressPane(
          "s4",
          {
            kind: "related",
            params: {
              table: "orders",
              column: "customer_id",
              value: 1,
              label: "Orders by this customer",
            },
          },
          { linkedTo: "s3" },
        ),
        stressPane("s5", rec("products", 1)),
      ]),
      stressPane("s6", rec("suppliers", 1), { linkedTo: "s5" }),
      col("c2", [
        stressPane("s7", {
          kind: "related",
          params: {
            table: "reviews",
            column: "product_id",
            value: 1,
            label: "Reviews of this product",
          },
        }),
        stressPane("s8", { kind: "audit", params: {} }),
      ]),
      stressPane("s9", { kind: "structure", params: { table: "orders" } }),
      stressPane("s10", { kind: "er", params: { table: "orders" } }),
    ],
  },
});
export const stressFit = (width: number): FitOptions => ({
  width,
  height: 900,
  gap: 6,
  kinds: stressKinds,
});
