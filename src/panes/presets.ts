/** Data Studio's layouts to start from (the bar's presets and ⌘K "Layout: …"). */
import { column, pane, row, type PresetOptions } from "@jali/core";
import { auditKind } from "./kinds/audit";
import { catalogKind } from "./kinds/catalog";
import { chartKind } from "./kinds/chart";
import { erKind } from "./kinds/er";
import { queryKind } from "./kinds/query";
import { recordKind } from "./kinds/record";
import { relatedKind } from "./kinds/related";
import { structureKind } from "./kinds/structure";
import { tableKind } from "./kinds/table";

const table = (name: string) => tableKind({ table: name });
const record = (name: string, id: number) => recordKind({ table: name, id });

const SQL =
  "SELECT status, count(*)::int AS orders, sum(total_cents)::int AS total_cents\nFROM orders\nGROUP BY status\nORDER BY orders DESC";

// Ids are spelled out: links and saved layouts name panes by id.
export const dataStudioPresets: PresetOptions[] = [
  {
    id: "one-table",
    label: "One table",
    layout: () =>
      row(
        { id: "r" },
        pane(catalogKind(), { id: "catalog", px: 280 }),
        pane(table("orders"), { id: "orders", linkedTo: "catalog" }),
      ),
  },
  {
    id: "order-chain",
    label: "Order → customer chain",
    layout: () =>
      row(
        { id: "r" },
        pane(table("orders"), { id: "orders", weight: 1.4 }),
        pane(record("orders", 1), { id: "order", linkedTo: "orders", follows: true }),
        pane(record("customers", 1), { id: "customer", linkedTo: "order" }),
      ),
  },
  {
    id: "query-chart",
    label: "Query + chart + inspector",
    layout: () =>
      row(
        { id: "r" },
        column(
          { id: "c", weight: 1.6 },
          pane(queryKind({ sql: SQL, autorun: 1 }), { id: "query" }),
          pane(chartKind({ runId: "" }), { id: "chart", linkedTo: "query" }),
        ),
        pane(structureKind({ table: "sample_orders" }), { id: "inspector" }),
      ),
  },
  {
    id: "stress-10",
    label: "Stress: 10 panes",
    layout: () =>
      row(
        { id: "r" },
        pane(table("orders"), { id: "s1" }),
        pane(record("orders", 1), { id: "s2", linkedTo: "s1", follows: true }),
        pane(record("customers", 1), { id: "s3", linkedTo: "s2" }),
        column(
          { id: "c1" },
          pane(
            relatedKind({
              table: "orders",
              column: "customer_id",
              value: 1,
              label: "Orders by this customer",
            }),
            { id: "s4", linkedTo: "s3" },
          ),
          pane(record("products", 1), { id: "s5" }),
        ),
        pane(record("suppliers", 1), { id: "s6", linkedTo: "s5" }),
        column(
          { id: "c2" },
          pane(
            relatedKind({
              table: "reviews",
              column: "product_id",
              value: 1,
              label: "Reviews of this product",
            }),
            { id: "s7" },
          ),
          pane(auditKind(), { id: "s8" }),
        ),
        pane(structureKind({ table: "orders" }), { id: "s9" }),
        pane(erKind({ table: "orders" }), { id: "s10" }),
      ),
  },
];

/** The layout Data Studio opens on. */
export const DEFAULT_PRESET = "order-chain";
