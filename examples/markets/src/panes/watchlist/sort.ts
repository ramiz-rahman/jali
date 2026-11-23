/** How a watchlist sorts: by a column, either way, or in the list's own order. Pure, so the pane only keeps it. */
import { isRecord, oneOf } from "@jali-examples/shared/store";
import type { Instrument, Quote } from "../../market/types";

export type SortBy = "list" | "symbol" | "last" | "changePct" | "volume";
export interface Sort {
  by: SortBy;
  dir: 1 | -1;
}
export const LIST_ORDER: Sort = { by: "list", dir: 1 };

export interface Row {
  inst: Instrument;
  q: Quote | undefined;
}

/** What each column sorts by; an instrument whose price is not known yet sorts as 0. */
const KEY: Record<Exclude<SortBy, "list">, (r: Row) => number | string> = {
  symbol: (r) => r.inst.symbol,
  last: (r) => r.q?.last ?? 0,
  changePct: (r) => r.q?.changePct ?? 0,
  volume: (r) => r.q?.volume ?? 0,
};

/** The rows in `sort`'s order; the list's own order is theirs. */
export function sortRows<R extends Row>(rows: R[], { by, dir }: Sort): R[] {
  if (by === "list") return rows;
  const key = KEY[by];
  return rows.toSorted((a, b) => {
    const [x, y] = [key(a), key(b)];
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

/** A column header pressed: a new column sorts biggest first (names A to Z), then the other way, then list order. */
export function nextSort(current: Sort, by: SortBy): Sort {
  if (current.by !== by) return { by, dir: by === "symbol" ? 1 : -1 };
  return current.dir === 1 ? { by, dir: -1 } : LIST_ORDER;
}

/** The sort kept in pane state, as read back, or list order. */
export const parseSort = (v: unknown): Sort | undefined => {
  if (!isRecord(v)) return undefined;
  const by = oneOf<SortBy>(["list", "symbol", "last", "changePct", "volume"])(v.by);
  const dir = oneOf<1 | -1>([1, -1])(v.dir);
  return by && dir ? { by, dir } : undefined;
};
