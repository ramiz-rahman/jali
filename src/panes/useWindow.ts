import { useCallback, useRef, useState } from "react";
import type { Row, TableName } from "../data/types";
import { useRows, type RowsOpts } from "../data/hooks";

const BLOCK = 100;

/** Windowed rows for a grid: fetches a 200-row block around the visible range; keeps the last rows while the next block loads. */
export function useWindowRows(table: TableName, base: Omit<RowsOpts, "limit" | "offset">, paused: boolean) {
  const [start, setStart] = useState(0);
  const onRange = useCallback((s: number) => setStart((cur) => { const b = Math.floor(s / BLOCK) * BLOCK; return b === cur ? cur : b; }), []);
  const q = useRows(table, { ...base, limit: BLOCK * 2, offset: start }, { paused });
  const last = useRef<{ rows: Row[]; offset: number; total: number } | null>(null);
  if (q.data) last.current = { rows: q.data.rows, offset: start, total: q.data.total };
  return { q, rows: last.current?.rows ?? [], offset: last.current?.offset ?? 0, total: last.current?.total ?? 0, onRange };
}
