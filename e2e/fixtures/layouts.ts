/** Layout builders shared by the specs. Layouts travel in the URL (`/?l=`), so a test can start from any tree. */
import * as core from "../../packages/core/src/layout";
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "../../packages/core/src/layout/types";

export type { Layout, LayoutNode, ObjectRef, PaneNode };

export const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref, ...extra });
export const row = (id: string, children: LayoutNode[]): LayoutNode => ({ id, type: "row", size: { weight: 1 }, children });
export const tbl = (table: string): ObjectRef => ({ kind: "table", params: { table } });
export const rec = (table: string, id: number): ObjectRef => ({ kind: "record", params: { table, id } });
export const query = (sql: string): ObjectRef => ({ kind: "query", params: { sql } });
export const audit = (): ObjectRef => ({ kind: "audit", params: {} });
export const catalog = (): ObjectRef => ({ kind: "catalog", params: {} });
export const layout = (root: LayoutNode): Layout => ({ version: 1, root });

/** A user-made tab group; `active` is the shown tab. */
export const stack = (id: string, active: string, children: PaneNode[]): LayoutNode => ({ id, type: "stack", size: { weight: 1 }, origin: "user", active, children });

/**
 * The URL path that opens a layout. This is the one place e2e depends on src: the link codec.
 * It accepts both the old `createLayoutCore().encode` and the new standalone `encode` export.
 */
type Codec = { encode?: (l: Layout) => string; createLayoutCore?: () => { encode: (l: Layout) => string } };
const encode = (l: Layout) => ((core as Codec).encode ?? (core as Codec).createLayoutCore!().encode)(l);
export const linkTo = (l: Layout) => `/?l=${encode(l)}`;

/** The orders table beside the customer 1 record, and any extra panes. */
export const customerWith = (...extra: PaneNode[]) => layout(row("r", [pane("c", rec("customers", 1)), ...extra]));

/** A table beside one pane that is either alone or a background tab behind another table. */
export const tabLayout = (hidden: boolean) =>
  layout(row("r", [
    pane("cat", catalog()),
    hidden ? stack("st", "t1", [pane("t1", tbl("orders")), pane("t2", tbl("suppliers"))]) : pane("t1", tbl("orders")),
  ]));

/** A table linked to a record whose row does not exist. */
export const goneRecord = () => layout(row("r", [pane("a", tbl("orders")), pane("b", rec("customers", 999999), { linkedTo: "a" })]));

export const SQL_PK = "SELECT id, name FROM customers WHERE id = 1";
export const SQL_NOPK = "SELECT name FROM customers WHERE id = 1";
export const queryResults = () => layout(row("r", [pane("c", rec("customers", 1)), pane("q1", query(SQL_PK)), pane("q2", query(SQL_NOPK))]));
