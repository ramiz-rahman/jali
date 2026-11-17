import type { ColumnInfo, ObjectRef, Relation, Row, TableInfo, TableName } from "../../data/types";

/** Composite primary keys are joined with ":" in column order, e.g. "789:2". */
export function rowId(columns: ColumnInfo[], row: Row): string {
  const pk = columns.filter((c) => c.primaryKey);
  const cols = pk.length ? pk : columns.slice(0, 1);
  return cols.map((c) => String(row[c.name] ?? "")).join(":");
}

export const recordRef = (table: TableName, id: string | number): ObjectRef => ({ kind: "record", params: { table, id } });
/** The table a table-shaped ref points at. */
export const tableOf = (ref: ObjectRef): TableName => String(ref.params.table ?? "") as TableName;
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

export { singular } from "../../data/tables";

export function tableInfoOf(catalog: TableInfo[] | undefined, name: string): TableInfo | undefined {
  return catalog?.find((t) => t.name === name);
}
