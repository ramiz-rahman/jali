/** Data Studio's layouts to start from (the bar's presets and ⌘K "Layout: …"). */
import type { LayoutNode, ObjectRef, PaneNode, Preset } from "@jali/core";

const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id, type: "pane", size: { weight: 1 }, ref, ...extra,
});
const row = (id: string, children: LayoutNode[], weight = 1): LayoutNode => ({ id, type: "row", size: { weight }, children });
const col = (id: string, children: LayoutNode[], weight = 1): LayoutNode => ({ id, type: "column", size: { weight }, children });

const ref = (kind: string, params: ObjectRef["params"]): ObjectRef => ({ kind, params });
const tbl = (table: string) => ref("table", { table });
const rec = (table: string, id: number) => ref("record", { table, id });

const SQL = "SELECT status, count(*)::int AS orders, sum(total_cents)::int AS total_cents\nFROM orders\nGROUP BY status\nORDER BY orders DESC";

export const dataStudioPresets: Preset[] = [
  {
    id: "one-table",
    label: "One table",
    build: () => ({ version: 1, root: row("r", [pane("catalog", ref("catalog", {}), { size: { px: 280 } }), pane("orders", tbl("orders"), { linkedTo: "catalog" })]) }),
  },
  {
    id: "order-chain",
    label: "Order → customer chain",
    build: () => ({
      version: 1,
      root: row("r", [
        pane("orders", tbl("orders"), { size: { weight: 1.4 } }),
        pane("order", rec("orders", 1), { linkedTo: "orders", follows: true }),
        pane("customer", rec("customers", 1), { linkedTo: "order" }),
      ]),
    }),
  },
  {
    id: "query-chart",
    label: "Query + chart + inspector",
    build: () => ({
      version: 1,
      root: row("r", [
        col("c", [pane("query", ref("query", { sql: SQL, autorun: 1 })), pane("chart", ref("chart", { runId: "" }), { linkedTo: "query" })], 1.6),
        pane("inspector", ref("structure", { table: "sample_orders" })),
      ]),
    }),
  },
  {
    id: "stress-10",
    label: "Stress: 10 panes",
    build: () => ({
      version: 1,
      root: row("r", [
        pane("s1", tbl("orders")),
        pane("s2", rec("orders", 1), { linkedTo: "s1", follows: true }),
        pane("s3", rec("customers", 1), { linkedTo: "s2" }),
        col("c1", [
          pane("s4", ref("related", { table: "orders", column: "customer_id", value: 1, label: "Orders by this customer" }), { linkedTo: "s3" }),
          pane("s5", rec("products", 1)),
        ]),
        pane("s6", rec("suppliers", 1), { linkedTo: "s5" }),
        col("c2", [
          pane("s7", ref("related", { table: "reviews", column: "product_id", value: 1, label: "Reviews of this product" })),
          pane("s8", ref("audit", {})),
        ]),
        pane("s9", ref("structure", { table: "orders" })),
        pane("s10", ref("er", { table: "orders" })),
      ]),
    }),
  },
];

/** The layout Data Studio opens on. */
export const DEFAULT_PRESET = "order-chain";
