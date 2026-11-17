import type { ColumnInfo, ObjectRef, Relation, Row, TableInfo, TableName } from "../../data/types";
import { isNumericType } from "../format";

/** Composite primary keys are joined with ":" in column order, e.g. "789:2". */
export function rowId(columns: ColumnInfo[], row: Row): string {
  const pk = columns.filter((c) => c.primaryKey);
  const cols = pk.length ? pk : columns.slice(0, 1);
  return cols.map((c) => String(row[c.name] ?? "")).join(":");
}

export const recordRef = (table: TableName, id: string | number): ObjectRef => ({ kind: "record", params: { table, id } });
export const tableRef = (table: TableName): ObjectRef => ({ kind: "table", params: { table } });
export const erRef = (table: TableName): ObjectRef => ({ kind: "er", params: { table } });
export const chartRef = (runId: string): ObjectRef => ({ kind: "chart", params: { runId } });

/** A relation becomes a related pane: its where clause is flattened to column/value params. */
export function relationRef(rel: Relation): ObjectRef {
  const [column, value] = Object.entries(rel.where)[0] ?? ["", ""];
  return { kind: "related", params: { table: rel.table, column, value, label: rel.label } };
}

/** The foreign key value of a cell, as a link to the record it points at. Null cells and plain columns have no link. */
export function foreignKeyRef(column: ColumnInfo, value: string | number | null | undefined): ObjectRef | null {
  if (!column.references || value === null || value === undefined || value === "") return null;
  return recordRef(column.references.table, String(value));
}

/** Which text columns can be edited inline: text-like, not keys. */
export function isEditable(c: ColumnInfo): boolean {
  return !c.primaryKey && !c.references && !isNumericType(c.type) && c.format !== "json" && !/_at$/.test(c.name) && c.name !== "email_verified";
}

/** Human title for a ref, used by the registry. */
export function titleFor(ref: ObjectRef): string {
  const p = ref.params;
  switch (ref.kind) {
    case "catalog": return "Tables";
    case "table": return String(p.table ?? "Table");
    case "record": return `${singular(String(p.table ?? "record"))} ${p.id ?? ""}`.trim();
    case "related": return String(p.label ?? "Related");
    case "query": return "Query";
    case "chart": return "Chart";
    case "structure": return `${p.table ?? ""} structure`.trim();
    case "er": return `${p.table ?? ""} relations`.trim();
    case "audit": return "Audit log";
    case "launcher": return "New pane";
    default: return ref.kind;
  }
}
export { singular } from "../../data/tables";
import { singular } from "../../data/tables";

export function tableInfoOf(catalog: TableInfo[] | undefined, name: string): TableInfo | undefined {
  return catalog?.find((t) => t.name === name);
}
