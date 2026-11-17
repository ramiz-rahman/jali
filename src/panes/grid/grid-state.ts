import type { ColumnInfo } from "../../data/types";
import { isNumericType } from "../format";

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

