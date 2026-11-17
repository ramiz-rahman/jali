import type { ColumnInfo, EntityKey, ObjectRef, Relation, Row, TableInfo, TableName } from "../data/types";

export const NUMERIC_TYPES = /^(int|integer|bigint|smallint|numeric|decimal|real|double|float|serial)/i;
export const isNumericType = (type: string) => NUMERIC_TYPES.test(type.trim());

export function isMoneyColumn(name: string) { return /_cents$/.test(name); }
export function isJsonColumn(name: string) { return /_json$/.test(name); }

/** Column header text: money columns drop "_cents" and read as a plain title ("unit_price_cents" -> "Unit price"). */
export function columnLabel(name: string): string {
  if (!isMoneyColumn(name)) return name;
  const words = name.replace(/_cents$/, "").split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Minor units as money: 12500 -> "125.00". */
export const formatMoney = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const partsOf = (f: Intl.DateTimeFormat, d: Date) => Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));

/** ISO timestamp -> "1 Jan 2026, 10:30" (UTC, 24-hour); date only -> "1 Jan 2026". Anything else -> null. */
export function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = ISO.exec(value.trim());
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const d = new Date(hasTime ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${m[6] ?? "Z"}`.replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : `${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const p = partsOf(hasTime ? stamp : day, d);
  const month = p.month === "Sept" ? "Sep" : p.month;
  const date = `${p.day} ${month} ${p.year}`;
  return hasTime ? `${date}, ${p.hour}:${p.minute}` : date;
}

/** JSON text on one line with no extra spaces. Invalid JSON is returned as it came. */
export function formatJson(text: string, pretty = false): string {
  try { return JSON.stringify(JSON.parse(text), null, pretty ? 2 : undefined); } catch { return text; }
}

export type CellKind = "null" | "money" | "time" | "json" | "number" | "text";
export function cellKind(value: string | number | null | undefined, column?: { name: string; type?: string }): CellKind {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return column && isMoneyColumn(column.name) ? "money" : "number";
  if (column && isJsonColumn(column.name)) return "json";
  return formatTimestamp(value) !== null ? "time" : "text";
}

/** The value as stored: ISO text, raw cents, raw JSON. Used for tooltips and copy. */
export const rawText = (value: string | number | null | undefined) => (value === null || value === undefined ? "NULL" : String(value));

/** Display text for one cell. null is rendered as a chip by the caller; this returns "" for null. */
export function formatCell(value: string | number | null | undefined, column?: { name: string; type?: string }): string {
  switch (cellKind(value, column)) {
    case "null": return "";
    case "money": return formatMoney(value as number);
    case "number": return Number.isInteger(value) ? (value as number).toLocaleString("en-US") : String(value);
    case "time": return formatTimestamp(value) ?? String(value);
    case "json": return formatJson(String(value));
    default: return String(value);
  }
}

export function isNumericValue(v: unknown): v is number { return typeof v === "number"; }

/** Counts: 1,234. */
export const formatCount = (n: number) => n.toLocaleString("en-US");

/** Short duration for run stats. */
export const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);

/** Compact axis number: 1.2k, 3.4M. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}k`;
  return trim(n);
}
const trim = (n: number) => String(Math.round(n * 10) / 10);

/** Composite primary keys are joined with ":" in column order, e.g. "789:2". */
export function rowId(columns: ColumnInfo[], row: Row): string {
  const pk = columns.filter((c) => c.primaryKey);
  const cols = pk.length ? pk : columns.slice(0, 1);
  return cols.map((c) => String(row[c.name] ?? "")).join(":");
}

export const recordRef = (table: TableName, id: string | number): ObjectRef => ({ kind: "record", params: { table, id } });
export const tableRef = (table: TableName): ObjectRef => ({ kind: "table", params: { table } });
export const structureRef = (table: TableName): ObjectRef => ({ kind: "structure", params: { table } });
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

/** Entity keys a patch touches, mirroring what updateRow returns. */
export const entityKey = (table: TableName, id: string): EntityKey => ({ table, id });

/** Column filters: a typed value becomes a number for numeric columns. */
export function parseFilter(column: ColumnInfo, text: string): string | number | null {
  const t = text.trim();
  if (!t) return null;
  if (isNumericType(column.type)) { const n = Number(t); return Number.isFinite(n) ? n : null; }
  return t;
}

/** Sort cycle: none -> asc -> desc -> none. */
export type SortState = { column: string; dir: "asc" | "desc" } | null;
export function nextSort(cur: SortState, column: string): SortState {
  if (!cur || cur.column !== column) return { column, dir: "asc" };
  return cur.dir === "asc" ? { column, dir: "desc" } : null;
}
export const orderByString = (s: SortState) => (s ? `${s.column} ${s.dir.toUpperCase()}` : undefined);

/** Which text columns can be edited inline: text-like, not keys. */
export function isEditable(c: ColumnInfo): boolean {
  return !c.primaryKey && !c.references && !isNumericType(c.type) && !/(_json|_at)$/.test(c.name) && c.name !== "email_verified";
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
export { singular } from "../data/tables";
import { singular } from "../data/tables";

/** Pick a label column (first text) and a value column (first numeric) for charting a result. */
export function pickChartColumns(rows: Row[], columns: string[]): { x: string | null; y: string | null } {
  const sample = rows[0];
  if (!sample) return { x: null, y: null };
  const y = columns.find((c) => typeof sample[c] === "number" && !/(^id$|_id$)/.test(c)) ?? columns.find((c) => typeof sample[c] === "number") ?? null;
  const x = columns.find((c) => c !== y && typeof sample[c] === "string") ?? columns.find((c) => c !== y) ?? null;
  return { x, y };
}

export function tableInfoOf(catalog: TableInfo[] | undefined, name: string): TableInfo | undefined {
  return catalog?.find((t) => t.name === name);
}
