import type { Layout, LayoutNode, ObjectRef, PaneNode } from "../layout-core/types";

export type PresetId = "one-table" | "order-chain" | "query-chart" | "stress-10";

const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id, type: "pane", size: { weight: 1 }, ref, ...extra,
});
const row = (id: string, children: LayoutNode[], weight = 1): LayoutNode => ({ id, type: "row", size: { weight }, children });
const col = (id: string, children: LayoutNode[], weight = 1): LayoutNode => ({ id, type: "column", size: { weight }, children });

const tbl = (table: string): ObjectRef => ({ kind: "table", params: { table } });
const rec = (table: string, id: number): ObjectRef => ({ kind: "record", params: { table, id } });

const SQL = "SELECT status, count(*)::int AS orders, sum(total_cents)::int AS total_cents\nFROM orders\nGROUP BY status\nORDER BY orders DESC";

export const PRESETS: { id: PresetId; label: string; build: () => Layout }[] = [
  {
    id: "one-table",
    label: "One table",
    build: () => ({ version: 1, root: row("r", [pane("catalog", { kind: "catalog", params: {} }, { size: { px: 280 } }), pane("orders", tbl("orders"), { linkedTo: "catalog" })]) }),
  },
  {
    id: "order-chain",
    label: "Order → customer chain",
    build: () => ({
      version: 1,
      root: row("r", [
        pane("orders", tbl("orders"), { size: { weight: 1.4 } }),
        pane("order", rec("orders", 1), { linkedTo: "orders" }),
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
        col("c", [pane("query", { kind: "query", params: { sql: SQL, autorun: 1 } }), pane("chart", { kind: "chart", params: { runId: "" } }, { linkedTo: "query" })], 1.6),
        pane("inspector", { kind: "structure", params: { table: "sample_orders" } }),
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
      ]),
    }),
  },
];

export const DEFAULT_PRESET: PresetId = "order-chain";
export const presetById = (id: PresetId) => PRESETS.find((p) => p.id === id)!;
